import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';

type TangramMove = {
	piece: number;
	xp: number;
	xq: number;
	yp: number;
	yq: number;
	rot: number;
	flip: number;
	at?: number;
};
type TangramVector = { seed: string; variant: string; moves: TangramMove[] };
const vectors = JSON.parse(readFileSync('tests/vectors/tangram.json', 'utf8')) as {
	generation: TangramVector[];
};
const classic = 'tangram:classic';
const tangramVariants = [
	'tangram:classic',
	'tangram:flip-off',
	'tangram:sei-shonagon',
	'tangram:double-14',
	'tangram:coloured-map',
	'tangram:no-full-size',
	'tangram:countdown-120',
	'tangram:mistake-limit-4',
	'tangram:falling-pieces',
	'tangram:hint-budget-3',
	'tangram:no-hint'
];
const viewports = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];

function classicVector() {
	const vector = vectors.generation.find((entry) => entry.variant === classic);
	if (!vector) throw new Error('Missing seeded Tangram Classic witness');
	return vector;
}

function vectorForVariant(variant: string) {
	const vector = vectors.generation.find((entry) => entry.variant === variant);
	if (!vector) throw new Error(`Missing seeded Tangram witness for ${variant}`);
	return vector;
}

async function installAvailability(page: Page, selectedVariant: string) {
	const available = familyIndex.filter((entry) => entry.enabled && entry.weight > 0);
	const variantLists = Object.fromEntries(
		available.map((entry) => [
			entry.id,
			entry.id === 'tangram'
				? [selectedVariant]
				: (puzzleMetadata[entry.id]?.variants ?? [])
						.filter((variant) => variant.enabled !== false)
						.map((variant) => variant.id)
		])
	) as Record<string, string[]>;
	await page.route('**/api/play/availability**', async (route) => {
		const family = new URL(route.request().url()).searchParams.get('family');
		await route.fulfill({
			json: family
				? { available: true }
				: {
						available: available.map((entry) => entry.id),
						weights: Object.fromEntries(available.map((entry) => [entry.id, entry.weight])),
						variants: variantLists
					}
		});
	});
	await page.route('**/api/play/scoring**', (route) => {
		const requestedFamily = new URL(route.request().url()).searchParams.get('family');
		const scoring =
			puzzleMetadata[requestedFamily as keyof typeof puzzleMetadata]?.scoring ??
			puzzleMetadata.tangram.scoring;
		return route.fulfill({
			json: { version: scoring.version, values: scoring.defaults }
		});
	});
}

function overlaps(
	a: { x: number; y: number; width: number; height: number },
	b: { x: number; y: number; width: number; height: number }
) {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function installSeed(page: Page, seed: string) {
	await page.addInitScript((value) => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = Number(value);
				return array;
			}
			return original(array);
		};
		localStorage.setItem('morphi.sound', 'off');
		localStorage.setItem(
			'morphi.selector.v2.guest',
			JSON.stringify({
				version: 1,
				eligible: ['block', 'memory', 'connect', 'nonogram', 'mahjong-solitaire', 'tangram'],
				queue: ['tangram', 'block', 'memory', 'connect', 'nonogram', 'mahjong-solitaire'],
				recent: [],
				cyclePosition: 0
			})
		);
	}, seed);
}

async function start(
	page: Page,
	vector: TangramVector,
	reducedMotion: 'reduce' | 'no-preference',
	variant = vector.variant
) {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.emulateMedia({ reducedMotion });
	await installAvailability(page, variant);
	await installSeed(page, vector.seed);
	await page.goto('/play');
	const game = page.locator('.game[data-family="tangram"]');
	await expect(game).toHaveAttribute('data-seed', vector.seed, { timeout: 15000 });
	return game;
}

async function seeded(page: Page, vector: TangramVector, variant = vector.variant) {
	const game = await start(page, vector, 'reduce', variant);
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await expect(page.locator('[data-family-stage="tangram"]')).toBeVisible();
	await expect(page.getByRole('button', { name: /New silhouette/i })).toHaveCount(0);
	return game;
}

