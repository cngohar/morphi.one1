import type { PuzzleId } from '../contract.js';
import { createRng, normalizeSeed, shuffle } from '../rng.js';
import { blend, colorAtContrast, contrast, minimumDifference, oklch } from './color.js';
import { THEME_CONFIG, THEME_CONFIG_VERSION, THEME_GENERATOR_VERSION } from './config.js';
import { generateSymbols, type ThemeSymbol } from './symbols.js';

export const PRESETS = [
	{
		id: 'shapes',
		background: '#e8f0fc',
		back: '#a9bcdd',
		colors: ['#009a86', '#7d61ae', '#7c4100', '#003041']
	},
	{ id: 'ocean', background: '#dff1f8', back: '#5bb5d5', colors: ['#1f78b4', '#c27400'] },
	{ id: 'garden', background: '#e6f4e1', back: '#6fbf73', colors: ['#2e8b57', '#b45309'] },
	{ id: 'candy', background: '#fde8f2', back: '#f27aae', colors: ['#d6336c', '#c27400'] }
] as const;

export interface ResolvedTheme {
	themeConfigVersion: string;
	themeGeneratorVersion: string;
	family: PuzzleId;
	seed: string;
	recipe: string;
	baseHue: number;
	initialHueBucket: number;
	attempts: number;
	fallback: boolean;
	background: string;
	back: string;
	face: string;
	edge: string;
	mark: string;
	colors: string[];
	style: (typeof THEME_CONFIG.styles)[number];
	container: string;
	symbols: ThemeSymbol[];
	backdrop: {
		kind: string;
		color: string;
		items: { x: number; y: number; rotate: number; scale: number }[];
	};
}
export function paletteIssues(
	theme: Pick<
		ResolvedTheme,
		'colors' | 'face' | 'back' | 'background' | 'edge' | 'mark' | 'backdrop'
	>
): string[] {
	const issues: string[] = [];
	if (!theme.colors.length || theme.colors.some((c) => contrast(c, theme.face) < 3.1))
		issues.push('symbol_contrast');
	if (minimumDifference([...new Set(theme.colors)]) < 22) issues.push('color_difference');
	if (contrast(theme.back, theme.background) < 1.55) issues.push('back_contrast');
	if (contrast(theme.edge, theme.background) < 3.1 || contrast(theme.edge, theme.face) < 3.1)
		issues.push('edge_contrast');
	if (contrast(theme.mark, theme.back) < 3.1) issues.push('mark_contrast');
	if (contrast('#1b2433', theme.background) < 4.7) issues.push('text_contrast');
	if (contrast(blend(theme.backdrop.color, theme.background, 0.2), theme.background) > 1.25)
		issues.push('decoration_contrast');
	return issues;
}

export function generateTheme(
	seed: string,
	family: ResolvedTheme['family'],
	version = THEME_CONFIG_VERSION
): ResolvedTheme {
	if (version !== THEME_CONFIG_VERSION) throw new RangeError('theme_version');
	// Domain-separated stream: theme draws never consume the puzzle's RNG.
	const rng = createRng(
		(
			(normalizeSeed(seed) ^
				0x7468656d652d7631n ^
				(family === 'memory'
					? 0x6d656d6f7279n
					: family === 'block'
						? 0x626c6f636bn
						: 0x636f6e6e656374n)) &
			((1n << 64n) - 1n)
		).toString()
	);
	const fraction = () => Number(rng.nextU64() >> 11n) / 9007199254740992;
	const pick = <T>(items: readonly T[]) => items[rng.nextInt(items.length)];
	let initialHueBucket = 0;
	for (let attempt = 1; attempt <= 9; attempt++) {
		const fallback = attempt === 9;
		const recipe = pick(THEME_CONFIG.recipes);
		const baseHue = fraction() * 360;
		if (attempt === 1) initialHueBucket = Math.floor(baseHue / 30);
		const targets = shuffle(rng, recipe.targets);
		const preset = pick(PRESETS);
		const colors = fallback
			? [...preset.colors]
			: targets.map((target, i) =>
					colorAtContrast(
						recipe.chroma[0] + fraction() * (recipe.chroma[1] - recipe.chroma[0]),
						baseHue +
							(recipe.offsets[i] ?? fraction() * 360) +
							(fraction() * 2 - 1) * recipe.jitter,
						target
					)
				);
		const background = fallback ? preset.background : oklch(0.965, 0.018, baseHue);
		const back = fallback ? preset.back : colorAtContrast(0.07, baseHue, 1.8, background);
		const edge = colorAtContrast(0.1, baseHue, 5.5, background);
		const mark = colorAtContrast(0.05, baseHue, 4.6, back);
		const kind = pick(THEME_CONFIG.backdrops);
		const theme: ResolvedTheme = {
			themeConfigVersion: version,
			themeGeneratorVersion: THEME_GENERATOR_VERSION,
			family,
			seed,
			recipe: fallback ? `preset-${preset.id}` : recipe.id,
			baseHue,
			initialHueBucket,
			attempts: Math.min(attempt, 8),
			fallback,
			background,
			back,
			face: '#ffffff',
			edge,
			mark,
			colors,
			style: { ...pick(THEME_CONFIG.styles) },
			container: pick(THEME_CONFIG.containers),
			symbols: generateSymbols(rng),
			backdrop: {
				kind,
				color: blend(edge, background, 0.35),
				items:
					kind === 'none'
						? []
						: Array.from(
								{ length: kind === 'corners' ? 4 : kind === 'diagonal' ? 6 : 8 },
								(_, i) => ({
									x: i % 2 ? 93 + fraction() * 4 : 3 + fraction() * 4,
									y:
										kind === 'corners'
											? (i < 2 ? 24 : 76) + fraction() * 3
											: kind === 'columns'
												? 23 + i * 7
												: kind === 'diagonal'
													? 24 + i * 9
													: 22 + fraction() * 56,
									rotate: kind === 'columns' ? 0 : fraction() * 80 - 40,
									scale: 0.8 + fraction() * 0.5
								})
							)
			}
		};
		if (!paletteIssues(theme).length) return theme;
		if (fallback) throw new Error('theme_preset_failed');
	}
	throw new Error('theme_generation_failed');
}
