/** Fixed presentation allowances. Never accepted from a client's submitted timing. */
export const MEMORY_PREVIEW_MS = 3000;
export const MEMORY_HIDE_MS = 250;
export const BLOCK_ENTRANCE_MS = 3000;
export function memoryEntranceMs(pairs: number): number {
	return pairs <= 6 ? 3000 : pairs <= 8 ? 4000 : 5000;
}
export function memoryOpeningMs(pairs: number): number {
	return memoryEntranceMs(pairs) + MEMORY_PREVIEW_MS + MEMORY_HIDE_MS;
}
