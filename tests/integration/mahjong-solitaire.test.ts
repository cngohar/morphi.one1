import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { manifest } from '../../src/lib/puzzles/mahjong-solitaire/manifest.js';
import {
	createMahjongRound,
	mahjongWitness,
	type MahjongMove
} from '../../src/lib/puzzles/mahjong-solitaire/logic.js';
import { scoring } from '../../src/lib/puzzles/mahjong-solitaire/scoring.js';
import { saveRun } from '../../src/lib/server/runs.js';
import {
	resumeDailyRanked,
	startDailyRanked,
	startRanked
} from '../../src/lib/server/ranked-session.js';
import { dailyBoard, utcDate } from '../../src/lib/server/daily.js';
import {
	buildActivityMapping,
	changeVariant,
	gameStatistics,
	queryActivityCounts,
	queryScoreHistory,
	variantAvailable
} from '../../src/lib/server/games.js';
import { readLiveScoreConfig, saveScoreConfig } from '../../src/lib/server/scoring.js';
import { CARD_RANKED_OPENING_MS, MAHJONG_ENTRANCE_MS } from '../../src/lib/round-timing.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';

const FAMILY = 'mahjong-solitaire';
const CLASSIC = `${FAMILY}:classic`;
const NO_UNDO = `${FAMILY}:no-undo`;
const noon = Date.parse('2026-11-09T12:00:00Z');
const day = 86_400_000;
const secret = 'mahjong-local-test-secret';
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
let sequence = 0;
const db = () => proxy.env.DB;

async function owner() {
	const id = crypto.randomUUID();
	await db().batch([
		db()
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(id, 'Private', `${id}@example.test`, 1, noon, noon),
		db()
			.prepare('INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)')
			.bind(id, id, id, noon)
	]);
	return id;
}

function seedForBand(band: number, variant = CLASSIC) {
	for (let seed = 1; seed <= 100; seed++) {
		if (createMahjongRound(String(seed), variant).band === band) return String(seed);
	}
	throw new Error(`Missing Mahjong band ${band} fixture seed`);
}

async function pin(date: string, seed: string, variant = CLASSIC, version = 'brief-v1') {
	await db()
		.prepare(
			'INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at) VALUES(?,?,?,?,?,?,?)'
		)
		.bind(
			FAMILY,
			date,
			variant,
			seed,
			'mahjong-solitaire-1',
			version,
			Date.parse(`${date}T00:00:00Z`)
		)
		.run();
}

async function issue(band = 1, variant = CLASSIC, version = 'brief-v1') {
	const now = noon + ++sequence * day;
	const seed = seedForBand(band, variant);
	await pin(utcDate(now), seed, variant, version);
	const id = await owner();
	const issued = await startDailyRanked(db(), id, FAMILY, id, now, undefined, secret);
	return { id, now, issued, seed, variant };
}

function completion(issued: { id: string; seed: string }, variant = CLASSIC): CompletedRun {
	const round = createMahjongRound(issued.seed, variant);
	const moves = mahjongWitness(round).map(([tileA, tileB]) => ({
		tileA: tileA!,
		tileB: tileB!
	})) satisfies MahjongMove[];
	return {
		version: 1,
		id: issued.id,
		family: FAMILY,
		seed: issued.seed,
		engineVersion: 'mahjong-solitaire-1',
		moves,
		elapsedSeconds: 0,
		rankedSession: issued.id
	};
}

async function completedRow(id: string) {
	return db()
		.prepare('SELECT ranked,rules_group,seconds,score FROM completed_run WHERE id=?')
		.bind(id)
		.first<{ ranked: number; rules_group: string; seconds: number; score: number }>();
}

async function boardRows(id: string) {
	return (await db()
		.prepare('SELECT COUNT(*) total FROM daily_best WHERE user_id=?')
		.bind(id)
		.first<{ total: number }>())!.total;
}

beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort())
		await db().batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => db().prepare(part))
		);
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES('mahjong-operator','admin')").run();
});

afterAll(async () => {
	await proxy?.dispose();
});

