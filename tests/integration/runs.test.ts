import { memoryOpeningMs } from '../../src/lib/round-timing.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { eq } from 'drizzle-orm';
import { createDatabase } from '../../src/lib/server/db/index.js';
import {
	user,
	player,
	completedRun,
	playSession,
	playerBan
} from '../../src/lib/server/db/schema.js';
import {
	accountHistory,
	digest,
	leaderboard,
	parseRun,
	saveRun,
	startRanked
} from '../../src/lib/server/runs.js';
import { createMemoryRound } from '../../src/lib/puzzles/memory/logic.js';
import { moderate } from '../../src/lib/server/moderation.js';
import { adminActor, adminAudit } from '../../src/lib/server/db/schema.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
let serial = 0;
const now = 1800000000000;
async function owner() {
	const id = crypto.randomUUID();
	const db = createDatabase(proxy.env.DB);
	await db.insert(user).values({
		id,
		name: 'Private Name',
		email: `${id}@example.test`,
		emailVerified: true,
		createdAt: new Date(),
		updatedAt: new Date()
	});
	await db.insert(player).values({
		userId: id,
		name: `player_${++serial}`,
		normalizedName: `player_${serial}`,
		updatedAt: new Date()
	});
	return id;
}
function memory(seed = '42', id = crypto.randomUUID()): CompletedRun {
	const round = createMemoryRound(seed);
	const symbols = [...new Set(round.cards.map((card) => card.symbol))];
	const moves = symbols.flatMap((symbol) =>
		round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
	);
	return {
		version: 1,
		id,
		family: 'memory',
		engineVersion: 'memory-1',
		seed,
		moves,
		elapsedSeconds: 10,
		rankedSession: null
	};
}
beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
		await proxy.env.DB.batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => proxy.env.DB.prepare(part))
		);
	}
});
afterAll(async () => {
	await proxy?.dispose();
});

