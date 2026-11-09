import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { catalog } from '../../src/lib/catalog.js';
import type { CompletedRun, PuzzleId } from '../../src/lib/engine/contract.js';
import { defaultScoreConfig } from '../../src/lib/scoring.js';
import { createMemoryRound } from '../../src/lib/puzzles/memory/logic.js';
import { createConnectRound } from '../../src/lib/puzzles/connect/logic.js';
import {
	dailyBest,
	dailyBoard,
	dailyCompletionStatements,
	dailyFreezeAt,
	dailyPuzzle,
	dailyStreak,
	utcDate,
	type DailyIssued
} from '../../src/lib/server/daily.js';
import { dailyBoardKey } from '../../src/lib/server/config-cache.js';
import {
	accountHistory,
	digest,
	parseRun,
	saveRun,
	startRanked
} from '../../src/lib/server/runs.js';
import {
	abandonRanked,
	resumeDailyRanked,
	startDailyRanked
} from '../../src/lib/server/ranked-session.js';
import { recordRoundStart } from '../../src/lib/server/activity.js';
import { loadMemoryDirectory } from '../../src/lib/server/memory-directory.js';
import { gameStatistics } from '../../src/lib/server/games.js';
import { pruneExpiredRecords } from '../../src/lib/server/retention.js';
import cron from '../../workers/cron.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const noon = Date.parse('2026-11-09T12:00:00Z');
const day = 86_400_000;
const secret = 'integration-daily-secret-do-not-publish';
const identities = Object.values(catalog).flatMap(
	(family) => family.variants?.map((v) => v.id) ?? []
);
let serial = 0;

async function migrate(db: D1Database) {
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort())
		await db.batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => db.prepare(part))
		);
}
async function owner(db = proxy.env.DB) {
	const id = crypto.randomUUID();
	const name = `daily_${++serial}`;
	await db.batch([
		db
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(id, 'Private provider name', `${id}@example.test`, 1, noon, noon),
		db
			.prepare('INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)')
			.bind(id, name, name, noon)
	]);
	return id;
}
async function pin(
	family: PuzzleId,
	date: string,
	variant = 'memory:no-preview',
	db = proxy.env.DB
) {
	await db
		.prepare(
			`INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at)
		VALUES(?,?,?,?,?,?,?)`
		)
		.bind(
			family,
			date,
			variant,
			'42',
			catalog[family].engineVersion,
			defaultScoreConfig(family, variant).version,
			Date.parse(`${date}T00:00:00Z`)
		)
		.run();
}
function completion(
	issued: Pick<DailyIssued, 'family' | 'id' | 'seed' | 'engineVersion'>
): CompletedRun {
	const moves =
		issued.family === 'connect'
			? createConnectRound(issued.seed).solution.flatMap((path, pair) =>
					path.map((cell, at) => ({ pair, cell, stroke: pair, at: pair * 100 + at }))
				)
			: [
					...new Set(
						createMemoryRound(issued.seed, 'memory:no-preview').cards.map((card) => card.symbol)
					)
				].flatMap((symbol) =>
					createMemoryRound(issued.seed, 'memory:no-preview').cards.flatMap((card, index) =>
						card.symbol === symbol ? [{ index }] : []
					)
				);
	return {
		version: 1,
		id: issued.id,
		family: issued.family,
		seed: issued.seed,
		engineVersion: issued.engineVersion,
		moves,
		elapsedSeconds: 10,
		rankedSession: issued.id
	};
}
function noIdentity(value: unknown) {
	const json = JSON.stringify(value);
	for (const identity of identities) expect(json).not.toContain(identity);
	expect(json).not.toContain(secret);
}
async function count(
	table: string,
	where = '',
	values: (string | number)[] = [],
	db = proxy.env.DB
) {
	return (await db
		.prepare(`SELECT COUNT(*) AS total FROM ${table} ${where}`)
		.bind(...values)
		.first<{ total: number }>())!.total;
}

beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	await migrate(proxy.env.DB);
	await proxy.env.DB.prepare(
		"INSERT INTO admin_actor(id,role) VALUES('daily-operator','admin')"
	).run();
});
afterAll(async () => {
	await proxy?.dispose();
});

