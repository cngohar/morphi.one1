import { expect, test, type Page } from '@playwright/test';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';
import {
	applyOneLineMove,
	createOneLineRound,
	ONE_LINE_VARIANTS
} from '../../src/lib/puzzles/one-line/logic.js';

const FAMILY = 'one-line';
const CLASSIC = 'one-line:classic';
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
					queue: ['one-line', ...ids.filter((id) => id !== 'one-line')],
					recent: [],
					cyclePosition: 0
				})
			);
		},
		{ seed, ids: available.map((entry) => entry.id) }
	);
	await page.goto('/play');
	const game = page.locator('.game[data-family="one-line"]');
	if (waitForGame) await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 30000 });
	return game;
}

async function solve(
	page: Page,
	variant = CLASSIC,
	seed = '1',
	moves?: ReturnType<typeof createOneLineRound>['solution']
) {
	let round = createOneLineRound(seed, variant);
	for (const move of moves ?? round.solution) {
		if (move.action === 4) {
			await page.locator(`[data-verdict="${move.value}"]`).click();
		} else if (move.action === 6) {
			const path = round.strokes.at(-1)!;
			await page.locator(`[data-dot="${path.path.at(-1)?.to ?? path.start}"]`).click();
		} else if (move.action === 0) {
			const stroke = round.lifted && round.strokes.length === 1 ? undefined : round.strokes.at(-1);
			const current = stroke ? (stroke.path.at(-1)?.to ?? stroke.start) : move.value;
			if (!stroke) await page.locator(`[data-dot="${current}"]`).click();
			const edge = round.edges[move.edge]!;
			const destination = edge.from === current ? edge.to : edge.from;
			await page.locator(`[data-dot="${destination}"]`).click();
		}
		round = applyOneLineMove(round, move);
	}
}

for (const size of sizes)
	test(`tap tracing solves and the figure fits at ${size.width}x${size.height}`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const seed = '20';
		await start(page, CLASSIC, seed);
		const bounds = await page.evaluate(() => {
			const board = document.querySelector('[aria-label="One-line drawing board"]')!;
			const bounds = board.getBoundingClientRect();
			const dots = [...board.querySelectorAll('[data-dot]')].map((dot) => {
				const { left, right, top, bottom, width, height } = dot.getBoundingClientRect();
				const target = document.elementFromPoint(left + width / 2, top + height / 2);
				return {
					left,
					right,
					top,
					bottom,
					width,
					height,
					insideBoard:
						left >= bounds.left &&
						right <= bounds.right &&
						top >= bounds.top &&
						bottom <= bounds.bottom,
					clickable: dot.contains(target)
				};
			});
			return {
				scrollWidth: document.documentElement.scrollWidth,
				innerWidth,
				innerHeight,
				dots
			};
		});
		expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.innerWidth);
		expect(bounds.dots.length).toBeGreaterThan(0);
		for (const dot of bounds.dots) {
			expect(dot.insideBoard && dot.clickable).toBe(true);
			expect(dot.left).toBeGreaterThanOrEqual(0);
			expect(dot.right).toBeLessThanOrEqual(bounds.innerWidth);
			expect(dot.top).toBeGreaterThanOrEqual(0);
			expect(dot.bottom).toBeLessThanOrEqual(bounds.innerHeight);
			if (size.width === 390) {
				expect(dot.width).toBeGreaterThanOrEqual(44);
				expect(dot.height).toBeGreaterThanOrEqual(44);
			}
		}
		await solve(page, CLASSIC, seed);
		await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
		expect(errors).toEqual([]);
	});

for (const variant of ONE_LINE_VARIANTS.slice(1, -1))
	test(`solves ${variant} using the preset rules`, async ({ page }) => {
		await start(page, variant);
		await solve(page, variant);
		await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
	});

test('hinted result is labelled and Next rotates away', async ({ page }) => {
	await start(page);
	await page.locator('[data-hint]').click();
	await solve(page);
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
	await expect(page.locator('.result-stats')).toHaveAttribute('aria-label', /solved with hint/i);
	await page.keyboard.press('n');
	await expect(page.locator('.game[data-family="one-line"]')).toHaveCount(0, { timeout: 20000 });
});

test('shared stage recovers a failed view load with Retry and Home', async ({ page }) => {
	await page.route('**/src/lib/puzzles/one-line/View.svelte*', (route) => route.abort());
	await start(page, CLASSIC, '1', false);
	await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible({
		timeout: 20000
	});
	await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeVisible();
	await page.unroute('**/src/lib/puzzles/one-line/View.svelte*');
	await page.getByRole('button', { name: 'Try again', exact: true }).click();
	await expect(page.locator('.game[data-family="one-line"]')).toHaveAttribute(
		'data-phase',
		'playing',
		{ timeout: 20000 }
	);
});

