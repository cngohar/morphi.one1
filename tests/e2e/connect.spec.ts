import { captureGameReview } from './review-capture.js';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
const vectors = JSON.parse(readFileSync('tests/vectors/connect.json', 'utf8')) as {
	seed: string;
	size: number;
	solution: number[][];
}[];

async function seeded(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = 1;
				return array;
			}
			return original(array);
		};
	});
}

async function drawPath(page: import('@playwright/test').Page, size: number, path: number[]) {
	const board = (await page.locator('.connect-board').boundingBox())!;
	for (const [index, cell] of path.entries()) {
		const x = board.x + (((cell % size) + 0.5) * board.width) / size;
		const y = board.y + ((Math.floor(cell / size) + 0.5) * board.height) / size;
		if (index === 0) await page.mouse.move(x, y);
		if (index === 0) await page.mouse.down();
		else await page.mouse.move(x, y, { steps: 2 });
	}
	await page.mouse.up();
}

test('Connect deals through Mix, draws paths, saves a result, and rotates on Next', async ({
	page
}, info) => {
	await seeded(page);
	await page.goto('/play');
	const game = page.locator('.game[data-family="connect"]');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
	const seed = await game.getAttribute('data-seed');
	const round = vectors.find((vector) => vector.seed === seed);
	expect(round).toBeDefined();
	await expect(page.locator('.connect-cell')).toHaveCount(round!.size * round!.size);
	await mkdir(`build/v1.1-connect/${info.project.name}`, { recursive: true });
	await page.screenshot({ path: `build/v1.1-connect/${info.project.name}/connect-playing.png` });
	for (const path of round!.solution) await drawPath(page, round!.size, path);
	const ending = page.locator('.ending');
	await expect(ending).toBeVisible();
	await expect(ending).toContainText('All pairs connected!');
	await expect(ending).toContainText('100% filled');
	await captureGameReview(page, 'connect-ending');
	await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
	await expect(page.locator('.played-stack>p')).toHaveText('Played · 1');
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await expect(page.locator('.game[data-family="connect"]')).toHaveCount(0, { timeout: 12000 });
});

