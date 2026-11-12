import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
const vectors = JSON.parse(readFileSync('tests/vectors/nonogram.json', 'utf8')) as {
	generation: { seed: string; variant: string; size: number; solution: number[] }[];
};

function seedFor(size: number, variant = 'nonogram:classic') {
	const vector = vectors.generation.find(
		(value) => value.variant === variant && value.size === size
	);
	if (!vector) throw new Error('Missing seeded Nonogram fixture');
	return Number(vector.seed);
}
async function seeded(page: Page, size = 5, reduced = true, variant = 'nonogram:classic') {
	if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
	const seed = seedFor(size, variant);
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
		localStorage.setItem('morphi.sound', 'off');
	}, seed);
	await page.goto('/play');
	const game = page.locator('.nonogram-game');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await expect(game).toHaveAttribute('data-size', String(size));
	return { game, round: vectors.generation.find((vector) => vector.seed === String(seed))! };
}

for (const [width, height] of [
	[390, 844],
	[844, 390],
	[1280, 800]
] as const) {
	for (const size of [5, 10, 15]) {
		test(`baseline ${size}×${size} fits ${width}×${height} with clue-only backdrop`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height });
			await seeded(page, size);
			await expect(page.locator('.nonogram-cell')).toHaveCount(size * size);
			const bounds = await page.locator('.nonogram-cell').first().boundingBox();
			expect(bounds!.width).toBeGreaterThan(8);
			const board = (await page.locator('.nonogram-board').boundingBox())!;
			expect(board.x).toBeGreaterThanOrEqual(0);
			expect(board.x + board.width).toBeLessThanOrEqual(width);
			expect(board.y + board.height).toBeLessThanOrEqual(height);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			if (width === 390 && size > 5) expect(bounds!.width).toBeLessThan(44);
			const motifs = page.locator('.theme-backdrop svg');
			if (width < 1024 || height < 560) await expect(motifs.first()).toBeHidden();
			else {
				await expect(motifs.first()).toBeVisible();
				expect(await motifs.count()).toBeGreaterThanOrEqual(2);
				expect(await motifs.count()).toBeLessThanOrEqual(10);
			}
			expect(
				await motifs.evaluateAll((nodes) =>
					nodes.every((node) => node.getAttribute('data-item') === 'clue-grid')
				)
			).toBe(true);
			await mkdir('build/v1.4.1/browser', { recursive: true });
			await page.screenshot({
				path: `build/v1.4.1/browser/baseline-${size}-${width}x${height}.png`
			});
		});
	}
}

test('baseline keyboard solve shows ending/result and Next rotates away', async ({ page }) => {
	const { round } = await seeded(page);
	const answer = round.solution;
	for (const [cell, mark] of answer.entries()) {
		if (!mark) continue;
		await page.locator('.nonogram-cell').nth(cell).focus();
		await page.keyboard.press('Space');
	}
	await expect(page.locator('.ending')).toContainText('Picture complete!');
	await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
	await expect(page.locator('.result-stats')).toContainText('Mistakes');
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await expect(page.locator('.nonogram-game')).toHaveCount(0, { timeout: 15000 });
});

test('baseline helpers undo a whole locked stroke, restart preserves seed, keyboard X is free', async ({
	page
}) => {
	const { game } = await seeded(page);
	await page.locator('.nonogram-cell').nth(0).focus();
	await page.keyboard.press('x');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('x');
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(2);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(1);
	const seed = await game.getAttribute('data-seed');
	await page.getByRole('button', { name: 'Hint', exact: true }).click();
	await expect(page.locator('.nonogram-cell.hinted')).toHaveCount(1);
	await page.getByRole('button', { name: 'Restart', exact: true }).click();
	await expect(game).toHaveAttribute('data-seed', seed!);
	await expect(page.locator('.nonogram-cell.filled')).toHaveCount(0);
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(0);
});

