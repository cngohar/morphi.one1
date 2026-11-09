import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import vectors from '../vectors/memory-batch-h.json' with { type: 'json' };
import type { MemoryMove } from '../../src/lib/puzzles/memory/logic.js';

const viewports = [
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 1280, height: 800 }
];
const evidence = 'build/v1.3.5.15/app';
type Vector = (typeof vectors)[number];
type Reference = {
	stacks: number[][];
	revealed: number[];
	matched: number[];
	shelf: { index: number; stack: number } | null;
	echo: number[];
	cursor: number;
	attempts: number;
	misses: number;
};
function initial(vector: Vector): Reference {
	return {
		stacks: structuredClone(vector.stacks),
		revealed: [],
		matched: [],
		shelf: null,
		echo: [],
		cursor: 0,
		attempts: 0,
		misses: 0
	};
}
const symbol = (vector: Vector, index: number) => vector.deck[index].split(':')[0];
const tops = (round: Reference) => round.stacks.map((stack) => stack.at(-1) ?? -1);
// Independent reference transitions operate on frozen decks and stack membership.
function advance(vector: Vector, before: Reference, action: MemoryMove): Reference {
	const round = structuredClone(before);
	if ('index' in action) {
		round.revealed.push(action.index);
		if (round.revealed.length === 2) {
			round.attempts += 1;
			const [a, b] = round.revealed;
			const order =
				vector.variant === 'memory:strata-order' &&
				symbol(vector, a) !== symbol(vector, (vector.pairs - 1 - round.cursor) * 2);
			if (symbol(vector, a) !== symbol(vector, b) || order) round.misses += 1;
		}
	} else if ('cancel' in action) round.revealed = [];
	else if ('lift' in action)
		round.shelf = { index: round.stacks[action.lift].pop()!, stack: action.lift };
	else if ('return' in action) {
		round.stacks[round.shelf!.stack].push(round.shelf!.index);
		round.shelf = null;
	} else if ('cycle' in action)
		round.stacks[action.cycle].unshift(round.stacks[action.cycle].pop()!);
	else if ('from' in action) round.stacks[action.to].push(round.stacks[action.from].pop()!);
	else if (round.echo.length) round.echo = [];
	else {
		const [a, b] = round.revealed;
		const matches =
			symbol(vector, a) === symbol(vector, b) &&
			(vector.variant !== 'memory:strata-order' ||
				symbol(vector, a) === symbol(vector, (vector.pairs - 1 - round.cursor) * 2));
		const affected = round.stacks.flatMap((stack, index) =>
			round.revealed.includes(stack.at(-1) ?? -1) ? [index] : []
		);
		if (matches) {
			round.matched.push(a, b);
			for (const index of affected) round.stacks[index].pop();
			if (round.shelf && round.revealed.includes(round.shelf.index)) round.shelf = null;
			round.cursor += 1;
		} else if (vector.variant === 'memory:strata-slip') {
			for (const index of affected) round.stacks[index].unshift(round.stacks[index].pop()!);
		}
		round.revealed = [];
		const exposed = affected
			.map((index) => round.stacks[index].at(-1) ?? -1)
			.filter((index) => index >= 0);
		if (
			matches &&
			vector.variant === 'memory:strata-chain' &&
			exposed.length === 2 &&
			symbol(vector, exposed[0]) === symbol(vector, exposed[1])
		) {
			round.revealed = exposed;
			round.attempts += 1;
		}
		if (matches && vector.variant === 'memory:strata-echo') round.echo = exposed;
	}
	return round;
}
async function setup(page: Page, vector: Vector, motion: 'reduce' | 'no-preference' = 'reduce') {
	await page.emulateMedia({ reducedMotion: motion });
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
	}, vector.seed);
	await page.route('**/api/play/availability**', (route) =>
		route.fulfill({
			json: new URL(route.request().url()).searchParams.get('family')
				? { available: true }
				: { available: ['memory'], weights: { memory: 1 }, variants: { memory: [vector.variant] } }
		})
	);
	await page.route('**/api/play/scoring**', (route) =>
		route.fulfill({
			json: { version: 'brief-v1', values: { pair: 1000, mismatch: 150, second: 5 } }
		})
	);
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await expect(page.locator('.active-round')).toHaveAttribute('data-family', 'memory');
	await expect(page.locator('.active-round')).not.toHaveAttribute('data-variant');
	await expect(page.locator('.game')).not.toHaveAttribute('data-variant');
}
async function nativeMove(page: Page, action: MemoryMove) {
	if ('index' in action) await page.locator(`[data-card-index="${action.index}"]`).click();
	else if ('lift' in action || 'cycle' in action || 'from' in action) {
		const source = 'lift' in action ? action.lift : 'cycle' in action ? action.cycle : action.from;
		await page.locator('[data-strata-source]').selectOption(String(source));
		if ('from' in action)
			await page.locator('[data-strata-destination]').selectOption(String(action.to));
		await page
			.locator(
				`[data-strata-utility="${'lift' in action ? 'lift' : 'cycle' in action ? 'cycle' : 'transfer'}"]`
			)
			.click();
	} else if ('return' in action) await page.locator('[data-strata-utility="return"]').click();
	else
		await page
			.getByRole('button', {
				name: 'cancel' in action ? 'Cancel selection' : /^(Continue|Close echo)$/,
				exact: true
			})
			.click();
}
async function compare(page: Page, vector: Vector, round: Reference) {
	for (const [stack, top] of tops(round).entries()) {
		const target = page.locator(`[data-strata-top="${stack}"]`);
		if (top < 0) await expect(target).toHaveCount(0);
		else if (round.echo.includes(top)) {
			await expect(target).toHaveCount(0);
			await expect(page.locator(`[data-strata-clue="${top}"]`)).toBeVisible();
		} else {
			await expect(target).toHaveAttribute('data-card-index', String(top));
			await expect(target).toHaveAttribute('aria-pressed', String(round.revealed.includes(top)));
			const firstStack = tops(round).indexOf(round.revealed[0]);
			const ringBlocked =
				vector.variant === 'memory:strata-linked' &&
				round.revealed.length === 1 &&
				!round.revealed.includes(top) &&
				(stack - firstStack + 4) % 4 === 2;
			const levelBlocked =
				vector.variant === 'memory:strata-sweep' &&
				round.stacks[stack].length < Math.max(...round.stacks.map((stack) => stack.length));
			if (round.revealed.length === 2 || round.echo.length || ringBlocked || levelBlocked)
				await expect(target).toBeDisabled();
			else await expect(target).toBeEnabled();
		}
	}
	await expect(page.locator('[data-strata-shelf]')).toHaveCount(round.shelf ? 1 : 0);
	if (round.shelf)
		await expect(page.locator('[data-strata-shelf]')).toHaveAttribute(
			'data-card-index',
			String(round.shelf.index)
		);
	const held = round.revealed.length === 2 || round.echo.length > 0;
	if (held) {
		await expect(
			page.getByRole('button', { name: /^(Continue|Close echo)$/, exact: true })
		).toBeEnabled();
		await expect(page.locator('.strata button[data-card-index]:enabled')).toHaveCount(0);
	}
	if (round.echo.length) {
		await expect(page.locator('[data-strata-clue]')).toHaveCount(round.echo.length);
		await expect(page.locator('[data-strata-clue] button')).toHaveCount(0);
	}
	if (vector.variant === 'memory:strata-glimpse') {
		const stack = round.stacks.find((stack) => stack.at(-1) === round.revealed[0]);
		await expect(page.locator('[data-strata-clue]')).toHaveCount(
			round.revealed.length === 1 && (stack?.length ?? 0) > 1 ? 1 : 0
		);
	}
}
async function bounds(page: Page, tag: string) {
	const frame = (await page.locator('.game').boundingBox())!;
	const viewport = page.viewportSize()!;
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const boxes = await page.locator('.strata button, .strata select').evaluateAll((nodes) =>
		nodes
			.filter((node) => node.getClientRects().length)
			.map((node) => {
				const { x, y, width, height } = node.getBoundingClientRect();
				return { x, y, width, height };
			})
	);
	for (const box of boxes) {
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x).toBeGreaterThanOrEqual(Math.max(0, frame.x) - 1);
		expect(box.y).toBeGreaterThanOrEqual(Math.max(0, frame.y) - 1);
		expect(box.x + box.width).toBeLessThanOrEqual(
			Math.min(viewport.width, frame.x + frame.width) + 1
		);
		expect(box.y + box.height).toBeLessThanOrEqual(
			Math.min(viewport.height, frame.y + frame.height) + 1
		);
	}
	await mkdir(evidence, { recursive: true });
	await writeFile(`${evidence}/${tag}.json`, JSON.stringify({ frame, viewport, boxes }, null, 2));
	await page.screenshot({ path: `${evidence}/${tag}.png` });
}
for (const vector of vectors)
	for (const viewport of viewports) {
		test(`Batch H ${vector.variant} ${vector.pairs} pairs at ${viewport.width}x${viewport.height}`, async ({
			page
		}) => {
			await page.setViewportSize(viewport);
			await setup(page, vector);
			let round = initial(vector);
			const tag = `${vector.variant.slice(7)}-${vector.pairs}-${viewport.width}x${viewport.height}`;
			await expect(page.locator('.strata-top svg')).toHaveCount(0);
			await expect(page.locator('.covered button')).toHaveCount(0);
			await compare(page, vector, round);
			await bounds(page, `${tag}-opening`);
			await page.getByRole('button', { name: 'How to play', exact: true }).click();
			await expect(page.locator('dialog[open]')).toContainText('Continue');
			await page.keyboard.press('Escape');
			for (const [offset, action] of (vector.moves as MemoryMove[]).entries()) {
				if (offset === vector.moves.length - 1)
					await expect(page.locator('.result')).toHaveCount(0);
				await nativeMove(page, action);
				round = advance(vector, round, action);
				if (offset !== vector.moves.length - 1) await compare(page, vector, round);
				if (offset + 1 === vector.checkpointMoves.length) {
					await bounds(page, `${tag}-checkpoint`);
					if (viewport.width === 390) {
						await page.reload();
						await page.getByRole('button', { name: 'Resume', exact: true }).click();
						await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing');
						await compare(page, vector, round);
					}
				}
			}
			expect(round.matched).toHaveLength(vector.pairs * 2);
			await expect(page.locator('.ending')).toContainText('All layers cleared');
			await expect(page.locator('.result')).toBeVisible({ timeout: 15000 });
			await page.screenshot({ path: `${evidence}/${tag}-result.png` });
		});
	}

test('Batch H native linked access survives keyboard rotation and motion failure', async ({
	page
}) => {
	const vector = vectors.find((vector) => vector.variant === 'memory:strata-linked')!;
	await page.setViewportSize(viewports[0]);
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 3)
				throw new Error('test_card_motion_unavailable');
			return original(array);
		};
	});
	await setup(page, vector, 'no-preference');
	const first = vector.stacks[0].at(-1)!;
	await page.locator(`[data-card-index="${first}"]`).focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('[data-strata-top="2"]')).toBeDisabled();
	await page.setViewportSize(viewports[1]);
	await expect(page.locator(`[data-card-index="${first}"]`)).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('button', { name: 'Cancel selection', exact: true }).focus();
	await page.keyboard.press('Space');
	await expect(page.locator('.strata-top[aria-pressed="true"]')).toHaveCount(0);
	await bounds(page, 'keyboard-motion-rotation');
});
