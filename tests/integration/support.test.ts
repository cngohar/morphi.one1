import { afterAll, beforeAll, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { readFile, readdir } from 'node:fs/promises';
import { accountIsActive, softDeleteUser } from '../../src/lib/server/user-lifecycle.js';
import { deleteAccountForPrivacy, pruneExpiredRecords } from '../../src/lib/server/retention.js';
import {
	closeSupportTicket,
	createSupportTicket,
	deleteSupportTaxonomy,
	listSupportTickets,
	readSupportTicket,
	replySupportTicket,
	saveSupportTaxonomy,
	supportTaxonomy,
	supportUnreadCount,
	updateSupportTicket,
	type SupportActor
} from '../../src/lib/server/support.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const now = 1_800_000_000_000;
const db = () => proxy.env.DB;
const requestId = () => crypto.randomUUID().replaceAll('-', '');

async function identity(role?: string) {
	const id = crypto.randomUUID();
	await db()
		.prepare(
			'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,?,?)'
		)
		.bind(id, 'Fixture', `${id}@example.test`, now, now)
		.run();
	if (role) await db().prepare('INSERT INTO admin_actor(id,role) VALUES(?,?)').bind(id, role).run();
	return { id, actor: { userId: id } satisfies SupportActor };
}

function create(userId: string, extra: Partial<Parameters<typeof createSupportTicket>[2]> = {}) {
	return createSupportTicket(db(), userId, {
		requestId: requestId(),
		subject: 'Help',
		categoryId: 'general',
		priorityId: 'normal',
		message: 'Please help.',
		...extra
	});
}

async function ageLimits(userId: string, kind: string, window: number) {
	const past = Date.now() - window - 1;
	await db()
		.prepare('UPDATE support_limit SET created_at=?,expires_at=? WHERE user_id=? AND kind=?')
		.bind(past, past, userId, kind)
		.run();
}

beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
		const statements = (await readFile(`migrations/${file}`, 'utf8'))
			.split('--> statement-breakpoint')
			.map((part) => part.trim())
			.filter(Boolean);
		await db().batch(statements.map((sql) => db().prepare(sql)));
	}
});

afterAll(async () => {
	await proxy?.dispose();
});

it('creates, reads, replies, closes, and marks only opened conversation pages read', async () => {
	const member = await identity();
	const moderator = await identity('moderator');
	const { ticketId } = await create(member.id);
	expect((await readSupportTicket(db(), member.actor, ticketId)).ticket).toMatchObject({
		subject: 'Help',
		state: 'open',
		unread: false
	});
	expect(await supportUnreadCount(db(), member.id)).toBe(0);
	for (let i = 0; i < 21; i++)
		await replySupportTicket(db(), { userId: moderator.id, staff: true }, ticketId, {
			requestId: requestId(),
			message: `Staff reply ${i}`
		});
	expect((await listSupportTickets(db(), member.actor)).tickets[0]?.unread).toBe(true);
	expect(await supportUnreadCount(db(), member.id)).toBe(1);
	const first = await readSupportTicket(db(), member.actor, ticketId, 1);
	expect(first.messages).toHaveLength(20);
	expect(first.hasMore).toBe(true);
	expect(first.ticket.unread).toBe(true);
	expect(await supportUnreadCount(db(), member.id)).toBe(1);
	const second = await readSupportTicket(db(), member.actor, ticketId, 2);
	expect(second.messages).toHaveLength(2);
	expect(second.ticket.unread).toBe(false);
	expect(await supportUnreadCount(db(), member.id)).toBe(0);
	await expect(
		replySupportTicket(db(), member.actor, ticketId, {
			requestId: requestId(),
			message: 'Members cannot close in a reply',
			close: true
		})
	).rejects.toMatchObject({ code: 'permission', status: 403 });
	await replySupportTicket(db(), member.actor, ticketId, {
		requestId: requestId(),
		message: 'Thanks, I can reproduce it.'
	});
	await closeSupportTicket(db(), member.actor, ticketId, requestId());
	expect((await readSupportTicket(db(), member.actor, ticketId)).ticket.state).toBe('closed');
	await expect(
		replySupportTicket(db(), member.actor, ticketId, {
			requestId: requestId(),
			message: 'One more thing'
		})
	).rejects.toMatchObject({ code: 'support_closed', status: 409 });
	const staffCloseTicket = await create(member.id);
	const staffClose = {
		requestId: requestId(),
		message: 'Resolved by staff.',
		close: true
	};
	await replySupportTicket(
		db(),
		{ userId: moderator.id, staff: true },
		staffCloseTicket.ticketId,
		staffClose
	);
	await replySupportTicket(
		db(),
		{ userId: moderator.id, staff: true },
		staffCloseTicket.ticketId,
		staffClose
	);
	const staffClosed = await readSupportTicket(db(), member.actor, staffCloseTicket.ticketId);
	expect(staffClosed.ticket.state).toBe('closed');
	expect(staffClosed.messages).toHaveLength(2);
	expect(staffClosed.messages[1]).toMatchObject({
		authorKind: 'staff',
		body: 'Resolved by staff.'
	});
});

