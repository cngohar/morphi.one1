import { expect, test, type Page } from '@playwright/test';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';
import {
	candidateMask,
	createSudokuRound,
	SUDOKU_VARIANTS
} from '../../src/lib/puzzles/sudoku/logic.js';

const FAMILY = 'sudoku';
const CLASSIC = 'sudoku:classic';
const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const sizes = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];

async function start(
	page: Page,
	variant = CLASSIC,
	seed = '1',
	waitForGame = true,
	reducedMotion: 'reduce' | 'no-preference' = 'reduce'
) {
	await page.emulateMedia({ reducedMotion });
	const available = familyIndex.filter((entry) => entry.enabled && entry.weight > 0);
	await page.route('**/api/play/availability**', (route) =>
		route.fulfill({
			json: new URL(route.request().url()).searchParams.has('family')
				? { available: true }
				: {
						available: available.map((entry) => entry.id),
						weights: Object.fromEntries(available.map((entry) => [entry.id, entry.weight])),
						variants: Object.fromEntries(
							available.map((entry) => [
								entry.id,
								entry.id === FAMILY
									? [variant]
									: (puzzleMetadata[entry.id].variants ?? []).map((row) => row.id)
							])
						)
					}
		})
	);
	await page.route('**/api/play/scoring**', (route) => {
		const family = new URL(route.request().url()).searchParams.get('family')!;
		const config = puzzleMetadata[family]?.scoring ?? puzzleMetadata[FAMILY].scoring;
		return route.fulfill({ json: { version: config.version, values: config.defaults } });
	});
	await page.addInitScript(
		({ seed, ids }) => {
			const original = crypto.getRandomValues.bind(crypto);
			crypto.getRandomValues = (array) => {
				if (array instanceof Uint32Array && array.length === 2) {
					array[0] = 0;
					array[1] = Number(seed);
					return array;
				}
				return original(array);
			};
			localStorage.setItem('morphi.sound', 'off');
			localStorage.setItem(
				'morphi.selector.v2.guest',
				JSON.stringify({
					version: 1,
					eligible: ids,
					queue: ['sudoku', ...ids.filter((id) => id !== 'sudoku')],
					recent: [],
					cyclePosition: 0
				})
			);
		},
		{ seed, ids: available.map((entry) => entry.id) }
	);
	await page.goto('/play');
	const game = page.locator('.game[data-family="sudoku"]');
	if (waitForGame) await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 30000 });
	return game;
}

const cell = (page: Page, index: number) => page.locator(`[data-sudoku-cell="${index}"]`);

async function solve(page: Page, variant = CLASSIC, seed = '1') {
	const round = createSudokuRound(seed, variant);
	for (const [index, digit] of round.solution.entries()) {
		if (round.givens[index] || (await cell(page, index).innerText()) === String(digit)) continue;
		await cell(page, index).click();
		await page.locator(`[data-sudoku-digit="${digit}"]`).click();
	}
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
}

for (const size of sizes) {
	test(`Classic board fits and solves at ${size.width}×${size.height}`, async ({ page }) => {
		await page.setViewportSize(size);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const game = await start(page);
		await expect(game.getByText('Every row, column and box holds 1–9 exactly once.')).toBeVisible();
		const board = game.getByRole('group', { name: 'Sudoku board' });
		const bounds = await board.boundingBox();
		expect(bounds).not.toBeNull();
		expect(bounds!.x).toBeGreaterThanOrEqual(0);
		expect(bounds!.y).toBeGreaterThanOrEqual(0);
		expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
		expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			size.width
		);
		await solve(page);
		expect(errors).toEqual([]);
	});
}

test('Classic notes, placement, Undo, Restart and Hint work via the controls', async ({ page }) => {
	const game = await start(page);
	const generated = createSudokuRound('1', CLASSIC);
	const index = generated.givens.indexOf(0);
	const button = cell(page, index);
	const digit = generated.solution[index]!;
	await button.click();
	await game.getByRole('button', { name: 'Notes', exact: true }).click();
	await page.keyboard.press(String(digit));
	await expect(button.locator('.notes')).toHaveText(String(digit));
	await game.getByRole('button', { name: 'Notes', exact: true }).click();
	await page.keyboard.press(String(digit));
	await expect(button.locator('.digit')).toHaveText(String(digit));
	await game.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(button.locator('.notes')).toHaveText(String(digit));
	await game.getByRole('button', { name: 'Restart', exact: true }).click();
	await expect(game.getByText('Restart this board?', { exact: false })).toBeVisible();
	await game.getByRole('button', { name: 'Restart', exact: true }).click();
	await expect(button.locator('.notes')).toHaveCount(0);
	await game.getByRole('button', { name: 'Hint', exact: true }).click();
	await expect(button.locator('.digit')).toHaveText(String(digit));
	await solve(page);
	await expect(page.locator('.result-stats')).toHaveAttribute('aria-label', /solved with hint/i);
	await expect(page.getByRole('button', { name: 'Next puzzle', exact: true })).toBeEnabled();
	await page.keyboard.press('n');
	await expect(page.locator('.game[data-family="sudoku"]')).toHaveCount(0, { timeout: 20000 });
});

