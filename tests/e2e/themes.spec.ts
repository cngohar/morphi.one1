import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { generateTheme } from '../../src/lib/engine/theme/generator.js';
import {
	THEME_CONFIG,
	THEME_CONFIG_VERSION,
	validateThemeConfig
} from '../../src/lib/engine/theme/config.js';
import { selectorSeedFor } from './entropy.js';

const defaultThemeConfig = validateThemeConfig(THEME_CONFIG, THEME_CONFIG_VERSION);

for (const family of ['memory', 'block'] as const)
	for (const [width, height] of [
		[360, 640],
		[390, 844],
		[844, 390],
		[1280, 800],
		[1920, 923],
		[1920, 1080]
	]) {
		test(`${family} procedural snapshot, symbols and interaction at ${width}×${height}`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			const container =
				['rounded', 'squircle', 'circle', 'hexagon'][[390, 844, 1280, 1920].indexOf(width)] ??
				'rounded';
			let seed = 0;
			while (generateTheme(String(seed), family).container !== container) {
				if (++seed > 1000) throw new Error('No seed found for the surface fixture.');
			}
			await page.addInitScript(
				({ value, selectorSeed }) => {
					const original = crypto.getRandomValues.bind(crypto);
					let first = true;
					crypto.getRandomValues = (array) => {
						if (array instanceof Uint32Array && array.length === 2) {
							array[0] = 0;
							array[1] = first ? selectorSeed : value;
							first = false;
							return array;
						}
						return original(array);
					};
				},
				{ value: seed, selectorSeed: selectorSeedFor(family) }
			);
			await page.route('**/api/play/theme', (route) =>
				route.fulfill({
					json: {
						version: THEME_CONFIG_VERSION,
						liveVersion: THEME_CONFIG_VERSION,
						values: defaultThemeConfig
					}
				})
			);
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await page.goto('/', {
				waitUntil: 'networkidle'
			});
			await page.getByRole('button', { name: 'Play', exact: true }).click();
			const game = page.locator('.game');
			await expect(game).toHaveAttribute('data-theme-version', THEME_CONFIG_VERSION);
			await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
			const scatter = page.locator('.theme-backdrop');
			const compact = width <= 900 || (width > height && height <= 560);
			if (compact) await expect(scatter).toBeHidden();
			else await expect(scatter).toBeVisible();
			const backdrop = await scatter.evaluate((element) => {
				const band = element.getBoundingClientRect();
				const header = document.querySelector('.game-header')!.getBoundingClientRect();
				const footer = document.querySelector('.round-panel')!.getBoundingClientRect();
				return {
					top: band.top,
					bottom: band.bottom,
					headerBottom: header.bottom,
					footerTop: footer.top,
					opacity: getComputedStyle(element).opacity,
					counts: ['left', 'right'].map(
						(side) => element.querySelectorAll(`svg[data-band="${side}"]`).length
					),
					kinds: [...element.querySelectorAll('svg')].map((svg) => svg.dataset.item),
					visible: [...element.querySelectorAll('svg')].every((svg) => {
						const r = svg.getBoundingClientRect();
						const panel = document.querySelector('.game')!.getBoundingClientRect();
						const x = r.x + r.width / 2,
							y = r.y + r.height / 2;
						return (
							x > 0 &&
							x < innerWidth &&
							y > header.bottom &&
							y < footer.top &&
							(x < panel.left || x > panel.right)
						);
					})
				};
			});
			expect(backdrop.opacity).toBe('0.2');
			for (const count of backdrop.counts) {
				expect(count).toBeGreaterThanOrEqual(1);
				expect(count).toBeLessThanOrEqual(5);
			}
			if (!compact) {
				expect(backdrop.visible).toBe(true);
				expect(backdrop.top).toBeGreaterThanOrEqual(backdrop.headerBottom - 1);
				expect(backdrop.bottom).toBeLessThanOrEqual(backdrop.footerTop + 1);
			}
			if (family === 'memory') expect(new Set(backdrop.kinds)).toEqual(new Set(['card']));
			else expect(backdrop.kinds).not.toContain('card');
			const expected = generateTheme(String(seed), family);
			const values = await game.evaluate((el) => {
				const css = getComputedStyle(el);
				return {
					memory: css.getPropertyValue('--memory-bg').trim(),
					block: css.getPropertyValue('--block-bg').trim(),
					radius: css.getPropertyValue('--memory-radius').trim()
				};
			});
			expect(values[family]).toBe(expected.background);
			expect(values.radius).not.toBe('');
			const textContrast = await page.evaluate(() => {
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = 1;
				const ctx = canvas.getContext('2d')!;
				const luminance = (color: string) => {
					ctx.clearRect(0, 0, 1, 1);
					ctx.fillStyle = color;
					ctx.fillRect(0, 0, 1, 1);
					const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
						const c = v / 255;
						return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
					});
					return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
				};
				return [
					...document.querySelectorAll('.game .stat-label,.family-high > span,.family-high small')
				].map((label) => {
					const background = label.closest('.game,.round-panel')!;
					const a = luminance(getComputedStyle(label).color),
						b = luminance(getComputedStyle(background).backgroundColor);
					return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
				});
			});
			expect(Math.min(...textContrast)).toBeGreaterThanOrEqual(4.5);
			if (family === 'memory') {
				const cards = page.locator('.memory-card');
				await cards.first().click();
				await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
				await cards.first().focus();
				await page.keyboard.press('Tab');
				await page.keyboard.press('Shift+Tab');
				expect(
					await cards.first().evaluate((el) => Number.parseFloat(getComputedStyle(el).outlineWidth))
				).toBeGreaterThanOrEqual(3);
				expect(await page.locator('.symbol path').first().getAttribute('d')).toBeTruthy();
			} else {
				const slots = page.locator('button.tray-slot');
				for (const slot of await slots.all()) {
					expect(
						await slot.evaluate((el) => {
							const r = el.getBoundingClientRect();
							return (
								document
									.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
									?.closest('button') === el
							);
						})
					).toBe(true);
				}
				await page.locator('button.tray-slot').first().click();
				await expect(page.locator('button.tray-slot').first()).toHaveAttribute(
					'aria-pressed',
					'true'
				);
				const source = await slots.first().boundingBox();
				const target = await page.locator('.board .cell[data-index="27"]').boundingBox();
				const color = await slots
					.first()
					.locator('.mini-cell')
					.first()
					.evaluate((el) => getComputedStyle(el).backgroundColor);
				await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
				await page.mouse.down();
				await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
					steps: 8
				});
				await expect(page.locator('.ghost')).toBeVisible();
				expect(
					await page
						.locator('.ghost-cell')
						.first()
						.evaluate((el) => getComputedStyle(el).backgroundColor)
				).toBe(color);
				expect(
					await page
						.locator('.ghost-cell')
						.first()
						.evaluate((el) => getComputedStyle(el).clipPath)
				).toBe(
					await page
						.locator('.board .cell')
						.first()
						.evaluate((el) => getComputedStyle(el).clipPath)
				);
				await page.mouse.up();
				await expect(page.locator('.ghost')).toHaveCount(0);
			}
			const history = await page.evaluate(
				(key) =>
					new Promise<unknown>((resolve, reject) => {
						const opening = indexedDB.open('morphi-themes', 1);
						opening.onerror = () => reject(opening.error);
						opening.onsuccess = () => {
							const db = opening.result,
								tx = db.transaction('history'),
								req = tx.objectStore('history').get(key);
							tx.oncomplete = () => {
								db.close();
								resolve(req.result);
							};
							tx.onerror = () => {
								db.close();
								reject(tx.error);
							};
						};
					}),
				`${family}:${THEME_CONFIG_VERSION}`
			);
			expect(history).toEqual([expected]);
			const dimensions = await page.evaluate(() => ({
				viewport: innerWidth,
				width: document.documentElement.scrollWidth
			}));
			expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
			const space = await page.evaluate(() => {
				const rect = (selector: string) => {
					const r = document.querySelector(selector)!.getBoundingClientRect();
					return {
						x: r.x,
						y: r.y,
						width: r.width,
						height: r.height,
						bottom: r.bottom,
						right: r.right
					};
				};
				return {
					viewport: { width: innerWidth, height: innerHeight },
					scrollHeight: document.documentElement.scrollHeight,
					header: rect('.game-header'),
					panel: rect('.game'),
					board: rect('.board'),
					stage: rect('.stage'),
					bottom: rect('.round-panel'),
					brand: rect('.game-header .brand')
				};
			});
			expect(space.scrollHeight).toBeLessThanOrEqual(height);
			expect(space.panel.y - space.header.bottom).toBeGreaterThanOrEqual(8);
			expect(space.bottom.y - space.panel.bottom).toBeGreaterThanOrEqual(8);
			expect(space.bottom.bottom).toBeCloseTo(height, 0);
			expect(space.bottom.width).toBeCloseTo(width, 0);
			expect(space.brand.x).toBeLessThanOrEqual(64);
			if (width > height && height <= 560) {
				expect(space.stage.height / space.panel.height).toBeGreaterThanOrEqual(0.8);
			}
			if (width >= 1024) {
				expect(space.panel.height / height).toBeGreaterThanOrEqual(0.7);
				const limitingUse =
					family === 'memory'
						? Math.max(
								space.board.width / space.stage.width,
								space.board.height / space.stage.height
							)
						: Math.max(
								space.board.width / space.stage.width,
								space.board.height / (space.stage.height - 84)
							);
				expect(limitingUse).toBeGreaterThanOrEqual(0.95);
			}
			const directory = `build/v1.1-themes/${testInfo.project.name}`;
			await mkdir(directory, { recursive: true });
			await writeFile(
				`${directory}/${family}-${width}x${height}.json`,
				JSON.stringify(space, null, 2)
			);
			await page.screenshot({ path: `${directory}/${family}-${width}x${height}.png` });
			expect(errors).toEqual([]);
		});
	}