it('issues one identical anonymous daily puzzle per family/day and resumes by session id', async () => {
	const date = utcDate(noon);
	await pin('memory', date);
	const a = await owner();
	const b = await owner();
	const first = await startDailyRanked(
		proxy.env.DB,
		a,
		'memory',
		a,
		noon,
		proxy.env.CONFIG_CACHE,
		secret
	);
	const second = await startDailyRanked(proxy.env.DB, b, 'memory', b, noon, undefined, secret);
	expect(first.id).not.toBe(second.id);
	expect(first.round).toEqual(second.round);
	expect(first.seed).toBe(second.seed);
	expect(first.date).toBe(date);
	expect(first.expiresAt - first.startedAt).toBe(7_200_000);
	expect(first.roundRuleLine).toBe('Cards start face down. There is no free opening allowance.');
	expect(first.round).not.toHaveProperty('variant');
	expect(first).not.toHaveProperty('variant');
	noIdentity(first);
	expect(
		await startDailyRanked(proxy.env.DB, a, 'memory', a, noon + 1000, undefined, secret)
	).toMatchObject({ id: first.id, seed: first.seed, startedAt: first.startedAt });
	const resumed = await resumeDailyRanked(
		proxy.env.DB,
		a,
		first.id,
		[{ index: 0 }],
		undefined,
		noon + 2000
	);
	expect(resumed.id).toBe(first.id);
	noIdentity(resumed);
	await expect(
		resumeDailyRanked(proxy.env.DB, b, first.id, [], undefined, noon + 2000)
	).rejects.toMatchObject({ code: 'session', status: 403 });
	await expect(
		resumeDailyRanked(proxy.env.DB, a, first.id, [{ index: 999 }], undefined, noon + 2000)
	).rejects.toMatchObject({ code: 'invalid_replay' });
	await abandonRanked(proxy.env.DB, a, first.id, noon + 3000);
	await abandonRanked(proxy.env.DB, b, second.id, noon + 3000);
});

it('saves atomically, invalidates the snapshot, keeps one best, and excludes same-day practice', async () => {
	const now = noon + day;
	const date = utcDate(now);
	await pin('memory', date);
	const a = await owner();
	const issued = await startDailyRanked(proxy.env.DB, a, 'memory', a, now, undefined, secret);
	const empty = await dailyBoard(proxy.env.DB, 'memory', date, a, proxy.env.CONFIG_CACHE, 25, now);
	expect(empty.rows).toEqual([]);
	expect(empty.own).toBeNull();
	expect(await proxy.env.CONFIG_CACHE.get(dailyBoardKey('memory', date))).not.toBeNull();
	const run = completion(issued);
	const saved = await saveRun(proxy.env.DB, a, run, now + 60_000, proxy.env.CONFIG_CACHE);
	expect(saved.ranked).toBe(true);
	expect(saved.group).toBe(`memory:${date}`);
	expect(await proxy.env.CONFIG_CACHE.get(dailyBoardKey('memory', date))).toBeNull();
	expect(await count('daily_board_snapshot', 'WHERE family=? AND date=?', ['memory', date])).toBe(
		0
	);
	expect(
		await count('daily_best', 'WHERE family=? AND date=? AND user_id=?', ['memory', date, a])
	).toBe(1);
	expect(await saveRun(proxy.env.DB, a, run, now + 61_000)).toEqual(saved);
	const board = await dailyBoard(proxy.env.DB, 'memory', date, a, undefined, 25, now + 61_000);
	expect(board.rows).toHaveLength(1);
	expect(board.own).toEqual({ score: saved.score, position: 1 });
	noIdentity(board);
	await expect(
		startDailyRanked(proxy.env.DB, a, 'memory', a, now + 62_000, undefined, secret)
	).rejects.toMatchObject({ code: 'daily_spent' });
	const practice = {
		...run,
		id: crypto.randomUUID(),
		rankedSession: null,
		variant: 'memory:no-preview'
	};
	expect((await saveRun(proxy.env.DB, a, practice, now + 62_000)).ranked).toBe(false);
	expect(await count('daily_best', 'WHERE user_id=?', [a])).toBe(1);
	expect(await dailyStreak(proxy.env.DB, a, now + 62_000)).toEqual({ current: 1, longest: 1 });
	const history = await accountHistory(proxy.env.DB, a);
	expect(history.bests).toEqual([{ family: 'memory', date, score: saved.score }]);
	expect(history.history.every((row) => row.family === 'memory' && row.date === date)).toBe(true);
	noIdentity(history);
	expect(history.history.every((row) => !Object.hasOwn(row, 'group'))).toBe(true);
});

