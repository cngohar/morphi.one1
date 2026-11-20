import { expect, test, type Page } from '@playwright/test';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';
import {
	boardGeometry,
	createShapeDivisionRound,
	vertexPoint,
	type ShapeDivisionRound
} from '../../src/lib/puzzles/shape-division/logic.js';

const family = 'shape-division';
const classic = 'shape-division:classic';
const seed = '24';
const sizes = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];
const round = createShapeDivisionRound(seed);
const membership = round.board.cells.map((_, cell) =>
	round.board.solution.findIndex((piece) => piece.includes(cell))
);
const cuts = round.board.links
	.filter(({ cells: [a, b] }) => membership[a] !== membership[b])
	.map(({ edge }) => edge);

async function start(
	page: Page,
	variant = classic,
	motion: 'reduce' | 'no-preference' = 'reduce',
	waitForPlaying = true
) {
	await page.emulateMedia({ reducedMotion: motion });
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
								entry.id === family
									? [variant]
									: (puzzleMetadata[entry.id].variants ?? []).map((row) => row.id)
							])
						)
					}
		})
	);
	await page.route('**/api/play/scoring**', (route) => {
		const id = new URL(route.request().url()).searchParams.get('family')!;
		const config = puzzleMetadata[id]?.scoring ?? puzzleMetadata[family].scoring;
		return route.fulfill({ json: { version: config.version, values: config.defaults } });
	});
	await page.addInitScript(
		({ ids, seed }) => {
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
					queue: ['shape-division', ...ids.filter((id) => id !== 'shape-division')],
					recent: [],
					cyclePosition: 0
				})
			);
		},
		{ ids: available.map((entry) => entry.id), seed }
	);
	await page.goto('/play');
	const game = page.locator('.shape-game[data-family="shape-division"]');
	if (waitForPlaying)
		await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 30000 });
	return game;
}
async function tap(page: Page, vertex: number) {
	await page.locator(`[data-vertex="${vertex}"]`).click();
}
async function solve(page: Page) {
	for (const [a, b] of cuts) {
		await tap(page, a);
		await tap(page, b);
	}
	await page.getByRole('button', { name: 'Check', exact: true }).click();
}
for (const size of sizes)
	test(`solves the production board at ${size.width}x${size.height}`, async ({ page }) => {
		await page.setViewportSize(size);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const game = await start(page);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		for (const [a, b] of cuts) {
			await tap(page, a);
			await tap(page, b);
		}
		await expect(game.locator('[data-piece]')).toHaveCount(4);
		await page.getByRole('button', { name: 'Check', exact: true }).click();
		await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
		expect(
			Number((await page.locator('.result-number').textContent())!.replaceAll(',', ''))
		).toBeGreaterThan(0);
		expect(errors).toEqual([]);
	});

test('a wrong production Check records a mistake and remains playable', async ({ page }) => {
	const game = await start(page);
	await page.getByRole('button', { name: 'Check', exact: true }).click();
	await expect(game.locator('.stats')).toContainText('1 / 3');
	await expect(game.locator('.message')).toBeVisible();
	await solve(page);
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
});

test('countdown expires as a completed loss', async ({ page }) => {
	await page.clock.install();
	await start(page, 'shape-division:countdown-300');
	await page.clock.fastForward(300001);
	await expect(page.locator('.result-number')).toHaveText('0', { timeout: 15000 });
});

test('keyboard-only play supports arrows, Enter, Undo, Hint, Restart and Check', async ({
	page
}) => {
	const game = await start(page);
	await page.getByRole('application', { name: 'Shape Division board' }).focus();
	let cursor = round.board.vertices[0]!;
	async function navigate(target: number) {
		const queue: { vertex: number; keys: string[] }[] = [{ vertex: cursor, keys: [] }];
		const seen = new Set([cursor]);
		while (queue.length) {
			const current = queue.shift()!;
			if (current.vertex === target) {
				for (const key of current.keys) await page.keyboard.press(key);
				cursor = target;
				return;
			}
			const [x, y] = vertexPoint(round.board, current.vertex);
			for (const [key, dx, dy] of [
				['ArrowLeft', -1, 0],
				['ArrowRight', 1, 0],
				['ArrowUp', 0, -1],
				['ArrowDown', 0, 1]
			] as const) {
				const next = round.board.vertices.find((vertex) => {
					const [vx, vy] = vertexPoint(round.board, vertex);
					return vx === x + dx && vy === y + dy;
				});
				if (next !== undefined && !seen.has(next)) {
					seen.add(next);
					queue.push({ vertex: next, keys: [...current.keys, key] });
				}
			}
		}
		throw new Error(`Vertex ${target} is unreachable`);
	}
	async function cut(a: number, b: number) {
		await navigate(a);
		await page.keyboard.press('Enter');
		await navigate(b);
		await page.keyboard.press('Enter');
	}
	await cut(...cuts[0]!);
	await expect(game.locator('[data-piece]')).toHaveCount(2);
	await page.keyboard.press('u');
	await expect(game.locator('[data-piece]')).toHaveCount(0);
	await page.keyboard.press('h');
	await expect(game.locator('.hint')).toHaveCount(1);
	await page.keyboard.press('r');
	for (const [a, b] of cuts) await cut(a, b);
	await page.keyboard.press('c');
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
	await expect(page.locator('.result-stats')).toHaveAttribute('aria-label', /solved with hint/i);
});

