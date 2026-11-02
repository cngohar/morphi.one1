import { env } from 'cloudflare:workers';
import { readScoreConfig } from '#lib/server/scoring.js';
import { catalog } from '#lib/catalog.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ url }) => {
	const family = Object.keys(catalog).find((family) => family === url.searchParams.get('family'));
	if (!family) return Response.json({ code: 'input' }, { status: 400 });
	try {
		return Response.json(await readScoreConfig(env.DB, family, undefined, env.CONFIG_CACHE), {
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch {
		console.error('morphi:score_config_unavailable');
		return Response.json({ code: 'unavailable' }, { status: 503 });
	}
};
