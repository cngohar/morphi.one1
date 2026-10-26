import { env } from 'cloudflare:workers';
import { leaderboard, RunError } from '#lib/server/runs.js';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ url, locals }) => {
	const group = url.searchParams.get('group') ?? 'block-placement-1';
	const offset = Number(url.searchParams.get('offset') ?? 0);
	try {
		return {
			...(await leaderboard(env.DB, group, offset, locals.user?.id ?? null)),
			unavailable: false
		};
	} catch (error) {
		console.warn(
			JSON.stringify({ event: 'leaderboard_unavailable', invalid: error instanceof RunError })
		);
		return { group: 'block-placement-1', offset: 0, rows: [], own: null, unavailable: true };
	}
};
