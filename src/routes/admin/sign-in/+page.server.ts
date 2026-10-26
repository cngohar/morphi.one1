import { fail, redirect, error } from '@sveltejs/kit';
import { RunError } from '#lib/server/runs.js';
import { env } from 'cloudflare:workers';
import { verifyOperator, operatorLimit } from '#lib/server/operator.js';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		const enrolled = await env.DB.prepare('SELECT user_id FROM admin_web_operator WHERE user_id=?')
			.bind(locals.user.id)
			.first();
		if (!enrolled) error(403, 'Access unavailable');
	}
	return {
		signedIn: Boolean(locals.user),
		fresh: Boolean(locals.session && Date.now() - locals.session.createdAt.getTime() < 15 * 60000),
		recovery: url.searchParams.has('recovery')
	};
};
export const actions: Actions = {
	google: async (event) => {
		if (event.request.headers.get('origin') !== event.url.origin) error(403, 'Access unavailable');
		if (!event.locals.auth) return fail(503, { code: 'unavailable' });
		try {
			const response = await event.locals.auth.api.signInSocial({
				headers: event.request.headers,
				body: {
					provider: 'google',
					callbackURL: '/admin/sign-in',
					errorCallbackURL: '/admin/sign-in?error=oauth',
					additionalParams: { prompt: 'select_account' }
				}
			});
			if (response.url) redirect(303, response.url, { external: ['https://accounts.google.com'] });
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e && e.status === 303) throw e;
			console.error('morphi:operator_google_failed');
			return fail(503, { code: 'unavailable' });
		}
		return fail(503, { code: 'unavailable' });
	},
	verify: async (event) => {
		if (event.request.headers.get('origin') !== event.url.origin) error(403, 'Access unavailable');
		const { locals } = event;
		if (
			!locals.user ||
			!locals.session ||
			Date.now() - locals.session.createdAt.getTime() >= 15 * 60000
		)
			return fail(403, { code: 'reauth' });
		try {
			await operatorLimit(env.DB, `verify:${locals.user.id}`, 5);
			const body = await event.request.formData();
			if ([...body.keys()].some((key) => !['code', 'recovery'].includes(key)))
				return fail(400, { code: 'code' });
			const token = await verifyOperator(
				env.DB,
				locals.user.id,
				locals.session.id,
				String(body.get('code') ?? ''),
				body.get('recovery') === '1',
				env.BETTER_AUTH_SECRET
			);
			event.cookies.set('morphi_operator', token, {
				path: '/admin',
				httpOnly: true,
				secure: event.url.protocol === 'https:',
				sameSite: 'strict',
				maxAge: 1800
			});
		} catch (error) {
			console.warn(
				JSON.stringify({
					event: 'operator_verify_denied',
					code: error instanceof RunError ? error.code : 'unavailable'
				})
			);
			return fail(403, { code: 'code' });
		}
		redirect(303, '/admin/dashboard');
	}
};