it('conditionally updates a best only for a higher validated score and preserves tie submission order', async () => {
	const now = noon + 2 * day;
	const date = utcDate(now);
	await pin('memory', date);
	const a = await owner();
	const issued = await startDailyRanked(proxy.env.DB, a, 'memory', a, now, undefined, secret);
	await saveRun(proxy.env.DB, a, completion(issued), now + 60_000);
	const original = await proxy.env.DB.prepare(
		'SELECT score,created_at,updated_at FROM daily_best WHERE user_id=?'
	)
		.bind(a)
		.first<{ score: number; created_at: number; updated_at: number }>();
	// Exercise the atomic statement with server-side validated ledger fixtures, not a client score.
	for (const score of [original!.score - 1, original!.score]) {
		await proxy.env.DB.prepare('UPDATE completed_run SET score=? WHERE id=?')
			.bind(score, issued.id)
			.run();
		await proxy.env.DB.batch(
			dailyCompletionStatements(proxy.env.DB, a, issued.id, 'memory', date, now + 70_000)
		);
		expect(
			await proxy.env.DB.prepare(
				'SELECT score,created_at,updated_at FROM daily_best WHERE user_id=?'
			)
				.bind(a)
				.first()
		).toEqual(original);
	}
	await proxy.env.DB.prepare('UPDATE completed_run SET score=? WHERE id=?')
		.bind(original!.score + 1, issued.id)
		.run();
	await dailyBest(proxy.env.DB, a, issued.id, undefined, now + 80_000);
	expect(await count('daily_best', 'WHERE user_id=?', [a])).toBe(1);
	expect(
		await proxy.env.DB.prepare('SELECT score,updated_at FROM daily_best WHERE user_id=?')
			.bind(a)
			.first()
	).toEqual({ score: original!.score + 1, updated_at: now + 80_000 });
});

it('spends an abandoned daily even after local maintenance removes other expired sessions', async () => {
	const now = noon + 3 * day;
	const date = utcDate(now);
	await pin('memory', date);
	const a = await owner();
	const issued = await startDailyRanked(proxy.env.DB, a, 'memory', a, now, undefined, secret);
	await abandonRanked(proxy.env.DB, a, issued.id, now + 1000);
	await pruneExpiredRecords(
		proxy.env.DB,
		'daily-operator',
		now + 3_600_000 * 3,
		proxy.env.RUN_ARCHIVE
	);
	expect(await count('play_session', 'WHERE id=?', [issued.id])).toBe(1);
	await expect(
		startDailyRanked(proxy.env.DB, a, 'memory', a, now + 3_600_000 * 3, undefined, secret)
	).rejects.toMatchObject({ code: 'daily_spent' });
	await expect(saveRun(proxy.env.DB, a, completion(issued), now + 60_000)).rejects.toMatchObject({
		status: 410
	});
	expect(await count('daily_best', 'WHERE user_id=?', [a])).toBe(0);
});

