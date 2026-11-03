import { env } from 'cloudflare:workers';
import { readThemeConfig } from '#lib/server/config.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async () =>
	Response.json(await readThemeConfig(env.DB, env.CONFIG_CACHE), {
		headers: { 'Cache-Control': 'no-store' }
	});
