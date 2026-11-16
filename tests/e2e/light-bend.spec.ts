import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';

type LightBendMove = { action: number; cell: number; value: number };
type LightBendVector = {
	seed: string;
	variant: string;
	band: number;
	width: number;
	height: number;
	mirrors: number[];
	tray: number;
	par: number;
	moves: LightBendMove[];
};
const vectors = JSON.parse(readFileSync('tests/vectors/light-bend.json', 'utf8')) as {
	generation: LightBendVector[];
};
const FAMILY = 'light-bend';
const CLASSIC = 'light-bend:classic';
const COUNTDOWN = 'light-bend:countdown-120';
const NO_PREVIEW = 'light-bend:no-preview';
const NO_HINT = 'light-bend:no-hint';
const PLACE = 'light-bend:place-your-own';
const CHECKPOINT = 'light-bend:checkpoint';
const ACTION = { rotate: 0, place: 1, undo: 2, hint: 3, reset: 4, fire: 5 } as const;
const viewports = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];
const EVIDENCE = 'build/v1.4.5/light-bend';

function vectorFor(variant: string, band?: number) {
	const found = vectors.generation.find(
		(entry) => entry.variant === variant && (band === undefined || entry.band === band)
	);
	if (!found) throw new Error(`Missing Light Bend vector for ${variant}/${band ?? 'any band'}`);
	return found;
}

async function installAvailability(page: Page, selectedVariant: string) {
	const available = familyIndex.filter((entry) => entry.enabled && entry.weight > 0);
	const variantLists = Object.fromEntries(
		available.map((entry) => [
			entry.id,
			entry.id === FAMILY
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
		const requested = new URL(route.request().url()).searchParams.get('family');
		const scoring =
			puzzleMetadata[requested as keyof typeof puzzleMetadata]?.scoring ??
			puzzleMetadata[FAMILY].scoring;
		return route.fulfill({ json: { version: scoring.version, values: scoring.defaults } });
	});
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
				eligible: [
					'block',
					'memory',
					'connect',
					'nonogram',
					'mahjong-solitaire',
					'tangram',
					'klondike-solitaire',
					'light-bend'
				],
				queue: [
					'light-bend',
					'block',
					'memory',
					'connect',
					'nonogram',
					'mahjong-solitaire',
					'tangram',
					'klondike-solitaire'
				],
				recent: [],
				cyclePosition: 0
			})
		);
	}, seed);
}

async function start(
	page: Page,
	vector: LightBendVector,
	reducedMotion: 'reduce' | 'no-preference' = 'reduce',
	variant = vector.variant
) {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.emulateMedia({ reducedMotion });
	await installAvailability(page, variant);
	await installSeed(page, vector.seed);
	await page.goto('/play');
	const game = page.locator('.game[data-family="light-bend"]');
	await expect(game).toHaveAttribute('data-seed', vector.seed, { timeout: 20000 });
	return game;
}

async function seeded(page: Page, vector: LightBendVector, variant = vector.variant) {
	const game = await start(page, vector, 'reduce', variant);
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 20000 });
	await expect(page.locator('[data-family-stage="light-bend"]')).toBeVisible();
	return game;
}

function cell(page: Page, index: number) {
	return page.locator(`.lb-board [data-cell="${index}"]`);
}

