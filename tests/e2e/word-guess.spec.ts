import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';

const vectors = JSON.parse(readFileSync('tests/vectors/word-guess.json', 'utf8')) as {
	generation: {
		seed: string;
		variant: string;
		answers: string[];
		rules: { length: number };
		budget: number;
		moves: { action: number; code: number }[];
		loss: { action: number; code: number }[];
		result: { score: number };
	}[];
};
const answerFor = (seed = '1', variant = 'word-guess:classic') =>
	vectors.generation.find((row) => row.seed === seed && row.variant === variant)!.answers[0]!;

const evidence = 'build/v1.4.6/browser';
const sizes = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];
async function start(
	page: Page,
	variant = 'word-guess:classic',
	seed = '1',
	reducedMotion: 'reduce' | 'no-preference' = 'reduce',
	waitForGame = true
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
								entry.id === 'word-guess'
									? [variant]
									: (puzzleMetadata[entry.id].variants ?? []).map((row) => row.id)
							])
						)
					}
		})
	);
	await page.route('**/api/play/scoring**', (route) => {
		const family = new URL(route.request().url()).searchParams.get('family')!;
		const scoring = puzzleMetadata[family]?.scoring ?? puzzleMetadata['word-guess'].scoring;
		return route.fulfill({ json: { version: scoring.version, values: scoring.defaults } });
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
					queue: ['word-guess', ...ids.filter((id) => id !== 'word-guess')],
					recent: [],
					cyclePosition: 0
				})
			);
		},
		{ seed, ids: available.map((entry) => entry.id) }
	);
	await page.goto('/play');
	const game = page.locator('.game[data-family="word-guess"]');
	if (waitForGame) await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 30000 });
	return game;
}
async function word(page: Page, value: string) {
	await expect(page.locator('.word-guess-game')).toHaveAttribute('data-busy', 'false');
	await page.keyboard.type(value);
	await page.keyboard.press('Enter');
}

for (const size of sizes)
	test(`Classic fits and solves with a physical keyboard at ${size.width}x${size.height}`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const game = await start(page);
		const bounds = await page.evaluate(() => {
			const box = document.querySelector('.keyboard')!.getBoundingClientRect();
			const key = document.querySelector('[data-key="Q"]')!.getBoundingClientRect();
			return {
				scrollWidth: document.documentElement.scrollWidth,
				innerWidth,
				height: innerHeight,
				keyboard: { top: box.top, bottom: box.bottom },
				key: { width: key.width, height: key.height },
				font: getComputedStyle(document.querySelector('.tile')!).fontFamily
			};
		});
		expect(bounds.scrollWidth).toBeLessThanOrEqual(size.width);
		expect(bounds.keyboard.top).toBeGreaterThanOrEqual(0);
		expect(bounds.keyboard.bottom).toBeLessThanOrEqual(size.height);
		await mkdir(evidence, { recursive: true });
		await writeFile(`${evidence}/classic-${size.width}-bounds.json`, JSON.stringify(bounds));
		await page.screenshot({ path: `${evidence}/classic-${size.width}.png` });
		await word(page, 'XXXXX');
		await expect(game.locator('[data-tries]')).toHaveText('0/6');
		for (let at = 0; at < 5; at++) await page.keyboard.press('Backspace');
		await word(page, answerFor());
		await expect(page.locator('.result-number')).toHaveText('100', { timeout: 15000 });
		expect(errors).toEqual([]);
	});

test('Classic solves through on-screen keys and Next rotates away', async ({ page }) => {
	await start(page);
	for (const key of answerFor()) await page.locator(`[data-key="${key}"]`).click();
	await page.locator('[data-key="Enter"]').click();
	await expect(page.locator('.result-number')).toHaveText('100', { timeout: 15000 });
	await expect(page.getByRole('button', { name: 'Next puzzle', exact: true })).toBeEnabled();
	await page.keyboard.press('n');
	await expect(page.locator('.game[data-family="word-guess"]')).toHaveCount(0, { timeout: 20000 });
});

