import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { manifest } from '../../src/lib/puzzles/light-bend/manifest.js';
import {
	applyLightBendMove,
	createLightBendRound,
	lightBendScore,
	lightBendWitness,
	LIGHT_BEND_ACTION,
	LIGHT_BEND_COUNTDOWN,
	type LightBendMove
} from '../../src/lib/puzzles/light-bend/logic.js';
import { scoring } from '../../src/lib/puzzles/light-bend/scoring.js';
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
import { CARD_RANKED_OPENING_MS, LIGHT_BEND_ENTRANCE_MS } from '../../src/lib/round-timing.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';

const FAMILY = 'light-bend';
const CLASSIC = `${FAMILY}:classic`;
const NO_HINT = `${FAMILY}:no-hint`;
const COUNTDOWN = `${FAMILY}:countdown-120`;
const noon = Date.parse('2026-11-16T12:00:00Z');
const day = 86_400_000;
const secret = 'light-bend-local-test-secret';
/** The full opening the server subtracts before it measures active play. */
const OPENING = CARD_RANKED_OPENING_MS + LIGHT_BEND_ENTRANCE_MS;
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

async function pin(date: string, seed: string, variant = CLASSIC, version = 'brief-v1') {
	await db()
		.prepare(
			'INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at) VALUES(?,?,?,?,?,?,?)'
		)
		.bind(FAMILY, date, variant, seed, 'light-bend-1', version, Date.parse(`${date}T00:00:00Z`))
		.run();
}

async function issue(variant = CLASSIC, version?: string, seed = '1') {
	const now = noon + ++sequence * day;
	const pinned =
		version ?? (await readLiveScoreConfig(db(), FAMILY, undefined, variant)).config.version;
	await pin(utcDate(now), seed, variant, pinned);
	const id = await owner();
	const issued = await startDailyRanked(db(), id, FAMILY, id, now, undefined, secret);
	return { id, now, issued, seed, variant, version: pinned };
}

function completion(
	issued: { id: string; seed: string },
	variant = CLASSIC,
	options: { hint?: boolean } = {}
): CompletedRun {
	const moves: LightBendMove[] = [];
	if (options.hint) moves.push({ action: LIGHT_BEND_ACTION.hint, cell: 0, value: 0 });
	moves.push(...lightBendWitness(createLightBendRound(issued.seed, variant)));
	return {
		version: 1,
		id: issued.id,
		family: FAMILY,
		seed: issued.seed,
		engineVersion: 'light-bend-1',
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
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES('lb-operator','admin')").run();
});

afterAll(async () => {
	await proxy?.dispose();
});

it('issues one group-less daily board for the whole family and keeps one ranked attempt', async () => {
	const { id, now, issued } = await issue();
	expect(manifest.enabled).toBe(true);
	expect(manifest.variants).toHaveLength(11);
	expect(manifest.variants!.every((variant) => variant.enabled)).toBe(true);
	expect(manifest).not.toHaveProperty('leaderboardGroups');
	expect(manifest.presentation.groups).toEqual({});
	// The issued round carries the eight rule keys and no witness or variant id.
	expect(Object.keys(issued.round.rules as object).sort()).toEqual([
		'beam',
		'hint',
		'info',
		'limit',
		'mirror',
		'sources',
		'undo',
		'win'
	]);
	expect(issued.round).not.toHaveProperty('witness');
	expect(JSON.stringify(issued)).not.toContain(`${FAMILY}:`);

	// A second player gets byte-identical rules from the same pinned board.
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

	// Resume replays the log so far and keeps the same session.
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

	const saved = await saveRun(db(), id, run, now + 1000 + OPENING + 10000);
	expect(saved.ranked).toBe(true);
	// The group-less family binds its own id as the internal storage cohort only.
	expect(await completedRow(issued.id)).toMatchObject({ ranked: 1, rules_group: FAMILY });
	expect(await boardRows(id)).toBe(1);
	await expect(
		startDailyRanked(db(), id, FAMILY, id, now + 30000, undefined, secret)
	).rejects.toMatchObject({ code: 'daily_spent' });
	const board = await dailyBoard(db(), FAMILY, utcDate(now), id, undefined, 25, now + 30000);
	expect(board.own?.score).toBe(saved.score);
});

