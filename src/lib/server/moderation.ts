import { RunError } from './runs.js';
import { validatePlayerName } from './players.js';
export type ModerationAction = 'ban' | 'unban' | 'hide' | 'restore' | 'ranked-on' | 'ranked-off';

async function requireModerator(db: D1Database, actor: string, admin = false) {
	const row = await db
		.prepare('SELECT role FROM admin_actor WHERE id=?')
		.bind(actor)
		.first<{ role: string }>();
	if (!row || !(admin ? ['admin'] : ['admin', 'moderator']).includes(row.role))
		throw new RunError('permission', 403);
}
function validReason(reason: string) {
	if (
		typeof reason !== 'string' ||
		reason.trim().length < 3 ||
		reason.length > 240 ||
		/[\r\n@]/.test(reason)
	)
		throw new RunError('reason');
	return reason.trim();
}
function validTarget(target: string) {
	if (typeof target !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(target))
		throw new RunError('input');
}
// The capture and mutation share one D1 transaction; no external read becomes the audit's before-state.
async function apply(
	db: D1Database,
	capture: D1PreparedStatement,
	changes: D1PreparedStatement[],
	conflict = 'missing'
) {
	const results = await db.batch([capture, ...changes]);
	if (results[0]!.meta.changes !== 1)
		throw new RunError(conflict, conflict === 'missing' ? 404 : 409);
}
export async function moderate(
	db: D1Database,
	actor: string,
	action: ModerationAction,
	target: string,
	reason: string,
	expiresAt: number | null = null
) {
	await requireModerator(db, actor, action.startsWith('ranked-'));
	reason = validReason(reason);
	validTarget(target);
	const id = crypto.randomUUID(),
		now = Date.now();
	if (
		expiresAt !== null &&
		(action !== 'ban' || !Number.isSafeInteger(expiresAt) || expiresAt <= now)
	)
		throw new RunError('input');
	if (action === 'ban' || action === 'unban') {
		const after =
			action === 'ban'
				? JSON.stringify({ userId: target, reason, createdAt: now, expiresAt })
				: 'null';
		await apply(
			db,
			db
				.prepare(
					`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
			SELECT ?,?,?,?,?,coalesce((SELECT json_object('userId',user_id,'reason',reason,'createdAt',created_at,'expiresAt',expires_at) FROM player_ban WHERE user_id=?),'null'),?,?
			FROM user WHERE id=? AND NOT EXISTS(SELECT 1 FROM user_lifecycle WHERE user_id=user.id)`
				)
				.bind(id, actor, action, target, reason, target, after, now, target),
			[
				action === 'ban'
					? db
							.prepare(
								`INSERT INTO player_ban(user_id,reason,created_at,expires_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_audit WHERE id=?)
				ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,created_at=excluded.created_at,expires_at=excluded.expires_at`
							)
							.bind(target, reason, now, expiresAt, id)
					: db
							.prepare(
								'DELETE FROM player_ban WHERE user_id=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)'
							)
							.bind(target, id)
			]
		);
	} else if (action === 'hide' || action === 'restore') {
		await apply(
			db,
			db
				.prepare(
					`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
			SELECT ?,?,?,?,?,json_object('hidden',json(CASE WHEN hidden THEN 'true' ELSE 'false' END)),?,? FROM completed_run WHERE id=?`
				)
				.bind(
					id,
					actor,
					action,
					target,
					reason,
					JSON.stringify({ hidden: action === 'hide' }),
					now,
					target
				),
			[
				db
					.prepare(
						'UPDATE completed_run SET hidden=? WHERE id=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)'
					)
					.bind(action === 'hide' ? 1 : 0, target, id)
			]
		);
	} else if (action === 'ranked-on' || action === 'ranked-off') {
		if (target !== 'ranked') throw new RunError('input');
		await apply(
			db,
			db
				.prepare(
					`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
			SELECT ?,?,?,?,?,coalesce((SELECT json_object('key',key,'enabled',json(CASE WHEN enabled THEN 'true' ELSE 'false' END)) FROM site_control WHERE key='ranked'),'null'),?,?`
				)
				.bind(
					id,
					actor,
					action,
					target,
					reason,
					JSON.stringify({ key: 'ranked', enabled: action === 'ranked-on' }),
					now
				),
			[
				db
					.prepare(
						`INSERT INTO site_control(key,enabled) SELECT 'ranked',? WHERE EXISTS(SELECT 1 FROM admin_audit WHERE id=?) ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled`
					)
					.bind(action === 'ranked-on' ? 1 : 0, id)
			]
		);
	} else throw new RunError('action');
	return { id };
}

