import { expect, test, type Page } from '@playwright/test';

const allVariants = ['memory:classic', 'memory:no-preview', 'memory:trios', 'memory:moving'];
async function memoryOnly(page: Page, enabled = allVariants) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = 42;
				return array;
			}
			return original(array);
		};
	});
	await page.route('**/api/play/availability**', async (route) => {
		const family = new URL(route.request().url()).searchParams.get('family');
		await route.fulfill({
			json: family
				? { available: true }
				: { available: ['memory'], weights: { memory: 1 }, variants: { memory: enabled } }
		});
	});
	await page.route('**/api/play/scoring**', async (route) => {
		const trio = new URL(route.request().url()).searchParams.get('variant') === 'memory:trios';
		await route.fulfill({
			json: {
				version: trio ? 'memory-trios-v1' : 'brief-v1',
				values: trio
					? { trio: 1500, mismatch: 150, second: 5 }
					: { pair: 1000, mismatch: 150, second: 5 }
			}
		});
	});
}
const symbols = (page: Page) =>
	page
		.locator('.memory-card')
		.evaluateAll((cards) => cards.map((card) => card.querySelector('.card-front svg')!.outerHTML));
async function solve(page: Page) {
	const cards = page.locator('.memory-card');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const groups = new Map<string, number[]>();
	for (const [index, symbol] of (await symbols(page)).entries())
		groups.set(symbol, [...(groups.get(symbol) ?? []), index]);
	for (const indices of groups.values())
		for (const index of indices) await cards.nth(index).click();
	await expect(page.locator('.result')).toBeVisible({ timeout: 15000 });
}

for (const [variant, label] of [
	['memory:classic', 'Classic'],
	['memory:no-preview', 'No preview'],
	['memory:trios', 'Trios'],
	['memory:moving', 'Moving cards']
]) {
	test(`${variant} labels HUD/help/result and completes through Next`, async ({ page }) => {
		await memoryOnly(page, [variant]);
		await page.goto('/play');
		await expect(page.locator('.active-round')).toHaveAttribute('data-variant', variant);
		await expect(page.locator('.public-header')).toContainText(`Memory · ${label}`);
		await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', {
			timeout: 15000
		});
		await page.getByRole('button', { name: 'How to play', exact: true }).click();
		await expect(page.locator('dialog[open]')).toContainText(`Memory · ${label}`);
		if (variant === 'memory:trios')
			await expect(page.locator('dialog[open]')).toContainText('three');
		if (variant === 'memory:no-preview')
			await expect(page.locator('dialog[open]')).toContainText('face down');
		await page.keyboard.press('Escape');
		await solve(page);
		await expect(page.locator('.result .eyebrow').first()).toContainText(`Memory · ${label}`);
		if (variant === 'memory:trios')
			await expect(page.locator('.result-stats')).toContainText('Trios');
		await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
		await expect(page.locator('.game')).toHaveAttribute('data-round', '2');
		await expect(page.locator('.active-round')).toHaveAttribute('data-variant', variant);
	});
}

test('no-preview never exposes opening faces and preserves variant across checkpoint reload', async ({
	page
}) => {
	await memoryOnly(page, ['memory:no-preview']);
	await page.addInitScript(() => {
		const exposed: string[] = [];
		Object.assign(window, { memoryOpeningExposed: exposed });
		new MutationObserver(() => {
			const game = document.querySelector('.game');
			if (
				game &&
				game.getAttribute('data-phase') !== 'playing' &&
				game.querySelector('.memory-card[aria-pressed="true"]')
			)
				exposed.push(game.getAttribute('data-phase') ?? '');
		}).observe(document, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['aria-pressed', 'data-phase']
		});
	});
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	expect(await page.evaluate(() => Reflect.get(window, 'memoryOpeningExposed'))).toEqual([]);
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(0);
	await page.locator('.memory-card').nth(0).click();
	await page.waitForTimeout(100);
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(page.locator('.active-round')).toHaveAttribute('data-variant', 'memory:no-preview');
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(1);
});

test('trios waits for three cards and enforces 18 flips per trio', async ({ page }) => {
	await memoryOnly(page, ['memory:trios']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const deck = await symbols(page),
		cards = page.locator('.memory-card');
	const first = 0,
		second = deck.findIndex((symbol) => symbol !== deck[0]),
		third = deck.findIndex((_, index) => index !== first && index !== second);
	const trios = deck.length / 3;
	for (let attempt = 0; attempt < trios * 6; attempt++) {
		await cards.nth(first).click();
		await cards.nth(second).click();
		await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(2);
		await cards.nth(third).click();
		if (attempt < trios * 6 - 1) await expect(cards.nth(first)).toBeEnabled();
	}
	await expect(page.getByRole('status').filter({ hasText: 'Flip limit reached' })).toBeVisible();
	await expect(page.locator('.memory-card:not([disabled])')).toHaveCount(0);
	await expect(page.locator('.result')).toHaveCount(0);
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 844, height: 390 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(viewport);
		await expect(page.getByRole('status').filter({ hasText: 'Flip limit reached' })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
			false
		);
		const bounds = await page.locator('.game').boundingBox();
		const last = await page.locator('.memory-card').last().boundingBox();
		expect(last!.y + last!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
	}
});

test('moving mismatch reshuffles only hidden unmatched positions', async ({ page }) => {
	await memoryOnly(page, ['memory:moving']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const deck = await symbols(page),
		cards = page.locator('.memory-card');
	const match = deck.flatMap((symbol, index) => (symbol === deck[0] ? [index] : []));
	for (const index of match) await cards.nth(index).click();
	await expect(page.locator('.memory-card.is-matched')).toHaveCount(2);
	const a = deck.findIndex((_, index) => !match.includes(index));
	const b = deck.findIndex((symbol, index) => !match.includes(index) && symbol !== deck[a]);
	await cards.nth(a).click();
	await cards.nth(b).click();
	await expect(cards.nth(a)).toBeEnabled();
	const after = await symbols(page);
	for (const index of [...match, a, b]) expect(after[index]).toBe(deck[index]);
	expect(after.some((symbol, index) => symbol !== deck[index])).toBe(true);
	await expect(page.locator('.memory-card.is-matched')).toHaveCount(2);
});

test('selector rotates enabled Memory variants without consecutive repeats', async ({ page }) => {
	await memoryOnly(page);
	await page.goto('/play');
	let last: string | null = null;
	for (let round = 0; round < 5; round++) {
		await expect(page.locator('.game')).toBeVisible();
		const variant = await page.locator('.active-round').getAttribute('data-variant');
		expect(allVariants).toContain(variant);
		expect(variant).not.toBe(last);
		last = variant;
		await solve(page);
		await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
		await expect(page.locator('.game')).toHaveAttribute('data-round', String(round + 2));
	}
});
