import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
import { createSudokuRound, candidateMask } from '../../src/lib/puzzles/sudoku/logic.js';
import { manifest } from '../../src/lib/puzzles/sudoku/manifest.js';
import { scoring } from '../../src/lib/puzzles/sudoku/scoring.js';
import { saveRun } from '../../src/lib/server/runs.js';
import {
	abandonRanked,
	startDailyRanked,
	resumeDailyRanked
} from '../../src/lib/server/ranked-session.js';
import { dailyBest, dailyBoard, utcDate } from '../../src/lib/server/daily.js';
import { readLiveScoreConfig, saveScoreConfig } from '../../src/lib/server/scoring.js';
import {
	buildActivityMapping,
	changeVariant,
	queryActivityCounts,
	queryScoreHistory,
	variantAvailable
} from '../../src/lib/server/games.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const db = () => proxy.env.DB;
const family = 'sudoku';
const classic = 'sudoku:classic';
const countdown = 'sudoku:countdown-600';
let sequence = 0;

beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort())
		await db().batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => db().prepare(part))
		);
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES('sudoku-operator','admin')").run();
});
afterAll(async () => {
	await proxy?.dispose();
});

async function issue(variant = classic, version = 'brief-v1', pin = true) {
	const now = Date.parse('2026-11-19T12:00:00Z') + ++sequence * 86_400_000;
	const user = crypto.randomUUID();
	await db().batch([
		db()
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(user, 'Private', `${user}@example.test`, 1, now, now),
		db()
			.prepare('INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)')
			.bind(user, user, user, now)
	]);
	if (pin)
		await db()
			.prepare(
				'INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at) VALUES(?,?,?,?,?,?,?)'
			)
			.bind(family, utcDate(now), variant, '1', 'sudoku-1', version, now)
			.run();
	const issued = await startDailyRanked(db(), user, family, user, now, undefined, 'sudoku-test');
	return { user, now, issued, variant };
}
function completion(
	issued: { id: string; seed: string },
	variant = classic,
	hint = false
): CompletedRun {
	const round = createSudokuRound(issued.seed, variant);
	const empty = round.givens.map((value, cell) => ({ value, cell })).filter(({ value }) => !value);
	const moves = empty
		.slice(hint ? 1 : 0)
		.map(({ cell }) => ({ action: 0, cell, value: round.solution[cell]! }));
	return {
		version: 1,
		id: issued.id,
		family,
		seed: issued.seed,
		engineVersion: 'sudoku-1',
		moves: hint ? [{ action: 4, cell: 0, value: 0 }, ...moves] : moves,
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

it('ships eleven enabled group-less presets and saves a clean board win', async () => {
	expect(manifest.enabled).toBe(true);
	expect(manifest.variants).toHaveLength(11);
	expect(manifest.variants!.every((v) => v.enabled)).toBe(true);
	expect(manifest.presentation.groups).toEqual({});
	expect(manifest).not.toHaveProperty('leaderboardGroups');
	const { user, now, issued } = await issue();
	const result = await saveRun(db(), user, completion(issued), now + 8200 + 5000);
	expect(result.ranked).toBe(true);
	expect(await boardRows(user)).toBe(1);
	const board = await dailyBoard(db(), family, utcDate(now), user, undefined, 25, now + 30000);
	expect(board.rows[0]).toMatchObject({ score: result.score, own: true });
	expect(board.rows[0]).not.toHaveProperty('hintUsed');
});

for (const [active, ranked] of [
	[2499, false],
	[2500, true]
] as const)
	it(`applies the ${active}ms floor and spends the daily attempt`, async () => {
		const { user, now, issued } = await issue();
		const result = await saveRun(db(), user, completion(issued), now + 8200 + active);
		expect(result.ranked).toBe(ranked);
		expect(await boardRows(user)).toBe(Number(ranked));
		await expect(
			startDailyRanked(db(), user, family, user, now + 30000, undefined, 'sudoku-test')
		).rejects.toMatchObject({ code: 'daily_spent' });
	});

it('pins all scoring fields and honours hint ranking across versions', async () => {
	expect(scoring.fields).toEqual([
		'completion',
		'second',
		'floor',
		'hint',
		'mistake',
		'restart',
		'countdown',
		'hintSolvedRanks',
		'mistakeLimit',
		'hintCap'
	]);
	const pinned = await issue();
	const live = await readLiveScoreConfig(db(), family);
	const off = await saveScoreConfig(
		db(),
		'sudoku-operator',
		family,
		live.liveVersion,
		{ ...scoring.defaults, hintSolvedRanks: 0 },
		'Disable hint ranking',
		false
	);
	const run = completion(pinned.issued, classic, true);
	expect((await saveRun(db(), pinned.user, run, pinned.now + 13200)).ranked).toBe(true);
	const board = () =>
		dailyBoard(db(), family, utcDate(pinned.now), pinned.user, undefined, 25, pinned.now + 30000);
	expect((await board()).rows[0]).toMatchObject({ hintUsed: true });
	await db().prepare('DELETE FROM daily_best WHERE user_id=?').bind(pinned.user).run();
	expect(await dailyBest(db(), pinned.user, run.id, undefined, pinned.now + 30000)).toEqual({
		family,
		date: utcDate(pinned.now)
	});
	expect((await board()).rows[0]).toMatchObject({ hintUsed: true });
	const unranked = await issue(classic, off.version);
	expect(
		(
			await saveRun(
				db(),
				unranked.user,
				completion(unranked.issued, classic, true),
				unranked.now + 13200
			)
		).ranked
	).toBe(false);
	expect(await boardRows(unranked.user)).toBe(0);
});

for (const [elapsed, outcome] of [
	[8199, 'invalid_replay'],
	[37200, 'invalid_replay'],
	[607199, 'invalid_replay'],
	[607200, 'saved'],
	[609200, 'saved'],
	[609201, 'too_slow']
] as const)
	it(`validates countdown timeout at ${elapsed}ms`, async () => {
		const { user, now, issued } = await issue(countdown);
		const run = completion(issued, countdown);
		run.moves = [{ action: 5, cell: 0, value: 0 }];
		const save = saveRun(db(), user, run, now + elapsed);
		if (outcome === 'saved') expect(await save).toMatchObject({ score: 0 });
		else await expect(save).rejects.toMatchObject({ code: outcome });
		expect(await boardRows(user)).toBe(0);
		if (outcome === 'saved') {
			expect(await dailyBest(db(), user, issued.id, undefined, now + 620000)).toBeNull();
			await expect(
				startDailyRanked(db(), user, family, user, now + 620000, undefined, 'sudoku-test')
			).rejects.toMatchObject({ code: 'daily_spent' });
		}
	});

for (const [elapsed, valid] of [
	[606200, true],
	[607200, false]
] as const)
	it(`validates countdown win at ${elapsed}ms`, async () => {
		const { user, now, issued } = await issue(countdown);
		const save = saveRun(db(), user, completion(issued, countdown), now + elapsed);
		if (valid) expect(await save).toMatchObject({ ranked: true });
		else await expect(save).rejects.toMatchObject({ code: 'invalid_replay' });
		expect(await boardRows(user)).toBe(Number(valid));
	});

it('audits availability and returns group-less activity and history', async () => {
	const variant = classic;
	const { user, now, issued } = await issue(variant);
	await changeVariant(
		db(),
		'sudoku-operator',
		family,
		variant,
		'variant-disable',
		'Focused test',
		now
	);
	expect(await variantAvailable(db(), family, variant)).toBe(false);
	await saveRun(db(), user, completion(issued, variant), now + 13200);
	await changeVariant(db(), 'sudoku-operator', family, variant, 'variant-enable', '', now + 1);
	const mapping = buildActivityMapping(family);
	expect(mapping).toHaveLength(11);
	expect(mapping.every((entry) => entry.rulesGroup === family)).toBe(true);
	expect(
		(await queryActivityCounts(db(), mapping)).find((row) => row.variant === variant)
			?.totalCompleted
	).toBeGreaterThan(0);
	expect(
		(await queryScoreHistory(db(), family, [{ id: variant }])).some(
			(row) => row.variant === variant && row.rules_group === family
		)
	).toBe(true);
	expect(
		await db()
			.prepare(
				"SELECT COUNT(*) total FROM admin_audit WHERE target LIKE '%sudoku%' AND action LIKE '%variant%'"
			)
			.first()
	).toEqual({ total: 2 });
});

it('saves a third solution-error as a loss and spends the daily', async () => {
	const { user, now, issued } = await issue();
	const round = createSudokuRound(issued.seed, classic);
	let wrong: { action: number; cell: number; value: number } | undefined;
	for (let cell = 0; cell < 81 && !wrong; cell++)
		if (!round.givens[cell]) {
			for (let value = 1; value <= 9; value++)
				if (value !== round.solution[cell] && candidateMask(round.cells, cell) & (1 << value)) {
					wrong = { action: 0, cell, value };
					break;
				}
		}
	expect(wrong).toBeDefined();
	const undo = { action: 3, cell: 0, value: 0 };
	const run = completion(issued);
	run.moves = [wrong!, undo, wrong!, undo, wrong!];
	expect(await saveRun(db(), user, run, now + 13200)).toMatchObject({ score: 0 });
	expect(await boardRows(user)).toBe(0);
	expect(await dailyBest(db(), user, issued.id, undefined, now + 30000)).toBeNull();
	await expect(
		startDailyRanked(db(), user, family, user, now + 30000, undefined, 'sudoku-test')
	).rejects.toMatchObject({ code: 'daily_spent' });
});

it('accepts a legitimate zero-point win on the board', async () => {
	const live = await readLiveScoreConfig(db(), family);
	const zero = await saveScoreConfig(
		db(),
		'sudoku-operator',
		family,
		live.liveVersion,
		{ ...scoring.defaults, completion: 0, floor: 0 },
		'Zero score',
		false
	);
	const { user, now, issued } = await issue(classic, zero.version);
	expect(await saveRun(db(), user, completion(issued), now + 13200)).toMatchObject({
		score: 0,
		ranked: true
	});
	expect(await boardRows(user)).toBe(1);
});

it('replays ranked checkpoints and rejects excess moves without abandoning the session', async () => {
	const { user, now, issued } = await issue();
	const run = completion(issued);
	const fresh = await resumeDailyRanked(db(), user, issued.id, [], undefined, now + 5000);
	expect(fresh.id).toBe(issued.id);
	expect(fresh.seed).toBe(issued.seed);
	expect(fresh.scoring.version).toBe(issued.scoring.version);
	expect(fresh.round).toEqual(issued.round);
	const resumed = await resumeDailyRanked(
		db(),
		user,
		issued.id,
		run.moves.slice(0, 1),
		undefined,
		now + 5000
	);
	expect(resumed.id).toBe(issued.id);
	expect(resumed.seed).toBe(issued.seed);
	expect(resumed.scoring.version).toBe(issued.scoring.version);
	const over = Array.from({ length: 10001 }, () => ({ action: 6, cell: 0, value: 0 }));
	await expect(
		resumeDailyRanked(db(), user, issued.id, over, undefined, now + 5000)
	).rejects.toMatchObject({ code: 'moves' });
	run.moves = over;
	await expect(saveRun(db(), user, run, now + 13200)).rejects.toMatchObject({ code: 'moves' });
	expect(
		await db().prepare('SELECT abandoned_at FROM play_session WHERE id=?').bind(issued.id).first()
	).toEqual({ abandoned_at: null });
});

it('accepts a terminal timeout in the ten-thousandth move slot', async () => {
	const { user, now, issued } = await issue(countdown);
	const run = completion(issued, countdown);
	run.moves = [
		...Array.from({ length: 9999 }, () => ({ action: 6, cell: 0, value: 0 })),
		{ action: 5, cell: 0, value: 0 }
	];
	expect(await saveRun(db(), user, run, now + 607200)).toMatchObject({ score: 0 });
	expect(await boardRows(user)).toBe(0);
});

it('keeps the pinned scoring version for a player starting after an edit', async () => {
	const pinned = await issue();
	const live = await readLiveScoreConfig(db(), family);
	const updated = await saveScoreConfig(
		db(),
		'sudoku-operator',
		family,
		live.liveVersion,
		{ ...scoring.defaults, hintSolvedRanks: 0, mistakeLimit: 7 },
		'Change rules',
		false
	);
	const user = crypto.randomUUID();
	await db().batch([
		db()
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(user, 'Private', `${user}@example.test`, 1, pinned.now, pinned.now),
		db()
			.prepare('INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)')
			.bind(user, user, user, pinned.now)
	]);
	const later = await startDailyRanked(
		db(),
		user,
		family,
		user,
		pinned.now + 1000,
		undefined,
		'sudoku-test'
	);
	expect(later.scoring.version).toBe(pinned.issued.scoring.version);
	expect(later.scoring.version).not.toBe(updated.version);
	expect(later.scoring.values).toEqual(pinned.issued.scoring.values);
	const mismatched = { ...completion(pinned.issued), scoreConfigVersion: updated.version };
	await expect(saveRun(db(), pinned.user, mismatched, pinned.now + 13200)).rejects.toMatchObject({
		code: 'score_version'
	});
	const next = await issue(classic, updated.version, false);
	expect(next.issued.scoring.version).toBe(updated.version);
	expect(next.issued.scoring.values).toMatchObject({ hintSolvedRanks: 0, mistakeLimit: 7 });
});

for (const [elapsed, ranked] of [
	[8199, false],
	[9699, false],
	[9700, true]
] as const)
	it(`applies the countdown floor at ${elapsed}ms`, async () => {
		const { user, now, issued } = await issue(countdown);
		const result = await saveRun(db(), user, completion(issued, countdown), now + elapsed);
		expect(result.ranked).toBe(ranked);
		expect(await boardRows(user)).toBe(Number(ranked));
	});

it('spends a ranked daily when a capped round is abandoned', async () => {
	const { user, now, issued } = await issue();
	const moves = Array.from({ length: 9999 }, () => ({ action: 6, cell: 0, value: 0 }));
	const resumed = await resumeDailyRanked(db(), user, issued.id, moves, undefined, now + 4000);
	expect(resumed.id).toBe(issued.id);
	await abandonRanked(db(), user, issued.id, now + 5000);
	expect(await boardRows(user)).toBe(0);
	expect(
		await db().prepare('SELECT id FROM completed_run WHERE id=?').bind(issued.id).first()
	).toBeNull();
	await expect(startDailyRanked(db(), user, family, user, now + 6000)).rejects.toMatchObject({
		code: 'daily_spent'
	});
});
