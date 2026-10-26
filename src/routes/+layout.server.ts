import type { LayoutServerLoad } from './$types';
import { ownerKey } from '#lib/server/play-http.js';

export const load: LayoutServerLoad = async ({ locals }) => ({
	account: {
		signedIn: Boolean(locals.user),
		ownerKey: locals.user ? await ownerKey(locals.user.id) : null,
		status: locals.accountStatus
	}
});
