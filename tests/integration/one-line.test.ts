import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import {
	createLightBendRound,
	lightBendWitness,
	LIGHT_BEND_ACTION
} from '../../src/lib/puzzles/light-bend/logic.js';
import { saveRun } from '../../src/lib/server/runs.js';
import { startDailyRanked } from '../../src/lib/server/ranked-session.js';
import { dailyBest, dailyBoard, utcDate } from '../../src/lib/server/daily.js';
import { CARD_RANKED_OPENING_MS, LIGHT_BEND_ENTRANCE_MS } from '../../src/lib/round-timing.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
import { applyOneLineMove, createOneLineRound } from '../../src/lib/puzzles/one-line/logic.js';
import { manifest } from '../../src/lib/puzzles/one-line/manifest.js';
import { scoring } from '../../src/lib/puzzles/one-line/scoring.js';
import { readLiveScoreConfig, saveScoreConfig } from '../../src/lib/server/scoring.js';
import {
	buildActivityMapping,
	changeVariant,
	queryActivityCounts,
	queryScoreHistory,
	variantAvailable
} from '../../src/lib/server/games.js';
import { dailyPuzzle } from '../../src/lib/server/daily.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const db = () => proxy.env.DB;
const noon = Date.parse('2026-11-18T12:00:00Z');

beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort())
		await db().batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => db().prepare(part))
		);
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES('one-line-operator','admin')").run();
});
afterAll(async () => {
	await proxy?.dispose();
});

it('labels a hinted Light Bend daily win on the first save and on retry', async () => {
	const user = crypto.randomUUID();
	const family = 'light-bend';
	const variant = 'light-bend:classic';
	const seed = '1';
	const date = utcDate(noon);
	await db().batch([
		db()
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(user, 'Private', `${user}@example.test`, 1, noon, noon),
		db()
			.prepare('INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)')
			.bind(user, user, user, noon),
		db()
			.prepare(
				'INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at) VALUES(?,?,?,?,?,?,?)'
			)
			.bind(family, date, variant, seed, 'light-bend-1', 'brief-v1', noon)
	]);
	const issued = await startDailyRanked(db(), user, family, user, noon, undefined, 'one-line-test');
	const run: CompletedRun = {
		version: 1,
		id: issued.id,
		family,
		seed,
		engineVersion: 'light-bend-1',
		moves: [
			{ action: LIGHT_BEND_ACTION.hint, cell: 0, value: 0 },
			...lightBendWitness(createLightBendRound(seed, variant))
		],
		elapsedSeconds: 0,
		rankedSession: issued.id
	};
	await saveRun(
		db(),
		user,
		run,
		noon + 1000 + CARD_RANKED_OPENING_MS + LIGHT_BEND_ENTRANCE_MS + 5000
	);
	const board = () => dailyBoard(db(), family, date, user, undefined, 25, noon + 30000);
	expect((await board()).rows[0]).toMatchObject({ hintUsed: true });
	await db().prepare('DELETE FROM daily_best WHERE user_id=?').bind(user).run();
	expect(await dailyBest(db(), user, issued.id, undefined, noon + 30000)).toEqual({ family, date });
	expect((await board()).rows[0]).toMatchObject({ hintUsed: true });
});

const FAMILY = 'one-line';
const CLASSIC = 'one-line:classic';
const COUNTDOWN = 'one-line:countdown';
const VERDICT = 'one-line:verdict';
let sequence = 0;

async function issue(variant = CLASSIC, version = 'brief-v1', seed = '1') {
	const now = noon + ++sequence * 86_400_000;
	const user = crypto.randomUUID();
	await db().batch([
		db()
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(user, 'Private', `${user}@example.test`, 1, now, now),
		db()
			.prepare('INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)')
			.bind(user, user, user, now),
		db()
			.prepare(
				'INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at) VALUES(?,?,?,?,?,?,?)'
			)
			.bind(FAMILY, utcDate(now), variant, seed, 'one-line-1', version, now)
	]);
	const issued = await startDailyRanked(db(), user, FAMILY, user, now, undefined, 'one-line-test');
	return { user, now, issued, variant };
}

function completion(
	issued: { id: string; seed: string },
	variant = CLASSIC,
	hint = false
): CompletedRun {
	const moves = createOneLineRound(issued.seed, variant).solution;
	return {
		version: 1,
		id: issued.id,
		family: FAMILY,
		seed: issued.seed,
		engineVersion: 'one-line-1',
		moves: hint ? [{ action: 2, edge: 0, value: 0 }, ...moves] : moves,
		elapsedSeconds: 0,
		rankedSession: issued.id
	};
}

async function boardRows(user: string) {
	return (await db()
		.prepare('SELECT COUNT(*) total FROM daily_best WHERE user_id=?')
		.bind(user)
		.first<{ total: number }>())!.total;
}