for (const variant of [
	'colour-2',
	'colour-5',
	'partial-clues',
	'totals-only',
	'unchecked',
	'strict-count',
	'countdown',
	'three-hearts',
	'no-undo',
	'hint-budget'
]) {
	test(`Batch A ${variant} teaches its rule and clears from the frozen vector`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const { game, round } = await seeded(page, 5, true, `nonogram:${variant}`);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await expect(page.locator('.public-header')).toContainText('Nonogram');
		const teaching = (await page.locator('.entrance-rule').boundingBox())!;
		const statistic = (await page.locator('.nonogram-game .stat-label').first().boundingBox())!;
		expect(teaching.y + teaching.height).toBeLessThanOrEqual(statistic.y);
		expect(await game.textContent()).not.toContain(`nonogram:${variant}`);
		await page.getByRole('button', { name: 'How to play', exact: true }).click();
		await expect(page.locator('dialog[open]')).toContainText('Nonogram');
		await page.keyboard.press('Escape');
		for (const [cell, mark] of round.solution.entries()) {
			if (!mark && variant !== 'unchecked') continue;
			if (mark > 0 && variant.startsWith('colour-'))
				await page.getByRole('button', { name: `Colour ${mark}`, exact: true }).click();
			await page.locator('.nonogram-cell').nth(cell).focus();
			await page.keyboard.press(mark ? 'Space' : 'x');
		}
		await expect(page.locator('.ending')).toContainText('Picture complete!');
		await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
	});
}

for (const variant of ['colour-2', 'colour-5', 'partial-clues', 'totals-only']) {
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800]
	] as const) {
		test(`${variant} 15×15 reflows at ${width}×${height}`, async ({ page }) => {
			await page.setViewportSize({ width, height });
			await seeded(page, 15, true, `nonogram:${variant}`);
			if (width === 390 && variant.startsWith('colour-')) {
				const cell = (await page.locator('.nonogram-cell').first().boundingBox())!;
				expect(cell.width).toBeGreaterThanOrEqual(19);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			const board = (await page.locator('.nonogram-board').boundingBox())!;
			expect(board.x).toBeGreaterThanOrEqual(0);
			expect(board.x + board.width).toBeLessThanOrEqual(width);
			expect(board.y + board.height).toBeLessThanOrEqual(height);
			await mkdir('build/v1.4.1/browser', { recursive: true });
			await page.screenshot({ path: `build/v1.4.1/browser/${variant}-15-${width}x${height}.png` });
		});
	}
}

test('three hearts loses with failed board viewable and no result save', async ({ page }) => {
	const { game, round } = await seeded(page, 5, true, 'nonogram:three-hearts');
	const empty = round.solution.indexOf(0);
	for (let i = 0; i < 3; i++) {
		await page.locator('.nonogram-cell').nth(empty).focus();
		await page.keyboard.press('Space');
	}
	await expect(game).toHaveAttribute('data-phase', 'finished');
	await expect(page.getByRole('button', { name: 'Try another puzzle', exact: true })).toBeVisible();
	await expect(page.locator('.nonogram-board')).toBeVisible();
	await expect(page.locator('.result')).toHaveCount(0);
	await page.getByRole('button', { name: 'Try another puzzle', exact: true }).click();
	await expect(page.locator('.nonogram-game')).toHaveCount(0, { timeout: 15000 });
});

test('unchecked and strict Check differ without leaking per-cell strict mistakes', async ({
	page
}) => {
	const { round } = await seeded(page, 5, true, 'nonogram:strict-count');
	await page.locator('.nonogram-cell').nth(round.solution.indexOf(0)).focus();
	await page.keyboard.press('Space');
	await expect(page.locator('.nonogram-cell.filled')).toHaveCount(1);
	await expect(page.locator('.nonogram-cell.mistake')).toHaveCount(0);
	await page.getByRole('button', { name: 'Check', exact: true }).click();
	await expect(page.locator('.nonogram-announcement')).toContainText('1 wrong filled cells');
	await expect(page.locator('.nonogram-cell.checked')).toHaveCount(0);
});

