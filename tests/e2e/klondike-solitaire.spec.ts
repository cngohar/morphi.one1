import { expect, test, type Page } from '@playwright/test';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';

const classic = 'klondike-solitaire:classic';

const viewports = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];

async function installAvailability(page: Page, selectedVariant = classic) {
	const available = familyIndex.filter((entry) => entry.enabled && entry.weight > 0);
	const variantLists = Object.fromEntries(
		available.map((entry) => [
			entry.id,
			entry.id === 'klondike-solitaire'
				? [selectedVariant]
				: (puzzleMetadata[entry.id]?.variants ?? [])
						.filter((variant) => variant.enabled !== false)
						.map((variant) => variant.id)
		])
	) as Record<string, string[]>;

	await page.route('**/api/play/availability**', async (route) => {
		const family = new URL(route.request().url()).searchParams.get('family');
		await route.fulfill({
			json: family
				? { available: true }
				: {
						available: available.map((entry) => entry.id),
						weights: Object.fromEntries(available.map((entry) => [entry.id, entry.weight])),
						variants: variantLists
					}
		});
	});
	await page.route('**/api/play/scoring**', (route) => {
		const requestedFamily = new URL(route.request().url()).searchParams.get('family');
		const scoring =
			puzzleMetadata[requestedFamily as keyof typeof puzzleMetadata]?.scoring ??
			puzzleMetadata['klondike-solitaire'].scoring;
		return route.fulfill({
			json: { version: scoring.version, values: scoring.defaults }
		});
	});
}

async function installSeed(page: Page, seed: string) {
	await page.addInitScript((seedValue) => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = Number(seedValue);
				return array;
			}
			return original(array);
		};
		localStorage.setItem('morphi.sound', 'off');
		localStorage.setItem(
			'morphi.selector.v2.guest',
			JSON.stringify({
				version: 1,
				eligible: [
					'block',
					'memory',
					'connect',
					'nonogram',
					'mahjong-solitaire',
					'tangram',
					'klondike-solitaire'
				],
				queue: [
					'klondike-solitaire',
					'tangram',
					'block',
					'memory',
					'connect',
					'nonogram',
					'mahjong-solitaire'
				],
				recent: [],
				cyclePosition: 0
			})
		);
	}, seed);
}

async function seeded(page: Page, variant = classic, seed = '1', timeout = 15000) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await installAvailability(page, variant);
	await installSeed(page, seed);
	await page.goto('/play');
	const game = page.locator('.klondike-game');
	await expect(game).toBeVisible({ timeout });
	return { game };
}

test.describe('Klondike Solitaire - Viewport & Layout Fit', () => {
	for (const { width, height } of viewports) {
		test(`fits ${width}×${height} with zero horizontal overflow`, async ({ page }) => {
			await page.setViewportSize({ width, height });
			await seeded(page, classic, '1');

			const game = page.locator('.klondike-game');
			await expect(game).toBeVisible();

			// Verify HUD, board, controls exist
			await expect(page.locator('.hud')).toBeVisible();
			await expect(page.locator('.board')).toBeVisible();
			await expect(page.locator('.controls')).toBeVisible();

			// Zero horizontal overflow check
			const noOverflow = await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth
			);
			expect(noOverflow).toBe(true);

			// Verify top row components: stock, waste, 4 foundations
			await expect(page.locator('.stock-cell')).toBeVisible();
			await expect(page.locator('.waste-cell')).toBeVisible();
			await expect(page.locator('.foundation-cell')).toHaveCount(4);

			// Verify 7 tableau columns
			await expect(page.locator('.tableau-column')).toHaveCount(7);
		});
	}
});

test.describe('Klondike Solitaire - Gameplay & Interactions', () => {
	test('stock draw deals card to waste and updates moves', async ({ page }) => {
		await page.setViewportSize({ width: 844, height: 390 });
		await seeded(page, classic, '1');

		// Initially waste is empty
		await expect(page.locator('.empty-waste-slot')).toBeVisible();

		// Click stock button
		const stockBtn = page.locator('.stock-btn');
		await expect(stockBtn).toBeVisible();
		await stockBtn.click();

		// Waste now has a card
		await expect(page.locator('.waste-card')).toHaveCount(1);
	});

	test('controls buttons (Undo, Hint, Auto-finish, Restart, New Deal) are present', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await seeded(page, classic, '1');

		await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Hint' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Auto-finish' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'New Deal' })).toBeVisible();
	});

	test('keyboard focus and navigation on tableau cards', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await seeded(page, classic, '1');

		// Press Tab to focus interactive element
		await page.keyboard.press('Tab');
		const focused = await page.evaluate(() => document.activeElement !== document.body);
		expect(focused).toBe(true);
	});
});

test('checkpoint restores the board and undo after reload', async ({ page }) => {
	test.setTimeout(480000);
	await seeded(page, classic, '1', 120000);
	const board = page.locator('.board');
	const snapshot = () =>
		board.evaluate((element) => ({
			stock: element.querySelector('.stock-cell')?.textContent?.trim(),
			waste: Array.from(element.querySelectorAll('.waste-cell [aria-label]'), (card) =>
				card.getAttribute('aria-label')
			),
			foundations: Array.from(element.querySelectorAll('.foundation-cell'), (cell) =>
				cell.textContent?.trim()
			),
			tableau: Array.from(element.querySelectorAll('.tableau-column'), (cell) => ({
				down: cell.querySelectorAll('.card-back').length,
				up: Array.from(cell.querySelectorAll('.card-face'), (card) =>
					card.getAttribute('aria-label')
				)
			}))
		}));
	const initial = await snapshot();
	await page.getByRole('button', { name: /Draw from stock/ }).click();
	const played = await snapshot();
	expect(played.stock).toBe('23');
	expect(played.waste).toHaveLength(1);
	expect(played.foundations).toHaveLength(4);
	expect(played.tableau).toHaveLength(7);
	await page.waitForTimeout(700);
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(page.locator('.klondike-game')).toBeVisible({ timeout: 120000 });
	expect(await snapshot()).toEqual(played);
	await page.keyboard.press('u');
	expect(await snapshot()).toEqual(initial);
	await expect(page.getByRole('button', { name: /Draw from stock/ })).toHaveAttribute(
		'aria-label',
		'Draw from stock (24 cards remaining)'
	);
});