it('ships all eleven presets enabled without groups and saves a clean family-board win', async () => {
	expect(manifest.enabled).toBe(true);
	expect(manifest.variants).toHaveLength(11);
	expect(manifest.variants!.every((variant) => variant.enabled)).toBe(true);
	expect(manifest.presentation.groups).toEqual({});
	expect(manifest).not.toHaveProperty('leaderboardGroups');
	const { user, now, issued } = await issue();
	const result = await saveRun(
		db(),
		user,
		completion(issued),
		now + 1000 + CARD_RANKED_OPENING_MS + 5000
	);
	expect(result.ranked).toBe(true);
	expect(await boardRows(user)).toBe(1);
	const board = await dailyBoard(db(), FAMILY, utcDate(now), user, undefined, 25, now + 30000);
	expect(board.rows[0]).toMatchObject({ score: result.score, own: true });
	expect(board.rows[0]).not.toHaveProperty('hintUsed');
});

for (const [active, ranked] of [
	[2499, false],
	[2500, true]
] as const)
	it(`applies the ${active}ms active timing floor and consumes the daily attempt`, async () => {
		const { user, now, issued } = await issue();
		const result = await saveRun(
			db(),
			user,
			completion(issued),
			now + 1000 + CARD_RANKED_OPENING_MS + active
		);
		expect(result.ranked).toBe(ranked);
		expect(await boardRows(user)).toBe(Number(ranked));
		await expect(
			startDailyRanked(db(), user, FAMILY, user, now + 30000, undefined, 'one-line-test')
		).rejects.toMatchObject({ code: 'daily_spent' });
	});

it('preserves the hinted label on first save and retry and respects pinned scoring', async () => {
	const pinned = await issue();
	const live = await readLiveScoreConfig(db(), FAMILY);
	const off = await saveScoreConfig(
		db(),
		'one-line-operator',
		FAMILY,
		live.liveVersion,
		{ ...scoring.defaults, hintSolvedRanks: 0 },
		'Disable hint ranking',
		false
	);
	const run = completion(pinned.issued, CLASSIC, true);
	expect(
		(await saveRun(db(), pinned.user, run, pinned.now + 1000 + CARD_RANKED_OPENING_MS + 5000))
			.ranked
	).toBe(true);
	const board = () =>
		dailyBoard(db(), FAMILY, utcDate(pinned.now), pinned.user, undefined, 25, pinned.now + 30000);
	expect((await board()).rows[0]).toMatchObject({ hintUsed: true });
	await db().prepare('DELETE FROM daily_best WHERE user_id=?').bind(pinned.user).run();
	expect(await dailyBest(db(), pinned.user, run.id, undefined, pinned.now + 30000)).toEqual({
		family: FAMILY,
		date: utcDate(pinned.now)
	});
	expect((await board()).rows[0]).toMatchObject({ hintUsed: true });
	const unranked = await issue(CLASSIC, off.version);
	expect(
		(
			await saveRun(
				db(),
				unranked.user,
				completion(unranked.issued, CLASSIC, true),
				unranked.now + 1000 + CARD_RANKED_OPENING_MS + 5000
			)
		).ranked
	).toBe(false);
	expect(await boardRows(unranked.user)).toBe(0);
});

for (const [elapsed, outcome] of [
	[2199, 'invalid_replay'],
	[31200, 'invalid_replay'],
	[121200, 'saved'],
	[123200, 'saved'],
	[123201, 'too_slow']
] as const)
	it(`validates countdown timeout at ${elapsed}ms ranked elapsed`, async () => {
		const { user, now, issued } = await issue(COUNTDOWN);
		const run = completion(issued, COUNTDOWN);
		run.moves = [{ action: 5, edge: 0, value: 0 }];
		const save = saveRun(db(), user, run, now + elapsed);
		if (outcome === 'saved') expect(await save).toMatchObject({ score: 0 });
		else await expect(save).rejects.toMatchObject({ code: outcome });
		expect(await boardRows(user)).toBe(0);
		if (outcome === 'saved') {
			expect(await dailyBest(db(), user, issued.id, undefined, now + 130000)).toBeNull();
			expect(await boardRows(user)).toBe(0);
		}
	});

for (const [elapsed, valid] of [
	[120200, true],
	[121200, false]
] as const)
	it(`validates countdown win at ${elapsed}ms ranked elapsed`, async () => {
		const { user, now, issued } = await issue(COUNTDOWN);
		const save = saveRun(db(), user, completion(issued, COUNTDOWN), now + elapsed);
		if (valid) expect(await save).toMatchObject({ ranked: true });
		else await expect(save).rejects.toMatchObject({ code: 'invalid_replay' });
		expect(await boardRows(user)).toBe(Number(valid));
	});