it('allows banned members to use support while denying gameplay, lifecycle accounts, guests, and cross-member access', async () => {
	const admin = await identity('admin');
	const banned = await identity();
	const other = await identity();
	await db()
		.prepare('INSERT INTO player_ban(user_id,reason,created_at,expires_at) VALUES(?,?,?,NULL)')
		.bind(banned.id, 'private moderation detail', now)
		.run();
	expect(await accountIsActive(db(), banned.id)).toBe(false);
	const { ticketId } = await create(banned.id);
	const moderator = await identity('moderator');
	await replySupportTicket(db(), { userId: moderator.id, staff: true }, ticketId, {
		requestId: requestId(),
		message: 'We can help with your appeal.'
	});
	expect((await readSupportTicket(db(), banned.actor, ticketId)).messages[1]?.body).toBe(
		'We can help with your appeal.'
	);
	await expect(readSupportTicket(db(), other.actor, ticketId)).rejects.toMatchObject({
		code: 'support_missing',
		status: 404
	});
	await expect(
		replySupportTicket(db(), other.actor, ticketId, { requestId: requestId(), message: 'No' })
	).rejects.toMatchObject({
		code: 'support_missing',
		status: 404
	});
	await expect(closeSupportTicket(db(), other.actor, ticketId, requestId())).rejects.toMatchObject({
		code: 'support_missing',
		status: 404
	});
	await expect(readSupportTicket(db(), { userId: 'guest' }, ticketId)).rejects.toMatchObject({
		code: 'support_unavailable',
		status: 403
	});
	await expect(create('guest')).rejects.toMatchObject({ code: 'support_unavailable', status: 403 });
	await expect(
		saveSupportTaxonomy(
			db(),
			{ userId: moderator.id, staff: true },
			{
				requestId: requestId(),
				kind: 'category',
				name: 'Moderator category'
			}
		)
	).rejects.toMatchObject({ code: 'permission', status: 403 });
	const supportRole = await identity('support');
	await expect(
		listSupportTickets(db(), { userId: supportRole.id, staff: true })
	).rejects.toMatchObject({
		code: 'permission',
		status: 403
	});
	await softDeleteUser(db(), admin.id, banned.id, 'test deletion', 7, now);
	await expect(listSupportTickets(db(), banned.actor)).rejects.toMatchObject({
		code: 'support_unavailable',
		status: 403
	});
	await expect(create(banned.id)).rejects.toMatchObject({
		code: 'support_unavailable',
		status: 403
	});
	expect(
		await db().prepare('SELECT id FROM support_ticket WHERE id=?').bind(ticketId).first()
	).toBeTruthy();
});

