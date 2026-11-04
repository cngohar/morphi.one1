import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { catalog } from '../../src/lib/catalog.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
import { defaultScoreConfig } from '../../src/lib/scoring.js';
import { CARD_RANKED_OPENING_MS } from '../../src/lib/round-timing.js';
import { createMemoryRound } from '../../src/lib/puzzles/memory/logic.js';
import {
	parseRoundActivity,
	recordRoundStart,
	recordRoundPlay,
	recordRoundAbandon
} from '../../src/lib/server/activity.js';
import {
	changeVariant,
	enabledVariants,
	gameAvailable,
	gameStatistics
} from '../../src/lib/server/games.js';
import {
	accountHistory,
	leaderboard,
	parseRun,
	saveRun,
	startRanked
} from '../../src/lib/server/runs.js';
import { abandonRanked, resumableRanked } from '../../src/lib/server/ranked-session.js';
import {
	listScoreVersions,
	readScoreConfig,
	rollbackScoreConfig,
	saveScoreConfig
} from '../../src/lib/server/scoring.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const now = 1800000000000;
let userId: string;
function completion(variant?: string, seed = '42', id = crypto.randomUUID()): CompletedRun {
	const round = createMemoryRound(seed, variant);
	return {
		version: 1,
		id,
		family: 'memory',
		engineVersion: 'memory-1',
		seed,
		...(variant ? { variant } : {}),
		moves: [...new Set(round.cards.map((card) => card.symbol))].flatMap((symbol) =>
			round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
		),
		elapsedSeconds: 10,
		rankedSession: null
	};
}
beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((file) => file.endsWith('.sql')).sort()) {
		await proxy.env.DB.batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => proxy.env.DB.prepare(part))
		);
	}
	userId = crypto.randomUUID();
	await proxy.env.DB.batch([
		proxy.env.DB.prepare(
			'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
		).bind(userId, 'Player', `${userId}@example.test`, 1, now, now),
		proxy.env.DB.prepare(
			'INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)'
		).bind(userId, 'variantplayer', 'variantplayer', now),
		proxy.env.DB.prepare('INSERT INTO admin_actor(id,role) VALUES(?,?)').bind('operator', 'admin')
	]);
});
afterAll(async () => {
	await proxy?.dispose();
});

it('validates family-owned variant ids and preserves legacy classic payloads', () => {
	const legacy = completion();
	expect(parseRun(legacy)).toEqual(legacy);
	expect(parseRun(completion('memory:trios')).variant).toBe('memory:trios');
	for (const variant of ['block:classic', 'memory:unknown', null, 1])
		expect(() => parseRun({ ...legacy, variant })).toThrow();
	expect(() =>
		parseRun({
			...legacy,
			family: 'block',
			engineVersion: 'block-placement-1',
			variant: 'memory:classic'
		})
	).toThrow();
	const activity = {
		action: 'play',
		ownerKey: 'key',
		family: 'memory',
		runId: legacy.id,
		rankedSession: null,
		variant: 'memory:trios'
	};
	expect(parseRoundActivity(activity).action).toBe('play');
	expect(() => parseRoundActivity({ ...activity, variant: 'connect:trios' })).toThrow();
});

it('reconciles ignored, played, abandoned, finished and open independently of imported guest completions', async () => {
	const db = proxy.env.DB,
		variant = 'memory:moving';
	const rounds = Array.from({ length: 5 }, () => ({
		runId: crypto.randomUUID(),
		family: 'memory',
		rankedSession: null,
		variant
	}));
	for (const round of rounds) await recordRoundStart(db, userId, round, now);
	await recordRoundAbandon(db, userId, rounds[1], now + 1);
	for (const round of rounds.slice(2)) await recordRoundPlay(db, userId, round, now + 2);
	await recordRoundPlay(db, userId, rounds[2], now + 3);
	expect(
		await db
			.prepare('SELECT first_move_at FROM account_round_activity WHERE run_id=?')
			.bind(rounds[2].runId)
			.first()
	).toEqual({ first_move_at: now + 2 });
	await recordRoundAbandon(db, userId, rounds[2], now + 4);
	await expect(
		saveRun(db, userId, completion('memory:no-preview', '42', rounds[4].runId), now + 5)
	).rejects.toMatchObject({ code: 'session' });
	await saveRun(db, userId, completion(variant, '42', rounds[4].runId), now + 5);
	await saveRun(db, userId, completion(variant), now + 6);
	const counts = (await gameStatistics(db, 'memory')).variants.find((row) => row.id === variant)!;
	expect(counts).toMatchObject({
		shown: 5,
		ignored: 2,
		played: 3,
		abandoned: 1,
		finished: 1,
		open: 1,
		imported: 1,
		totalCompleted: 2
	});
	expect(counts.shown).toBe(counts.ignored + counts.played);
	expect(counts.played).toBe(counts.abandoned + counts.finished + counts.open);
	expect(counts.rows.reduce((sum, row) => sum + row.completed, 0)).toBe(2);
});

