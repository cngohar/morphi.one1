import {
	anonymizeExpiredUsers,
	restoreDeletedUser,
	softDeleteUser
} from '../../src/lib/server/user-lifecycle.js';
import { abandonRanked, activeRanked } from '../../src/lib/server/ranked-session.js';
import { memoryOpeningMs, CARD_RANKED_OPENING_MS } from '../../src/lib/round-timing.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { eq, inArray } from 'drizzle-orm';
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
import { createConnectRound } from '../../src/lib/puzzles/connect/logic.js';
import { moderate } from '../../src/lib/server/moderation.js';
import { adminActor, adminAudit } from '../../src/lib/server/db/schema.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
import { generateTheme } from '../../src/lib/engine/theme/generator.js';
import {
	THEME_CONFIG_VERSION,
	THEME_GENERATOR_VERSION
} from '../../src/lib/engine/theme/config.js';
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
function connect(seed = '314159', id = crypto.randomUUID()): CompletedRun {
	const round = createConnectRound(seed);
	return {
		version: 1,
		id,
		family: 'connect',
		engineVersion: 'connect-1',
		seed,
		moves: round.solution.flatMap((path, pair) =>
			path.map((cell, at) => ({ pair, cell, stroke: pair, at: pair * 100 + at }))
		),
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
	it('enforces timed bans, preserves saved retries, and finalizes soft deletion at the deadline', async () => {
		const a = await owner();
		const actor = crypto.randomUUID();
		await proxy.env.DB.prepare("INSERT INTO admin_actor(id,role) VALUES (?,'admin')")
			.bind(actor)
			.run();
		const run = memory();
		const saved = await saveRun(proxy.env.DB, a, run, now);
		await moderate(proxy.env.DB, actor, 'ban', a, 'review reason', now + 1000);
		expect(await saveRun(proxy.env.DB, a, run, now + 1)).toEqual(saved);
		await proxy.env.DB.prepare(
			'INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)'
		)
			.bind(crypto.randomUUID(), crypto.randomUUID(), a, now + 5000, now, now)
			.run();
		await expect(saveRun(proxy.env.DB, a, memory(), now + 1)).rejects.toMatchObject({
			code: 'unavailable'
		});
		await expect(startRanked(proxy.env.DB, a, 'memory', a, now + 1)).rejects.toMatchObject({
			status: 429
		});
		await saveRun(proxy.env.DB, a, memory(), now + 1000);
		await startRanked(proxy.env.DB, a, 'memory', a, now + 1000);
		const { restoreUntil } = await softDeleteUser(proxy.env.DB, actor, a, 'review reason', 1, now);
		await expect(
			restoreDeletedUser(proxy.env.DB, actor, a, 'review reason', restoreUntil)
		).rejects.toMatchObject({ code: 'restore_expired_or_unavailable' });
		await anonymizeExpiredUsers(proxy.env.DB, restoreUntil);
		expect(await proxy.env.DB.prepare('SELECT id FROM user WHERE id=?').bind(a).first()).toBeNull();
		expect(
			await proxy.env.DB.prepare('SELECT id FROM completed_run WHERE user_id=?').bind(a).first()
		).toBeNull();
		expect(
			(
				await proxy.env.DB.prepare('SELECT anonymized_at FROM user_lifecycle WHERE user_id=?')
					.bind(a)
					.first<{ anonymized_at: number }>()
			)?.anonymized_at
		).toBe(restoreUntil);
	});
	it('restores only before the deadline and protects enrolled operators', async () => {
		const a = await owner();
		const actor = crypto.randomUUID();
		await proxy.env.DB.prepare("INSERT INTO admin_actor(id,role) VALUES (?,'admin')")
			.bind(actor)
			.run();
		const { restoreUntil } = await softDeleteUser(proxy.env.DB, actor, a, 'review reason', 1, now);
		await restoreDeletedUser(proxy.env.DB, actor, a, 'review reason', restoreUntil - 1);
		expect(
			await proxy.env.DB.prepare('SELECT id FROM user WHERE id=?').bind(a).first()
		).toBeTruthy();
		await proxy.env.DB.prepare(
			"INSERT INTO admin_web_operator(user_id,secret_cipher) VALUES (?,'test')"
		)
			.bind(a)
			.run();
		await expect(
			softDeleteUser(proxy.env.DB, actor, a, 'review reason', 1, now)
		).rejects.toMatchObject({ code: 'user_unavailable' });
	});

	it('replays Connect from path strokes and scores ranked time on the server', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'connect', a, now);
		const run = {
			...connect(issued.seed, issued.id),
			rankedSession: issued.id,
			theme: { configVersion: THEME_CONFIG_VERSION, generatorVersion: THEME_GENERATOR_VERSION }
		};
		const saved = await saveRun(proxy.env.DB, a, run, now + 60000);
		expect(saved.ranked).toBe(true);
		expect(saved.score).toBeGreaterThan(1000);
		expect((await leaderboard(proxy.env.DB, saved.group, 0, a)).rows).toHaveLength(1);
		await expect(
			saveRun(proxy.env.DB, a, { ...connect(), moves: run.moves.slice(0, -1) }, now)
		).rejects.toMatchObject({ code: 'invalid_replay' });
	});
	it('releases an invalid claimed replay and keeps an old retry from unlocking its replacement', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const complete = memory(issued.seed, issued.id);
		const invalid = {
			...complete,
			rankedSession: issued.id,
			moves: complete.moves.slice(0, -1)
		};
		const hash = await digest(JSON.stringify(parseRun(invalid)));

		expect(await activeRanked(proxy.env.DB, a, now)).toMatchObject({
			id: issued.id,
			saving: false
		});
		await expect(saveRun(proxy.env.DB, a, invalid, now + 30000)).rejects.toMatchObject({
			code: 'invalid_replay'
		});
		expect(
			await proxy.env.DB.prepare(
				'SELECT payload_hash AS payloadHash,claimed_at AS claimedAt,abandoned_at AS abandonedAt FROM play_session WHERE id=?'
			)
				.bind(issued.id)
				.first()
		).toEqual({ payloadHash: hash, claimedAt: now + 30000, abandonedAt: now + 30000 });
		expect(await activeRanked(proxy.env.DB, a, now + 30000)).toBeNull();

		const replacement = await startRanked(proxy.env.DB, a, 'block', a, now + 30001);
		await expect(saveRun(proxy.env.DB, a, invalid, now + 30002)).rejects.toMatchObject({
			code: 'invalid_replay'
		});
		expect(await activeRanked(proxy.env.DB, a, now + 30002)).toMatchObject({
			id: replacement.id,
			saving: false
		});
	});
	it('accepts a Connect all-pairs win with gaps and omits the grid bonus', async () => {
		const a = await owner();
		const round = createConnectRound('1');
		const moves = round.solution.flatMap((path, pair) =>
			(pair === 2 ? [path[0]!, path[1]!, path[2]!, path.at(-1)!] : path).map((cell, at) => ({
				pair,
				cell,
				stroke: pair,
				at: pair * 100 + at
			}))
		);
		const saved = await saveRun(proxy.env.DB, a, { ...connect('1'), moves }, now);
		expect(saved.ranked).toBe(false);
		expect(saved.score).toBe(round.pairs.length * 200 + (round.par - 10) * 10);
	});
	it('records authoritative theme snapshots and keeps legacy queued runs compatible', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		expect(issued.theme).toEqual(generateTheme(issued.seed, 'memory'));
		const run = {
			...memory(issued.seed, issued.id),
			rankedSession: issued.id,
			theme: { configVersion: THEME_CONFIG_VERSION, generatorVersion: THEME_GENERATOR_VERSION }
		};
		const saved = await saveRun(proxy.env.DB, a, run, now + 31000);
		const db = createDatabase(proxy.env.DB);
		const stored = await db.select().from(completedRun).where(eq(completedRun.id, run.id)).get();
		expect(stored?.themeConfigVersion).toBe(THEME_CONFIG_VERSION);
		expect(stored?.themeGeneratorVersion).toBe(THEME_GENERATOR_VERSION);
		expect(JSON.parse(stored!.themeSnapshot!)).toEqual(issued.theme);
		const legacy = memory();
		await saveRun(proxy.env.DB, a, legacy, now);
		expect(
			(await db.select().from(completedRun).where(eq(completedRun.id, legacy.id)).get())
				?.themeConfigVersion
		).toBe('curated-v1');
		const solo = { ...memory(), theme: run.theme };
		await saveRun(proxy.env.DB, a, solo, now);
		expect(
			JSON.parse(
				(await db.select().from(completedRun).where(eq(completedRun.id, solo.id)).get())!
					.themeSnapshot!
			)
		).toEqual(generateTheme(solo.seed, 'memory'));
		await expect(
			saveRun(
				proxy.env.DB,
				a,
				{ ...memory(), theme: { ...run.theme, configVersion: 'future' } },
				now
			)
		).rejects.toMatchObject({ code: 'theme_version' });
		await expect(
			saveRun(proxy.env.DB, a, { ...memory(), theme: { ...run.theme, colors: ['#ffffff'] } }, now)
		).rejects.toMatchObject({ code: 'theme_version' });
		expect((await saveRun(proxy.env.DB, a, run, now + 9000000)).score).toBe(saved.score);
		await db.delete(user).where(eq(user.id, a));
	});
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
		expect(
			(
				await db
					.select()
					.from(adminAudit)
					.where(inArray(adminAudit.actor, [admin, moderator]))
			).length
		).toBe(4);
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
	it('uses the issued Card allowance while legacy sessions keep their original timing', async () => {
		const a = await owner(),
			b = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const db = createDatabase(proxy.env.DB);
		const row = await db.select().from(playSession).where(eq(playSession.id, issued.id)).get();
		expect(row?.cardOpeningMs).toBe(CARD_RANKED_OPENING_MS);
		const legacyId = crypto.randomUUID();
		await db.insert(playSession).values({
			id: legacyId,
			userId: b,
			family: 'memory',
			seed: issued.seed,
			engineVersion: 'memory-1',
			createdAt: now,
			expiresAt: now + 7200000,
			ipHash: b
		});
		const legacy = await db.select().from(playSession).where(eq(playSession.id, legacyId)).get();
		expect(legacy?.cardOpeningMs).toBe(0);
		const opening = memoryOpeningMs(createMemoryRound(issued.seed).pairs);
		const current = await saveRun(
			proxy.env.DB,
			a,
			{ ...memory(issued.seed, issued.id), elapsedSeconds: 0, rankedSession: issued.id },
			now + 1000 + opening + CARD_RANKED_OPENING_MS + 10000
		);
		const previous = await saveRun(
			proxy.env.DB,
			b,
			{ ...memory(issued.seed, legacyId), elapsedSeconds: 0, rankedSession: legacyId },
			now + 1000 + opening + 10000
		);
		expect(current.score).toBe(previous.score);
		expect(current.score).toBe(createMemoryRound(issued.seed).pairs * 1000 - 50);
		expect(() => parseRun({ ...memory(), cardOpeningMs: 999999 })).toThrow();
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
				Math.floor(
					(30000 - memoryOpeningMs(createMemoryRound(issued.seed).pairs) - CARD_RANKED_OPENING_MS) /
						1000
				) *
					5
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
		const next = await startRanked(proxy.env.DB, a, 'memory', a, now + 1, first.id);
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
		const fast = await startRanked(proxy.env.DB, a, 'memory', a, now + 7200002);
		const fastRun = { ...memory(fast.seed, fast.id), rankedSession: fast.id };
		await expect(saveRun(proxy.env.DB, a, fastRun, now + 7201002)).rejects.toMatchObject({
			code: 'too_fast'
		});
		const fastSession = await proxy.env.DB.prepare(
			'SELECT payload_hash AS payloadHash,claimed_at AS claimedAt,abandoned_at AS abandonedAt FROM play_session WHERE id=?'
		)
			.bind(fast.id)
			.first();
		expect(fastSession).toEqual({
			payloadHash: await digest(JSON.stringify(parseRun(fastRun))),
			claimedAt: now + 7201002,
			abandonedAt: now + 7201002
		});
		expect(await activeRanked(proxy.env.DB, a, now + 7201002)).toBeNull();
		const afterFast = await startRanked(proxy.env.DB, a, 'memory', a, now + 7201003);
		expect((await activeRanked(proxy.env.DB, a, now + 7201003))?.id).toBe(afterFast.id);
	});
	it('resumes an interrupted claimed submission after expiry and a later start', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const run = { ...memory(issued.seed, issued.id), rankedSession: issued.id };
		await createDatabase(proxy.env.DB)
			.update(playSession)
			.set({ payloadHash: await digest(JSON.stringify(parseRun(run))), claimedAt: now + 30000 })
			.where(eq(playSession.id, run.id));
		await expect(
			startRanked(proxy.env.DB, a, 'block', a, now + 40000, issued.id)
		).rejects.toMatchObject({ code: 'ranked_active' });
		await abandonRanked(proxy.env.DB, a, issued.id, now + 40000);
		expect((await activeRanked(proxy.env.DB, a, now + 40000))?.saving).toBe(true);
		const replacement = await startRanked(proxy.env.DB, a, 'memory', a, now + 7200000);
		const saved = await saveRun(proxy.env.DB, a, run, now + 9000000);
		expect(saved.ranked).toBe(true);
		expect((await activeRanked(proxy.env.DB, a, now + 9000000))?.id).toBe(replacement.id);
		expect(saved.score).toBe(
			createMemoryRound(run.seed).pairs * 1000 -
				Math.floor(
					(29000 - memoryOpeningMs(createMemoryRound(run.seed).pairs) - CARD_RANKED_OPENING_MS) /
						1000
				) *
					5
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
	it('serializes account-wide starts, explicit takeover and stale-tab abandonment', async () => {
		const a = await owner();
		const starts = await Promise.allSettled(
			['memory', 'block', 'connect'].map((family) => startRanked(proxy.env.DB, a, family, a, now))
		);
		const successful = starts.filter((result) => result.status === 'fulfilled');
		expect(successful).toHaveLength(1);
		expect(
			starts
				.filter((result) => result.status === 'rejected')
				.every((result) => result.reason.code === 'ranked_active')
		).toBe(true);
		const old = successful[0]!.value;
		await expect(startRanked(proxy.env.DB, a, 'block', a, now + 7200000 - 1)).rejects.toMatchObject(
			{ code: 'ranked_active' }
		);
		const next = await startRanked(proxy.env.DB, a, 'connect', a, now + 100, old.id);
		await abandonRanked(proxy.env.DB, a, old.id, now + 101);
		expect((await activeRanked(proxy.env.DB, a, now + 101))?.id).toBe(next.id);
		await expect(
			startRanked(proxy.env.DB, a, 'memory', a, now + 102, old.id)
		).rejects.toMatchObject({ code: 'ranked_active' });
		const expired = await startRanked(proxy.env.DB, a, 'memory', a, now + 7200100);
		expect((await activeRanked(proxy.env.DB, a, now + 7200100))?.id).toBe(expired.id);
	});
	it('counts cross-family abandons and takeovers toward the cap without losing the prior round', async () => {
		const a = await owner();
		let current = await startRanked(proxy.env.DB, a, 'memory', a, now);
		await abandonRanked(proxy.env.DB, a, current.id, now + 1);
		current = await startRanked(proxy.env.DB, a, 'connect', a, now + 2);
		const families = ['memory', 'connect', 'block'];
		for (let index = 2; index <= 10; index++) {
			current = await startRanked(
				proxy.env.DB,
				a,
				families[index % 3]!,
				a,
				now + index + 1,
				current.id
			);
		}
		await expect(
			startRanked(proxy.env.DB, a, 'memory', a, now + 100, current.id)
		).rejects.toMatchObject({ status: 429 });
		expect((await activeRanked(proxy.env.DB, a, now + 101))?.id).toBe(current.id);
		const row = await proxy.env.DB.prepare('SELECT abandoned_at FROM play_session WHERE id=?')
			.bind(current.id)
			.first<{ abandoned_at: number | null }>();
		expect(row?.abandoned_at).toBeNull();
	});
	it('counts terminal replay failures toward the ranked abandonment cap', async () => {
		const a = await owner();
		for (let index = 0; index < 11; index++) {
			const startedAt = now + index * 1000;
			const issued = await startRanked(proxy.env.DB, a, 'memory', a, startedAt);
			const complete = memory(issued.seed, issued.id);
			const invalid = {
				...complete,
				rankedSession: issued.id,
				moves: complete.moves.slice(0, -1)
			};
			const failedAt = startedAt + 500;
			await expect(saveRun(proxy.env.DB, a, invalid, failedAt)).rejects.toMatchObject({
				code: 'invalid_replay'
			});
			const row = await proxy.env.DB.prepare(
				'SELECT abandoned_at AS abandonedAt FROM play_session WHERE id=?'
			)
				.bind(issued.id)
				.first<{ abandonedAt: number | null }>();
			expect(row?.abandonedAt).toBe(failedAt);
		}
		expect(await activeRanked(proxy.env.DB, a, now + 11000)).toBeNull();
		await expect(startRanked(proxy.env.DB, a, 'memory', a, now + 11000)).rejects.toMatchObject({
			status: 429
		});
	});
	it('keeps a valid claimed run retryable when its completed-run insert fails', async () => {
		const a = await owner();
		const issued = await startRanked(proxy.env.DB, a, 'memory', a, now);
		const run = { ...memory(issued.seed, issued.id), rankedSession: issued.id };
		const hash = await digest(JSON.stringify(parseRun(run)));
		const trigger = `reject_run_${issued.id.replaceAll('-', '')}`;
		await proxy.env.DB.prepare(
			`CREATE TRIGGER ${trigger} BEFORE INSERT ON completed_run WHEN NEW.id='${issued.id}' BEGIN SELECT RAISE(FAIL,'injected storage failure'); END`
		).run();
		try {
			await expect(saveRun(proxy.env.DB, a, run, now + 30000)).rejects.toBeDefined();
			expect(
				await proxy.env.DB.prepare(
					'SELECT payload_hash AS payloadHash,claimed_at AS claimedAt,abandoned_at AS abandonedAt FROM play_session WHERE id=?'
				)
					.bind(issued.id)
					.first()
			).toEqual({ payloadHash: hash, claimedAt: now + 30000, abandonedAt: null });
			expect(await activeRanked(proxy.env.DB, a, now + 30000)).toMatchObject({
				id: issued.id,
				saving: true
			});
			await expect(startRanked(proxy.env.DB, a, 'block', a, now + 30001)).rejects.toMatchObject({
				code: 'ranked_active'
			});
			await expect(
				startRanked(proxy.env.DB, a, 'block', a, now + 30001, issued.id)
			).rejects.toMatchObject({ code: 'ranked_active' });
		} finally {
			await proxy.env.DB.prepare(`DROP TRIGGER ${trigger}`).run();
		}
		await expect(saveRun(proxy.env.DB, a, run, now + 30002)).resolves.toMatchObject({
			id: issued.id,
			ranked: true
		});
		expect(await activeRanked(proxy.env.DB, a, now + 30002)).toBeNull();
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

it('versions scoring edits, freezes in-flight/past replay, separates boards and audits defaults', async () => {
	const { readScoreConfig, saveScoreConfig } = await import('../../src/lib/server/scoring.js');
	const { catalog } = await import('../../src/lib/catalog.js');
	const db = proxy.env.DB,
		userId = await owner();
	const before = await readScoreConfig(db, 'memory');
	const old = await startRanked(db, userId, 'memory', 'score-old', now);
	const oldRun = {
		...memory(old.seed, old.id),
		rankedSession: old.id,
		scoreConfigVersion: old.scoring.version
	};
	const edited = await saveScoreConfig(
		db,
		'test-operator',
		'memory',
		before.version,
		{ ...catalog.memory.scoring.defaults, pair: 2000 },
		'Local scoring test'
	);
	expect(edited.version).not.toBe(before.version);
	const savedOld = await saveRun(db, userId, oldRun, now + 60000);
	expect(savedOld.score).toBe(
		catalog.memory.replay(
			old.seed,
			oldRun.moves,
			Math.floor(
				(59000 - memoryOpeningMs(createMemoryRound(old.seed).pairs) - CARD_RANKED_OPENING_MS) / 1000
			),
			before.values
		).score
	);
	const newer = await startRanked(db, userId, 'memory', 'score-new', now + 70000);
	expect(newer.scoring).toEqual(edited);
	const newerRun = {
		...memory(newer.seed, newer.id),
		rankedSession: newer.id,
		scoreConfigVersion: edited.version
	};
	const savedNew = await saveRun(db, userId, newerRun, now + 130000);
	expect(savedNew.score).toBeGreaterThan(10000);
	expect((await saveRun(db, userId, oldRun, now + 140000)).score).toBe(savedOld.score);
	const row = await db
		.prepare('SELECT score_config_version FROM completed_run WHERE id=?')
		.bind(newer.id)
		.first<{ score_config_version: string }>();
	expect(row?.score_config_version).toBe(edited.version);
	const board = await leaderboard(db, savedOld.group, 0, userId);
	expect(board.scoreConfigVersion).toBe(edited.version);
	const historyAfterEdit = await accountHistory(db, userId);
	expect(historyAfterEdit.bests.every((best) => best.scoreConfigVersion === edited.version)).toBe(
		true
	);
	expect(
		historyAfterEdit.history.some((item) => item.scoreConfigVersion === old.scoring.version)
	).toBe(true);
	if (savedOld.group === savedNew.group)
		expect(board.rows.find((row) => row.own)?.score).toBe(savedNew.score);
	else expect(board.rows.find((row) => row.own)).toBeUndefined();
	const audit = await db
		.prepare(
			"SELECT before,after FROM admin_audit WHERE action='score-change' AND target='memory' ORDER BY created_at DESC LIMIT 1"
		)
		.first<{ before: string; after: string }>();
	expect(JSON.parse(audit!.before)).toEqual(before);
	expect(JSON.parse(audit!.after)).toEqual(edited);
	await expect(
		saveScoreConfig(
			db,
			'test-operator',
			'memory',
			edited.version,
			{ ...catalog.memory.scoring.defaults, pair: -1 },
			'Invalid'
		)
	).rejects.toThrow();
	expect(await readScoreConfig(db, 'memory')).toEqual(edited);
	await expect(
		saveScoreConfig(
			db,
			'test-operator',
			'memory',
			before.version,
			catalog.memory.scoring.defaults,
			'Stale'
		)
	).rejects.toMatchObject({ code: 'score_conflict' });
	const restored = await saveScoreConfig(
		db,
		'test-operator',
		'memory',
		edited.version,
		catalog.memory.scoring.defaults,
		'Restore',
		true
	);
	expect(restored.version).not.toBe(before.version);
	expect(restored.values).toEqual(catalog.memory.scoring.defaults);
	await expect(
		db
			.prepare('UPDATE score_config SET values_json=? WHERE version=?')
			.bind('{}', edited.version)
			.run()
	).rejects.toThrow('immutable');
	expect((await saveRun(db, userId, newerRun, now + 150000)).score).toBe(savedNew.score);
});
it('serializes concurrent score saves without orphan versions or audit records', async () => {
	const { readScoreConfig, saveScoreConfig } = await import('../../src/lib/server/scoring.js');
	const { catalog } = await import('../../src/lib/catalog.js');
	const db = proxy.env.DB,
		before = await readScoreConfig(db, 'connect');
	const outcomes = await Promise.allSettled(
		[100, 300].map((pair) =>
			saveScoreConfig(
				db,
				'race-operator',
				'connect',
				before.version,
				{ ...catalog.connect.scoring.defaults, pair },
				'Concurrent test'
			)
		)
	);
	expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
	const audit = await db
		.prepare("SELECT count(*) n FROM admin_audit WHERE actor='race-operator'")
		.first<{ n: number }>();
	expect(audit?.n).toBe(1);
	const current = await readScoreConfig(db, 'connect');
	expect([100, 300]).toContain(current.values.pair);
});

it('enforces game lifecycle for new ranked starts while keeping existing runs and audit', async () => {
	const { changeGame, gameAvailable } = await import('../../src/lib/server/games.js');
	const db = proxy.env.DB,
		actor = crypto.randomUUID(),
		id = await owner();
	await db.prepare("INSERT INTO admin_actor(id,role) VALUES(?,'admin')").bind(actor).run();
	const issued = await startRanked(db, id, 'connect', crypto.randomUUID(), now);
	await changeGame(db, actor, 'connect', 'game-disable', 'Maintenance', 7, now);
	expect(await gameAvailable(db, 'connect')).toBe(false);
	await expect(startRanked(db, id, 'connect', crypto.randomUUID(), now)).rejects.toMatchObject({
		code: 'game_disabled'
	});
	expect(
		await db.prepare('SELECT id FROM play_session WHERE id=?').bind(issued.id).first()
	).toBeTruthy();
	await changeGame(db, actor, 'connect', 'game-enable', 'Reopen game', 7, now);
	await changeGame(db, actor, 'connect', 'game-delete', 'Retire game', 7, now);
	await expect(
		changeGame(db, actor, 'connect', 'game-hard-delete', 'Confirm retirement', 7, now)
	).rejects.toMatchObject({ code: 'game_conflict' });
	await changeGame(db, actor, 'connect', 'game-restore', 'Restore game', 7, now + 1);
	await changeGame(db, actor, 'connect', 'game-delete', 'Retire game again', 1, now + 2);
	await changeGame(
		db,
		actor,
		'connect',
		'game-hard-delete',
		'Confirm retirement',
		7,
		now + 86400002
	);
	expect(
		await db.prepare('SELECT id FROM play_session WHERE id=?').bind(issued.id).first()
	).toBeTruthy();
	const audit = await db
		.prepare("SELECT count(*) AS n FROM admin_audit WHERE actor=? AND action LIKE 'game-%'")
		.bind(actor)
		.first<{ n: number }>();
	expect(audit?.n).toBe(6);
	await db
		.prepare("UPDATE game_lifecycle SET state='enabled',restore_until=NULL WHERE family='connect'")
		.run();
});
