import type { Rng } from '../rng.js';
import { shuffle } from '../rng.js';

export interface ThemeSymbol {
	family: string;
	label:
		| 'circle'
		| 'triangle'
		| 'square'
		| 'diamond'
		| 'star'
		| 'hexagon'
		| 'cross'
		| 'ring'
		| 'pentagon'
		| 'heart'
		| 'crescent'
		| 'petals';
	path: string;
}
const point = (radius: number, angle: number) =>
	`${(24 + radius * Math.cos(angle)).toFixed(3)} ${(24 + radius * Math.sin(angle)).toFixed(3)}`;
function polygon(sides: number, inner = 18): string {
	const star = inner !== 18,
		count = star ? sides * 2 : sides;
	return (
		Array.from(
			{ length: count },
			(_, i) =>
				`${i ? 'L' : 'M'}${point(star && i % 2 ? inner : 18, (i * Math.PI * 2) / count - Math.PI / 2)}`
		).join(' ') + 'Z'
	);
}
export const SYMBOL_FAMILIES: readonly string[] = [
	'circle',
	'triangle',
	'square',
	'pentagon',
	'hexagon',
	'star',
	'ring',
	'cross',
	'arc',
	'petals',
	'diamond',
	'heart'
];
/** Select distinct silhouettes; shape identity never comes from color. */
export function generateSymbols(rng: Rng, count = 10, allowed = SYMBOL_FAMILIES): ThemeSymbol[] {
	const inner = 7 + rng.nextInt(3);
	const silhouettes = [
		{ family: 'circle', label: 'circle', path: 'M42 24a18 18 0 1 1-36 0a18 18 0 1 1 36 0Z' },
		{ family: 'square', label: 'square', path: 'M7 7H41V41H7Z' },
		{ family: 'triangle', label: 'triangle', path: polygon(3) },
		{ family: 'pentagon', label: 'pentagon', path: polygon(5) },
		{ family: 'hexagon', label: 'hexagon', path: polygon(6) },
		{ family: 'star', label: 'star', path: polygon(5, inner) },
		{
			family: 'ring',
			label: 'ring',
			path: 'M42 24a18 18 0 1 1-36 0a18 18 0 1 1 36 0M33 24a9 9 0 1 0-18 0a9 9 0 1 0 18 0'
		},
		{ family: 'cross', label: 'cross', path: 'M18 6h12v12h12v12H30v12H18V30H6V18h12Z' },
		{ family: 'arc', label: 'crescent', path: 'M35 8a18 18 0 1 0 0 32a15 15 0 0 1 0-32Z' },
		{
			family: 'petals',
			label: 'petals',
			path: 'M24 15C3-5-5 24 15 24C-5 45 24 53 24 33C45 53 53 24 33 24C53 3 24-5 24 15Z'
		},
		{ family: 'diamond', label: 'diamond', path: 'M24 4 41 24 24 44 7 24Z' },
		{
			family: 'heart',
			label: 'heart',
			path: 'M24 43S5 31 5 17C5 4 20 3 24 12C28 3 43 4 43 17C43 31 24 43 24 43Z'
		}
	] satisfies ThemeSymbol[];
	const available = silhouettes.filter((s) => allowed.includes(s.family));
	if (!Number.isSafeInteger(count) || count < 1 || count > available.length)
		throw new RangeError('theme_symbols');
	return shuffle(rng, available).slice(0, count);
}