it('isolates shared pair scoring from trios and changes only future scores and live eligibility', async () => {
	const db = proxy.env.DB,
		variant = 'memory:trios';
	const original = defaultScoreConfig('memory', variant);
	expect(original).toEqual({
		version: 'memory-trios-v1',
		values: { trio: 1500, mismatch: 150, second: 5 }
	});
	const run = completion(variant);
	const saved = await saveRun(db, userId, run, now + 10);
	const edit = await saveScoreConfig(
		db,
		'operator',
		'memory',
		original.version,
		{ ...original.values, trio: 2000 },
		'Tune trios',
		false,
		undefined,
		variant
	);
	expect(await readScoreConfig(db, 'memory', undefined, undefined, variant)).toEqual(edit);
	for (const shared of ['memory:classic', 'memory:no-preview', 'memory:moving'])
		expect(await readScoreConfig(db, 'memory', undefined, undefined, shared)).toEqual(
			defaultScoreConfig('memory')
		);
	expect((await accountHistory(db, userId)).bests.some((row) => row.group === saved.group)).toBe(
		false
	);
	expect((await leaderboard(db, saved.group, 0, userId)).scoreConfigVersion).toBe(edit.version);
	const future = await saveRun(
		db,
		userId,
		{ ...completion(variant), scoreConfigVersion: edit.version },
		now + 11
	);
	expect(future.score).toBeGreaterThan(saved.score);
	expect((await saveRun(db, userId, run, now + 12)).score).toBe(saved.score);
	const before = (await gameStatistics(db, 'memory')).variants.find((row) => row.id === variant)!;
	const rollback = await rollbackScoreConfig(
		db,
		'operator',
		'memory',
		edit.version,
		original.version,
		'Restore trios',
		variant
	);
	expect(rollback.version).not.toBe(original.version);
	expect(rollback.values).toEqual(original.values);
	expect((await listScoreVersions(db, 'memory', variant)).map((row) => row.version)).toEqual(
		expect.arrayContaining([original.version, edit.version, rollback.version])
	);
	expect((await gameStatistics(db, 'memory')).variants.find((row) => row.id === variant)).toEqual(
		before
	);
	const pair = defaultScoreConfig('memory');
	const pairEdit = await saveScoreConfig(
		db,
		'operator',
		'memory',
		pair.version,
		{ ...pair.values, pair: 1200 },
		'Tune pairs'
	);
	for (const shared of ['memory:classic', 'memory:no-preview', 'memory:moving'])
		expect(await readScoreConfig(db, 'memory', undefined, undefined, shared)).toEqual(pairEdit);
	expect(await readScoreConfig(db, 'memory', undefined, undefined, variant)).toEqual(rollback);
});

