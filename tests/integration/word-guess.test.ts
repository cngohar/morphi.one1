import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { manifest } from '../../src/lib/puzzles/word-guess/manifest.js';
import { createWordGuessRound, encodeWord } from '../../src/lib/puzzles/word-guess/logic.js';
import { WORD_LISTS } from '../../src/lib/puzzles/word-guess/words.js';
import { saveRun } from '../../src/lib/server/runs.js';
import {
	startDailyRanked,
	startRanked,
	resumeDailyRanked
} from '../../src/lib/server/ranked-session.js';
import {
	dailyBest,
	dailyBoard,
	dailyCompletionStatements,
	utcDate
} from '../../src/lib/server/daily.js';
import { CARD_RANKED_OPENING_MS } from '../../src/lib/round-timing.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
import { scoring } from '../../src/lib/puzzles/word-guess/scoring.js';
import { readLiveScoreConfig, saveScoreConfig } from '../../src/lib/server/scoring.js';
import {
	buildActivityMapping,
	changeVariant,
	queryActivityCounts,
	queryScoreHistory,
	variantAvailable
} from '../../src/lib/server/games.js';
import { pruneExpiredRecords } from '../../src/lib/server/retention.js';

const family = 'word-guess';
const classic = `${family}:classic`;
const noon = Date.parse('2026-11-17T12:00:00Z');
let sequence = 0;
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const db = () => proxy.env.DB;
async function issue(variant = classic, version = 'brief-v1', seed = '1') {
	const now = noon + ++sequence * 86400000;
	const user = crypto.randomUUID();
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
			.bind(family, utcDate(now), variant, seed, 'word-guess-1', version, now)
	]);
	const issued = await startDailyRanked(
		db(),
		user,
		family,
		user,
		now,
		undefined,
		'word-guess-local-test'
	);
	return { user, now, issued, variant, seed };
}
function completion(
	issued: { id: string; seed: string },
	variant = classic,
	loss = false
): CompletedRun {
	const round = createWordGuessRound(issued.seed, variant);
	const wrong = WORD_LISTS[round.rules.length].guesses.find(
		(word) => !round.boards.some((board) => board.answer === word)
	)!;
	const words = loss
		? Array<string>(round.budget).fill(wrong)
		: round.boards.map((board) => board.answer);
	return {
		version: 1,
		id: issued.id,
		family,
		seed: issued.seed,
		engineVersion: 'word-guess-1',
		moves: words.map((word) => ({ action: 0, code: encodeWord(word) })),
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
beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort())
		await db().batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => db().prepare(part))
		);
	await db()
		.prepare("INSERT INTO admin_actor(id,role) VALUES('word-guess-operator','admin')")
		.run();
});

const hintVariant = 'word-guess:hint-budget-3';
function hinted(issued: { id: string; seed: string }) {
	const run = completion(issued, hintVariant);
	run.moves.unshift({ action: 1, code: 0 });
	return run;
}

