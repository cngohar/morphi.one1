import { env } from 'cloudflare:workers';
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { catalog } from '#lib/catalog.js';
import { leaderboard, digest, RunError } from '#lib/server/runs.js';
import { gameAvailable } from '#lib/server/games.js';
import { dailyStreak, utcDate, validateDailyDate } from '#lib/server/daily.js';
import { startDailyRanked, resumeDailyRanked, activeRanked } from '#lib/server/ranked-session.js';
import { ownerKey, readPlayBody } from '#lib/server/play-http.js';
import { readScoreConfig } from '#lib/server/scoring.js';
import { boundAccountRequest } from '#lib/server/request-body.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	if (url.searchParams.has('group')) error(404, 'Board not found');
	const today = utcDate(Date.now());
	const date = url.searchParams.get('date') ?? today;
	try {
		validateDailyDate(date);
	} catch {
		error(400, 'Invalid date');
	}
	if (date > today) error(400, 'Invalid date');
	const played = locals.user
		? await env.DB.prepare('SELECT DISTINCT family FROM completed_run WHERE user_id=?')
				.bind(locals.user.id)
				.all<{ family: string }>()
		: { results: [] };
	const families = (
		await Promise.all(
			Object.keys(catalog).map(async (family) =>
				(await gameAvailable(env.DB, family)) || played.results.some((row) => row.family === family)
					? family
					: null
			)
		)
	).filter((family): family is string => family !== null);
	const family = url.searchParams.get('family') ?? families[0] ?? Object.keys(catalog)[0];
	if (!family || !families.includes(family)) error(404, 'Board not found');
	const limit = url.searchParams.get('limit') === '100' ? 100 : 25;
	const archive = await env.DB.prepare(
		'SELECT date FROM daily_board_snapshot WHERE family=? AND date<? ORDER BY date DESC LIMIT 3660'
	)
		.bind(family, today)
		.all<{ date: string }>();
	const months = Object.groupBy(
		archive.results.map((row) => row.date),
		(date) => date.slice(0, 7)
	);
	try {
		return {
			...(await leaderboard(
				env.DB,
				family,
				date,
				locals.user?.id ?? null,
				env.CONFIG_CACHE,
				limit
			)),
			families,
			months,
			limit,
			today,
			streak: locals.user ? await dailyStreak(env.DB, locals.user.id) : null,
			unavailable: false
		};
	} catch (cause) {
		console.warn(
			JSON.stringify({ event: 'daily_board_unavailable', invalid: cause instanceof RunError })
		);
		return {
			family,
			date,
			rows: [],
			own: null,
			totalPlayers: 0,
			updatedAt: 0,
			frozen: false,
			families,
			months,
			limit,
			today,
			streak: null,
			unavailable: true
		};
	}
};

/** Page actions require form transport; preserve the existing bounded JSON play guards. */
async function actionRequest(event: RequestEvent, limit = 65_536) {
	const type = event.request.headers.get('content-type')?.split(';')[0].trim();
	if (type !== 'multipart/form-data' && type !== 'application/x-www-form-urlencoded')
		throw new RunError('content_type', 415);
	const request = await boundAccountRequest(event.request, limit);
	if (!request) throw new RunError('body_limit', 413);
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		throw new RunError('payload');
	}
	const payload = form.get('payload');
	if (Array.from(form.keys()).join(',') !== 'payload' || typeof payload !== 'string')
		throw new RunError('payload');
	const headers = new Headers(request.headers);
	headers.set('content-type', 'application/json');
	headers.delete('content-length');
	return new Request(request, { headers, body: payload });
}

export const actions: Actions = {
	streak: async (event) => {
		try {
			const body = await readPlayBody({ ...event, request: await actionRequest(event) });
			if (
				Object.keys(body).join(',') !== 'ownerKey' ||
				body.ownerKey !== (await ownerKey(event.locals.user!.id))
			)
				throw new RunError('payload');
			return await dailyStreak(env.DB, event.locals.user!.id);
		} catch (cause) {
			return fail(cause instanceof RunError ? cause.status : 503, { code: 'unavailable' });
		}
	},
	daily: async (event) => {
		try {
			const body = await readPlayBody({ ...event, request: await actionRequest(event) });
			if (
				typeof body.family !== 'string' ||
				!Object.hasOwn(catalog, body.family) ||
				body.ownerKey !== (await ownerKey(event.locals.user!.id)) ||
				Object.keys(body).some(
					(key) => !['family', 'ownerKey', 'sessionId', 'resumeMoves'].includes(key)
				)
			)
				throw new RunError('payload');
			if (body.sessionId !== undefined) {
				if (typeof body.sessionId !== 'string' || !Array.isArray(body.resumeMoves))
					throw new RunError('payload');
				return await resumeDailyRanked(
					env.DB,
					event.locals.user!.id,
					body.sessionId,
					body.resumeMoves,
					env.CONFIG_CACHE
				);
			}
			const address = event.request.headers.get('cf-connecting-ip') ?? event.getClientAddress();
			const ipHash = await digest(`${env.BETTER_AUTH_SECRET}\0start\0${address}`);
			return await startDailyRanked(
				env.DB,
				event.locals.user!.id,
				body.family,
				ipHash,
				Date.now(),
				env.CONFIG_CACHE,
				env.DAILY_SEED_SECRET
			);
		} catch (cause) {
			if (cause instanceof RunError)
				return fail(cause.status, {
					code: cause.code,
					...(cause.code === 'ranked_active' && event.locals.user
						? { active: await activeRanked(env.DB, event.locals.user.id) }
						: {})
				});
			console.error(JSON.stringify({ event: 'daily_start_unavailable' }));
			return fail(503, { code: 'unavailable' });
		}
	},
	// Practice retains its own random round and live score snapshot. Identity is
	// an internal request value, never a URL or a response field.
	scoring: async (event) => {
		try {
			if (event.request.headers.get('origin') !== event.url.origin)
				throw new RunError('origin', 403);
			const request = await actionRequest(event, 4096);
			const value: unknown = await request.json();
			if (!value || typeof value !== 'object' || Array.isArray(value))
				throw new RunError('payload');
			const body = value as Record<string, unknown>;
			if (
				typeof body.family !== 'string' ||
				!Object.hasOwn(catalog, body.family) ||
				(body.variant !== undefined && typeof body.variant !== 'string') ||
				Object.keys(body).some((key) => !['family', 'variant'].includes(key))
			)
				throw new RunError('payload');
			return await readScoreConfig(env.DB, body.family, undefined, env.CONFIG_CACHE, body.variant);
		} catch (cause) {
			return fail(cause instanceof RunError ? cause.status : 503, { code: 'unavailable' });
		}
	}
};
