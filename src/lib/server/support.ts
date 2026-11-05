import { can } from '../operator-permissions.js';
import { auditOperatorRead } from './operator.js';
import { digest, RunError } from './runs.js';

export type SupportActor = { userId: string; staff?: boolean };
export type SupportTaxonomyKind = 'category' | 'priority';
export type SupportTaxonomyEntry = { id: string; name: string; isDefault: boolean };
export type SupportTicket = {
	id: string;
	userId: string;
	subject: string;
	categoryId: string;
	priorityId: string;
	categoryName: string;
	priorityName: string;
	state: 'open' | 'closed';
	createdAt: number;
	updatedAt: number;
	unread: boolean;
};
export type SupportMessage = {
	id: string;
	sequence: number;
	ticketId: string;
	authorKind: 'member' | 'staff';
	body: string;
	createdAt: number;
};
export const SUPPORT_PAGE_SIZE = 20;
export const SUPPORT_LIMITS = { subject: 120, message: 4000, taxonomy: 60 } as const;
export class SupportError extends RunError {
	constructor(
		code: string,
		status = 400,
		public retryAfter?: number
	) {
		super(code, status);
	}
}
type Value = string | number | null;
type Condition = { sql: string; values: Value[] };
const activeMember = `EXISTS(SELECT 1 FROM user WHERE id=? AND NOT EXISTS
	(SELECT 1 FROM user_lifecycle WHERE user_id=user.id))`;
const claimed = 'EXISTS(SELECT 1 FROM support_receipt WHERE nonce=?)';
const ticketColumns = `t.id,t.user_id AS userId,t.subject,t.category_id AS categoryId,
	t.priority_id AS priorityId,c.name AS categoryName,p.name AS priorityName,t.state,
	t.created_at AS createdAt,t.updated_at AS updatedAt,
	(t.last_staff_sequence>t.member_read_sequence) AS unread`;
const ticketJoin =
	'support_ticket t JOIN support_category c ON c.id=t.category_id JOIN support_priority p ON p.id=t.priority_id';

export async function assertSupportMember(db: D1Database, userId: string) {
	if (!(await db.prepare(`SELECT 1 WHERE ${activeMember}`).bind(userId).first()))
		throw new SupportError('support_unavailable', 403);
}
async function assertActor(db: D1Database, actor: SupportActor, taxonomy = false) {
	await assertSupportMember(db, actor.userId);
	if (taxonomy || actor.staff) {
		const role = await db
			.prepare('SELECT role FROM admin_actor WHERE id=?')
			.bind(actor.userId)
			.first<{ role: string }>();
		if (!actor.staff || !role || !can(role.role, taxonomy ? 'support-taxonomy' : 'support-tickets'))
			throw new SupportError('permission', 403);
	}
}
function text(value: string, max: number, code: string) {
	// Match the browser's maxlength: trimmed UTF-16 code units, including surrogate pairs.
	if (
		typeof value !== 'string' ||
		!value.trim() ||
		value.trim().length > max ||
		value.includes('\0')
	)
		throw new SupportError(code);
	return value.trim();
}
function identifier(value: string) {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value))
		throw new SupportError('support_identifier');
	return value;
}
function pagination(page: number) {
	if (!Number.isSafeInteger(page) || page < 1 || page > 100_000)
		throw new SupportError('support_page');
	return (page - 1) * SUPPORT_PAGE_SIZE;
}
function taxonomyTable(kind: SupportTaxonomyKind) {
	if (kind !== 'category' && kind !== 'priority') throw new SupportError('support_taxonomy');
	return kind === 'category' ? 'support_category' : 'support_priority';
}
function ticketCondition(actor: SupportActor, id: string, open = false): Condition {
	identifier(id);
	return {
		sql: `EXISTS(SELECT 1 FROM support_ticket WHERE id=? ${actor.staff ? '' : 'AND user_id=?'} ${open ? "AND state='open'" : ''})`,
		values: actor.staff ? [id] : [id, actor.userId]
	};
}
async function checkedTicket(db: D1Database, actor: SupportActor, id: string, open = false) {
	const condition = ticketCondition(actor, id);
	if (
		!(await db
			.prepare(`SELECT 1 WHERE ${condition.sql}`)
			.bind(...condition.values)
			.first())
	)
		throw new SupportError('support_missing', 404);
	if (
		open &&
		!(await db.prepare("SELECT 1 FROM support_ticket WHERE id=? AND state='open'").bind(id).first())
	)
		throw new SupportError('support_closed', 409);
}
async function checkedChoices(db: D1Database, categoryId: string, priorityId: string) {
	identifier(categoryId);
	identifier(priorityId);
	if (
		!(await db
			.prepare('SELECT 1 FROM support_category c,support_priority p WHERE c.id=? AND p.id=?')
			.bind(categoryId, priorityId)
			.first())
	)
		throw new SupportError('support_choice', 409);
}
const choicesCondition = (categoryId: string, priorityId: string): Condition => ({
	sql: 'EXISTS(SELECT 1 FROM support_category c,support_priority p WHERE c.id=? AND p.id=?)',
	values: [categoryId, priorityId]
});