function trayPiece(page: Page, piece: number) {
	return page.locator(`.tangram-tray [data-piece="${piece}"]`);
}

async function waitForArrival(page: Page, piece: number) {
	const tray = trayPiece(page, piece);
	if ((await tray.getAttribute('data-arrived')) !== null)
		await expect(tray).toHaveAttribute('data-arrived', 'true', { timeout: 10000 });
}

function boardPiece(page: Page, piece: number) {
	return page.locator(`.tangram-board [data-piece="${piece}"]`);
}

async function focusPieceWithTab(page: Page, piece: number) {
	const selector = String(piece);
	for (let attempt = 0; attempt < 100; attempt++) {
		if (
			await page.evaluate(
				(value) => document.activeElement?.getAttribute('data-piece') === value,
				selector
			)
		)
			return;
		await page.keyboard.press('Tab');
	}
	throw new Error(`Tab order did not reach Tangram piece ${piece}`);
}

async function position(piece: ReturnType<typeof boardPiece>) {
	const values = await piece.evaluate((node) => ({
		xp: node.getAttribute('data-xp'),
		xq: node.getAttribute('data-xq'),
		yp: node.getAttribute('data-yp'),
		yq: node.getAttribute('data-yq'),
		rot: node.getAttribute('data-rot'),
		flip: node.getAttribute('data-flip')
	}));
	for (const [key, value] of Object.entries(values))
		if (value === null) throw new Error(`Tangram draft is missing data-${key}`);
	return {
		xp: Number(values.xp),
		xq: Number(values.xq),
		yp: Number(values.yp),
		yq: Number(values.yq),
		rot: Number(values.rot),
		flip: values.flip === '1' || values.flip === 'true' ? 1 : 0
	};
}

async function orient(page: Page, piece: ReturnType<typeof boardPiece>, move: TangramMove) {
	const current = await position(piece);
	let turns = (((move.rot - current.rot) % 8) + 8) % 8;
	if (turns > 4) {
		turns = 8 - turns;
		for (let turn = 0; turn < turns; turn++) await page.keyboard.press('Shift+R');
	} else {
		for (let turn = 0; turn < turns; turn++) await page.keyboard.press('R');
	}
	if ((move.flip ? 1 : 0) !== current.flip) await page.keyboard.press('F');
}

async function pressDelta(page: Page, key: string, delta: number) {
	for (let count = 0; count < Math.abs(delta); count++) await page.keyboard.press(key);
}

async function applyKeyboardMove(
	page: Page,
	move: TangramMove,
	placedCount: number,
	totalPieces = 7
) {
	await waitForArrival(page, move.piece);
	await focusPieceWithTab(page, move.piece);
	const piece = boardPiece(page, move.piece);
	await expect(piece).toBeVisible();
	await orient(page, piece, move);
	let current = await position(piece);
	await pressDelta(
		page,
		`Shift+Arrow${move.xp > current.xp ? 'Right' : 'Left'}`,
		move.xp - current.xp
	);
	current = await position(piece);
	await pressDelta(page, `Arrow${move.xq > current.xq ? 'Right' : 'Left'}`, move.xq - current.xq);
	current = await position(piece);
	await pressDelta(
		page,
		`Shift+Arrow${move.yp > current.yp ? 'Down' : 'Up'}`,
		move.yp - current.yp
	);
	current = await position(piece);
	await pressDelta(page, `Arrow${move.yq > current.yq ? 'Down' : 'Up'}`, move.yq - current.yq);
	await page.keyboard.press('Enter');
	await expectPlaced(page, piece, move, placedCount, totalPieces);
}

async function project(page: Page, location: Pick<TangramMove, 'xp' | 'xq' | 'yp' | 'yq'>) {
	return page.locator('.tangram-board').evaluate((svg, point) => {
		const matrix = (svg as SVGSVGElement).getScreenCTM();
		if (!matrix) throw new Error('Tangram board has no screen transform');
		const projected = new DOMPoint(
			(point.xp + point.xq * Math.SQRT2) / 4,
			(point.yp + point.yq * Math.SQRT2) / 4
		).matrixTransform(matrix);
		return { x: projected.x, y: projected.y };
	}, location);
}

