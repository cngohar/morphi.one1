import { env } from 'cloudflare:workers';
import { digest, RunError, startRanked } from '#lib/server/runs.js';
import { ownerKey, playFailure, readPlayBody } from '#lib/server/play-http.js';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async (event) => {
	try {
		const body = await readPlayBody(event);
		if (
			Object.keys(body).sort().join(',') !== 'family,ownerKey' ||
			(body.family !== 'block' && body.family !== 'memory' && body.family !== 'connect') ||
			body.ownerKey !== (await ownerKey(event.locals.user!.id))
		)
			throw new RunError('payload');
		const ip = event.request.headers.get('cf-connecting-ip') ?? event.getClientAddress();
		const ipHash = await digest(`${env.BETTER_AUTH_SECRET}\0start\0${ip}`);
		return Response.json(await startRanked(env.DB, event.locals.user!.id, body.family, ipHash), {
			headers: { 'Cache-Control': 'private, no-store' }
		});
	} catch (error) {
		return playFailure(error);
	}
};
