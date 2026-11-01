import { can } from '../operator-permissions.js';
import { auditOperatorRead } from './operator.js';
import { RunError } from './runs.js';

export async function userDirectory(
	db: D1Database,
	actor: { id: string; role: string },
	page: number,
	search = '',
	status = 'all'
) {
	if (!can(actor.role, 'users')) throw new RunError('permission', 403);
	if (
		search.length > 80 ||
		/[\r\n]/.test(search) ||
		!['all', 'active', 'banned', 'deleted'].includes(status)
	)
		throw new RunError('input');
	const rows = (
		await db
			.prepare(
				`SELECT u.id, p.name, u.created_at, (SELECT count(*) FROM completed_run r WHERE r.user_id=u.id) completions,
				EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=u.id AND (b.expires_at IS NULL OR b.expires_at>unixepoch()*1000)) banned,
				EXISTS(SELECT 1 FROM user_lifecycle l WHERE l.user_id=u.id) deleted
				FROM user u LEFT JOIN player p ON p.user_id=u.id
				WHERE (?='' OR instr(lower(coalesce(p.name,'')),lower(?))>0)
				AND (?='all' OR (?='banned' AND EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=u.id AND (b.expires_at IS NULL OR b.expires_at>unixepoch()*1000)))
				OR (?='deleted' AND EXISTS(SELECT 1 FROM user_lifecycle l WHERE l.user_id=u.id))
				OR (?='active' AND NOT EXISTS(SELECT 1 FROM user_lifecycle l WHERE l.user_id=u.id) AND NOT EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=u.id AND (b.expires_at IS NULL OR b.expires_at>unixepoch()*1000))))
				ORDER BY p.normalized_name,u.id LIMIT 26 OFFSET ?`
			)
			.bind(search, search, status, status, status, status, page * 25)
			.all<{
				id: string;
				name: string | null;
				created_at: number;
				completions: number;
				banned: number;
				deleted: number;
			}>()
	).results;
	await auditOperatorRead(db, actor.id, 'users:read', `page-${page}`);
	return { rows: rows.slice(0, 25), more: rows.length > 25 };
}

export async function userOverview(db: D1Database, actor: { role: string }) {
	if (!can(actor.role, 'users')) throw new RunError('permission', 403);
	const totals = await db
		.prepare(
			`SELECT (SELECT count(*) FROM user) users,
		(SELECT count(*) FROM player_ban WHERE expires_at IS NULL OR expires_at>unixepoch()*1000) bans,
		(SELECT count(*) FROM user_lifecycle) deleted,
		(SELECT count(*) FROM completed_run) completions`
		)
		.first<{ users: number; bans: number; deleted: number; completions: number }>();
	const top = await db
		.prepare(
			`SELECT p.name,count(*) completions FROM completed_run r JOIN player p ON p.user_id=r.user_id GROUP BY r.user_id ORDER BY completions DESC,p.normalized_name,r.user_id LIMIT 1`
		)
		.first<{ name: string; completions: number }>();
	return { totals, top };
}

export async function userDetail(
	db: D1Database,
	actor: { id: string; role: string },
	id: string,
	page: number
) {
	if (!can(actor.role, 'users')) throw new RunError('permission', 403);
	const user = await db
		.prepare(
			'SELECT u.id,u.name google_name,u.email,u.created_at,p.name public_name, l.restore_until, b.expires_at ban_expires, CASE WHEN b.user_id IS NOT NULL AND (b.expires_at IS NULL OR b.expires_at>?) THEN 1 ELSE 0 END banned FROM user u LEFT JOIN player p ON p.user_id=u.id LEFT JOIN user_lifecycle l ON l.user_id=u.id LEFT JOIN player_ban b ON b.user_id=u.id WHERE u.id=?'
		)
		.bind(Date.now(), id)
		.first<{
			id: string;
			google_name: string;
			email: string;
			created_at: number;
			public_name: string | null;
			restore_until: number | null;
			ban_expires: number | null;
			banned: number;
		}>();
	if (!user) throw new RunError('missing', 404);
	const stats = (
		await db
			.prepare(
				'SELECT family,rules_group,score_config_version,count(*) completions,max(score) best,avg(score) average,sum(ranked) ranked,sum(CASE WHEN ranked=0 THEN 1 ELSE 0 END) solo,sum(hidden) hidden,max(created_at) last_saved FROM completed_run WHERE user_id=? GROUP BY family,rules_group,score_config_version ORDER BY family,rules_group,score_config_version'
			)
			.bind(id)
			.all<{
				family: string;
				rules_group: string;
				score_config_version: string;
				completions: number;
				best: number;
				average: number;
				ranked: number;
				solo: number;
				hidden: number;
				last_saved: number;
			}>()
	).results;
	const activity = (
		await db
			.prepare(
				"SELECT strftime('%Y-%m-%d',created_at/1000,'unixepoch') day,count(*) total FROM completed_run WHERE user_id=? GROUP BY day ORDER BY day DESC LIMIT 26 OFFSET ?"
			)
			.bind(id, page * 25)
			.all<{ day: string; total: number }>()
	).results;
	const moderation = (
		await db
			.prepare(
				"SELECT id,action,reason,created_at FROM admin_audit WHERE target=? AND action IN ('ban','unban','undo-ban','undo-unban','warning') ORDER BY created_at DESC,id LIMIT 26 OFFSET ?"
			)
			.bind(id, page * 25)
			.all<{ id: string; action: string; reason: string; created_at: number }>()
	).results;
	const rounds = (
		await db
			.prepare(
				'SELECT id,family,score,hidden,created_at FROM completed_run WHERE user_id=? ORDER BY created_at DESC,id LIMIT 26 OFFSET ?'
			)
			.bind(id, page * 25)
			.all<{ id: string; family: string; score: number; hidden: number; created_at: number }>()
	).results;
	const tracking = await db
		.prepare('SELECT tracking_since,last_activity_at FROM account_activity WHERE user_id=?')
		.bind(id)
		.first<{ tracking_since: number; last_activity_at: number }>();
	const tracked = (
		await db
			.prepare(
				'SELECT family,count(*) starts,sum(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) completed,sum(CASE WHEN abandoned_at IS NOT NULL AND completed_at IS NULL THEN 1 ELSE 0 END) abandoned FROM account_round_activity WHERE user_id=? GROUP BY family ORDER BY family'
			)
			.bind(id)
			.all<{ family: string; starts: number; completed: number; abandoned: number }>()
	).results;
	await auditOperatorRead(db, actor.id, 'user-detail:read', id);
	return {
		user,
		stats,
		activity: activity.slice(0, 25),
		moderation: moderation.slice(0, 25),
		rounds: rounds.slice(0, 25),
		more: activity.length > 25 || moderation.length > 25 || rounds.length > 25,
		tracking,
		tracked
	};
}
