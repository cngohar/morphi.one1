import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBlockHintSeen, saveBlockHintSeen } from '#lib/ui/storage.js';

describe('block hint storage', () => {
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

		expect(() => saveBlockHintSeen()).not.toThrow();
		expect(loadBlockHintSeen()).toBe(true);
	});
});