it('a zero-point hinted win ranks and carries its label in top-25, top-100 and own rank', async () => {
	const { user, now, issued } = await issue(hintVariant);
	const saved = await saveRun(
		db(),
		user,
		hinted(issued),
		now + 1000 + CARD_RANKED_OPENING_MS + 5000
	);
	expect(saved).toMatchObject({ score: 0, ranked: true });
	for (const limit of [25, 100]) {
		const board = await dailyBoard(db(), family, utcDate(now), user, undefined, limit, now + 30000);
		expect(board.rows[0]).toMatchObject({ score: 0, hintUsed: true, own: true });
		expect(board.own).toMatchObject({ score: 0, hintUsed: true });
	}
	expect(
		await db().prepare('SELECT hint_used FROM daily_best WHERE user_id=?').bind(user).first()
	).toEqual({ hint_used: 1 });
});
it('retries repair a zero-point hinted win exactly once and retain the label', async () => {
	const { user, now, issued } = await issue(hintVariant);
	const run = hinted(issued);
	await saveRun(db(), user, run, now + 1000 + CARD_RANKED_OPENING_MS + 5000);
	await db().prepare('DELETE FROM daily_best WHERE user_id=?').bind(user).run();
	for (let at = 0; at < 2; at++)
		expect(await dailyBest(db(), user, run.id, undefined, now + 30000)).toEqual({
			family,
			date: utcDate(now)
		});
	expect(await boardRows(user)).toBe(1);
	expect(
		await db().prepare('SELECT score,hint_used FROM daily_best WHERE user_id=?').bind(user).first()
	).toEqual({ score: 0, hint_used: 1 });
});
it('a retry with an unrecomputable outcome inserts nothing and reports it', async () => {
	const { user, now, issued } = await issue();
	const run = completion(issued);
	await saveRun(db(), user, run, now + 1000 + CARD_RANKED_OPENING_MS + 5000);
	await db().batch([
		db().prepare('DELETE FROM daily_best WHERE user_id=?').bind(user),
		db().prepare("UPDATE completed_run SET move_log='null' WHERE id=?").bind(run.id)
	]);
	const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
	try {
		expect(await dailyBest(db(), user, run.id, undefined, now + 30000)).toBeNull();
		expect(warning).toHaveBeenCalledWith(
			expect.stringContaining('daily_retry_outcome_unavailable')
		);
	} finally {
		warning.mockRestore();
	}
	expect(await boardRows(user)).toBe(0);
});
it('hint ranking uses pinned immutable scoring: zero disables and any nonzero enables', async () => {
	const pinned = await issue(hintVariant);
	const live = await readLiveScoreConfig(db(), family);
	const off = await saveScoreConfig(
		db(),
		'word-guess-operator',
		family,
		live.liveVersion,
		{ ...scoring.defaults, hintSolvedRanks: 0 },
		'Disable hint ranking',
		false
	);
	expect(
		(
			await saveRun(
				db(),
				pinned.user,
				hinted(pinned.issued),
				pinned.now + 1000 + CARD_RANKED_OPENING_MS + 5000
			)
		).ranked
	).toBe(true);
	const unranked = await issue(hintVariant, off.version);
	expect(
		(
			await saveRun(
				db(),
				unranked.user,
				hinted(unranked.issued),
				unranked.now + 1000 + CARD_RANKED_OPENING_MS + 5000
			)
		).ranked
	).toBe(false);
	expect(await boardRows(unranked.user)).toBe(0);
	const enabled = await saveScoreConfig(
		db(),
		'word-guess-operator',
		family,
		off.version,
		{ ...scoring.defaults, hintSolvedRanks: 2, first: 321 },
		'Nonzero ranking gate',
		false
	);
	const ranked = await issue(hintVariant, enabled.version);
	expect(
		(
			await saveRun(
				db(),
				ranked.user,
				hinted(ranked.issued),
				ranked.now + 1000 + CARD_RANKED_OPENING_MS + 5000
			)
		).ranked
	).toBe(true);
	expect((await readLiveScoreConfig(db(), family, undefined, classic)).config.version).toBe(
		enabled.version
	);
	expect((await readLiveScoreConfig(db(), family, undefined, hintVariant)).config.version).toBe(
		enabled.version
	);
});
it('countdown expiry saves no completed run or daily row', async () => {
	const { user, now, issued } = await issue('word-guess:countdown-120');
	await expect(
		saveRun(
			db(),
			user,
			completion(issued, 'word-guess:countdown-120'),
			now + CARD_RANKED_OPENING_MS + 120000
		)
	).rejects.toMatchObject({ code: 'invalid_replay' });
	expect(await boardRows(user)).toBe(0);
	expect(
		await db().prepare('SELECT id FROM completed_run WHERE id=?').bind(issued.id).first()
	).toBeNull();
	expect(
		await db().prepare('SELECT abandoned_at FROM play_session WHERE id=?').bind(issued.id).first()
	).not.toEqual({ abandoned_at: null });
});
it('a ranked resume keeps the same puzzle and server timing includes the hidden gap', async () => {
	const { user, now, issued } = await issue('word-guess:boards-2');
	const run = completion(issued, 'word-guess:boards-2');
	const resumed = await resumeDailyRanked(
		db(),
		user,
		issued.id,
		run.moves.slice(0, 1),
		undefined,
		now + 5000
	);
	expect(resumed.seed).toBe(issued.seed);
	await saveRun(db(), user, run, now + 1000 + CARD_RANKED_OPENING_MS + 35000);
	expect(
		await db().prepare('SELECT seconds FROM completed_run WHERE id=?').bind(run.id).first()
	).toEqual({ seconds: 35 });
});
it('admin disable is audited and group-less preset activity/history remain bounded', async () => {
	const variant = 'word-guess:length-4';
	const { user, now, issued } = await issue(variant);
	await changeVariant(
		db(),
		'word-guess-operator',
		family,
		variant,
		'variant-disable',
		'Focused test',
		now
	);
	expect(await variantAvailable(db(), family, variant)).toBe(false);
	await expect(
		startRanked(db(), user, family, 'disabled', now, null, undefined, variant)
	).rejects.toMatchObject({ code: 'game_disabled' });
	await saveRun(
		db(),
		user,
		completion(issued, variant),
		now + 1000 + CARD_RANKED_OPENING_MS + 5000
	);
	await changeVariant(db(), 'word-guess-operator', family, variant, 'variant-enable', '', now + 1);
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
				"SELECT COUNT(*) total FROM admin_audit WHERE target LIKE '%word-guess%' AND action LIKE '%variant%'"
			)
			.first()
	).toEqual({ total: 2 });
});
it('only the hinted Light Bend row gets a hint label', async () => {
	const { user, now, issued } = await issue();
	await saveRun(db(), user, completion(issued), now + 1000 + CARD_RANKED_OPENING_MS + 5000);
	expect(
		(await dailyBoard(db(), family, utcDate(now), user, undefined, 25, now + 30000)).rows[0]
	).not.toHaveProperty('hintUsed');
	await db()
		.prepare(
			'INSERT INTO daily_best(family,date,user_id,score,seconds,moves,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)'
		)
		.bind('connect', utcDate(now), user, 123, 10, 1, now, now)
		.run();
	expect(
		(await dailyBoard(db(), 'connect', utcDate(now), user, undefined, 100, now + 30000)).rows[0]
	).not.toHaveProperty('hintUsed');
	await db().batch([
		db().prepare("UPDATE completed_run SET family='light-bend' WHERE id=?").bind(issued.id),
		db()
			.prepare(
				"INSERT INTO daily_puzzle SELECT 'light-bend',date,variant,seed,engine_version,score_config_version,created_at FROM daily_puzzle WHERE family=? AND date=?"
			)
			.bind(family, utcDate(now)),
		...dailyCompletionStatements(db(), user, issued.id, 'light-bend', utcDate(now), now + 30000, {
			hintUsed: true
		})
	]);
	const board = await dailyBoard(
		db(),
		'light-bend',
		utcDate(now),
		user,
		undefined,
		100,
		now + 30000
	);
	expect(board.rows).toHaveLength(1);
	expect(board.rows[0]).toMatchObject({ hintUsed: true });
});
it('the board hint label survives real R2 archival and deletion after ninety days', async () => {
	const { user, now, issued } = await issue(hintVariant);
	await saveRun(db(), user, hinted(issued), now + 1000 + CARD_RANKED_OPENING_MS + 5000);
	const later = now + 91 * 86400000;
	await pruneExpiredRecords(db(), 'word-guess-operator', later, proxy.env.RUN_ARCHIVE);
	expect(
		await db().prepare('SELECT id FROM completed_run WHERE id=?').bind(issued.id).first()
	).toBeNull();
	expect(await proxy.env.RUN_ARCHIVE.head(issued.id)).not.toBeNull();
	for (const limit of [25, 100])
		expect(
			(await dailyBoard(db(), family, utcDate(now), user, undefined, limit, later)).rows[0]
		).toMatchObject({ hintUsed: true, score: 0 });
});
afterAll(async () => {
	await proxy?.dispose();
});

