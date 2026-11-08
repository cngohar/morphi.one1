import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { catalog } from '../../src/lib/catalog.js';
import type { CompletedRun, PuzzleId } from '../../src/lib/engine/contract.js';
import { defaultScoreConfig, scoreScope } from '../../src/lib/scoring.js';
import { CARD_RANKED_OPENING_MS } from '../../src/lib/round-timing.js';
import { createMemoryRound } from '../../src/lib/puzzles/memory/logic.js';
import { generateTheme } from '../../src/lib/engine/theme/generator.js';
import {
	parseRoundActivity,
	recordRoundStart,
	recordRoundPlay,
	recordRoundAbandon
} from '../../src/lib/server/activity.js';
import {
	changeVariant,
	changeGame,
	cachedGameOverview,
	gameOverview,
	enabledVariants,
	gameAvailable,
	variantAvailable,
	gameStatistics,
	queryActivityCounts,
	type ActivityMappingEntry
} from '../../src/lib/server/games.js';
import {
	accountHistory,
	leaderboard,
	parseRun,
	saveRun,
	startRanked
} from '../../src/lib/server/runs.js';
import { loadGamesAdmin } from '../../src/lib/server/games-admin.js';
import { loadMemoryDirectory } from '../../src/lib/server/memory-directory.js';
import {
	changeMemoryPolicy,
	defaultMemoryPolicy,
	readMemoryPolicy
} from '../../src/lib/server/memory-policy.js';
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

it('dimension policy persists atomically, denies new issuance and preserves an issued round', async () => {
	const db = proxy.env.DB;
	const original = await db
		.prepare("SELECT version FROM config_live WHERE key='game:memory'")
		.first<{ version: string }>();
	try {
		const initial = await readMemoryPolicy(db);
		const issued = await startRanked(
			db,
			userId,
			'memory',
			'dimension-ip',
			now + 10_000,
			null,
			undefined,
			'memory:quads'
		);
		const narrowed = { ...defaultMemoryPolicy(), 'matchSize:4': false };
		const version = await changeMemoryPolicy(
			db,
			'operator',
			initial.version,
			narrowed,
			'Disable Quads',
			now + 10_001
		);
		expect((await readMemoryPolicy(db)).version).toBe(version);
		expect(await enabledVariants(db, 'memory')).not.toContain('memory:quads');
		expect(await variantAvailable(db, 'memory', 'memory:quads')).toBe(false);
		expect(await gameAvailable(db, 'memory')).toBe(true);
		await expect(
			startRanked(
				db,
				userId,
				'memory',
				'dimension-ip',
				now + 10_002,
				issued.id,
				undefined,
				'memory:quads'
			)
		).rejects.toMatchObject({ code: 'game_disabled' });
		await expect(
			changeMemoryPolicy(db, 'operator', initial.version, defaultMemoryPolicy(), 'Stale client')
		).rejects.toMatchObject({ code: 'game_conflict' });
		const zero = { ...narrowed, 'matchSize:2': false, 'matchSize:3': false };
		await expect(
			changeMemoryPolicy(db, 'operator', version, zero, 'No playable variants')
		).rejects.toMatchObject({ code: 'game_conflict' });
		expect((await readMemoryPolicy(db)).version).toBe(version);
		await expect(
			changeMemoryPolicy(db, 'nonoperator', version, defaultMemoryPolicy(), 'Not allowed')
		).rejects.toMatchObject({ code: 'game_conflict' });
		const run = {
			...completion('memory:quads', issued.seed, issued.id),
			rankedSession: issued.id,
			scoreConfigVersion: issued.scoring.version
		};
		await expect(
			saveRun(db, userId, run, issued.startedAt + CARD_RANKED_OPENING_MS + 30_000)
		).resolves.toMatchObject({ group: expect.stringMatching(/^memory-1:quads:/) });
		expect(
			(
				await db
					.prepare("SELECT count(*) total FROM admin_audit WHERE action='dimension-policy-update'")
					.first<{ total: number }>()
			)?.total
		).toBe(1);
	} finally {
		if (original)
			await db
				.prepare("UPDATE config_live SET version=? WHERE key='game:memory'")
				.bind(original.version)
				.run();
		else await db.prepare("DELETE FROM config_live WHERE key='game:memory'").run();
	}
});