for (const [active, ranked] of [
	[2499, false],
	[2500, true]
] as const) {
	it(`floor at ${active}ms of active play saves ranked=${ranked} and consumes the attempt`, async () => {
		const { id, now, issued } = await issue();
		const submitted = now + 1000 + OPENING + active;
		const run = completion(issued);
		const saved = await saveRun(db(), id, run, submitted);
		expect(saved.ranked).toBe(ranked);
		expect(await completedRow(run.id)).toMatchObject({
			ranked: Number(ranked),
			rules_group: FAMILY
		});
		expect(await boardRows(id)).toBe(Number(ranked));
		expect(
			await db().prepare('SELECT abandoned_at FROM play_session WHERE id=?').bind(run.id).first()
		).toEqual({ abandoned_at: null });
		// The save is idempotent, and the attempt is spent either way.
		expect(await saveRun(db(), id, run, submitted + 1000)).toEqual(saved);
		await expect(
			startDailyRanked(db(), id, FAMILY, id, submitted + 1000, undefined, secret)
		).rejects.toMatchObject({ code: 'daily_spent' });
		if (ranked) {
			const board = await dailyBoard(db(), FAMILY, utcDate(now), id, undefined, 25, submitted);
			expect(board.own?.score).toBe(saved.score);
		}
	});
}

it('ranks a hint-assisted daily as "solved with hint" while hintSolvedRanks stays on', async () => {
	const { id, now, issued } = await issue();
	const hinted = completion(issued, CLASSIC, { hint: true });
	const submitted = now + 1000 + OPENING + 10000;
	const saved = await saveRun(db(), id, hinted, submitted);
	expect(saved.ranked).toBe(true);
	expect(await completedRow(hinted.id)).toMatchObject({ ranked: 1, rules_group: FAMILY });
	expect(await boardRows(id)).toBe(1);
	// The hint still costs points, so the same board with a hint scores lower.
	const clean = createLightBendRound(issued.seed, CLASSIC);
	let solved = clean;
	for (const move of lightBendWitness(clean)) solved = applyLightBendMove(solved, move);
	const hintedRound = lightBendWitness(clean).reduce(
		(round, move) => applyLightBendMove(round, move),
		applyLightBendMove(clean, { action: LIGHT_BEND_ACTION.hint, cell: 0, value: 0 })
	);
	expect(lightBendScore(hintedRound, 10)).toBeLessThan(lightBendScore(solved, 10));
});

it('unranks a hint-assisted daily when the admin turns hintSolvedRanks off', async () => {
	const live = await readLiveScoreConfig(db(), FAMILY, undefined, CLASSIC);
	const { version } = await saveScoreConfig(
		db(),
		'lb-operator',
		FAMILY,
		live.liveVersion,
		{ ...scoring.defaults, hintSolvedRanks: 0 },
		'Hint no longer ranks',
		false,
		undefined
	);
	// The pinned session keeps its own score version, so re-pin the day at the new one.
	const next = await issue(CLASSIC, version);
	expect(next.issued.scoring.version).toBe(version);
	const hinted = completion(next.issued, CLASSIC, { hint: true });
	const saved = await saveRun(db(), next.id, hinted, next.now + 1000 + OPENING + 10000);
	expect(saved.ranked).toBe(false);
	expect(await completedRow(hinted.id)).toMatchObject({ ranked: 0, rules_group: FAMILY });
	expect(await boardRows(next.id)).toBe(0);

	// A clean solve at the same config still ranks.
	const clean = await issue(CLASSIC, version);
	const plain = await saveRun(
		db(),
		clean.id,
		completion(clean.issued),
		clean.now + 1000 + OPENING + 10000
	);
	expect(plain.ranked).toBe(true);
	expect(await boardRows(clean.id)).toBe(1);
});

