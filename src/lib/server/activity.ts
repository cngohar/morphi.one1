import { catalog } from '#lib/catalog.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import { RunError } from './runs.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface ReportedRoundStart {
	runId: string;
	family: PuzzleId;
	rankedSession: string | null;
}

export function parseRoundActivity(value: Record<string, unknown>): {
	action: 'start' | 'abandon';
	round: ReportedRoundStart;
} {
	if (
		Object.keys(value).sort().join(',') !== 'action,family,ownerKey,rankedSession,runId' ||
		(value.action !== 'start' && value.action !== 'abandon') ||
		typeof value.runId !== 'string' ||
		!UUID.test(value.runId) ||
		typeof value.family !== 'string' ||
		!Object.hasOwn(catalog, value.family) ||
		(value.rankedSession !== null && value.rankedSession !== value.runId)
	)
		throw new RunError('payload');
	return {
		action: value.action,
		round: { runId: value.runId, family: value.family, rankedSession: value.rankedSession }
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
	await binding
		.prepare(
			`INSERT INTO account_round_activity (run_id,user_id,family,ranked,started_at,completed_at)
			SELECT ?,?,?,?,?,(SELECT created_at FROM completed_run WHERE id=? AND user_id=? AND family=? AND ranked=? AND created_at>?) WHERE EXISTS (SELECT 1 FROM user WHERE id=?)
			AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=?)
			AND NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=? AND (expires_at IS NULL OR expires_at>?))
			AND (SELECT count(*) FROM account_round_activity WHERE user_id=? AND started_at>?)<30
			AND (EXISTS (SELECT 1 FROM completed_run WHERE id=? AND user_id=? AND family=? AND ranked=? AND created_at>?)
			OR (NOT EXISTS (SELECT 1 FROM completed_run WHERE id=?) AND
			((?=1 AND EXISTS (SELECT 1 FROM play_session WHERE id=? AND user_id=? AND family=? AND expires_at>? AND payload_hash IS NULL))
			OR (?=0 AND NOT EXISTS (SELECT 1 FROM play_session WHERE id=?)))))
			ON CONFLICT(run_id) DO NOTHING`
		)
		.bind(
			round.runId,
			userId,
			round.family,
			ranked,
			now,
			round.runId,
			userId,
			round.family,
			ranked,
			now - 30_000,
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
			round.runId,
			ranked,
			round.runId,
			userId,
			round.family,
			now,
			ranked,
			round.runId
		)
		.run();
	const stored = await binding
		.prepare('SELECT user_id,family,ranked FROM account_round_activity WHERE run_id=?')
		.bind(round.runId)
		.first<{ user_id: string; family: string; ranked: number }>();
	if (!stored) throw new RunError('activity_unavailable', 429);
	if (stored.user_id !== userId || stored.family !== round.family || stored.ranked !== ranked)
		throw new RunError('conflict', 409);
}

/** An explicit Home departure is a report; unknown exits stay unresolved. */
export async function recordRoundAbandon(
	binding: D1Database,
	userId: string,
	round: ReportedRoundStart,
	now = Date.now()
) {
	await binding
		.prepare(
			`UPDATE account_round_activity SET abandoned_at=COALESCE(abandoned_at,?)
			WHERE run_id=? AND user_id=? AND family=? AND ranked=? AND completed_at IS NULL
			AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=?)
			AND NOT EXISTS (SELECT 1 FROM completed_run WHERE id=? AND user_id=?)`
		)
		.bind(
			now,
			round.runId,
			userId,
			round.family,
			round.rankedSession ? 1 : 0,
			userId,
			round.runId,
			userId
		)
		.run();
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