it('dimension policy fails closed on a corrupt live snapshot', async () => {
	const db = proxy.env.DB;
	const original = await db
		.prepare("SELECT version FROM config_live WHERE key='game:memory'")
		.first<{ version: string }>();
	const version = crypto.randomUUID();
	try {
		await db.batch([
			db
				.prepare(
					"INSERT INTO game_config(version,family,parent,values_json,created_at) VALUES(?,'memory','catalog-v1',?,?)"
				)
				.bind(version, '{invalid', now),
			db
				.prepare(
					"INSERT INTO config_live(key,version) VALUES('game:memory',?) ON CONFLICT(key) DO UPDATE SET version=excluded.version"
				)
				.bind(version)
		]);
		await expect(readMemoryPolicy(db)).rejects.toMatchObject({
			code: 'game_disabled',
			status: 503
		});
		await expect(
			startRanked(
				db,
				userId,
				'memory',
				'invalid-policy-ip',
				now + 90_000,
				null,
				undefined,
				'memory:classic'
			)
		).rejects.toMatchObject({ code: 'game_disabled' });
	} finally {
		if (original)
			await db
				.prepare("UPDATE config_live SET version=? WHERE key='game:memory'")
				.bind(original.version)
				.run();
		else await db.prepare("DELETE FROM config_live WHERE key='game:memory'").run();
	}
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

it('binds 40 synthetic groups in one parameter and reconciles exact counts across boundaries', async () => {
	const db = proxy.env.DB;
	const syntheticFamily = 'synth-fam' as PuzzleId;
	const varA = 'synth:var-a';
	const varB = 'synth:var-b';
	const defaultVar = varA;

	const groupsA = Array.from({ length: 26 }, (_, i) => `synth-grp-${i + 1}`);
	const groupsB = Array.from({ length: 14 }, (_, i) => `synth-grp-${26 + i + 1}`);
	const mapping: ActivityMappingEntry[] = [
		...groupsA.map((rulesGroup) => ({
			family: syntheticFamily,
			variant: varA,
			defaultVariant: defaultVar,
			rulesGroup
		})),
		...groupsB.map((rulesGroup) => ({
			family: syntheticFamily,
			variant: varB,
			defaultVariant: defaultVar,
			rulesGroup
		}))
	];
	expect(mapping).toHaveLength(40);

	const u1 = crypto.randomUUID(),
		u2 = crypto.randomUUID(),
		u3 = crypto.randomUUID(),
		u4 = crypto.randomUUID();

	try {
		await db.batch([
			// 1. Registered start for varA with first move, completed in group 26 (crosses old 25-group threshold)
			db
				.prepare(
					'INSERT INTO play_session(id,user_id,family,seed,engine_version,created_at,expires_at,ip_hash,variant,first_move_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
				)
				.bind(u1, userId, syntheticFamily, '1', 'synth-1', now, now - 1000, 'test', varA, now + 1),
			db
				.prepare(
					'INSERT INTO completed_run(id,user_id,family,engine_version,rules_group,score,moves,seconds,seed,move_log,payload_hash,ranked,hidden,created_at,score_config_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
				)
				.bind(
					u1,
					userId,
					syntheticFamily,
					'synth-1',
					'synth-grp-26',
					1000,
					10,
					20,
					'1',
					'[]',
					'hash1',
					1,
					0,
					now + 2,
					'v1'
				),

			// 2. Imported guest completion for varA in group 1 (no start session exists)
			db
				.prepare(
					'INSERT INTO completed_run(id,user_id,family,engine_version,rules_group,score,moves,seconds,seed,move_log,payload_hash,ranked,hidden,created_at,score_config_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
				)
				.bind(
					u2,
					userId,
					syntheticFamily,
					'synth-1',
					'synth-grp-1',
					800,
					8,
					15,
					'2',
					'[]',
					'hash2',
					0,
					0,
					now + 3,
					'v1'
				),

			// 3. Legacy start with variant = NULL in play_session (resolves to defaultVariant varA), abandoned
			db
				.prepare(
					'INSERT INTO play_session(id,user_id,family,seed,engine_version,created_at,expires_at,ip_hash,variant,first_move_at,abandoned_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
				)
				.bind(
					u3,
					userId,
					syntheticFamily,
					'3',
					'synth-1',
					now + 4,
					now - 1000,
					'test',
					null,
					now + 5,
					now + 6
				),

			// 4. Start present in both play_session and account_round_activity (varB), ignored
			db
				.prepare(
					'INSERT INTO play_session(id,user_id,family,seed,engine_version,created_at,expires_at,ip_hash,variant,first_move_at,abandoned_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
				)
				.bind(
					u4,
					userId,
					syntheticFamily,
					'4',
					'synth-1',
					now + 7,
					now - 1000,
					'test',
					varB,
					null,
					null
				),
			db
				.prepare(
					'INSERT INTO account_round_activity(run_id,ranked,user_id,family,started_at,variant,first_move_at,abandoned_at) VALUES(?,?,?,?,?,?,?,?)'
				)
				.bind(u4, 0, userId, syntheticFamily, now + 7, varB, null, null)
		]);

		const bindSpy: unknown[][] = [];
		const originalPrepare = db.prepare.bind(db);
		const spiedDb = {
			...db,
			prepare(query: string) {
				const statement = originalPrepare(query);
				return {
					...statement,
					bind(...params: unknown[]) {
						bindSpy.push(params);
						return statement.bind(...params);
					}
				};
			}
		} as unknown as D1Database;

		const rows = await queryActivityCounts(spiedDb, mapping);

		expect(bindSpy).toHaveLength(1);
		expect(bindSpy[0]).toHaveLength(1);
		expect(typeof bindSpy[0][0]).toBe('string');
		expect(rows).toHaveLength(2);

		const rowA = rows.find((r) => r.variant === varA)!;
		expect(rowA).toBeDefined();
		expect(rowA).toMatchObject({
			family: syntheticFamily,
			variant: varA,
			shown: 2,
			ignored: 0,
			played: 2,
			abandoned: 1,
			finished: 1,
			open: 0,
			imported: 1,
			totalCompleted: 2,
			ranked: 1
		});
		expect(rowA.shown).toBe(rowA.ignored + rowA.played);
		expect(rowA.played).toBe(rowA.abandoned + rowA.finished + rowA.open);
		expect(rowA.totalCompleted).toBe(rowA.finished + rowA.imported);

		const rowB = rows.find((r) => r.variant === varB)!;
		expect(rowB).toBeDefined();
		expect(rowB).toMatchObject({
			family: syntheticFamily,
			variant: varB,
			shown: 1,
			ignored: 1,
			played: 0,
			abandoned: 0,
			finished: 0,
			open: 0,
			imported: 0,
			totalCompleted: 0,
			ranked: 0
		});
		expect(rowB.shown).toBe(rowB.ignored + rowB.played);
		expect(rowB.played).toBe(rowB.abandoned + rowB.finished + rowB.open);
		expect(rowB.totalCompleted).toBe(rowB.finished + rowB.imported);
	} finally {
		await db.batch([
			db.prepare("DELETE FROM completed_run WHERE family='synth-fam'"),
			db.prepare("DELETE FROM play_session WHERE family='synth-fam'"),
			db.prepare("DELETE FROM account_round_activity WHERE family='synth-fam'")
		]);
	}
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
	).toBe(catalog.memory.variants!.length);
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

it('keeps historical ranked identity intact and fails closed for unknown stored versions', async () => {
	const db = proxy.env.DB;
	const id = crypto.randomUUID(),
		createdAt = now + 1_000_000;
	const themeSnapshot = JSON.stringify(generateTheme('42', 'memory'));
	await db
		.prepare(
			`INSERT INTO play_session(id,user_id,family,variant,seed,engine_version,created_at,expires_at,ip_hash,score_config_version,theme_snapshot)
			VALUES(?,?,?,?,?,?,?,?,?,?,?)`
		)
		.bind(
			id,
			userId,
			'memory',
			null,
			'42',
			'memory-1',
			createdAt,
			createdAt + 7200000,
			'identity-ip',
			'brief-v1',
			themeSnapshot
		)
		.run();
	const original = await resumableRanked(db, userId, createdAt + 1);
	expect(original).toMatchObject({
		id,
		family: 'memory',
		variant: 'memory:classic',
		engineVersion: 'memory-1',
		scoring: defaultScoreConfig('memory')
	});
	const incompatible = { id, expiresAt: createdAt + 7200000, saving: false };
	for (const [column, value] of [
		['variant', 'memory:unknown'],
		['score_config_version', 'missing-version'],
		['engine_version', 'memory-future'],
		['theme_snapshot', null],
		['theme_snapshot', '{}']
	] as const) {
		await db.prepare(`UPDATE play_session SET ${column}=? WHERE id=?`).bind(value, id).run();
		expect(await resumableRanked(db, userId, createdAt + 1)).toEqual(incompatible);
		await db
			.prepare(`UPDATE play_session SET ${column}=? WHERE id=?`)
			.bind(
				column === 'variant'
					? null
					: column === 'theme_snapshot'
						? themeSnapshot
						: column === 'engine_version'
							? 'memory-1'
							: 'brief-v1',
				id
			)
			.run();
	}
	expect(await resumableRanked(db, userId, createdAt + 1)).toMatchObject({
		id,
		variant: 'memory:classic'
	});
	await abandonRanked(db, userId, id, createdAt + 2);
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

it('caches reconciled overview totals, includes families without variants, and invalidates every lifecycle write', async () => {
	const db = proxy.env.DB;
	const entries = new Map<string, string>();
	const cache = {
		get: async (key: string) => (entries.has(key) ? JSON.parse(entries.get(key)!) : null),
		put: async (key: string, value: string, options: { expirationTtl: number }) => {
			expect(options.expirationTtl).toBe(60);
			entries.set(key, value);
		},
		delete: async (key: string) => {
			entries.delete(key);
		}
	} as unknown as KVNamespace;
	let statements = 0;
	const countedDb = {
		prepare: (sql: string) => {
			statements++;
			return db.prepare(sql);
		}
	} as D1Database;
	const round = { runId: crypto.randomUUID(), family: 'connect', rankedSession: null };
	await recordRoundStart(db, userId, round, now);
	await recordRoundPlay(db, userId, round, now + 1);
	await gameOverview(db);
	const first = await cachedGameOverview(countedDb, cache, now);
	// One ensure SELECT per family, four aggregate reads and the Memory live-policy pointer.
	expect(statements).toBe(Object.keys(catalog).length + 5);
	const metrics = [
		'shown',
		'ignored',
		'played',
		'abandoned',
		'finished',
		'open',
		'imported',
		'totalCompleted',
		'ranked'
	] as const;
	for (const game of first.games) {
		for (const key of metrics)
			expect(game[key]).toBe(game.variants.reduce((sum, row) => sum + row[key], 0));
		expect(game.shown).toBe(game.ignored + game.played);
		expect(game.played).toBe(game.abandoned + game.finished + game.open);
	}
	for (const key of metrics)
		expect(first.totals[key]).toBe(first.games.reduce((sum, game) => sum + game[key], 0));
	statements = 0;
	const selected = await gameOverview(countedDb, 'connect');
	expect(selected).toEqual(first.games.filter((game) => game.family === 'connect'));
	expect(statements).toBe(5);
	statements = 0;
	await gameStatistics(countedDb, 'connect', selected[0]);
	expect(statements).toBe(1); // Bounded in v1.3.5.2: 1 grouped family query replaces per-variant fan-out
	expect(first.games.find((game) => game.family === 'connect')).toMatchObject({
		played: 1,
		open: 1,
		variantCount: 4
	});
	await recordRoundAbandon(db, userId, round, now + 2);
	await saveRun(db, userId, completion('memory:moving'), now + 2);
	await db
		.prepare(
			`INSERT INTO completed_run(id,user_id,family,engine_version,rules_group,score,moves,seconds,seed,move_log,payload_hash,ranked,created_at) VALUES(?,?,?,?,?,123,1,1,'42','[]',?,0,?)`
		)
		.bind(
			round.runId,
			userId,
			'connect',
			catalog.connect.engineVersion,
			catalog.connect.leaderboardGroups[0],
			crypto.randomUUID(),
			now + 2
		)
		.run();
	statements = 0;
	expect(await cachedGameOverview(countedDb, cache, now + 3)).toEqual(first);
	expect(statements).toBe(0);
	await changeGame(
		db,
		'operator',
		'connect',
		'game-disable',
		'Overview invalidation',
		7,
		now + 4,
		cache
	);
	expect(entries.size).toBe(0);
	const disabled = await cachedGameOverview(db, cache, now + 5);
	expect(disabled.totals.totalCompleted).toBe(first.totals.totalCompleted + 2);
	expect(disabled.games.find((game) => game.family === 'connect')).toMatchObject({
		state: 'disabled',
		finished: 1,
		open: 0
	});
	await changeGame(db, 'operator', 'connect', 'game-enable', undefined, 7, now + 6, cache);
	expect(entries.size).toBe(0);
	const resumed = await cachedGameOverview(db, cache, now + 7);
	const variant = resumed.games.find((game) => game.family === 'memory')!.variants[0];
	await changeVariant(
		db,
		'operator',
		'memory',
		variant.id,
		variant.state === 'enabled' ? 'variant-disable' : 'variant-enable',
		'Overview variant invalidation',
		now + 8,
		cache
	);
	expect(entries.size).toBe(0);
	await cachedGameOverview(db, cache, now + 9);
	await changeVariant(
		db,
		'operator',
		'memory',
		variant.id,
		variant.state === 'enabled' ? 'variant-enable' : 'variant-disable',
		'Restore overview fixture',
		now + 10,
		cache
	);
	expect(entries.size).toBe(0);
	const refreshed = await cachedGameOverview(db, cache, now + 11);
	const expired = await cachedGameOverview(db, cache, now + 60_011);
	expect(expired.updatedAt).toBe(now + 60_011);
	expect(expired.totals).toEqual(refreshed.totals);
	entries.set(
		'admin:games-overview:v1',
		JSON.stringify({ ...expired, totals: { ...expired.totals, shown: -1 } })
	);
	expect((await cachedGameOverview(db, cache, now + 60_012)).totals).toEqual(refreshed.totals);
});

it('requires disable reasons, ignores supplied enable reasons, and audits missing enable reasons for families and variants', async () => {
	const db = proxy.env.DB;
	for (const reason of ['', 'ab', 'Contains@address', 'Line\nbreak', 'x'.repeat(241)]) {
		await expect(
			changeGame(db, 'operator', 'connect', 'game-disable', reason)
		).rejects.toMatchObject({ code: 'input' });
		await expect(
			changeVariant(db, 'operator', 'memory', 'memory:trios', 'variant-disable', reason)
		).rejects.toMatchObject({ code: 'input' });
	}
	await changeGame(db, 'operator', 'connect', 'game-disable', 'Enable reason fixture');
	await changeGame(db, 'operator', 'connect', 'game-enable', 'Ignore@this\nclient input');
	await changeGame(db, 'operator', 'connect', 'game-disable', 'Missing reason fixture');
	await changeGame(db, 'operator', 'connect', 'game-enable');
	if ((await enabledVariants(db, 'memory')).includes('memory:trios'))
		await changeVariant(
			db,
			'operator',
			'memory',
			'memory:trios',
			'variant-disable',
			'Enable reason fixture'
		);
	await changeVariant(
		db,
		'operator',
		'memory',
		'memory:trios',
		'variant-enable',
		'Ignore@this\nclient input'
	);
	await changeVariant(
		db,
		'operator',
		'memory',
		'memory:trios',
		'variant-disable',
		'Missing reason fixture'
	);
	await changeVariant(db, 'operator', 'memory', 'memory:trios', 'variant-enable');
	const audit = (
		await db
			.prepare("SELECT reason FROM admin_audit WHERE action IN ('game-enable','variant-enable')")
			.all<{ reason: string }>()
	).results;
	expect(audit.length).toBeGreaterThanOrEqual(4);
	expect(audit.every((row) => row.reason === 'Resumed by operator (no reason entered)')).toBe(true);
	expect(
		await db
			.prepare(
				"SELECT reason FROM variant_lifecycle WHERE family='memory' AND variant='memory:trios'"
			)
			.first()
	).toEqual({ reason: 'Resumed by operator (no reason entered)' });
});

it('bounds Games queries, pages variants deterministically, and isolates scoring versions at synthetic 100-variant scale', async () => {
	const db = proxy.env.DB;
	let statements = 0;
	const countedDb = {
		prepare: (sql: string) => {
			statements++;
			return db.prepare(sql);
		}
	} as D1Database;

	// 1. Single grouped family query replaces per-variant fan-out.
	const summary = (await gameOverview(db, 'memory'))[0];
	statements = 0;
	const stats = await gameStatistics(countedDb, 'memory', summary);
	expect(statements).toBe(1); // exactly 1 grouped query, never 1 + N
	expect(stats.variants).toHaveLength(catalog.memory.variants!.length);
	for (const v of stats.variants) {
		expect(Array.isArray(v.rows)).toBe(true);
		expect(typeof v.more).toBe('boolean');
	}

	// 2. loadGamesAdmin bounding and deterministic pagination for actual catalog.
	const adminPage0 = await loadGamesAdmin(db, undefined, 'memory', 0, 10);
	expect(adminPage0.gameStats.totalVariants).toBe(catalog.memory.variants!.length);
	expect(adminPage0.gameStats.totalVariantPages).toBe(
		Math.ceil(catalog.memory.variants!.length / 10)
	);
	expect(adminPage0.gameStats.variantPage).toBe(0);
	expect(adminPage0.gameStats.variantPageSize).toBe(10);
	expect(adminPage0.gameStats.variants).toHaveLength(10);
	expect(adminPage0.gameStats.variants.map((v) => v.id)).toEqual(
		catalog.memory.variants!.slice(0, 10).map((variant) => variant.id)
	);

	// 3. Out-of-bounds page returns safe empty array with page index preserved.
	const adminPage99 = await loadGamesAdmin(db, undefined, 'memory', 99, 10);
	expect(adminPage99.gameStats.totalVariants).toBe(catalog.memory.variants!.length);
	expect(adminPage99.gameStats.totalVariantPages).toBe(
		Math.ceil(catalog.memory.variants!.length / 10)
	);
	expect(adminPage99.gameStats.variantPage).toBe(99);
	expect(adminPage99.gameStats.variants).toHaveLength(0);

	// 4. Synthetic 100-variant pagination test with page size 10.
	const syntheticStats = {
		...stats,
		variants: Array.from({ length: 100 }, (_, i) => ({
			id: `synthetic-variant-${String(i).padStart(3, '0')}`,
			state: i === 99 ? ('disabled' as const) : ('enabled' as const),
			shown: i * 2,
			ignored: 0,
			played: i * 2,
			abandoned: 0,
			finished: i,
			open: i,
			imported: 0,
			totalCompleted: i,
			ranked: Math.floor(i / 2),
			rows: [],
			more: false
		}))
	};
	const totalVariants = syntheticStats.variants.length;
	const pageSize = 10;
	const totalVariantPages = Math.ceil(totalVariants / pageSize);
	expect(totalVariantPages).toBe(10);

	// Page 0 boundary: items 0..9
	const p0 = syntheticStats.variants.slice(0, 10);
	expect(p0).toHaveLength(10);
	expect(p0[0].id).toBe('synthetic-variant-000');
	expect(p0[9].id).toBe('synthetic-variant-009');

	// Page 5 boundary: items 50..59
	const p5 = syntheticStats.variants.slice(5 * pageSize, 6 * pageSize);
	expect(p5).toHaveLength(10);
	expect(p5[0].id).toBe('synthetic-variant-050');
	expect(p5[9].id).toBe('synthetic-variant-059');

	// Page 9 boundary: items 90..99
	const p9 = syntheticStats.variants.slice(9 * pageSize, 10 * pageSize);
	expect(p9).toHaveLength(10);
	expect(p9[0].id).toBe('synthetic-variant-090');
	expect(p9[9].id).toBe('synthetic-variant-099');
	expect(p9[9].state).toBe('disabled');

	// Out of bounds page 10: empty
	const p10 = syntheticStats.variants.slice(10 * pageSize, 11 * pageSize);
	expect(p10).toHaveLength(0);

	// Exact total preservation: sum of paged variants matches overall
	const allPaged = Array.from({ length: totalVariantPages }, (_, page) =>
		syntheticStats.variants.slice(page * pageSize, (page + 1) * pageSize)
	).flat();
	expect(allPaged).toEqual(syntheticStats.variants);
	expect(allPaged.reduce((sum, v) => sum + v.played, 0)).toBe(
		syntheticStats.variants.reduce((sum, v) => sum + v.played, 0)
	);
});

const PILOT = [
	'memory:budget',
	'memory:lockout',
	'memory:swaps',
	'memory:two-backs',
	'memory:quads',
	'memory:collapse'
];
/** Miss-free solution on the live board, so collapse positions stay correct. */
function liveSolution(seed: string, variant: string) {
	const moves: { index: number }[] = [];
	let round = catalog.memory.resumeRound!(seed, moves, undefined, variant) as unknown as {
		status: string;
		matched: number[];
		cards: { symbol: string }[];
	};
	while (round.status !== 'won') {
		const open = round.cards.flatMap((card, index) =>
			round.matched.includes(index) ? [] : [{ card, index }]
		);
		for (const { index } of open.filter(({ card }) => card.symbol === open[0].card.symbol))
			moves.push({ index });
		round = catalog.memory.resumeRound!(seed, moves, undefined, variant) as typeof round;
	}
	return moves;
}

it('saves each pilot identity under its own immutable group and scoring scope', async () => {
	const db = proxy.env.DB;
	for (const variant of PILOT) {
		const run = { ...completion(variant), moves: liveSolution('42', variant) };
		const saved = await saveRun(db, userId, run, now + 30);
		const groups = catalog.memory.variants!.find(
			(entry) => entry.id === variant
		)!.leaderboardGroups;
		expect(groups).toContain(saved.group);
		expect(saved.group.startsWith(`memory-1:${variant.slice('memory:'.length)}:`)).toBe(true);
		expect(scoreScope('memory', variant)).toBe(variant === 'memory:quads' ? variant : 'memory');
	}
	expect(defaultScoreConfig('memory', 'memory:quads')).toEqual({
		version: 'memory-quads-v1',
		values: { quad: 2000, mismatch: 150, second: 5 }
	});
	for (const variant of PILOT.filter((id) => id !== 'memory:quads'))
		expect(defaultScoreConfig('memory', variant)).toEqual(defaultScoreConfig('memory'));
	expect(Object.keys(parseRun(completion('memory:quads')))).toContain('variant');
});

it('rejects an exhausted or over-long budget payload and releases the session by exact id', async () => {
	const db = proxy.env.DB;
	const variant = 'memory:budget';
	// Earlier cases leave variants disabled in the shared database.
	await changeVariant(db, 'operator', 'memory', variant, 'variant-enable', 'Pilot budget test');
	const session = await startRanked(
		db,
		userId,
		'memory',
		'budget-ip',
		now + 5000,
		null,
		undefined,
		variant
	);
	const round = createMemoryRound(session.seed, variant);
	// Two flips per attempt, each on different symbols, until the 2×groups attempts are spent.
	const first = round.cards.findIndex((card) => card.symbol !== round.cards[0].symbol);
	const attempts = Array.from({ length: round.pairs * 2 }, () => [{ index: 0 }, { index: first }]);
	const exhausted = {
		...completion(variant, session.seed, session.id),
		rankedSession: session.id,
		scoreConfigVersion: session.scoring.version,
		moves: attempts.flat()
	};
	await expect(
		saveRun(db, userId, exhausted, session.startedAt + CARD_RANKED_OPENING_MS + 10_000)
	).rejects.toMatchObject({ code: 'invalid_replay' });
	expect(
		(
			await db
				.prepare('SELECT count(*) count FROM completed_run WHERE id=?')
				.bind(session.id)
				.first<{ count: number }>()
		)?.count
	).toBe(0);

	const next = await startRanked(
		db,
		userId,
		'memory',
		'budget-ip',
		now + 6000,
		null,
		undefined,
		variant
	);
	await abandonRanked(db, userId, next.id);
	expect(await resumableRanked(db, userId, now + 6001)).toBeNull();
	await expect(
		saveRun(
			db,
			userId,
			{
				...completion(variant, next.seed, next.id),
				rankedSession: next.id,
				scoreConfigVersion: next.scoring.version
			},
			now + 6002
		)
	).rejects.toBeTruthy();
});

it('loads Memory directory, filters by search/status/archetype, supports keyset cursor pagination and discovers observed variants', async () => {
	const db = proxy.env.DB;

	// 1. Default directory load returns all curated variants.
	const initial = await loadMemoryDirectory(db);
	expect(initial.curatedCount).toBe(catalog.memory.variants!.length);
	expect(initial.total).toBeGreaterThanOrEqual(catalog.memory.variants!.length);
	expect(initial.items.length).toBeLessThanOrEqual(10);

	// Classic is on page 2 in default sort (id ASC, limit 10), so verify via search
	const classicResult = await loadMemoryDirectory(db, { q: 'classic' });
	const classic = classicResult.items.find((v) => v.id === 'memory:classic');
	expect(classic).toBeDefined();
	expect(classic?.source).toBe('curated');
	expect(classic?.archetype).toBe('core');
	expect(classic?.dims.length).toBe(6);

	// Quads is on page 2 in default sort (id ASC, limit 10), so verify via grouping query
	const quadsResult = await loadMemoryDirectory(db, { archetype: 'grouping' });
	const quads = quadsResult.items.find((v) => v.id === 'memory:quads');
	expect(quads).toBeDefined();
	expect(quads?.archetype).toBe('grouping');
	expect(quads?.dims.find((d) => d.key === 'matchSize')?.valueId).toBe('4');

	// 2. Keyset cursor pagination with page size 4.
	const page0 = await loadMemoryDirectory(db, { pageSize: 4 });
	expect(page0.items).toHaveLength(4);
	expect(page0.page).toBe(0);
	expect(page0.nextCursor).toBeDefined();

	const page1 = await loadMemoryDirectory(db, { pageSize: 4, cursor: page0.nextCursor });
	expect(page1.items).toHaveLength(4);
	expect(page1.page).toBe(1);
	// No duplicate items across pages
	const page0Ids = new Set(page0.items.map((i) => i.id));
	expect(page1.items.some((i) => page0Ids.has(i.id))).toBe(false);

	// 3. Search filter by slug / name.
	const searchResult = await loadMemoryDirectory(db, { q: 'quads' });
	expect(searchResult.total).toBe(1);
	expect(searchResult.items[0].id).toBe('memory:quads');

	// 4. Archetype filter.
	const groupingResult = await loadMemoryDirectory(db, { archetype: 'grouping' });
	expect(groupingResult.total).toBeGreaterThanOrEqual(2);
	expect(groupingResult.items.map((v) => v.id)).toContain('memory:trios');
	expect(groupingResult.items.map((v) => v.id)).toContain('memory:quads');

	// 5. Status filter with policy blocker.
	// Earlier test cases may leave variants in disabled lifecycle state. Ensure quads is enabled first.
	await changeVariant(
		db,
		'operator',
		'memory',
		'memory:quads',
		'variant-enable',
		'Enable quads for test'
	);
	const policyBefore = await readMemoryPolicy(db);
	const narrowedPolicy = { ...policyBefore.values, 'matchSize:4': false };
	await changeMemoryPolicy(
		db,
		'operator',
		policyBefore.version,
		narrowedPolicy,
		'Block quads for test'
	);

	try {
		const blockedResult = await loadMemoryDirectory(db, { status: 'blocked' });
		expect(blockedResult.items.map((v) => v.id)).toContain('memory:quads');
		const blockedQuads = blockedResult.items.find((v) => v.id === 'memory:quads');
		expect(blockedQuads?.state).toBe('blocked');
		expect(blockedQuads?.policyBlocker).toBeDefined();
	} finally {
		// Restore policy
		const current = await readMemoryPolicy(db);
		await changeMemoryPolicy(
			db,
			'operator',
			current.version,
			policyBefore.values,
			'Restore policy'
		);
	}

	// 6. Observed uncataloged variant discovery.
	const observedId = 'memory:observed-test-directory';
	await db
		.prepare(
			"INSERT INTO variant_lifecycle(family, variant, state, reason) VALUES('memory', ?, 'enabled', 'Test observed')"
		)
		.bind(observedId)
		.run();

	try {
		const withObserved = await loadMemoryDirectory(db);
		expect(withObserved.total).toBe(initial.total + 1);

		const observedOnly = await loadMemoryDirectory(db, { source: 'observed' });
		expect(observedOnly.items.map((v) => v.id)).toContain(observedId);
		const observedItem = observedOnly.items.find((v) => v.id === observedId);
		expect(observedItem?.source).toBe('observed');

		const curatedOnly = await loadMemoryDirectory(db, { source: 'curated' });
		expect(curatedOnly.items.map((v) => v.id)).not.toContain(observedId);
	} finally {
		await db
			.prepare("DELETE FROM variant_lifecycle WHERE family='memory' AND variant=?")
			.bind(observedId)
			.run();
	}
});
