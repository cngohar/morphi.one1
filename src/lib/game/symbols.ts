import type { MessageKey } from '#lib/i18n/messages.js';

export const SYMBOL_COLORS = ['#009A86', '#7D61AE', '#7C4100', '#003041'] as const;

export const SYMBOLS = [
	{ id: 'circle', color: SYMBOL_COLORS[0], label: 'symbol.circle' },
	{ id: 'triangle', color: SYMBOL_COLORS[1], label: 'symbol.triangle' },
	{ id: 'square', color: SYMBOL_COLORS[2], label: 'symbol.square' },
	{ id: 'diamond', color: SYMBOL_COLORS[3], label: 'symbol.diamond' },
	{ id: 'star', color: SYMBOL_COLORS[0], label: 'symbol.star' },
	{ id: 'hexagon', color: SYMBOL_COLORS[1], label: 'symbol.hexagon' },
	{ id: 'cross', color: SYMBOL_COLORS[2], label: 'symbol.cross' },
	{ id: 'ring', color: SYMBOL_COLORS[3], label: 'symbol.ring' },
	{ id: 'pentagon', color: SYMBOL_COLORS[0], label: 'symbol.pentagon' },
	{ id: 'heart', color: SYMBOL_COLORS[1], label: 'symbol.heart' }
] as const satisfies ReadonlyArray<{
	id: string;
	color: string;
	label: MessageKey;
}>;

export type SymbolId = (typeof SYMBOLS)[number]['id'];

export function symbolLabel(symbol: SymbolId): MessageKey {
	const record = SYMBOLS.find((item) => item.id === symbol);
	return record ? record.label : 'symbol.circle';
}