test('Connect finishes when all pairs connect even with empty cells', async ({ page }, info) => {
	await seeded(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/play');
	const game = page.locator('.game[data-family="connect"]');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
	const round = vectors.find((vector) => vector.seed === '1')!;
	await expect(game).toHaveAttribute('data-seed', '1');
	for (const [pair, path] of round.solution.entries())
		await drawPath(
			page,
			round.size,
			pair === 2 ? [path[0]!, path[1]!, path[2]!, path.at(-1)!] : path
		);
	await expect(page.locator('.ending')).toContainText('92% filled');
	await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
	await expect(page.locator('.result-stats')).toHaveAttribute(
		'aria-label',
		/8 pairs connected.*92% filled/
	);
	await expect(page.locator('.result-stats')).toContainText('92%');
	const save = (await page.locator('.result-save').boundingBox())!;
	const stackLabel = (await page.locator('.played-stack p').boundingBox())!;
	expect(save.y + save.height).toBeLessThan(stackLabel.y);
	await page.waitForTimeout(650);
	await mkdir(`build/v1.1-connect/${info.project.name}`, { recursive: true });
	await page.screenshot({
		path: `build/v1.1-connect/${info.project.name}/connect-partial-result.png`
	});
});

test('reduced-motion ending pauses while hidden and then shows the result', async ({ page }) => {
	await seeded(page);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/play');
	const game = page.locator('.game[data-family="connect"]');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
	const round = vectors.find((vector) => vector.seed === '1')!;
	for (const path of round.solution) await drawPath(page, round.size, path);
	await expect(page.locator('.ending')).toContainText('All pairs connected!');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(1200);
	await expect(page.locator('.ending')).toBeVisible();
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(page.locator('.result')).toBeVisible({ timeout: 3000 });
});

test('Connect begins hidden, reveals its board, and centres symbols in dots', async ({ page }) => {
	await seeded(page);
	await page.addInitScript(() => {
		const capture = window as Window & {
			__connectFrames?: { cell: number; dot: number }[];
		};
		capture.__connectFrames = [];
		let attempts = 0;
		const sample = () => {
			const stage = document.querySelector<HTMLElement>('.round-stage');
			const cell = document.querySelector<HTMLElement>('.connect-cell');
			const dot = document.querySelector<HTMLElement>('.connect-dot');
			if (stage?.dataset.cardPhase === 'arriving' && cell && dot)
				capture.__connectFrames!.push({
					cell: Number(getComputedStyle(cell).opacity),
					dot: Number(getComputedStyle(dot).opacity)
				});
			if (++attempts < 800 && stage?.dataset.cardPhase !== 'playing') requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	await page.goto('/play');
	await expect(page.locator('.game[data-family="connect"]')).toHaveAttribute(
		'data-phase',
		'playing',
		{ timeout: 12000 }
	);
	const frames = await page.evaluate(
		() => (window as Window & { __connectFrames?: { cell: number; dot: number }[] }).__connectFrames
	);
	expect(frames?.length).toBeGreaterThan(20);
	expect(frames![0]!.cell).toBeLessThanOrEqual(0.05);
	expect(frames![0]!.dot).toBeLessThanOrEqual(0.05);
	expect(frames!.some((frame) => frame.cell > 0.5)).toBe(true);
	const alignment = await page.locator('.connect-dot svg').evaluateAll((nodes) =>
		nodes.every((node) => {
			if (node.getAttribute('viewBox') !== '0 0 48 48') return false;
			const svg = node.getBoundingClientRect();
			const dot = node.parentElement!.getBoundingClientRect();
			return (
				Math.abs(svg.x + svg.width / 2 - (dot.x + dot.width / 2)) < 1.5 &&
				Math.abs(svg.y + svg.height / 2 - (dot.y + dot.height / 2)) < 1.5
			);
		})
	);
	expect(alignment).toBe(true);
});

for (const [width, height] of [
	[390, 844],
	[844, 390],
	[1920, 923]
])
	test(`Connect fits ${width}×${height} with family-only backdrop`, async ({ page }, info) => {
		await seeded(page);
		await page.setViewportSize({ width, height });
		await page.goto('/play');
		await expect(page.locator('.game[data-family="connect"]')).toHaveAttribute(
			'data-phase',
			'playing',
			{ timeout: 12000 }
		);
		const board = (await page.locator('.connect-board').boundingBox())!;
		const panel = (await page.locator('.game[data-family="connect"]').boundingBox())!;
		expect(board.width).toBeGreaterThan(Math.min(width, height) * 0.5);
		expect(board.x).toBeGreaterThanOrEqual(0);
		expect(board.x + board.width).toBeLessThanOrEqual(width);
		expect(panel.y + panel.height).toBeLessThanOrEqual(height);
		const items = page.locator('.theme-backdrop svg');
		if (width < 1024 || height < 560) await expect(items.first()).toBeHidden();
		else {
			await expect(items.first()).toBeVisible();
			expect(await items.count()).toBeGreaterThanOrEqual(2);
			expect(await items.count()).toBeLessThanOrEqual(10);
		}
		expect(
			await items.evaluateAll((nodes) =>
				nodes.every((node) => node.getAttribute('data-item') === 'dot-path')
			)
		).toBe(true);
		await mkdir(`build/v1.1-connect/${info.project.name}`, { recursive: true });
		await page.screenshot({
			path: `build/v1.1-connect/${info.project.name}/connect-${width}x${height}.png`
		});
	});

test('Connect fetches its own cues when enabled and stays silent when muted', async ({ page }) => {
	await seeded(page);
	await page.addInitScript(() => localStorage.setItem('morphi.sound', 'off'));
	const requested: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/audio/')) requested.push(request.url());
	});
	await page.goto('/play');
	await expect(page.locator('.game[data-family="connect"]')).toHaveAttribute(
		'data-phase',
		'playing',
		{
			timeout: 12000
		}
	);
	expect(requested).toEqual([]);
	await page.getByRole('button', { name: 'Turn sound on' }).click();
	const cues = [
		'appear',
		'start',
		'extend',
		'backtrack',
		'pair',
		'cut',
		'redraw',
		'invalid',
		'win'
	];
	await expect
		.poll(
			() =>
				cues.filter((name) => requested.some((url) => url.endsWith(`/audio/connect-${name}.mp3`)))
					.length
		)
		.toBe(cues.length);
	await page.getByRole('button', { name: 'Turn sound off' }).click();
	await expect(page.getByRole('button', { name: 'Turn sound on' })).toBeVisible();
});

test('Connect remains playable with reduced motion', async ({ page }) => {
	await seeded(page);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/play');
	const game = page.locator('.game[data-family="connect"]');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
	const seed = await game.getAttribute('data-seed');
	const round = vectors.find((vector) => vector.seed === seed)!;
	const first = round.solution[0]![0]!;
	const board = (await page.locator('.connect-board').boundingBox())!;
	const x = board.x + (((first % round.size) + 0.5) * board.width) / round.size;
	const y = board.y + ((Math.floor(first / round.size) + 0.5) * board.height) / round.size;
	await page.mouse.click(x, y);
	await expect(page.locator('.connect-cell.claimed')).toHaveCount(1);
	await expect(game).toHaveAttribute('data-phase', 'playing');
});
