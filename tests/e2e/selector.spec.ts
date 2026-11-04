import { expect, test } from '@playwright/test';
import { fixSelectorSeed, selectorSeedFor } from './entropy.js';

for (const family of ['memory', 'block'] as const) {
	test(`the selector RNG can deal ${family} as the first game`, async ({ page }) => {
		await fixSelectorSeed(page, selectorSeedFor(family));
		await page.goto('/', { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Play', exact: true }).click();
		await expect(page.locator(`.game[data-family="${family}"]`)).toBeVisible({ timeout: 15000 });
	});
}

test('a failed Memory start keeps its pending draw and does not reveal it in the error', async ({
	page
}) => {
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		let draws = 0;
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				draws++;
				if (draws === 1) {
					array[0] = 0;
					array[1] = 0;
					return array;
				}
				if (draws === 2) throw new Error('Synthetic seed failure');
			}
			return original(array);
		};
	});
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.getByRole('alert').locator('p')).toHaveText(
		'Your puzzle could not start. Please try again.'
	);
	await expect(page.getByRole('alert')).not.toContainText(/memory|block|connect/i);
	await page.getByRole('button', { name: 'Try again', exact: true }).click();
	await expect(page.locator('.game[data-family="memory"]')).toBeVisible({ timeout: 15000 });
	await expect(page.getByRole('alert')).toHaveCount(0);
});
