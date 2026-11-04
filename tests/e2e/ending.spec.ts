import { expect, test, type Page } from '@playwright/test';
import { captureGameReview } from './review-capture.js';
import { fixSelectorSeed, selectorSeedFor } from './entropy.js';
declare global {
	interface Window {
		endingPhases: { phase: string; at: number }[];
	}
}

async function finishMemory(page: Page) {
	await expect(page.locator('.game[data-family="memory"]')).toHaveAttribute(
		'data-phase',
		'playing',
		{
			timeout: 16000
		}
	);
	const cards = page.locator('.memory-card');
	const symbols = await cards.evaluateAll((elements) =>
		elements.map((element) => element.querySelector('.card-front svg')!.outerHTML)
	);
	const pairs = new Map<string, number[]>();
	symbols.forEach((symbol, index) => pairs.set(symbol, [...(pairs.get(symbol) ?? []), index]));
	for (const pair of pairs.values()) {
		expect(pair).toHaveLength(2);
		await cards.nth(pair[0]!).click();
		await cards.nth(pair[1]!).click();
	}
	return pairs.size;
}

async function pendingFamilies(page: Page) {
	return page.evaluate(
		() =>
			new Promise<string[]>((resolve, reject) => {
				const opening = indexedDB.open('morphi-progress', 1);
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const db = opening.result;
					const request = db.transaction('pending').objectStore('pending').getAll();
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						resolve(request.result.map((entry) => entry.run.family));
						db.close();
					};
				};
			})
	);
}

async function trackPhases(page: Page) {
	await page.addInitScript(() => {
		const trace: { phase: string; at: number }[] = [];
		window.endingPhases = trace;
		document.addEventListener('visibilitychange', () => {
			trace.push({ phase: document.hidden ? 'hidden' : 'visible', at: performance.now() });
		});
		new MutationObserver((records) => {
			for (const record of records) {
				const target = record.target as HTMLElement;
				if (target.matches('.round-stage') && record.attributeName === 'data-card-phase') {
					trace.push({ phase: target.dataset.cardPhase!, at: performance.now() });
				}
			}
		}).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-card-phase'] });
	});
}

async function phaseTimes(page: Page) {
	return page.evaluate(() => window.endingPhases);
}

test('Memory ending holds over the completed board and its queued result survives early Next', async ({
	page
}) => {
	await fixSelectorSeed(page, selectorSeedFor('memory'));
	await trackPhases(page);
	await page.goto('/play');
	const pairs = await finishMemory(page);
	const ending = page.locator('.ending');
	await expect(ending).toBeVisible();
	await captureGameReview(page, 'memory-ending');
	await expect(ending).toContainText('All pairs found!');
	await expect(page.locator('.round-frame .game')).toBeVisible();
	await expect(page.locator('.round-stage')).toHaveAttribute('data-card-phase', 'ending');
	const board = (await page.locator('.round-frame').boundingBox())!;
	await page.mouse.click(board.x + board.width / 2, board.y + board.height / 2);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 844, height: 390 },
		{ width: 1280, height: 800 }
	]) {
		await page.setViewportSize(viewport);
		await expect(ending).toBeVisible();
		await expect(page.locator('.round-frame .game')).toBeVisible();
		const text = (await ending.locator('strong').boundingBox())!;
		expect(text.x).toBeGreaterThanOrEqual(0);
		expect(text.y).toBeGreaterThanOrEqual(0);
		expect(text.x + text.width).toBeLessThanOrEqual(viewport.width);
		expect(text.y + text.height).toBeLessThanOrEqual(viewport.height);
		expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
			false
		);
	}
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(ending.locator('span')).toHaveText(new RegExp(`^${pairs} pairs · \\d+:\\d{2}$`));
	await expect.poll(() => pendingFamilies(page)).toContain('memory');
	await expect(page.locator('.result')).toBeVisible();
	await captureGameReview(page, 'memory-result');
	const phases = await phaseTimes(page);
	const started = phases.find((entry) => entry.phase === 'ending')!.at;
	const folded = phases.find((entry) => entry.phase === 'folding')!.at;
	const result = phases.find((entry) => entry.phase === 'result')!.at;
	const hidden = phases.find((entry) => entry.phase === 'hidden')!.at;
	const visible = phases.find((entry) => entry.phase === 'visible')!.at;
	expect(folded - started - (visible - hidden)).toBeGreaterThanOrEqual(910);
	expect(result - folded).toBeGreaterThanOrEqual(490);
	await expect(page.locator('.result-stats')).toContainText(String(pairs));
	await expect(page.locator('.played-stack>p')).toHaveText('Played · 1');
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await expect(page.locator('.round-meta')).toContainText('Round 2', { timeout: 12000 });
	expect(await pendingFamilies(page)).toContain('memory');
});

test('Block ending shows its score and piece count, then advances automatically with reduced motion', async ({
	page
}) => {
	await fixSelectorSeed(page, selectorSeedFor('block'));
	await trackPhases(page);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/play');
	await expect(page.locator('.game[data-family="block"]')).toHaveAttribute(
		'data-phase',
		'playing',
		{
			timeout: 12000
		}
	);
	for (let step = 0; step < 320; step++) {
		const move = await page.evaluate(() => {
			const board = Array.from(document.querySelectorAll('.board .cell'), (cell) =>
				cell.classList.contains('is-filled')
			);
			for (const slot of document.querySelectorAll<HTMLElement>(
				'button.tray-slot:not(.is-empty)'
			)) {
				const cells = Array.from(slot.querySelectorAll<HTMLElement>('.mini-cell'), (cell) => ({
					x: Number(cell.style.gridColumn) - 1,
					y: Number(cell.style.gridRow) - 1
				}));
				for (let y = 0; y < 8; y++)
					for (let x = 0; x < 8; x++)
						if (
							cells.every(
								(cell) => x + cell.x < 8 && y + cell.y < 8 && !board[(y + cell.y) * 8 + x + cell.x]
							)
						)
							return { slot: slot.dataset.trayIndex, index: y * 8 + x };
			}
			return null;
		});
		if (!move) break;
		await page.locator(`.tray [data-tray-index="${move.slot}"]`).click();
		await page.locator(`.board .cell[data-index="${move.index}"]`).click();
		await page.waitForTimeout(120);
		await page.waitForFunction(() => {
			if (document.querySelector('.game.is-over, .ending, .result')) return true;
			const slots = [...document.querySelectorAll('button.tray-slot')];
			return (
				slots.length > 0 && slots.every((slot) => slot.getAttribute('aria-disabled') !== 'true')
			);
		});
		if (await page.locator('.game.is-over, .ending, .result').count()) break;
	}
	const ending = page.locator('.ending');
	await expect(ending).toBeVisible({ timeout: 6000 });
	await captureGameReview(page, 'block-ending');
	await expect(ending).toContainText(/No moves left!|Board full!/);
	await expect(page.locator('.round-frame .game')).toBeVisible();
	await expect(ending.locator('span')).toHaveText(/^[\d,]+ points · [\d,]+ pieces$/);
	await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });
	await captureGameReview(page, 'block-result');
	const phases = await phaseTimes(page);
	expect(
		phases.find((entry) => entry.phase === 'folding')!.at -
			phases.find((entry) => entry.phase === 'ending')!.at
	).toBeGreaterThanOrEqual(490);
	await expect(page.locator('.played-stack>p')).toHaveText('Played · 1');
	await expect.poll(() => pendingFamilies(page)).toContain('block');
});