type Quota = { kind: string; count: number; window: number };
const creationQuota = { kind: 'create', count: 3, window: 3_600_000 };
const replyQuota = (actor: SupportActor): Quota =>
	actor.staff
		? { kind: 'staff-reply', count: 30, window: 60_000 }
		: { kind: 'member-reply', count: 10, window: 600_000 };
async function checkQuota(db: D1Database, actor: SupportActor, quota: Quota, now: number) {
	const times = await db
		.prepare(
			'SELECT created_at FROM support_limit WHERE user_id=? AND kind=? AND created_at>? ORDER BY created_at DESC LIMIT ?'
		)
		.bind(actor.userId, quota.kind, now - quota.window, quota.count)
		.all<{ created_at: number }>();
	if (times.results.length >= quota.count)
		throw new SupportError(
			'support_limit',
			429,
			Math.max(1, Math.ceil((times.results.at(-1)!.created_at + quota.window - now) / 1000))
		);
}

/** The conditional claim, all writes and their audit share one D1 transaction. */
async function commit(
	db: D1Database,
	actor: SupportActor,
	requestId: string,
	payload: unknown,
	resultId: string,
	ticketId: string | null,
	conditions: Condition[],
	writes: (nonce: string) => D1PreparedStatement[],
	diagnose: () => Promise<void>,
	options: { taxonomy?: boolean; quota?: Quota; now?: number } = {}
) {
	const now = options.now ?? Date.now();
	await assertActor(db, actor, options.taxonomy);
	if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId))
		throw new SupportError('support_request');
	const payloadHash = await digest(JSON.stringify(payload));
	const previous = () =>
		db
			.prepare(
				'SELECT payload_hash,result_id FROM support_receipt WHERE user_id=? AND request_id=?'
			)
			.bind(actor.userId, requestId)
			.first<{ payload_hash: string; result_id: string }>();
	const replay = (row: { payload_hash: string; result_id: string }) => {
		if (row.payload_hash !== payloadHash) throw new SupportError('support_request_conflict', 409);
		return row.result_id;
	};
	const old = await previous();
	if (old) return replay(old);
	const nonce = crypto.randomUUID();
	const guards: Condition[] = [{ sql: activeMember, values: [actor.userId] }, ...conditions];
	if (actor.staff)
		guards.push({
			sql: `EXISTS(SELECT 1 FROM admin_actor WHERE id=? AND role IN (${options.taxonomy ? "'admin'" : "'admin','moderator'"}))`,
			values: [actor.userId]
		});
	if (options.quota)
		guards.push({
			sql: '(SELECT count(*) FROM support_limit WHERE user_id=? AND kind=? AND created_at>?)<?',
			values: [actor.userId, options.quota.kind, now - options.quota.window, options.quota.count]
		});
	const statements = [
		db
			.prepare('DELETE FROM support_limit WHERE user_id=? AND expires_at<=?')
			.bind(actor.userId, now),
		db
			.prepare(
				`INSERT INTO support_receipt(nonce,user_id,request_id,payload_hash,ticket_id,result_id,created_at)
			SELECT ?,?,?,?,?,?,? WHERE ${guards.map((g) => `(${g.sql})`).join(' AND ')}
			ON CONFLICT(user_id,request_id) DO NOTHING`
			)
			.bind(
				nonce,
				actor.userId,
				requestId,
				payloadHash,
				ticketId,
				resultId,
				now,
				...guards.flatMap((g) => g.values)
			),
		...writes(nonce)
	];
	if (options.quota)
		statements.push(
			db
				.prepare(
					`INSERT INTO support_limit(nonce,user_id,kind,created_at,expires_at)
		SELECT ?,?,?,?,? WHERE ${claimed}`
				)
				.bind(nonce, actor.userId, options.quota.kind, now, now + options.quota.window, nonce)
		);
	await db.batch(statements);
	const saved = await previous();
	if (saved) return replay(saved);
	await assertActor(db, actor, options.taxonomy);
	await diagnose();
	if (options.quota) await checkQuota(db, actor, options.quota, now);
	throw new SupportError('support_conflict', 409);
}
function staffAudit(
	db: D1Database,
	actor: SupportActor,
	action: string,
	target: string,
	nonce: string,
	now: number
) {
	return actor.staff
		? [
				db
					.prepare(
						`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
		SELECT ?,?,?,?,'Support action',NULL,NULL,? WHERE ${claimed}`
					)
					.bind(nonce, actor.userId, action, target, now, nonce)
			]
		: [];
}

