import { describe, it, expect } from 'vitest';
import { BLOCK_THEMES } from './puzzles/block-placement/themes.js';
import { MEMORY_THEMES } from './puzzles/memory/themes.js';
describe('shared theme design', () => {
	it('reuses the four block themes with the same backdrops and card surfaces', () => {
		expect(MEMORY_THEMES).toHaveLength(4);

		for (const theme of MEMORY_THEMES) {
			const block = BLOCK_THEMES.find((candidate) => candidate.id === theme.id);
			expect(block).toBeDefined();
			expect(theme.background).toBe(block?.background);
			expect(theme.back).toBe(block?.cell);
			expect(theme.face).toBe(block?.tray);
			expect(theme.matched).toBe(block?.traySlot);
		}
	});
});