it('protects defaults, renames stable taxonomy ids, reassigns open and closed tickets, and serializes create/delete races', async () => {
	const admin = await identity('admin');
	const moderator = await identity('moderator');
	const supportRole = await identity('support');
	const member = await identity();
	const defaults = await supportTaxonomy(db(), member.actor);
	expect(defaults.categories.find((entry) => entry.isDefault)).toMatchObject({
		id: 'general',
		name: 'General'
	});
	expect(defaults.priorities.find((entry) => entry.isDefault)).toMatchObject({
		id: 'normal',
		name: 'Normal'
	});
	await expect(
		saveSupportTaxonomy(
			db(),
			{ userId: admin.id, staff: true },
			{
				requestId: requestId(),
				kind: 'category',
				id: 'general',
				name: 'Renamed default'
			}
		)
	).rejects.toMatchObject({ code: 'support_default', status: 409 });
	const category = await saveSupportTaxonomy(
		db(),
		{ userId: admin.id, staff: true },
		{
			requestId: requestId(),
			kind: 'category',
			name: 'Billing'
		}
	);
	const priority = await saveSupportTaxonomy(
		db(),
		{ userId: admin.id, staff: true },
		{
			requestId: requestId(),
			kind: 'priority',
			name: 'Urgent'
		}
	);
	const first = await create(member.id, { categoryId: category.id, priorityId: priority.id });
	const second = await create(member.id, { categoryId: category.id, priorityId: priority.id });
	await closeSupportTicket(db(), member.actor, second.ticketId, requestId());
	const updateDefaults = {
		requestId: requestId(),
		categoryId: 'general',
		priorityId: 'normal'
	};
	await expect(
		updateSupportTicket(db(), member.actor, first.ticketId, updateDefaults)
	).rejects.toMatchObject({
		code: 'permission',
		status: 403
	});
	await expect(
		updateSupportTicket(
			db(),
			{ userId: supportRole.id, staff: true },
			first.ticketId,
			updateDefaults
		)
	).rejects.toMatchObject({ code: 'permission', status: 403 });
	await updateSupportTicket(
		db(),
		{ userId: moderator.id, staff: true },
		first.ticketId,
		updateDefaults
	);
	await updateSupportTicket(db(), { userId: admin.id, staff: true }, second.ticketId, {
		...updateDefaults,
		requestId: requestId()
	});
	expect((await readSupportTicket(db(), member.actor, second.ticketId)).ticket).toMatchObject({
		state: 'closed',
		categoryId: 'general',
		priorityId: 'normal'
	});
	await updateSupportTicket(db(), { userId: admin.id, staff: true }, second.ticketId, {
		requestId: requestId(),
		categoryId: category.id,
		priorityId: priority.id
	});
	await saveSupportTaxonomy(
		db(),
		{ userId: admin.id, staff: true },
		{
			requestId: requestId(),
			kind: 'category',
			id: category.id,
			name: 'Payments'
		}
	);
	await saveSupportTaxonomy(
		db(),
		{ userId: admin.id, staff: true },
		{
			requestId: requestId(),
			kind: 'priority',
			id: priority.id,
			name: 'High'
		}
	);
	await updateSupportTicket(db(), { userId: moderator.id, staff: true }, first.ticketId, {
		requestId: requestId(),
		categoryId: category.id,
		priorityId: priority.id
	});
	expect((await readSupportTicket(db(), member.actor, first.ticketId)).ticket).toMatchObject({
		categoryId: category.id,
		categoryName: 'Payments',
		priorityId: priority.id,
		priorityName: 'High'
	});
	const updateAudits = await db()
		.prepare(
			"SELECT actor,reason,before,after FROM admin_audit WHERE action='support-update' AND target IN (?,?)"
		)
		.bind(first.ticketId, second.ticketId)
		.all<{ actor: string; reason: string; before: string | null; after: string | null }>();
	expect(updateAudits.results).toHaveLength(4);
	expect(
		updateAudits.results.every(
			(audit) => audit.reason === 'Support action' && audit.before === null && audit.after === null
		)
	).toBe(true);
	expect(updateAudits.results.map((audit) => audit.actor)).toEqual(
		expect.arrayContaining([admin.id, moderator.id])
	);
	await deleteSupportTaxonomy(
		db(),
		{ userId: admin.id, staff: true },
		{
			requestId: requestId(),
			kind: 'category',
			id: category.id
		}
	);
	await deleteSupportTaxonomy(
		db(),
		{ userId: admin.id, staff: true },
		{
			requestId: requestId(),
			kind: 'priority',
			id: priority.id
		}
	);
	for (const ticketId of [first.ticketId, second.ticketId])
		expect((await readSupportTicket(db(), member.actor, ticketId)).ticket).toMatchObject({
			categoryId: 'general',
			categoryName: 'General',
			priorityId: 'normal',
			priorityName: 'Normal'
		});
	await expect(
		deleteSupportTaxonomy(
			db(),
			{ userId: admin.id, staff: true },
			{
				requestId: requestId(),
				kind: 'priority',
				id: 'normal'
			}
		)
	).rejects.toMatchObject({ code: 'support_default', status: 409 });
	await expect(
		updateSupportTicket(db(), { userId: admin.id, staff: true }, first.ticketId, {
			requestId: requestId(),
			categoryId: category.id,
			priorityId: 'normal'
		})
	).rejects.toMatchObject({ code: 'support_choice', status: 409 });
	const raceCategory = await saveSupportTaxonomy(
		db(),
		{ userId: admin.id, staff: true },
		{
			requestId: requestId(),
			kind: 'category',
			name: 'Race'
		}
	);
	const [created, deleted] = await Promise.allSettled([
		create(member.id, { categoryId: raceCategory.id }),
		deleteSupportTaxonomy(
			db(),
			{ userId: admin.id, staff: true },
			{
				requestId: requestId(),
				kind: 'category',
				id: raceCategory.id
			}
		)
	]);
	expect(deleted.status).toBe('fulfilled');
	if (created.status === 'fulfilled')
		expect(
			(await readSupportTicket(db(), member.actor, created.value.ticketId)).ticket.categoryId
		).toBe('general');
	else expect(created.reason).toMatchObject({ code: 'support_choice', status: 409 });
	expect(
		(
			await db()
				.prepare('SELECT count(*) AS n FROM support_ticket WHERE category_id=?')
				.bind(raceCategory.id)
				.first<{ n: number }>()
		)?.n
	).toBe(0);
});