/** Screen point at the centre of a board cell, resolved from its live box. */
async function cellPoint(page: Page, index: number) {
	const box = await page.locator(`.lb-board [data-cell="${index}"]`).boundingBox();
	if (!box) throw new Error(`Light Bend cell ${index} is not on screen`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function tap(page: Page, index: number) {
	const point = await cellPoint(page, index);
	await page.mouse.move(point.x, point.y);
	await page.mouse.down();
	await page.mouse.up();
}

async function layoutBounds(page: Page) {
	return page.evaluate(() => {
		const rect = (selector: string) => {
			const node = document.querySelector(selector);
			if (!node) return null;
			const box = node.getBoundingClientRect();
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
			innerWidth: window.innerWidth,
			viewport: rect('.lb-viewport'),
			rail: rect('.lb-rail'),
			heading: rect('.lb-heading')
		};
	});
}

test('seeded Classic witness solves by tap, shows points and stars, and Next leaves Light Bend', async ({
	page
}) => {
	const vector = vectorFor(CLASSIC, 0);
	const game = await seeded(page, vector);
	expect(await game.getAttribute('data-par')).toBe(String(vector.par));
	await mkdir(EVIDENCE, { recursive: true });
	await page.screenshot({ path: `${EVIDENCE}/classic-opening-1280x800.png` });
	for (const move of vector.moves) await tap(page, move.cell);
	await expect(game).toHaveAttribute('data-phase', 'finished', { timeout: 5000 });
	await expect(page.getByRole('heading', { name: 'Well played.', exact: true })).toBeVisible({
		timeout: 5000
	});
	const result = page.getByRole('region', { name: 'Your score' });
	await expect(result).toBeVisible();
	// The score is a live number, and the result stats carry the star grade.
	await expect(result.locator('.result-number')).not.toBeEmpty();
	await expect(result.locator('.result-number')).toHaveText(/[\d,]+/);
	await expect(page.locator('.result-stats')).toContainText(String(vector.par));
	await expect(page.locator(`.game[data-family="light-bend"] [data-stars]`)).toContainText('3');
	await page.screenshot({ path: `${EVIDENCE}/classic-result-1280x800.png` });
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await expect(page.locator('.game[data-family="light-bend"]')).toHaveCount(0, { timeout: 20000 });
});

test('all four Gentle mirrors sit inside the phone viewport at the opening scale', async ({
	page
}) => {
	const vector = vectorFor(CLASSIC, 0);
	const game = await seeded(page, vector);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(game).toBeVisible();
	const bounds = await layoutBounds(page);
	expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.innerWidth);
	// Measured live from the board, not asserted from the arithmetic.
	const inside = await page.evaluate(() => {
		const viewport = document.querySelector('.lb-viewport')!.getBoundingClientRect();
		return Array.from(document.querySelectorAll('.lb-board [data-cell]')).map((node) => {
			const box = node.getBoundingClientRect();
			return {
				cell: Number(node.getAttribute('data-cell')),
				inside:
					box.left >= viewport.left - 1 &&
					box.right <= viewport.right + 1 &&
					box.top >= viewport.top - 1 &&
					box.bottom <= viewport.bottom + 1
			};
		});
	});
	expect(inside.length).toBe(vector.mirrors.length);
	for (const entry of inside) expect(entry.inside, `cell ${entry.cell}`).toBe(true);
	await mkdir(EVIDENCE, { recursive: true });
	await page.screenshot({ path: `${EVIDENCE}/classic-gentle-390x844.png` });
});

for (const variant of [CLASSIC, NO_PREVIEW, PLACE, CHECKPOINT]) {
	test(`${variant} lays out with zero horizontal overflow at all three viewports`, async ({
		page
	}) => {
		const vector = vectorFor(variant);
		const game = await seeded(page, vector, variant);
		const slug = variant.replace(':', '-');
		await mkdir(`${EVIDENCE}/layouts`, { recursive: true });
		for (const viewport of viewports) {
			await page.setViewportSize(viewport);
			await expect(game).toBeVisible();
			const bounds = await layoutBounds(page);
			expect(bounds.scrollWidth, `${variant} ${viewport.width}`).toBeLessThanOrEqual(
				bounds.innerWidth
			);
			expect(bounds.viewport!.width).toBeGreaterThan(0);
			expect(bounds.viewport!.height).toBeGreaterThan(0);
			expect(bounds.rail!.width).toBeGreaterThan(0);
			await page.screenshot({
				path: `${EVIDENCE}/layouts/${slug}-${viewport.width}x${viewport.height}.png`
			});
		}
	});
}

test('a drag past 12 px pans the board without rotating a mirror', async ({ page }) => {
	const vector = vectorFor(CLASSIC, 0);
	const game = await seeded(page, vector);
	const viewport = page.locator('.lb-viewport');
	const before = Number(await viewport.getAttribute('data-offset-x'));
	const litBefore = await page.locator('.lb-status').textContent();
	const point = await cellPoint(page, vector.mirrors[0]!);
	// 40 px of drag: well past the slop, so the gesture is a pan and not a tap.
	await page.mouse.move(point.x + 40, point.y);
	await page.mouse.down();
	await page.mouse.move(point.x, point.y, { steps: 8 });
	await page.mouse.up();
	await expect(viewport).not.toHaveAttribute('data-offset-x', String(before));
	expect(Number(await viewport.getAttribute('data-offset-x'))).toBeLessThan(before);
	// Nothing rotated: the lit count and the selection are exactly as they were.
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await expect(page.locator('.lb-status')).toHaveText(litBefore ?? '');
	await expect(page.locator('.lb-board [data-cell].lb-selected')).toHaveCount(0);
});

test('a 12 px-or-less gesture is a tap and rotates exactly one mirror, once per gesture', async ({
	page
}) => {
	const vector = vectorFor(CLASSIC, 0);
	const game = await seeded(page, vector);
	const viewport = page.locator('.lb-viewport');
	const offsetBefore = Number(await viewport.getAttribute('data-offset-x'));
	const point = await cellPoint(page, vector.mirrors[0]!);
	await page.mouse.move(point.x + 6, point.y + 4);
	await page.mouse.down();
	await page.mouse.move(point.x, point.y, { steps: 3 });
	await page.mouse.up();
	// A tap rotates: the mirror cell's orientation class flips from slash to backslash.
	const rotated = page.locator(`.lb-board [data-cell="${vector.mirrors[0]}"]`);
	const classes = (await rotated.getAttribute('class')) ?? '';
	expect(classes.includes('lb-selected')).toBe(true);
	expect(Number(await viewport.getAttribute('data-offset-x'))).toBe(offsetBefore);
	await expect(game).toHaveAttribute('data-phase', 'playing');
});

test('a second finger cancels the pending tap', async ({ page }) => {
	const vector = vectorFor(CLASSIC, 0);
	await seeded(page, vector);
	const point = await cellPoint(page, vector.mirrors[0]!);
	await page.mouse.move(point.x, point.y);
	await page.mouse.down();
	// A second pointer presses while the first is still down.
	await page.evaluate(({ x, y }) => {
		const viewport = document.querySelector('.lb-viewport')!;
		viewport.dispatchEvent(
			new PointerEvent('pointerdown', {
				pointerId: 99,
				pointerType: 'touch',
				clientX: x + 30,
				clientY: y + 30,
				bubbles: true,
				button: 0
			})
		);
	}, point);
	await page.mouse.up();
	const cell = page.locator(`.lb-board [data-cell="${vector.mirrors[0]}"]`);
	const classes = (await cell.getAttribute('class')) ?? '';
	expect(classes.includes('lb-selected')).toBe(false);
});

test('zoom buttons and Fit keep the playable cells at or above the 44 px floor', async ({
	page
}) => {
	const vector = vectorFor(CLASSIC, 0);
	await seeded(page, vector);
	await page.setViewportSize({ width: 390, height: 844 });
	const scale = async () => Number(await page.locator('.lb-board').getAttribute('data-scale'));
	const smallest = async () => (await scale()) * 64;
	// Fit is the smallest the board ever gets; it may never drop below 44 px cells.
	await page.getByRole('button', { name: /^Fit/ }).click();
	expect(await smallest()).toBeGreaterThanOrEqual(43.9);
	await page.getByRole('button', { name: /^Zoom in/ }).click();
	expect(await smallest()).toBeGreaterThan(43.9);
	await page.getByRole('button', { name: /^Zoom out/ }).click();
	await page.getByRole('button', { name: /^Zoom out/ }).click();
	await page.getByRole('button', { name: /^Zoom out/ }).click();
	expect(await smallest()).toBeGreaterThanOrEqual(43.9);
});

test('keyboard-only play solves Classic and starts Next with N and no pointer', async ({
	page
}) => {
	const vector = vectorFor(CLASSIC, 0);
	const game = await seeded(page, vector);
	await page.locator('.game[data-family="light-bend"]').focus();
	// Movement never needs the mouse: arrows pick a mirror, Enter rotates the selection.
	for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'])
		await page.keyboard.press(key);
	await page.keyboard.press('h');
	await page.keyboard.press('u');
	await page.keyboard.press('r');
	await page.keyboard.press('f');
	await page.keyboard.press('+');
	await page.keyboard.press('-');
	await expect(page.locator('[data-hints-left]')).toContainText('2');
	// Solve by selecting each mirror with arrows and pressing Enter the needed turns.
	for (const move of vector.moves) {
		for (let press = 0; press < 200; press++) {
			const selected = await page.evaluate(
				() =>
					document.querySelector('.lb-board [data-cell].lb-selected')?.getAttribute('data-cell') ??
					null
			);
			if (selected === String(move.cell)) break;
			await page.keyboard.press('ArrowRight');
		}
		await page.keyboard.press('Enter');
	}
	await expect(game).toHaveAttribute('data-phase', 'finished', { timeout: 5000 });
	await expect(page.getByRole('heading', { name: 'Well played.', exact: true })).toBeVisible({
		timeout: 5000
	});
	await page.keyboard.press('N');
	await expect(page.locator('.game[data-family="light-bend"]')).toHaveCount(0, { timeout: 20000 });
});

test('a blocked beam keeps the board playable and never ends the round', async ({ page }) => {
	const vector = vectorFor(CLASSIC, 0);
	const game = await seeded(page, vector);
	// Rotate to a wrong orientation first: the beam is blocked, not lost.
	const [wrong] = vector.mirrors;
	await tap(page, wrong!);
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await expect(page.locator('.lb-caption')).toContainText(/[Ll]ight|blocked|beam/);
	// The board is still interactive: undo restores the opening state.
	await page.getByRole('button', { name: /^Undo/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'playing');
});

test('no-preview holds the win until Fire, and a wrong rotation clears the firing', async ({
	page
}) => {
	const vector = vectorFor(NO_PREVIEW);
	const game = await seeded(page, vector, NO_PREVIEW);
	// The live beam is withheld while playing.
	await expect(page.locator('.lb-beam')).toHaveCount(0);
	for (const move of vector.moves) if (move.action !== ACTION.fire) await tap(page, move.cell);
	// The trace is complete but the round is still in play.
	await expect(game).toHaveAttribute('data-phase', 'playing');
	await page.getByRole('button', { name: /^Fire/ }).click();
	await expect(game).toHaveAttribute('data-phase', 'finished', { timeout: 5000 });
	await expect(page.locator('.lb-beam')).toHaveCount(1);
});

test('countdown-120 hides the timer at zero and ends the run with no score', async ({ page }) => {
	const vector = vectorFor(COUNTDOWN);
	const game = await seeded(page, vector, COUNTDOWN);
	await expect(page.locator('[data-countdown]')).toBeVisible();
	// Fast-forward the round clock by 125 s through the page's own clock.
	await page.evaluate(() => {
		const realNow = performance.now.bind(performance);
		let skew = 0;
		performance.now = () => realNow() + skew;
		(window as unknown as { __lbSkew: (ms: number) => void }).__lbSkew = (ms: number) => {
			skew = ms;
		};
	});
	await page.evaluate(() =>
		(window as unknown as { __lbSkew: (ms: number) => void }).__lbSkew(125_000)
	);
	await expect(game).toHaveAttribute('data-phase', 'finished', { timeout: 5000 });
	// A timed end keeps the board and shows the run-over panel, never a score.
	const over = page.locator('.lb-run-over');
	await expect(over).toBeVisible();
	await expect(over).toContainText('Run over');
	await expect(over).toContainText('saves no score');
	await expect(page.getByRole('region', { name: 'Your score' })).toHaveCount(0);
	// The board stays inspectable: the mirrors and beam are still drawn.
	await expect(page.locator('.lb-board [data-cell]')).toHaveCount(vector.mirrors.length);
});

test('place-your-own starts with an empty board and a tray, and placement fills a slot', async ({
	page
}) => {
	const vector = vectorFor(PLACE);
	const game = await seeded(page, vector, PLACE);
	// The tray is the hand the Gentle band allows; `mirrors` is every placement cell.
	const tray = vector.tray;
	expect(tray).toBeGreaterThan(0);
	expect(vector.mirrors.length).toBeGreaterThan(tray);
	await expect(page.locator('[data-tray-left]')).toContainText(String(tray));
	const slots = page.locator('.lb-board .lb-slot');
	expect(await slots.count()).toBe(vector.mirrors.length);
	await expect(page.locator('.lb-board .lb-mirror')).toHaveCount(0);
	await tap(page, vector.mirrors[0]!);
	await expect(page.locator('.lb-board .lb-mirror')).toHaveCount(1);
	await expect(page.locator('[data-tray-left]')).toContainText(String(tray - 1));
	await expect(game).toHaveAttribute('data-phase', 'playing');
});

test('no-hint disables the hint control and the H key does nothing', async ({ page }) => {
	const vector = vectorFor(NO_HINT);
	const game = await seeded(page, vector, NO_HINT);
	await expect(page.getByRole('button', { name: /^Hint/ })).toBeDisabled();
	await expect(page.locator('[data-hints-left]')).toContainText('0');
	const before = await page.locator('.lb-caption').getAttribute('aria-live');
	await page.keyboard.press('h');
	await expect(page.locator('.lb-caption')).toHaveAttribute('aria-live', before ?? 'polite');
	await expect(game).toHaveAttribute('data-phase', 'playing');
});

test('reduced motion settles the entrance without delaying the board', async ({ page }) => {
	const vector = vectorFor(CLASSIC, 0);
	const game = await start(page, vector, 'reduce');
	// With reduced motion the board is playable immediately, not after 3,000 ms.
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 2000 });
	const point = await cellPoint(page, vector.mirrors[0]!);
	await page.mouse.click(point.x, point.y);
	await expect(game).toHaveAttribute('data-phase', 'playing');
});

