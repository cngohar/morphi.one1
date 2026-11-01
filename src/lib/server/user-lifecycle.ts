import { RunError } from './runs.js';

const DAY_MS = 86_400_000;

function validateReason(reason: string) {
	if (
		typeof reason !== 'string' ||
		reason.trim().length < 3 ||
		reason.length > 240 ||
		/[\r\n@]/.test(reason)
	)
		throw new RunError('reason');
	return reason.trim();
}

async function requireAdmin(binding: D1Database, actor: string) {
	if (
		!(await binding
			.prepare("SELECT id FROM admin_actor WHERE id=? AND role='admin'")
			.bind(actor)
			.first())
	)
		throw new RunError('permission', 403);
}

/** Checks whether a user may start or save a new game. */
export async function accountIsActive(binding: D1Database, userId: string, now = Date.now()) {
	return Boolean(
		await binding
			.prepare(
				`SELECT id FROM user WHERE id=?
		AND NOT EXISTS(SELECT 1 FROM user_lifecycle WHERE user_id=user.id)
		AND NOT EXISTS(SELECT 1 FROM player_ban WHERE user_id=user.id AND (expires_at IS NULL OR expires_at>?))`
			)
			.bind(userId, now)
			.first()
	);
}

export async function assertAccountActive(binding: D1Database, userId: string, now = Date.now()) {
	if (!(await accountIsActive(binding, userId, now))) throw new RunError('unavailable', 403);
}

export async function softDeleteUser(
	binding: D1Database,
	actor: string,
	userId: string,
	reason: string,
	days = 7,
	now = Date.now()
) {
	await requireAdmin(binding, actor);
	reason = validateReason(reason);
	if (!Number.isSafeInteger(days) || days < 1 || days > 365 || !Number.isSafeInteger(now))
		throw new RunError('restoration_period');
	const operation = crypto.randomUUID();
	const restoreUntil = now + days * DAY_MS;
	const results = await binding.batch([
		binding
			.prepare(
				`INSERT INTO user_lifecycle(user_id,deleted_at,restore_until,operation_id)
			SELECT id,?,?,? FROM user WHERE id=?
			AND EXISTS(SELECT 1 FROM admin_actor WHERE id=? AND role='admin')
			AND NOT EXISTS(SELECT 1 FROM admin_web_operator WHERE user_id=user.id)
			ON CONFLICT(user_id) DO NOTHING`
			)
			.bind(now, restoreUntil, operation, userId, actor),
		binding
			.prepare(
				`DELETE FROM session WHERE user_id=?
			AND EXISTS(SELECT 1 FROM user_lifecycle WHERE user_id=? AND operation_id=?)`
			)
			.bind(userId, userId, operation),
		binding
			.prepare(
				`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
			SELECT ?,?,'user-soft-delete',user_id,?,NULL,?,? FROM user_lifecycle WHERE user_id=? AND operation_id=?`
			)
			.bind(
				operation,
				actor,
				reason,
				JSON.stringify({ deletedAt: now, restoreUntil }),
				now,
				userId,
				operation
			)
	]);
	if (!results[0].meta.changes) throw new RunError('user_unavailable', 409);
	return { restoreUntil };
}

export async function restoreDeletedUser(
	binding: D1Database,
	actor: string,
	userId: string,
	reason: string,
	now = Date.now()
) {
	await requireAdmin(binding, actor);
	reason = validateReason(reason);
	const operation = crypto.randomUUID();
	const results = await binding.batch([
		binding
			.prepare(
				`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
			SELECT ?,?,'user-restore',user_id,?,json_object('deletedAt',deleted_at,'restoreUntil',restore_until),NULL,?
			FROM user_lifecycle WHERE user_id=? AND anonymized_at IS NULL AND restore_until>?
			AND EXISTS(SELECT 1 FROM user WHERE id=user_id)
			AND EXISTS(SELECT 1 FROM admin_actor WHERE id=? AND role='admin')`
			)
			.bind(operation, actor, reason, now, userId, now, actor),
		binding
			.prepare(
				`DELETE FROM user_lifecycle WHERE user_id=? AND anonymized_at IS NULL AND restore_until>?
			AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)`
			)
			.bind(userId, now, operation)
	]);
	if (!results[1].meta.changes) throw new RunError('restore_expired_or_unavailable', 409);
}

/** Finalization runs on an app request or explicit maintenance; there is no scheduler. */
export async function anonymizeExpiredUsers(binding: D1Database, now = Date.now()) {
	const results = await binding.batch([
		binding
			.prepare(
				`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
			SELECT lower(hex(randomblob(16))),'system-maintenance','user-anonymized',user_id,
			'Restoration period expired',NULL,NULL,? FROM user_lifecycle
			WHERE anonymized_at IS NULL AND restore_until<=?`
			)
			.bind(now, now),
		binding
			.prepare(
				`DELETE FROM user WHERE id IN
			(SELECT user_id FROM user_lifecycle WHERE anonymized_at IS NULL AND restore_until<=?)`
			)
			.bind(now),
		binding
			.prepare(
				`UPDATE user_lifecycle SET anonymized_at=?
			WHERE anonymized_at IS NULL AND restore_until<=?`
			)
			.bind(now, now)
	]);
	return results[2].meta.changes;
}