test('normal motion draws the outline and opens a gap as the pieces lift', async ({
	page
}, testInfo) => {
	const game = await start(page, classic, 'no-preference', false);
	await expect(game).toHaveAttribute('data-phase', 'opening', { timeout: 20000 });
	await expect(game.getByRole('button', { name: 'Check' })).toBeDisabled();
	await expect(game.locator('.outline')).toHaveAttribute('style', /stroke-dashoffset/);
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await tap(page, cuts[0]![0]);
	await tap(page, cuts[0]![1]);
	const inset = game.locator('[data-piece-inset]').first();
	await expect(inset).toHaveAttribute('stroke-width', '12');
	await expect(game.locator('[data-piece]').first()).toHaveCSS(
		'transform',
		/matrix\(1, 0, 0, 1, 0, -2\)/
	);
	await game.screenshot({ path: testInfo.outputPath('detached-pieces.png') });
	for (const [a, b] of cuts.slice(1)) {
		await tap(page, a);
		await tap(page, b);
	}
	await game.getByRole('button', { name: 'Check' }).click();
	await expect(page.locator('.result-number')).toBeVisible({ timeout: 15000 });
});

async function useFixture(page: Page, fixture: ShapeDivisionRound) {
	await page.route('**/shape-division/manifest.ts*', async (route) => {
		const response = await route.fetch();
		await route.fulfill({
			response,
			body: `${await response.text()}\nmanifest.createRound = () => (${JSON.stringify(fixture)});\n`
		});
	});
}

test('the square fixture rejects four 25% pieces with two shapes', async ({ page }) => {
	const cells = Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)] as const);
	const fixture = {
		...round,
		board: boardGeometry(cells),
		rules: { ...round.rules, pieceSize: 4 },
		pieces: [cells.map((_, i) => i)]
	};
	await useFixture(page, fixture);
	const game = await start(page);
	for (const [a, b] of [
		[5, 9],
		[10, 14],
		[12, 22]
	] as const) {
		await tap(page, a);
		await tap(page, b);
	}
	await expect(game.locator('[data-piece]')).toHaveCount(4);
	await expect(game.locator('.board-label')).toHaveText(['25%', '25%', '25%', '25%']);
	await game.getByRole('button', { name: 'Check' }).click();
	await expect(
		game.getByRole('status').filter({ hasText: 'same size but not the same shape' })
	).toBeVisible();
	await expect(game.locator('.stats')).toContainText('1 / 3');
});

test('an oversized checkpoint is discarded before resume', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(
		async (config) => {
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
							family: 'shape-division',
							seed: '24',
							engineVersion: 'shape-division-1',
							difficulty: null,
							modifiers: {},
							theme: null,
							scoring: config,
							moves: Array.from({ length: 10001 }, () => ({ action: 6, first: 0, second: 0 })),
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
		{ version: 'brief-v1', values: puzzleMetadata[family].scoring.defaults }
	);
	const discarded = page.waitForEvent('console', {
		predicate: (message) =>
			message.type() === 'warning' && message.text().includes('checkpoint_discarded')
	});
	await start(page);
	expect((await discarded).text()).toContain('invalid_or_expired');
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
});

test('no-hint hides Hint and ignores its keyboard shortcut', async ({ page }) => {
	const game = await start(page, 'shape-division:no-hint');
	await expect(game.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
	await page.keyboard.press('h');
	await expect(game.locator('.hint')).toHaveCount(0);
});

test('an incomplete Equality-score Check stays in play without a mistake', async ({ page }) => {
	const game = await start(page, 'shape-division:equality-score');
	await game.getByRole('button', { name: 'Check', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await expect(game.locator('.stats')).toContainText('0 / 3');
	await expect(page.locator('.result-number')).toHaveCount(0);
});

test('restarting countdown preserves elapsed time', async ({ page }) => {
	await page.clock.install();
	const game = await start(page, 'shape-division:countdown-300');
	await page.clock.fastForward(10000);
	await expect(game.locator('.stats')).toContainText('4:50');
	await game.getByRole('button', { name: 'Restart', exact: true }).click();
	await expect(game.locator('.stats')).toContainText('4:50');
	await page.clock.fastForward(10000);
	await expect(game.locator('.stats')).toContainText('4:40');
});

test('the final move offers Try another puzzle when Equality-score cannot finish', async ({
	page
}) => {
	const variant = 'shape-division:equality-score';
	await useFixture(page, { ...createShapeDivisionRound(seed, variant), moves: 9999 });
	const game = await start(page, variant);
	await expect(game.getByRole('button', { name: 'Check', exact: true })).toBeDisabled();
	await expect(game.getByRole('button', { name: 'Try another puzzle', exact: true })).toBeVisible();
});
