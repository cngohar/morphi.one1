import type { Page } from '@playwright/test';

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