it('counts hidden time on the server after a ranked resume', async () => {
	const { id, now, issued } = await issue();
	const run = completion(issued);
	const hiddenMs = 30_000;
	await resumeDailyRanked(db(), id, issued.id, run.moves.slice(0, 1), undefined, now + 5000);
	run.elapsedSeconds = 0;
	const saved = await saveRun(db(), id, run, now + 1000 + OPENING + 5000 + hiddenMs);
	expect(saved.ranked).toBe(true);
	// The server measures the hidden gap, so the scored seconds include it.
	const row = await completedRow(run.id);
	expect(row).toMatchObject({ ranked: 1, rules_group: FAMILY });
	expect(row!.seconds).toBeGreaterThanOrEqual(30);
	expect(await boardRows(id)).toBe(1);
});

it('saves the countdown-120 variant under its own ceiling and times it out past 120 s', async () => {
	const { id, now, issued } = await issue(COUNTDOWN);
	const run = completion(issued, COUNTDOWN);
	// The timed path subtracts only the opening (no 1,000 ms wall allowance), so 60 s
	// of wall clock after the opening is 60 scored seconds.
	const saved = await saveRun(db(), id, run, now + OPENING + 60000);
	expect(saved.ranked).toBe(true);
	expect(await completedRow(run.id)).toMatchObject({
		ranked: 1,
		rules_group: FAMILY,
		seconds: 60
	});
	expect(await boardRows(id)).toBe(1);
	// Countdown pays the remaining seconds, so a fast clear beats a slow one.
	const fast = await issue(COUNTDOWN);
	const fastSaved = await saveRun(
		db(),
		fast.id,
		completion(fast.issued, COUNTDOWN),
		fast.now + OPENING + 5000
	);
	expect(fastSaved.score).toBeGreaterThan(saved.score);
	// A claim past the ceiling is an authoritative expiry, not a ranked score.
	const late = await issue(COUNTDOWN);
	const lateRun = completion(late.issued, COUNTDOWN);
	const submitted = late.now + OPENING + (LIGHT_BEND_COUNTDOWN + 5) * 1000;
	await expect(saveRun(db(), late.id, lateRun, submitted)).rejects.toMatchObject({
		code: 'too_slow'
	});
	expect(await completedRow(lateRun.id)).toBeNull();
	expect(await boardRows(late.id)).toBe(0);
});

it('audits variant disable and maps all eleven presets to one family cohort', async () => {
	const classic = await issue();
	const { id, now, issued } = await issue(NO_HINT);
	const mapping = buildActivityMapping(FAMILY);
	expect(mapping).toHaveLength(manifest.variants!.length);
	expect(mapping.every((entry) => entry.rulesGroup === FAMILY)).toBe(true);
	await expect(
		changeVariant(db(), 'missing-operator', FAMILY, NO_HINT, 'variant-disable', 'Test')
	).rejects.toThrow();
	await changeVariant(db(), 'lb-operator', FAMILY, NO_HINT, 'variant-disable', 'Test disable', now);
	expect(await variantAvailable(db(), FAMILY, NO_HINT)).toBe(false);
	await expect(
		startRanked(db(), await owner(), FAMILY, 'disabled', now, null, undefined, NO_HINT)
	).rejects.toMatchObject({ code: 'game_disabled' });
	// A session already pinned to the day still finishes after the disable.
	const saved = await saveRun(db(), id, completion(issued, NO_HINT), now + 1000 + OPENING + 5000);
	expect(saved.ranked).toBe(true);
	await changeVariant(db(), 'lb-operator', FAMILY, NO_HINT, 'variant-enable', '', now + 1);
	expect(await variantAvailable(db(), FAMILY, NO_HINT)).toBe(true);
	expect(
		(await db()
			.prepare(
				"SELECT COUNT(*) total FROM admin_audit WHERE target LIKE '%light-bend%' AND action LIKE '%variant%'"
			)
			.first<{ total: number }>())!.total
	).toBeGreaterThanOrEqual(2);

	const classicSaved = await saveRun(
		db(),
		classic.id,
		completion(classic.issued),
		classic.now + 1000 + OPENING + 5000
	);
	expect(classicSaved.ranked).toBe(true);
	const counts = await queryActivityCounts(db(), mapping);
	for (const variant of [CLASSIC, NO_HINT])
		expect(counts.find((entry) => entry.variant === variant)?.totalCompleted).toBeGreaterThan(0);
	const history = await queryScoreHistory(db(), FAMILY, [{ id: CLASSIC }, { id: NO_HINT }]);
	for (const variant of [CLASSIC, NO_HINT])
		expect(history.some((entry) => entry.variant === variant && entry.rules_group === FAMILY)).toBe(
			true
		);
	const statistics = await gameStatistics(db(), FAMILY);
	for (const variant of [CLASSIC, NO_HINT])
		expect(statistics.variants.find((entry) => entry.id === variant)!.rows.length).toBeGreaterThan(
			0
		);
});

