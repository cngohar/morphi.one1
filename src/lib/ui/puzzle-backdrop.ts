import { puzzleMetadata } from '#lib/puzzle-metadata.js';
import { createRng, normalizeSeed } from '#lib/engine/rng.js';
import { blend, contrast } from '#lib/engine/theme/color.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';

/** Presentation only: keep approved palette snapshots and game RNG unchanged. */
export function puzzleBackdrop(theme: ResolvedTheme) {
	if (!Object.hasOwn(puzzleMetadata, theme.family)) throw new RangeError('backdrop_family');
	const definition = puzzleMetadata[theme.family].presentation?.backdrop;
	if (!definition?.items.length) throw new RangeError('backdrop_family');
	let scatterSeed = normalizeSeed(theme.seed) ^ 0x73636174746572n;
	// Published backdrop choices must affect the rendered layout as well as its label.
	for (const character of theme.backdrop.kind)
		scatterSeed = BigInt.asUintN(64, scatterSeed * 257n + BigInt(character.codePointAt(0)!));
	const rng = createRng(scatterSeed.toString());
	const fraction = () => rng.nextInt(1000) / 1000;
	let color = theme.backdrop.color;
	for (const strength of [0.65, 0.6, 0.55, 0.5]) {
		const candidate = blend(theme.edge, theme.background, strength);
		if (contrast(blend(candidate, theme.background, 0.2), theme.background) <= 1.25) {
			color = candidate;
			break;
		}
	}
	// Wider layouts have 1–5 objects per side; compact layouts hide this layer.
	const leftCount = 1 + rng.nextInt(5);
	const rightCount = 1 + rng.nextInt(5);
	const items = Array.from({ length: leftCount + rightCount }, (_, i) => {
		const band = i < leftCount ? 'left' : 'right';
		const piece = definition.items[rng.nextInt(definition.items.length)];
		const glyph = theme.symbols[rng.nextInt(theme.symbols.length)];
		return {
			band,
			// Independent two-dimensional positions within each exposed background region.
			x: 0.08 + fraction() * 0.84,
			y: 8 + fraction() * 84,
			rotate: Math.round(fraction() * 60 - 30),
			kind: piece.id,
			path: piece.path,
			glyph: glyph.path
		};
	});
	return {
		color,
		fill: definition.fill,
		symbol: definition.symbol,
		kind: theme.backdrop.kind === 'none' ? 'arc' : theme.backdrop.kind,
		items
	};
}
