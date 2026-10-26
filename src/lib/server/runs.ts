import { memoryOpeningMs } from '#lib/round-timing.js';
import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { catalog } from '#lib/catalog.js';
import { normalizeSeed } from '#lib/engine/rng.js';
import type { CompletedRun, PuzzleId } from '#lib/engine/contract.js';
import { randomSeed } from '#lib/seeds.js';
import { createDatabase } from './db/index.js';
import { completedRun, playSession, playerBan } from './db/schema.js';

export class RunError extends Error {
	constructor(
		public code: string,
		public status = 400
	) {
		super(code);
	}
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function digest(value: string): Promise<string> {
	const bytes = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
	);
	return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}
export function parseRun(value: unknown): CompletedRun {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RunError('payload');
	const run = value as CompletedRun;
	if (
		Object.keys(run).sort().join(',') !==
			'elapsedSeconds,engineVersion,family,id,moves,rankedSession,seed,version' ||
		run.version !== 1 ||
		typeof run.id !== 'string' ||
		!UUID.test(run.id) ||
		!['block', 'memory'].includes(run.family) ||
		typeof run.seed !== 'string' ||
		run.seed.length > 20 ||
		!Number.isSafeInteger(run.elapsedSeconds) ||
		run.elapsedSeconds < 0 ||
		run.elapsedSeconds > 7200 ||
		!(run.rankedSession === null || run.rankedSession === run.id)
	)
		throw new RunError('payload');
	try {
		normalizeSeed(run.seed);
	} catch {
		throw new RunError('seed');
	}
	const manifest = catalog[run.family];
	if (run.engineVersion !== manifest.engineVersion) throw new RunError('version', 409);
	if (
		!Array.isArray(run.moves) ||
		!run.moves.length ||
		run.moves.length > manifest.maxMoves ||
		run.moves.some((move) => !move || typeof move !== 'object' || Array.isArray(move))
	)
		throw new RunError('moves');
	// Canonical field order makes reordered JSON keys an identical retry.
	for (const move of run.moves) {
		if (
			Object.keys(move).sort().join(',') !== (run.family === 'memory' ? 'index' : 'trayIndex,x,y')
		)
			throw new RunError('move');
	}
	return {
		version: 1,
		id: run.id,
		family: run.family,
		engineVersion: run.engineVersion,
		seed: run.seed,
		moves: run.moves.map((move) =>
			run.family === 'memory'
				? { index: move.index }
				: { trayIndex: move.trayIndex, x: move.x, y: move.y }
		),
		elapsedSeconds: run.elapsedSeconds,
		rankedSession: run.rankedSession
	};
}

export async function startRanked(
	binding: D1Database,
	userId: string,
	family: PuzzleId,
	ipHash: string,
	now = Date.now()
) {
	const db = createDatabase(binding);
	const id = crypto.randomUUID();
	const seed = randomSeed();
	// One conditional statement serializes caps and insertion. No read/check/write gap.
	const rows = await db.all<{ id: string }>(sql`
		INSERT INTO play_session (id,user_id,family,seed,engine_version,created_at,expires_at,ip_hash)
		SELECT ${id},${userId},${family},${seed},${catalog[family].engineVersion},${now},${now + 7200000},${ipHash}
		WHERE EXISTS (SELECT 1 FROM player WHERE user_id=${userId})
		AND NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=${userId})
		AND NOT EXISTS (SELECT 1 FROM site_control WHERE key='ranked' AND enabled=0)
		AND (SELECT count(*) FROM play_session WHERE user_id=${userId} AND created_at>${now - 3600000}) < 30
		AND (SELECT count(*) FROM play_session WHERE ip_hash=${ipHash} AND created_at>${now - 3600000}) < 30
		AND (SELECT count(*) FROM play_session s WHERE s.user_id=${userId} AND s.created_at>${now - 3600000}
			AND s.payload_hash IS NULL AND EXISTS
			(SELECT 1 FROM play_session newer WHERE newer.user_id=s.user_id AND newer.family=s.family AND newer.sequence>s.sequence))
 + CASE WHEN EXISTS (SELECT 1 FROM play_session current WHERE current.user_id=${userId} AND current.family=${family} AND current.payload_hash IS NULL AND current.created_at>${now - 3600000} AND NOT EXISTS (SELECT 1 FROM play_session newer WHERE newer.user_id=current.user_id AND newer.family=current.family AND newer.sequence>current.sequence)) THEN 1 ELSE 0 END <= 10
		RETURNING id`);
	if (!rows.length) throw new RunError('start_limited', 429);
	return {
		id,
		seed,
		family,
		engineVersion: catalog[family].engineVersion,
		startedAt: now,
		expiresAt: now + 7200000
	};
}

