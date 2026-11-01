import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { createDatabase } from '../../src/lib/server/db/index.js';
import { user } from '../../src/lib/server/db/schema.js';
import {
	completionActivityStatement,
	parseRoundActivity,
	recordRoundAbandon,
	recordRoundStart
} from '../../src/lib/server/activity.js';
import { saveRun } from '../../src/lib/server/runs.js';
import { createMemoryRound } from '../../src/lib/puzzles/memory/logic.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
let owner: string;
const now = 1800000000000;
function memory(id: string): CompletedRun {
	const round = createMemoryRound('42');
	const symbols = [...new Set(round.cards.map((card) => card.symbol))];
	return {
		version: 1,
		id,
		family: 'memory',
		engineVersion: 'memory-1',
		seed: '42',
		moves: symbols.flatMap((symbol) =>
			round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
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
	owner = crypto.randomUUID();
	await createDatabase(proxy.env.DB)
		.insert(user)
		.values({
			id: owner,
			name: 'Player',
			email: `${owner}@example.test`,
			emailVerified: true,
			createdAt: new Date(),
			updatedAt: new Date()
		});
});
afterAll(async () => {
	await proxy?.dispose();
});

it('validates activity payloads strictly', () => {
	const runId = crypto.randomUUID();
	const valid = { action: 'start', ownerKey: 'key', runId, family: 'memory', rankedSession: null };
	expect(parseRoundActivity(valid).round.runId).toBe(runId);
	for (const family of ['unknown', '__proto__', 'constructor', null, 1])
		expect(() => parseRoundActivity({ ...valid, family })).toThrow();
	expect(() => parseRoundActivity({ ...valid, extra: true })).toThrow();
	expect(() => parseRoundActivity({ ...valid, rankedSession: crypto.randomUUID() })).toThrow();
});

it('records explicit departures and reconciles completion in either request order', async () => {
	const db = proxy.env.DB;
	const first = { runId: crypto.randomUUID(), family: 'memory' as const, rankedSession: null };
	await recordRoundStart(db, owner, first, now);
	await recordRoundStart(db, owner, first, now);
	await recordRoundAbandon(db, owner, first, now + 1);
	await saveRun(db, owner, memory(first.runId), now + 2);
	await completionActivityStatement(db, owner, first.runId, now + 2).run();
	const row = await db
		.prepare('SELECT completed_at, abandoned_at FROM account_round_activity WHERE run_id=?')
		.bind(first.runId)
		.first<{ completed_at: number | null; abandoned_at: number | null }>();
	expect(row?.completed_at).not.toBeNull();
	expect(row?.abandoned_at).toBeNull();
	await recordRoundAbandon(db, owner, first, now + 3);
	expect(
		(
			await db
				.prepare('SELECT abandoned_at FROM account_round_activity WHERE run_id=?')
				.bind(first.runId)
				.first<{ abandoned_at: number | null }>()
		)?.abandoned_at
	).toBeNull();

	const second = { ...first, runId: crypto.randomUUID() };
	await saveRun(db, owner, memory(second.runId), now + 4);
	await recordRoundStart(db, owner, second, now + 5);
	expect(
		(
			await db
				.prepare('SELECT completed_at FROM account_round_activity WHERE run_id=?')
				.bind(second.runId)
				.first<{ completed_at: number | null }>()
		)?.completed_at
	).not.toBeNull();
	await expect(
		recordRoundStart(db, owner, { ...second, family: 'block' }, now + 6)
	).rejects.toMatchObject({ code: 'conflict' });
	const old = { ...first, runId: crypto.randomUUID() };
	await saveRun(db, owner, memory(old.runId), now + 7);
	await expect(recordRoundStart(db, owner, old, now + 40_000)).rejects.toMatchObject({
		code: 'activity_unavailable'
	});
});
