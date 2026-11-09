import { env } from 'cloudflare:workers';
import { catalog } from '#lib/catalog.js';
import { gameAvailable } from '#lib/server/games.js';
import { readGameConfig } from '#lib/server/config.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const requested = url.searchParams.get('family');
	const family = Object.keys(catalog).find((item) => item === requested);
	if (requested !== null && !family) return Response.json({ code: 'input' }, { status: 400 });
	if (url.searchParams.has('variant')) return Response.json({ code: 'input' }, { status: 400 });
	try {
		const available = family
			? await gameAvailable(env.DB, family)
			: (
					await Promise.all(
						Object.keys(catalog).map(async (item) =>
							(await gameAvailable(env.DB, item)) ? item : null
						)
					)
				).filter((item) => item !== null);
		const weights = Array.isArray(available)
			? Object.fromEntries(
					await Promise.all(
						available.map(async (id) => [
							id,
							(await readGameConfig(env.DB, id, env.CONFIG_CACHE)).values.weight
						])
					)
				)
			: undefined;
		return Response.json(
			{ available, ...(weights ? { weights } : {}) },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch {
		console.error('morphi:game_availability_unavailable');
		return Response.json({ code: 'unavailable' }, { status: 503 });
	}
};
