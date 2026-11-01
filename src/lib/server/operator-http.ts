import { env } from 'cloudflare:workers';
import type { RequestEvent } from '@sveltejs/kit';
import { RunError } from './runs.js';
import { operatorLimit, requireOperator } from './operator.js';
export async function operatorRequest(event: RequestEvent, action: string, sensitive = false) {
	if (!event.locals.user || !event.locals.session) throw new RunError('signed_out', 401);
	const token = event.cookies.get('morphi_operator') ?? '';
	if (!token) {
		const enrolled = await env.DB.prepare('SELECT user_id FROM admin_web_operator WHERE user_id=?')
			.bind(event.locals.user.id)
			.first();
		throw new RunError(enrolled ? 'signed_out' : 'permission', enrolled ? 401 : 403);
	}
	await operatorLimit(env.DB, `user:${event.locals.user.id}`, 60);
	if (event.request.method !== 'GET' && event.request.headers.get('origin') !== event.url.origin)
		throw new RunError('origin', 403);
	return requireOperator(
		env.DB,
		{
			userId: event.locals.user.id,
			authSession: event.locals.session.id,
			authCreatedAt: event.locals.session.createdAt.getTime(),
			token
		},
		action,
		sensitive
	);
}