export async function saveRun(
	binding: D1Database,
	userId: string,
	input: unknown,
	now = Date.now()
) {
	const db = createDatabase(binding);
	const run = parseRun(input);
	const hash = await digest(JSON.stringify(run));
	const stored = await db.select().from(completedRun).where(eq(completedRun.id, run.id)).get();
	if (stored) {
		if (stored.userId !== userId || stored.payloadHash !== hash)
			throw new RunError('conflict', 409);
		return { id: stored.id, score: stored.score, ranked: stored.ranked, group: stored.group };
	}
	if (await db.select().from(playerBan).where(eq(playerBan.userId, userId)).get())
		throw new RunError('unavailable', 403);
	let seconds = run.elapsedSeconds;
	let submittedAt = now;
	let rankedWallMs = 0;
	if (run.rankedSession) {
		const issued = await db
			.select()
			.from(playSession)
			.where(and(eq(playSession.id, run.id), eq(playSession.userId, userId)))
			.get();
		if (
			!issued ||
			issued.seed !== run.seed ||
			issued.family !== run.family ||
			issued.engineVersion !== run.engineVersion
		)
			throw new RunError('session', 403);
		if (issued.payloadHash && issued.payloadHash !== hash) throw new RunError('conflict', 409);
		if (!issued.payloadHash) {
			const claimed = await db
				.update(playSession)
				.set({ payloadHash: hash, claimedAt: now })
				.where(
					and(
						eq(playSession.id, run.id),
						isNull(playSession.payloadHash),
						gt(playSession.expiresAt, now),
						sql`NOT EXISTS (SELECT 1 FROM play_session newer WHERE newer.user_id=${userId} AND newer.family=${run.family} AND newer.sequence>${issued.sequence})`,
						sql`NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=${userId})`,
						sql`NOT EXISTS (SELECT 1 FROM site_control WHERE key='ranked' AND enabled=0)`
					)
				)
				.returning()
				.get();
			if (!claimed) {
				const raced = await db.select().from(playSession).where(eq(playSession.id, run.id)).get();
				if (!raced?.payloadHash) throw new RunError('expired_or_superseded', 410);
				if (raced.payloadHash !== hash) throw new RunError('conflict', 409);
				submittedAt = raced.claimedAt!;
			} else submittedAt = claimed.claimedAt!;
		} else submittedAt = issued.claimedAt!;
		rankedWallMs = Math.max(0, submittedAt - issued.createdAt - 1000);
		seconds = Math.floor(rankedWallMs / 1000);
	}
	let result;
	const replayStarted = performance.now();
	try {
		result = catalog[run.family].replay(run.seed, run.moves, seconds);
	} catch {
		throw new RunError('invalid_replay');
	}
	if (run.rankedSession && run.family === 'memory') {
		seconds = Math.floor(Math.max(0, rankedWallMs - memoryOpeningMs(result.pairs!)) / 1000);
		result = catalog[run.family].replay(run.seed, run.moves, seconds);
	}
	if (run.rankedSession && run.family === 'memory' && seconds < result.pairs! * 0.4)
		throw new RunError('too_fast');
	console.info(
		JSON.stringify({
			event: 'run_replayed',
			family: run.family,
			moves: run.moves.length,
			durationMs: Math.round((performance.now() - replayStarted) * 100) / 100
		})
	);
	// Re-check bans in the insertion statement as well as before replay.
	await db.run(sql`INSERT INTO completed_run
		(id,user_id,family,engine_version,rules_group,score,pairs,moves,seconds,seed,move_log,payload_hash,ranked,hidden,created_at)
		SELECT ${run.id},${userId},${run.family},${run.engineVersion},${result.group},${result.score},${result.pairs},
		${result.moves},${seconds},${run.seed},${JSON.stringify(run.moves)},${hash},${run.rankedSession ? 1 : 0},0,${submittedAt}
		WHERE NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=${userId})
 AND (${run.rankedSession ? 1 : 0}=1 OR (SELECT count(*) FROM completed_run WHERE user_id=${userId} AND created_at>${now - 3600000})<100)
		ON CONFLICT(id) DO NOTHING`);
	const committed = await db.select().from(completedRun).where(eq(completedRun.id, run.id)).get();
	if (!committed) throw new RunError('save_limited', 429);
	if (committed.userId !== userId || committed.payloadHash !== hash)
		throw new RunError('conflict', 409);
	return {
		id: committed.id,
		score: committed.score,
		ranked: committed.ranked,
		group: committed.group
	};
}

