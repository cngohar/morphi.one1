import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { manifest } from '../../src/lib/puzzles/nonogram/manifest.js';
import {
	createNonogramRound,
	nonogramSolverRules,
	solveNonogramLines,
	type NonogramRound
} from '../../src/lib/puzzles/nonogram/logic.js';
import { scoring } from '../../src/lib/puzzles/nonogram/scoring.js';
import { saveRun } from '../../src/lib/server/runs.js';
import {
	abandonRanked,
	resumeDailyRanked,
	startDailyRanked,
	startRanked
} from '../../src/lib/server/ranked-session.js';
import { dailyBest, dailyBoard, dailyFreezeAt, utcDate } from '../../src/lib/server/daily.js';
import {
	buildActivityMapping,
	changeVariant,
	gameAvailable,
	gameStatistics,
	queryActivityCounts,
	queryScoreHistory,
	variantAvailable
} from '../../src/lib/server/games.js';
import { readLiveScoreConfig, saveScoreConfig } from '../../src/lib/server/scoring.js';
import { CARD_RANKED_OPENING_MS, NONOGRAM_ENTRANCE_MS } from '../../src/lib/round-timing.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const noon = Date.parse('2026-11-09T12:00:00Z');
let sequence = 0;
const db = () => proxy.env.DB;
const secret = 'nonogram-local-test-secret';
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
function seedAtSize(size: number, variant = 'nonogram:classic') {
	for (let seed = 1; seed <= 100; seed++) {
		if (createNonogramRound(String(seed), variant).size === size) return String(seed);
	}
	throw new Error(`Missing ${size} fixture seed`);
}
async function pin(date: string, seed: string, variant = 'nonogram:classic', version = 'brief-v1') {
	await db()
		.prepare(
			'INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at) VALUES(?,?,?,?,?,?,?)'
		)
		.bind('nonogram', date, variant, seed, 'nonogram-1', version, Date.parse(`${date}T00:00:00Z`))
		.run();
}
async function issue(size = 5, variant = 'nonogram:classic', seed = seedAtSize(size, variant)) {
	const now = noon + ++sequence * 86400000;
	await pin(utcDate(now), seed, variant);
	const id = await owner();
	const issued = await startDailyRanked(db(), id, 'nonogram', id, now, undefined, secret);
	return { id, now, issued, variant };
}
function completion(
	issued: { id: string; seed: string; round: unknown },
	variant = 'nonogram:classic'
): CompletedRun {
	const round = issued.round as NonogramRound;
	const solved = solveNonogramLines(
		round.size,
		round.rowClues,
		round.columnClues,
		undefined,
		undefined,
		nonogramSolverRules(round)
	);
	let stroke = 0;
	const moves = solved.grid.flatMap((mark, cell) =>
		mark > 0 || variant === 'nonogram:unchecked'
			? [{ cell, mark: mark || -1, at: stroke, stroke: stroke++ }]
			: []
	);
	return {
		version: 1,
		id: issued.id,
		family: 'nonogram',
		seed: issued.seed,
		engineVersion: 'nonogram-1',
		moves,
		elapsedSeconds: 0,
		rankedSession: issued.id
	};
}
async function row(id: string) {
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
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES('nonogram-operator','admin')").run();
});
afterAll(async () => {
	await proxy?.dispose();
});

it('ships enabled and issues one anonymous family/day puzzle without a solution or variant group', async () => {
	const { id, now, issued } = await issue();
	expect(await gameAvailable(db(), 'nonogram')).toBe(true);
	expect(manifest.variants.every((variant) => variant.enabled)).toBe(true);
	expect(manifest).not.toHaveProperty('leaderboardGroups');
	const second = await startDailyRanked(
		db(),
		await owner(),
		'nonogram',
		'second',
		now,
		undefined,
		secret
	);
	expect(second.round).toEqual(issued.round);
	expect(issued.round).not.toHaveProperty('solution');
	expect(JSON.stringify(issued)).not.toContain('nonogram:');
	const run = completion(issued);
	const restored = await resumeDailyRanked(
		db(),
		id,
		issued.id,
		run.moves.slice(0, 1),
		undefined,
		now + 1000
	);
	expect(restored.id).toBe(issued.id);
	expect(JSON.stringify(restored)).not.toContain('nonogram:');
	await abandonRanked(db(), id, issued.id, now + 2000);
	expect(await boardRows(id)).toBe(0);
});