test('standalone Undo and Restart reverse drawing without rerolling', async ({ page }) => {
	const game = await start(page);
	const round = createOneLineRound('1', CLASSIC);
	const first = round.solution.find((move) => move.action === 0)!;
	const edge = round.edges[first.edge]!;
	const destination = edge.from === first.value ? edge.to : edge.from;
	const lines = game.locator('.stats span').first();
	await game.locator(`[data-dot="${first.value}"]`).click();
	await game.locator(`[data-dot="${destination}"]`).click();
	await expect(lines).toContainText('1/');
	await game.locator('[data-undo]').click();
	await expect(lines).toContainText('0/');
	await game.locator(`[data-dot="${first.value}"]`).click();
	await game.locator(`[data-dot="${destination}"]`).click();
	await expect(lines).toContainText('1/');
	await game.locator('[data-restart]').click();
	await expect(lines).toContainText('0/');
	await expect(game).toHaveAttribute('data-seed', '1');
	await solve(page);
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
});

test('drag back undoes the last trace', async ({ page }) => {
	const game = await start(page);
	const round = createOneLineRound('1', CLASSIC);
	const first = round.solution.find((move) => move.action === 0)!;
	const edge = round.edges[first.edge]!;
	const destination = edge.from === first.value ? edge.to : edge.from;
	const startBox = (await game.locator(`[data-dot="${first.value}"]`).boundingBox())!;
	const endBox = (await game.locator(`[data-dot="${destination}"]`).boundingBox())!;
	const point = (box: typeof startBox) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
	await page.mouse.move(point(startBox).x, point(startBox).y);
	await page.mouse.down();
	await page.mouse.move(point(endBox).x, point(endBox).y, { steps: 8 });
	await expect(game.locator('.stats span').first()).toContainText('1/');
	await page.mouse.move(point(startBox).x, point(startBox).y, { steps: 8 });
	await expect(game.locator('.stats span').first()).toContainText('0/');
	await page.mouse.up();
});

test('one-way trace against an arrow shows a rejection without spending a line', async ({
	page
}) => {
	const variant = 'one-line:one-way';
	const round = createOneLineRound('1', variant);
	const edge = round.edges.find((item) => item.directed)!;
	const game = await start(page, variant);
	await game.locator(`[data-dot="${edge.to}"]`).click();
	await game.locator(`[data-dot="${edge.from}"]`).click();
	await expect(game.locator('[data-message]')).toHaveText('That line only goes the other way.');
	await expect(game.locator('.stats span').first()).toContainText('0/');
});

test('countdown expires as a completed loss', async ({ page }) => {
	await page.clock.install();
	const game = await start(page, 'one-line:countdown');
	await page.clock.fastForward(120001);
	await expect(game).toHaveAttribute('data-status', 'timeout');
	await expect(page.locator('.result-number')).toHaveText('0', { timeout: 15000 });
});

test('correct and wrong verdicts finish with the expected scores', async ({ page, browser }) => {
	const variant = 'one-line:verdict';
	let seed = 1;
	while (createOneLineRound(String(seed), variant).odd.length <= 2) seed++;
	await start(page, variant, String(seed));
	await page.locator('[data-verdict="1"]').click();
	await expect(page.locator('.result-number')).toHaveText('500', { timeout: 15000 });
	let drawable = 1;
	while (createOneLineRound(String(drawable), variant).odd.length > 2) drawable++;
	// A fresh page initializes the selector and seed for the other verdict figure.
	const other = await browser.newContext();
	try {
		const otherPage = await other.newPage();
		await start(otherPage, variant, String(drawable));
		await otherPage.locator('[data-verdict="1"]').click();
		await expect(otherPage.locator('.result-number')).toHaveText('0', { timeout: 15000 });
	} finally {
		await other.close();
	}
});

test('keyboard-only play supports arrows, Enter, U, H, R and Next', async ({ page }) => {
	const game = await start(page);
	let round = createOneLineRound('1', CLASSIC);
	let cursor = 0;
	async function navigate(target: number) {
		const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const;
		const queue: { dot: number; path: string[] }[] = [{ dot: cursor, path: [] }];
		const seen = new Set([cursor]);
		while (queue.length) {
			const item = queue.shift()!;
			if (item.dot === target) {
				for (const key of item.path) await page.keyboard.press(key);
				cursor = target;
				return;
			}
			const origin = round.dots[item.dot]!;
			for (const key of keys) {
				const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
				const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
				const next = round.dots
					.map((dot, index) => ({
						index,
						forward: (dot.x - origin.x) * dx + (dot.y - origin.y) * dy,
						side: Math.abs((dot.x - origin.x) * dy - (dot.y - origin.y) * dx)
					}))
					.filter((dot) => dot.forward > 0)
					.sort((a, b) => a.forward + 2 * a.side - (b.forward + 2 * b.side))[0];
				if (next && !seen.has(next.index)) {
					seen.add(next.index);
					queue.push({ dot: next.index, path: [...item.path, key] });
				}
			}
		}
		throw new Error(`Dot ${target} is unreachable by keyboard`);
	}
	const first = round.solution.find((move) => move.action === 0)!;
	const firstEdge = round.edges[first.edge]!;
	await navigate(first.value);
	await page.keyboard.press('Enter');
	await navigate(firstEdge.from === first.value ? firstEdge.to : firstEdge.from);
	await page.keyboard.press('Enter');
	await expect(game.locator('.stats span').first()).toContainText('1/');
	await page.keyboard.press('u');
	await expect(game.locator('.stats span').first()).toContainText('0/');
	await page.keyboard.press('h');
	await page.keyboard.press('r');
	for (const move of round.solution) {
		if (move.action !== 0) continue;
		const stroke = round.strokes.at(-1);
		const current = stroke ? (stroke.path.at(-1)?.to ?? stroke.start) : move.value;
		if (!stroke) {
			await navigate(current);
			await page.keyboard.press('Enter');
		}
		const edge = round.edges[move.edge]!;
		await navigate(edge.from === current ? edge.to : edge.from);
		await page.keyboard.press('Enter');
		round = applyOneLineMove(round, move);
	}
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
	await page.keyboard.press('n');
	await expect(game).toHaveCount(0, { timeout: 20000 });
});

