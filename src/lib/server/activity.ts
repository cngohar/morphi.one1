import { catalog } from '#lib/catalog.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import { puzzleVariant } from '#lib/scoring.js';
import { RunError } from './runs.js';
import { dailySessionId, utcDate } from './daily.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface ReportedRoundStart {
	runId: string;
	family: PuzzleId;
	variant?: string;
	rankedSession: string | null;
}

export function parseRoundActivity(value: Record<string, unknown>): {
	action: 'start' | 'play' | 'abandon';
	round: ReportedRoundStart;
} {
	if (
		Object.keys(value)
			.filter((key) => key !== 'variant')
			.sort()
			.join(',') !== 'action,family,ownerKey,rankedSession,runId' ||
		(value.action !== 'start' && value.action !== 'play' && value.action !== 'abandon') ||
		typeof value.runId !== 'string' ||
		!UUID.test(value.runId) ||
		typeof value.family !== 'string' ||
		!Object.hasOwn(catalog, value.family) ||
		(value.rankedSession !== null && value.rankedSession !== value.runId)
	)
		throw new RunError('payload');
	let variant;
	try {
		if (value.variant !== undefined && typeof value.variant !== 'string')
			throw new RangeError('variant');
		variant = puzzleVariant(value.family, value.variant)?.id;
	} catch {
		throw new RunError('variant');
	}
	return {
		action: value.action,
		round: {
			runId: value.runId,
			family: value.family,
			...(variant ? { variant } : {}),
			rankedSession: value.rankedSession
		}
	};
}

/** Observed authenticated requests include background sync, not just human interaction. */
export async function recordAccountActivity(binding: D1Database, userId: string, now = Date.now()) {
	await binding
		.prepare(
			`INSERT INTO account_activity (user_id,tracking_since,last_activity_at)
			SELECT id,?,? FROM user WHERE id=?
			AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=?)
			ON CONFLICT(user_id) DO UPDATE SET last_activity_at=MAX(last_activity_at,excluded.last_activity_at)`
		)
		.bind(now, now, userId, userId)
		.run();
}

/** No historical rows: only an authenticated client acknowledgement creates a start. */
export async function recordRoundStart(
	binding: D1Database,
	userId: string,
	round: ReportedRoundStart,
	now = Date.now()
) {
	const ranked = round.rankedSession ? 1 : 0;
	const defaultId = catalog[round.family].variants?.[0].id ?? null;
	const reportedVariant = roundVariant(round);
	const dailyPuzzle = ranked
		? await binding
				.prepare(
					`SELECT p.variant,p.date FROM daily_puzzle p WHERE p.family=? AND
					(EXISTS (SELECT 1 FROM play_session s WHERE s.id=? AND s.user_id=? AND s.family=p.family
					AND p.date=strftime('%Y-%m-%d',s.created_at/1000,'unixepoch') AND s.variant=p.variant
					AND s.seed=p.seed AND s.engine_version=p.engine_version AND s.score_config_version=p.score_config_version)
					OR EXISTS (SELECT 1 FROM completed_run r JOIN daily_best b ON b.family=p.family
					AND b.date=p.date AND b.user_id=r.user_id WHERE r.id=? AND r.user_id=? AND r.family=p.family
					AND r.ranked=1 AND r.seed=p.seed AND r.engine_version=p.engine_version
					AND r.score_config_version=p.score_config_version))`
				)
				.bind(round.family, round.runId, userId, round.runId, userId)
				.first<{ variant: string; date: string }>()
		: null;
	const daily =
		dailyPuzzle && (await dailySessionId(userId, round.family, dailyPuzzle.date)) === round.runId
			? dailyPuzzle
			: null;
	let variant = reportedVariant;
	if (ranked && !daily) {
		// Legacy ranked issuance still uses a random session id. A deterministic
		// daily id must retain its authoritative puzzle rather than use this path.
		const legacy = await binding
			.prepare('SELECT created_at,variant FROM play_session WHERE id=? AND user_id=? AND family=?')
			.bind(round.runId, userId, round.family)
			.first<{ created_at: number; variant: string | null }>();
		if (
			!legacy ||
			(await dailySessionId(userId, round.family, utcDate(legacy.created_at))) === round.runId
		)
			throw new RunError('activity_unavailable', 429);
		variant = roundVariant({ ...round, variant: legacy.variant ?? undefined });
		if (reportedVariant?.id !== defaultId && reportedVariant?.id !== variant?.id)
			throw new RunError('conflict', 409);
	}
	if (daily && reportedVariant?.id !== defaultId && reportedVariant?.id !== daily.variant)
		throw new RunError('conflict', 409);
	if (daily) variant = roundVariant({ ...round, variant: daily.variant });
	const dailyFilter = `AND (?=0 OR EXISTS (SELECT 1 FROM daily_puzzle p JOIN daily_best b
		ON b.family=p.family AND b.date=p.date AND b.user_id=completed_run.user_id
		WHERE p.family=completed_run.family AND p.date=? AND p.variant=? AND p.seed=completed_run.seed
		AND p.engine_version=completed_run.engine_version AND p.score_config_version=completed_run.score_config_version))`;
	await binding
		.prepare(
			`INSERT INTO account_round_activity (run_id,user_id,family,ranked,variant,started_at,completed_at)
			SELECT ?,?,?,?,?,?,(SELECT created_at FROM completed_run WHERE id=? AND user_id=? AND family=? AND ranked=? AND created_at>? ${dailyFilter}) WHERE EXISTS (SELECT 1 FROM user WHERE id=?)
			AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=?)
			AND NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=? AND (expires_at IS NULL OR expires_at>?))
			AND (SELECT count(*) FROM account_round_activity WHERE user_id=? AND started_at>?)<30
			AND (EXISTS (SELECT 1 FROM completed_run WHERE id=? AND user_id=? AND family=? AND ranked=? AND created_at>? ${dailyFilter})
			OR (NOT EXISTS (SELECT 1 FROM completed_run WHERE id=?) AND
			((?=1 AND EXISTS (SELECT 1 FROM play_session WHERE id=? AND user_id=? AND family=? AND expires_at>? AND payload_hash IS NULL AND COALESCE(variant,?) IS ?))
			OR (?=0 AND NOT EXISTS (SELECT 1 FROM play_session WHERE id=?)))))
			ON CONFLICT(run_id) DO NOTHING`
		)
		.bind(
			round.runId,
			userId,
			round.family,
			ranked,
			variant?.id ?? null,
			now,
			round.runId,
			userId,
			round.family,
			ranked,
			now - 30_000,
			daily ? 1 : 0,
			daily?.date ?? null,
			variant?.id ?? null,
			userId,
			userId,
			userId,
			now,
			userId,
			now - 3_600_000,
			round.runId,
			userId,
			round.family,
			ranked,
			now - 30_000,
			daily ? 1 : 0,
			daily?.date ?? null,
			variant?.id ?? null,
			round.runId,
			ranked,
			round.runId,
			userId,
			round.family,
			now,
			defaultId,
			variant?.id ?? null,
			ranked,
			round.runId
		)
		.run();
	const stored = await binding
		.prepare('SELECT user_id,family,ranked,variant FROM account_round_activity WHERE run_id=?')
		.bind(round.runId)
		.first<{ user_id: string; family: string; ranked: number; variant: string | null }>();
	if (!stored) throw new RunError('activity_unavailable', 429);
	if (
		stored.user_id !== userId ||
		stored.family !== round.family ||
		stored.ranked !== ranked ||
		puzzleVariant(round.family, stored.variant ?? undefined)?.id !== variant?.id
	)
		throw new RunError('conflict', 409);
}

