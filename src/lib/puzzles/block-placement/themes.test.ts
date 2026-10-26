import { describe, expect, it } from 'vitest';
import {
	BLOCK_THEMES,
	blockThemeForSeed,
	blockThemeStyle
} from '#lib/puzzles/block-placement/themes.js';

function luminance(hex: string): number {
	const channels = [1, 3, 5].map((index) => {
		const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
	const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
	return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('block themes', () => {
	it('has four fixed themes with piece colors and picker tints each', () => {
		expect(BLOCK_THEMES).toHaveLength(4);
		expect(new Set(BLOCK_THEMES.map((theme) => theme.id)).size).toBe(4);
		expect(
			new Set(
				BLOCK_THEMES.map(
					(theme) =>
						`${theme.background}|${theme.cell}|${theme.edge}|${theme.tray}|${theme.traySlot}`
				)
			).size
		).toBe(4);
		expect(new Set(BLOCK_THEMES.map((theme) => theme.pieces.join('|'))).size).toBe(4);

		for (const theme of BLOCK_THEMES) {
			expect(theme.pieces).toHaveLength(4);
			expect(theme.pieces.every((color) => color.length > 0)).toBe(true);
			expect(theme.tray.length).toBeGreaterThan(0);
			expect(theme.traySlot.length).toBeGreaterThan(0);
		}
	});

	it('keeps the approved board and picker visibility floors on every theme', () => {
		for (const theme of BLOCK_THEMES) {
			expect(contrast(theme.cell, theme.background)).toBeGreaterThanOrEqual(1.239);
			expect(contrast(theme.edge, theme.background)).toBeGreaterThanOrEqual(1.31);
			expect(contrast(theme.tray, theme.background)).toBeGreaterThanOrEqual(1.04);
			expect(contrast(theme.traySlot, theme.tray)).toBeGreaterThanOrEqual(1.12);
		}
	});

	it('selects the same theme for the same seed', () => {
		for (let seed = 0; seed < 50; seed += 1) {
			const value = String(seed);
			expect(blockThemeForSeed(value)).toBe(blockThemeForSeed(value));
		}
	});

	it('can reach every theme from a decimal seed', () => {
		const ids = new Set<string>();

		for (let seed = 0; seed < 400; seed += 1) {
			ids.add(blockThemeForSeed(String(seed)).id);
		}

		expect(ids).toEqual(new Set(BLOCK_THEMES.map((theme) => theme.id)));
	});

	it('serializes every theme variable for the screen', () => {
		for (const theme of BLOCK_THEMES) {
			const style = blockThemeStyle(theme);
			expect(style).toContain(`--block-bg:${theme.background}`);
			expect(style).toContain(`--block-tray:${theme.tray}`);
			expect(style).toContain(`--block-tray-slot:${theme.traySlot}`);
			expect(style).toContain(`--piece-1:${theme.pieces[0]}`);
			expect(style).toContain(`--piece-4:${theme.pieces[3]}`);
		}
	});
});
