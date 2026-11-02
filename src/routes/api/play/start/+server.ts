import { catalog } from '#lib/catalog.js';
import { env } from 'cloudflare:workers';
import { digest, RunError, startRanked } from '#lib/server/runs.js';
import { ownerKey, playFailure, readPlayBody } from '#lib/server/play-http.js';
import { activeRanked } from '#lib/server/ranked-session.js';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async (event) => {
	try {
		const body = await readPlayBody(event);
		if (
			Object.keys(body)
				.filter((key) => key !== 'takeoverSession')
				.sort()
				.join(',') !== 'family,ownerKey' ||
			(body.takeoverSession !== undefined &&
				(typeof body.takeoverSession !== 'string' ||
					!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
						body.takeoverSession
					))) ||
			typeof body.family !== 'string' ||
			!Object.hasOwn(catalog, body.family) ||
			body.ownerKey !== (await ownerKey(event.locals.user!.id))
		)
			throw new RunError('payload');
		const ip = event.request.headers.get('cf-connecting-ip') ?? event.getClientAddress();
		const ipHash = await digest(`${env.BETTER_AUTH_SECRET}\0start\0${ip}`);
		return Response.json(
			await startRanked(
				env.DB,
				event.locals.user!.id,
				body.family,
				ipHash,
				Date.now(),
				(body.takeoverSession as string | undefined) ?? null,
				env.CONFIG_CACHE
			),
			{
				headers: { 'Cache-Control': 'private, no-store' }
			}
		);
	} catch (error) {
		if (error instanceof RunError && error.code === 'ranked_active' && event.locals.user) {
			console.warn(JSON.stringify({ event: 'play_request_rejected', code: error.code }));
			try {
				return Response.json(
					{ code: error.code, active: await activeRanked(env.DB, event.locals.user.id) },
					{ status: 409, headers: { 'Cache-Control': 'private, no-store' } }
				);
			} catch (failure) {
				return playFailure(failure);
			}
		}
		return playFailure(error);
	}
};