export async function supportTaxonomy(db: D1Database, actor: SupportActor) {
	await assertActor(db, actor);
	const results = await db.batch<{ id: string; name: string; isDefault: number }>([
		db.prepare(
			'SELECT id,name,is_default AS isDefault FROM support_category ORDER BY is_default DESC,normalized_name,id'
		),
		db.prepare(
			'SELECT id,name,is_default AS isDefault FROM support_priority ORDER BY is_default DESC,normalized_name,id'
		)
	]);
	const entries = (rows: Record<string, unknown>[]) =>
		rows.map((row) => ({
			id: String(row.id),
			name: String(row.name),
			isDefault: Boolean(row.isDefault)
		}));
	if (actor.staff)
		await auditOperatorRead(db, actor.userId, 'support-taxonomy-read', 'support-taxonomy');
	return { categories: entries(results[0]!.results), priorities: entries(results[1]!.results) };
}
export async function listSupportTickets(db: D1Database, actor: SupportActor, page = 1) {
	await assertActor(db, actor);
	const offset = pagination(page);
	const rows = await db
		.prepare(
			`SELECT ${ticketColumns} FROM ${ticketJoin} ${actor.staff ? '' : 'WHERE t.user_id=?'} ORDER BY t.updated_at DESC,t.id DESC LIMIT ? OFFSET ?`
		)
		.bind(...(actor.staff ? [] : [actor.userId]), SUPPORT_PAGE_SIZE + 1, offset)
		.all<SupportTicket>();
	if (actor.staff) await auditOperatorRead(db, actor.userId, 'support-list', 'support-inbox');
	return {
		tickets: rows.results
			.slice(0, SUPPORT_PAGE_SIZE)
			.map((t) => ({ ...t, unread: Boolean(t.unread) })),
		page,
		hasMore: rows.results.length > SUPPORT_PAGE_SIZE
	};
}
export async function readSupportTicket(
	db: D1Database,
	actor: SupportActor,
	ticketId: string,
	page = 1
) {
	await assertActor(db, actor);
	await checkedTicket(db, actor, ticketId);
	const offset = pagination(page);
	const results = await db.batch([
		db.prepare(`SELECT ${ticketColumns} FROM ${ticketJoin} WHERE t.id=?`).bind(ticketId),
		db
			.prepare(
				'SELECT id,sequence,ticket_id AS ticketId,author_kind AS authorKind,body,created_at AS createdAt FROM support_message WHERE ticket_id=? ORDER BY sequence LIMIT ? OFFSET ?'
			)
			.bind(ticketId, SUPPORT_PAGE_SIZE + 1, offset),
		...(actor.staff
			? [
					db
						.prepare(
							`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'support-read',?,'Operator review',NULL,NULL,?)`
						)
						.bind(crypto.randomUUID(), actor.userId, ticketId, Date.now())
				]
			: [
					db
						.prepare(
							`UPDATE support_ticket SET member_read_sequence=max(member_read_sequence,coalesce((SELECT max(sequence) FROM
				(SELECT sequence FROM support_message WHERE ticket_id=? ORDER BY sequence LIMIT ? OFFSET ?)),0)) WHERE id=? AND user_id=?`
						)
						.bind(ticketId, SUPPORT_PAGE_SIZE, offset, ticketId, actor.userId)
				])
	]);
	const ticket = results[0]!.results[0] as SupportTicket | undefined;
	if (!ticket) throw new SupportError('support_missing', 404);
	const messages = results[1]!.results as SupportMessage[];
	const readState = await db
		.prepare(
			'SELECT last_staff_sequence>member_read_sequence AS unread FROM support_ticket WHERE id=?'
		)
		.bind(ticketId)
		.first<{ unread: number }>();
	return {
		ticket: { ...ticket, unread: Boolean(readState?.unread) },
		messages: messages.slice(0, SUPPORT_PAGE_SIZE),
		page,
		hasMore: messages.length > SUPPORT_PAGE_SIZE
	};
}
export async function supportUnreadCount(db: D1Database, userId: string) {
	await assertSupportMember(db, userId);
	return (await db
		.prepare(
			'SELECT count(*) AS count FROM support_ticket WHERE user_id=? AND last_staff_sequence>member_read_sequence'
		)
		.bind(userId)
		.first<{ count: number }>())!.count;
}