async function polygonCenter(piece: ReturnType<typeof boardPiece>) {
	return piece
		.locator('polygon')
		.first()
		.evaluate((polygon) => {
			const shape = polygon as SVGPolygonElement;
			const matrix = shape.getScreenCTM();
			if (!matrix || shape.points.numberOfItems < 3)
				throw new Error('Tangram piece polygon is unavailable');
			let x = 0;
			let y = 0;
			for (let index = 0; index < shape.points.numberOfItems; index++) {
				const point = shape.points.getItem(index);
				x += point.x;
				y += point.y;
			}
			const center = new DOMPoint(
				x / shape.points.numberOfItems,
				y / shape.points.numberOfItems
			).matrixTransform(matrix);
			return { x: center.x, y: center.y };
		});
}

async function applyPointerMove(
	page: Page,
	move: TangramMove,
	placedCount: number,
	totalPieces = 7
) {
	await waitForArrival(page, move.piece);
	await focusPieceWithTab(page, move.piece);
	const piece = boardPiece(page, move.piece);
	await expect(piece).toBeVisible();
	await orient(page, piece, move);
	const current = await position(piece);
	const from = await polygonCenter(piece);
	const [currentOrigin, targetOrigin] = await Promise.all([
		project(page, current),
		project(page, move)
	]);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	if (Math.hypot(targetOrigin.x - currentOrigin.x, targetOrigin.y - currentOrigin.y) < 5)
		await page.mouse.move(from.x + 10, from.y);
	await page.mouse.move(
		from.x + targetOrigin.x - currentOrigin.x,
		from.y + targetOrigin.y - currentOrigin.y,
		{ steps: 6 }
	);
	await page.mouse.up();
	await expectPlaced(page, piece, move, placedCount, totalPieces);
}

async function dropAtOccupiedSlot(page: Page, move: TangramMove, occupied: TangramMove) {
	await waitForArrival(page, move.piece);
	await focusPieceWithTab(page, move.piece);
	const piece = boardPiece(page, move.piece);
	await expect(piece).toBeVisible();
	await orient(page, piece, move);
	const current = await position(piece);
	const from = await polygonCenter(piece);
	const [currentOrigin, occupiedOrigin] = await Promise.all([
		project(page, current),
		project(page, occupied)
	]);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(
		from.x + occupiedOrigin.x - currentOrigin.x,
		from.y + occupiedOrigin.y - currentOrigin.y,
		{ steps: 6 }
	);
	await page.mouse.up();
}

async function expectPlaced(
	page: Page,
	piece: ReturnType<typeof boardPiece>,
	move: TangramMove,
	placedCount: number,
	totalPieces = 7
) {
	await expect(piece).toHaveAttribute('data-xp', String(move.xp));
	await expect(piece).toHaveAttribute('data-xq', String(move.xq));
	await expect(piece).toHaveAttribute('data-yp', String(move.yp));
	await expect(piece).toHaveAttribute('data-yq', String(move.yq));
	await expect(piece).toHaveAttribute('data-rot', String(move.rot));
	await expect(piece).toHaveAttribute('data-flip', String(move.flip));
	await expect(page.locator('.game[data-family="tangram"]')).toContainText(
		`${placedCount} of ${totalPieces} pieces placed`
	);
}

