/** Fixed presentation allowances. Never accepted from a client's submitted timing. */
export const MEMORY_PREVIEW_MS = 3000;
export const MEMORY_HIDE_MS = 250;
export const BLOCK_ENTRANCE_MS = 3000;
export const CONNECT_ENTRANCE_MS = 2500;
export const NONOGRAM_ENTRANCE_MS = 2500;
export function memoryEntranceMs(pairs: number): number {
	return pairs <= 6 ? 3000 : pairs <= 8 ? 4000 : 5000;
}
export function memoryOpeningMs(pairs: number): number {
	return memoryEntranceMs(pairs) + MEMORY_PREVIEW_MS + MEMORY_HIDE_MS;
}

/** Accepted Card opening; server-owned per issued session, zero on legacy rows. */
export const CARD_DEAL_MS = 650;
export const CARD_FLIP_MS = 400;
export const CARD_UNFOLD_MS = 800;
export const CARD_OPENING_MS = CARD_DEAL_MS + CARD_FLIP_MS + CARD_UNFOLD_MS;
export const CARD_FOLD_MS = 500;
export const RESULT_EXIT_MS = 350;

/** Ranked issuance follows the neutral deal; only flip/unfold remain before the game opening. */
export const CARD_RANKED_OPENING_MS = CARD_FLIP_MS + CARD_UNFOLD_MS;