function decode(code: number, length: number) {
	let word = '';
	for (let at = 0; at < length; at++) {
		word = String.fromCharCode(65 + (code % 26)) + word;
		code = Math.floor(code / 26);
	}
	return word;
}
async function capture(page: Page, name: string) {
	const bounds = await page.evaluate(async () => {
		await document.fonts.ready;
		const box = (selector: string) => {
			const b = document.querySelector(selector)!.getBoundingClientRect();
			return {
				left: b.left,
				right: b.right,
				top: b.top,
				bottom: b.bottom,
				width: b.width,
				height: b.height
			};
		};
		return {
			scrollWidth: document.documentElement.scrollWidth,
			innerWidth,
			innerHeight,
			keyboard: box('.keyboard'),
			key: box('[data-key="Q"]'),
			tile: box('.tile'),
			boards: box('.word-boards'),
			font: getComputedStyle(document.querySelector('.tile')!).fontFamily,
			nunitoLoaded: document.fonts.check('900 24px "Nunito Variable"')
		};
	});
	expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.innerWidth);
	expect(bounds.keyboard.bottom).toBeLessThanOrEqual(bounds.innerHeight);
	expect(bounds.boards.top).toBeGreaterThanOrEqual(0);
	expect(bounds.tile.height).toBeGreaterThan(0);
	expect(bounds.nunitoLoaded).toBe(true);
	await mkdir(evidence, { recursive: true });
	await writeFile(`${evidence}/${name}-bounds.json`, JSON.stringify(bounds));
	await page.screenshot({ path: `${evidence}/${name}.png` });
}
const presets = [...new Set(vectors.generation.map((row) => row.variant))];
for (const variant of presets.filter((id) => id !== 'word-guess:classic')) {
	for (const size of sizes) {
		test(`${variant} fits and solves at ${size.width}x${size.height}`, async ({ page }) => {
			await page.setViewportSize(size);
			const vector = vectors.generation.find((row) => row.variant === variant)!;
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await start(page, variant, vector.seed);
			const name = `${variant.split(':')[1]}-${size.width}`;
			await capture(page, name);
			for (const move of vector.moves) {
				if (move.action === 1) await page.locator('[data-hint]').click();
				else await word(page, decode(move.code, vector.rules.length));
			}
			await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
			if (!variant.includes('countdown'))
				await expect(page.locator('.result-number')).toHaveText(String(vector.result.score));
			else
				expect(
					Number((await page.locator('.result-number').textContent())?.replaceAll(',', ''))
				).toBeGreaterThan(100);
			for (const answer of vector.answers)
				await expect(page.locator('.result-stats')).toContainText(answer);
			await page.screenshot({ path: `${evidence}/${name}-result.png` });
			expect(errors).toEqual([]);
		});
	}
}
for (const [variant, rejected, message] of [
	['word-guess:hard-mode', 'MUSIC', 'Keep P in position 3.'],
	['word-guess:ultra-hard', 'PAPER', 'Move P out of position 1.']
])
	test(`${variant} rejects a constraint violation without spending a row`, async ({ page }) => {
		const game = await start(page, variant, '746');
		await word(page, 'PAPER');
		await word(page, rejected!);
		await expect(game.locator('.message')).toContainText(message!);
		await expect(game.locator('[data-tries]')).toHaveText('1/6');
		for (let at = 0; at < 5; at++) await page.keyboard.press('Backspace');
		await word(page, 'APPLE');
		await expect(page.locator('.result-number')).toHaveText('90', { timeout: 15000 });
	});
