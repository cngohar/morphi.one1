import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
import { createShapeDivisionRound } from '../../src/lib/puzzles/shape-division/logic.js';
import { manifest } from '../../src/lib/puzzles/shape-division/manifest.js';
import { scoring } from '../../src/lib/puzzles/shape-division/scoring.js';
import { readLiveScoreConfig, saveScoreConfig } from '../../src/lib/server/scoring.js';
import { saveRun } from '../../src/lib/server/runs.js';
import {
	startDailyRanked,
	startRanked,
	resumeDailyRanked
} from '../../src/lib/server/ranked-session.js';
import { dailyBest, dailyBoard, utcDate } from '../../src/lib/server/daily.js';
import { changeVariant, variantAvailable } from '../../src/lib/server/games.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const db = () => proxy.env.DB;
const family = 'shape-division';
const classic = 'shape-division:classic';
const countdown = 'shape-division:countdown-300';
const seed = '24';
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
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES('shape-operator','admin')").run();
});
afterAll(async () => {
	await proxy?.dispose();
});

async function owner(now: number) {
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
	return user;
}
async function issue() {
	const now = Date.parse('2026-11-20T12:00:00Z') + ++sequence * 86_400_000;
	const user = await owner(now);
	await db()
		.prepare(
			'INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at) VALUES(?,?,?,?,?,?,?)'
		)
		.bind(family, utcDate(now), classic, seed, 'shape-division-1', 'brief-v1', now)
		.run();
	const issued = await startDailyRanked(db(), user, family, user, now, undefined, 'shape-test');
	return { user, now, issued };
}
function winningMoves(variant = classic) {
	const board = createShapeDivisionRound(seed, variant).board;
	const part = board.cells.map((_, cell) =>
		board.solution.findIndex((piece) => piece.includes(cell))
	);
	return [
		...board.links
			.filter(({ cells: [a, b] }) => part[a] !== part[b])
			.map(({ edge: [first, second] }) => ({ action: 0, first, second })),
		{ action: 2, first: 0, second: 0 }
	];
}
function run(id: string, variant = classic, ranked = true): CompletedRun {
	return {
		version: 1,
		id,
		family,
		seed,
		engineVersion: 'shape-division-1',
		moves: winningMoves(variant),
		elapsedSeconds: 0,
		rankedSession: ranked ? id : null,
		...(ranked ? {} : { variant })
	};
}
async function rows(user: string) {
	return (await db()
		.prepare('SELECT COUNT(*) total FROM daily_best WHERE user_id=?')
		.bind(user)
		.first<{ total: number }>())!.total;
}

it('ships ten enabled presets without groups and saves a daily win', async () => {
	expect(manifest.enabled).toBe(true);
	expect(manifest.variants).toHaveLength(10);
	expect(manifest.variants!.every((v) => v.enabled)).toBe(true);
	expect(manifest.presentation.groups).toEqual({});
	expect(manifest).not.toHaveProperty('leaderboardGroups');
	const { user, now, issued } = await issue();
	const saved = await saveRun(db(), user, run(issued.id), now + 1200 + 2080 + 5000);
	expect(saved.ranked).toBe(true);
	expect(await rows(user)).toBe(1);
	expect(
		(await dailyBoard(db(), family, utcDate(now), user, undefined, 25, now + 30000)).rows[0]
	).toMatchObject({ score: saved.score, own: true });
});

for (const [active, ranked] of [
	[2499, false],
	[2500, true]
] as const)
	it(`applies the ${active}ms active floor and spends the attempt`, async () => {
		const { user, now, issued } = await issue();
		expect(
			(await saveRun(db(), user, run(issued.id), now + 1000 + 1200 + 2080 + active)).ranked
		).toBe(ranked);
		expect(await rows(user)).toBe(Number(ranked));
		await expect(
			startDailyRanked(db(), user, family, user, now + 30000, undefined, 'shape-test')
		).rejects.toMatchObject({ code: 'daily_spent' });
	});