it('saves a group-less daily win on the one family board', async () => {
	const { user, now, issued } = await issue();
	expect(manifest.presentation.groups).toEqual({});
	expect(manifest).not.toHaveProperty('leaderboardGroups');
	const run = completion(issued);
	const saved = await saveRun(db(), user, run, now + 1000 + CARD_RANKED_OPENING_MS + 5000);
	expect(saved.ranked).toBe(true);
	expect(await boardRows(user)).toBe(1);
	expect(
		(await dailyBoard(db(), family, utcDate(now), user, undefined, 25, now + 30000)).rows[0]
	).toMatchObject({ score: 100, own: true });
});
for (const [active, ranked] of [
	[2499, false],
	[2500, true]
] as const)
	it(`active timing floor ${active}ms ranks=${ranked} and consumes the attempt`, async () => {
		const { user, now, issued } = await issue();
		const saved = await saveRun(
			db(),
			user,
			completion(issued),
			now + 1000 + CARD_RANKED_OPENING_MS + active
		);
		expect(saved.ranked).toBe(ranked);
		expect(await boardRows(user)).toBe(Number(ranked));
		await expect(
			startDailyRanked(db(), user, family, user, now + 30000, undefined, 'word-guess-local-test')
		).rejects.toMatchObject({ code: 'daily_spent' });
	});
it('saves a complete loss with zero points and retries never insert a board row', async () => {
	const { user, now, issued } = await issue();
	const run = completion(issued, classic, true);
	const saved = await saveRun(db(), user, run, now + 1000 + CARD_RANKED_OPENING_MS + 5000);
	expect(saved.score).toBe(0);
	expect(await boardRows(user)).toBe(0);
	expect(await dailyBest(db(), user, run.id, undefined, now + 30000)).toBeNull();
	expect(await boardRows(user)).toBe(0);
	expect(
		await db().prepare('SELECT score FROM completed_run WHERE id=?').bind(run.id).first()
	).toEqual({ score: 0 });
});
