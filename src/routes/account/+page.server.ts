import { fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { createDatabase } from '#lib/server/db/index.js';
import { session } from '#lib/server/db/schema.js';
import { accountHistory } from '#lib/server/runs.js';
import { findPlayer } from '#lib/server/players.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/account/sign-in');
	let player;
	try {
		player = await findPlayer(env.DB, locals.user.id);
	} catch {
		console.error(JSON.stringify({ event: 'account_profile_read_failed' }));
		return { name: '', unavailable: true, history: [], bests: [], summary: [] };
	}
	if (!player) redirect(303, '/account/name');
	try {
		return {
			name: player.name,
			unavailable: false,
			...(await accountHistory(env.DB, locals.user.id))
		};
	} catch {
		console.error('morphi:history_read_failed');
		return { name: player.name, unavailable: true, history: [], bests: [], summary: [] };
	}
};

export const actions: Actions = {
	signout: async ({ locals, request }) => {
		if (!locals.auth) return fail(503, { code: 'unavailable' as const });
		try {
			// Better Auth's sign-out intentionally swallows storage failures. Revoke first
			// so a database outage produces a retryable error instead of false success.
			if (locals.session)
				await createDatabase(env.DB).delete(session).where(eq(session.id, locals.session.id));
			await locals.auth.api.signOut({ headers: request.headers });
		} catch {
			console.error(JSON.stringify({ event: 'account_signout_failed' }));
			return fail(503, { code: 'unavailable' as const });
		}
		redirect(303, '/');
	},
	delete: async ({ locals, request }) => {
		if (!locals.user || !locals.session || !locals.auth)
			return fail(401, { code: 'expired' as const });
		const body = await request.formData();
		if (body.get('confirm') !== 'delete' || [...body.keys()].some((key) => key !== 'confirm'))
			return fail(400, { code: 'confirmation' as const });
		if (Date.now() - locals.session.createdAt.getTime() >= 5 * 60 * 1000)
			return fail(400, { code: 'reauth' as const });
		try {
			await locals.auth.api.deleteUser({ headers: request.headers, body: {} });
		} catch {
			console.error(JSON.stringify({ event: 'account_deletion_failed' }));
			return fail(503, { code: 'unavailable' as const });
		}
		redirect(303, '/account/sign-in?deleted=1');
	}
};
