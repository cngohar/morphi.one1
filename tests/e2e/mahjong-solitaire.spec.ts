import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

type MahjongMove = {
	tileA?: number;
	tileB?: number;
	tileC?: number;
	tile?: number;
	action?: number;
	at?: number;
};
type Vector = {
	seed: string;
	variant: string;
	band: number;
	moves: MahjongMove[];
};
const vectors = JSON.parse(readFileSync('tests/vectors/mahjong-solitaire.json', 'utf8')) as {
	generation: Vector[];
};
const classic = 'mahjong-solitaire:classic';
const variantRules: Record<string, string> = {
	'mahjong-solitaire:triple-match':
		'Select three matching free tiles to remove a triple. Each triple earns 150 points.',
	'mahjong-solitaire:exact-only':
		'Every match must have identical faces, including Flowers and Seasons.',
	'mahjong-solitaire:face-down-peek':
		'Twelve tiles start face-down. Tap a free face-down tile to reveal it permanently before matching it.',
	'mahjong-solitaire:no-highlight':
		'Judge which tiles are free from the stack. Free tiles have no special outline, dot or brightness.',
	'mahjong-solitaire:countdown':
		'Clear before time runs out: three minutes on the small board, ten on the larger boards. Each remaining second adds five points.',
	'mahjong-solitaire:three-hearts':
		'Each mismatch costs one of three hearts. Zero hearts ends the run; each remaining heart adds 250 points.',
	'mahjong-solitaire:no-undo':
		'Undo is unavailable. Shuffle or restart the same board to recover a blocked position.',
	'mahjong-solitaire:hint-budget':
		'You have three hints. Each highlights a free match and costs 100 points.',
	'mahjong-solitaire:shuffle-budget':
		'You have three shuffles. Each solvable re-deal costs 50 points and clears undo history.',
	'mahjong-solitaire:avalanche':
		'After each match, tiles above its empty slots in the same column slide down. Check which tiles become free.'
};

function vectorForBand(band: number) {
	return vectorForVariant(classic, band);
}

function vectorForVariant(variant: string, band?: number) {
	const vector = vectors.generation.find(
		(value) => value.variant === variant && (band === undefined || value.band === band)
	);
	if (!vector)
		throw new Error(
			`Missing seeded Mahjong fixture for ${variant}${band ? ` in band ${band}` : ''}`
		);
	return vector;
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
	}, seed);
}

async function seededVector(page: Page, vector: Vector) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await installSeed(page, vector.seed);
	await page.goto('/play');
	const game = page.locator('.mahjong-game');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await expect(game).toHaveAttribute('data-seed', vector.seed);
	await expect(game).toHaveAttribute('data-band', String(vector.band));
	return { game, vector };
}

async function seeded(page: Page, band: number) {
	return seededVector(page, vectorForBand(band));
}

function tile(page: Page, id: number) {
	return page.locator(`.mahjong-tile[data-tile="${id}"]`);
}

async function applyVectorMove(page: Page, move: MahjongMove) {
	const ids =
		move.tile !== undefined
			? [move.tile]
			: [move.tileA, move.tileB, move.tileC].filter((id): id is number => id !== undefined);
	if (!ids.length || (move.tile === undefined && ids.length < 2) || move.action !== undefined)
		throw new Error('Mahjong solution vectors must contain only pair/triple/peek moves');
	for (const id of ids)
		await page.locator(`.mahjong-tile[data-tile="${id}"][data-free="true"]`).click();
}

