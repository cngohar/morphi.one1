import { env } from 'cloudflare:workers';
import { boundAccountRequest } from '#lib/server/request-body.js';
import { parseMeasurement } from '#lib/server/measurement.js';
import { operatorLimit } from '#lib/server/operator.js';
import { digest } from '#lib/server/runs.js';
import type { RequestHandler } from './$types';
const headers = { 'Cache-Control': 'private, no-store' };
export const POST: RequestHandler = async (event) => {
	if (event.request.headers.get('origin') !== event.url.origin)
		return new Response(null, { status: 403, headers });
	if (event.request.headers.get('sec-gpc') === '1' || event.request.headers.get('dnt') === '1')
		return new Response(null, { status: 204, headers });
	if (!event.request.headers.get('content-type')?.startsWith('application/json'))
		return new Response(null, { status: 415, headers });
	try {
		const request = await boundAccountRequest(event.request, 1024);
		if (!request) return new Response(null, { status: 413, headers });
		const body = parseMeasurement(await request.json());
		if (!body) return new Response(null, { status: 400, headers });
		const now = Date.now();
		const address = event.request.headers.get('cf-connecting-ip') ?? 'local';
		const key = await digest(
			`${env.BETTER_AUTH_SECRET}:measurement:${Math.floor(now / 86400000)}:${address}`
		);
		await operatorLimit(env.DB, `measurement:${key}`, 120, now);
		let visitor = event.cookies.get('morphi_measurement');
		if (!visitor || !/^[0-9a-f-]{36}$/.test(visitor)) {
			visitor = crypto.randomUUID();
			event.cookies.set('morphi_measurement', visitor, {
				path: '/api/measurement',
				httpOnly: true,
				secure: event.url.protocol === 'https:',
				sameSite: 'strict',
				maxAge: 86400
			});
		}
		// A salted server hash is the only visitor value retained in event records.
		const visitorHash = await digest(`${env.BETTER_AUTH_SECRET}:visitor:${visitor}`);
		await env.DB.batch([
			env.DB.prepare(
				'INSERT OR IGNORE INTO anonymous_event(id,visitor,event,family,code,created_at) VALUES(?,?,?,?,?,?)'
			).bind(body.id, visitorHash, body.event, body.family, body.code, now),
			env.DB.prepare(
				'DELETE FROM anonymous_event WHERE id IN(SELECT id FROM anonymous_event WHERE created_at<? LIMIT 100)'
			).bind(now - 7 * 86400000)
		]);
		return new Response(null, { status: 204, headers });
	} catch {
		console.warn('morphi:measurement_unavailable');
		return new Response(null, { status: 503, headers });
	}
};
export const DELETE: RequestHandler = async (event) => {
	if (event.request.headers.get('origin') !== event.url.origin)
		return new Response(null, { status: 403, headers });
	const visitor = event.cookies.get('morphi_measurement');
	event.cookies.delete('morphi_measurement', { path: '/api/measurement' });
	if (visitor && /^[0-9a-f-]{36}$/.test(visitor))
		try {
			await env.DB.prepare('DELETE FROM anonymous_event WHERE visitor=?')
				.bind(await digest(`${env.BETTER_AUTH_SECRET}:visitor:${visitor}`))
				.run();
		} catch {
			console.warn('morphi:measurement_clear_unavailable');
			return new Response(null, { status: 503, headers });
		}
	return new Response(null, { status: 204, headers });
};
