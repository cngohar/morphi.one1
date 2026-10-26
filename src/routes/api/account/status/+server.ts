import { json } from '@sveltejs/kit';
import { ownerKey } from '#lib/server/play-http.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ locals }) =>
	json(
		{
			signedIn: Boolean(locals.user),
			ownerKey: locals.user ? await ownerKey(locals.user.id) : null
		},
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