async function captureVariantLayouts(page: Page, variant: string) {
	const board = page.locator('.tangram-board');
	const tray = page.locator('.tangram-tray');
	const playedLabel = page.locator('.played-stack p');
	const highScoreLabel = page.locator('.family-high > span');
	const helpButtons = page.locator('.tangram-footer .help-controls .btn');
	const slug = variant.replace(':', '-');
	await mkdir('build/v1.4.4/variants/browser', { recursive: true });
	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		await expect(board).toBeVisible();
		await expect(tray).toBeVisible();
		const bounds = await page.evaluate(() => {
			const rect = (selector: string) => {
				const box = document.querySelector(selector)!.getBoundingClientRect();
				return {
					x: box.x,
					y: box.y,
					width: box.width,
					height: box.height,
					right: box.right,
					bottom: box.bottom
				};
			};
			return {
				scrollWidth: document.documentElement.scrollWidth,
				scrollHeight: document.documentElement.scrollHeight,
				board: rect('.tangram-board'),
				tray: rect('.tangram-tray')
			};
		});
		expect(bounds.scrollWidth).toBeLessThanOrEqual(viewport.width);
		expect(bounds.scrollHeight).toBeLessThanOrEqual(viewport.height);
		expect(bounds.board.width).toBeGreaterThan(0);
		expect(bounds.board.height).toBeGreaterThan(0);
		expect(bounds.tray.width).toBeGreaterThan(0);
		expect(bounds.tray.height).toBeGreaterThan(0);
		if (viewport.width === 390) expect(bounds.board.bottom).toBeLessThanOrEqual(bounds.tray.y + 1);
		else expect(bounds.board.right).toBeLessThanOrEqual(bounds.tray.x + 1);
		await expect(playedLabel).toBeVisible();
		await expect(highScoreLabel).toBeVisible();
		await expect(helpButtons).toHaveCount(2);
		const playedBox = await playedLabel.boundingBox();
		const highScoreBox = await highScoreLabel.boundingBox();
		if (!playedBox || !highScoreBox) throw new Error('Tangram footer labels are not measurable');
		expect(overlaps(playedBox, highScoreBox)).toBe(false);
		for (const helpButton of await helpButtons.all()) {
			await expect(helpButton).toBeVisible();
			const helpBox = await helpButton.boundingBox();
			if (!helpBox) throw new Error('Tangram help button is not measurable');
			expect(overlaps(playedBox, helpBox)).toBe(false);
		}
		if (viewport.width === 390 && variant !== 'tangram:double-14') {
			const leg = await trayPiece(page, 3)
				.locator('polygon')
				.evaluate((polygon) => {
					const shape = polygon as SVGPolygonElement;
					const matrix = shape.getScreenCTM();
					if (!matrix || shape.points.numberOfItems !== 3)
						throw new Error('Small triangle polygon is unavailable');
					const points = Array.from({ length: 3 }, (_, index) => {
						const point = shape.points.getItem(index);
						return new DOMPoint(point.x, point.y).matrixTransform(matrix);
					});
					return Math.min(
						...points.map((point, index) => {
							const next = points[(index + 1) % 3]!;
							return Math.hypot(next.x - point.x, next.y - point.y);
						})
					);
				});
			expect(leg).toBeGreaterThanOrEqual(44);
		}
		await page.screenshot({
			path: `build/v1.4.4/variants/browser/tangram-${slug}-square-${viewport.width}x${viewport.height}.png`
		});
	}
}

async function finish(
	page: Page,
	ending: Promise<void>,
	evidence?: string,
	evidenceDirectory = 'build/v1.4.4/baseline/browser'
) {
	await ending;
	if (evidence) {
		await mkdir(evidenceDirectory, { recursive: true });
		await page.screenshot({ path: `${evidenceDirectory}/${evidence}-ending.png` });
	}
	await expect(page.getByRole('heading', { name: 'Well played.', exact: true })).toBeVisible({
		timeout: 5000
	});
	await expect(page.getByRole('region', { name: 'Your score' })).toBeVisible();
	await expect(page.locator('[aria-label*="pieces placed"]')).toBeVisible();
	if (evidence) await page.screenshot({ path: `${evidenceDirectory}/${evidence}-result.png` });
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await expect(page.locator('.game[data-family="tangram"]')).toHaveCount(0, { timeout: 15000 });
}