test('entrance locks input and pauses while hidden', async ({ page }) => {
	const vector = vectorFor(CLASSIC, 0);
	const game = await start(page, vector, 'no-preference');
	await expect(game).toHaveAttribute('data-phase', 'arrival');
	await expect(page.locator('[data-family-stage="light-bend"]')).toBeVisible();
	const mirror = cell(page, vector.mirrors[0]!);
	const label = await mirror.getAttribute('aria-label');
	await game.focus();
	await page.keyboard.press('Enter');
	await expect(mirror).toHaveAttribute('aria-label', label!);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(3200);
	await expect(game).toHaveAttribute('data-phase', 'arrival');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
});

test('failed motion settles to a playable board', async ({ page }) => {
	await page.route('**/src/lib/puzzles/light-bend/motion.ts*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/javascript',
			body: 'export function lightBendEnter() { throw new Error("injected motion failure"); }'
		})
	);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const vector = vectorFor(CLASSIC, 0);
	const game = await start(page, vector, 'no-preference');
	await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	const mirror = cell(page, vector.mirrors[0]!);
	const label = await mirror.getAttribute('aria-label');
	await tap(page, vector.mirrors[0]!);
	await expect(mirror).not.toHaveAttribute('aria-label', label!);
	expect(errors).toEqual([]);
});

test('a failed Stage load shows Retry and Home', async ({ page }) => {
	await page.route('**/src/lib/puzzles/light-bend/Stage.svelte*', (route) => route.abort());
	const vector = vectorFor(CLASSIC, 0);
	await installAvailability(page, CLASSIC);
	await installSeed(page, vector.seed);
	await page.goto('/play');
	await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible({
		timeout: 15000
	});
	await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeVisible();
	await expect(page.locator('body')).not.toBeEmpty();
});