it('rejects a changed seed, explicit variant, forged session, and altered pinned puzzle without board writes', async () => {
	const now = noon + 4 * day;
	const date = utcDate(now);
	await pin('memory', date);
	const a = await owner();
	const issued = await startDailyRanked(proxy.env.DB, a, 'memory', a, now, undefined, secret);
	const run = completion(issued);
	for (const tampered of [
		{ ...run, seed: '43' },
		{ ...run, variant: 'memory:trios' }
	]) {
		await expect(saveRun(proxy.env.DB, a, tampered, now + 60_000)).rejects.toMatchObject({
			code: 'session'
		});
	}
	const fake = crypto.randomUUID();
	await expect(
		saveRun(proxy.env.DB, a, { ...run, id: fake, rankedSession: fake }, now + 60_000)
	).rejects.toMatchObject({ code: 'session' });
	await proxy.env.DB.prepare(
		"UPDATE daily_puzzle SET variant='memory:trios' WHERE family='memory' AND date=?"
	)
		.bind(date)
		.run();
	await expect(saveRun(proxy.env.DB, a, run, now + 60_000)).rejects.toMatchObject({
		code: 'session'
	});
	await proxy.env.DB.prepare(
		"UPDATE daily_puzzle SET variant='memory:no-preview' WHERE family='memory' AND date=?"
	)
		.bind(date)
		.run();
	expect(await count('completed_run', 'WHERE user_id=?', [a])).toBe(0);
	expect(await count('daily_best', 'WHERE user_id=?', [a])).toBe(0);
	await abandonRanked(proxy.env.DB, a, issued.id, now + 61_000);
});

it('credits a late result to its UTC start-day board and completion-day streak, then freezes', async () => {
	const start = Date.parse('2026-11-20T23:59:59Z');
	const date = utcDate(start);
	await pin('memory', date);
	const a = await owner();
	const issued = await startDailyRanked(proxy.env.DB, a, 'memory', a, start, undefined, secret);
	const run = completion(issued);
	const submitted = Date.parse('2026-11-21T00:01:00Z');
	await saveRun(proxy.env.DB, a, run, submitted);
	expect(
		await proxy.env.DB.prepare('SELECT last_date FROM streak WHERE user_id=?').bind(a).first()
	).toEqual({ last_date: '2026-11-21' });
	expect(
		await count('daily_best', 'WHERE family=? AND date=? AND user_id=?', ['memory', date, a])
	).toBe(1);
	expect(await count('daily_best', 'WHERE date=? AND user_id=?', ['2026-11-21', a])).toBe(0);
	expect((await dailyBoard(proxy.env.DB, 'memory', date, a, undefined, 25, submitted)).frozen).toBe(
		false
	);
	const freeze = dailyFreezeAt(date);
	const frozen = await dailyBoard(proxy.env.DB, 'memory', date, a, undefined, 25, freeze);
	expect(frozen.frozen).toBe(true);
	expect((await saveRun(proxy.env.DB, a, run, freeze)).ranked).toBe(true);
	const score = frozen.own!.score;
	await proxy.env.DB.prepare('UPDATE completed_run SET score=score+100 WHERE id=?')
		.bind(issued.id)
		.run();
	await dailyBest(proxy.env.DB, a, issued.id, undefined, freeze + 1);
	expect(
		await dailyBoard(proxy.env.DB, 'memory', date, a, undefined, 25, freeze + 1)
	).toMatchObject({ own: { score }, updatedAt: frozen.updatedAt });
	const b = await owner();
	const expired = await startDailyRanked(proxy.env.DB, b, 'memory', b, start, undefined, secret);
	await expect(saveRun(proxy.env.DB, b, completion(expired), freeze)).rejects.toMatchObject({
		status: 410
	});
});

it('rejects an interrupted daily claim after the final freeze without creating a ranked completion', async () => {
	const start = Date.parse('2026-11-22T23:59:00Z');
	const date = utcDate(start);
	await pin('memory', date);
	const a = await owner();
	const issued = await startDailyRanked(proxy.env.DB, a, 'memory', a, start, undefined, secret);
	const run = completion(issued);
	const hash = await digest(JSON.stringify(parseRun({ ...run, variant: 'memory:no-preview' })));
	await proxy.env.DB.prepare('UPDATE play_session SET payload_hash=?,claimed_at=? WHERE id=?')
		.bind(hash, start + 60_000, issued.id)
		.run();
	await expect(saveRun(proxy.env.DB, a, run, dailyFreezeAt(date))).rejects.toMatchObject({
		code: 'expired_or_superseded',
		status: 410
	});
	expect(await count('completed_run', 'WHERE id=?', [issued.id])).toBe(0);
	expect(await count('daily_best', 'WHERE user_id=?', [a])).toBe(0);
});