for (const [size, active, ranked] of [
	[5, 2499, false],
	[5, 2500, true],
	[10, 9999, false],
	[10, 10000, true],
	[15, 22499, false],
	[15, 22500, true]
] as const) {
	it(`exact ${size}×${size} floor at ${active}ms saves ranked=${ranked} and consumes the attempt`, async () => {
		const { id, now, issued } = await issue(size);
		const run = completion(issued);
		const submitted = now + 1000 + CARD_RANKED_OPENING_MS + NONOGRAM_ENTRANCE_MS + active;
		const saved = await saveRun(db(), id, run, submitted);
		expect(saved.ranked).toBe(ranked);
		expect(await row(run.id)).toMatchObject({
			ranked: Number(ranked),
			rules_group: 'nonogram',
			seconds: Math.floor(active / 1000)
		});
		expect(await boardRows(id)).toBe(Number(ranked));
		expect(
			await db().prepare('SELECT abandoned_at FROM play_session WHERE id=?').bind(run.id).first()
		).toEqual({ abandoned_at: null });
		expect(await saveRun(db(), id, run, submitted + 1000)).toEqual(saved);
		await expect(
			startDailyRanked(db(), id, 'nonogram', id, submitted + 1000, undefined, secret)
		).rejects.toMatchObject({ code: 'daily_spent' });
		if (ranked) {
			const board = await dailyBoard(db(), 'nonogram', utcDate(now), id, undefined, 25, submitted);
			expect(board.own?.score).toBe(saved.score);
		}
	});
}

for (const [penalty, seconds, accepted] of [
	[false, 1799, true],
	[false, 1800, false],
	[true, 1679, true],
	[true, 1680, false]
] as const) {
	it(`countdown authoritative ${seconds}s with penalty=${penalty} accepts=${accepted} after opening allowances`, async () => {
		const { id, now, issued } = await issue(5, 'nonogram:countdown');
		const run = completion(issued, 'nonogram:countdown');
		if (penalty) {
			const round = createNonogramRound(issued.seed, 'nonogram:countdown');
			const empty = solveNonogramLines(round.size, round.rowClues, round.columnClues).grid.indexOf(
				0
			);
			run.moves = [
				{ at: 0, cell: empty, mark: 1, stroke: 0 },
				...run.moves.map((move) => ({ ...move, at: move.at! + 1, stroke: move.stroke! + 1 }))
			];
		}
		const submitted = now + CARD_RANKED_OPENING_MS + NONOGRAM_ENTRANCE_MS + seconds * 1000;
		if (accepted) {
			expect((await saveRun(db(), id, run, submitted)).ranked).toBe(true);
			expect(await boardRows(id)).toBe(1);
		} else {
			await expect(saveRun(db(), id, run, submitted)).rejects.toMatchObject({
				code: 'invalid_replay'
			});
			expect(await row(run.id)).toBeNull();
			expect(await boardRows(id)).toBe(0);
		}
	});
}

for (const variant of ['nonogram:three-hearts', 'nonogram:countdown']) {
	it(`${variant} loss abandons the exact ranked session and writes no score`, async () => {
		const { id, now, issued } = await issue(5, variant);
		await abandonRanked(db(), id, issued.id, now + 30000);
		expect(
			await db()
				.prepare('SELECT abandoned_at FROM play_session WHERE id=? AND user_id=?')
				.bind(issued.id, id)
				.first()
		).toEqual({ abandoned_at: now + 30000 });
		expect(await row(issued.id)).toBeNull();
		expect(await boardRows(id)).toBe(0);
		await expect(
			startDailyRanked(db(), id, 'nonogram', id, now + 31000, undefined, secret)
		).rejects.toMatchObject({ code: 'daily_spent' });
	});
}

