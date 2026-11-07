import { expect, test, type Page } from '@playwright/test';

const allVariants = ['memory:classic', 'memory:no-preview', 'memory:trios', 'memory:moving'];
async function memoryOnly(page: Page, enabled = allVariants, seed = 42) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript((seed) => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = seed;
				return array;
			}
			return original(array);
		};
	}, seed);
	await page.route('**/api/play/availability**', async (route) => {
		const family = new URL(route.request().url()).searchParams.get('family');
		await route.fulfill({
			json: family
				? { available: true }
				: { available: ['memory'], weights: { memory: 1 }, variants: { memory: enabled } }
		});
	});
	await page.route('**/api/play/scoring**', async (route) => {
		const variant = new URL(route.request().url()).searchParams.get('variant');
		await route.fulfill({
			json:
				variant === 'memory:trios'
					? { version: 'memory-trios-v1', values: { trio: 1500, mismatch: 150, second: 5 } }
					: variant === 'memory:quads'
						? { version: 'memory-quads-v1', values: { quad: 2000, mismatch: 150, second: 5 } }
						: { version: 'brief-v1', values: { pair: 1000, mismatch: 150, second: 5 } }
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

const pilot = [
	['memory:budget', 'Tight Budget'],
	['memory:lockout', 'Lockout'],
	['memory:swaps', 'Marked Swaps'],
	['memory:two-backs', 'Two Backs'],
	['memory:quads', 'Quads'],
	['memory:collapse', 'Collapse']
] as const;
const viewports = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];
const open = (page: Page) => page.locator('.memory-card:not(.is-matched)');
/** Solves on the live board; collapse removes matched cards, so positions are re-read. */
async function solveLive(page: Page) {
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	while ((await page.locator('.result').count()) === 0 && (await open(page).count()) > 0) {
		const deck = await open(page).evaluateAll((cards) =>
			cards.map((card) => card.querySelector('.card-front svg')!.outerHTML)
		);
		for (const [index, symbol] of deck.entries())
			if (symbol === deck[0]) await open(page).nth(index).click();
		await page.waitForTimeout(60);
	}
	await expect(page.locator('.result')).toBeVisible({ timeout: 15000 });
}
const deckOf = (page: Page) =>
	open(page).evaluateAll((cards) =>
		cards.map((card) => card.querySelector('.card-front svg')!.outerHTML)
	);

for (const [variant, label] of pilot) {
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
		await page.keyboard.press('Escape');
		await solveLive(page);
		await expect(page.locator('.result .eyebrow').first()).toContainText(`Memory · ${label}`);
		await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
		await expect(page.locator('.game')).toHaveAttribute('data-round', '2');
		await expect(page.locator('.active-round')).toHaveAttribute('data-variant', variant);
	});
}

test('budget run-over keeps no score, survives reload as Resume, and Try another clears it', async ({
	page
}) => {
	await memoryOnly(page, ['memory:budget'], 3);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const deck = await symbols(page),
		cards = page.locator('.memory-card');
	const a = 0,
		b = deck.findIndex((symbol) => symbol !== deck[0]);
	const attempts = deck.length; // two attempts per pair, two cards per pair
	const stat = page.locator('.stat').filter({ hasText: 'Attempts left' });
	await expect(stat).toContainText(`${attempts} / ${attempts}`);
	for (let attempt = 0; attempt < attempts; attempt++) {
		await expect(page.getByRole('dialog', { name: 'Run over' })).toHaveCount(0);
		await cards.nth(a).click();
		await cards.nth(b).click();
		await expect(cards.nth(a)).toHaveAttribute('aria-pressed', 'false');
	}
	const dialog = page.getByRole('dialog', { name: 'Run over' });
	await expect(dialog).toBeVisible();
	await expect(stat).toContainText(`0 / ${attempts}`);
	await expect(page.locator('.result')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Try another', exact: true })).toBeFocused();
	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
			false
		);
		const box = await dialog.locator('.run-over-panel').boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.y).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
		expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
		const hud = await page.locator('.stats').evaluate((el) => el.scrollWidth <= el.clientWidth);
		expect(hud).toBe(true);
	}
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.waitForTimeout(100);
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Run over' })).toBeVisible();
	await expect(page.locator('.result')).toHaveCount(0);
	await page.getByRole('button', { name: 'Try another', exact: true }).click();
	await expect(page.locator('.game')).toHaveAttribute('data-round', '2', { timeout: 15000 });
	await expect(page.getByRole('dialog', { name: 'Run over' })).toHaveCount(0);
	await page.waitForTimeout(100);
	await page.reload();
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(1);
	await expect(page.locator('.game')).toHaveCount(0);
});