it('labels a hinted daily win, including a reconstructed best', async () => {
	const { user, now, issued } = await issue();
	const completed = run(issued.id);
	completed.moves.unshift({ action: 3, first: 0, second: 0 });
	await saveRun(db(), user, completed, now + 8280);
	const board = () => dailyBoard(db(), family, utcDate(now), user, undefined, 25, now + 30000);
	expect((await board()).rows[0]).toMatchObject({ hintUsed: true });
	await db().prepare('DELETE FROM daily_best WHERE user_id=?').bind(user).run();
	expect(await dailyBest(db(), user, issued.id, undefined, now + 30000)).toEqual({
		family,
		date: utcDate(now)
	});
	expect((await board()).rows[0]).toMatchObject({ hintUsed: true });
});

it('saves three wrong Checks as a loss without a daily row', async () => {
	const { user, now, issued } = await issue();
	const completed = run(issued.id);
	completed.moves = Array.from({ length: 3 }, () => ({ action: 2, first: 0, second: 0 }));
	expect(await saveRun(db(), user, completed, now + 8280)).toMatchObject({ score: 0 });
	expect(await rows(user)).toBe(0);
	expect(await dailyBest(db(), user, issued.id, undefined, now + 30000)).toBeNull();
});

it('refuses non-Classic legacy ranked issuance and permits Classic', async () => {
	const now = Date.parse('2027-01-01T12:00:00Z');
	const user = await owner(now);
	await expect(
		startRanked(db(), user, family, user, now, null, undefined, countdown)
	).rejects.toMatchObject({ code: 'variant' });
	expect(await startRanked(db(), user, family, user, now, null, undefined, classic)).toHaveProperty(
		'id'
	);
});

it('honours a preset disable while an issued daily remains saveable', async () => {
	const { user, now, issued } = await issue();
	await changeVariant(
		db(),
		'shape-operator',
		family,
		classic,
		'variant-disable',
		'Focused test',
		now
	);
	try {
		expect(await variantAvailable(db(), family, classic)).toBe(false);
		expect((await saveRun(db(), user, run(issued.id), now + 8280)).ranked).toBe(true);
	} finally {
		await changeVariant(db(), 'shape-operator', family, classic, 'variant-enable', '', now + 1);
	}
});

for (const [seconds, timeout] of [
	[299, false],
	[300, true]
] as const)
	it(`saves practice countdown at ${seconds} whole seconds`, async () => {
		const now = Date.parse('2028-01-01T12:00:00Z') + ++sequence * 1000;
		const user = await owner(now);
		const completed = run(crypto.randomUUID(), countdown, false);
		completed.elapsedSeconds = seconds;
		if (timeout) completed.moves = [{ action: 5, first: 0, second: 0 }];
		const saved = await saveRun(db(), user, completed, now);
		expect(saved.ranked).toBe(false);
		if (timeout) expect(saved.score).toBe(0);
		else expect(saved.score).toBeGreaterThan(0);
	});

// The production issuer rejects this preset; these fixtures exercise the saver deadline itself.
async function countdownFixture() {
	const fixture = await issue();
	await db().batch([
		db().prepare('UPDATE play_session SET variant=? WHERE id=?').bind(countdown, fixture.issued.id),
		db()
			.prepare('UPDATE daily_puzzle SET variant=? WHERE family=? AND date=?')
			.bind(countdown, family, utcDate(fixture.now))
	]);
	return fixture;
}
for (const [elapsed, outcome] of [
	[3279, 'invalid_replay'],
	[303279, 'invalid_replay'],
	[303280, 'saved'],
	[305280, 'saved'],
	[305281, 'too_slow']
] as const)
	it(`checks ranked timeout at ${elapsed}ms`, async () => {
		const { user, now, issued } = await countdownFixture();
		const completed = run(issued.id, countdown);
		completed.moves = [{ action: 5, first: 0, second: 0 }];
		const saved = saveRun(db(), user, completed, now + elapsed);
		if (outcome === 'saved') expect(await saved).toMatchObject({ score: 0 });
		else await expect(saved).rejects.toMatchObject({ code: outcome });
		expect(await rows(user)).toBe(0);
	});