for (const [active, ranked] of [
	[2499, false],
	[2500, true]
] as const) {
	it(`timed maxSeconds branch enforces the same exact ${active}ms minimum`, async () => {
		const { id, now, issued } = await issue(5, 'nonogram:countdown');
		const run = completion(issued, 'nonogram:countdown');
		const saved = await saveRun(
			db(),
			id,
			run,
			now + CARD_RANKED_OPENING_MS + NONOGRAM_ENTRANCE_MS + active
		);
		expect(saved.ranked).toBe(ranked);
		expect(await boardRows(id)).toBe(Number(ranked));
	});
}

it('recovers original pinned variant/date after session removal across midnight and repeated pins', async () => {
	const now = Date.parse('2027-02-01T23:59:50Z');
	const date = utcDate(now),
		variant = 'nonogram:no-undo',
		seed = seedAtSize(5, variant);
	await pin(date, seed, variant);
	await pin('2027-02-02', seed, variant);
	const id = await owner();
	const issued = await startDailyRanked(db(), id, 'nonogram', id, now, undefined, secret);
	const run = completion(issued, variant);
	const saved = await saveRun(db(), id, run, now + 30000);
	await db().prepare('DELETE FROM play_session WHERE id=?').bind(run.id).run();
	await db().prepare('DELETE FROM daily_best WHERE user_id=?').bind(id).run();
	expect(await saveRun(db(), id, run, now + 31000)).toEqual(saved);
	expect(
		await db().prepare('SELECT date FROM daily_best WHERE user_id=?').bind(id).first()
	).toEqual({ date });
	await expect(
		saveRun(db(), id, { ...run, variant: 'nonogram:classic' }, now + 32000)
	).rejects.toMatchObject({ code: 'conflict' });
	await db().prepare('DELETE FROM daily_best WHERE user_id=?').bind(id).run();
	await dailyBest(db(), id, run.id, undefined, dailyFreezeAt(date));
	expect(await boardRows(id)).toBe(0);
});

it('refuses unresolved pinned identity after session removal and late grace claims', async () => {
	const { id, now, issued } = await issue();
	const run = completion(issued);
	await saveRun(db(), id, run, now + 30000);
	await db().prepare('DELETE FROM play_session WHERE id=?').bind(run.id).run();
	await db()
		.prepare('DELETE FROM daily_puzzle WHERE family=? AND date=?')
		.bind('nonogram', utcDate(now))
		.run();
	await expect(saveRun(db(), id, run, now + 31000)).rejects.toMatchObject({ code: 'conflict' });
	const late = await issue();
	await expect(
		saveRun(db(), late.id, completion(late.issued), dailyFreezeAt(utcDate(late.now)))
	).rejects.toMatchObject({ code: 'expired_or_superseded' });
	expect(await boardRows(late.id)).toBe(0);
});

it('audits operator-only variant enable/disable without changing an already issued daily', async () => {
	const { id, now, issued } = await issue(5, 'nonogram:no-undo');
	await expect(
		changeVariant(
			db(),
			'missing-operator',
			'nonogram',
			'nonogram:no-undo',
			'variant-disable',
			'Test'
		)
	).rejects.toThrow();
	await changeVariant(
		db(),
		'nonogram-operator',
		'nonogram',
		'nonogram:no-undo',
		'variant-disable',
		'Test disable',
		now
	);
	expect(await variantAvailable(db(), 'nonogram', 'nonogram:no-undo')).toBe(false);
	await expect(
		startRanked(
			db(),
			await owner(),
			'nonogram',
			'disabled',
			now,
			null,
			undefined,
			'nonogram:no-undo'
		)
	).rejects.toMatchObject({ code: 'game_disabled' });
	expect(
		(await saveRun(db(), id, completion(issued, 'nonogram:no-undo'), now + 30000)).ranked
	).toBe(true);
	await changeVariant(
		db(),
		'nonogram-operator',
		'nonogram',
		'nonogram:no-undo',
		'variant-enable',
		'',
		now + 1
	);
	expect(await variantAvailable(db(), 'nonogram', 'nonogram:no-undo')).toBe(true);
	expect(
		(await db()
			.prepare(
				"SELECT COUNT(*) total FROM admin_audit WHERE target LIKE '%nonogram%' AND action LIKE '%variant%'"
			)
			.first<{ total: number }>())!.total
	).toBeGreaterThanOrEqual(2);
});

