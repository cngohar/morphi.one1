import { expect, test } from '@playwright/test';
import { fixSelectorSeed } from './entropy.js';

for (const [seed, family] of [
	[0, 'memory'],
	[2, 'block']
] as const) {
	test(`the selector RNG can deal ${family} as the first game`, async ({ page }) => {
		await fixSelectorSeed(page, seed);
		await page.goto('/', { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Play', exact: true }).click();
		await expect(page.locator(`.game[data-family="${family}"]`)).toBeVisible();
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
	await expect(page.getByRole('alert')).toHaveText(
		'Your puzzle could not start. Please try again.'
	);
	await expect(page.getByRole('alert')).not.toContainText(/memory|block/i);
	await page.getByRole('button', { name: 'Try again', exact: true }).click();
	await expect(page.locator('.game[data-family="memory"]')).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});