it('enforces creation, open-ticket, member-reply, and staff-reply quotas atomically', async () => {
	const member = await identity();
	const creationAttempts = await Promise.allSettled(
		Array.from({ length: 6 }, () => create(member.id))
	);
	expect(creationAttempts.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
	const creationFailures = creationAttempts.filter((result) => result.status === 'rejected');
	expect(creationFailures).toHaveLength(3);
	for (const failure of creationFailures)
		if (failure.status === 'rejected')
			expect(failure.reason).toMatchObject({ code: 'support_limit', status: 429 });
	await ageLimits(member.id, 'create', 3_600_000);
	await create(member.id);
	await create(member.id);
	await expect(create(member.id)).rejects.toMatchObject({
		code: 'support_open_limit',
		status: 429
	});
	const counted = await db()
		.prepare("SELECT count(*) AS n FROM support_ticket WHERE user_id=? AND state='open'")
		.bind(member.id)
		.first<{ n: number }>();
	expect(counted?.n).toBe(5);

	const replier = await identity();
	const memberTicket = await create(replier.id);
	const memberReplies = await Promise.allSettled(
		Array.from({ length: 12 }, (_, i) =>
			replySupportTicket(db(), replier.actor, memberTicket.ticketId, {
				requestId: requestId(),
				message: `Member reply ${i}`
			})
		)
	);
	expect(memberReplies.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
	const memberFailures = memberReplies.filter((result) => result.status === 'rejected');
	expect(memberFailures).toHaveLength(2);
	for (const failure of memberFailures)
		if (failure.status === 'rejected')
			expect(failure.reason).toMatchObject({ code: 'support_limit', status: 429 });

	const staff = await identity('moderator');
	const owner = await identity();
	const staffTicket = await create(owner.id);
	const staffReplies = await Promise.allSettled(
		Array.from({ length: 32 }, (_, i) =>
			replySupportTicket(db(), { userId: staff.id, staff: true }, staffTicket.ticketId, {
				requestId: requestId(),
				message: `Staff reply ${i}`
			})
		)
	);
	expect(staffReplies.filter((result) => result.status === 'fulfilled')).toHaveLength(30);
	const staffFailures = staffReplies.filter((result) => result.status === 'rejected');
	expect(staffFailures).toHaveLength(2);
	for (const failure of staffFailures)
		if (failure.status === 'rejected')
			expect(failure.reason).toMatchObject({ code: 'support_limit', status: 429 });
	await db().prepare('DELETE FROM user WHERE id=?').bind(owner.id).run();
	const nextOwner = await identity();
	const nextTicket = await create(nextOwner.id);
	await expect(
		replySupportTicket(db(), { userId: staff.id, staff: true }, nextTicket.ticketId, {
			requestId: requestId(),
			message: 'Staff reply over limit'
		})
	).rejects.toMatchObject({ code: 'support_limit', status: 429 });
	const surviving = await db()
		.prepare("SELECT count(*) AS n FROM support_limit WHERE user_id=? AND kind='staff-reply'")
		.bind(staff.id)
		.first<{ n: number }>();
	expect(surviving?.n).toBe(30);
});

it('replays matching nonces once, rejects nonce conflicts, and preserves close/reply race outcomes', async () => {
	const member = await identity();
	const createNonce = requestId();
	const payload = {
		requestId: createNonce,
		subject: 'Retry',
		categoryId: 'general',
		priorityId: 'normal',
		message: 'Only once'
	};
	const [one, two] = await Promise.all([
		createSupportTicket(db(), member.id, payload),
		createSupportTicket(db(), member.id, payload)
	]);
	expect(one.ticketId).toBe(two.ticketId);
	const replyNonce = requestId();
	const reply = { requestId: replyNonce, message: 'One reply' };
	await Promise.all([
		replySupportTicket(db(), member.actor, one.ticketId, reply),
		replySupportTicket(db(), member.actor, one.ticketId, reply)
	]);
	await expect(
		createSupportTicket(db(), member.id, { ...payload, subject: 'Conflicting retry' })
	).rejects.toMatchObject({ code: 'support_request_conflict', status: 409 });
	await expect(
		replySupportTicket(db(), member.actor, one.ticketId, { ...reply, message: 'Conflicting reply' })
	).rejects.toMatchObject({ code: 'support_request_conflict', status: 409 });
	expect((await readSupportTicket(db(), member.actor, one.ticketId)).messages).toHaveLength(2);

	const race = await create(member.id);
	const results = await Promise.allSettled([
		closeSupportTicket(db(), member.actor, race.ticketId, requestId()),
		replySupportTicket(db(), member.actor, race.ticketId, {
			requestId: requestId(),
			message: 'Draft in flight'
		})
	]);
	expect(results[0]?.status).toBe('fulfilled');
	if (results[1]?.status === 'rejected')
		expect(results[1].reason).toMatchObject({ code: 'support_closed', status: 409 });
	const final = await readSupportTicket(db(), member.actor, race.ticketId);
	expect(final.ticket.state).toBe('closed');
	expect(final.messages.map((message) => message.body)).toEqual(
		results[1]?.status === 'fulfilled' ? ['Please help.', 'Draft in flight'] : ['Please help.']
	);
});

it('keeps trimmed UTF-16 boundary text as plain text and rejects NUL or over-limit input', async () => {
	const member = await identity();
	const subject = '🙂'.repeat(60);
	const body = '  <script>alert(1)</script>\nhttps://example.test/?q=<img>  ';
	const ticket = await create(member.id, { subject: `  ${subject}  `, message: body });
	const opened = await readSupportTicket(db(), member.actor, ticket.ticketId);
	expect(opened.ticket.subject).toBe(subject);
	expect(opened.messages[0]?.body).toBe(body.trim());
	await replySupportTicket(db(), member.actor, ticket.ticketId, {
		requestId: requestId(),
		message: '🙂'.repeat(2_000)
	});
	await expect(create(member.id, { subject: '🙂'.repeat(61) })).rejects.toMatchObject({
		code: 'support_subject'
	});
	await expect(
		replySupportTicket(db(), member.actor, ticket.ticketId, {
			requestId: requestId(),
			message: '🙂'.repeat(2_001)
		})
	).rejects.toMatchObject({ code: 'support_message' });
	await expect(create(member.id, { subject: 'bad\0subject' })).rejects.toMatchObject({
		code: 'support_subject'
	});
	await expect(
		replySupportTicket(db(), member.actor, ticket.ticketId, {
			requestId: requestId(),
			message: 'bad\0message'
		})
	).rejects.toMatchObject({ code: 'support_message' });
	const staff = await identity('moderator');
	await replySupportTicket(db(), { userId: staff.id, staff: true }, ticket.ticketId, {
		requestId: requestId(),
		message: '<script>staff body</script>'
	});
	const audit = await db()
		.prepare(
			"SELECT reason,before,after FROM admin_audit WHERE actor=? AND action='support-reply' AND target=?"
		)
		.bind(staff.id, ticket.ticketId)
		.first<{ reason: string; before: string | null; after: string | null }>();
	expect(audit).toEqual({ reason: 'Support action', before: null, after: null });
});

it('cascades direct user and privacy deletion, blocks pending deletion, and prunes support limits and expired accounts', async () => {
	const admin = await identity('admin');
	const directDelete = await identity();
	const privacy = await identity();
	const lifecycle = await identity();
	const retained = await identity();
	const selfTicket = await create(directDelete.id);
	const privacyTicket = await create(privacy.id);
	const lifecycleTicket = await create(lifecycle.id);
	const selfMessage = await db()
		.prepare('SELECT id FROM support_message WHERE ticket_id=?')
		.bind(selfTicket.ticketId)
		.first<{ id: string }>();
	await db().prepare('DELETE FROM user WHERE id=?').bind(directDelete.id).run();
	expect(
		await db().prepare('SELECT id FROM support_message WHERE id=?').bind(selfMessage?.id).first()
	).toBeNull();
	await deleteAccountForPrivacy(db(), admin.id, privacy.id, 'case_133');
	expect(
		await db()
			.prepare('SELECT id FROM support_ticket WHERE id=?')
			.bind(privacyTicket.ticketId)
			.first()
	).toBeNull();
	expect(
		await db()
			.prepare(
				"SELECT count(*) AS n FROM admin_audit WHERE actor=? AND action='privacy-delete' AND target=?"
			)
			.bind(admin.id, privacy.id)
			.first<{ n: number }>()
	).toMatchObject({ n: 1 });
	await softDeleteUser(db(), admin.id, lifecycle.id, 'test lifecycle', 1, now);
	await expect(listSupportTickets(db(), { userId: lifecycle.id })).rejects.toMatchObject({
		code: 'support_unavailable',
		status: 403
	});
	expect(
		await db()
			.prepare('SELECT id FROM support_ticket WHERE id=?')
			.bind(lifecycleTicket.ticketId)
			.first()
	).toBeTruthy();
	await db()
		.prepare(
			"INSERT INTO support_limit(nonce,user_id,kind,created_at,expires_at) VALUES(?,?,'member-reply',?,?)"
		)
		.bind(crypto.randomUUID(), retained.id, now - 100_000, now - 1)
		.run();
	await pruneExpiredRecords(db(), admin.id, now + 86_400_001);
	expect(
		await db().prepare('SELECT id FROM user WHERE id=?').bind(lifecycle.id).first()
	).toBeNull();
	expect(
		await db()
			.prepare('SELECT id FROM support_ticket WHERE id=?')
			.bind(lifecycleTicket.ticketId)
			.first()
	).toBeNull();
	expect(
		await db().prepare('SELECT nonce FROM support_limit WHERE user_id=?').bind(retained.id).first()
	).toBeNull();
});
