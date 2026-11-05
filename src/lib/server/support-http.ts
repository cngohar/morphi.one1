import { env } from 'cloudflare:workers';
import type { RequestEvent } from '@sveltejs/kit';
import { boundAccountRequest } from './request-body.js';
import { RunError } from './runs.js';
import { ownerKey } from './play-http.js';
import { operatorRequest } from './operator-http.js';
import {
	assertSupportMember,
	supportTaxonomy,
	listSupportTickets,
	readSupportTicket,
	createSupportTicket,
	replySupportTicket,
	closeSupportTicket,
	updateSupportTicket,
	saveSupportTaxonomy,
	deleteSupportTaxonomy,
	type SupportActor
} from './support.js';

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export function supportFailure(error: unknown): Response {
	if (error instanceof RunError) {
		const retryAfter =
			'retryAfter' in error && typeof error.retryAfter === 'number' ? error.retryAfter : 60;
		console.warn(JSON.stringify({ event: 'support_request_rejected', code: error.code }));
		return Response.json(
			{ code: error.code, ...(error.status === 429 ? { retryAfter } : {}) },
			{
				status: error.status,
				headers: {
					...headers,
					...(error.status === 429 ? { 'Retry-After': String(retryAfter) } : {})
				}
			}
		);
	}
	console.error(JSON.stringify({ event: 'support_request_failed' }));
	return Response.json({ code: 'unavailable' }, { status: 503, headers });
}
async function actorFor(
	event: RequestEvent,
	staff: boolean,
	taxonomy = false
): Promise<SupportActor> {
	if (!event.locals.user || !event.locals.session) throw new RunError('signed_out', 401);
	if (staff)
		await operatorRequest(
			event,
			taxonomy ? 'support-taxonomy' : 'support-tickets',
			!['GET', 'HEAD'].includes(event.request.method)
		);
	await assertSupportMember(env.DB, event.locals.user.id);
	return { userId: event.locals.user.id, ...(staff ? { staff: true } : {}) };
}
async function readBody(event: RequestEvent): Promise<Record<string, unknown>> {
	if (event.request.headers.get('origin') !== event.url.origin) throw new RunError('origin', 403);
	if (!event.request.headers.get('content-type')?.startsWith('application/json'))
		throw new RunError('content_type', 415);
	const request = await boundAccountRequest(event.request, 32768);
	if (!request) throw new RunError('body_limit', 413);
	let body;
	try {
		body = await request.json();
	} catch {
		throw new RunError('json');
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RunError('payload');
	const payload = body as Record<string, unknown>;
	if (payload.ownerKey !== (await ownerKey(event.locals.user!.id)))
		throw new RunError('account_changed', 409);
	return payload;
}
function pageOf(event: RequestEvent): number {
	const page = Number(event.url.searchParams.get('page') ?? 1);
	if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new RunError('page');
	return page;
}
export async function supportList(event: RequestEvent, staff = false): Promise<Response> {
	try {
		const actor = await actorFor(event, staff);
		return Response.json(
			{
				...(await listSupportTickets(env.DB, actor, pageOf(event))),
				...(await supportTaxonomy(env.DB, actor))
			},
			{ headers }
		);
	} catch (error) {
		return supportFailure(error);
	}
}
export async function supportConversation(event: RequestEvent, staff = false): Promise<Response> {
	try {
		const actor = await actorFor(event, staff);
		return Response.json(
			await readSupportTicket(env.DB, actor, event.params.ticket!, pageOf(event)),
			{ headers }
		);
	} catch (error) {
		return supportFailure(error);
	}
}
export async function supportWrite(
	event: RequestEvent,
	staff = false,
	taxonomy = false
): Promise<Response> {
	try {
		const actor = await actorFor(event, staff, taxonomy);
		const body = await readBody(event);
		const requestId = body.requestId as string;
		let result;
		if (taxonomy) {
			const input = {
				requestId,
				kind: body.kind as 'category' | 'priority',
				id: body.id as string,
				name: body.name as string
			};
			if (body.action === 'save') result = await saveSupportTaxonomy(env.DB, actor, input);
			else if (body.action === 'delete') result = await deleteSupportTaxonomy(env.DB, actor, input);
			else throw new RunError('payload');
		} else if (!event.params.ticket && !staff) {
			result = await createSupportTicket(env.DB, actor.userId, {
				requestId,
				subject: body.subject as string,
				categoryId: body.categoryId as string,
				priorityId: body.priorityId as string,
				message: body.message as string
			});
		} else if (event.params.ticket) {
			if (body.action === 'reply')
				result = await replySupportTicket(env.DB, actor, event.params.ticket, {
					requestId,
					message: body.message as string,
					close: body.close as boolean
				});
			else if (body.action === 'close')
				result = await closeSupportTicket(env.DB, actor, event.params.ticket, requestId);
			else if (body.action === 'update' && staff)
				result = await updateSupportTicket(env.DB, actor, event.params.ticket, {
					requestId,
					categoryId: body.categoryId as string,
					priorityId: body.priorityId as string
				});
			else throw new RunError('payload');
		} else throw new RunError('payload');
		return Response.json(result, { headers });
	} catch (error) {
		return supportFailure(error);
	}
}
