import { env } from 'cloudflare:workers';
import { resumableRanked } from '#lib/server/ranked-session.js';
import { ownerKey, playFailure } from '#lib/server/play-http.js';
import { RunError } from '#lib/server/runs.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		if (!locals.user || !locals.session) throw new RunError('signed_out', 401);
		if (url.searchParams.get('ownerKey') !== (await ownerKey(locals.user.id)))
			throw new RunError('account_changed', 409);
		return Response.json(
			await resumableRanked(env.DB, locals.user.id, Date.now(), env.CONFIG_CACHE),
			{
				headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }
			}
		);
	} catch (error) {
		return playFailure(error);
	}
};
