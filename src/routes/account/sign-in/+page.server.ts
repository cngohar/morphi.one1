import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user && !url.searchParams.has('reauth')) redirect(303, '/account');
	return {
		status: locals.accountStatus,
		oauthError: url.searchParams.has('error'),
		deleted: url.searchParams.has('deleted'),
		reauth: url.searchParams.has('reauth')
	};
};

export const actions: Actions = {
	google: async ({ locals, request }) => {
		if (!locals.auth || locals.accountStatus !== 'ready') return fail(503, { failed: true });
		let destination: string | undefined;
		try {
			const response = await locals.auth.api.signInSocial({
				headers: request.headers,
				body: {
					provider: 'google',
					callbackURL: '/account',
					errorCallbackURL: '/account/sign-in?error=oauth'
				}
			});
			destination = response.url;
		} catch {
			console.error(JSON.stringify({ event: 'google_signin_start_failed' }));
			return fail(503, { failed: true });
		}
		if (!destination) return fail(503, { failed: true });
		redirect(303, destination, { external: ['https://accounts.google.com'] });
	}
};