it('advances one site-wide streak across different daily families and resets after a skipped UTC day', async () => {
	const a = await owner();
	for (const [offset, family, variant, expected] of [
		[30, 'memory', 'memory:no-preview', 1],
		[30, 'connect', 'connect:classic', 1],
		[31, 'memory', 'memory:no-preview', 2],
		[33, 'memory', 'memory:no-preview', 1]
	] as const) {
		const now = noon + offset * day;
		const date = utcDate(now);
		await pin(family, date, variant);
		const issued = await startDailyRanked(proxy.env.DB, a, family, a, now, undefined, secret);
		await saveRun(proxy.env.DB, a, completion(issued), now + 60_000);
		expect(await dailyStreak(proxy.env.DB, a, now + 60_000)).toEqual({
			current: expected,
			longest: offset >= 31 ? 2 : 1
		});
	}
	expect(await dailyStreak(proxy.env.DB, a, noon + 35 * day)).toEqual({ current: 0, longest: 2 });
});

it('accepts anonymous daily and practice round-start activity and rejects family/puzzle tampering (§8D)', async () => {
	const now = noon + 40 * day;
	const date = utcDate(now);
	await pin('memory', date);
	const a = await owner();
	const issued = await startDailyRanked(proxy.env.DB, a, 'memory', a, now, undefined, secret);
	const round = { runId: issued.id, family: 'memory' as const, rankedSession: issued.id };
	await recordRoundStart(proxy.env.DB, a, round, now + 1000);
	expect(
		await proxy.env.DB.prepare('SELECT variant,ranked FROM account_round_activity WHERE run_id=?')
			.bind(issued.id)
			.first()
	).toEqual({ variant: 'memory:no-preview', ranked: 1 });
	await expect(
		recordRoundStart(proxy.env.DB, a, { ...round, family: 'block' }, now + 1000)
	).rejects.toThrow();
	await expect(
		recordRoundStart(proxy.env.DB, a, { ...round, variant: 'memory:trios' }, now + 1000)
	).rejects.toThrow();
	await saveRun(proxy.env.DB, a, completion(issued), now + 60_000);
	await recordRoundStart(proxy.env.DB, a, round, now + 61_000);
	const practiceId = crypto.randomUUID();
	const practice = { runId: practiceId, family: 'memory' as const, rankedSession: null };
	await recordRoundStart(proxy.env.DB, a, practice, now + 62_000);
	const classic = createMemoryRound('42');
	await saveRun(
		proxy.env.DB,
		a,
		{
			...completion(issued),
			id: practiceId,
			rankedSession: null,
			moves: [...new Set(classic.cards.map((card) => card.symbol))].flatMap((symbol) =>
				classic.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
			)
		},
		now + 63_000
	);
	await recordRoundStart(proxy.env.DB, a, practice, now + 64_000);
	expect(await count('account_round_activity', 'WHERE user_id=?', [a])).toBe(2);
	expect(await readFile('src/lib/server/activity.ts', 'utf8')).not.toMatch(/rules_group/);
});

it('keeps admin variant inspection and its family/date board separate from player history (§8D)', async () => {
	const directory = await loadMemoryDirectory(proxy.env.DB);
	expect(directory.items.length).toBeGreaterThan(0);
	for (const row of directory.items) {
		expect(row.id).toMatch(/^memory:/);
		expect(row.rulesGroup).toMatch(/^memory · \d{4}-\d{2}-\d{2}$/);
	}
	const statistics = await gameStatistics(proxy.env.DB, 'memory');
	expect(statistics.variants.length).toBeGreaterThan(0);
});

it('preserves authoritative legacy ranked starts without admitting a wrong variant', async () => {
	const now = noon + 42 * day;
	const a = await owner();
	const issued = await startRanked(
		proxy.env.DB,
		a,
		'memory',
		a,
		now,
		null,
		undefined,
		'memory:no-preview'
	);
	const round = { runId: issued.id, family: 'memory' as const, rankedSession: issued.id };
	await recordRoundStart(proxy.env.DB, a, round, now + 1000);
	expect(
		await proxy.env.DB.prepare('SELECT variant,ranked FROM account_round_activity WHERE run_id=?')
			.bind(issued.id)
			.first()
	).toEqual({ variant: 'memory:no-preview', ranked: 1 });
	await expect(
		recordRoundStart(proxy.env.DB, a, { ...round, variant: 'memory:trios' }, now + 1000)
	).rejects.toMatchObject({ code: 'conflict' });
	await abandonRanked(proxy.env.DB, a, issued.id, now + 2000);
});