test('generated silhouettes remain distinct at 24px in both fill styles', async ({ page }) => {
	const themes = ['0', '1', '42'].map((seed) => generateTheme(seed, 'memory'));
	const result = await page.evaluate((themes) => {
		let minimum = 1;
		for (const t of themes)
			for (const outline of [false, true]) {
				const masks = t.symbols.map((s) => {
					const canvas = document.createElement('canvas');
					canvas.width = 24;
					canvas.height = 24;
					const ctx = canvas.getContext('2d')!;
					ctx.scale(0.5, 0.5);
					const path = new Path2D(s.path);
					ctx.fillStyle = '#000';
					ctx.strokeStyle = '#000';
					ctx.lineWidth = 3;
					if (outline) ctx.stroke(path);
					else ctx.fill(path, 'evenodd');
					const data = ctx.getImageData(0, 0, 24, 24).data;
					return Array.from({ length: 576 }, (_, i) => data[i * 4 + 3] > 127);
				});
				for (let i = 0; i < masks.length; i++)
					for (let j = i + 1; j < masks.length; j++) {
						let union = 0,
							difference = 0;
						for (let k = 0; k < 576; k++) {
							if (masks[i][k] || masks[j][k]) union++;
							if (masks[i][k] !== masks[j][k]) difference++;
						}
						minimum = Math.min(minimum, difference / union);
					}
			}
		return minimum;
	}, themes);
	// Symmetric mask difference / union; threshold locked with the v1 shape set.
	expect(result).toBeGreaterThanOrEqual(0.1);
});