for (const [elapsed, valid] of [
	[303279, true],
	[303280, false]
] as const)
	it(`checks ranked countdown win at ${elapsed}ms`, async () => {
		const { user, now, issued } = await countdownFixture();
		const saved = saveRun(db(), user, run(issued.id, countdown), now + elapsed);
		if (valid) expect(await saved).toMatchObject({ ranked: true });
		else await expect(saved).rejects.toMatchObject({ code: 'invalid_replay' });
	});

it('replays a daily checkpoint and rejects excess moves without abandoning it', async () => {
	const { user, now, issued } = await issue();
	const completed = run(issued.id);
	const resumed = await resumeDailyRanked(
		db(),
		user,
		issued.id,
		completed.moves.slice(0, 1),
		undefined,
		now + 5000
	);
	expect(resumed.id).toBe(issued.id);
	expect(resumed.seed).toBe(seed);
	expect(resumed.scoring.version).toBe(issued.scoring.version);
	const excess = Array.from({ length: 10001 }, () => ({ action: 6, first: 0, second: 0 }));
	await expect(
		resumeDailyRanked(db(), user, issued.id, excess, undefined, now + 5000)
	).rejects.toMatchObject({ code: 'moves' });
	completed.moves = excess;
	await expect(saveRun(db(), user, completed, now + 8280)).rejects.toMatchObject({ code: 'moves' });
	expect(
		await db().prepare('SELECT abandoned_at FROM play_session WHERE id=?').bind(issued.id).first()
	).toEqual({ abandoned_at: null });
});

it('pins daily rules across an admin edit and uses new rules on the next daily', async () => {
	const pinned = await issue();
	const live = await readLiveScoreConfig(db(), family);
	const updated = await saveScoreConfig(
		db(),
		'shape-operator',
		family,
		live.liveVersion,
		{ ...scoring.defaults, hintSolvedRanks: 0, mistakeLimit: 7 },
		'Change rules',
		false
	);
	const second = await owner(pinned.now);
	const sameDay = await startDailyRanked(
		db(),
		second,
		family,
		second,
		pinned.now + 1000,
		undefined,
		'shape-test'
	);
	expect(sameDay.scoring.version).toBe(pinned.issued.scoring.version);
	expect(sameDay.scoring.version).not.toBe(updated.version);
	expect(sameDay.scoring.values).toEqual(pinned.issued.scoring.values);
	const nextTime = pinned.now + 86_400_000;
	sequence++;
	const nextUser = await owner(nextTime);
	const next = await startDailyRanked(
		db(),
		nextUser,
		family,
		nextUser,
		nextTime,
		undefined,
		'shape-test'
	);
	expect(next.scoring.version).toBe(updated.version);
	expect(next.scoring.values).toMatchObject({ hintSolvedRanks: 0, mistakeLimit: 7 });
});

it('credits a daily win after midnight to the day it began', async () => {
	const { user, now, issued } = await issue();
	const finished = now + 12 * 60 * 60 * 1000 + 1000;
	// Move the issued clock to just before midnight while retaining the pinned daily.
	await db()
		.prepare('UPDATE play_session SET created_at=?, expires_at=? WHERE id=?')
		.bind(finished - 11000, finished + 60_000, issued.id)
		.run();
	expect((await saveRun(db(), user, run(issued.id), finished)).ranked).toBe(true);
	expect(
		(await dailyBoard(db(), family, utcDate(now), user, undefined, 25, finished)).rows[0]
	).toMatchObject({ own: true });
});
