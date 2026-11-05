import { recordAccountActivity } from '#lib/server/activity.js';
import { anonymizeExpiredUsers } from '#lib/server/user-lifecycle.js';
import { operatorLimit } from '#lib/server/operator.js';
import { digest } from '#lib/server/runs.js';
import { building } from '$app/env';
import { getRequestEvent } from '$app/server';
import { env } from 'cloudflare:workers';
import { sveltekitCookies, svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { boundAccountRequest } from '#lib/server/request-body.js';
import { createAuth, googleIsConfigured } from '#lib/server/auth.js';
import { responsePolicy } from '#lib/server/response-policy.js';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.auth = null;
	event.locals.user = null;
	event.locals.session = null;
	event.locals.accountStatus = 'unavailable';
	// Static public documents are rendered at build time without Worker bindings.
	if (building) return resolve(event);
	if (env.DB) {
		try {
			await anonymizeExpiredUsers(env.DB);
		} catch {
			console.error(JSON.stringify({ event: 'account_maintenance_failed' }));
		}
	}
	const authPath = event.url.pathname.startsWith('/api/auth/');
	const accountPath = event.url.pathname.startsWith('/account');
	const adminPath =
		event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/api/admin');
	if ((authPath || accountPath || adminPath) && !['GET', 'HEAD'].includes(event.request.method)) {
		const supportPath = /^(?:\/api\/support|\/admin\/support\/data)(?:\/|$)/.test(
			event.url.pathname
		);
		const bounded = await boundAccountRequest(event.request, supportPath ? 32768 : 16384);
		if (!bounded)
			return Response.json(
				{ code: 'BODY_TOO_LARGE', retryable: false },
				{
					status: 413,
					headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }
				}
			);
		event = { ...event, request: bounded };
	}
	if (adminPath) {
		try {
			const address = event.request.headers.get('cf-connecting-ip') ?? 'local';
			const key = await digest(
				`${env.BETTER_AUTH_SECRET}:operator-route:${Math.floor(Date.now() / 86400000)}:${address}`
			);
			await operatorLimit(env.DB, key, 120);
		} catch {
			return new Response('Access temporarily unavailable', {
				status: 429,
				headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Retry-After': '60' }
			});
		}
	}
	const settings = {
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET ?? '',
		googleClientId: env.GOOGLE_CLIENT_ID ?? '',
		googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? ''
	};
	if (!building && settings.secret.length >= 32 && env.DB) {
		try {
			const auth = createAuth(env.DB, settings, [sveltekitCookies(getRequestEvent)]);
			event.locals.auth = auth;
			event.locals.accountStatus = googleIsConfigured(settings) ? 'ready' : 'unconfigured';
			if (!authPath && event.request.headers.get('cookie')?.includes('better-auth.session_token')) {
				const current = await auth.api.getSession({
					headers: event.request.headers,
					query: { disableCookieCache: true }
				});
				event.locals.user = current?.user ?? null;
				event.locals.session = current?.session ?? null;
				if (current?.user) {
					try {
						await recordAccountActivity(env.DB, current.user.id);
					} catch {
						console.error(JSON.stringify({ event: 'account_activity_failed' }));
					}
				}
			}
		} catch {
			event.locals.accountStatus = 'unavailable';
			event.locals.auth = null;
			console.error(JSON.stringify({ event: 'account_session_unavailable' }));
		}
	}
	let response: Response;
	try {
		if (authPath && !event.locals.auth)
			response = Response.json({ code: 'AUTH_UNAVAILABLE', retryable: true }, { status: 503 });
		else if (authPath && event.locals.auth)
			response = await svelteKitHandler({ event, resolve, auth: event.locals.auth, building });
		else response = await resolve(event);
	} catch (error) {
		if (!authPath) throw error;
		console.error(JSON.stringify({ event: 'auth_request_failed' }));
		response = Response.json({ code: 'AUTH_UNAVAILABLE', retryable: true }, { status: 503 });
	}
	responsePolicy(
		response,
		event.url.pathname,
		Boolean(event.locals.user) || response.headers.has('Set-Cookie')
	);
	if (adminPath) {
		response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
		response.headers.set('X-Frame-Options', 'DENY');
	}
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
};
