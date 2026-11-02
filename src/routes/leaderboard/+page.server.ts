import { env } from 'cloudflare:workers';
import { BOARD_GROUPS, leaderboard, RunError } from '#lib/server/runs.js';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ url, locals }) => {
	const group = url.searchParams.get('group') ?? BOARD_GROUPS[0];
	const offset = Number(url.searchParams.get('offset') ?? 0);
	try {
		return {
			...(await leaderboard(env.DB, group, offset, locals.user?.id ?? null, env.CONFIG_CACHE)),
			unavailable: false
		};
	} catch (error) {
		console.warn(
			JSON.stringify({ event: 'leaderboard_unavailable', invalid: error instanceof RunError })
		);
		return { group: BOARD_GROUPS[0], offset: 0, rows: [], own: null, unavailable: true };
	}
};
