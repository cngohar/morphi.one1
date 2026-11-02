import { env } from 'cloudflare:workers';
import { RunError } from '#lib/server/runs.js';
import { abandonRanked } from '#lib/server/ranked-session.js';
import { ownerKey, playFailure, readPlayBody } from '#lib/server/play-http.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await readPlayBody(event);
		if (
			Object.keys(body).sort().join(',') !== 'ownerKey,session' ||
			typeof body.session !== 'string' ||
			!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.session) ||
			body.ownerKey !== (await ownerKey(event.locals.user!.id))
		)
			throw new RunError('payload');
		return Response.json(await abandonRanked(env.DB, event.locals.user!.id, body.session), {
			headers: { 'Cache-Control': 'private, no-store' }
		});
	} catch (error) {
		return playFailure(error);
	}
};