test('one continuous drag follows the solution to completion', async ({ page }) => {
	const game = await start(page);
	let round = createOneLineRound('1', CLASSIC);
	const solution = round.solution;
	const first = solution[0]!;
	async function point(dot: number) {
		const box = (await game.locator(`[data-dot="${dot}"]`).boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	}
	const startPoint = await point(first.value);
	await page.mouse.move(startPoint.x, startPoint.y);
	await page.mouse.down();
	for (const move of solution) {
		const stroke = round.strokes.at(-1);
		const current = stroke ? (stroke.path.at(-1)?.to ?? stroke.start) : move.value;
		const edge = round.edges[move.edge]!;
		const target = await point(edge.from === current ? edge.to : edge.from);
		await page.mouse.move(target.x, target.y);
		round = applyOneLineMove(round, move);
	}
	await page.mouse.up();
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
});

test('a stranded route shows a loss and zero points', async ({ page }) => {
	const initial = createOneLineRound('1', CLASSIC);
	let nodes = 0;
	function findLoss(
		round: typeof initial,
		moves: typeof initial.solution
	): typeof initial.solution | undefined {
		if (round.status === 'stranded') return moves;
		if (round.status !== 'playing' || ++nodes > 10000) return undefined;
		for (let edge = 0; edge < round.edges.length; edge++) {
			for (const value of round.strokes.length
				? [0]
				: [round.edges[edge]!.from, round.edges[edge]!.to]) {
				const move = { action: 0, edge, value };
				try {
					const found = findLoss(applyOneLineMove(round, move), [...moves, move]);
					if (found) return found;
				} catch {
					// Searching includes illegal edges.
				}
			}
		}
	}
	const loss = findLoss(initial, []);
	expect(loss).toBeDefined();
	await start(page);
	await solve(page, CLASSIC, '1', loss!);
	await expect(page.locator('.ending')).toContainText('Stranded — no way out.');
	await expect(page.locator('.result-number')).toHaveText('0', { timeout: 15000 });
});

test('a motion failure leaves the game playable', async ({ page }) => {
	await page.route('**/src/lib/puzzles/one-line/motion.ts*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/javascript',
			body: 'export function oneLineMotion(){throw new Error("injected failure");}'
		})
	);
	await start(page);
	await solve(page);
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
});

test('keeps the trace through reduced motion, rotation and checkpoint recovery', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.setViewportSize({ width: 390, height: 844 });
	const game = await start(page, CLASSIC, '1', false, 'no-preference');
	await expect(game).toHaveAttribute('data-phase', 'arrival');
	await page.keyboard.press('h');
	await expect(game.locator('.stats span').nth(2)).toHaveText('Hints 3');
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await solve(page, CLASSIC, '1', createOneLineRound('1').solution.slice(0, 1));
	const lines = game.locator('.stats span').first();
	await expect(lines).toContainText('1/6');
	const trace = game.locator('.drawn').first();
	await expect
		.poll(() => trace.evaluate((node) => (node as SVGElement).style.strokeDasharray))
		.not.toBe('');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect
		.poll(() => trace.evaluate((node) => (node as SVGElement).style.strokeDasharray))
		.toBe('');
	await page.setViewportSize({ width: 844, height: 390 });
	await expect(lines).toContainText('1/6');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect
		.poll(() =>
			page.evaluate(async () => {
				const db = await new Promise<IDBDatabase>((resolve, reject) => {
					const request = indexedDB.open('morphi-checkpoint', 1);
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
				try {
					return await new Promise<number | undefined>((resolve, reject) => {
						const request = db.transaction('active').objectStore('active').get('guest');
						request.onsuccess = () => resolve(request.result?.moves.length);
						request.onerror = () => reject(request.error);
					});
				} finally {
					db.close();
				}
			})
		)
		.toBe(1);
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await expect(lines).toContainText('1/6');
	await game.locator('[data-undo]').click();
	await expect(lines).toContainText('0/6');
	await solve(page);
	await expect(page.locator('.result-number')).toHaveText('600');
	await page.goto('/');
	await expect(game).toHaveCount(0);
	expect(errors).toEqual([]);
});
