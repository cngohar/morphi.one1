import { env } from 'cloudflare:workers';
import {
	parseRoundActivity,
	recordRoundAbandon,
	recordRoundStart,
	recordRoundPlay
} from '#lib/server/activity.js';
import { RunError } from '#lib/server/runs.js';
import { ownerKey, playFailure, readPlayBody } from '#lib/server/play-http.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await readPlayBody(event);
		if (body.ownerKey !== (await ownerKey(event.locals.user!.id)))
			throw new RunError('account_changed', 409);
		const { action, round } = parseRoundActivity(body);
		if (action === 'start') await recordRoundStart(env.DB, event.locals.user!.id, round);
		else if (action === 'play') await recordRoundPlay(env.DB, event.locals.user!.id, round);
		else await recordRoundAbandon(env.DB, event.locals.user!.id, round);
		return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
	} catch (error) {
		return playFailure(error);
	}
};