export async function accountHistory(binding: D1Database, userId: string) {
	const db = createDatabase(binding);
	const history = await db
		.select({
			id: completedRun.id,
			family: completedRun.family,
			score: completedRun.score,
			group: completedRun.group,
			ranked: completedRun.ranked,
			seconds: completedRun.seconds,
			createdAt: completedRun.createdAt
		})
		.from(completedRun)
		.where(eq(completedRun.userId, userId))
		.orderBy(desc(completedRun.createdAt), asc(completedRun.id))
		.limit(30);
	const bests = await db
		.select({
			family: completedRun.family,
			group: completedRun.group,
			score: sql<number>`max(${completedRun.score})`
		})
		.from(completedRun)
		.where(eq(completedRun.userId, userId))
		.groupBy(completedRun.family, completedRun.group);
	const summary = await db
		.select({
			family: completedRun.family,
			rounds: sql<number>`count(*)`,
			ranked: sql<number>`sum(case when ${completedRun.ranked}=1 then 1 else 0 end)`,
			lastPlayed: sql<number>`max(${completedRun.createdAt})`
		})
		.from(completedRun)
		.where(eq(completedRun.userId, userId))
		.groupBy(completedRun.family);
	return { history, bests, summary };
}

export const BOARD_GROUPS = [
	'block-placement-1',
	'memory-1:6',
	'memory-1:8',
	'memory-1:10'
] as const;
export async function leaderboard(
	binding: D1Database,
	group: string,
	offset: number,
	viewer: string | null
) {
	if (
		!(BOARD_GROUPS as readonly string[]).includes(group) ||
		!Number.isSafeInteger(offset) ||
		offset < 0 ||
		offset > 9900 ||
		offset % 25
	)
		throw new RunError('board');
	const db = createDatabase(binding);
	// Each player occupies one place, using their best eligible result.
	const query = sql`WITH eligible AS (
		SELECT r.*, p.name, row_number() OVER (PARTITION BY r.user_id ORDER BY r.score DESC,r.created_at,r.id) AS personal
		FROM completed_run r JOIN player p ON p.user_id=r.user_id
		WHERE r.rules_group=${group} AND r.ranked=1 AND r.hidden=0
		AND NOT EXISTS (SELECT 1 FROM player_ban b WHERE b.user_id=r.user_id)
	), ranked AS (
		SELECT name,score,user_id,row_number() OVER (ORDER BY score DESC,created_at,id) AS position
		FROM eligible WHERE personal=1
	) SELECT name,score,position,CASE WHEN user_id=${viewer} THEN 1 ELSE 0 END AS own
	FROM ranked WHERE position>${offset} AND position<=${offset + 25} OR user_id=${viewer} ORDER BY position`;
	const rows = await db.all<{ name: string; score: number; position: number; own: number }>(query);
	return {
		rows: rows.filter((row) => row.position > offset && row.position <= offset + 25),
		own: rows.find((row) => row.own) ?? null,
		offset,
		group
	};
}