it('isolates immutable scoring versions per preset and retains issued scores', async () => {
	const { id, now, issued } = await issue();
	const run = completion(issued);
	const expected = manifest.replay(
		run.seed,
		run.moves,
		25,
		scoring.defaults,
		'nonogram:classic'
	).score;
	const { version } = await saveScoreConfig(
		db(),
		'nonogram-operator',
		'nonogram',
		'brief-v1',
		{ ...scoring.defaults, cell: 20 },
		'Adjust cells',
		false,
		undefined,
		'nonogram:classic'
	);
	expect(
		(await readLiveScoreConfig(db(), 'nonogram', undefined, 'nonogram:classic')).config.version
	).toBe(version);
	expect(
		(await readLiveScoreConfig(db(), 'nonogram', undefined, 'nonogram:no-undo')).config.version
	).toBe('brief-v1');
	const saved = await saveRun(
		db(),
		id,
		run,
		now + 1000 + CARD_RANKED_OPENING_MS + NONOGRAM_ENTRANCE_MS + 25000
	);
	expect(saved.score).toBe(expected);
	const nextNow = noon + ++sequence * 86400000;
	await pin(utcDate(nextNow), run.seed, 'nonogram:classic', version);
	const nextOwner = await owner();
	const next = await startDailyRanked(
		db(),
		nextOwner,
		'nonogram',
		nextOwner,
		nextNow,
		undefined,
		secret
	);
	expect(next.scoring.version).toBe(version);
	expect(
		(
			await saveRun(
				db(),
				nextOwner,
				completion(next),
				nextNow + 1000 + CARD_RANKED_OPENING_MS + NONOGRAM_ENTRANCE_MS + 25000
			)
		).score
	).toBeGreaterThan(saved.score);
});

it('returns one mapping per group-less preset and honest activity/per-preset history', async () => {
	const mapping = buildActivityMapping('nonogram');
	expect(mapping).toHaveLength(11);
	expect(mapping.every((entry) => entry.rulesGroup === 'nonogram')).toBe(true);
	const counts = await queryActivityCounts(db(), mapping);
	expect(counts.filter((entry) => entry.totalCompleted > 0).length).toBeGreaterThanOrEqual(2);
	const total = (await db()
		.prepare(
			"SELECT COUNT(*) total FROM completed_run r WHERE family='nonogram' AND (EXISTS(SELECT 1 FROM play_session s WHERE s.id=r.id AND s.user_id=r.user_id) OR EXISTS(SELECT 1 FROM account_round_activity a WHERE a.run_id=r.id AND a.user_id=r.user_id))"
		)
		.first<{ total: number }>())!.total;
	expect(counts.reduce((sum, entry) => sum + entry.totalCompleted, 0)).toBe(total);
	const history = await queryScoreHistory(db(), 'nonogram', [
		{ id: 'nonogram:no-undo' },
		{ id: 'nonogram:classic' }
	]);
	expect(
		history.some(
			(entry) => entry.variant === 'nonogram:no-undo' && entry.rules_group === 'nonogram'
		)
	).toBe(true);
	expect(
		history.some(
			(entry) => entry.variant === 'nonogram:classic' && entry.rules_group === 'nonogram'
		)
	).toBe(true);
	const statistics = await gameStatistics(db(), 'nonogram');
	expect(
		statistics.variants.find((entry) => entry.id === 'nonogram:no-undo')!.rows.length
	).toBeGreaterThan(0);
});
