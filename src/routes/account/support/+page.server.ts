import { error, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { assertSupportMember } from '#lib/server/support.js';
import { RunError } from '#lib/server/runs.js';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.session) redirect(303, '/account/sign-in');
	try {
		await assertSupportMember(env.DB, locals.user.id);
	} catch (cause) {
		if (cause instanceof RunError) error(cause.status, 'Support access unavailable');
		throw cause;
	}
	return {};
};