export async function createSupportTicket(
	db: D1Database,
	userId: string,
	input: {
		requestId: string;
		subject: string;
		categoryId: string;
		priorityId: string;
		message: string;
	}
) {
	const actor = { userId };
	const subject = text(input.subject, SUPPORT_LIMITS.subject, 'support_subject');
	const message = text(input.message, SUPPORT_LIMITS.message, 'support_message');
	identifier(input.categoryId);
	identifier(input.priorityId);
	const id = crypto.randomUUID(),
		now = Date.now();
	const result = await commit(
		db,
		actor,
		input.requestId,
		['create', subject, input.categoryId, input.priorityId, message],
		id,
		null,
		[
			choicesCondition(input.categoryId, input.priorityId),
			{
				sql: "(SELECT count(*) FROM support_ticket WHERE user_id=? AND state='open')<5",
				values: [userId]
			}
		],
		(nonce) => [
			db
				.prepare(
					`INSERT INTO support_ticket(id,user_id,subject,category_id,priority_id,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${claimed}`
				)
				.bind(id, userId, subject, input.categoryId, input.priorityId, now, now, nonce),
			db
				.prepare(
					`INSERT INTO support_message(id,ticket_id,author_kind,body,created_at) SELECT ?,?,'member',?,? WHERE ${claimed}`
				)
				.bind(crypto.randomUUID(), id, message, now, nonce),
			db.prepare('UPDATE support_receipt SET ticket_id=? WHERE nonce=?').bind(id, nonce)
		],
		async () => {
			await checkedChoices(db, input.categoryId, input.priorityId);
			const count = await db
				.prepare("SELECT count(*) AS count FROM support_ticket WHERE user_id=? AND state='open'")
				.bind(userId)
				.first<{ count: number }>();
			if (count!.count >= 5) throw new SupportError('support_open_limit', 429);
		},
		{ quota: creationQuota, now }
	);
	return { ticketId: result };
}
export async function replySupportTicket(
	db: D1Database,
	actor: SupportActor,
	ticketId: string,
	input: { requestId: string; message: string; close?: boolean }
) {
	const message = text(input.message, SUPPORT_LIMITS.message, 'support_message');
	if (input.close !== undefined && typeof input.close !== 'boolean')
		throw new SupportError('support_action');
	if (input.close && !actor.staff) throw new SupportError('permission', 403);
	const now = Date.now(),
		messageId = crypto.randomUUID();
	const result = await commit(
		db,
		actor,
		input.requestId,
		['reply', ticketId, message, Boolean(input.close), Boolean(actor.staff)],
		ticketId,
		ticketId,
		[ticketCondition(actor, ticketId, true)],
		(nonce) => [
			db
				.prepare(
					`INSERT INTO support_message(id,ticket_id,author_kind,body,created_at) SELECT ?,?,?,?,? WHERE ${claimed}`
				)
				.bind(messageId, ticketId, actor.staff ? 'staff' : 'member', message, now, nonce),
			db
				.prepare(
					`UPDATE support_ticket SET updated_at=?,state=?,last_staff_sequence=${actor.staff ? '(SELECT sequence FROM support_message WHERE id=?)' : 'last_staff_sequence'} WHERE id=? AND ${claimed}`
				)
				.bind(
					now,
					input.close ? 'closed' : 'open',
					...(actor.staff ? [messageId] : []),
					ticketId,
					nonce
				),
			...staffAudit(
				db,
				actor,
				input.close ? 'support-reply-close' : 'support-reply',
				ticketId,
				nonce,
				now
			)
		],
		() => checkedTicket(db, actor, ticketId, true),
		{ quota: replyQuota(actor), now }
	);
	return { ticketId: result };
}
export async function closeSupportTicket(
	db: D1Database,
	actor: SupportActor,
	ticketId: string,
	requestId: string
) {
	const now = Date.now();
	const result = await commit(
		db,
		actor,
		requestId,
		['close', ticketId, Boolean(actor.staff)],
		ticketId,
		ticketId,
		[ticketCondition(actor, ticketId)],
		(nonce) => [
			db
				.prepare(`UPDATE support_ticket SET state='closed',updated_at=? WHERE id=? AND ${claimed}`)
				.bind(now, ticketId, nonce),
			...staffAudit(db, actor, 'support-close', ticketId, nonce, now)
		],
		() => checkedTicket(db, actor, ticketId),
		{ now }
	);
	return { ticketId: result };
}
export async function updateSupportTicket(
	db: D1Database,
	actor: SupportActor,
	ticketId: string,
	input: { requestId: string; categoryId: string; priorityId: string }
) {
	if (!actor.staff) throw new SupportError('permission', 403);
	identifier(input.categoryId);
	identifier(input.priorityId);
	const now = Date.now();
	const result = await commit(
		db,
		actor,
		input.requestId,
		['update', ticketId, input.categoryId, input.priorityId],
		ticketId,
		ticketId,
		[ticketCondition(actor, ticketId), choicesCondition(input.categoryId, input.priorityId)],
		(nonce) => [
			db
				.prepare(
					`UPDATE support_ticket SET category_id=?,priority_id=?,updated_at=? WHERE id=? AND ${claimed}`
				)
				.bind(input.categoryId, input.priorityId, now, ticketId, nonce),
			...staffAudit(db, actor, 'support-update', ticketId, nonce, now)
		],
		async () => {
			await checkedTicket(db, actor, ticketId);
			await checkedChoices(db, input.categoryId, input.priorityId);
		},
		{ now }
	);
	return { ticketId: result };
}
export async function saveSupportTaxonomy(
	db: D1Database,
	actor: SupportActor,
	input: { requestId: string; kind: SupportTaxonomyKind; id?: string; name: string }
) {
	const table = taxonomyTable(input.kind),
		name = text(input.name, SUPPORT_LIMITS.taxonomy, 'support_name');
	const normalized = name.normalize('NFKC').toLocaleLowerCase('en-US'),
		id = input.id !== undefined ? identifier(input.id) : crypto.randomUUID(),
		now = Date.now();
	const conditions: Condition[] = [
		{
			sql: `NOT EXISTS(SELECT 1 FROM ${table} WHERE normalized_name=? AND id<>?)`,
			values: [normalized, id]
		}
	];
	if (input.id)
		conditions.push({
			sql: `EXISTS(SELECT 1 FROM ${table} WHERE id=? AND is_default=0)`,
			values: [id]
		});
	const result = await commit(
		db,
		actor,
		input.requestId,
		['taxonomy-save', input.kind, input.id ?? null, name],
		id,
		null,
		conditions,
		(nonce) => [
			input.id
				? db
						.prepare(`UPDATE ${table} SET name=?,normalized_name=? WHERE id=? AND ${claimed}`)
						.bind(name, normalized, id, nonce)
				: db
						.prepare(`INSERT INTO ${table}(id,name,normalized_name) SELECT ?,?,? WHERE ${claimed}`)
						.bind(id, name, normalized, nonce),
			...staffAudit(db, actor, 'support-taxonomy-save', `${input.kind}:${id}`, nonce, now)
		],
		async () => {
			if (input.id) {
				const row = await db
					.prepare(`SELECT is_default FROM ${table} WHERE id=?`)
					.bind(id)
					.first<{ is_default: number }>();
				if (!row) throw new SupportError('support_choice', 409);
				if (row.is_default) throw new SupportError('support_default', 409);
			}
			throw new SupportError('support_name_conflict', 409);
		},
		{ taxonomy: true, now }
	);
	return { id: result };
}
export async function deleteSupportTaxonomy(
	db: D1Database,
	actor: SupportActor,
	input: { requestId: string; kind: SupportTaxonomyKind; id: string }
) {
	const table = taxonomyTable(input.kind),
		id = identifier(input.id),
		now = Date.now();
	const column = input.kind === 'category' ? 'category_id' : 'priority_id';
	const result = await commit(
		db,
		actor,
		input.requestId,
		['taxonomy-delete', input.kind, id],
		id,
		null,
		[{ sql: `EXISTS(SELECT 1 FROM ${table} WHERE id=? AND is_default=0)`, values: [id] }],
		(nonce) => [
			db
				.prepare(
					`UPDATE support_ticket SET ${column}=(SELECT id FROM ${table} WHERE is_default=1) WHERE ${column}=? AND ${claimed}`
				)
				.bind(id, nonce),
			db.prepare(`DELETE FROM ${table} WHERE id=? AND is_default=0 AND ${claimed}`).bind(id, nonce),
			...staffAudit(db, actor, 'support-taxonomy-delete', `${input.kind}:${id}`, nonce, now)
		],
		async () => {
			const row = await db
				.prepare(`SELECT is_default FROM ${table} WHERE id=?`)
				.bind(id)
				.first<{ is_default: number }>();
			throw new SupportError(row?.is_default ? 'support_default' : 'support_choice', 409);
		},
		{ taxonomy: true, now }
	);
	return { id: result };
}
