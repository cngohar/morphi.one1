import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fixSelectorSeed } from './entropy.js';

test('the next solo candidate prepares during arrival and is reused on Next', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await fixSelectorSeed(page, 0);
	await page.addInitScript(() => {
		const themes: { family: string; background: string }[] = [];
		Object.defineProperty(window, '__preparedThemes', { value: themes });
		const NativeWorker = Worker;
		window.Worker = class extends NativeWorker {
			constructor(url: string | URL, options?: WorkerOptions) {
				super(url, options);
				this.addEventListener('message', (event) => {
					if (event.data?.theme) themes.push(event.data.theme);
				});
			}
		};
	});
	const durations: number[] = [];
	for (let iteration = 0; iteration < 5; iteration++) {
		await page.goto('/play');
		await expect(page.locator('.game')).toHaveAttribute('data-family', 'memory');
		const cards = page.locator('.memory-card');
		await expect(cards.first()).toBeVisible();
		const symbols = await cards.evaluateAll((elements) =>
			elements.map((element) => element.querySelector('.card-front svg')!.outerHTML)
		);
		await expect
			.poll(() =>
				page.evaluate(
					() => (window as unknown as { __preparedThemes: unknown[] }).__preparedThemes.length
				)
			)
			.toBe(2);
		const expected = await page.evaluate(
			() =>
				(window as unknown as { __preparedThemes: { family: string; background: string }[] })
					.__preparedThemes[1]!
		);
		expect(expected.family).not.toBe('memory');
		await expect(cards.first()).toBeEnabled({ timeout: 12000 });
		const pairs = new Map<string, number[]>();
		for (const [index, symbol] of symbols.entries())
			pairs.set(symbol, [...(pairs.get(symbol) ?? []), index]);
		for (const indices of pairs.values()) {
			expect(indices).toHaveLength(2);
			await cards.nth(indices[0]).click();
			await cards.nth(indices[1]).click();
		}
		await expect(page.locator('.result')).toBeVisible();
		await page.evaluate((round) => {
			document.body.dataset.expectedRound = String(round);
		}, 2);
		const duration = await page.evaluate(
			() =>
				new Promise<number>((resolve, reject) => {
					const started = performance.now();
					const timeout = setTimeout(() => {
						observer.disconnect();
						reject(new Error('Next timed out'));
					}, 10000);
					const observer = new MutationObserver(() => {
						if (
							document.querySelector(
								`.game[data-round="${Number(document.body.dataset.expectedRound)}"]`
							)
						) {
							observer.disconnect();
							clearTimeout(timeout);
							resolve(performance.now() - started);
						}
					});
					observer.observe(document.body, { childList: true, subtree: true });
					(document.querySelector('.next') as HTMLButtonElement).click();
				})
		);
		durations.push(duration);
		await expect(page.locator('.game')).toBeVisible();
		await expect(page.locator('.game')).toHaveAttribute('data-family', expected.family);
		expect(
			await page
				.locator('.game')
				.evaluate((el) => getComputedStyle(el).getPropertyValue('--round-bg').trim())
		).toBe(expected.background);
		await expect(page.locator('.round-meta')).toContainText('Round 2');
	}
	const sorted = durations.toSorted((a, b) => a - b);
	await mkdir('build/v1.1-card', { recursive: true });
	await writeFile(
		'build/v1.1-card/preparation-measurements.json',
		JSON.stringify(
			{
				device: 'Headless desktop Chromium, 1280×720, local development server',
				network: 'localhost, unthrottled',
				load: 'preloaded solo Mix Memory-to-selector transitions, fresh session per run, reduced motion',
				metric:
					'Next activation to next round DOM; includes accepted Card exit/deal, excludes per-game entrance/preview',
				runs: durations.length,
				milliseconds: durations,
				median: sorted[2],
				p95: sorted[4],
				classification: 'diagnostic goal only; no phone/4G/public-launch acceptance'
			},
			null,
			2
		) + '\n'
	);
});

test('stalled Worker shows a neutral loading card; leaving ignores its late completion', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => {
		window.Worker = class {
			postMessage() {}
			terminate() {}
		} as unknown as typeof Worker;
	});
	await page.goto('/play');
	await expect(page.locator('.round-card')).toBeVisible();
	await expect(page.locator('.game')).toHaveCount(0);
	await expect(page.locator('.puzzle-name')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Back to home', exact: true }).click();
	await expect(page).toHaveURL('/');
	await page.waitForTimeout(5500);
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});

