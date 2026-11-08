import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import vectors from '../vectors/memory-time-strata.json' with { type: 'json' };
import type { MemoryMove } from '../../src/lib/puzzles/memory/logic.js';

const variant = 'memory:time-strata';
type ReferenceRound = {
	cards: { symbol: string }[];
	stacks: number[][];
	revealed: number[];
	matched: number[];
	status: string;
};

// The browser oracle starts from independently frozen vectors, never app-internal symbols.
function referenceRound(seed: string): ReferenceRound {
	const vector = vectors.find((vector) => vector.seed === seed)!;
	return {
		cards: vector.deck.map((id) => ({ symbol: id.split(':')[0] })),
		stacks: structuredClone(vector.stacks),
		revealed: [],
		matched: [],
		status: 'playing'
	};
}
const timeStrataTops = (round: ReferenceRound) => round.stacks.map((stack) => stack.at(-1) ?? -1);
function advanceReference(before: ReferenceRound, move: MemoryMove) {
	const round = structuredClone(before);
	if ('index' in move) round.revealed.push(move.index);
	else if ('cancel' in move) round.revealed = [];
	else {
		if (round.cards[round.revealed[0]].symbol === round.cards[round.revealed[1]].symbol) {
			round.matched.push(...round.revealed);
			for (const stack of round.stacks)
				if (round.revealed.includes(stack.at(-1) ?? -1)) stack.pop();
		}
		round.revealed = [];
		if (round.stacks.every((stack) => stack.length === 0)) round.status = 'won';
	}
	return { round };
}

const viewports = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];
const evidence = 'build/v1.3.5.14/app';

async function setup(
	page: Page,
	seed: string,
	reducedMotion: 'reduce' | 'no-preference' = 'reduce'
) {
	await page.emulateMedia({ reducedMotion });
	await page.addInitScript((seed) => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = Number(seed);
				return array;
			}
			return original(array);
		};
		const exposed: string[] = [];
		Object.assign(window, { strataOpeningExposed: exposed });
		new MutationObserver(() => {
			const game = document.querySelector('.game');
			if (
				game &&
				game.getAttribute('data-phase') !== 'playing' &&
				game.querySelector('.strata-top[aria-pressed="true"]')
			)
				exposed.push(game.getAttribute('data-phase') ?? '');
		}).observe(document, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['aria-pressed', 'data-phase']
		});
	}, seed);
	await page.route('**/api/play/availability**', (route) =>
		route.fulfill({
			json: new URL(route.request().url()).searchParams.get('family')
				? { available: true }
				: { available: ['memory'], weights: { memory: 1 }, variants: { memory: [variant] } }
		})
	);
	await page.route('**/api/play/scoring**', (route) =>
		route.fulfill({
			json: { version: 'brief-v1', values: { pair: 1000, mismatch: 150, second: 5 } }
		})
	);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await expect(page.locator('.active-round')).toHaveAttribute('data-variant', variant);
}

function exposedPair(round: ReferenceRound) {
	const tops = timeStrataTops(round).filter((index) => index >= 0);
	const first = tops.find((index) =>
		tops.some((other) => index !== other && round.cards[index].symbol === round.cards[other].symbol)
	)!;
	return [
		first,
		tops.find(
			(index) => index !== first && round.cards[index].symbol === round.cards[first].symbol
		)!
	];
}

async function move(page: Page, round: ReferenceRound, action: MemoryMove) {
	if ('index' in action) await page.locator(`[data-card-index="${action.index}"]`).click();
	else
		await page
			.getByRole('button', {
				name: 'continue' in action ? 'Continue' : 'Cancel selection',
				exact: true
			})
			.click();
	const result = advanceReference(round, action);
	return result.round;
}

async function resume(page: Page) {
	await page.reload();
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing');
}

async function bounds(page: Page, tag: string) {
	const viewport = page.viewportSize()!;
	const game = (await page.locator('.game').boundingBox())!;
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const boxes = await page.locator('.strata button').evaluateAll((nodes) =>
		nodes.map((node) => {
			const { x, y, width, height } = node.getBoundingClientRect();
			return { x, y, width, height };
		})
	);
	for (const box of boxes) {
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
		expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
		expect(box.x).toBeGreaterThanOrEqual(game.x);
		expect(box.y).toBeGreaterThanOrEqual(game.y);
		expect(box.x + box.width).toBeLessThanOrEqual(game.x + game.width + 1);
		expect(box.y + box.height).toBeLessThanOrEqual(game.y + game.height + 1);
	}
	await mkdir(evidence, { recursive: true });
	await page.screenshot({ path: `${evidence}/${tag}.png` });
	await writeFile(`${evidence}/${tag}.json`, JSON.stringify({ viewport, game, boxes }, null, 2));
}

