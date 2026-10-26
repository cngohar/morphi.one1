import { expect, test, type Page } from '@playwright/test';
import { fixSelectorSeed } from './entropy.js';

test.beforeEach(async ({ page }) => {
	await fixSelectorSeed(page);
});

async function startBlock(page: Page): Promise<void> {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.locator('.game[data-family="block"]')).toHaveAttribute('data-phase', 'playing');
}

async function dragOverBoard(page: Page) {
	const index = await page.locator('button.tray-slot').evaluateAll((slots) => {
		const slot = slots.find((element) => {
			const cell = element.querySelector<HTMLElement>('.mini-cell');
			return cell?.style.gridColumn === '1' && cell.style.gridRow === '1';
		});
		return slot?.getAttribute('data-tray-index');
	});
	expect(index).toBeTruthy();
	const slot = page.locator(`button.tray-slot[data-tray-index="${index}"]`);
	const source = await slot.locator('.mini-cell').first().boundingBox();
	const target = await page.locator('.board .cell[data-index="0"]').boundingBox();
	expect(source).not.toBeNull();
	expect(target).not.toBeNull();
	await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
	await page.mouse.down();
	await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2);
	await expect(page.locator('.ghost')).toBeVisible();
	return slot;
}

test('a failed seed draw preserves the pending selector draw on retry', async ({ page }) => {
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		let draws = 0;
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2 && ++draws === 2) {
				throw new Error('Simulated entropy failure');
			}
			return original(array);
		};
	});
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.getByRole('alert')).toBeVisible();
	await page.getByRole('button', { name: 'Try again', exact: true }).click();
	await expect(page.locator('.game[data-family="block"]')).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('two synchronous Play activations start only one round', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).evaluate((button) => {
		if (!(button instanceof HTMLButtonElement)) throw new Error('Play must be a button');
		button.click();
		button.click();
	});
	await expect(page.locator('.game[data-family="block"]')).toBeVisible();
	await expect(page.locator('.round-meta')).toContainText('Round 1');
	await page.getByRole('button', { name: 'Back to home' }).click();
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.locator('.game')).toBeVisible();
});

test('a drop outside uses pointerup coordinates rather than the previous valid ghost', async ({
	page
}) => {
	await startBlock(page);
	const slot = await dragOverBoard(page);
	await slot.dispatchEvent('pointerup', {
		pointerId: 1,
		pointerType: 'mouse',
		isPrimary: true,
		clientX: 0,
		clientY: 0
	});
	await page.mouse.up();
	await expect(page.locator('.ghost')).toHaveCount(0);
	await expect(page.locator('.board .cell.is-filled')).toHaveCount(0);
});

test('a secondary touch cannot replace the active drag', async ({ page }) => {
	await startBlock(page);
	const slot = await dragOverBoard(page);
	const index = await slot.getAttribute('data-tray-index');
	await page
		.locator(`button.tray-slot:not([data-tray-index="${index}"])`)
		.first()
		.dispatchEvent('pointerdown', {
			pointerId: 2,
			pointerType: 'touch',
			isPrimary: false,
			clientX: 0,
			clientY: 0
		});
	await page.mouse.up();
	await expect(page.locator('.board .cell.is-filled').first()).toBeVisible();
});

test('lost capture and window blur cancel a drag without placing', async ({ page }) => {
	await startBlock(page);
	const slot = await dragOverBoard(page);
	await slot.dispatchEvent('lostpointercapture', { pointerId: 1, pointerType: 'mouse' });
	await expect(page.locator('.ghost')).toHaveCount(0);
	await page.mouse.up();
	await dragOverBoard(page);
	await page.evaluate(() => window.dispatchEvent(new Event('blur')));
	await expect(page.locator('.ghost')).toHaveCount(0);
	await page.mouse.up();
	await expect(page.locator('.board .cell.is-filled')).toHaveCount(0);
});

test('held Enter does not select and immediately place a piece', async ({ page }) => {
	await startBlock(page);
	const slot = page.locator('button.tray-slot').first();
	await slot.press('Enter');
	await slot.dispatchEvent('keydown', { key: 'Enter', repeat: true });
	await expect(slot).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.board .cell.is-filled')).toHaveCount(0);
});

test('Memory preserves the mismatch hold while hidden', async ({ page }) => {
	await page.goto('/memory', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	const cards = page.locator('.memory-card');
	await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
	const labels = await cards.evaluateAll((elements) =>
		elements.map((e) => e.getAttribute('aria-label')?.split(', ')[1])
	);
	const other = labels.findIndex((label) => label !== labels[0]);
	expect(other).toBeGreaterThan(0);
	await expect(cards.first()).toBeEnabled({ timeout: 10000 });
	await cards.first().click();
	await cards.nth(other).click();
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	// This exceeds the normal 500 ms hold, but hidden time must not consume it.
	await page.waitForTimeout(700);
	await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
	await expect(cards.nth(other)).toHaveAttribute('aria-pressed', 'true');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(cards.first()).toHaveAttribute('aria-pressed', 'false');
	await expect(cards.nth(other)).toHaveAttribute('aria-pressed', 'false');
});
