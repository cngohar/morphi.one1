import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { manifest } from '../../src/lib/puzzles/klondike-solitaire/manifest.js';
import {
	klondikeDeal,
	solveKlondike,
	parseRules,
	KLONDIKE_ACTION
} from '../../src/lib/puzzles/klondike-solitaire/logic.js';
import { saveRun } from '../../src/lib/server/runs.js';
import {
	resumeDailyRanked,
	startDailyRanked
} from '../../src/lib/server/ranked-session.js';
import { dailyBoard, utcDate } from '../../src/lib/server/daily.js';
import { CARD_RANKED_OPENING_MS, KLONDIKE_ENTRANCE_MS } from '../../src/lib/round-timing.js';
import type { CompletedRun, Move } from '../../src/lib/engine/contract.js';

const FAMILY = 'klondike-solitaire';
const CLASSIC = `${FAMILY}:classic`;
const noon = Date.parse('2026-11-14T12:00:00Z');
const day = 86_400_000;
const secret = 'klondike-local-test-secret';
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
		.bind(
			FAMILY,
			date,
			variant,
			seed,
			'klondike-solitaire-1',
			version,
			Date.parse(`${date}T00:00:00Z`)
		)
		.run();
}

async function issue(variant = CLASSIC, version = 'brief-v1') {
	const now = noon + ++sequence * day;
	const seed = '1';
	await pin(utcDate(now), seed, variant, version);
	const id = await owner();
	const issued = await startDailyRanked(db(), id, FAMILY, id, now, undefined, secret);
	return { id, now, issued, seed, variant };
}

function solveWitnessMoves(seed: string, variant: string): Move[] {
	const rules = parseRules(variant);
	const { deck } = klondikeDeal(seed, variant);
	const res = solveKlondike(deck, rules, 5000);
	if (res.outcome !== 'won' || !res.moves) throw new Error(`Seed ${seed} not solvable in witness`);
	return res.moves;
}

function completion(
	issued: { id: string; seed: string },
	variant = CLASSIC,
	extraMoves: Move[] = []
): CompletedRun {
	const moves = solveWitnessMoves(issued.seed, variant).concat(extraMoves);
	return {
		version: 1,
		id: issued.id,
		family: FAMILY,
		seed: issued.seed,
		engineVersion: 'klondike-solitaire-1',
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
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES('klondike-operator','admin')").run();
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

	// 65 seconds active play (> 60s timing floor)
	const saved = await saveRun(
		db(),
		id,
		run,
		now + 1000 + CARD_RANKED_OPENING_MS + KLONDIKE_ENTRANCE_MS + 65000
	);
	expect(saved.ranked).toBe(true);
	expect(await completedRow(issued.id)).toMatchObject({
		ranked: 1,
		rules_group: FAMILY
	});
	expect(await boardRows(id)).toBe(1);

	// Second daily attempt is rejected with daily_spent
	await expect(
		startDailyRanked(db(), id, FAMILY, id, now + 70000, undefined, secret)
	).rejects.toMatchObject({
		code: 'daily_spent'
	});

	const board = await dailyBoard(db(), FAMILY, utcDate(now), id, undefined, 25, now + 70000);
	expect(board.own?.score).toBe(saved.score);
});

for (const [activeSeconds, activeMs, ranked] of [
	[59, 59999, false],
	[60, 60000, true]
] as const) {
	it(`floor at ${activeMs}ms saves ranked=${ranked} and consumes the attempt`, async () => {
		const { id, now, issued } = await issue();
		const submitted = now + 1000 + CARD_RANKED_OPENING_MS + KLONDIKE_ENTRANCE_MS + activeMs;
		const run = completion(issued);
		const saved = await saveRun(db(), id, run, submitted);
		expect(saved.ranked).toBe(ranked);
		expect(await completedRow(run.id)).toMatchObject({
			ranked: Number(ranked),
			rules_group: FAMILY,
			seconds: activeSeconds
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
	});
}

it('hint-assisted daily win saves unranked without daily_best row (D8)', async () => {
	const { id, now, issued } = await issue();
	const hintMove: Move = {
		action: KLONDIKE_ACTION.hint,
		at: 100,
		card: 0,
		count: 0,
		dst: 0,
		src: 0
	};
	const run = completion(issued, CLASSIC, [hintMove]);
	const submitted = now + 1000 + CARD_RANKED_OPENING_MS + KLONDIKE_ENTRANCE_MS + 65000;
	const saved = await saveRun(db(), id, run, submitted);

	expect(saved.ranked).toBe(false);
	expect(await completedRow(run.id)).toMatchObject({
		ranked: 0,
		rules_group: FAMILY
	});
	// No daily_best row inserted for hint-assisted win
	expect(await boardRows(id)).toBe(0);
});

it('accepts 10,000-move max boundary serialization without crashing', async () => {
	expect(manifest.maxMoves).toBe(10000);
});