for (const vector of vectors.slice(0, 3))
	for (const viewport of viewports) {
		test(`Time Strata ${vector.pairs} pairs at ${viewport.width}x${viewport.height}: tops, outcomes, recovery and completion`, async ({
			page
		}) => {
			await page.setViewportSize(viewport);
			await setup(page, vector.seed);
			let round = referenceRound(vector.seed);
			const tag = `${vector.pairs}-${viewport.width}x${viewport.height}`;
			await expect(page.locator('.strata-top')).toHaveCount(4);
			await expect(page.locator('.strata-top svg')).toHaveCount(0);
			await expect(page.locator('.covered button')).toHaveCount(0);
			await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(0);
			expect(await page.evaluate(() => Reflect.get(window, 'strataOpeningExposed'))).toEqual([]);
			await bounds(page, `${tag}-opening`);
			await page.getByRole('button', { name: 'How to play', exact: true }).click();
			await expect(page.locator('dialog[open]')).toContainText('Only each stack');
			await page.keyboard.press('Escape');
			const first = timeStrataTops(round)[0];
			round = await move(page, round, { index: first });
			if (viewport.width === 390) {
				await resume(page);
				await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(1);
			}
			await page.locator(`[data-card-index="${first}"]`).click();
			round = advanceReference(round, { cancel: 1 }).round;
			await expect(page.locator('.strata .status')).toContainText('No attempt spent');
			await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(0);
			round = await move(page, round, { index: first });
			round = await move(page, round, { cancel: 1 });
			const miss = timeStrataTops(round).find(
				(index) => round.cards[index].symbol !== round.cards[first].symbol
			)!;
			round = await move(page, round, { index: first });
			round = await move(page, round, { index: miss });
			await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeFocused();
			await expect(page.locator('.strata-top:enabled')).toHaveCount(0);
			await bounds(page, `${tag}-mismatch`);
			await page.waitForTimeout(700);
			await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(2);
			if (viewport.width === 390) await resume(page);
			await expect(page.locator('.strata .status')).toContainText('Different symbols');
			round = await move(page, round, { continue: 1 });
			await expect(page.locator(`[data-card-index="${first}"]`)).toBeFocused();
			await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(0);
			const pair = exposedPair(round);
			round = await move(page, round, { index: pair[0] });
			round = await move(page, round, { index: pair[1] });
			await bounds(page, `${tag}-match`);
			if (viewport.width === 390) await resume(page);
			await expect(page.locator('.strata .status')).toContainText('Pair found');
			await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(2);
			round = await move(page, round, { continue: 1 });
			await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(0);
			let sawEmpty = false;
			while (round.status === 'playing') {
				const [a, b] = exposedPair(round);
				round = await move(page, round, { index: a });
				round = await move(page, round, { index: b });
				if (round.matched.length === round.cards.length - 2)
					await expect(page.locator('.result')).toHaveCount(0);
				round = await move(page, round, { continue: 1 });
				if (round.status === 'playing' && round.stacks!.some((stack) => stack.length === 0)) {
					sawEmpty = true;
					await expect(page.locator('.strata .empty-well')).toHaveCount(
						round.stacks!.filter((stack) => stack.length === 0).length
					);
				}
			}
			expect(sawEmpty).toBe(true);
			await expect(page.locator('.ending')).toContainText('All layers cleared');
			await expect(page.locator('.result')).toBeVisible({ timeout: 15000 });
			await expect(page.locator('.result')).toContainText('Time Strata');
			await page.screenshot({ path: `${evidence}/${tag}-result.png` });
			await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
			await expect(page.locator('.game')).toHaveAttribute('data-round', '2');
			await expect(page.locator('.active-round')).toHaveAttribute('data-variant', variant);
		});
	}

test('Time Strata native keyboard selection and Continue survive rotation', async ({ page }) => {
	await page.setViewportSize(viewports[0]);
	await setup(page, vectors[0].seed);
	let round = referenceRound(vectors[0].seed);
	const [first, second] = exposedPair(round);
	await page.locator(`[data-card-index="${first}"]`).focus();
	await page.keyboard.press('Enter');
	round = advanceReference(round, { index: first }).round;
	await page.setViewportSize(viewports[1]);
	await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(1);
	await page.locator(`[data-card-index="${second}"]`).focus();
	await page.keyboard.press('Space');
	round = advanceReference(round, { index: second }).round;
	await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(0);
	expect(advanceReference(round, { continue: 1 }).round.matched).toHaveLength(2);
	await bounds(page, 'keyboard-rotation');
});

test('Time Strata face-down opening stays playable when Card motion fails', async ({ page }) => {
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 3)
				throw new Error('test_card_motion_unavailable');
			return original(array);
		};
	});
	await setup(page, vectors[0].seed, 'no-preference');
	expect(await page.evaluate(() => Reflect.get(window, 'strataOpeningExposed'))).toEqual([]);
	await expect(page.locator('.strata-top svg')).toHaveCount(0);
	const first = timeStrataTops(referenceRound(vectors[0].seed))[0];
	await page.locator(`[data-card-index="${first}"]`).click();
	await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(1);
});
