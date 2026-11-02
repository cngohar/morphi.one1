import { expect, it } from 'vitest';
import { catalog } from '#lib/catalog.js';
import { blend, contrast } from '#lib/engine/theme/color.js';
import { generateTheme } from '#lib/engine/theme/generator.js';
import { puzzleBackdrop } from './puzzle-backdrop.js';

it('always scatters only the current puzzle objects without mutating its approved snapshot', () => {
	const knownPieces = new Set(catalog.block.backdropPieces.map((piece) => piece.id));
	const reached = new Set<string>();
	const counts = new Set<number>();
	const horizontal = new Set<number>();
	for (const family of ['memory', 'block'] as const) {
		for (let seed = 0; seed < 100; seed++) {
			const theme = generateTheme(String(seed), family);
			const before = JSON.stringify(theme);
			const backdrop = puzzleBackdrop(theme);
			expect(backdrop).toEqual(puzzleBackdrop(theme));
			for (const side of ['left', 'right']) {
				const count = backdrop.items.filter((item) => item.band === side).length;
				expect(count).toBeGreaterThanOrEqual(1);
				expect(count).toBeLessThanOrEqual(5);
				counts.add(count);
			}
			expect(backdrop.items.every((item) => ['left', 'right'].includes(item.band))).toBe(true);
			expect(backdrop.kind).not.toBe('none');
			expect(
				contrast(blend(backdrop.color, theme.background, 0.2), theme.background)
			).toBeLessThanOrEqual(1.25);
			for (const item of backdrop.items) {
				expect(item.x).toBeGreaterThanOrEqual(0.08);
				expect(item.x).toBeLessThanOrEqual(0.92);
				expect(item.y).toBeGreaterThanOrEqual(8);
				expect(item.y).toBeLessThanOrEqual(92);
				horizontal.add(Math.floor(item.x * 10));
				if (family === 'memory') expect(item.kind).toBe('card');
				else {
					expect(
						knownPieces.has(item.kind as (typeof catalog.block.backdropPieces)[number]['id'])
					).toBe(true);
					reached.add(item.kind);
				}
			}
			expect(JSON.stringify(theme)).toBe(before);
		}
	}
	expect([...reached].sort()).toEqual([...knownPieces].sort());
	expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
	expect(horizontal.size).toBeGreaterThanOrEqual(8);
	expect(puzzleBackdrop(generateTheme('1', 'memory'))).not.toEqual(
		puzzleBackdrop(generateTheme('2', 'memory'))
	);
});