it('recomputes cold and expired snapshots, preserves ties/own rank outside Top 25, and anonymizes frozen ranks', async () => {
	const date = '2026-10-01';
	const a = await owner();
	const b = await owner();
	const ids = Array.from({ length: 26 }, (_, index) =>
		index === 0 ? a : index === 1 ? b : `tie-${index}`
	);
	await proxy.env.DB.batch(
		ids.map((id, index) =>
			proxy.env.DB.prepare(
				'INSERT INTO daily_best(family,date,user_id,score,seconds,moves,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)'
			).bind('memory', date, id, 100, 10, 12, noon + index, noon)
		)
	);
	const top = await dailyBoard(proxy.env.DB, 'memory', date, b, proxy.env.CONFIG_CACHE, 25, noon);
	expect(top.rows).toHaveLength(25);
	expect(top.own).toEqual({ score: 100, position: 2, percentile: 10 });
	const outside = await dailyBoard(proxy.env.DB, 'memory', date, ids[25], undefined, 25, noon);
	expect(outside.own).toEqual({ score: 100, position: 26 });
	expect(outside.rows.some((row) => row.own)).toBe(false);
	expect(
		(await dailyBoard(proxy.env.DB, 'memory', date, null, undefined, 100, noon)).rows
	).toHaveLength(26);
	await proxy.env.DB.prepare("INSERT INTO player_ban(user_id,reason,created_at) VALUES(?,'test',?)")
		.bind(a, noon)
		.run();
	await proxy.env.DB.prepare('DELETE FROM user WHERE id=?').bind(b).run();
	const anonymous = await dailyBoard(
		proxy.env.DB,
		'memory',
		date,
		null,
		proxy.env.CONFIG_CACHE,
		25,
		noon + 1
	);
	expect(anonymous.rows.slice(0, 2)).toEqual([
		{ name: 'Anonymous', score: 100, position: 1, own: false },
		{ name: 'Anonymous', score: 100, position: 2, own: false }
	]);
	expect(anonymous.totalPlayers).toBe(26);
	expect(anonymous.updatedAt).toBe(top.updatedAt);
	noIdentity(anonymous);
	const liveDate = utcDate(noon);
	const cold = await dailyBoard(proxy.env.DB, 'connect', liveDate, null, undefined, 25, noon);
	expect(
		(await dailyBoard(proxy.env.DB, 'connect', liveDate, null, undefined, 25, noon + 299_999))
			.updatedAt
	).toBe(cold.updatedAt);
	expect(
		(await dailyBoard(proxy.env.DB, 'connect', liveDate, null, undefined, 25, noon + 300_000))
			.updatedAt
	).toBe(noon + 300_000);
});

