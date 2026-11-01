import { catalog } from '#lib/catalog.js';
export const measurementEvents = [
	'play_clicked',
	'round_started',
	'round_completed',
	'next_clicked',
	'error'
] as const;
export function parseMeasurement(
	value: unknown
): { id: string; event: string; family: string | null; code: string | null } | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const body = value as Record<string, unknown>;
	if (
		Object.keys(body).sort().join(',') !== 'code,consent,event,family,id' ||
		body.consent !== true ||
		typeof body.id !== 'string' ||
		!/^[0-9a-f-]{36}$/.test(body.id) ||
		!measurementEvents.includes(body.event as (typeof measurementEvents)[number]) ||
		(body.family !== null &&
			(typeof body.family !== 'string' || !Object.hasOwn(catalog, body.family))) ||
		![null, 'start', 'save', 'view'].includes(body.code as string | null)
	)
		return null;
	return {
		id: body.id,
		event: String(body.event),
		family: body.family as string | null,
		code: body.code as string | null
	};
}