it('issues a group-less daily board and keeps its one ranked attempt', async () => {
	const { id, now, issued } = await issue();
	expect(manifest.enabled).toBe(true);
	expect(manifest.variants).toHaveLength(11);
	expect(manifest.variants.every((variant) => variant.enabled)).toBe(true);
	expect(manifest).not.toHaveProperty('leaderboardGroups');
	expect(manifest.presentation.groups).toEqual({});
	const second = await startDailyRanked(
		db(),
		await owner(),
		FAMILY,
		'second',
		now,
		undefined,
		secret
	);
	expect(second.round).toEqual(issued.round);
	expect(issued.round).not.toHaveProperty('witness');
	expect(JSON.stringify(issued)).not.toContain(`${FAMILY}:`);
	const run = completion(issued);
	const resumed = await resumeDailyRanked(
		db(),
		id,
		issued.id,
		run.moves.slice(0, 1),
		undefined,
		now + 5000
	);
	expect(resumed.id).toBe(issued.id);
	expect(resumed.round.seed).toBe(issued.seed);
	expect((resumed.round as unknown as { removals: number }).removals).toBe(1);

	const saved = await saveRun(
		db(),
		id,
		run,
		now + 1000 + CARD_RANKED_OPENING_MS + MAHJONG_ENTRANCE_MS + 10000
	);
	expect(saved.ranked).toBe(true);
	expect(await completedRow(issued.id)).toMatchObject({
		ranked: 1,
		rules_group: FAMILY
	});
	expect(await boardRows(id)).toBe(1);
	await expect(
		startDailyRanked(db(), id, FAMILY, id, now + 30000, undefined, secret)
	).rejects.toMatchObject({
		code: 'daily_spent'
	});
	const board = await dailyBoard(db(), FAMILY, utcDate(now), id, undefined, 25, now + 30000);
	expect(board.own?.score).toBe(saved.score);
});

for (const [band, active, ranked] of [
	[1, 2499, false],
	[1, 2500, true],
	[2, 9999, false],
	[2, 10000, true],
	[3, 9999, false],
	[3, 10000, true]
] as const) {
	it(`band ${band} floor at ${active}ms saves ranked=${ranked} and consumes the attempt`, async () => {
		const { id, now, issued } = await issue(band);
		const submitted = now + 1000 + CARD_RANKED_OPENING_MS + MAHJONG_ENTRANCE_MS + active;
		const run = completion(issued);
		const saved = await saveRun(db(), id, run, submitted);
		expect(saved.ranked).toBe(ranked);
		expect(await completedRow(run.id)).toMatchObject({
			ranked: Number(ranked),
			rules_group: FAMILY,
			seconds: Math.floor(active / 1000)
		});
		expect(await boardRows(id)).toBe(Number(ranked));
		expect(
			await db().prepare('SELECT abandoned_at FROM play_session WHERE id=?').bind(run.id).first()
		).toEqual({ abandoned_at: null });
		expect(await saveRun(db(), id, run, submitted + 1000)).toEqual(saved);
		await expect(
			startDailyRanked(db(), id, FAMILY, id, submitted + 1000, undefined, secret)
		).rejects.toMatchObject({
			code: 'daily_spent'
		});
		if (ranked) {
			const board = await dailyBoard(db(), FAMILY, utcDate(now), id, undefined, 25, submitted);
			expect(board.own?.score).toBe(saved.score);
		}
	});
}

it('counts hidden time on the server after ranked resume, regardless of the client elapsed claim', async () => {
	const { id, now, issued } = await issue(1);
	const run = completion(issued);
	const hiddenMs = 30_000;
	await resumeDailyRanked(db(), id, issued.id, run.moves.slice(0, 1), undefined, now + 5000);
	run.elapsedSeconds = 0;
	const saved = await saveRun(
		db(),
		id,
		run,
		now + 1000 + CARD_RANKED_OPENING_MS + MAHJONG_ENTRANCE_MS + 2500 + hiddenMs
	);
	expect(saved.ranked).toBe(true);
	expect(await completedRow(run.id)).toMatchObject({
		ranked: 1,
		seconds: 32,
		rules_group: FAMILY
	});
	expect(await boardRows(id)).toBe(1);
});

