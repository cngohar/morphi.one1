import { env } from 'cloudflare:workers';
import type { RequestEvent } from '@sveltejs/kit';
import { boundAccountRequest } from './request-body.js';
import { digest, RunError } from './runs.js';

export async function ownerKey(userId: string): Promise<string> {
	return digest(`${env.BETTER_AUTH_SECRET}\0progress\0${userId}`);
}
export async function readPlayBody(event: RequestEvent): Promise<Record<string, unknown>> {
	if (!event.locals.user || !event.locals.session) throw new RunError('signed_out', 401);
	if (event.request.headers.get('origin') !== new URL(env.BETTER_AUTH_URL).origin)
		throw new RunError('origin', 403);
	if (!event.request.headers.get('content-type')?.startsWith('application/json'))
		throw new RunError('content_type', 415);
	const bounded = await boundAccountRequest(event.request, 65536);
	if (!bounded) throw new RunError('body_limit', 413);
	let value;
	try {
		value = await bounded.json();
	} catch {
		throw new RunError('json');
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RunError('payload');
	return value as Record<string, unknown>;
}
export function playFailure(error: unknown): Response {
	if (error instanceof RunError) {
		console.warn(JSON.stringify({ event: 'play_request_rejected', code: error.code }));
		return Response.json(
			{ code: error.code },
			{
				status: error.status,
				headers: {
					'Cache-Control': 'private, no-store',
					...(error.status === 429 ? { 'Retry-After': '3600' } : {})
				}
			}
		);
	}
	console.error(JSON.stringify({ event: 'play_request_failed' }));
	return Response.json(
		{ code: 'unavailable' },
		{ status: 503, headers: { 'Cache-Control': 'private, no-store' } }
	);
}
