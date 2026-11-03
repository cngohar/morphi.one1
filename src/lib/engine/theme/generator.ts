import { containerStyle } from './style.js';
import type { PuzzleId } from '../contract.js';
import { createRng, normalizeSeed, shuffle } from '../rng.js';
import { blend, colorAtContrast, contrast, minimumDifference, oklch } from './color.js';
import {
	THEME_CONFIG,
	THEME_CONFIG_VERSION,
	THEME_GENERATOR_VERSION,
	themeProfile,
	validateThemeConfig,
	type ThemeConfig
} from './config.js';
import { siteTokenIssues } from './site-tokens.js';
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
	containerStyle?: { radius: string; clip: string };
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
	if (minimumDifference(theme.colors) < 22) issues.push('color_difference');
	if (contrast(theme.back, theme.background) < 1.55) issues.push('back_contrast');
	if (contrast(theme.edge, theme.background) < 3.1 || contrast(theme.edge, theme.face) < 3.1)
		issues.push('edge_contrast');
	if (contrast(theme.mark, theme.back) < 3.1) issues.push('mark_contrast');
	if (contrast('#1b2433', theme.background) < 4.7) issues.push('text_contrast');
	if (contrast(blend(theme.backdrop.color, theme.background, 0.2), theme.background) > 1.25)
		issues.push('decoration_contrast');
	return issues;
}

const paletteCache = new Map<string, string>();
function cachedColor(
	recipe: string,
	chroma: number,
	hue: number,
	target: number,
	ground = '#ffffff'
): string {
	const hueBucket = ((Math.round(hue) % 360) + 360) % 360;
	const chromaBucket = Math.round(chroma * 100) / 100;
	const key = `${recipe}:${hueBucket}:${chromaBucket}:${target}:${ground}`;
	let color = paletteCache.get(key);
	if (color === undefined) {
		color = colorAtContrast(chromaBucket, hueBucket, target, ground);
		if (paletteCache.size >= 32768) paletteCache.delete(paletteCache.keys().next().value!);
		paletteCache.set(key, color);
	}
	return color;
}
export function generateTheme(
	seed: string,
	family: ResolvedTheme['family'],
	versionOrConfig: string | Readonly<ThemeConfig> = THEME_CONFIG
): ResolvedTheme {
	const config = typeof versionOrConfig === 'string' ? THEME_CONFIG : versionOrConfig;
	if (typeof versionOrConfig === 'string' && versionOrConfig !== THEME_CONFIG_VERSION)
		throw new RangeError('theme_version');
	const version = config.version;
	const profile = themeProfile(config, family);
	const recipes = config.recipes.filter(({ id }) => profile.recipes.includes(id));
	const styles = config.styles.filter(({ id }) => profile.styles.includes(id));
	// A stable family domain permits future families without a shared fallback stream.
	let familyDomain = 0n;
	for (const char of family)
		familyDomain = BigInt.asUintN(64, familyDomain * 257n + BigInt(char.codePointAt(0)!));

	// Domain-separated stream: theme draws never consume the puzzle's RNG.
	const rng = createRng(
		((normalizeSeed(seed) ^ 0x7468656d652d7631n ^ familyDomain) & ((1n << 64n) - 1n)).toString()
	);
	const fraction = () => Number(rng.nextU64() >> 11n) / 9007199254740992;
	const pick = <T>(items: readonly T[]) => items[rng.nextInt(items.length)];
	let initialHueBucket = 0;
	for (let attempt = 1; attempt <= 9; attempt++) {
		const fallback = attempt === 9;
		const recipe = pick(recipes);
		const baseHue = fraction() * 360;
		if (attempt === 1) initialHueBucket = Math.floor(baseHue / 30);
		const targets = shuffle(rng, recipe.targets);
		const preset = pick(PRESETS);
		const colors = fallback
			? [...preset.colors]
			: targets.map((target, i) =>
					cachedColor(
						recipe.id,
						recipe.chroma[0] + fraction() * (recipe.chroma[1] - recipe.chroma[0]),
						baseHue +
							(recipe.offsets[i] ?? fraction() * 360) +
							(fraction() * 2 - 1) * recipe.jitter,
						target
					)
				);
		const background = fallback ? preset.background : oklch(0.965, 0.018, Math.round(baseHue));
		const back = fallback ? preset.back : cachedColor('surface', 0.07, baseHue, 1.8, background);
		const edge = cachedColor('edge', 0.1, baseHue, 5.5, background);
		const mark = cachedColor('mark', 0.05, baseHue, 4.6, back);
		const kind = pick(profile.backdrops);
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
			style: { ...pick(styles) },
			container: pick(profile.containers),
			symbols: generateSymbols(rng, profile.symbolCount, profile.symbolFamilies),
			backdrop: {
				kind,
				color: blend(edge, background, 0.35),
				items:
					kind === 'none'
						? []
						: [1 + rng.nextInt(5), 1 + rng.nextInt(5)].flatMap((count, side) =>
								Array.from({ length: count }, () => ({
									x: (side ? 90 : 2) + fraction() * 8,
									y: 22 + fraction() * 56,
									rotate: fraction() * 80 - 40,
									scale: 0.8 + fraction() * 0.5
								}))
							)
			}
		};
		theme.containerStyle = containerStyle(theme, config.siteTokens);
		if (!paletteIssues(theme).length) return theme;
		if (fallback) throw new Error('theme_preset_failed');
	}
	throw new Error('theme_generation_failed');
}

/** Publishing gate: schema, site contrast and actual gamut/Machado-checked palettes. */
export function checkThemeConfig(value: unknown): string[] {
	let config: ThemeConfig;
	try {
		config = validateThemeConfig(value);
	} catch {
		return ['theme_config'];
	}
	const issues = siteTokenIssues(config.siteTokens);
	for (const recipe of config.recipes) {
		const restricted: ThemeConfig = {
			...config,
			recipes: [recipe],
			profiles: Object.fromEntries(
				Object.entries(config.profiles).map(([family, profile]) => [
					family,
					{ ...profile, recipes: [recipe.id] }
				])
			)
		};
		let procedural = 0;
		for (let seed = 0; seed < 24; seed++) {
			try {
				const theme = generateTheme(String(seed), 'default', restricted);
				if (paletteIssues(theme).length) issues.push(`palette:${recipe.id}`);
				if (!theme.fallback) procedural++;
			} catch {
				issues.push(`palette:${recipe.id}`);
			}
		}
		if (!procedural) issues.push(`palette:${recipe.id}`);
	}
	return [...new Set(issues)];
}