it('pins old puzzles across key rotation/variant disablement and runs the local scheduled handler at rollover/freeze', async () => {
	const midnight = Date.parse('2027-01-01T00:00:00Z');
	const controller = (time: number, expression: string) =>
		({ scheduledTime: time, cron: expression, noRetry() {} }) as ScheduledController;
	await cron.scheduled(controller(midnight, '0 0 * * *'), {
		...proxy.env,
		DAILY_SEED_SECRET: secret
	});
	for (const family of Object.keys(catalog)) {
		expect(await count('daily_puzzle', 'WHERE family=? AND date=?', [family, '2027-01-02'])).toBe(
			1
		);
		expect(
			await count('daily_board_snapshot', 'WHERE family=? AND date=?', [family, '2027-01-01'])
		).toBe(1);
	}
	const pinned = await dailyPuzzle(proxy.env.DB, 'memory', '2027-01-02', secret);
	expect(await dailyPuzzle(proxy.env.DB, 'memory', '2027-01-02', 'rotated-secret')).toEqual(pinned);
	await proxy.env.DB.prepare(
		"UPDATE variant_lifecycle SET state='disabled' WHERE family='memory' AND variant=?"
	)
		.bind(pinned.variant)
		.run();
	expect(await dailyPuzzle(proxy.env.DB, 'memory', '2027-01-02', '')).toEqual(pinned);
	await proxy.env.DB.prepare(
		"UPDATE variant_lifecycle SET state='enabled' WHERE family='memory' AND variant=?"
	)
		.bind(pinned.variant)
		.run();
	await cron.scheduled(controller(midnight + 2 * 3_600_000, '*/5 * * * *'), {
		...proxy.env,
		DAILY_SEED_SECRET: secret
	});
	expect(
		(
			await dailyBoard(
				proxy.env.DB,
				'memory',
				'2026-12-31',
				null,
				undefined,
				25,
				midnight + 2 * 3_600_000
			)
		).frozen
	).toBe(true);
	await cron.scheduled(controller(midnight + day + 300_000, '*/5 * * * *'), {
		...proxy.env,
		DAILY_SEED_SECRET: secret
	});
	expect(await count('daily_puzzle', 'WHERE date=?', ['2027-01-03'])).toBe(0);
	await cron.scheduled(controller(midnight, '0 0 1 * *'), {
		...proxy.env,
		DAILY_SEED_SECRET: secret
	});
	expect(
		(await dailyBoard(proxy.env.DB, 'memory', '2026-10-01', null, undefined, 25, midnight)).frozen
	).toBe(true);
});