for (const variant of SUDOKU_VARIANTS.slice(1)) {
	test(`plays and solves ${variant}`, async ({ page }) => {
		const game = await start(page, variant);
		if (variant === 'sudoku:irregular') {
			await expect(
				game.getByText('Every row, column and irregular region holds 1–9 exactly once.')
			).toBeVisible();
			await expect(game.getByText('Every row, column and box holds 1–9 exactly once.')).toHaveCount(
				0
			);
		}
		if (variant === 'sudoku:no-hint')
			await expect(game.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
		await solve(page, variant);
	});
}

test('replacements respect givens, conflicts and mistakes', async ({ page }) => {
	const game = await start(page);
	const round = createSudokuRound('1', CLASSIC);
	const index = round.givens.findIndex(
		(given, cell) =>
			!given &&
			digits.some(
				(value) =>
					value !== round.solution[cell] && candidateMask(round.givens, cell) & (1 << value)
			)
	);
	expect(index).toBeGreaterThanOrEqual(0);
	const correct = round.solution[index]!;
	const wrong = digits.find(
		(value) => value !== correct && candidateMask(round.givens, index) & (1 << value)
	)!;
	const conflict = round.givens[round.peers[index]!.find((peer) => round.givens[peer])!]!;
	const enter = (value: number) => game.locator(`[data-sudoku-digit="${value}"]`).click();
	await cell(page, round.givens.findIndex(Boolean)).click();
	await enter(correct);
	await expect(game.getByRole('status')).toContainText('given');
	await cell(page, index).click();
	await enter(correct);
	await expect(cell(page, index).locator('.digit')).toHaveText(String(correct));
	await enter(correct);
	await expect(game.getByRole('status')).not.toContainText('mistake');
	await enter(conflict);
	await expect(game.getByRole('status')).toContainText('No mistake was counted');
	await expect(cell(page, index).locator('.digit')).toHaveText(String(correct));
	await enter(wrong);
	await expect(cell(page, index)).toHaveClass(/\bwrong\b/);
	await expect(game.getByRole('status')).toContainText('Mistake 1');
	await enter(correct);
	await expect(cell(page, index)).not.toHaveClass(/\bwrong\b/);
	await enter(wrong);
	await enter(correct);
	await enter(wrong);
	await expect(page.locator('.result-number')).toHaveText('0');
	await expect(page.locator('.result-stats')).toHaveAttribute('aria-label', /three mistakes/i);
});

test('countdown keeps its original deadline across Restart and shows a loss at zero', async ({
	page
}) => {
	await page.clock.install();
	const game = await start(page, 'sudoku:countdown-600');
	await page.clock.fastForward(590_000);
	await expect(game.locator('[data-countdown]')).toHaveAttribute('data-countdown', '10');
	await game.getByRole('button', { name: 'Restart', exact: true }).click();
	await expect(game.locator('[data-countdown]')).toHaveAttribute('data-countdown', '10');
	await page.clock.fastForward(10_000);
	await expect(page.locator('.result-number')).toHaveText('0');
	await expect(page.locator('.result-stats')).toHaveAttribute('aria-label', /time.s up/i);
});

test('entrance reveals the cells before the givens and locks input', async ({ page }) => {
	const game = await start(page, CLASSIC, '1', false, 'no-preference');
	await expect(game).toHaveAttribute('data-phase', 'opening');
	const given = game.locator('.given .digit').first();
	await expect(given).toHaveCSS('opacity', '0');
	await expect(game.locator('[data-sudoku-digit="1"]')).toBeDisabled();
	await expect(given).not.toHaveCSS('opacity', '0', { timeout: 4500 });
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 6500 });
	await expect(game.locator('[data-sudoku-digit="1"]')).toBeEnabled();
});