async function assertVariantDelta(page: Page, game: Locator, variant: string) {
	if (variant === 'tangram:double-14') {
		await expect(trayPiece(page, 0)).toBeVisible();
		await expect(page.locator('.tangram-tray [data-piece]')).toHaveCount(14);
		await expect(game).toContainText('0 of 14 pieces placed');
		return;
	}
	await expect(page.locator('.tangram-tray [data-piece]')).toHaveCount(7);
	switch (variant) {
		case 'tangram:flip-off': {
			await expect(page.getByRole('button', { name: 'Flip F', exact: true })).toBeDisabled();
			await waitForArrival(page, 6);
			await focusPieceWithTab(page, 6);
			const parallelogram = boardPiece(page, 6);
			await expect(parallelogram).toHaveAttribute('data-flip', '0');
			await page.keyboard.press('F');
			await expect(parallelogram).toHaveAttribute('data-flip', '0');
			break;
		}
		case 'tangram:coloured-map': {
			const mapPieces = page.locator('.map-piece');
			await expect(mapPieces).toHaveCount(7);
			for (const piece of await mapPieces.all()) await expect(piece).toBeVisible();
			break;
		}
		case 'tangram:no-full-size':
			await expect(page.locator('.tangram-reference .silhouette')).toBeVisible();
			await expect(page.locator('.tangram-board .silhouette')).toHaveCount(0);
			break;
		case 'tangram:countdown-120':
			await expect(page.locator('[data-countdown]')).toHaveAttribute('data-countdown', /\d+/);
			break;
		case 'tangram:mistake-limit-4':
			await expect(page.locator('[data-mistakes-left]')).toHaveAttribute('data-mistakes-left', '4');
			break;
		case 'tangram:hint-budget-3':
			await expect(page.locator('[data-hints-left]')).toHaveAttribute('data-hints-left', '3');
			break;
		case 'tangram:no-hint': {
			const hint = page.getByRole('button', { name: /^Hint/ });
			await expect(hint).toBeDisabled();
			await page.keyboard.press('H');
			await expect(game).toContainText('0 of 7 pieces placed');
			break;
		}
	}
}

test('seeded Classic witness solves through pointer input, saves a result, and Next leaves Tangram', async ({
	page
}) => {
	const vector = classicVector();
	const game = await seeded(page, vector);
	await expect(game).toHaveAttribute('data-seed', vector.seed);
	await expect(page.locator('.tangram-board')).toBeVisible();
	await mkdir('build/v1.4.4/baseline/browser', { recursive: true });
	const lastIndex = vector.moves.length - 1;
	for (const [index, move] of vector.moves.entries()) {
		if (index === lastIndex) break;
		await applyPointerMove(page, move, index + 1);
		if (index === 0)
			await page.screenshot({
				path: 'build/v1.4.4/baseline/browser/tangram-classic-first-piece.png'
			});
	}
	const ending = page
		.locator('.ending strong')
		.filter({ hasText: 'Silhouette complete!' })
		.waitFor({ state: 'visible', timeout: 5000 });
	await applyPointerMove(page, vector.moves[lastIndex]!, lastIndex + 1);
	await finish(page, ending, 'tangram-classic');
});

test('keyboard-only Tangram Classic witness uses Tab, nudges, rotation, flip, and hint', async ({
	page
}) => {
	const vector = classicVector();
	const game = await seeded(page, vector);
	await focusPieceWithTab(page, vector.moves[0]!.piece);
	await page.keyboard.press('H');
	await expect(game).toContainText('1 of 7 pieces placed');
	await expect(game).toContainText(/Hints used\s*1/i);
	await expectPlaced(page, boardPiece(page, vector.moves[0]!.piece), vector.moves[0]!, 1);
	const lastIndex = vector.moves.length - 1;
	for (const [index, move] of vector.moves.slice(1).entries()) {
		const vectorIndex = index + 1;
		if (vectorIndex === lastIndex) break;
		await applyKeyboardMove(page, move, vectorIndex + 1);
	}
	const ending = page
		.locator('.ending strong')
		.filter({ hasText: 'Silhouette complete!' })
		.waitFor({ state: 'visible', timeout: 5000 });
	await applyKeyboardMove(page, vector.moves[lastIndex]!, lastIndex + 1);
	await finish(page, ending);
});