test('budget accepts a match on its final attempt, then ends the unfinished run', async ({
	page
}) => {
	await memoryOnly(page, ['memory:budget'], 3);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const deck = await symbols(page),
		cards = page.locator('.memory-card');
	const a = 0,
		b = deck.findIndex((symbol) => symbol !== deck[0]);
	const limit = deck.length;
	for (let attempt = 0; attempt < limit - 1; attempt++) {
		await cards.nth(a).click();
		await cards.nth(b).click();
		await expect(cards.nth(a)).toHaveAttribute('aria-pressed', 'false');
	}
	await expect(page.getByRole('dialog', { name: 'Run over' })).toHaveCount(0);
	// The last attempt is still accepted; one match cannot clear the board, so the run ends.
	for (const [index, symbol] of deck.entries())
		if (symbol === deck[0]) await cards.nth(index).click();
	await expect(page.locator('.memory-card.is-matched')).toHaveCount(2);
	await expect(page.getByRole('dialog', { name: 'Run over' })).toBeVisible();
});

test('lockout locks the last missed card for exactly one attempt', async ({ page }) => {
	await memoryOnly(page, ['memory:lockout']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const deck = await symbols(page),
		cards = page.locator('.memory-card');
	const a = 0,
		b = deck.findIndex((symbol) => symbol !== deck[0]);
	await cards.nth(a).click();
	await cards.nth(b).click();
	await expect(cards.nth(b)).toHaveClass(/is-lockout/);
	await expect(cards.nth(b)).toHaveAttribute('aria-label', /locked for this attempt/);
	await expect(cards.nth(a)).toHaveAttribute('aria-pressed', 'false');
	await cards.nth(b).click();
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(0);
	const pair = deck.flatMap((symbol, index) =>
		index !== b && index !== a && symbol === deck[a] ? [index] : []
	);
	await cards.nth(a).click();
	await cards.nth(pair[0]).click();
	await expect(page.locator('.memory-card.is-matched')).toHaveCount(2);
	await expect(cards.nth(b)).not.toHaveClass(/is-lockout/);
	await cards.nth(b).click();
	await expect(cards.nth(b)).toHaveAttribute('aria-pressed', 'true');
});

test('swaps marks two exchanged positions until the next flip', async ({ page }) => {
	await memoryOnly(page, ['memory:swaps']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const deck = await symbols(page),
		cards = page.locator('.memory-card');
	const b = deck.findIndex((symbol) => symbol !== deck[0]);
	await cards.nth(0).click();
	await cards.nth(b).click();
	await expect(page.locator('.memory-card.is-marked')).toHaveCount(2);
	await expect(page.locator('.memory-card.is-marked').first()).toHaveAttribute(
		'aria-label',
		/swapped/
	);
	const after = await symbols(page);
	expect(after.filter((symbol, index) => symbol !== deck[index])).toHaveLength(2);
	const unmarked = await page
		.locator('.memory-card:not(.is-marked)')
		.first()
		.getAttribute('aria-label');
	expect(unmarked).toBeTruthy();
	await page.locator('.memory-card:not(.is-marked)').first().click();
	await expect(page.locator('.memory-card.is-marked')).toHaveCount(0);
});

test('two-backs shows one dotted and one striped back per pair with accessible names', async ({
	page
}) => {
	await memoryOnly(page, ['memory:two-backs']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const count = await page.locator('.memory-card').count();
	await expect(page.locator('.memory-card[aria-label$="dotted back"]')).toHaveCount(count / 2);
	await expect(page.locator('.memory-card[aria-label$="striped back"]')).toHaveCount(count / 2);
	await expect(page.locator('.back-pattern')).toHaveCount(count);
});

test('quads fits 24 cards at all three required sizes and matches four at a time', async ({
	page
}) => {
	await memoryOnly(page, ['memory:quads'], 1);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await expect(page.locator('.memory-card')).toHaveCount(24);
	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		await page.waitForTimeout(100);
		expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
			false
		);
		const stage = (await page.locator('.stage').boundingBox())!;
		for (const card of await page.locator('.memory-card').all()) {
			const box = (await card.boundingBox())!;
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.x).toBeGreaterThanOrEqual(stage.x - 1);
			expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
			expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
		}
	}
	await page.setViewportSize({ width: 1280, height: 800 });
	const deck = await deckOf(page);
	const group = deck.flatMap((symbol, index) => (symbol === deck[0] ? [index] : []));
	expect(group).toHaveLength(4);
	for (const index of group.slice(0, 3)) await open(page).nth(index).click();
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(3);
	await open(page).nth(group[3]).click();
	await expect(page.locator('.memory-card.is-matched')).toHaveCount(4);
});

test('collapse removes matched cards and keeps focus on a surviving card', async ({ page }) => {
	await memoryOnly(page, ['memory:collapse']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const deck = await symbols(page),
		cards = page.locator('.memory-card');
	const group = deck.flatMap((symbol, index) => (symbol === deck[0] ? [index] : []));
	await cards.nth(group[0]).click();
	await cards.nth(group[1]).focus();
	await page.keyboard.press('Enter');
	await expect(cards).toHaveCount(deck.length - 2);
	await expect(page.locator('.memory-card.is-matched')).toHaveCount(0);
	await expect
		.poll(() => page.evaluate(() => document.activeElement?.classList.contains('memory-card')))
		.toBe(true);
	const remaining = await symbols(page);
	expect(remaining).toEqual(deck.filter((symbol) => symbol !== deck[0]));
});
