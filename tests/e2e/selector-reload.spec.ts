import { expect, test } from '@playwright/test';
import { createRng } from '../../src/lib/engine/rng.js';
import { createPuzzleSelector, type PuzzleSelectorState } from '../../src/lib/selector.js';

const guestKey = 'morphi.selector.v2.guest';

test('guest selector resumes its queued cycle after refreshing /play', async ({ page }) => {
	const scores = {
		block: { line: 100, extraLine: 50, combo: 50 },
		memory: { pair: 1000, mismatch: 150, second: 5 },
		connect: { pair: 200, grid: 1000, second: 10, redraw: 50 }
	};
	await page.route('**/api/play/availability**', async (route) => {
		const requested = new URL(route.request().url()).searchParams.get('family');
		const body = requested
			? { available: true }
			: { available: ['block', 'memory', 'connect'], weights: { block: 1, memory: 1, connect: 1 } };
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(body)
		});
	});
	await page.route('**/api/play/scoring**', async (route) => {
		const family = new URL(route.request().url()).searchParams.get('family') as
			keyof typeof scores | null;
		const values = family ? scores[family] : undefined;
		await route.fulfill({
			status: values ? 200 : 400,
			contentType: 'application/json',
			body: JSON.stringify(values ? { version: 'brief-v1', values } : {})
		});
	});
	await page.addInitScript((key: string) => {
		const getItem = Storage.prototype.getItem;
		let captured = false;
		Object.defineProperty(window, '__selectorRestoreRead', {
			configurable: true,
			writable: true,
			value: null
		});
		Storage.prototype.getItem = function (name: string) {
			const value = getItem.call(this, name);
			if (name === key && !captured) {
				captured = true;
				(window as Window & { __selectorRestoreRead?: string | null }).__selectorRestoreRead =
					value;
			}
			return value;
		};
	}, guestKey);

	await page.goto('/play', { waitUntil: 'domcontentloaded' });
	const game = page.locator('.game[data-family]');
	await expect(game).toBeVisible({ timeout: 20_000 });
	await page.waitForFunction(
		(key) => {
			try {
				const state = JSON.parse(localStorage.getItem(key) ?? 'null') as {
					version?: number;
					queue?: unknown;
					recent?: unknown;
				};
				return (
					state.version === 1 &&
					Array.isArray(state.queue) &&
					state.queue.length > 1 &&
					Array.isArray(state.recent) &&
					state.recent.length > 0
				);
			} catch {
				return false;
			}
		},
		guestKey,
		{ timeout: 20_000 }
	);

	const savedRaw = await page.evaluate((key) => localStorage.getItem(key), guestKey);
	expect(savedRaw).not.toBeNull();
	const before = JSON.parse(savedRaw!) as PuzzleSelectorState<string>;
	const currentFamily = await game.getAttribute('data-family');
	expect(before.recent.at(-1)).toBe(currentFamily);
	expect(before.queue.length).toBeGreaterThan(1);
	expect(
		await page.evaluate(
			(prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix)),
			'morphi.selector.v2.'
		)
	).toEqual([guestKey]);

	const expectedSelector = createPuzzleSelector({
		families: before.eligible.map((family) => ({ family, weight: 1 })),
		rng: createRng('6789'),
		state: before
	});
	const expectedFamily = expectedSelector.next();
	const expectedAfter = expectedSelector.snapshot();
	expect(expectedFamily).toBe(before.queue[0]);

	await page.reload({ waitUntil: 'domcontentloaded' });
	await expect(game).toBeVisible({ timeout: 30_000 });
	await expect(game).toHaveAttribute('data-family', expectedFamily);
	await page.waitForFunction(
		({ key, expected }) => {
			try {
				return (
					JSON.stringify(JSON.parse(localStorage.getItem(key) ?? 'null')) ===
					JSON.stringify(expected)
				);
			} catch {
				return false;
			}
		},
		{ key: guestKey, expected: expectedAfter },
		{ timeout: 20_000 }
	);

	const restoredRaw = await page.evaluate(
		() =>
			(window as Window & { __selectorRestoreRead?: string | null }).__selectorRestoreRead ?? null
	);
	expect(restoredRaw).not.toBeNull();
	expect(JSON.parse(restoredRaw!)).toEqual(before);
	const afterRaw = await page.evaluate((key) => localStorage.getItem(key), guestKey);
	expect(JSON.parse(afterRaw!)).toEqual(expectedAfter);
});
