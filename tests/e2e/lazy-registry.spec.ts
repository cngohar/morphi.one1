import { expect, test, type Page } from '@playwright/test';
import { fixSelectorSeed } from './entropy.js';

function watchViews(page: Page): Map<string, Set<string>> {
	const requested = new Map<string, Set<string>>();
	page.on('request', (request) => {
		const match = /\/src\/lib\/puzzles\/([^/]+)\/(View|Game)\.svelte(?:\?|$)/.exec(request.url());
		if (!match) return;
		const files = requested.get(match[1]) ?? new Set<string>();
		files.add(match[2]);
		requested.set(match[1], files);
	});
	return requested;
}

async function solveMemory(page: Page) {
	const cards = page.locator('.memory-card');
	await expect(cards.first()).toBeEnabled({ timeout: 16000 });
	const symbols = await cards.evaluateAll((elements) =>
		elements.map((element) => element.querySelector('.card-front svg')!.outerHTML)
	);
	const pairs = new Map<string, number[]>();
	for (const [index, symbol] of symbols.entries())
		pairs.set(symbol, [...(pairs.get(symbol) ?? []), index]);
	for (const indices of pairs.values()) {
		expect(indices).toHaveLength(2);
		await cards.nth(indices[0]).click();
		await cards.nth(indices[1]).click();
	}
	await expect(page.locator('.result')).toBeVisible();
}

test('first Play loads only the selected Game view, including after speculative generation and Next', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await fixSelectorSeed(page, 0);
	await page.addInitScript(() => {
		const prepared: { family: string }[] = [];
		Object.defineProperty(window, '__lazyPrepared', { value: prepared });
		const NativeWorker = Worker;
		window.Worker = class extends NativeWorker {
			constructor(url: string | URL, options?: WorkerOptions) {
				super(url, options);
				this.addEventListener('message', (event) => {
					if (event.data?.theme) prepared.push(event.data.theme);
				});
			}
		};
	});
	const requested = watchViews(page);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-family', 'memory', { timeout: 12000 });
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as unknown as { __lazyPrepared: unknown[] }).__lazyPrepared.length
			)
		)
		.toBe(2);
	const nextFamily = await page.evaluate(
		() => (window as unknown as { __lazyPrepared: { family: string }[] }).__lazyPrepared[1].family
	);
	expect(nextFamily).not.toBe('memory');
	expect([...requested.keys()]).toEqual(['memory']);
	expect([...requested.get('memory')!].sort()).toEqual(['Game', 'View']);
	await solveMemory(page);
	expect([...requested.keys()]).toEqual(['memory']);
	await page.locator('.next').click();
	await expect(page.locator('.game')).toHaveAttribute('data-family', nextFamily);
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
	const nextDirectory = nextFamily === 'block' ? 'block-placement' : nextFamily;
	expect([...requested.keys()].sort()).toEqual(['memory', nextDirectory].sort());
	expect([...requested.get(nextDirectory)!].sort()).toEqual(['Game', 'View']);
});

test('a failed view load keeps its pending family, neutral first-load card and completed result on retry', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await fixSelectorSeed(page, 0);
	const blocked = new Set<string>();
	const attempts: string[] = [];
	await page.route('**/src/lib/puzzles/*/View.svelte*', async (route) => {
		const directory = /\/puzzles\/([^/]+)\//.exec(route.request().url())![1];
		attempts.push(directory);
		if (!blocked.has(directory)) {
			blocked.add(directory);
			await route.abort('failed');
		} else await route.continue();
	});
	await page.goto('/play');
	await expect(page.locator('.card-loading[role="alert"]')).toBeVisible();
	await expect(page.locator('.game')).toHaveCount(0);
	await expect(page.locator('.puzzle-name')).toHaveCount(0);
	expect(attempts).toEqual(['memory']);
	const retry = page.getByRole('button', { name: 'Try again', exact: true });
	await expect(retry).toBeVisible();
	await retry.click();
	await expect(page.locator('.game')).toHaveAttribute('data-family', 'memory');
	await expect(page.locator('.game')).toHaveAttribute('data-round', '1');
	expect(attempts).toEqual(['memory', 'memory']);
	await solveMemory(page);
	await expect(page.locator('.scramble-visual')).toHaveCount(0);
	const score = await page.locator('.result-number').textContent();
	await page.locator('.next').click();
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.locator('.result-number')).toHaveText(score!);
	await expect(page.locator('.played-stack>p')).toHaveText('Played · 1');
	const nextDirectory = attempts.at(-1)!;
	expect(nextDirectory).not.toBe('memory');
	await page.locator('.next').click();
	await expect(page.locator('.game')).toHaveAttribute(
		'data-family',
		nextDirectory === 'block-placement' ? 'block' : nextDirectory
	);
	await expect(page.locator('.game')).toHaveAttribute('data-round', '2');
	expect(attempts).toEqual(['memory', 'memory', nextDirectory, nextDirectory]);
	await expect(page.getByRole('alert')).toHaveCount(0);
});
