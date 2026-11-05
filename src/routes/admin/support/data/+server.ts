import { supportList } from '#lib/server/support-http.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = (event) => supportList(event, true);