test('repeated taps rotate the focused piece by 45 degrees each time', async ({ page }) => {
	const vector = classicVector();
	await seeded(page, vector);
	const piece = vector.moves[0]!.piece;
	await focusPieceWithTab(page, piece);
	const draft = boardPiece(page, piece);
	await expect(draft).toHaveAttribute('data-rot', '0');
	await draft.click();
	await expect(draft).toHaveAttribute('data-rot', '1');
	await draft.click();
	await expect(draft).toHaveAttribute('data-rot', '2');
	await page.keyboard.press('Shift+R');
	await expect(draft).toHaveAttribute('data-rot', '1');
	await page.keyboard.press('R');
	await expect(draft).toHaveAttribute('data-rot', '2');
});

test('Classic board and tray fit all three viewports with a 44px small-triangle leg', async ({
	page
}) => {
	const vector = classicVector();
	await seeded(page, vector);
	const board = page.locator('.tangram-board');
	const playedLabel = page.locator('.played-stack p');
	const highScoreLabel = page.locator('.family-high > span');
	const helpButtons = page.locator('.tangram-footer .help-controls .btn');
	await mkdir('build/v1.4.4/baseline/browser', { recursive: true });
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 844, height: 390 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(viewport);
		await expect(board).toBeVisible();
		const bounds = await page.evaluate(() => {
			const rect = (selector: string) => {
				const box = document.querySelector(selector)!.getBoundingClientRect();
				return {
					x: box.x,
					y: box.y,
					width: box.width,
					height: box.height,
					right: box.right,
					bottom: box.bottom
				};
			};
			return {
				innerWidth,
				innerHeight,
				scrollWidth: document.documentElement.scrollWidth,
				scrollHeight: document.documentElement.scrollHeight,
				board: rect('.tangram-board'),
				tray: rect('.tangram-tray')
			};
		});
		expect(bounds.scrollWidth).toBeLessThanOrEqual(viewport.width);
		expect(bounds.scrollHeight).toBeLessThanOrEqual(viewport.height);
		expect(bounds.board.width).toBeGreaterThan(0);
		expect(bounds.board.height).toBeGreaterThan(0);
		expect(bounds.tray.width).toBeGreaterThan(0);
		expect(bounds.tray.height).toBeGreaterThan(0);
		await expect(playedLabel).toBeVisible();
		await expect(highScoreLabel).toBeVisible();
		await expect(helpButtons).toHaveCount(2);
		const playedBox = await playedLabel.boundingBox();
		const highScoreBox = await highScoreLabel.boundingBox();
		if (!playedBox || !highScoreBox) throw new Error('Tangram footer labels are not measurable');
		expect(overlaps(playedBox, highScoreBox)).toBe(false);
		for (const helpButton of await helpButtons.all()) {
			await expect(helpButton).toBeVisible();
			const helpBox = await helpButton.boundingBox();
			if (!helpBox) throw new Error('Tangram help button is not measurable');
			expect(overlaps(playedBox, helpBox)).toBe(false);
		}
		if (viewport.width === 390) expect(bounds.board.bottom).toBeLessThanOrEqual(bounds.tray.y + 1);
		else expect(bounds.board.right).toBeLessThanOrEqual(bounds.tray.x + 1);
		if (viewport.width === 390) {
			const leg = await trayPiece(page, 3)
				.locator('polygon')
				.evaluate((polygon) => {
					const shape = polygon as SVGPolygonElement;
					const matrix = shape.getScreenCTM();
					if (!matrix || shape.points.numberOfItems !== 3)
						throw new Error('Small triangle polygon is unavailable');
					const points = Array.from({ length: 3 }, (_, index) => {
						const point = shape.points.getItem(index);
						return new DOMPoint(point.x, point.y).matrixTransform(matrix);
					});
					return Math.min(
						...points.flatMap((point, index) => {
							const next = points[(index + 1) % 3]!;
							return [Math.hypot(next.x - point.x, next.y - point.y)];
						})
					);
				});
			expect(leg).toBeGreaterThanOrEqual(44);
		}
		await page.screenshot({
			path: `build/v1.4.4/baseline/browser/tangram-${viewport.width}x${viewport.height}.png`
		});
	}
});