it('saves a wrong verdict as a loss and retry never inserts a board row', async () => {
	let seed = 1;
	while (createOneLineRound(String(seed), VERDICT).odd.length > 2) seed++;
	const { user, now, issued } = await issue(VERDICT, 'brief-v1', String(seed));
	const run = completion(issued, VERDICT);
	run.moves = [{ action: 4, edge: 0, value: 1 }];
	expect(await saveRun(db(), user, run, now + 1000 + CARD_RANKED_OPENING_MS + 5000)).toMatchObject({
		score: 0
	});
	expect(await boardRows(user)).toBe(0);
	expect(await dailyBest(db(), user, run.id, undefined, now + 30000)).toBeNull();
	expect(await boardRows(user)).toBe(0);
});

it('saves a stranded drawing as a loss and retry never inserts a board row', async () => {
	const { user, now, issued } = await issue();
	const initial = createOneLineRound(issued.seed, CLASSIC);
	let nodes = 0;
	function findLoss(
		round: typeof initial,
		moves: CompletedRun['moves']
	): CompletedRun['moves'] | undefined {
		if (round.status === 'stranded') return moves;
		if (round.status !== 'playing' || ++nodes > 10000) return undefined;
		for (let edge = 0; edge < round.edges.length; edge++) {
			for (const value of round.strokes.length
				? [0]
				: [round.edges[edge]!.from, round.edges[edge]!.to]) {
				const move = { action: 0, edge, value };
				try {
					const next = applyOneLineMove(round, move);
					const found = findLoss(next, [...moves, move]);
					if (found) return found;
				} catch {
					// Illegal traces are expected while searching for a legal dead end.
				}
			}
		}
	}
	const loss = findLoss(initial, []);
	expect(loss).toBeDefined();
	const run = completion(issued);
	run.moves = loss!;
	expect(await saveRun(db(), user, run, now + 1000 + CARD_RANKED_OPENING_MS + 5000)).toMatchObject({
		score: 0
	});
	expect(await boardRows(user)).toBe(0);
	expect(await dailyBest(db(), user, run.id, undefined, now + 30000)).toBeNull();
	expect(await boardRows(user)).toBe(0);
});

it('audits variant availability and exposes activity and score history without groups', async () => {
	const variant = 'one-line:one-way';
	const { user, now, issued } = await issue(variant);
	await changeVariant(
		db(),
		'one-line-operator',
		FAMILY,
		variant,
		'variant-disable',
		'Focused test',
		now
	);
	expect(await variantAvailable(db(), FAMILY, variant)).toBe(false);
	await saveRun(
		db(),
		user,
		completion(issued, variant),
		now + 1000 + CARD_RANKED_OPENING_MS + 5000
	);
	await changeVariant(db(), 'one-line-operator', FAMILY, variant, 'variant-enable', '', now + 1);
	const mapping = buildActivityMapping(FAMILY);
	expect(mapping).toHaveLength(11);
	expect(mapping.every((entry) => entry.rulesGroup === FAMILY)).toBe(true);
	expect(
		(await queryActivityCounts(db(), mapping)).find((row) => row.variant === variant)
			?.totalCompleted
	).toBeGreaterThan(0);
	expect(
		(await queryScoreHistory(db(), FAMILY, [{ id: variant }])).some(
			(row) => row.variant === variant && row.rules_group === FAMILY
		)
	).toBe(true);
	expect(
		await db()
			.prepare(
				"SELECT COUNT(*) total FROM admin_audit WHERE target LIKE '%one-line%' AND action LIKE '%variant%'"
			)
			.first()
	).toEqual({ total: 2 });
});

it('never issues verdict in the daily pool', async () => {
	for (const date of ['2029-01-01', '2029-01-02', '2029-01-03']) {
		const puzzle = await dailyPuzzle(db(), FAMILY, date, 'one-line-test');
		expect(puzzle.variant).not.toBe(VERDICT);
	}
});

it('reports daily unavailable when verdict is the only enabled preset', async () => {
	const disabled = manifest.variants!.filter((variant) => variant.id !== VERDICT);
	for (const variant of disabled)
		await changeVariant(
			db(),
			'one-line-operator',
			FAMILY,
			variant.id,
			'variant-disable',
			'Focused test',
			noon
		);
	try {
		await expect(dailyPuzzle(db(), FAMILY, '2030-01-01', 'one-line-test')).rejects.toMatchObject({
			code: 'daily_unavailable',
			status: 503
		});
		expect(await variantAvailable(db(), FAMILY, VERDICT)).toBe(true);
	} finally {
		for (const variant of disabled)
			await changeVariant(
				db(),
				'one-line-operator',
				FAMILY,
				variant.id,
				'variant-enable',
				'',
				noon + 1
			);
	}
});