export async function renamePlayerByOperator(
	db: D1Database,
	actor: string,
	target: string,
	input: unknown,
	reason: string
) {
	await requireModerator(db, actor);
	reason = validReason(reason);
	validTarget(target);
	const name = validatePlayerName(input);
	if (!name) throw new RunError('input');
	const id = crypto.randomUUID(),
		now = Date.now();
	try {
		await apply(
			db,
			db
				.prepare(
					`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
			SELECT ?,?,'rename',user_id,?,json_object('name',name),?,? FROM player WHERE normalized_name=? AND NOT EXISTS(SELECT 1 FROM user_lifecycle WHERE user_id=player.user_id)`
				)
				.bind(id, actor, reason, JSON.stringify({ name }), now, target.toLowerCase()),
			[
				db
					.prepare(
						'UPDATE player SET name=?,normalized_name=?,updated_at=? WHERE user_id=(SELECT target FROM admin_audit WHERE id=?)'
					)
					.bind(name, name.toLowerCase(), now, id)
			]
		);
	} catch (e) {
		if (String(e).includes('UNIQUE constraint failed')) throw new RunError('taken', 409);
		throw e;
	}
}
export async function addModerationCase(
	db: D1Database,
	actor: string,
	id: string,
	kind: string,
	target: string,
	reason: string
) {
	await requireModerator(db, actor);
	reason = validReason(reason);
	validTarget(target);
	if (!/^CASE-[A-Za-z0-9_-]{3,55}$/.test(id) || !['username', 'score'].includes(kind))
		throw new RunError('input');
	const auditId = crypto.randomUUID(),
		now = Date.now();
	try {
		await db.batch([
			db
				.prepare(
					"INSERT INTO moderation_case(id,kind,target,state,created_at) VALUES(?,?,?,'open',?)"
				)
				.bind(id, kind, target, now),
			db
				.prepare(
					`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) SELECT ?,?,'case-add',id,?,'null',json_object('kind',kind,'target',target,'state',state),? FROM moderation_case WHERE id=?`
				)
				.bind(auditId, actor, reason, now, id)
		]);
	} catch (e) {
		if (String(e).includes('UNIQUE constraint failed')) throw new RunError('case_conflict', 409);
		throw e;
	}
}
export async function resolveModerationCase(
	db: D1Database,
	actor: string,
	id: string,
	reason: string
) {
	await requireModerator(db, actor);
	reason = validReason(reason);
	validTarget(id);
	const auditId = crypto.randomUUID();
	await apply(
		db,
		db
			.prepare(
				`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
		SELECT ?,?,'case-resolve',id,?,json_object('kind',kind,'target',target,'state',state),json_object('kind',kind,'target',target,'state','resolved'),? FROM moderation_case WHERE id=? AND state='open'`
			)
			.bind(auditId, actor, reason, Date.now(), id),
		[
			db
				.prepare(
					"UPDATE moderation_case SET state='resolved' WHERE id=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)"
				)
				.bind(id, auditId)
		],
		'case_conflict'
	);
}

export async function undoModeration(
	db: D1Database,
	actor: string,
	auditId: string,
	reason: string
) {
	await requireModerator(db, actor);
	reason = validReason(reason);
	validTarget(auditId);
	const source = await db
		.prepare('SELECT action FROM admin_audit WHERE id=?')
		.bind(auditId)
		.first<{ action: string }>();
	if (!source) throw new RunError('missing', 404);
	const ban = ['ban', 'unban'].includes(source.action);
	if (!ban && !['hide', 'restore'].includes(source.action))
		throw new RunError('undo_unavailable', 409);
	const id = crypto.randomUUID(),
		now = Date.now();
	const group = ban
		? "'ban','unban','undo-ban','undo-unban'"
		: "'hide','restore','undo-hide','undo-restore'";
	const currentMatches = ban
		? `EXISTS(SELECT 1 FROM user WHERE id=s.target AND NOT EXISTS(SELECT 1 FROM user_lifecycle WHERE user_id=user.id)) AND
		((json_type(s.after)='null' AND NOT EXISTS(SELECT 1 FROM player_ban WHERE user_id=s.target)) OR
		EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=s.target AND b.reason IS json_extract(s.after,'$.reason') AND b.created_at IS json_extract(s.after,'$.createdAt') AND b.expires_at IS json_extract(s.after,'$.expiresAt')))`
		: `EXISTS(SELECT 1 FROM completed_run r WHERE r.id=s.target AND r.hidden IS json_extract(s.after,'$.hidden'))`;
	const capture = db
		.prepare(
			`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
		SELECT ?,?,'undo-'||s.action,s.target,?,s.after,
		CASE WHEN s.action='unban' AND json_type(s.before)='object'
		THEN json_object('userId',s.target,'reason',?,'createdAt',?,'expiresAt',NULL) ELSE s.before END,?
		FROM admin_audit s WHERE s.id=? AND ${currentMatches}
		AND NOT EXISTS(SELECT 1 FROM admin_audit n WHERE n.target=s.target AND n.action IN (${group}) AND n.rowid>s.rowid)`
		)
		.bind(id, actor, reason, reason, now, now, auditId);
	const changes = ban
		? [
				db
					.prepare(
						'DELETE FROM player_ban WHERE user_id=(SELECT target FROM admin_audit WHERE id=?)'
					)
					.bind(id),
				db
					.prepare(
						`INSERT INTO player_ban(user_id,reason,created_at,expires_at) SELECT target,json_extract(after,'$.reason'),json_extract(after,'$.createdAt'),json_extract(after,'$.expiresAt') FROM admin_audit WHERE id=? AND json_type(after)='object'`
					)
					.bind(id)
			]
		: [
				db
					.prepare(
						"UPDATE completed_run SET hidden=(SELECT json_extract(after,'$.hidden') FROM admin_audit WHERE id=?) WHERE id=(SELECT target FROM admin_audit WHERE id=?)"
					)
					.bind(id, id)
			];
	await apply(db, capture, changes, 'undo_conflict');
	return { id };
}