async function storeGuestCheckpoint(
	page: Page,
	seed: string,
	moves: { action: number; cell: number; value: number }[]
) {
	await page.goto('/');
	await page.evaluate(
		async ({ family, seed, config, moves }) => {
			await new Promise<void>((resolve, reject) => {
				const opening = indexedDB.open('morphi-checkpoint', 1);
				opening.onupgradeneeded = () => opening.result.createObjectStore('active');
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const db = opening.result;
					const tx = db.transaction('active', 'readwrite');
					tx.objectStore('active').put(
						{
							version: 1,
							id: '4f87bbdc-5ccc-441f-a9a0-14be85cc30be',
							owner: null,
							family,
							seed,
							engineVersion: 'sudoku-1',
							difficulty: null,
							modifiers: {},
							theme: null,
							scoring: config,
							moves,
							state: { phase: 'playing', elapsedMs: 0, clockStarted: true, pending: {} },
							status: 'active',
							savedAt: Date.now(),
							rankedSession: null,
							rankedStartedAt: null
						},
						'guest'
					);
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => {
						db.close();
						reject(tx.error);
					};
				};
			});
		},
		{
			family: FAMILY,
			seed,
			moves,
			config: {
				version: 'brief-v1',
				values: { ...puzzleMetadata.sudoku.scoring.defaults, mistakeLimit: 0 }
			}
		}
	);
}

test('an oversized stored checkpoint is discarded before resume', async ({ page }) => {
	await storeGuestCheckpoint(
		page,
		'1',
		Array.from({ length: 10001 }, () => ({ action: 2, cell: 1, value: 1 }))
	);
	const discarded = page.waitForEvent('console', {
		predicate: (message) =>
			message.type() === 'warning' && message.text().includes('checkpoint_discarded')
	});
	await start(page);
	expect((await discarded).text()).toContain('invalid_or_expired');
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
});

test('stage offers Retry and Home when the Sudoku view cannot load', async ({ page }) => {
	await page.route('**/src/lib/puzzles/sudoku/View.svelte*', (route) => route.abort());
	await start(page, CLASSIC, '1', false);
	await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible({
		timeout: 20000
	});
	await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeVisible();
	await page.unroute('**/src/lib/puzzles/sudoku/View.svelte*');
	await page.getByRole('button', { name: 'Try again', exact: true }).click();
	await expect(page.locator('.game[data-family="sudoku"]')).toHaveAttribute(
		'data-phase',
		'playing',
		{ timeout: 20000 }
	);
});

test('a missing animation settles the round with input available', async ({ page }) => {
	await page.route('**/src/lib/puzzles/sudoku/motion.ts*', async (route) => {
		const response = await route.fetch();
		const body = await response.text();
		expect(body).toContain('timeline = createTimeline');
		await route.fulfill({
			response,
			body: body.replace(
				'timeline = createTimeline',
				'throw new Error("test_motion_failure"); timeline = createTimeline'
			)
		});
	});
	await start(page, CLASSIC, '1', false, 'no-preference');
	const game = page.locator('.game[data-family="sudoku"]');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 20000 });
	await expect(game.locator('[data-sudoku-digit="1"]')).toBeEnabled();
	await expect(game.locator('[data-sudoku-cell]').first()).toHaveCSS('opacity', '1');
});

test('a capped board with no terminal action can be abandoned', async ({ page }) => {
	const seed = '42';
	const round = createSudokuRound(seed);
	const index = round.givens.indexOf(0);
	await storeGuestCheckpoint(
		page,
		seed,
		Array.from({ length: 9999 }, () => ({ action: 2, cell: index, value: 1 }))
	);
	const game = await start(page, CLASSIC, '1', false);
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await expect(game).toHaveAttribute('data-seed', seed);
	const another = game.getByRole('button', { name: 'Try another puzzle' });
	await expect(another).toBeEnabled();
	await expect(game.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
	await another.click();
	await expect(another).toHaveCount(0);
	await expect(page.locator('.result-number')).not.toBeVisible();
});

test('keyboard notes, edit, Undo, Hint and Restart survive rotation', async ({ page }) => {
	await page.setViewportSize(sizes[0]!);
	const game = await start(page);
	const round = createSudokuRound('1');
	const index = round.givens.indexOf(0);
	const digit = round.solution[index]!;
	for (let row = 0; row < Math.floor(index / 9); row++) await page.keyboard.press('ArrowDown');
	for (let column = 0; column < index % 9; column++) await page.keyboard.press('ArrowRight');
	await page.keyboard.press('n');
	await page.keyboard.press(String(digit));
	await expect(cell(page, index).locator('.notes')).toHaveText(String(digit));
	await page.keyboard.press('n');
	await page.keyboard.press(String(digit));
	await page.setViewportSize(sizes[1]!);
	await expect(cell(page, index).locator('.digit')).toHaveText(String(digit));
	await page.keyboard.press('Backspace');
	await expect(cell(page, index).locator('.digit')).toHaveCount(0);
	await page.keyboard.press('Control+z');
	await expect(cell(page, index).locator('.digit')).toHaveText(String(digit));
	await page.keyboard.press('h');
	await expect(game.locator('.sudoku-cell.hinted')).toHaveCount(1);
	await page.keyboard.press('r');
	await expect(game.getByRole('button', { name: 'Restart', exact: true })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(cell(page, index).locator('.digit')).toHaveCount(0);
});
