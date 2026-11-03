import { describe, expect, it, vi } from 'vitest';
import * as colorMath from './color.js';
import { createRng } from '../rng.js';
import { generateSymbols } from './symbols.js';
import { contrast, minimumDifference, oklch, simulate } from './color.js';
import { checkThemeConfig, generateTheme, paletteIssues, PRESETS } from './generator.js';
import { drawFreshTheme, freshnessScore, freshnessViolations } from './freshness.js';
import { THEME_CONFIG, validateThemeConfig } from './config.js';

describe('procedural cosmetic themes', () => {
	it('uses independently checked color references and rejects bad palettes', () => {
		expect(contrast('#000000', '#ffffff')).toBe(21);
		expect(oklch(1, 0, 0)).toBe('#ffffff');
		expect(oklch(0, 0, 0)).toBe('#000000');
		expect(simulate('#ff0000', 0)).toEqual([0.152286, 0.114503, 0]);
		expect(minimumDifference(PRESETS[0].colors)).toBeCloseTo(35.3, 0);
		const theme = generateTheme('42', 'memory');
		expect(paletteIssues({ ...theme, colors: ['#ffffff'] })).toContain('symbol_contrast');
		expect(paletteIssues({ ...theme, colors: ['#000000', '#000000'] })).toContain(
			'color_difference'
		);
		expect(paletteIssues({ ...theme, colors: ['#2f6fed', '#8b5cf6'] })).toContain(
			'color_difference'
		);
		expect(paletteIssues({ ...theme, back: theme.background })).toContain('back_contrast');
	});
	it('validates immutable profiles, references and publishing safety', () => {
		expect(THEME_CONFIG.recipes).toHaveLength(7);
		expect(THEME_CONFIG.recipes.some((r) => r.id === 'free')).toBe(true);
		expect(THEME_CONFIG.styles.length).toBeGreaterThanOrEqual(4);
		expect(THEME_CONFIG.containers.length).toBeGreaterThanOrEqual(4);
		expect(THEME_CONFIG.backdrops.length).toBeGreaterThanOrEqual(5);
		expect(Object.isFrozen(THEME_CONFIG.recipes[0].targets)).toBe(true);
		expect(validateThemeConfig(THEME_CONFIG)).toBe(THEME_CONFIG);
		expect(checkThemeConfig(THEME_CONFIG)).toEqual([]);
		expect(() => generateTheme('42', 'block', 'future')).toThrow('theme_version');
		expect(() => generateTheme('-1', 'memory')).toThrow();
		expect(() => validateThemeConfig({ ...THEME_CONFIG, unexpected: true })).toThrow();
		const invalid = structuredClone(THEME_CONFIG);
		invalid.profiles.default.recipes = ['missing'];
		expect(() => validateThemeConfig(invalid)).toThrow();
		const unsafe = structuredClone(THEME_CONFIG);
		unsafe.recipes[0].targets = [21, 21, 21];
		expect(checkThemeConfig(unsafe)).toContain(`palette:${unsafe.recipes[0].id}`);
	});
	it('keeps cached snapshots deterministic and supplies distinct silhouettes for all current Memory pairs', () => {
		const rng = createRng('42'),
			reference = createRng('42');
		const recipes = new Set<string>(),
			styles = new Set<string>(),
			shapes = new Set<string>();
		const symbolSubsets = new Set<string>();
		for (let i = 0; i < 100; i++) {
			const theme = generateTheme(String(i), 'memory');
			expect(theme).toEqual(generateTheme(String(i), 'memory'));
			expect(paletteIssues(theme)).toEqual([]);
			expect(theme.attempts).toBeLessThanOrEqual(8);
			expect(new Set(theme.symbols.map((s) => s.path)).size).toBe(10);
			symbolSubsets.add([...new Set(theme.symbols.map((s) => s.family))].sort().join(','));
			recipes.add(theme.recipe);
			styles.add(theme.style.id);
			shapes.add(theme.container);
		}
		expect(rng.nextU64()).toBe(reference.nextU64());
		expect(recipes.size).toBeGreaterThanOrEqual(7);
		expect(styles.size).toBe(5);
		expect(shapes.size).toBe(4);
		expect(symbolSubsets.size).toBeGreaterThan(20);
		for (const symbolCount of [6, 8, 10, 12]) {
			const symbols = generateSymbols(createRng('42'), symbolCount);
			expect(new Set(symbols.map(({ path }) => path)).size).toBe(symbolCount);
			expect(new Set(symbols.map(({ label }) => label)).size).toBe(symbolCount);
		}
		expect(generateTheme('42', 'memory')).not.toEqual(generateTheme('42', 'block'));
		expect(generateTheme('42', 'new-family')).not.toEqual(generateTheme('42', 'other-family'));
	});
	it('reuses solved palette colors without changing snapshots', () => {
		const solve = vi.spyOn(colorMath, 'colorAtContrast');
		try {
			const first = generateTheme('987654321012345678', 'cache-example');
			solve.mockClear();
			expect(generateTheme('987654321012345678', 'cache-example')).toEqual(first);
			expect(solve).not.toHaveBeenCalled();
		} finally {
			solve.mockRestore();
		}
	});
	it('chooses the lowest weighted violation score and isolates family history', () => {
		let draws = 0;
		expect(
			drawFreshTheme('block', [], () => {
				draws++;
				return '42';
			}).seed
		).toBe('42');
		expect(draws).toBe(1);
		const previous = generateTheme('42', 'memory');
		expect(freshnessViolations(previous, [previous])).toEqual([
			'recipe',
			'hue',
			'style',
			'container',
			'symbols'
		]);
		const other = { ...previous, family: 'block' };
		expect(freshnessViolations(previous, [other])).toEqual([]);
		draws = 0;
		const best = drawFreshTheme('memory', [previous], () => String(++draws));
		const scores = Array.from({ length: 8 }, (_, i) =>
			freshnessScore(generateTheme(String(i + 1), 'memory'), [previous])
		);
		expect(freshnessScore(best, [previous])).toBe(Math.min(...scores));
		expect(paletteIssues(best)).toEqual([]);
		const config = structuredClone(THEME_CONFIG);
		config.profiles.default.freshness.weights = {
			recipe: 0,
			hue: 0,
			style: 0,
			container: 0,
			symbols: 10
		};
		expect(freshnessScore(previous, [previous], config)).toBe(10);
		expect(
			Array.from({ length: 100 }, (_, i) => generateTheme(String(i), 'memory')).some(
				(theme) => !freshnessViolations(theme, [previous]).includes('symbols')
			)
		).toBe(true);
	});
	it('scatters backdrop positions independently in both side regions', () => {
		const counts = new Set<number>();
		for (let seed = 0; seed < 30; seed++) {
			const theme = generateTheme(String(seed), 'memory');
			if (!theme.backdrop.items.length) continue;
			counts.add(theme.backdrop.items.length);
			for (const item of theme.backdrop.items) {
				expect((item.x >= 2 && item.x < 10) || (item.x >= 90 && item.x < 98)).toBe(true);
				expect(item.y).toBeGreaterThanOrEqual(22);
				expect(item.y).toBeLessThan(78);
			}
		}
		expect(counts.size).toBeGreaterThan(3);
	});
});
