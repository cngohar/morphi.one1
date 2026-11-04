import type { Page } from '@playwright/test';
import { createRng } from '../../src/lib/engine/rng.js';
import { familyIndex } from '../../src/lib/family-index.js';
import { createPuzzleSelector, type PuzzleFamily } from '../../src/lib/selector.js';

export function selectorSeedFor(...expectedFamilies: PuzzleFamily[]): number {
	for (let seed = 0; seed < 10000; seed++) {
		const selector = createPuzzleSelector({
			families: familyIndex
				.filter((entry) => entry.enabled)
				.map((entry) => ({ family: entry.id, weight: entry.weight })),
			weight: (entry) => entry.weight * 2,
			rng: createRng(String(seed))
		});
		if (expectedFamilies.every((family) => selector.next() === family)) return seed;
	}
	throw new Error(`No selector seed found for ${expectedFamilies.join(' → ')}.`);
}

// Only the selector's first 64-bit draw is fixed. Puzzle seeds and auth IDs keep
// their normal entropy; no fixture switch or family picker ships in the app.
export async function fixSelectorSeed(page: Page, seed = 2) {
	await page.addInitScript((selectorSeed) => {
		const original = crypto.getRandomValues.bind(crypto);
		let first = true;
		crypto.getRandomValues = (array) => {
			if (first && array instanceof Uint32Array && array.length === 2) {
				first = false;
				array[0] = 0;
				array[1] = selectorSeed;
				return array;
			}
			return original(array);
		};
	}, seed);
}
