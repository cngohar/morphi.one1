import { describe, expect, it } from 'vitest';
import { MEMORY_THEMES, memoryThemeForSeed, memoryThemeStyle } from './themes.js';

function luminance(hex: string): number {
	const value = hex.replace('#', '');
	const [r, g, b] = [0, 2, 4].map((offset) => {
		const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(first: string, second: string): number {
	const a = luminance(first);
	const b = luminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('memory themes', () => {
	it('keeps every symbol and card color readable', () => {
		for (const theme of MEMORY_THEMES) {
			for (const symbol of theme.symbols) {
				expect(contrast(symbol, theme.face)).toBeGreaterThanOrEqual(3);
			}

			expect(contrast(theme.edge, theme.background)).toBeGreaterThanOrEqual(3);
			expect(contrast(theme.mark, theme.back)).toBeGreaterThanOrEqual(3);
			expect(contrast(theme.mark, theme.matched)).toBeGreaterThanOrEqual(3);
			expect(contrast('#1b2433', theme.background)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(theme.back, theme.background)).toBeGreaterThanOrEqual(1.2);
			expect(contrast(theme.face, theme.background)).toBeGreaterThanOrEqual(1.05);
			expect(contrast(theme.matched, theme.face)).toBeGreaterThanOrEqual(1.15);
		}
	});

	it('gives each theme its own symbol palette', () => {
		expect(new Set(MEMORY_THEMES.map((theme) => theme.symbols.join('|'))).size).toBe(4);
		expect(new Set(MEMORY_THEMES.map((theme) => theme.background)).size).toBe(4);
	});

	it('picks a stable theme from the seed', () => {
		expect(memoryThemeForSeed('42')).toBe(memoryThemeForSeed('42'));

		const seen = new Set(
			Array.from({ length: 64 }, (_, index) => memoryThemeForSeed(String(index)).id)
		);
		expect(seen.size).toBe(4);
	});

	it('writes the screen CSS variables', () => {
		const style = memoryThemeStyle(MEMORY_THEMES[0]!);
		expect(style).toContain('--memory-bg:#e8f0fc');
		expect(style).toContain('--memory-back:#cdd9ee');
		expect(style).toContain('--memory-edge:#2f6fed');
		expect(style).toContain('--memory-face:#f3f8ff');
		expect(style).toContain('--memory-matched:#dbe5f5');
		expect(style).toContain('--memory-mark:#8a5a00');
	});
});