for (const [band, label] of [
	[1, 'Quick'],
	[2, 'Turtle'],
	[3, 'Fortress']
] as const) {
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800]
	] as const) {
		test(`${label} fits ${width}×${height} without page overflow`, async ({ page }) => {
			await page.setViewportSize({ width, height });
			await seeded(page, band);
			const viewport = page.locator('.mahjong-viewport');
			const viewportBounds = (await viewport.boundingBox())!;
			const board = (await page.locator('.mahjong-board').boundingBox())!;
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			expect(viewportBounds.x).toBeGreaterThanOrEqual(0);
			expect(viewportBounds.x + viewportBounds.width).toBeLessThanOrEqual(width);
			expect(board.x).toBeGreaterThanOrEqual(viewportBounds.x - 1);
			expect(board.x + board.width).toBeLessThanOrEqual(
				viewportBounds.x + viewportBounds.width + 1
			);
			if (band === 1 && width === 390) {
				const quickTile = (await page
					.locator('.mahjong-tile[data-free="true"]')
					.first()
					.boundingBox())!;
				expect(quickTile.width).toBeGreaterThanOrEqual(44);
			}
			if (band > 1 && width === 390) {
				await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
				await expect(viewport).toHaveAttribute('data-zoom', '1.5');
				const bounds = (await viewport.boundingBox())!;
				await page.mouse.move(bounds.x + bounds.width - 20, bounds.y + bounds.height / 2);
				await page.mouse.down();
				await page.mouse.move(bounds.x + 20, bounds.y + bounds.height / 2, { steps: 5 });
				await page.mouse.up();
				expect(await viewport.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
				await page.getByRole('button', { name: 'Fit', exact: true }).click();
				await expect(viewport).toHaveAttribute('data-zoom', '1');
			}
			await mkdir('build/v1.4.2/browser', { recursive: true });
			await page.screenshot({
				path: `build/v1.4.2/browser/${label.toLowerCase()}-${width}x${height}.png`
			});
		});
	}
}

test('seeded Quick witness solves, announces the clear, saves a result, and Next leaves Mahjong', async ({
	page
}) => {
	const { vector } = await seeded(page, 1);
	for (const move of vector.moves) await applyVectorMove(page, move);
	await expect(page.locator('.ending')).toContainText('Board cleared!');
	await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
	await expect(page.locator('.result-stats')).toBeVisible();
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await expect(page.locator('.mahjong-game')).toHaveCount(0, { timeout: 15000 });
});

test('keyboard arrows move among free tiles and Enter/Space remove a matching pair', async ({
	page
}) => {
	const { vector } = await seeded(page, 1);
	const move = vector.moves[0]!;
	const first = tile(page, move.tileA!);
	const second = tile(page, move.tileB!);
	await first.focus();
	await page.keyboard.press('ArrowRight');
	const focusedId = await page.evaluate(() => document.activeElement?.getAttribute('data-tile'));
	expect(focusedId).not.toBeNull();
	expect(await tile(page, Number(focusedId)).getAttribute('data-free')).toBe('true');
	await first.focus();
	await page.keyboard.press('Enter');
	await expect(first).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Escape');
	await expect(first).toHaveAttribute('aria-pressed', 'false');
	await first.focus();
	await page.keyboard.press('Enter');
	await second.focus();
	await page.keyboard.press('Space');
	await expect(first).toHaveCount(0, { timeout: 2000 });
	await expect(second).toHaveCount(0, { timeout: 2000 });
});

test('reduced motion settles the board while the logical entrance still locks early input', async ({
	page
}) => {
	const vector = vectorForBand(1);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await installSeed(page, vector.seed);
	await page.goto('/play');
	const game = page.locator('.mahjong-game');
	await expect(game).toHaveAttribute('data-phase', 'arrival', { timeout: 10000 });
	const first = page.locator(`.mahjong-tile[data-tile="${vector.moves[0]!.tileA!}"]`);
	expect(
		await first.locator('.tile-motion').evaluate((node) => getComputedStyle(node).opacity)
	).toBe('1');
	await first.focus();
	await page.keyboard.press('Enter');
	await expect(first).toHaveAttribute('aria-pressed', 'false');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
});

