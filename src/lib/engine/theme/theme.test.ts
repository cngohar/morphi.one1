import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.js';
import { contrast, minimumDifference, oklch, simulate } from './color.js';
import { generateTheme, paletteIssues, PRESETS } from './generator.js';
import { drawFreshTheme, freshnessViolations } from './freshness.js';
import { THEME_CONFIG } from './config.js';

describe('procedural cosmetic themes', () => {
	it('uses independently checked color references and rejects bad palettes', () => {
		expect(contrast('#000000', '#ffffff')).toBe(21);
		expect(oklch(1, 0, 0)).toBe('#ffffff');
		expect(oklch(0, 0, 0)).toBe('#000000');
		expect(simulate('#ff0000', 0)).toEqual([0.152286, 0.114503, 0]);
		expect(minimumDifference(PRESETS[0].colors)).toBeCloseTo(35.3, 0);
		const theme = generateTheme('42', 'memory');
		expect(paletteIssues({ ...theme, colors: ['#ffffff'] })).toContain('symbol_contrast');
		expect(paletteIssues({ ...theme, colors: ['#2f6fed', '#8b5cf6'] })).toContain(
			'color_difference'
		);
		expect(paletteIssues({ ...theme, back: theme.background })).toContain('back_contrast');
	});
	it('pins immutable data with six harmonies, free sampling and structural axes', () => {
		expect(THEME_CONFIG.recipes).toHaveLength(7);
		expect(THEME_CONFIG.recipes.some((r) => r.id === 'free')).toBe(true);
		expect(THEME_CONFIG.styles.length).toBeGreaterThanOrEqual(4);
		expect(THEME_CONFIG.containers.length).toBeGreaterThanOrEqual(4);
		expect(THEME_CONFIG.backdrops.length).toBeGreaterThanOrEqual(5);
		expect(Object.isFrozen(THEME_CONFIG.recipes[0].targets)).toBe(true);
		expect(() => generateTheme('42', 'block', 'future')).toThrow('theme_version');
		expect(() => generateTheme('-1', 'memory')).toThrow();
	});
	it('has stable snapshots and enough distinct symbols without consuming a rules RNG', () => {
		const rng = createRng('42'),
			reference = createRng('42');
		const recipes = new Set<string>(),
			styles = new Set<string>(),
			shapes = new Set<string>();
		for (let i = 0; i < 100; i++) {
			const theme = generateTheme(String(i), 'memory');
			expect(theme).toEqual(generateTheme(String(i), 'memory'));
			expect(paletteIssues(theme)).toEqual([]);
			expect(theme.attempts).toBeLessThanOrEqual(8);
			expect(new Set(theme.symbols.map((s) => s.path)).size).toBe(10);
			expect(new Set(theme.symbols.map((s) => s.family)).size).toBeGreaterThanOrEqual(6);
			recipes.add(theme.recipe);
			styles.add(theme.style.id);
			shapes.add(theme.container);
		}
		expect(rng.nextU64()).toBe(reference.nextU64());
		expect(recipes.size).toBeGreaterThanOrEqual(7);
		expect(styles.size).toBe(5);
		expect(shapes.size).toBe(4);
		expect(generateTheme('42', 'memory')).not.toEqual(generateTheme('42', 'block'));
		const fallback = generateTheme('47614', 'memory');
		expect(fallback.fallback).toBe(true);
		expect(fallback.attempts).toBe(8);
		expect(paletteIssues(fallback)).toEqual([]);
	});
	it('accepts the first fresh theme, and the eighth accessible candidate if all fail', () => {
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
		draws = 0;
		const final = drawFreshTheme('memory', [previous], () => String(++draws));
		expect(draws).toBe(8);
		expect(final.seed).toBe('8');
		expect(paletteIssues(final)).toEqual([]);
	});
});