it('archives >90-day move logs by run id to real local R2 before delete, preserving the boundary and failed archives', async () => {
	const db = proxy.env.DB;
	const now = Date.parse('2027-06-01T12:00:00Z');
	const a = await owner();
	const base = createMemoryRound('42');
	const moves = [...new Set(base.cards.map((card) => card.symbol))].flatMap((symbol) =>
		base.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
	);
	const make = (id: string) => ({
		...completion({ id, family: 'memory', seed: '42', engineVersion: 'memory-1' }),
		rankedSession: null,
		moves
	});
	const oldId = crypto.randomUUID();
	const boundaryId = crypto.randomUUID();
	await saveRun(db, a, make(oldId), now - 90 * day - 1);
	await saveRun(db, a, make(boundaryId), now - 90 * day);
	const log = JSON.stringify(moves);
	const failing = new Proxy(proxy.env.RUN_ARCHIVE, {
		get(target, key) {
			if (key === 'put')
				return async () => {
					throw new Error('injected local archive failure');
				};
			const value = Reflect.get(target, key);
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
	await expect(pruneExpiredRecords(db, 'daily-operator', now, failing)).rejects.toThrow(
		'injected local archive failure'
	);
	expect(await count('completed_run', 'WHERE id=?', [oldId])).toBe(1);
	await pruneExpiredRecords(db, 'daily-operator', now);
	expect(await count('completed_run', 'WHERE id=?', [oldId])).toBe(1);
	// Earlier test runs may occupy the bounded 50-run batch; repeat only while the target remains.
	for (let batch = 0; batch < 5 && (await count('completed_run', 'WHERE id=?', [oldId])); batch++)
		await pruneExpiredRecords(db, 'daily-operator', now, proxy.env.RUN_ARCHIVE);
	expect(await count('completed_run', 'WHERE id=?', [oldId])).toBe(0);
	expect(await (await proxy.env.RUN_ARCHIVE.get(oldId))!.text()).toBe(log);
	expect(await count('completed_run', 'WHERE id=?', [boundaryId])).toBe(1);
	expect(await proxy.env.RUN_ARCHIVE.get(boundaryId)).toBeNull();
	await expect(
		pruneExpiredRecords(db, 'non-operator', now, proxy.env.RUN_ARCHIVE)
	).rejects.toMatchObject({ status: 403 });
});

// Collect real D1 metadata without substituting a fake database. first() uses all() only to retain meta.
function traceDatabase(db: D1Database) {
	let roundTrips = 0;
	const queries: { sql: string; rowsRead: number; returned: number }[] = [];
	const raw = new WeakMap<D1PreparedStatement, { statement: D1PreparedStatement; sql: string }>();
	const record = (sql: string, result: D1Result) =>
		queries.push({ sql, rowsRead: result.meta.rows_read, returned: result.results.length });
	const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
		const wrapped = new Proxy(statement, {
			get(target, key) {
				if (key === 'bind') return (...values: unknown[]) => wrap(target.bind(...values), sql);
				if (key === 'raw')
					return async (options?: { columnNames?: boolean }) => {
						roundTrips++;
						return options?.columnNames ? target.raw({ columnNames: true }) : target.raw();
					};
				if (key === 'first')
					return async (column?: string) => {
						roundTrips++;
						const result = await target.all();
						record(sql, result);
						return column ? (result.results[0]?.[column] ?? null) : (result.results[0] ?? null);
					};
				if (key === 'all' || key === 'run')
					return async () => {
						roundTrips++;
						const result = await target[key]();
						record(sql, result);
						return result;
					};
				const value = Reflect.get(target, key);
				return typeof value === 'function' ? value.bind(target) : value;
			}
		});
		raw.set(wrapped, { statement, sql });
		return wrapped;
	};
	const binding = new Proxy(db, {
		get(target, key) {
			if (key === 'prepare') return (sql: string) => wrap(target.prepare(sql), sql);
			if (key === 'batch')
				return async (statements: D1PreparedStatement[]) => {
					roundTrips++;
					const results = await target.batch(
						statements.map((statement) => raw.get(statement)?.statement ?? statement)
					);
					results.forEach((result, index) =>
						record(raw.get(statements[index])?.sql ?? 'batch', result)
					);
					return results;
				};
			const value = Reflect.get(target, key);
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
	return { binding, queries, roundTrips: () => roundTrips };
}

it('measures indexed 10,000-player board reads and daily/legacy saveRun D1 round trips', async () => {
	const date = '2026-10-02';
	const db = proxy.env.DB;
	await db
		.prepare(
			`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<10000)
		INSERT INTO daily_best(family,date,user_id,score,seconds,moves,created_at,updated_at)
		SELECT 'memory',?,'load-'||printf('%05d',x),10001-x,10,12,?,? FROM n`
		)
		.bind(date, noon, noon)
		.run();
	const read = traceDatabase(db);
	const board = await dailyBoard(read.binding, 'memory', date, 'load-09999', undefined, 25, noon);
	expect(board.rows).toHaveLength(25);
	expect(board.totalPlayers).toBe(10000);
	expect(board.own?.position).toBe(9999);
	expect(read.queries.every((row) => !/completed_run|OVER\s*\(/i.test(row.sql))).toBe(true);
	expect(read.queries.filter((row) => row.sql.includes('COUNT(*) AS higher'))).toHaveLength(1);
	const plan = await db
		.prepare(
			'EXPLAIN QUERY PLAN SELECT user_id,score FROM daily_best WHERE family=? AND date=? ORDER BY score DESC,created_at,user_id LIMIT 25'
		)
		.bind('memory', date)
		.all<{ detail: string }>();
	expect(plan.results.some((row) => row.detail.includes('daily_best_board'))).toBe(true);
	const a = await owner();
	const now = noon + 45 * day;
	await pin('memory', utcDate(now));
	const daily = await startDailyRanked(db, a, 'memory', a, now, undefined, secret);
	const dailySave = traceDatabase(db);
	await saveRun(dailySave.binding, a, completion(daily), now + 60_000);
	const b = await owner();
	const legacy = await startRanked(db, b, 'memory', b, now, null, undefined, 'memory:no-preview');
	const legacySave = traceDatabase(db);
	await saveRun(legacySave.binding, b, completion({ ...legacy, family: 'memory' }), now + 60_000);
	const report = {
		players: 10000,
		boardRoundTrips: read.roundTrips(),
		boardQueries: read.queries,
		dailySaveRoundTrips: dailySave.roundTrips(),
		legacyRankedSaveRoundTrips: legacySave.roundTrips(),
		baseline: 'existing non-daily ranked path in this working tree',
		queryPlan: plan.results
	};
	await mkdir('build/v1.4/integration', { recursive: true });
	await writeFile('build/v1.4/integration/daily-load.json', JSON.stringify(report, null, 2) + '\n');
	expect(read.queries.every((row) => Number.isFinite(row.rowsRead))).toBe(true);
}, 30_000);
