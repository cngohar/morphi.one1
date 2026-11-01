import { completionActivityStatement } from './activity.js';
import { readLiveScoreConfig, readScoreConfig } from './scoring.js';
import { SCORE_DEFAULT_VERSION } from '#lib/engine/scoring.js';
import { memoryOpeningMs, CONNECT_ENTRANCE_MS, CARD_RANKED_OPENING_MS } from '#lib/round-timing.js';
import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { catalog } from '#lib/catalog.js';
import { normalizeSeed } from '#lib/engine/rng.js';
import type { CompletedRun, PuzzleId } from '#lib/engine/contract.js';
import { randomSeed } from '#lib/seeds.js';
import { createDatabase } from './db/index.js';
import { completedRun, playSession } from './db/schema.js';
import { drawFreshTheme } from '#lib/engine/theme/freshness.js';
import { generateTheme, type ResolvedTheme } from '#lib/engine/theme/generator.js';
import { THEME_CONFIG_VERSION, THEME_GENERATOR_VERSION } from '#lib/engine/theme/config.js';

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
		Object.keys(run)
			.filter((key) => key !== 'theme' && key !== 'scoreConfigVersion')
			.sort()
			.join(',') !== 'elapsedSeconds,engineVersion,family,id,moves,rankedSession,seed,version' ||
		run.version !== 1 ||
		typeof run.id !== 'string' ||
		!UUID.test(run.id) ||
		!['block', 'memory', 'connect'].includes(run.family) ||
		typeof run.seed !== 'string' ||
		run.seed.length > 20 ||
		!Number.isSafeInteger(run.elapsedSeconds) ||
		run.elapsedSeconds < 0 ||
		run.elapsedSeconds > 7200 ||
		!(run.rankedSession === null || run.rankedSession === run.id)
	)
		throw new RunError('payload');
	if (
		run.theme !== undefined &&
		(!run.theme ||
			typeof run.theme !== 'object' ||
			Object.keys(run.theme).sort().join(',') !== 'configVersion,generatorVersion' ||
			run.theme.configVersion !== THEME_CONFIG_VERSION ||
			run.theme.generatorVersion !== THEME_GENERATOR_VERSION)
	)
		throw new RunError('theme_version', 409);
	if (
		run.scoreConfigVersion !== undefined &&
		(typeof run.scoreConfigVersion !== 'string' ||
			!/^(brief-v1|[0-9a-f-]{36})$/.test(run.scoreConfigVersion))
	)
		throw new RunError('score_version', 409);
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
			Object.keys(move).sort().join(',') !==
			(run.family === 'memory'
				? 'index'
				: run.family === 'connect'
					? 'at,cell,pair,stroke'
					: 'trayIndex,x,y')
		)
			throw new RunError('move');
	}
	return {
		version: 1,
		...(run.scoreConfigVersion ? { scoreConfigVersion: run.scoreConfigVersion } : {}),
		id: run.id,
		family: run.family,
		engineVersion: run.engineVersion,
		seed: run.seed,
		moves: run.moves.map((move) =>
			run.family === 'memory'
				? { index: move.index }
				: run.family === 'connect'
					? { pair: move.pair, cell: move.cell, stroke: move.stroke, at: move.at }
					: { trayIndex: move.trayIndex, x: move.x, y: move.y }
		),
		elapsedSeconds: run.elapsedSeconds,
		rankedSession: run.rankedSession,
		...(run.theme
			? {
					theme: {
						configVersion: run.theme.configVersion,
						generatorVersion: run.theme.generatorVersion
					}
				}
			: {})
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
	const recent = await db
		.select({ snapshot: playSession.themeSnapshot })
		.from(playSession)
		.where(eq(playSession.userId, userId))
		.orderBy(desc(playSession.sequence))
		.limit(3);
	const history = recent.flatMap((row) =>
		row.snapshot ? [JSON.parse(row.snapshot) as ResolvedTheme] : []
	);
	const theme = drawFreshTheme(family, history, randomSeed);
	const seed = theme.seed;
	// One conditional statement serializes caps and insertion. No read/check/write gap.
	for (let attempt = 0; attempt < 3; attempt++) {
		const { config: scoring, liveVersion } = await readLiveScoreConfig(binding, family);
		const rows = await db.all<{ id: string }>(sql`
		INSERT INTO play_session (id,user_id,family,seed,engine_version,created_at,expires_at,ip_hash,theme_config_version,theme_generator_version,theme_snapshot,card_opening_ms,score_config_version)
		SELECT ${id},${userId},${family},${seed},${catalog[family].engineVersion},${now},${now + 7200000},${ipHash},${theme.themeConfigVersion},${theme.themeGeneratorVersion},${JSON.stringify(theme)},${CARD_RANKED_OPENING_MS},${scoring.version}
		WHERE EXISTS (SELECT 1 FROM player WHERE user_id=${userId})
		AND NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=${userId} AND (expires_at IS NULL OR expires_at>${now}))
		AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=${userId})
		AND EXISTS (SELECT 1 FROM game_lifecycle WHERE family=${family} AND state='enabled')
		AND COALESCE((SELECT version FROM score_live WHERE family=${family}),'brief-v1')=${liveVersion}
		AND NOT EXISTS (SELECT 1 FROM site_control WHERE key='ranked' AND enabled=0)
		AND (SELECT count(*) FROM play_session WHERE user_id=${userId} AND created_at>${now - 3600000}) < 30
		AND (SELECT count(*) FROM play_session WHERE ip_hash=${ipHash} AND created_at>${now - 3600000}) < 30
		AND (SELECT count(*) FROM play_session s WHERE s.user_id=${userId} AND s.created_at>${now - 3600000}
			AND s.payload_hash IS NULL AND EXISTS
			(SELECT 1 FROM play_session newer WHERE newer.user_id=s.user_id AND newer.family=s.family AND newer.sequence>s.sequence))
 + CASE WHEN EXISTS (SELECT 1 FROM play_session current WHERE current.user_id=${userId} AND current.family=${family} AND current.payload_hash IS NULL AND current.created_at>${now - 3600000} AND NOT EXISTS (SELECT 1 FROM play_session newer WHERE newer.user_id=current.user_id AND newer.family=current.family AND newer.sequence>current.sequence)) THEN 1 ELSE 0 END <= 10
		RETURNING id`);
		if (!rows.length) {
			const available = await binding
				.prepare('SELECT state FROM game_lifecycle WHERE family=?')
				.bind(family)
				.first<{ state: string }>();
			if (available?.state !== 'enabled') throw new RunError('game_disabled', 409);
			const current = await binding
				.prepare('SELECT version FROM score_live WHERE family=?')
				.bind(family)
				.first<{ version: string }>();
			if ((current?.version ?? 'brief-v1') !== liveVersion) continue;
			throw new RunError('start_limited', 429);
		}
		return {
			scoring,
			id,
			seed,
			family,
			theme,
			engineVersion: catalog[family].engineVersion,
			startedAt: now,
			expiresAt: now + 7200000
		};
	}
	throw new RunError('score_conflict', 409);
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
		if (
			await binding
				.prepare('SELECT user_id FROM user_lifecycle WHERE user_id=?')
				.bind(userId)
				.first()
		)
			throw new RunError('unavailable', 403);
		if (stored.userId !== userId || stored.payloadHash !== hash)
			throw new RunError('conflict', 409);
		await trackCompletion(binding, userId, run.id, now);
		return { id: stored.id, score: stored.score, ranked: stored.ranked, group: stored.group };
	}
	const active = await binding
		.prepare(
			`SELECT id FROM user WHERE id=?
		AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=user.id)
		AND NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=user.id AND (expires_at IS NULL OR expires_at>?))`
		)
		.bind(userId, now)
		.first();
	if (!active) throw new RunError('unavailable', 403);
	let scoring = await readScoreConfig(
		binding,
		run.family,
		run.scoreConfigVersion ?? SCORE_DEFAULT_VERSION
	);
	let seconds = run.elapsedSeconds;
	let submittedAt = now;
	let rankedWallMs = 0;
	let cardOpeningMs = 0;
	let resolvedTheme = run.theme
		? generateTheme(run.seed, run.family, run.theme.configVersion)
		: null;
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
		if (run.scoreConfigVersion && run.scoreConfigVersion !== issued.scoreConfigVersion)
			throw new RunError('score_version', 409);
		scoring = await readScoreConfig(binding, run.family, issued.scoreConfigVersion);
		cardOpeningMs = issued.cardOpeningMs;
		// The issued snapshot is authoritative, including for a queued legacy client.
		resolvedTheme = issued.themeSnapshot
			? (JSON.parse(issued.themeSnapshot) as ResolvedTheme)
			: null;
		if (
			run.theme &&
			(issued.themeConfigVersion !== run.theme.configVersion ||
				issued.themeGeneratorVersion !== run.theme.generatorVersion)
		)
			throw new RunError('theme_version', 409);
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
						sql`NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=${userId} AND (expires_at IS NULL OR expires_at>${now}))`,
						sql`NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=${userId})`,
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
		result = catalog[run.family].replay(run.seed, run.moves, seconds, scoring.values);
	} catch {
		throw new RunError('invalid_replay');
	}
	if (run.rankedSession && run.family === 'memory') {
		seconds = Math.floor(
			Math.max(0, rankedWallMs - memoryOpeningMs(result.pairs!) - cardOpeningMs) / 1000
		);
		result = catalog[run.family].replay(run.seed, run.moves, seconds, scoring.values);
	}
	if (run.rankedSession && run.family === 'connect') {
		seconds = Math.floor(Math.max(0, rankedWallMs - CONNECT_ENTRANCE_MS - cardOpeningMs) / 1000);
		result = catalog.connect.replay(run.seed, run.moves, seconds, scoring.values);
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
		(id,user_id,family,engine_version,rules_group,score,pairs,moves,seconds,seed,move_log,payload_hash,ranked,hidden,created_at,theme_config_version,theme_generator_version,theme_snapshot,score_config_version)
		SELECT ${run.id},${userId},${run.family},${run.engineVersion},${result.group},${result.score},${result.pairs},
		${result.moves},${seconds},${run.seed},${JSON.stringify(run.moves)},${hash},${run.rankedSession ? 1 : 0},0,${submittedAt},${resolvedTheme?.themeConfigVersion ?? 'curated-v1'},${resolvedTheme?.themeGeneratorVersion ?? 'curated-v1'},${resolvedTheme ? JSON.stringify(resolvedTheme) : null},${scoring.version}
		WHERE NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=${userId} AND (expires_at IS NULL OR expires_at>${now}))
 AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=${userId})
 AND (${run.rankedSession ? 1 : 0}=1 OR (SELECT count(*) FROM completed_run WHERE user_id=${userId} AND created_at>${now - 3600000})<100)
		ON CONFLICT(id) DO NOTHING`);
	const committed = await db.select().from(completedRun).where(eq(completedRun.id, run.id)).get();
	if (!committed) throw new RunError('save_limited', 429);
	if (committed.userId !== userId || committed.payloadHash !== hash)
		throw new RunError('conflict', 409);
	await trackCompletion(binding, userId, run.id, now);
	return {
		id: committed.id,
		score: committed.score,
		ranked: committed.ranked,
		group: committed.group
	};
}

async function trackCompletion(binding: D1Database, userId: string, runId: string, now: number) {
	try {
		await completionActivityStatement(binding, userId, runId, now).run();
	} catch {
		console.error(JSON.stringify({ event: 'account_activity_completion_failed' }));
	}
}

export async function accountHistory(binding: D1Database, userId: string) {
	const db = createDatabase(binding);
	const history = await db
		.select({
			id: completedRun.id,
			family: completedRun.family,
			score: completedRun.score,
			group: completedRun.group,
			scoreConfigVersion: completedRun.scoreConfigVersion,
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
			scoreConfigVersion: completedRun.scoreConfigVersion,
			score: sql<number>`max(${completedRun.score})`
		})
		.from(completedRun)
		.where(
			and(
				eq(completedRun.userId, userId),
				sql`${completedRun.scoreConfigVersion} = COALESCE((SELECT version FROM score_live WHERE family=${completedRun.family}), 'brief-v1')`
			)
		)
		.groupBy(completedRun.family, completedRun.group, completedRun.scoreConfigVersion);
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
	'memory-1:10',
	'connect-1:1',
	'connect-1:2',
	'connect-1:3'
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
	const family: PuzzleId = group.startsWith('memory')
		? 'memory'
		: group.startsWith('connect')
			? 'connect'
			: 'block';
	const scoring = await readScoreConfig(binding, family);
	// Each player occupies one place, using their best eligible result.
	const query = sql`WITH eligible AS (
		SELECT r.*, p.name, row_number() OVER (PARTITION BY r.user_id ORDER BY r.score DESC,r.created_at,r.id) AS personal
		FROM completed_run r JOIN player p ON p.user_id=r.user_id
		WHERE r.rules_group=${group} AND r.score_config_version=${scoring.version} AND r.ranked=1 AND r.hidden=0
		AND NOT EXISTS (SELECT 1 FROM player_ban b WHERE b.user_id=r.user_id AND (b.expires_at IS NULL OR b.expires_at>unixepoch()*1000))
		AND NOT EXISTS (SELECT 1 FROM user_lifecycle l WHERE l.user_id=r.user_id)
	), ranked AS (
		SELECT name,score,user_id,row_number() OVER (ORDER BY score DESC,created_at,id) AS position
		FROM eligible WHERE personal=1
	) SELECT name,score,position,CASE WHEN user_id=${viewer} THEN 1 ELSE 0 END AS own
	FROM ranked WHERE position>${offset} AND position<=${offset + 25} OR user_id=${viewer} ORDER BY position`;
	const rows = await db.all<{ name: string; score: number; position: number; own: number }>(query);
	return {
		scoreConfigVersion: scoring.version,
		rows: rows.filter((row) => row.position > offset && row.position <= offset + 25),
		own: rows.find((row) => row.own) ?? null,
		offset,
		group
	};
}
