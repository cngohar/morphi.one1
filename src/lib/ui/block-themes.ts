import { createRng } from '#lib/engine/rng.js';

export interface BlockTheme {
	id: string;
	name: string;
	background: string;
	cell: string;
	edge: string;
	tray: string;
	traySlot: string;
	pieces: readonly [string, string, string, string];
}

export const BLOCK_THEMES: readonly BlockTheme[] = [
	{
		id: 'sky',
		name: 'Sky',
		background: '#e8f0fc',
		cell: '#cdd9ee',
		edge: '#c8d3e5',
		tray: '#f3f8ff',
		traySlot: '#dbe5f5',
		pieces: ['var(--primary)', 'var(--accent)', 'var(--success)', 'var(--warning-fill)']
	},
	{
		id: 'shapes',
		name: 'Shapes',
		background: '#f3eefb',
		cell: '#dcd2ee',
		edge: '#d4c9e7',
		tray: '#faf6ff',
		traySlot: '#e6dcf5',
		pieces: ['#009a86', '#7d61ae', '#7c4100', '#003041']
	},
	{
		id: 'ocean',
		name: 'Ocean',
		background: '#e2f3fa',
		cell: '#c2dde9',
		edge: '#bad6e2',
		tray: '#f0fafd',
		traySlot: '#d3e8f1',
		pieces: ['var(--accent)', 'var(--success)', '#003041', 'var(--warning-fill)']
	},
	{
		id: 'garden',
		name: 'Garden',
		background: '#e6f4e1',
		cell: '#c9dfc0',
		edge: '#c3d8bb',
		tray: '#f4fbf0',
		traySlot: '#d9e9d0',
		pieces: ['var(--success)', 'var(--primary)', 'var(--warning-fill)', '#7c4100']
	}
];

export function blockThemeForSeed(seed: string): BlockTheme {
	const index = createRng(seed).nextInt(BLOCK_THEMES.length);
	return BLOCK_THEMES[index] ?? BLOCK_THEMES[0];
}

export function blockThemeStyle(theme: BlockTheme): string {
	return [
		`--block-bg:${theme.background}`,
		`--block-cell:${theme.cell}`,
		`--block-cell-edge:${theme.edge}`,
		`--block-tray:${theme.tray}`,
		`--block-tray-slot:${theme.traySlot}`,
		`--piece-1:${theme.pieces[0]}`,
		`--piece-2:${theme.pieces[1]}`,
		`--piece-3:${theme.pieces[2]}`,
		`--piece-4:${theme.pieces[3]}`
	].join(';');
}
