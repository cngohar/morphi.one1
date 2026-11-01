import { env } from 'cloudflare:workers';
import { readScoreConfig } from '#lib/server/scoring.js';
import { SCORE_FAMILIES } from '#lib/engine/scoring.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ url }) => {
	const family = SCORE_FAMILIES.find((family) => family === url.searchParams.get('family'));
	if (!family) return Response.json({ code: 'input' }, { status: 400 });
	try {
		return Response.json(await readScoreConfig(env.DB, family), {
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch {
		console.error('morphi:score_config_unavailable');
		return Response.json({ code: 'unavailable' }, { status: 503 });
	}
};