it('persists authoritative ranked variants, counts ranked starts once, and permits completion after disable', async () => {
	const db = proxy.env.DB,
		variant = 'memory:no-preview';

	const classic = await startRanked(db, userId, 'memory', 'variant-ip', now - 30_000);
	await db.prepare('UPDATE play_session SET variant=NULL WHERE id=?').bind(classic.id).run();
	const legacy = { ...completion(undefined, classic.seed, classic.id), rankedSession: classic.id };
	const classicSaved = await saveRun(db, userId, legacy, now);
	expect(classicSaved.group).toMatch(/^memory-1:(6|8|10)$/);
	const session = await startRanked(
		db,
		userId,
		'memory',
		'variant-ip',
		now + 1000,
		null,
		undefined,
		variant
	);
	expect(await resumableRanked(db, userId, now + 1001)).toMatchObject({ variant });
	const round = { runId: session.id, family: 'memory', rankedSession: session.id, variant };
	await recordRoundStart(db, userId, round, now + 1002);
	await recordRoundPlay(db, userId, round, now + 1003);
	const run = {
		...completion(variant, session.seed, session.id),
		rankedSession: session.id,
		scoreConfigVersion: session.scoring.version
	};
	await expect(
		saveRun(db, userId, { ...run, variant: 'memory:moving' }, now + 2000)
	).rejects.toMatchObject({ code: 'session' });
	await changeVariant(
		db,
		'operator',
		'memory',
		variant,
		'variant-disable',
		'Test disable',
		now + 2001
	);
	await expect(
		startRanked(db, userId, 'memory', 'variant-ip', now + 2002, session.id, undefined, variant)
	).rejects.toMatchObject({ code: 'game_disabled' });
	const saved = await saveRun(db, userId, run, session.startedAt + CARD_RANKED_OPENING_MS + 10_000);
	expect(saved.group).toMatch(/^memory-1:no-preview:/);
	const counts = (await gameStatistics(db, 'memory')).variants.find((row) => row.id === variant)!;
	expect(counts).toMatchObject({
		shown: 1,
		ignored: 0,
		played: 1,
		finished: 1,
		abandoned: 0,
		open: 0,
		imported: 0
	});
	const board = await leaderboard(db, saved.group, 0, userId);
	expect(board.rows[0]?.score).toBe(saved.score);
	for (const entry of catalog.memory.variants!)
		if (entry.id !== variant)
			await changeVariant(
				db,
				'operator',
				'memory',
				entry.id,
				'variant-disable',
				'Test all disabled'
			);
	expect(await enabledVariants(db, 'memory')).toEqual([]);
	expect(await gameAvailable(db, 'memory')).toBe(false);
	await expect(
		changeVariant(db, 'nonoperator', 'memory', variant, 'variant-enable', 'Unauthorized')
	).rejects.toMatchObject({ code: 'game_conflict' });
	await changeVariant(db, 'operator', 'memory', variant, 'variant-enable', 'Restore variant');
	expect(await gameAvailable(db, 'memory')).toBe(true);
	expect(
		(
			await db
				.prepare("SELECT count(*) count FROM admin_audit WHERE action='variant-disable'")
				.first<{ count: number }>()
		)?.count
	).toBe(4);
	const replacement = await startRanked(
		db,
		userId,
		'memory',
		'variant-ip',
		now + 30_000,
		null,
		undefined,
		variant
	);
	await abandonRanked(db, userId, replacement.id, now + 30_001);
	const raced = await Promise.allSettled([
		changeVariant(db, 'operator', 'memory', variant, 'variant-disable', 'Concurrent disable'),
		startRanked(db, userId, 'memory', 'variant-ip', now + 40_000, null, undefined, variant)
	]);
	expect(raced[0].status).toBe('fulfilled');
	if (raced[1].status === 'fulfilled')
		await abandonRanked(db, userId, raced[1].value.id, now + 40_001);
	else expect(raced[1].reason).toMatchObject({ code: 'game_disabled' });
	expect(await gameAvailable(db, 'memory')).toBe(false);
	await expect(
		startRanked(db, userId, 'memory', 'variant-ip', now + 50_000, null, undefined, variant)
	).rejects.toMatchObject({ code: 'game_disabled' });
});

it('keeps a delayed first-flip report as played after an explicit departure', async () => {
	const db = proxy.env.DB;
	const round = {
		runId: crypto.randomUUID(),
		family: 'memory',
		variant: 'memory:classic',
		rankedSession: null
	};
	const before = (await gameStatistics(db, 'memory')).variants.find(
		(row) => row.id === round.variant
	)!;
	await recordRoundStart(db, userId, round, now + 100000);
	await recordRoundAbandon(db, userId, round, now + 100001);
	await recordRoundPlay(db, userId, round, now + 100002);
	await recordRoundPlay(db, userId, round, now + 100003);
	const after = (await gameStatistics(db, 'memory')).variants.find(
		(row) => row.id === round.variant
	)!;
	expect(after.shown).toBe(before.shown + 1);
	expect(after.played).toBe(before.played + 1);
	expect(after.abandoned).toBe(before.abandoned + 1);
	expect(after.ignored).toBe(before.ignored);
	expect(
		await db
			.prepare('SELECT first_move_at FROM account_round_activity WHERE run_id=?')
			.bind(round.runId)
			.first()
	).toEqual({ first_move_at: now + 100002 });
});