for (const variant of tangramVariants) {
	test(`${variant} renders in three viewports and solves through its frozen pointer witness`, async ({
		page
	}) => {
		const vector = vectorForVariant(variant);
		const totalPieces = vector.moves.length;
		expect(totalPieces).toBe(variant === 'tangram:double-14' ? 14 : 7);
		const game = await seeded(page, vector, variant);
		await expect(game).toHaveAttribute('data-seed', vector.seed);
		await assertVariantDelta(page, game, variant);
		await captureVariantLayouts(page, variant);

		await page.setViewportSize({ width: 1280, height: 800 });
		const lastIndex = vector.moves.length - 1;
		for (const [index, move] of vector.moves.entries()) {
			if (index === lastIndex) break;
			await applyPointerMove(page, move, index + 1, totalPieces);
		}
		const ending = page
			.locator('.ending strong')
			.filter({ hasText: 'Silhouette complete!' })
			.waitFor({ state: 'visible', timeout: 5000 });
		await applyPointerMove(page, vector.moves[lastIndex]!, lastIndex + 1, totalPieces);
		await finish(page, ending, variant.replace(':', '-'), 'build/v1.4.4/variants/browser');
	});
}

test('Hint and Peek share the three-hint budget', async ({ page }) => {
	const vector = vectorForVariant('tangram:hint-budget-3');
	await seeded(page, vector, 'tangram:hint-budget-3');
	const hint = page.getByRole('button', { name: 'Hint H', exact: true });
	const peek = page.getByRole('button', { name: 'Peek', exact: true });
	const hintsLeft = page.locator('[data-hints-left]');
	await expect(hintsLeft).toHaveAttribute('data-hints-left', '3');
	await hint.click();
	await expect(hintsLeft).toHaveAttribute('data-hints-left', '2');
	await peek.click();
	await expect(hintsLeft).toHaveAttribute('data-hints-left', '1');
	await hint.click();
	await expect(hintsLeft).toHaveAttribute('data-hints-left', '0');
	await expect(hint).toBeDisabled();
	await expect(peek).toBeDisabled();
	await page.keyboard.press('H');
	await expect(hintsLeft).toHaveAttribute('data-hints-left', '0');
});

test('the countdown reaches zero through the app clock and ends without a score result', async ({
	page
}) => {
	await page.clock.install();
	const vector = vectorForVariant('tangram:countdown-120');
	const game = await start(page, vector, 'reduce', 'tangram:countdown-120');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const countdown = page.locator('[data-countdown]');
	await expect(countdown).toHaveAttribute('data-countdown', /\d+/);
	await page.clock.runFor(120_000);
	await expect(countdown).toHaveAttribute('data-countdown', '0');
	await expect(page.locator('.tangram-over[role="status"]')).toBeVisible();
	await expect(page.getByRole('button', { name: /Try another puzzle/i })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Well played.', exact: true })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Your score' })).toHaveCount(0);
});

test('falling pieces become keyboard-available in an increasing-speed idle queue', async ({
	page
}) => {
	const vector = vectorForVariant('tangram:falling-pieces');
	const game = await start(page, vector, 'no-preference', 'tangram:falling-pieces');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const pieces = page.locator('.tangram-tray [data-piece]');
	await expect(pieces).toHaveCount(7);
	const schedule = await pieces.evaluateAll((nodes) =>
		nodes.map((node) => ({
			id: Number(node.getAttribute('data-piece')),
			arrived: node.getAttribute('data-arrived'),
			arrivalAt: Number(node.getAttribute('data-arrival-at'))
		}))
	);
	const times = schedule.map((piece) => piece.arrivalAt).sort((a, b) => a - b);
	expect(times.every(Number.isFinite)).toBe(true);
	const gaps = times.slice(1).map((time, index) => time - times[index]!);
	for (const gap of gaps) expect(gap).toBeGreaterThan(0);
	for (let index = 1; index < gaps.length; index++)
		expect(gaps[index]!).toBeLessThan(gaps[index - 1]!);
	const pendingId = schedule.find((piece) => piece.arrived !== 'true')?.id;
	expect(pendingId).toBeDefined();
	const pending = trayPiece(page, pendingId!);
	await expect(pending).toHaveAttribute('data-arrived', 'false');
	await expect(pending).toHaveAttribute('tabindex', '-1');
	await expect(pending).toHaveCSS('visibility', 'hidden');
	await pending.evaluate((node) => (node as HTMLElement).focus());
	await page.keyboard.press('Enter');
	await expect(boardPiece(page, pendingId!)).toHaveCount(0);
	await expect(pending).toHaveAttribute('data-arrived', 'true', { timeout: 10000 });
	await expect(pending).toHaveAttribute('tabindex', '0');
});