describe('completed progress and ranked runs against real local D1', () => {
	it('checks moderation roles per action and audits mutations atomically', async () => {
		const a = await owner();
		const db = createDatabase(proxy.env.DB);
		const admin = crypto.randomUUID(),
			moderator = crypto.randomUUID(),
			support = crypto.randomUUID();
		await db.insert(adminActor).values([
			{ id: admin, role: 'admin' },
			{ id: moderator, role: 'moderator' },
			{ id: support, role: 'support' }
		]);
		await expect(moderate(proxy.env.DB, support, 'ban', a, 'test reason')).rejects.toMatchObject({
			code: 'permission'
		});
		await expect(
			moderate(proxy.env.DB, moderator, 'ranked-off', 'ranked', 'test reason')
		).rejects.toMatchObject({ code: 'permission' });
		await moderate(proxy.env.DB, moderator, 'ban', a, 'test reason');
		expect(await db.select().from(playerBan).where(eq(playerBan.userId, a)).get()).toBeDefined();
		await moderate(proxy.env.DB, moderator, 'unban', a, 'review completed');
		expect(await db.select().from(playerBan).where(eq(playerBan.userId, a)).get()).toBeUndefined();
		await moderate(proxy.env.DB, admin, 'ranked-off', 'ranked', 'test reason');
		await expect(startRanked(proxy.env.DB, a, 'memory', a, now)).rejects.toMatchObject({
			status: 429
		});
		await moderate(proxy.env.DB, admin, 'ranked-on', 'ranked', 'test reason');
		expect((await db.select().from(adminAudit)).length).toBe(4);
	});
	it('replays unranked history, isolates ownership, and never promotes it into a board', async () => {
		const a = await owner(),
			b = await owner();
		const run = memory();
		const result = await saveRun(proxy.env.DB, a, run, now);
		expect(result.ranked).toBe(false);
		expect(result.score).toBe(createMemoryRound(run.seed).pairs * 1000 - 50);
		expect((await accountHistory(proxy.env.DB, a)).history).toHaveLength(1);
		expect((await accountHistory(proxy.env.DB, b)).history).toEqual([]);
		await expect(saveRun(proxy.env.DB, b, run, now)).rejects.toMatchObject({ code: 'conflict' });
		expect((await leaderboard(proxy.env.DB, result.group, 0, a)).rows).toEqual([]);
	});
	it('calculates ranked score from server time and tolerates identical concurrent retries', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const run = { ...memory(issued.seed, issued.id), elapsedSeconds: 0, rankedSession: issued.id };
		const results = await Promise.all([
			saveRun(proxy.env.DB, a, run, now + 31000),
			saveRun(proxy.env.DB, a, run, now + 31000)
		]);
		expect(results[0]).toEqual(results[1]);
		expect(results[0].score).toBe(
			createMemoryRound(issued.seed).pairs * 1000 -
				Math.floor((30000 - memoryOpeningMs(createMemoryRound(issued.seed).pairs)) / 1000) * 5
		);
		expect((await accountHistory(proxy.env.DB, a)).history).toHaveLength(1);
		const board = await leaderboard(proxy.env.DB, results[0].group, 0, a);
		expect(board.own?.score).toBe(results[0].score);
		expect(JSON.stringify(board)).not.toContain('Private Name');
		await expect(
			saveRun(proxy.env.DB, a, { ...run, elapsedSeconds: 1 }, now + 40000)
		).rejects.toMatchObject({ code: 'conflict' });
		await expect(saveRun(proxy.env.DB, a, run, now + 9000000)).resolves.toEqual(results[0]);
	});
	it('rejects stolen sessions, forged seeds, supersession, expiry, and impossible durations', async () => {
		const a = await owner(),
			b = await owner();
		const first = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const run = { ...memory(first.seed, first.id), rankedSession: first.id };
		await expect(saveRun(proxy.env.DB, b, run, now + 30000)).rejects.toMatchObject({
			code: 'session'
		});
		await expect(
			saveRun(proxy.env.DB, a, { ...run, seed: first.seed === '42' ? '43' : '42' }, now + 30000)
		).rejects.toMatchObject({ code: 'session' });
		const next = await startRanked(proxy.env.DB, a, 'memory', a, now + 1);
		await expect(saveRun(proxy.env.DB, a, run, now + 30000)).rejects.toMatchObject({
			code: 'expired_or_superseded'
		});
		await expect(
			saveRun(
				proxy.env.DB,
				a,
				{ ...memory(next.seed, next.id), rankedSession: next.id },
				now + 7200001
			)
		).rejects.toMatchObject({ status: 410 });
		const fast = await startRanked(proxy.env.DB, a, 'memory', a, now + 2);
		await expect(
			saveRun(
				proxy.env.DB,
				a,
				{ ...memory(fast.seed, fast.id), rankedSession: fast.id },
				now + 1002
			)
		).rejects.toMatchObject({ code: 'too_fast' });
	});
	it('resumes an interrupted claimed submission after expiry and a later start', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const run = { ...memory(issued.seed, issued.id), rankedSession: issued.id };
		await createDatabase(proxy.env.DB)
			.update(playSession)
			.set({ payloadHash: await digest(JSON.stringify(parseRun(run))), claimedAt: now + 30000 })
			.where(eq(playSession.id, run.id));
		await startRanked(proxy.env.DB, a, 'memory', a, now + 40000);
		const saved = await saveRun(proxy.env.DB, a, run, now + 9000000);
		expect(saved.ranked).toBe(true);
		expect(saved.score).toBe(
			createMemoryRound(run.seed).pairs * 1000 -
				Math.floor((29000 - memoryOpeningMs(createMemoryRound(run.seed).pairs)) / 1000) * 5
		);
	});
	it('serializes competing payloads and a start racing submission without duplicate results', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const run = { ...memory(issued.seed, issued.id), rankedSession: issued.id };
		const outcomes = await Promise.allSettled([
			saveRun(proxy.env.DB, a, run, now + 30000),
			saveRun(proxy.env.DB, a, { ...run, elapsedSeconds: 11 }, now + 30000)
		]);
		expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
		expect((await accountHistory(proxy.env.DB, a)).history).toHaveLength(1);
		const issued2 = await startRanked(proxy.env.DB, a, 'memory', a, now + 40000);
		await Promise.allSettled([
			saveRun(
				proxy.env.DB,
				a,
				{ ...memory(issued2.seed, issued2.id), rankedSession: issued2.id },
				now + 70000
			),
			startRanked(proxy.env.DB, a, 'memory', a, now + 70001)
		]);
		expect((await accountHistory(proxy.env.DB, a)).history.length).toBeLessThanOrEqual(2);
	});
	it('enforces durable seed-shopping caps including concurrent starts', async () => {
		const a = await owner();
		const starts = await Promise.allSettled(
			Array.from({ length: 20 }, (_, i) => startRanked(proxy.env.DB, a, 'memory', a, now + i))
		);
		expect(starts.filter((result) => result.status === 'fulfilled').length).toBeLessThanOrEqual(11);
		await expect(startRanked(proxy.env.DB, a, 'memory', a, now + 100)).rejects.toMatchObject({
			status: 429
		});
	});
	it('reflects hidden scores, bans, and account deletion in public rankings', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const run = { ...memory(issued.seed, issued.id), rankedSession: issued.id };
		const result = await saveRun(proxy.env.DB, a, run, now + 30000);
		const db = createDatabase(proxy.env.DB);
		await db.update(completedRun).set({ hidden: true }).where(eq(completedRun.id, run.id));
		expect((await leaderboard(proxy.env.DB, result.group, 0, a)).own).toBeNull();
		await db.update(completedRun).set({ hidden: false }).where(eq(completedRun.id, run.id));
		await db.insert(playerBan).values({ userId: a, reason: 'test', createdAt: now });
		expect((await leaderboard(proxy.env.DB, result.group, 0, a)).own).toBeNull();
		await expect(saveRun(proxy.env.DB, a, memory(), now)).rejects.toMatchObject({ status: 403 });
		await expect(saveRun(proxy.env.DB, a, run, now)).resolves.toEqual(result);
		await db.delete(user).where(eq(user.id, a));
		expect((await accountHistory(proxy.env.DB, a)).history).toEqual([]);
		expect(await db.select().from(playSession).where(eq(playSession.userId, a))).toEqual([]);
	});
	it('rejects client scores, unknown versions, oversized logs, invalid moves, and incomplete games', async () => {
		const a = await owner();
		for (const bad of [
			{ ...memory(), score: 999999 },
			{ ...memory(), engineVersion: 'future' },
			{ ...memory(), moves: Array.from({ length: 121 }, () => ({ index: 0 })) },
			{ ...memory(), moves: [{ index: -1 }] },
			{ ...memory(), moves: [{ index: 0 }] },
			{ ...memory(), seed: '18446744073709551616' }
		]) {
			await expect(saveRun(proxy.env.DB, a, bad, now)).rejects.toBeDefined();
		}
		await expect(leaderboard(proxy.env.DB, 'unknown', 0, null)).rejects.toMatchObject({
			code: 'board'
		});
	});
});
