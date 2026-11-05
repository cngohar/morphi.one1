import { supportConversation, supportWrite } from '#lib/server/support-http.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = (event) => supportConversation(event, true);
export const POST: RequestHandler = (event) => supportWrite(event, true);
