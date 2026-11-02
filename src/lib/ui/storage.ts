import { SCORE_DEFAULT_VERSION } from '#lib/engine/scoring.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import type { PuzzleSelectorState } from '#lib/selector.js';
const SOUND_KEY = 'morphi.sound';
const BLOCK_HINT_KEY = 'morphi.block.hintSeen';

export type BestGame = PuzzleId;

const memoryStore = new Map<string, string>();
const failedWrites = new Set<string>();

function read(key: string): string | null {
	// A failed write must not be hidden by an older value still on disk.
	if (failedWrites.has(key)) {
		return memoryStore.get(key) ?? null;
	}

	try {
		const stored = localStorage.getItem(key);
		if (stored !== null) {
			memoryStore.set(key, stored);
			return stored;
		}
	} catch {
		// Storage can be blocked in private modes. Keep the in-memory value.
	}

	return memoryStore.get(key) ?? null;
}

function write(key: string, value: string): void {
	memoryStore.set(key, value);

	try {
		localStorage.setItem(key, value);
		failedWrites.delete(key);
	} catch {
		failedWrites.add(key);
		// The in-memory fallback still keeps this session playable.
	}
}

function selectorKey(ownerKey: string | null): string {
	return `morphi.selector.v2.${ownerKey === null ? 'guest' : `account:${encodeURIComponent(ownerKey)}`}`;
}

export function loadSelectorState(ownerKey: string | null): unknown {
	const stored = read(selectorKey(ownerKey));
	if (stored === null) return undefined;
	try {
		return JSON.parse(stored);
	} catch {
		console.warn('morphi:selector_state_invalid');
		return undefined;
	}
}

export function saveSelectorState(ownerKey: string | null, state: PuzzleSelectorState): void {
	const key = selectorKey(ownerKey);
	write(key, JSON.stringify(state));
	if (failedWrites.has(key)) console.warn('morphi:selector_storage_unavailable');
}

export function loadBestScore(game: BestGame = 'block', version = SCORE_DEFAULT_VERSION): number {
	const stored = read(
		version === SCORE_DEFAULT_VERSION ? `morphi.${game}.best` : `morphi.${game}.best.${version}`
	);
	const score = stored !== null && /^\d+$/.test(stored) ? Number(stored) : 0;
	return Number.isSafeInteger(score) && score > 0 ? score : 0;
}

export function saveBestScore(
	score: number,
	game: BestGame = 'block',
	version = SCORE_DEFAULT_VERSION
): void {
	if (!Number.isSafeInteger(score) || score <= loadBestScore(game, version)) {
		return;
	}

	write(
		version === SCORE_DEFAULT_VERSION ? `morphi.${game}.best` : `morphi.${game}.best.${version}`,
		String(score)
	);
}

export function loadBlockHintSeen(): boolean {
	return read(BLOCK_HINT_KEY) === '1';
}

export function loadFamilyPlayed(game: BestGame): boolean {
	return read(`morphi.${game}.played`) === '1' || loadBestScore(game) > 0;
}

export function markFamilyPlayed(game: BestGame): void {
	write(`morphi.${game}.played`, '1');
}

export function saveBlockHintSeen(): void {
	write(BLOCK_HINT_KEY, '1');
}

export function loadSoundEnabled(): boolean {
	const stored = read(SOUND_KEY);
	return stored === null ? true : stored === 'on';
}

export function saveSoundEnabled(enabled: boolean): void {
	write(SOUND_KEY, enabled ? 'on' : 'off');
}
