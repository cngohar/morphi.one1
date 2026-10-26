import { expect, test, type Page } from '@playwright/test';
import { fixSelectorSeed } from './entropy.js';

test.beforeEach(async ({ page }) => {
	await fixSelectorSeed(page);
});

type Slot = { index: number; cells: Array<{ x: number; y: number }> };
type BlockState = { board: boolean[]; slots: Array<Slot | null> };

type Layout = { name: string; width: number; height: number };

const layouts: Layout[] = [
	{ name: 'phone portrait', width: 390, height: 844 },
	{ name: 'phone landscape', width: 844, height: 390 },
	{ name: 'small portrait', width: 360, height: 640 },
	{ name: 'desktop', width: 1280, height: 800 }
];

async function readBlock(page: Page): Promise<BlockState> {
	return page.evaluate(() => {
		const board = Array.from(document.querySelectorAll<HTMLElement>('.board .cell')).map((cell) =>
			cell.classList.contains('is-filled')
		);
		const slots = Array.from(document.querySelectorAll<HTMLElement>('.tray [data-tray-index]')).map(
			(slot) => {
				if (slot.tagName !== 'BUTTON' || slot.classList.contains('is-empty')) {
					return null;
				}

				return {
					index: Number(slot.getAttribute('data-tray-index')),
					cells: Array.from(slot.querySelectorAll<HTMLElement>('.mini-cell')).map((cell) => ({
						x: Number(cell.style.gridColumn) - 1,
						y: Number(cell.style.gridRow) - 1
					}))
				};
			}
		);
		return { board, slots };
	});
}

async function waitForIdle(page: Page): Promise<void> {
	await page.waitForFunction(
		() => {
			if (document.querySelector('.result')) {
				return true;
			}

			const slots = Array.from(document.querySelectorAll<HTMLElement>('button.tray-slot'));
			return (
				slots.length > 0 && slots.every((slot) => slot.getAttribute('aria-disabled') !== 'true')
			);
		},
		null,
		{ timeout: 10000 }
	);
}

async function solveBlock(page: Page): Promise<void> {
	for (let step = 0; step < 320; step += 1) {
		if (await page.locator('.result').count()) {
			return;
		}

		const { board, slots } = await readBlock(page);
		let move: { slot: number; index: number } | null = null;

		for (const slot of slots) {
			if (!slot) {
				continue;
			}

			const width = Math.max(...slot.cells.map((cell) => cell.x)) + 1;
			const height = Math.max(...slot.cells.map((cell) => cell.y)) + 1;

			for (let y = 0; y <= 8 - height && !move; y += 1) {
				for (let x = 0; x <= 8 - width && !move; x += 1) {
					if (slot.cells.every((cell) => !board[(y + cell.y) * 8 + x + cell.x])) {
						move = { slot: slot.index, index: y * 8 + x };
					}
				}
			}

			if (move) {
				break;
			}
		}

		if (!move) {
			await page.locator('.result').waitFor({ timeout: 6000 });
			return;
		}

		await page.locator(`.tray [data-tray-index="${move.slot}"]`).click();
		await page.locator(`.board .cell[data-index="${move.index}"]`).click();
		await page.waitForTimeout(120);
		await waitForIdle(page);
	}

	throw new Error('Block did not finish.');
}

async function readGame(page: Page, family: 'block' | 'memory') {
	return page.evaluate((gameFamily) => {
		const root = document.querySelector<HTMLElement>(`.game[data-family="${gameFamily}"]`);
		const q = (selector: string) => root?.querySelector<HTMLElement>(selector) ?? null;
		const rect = (element: HTMLElement | null) => {
			if (!element) {
				return null;
			}

			const box = element.getBoundingClientRect();
			return {
				left: box.left,
				top: box.top,
				width: box.width,
				height: box.height,
				right: box.right,
				bottom: box.bottom
			};
		};
		const font = (selector: string) => {
			const element = q(selector);
			return element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
		};
		const board = q('.board');
		const stage = q('.stage');

		return {
			viewportWidth: document.documentElement.clientWidth,
			viewportHeight: document.documentElement.clientHeight,
			scrollWidth: document.documentElement.scrollWidth,
			scrollHeight: document.documentElement.scrollHeight,
			game: rect(root),
			stage: rect(stage),
			board: rect(board),
			card: rect(q('.memory-card')),
			boardCenterDelta: board
				? board.getBoundingClientRect().left +
					board.getBoundingClientRect().width / 2 -
					document.documentElement.clientWidth / 2
				: null,
			pairs: Number(board?.getAttribute('data-pairs') ?? 0),
			columns: Number(board?.getAttribute('data-columns') ?? 0),
			statFontSize: font('.stat strong')
		};
	}, family);
}