it('audits variant disable and maps multiple preset histories to one family cohort', async () => {
	const classic = await issue();
	const { id, now, issued } = await issue(1, NO_UNDO);
	const mapping = buildActivityMapping(FAMILY);
	expect(mapping).toHaveLength(manifest.variants.length);
	expect(mapping.every((entry) => entry.rulesGroup === FAMILY)).toBe(true);
	await expect(
		changeVariant(db(), 'missing-operator', FAMILY, NO_UNDO, 'variant-disable', 'Test')
	).rejects.toThrow();
	await changeVariant(
		db(),
		'mahjong-operator',
		FAMILY,
		NO_UNDO,
		'variant-disable',
		'Test disable',
		now
	);
	expect(await variantAvailable(db(), FAMILY, NO_UNDO)).toBe(false);
	await expect(
		startRanked(db(), await owner(), FAMILY, 'disabled', now, null, undefined, NO_UNDO)
	).rejects.toMatchObject({ code: 'game_disabled' });
	const saved = await saveRun(
		db(),
		id,
		completion(issued, NO_UNDO),
		now + 1000 + CARD_RANKED_OPENING_MS + MAHJONG_ENTRANCE_MS + 2500
	);
	expect(saved.ranked).toBe(true);
	await changeVariant(db(), 'mahjong-operator', FAMILY, NO_UNDO, 'variant-enable', '', now + 1);
	expect(await variantAvailable(db(), FAMILY, NO_UNDO)).toBe(true);
	expect(
		(await db()
			.prepare(
				"SELECT COUNT(*) total FROM admin_audit WHERE target LIKE '%mahjong-solitaire%' AND action LIKE '%variant%'"
			)
			.first<{ total: number }>())!.total
	).toBeGreaterThanOrEqual(2);

	const classicSaved = await saveRun(
		db(),
		classic.id,
		completion(classic.issued),
		classic.now + 1000 + CARD_RANKED_OPENING_MS + MAHJONG_ENTRANCE_MS + 2500
	);
	expect(classicSaved.ranked).toBe(true);
	const counts = await queryActivityCounts(db(), mapping);
	for (const variant of [CLASSIC, NO_UNDO])
		expect(counts.find((entry) => entry.variant === variant)?.totalCompleted).toBeGreaterThan(0);
	const history = await queryScoreHistory(db(), FAMILY, [{ id: CLASSIC }, { id: NO_UNDO }]);
	for (const variant of [CLASSIC, NO_UNDO])
		expect(history.some((entry) => entry.variant === variant && entry.rules_group === FAMILY)).toBe(
			true
		);
	const statistics = await gameStatistics(db(), FAMILY);
	for (const variant of [CLASSIC, NO_UNDO])
		expect(statistics.variants.find((entry) => entry.id === variant)!.rows.length).toBeGreaterThan(
			0
		);
});

it('keeps issued scoring immutable when the classic score configuration changes', async () => {
	const { id, now, issued } = await issue();
	const run = completion(issued);
	const expected = manifest.replay(run.seed, run.moves, 25, scoring.defaults, CLASSIC).score;
	const { version } = await saveScoreConfig(
		db(),
		'mahjong-operator',
		FAMILY,
		'brief-v1',
		{ ...scoring.defaults, pair: 200 },
		'Adjust pair score',
		false,
		undefined,
		CLASSIC
	);
	expect((await readLiveScoreConfig(db(), FAMILY, undefined, CLASSIC)).config.version).toBe(
		version
	);
	expect((await readLiveScoreConfig(db(), FAMILY, undefined, NO_UNDO)).config.version).toBe(
		'brief-v1'
	);
	const { version: noUndoVersion } = await saveScoreConfig(
		db(),
		'mahjong-operator',
		FAMILY,
		'brief-v1',
		{ ...scoring.defaults, pair: 300 },
		'Adjust no-undo score',
		false,
		undefined,
		NO_UNDO
	);
	expect(noUndoVersion).not.toBe(version);
	expect((await readLiveScoreConfig(db(), FAMILY, undefined, CLASSIC)).config.values.pair).toBe(
		200
	);
	expect((await readLiveScoreConfig(db(), FAMILY, undefined, NO_UNDO)).config.values.pair).toBe(
		300
	);
	expect(
		(await db()
			.prepare(
				"SELECT COUNT(*) total FROM admin_audit WHERE action='score-change' AND target IN (?,?)"
			)
			.bind(`${FAMILY}:classic`, `${FAMILY}:no-undo`)
			.first<{ total: number }>())!.total
	).toBeGreaterThanOrEqual(2);
	const saved = await saveRun(
		db(),
		id,
		run,
		now + 1000 + CARD_RANKED_OPENING_MS + MAHJONG_ENTRANCE_MS + 25000
	);
	expect(saved.score).toBe(expected);

	const nextNow = noon + ++sequence * day;
	await pin(utcDate(nextNow), issued.seed, CLASSIC, version);
	const nextOwner = await owner();
	const next = await startDailyRanked(
		db(),
		nextOwner,
		FAMILY,
		nextOwner,
		nextNow,
		undefined,
		secret
	);
	expect(next.scoring.version).toBe(version);
	const nextSaved = await saveRun(
		db(),
		nextOwner,
		completion(next),
		nextNow + 1000 + CARD_RANKED_OPENING_MS + MAHJONG_ENTRANCE_MS + 25000
	);
	expect(nextSaved.score).toBeGreaterThan(saved.score);
});