it('keeps issued scoring immutable: one family config serves all eleven presets', async () => {
	const { id, now, issued } = await issue(CLASSIC, 'brief-v1');
	const run = completion(issued);
	const expected = manifest.replay(run.seed, run.moves, 50, scoring.defaults, CLASSIC).score;
	// The scope is the family, so a save without a variant is the same row every preset reads.
	const live = await readLiveScoreConfig(db(), FAMILY, undefined, CLASSIC);
	const { version } = await saveScoreConfig(
		db(),
		'lb-operator',
		FAMILY,
		live.liveVersion,
		{ ...scoring.defaults, second: 9 },
		'Adjust per-second score',
		false
	);
	expect((await readLiveScoreConfig(db(), FAMILY, undefined, CLASSIC)).config.version).toBe(
		version
	);
	expect((await readLiveScoreConfig(db(), FAMILY, undefined, COUNTDOWN)).config.version).toBe(
		version
	);
	expect((await readLiveScoreConfig(db(), FAMILY, undefined, NO_HINT)).config.values.second).toBe(
		9
	);
	const saved = await saveRun(db(), id, run, now + 1000 + OPENING + 50000);
	expect(saved.score).toBe(expected);

	// A day pinned to the new version issues and scores under it.
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
		nextNow + 1000 + OPENING + 50000
	);
	expect(nextSaved.score).toBeLessThan(saved.score);
	expect(
		(await db()
			.prepare("SELECT COUNT(*) total FROM admin_audit WHERE action='score-change' AND target=?")
			.bind(FAMILY)
			.first<{ total: number }>())!.total
	).toBeGreaterThanOrEqual(1);
});

it('rejects a tampered or incomplete log without a completion or daily row', async () => {
	const { id, now, issued } = await issue();
	const run = completion(issued);
	const submitted = now + 1000 + OPENING + 10000;
	await expect(
		saveRun(db(), id, { ...run, moves: run.moves.slice(0, -1) }, submitted)
	).rejects.toMatchObject({ code: 'invalid_replay' });
	expect(await completedRow(run.id)).toBeNull();
	expect(await boardRows(id)).toBe(0);
	// An illegal action code is rejected by the move parser before any state change.
	const other = await issue();
	await expect(
		saveRun(
			db(),
			other.id,
			{ ...completion(other.issued), moves: [{ action: 9, cell: 0, value: 0 }] },
			other.now + 1000 + OPENING + 10000
		)
	).rejects.toMatchObject({ code: 'move' });
	expect(await boardRows(other.id)).toBe(0);
});

it('gates the daily walk on dailySeedOk so an exhausted seed never becomes a board', async () => {
	// Every seed the walk accepts yields a board with a proven par and a valid witness.
	const accepted = Array.from({ length: 40 }, (_, index) => String(index + 1)).filter((seed) =>
		manifest.dailySeedOk!(seed, CLASSIC)
	);
	expect(accepted.length).toBeGreaterThan(30);
	for (const seed of accepted.slice(0, 6)) {
		const round = createLightBendRound(seed, CLASSIC);
		expect(round.par).toBeGreaterThanOrEqual(1);
		expect(lightBendWitness(round).length).toBeGreaterThan(0);
	}
	// dailySeedOk never throws, even for a seed that no pipeline run can accept.
	for (const seed of ['0', '1', '18446744073709551615'])
		expect(typeof manifest.dailySeedOk!(seed, CLASSIC)).toBe('boolean');
});
