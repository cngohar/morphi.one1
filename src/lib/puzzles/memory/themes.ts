import { createRng } from '#lib/engine/rng.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';

export interface MemoryTheme {
	id: string;
	name: string;
	background: string;
	back: string;
	edge: string;
	face: string;
	matched: string;
	mark: string;
	symbols: readonly [string, string, string, string];
}

export function memoryThemeFromResolved(theme: ResolvedTheme): MemoryTheme {
	return {
		id: theme.recipe,
		name: theme.recipe,
		background: theme.background,
		back: theme.back,
		edge: theme.edge,
		face: theme.face,
		matched: theme.face,
		mark: theme.mark,
		symbols: [0, 1, 2, 3].map((i) => theme.colors[i % theme.colors.length]) as [
			string,
			string,
			string,
			string
		]
	};
}

export const MEMORY_THEMES: readonly MemoryTheme[] = [
	{
		id: 'sky',
		name: 'Sky',
		background: '#e8f0fc',
		back: '#cdd9ee',
		edge: '#2f6fed',
		face: '#f3f8ff',
		matched: '#dbe5f5',
		mark: '#8a5a00',
		symbols: ['#e5532d', '#2f6fed', '#0e7c6e', '#8a5a00']
	},
	{
		id: 'shapes',
		name: 'Shapes',
		background: '#f3eefb',
		back: '#dcd2ee',
		edge: '#7d61ae',
		face: '#faf6ff',
		matched: '#e6dcf5',
		mark: '#003041',
		symbols: ['#009a86', '#7d61ae', '#7c4100', '#003041']
	},
	{
		id: 'ocean',
		name: 'Ocean',
		background: '#e2f3fa',
		back: '#c2dde9',
		edge: '#0e7c6e',
		face: '#f0fafd',
		matched: '#d3e8f1',
		mark: '#003041',
		symbols: ['#2f6fed', '#0e7c6e', '#003041', '#8a5a00']
	},
	{
		id: 'garden',
		name: 'Garden',
		background: '#e6f4e1',
		back: '#c9dfc0',
		edge: '#e5532d',
		face: '#f4fbf0',
		matched: '#d9e9d0',
		mark: '#7c4100',
		symbols: ['#0e7c6e', '#e5532d', '#8a5a00', '#7c4100']
	}
];

export function memoryThemeForSeed(seed: string): MemoryTheme {
	const index = createRng(seed).nextInt(MEMORY_THEMES.length);
	return MEMORY_THEMES[index] ?? MEMORY_THEMES[0];
}

export function memoryThemeStyle(theme: MemoryTheme): string {
	return [
		`--memory-bg:${theme.background}`,
		`--memory-back:${theme.back}`,
		`--memory-edge:${theme.edge}`,
		`--memory-face:${theme.face}`,
		`--memory-matched:${theme.matched}`,
		`--memory-mark:${theme.mark}`
	].join(';');
}
