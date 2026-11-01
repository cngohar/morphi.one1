import { RunError } from './runs.js';
import { auditOperatorRead } from './operator.js';
export interface AuditRow {
	id: string;
	actor: string;
	action: string;
	target: string;
	reason: string;
	before: string | null;
	after: string | null;
	created_at: number;
}
export interface AuditFilters {
	actor?: string;
	action?: string;
	target?: string;
	from?: number;
	to?: number;
	page?: number;
}
async function requireAuditAdmin(db: D1Database, actor: string) {
	if (
		!(await db
			.prepare("SELECT id FROM admin_actor WHERE id=? AND role='admin'")
			.bind(actor)
			.first())
	)
		throw new RunError('permission', 403);
}
const columns = 'id,actor,action,target,reason,before,after,created_at';
/** Exact text filters and UTC millisecond interval [from,to). */
export async function readAudit(db: D1Database, actor: string, filters: AuditFilters = {}) {
	await requireAuditAdmin(db, actor);
	if (
		Object.keys(filters).some(
			(key) => !['actor', 'action', 'target', 'from', 'to', 'page'].includes(key)
		)
	)
		throw new RunError('input');
	const where: string[] = [],
		values: (string | number)[] = [];
	for (const key of ['actor', 'action', 'target'] as const) {
		const value = filters[key];
		if (value === undefined) continue;
		if (typeof value !== 'string' || !value.length || value.length > 100 || /[\r\n]/.test(value))
			throw new RunError('input');
		where.push(`${key}=?`);
		values.push(value);
	}
	for (const key of ['from', 'to'] as const) {
		const value = filters[key];
		if (value === undefined) continue;
		if (!Number.isSafeInteger(value) || value < 0 || value > 8640000000000000)
			throw new RunError('input');
		where.push(`created_at${key === 'from' ? '>=' : '<'}?`);
		values.push(value);
	}
	if (filters.from !== undefined && filters.to !== undefined && filters.from >= filters.to)
		throw new RunError('input');
	const page = filters.page ?? 0;
	if (!Number.isSafeInteger(page) || page < 0 || page > 1000) throw new RunError('input');
	const rows = (
		await db
			.prepare(
				`SELECT ${columns} FROM admin_audit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC,rowid DESC LIMIT 26 OFFSET ?`
			)
			.bind(...values, page * 25)
			.all<AuditRow>()
	).results;
	await auditOperatorRead(db, actor, 'audit:read', `page-${page}`);
	return { rows: rows.slice(0, 25), more: rows.length > 25, page };
}
/** Each cursor freezes the last rowid, so a whole year can be archived without omitted or duplicated rows. */
export async function exportAuditYear(
	db: D1Database,
	actor: string,
	year: number,
	cursor?: string
) {
	await requireAuditAdmin(db, actor);
	if (!Number.isSafeInteger(year) || year < 1970 || year > 9999) throw new RunError('input');
	let through: number,
		after = 0;
	if (cursor !== undefined) {
		if (typeof cursor !== 'string' || !/^\d{4}:\d{1,16}:\d{1,16}$/.test(cursor))
			throw new RunError('input');
		const parts = cursor.split(':').map(Number);
		if (
			parts[0] !== year ||
			!Number.isSafeInteger(parts[1]) ||
			!Number.isSafeInteger(parts[2]) ||
			parts[2]! > parts[1]!
		)
			throw new RunError('input');
		through = parts[1]!;
		after = parts[2]!;
	} else {
		through = (await db
			.prepare('SELECT coalesce(max(rowid),0) last FROM admin_audit')
			.first<{ last: number }>())!.last;
	}
	const limit = 1000;
	const results = (
		await db
			.prepare(
				`SELECT rowid cursor_rowid,${columns} FROM admin_audit WHERE created_at>=? AND created_at<? AND rowid>? AND rowid<=? ORDER BY rowid LIMIT ?`
			)
			.bind(Date.UTC(year, 0, 1), Date.UTC(year + 1, 0, 1), after, through, limit + 1)
			.all<AuditRow & { cursor_rowid: number }>()
	).results;
	const page = results.slice(0, limit);
	const nextCursor =
		results.length > limit ? `${year}:${through}:${page[page.length - 1]!.cursor_rowid}` : null;
	await auditOperatorRead(db, actor, 'audit-export', `${year}:${after}:${through}`);
	return {
		year,
		rows: page.map((row) => ({
			id: row.id,
			actor: row.actor,
			action: row.action,
			target: row.target,
			reason: row.reason,
			before: row.before,
			after: row.after,
			created_at: row.created_at
		})),
		nextCursor,
		limit
	};
}
