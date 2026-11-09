import { catalog } from '#lib/catalog.js';
import type { PuzzleId, PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
import { defaultScoreConfig, scoreScope, type ScoreConfig } from '#lib/scoring.js';
import { enabledVariants, gameAvailable } from './games.js';
import { readLiveScoreConfig } from './scoring.js';
import { RunError, digest } from './runs.js';
import { cachedConfigRow, dailyBoardKey, invalidateDailyBoard } from './config-cache.js';
import { memorySqlPaths } from './memory-policy.js';

const DAY_MS = 86_400_000;
const GRACE_MS = 7_200_000;
const TIERS = [1, 5, 10, 25, 50] as const;
export function utcDate(now = Date.now()) {
	if (!Number.isSafeInteger(now)) throw new RunError('date');
	return new Date(now).toISOString().slice(0, 10);
}
export function validateDailyDate(date: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RunError('date');
	const time = Date.parse(`${date}T00:00:00Z`);
	if (!Number.isSafeInteger(time) || utcDate(time) !== date) throw new RunError('date');
	return date;
}
/** Yesterday accepts its issued rounds until the last two-hour session can expire. */
export function dailyFreezeAt(date: string) {
	return Date.parse(`${validateDailyDate(date)}T00:00:00Z`) + DAY_MS + GRACE_MS;
}
export function isDailyFrozen(date: string, now = Date.now()) {
	return now >= dailyFreezeAt(date);
}
export function midnightDailyGeneration(now: number) {
	return now === Date.parse(`${utcDate(now)}T00:00:00Z`);
}
export interface DailyPuzzle {
	family: PuzzleId;
	date: string;
	variant: string;
	seed: string;
	engineVersion: string;
	scoreConfigVersion: string;
	createdAt: number;
}
export interface DailyIssued {
	id: string;
	family: PuzzleId;
	seed: string;
	engineVersion: string;
	startedAt: number;
	expiresAt: number;
	theme: ResolvedTheme;
	scoring: ScoreConfig;
	round: { seed: string; rules: Record<string, number | boolean>; [key: string]: unknown };
	help: PuzzlePresentation['help'];
	ending: Omit<PuzzleManifest['ending'], 'condition'>;
	roundRuleLine: string;
	date: string;
	daily: true;
}
const PUZZLE_COLUMNS = `family,date,variant,seed,engine_version AS engineVersion,
score_config_version AS scoreConfigVersion,created_at AS createdAt`;

/** Separate bytes select the rules and the 64-bit engine seed; only the server knows the key. */
export async function deriveDailyPuzzle(
	date: string,
	family: string,
	secret: string,
	variants: readonly { id: string; weight: number }[]
) {
	validateDailyDate(date);
	if (!secret) throw new RunError('daily_unavailable', 503);
	const choices = variants.filter((row) => Number.isSafeInteger(row.weight) && row.weight > 0);
	const total = choices.reduce((sum, row) => sum + row.weight, 0);
	if (!choices.length || !Number.isSafeInteger(total)) throw new RunError('game_disabled', 409);
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const bytes = new Uint8Array(
		await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${date}|${family}`))
	);
	const integer = (start: number) =>
		bytes.slice(start, start + 8).reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
	let ticket = Number(integer(8) % BigInt(total));
	for (const choice of choices) {
		if (ticket < choice.weight) return { seed: integer(0).toString(), variant: choice.id };
		ticket -= choice.weight;
	}
	throw new RunError('daily_unavailable', 503);
}

export async function dailyPuzzle(
	binding: D1Database,
	family: PuzzleId,
	date: string,
	secret: string,
	cache?: KVNamespace,
	now = Date.now()
): Promise<DailyPuzzle> {
	validateDailyDate(date);
	if (!Object.hasOwn(catalog, family)) throw new RunError('board');
	const existing = await binding
		.prepare(`SELECT ${PUZZLE_COLUMNS} FROM daily_puzzle WHERE family=? AND date=?`)
		.bind(family, date)
		.first<DailyPuzzle>();
	if (existing) return existing; // Secret rotation and later disablement never change a pinned puzzle.
	if (!(await gameAvailable(binding, family))) throw new RunError('game_disabled', 409);
	const enabled = await enabledVariants(binding, family);
	const choices = (catalog[family].variants ?? []).filter((row) => enabled.includes(row.id));
	const derived = await deriveDailyPuzzle(date, family, secret, choices);
	const { config, liveVersion } = await readLiveScoreConfig(
		binding,
		family,
		cache,
		derived.variant
	);
	const paths =
		family === 'memory' ? memorySqlPaths(derived.variant) : Array(6).fill('$.dimensions');
	await binding
		.prepare(
			`INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at)
		SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM game_lifecycle WHERE family=? AND state='enabled')
		AND COALESCE((SELECT state FROM variant_lifecycle WHERE family=? AND variant=?),?)='enabled'
		AND COALESCE((SELECT version FROM score_live WHERE family=?),?)=?
		AND (?!='memory' OR NOT EXISTS(SELECT 1 FROM config_live live WHERE live.key='game:memory' AND NOT EXISTS(
			SELECT 1 FROM game_config policy WHERE policy.version=live.version AND policy.family='memory'
			AND CASE WHEN json_valid(policy.values_json) THEN
			COALESCE(json_extract(policy.values_json,?),1)=1 AND COALESCE(json_extract(policy.values_json,?),1)=1
			AND COALESCE(json_extract(policy.values_json,?),1)=1 AND COALESCE(json_extract(policy.values_json,?),1)=1
			AND COALESCE(json_extract(policy.values_json,?),1)=1 AND COALESCE(json_extract(policy.values_json,?),1)=1 ELSE 0 END)))
		ON CONFLICT(family,date) DO NOTHING`
		)
		.bind(
			family,
			date,
			derived.variant,
			derived.seed,
			catalog[family].engineVersion,
			config.version,
			now,
			family,
			family,
			derived.variant,
			choices.find((row) => row.id === derived.variant)?.enabled === false ? 'disabled' : 'enabled',
			scoreScope(family, derived.variant),
			defaultScoreConfig(family, derived.variant).version,
			liveVersion,
			family,
			...paths
		)
		.run();
	const pinned = await binding
		.prepare(`SELECT ${PUZZLE_COLUMNS} FROM daily_puzzle WHERE family=? AND date=?`)
		.bind(family, date)
		.first<DailyPuzzle>();
	if (!pinned) throw new RunError('daily_unavailable', 503);
	return pinned;
}

/** Stable primary key makes concurrent re-issuance one ranked attempt without another table. */
export async function dailySessionId(userId: string, family: string, date: string) {
	const hash = await digest(JSON.stringify(['daily-v1', userId, family, validateDailyDate(date)]));
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function percentileCutoffs(totalPlayers: number) {
	return TIERS.map((tier) => ({ tier, rank: Math.floor((totalPlayers * tier) / 100) }));
}
export function rankPercentile(position: number, cutoffs: ReturnType<typeof percentileCutoffs>) {
	return cutoffs.find((row) => position > 0 && position <= row.rank)?.tier;
}
export function nextStreak(current: number, longest: number, lastDate: string, date: string) {
	validateDailyDate(date);
	validateDailyDate(lastDate);
	if (date <= lastDate) return { current, longest, lastDate };
	const next =
		Date.parse(`${date}T00:00:00Z`) - Date.parse(`${lastDate}T00:00:00Z`) === DAY_MS
			? current + 1
			: 1;
	return { current: next, longest: Math.max(longest, next), lastDate: date };
}
export function streakFreezeEligible(userId: string) {
	void userId;
	// TODO(v1.4.x): pro streak freeze — wire to premium status when premium lands
	return { eligible: false as const, reason: 'premium-not-launched' as const };
}
export async function dailyStreak(binding: D1Database, userId: string, now = Date.now()) {
	const row = await binding
		.prepare('SELECT current,longest,last_date AS lastDate FROM streak WHERE user_id=?')
		.bind(userId)
		.first<{ current: number; longest: number; lastDate: string }>();
	if (!row) return { current: 0, longest: 0 };
	const yesterday = utcDate(now - DAY_MS);
	return { current: row.lastDate < yesterday ? 0 : row.current, longest: row.longest };
}

/** Called on saved retries too, so an interrupted save repairs its best and streak. */
export async function dailyBest(
	binding: D1Database,
	userId: string,
	runId: string,
	cache?: KVNamespace,
	now = Date.now()
) {
	const candidates = await binding
		.prepare(
			`SELECT r.family,r.score,r.seconds,r.moves,r.created_at AS submittedAt,p.variant,p.date
		FROM completed_run r LEFT JOIN play_session s ON s.id=r.id AND s.user_id=r.user_id
		JOIN daily_puzzle p ON p.family=r.family AND p.seed=r.seed AND p.engine_version=r.engine_version
		AND p.score_config_version=r.score_config_version
		AND (s.id IS NULL OR (s.family=r.family AND s.seed=r.seed AND s.variant=p.variant
		AND s.engine_version=p.engine_version AND s.score_config_version=p.score_config_version
		AND s.payload_hash=r.payload_hash AND p.date=strftime('%Y-%m-%d',s.created_at/1000,'unixepoch')))
		WHERE r.id=? AND r.user_id=? AND r.ranked=1 AND r.hidden=0`
		)
		.bind(runId, userId)
		.all<{
			family: string;
			date: string;
			variant: string;
			score: number;
			seconds: number;
			moves: number;
			submittedAt: number;
		}>();
	let run;
	for (const candidate of candidates.results) {
		if (
			(await dailySessionId(userId, candidate.family, candidate.date)) === runId &&
			catalog[candidate.family]?.variants?.some((row) => row.id === candidate.variant)
		) {
			run = candidate;
			break;
		}
	}
	if (!run) return null;
	const results = await binding.batch(
		dailyCompletionStatements(binding, userId, runId, run.family, run.date, now)
	);
	if (results[0].meta.changes) await invalidateDailyBoard(cache, run.family, run.date);
	return { family: run.family, date: run.date };
}

/** Also batched with the daily completed_run insert, so no completed-without-best gap exists. */
export function dailyCompletionStatements(
	binding: D1Database,
	userId: string,
	runId: string,
	family: string,
	date: string,
	now: number
) {
	validateDailyDate(date);
	return [
		binding
			.prepare(
				`INSERT INTO daily_best(family,date,user_id,score,seconds,moves,created_at,updated_at)
			SELECT r.family,?,r.user_id,r.score,r.seconds,r.moves,r.created_at,? FROM completed_run r
			JOIN daily_puzzle p ON p.family=r.family AND p.date=? AND p.seed=r.seed
			AND p.engine_version=r.engine_version AND p.score_config_version=r.score_config_version
			WHERE r.id=? AND r.user_id=? AND r.family=? AND r.ranked=1 AND r.hidden=0 AND ?<?
			AND EXISTS(SELECT 1 FROM player WHERE user_id=r.user_id)
			AND NOT EXISTS(SELECT 1 FROM user_lifecycle WHERE user_id=r.user_id)
			AND NOT EXISTS(SELECT 1 FROM player_ban WHERE user_id=r.user_id AND (expires_at IS NULL OR expires_at>?))
			ON CONFLICT(family,date,user_id) DO UPDATE SET score=excluded.score,seconds=excluded.seconds,
			moves=excluded.moves,created_at=excluded.created_at,updated_at=excluded.updated_at WHERE excluded.score>daily_best.score`
			)
			.bind(date, now, date, runId, userId, family, now, dailyFreezeAt(date), now),
		binding
			.prepare('DELETE FROM daily_board_snapshot WHERE family=? AND date=? AND changes()>0')
			.bind(family, date),
		binding
			.prepare(
				`INSERT INTO streak(user_id,current,longest,last_date)
			SELECT r.user_id,1,1,strftime('%Y-%m-%d',r.created_at/1000,'unixepoch') FROM completed_run r
			WHERE r.id=? AND r.user_id=? AND EXISTS(SELECT 1 FROM daily_best WHERE family=? AND date=? AND user_id=r.user_id)
			ON CONFLICT(user_id) DO UPDATE SET
			current=CASE WHEN julianday(excluded.last_date)-julianday(streak.last_date)=1 THEN streak.current+1 ELSE 1 END,
			longest=MAX(streak.longest,CASE WHEN julianday(excluded.last_date)-julianday(streak.last_date)=1 THEN streak.current+1 ELSE 1 END),
			last_date=excluded.last_date WHERE excluded.last_date>streak.last_date`
			)
			.bind(runId, userId, family, date)
	];
}

interface SnapshotRow {
	userId: string;
	name: string;
	score: number;
	position: number;
}
interface Snapshot {
	rows: SnapshotRow[];
	cutoffs: ReturnType<typeof percentileCutoffs>;
	totalPlayers: number;
	updatedAt: number;
}
function parseSnapshot(value: unknown): Snapshot | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Snapshot;
	if (
		!Array.isArray(row.rows) ||
		row.rows.length > 25 ||
		!Array.isArray(row.cutoffs) ||
		!Number.isSafeInteger(row.totalPlayers) ||
		row.totalPlayers < 0 ||
		!Number.isSafeInteger(row.updatedAt)
	)
		return null;
	if (
		row.rows.some(
			(entry) =>
				typeof entry.userId !== 'string' ||
				typeof entry.name !== 'string' ||
				!Number.isSafeInteger(entry.score) ||
				!Number.isSafeInteger(entry.position)
		)
	)
		return null;
	if (JSON.stringify(row.cutoffs) !== JSON.stringify(percentileCutoffs(row.totalPlayers)))
		return null;
	return row;
}
async function computeSnapshot(
	binding: D1Database,
	family: string,
	date: string,
	now: number
): Promise<Snapshot> {
	// Accepted scores form a stable ledger. Later bans/deletions anonymize names, never move ranks.
	const results = await binding.batch([
		binding
			.prepare(
				`SELECT b.user_id AS userId,COALESCE(p.name,'Anonymous') AS name,b.score FROM daily_best b
			LEFT JOIN player p ON p.user_id=b.user_id WHERE b.family=? AND b.date=?
			ORDER BY b.score DESC,b.created_at,b.user_id LIMIT 25`
			)
			.bind(family, date),
		binding
			.prepare('SELECT COUNT(*) AS total FROM daily_best WHERE family=? AND date=?')
			.bind(family, date)
	]);
	const totalPlayers = (results[1].results[0] as { total: number }).total;
	const rows = (results[0].results as Omit<SnapshotRow, 'position'>[]).map((row, index) => ({
		...row,
		position: index + 1
	}));
	const snapshot = { rows, totalPlayers, cutoffs: percentileCutoffs(totalPlayers), updatedAt: now };
	await binding
		.prepare(
			`INSERT INTO daily_board_snapshot(family,date,top_json,total_players,updated_at) VALUES(?,?,?,?,?)
		ON CONFLICT(family,date) DO UPDATE SET top_json=excluded.top_json,total_players=excluded.total_players,updated_at=excluded.updated_at`
		)
		.bind(family, date, JSON.stringify({ rows, cutoffs: snapshot.cutoffs }), totalPlayers, now)
		.run();
	return snapshot;
}
async function boardSnapshot(
	binding: D1Database,
	family: string,
	date: string,
	cache: KVNamespace | undefined,
	now: number
) {
	const frozen = isDailyFrozen(date, now);
	return (await cachedConfigRow(
		cache,
		dailyBoardKey(family, date),
		async () => {
			const stored = await binding
				.prepare(
					'SELECT top_json,total_players,updated_at FROM daily_board_snapshot WHERE family=? AND date=?'
				)
				.bind(family, date)
				.first<{ top_json: string; total_players: number; updated_at: number }>();
			if (
				stored &&
				stored.updated_at <= now &&
				(frozen ? stored.updated_at >= dailyFreezeAt(date) : now - stored.updated_at < 300_000)
			) {
				try {
					const parsed = parseSnapshot({
						...JSON.parse(stored.top_json),
						totalPlayers: stored.total_players,
						updatedAt: stored.updated_at
					});
					if (parsed) return parsed;
				} catch {
					/* A bad cache/snapshot falls back to the authoritative ledger. */
				}
			}
			return computeSnapshot(binding, family, date, now);
		},
		(value) => {
			const row = parseSnapshot(value);
			return row &&
				row.updatedAt <= now &&
				(frozen ? row.updatedAt >= dailyFreezeAt(date) : now - row.updatedAt < 300_000)
				? row
				: null;
		},
		300
	))!;
}

export async function dailyBoard(
	binding: D1Database,
	family: string,
	date: string,
	viewer: string | null,
	cache?: KVNamespace,
	limit = 25,
	now = Date.now()
) {
	validateDailyDate(date);
	if (!Object.hasOwn(catalog, family) || date > utcDate(now) || ![25, 100].includes(limit))
		throw new RunError('board');
	const frozen = isDailyFrozen(date, now);
	const snapshot = await boardSnapshot(binding, family, date, cache, now);
	let rows = snapshot.rows;
	if (limit === 100) {
		const result = await binding
			.prepare(
				`SELECT b.user_id AS userId,COALESCE(p.name,'Anonymous') AS name,b.score
			FROM daily_best b LEFT JOIN player p ON p.user_id=b.user_id WHERE b.family=? AND b.date=?
			ORDER BY b.score DESC,b.created_at,b.user_id LIMIT 100`
			)
			.bind(family, date)
			.all<Omit<SnapshotRow, 'position'>>();
		rows = result.results.map((row, index) => ({ ...row, position: index + 1 }));
	}
	// Re-resolve names even on cached/frozen snapshots. Deletions and bans never leak stale names.
	const names = rows.length
		? (
				await binding
					.prepare(
						`SELECT p.user_id AS userId,p.name FROM player p
		WHERE p.user_id IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM user_lifecycle l WHERE l.user_id=p.user_id)
		AND NOT EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=p.user_id AND (b.expires_at IS NULL OR b.expires_at>?))`
					)
					.bind(JSON.stringify(rows.map((row) => row.userId)), now)
					.all<{ userId: string; name: string }>()
			).results
		: [];
	const ownRow = viewer
		? await binding
				.prepare(
					`SELECT b.score,b.created_at AS createdAt FROM daily_best b WHERE b.family=? AND b.date=? AND b.user_id=?`
				)
				.bind(family, date, viewer)
				.first<{ score: number; createdAt: number }>()
		: null;
	let own: { score: number; position: number; percentile?: number } | null = null;
	if (ownRow) {
		const count = await binding
			.prepare(
				`SELECT COUNT(*) AS higher FROM daily_best b WHERE b.family=? AND b.date=?
			AND b.score>=? AND (b.score>? OR (b.score=? AND (b.created_at<? OR (b.created_at=? AND b.user_id<?))))`
			)
			.bind(
				family,
				date,
				ownRow.score,
				ownRow.score,
				ownRow.score,
				ownRow.createdAt,
				ownRow.createdAt,
				viewer
			)
			.first<{ higher: number }>();
		const position = count!.higher + 1;
		const percentile = rankPercentile(position, snapshot.cutoffs);
		own = { score: ownRow.score, position, ...(percentile === undefined ? {} : { percentile }) };
	}
	return {
		family,
		date,
		rows: rows.map((row) => ({
			name: names.find((entry) => entry.userId === row.userId)?.name ?? 'Anonymous',
			score: row.score,
			position: row.position,
			own: row.userId === viewer
		})),
		own,
		totalPlayers: snapshot.totalPlayers,
		updatedAt: snapshot.updatedAt,
		frozen
	};
}

/** Five-minute snapshots; only midnight pins tomorrow; 02:00 UTC finalizes yesterday. */
export async function refreshDailyBoards(
	binding: D1Database,
	secret: string,
	cache?: KVNamespace,
	now = Date.now(),
	monthly = false,
	generateTomorrow = false
) {
	const today = utcDate(now);
	const tomorrow = utcDate(now + DAY_MS);
	const yesterday = utcDate(now - DAY_MS);
	const midnight = generateTomorrow && midnightDailyGeneration(now);
	for (const family of Object.keys(catalog)) {
		if (midnight && (await gameAvailable(binding, family))) {
			// Today is a cold-start/Cron-failure repair; future generation is midnight-only.
			await dailyPuzzle(binding, family, today, secret, cache, now);
			await dailyPuzzle(binding, family, tomorrow, secret, cache, now);
		}
		for (const date of [today, yesterday]) {
			if (isDailyFrozen(date, now)) {
				const stored = await binding
					.prepare(
						'SELECT updated_at AS updatedAt FROM daily_board_snapshot WHERE family=? AND date=?'
					)
					.bind(family, date)
					.first<{ updatedAt: number }>();
				if (stored && stored.updatedAt >= dailyFreezeAt(date)) continue;
			}
			const row = await computeSnapshot(binding, family, date, now);
			await invalidateDailyBoard(cache, family, date);
			try {
				await cache?.put(dailyBoardKey(family, date), JSON.stringify(row), { expirationTtl: 300 });
			} catch {
				console.warn('morphi:daily_board_cache_write_failed');
			}
		}
	}
	if (monthly) {
		const dates = await binding
			.prepare(
				`SELECT DISTINCT b.family,b.date FROM daily_best b LEFT JOIN daily_board_snapshot s ON s.family=b.family AND s.date=b.date WHERE b.date<? AND (s.family IS NULL OR s.updated_at < (unixepoch(b.date)+93600)*1000) ORDER BY b.date,b.family`
			)
			.bind(today)
			.all<{ family: string; date: string }>();
		for (const row of dates.results)
			if (isDailyFrozen(row.date, now)) await computeSnapshot(binding, row.family, row.date, now);
	}
	return { date: today };
}