for (const layout of layouts) {
	test.describe(layout.name, () => {
		test.use({ viewport: { width: layout.width, height: layout.height } });

		test('keeps the boards centered and the memory layout compact', async ({ page }, testInfo) => {
			await page.goto('/', { waitUntil: 'networkidle' });
			await page.waitForTimeout(500);
			await page.getByRole('button', { name: 'Play' }).click();
			await expect(page.locator('.game[data-family="block"]')).toHaveAttribute(
				'data-phase',
				'playing'
			);

			const block = await readGame(page, 'block');
			expect(block.scrollWidth).toBeLessThanOrEqual(block.viewportWidth);
			expect(block.scrollHeight).toBeLessThanOrEqual(block.viewportHeight);
			expect(
				Math.abs(layout.name === 'phone landscape' ? 0 : (block.boardCenterDelta ?? 100))
			).toBeLessThanOrEqual(1);
			expect(block.board?.left ?? -1).toBeGreaterThanOrEqual(0);
			expect(block.board?.right ?? Infinity).toBeLessThanOrEqual(block.viewportWidth);
			const blockShot = testInfo.outputPath(`block-${layout.name}.png`);
			await page.screenshot({ path: blockShot });
			await testInfo.attach(`block-${layout.name}`, {
				path: blockShot,
				contentType: 'image/png'
			});

			await solveBlock(page);
			await expect(page.getByRole('heading', { name: 'Well played.', exact: true })).toBeVisible();
			await expect(
				page.getByRole('link', { name: 'Sign in with Google', exact: true })
			).toBeVisible();
			expect(
				(layout.height < 700 && layout.width < layout.height) ||
					(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight))
			).toBe(true);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			const resultShot = testInfo.outputPath(`result-${layout.name}.png`);
			await page.screenshot({ path: resultShot });
			await testInfo.attach(`result-${layout.name}`, {
				path: resultShot,
				contentType: 'image/png'
			});
			await page.locator('.result .next').click();
			await page.locator('.game[data-family="memory"]').waitFor();
			await page.locator('.game[data-family="memory"]').evaluate(async () => {
				await new Promise((resolve) => setTimeout(resolve, 5500));
			});

			const memory = await readGame(page, 'memory');
			const stage = memory.stage;
			const board = memory.board;
			const card = memory.card;
			expect(memory.scrollWidth).toBeLessThanOrEqual(memory.viewportWidth);
			expect(memory.scrollHeight).toBeLessThanOrEqual(memory.viewportHeight);
			expect(
				Math.abs(layout.name === 'phone landscape' ? 0 : (memory.boardCenterDelta ?? 100))
			).toBeLessThanOrEqual(1);
			expect(board?.left ?? -1).toBeGreaterThanOrEqual(stage?.left ?? 0);
			expect(board?.right ?? Infinity).toBeLessThanOrEqual(stage?.right ?? memory.viewportWidth);
			expect(board?.top ?? -1).toBeGreaterThanOrEqual(stage?.top ?? 0);
			expect(board?.bottom ?? Infinity).toBeLessThanOrEqual(stage?.bottom ?? memory.viewportHeight);
			expect(memory.statFontSize ?? Infinity).toBeLessThanOrEqual(24);

			const expectedColumns =
				memory.viewportWidth >= 1024
					? memory.pairs === 10
						? 5
						: 4
					: memory.viewportWidth > memory.viewportHeight && memory.viewportHeight <= 560
						? memory.pairs
						: 4;
			expect(memory.columns).toBe(expectedColumns);

			if (memory.pairs === 6) {
				const minCardWidth =
					layout.name === 'phone portrait'
						? 70
						: layout.name === 'small portrait'
							? 60
							: layout.name === 'phone landscape'
								? 80
								: 140;
				expect(card?.width ?? 0).toBeGreaterThanOrEqual(minCardWidth);
			}

			const memoryShot = testInfo.outputPath(`memory-${layout.name}.png`);
			await page.screenshot({ path: memoryShot });
			await testInfo.attach(`memory-${layout.name}`, {
				path: memoryShot,
				contentType: 'image/png'
			});
		});
	});
}
