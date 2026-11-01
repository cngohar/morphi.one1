import { PIECES } from '#lib/catalog.js';
import { createRng, normalizeSeed } from '#lib/engine/rng.js';
import { blend, contrast } from '#lib/engine/theme/color.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';

/** Presentation only: keep approved palette snapshots and game RNG unchanged. */
export function puzzleBackdrop(theme: ResolvedTheme) {
	const families = { memory: true, block: true, connect: true } satisfies Record<
		ResolvedTheme['family'],
		boolean
	>;
	if (!Object.hasOwn(families, theme.family)) throw new RangeError('backdrop_family');
	const rng = createRng((normalizeSeed(theme.seed) ^ 0x73636174746572n).toString());
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
		const piece = PIECES[rng.nextInt(PIECES.length)];
		const glyph = theme.symbols[rng.nextInt(theme.symbols.length)];
		return {
			band,
			// Independent two-dimensional positions within each exposed background region.
			x: 0.08 + fraction() * 0.84,
			y: 8 + fraction() * 84,
			rotate: Math.round(fraction() * 60 - 30),
			kind: theme.family === 'memory' ? 'card' : theme.family === 'connect' ? 'dot-path' : piece.id,
			path:
				theme.family === 'connect'
					? 'M8 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M13 17v27h34V17M42 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0'
					: theme.family === 'memory'
						? `M12 5H48V55H12Z`
						: piece.cells
								.map(({ x, y }) => {
									const size = 46 / Math.max(piece.width, piece.height);
									const left = 7 + x * size;
									const top = 7 + y * size;
									return `M${left} ${top}h${size - 2}v${size - 2}h${2 - size}Z`;
								})
								.join(''),
			glyph: glyph.path
		};
	});
	return { color, kind: theme.backdrop.kind === 'none' ? 'arc' : theme.backdrop.kind, items };
}