test('hidden-tab time pauses entrance, resize/reduced motion resumes it, and the page stays fitted', async ({
	page
}) => {
	const vector = vectorForBand(2);
	await page.setViewportSize({ width: 390, height: 844 });
	await installSeed(page, vector.seed);
	await page.goto('/play');
	const game = page.locator('.mahjong-game');
	await expect(game).toHaveAttribute('data-phase', 'arrival', { timeout: 10000 });
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(2200);
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

test('navigation during entrance cancels pending callbacks', async ({ page }) => {
	const vector = vectorForBand(1);
	await installSeed(page, vector.seed);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/play');
	await expect(page.locator('.mahjong-game')).toHaveAttribute('data-phase', 'arrival', {
		timeout: 10000
	});
	await page.goto('/');
	await page.waitForTimeout(2100);
	await expect(page.locator('.mahjong-game')).toHaveCount(0);
	expect(errors).toEqual([]);
});

test('failed motion settles to a playable state', async ({ page }) => {
	await page.route('**/src/lib/puzzles/mahjong-solitaire/motion.ts*', async (route) => {
		const response = await route.fetch();
		const body = await response.text();
		await route.fulfill({
			response,
			body: body.replace(
				'createTimeline({ autoplay: false })',
				'(() => { throw new Error("injected Mahjong motion failure"); })()'
			)
		});
	});
	const vector = vectorForBand(1);
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await installSeed(page, vector.seed);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/play');
	const game = page.locator('.mahjong-game');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await expect(page.locator('.mahjong-board')).toHaveAttribute('data-motion-ready', 'true');
	await applyVectorMove(page, vector.moves[0]!);
	await expect(tile(page, vector.moves[0]!.tileA!)).toHaveCount(0, { timeout: 2000 });
	await page.goto('/');
	await page.waitForTimeout(2100);
	await expect(page.locator('.mahjong-game')).toHaveCount(0);
	expect(errors).toEqual([]);
});

for (const variant of Object.keys(variantRules)) {
	test(`${variant} teaches its rule and clears from a frozen witness`, async ({ page }) => {
		const vector = vectorForVariant(
			variant,
			variant === 'mahjong-solitaire:exact-only' ? 2 : undefined
		);
		await page.setViewportSize({ width: 1280, height: 800 });
		const { game } = await seededVector(page, vector);
		await expect(page.locator('.entrance-rule')).toContainText(variantRules[variant]!);
		expect(await game.textContent()).not.toContain(variant);
		await expect(game).toHaveAttribute(
			'data-group-size',
			variant === 'mahjong-solitaire:triple-match' ? '3' : '2'
		);
		if (variant === 'mahjong-solitaire:no-highlight') {
			await expect(game).toHaveAttribute('data-highlight', 'false');
			await expect(page.locator('.mahjong-tile .free-dot')).toHaveCount(0);
		}
		if (variant === 'mahjong-solitaire:three-hearts')
			await expect(page.locator('.mahjong-hearts')).toHaveAttribute('data-hearts', '3');
		if (variant === 'mahjong-solitaire:countdown') {
			const initial = vector.band === 1 ? '180' : '600';
			await expect(game.locator('[data-countdown]')).toHaveAttribute('data-countdown', initial);
		}
		if (variant === 'mahjong-solitaire:face-down-peek') {
			const peek = vector.moves.find((move) => move.tile !== undefined)!;
			const hidden = tile(page, peek.tile!);
			await expect(hidden).toHaveAttribute('data-face-down', 'true');
			await expect(hidden).not.toHaveAttribute('data-face');
		}
		for (const move of vector.moves) {
			if (move.tile !== undefined) {
				const hidden = tile(page, move.tile);
				await expect(hidden).toHaveAttribute('data-face-down', 'true');
				await applyVectorMove(page, move);
				await expect(hidden).toHaveAttribute('data-face-down', 'false');
				await expect(hidden).toHaveAttribute('data-face', /.+/);
			} else await applyVectorMove(page, move);
		}
		await expect(page.locator('.ending')).toContainText('Board cleared!');
		await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('.result-stats')).toBeVisible();
	});
}

test('exact-only keeps different free Flower faces from matching', async ({ page }) => {
	const vector = vectorForVariant('mahjong-solitaire:exact-only', 2);
	await page.setViewportSize({ width: 1280, height: 800 });
	await seededVector(page, vector);
	async function differentFreeFlowers() {
		const flowers = await page
			.locator('.mahjong-tile[data-free="true"][data-face^="F"]')
			.evaluateAll((nodes) =>
				nodes.map((node) => ({
					id: Number(node.getAttribute('data-tile')),
					face: node.getAttribute('data-face')!
				}))
			);
		const first = flowers.find((a, index) =>
			flowers.slice(index + 1).some((b) => b.face !== a.face)
		);
		return first
			? {
					first,
					second: flowers.find((value) => value.id !== first.id && value.face !== first.face)!
				}
			: undefined;
	}
	let pair = await differentFreeFlowers();
	for (const move of vector.moves) {
		if (pair) break;
		await applyVectorMove(page, move);
		pair = await differentFreeFlowers();
	}
	expect(pair).toBeDefined();
	await tile(page, pair!.first.id).click();
	await tile(page, pair!.second.id).click();
	await expect(tile(page, pair!.first.id)).toHaveAttribute('aria-pressed', 'false');
	await expect(tile(page, pair!.second.id)).toHaveAttribute('aria-pressed', 'true');
	await expect(tile(page, pair!.first.id)).toHaveCount(1);
	await expect(tile(page, pair!.second.id)).toHaveCount(1);
});

test('three-hearts ends after three mismatches and keeps the unsaved board visible', async ({
	page
}) => {
	const vector = vectorForVariant('mahjong-solitaire:three-hearts', 1);
	await page.setViewportSize({ width: 1280, height: 800 });
	const { game } = await seededVector(page, vector);
	let selectedFace: string | undefined;
	for (let click = 0; click < 4; click++) {
		const free = await page.locator('.mahjong-tile[data-free="true"]').evaluateAll((nodes) =>
			nodes.map((node) => ({
				id: Number(node.getAttribute('data-tile')),
				face: node.getAttribute('data-face')!
			}))
		);
		const key = (face: string) => (face.startsWith('F') || face.startsWith('S') ? face[0] : face);
		const next = free.find(
			({ face }) => selectedFace === undefined || key(face) !== key(selectedFace)
		);
		expect(next).toBeDefined();
		await tile(page, next!.id).click();
		selectedFace = next!.face;
		if (click > 0)
			await expect(page.locator('.mahjong-hearts')).toHaveAttribute(
				'data-hearts',
				String(3 - click)
			);
	}
	await expect(game).toHaveAttribute('data-status', 'lost');
	await expect(game).toHaveAttribute('data-phase', 'finished');
	await expect(page.locator('.mahjong-board')).toBeVisible();
	await expect(page.locator('.result')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Try another puzzle', exact: true })).toBeVisible();
});

test('countdown timeout keeps its board visible without a result', async ({ page }) => {
	const vector = vectorForVariant('mahjong-solitaire:countdown', 1);
	await page.clock.install();
	const { game } = await seededVector(page, vector);
	await page.clock.fastForward(180_000);
	await page.clock.runFor(300);
	await expect(game).toHaveAttribute('data-status', 'lost');
	await expect(game).toHaveAttribute('data-phase', 'finished');
	await expect(game.locator('.mahjong-board')).toBeVisible();
	await expect(page.locator('.result')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Try another puzzle', exact: true })).toBeVisible();
});

test('hint budget stops at three uses', async ({ page }) => {
	const hintVector = vectorForVariant('mahjong-solitaire:hint-budget', 1);
	await page.setViewportSize({ width: 1280, height: 800 });
	await seededVector(page, hintVector);
	const hint = page.getByRole('button', { name: /^Hint/ });
	for (let used = 0; used < 3; used++) {
		await expect(page.locator('[data-hints-left]')).toHaveText(String(3 - used));
		await hint.click();
	}
	await expect(page.locator('[data-hints-left]')).toHaveText('0');
	await expect(hint).toBeDisabled();
});

test('shuffle budget stops at three uses', async ({ page }) => {
	const shuffleVector = vectorForVariant('mahjong-solitaire:shuffle-budget', 1);
	await page.setViewportSize({ width: 1280, height: 800 });
	await seededVector(page, shuffleVector);
	await applyVectorMove(page, shuffleVector.moves[0]!);
	const undo = page.getByRole('button', { name: 'Undo', exact: true });
	await expect(undo).toBeEnabled();
	const shuffle = page.getByRole('button', { name: /^Shuffle/ });
	for (let used = 0; used < 3; used++) {
		await expect(page.locator('[data-shuffles-left]')).toHaveText(String(3 - used));
		await shuffle.click();
		if (used === 0) await expect(undo).toBeDisabled();
	}
	await expect(page.locator('[data-shuffles-left]')).toHaveText('0');
	await expect(shuffle).toBeDisabled();
});

test('No Undo disables recovery after a pair is removed', async ({ page }) => {
	const noUndoVector = vectorForVariant('mahjong-solitaire:no-undo', 1);
	await page.setViewportSize({ width: 1280, height: 800 });
	await seededVector(page, noUndoVector);
	await applyVectorMove(page, noUndoVector.moves[0]!);
	await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('practice checkpoint restores solved tiles with the same seed', async ({ page }) => {
	const vector = vectorForBand(1);
	const { game } = await seededVector(page, vector);
	const firstMove = vector.moves[0]!;
	await applyVectorMove(page, firstMove);
	await page.waitForTimeout(700);
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await expect(game).toHaveAttribute('data-seed', vector.seed);
	await expect(tile(page, firstMove.tileA!)).toHaveCount(0);
	await expect(tile(page, firstMove.tileB!)).toHaveCount(0);
});