test('three deterministic hints preserve tries and a zero-point win is labelled', async ({
	page
}) => {
	const game = await start(page, 'word-guess:hint-budget-3');
	for (let at = 0; at < 3; at++) await game.locator('[data-hint]').click();
	await expect(game.locator('[data-hint]')).toBeDisabled();
	await expect(game.locator('[data-tries]')).toHaveText('0/6');
	for (let at = 0; at < 3; at++)
		await expect(game.locator(`[data-revealed="${at}"]`)).toHaveText(
			`Board 1, position ${at + 1}: ${answerFor()[at]}`
		);
	await capture(page, 'hint-three-portrait');
	await word(page, answerFor());
	await expect(page.locator('.result-number')).toHaveText('0', { timeout: 15000 });
	await expect(page.locator('.result-stats')).toContainText('solved with hint');
});
test('countdown expires mid-typing, retains the board and saves no score', async ({ page }) => {
	await page.clock.install();
	const game = await start(page, 'word-guess:countdown-120');
	await page.keyboard.type('APP');
	await page.clock.fastForward(120001);
	await expect(game).toHaveAttribute('data-phase', 'over');
	await expect(game.locator('[data-tries]')).toHaveText('0/6');
	await expect(game.locator('[data-countdown]')).toHaveText('Time left 00:00');
	await expect(game.locator('.time-up')).toContainText("Time's up!");
	await expect(game.locator('.time-up')).toContainText(answerFor());
	await expect(page.locator('.result-number')).toHaveCount(0);
	await expect(game.locator('.tile')).toHaveCount(30);
	await page.screenshot({ path: `${evidence}/countdown-expired.png` });
	await game.getByRole('button', { name: 'Try another puzzle', exact: true }).click();
	await expect(game).toHaveCount(0, { timeout: 20000 });
});
test('a complete loss shows X/6 and reveals the answer', async ({ page }) => {
	const vector = vectors.generation[0]!;
	await start(page);
	for (const move of vector.loss) await word(page, decode(move.code, 5));
	await expect(page.locator('.result-number')).toHaveText('0', { timeout: 15000 });
	await expect(page.locator('.result-stats')).toContainText('X/6');
	await expect(page.locator('.result-stats')).toContainText(answerFor());
	await expect(page.locator('.result-stats')).not.toContainText('solved with hint');
});
test('double Enter spends one row, rotation and hidden-tab return preserve input', async ({
	page
}) => {
	const game = await start(page);
	const wrong = decode(vectors.generation[0]!.loss[0]!.code, 5);
	await page.keyboard.type(wrong);
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(game.locator('[data-tries]')).toHaveText('1/6');
	await page.setViewportSize(sizes[1]!);
	await page.keyboard.type('IM');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.keyboard.type('PLY');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(game.locator('.active-row')).toHaveText('IM');
	await capture(page, 'rotation-mid-round');
	await expect(game).toHaveAttribute('data-busy', 'false');
	await page.keyboard.type('PLY');
	await page.keyboard.press('Enter');
	await expect(page.locator('.result-number')).toHaveText('90', { timeout: 15000 });
});
test('Reset starts a fresh unlimited round in the same rules', async ({ page }) => {
	const game = await start(page, 'word-guess:length-4');
	const round = await game.getAttribute('data-round');
	await page.keyboard.type('AB');
	await page.evaluate(() => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = 2;
				return array;
			}
			return original(array);
		};
	});
	await game.getByRole('button', { name: 'Reset', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await expect(game).not.toHaveAttribute('data-round', round!);
	await expect(game.locator('[data-tries]')).toHaveText('0/6');
	await expect(game.locator('.tile')).toHaveCount(24);
	await expect(game.locator('.active-row')).toHaveText('');
	await expect(game).not.toHaveAttribute('data-seed', '1');
});
test('checkpoint reload restores guesses, hints and partially typed input', async ({ page }) => {
	const game = await start(page, 'word-guess:hint-budget-3');
	await game.locator('[data-hint]').click();
	await word(page, decode(vectors.generation[0]!.loss[0]!.code, 5));
	await page.keyboard.type('IM');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect
		.poll(() =>
			page.evaluate(async () => {
				const db = await new Promise<IDBDatabase>((resolve, reject) => {
					const opening = indexedDB.open('morphi-checkpoint', 1);
					opening.onsuccess = () => resolve(opening.result);
					opening.onerror = () => reject(opening.error);
				});
				try {
					return await new Promise<Record<string, number> | undefined>((resolve, reject) => {
						const request = db.transaction('active').objectStore('active').get('guest');
						request.onsuccess = () => resolve(request.result?.state.pending);
						request.onerror = () => reject(request.error);
					});
				} finally {
					db.close();
				}
			})
		)
		.toMatchObject({ letter0: 73, letter1: 77 });
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 20000 });
	await expect(game.locator('[data-tries]')).toHaveText('1/6');
	await expect(game.locator('[data-hint]')).toHaveText('Hint (2 left)');
	await expect(game.locator('.active-row')).toHaveText('IM');
	const elapsedBefore = await game.locator('.word-hud').textContent();
	await page.waitForTimeout(1100);
	await expect(game.locator('.word-hud')).not.toHaveText(elapsedBefore!);
	await page.keyboard.type('PLY');
	await page.keyboard.press('Enter');
	await expect(page.locator('.result-number')).toHaveText('0', { timeout: 15000 });
	await expect(page.locator('.result-stats')).toContainText('solved with hint');
});
test('normal tile flips and key pop run, Nunito loads, changing reduced motion settles', async ({
	page
}) => {
	const game = await start(page, 'word-guess:classic', '1', 'no-preference');
	await page.locator('[data-key="A"]').click();
	await expect
		.poll(() => page.locator('[data-key="A"]').evaluate((node) => node.style.transform))
		.not.toBe('');
	await page.keyboard.press('Backspace');
	await word(page, decode(vectors.generation[0]!.loss[0]!.code, 5));
	await expect
		.poll(() =>
			game
				.locator('[data-row="0"] .tile')
				.first()
				.evaluate((node) => node.style.transform)
		)
		.not.toBe('');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect
		.poll(() =>
			game
				.locator('[data-row="0"] .tile')
				.first()
				.evaluate((node) => node.style.transform)
		)
		.toBe('');
	await capture(page, 'motion-settled');
	await word(page, answerFor());
	await expect(page.locator('.result-number')).toHaveText('90', { timeout: 15000 });
});
test('injected family motion failure settles and leaves input playable', async ({ page }) => {
	await page.route('**/src/lib/puzzles/word-guess/motion.ts*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/javascript',
			body: 'export function wordGuessMotion(){throw new Error("injected failure");}'
		})
	);
	await start(page, 'word-guess:classic', '1', 'no-preference');
	await word(page, decode(vectors.generation[0]!.loss[0]!.code, 5));
	await word(page, answerFor());
	await expect(page.locator('.result-number')).toHaveText('90', { timeout: 15000 });
});
test('shared stage recovers a failed view load with Retry and Home', async ({ page }) => {
	await page.route('**/src/lib/puzzles/word-guess/View.svelte*', (route) => route.abort());
	await start(page, 'word-guess:classic', '1', 'reduce', false);
	await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible({
		timeout: 20000
	});
	await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeVisible();
	await page.unroute('**/src/lib/puzzles/word-guess/View.svelte*');
	await page.getByRole('button', { name: 'Try again', exact: true }).click();
	await expect(page.locator('.word-guess-game')).toHaveAttribute('data-phase', 'playing', {
		timeout: 20000
	});
});
for (const limit of [25, 100])
	test(`real daily board top-${limit} renders persistent hint status`, async ({ page }) => {
		await page.goto(`/leaderboard?family=word-guess&date=2026-11-01&limit=${limit}`);
		await expect(page.locator('tbody tr')).toHaveCount(limit === 25 ? 25 : 30);
		await expect(page.locator('tbody tr').first()).toContainText('solved with hint');
		await expect(page.locator('tbody tr').nth(1)).not.toContainText('solved with hint');
		if (limit === 100)
			await expect(page.locator('tbody tr').last()).toContainText('solved with hint');
		await page.screenshot({ path: `${evidence}/board-top-${limit}.png`, fullPage: true });
	});

test('early input is locked, hidden entrance resumes, and navigation during a flip cleans up', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const game = await start(page, 'word-guess:classic', '1', 'no-preference', false);
	await expect(game).toHaveAttribute('data-phase', 'arrival');
	await page.keyboard.type('APPLE');
	await expect(game.locator('.active-row')).toHaveText('');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(2100);
	await expect(game).toHaveAttribute('data-phase', 'arrival');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 10000 });
	await word(page, decode(vectors.generation[0]!.loss[0]!.code, 5));
	await page.goto('/');
	await expect(game).toHaveCount(0);
	expect(errors).toEqual([]);
});
