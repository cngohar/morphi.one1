import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type BlockMove = { trayIndex: number; x: number; y: number };
const vectors = JSON.parse(readFileSync('tests/vectors/block-variants.json', 'utf8')) as {
	seed: string;
	variant: string;
	moves: BlockMove[];
}[];

const variants = ['block:classic', 'block:board-10', 'block:rows-only', 'block:rush-60'];
async function blockOnly(page: Page, enabled = variants) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.clock.install();
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
				: { available: ['block'], weights: { block: 1 }, variants: { block: enabled } }
		});
	});
	await page.route('**/api/play/scoring**', (route) =>
		route.fulfill({
			json: { version: 'brief-v1', values: { line: 100, extraLine: 50, combo: 50 } }
		})
	);
}
async function place(page: Page, move: BlockMove, size = 8) {
	const slot = page.locator(`[data-tray-index="${move.trayIndex}"]`);
	await expect(slot).toHaveAttribute('aria-disabled', 'false');
	await slot.click();
	await page
		.locator('[role=gridcell]')
		.nth(move.y * size + move.x)
		.click();
	await page.clock.runFor(1600);
}
async function finish(page: Page, variant: string) {
	const fixture = vectors.find((entry) => entry.seed === '42' && entry.variant === variant)!;
	if (variant === 'block:rush-60') {
		await place(page, fixture.moves[0]);
		await page.clock.fastForward(60000);
	} else
		for (const move of fixture.moves)
			await place(page, move, variant === 'block:board-10' ? 10 : 8);
	await expect(page.locator('.result')).toBeVisible({ timeout: 15000 });
}
for (const [variant, label] of [
	['block:classic', 'Classic'],
	['block:board-10', '10 x 10 board'],
	['block:rows-only', 'Rows only'],
	['block:rush-60', '60-second rush']
]) {
	test(`${variant} labels HUD, help and result`, async ({ page }) => {
		await blockOnly(page, [variant]);
		await page.goto('/play');
		await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', {
			timeout: 15000
		});
		await expect(page.locator('.round-meta')).toContainText(`Block · ${label}`);
		await page.getByRole('button', { name: 'How to play', exact: true }).click();
		await expect(page.locator('dialog[open]')).toContainText(`Block · ${label}`);
		if (variant === 'block:board-10')
			await expect(page.locator('dialog[open]')).toContainText('10 × 10');
		if (variant === 'block:rows-only')
			await expect(page.locator('dialog[open]')).toContainText('Columns never clear');
		if (variant === 'block:rush-60')
			await expect(page.locator('dialog[open]')).toContainText('60-second clock');
		await page.keyboard.press('Escape');
		if (variant === 'block:rush-60')
			await page.evaluate(() => {
				const endings: { headline: string; subline: string }[] = [];
				Object.assign(window, { blockEndings: endings });
				new MutationObserver(() => {
					const headline = document.querySelector('.ending strong');
					const subline = document.querySelector('.ending span');
					if (headline && subline)
						endings.push({
							headline: headline.textContent ?? '',
							subline: subline.textContent ?? ''
						});
				}).observe(document.body, { childList: true, subtree: true, characterData: true });
			});
		await finish(page, variant);
		await expect(page.locator('.result .eyebrow').first()).toHaveText(
			`Run ended · Block · ${label}`
		);
		if (variant === 'block:rush-60') {
			await expect(page.locator('.result-stats')).toHaveAttribute('aria-label', /^Time's up ·/);
			expect(await page.evaluate(() => Reflect.get(window, 'blockEndings'))).toContainEqual({
				headline: "Time's up!",
				subline: '60 seconds complete · 0 points · 1 pieces'
			});
		}
	});
}

test('10 × 10 board fits the three emulated viewport sizes', async ({ page }) => {
	await blockOnly(page, ['block:board-10']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 844, height: 390 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(viewport);
		await expect(page.getByRole('grid', { name: '10 by 10 board' })).toBeVisible();
		await expect(page.locator('[role=gridcell]')).toHaveCount(100);
		expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
			false
		);
		const board = await page.locator('.board').boundingBox();
		expect(board!.x).toBeGreaterThanOrEqual(0);
		expect(board!.y + board!.height).toBeLessThanOrEqual(viewport.height + 1);
		expect(board!.x + board!.width).toBeLessThanOrEqual(viewport.width + 1);
	}
});

test('rush starts only on valid placement and expires through Help and an emulated hidden page without extra moves', async ({
	page
}) => {
	await blockOnly(page, ['block:rush-60']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await page.clock.fastForward(5000);
	await expect(page.locator('[data-countdown]')).toHaveAttribute('data-countdown', '60');
	await page.locator('button[data-tray-index]:not([aria-label*="single block"])').first().click();
	await page.locator('[role=gridcell]').last().click();
	await expect(page.locator('[data-countdown]')).toHaveAttribute('data-countdown', '60');
	const move = vectors.find((entry) => entry.seed === '42' && entry.variant === 'block:rush-60')!
		.moves[0];
	// Deselect the invalid selection before the real placement.
	await page.keyboard.press('Escape');
	await place(page, move);
	await page.getByRole('button', { name: 'How to play', exact: true }).click();
	await page.clock.fastForward(10000);
	await expect(page.locator('[data-countdown]')).toHaveAttribute('data-countdown', '49');
	await page.keyboard.press('Escape');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.clock.fastForward(50000);
	await expect(page.locator('[data-countdown]')).toHaveAttribute('data-countdown', '0');
	await expect(page.locator('.tray-slot:not(.is-empty)').first()).toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await page.locator('.tray-slot:not(.is-empty)').first().dispatchEvent('click');
	await page.locator('[role=gridcell]').last().dispatchEvent('click');
	const saved = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const opening = indexedDB.open('morphi-progress', 1);
			opening.onsuccess = () => resolve(opening.result);
			opening.onerror = () => reject(opening.error);
		});
		return await new Promise<{ run: { moves: unknown[] } }[]>((resolve, reject) => {
			const query = db.transaction('pending').objectStore('pending').getAll();
			query.onsuccess = () => {
				db.close();
				resolve(query.result);
			};
			query.onerror = () => reject(query.error);
		});
	});
	expect(saved).toHaveLength(1);
	expect(saved[0].run.moves).toHaveLength(1);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(page.locator('.result')).toBeVisible();
});

test('rush checkpoint reload includes time spent away and preserves the variant', async ({
	page
}) => {
	await blockOnly(page, ['block:rush-60']);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await place(
		page,
		vectors.find((entry) => entry.seed === '42' && entry.variant === 'block:rush-60')!.moves[0]
	);
	await page.getByRole('button', { name: 'How to play', exact: true }).click();
	await page.clock.fastForward(10000);
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(page.locator('.game')).toHaveAttribute('data-variant', 'block:rush-60');
	const remaining = Number(await page.locator('[data-countdown]').getAttribute('data-countdown'));
	expect(remaining).toBeLessThanOrEqual(49);
	expect(remaining).toBeGreaterThan(0);
	await page.clock.fastForward(60000);
	await expect(page.locator('.result')).toBeVisible();
});

test('selector rotates enabled Block variants without consecutive repeats', async ({ page }) => {
	await blockOnly(page);
	await page.goto('/play');
	let last: string | null = null;
	for (let i = 0; i < 4; i++) {
		await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', {
			timeout: 15000
		});
		const variant = await page.locator('.game').getAttribute('data-variant');
		expect(variants).toContain(variant);
		expect(variant).not.toBe(last);
		last = variant;
		await finish(page, variant!);
		await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
		await expect(page.locator('.game')).toHaveAttribute('data-round', String(i + 2));
	}
});
