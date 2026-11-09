import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { catalog } from '../../src/lib/catalog.js';
import type { CompletedRun, PuzzleManifest } from '../../src/lib/engine/contract.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';
import { THEME_CONFIG } from '../../src/lib/engine/theme/config.js';
import { accountHistory, leaderboard, saveRun, startRanked } from '../../src/lib/server/runs.js';
import { activeRanked, abandonRanked } from '../../src/lib/server/ranked-session.js';
import { readGameConfig, readStyleConfig, readThemeConfig } from '../../src/lib/server/config.js';
import { readLiveScoreConfig, readScoreConfig } from '../../src/lib/server/scoring.js';
import { parseMeasurement } from '../../src/lib/server/measurement.js';
import { utcDate } from '../../src/lib/server/daily.js';

const family = 'slice3-synthetic-numeric';
const group = 'slice3-numeric-1:custom';
const now = 1_800_000_000_000;
const themeValues = (version: string) => ({ ...THEME_CONFIG, version });
const manifest: PuzzleManifest = {
	id: family,
	presentation: {
		name: 'slice3.finished',
		scoringLabels: { perStep: 'slice3.finished' },
		groups: { 'slice3-numeric-1:custom': 'slice3.finished' },
		help: {
			steps: ['slice3.finished'],
			rows: [{ label: 'slice3.finished', field: 'perStep', sign: '+' }],
			note: 'slice3.finished',
			tips: 'slice3.finished'
		},
		backdrop: { items: [{ id: 'synthetic', path: 'M1 1h10v10Z' }], fill: 'solid' }
	},
	engineVersion: 'slice3-numeric-1',
	maxMoves: 2,
	parseMove(move) {
		if (
			Object.keys(move).sort().join(',') !== 'charge,steps' ||
			![move.charge, move.steps].every(Number.isSafeInteger)
		)
			throw new RangeError('move');
		return { steps: move.steps, charge: move.charge };
	},
	leaderboardGroups: [group],
	rankedTiming: {
		openingMs: (result) => result.moves * 500,
		minimumSeconds: (result) => result.moves
	},
	scoring: {
		version: 'slice3-score-1',
		fields: ['perStep', 'perCharge'],
		defaults: { perStep: 13, perCharge: 17 }
	},
	messages: { 'slice3.finished': 'Finished', 'slice3.result': 'Score {score}' },
	createRound: (seed) => ({ seed }),
	ending: {
		kind: 'completion',
		headlines: { default: 'slice3.finished' },
		subline: { key: 'slice3.result', values: ['score'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition: 'The synthetic move limit was reached.'
	},
	replay(_seed, moves, seconds, scoring = { perStep: 13, perCharge: 17 }) {
		if (!moves.length || moves.length > this.maxMoves) throw new RangeError('move_limit');
		const score = moves.reduce(
			(total, move) => total + move.steps! * scoring.perStep + move.charge! * scoring.perCharge,
			0
		);
		return { score: Math.max(0, score - seconds), group, pairs: null, moves: moves.length };
	}
};

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const db = () => proxy.env.DB;
const cache = () => proxy.env.CONFIG_CACHE;
const legacySessions = {
	userId: '',
	older: '',
	newer: '',
	claimed: '',
	latestCreatedAt: now + 2
};
const legacyMeasurement = {
	id: '',
	visitor: 'legacy-visitor',
	event: 'round_started',
	family: 'memory',
	code: 'start',
	createdAt: now
};

async function applyMigration(file: string) {
	await db().batch(
		(await readFile(`migrations/${file}`, 'utf8'))
			.split('--> statement-breakpoint')
			.filter((part) => part.trim())
			.map((part) => db().prepare(part))
	);
}

async function createPlayer() {
	const id = crypto.randomUUID();
	const name = `slice3_${id.slice(0, 8)}`;
	await db().batch([
		db()
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(id, 'Private Name', `${id}@example.test`, 1, now, now),
		db()
			.prepare('INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)')
			.bind(id, name, name, now)
	]);
	return id;
}

function run(
	id: string,
	seed: string,
	moves: CompletedRun['moves'],
	ranked: boolean,
	engineVersion = manifest.engineVersion
): CompletedRun {
	return {
		version: 1,
		id,
		family,
		engineVersion,
		seed,
		moves,
		elapsedSeconds: 10,
		rankedSession: ranked ? id : null
	};
}

beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	const files = (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort();
	const upgrade = files.indexOf('0011_catalog_config_sessions.sql');
	if (upgrade < 1) throw new Error('missing catalog config migration');
	for (const file of files.slice(0, upgrade)) await applyMigration(file);
	legacySessions.userId = crypto.randomUUID();
	legacySessions.older = crypto.randomUUID();
	legacySessions.newer = crypto.randomUUID();
	legacySessions.claimed = crypto.randomUUID();
	await db()
		.prepare(
			'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
		)
		.bind(legacySessions.userId, 'Legacy', `${legacySessions.userId}@example.test`, 1, now, now)
		.run();
	await db().batch([
		...[
			[legacySessions.older, 'memory', 'memory-1', '42', now, null, null],
			[legacySessions.newer, 'connect', 'connect-1', '43', now + 1, null, null],
			[legacySessions.claimed, 'block', 'block-1', '44', now + 2, 'claimed-hash', now + 2]
		].map(([id, puzzle, version, seed, createdAt, hash, claimedAt]) =>
			db()
				.prepare(
					'INSERT INTO play_session(id,user_id,family,seed,engine_version,created_at,expires_at,ip_hash,payload_hash,claimed_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
				)
				.bind(
					id,
					legacySessions.userId,
					puzzle,
					seed,
					version,
					createdAt,
					now + 7_200_000,
					'legacy-ip',
					hash,
					claimedAt
				)
		)
	]);
	legacyMeasurement.id = crypto.randomUUID();
	await db()
		.prepare(
			'INSERT INTO anonymous_event(id,visitor,event,family,code,created_at) VALUES(?,?,?,?,?,?)'
		)
		.bind(
			legacyMeasurement.id,
			legacyMeasurement.visitor,
			legacyMeasurement.event,
			legacyMeasurement.family,
			legacyMeasurement.code,
			legacyMeasurement.createdAt
		)
		.run();
	for (const file of files.slice(upgrade)) await applyMigration(file);
	catalog[family] = manifest;
	puzzleMetadata[family] = {
		engineVersion: manifest.engineVersion,
		scoring: manifest.scoring,
		ending: manifest.ending,
		presentation: manifest.presentation
	};
}, 30_000);

afterAll(async () => {
	delete catalog[family];
	delete puzzleMetadata[family];
	await proxy?.dispose();
});

beforeEach(async () => {
	await db().batch([
		db()
			.prepare('DELETE FROM config_live WHERE key IN (?,?,?)')
			.bind(`game:${family}`, 'theme', `style:${family}`),
		db().prepare('DELETE FROM score_live WHERE family=?').bind(family),
		db().prepare('DELETE FROM game_lifecycle WHERE family=?').bind(family)
	]);
}, 30_000);

it('abandons only superseded unclaimed sessions during the schema upgrade', async () => {
	const rows = await db()
		.prepare(
			'SELECT id,payload_hash,claimed_at,abandoned_at FROM play_session WHERE user_id=? ORDER BY sequence'
		)
		.bind(legacySessions.userId)
		.all<{
			id: string;
			payload_hash: string | null;
			claimed_at: number | null;
			abandoned_at: number | null;
		}>();
	expect(rows.results).toEqual([
		{
			id: legacySessions.older,
			payload_hash: null,
			claimed_at: null,
			abandoned_at: legacySessions.latestCreatedAt
		},
		{
			id: legacySessions.newer,
			payload_hash: null,
			claimed_at: null,
			abandoned_at: legacySessions.latestCreatedAt
		},
		{
			id: legacySessions.claimed,
			payload_hash: 'claimed-hash',
			claimed_at: now + 2,
			abandoned_at: null
		}
	]);
	const measurement = await db()
		.prepare(
			'SELECT id,visitor,event,family,code,created_at AS createdAt FROM anonymous_event WHERE id=?'
		)
		.bind(legacyMeasurement.id)
		.first();
	expect(measurement).toEqual(legacyMeasurement);
	const indexes = await db()
		.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='anonymous_event'")
		.all<{ name: string }>();
	expect(indexes.results.map((index) => index.name)).toEqual(
		expect.arrayContaining(['anonymous_event_time', 'anonymous_event_visitor'])
	);
});

it('persists parsed measurement events for new catalog families while retaining other checks', async () => {
	for (const puzzle of [family, 'connect']) {
		const body = {
			id: crypto.randomUUID(),
			event: 'round_completed',
			family: puzzle,
			code: 'save',
			consent: true
		};
		const parsed = parseMeasurement(body);
		expect(parsed).not.toBeNull();
		await db()
			.prepare(
				'INSERT INTO anonymous_event(id,visitor,event,family,code,created_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(parsed!.id, 'slice3-visitor', parsed!.event, parsed!.family, parsed!.code, now)
			.run();
	}
	await expect(
		db()
			.prepare(
				'INSERT INTO anonymous_event(id,visitor,event,family,code,created_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(crypto.randomUUID(), 'invalid', 'unknown-event', 'memory', 'save', now)
			.run()
	).rejects.toThrow();
	await expect(
		db()
			.prepare(
				'INSERT INTO anonymous_event(id,visitor,event,family,code,created_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(crypto.randomUUID(), 'invalid', 'round_completed', 'memory', 'unknown-code', now)
			.run()
	).rejects.toThrow();
});

it('starts, validates, replays and scores a novel manifest family through the catalog', async () => {
	const userId = await createPlayer();
	const issued = await startRanked(db(), userId, family, 'slice3-ip', now, null, cache());
	const rankedRun = run(issued.id, issued.seed, [{ charge: 2, steps: 3 }], true);
	const saved = await saveRun(db(), userId, rankedRun, now + 7100, cache());
	expect(saved).toEqual({ id: issued.id, score: 69, ranked: true, group: family });
	expect(
		await db()
			.prepare('SELECT rules_group,score_config_version,score FROM completed_run WHERE id=?')
			.bind(issued.id)
			.first()
	).toEqual({ rules_group: group, score_config_version: manifest.scoring.version, score: 69 });

	const reordered = { ...rankedRun, moves: [{ steps: 3, charge: 2 }] };
	expect(await saveRun(db(), userId, reordered, now + 7200, cache())).toEqual(saved);
	await expect(
		saveRun(
			db(),
			userId,
			run(crypto.randomUUID(), issued.seed, [{ steps: 1, charge: 1 }], false, 'future'),
			now
		)
	).rejects.toMatchObject({ code: 'version' });
	await expect(
		saveRun(
			db(),
			userId,
			run(crypto.randomUUID(), issued.seed, [{ steps: 1, charge: 1, extra: 1 }], false),
			now
		)
	).rejects.toMatchObject({ code: 'move' });
	await expect(
		saveRun(
			db(),
			userId,
			run(
				crypto.randomUUID(),
				issued.seed,
				[
					{ steps: 1, charge: 1 },
					{ steps: 1, charge: 1 },
					{ steps: 1, charge: 1 }
				],
				false
			),
			now
		)
	).rejects.toMatchObject({ code: 'moves' });

	const solo = run(crypto.randomUUID(), '42', [{ steps: 1, charge: 0 }], false);
	const soloResult = await saveRun(db(), userId, solo, now + 9000, cache());
	expect(soloResult).toMatchObject({ ranked: false, score: 3, group: family });
	const history = await accountHistory(db(), userId);
	expect(history.history).toHaveLength(2);
	expect(history.bests).toEqual([]);
	expect(history.history.every((row) => row.family === family && row.date === utcDate(now))).toBe(
		true
	);
	expect((await leaderboard(db(), family, utcDate(now), userId, cache(), 25, now)).rows).toEqual(
		[]
	);

	const tooFast = await startRanked(db(), userId, family, 'slice3-ip', now + 10_000, null, cache());
	expect(await activeRanked(db(), userId, now + 10_000)).toMatchObject({
		id: tooFast.id,
		saving: false
	});
	await expect(
		saveRun(
			db(),
			userId,
			run(tooFast.id, tooFast.seed, [{ steps: 1, charge: 0 }], true),
			now + 12_150,
			cache()
		)
	).rejects.toMatchObject({ code: 'too_fast' });
	expect(await activeRanked(db(), userId, now + 12_150)).toBeNull();
	const recovered = await startRanked(
		db(),
		userId,
		family,
		'slice3-ip',
		now + 12_151,
		null,
		cache()
	);
	expect(await activeRanked(db(), userId, now + 12_151)).toMatchObject({
		id: recovered.id,
		saving: false
	});
}, 30_000);

it('serializes competing ranked starts, permits explicit takeover and unlocks at the two-hour TTL', async () => {
	const userId = await createPlayer();
	const starts = await Promise.allSettled([
		startRanked(db(), userId, family, 'slice3-race', now, null, cache()),
		startRanked(db(), userId, family, 'slice3-race', now, null, cache())
	]);
	const started = starts.filter((result) => result.status === 'fulfilled');
	expect(started).toHaveLength(1);
	expect(
		starts.filter((result) => result.status === 'rejected').map((result) => result.reason.code)
	).toEqual(['ranked_active']);
	const first = started[0]!.value;
	const replacement = await startRanked(
		db(),
		userId,
		family,
		'slice3-race',
		now + 100,
		first.id,
		cache()
	);
	expect((await activeRanked(db(), userId, now + 101))?.id).toBe(replacement.id);
	await abandonRanked(db(), userId, first.id, now + 102);
	expect((await activeRanked(db(), userId, now + 102))?.id).toBe(replacement.id);
	await expect(
		startRanked(db(), userId, family, 'slice3-race', replacement.expiresAt - 1, null, cache())
	).rejects.toMatchObject({ code: 'ranked_active' });
	const afterExpiry = await startRanked(
		db(),
		userId,
		family,
		'slice3-race',
		replacement.expiresAt,
		null,
		cache()
	);
	expect(afterExpiry.expiresAt).toBe(replacement.expiresAt + 7_200_000);
}, 30_000);

it('honors novel manifest selection defaults without reviving its existing lifecycle state', async () => {
	const { gameAvailable } = await import('../../src/lib/server/games.js');
	catalog[family] = { ...manifest, weight: 7, enabled: false };
	try {
		expect(await readGameConfig(db(), family)).toEqual({
			version: 'catalog-v1',
			values: { weight: 7 }
		});
		expect(await gameAvailable(db(), family)).toBe(false);
		catalog[family] = { ...manifest, weight: 0, enabled: true };
		expect((await readGameConfig(db(), family)).values.weight).toBe(0);
		expect(await gameAvailable(db(), family)).toBe(false);
	} finally {
		catalog[family] = manifest;
	}
});

it('reads catalog config from D1, ignores stale live cache entries and falls back through parents', async () => {
	const kv = cache();
	const defaults = await Promise.all([
		readGameConfig(db(), family, kv),
		readThemeConfig(db(), kv),
		readStyleConfig(db(), family, kv)
	]);
	expect(defaults[0]).toEqual({ version: 'catalog-v1', values: { weight: 1 } });
	expect(defaults[1]).toEqual({ version: THEME_CONFIG.version, values: THEME_CONFIG });
	expect(defaults[2]).toEqual({ version: THEME_CONFIG.version, values: THEME_CONFIG.styles });

	const gameA = crypto.randomUUID();
	const gameB = crypto.randomUUID();
	const gameBroken = crypto.randomUUID();
	const themeA = crypto.randomUUID();
	const themeBroken = crypto.randomUUID();
	const styleA = crypto.randomUUID();
	const scoreA = crypto.randomUUID();
	const scoreB = crypto.randomUUID();
	const scoreBroken = crypto.randomUUID();
	const scoreAValues = { perStep: 13, perCharge: 17 };
	const scoreBValues = { perStep: 15, perCharge: 20 };
	await db().batch([
		db()
			.prepare(
				'INSERT INTO game_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(gameA, family, 'catalog-v1', JSON.stringify({ weight: 4 }), now),
		db().prepare('INSERT INTO config_live(key,version) VALUES(?,?)').bind(`game:${family}`, gameA),
		db()
			.prepare('INSERT INTO theme_config(version,parent,values_json,created_at) VALUES(?,?,?,?)')
			.bind(themeA, THEME_CONFIG.version, JSON.stringify(themeValues(themeA)), now),
		db().prepare('INSERT INTO config_live(key,version) VALUES(?,?)').bind('theme', themeA),
		db()
			.prepare(
				'INSERT INTO style_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(styleA, family, THEME_CONFIG.version, JSON.stringify(THEME_CONFIG.styles), now),
		db()
			.prepare('INSERT INTO config_live(key,version) VALUES(?,?)')
			.bind(`style:${family}`, styleA),
		db()
			.prepare(
				'INSERT INTO score_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(scoreA, family, manifest.scoring.version, JSON.stringify(scoreAValues), now),
		db().prepare('INSERT INTO score_live(family,version) VALUES(?,?)').bind(family, scoreA)
	]);
	expect(await readGameConfig(db(), family, kv)).toEqual({
		version: gameA,
		values: { weight: 4 }
	});
	expect(await readThemeConfig(db(), kv)).toEqual({ version: themeA, values: themeValues(themeA) });
	expect(await readStyleConfig(db(), family, kv)).toEqual({
		version: styleA,
		values: THEME_CONFIG.styles
	});
	expect(await readLiveScoreConfig(db(), family, kv)).toEqual({
		liveVersion: scoreA,
		config: { version: scoreA, values: scoreAValues }
	});
	for (const [table, version] of [
		['game_config', gameA],
		['theme_config', themeA],
		['style_config', styleA]
	] as const) {
		await expect(
			db()
				.prepare(`UPDATE ${table} SET values_json=values_json WHERE version=?`)
				.bind(version)
				.run()
		).rejects.toThrow();
		await expect(
			db().prepare(`DELETE FROM ${table} WHERE version=?`).bind(version).run()
		).rejects.toThrow();
	}

	await db().batch([
		db()
			.prepare(
				'INSERT INTO game_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(gameB, family, gameA, JSON.stringify({ weight: 9 }), now + 1),
		db().prepare('UPDATE config_live SET version=? WHERE key=?').bind(gameB, `game:${family}`),
		db()
			.prepare('INSERT INTO theme_config(version,parent,values_json,created_at) VALUES(?,?,?,?)')
			.bind(themeBroken, themeA, '{', now + 1),
		db().prepare('UPDATE config_live SET version=? WHERE key=?').bind(themeBroken, 'theme'),
		db()
			.prepare(
				'INSERT INTO score_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(scoreB, family, scoreA, JSON.stringify(scoreBValues), now + 1),
		db().prepare('UPDATE score_live SET version=? WHERE family=?').bind(scoreB, family)
	]);
	expect(await readGameConfig(db(), family, kv)).toEqual({ version: gameB, values: { weight: 9 } });
	expect(await readThemeConfig(db(), kv)).toEqual({ version: themeA, values: themeValues(themeA) });
	expect(await readLiveScoreConfig(db(), family, kv)).toEqual({
		liveVersion: scoreB,
		config: { version: scoreB, values: scoreBValues }
	});
	expect(await readScoreConfig(db(), family, scoreA, kv)).toEqual({
		version: scoreA,
		values: scoreAValues
	});

	await db().batch([
		db()
			.prepare(
				'INSERT INTO game_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(gameBroken, family, gameB, '{', now + 2),
		db().prepare('UPDATE config_live SET version=? WHERE key=?').bind(gameBroken, `game:${family}`),
		db()
			.prepare(
				'INSERT INTO score_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(scoreBroken, family, scoreB, '{', now + 2),
		db().prepare('UPDATE score_live SET version=? WHERE family=?').bind(scoreBroken, family)
	]);
	expect(await readGameConfig(db(), family, kv)).toEqual({ version: gameB, values: { weight: 9 } });
	expect(await readLiveScoreConfig(db(), family, kv)).toEqual({
		liveVersion: scoreBroken,
		config: { version: scoreB, values: scoreBValues }
	});
	await db()
		.prepare('UPDATE config_live SET version=? WHERE key=?')
		.bind(gameA, `game:${family}`)
		.run();
	expect(await readGameConfig(db(), family, kv)).toEqual({ version: gameA, values: { weight: 4 } });

	const malformedCache = {
		get: async () => '{',
		put: async () => undefined
	} as unknown as KVNamespace;
	expect(await readGameConfig(db(), family, malformedCache)).toEqual({
		version: gameA,
		values: { weight: 4 }
	});
}, 30_000);

it('uses safe defaults for invalid and unreachable config', async () => {
	const gameInvalid = crypto.randomUUID();
	const themeInvalid = crypto.randomUUID();
	const styleInvalid = crypto.randomUUID();
	await db().batch([
		db()
			.prepare(
				'INSERT INTO game_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(gameInvalid, family, 'catalog-v1', '{', now),
		db()
			.prepare('INSERT INTO config_live(key,version) VALUES(?,?)')
			.bind(`game:${family}`, gameInvalid),
		db()
			.prepare('INSERT INTO theme_config(version,parent,values_json,created_at) VALUES(?,?,?,?)')
			.bind(themeInvalid, crypto.randomUUID(), '{', now),
		db().prepare('INSERT INTO config_live(key,version) VALUES(?,?)').bind('theme', themeInvalid),
		db()
			.prepare(
				'INSERT INTO style_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(styleInvalid, family, THEME_CONFIG.version, '{}', now),
		db()
			.prepare('INSERT INTO config_live(key,version) VALUES(?,?)')
			.bind(`style:${family}`, styleInvalid)
	]);
	expect(await readGameConfig(db(), family)).toEqual({
		version: 'catalog-v1',
		values: { weight: 1 }
	});
	expect(await readThemeConfig(db())).toEqual({
		version: THEME_CONFIG.version,
		values: THEME_CONFIG
	});
	expect(await readStyleConfig(db(), family)).toEqual({
		version: THEME_CONFIG.version,
		values: THEME_CONFIG.styles
	});

	const offline = {
		prepare: () => {
			throw new Error('unavailable');
		}
	} as unknown as D1Database;
	await expect(readGameConfig(offline, family)).resolves.toEqual({
		version: 'catalog-v1',
		values: { weight: 1 }
	});
	await expect(readThemeConfig(offline)).resolves.toEqual({
		version: THEME_CONFIG.version,
		values: THEME_CONFIG
	});
	await expect(readStyleConfig(offline, family)).resolves.toEqual({
		version: THEME_CONFIG.version,
		values: THEME_CONFIG.styles
	});
	await expect(readLiveScoreConfig(offline, family)).resolves.toEqual({
		liveVersion: manifest.scoring.version,
		config: { version: manifest.scoring.version, values: manifest.scoring.defaults }
	});
}, 30_000);

it('lists and audits lifecycle changes for a novel catalog family without a server family list', async () => {
	const { gameOverview, gameStatistics, gameAvailable, changeGame } =
		await import('../../src/lib/server/games.js');
	const actor = crypto.randomUUID();
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES(?,'admin')").bind(actor).run();
	const player = await createPlayer();
	await saveRun(
		db(),
		player,
		run(crypto.randomUUID(), '42', [{ steps: 2, charge: 3 }], false),
		now
	);
	const overview = (await gameOverview(db())).find((entry) => entry.family === family);
	expect(overview).toMatchObject({ family, state: 'enabled', restoreUntil: null });
	expect(overview!.completed).toBeGreaterThan(0);
	expect((await gameStatistics(db(), family)).rows.some((row) => row.rules_group === group)).toBe(
		true
	);
	await changeGame(db(), actor, family, 'game-disable', 'Novel family maintenance', 7, now);
	expect(await gameAvailable(db(), family)).toBe(false);
	await changeGame(db(), actor, family, 'game-enable', 'Novel family restored', 7, now + 1);
	expect(await gameAvailable(db(), family)).toBe(true);
	const audits = await db()
		.prepare('SELECT action,target,before,after FROM admin_audit WHERE actor=? ORDER BY created_at')
		.bind(actor)
		.all<{ action: string; target: string; before: string; after: string }>();
	expect(
		audits.results.map((row) => [
			row.action,
			row.target,
			JSON.parse(row.before).state,
			JSON.parse(row.after).state
		])
	).toEqual([
		['game-disable', family, 'enabled', 'disabled'],
		['game-enable', family, 'disabled', 'enabled']
	]);
}, 30_000);
