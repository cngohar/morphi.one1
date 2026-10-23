const BEST_KEYS = {
	block: 'morphi.block.best',
	memory: 'morphi.memory.best'
} as const;
const SOUND_KEY = 'morphi.sound';
const BLOCK_HINT_KEY = 'morphi.block.hintSeen';

export type BestGame = keyof typeof BEST_KEYS;

const memoryStore = new Map<string, string>();

function read(key: string): string | null {
	try {
		const stored = localStorage.getItem(key);
		if (stored !== null) {
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
	} catch {
		// The in-memory fallback still keeps this session playable.
	}
}

export function loadBestScore(game: BestGame = 'block'): number {
	const stored = read(BEST_KEYS[game]);
	const score = stored === null ? 0 : Number.parseInt(stored, 10);
	return Number.isSafeInteger(score) && score > 0 ? score : 0;
}

export function saveBestScore(score: number, game: BestGame = 'block'): void {
	if (!Number.isSafeInteger(score) || score <= loadBestScore(game)) {
		return;
	}

	write(BEST_KEYS[game], String(score));
}

export function loadBlockHintSeen(): boolean {
	return read(BLOCK_HINT_KEY) === '1';
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
