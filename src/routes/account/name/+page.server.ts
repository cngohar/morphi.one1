import { fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { findPlayer, savePlayerName, validatePlayerName } from '#lib/server/players.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/account/sign-in');
	try {
		const player = await findPlayer(env.DB, locals.user.id);
		return { name: player?.name ?? '', unavailable: false };
	} catch {
		console.error(JSON.stringify({ event: 'player_read_failed' }));
		return { name: '', unavailable: true };
	}
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) return fail(401, { code: 'expired' as const, name: '' });
		if (Number(request.headers.get('content-length') ?? 0) > 2048)
			return fail(413, { code: 'invalid' as const, name: '' });
		const form = await request.formData();
		const input = form.get('playerName');
		const name = validatePlayerName(input);
		if (
			!name ||
			[...form.keys()].some((key) => key !== 'playerName') ||
			form.getAll('playerName').length !== 1
		) {
			return fail(400, {
				code: 'invalid' as const,
				name: typeof input === 'string' ? input.slice(0, 20) : ''
			});
		}
		try {
			if ((await savePlayerName(env.DB, locals.user.id, name)) === 'taken')
				return fail(409, { code: 'taken' as const, name });
		} catch {
			console.error(JSON.stringify({ event: 'player_name_save_failed' }));
			return fail(503, { code: 'unavailable' as const, name });
		}
		redirect(303, '/account');
	}
};
