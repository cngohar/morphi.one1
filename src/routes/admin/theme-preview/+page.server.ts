import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { operatorRequest } from '#lib/server/operator-http.js';
import { readThemeDraft } from '#lib/server/theme-admin.js';
import { auditOperatorRead } from '#lib/server/operator.js';
import { RunError } from '#lib/server/runs.js';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async (event) => {
	try {
		const actor = await operatorRequest(event, 'themes');
		const draft = await readThemeDraft(env.DB, event.url.searchParams.get('draft') ?? '');
		await auditOperatorRead(env.DB, actor.id, 'theme-preview', draft.id);
		return { draft };
	} catch (e) {
		if (e instanceof RunError) error(e.status, 'Theme preview unavailable');
		throw e;
	}
};
