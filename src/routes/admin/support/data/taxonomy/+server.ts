import { supportWrite } from '#lib/server/support-http.js';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = (event) => supportWrite(event, true, true);