test('stalled history storage is bounded and failed Worker falls back to a playable round', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await fixSelectorSeed(page, 0);
	await page.addInitScript(() => {
		const open = indexedDB.open.bind(indexedDB);
		indexedDB.open = ((name: string, version?: number) =>
			name === 'morphi-themes' ? {} : open(name, version)) as typeof indexedDB.open;
		window.Worker = class {
			constructor() {
				throw new Error('fixture blocked worker');
			}
		} as unknown as typeof Worker;
	});
	await page.goto('/play');
	await expect(page.locator('.round-card')).toBeVisible();
	await expect(page.locator('.game')).toBeVisible({ timeout: 12000 });
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
	await expect(page.locator('.theme-backdrop')).toBeVisible();
	for (const side of ['left', 'right']) {
		const count = await page.locator(`.theme-backdrop svg[data-band="${side}"]`).count();
		expect(count).toBeGreaterThanOrEqual(1);
		expect(count).toBeLessThanOrEqual(5);
	}
});

test('a failed Next retains the finished result; retry and duplicate Next commit once', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		const state = { blocked: false, allowOne: false };
		Object.defineProperty(window, '__preparationFailure', { value: state });
		const nativeRandom = crypto.getRandomValues.bind(crypto);
		let first = true;
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				if (first) {
					first = false;
					array[0] = 0;
					array[1] = 0;
					return array;
				}
				if (state.blocked) {
					if (state.allowOne) state.allowOne = false;
					else throw new Error('fixture next preparation failed');
				}
			}
			return nativeRandom(array);
		};
		const NativeWorker = Worker;
		window.Worker = class extends NativeWorker {
			constructor(url: string | URL, options?: WorkerOptions) {
				super(url, options);
				this.addEventListener('message', () => {
					state.blocked = true;
				});
			}
		};
	});
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-family', 'memory');
	const cards = page.locator('.memory-card');
	await expect(cards.first()).toBeVisible();
	const shapes = await cards.evaluateAll((elements) =>
		elements.map((element) => element.querySelector('.card-front svg')!.outerHTML)
	);
	await expect(cards.first()).toBeEnabled({ timeout: 12000 });
	const pairs = new Map<string, number[]>();
	for (const [index, shape] of shapes.entries())
		pairs.set(shape, [...(pairs.get(shape) ?? []), index]);
	for (const indices of pairs.values()) {
		await cards.nth(indices[0]).click();
		await cards.nth(indices[1]).click();
	}
	await expect(page.locator('.result')).toBeVisible();
	await expect(page.locator('.scramble-visual')).toHaveCount(0);
	const score = await page.locator('.result-number').textContent();
	await page.evaluate(() => {
		(
			window as unknown as { __preparationFailure: { allowOne: boolean } }
		).__preparationFailure.allowOne = true;
	});
	await page.locator('.next').click();
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.locator('.result-number')).toHaveText(score!);
	await expect(page.locator('.next')).toBeEnabled();
	await page.evaluate(() => {
		(
			window as unknown as { __preparationFailure: { blocked: boolean } }
		).__preparationFailure.blocked = false;
	});
	await page.locator('.next').evaluate((button) => {
		(button as HTMLButtonElement).click();
		(button as HTMLButtonElement).click();
	});
	await expect(page.locator('.game')).toBeVisible();
	await expect(page.locator('.round-meta')).toContainText('Round 2');
	await expect(page.locator('.game')).not.toHaveAttribute('data-family', 'memory');
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('availability skips disabled games and preserves a result when all games are disabled', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	let enabled = ['memory'];
	await page.route('**/api/play/availability**', async (route) => {
		const family = new URL(route.request().url()).searchParams.get('family');
		await route.fulfill({ json: { available: family ? enabled.includes(family) : enabled } });
	});
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-family', 'memory');
	const cards = page.locator('.memory-card');
	await expect(cards.first()).toBeEnabled({ timeout: 12000 });
	const symbols = await cards.evaluateAll((elements) =>
		elements.map((element) => element.querySelector('.card-front svg')!.outerHTML)
	);
	const pairs = new Map<string, number[]>();
	for (const [index, symbol] of symbols.entries())
		pairs.set(symbol, [...(pairs.get(symbol) ?? []), index]);
	for (const indices of pairs.values()) {
		await cards.nth(indices[0]!).click();
		await cards.nth(indices[1]!).click();
	}
	await expect(page.locator('.result')).toBeVisible();
	const score = await page.locator('.result-number').textContent();
	enabled = [];
	await page.locator('.next').click();
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.locator('.result-number')).toHaveText(score!);
	enabled = ['connect'];
	await page.locator('.next').click();
	await expect(page.locator('.game')).toHaveAttribute('data-family', 'connect');
});
