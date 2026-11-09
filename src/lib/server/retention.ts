import { createDatabase } from './db/index.js';
import { adminActor, adminAudit, user } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { RunError } from './runs.js';
import { anonymizeExpiredUsers } from './user-lifecycle.js';

// The longest configured auth limiter window is 60 seconds. A day is a
// conservative cleanup buffer, not a promise of scheduled deletion.
export const AUTH_LIMIT_CLEANUP_BUFFER_MS = 86_400_000;
const RANKED_LIMIT_WINDOW_MS = 3_600_000;
const COMPLETED_RUN_RETENTION_MS = 90 * 86_400_000;

async function requireAdmin(binding: D1Database, actor: string) {
	const identity = await createDatabase(binding)
		.select()
		.from(adminActor)
		.where(eq(adminActor.id, actor))
		.get();
	if (identity?.role !== 'admin') throw new RunError('permission', 403);
}

/** Operator-invoked maintenance. No background job or time-to-erasure guarantee. */
export async function pruneExpiredRecords(
	binding: D1Database,
	actor: string,
	now = Date.now(),
	archive?: R2Bucket
) {
	await requireAdmin(binding, actor);
	await anonymizeExpiredUsers(binding, now);
	const completedRunBefore = now - COMPLETED_RUN_RETENTION_MS;
	const completedDeletes: D1PreparedStatement[] = [];
	if (archive) {
		const rows = (
			await binding
				.prepare(
					`SELECT id,move_log,payload_hash,created_at FROM completed_run
					WHERE created_at < ? ORDER BY created_at,id LIMIT 50`
				)
				.bind(completedRunBefore)
				.all<{ id: string; move_log: string; payload_hash: string; created_at: number }>()
		).results;
		for (const row of rows) {
			try {
				const stored = await archive.put(row.id, row.move_log, {
					httpMetadata: { contentType: 'application/json' }
				});
				if (!stored) throw new Error('run_archive_failed');
			} catch (error) {
				console.error(JSON.stringify({ event: 'run_archive_failed' }));
				throw error;
			}
			completedDeletes.push(
				binding
					.prepare(
						`DELETE FROM completed_run WHERE id=? AND payload_hash=?
						AND created_at=? AND move_log=? AND created_at < ?`
					)
					.bind(row.id, row.payload_hash, row.created_at, row.move_log, completedRunBefore)
			);
		}
	}
	const criteria = {
		expiredAt: now,
		authLimiterBefore: now - AUTH_LIMIT_CLEANUP_BUFFER_MS,
		rankedAddressBefore: now - RANKED_LIMIT_WINDOW_MS,
		completedRunBefore,
		archivedRuns: completedDeletes.length
	};
	const results = await binding.batch([
		binding.prepare('DELETE FROM support_limit WHERE expires_at <= ?').bind(now),
		binding.prepare('DELETE FROM anonymous_event WHERE created_at < ?').bind(now - 7 * 86_400_000),
		binding.prepare('DELETE FROM admin_web_limit WHERE expires_at <= ?').bind(now),
		binding
			.prepare('DELETE FROM admin_web_session WHERE expires_at <= ? OR last_seen <= ?')
			.bind(now, now - 10 * 60_000),
		binding.prepare('DELETE FROM session WHERE expires_at <= ?').bind(now),
		binding.prepare('DELETE FROM verification WHERE expires_at <= ?').bind(now),
		binding
			.prepare('DELETE FROM rate_limit WHERE last_request < ?')
			.bind(criteria.authLimiterBefore),
		binding
			.prepare("UPDATE play_session SET ip_hash = '' WHERE created_at <= ? AND ip_hash != ''")
			.bind(criteria.rankedAddressBefore),
		// Preserve unresolved claims and today's spent daily attempts. Removing
		// a daily tombstone would allow its deterministic session to be reissued.
		binding
			.prepare(
				`DELETE FROM play_session WHERE expires_at <= ? AND
				(payload_hash IS NULL OR EXISTS (SELECT 1 FROM completed_run r
				WHERE r.id = play_session.id AND r.user_id = play_session.user_id
				AND r.payload_hash = play_session.payload_hash))
				AND NOT EXISTS (SELECT 1 FROM daily_puzzle p WHERE p.date = ?
				AND p.family = play_session.family AND p.seed = play_session.seed
				AND p.variant = COALESCE(play_session.variant,''))`
			)
			.bind(now, new Date(now).toISOString().slice(0, 10)),
		...completedDeletes,
		binding
			.prepare(
				`INSERT INTO admin_audit
				(id,actor,action,target,reason,before,after,created_at)
				VALUES (?,?, 'prune-expired','operational-records',?,NULL,?,?)`
			)
			.bind(
				crypto.randomUUID(),
				actor,
				'Expired operational records; unresolved ranked claims and audit records preserved',
				JSON.stringify(criteria),
				now
			)
	]);
	return results.slice(0, -1).map((result) => result.meta.changes);
}

/** A verified request is decided by the operator before this local-only action. */
export async function deleteAccountForPrivacy(
	binding: D1Database,
	actor: string,
	userId: string,
	requestReference: string
) {
	await requireAdmin(binding, actor);
	// Store an opaque case reference, never the request email, age, or evidence.
	if (!/^[A-Za-z0-9_-]{3,64}$/.test(requestReference)) throw new RunError('request_reference');
	const db = createDatabase(binding);
	if (!(await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).get()))
		throw new RunError('missing', 404);
	await db.batch([
		db.delete(user).where(eq(user.id, userId)),
		db.insert(adminAudit).values({
			id: crypto.randomUUID(),
			actor,
			action: 'privacy-delete',
			target: userId,
			reason: requestReference,
			before: null,
			after: null,
			createdAt: Date.now()
		})
	]);
}