test('four rejected occupied-slot snaps run the mistake-limit round over without a result', async ({
	page
}) => {
	const vector = vectorForVariant('tangram:mistake-limit-4');
	const totalPieces = vector.moves.length;
	const game = await seeded(page, vector, 'tangram:mistake-limit-4');
	const mistakesLeft = page.locator('[data-mistakes-left]');
	await expect(mistakesLeft).toHaveAttribute('data-mistakes-left', '4');
	await applyPointerMove(page, vector.moves[0]!, 1, totalPieces);
	for (let index = 0; index < 4; index++) {
		if (index > 0) {
			await trayPiece(page, vector.moves[1]!.piece).focus();
			await page.keyboard.press('Space');
		}
		await dropAtOccupiedSlot(page, vector.moves[1]!, vector.moves[0]!);
		await expect(mistakesLeft).toHaveAttribute('data-mistakes-left', String(3 - index));
		if (index < 3) await expect(game).toContainText('1 of 7 pieces placed');
	}
	await expect(page.locator('.tangram-over[role="status"]')).toBeVisible();
	await expect(page.getByRole('button', { name: /Try another puzzle/i })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Well played.', exact: true })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Your score' })).toHaveCount(0);
});

test('reduced motion settles the entrance while the game stays playable', async ({ page }) => {
	const vector = classicVector();
	const game = await seeded(page, vector);
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await focusPieceWithTab(page, vector.moves[0]!.piece);
	await page.keyboard.press('R');
	await expect(boardPiece(page, vector.moves[0]!.piece)).toHaveAttribute('data-rot', '1');
});

test('entrance locks early input, pauses while hidden, and fits after landscape resize', async ({
	page
}) => {
	const vector = classicVector();
	const game = await start(page, vector, 'no-preference');
	await expect(game).toHaveAttribute('data-phase', 'arrival', { timeout: 10000 });
	const noPlacements = '0 of 7 pieces placed';
	await expect(game).toContainText(noPlacements);
	await trayPiece(page, vector.moves[0]!.piece).evaluate((node) => (node as HTMLElement).focus());
	await page.keyboard.press('Enter');
	await expect(game).toHaveAttribute('data-phase', 'arrival');
	await expect(game).toContainText(noPlacements);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(1700);
	await expect(game).toHaveAttribute('data-phase', 'arrival');
	await page.setViewportSize({ width: 844, height: 390 });
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
	const board = await page.locator('.tangram-board').boundingBox();
	expect(board?.width).toBeGreaterThan(0);
	expect(board?.height).toBeGreaterThan(0);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed motion settles to a playable Classic board', async ({ page }) => {
	await page.route('**/src/lib/puzzles/tangram/motion.ts*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/javascript',
			body: 'export function tangramEnter() { throw new Error("injected Tangram motion failure"); }'
		})
	);
	const vector = classicVector();
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const game = await start(page, vector, 'no-preference');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await applyKeyboardMove(page, vector.moves[0]!, 1);
	expect(errors).toEqual([]);
});

test('a failed Tangram Stage load shows Retry and Home instead of a blank page', async ({
	page
}) => {
	await page.route('**/src/lib/puzzles/tangram/Stage.svelte*', (route) => route.abort());
	const vector = classicVector();
	await installSeed(page, vector.seed);
	await page.goto('/play');
	await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible({
		timeout: 15000
	});
	await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeVisible();
	await expect(page.locator('body')).not.toBeEmpty();
});
