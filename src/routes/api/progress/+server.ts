import { env } from 'cloudflare:workers';
import { accountHistory, RunError, saveRun } from '#lib/server/runs.js';
import { ownerKey, playFailure, readPlayBody } from '#lib/server/play-http.js';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async (event) => {
	try {
		const body = await readPlayBody(event);
		if (
			Object.keys(body).sort().join(',') !== 'ownerKey,run' ||
			body.ownerKey !== (await ownerKey(event.locals.user!.id))
		)
			throw new RunError('account_changed', 409);
		return Response.json(
			await saveRun(env.DB, event.locals.user!.id, body.run, undefined, env.CONFIG_CACHE),
			{
				headers: { 'Cache-Control': 'private, no-store' }
			}
		);
	} catch (error) {
		return playFailure(error);
	}
};
export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) throw new RunError('signed_out', 401);
		return Response.json(await accountHistory(env.DB, locals.user.id), {
			headers: { 'Cache-Control': 'private, no-store' }
		});
	} catch (error) {
		return playFailure(error);
	}
};
