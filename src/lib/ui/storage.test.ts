import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let storage: typeof import('#lib/ui/storage.js');
let disk: Map<string, string>;
let setItem: ReturnType<typeof vi.fn>;

describe('local settings and best scores', () => {
	beforeEach(async () => {
		vi.resetModules();
		disk = new Map();
		setItem = vi.fn((key: string, value: string) => {
			disk.set(key, value);
		});
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => disk.get(key) ?? null,
			setItem
		});
		storage = await import('#lib/ui/storage.js');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps the first-round marker in memory when localStorage is blocked', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		expect(() => storage.saveBlockHintSeen()).not.toThrow();
		expect(storage.loadBlockHintSeen()).toBe(true);
	});

	it('keeps a new best when writes fail but the old best is still readable', () => {
		disk.set('morphi.block.best', '100');
		setItem.mockImplementation(() => {
			throw new Error('quota');
		});
		storage.saveBestScore(500);
		expect(storage.loadBestScore()).toBe(500);
		storage.saveBestScore(300);
		expect(storage.loadBestScore()).toBe(500);
		expect(disk.get('morphi.block.best')).toBe('100');
	});

	it('keeps the latest sound preference after a failed write', () => {
		disk.set('morphi.sound', 'on');
		setItem.mockImplementation(() => {
			throw new Error('quota');
		});
		storage.saveSoundEnabled(false);
		expect(storage.loadSoundEnabled()).toBe(false);
	});

	it('uses disk values again after a later successful write', () => {
		disk.set('morphi.block.best', '100');
		setItem.mockImplementationOnce(() => {
			throw new Error('quota');
		});
		storage.saveBestScore(500);
		storage.saveBestScore(600);
		expect(disk.get('morphi.block.best')).toBe('600');
		disk.set('morphi.block.best', '700'); // Another tab saves a higher score.
		expect(storage.loadBestScore()).toBe(700);
	});

	it('keeps best scores separate and never replaces a higher best', () => {
		storage.saveBestScore(500, 'block');
		storage.saveBestScore(2000, 'memory');
		storage.saveBestScore(100, 'block');
		expect(storage.loadBestScore('block')).toBe(500);
		expect(storage.loadBestScore('memory')).toBe(2000);
	});

	it('keeps the last readable best when storage later becomes unavailable', () => {
		disk.set('morphi.block.best', '500');
		expect(storage.loadBestScore()).toBe(500);
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		storage.saveBestScore(300);
		expect(storage.loadBestScore()).toBe(500);
	});

	it.each(['100oops', '1.5', '-1', 'Infinity', 'NaN', '9007199254740992', ''])(
		'ignores a malformed best: %s',
		(value) => {
			disk.set('morphi.block.best', value);
			expect(storage.loadBestScore()).toBe(0);
		}
	);

	it('ignores invalid best-score writes', () => {
		for (const score of [-1, 0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
			storage.saveBestScore(score);
		}
		expect(setItem).not.toHaveBeenCalled();
		expect(storage.loadBestScore()).toBe(0);
	});
});