test('entrance blocks early input, pauses hidden and survives resize/reduced-motion changes', async ({
	page
}) => {
	const seed = seedFor(15);
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
	await page.goto('/play');
	const game = page.locator('.nonogram-game');
	await expect(game).toHaveAttribute('data-phase', 'arrival', { timeout: 15000 });
	await page.locator('.nonogram-cell').first().focus();
	await page.keyboard.press('Space');
	await expect(page.locator('.nonogram-cell.filled')).toHaveCount(0);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(2700);
	await expect(game).toHaveAttribute('data-phase', 'arrival');
	await page.setViewportSize({ width: 844, height: 390 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('checkpoint restores marks after reload and same seed after resume', async ({ page }) => {
	const { game } = await seeded(page);
	const seed = await game.getAttribute('data-seed');
	await page.locator('.nonogram-cell').first().focus();
	await page.keyboard.press('x');
	await page.waitForTimeout(700);
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(page.locator('.nonogram-game')).toHaveAttribute('data-phase', 'playing', {
		timeout: 15000
	});
	await expect(page.locator('.nonogram-game')).toHaveAttribute('data-seed', seed!);
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(1);
});

test('failed entrance motion settles to a playable board', async ({ page }) => {
	await page.route('**/src/lib/puzzles/nonogram/motion.ts*', async (route) => {
		const response = await route.fetch();
		await route.fulfill({
			response,
			body:
				(await response.text()) +
				'\nnonogramEnter = () => { throw new Error("injected motion failure"); };\n'
		});
	});
	await seeded(page);
	await expect(page.locator('.nonogram-board')).toHaveAttribute('data-motion-ready', 'true');
	await page.locator('.nonogram-cell').first().focus();
	await page.keyboard.press('x');
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(1);
});

test('countdown expiry leaves a viewable failed board and no saved result', async ({ page }) => {
	await page.clock.install();
	await seeded(page, 5, true, 'nonogram:countdown');
	await page.clock.fastForward(1_800_000);
	await page.clock.runFor(250);
	await expect(page.locator('.nonogram-game')).toHaveAttribute('data-phase', 'finished');
	await expect(page.locator('.nonogram-board')).toBeVisible();
	await expect(page.locator('.result')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Try another puzzle', exact: true })).toBeVisible();
});

test('pointer drag locks its row, Undo cancels it, and long-press/right-click/repeat handle X', async ({
	page
}) => {
	await seeded(page);
	const cells = page.locator('.nonogram-cell');
	const first = (await cells.first().boundingBox())!;
	const target = (await cells.nth(9).boundingBox())!;
	await page.getByRole('button', { name: 'X', exact: true }).click();
	await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
	await page.mouse.down();
	await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
	await page.mouse.up();
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(5);
	for (let cell = 0; cell < 5; cell++)
		await expect(cells.nth(cell)).toHaveAttribute('data-mark', '-1');
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(0);
	await cells.first().click({ button: 'right' });
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(1);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await page.getByRole('button', { name: 'Fill', exact: true }).click();
	const touch = await page.context().newCDPSession(page);
	await touch.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x: first.x + first.width / 2, y: first.y + first.height / 2 }]
	});
	await expect(cells.first()).toHaveAttribute('data-mark', '-1');
	await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await touch.detach();
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await cells.first().focus();
	await page.keyboard.down('x');
	await page.keyboard.down('x');
	await page.keyboard.up('x');
	await expect(page.locator('.nonogram-cell.crossed')).toHaveCount(1);
});

test('missing sound assets leave hint and gameplay usable', async ({ page }) => {
	await page.route('**/audio/**', (route) => route.abort());
	await seeded(page);
	await page.getByRole('button', { name: 'Turn sound on', exact: true }).click();
	await page.getByRole('button', { name: 'Hint', exact: true }).click();
	await expect(page.locator('.nonogram-cell.hinted')).toHaveCount(1);
	await expect(page.locator('.nonogram-game')).toHaveAttribute('data-phase', 'playing');
});

test('navigation during entrance cancels game callbacks', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
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
	}, seedFor(5));
	await page.goto('/play');
	await expect(page.locator('.nonogram-game')).toHaveAttribute('data-phase', 'arrival', {
		timeout: 15000
	});
	await page.goto('/');
	await page.waitForTimeout(2800);
	await expect(page.locator('.nonogram-game')).toHaveCount(0);
	expect(errors).toEqual([]);
});