function roundVariant(round: ReportedRoundStart) {
	try {
		return puzzleVariant(round.family, round.variant);
	} catch {
		throw new RunError('variant');
	}
}

/** A late first-flip report may follow Home; retries cannot move its timestamp. */
export async function recordRoundPlay(
	binding: D1Database,
	userId: string,
	round: ReportedRoundStart,
	now = Date.now()
) {
	const variant = roundVariant(round)?.id ?? null;
	const defaultId = catalog[round.family].variants?.[0].id ?? null;
	await binding.batch([
		binding
			.prepare(
				`UPDATE account_round_activity SET first_move_at=COALESCE(first_move_at,?)
 WHERE run_id=? AND user_id=? AND family=? AND ranked=? AND COALESCE(variant,?) IS ?
 AND completed_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM user_lifecycle WHERE user_id=?)`
			)
			.bind(
				now,
				round.runId,
				userId,
				round.family,
				round.rankedSession ? 1 : 0,
				defaultId,
				variant,
				userId
			),
		binding
			.prepare(
				`UPDATE play_session SET first_move_at=COALESCE(first_move_at,?)
 WHERE id=? AND user_id=? AND family=? AND COALESCE(variant,?) IS ?
 AND ?=1 AND expires_at>? AND payload_hash IS NULL
 AND NOT EXISTS(SELECT 1 FROM user_lifecycle WHERE user_id=?)`
			)
			.bind(
				now,
				round.runId,
				userId,
				round.family,
				defaultId,
				variant,
				round.rankedSession ? 1 : 0,
				now,
				userId
			)
	]);
}

/** An explicit departure is a report; unknown exits stay unresolved. */
export async function recordRoundAbandon(
	binding: D1Database,
	userId: string,
	round: ReportedRoundStart,
	now = Date.now()
) {
	const variant = roundVariant(round)?.id ?? null;
	const defaultId = catalog[round.family].variants?.[0].id ?? null;
	await binding.batch([
		binding
			.prepare(
				`UPDATE account_round_activity SET abandoned_at=COALESCE(abandoned_at,?)
 WHERE run_id=? AND user_id=? AND family=? AND ranked=? AND COALESCE(variant,?) IS ? AND completed_at IS NULL
 AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=?)
 AND NOT EXISTS (SELECT 1 FROM completed_run WHERE id=? AND user_id=?)`
			)
			.bind(
				now,
				round.runId,
				userId,
				round.family,
				round.rankedSession ? 1 : 0,
				defaultId,
				variant,
				userId,
				round.runId,
				userId
			),
		binding
			.prepare(
				`UPDATE play_session SET abandoned_at=COALESCE(abandoned_at,?)
 WHERE id=? AND user_id=? AND family=? AND COALESCE(variant,?) IS ? AND ?=1 AND payload_hash IS NULL
 AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=?)
 AND NOT EXISTS (SELECT 1 FROM completed_run WHERE id=? AND user_id=?)`
			)
			.bind(
				now,
				round.runId,
				userId,
				round.family,
				defaultId,
				variant,
				round.rankedSession ? 1 : 0,
				userId,
				round.runId,
				userId
			)
	]);
}

/** Join the completion insert transaction; a later valid completion supersedes a departure report. */
export function completionActivityStatement(
	binding: D1Database,
	userId: string,
	runId: string,
	now = Date.now()
) {
	return binding
		.prepare(
			`UPDATE account_round_activity SET completed_at=COALESCE(completed_at,?),abandoned_at=NULL
			WHERE run_id=? AND user_id=? AND EXISTS
			(SELECT 1 FROM completed_run r WHERE r.id=account_round_activity.run_id
			AND r.user_id=account_round_activity.user_id AND r.family=account_round_activity.family
			AND r.ranked=account_round_activity.ranked)`
		)
		.bind(now, runId, userId);
}
