import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { selectorSeedFor } from './entropy.js';

test('Memory resize uses the new layout without restarting the round', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript((selectorSeed) => {
		const original = crypto.getRandomValues.bind(crypto);
		let first = true;
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = first ? selectorSeed : 1;
				first = false;
				return array;
			}
			return original(array);
		};
	}, selectorSeedFor('memory'));
	await page.goto('/play');
	const game = page.locator('.game[data-family="memory"]');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 16000 });
	await expect(page.locator('.memory-card')).toHaveCount(20);
	await expect(page.locator('.board')).toHaveAttribute('data-columns', '4');
	const originalCard = await page.locator('.memory-card').first().elementHandle();
	await page.setViewportSize({ width: 1920, height: 923 });
	await expect(page.locator('.board')).toHaveAttribute('data-columns', '5');
	await expect
		.poll(async () => (await page.locator('.round-frame').boundingBox())!.width)
		.toBeGreaterThan(750);
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await expect(game).toHaveAttribute('data-round', '1');
	expect(
		await originalCard!.evaluate((card) => card === document.querySelector('.memory-card'))
	).toBe(true);
});

for (const [width, height] of [
	[390, 844],
	[844, 390],
	[1280, 800],
	[1920, 923]
])
	test(`actual Card lifecycle and result at ${width}×${height}`, async ({ page }, info) => {
		await page.setViewportSize({ width, height });
		await page.addInitScript(
			(selectorSeed) => {
				const original = crypto.getRandomValues.bind(crypto);
				let first = true;
				crypto.getRandomValues = (array) => {
					if (array instanceof Uint32Array && array.length === 2) {
						array[0] = 0;
						array[1] = first ? selectorSeed : 3;
						first = false;
						return array;
					}
					return original(array);
				};
				const frames: {
					phase: string;
					x: number;
					y: number;
					width: number;
					count: number;
					resultOpacity: number;
				}[] = [];
				Object.defineProperty(window, '__appCardFrames', { value: frames });
				let originalFrame: Element | null = null;
				const sample = () => {
					const root = document.querySelector<HTMLElement>('.round-stage');
					const frame = root?.querySelector('.round-frame');
					if (root && frame) {
						originalFrame ??= frame;
						const r = frame.getBoundingClientRect();
						if (originalFrame !== frame) throw new Error('Card frame replaced');
						frames.push({
							phase: root.dataset.cardPhase ?? '',
							x: r.x + r.width / 2,
							y: r.y + r.height / 2,
							width: r.width,
							count: document.querySelectorAll('.round-frame').length,
							resultOpacity: Number(
								getComputedStyle(root.querySelector('.result-main') ?? root).opacity
							)
						});
					}
					if (frames.length < 1600) requestAnimationFrame(sample);
				};
				requestAnimationFrame(sample);
			},
			selectorSeedFor('memory', 'block')
		);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto('/play');
		await expect(page.locator('.game[data-family="memory"]')).toHaveAttribute(
			'data-phase',
			'playing',
			{ timeout: 16000 }
		);
		const output = `build/v1.1-integration/${info.project.name}`;
		await mkdir(output, { recursive: true });
		await page.screenshot({ path: `${output}/memory-${width}x${height}.png` });
		const cards = page.locator('.memory-card');
		const symbols = await cards.evaluateAll((elements) =>
			elements.map((el) => el.querySelector('.card-front svg')!.outerHTML)
		);
		const pairs = new Map<string, number[]>();
		symbols.forEach((symbol, i) => pairs.set(symbol, [...(pairs.get(symbol) ?? []), i]));
		for (const [a, b] of pairs.values()) {
			await cards.nth(a).click();
			await cards.nth(b).click();
		}
		await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('.scramble-visual')).toHaveCount(0);
		await expect(page.locator('.result-main')).toHaveCSS('opacity', '1');
		await expect(
			page.getByRole('link', { name: 'Sign in with Google', exact: true })
		).toBeVisible();
		await expect(page.locator('.played-stack>p')).toHaveText('Played · 1');
		const fit = await page.evaluate(() => {
			const r = document.querySelector('.result-main')!.getBoundingClientRect();
			return {
				left: r.left,
				right: r.right,
				top: r.top,
				bottom: r.bottom,
				header: document.querySelector('.game-header')!.getBoundingClientRect().bottom,
				footer: document.querySelector('.round-panel')!.getBoundingClientRect().top,
				scroll: document.documentElement.scrollHeight
			};
		});
		expect(fit.left).toBeGreaterThanOrEqual(0);
		expect(fit.right).toBeLessThanOrEqual(width);
		expect(fit.top).toBeGreaterThanOrEqual(fit.header - 1);
		expect(fit.bottom).toBeLessThanOrEqual(fit.footer + 1);
		expect(fit.scroll).toBeLessThanOrEqual(height);
		if (width >= 1024)
			expect((await page.locator('.result-main').boundingBox())!.width).toBeGreaterThanOrEqual(900);
		await page.screenshot({ path: `${output}/result-${width}x${height}.png` });
		await page.locator('.next').evaluate((button) => {
			(button as HTMLButtonElement).click();
			(button as HTMLButtonElement).click();
		});
		await expect(page.locator('.game[data-family="block"]')).toHaveAttribute(
			'data-phase',
			'playing',
			{ timeout: 12000 }
		);
		await expect(page.locator('.round-meta')).toContainText('Round 2');
		await expect(page.locator('.played-stack>p')).toHaveText('Played · 1');
		await page.screenshot({ path: `${output}/block-next-${width}x${height}.png` });
		const frames = await page.evaluate(
			() =>
				(
					window as unknown as {
						__appCardFrames: {
							phase: string;
							x: number;
							y: number;
							width: number;
							count: number;
							resultOpacity: number;
						}[];
					}
				).__appCardFrames
		);
		expect(frames.every((frame) => frame.count === 1)).toBe(true);
		const unfolding = frames.filter((frame) => frame.phase === 'unfolding');
		expect(unfolding.length).toBeGreaterThan(10);
		for (const frame of unfolding) {
			expect(Math.abs(frame.x - width / 2)).toBeLessThan(1);
		}
		const resultFrames = frames.filter((frame) => frame.phase === 'result');
		expect(resultFrames.some((frame) => frame.resultOpacity < 0.8)).toBe(true);
		expect(resultFrames.at(-1)!.resultOpacity).toBe(1);
		for (let i = 1; i < resultFrames.length; i++)
			expect(resultFrames[i].resultOpacity).toBeGreaterThanOrEqual(
				resultFrames[i - 1].resultOpacity - 0.001
			);
		expect(errors).toEqual([]);
		await writeFile(
			`${output}/frames-${width}x${height}.json`,
			JSON.stringify({ fit, frames }, null, 2) + '\n'
		);
	});
