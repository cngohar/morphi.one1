import { THEME_CONFIG, FRESHNESS_RULES, themeProfile, type ThemeConfig } from './config.js';
import { generateTheme, type ResolvedTheme } from './generator.js';
export { FRESHNESS_RULES } from './config.js';

export function freshnessViolations(
	theme: ResolvedTheme,
	history: readonly ResolvedTheme[],
	config: Readonly<ThemeConfig> = THEME_CONFIG
) {
	const recent = history
		.filter(
			(previous) =>
				previous.family === theme.family &&
				previous.themeConfigVersion === theme.themeConfigVersion &&
				previous.themeGeneratorVersion === theme.themeGeneratorVersion
		)
		.slice(-themeProfile(config, theme.family).freshness.history);
	return FRESHNESS_RULES.filter((rule) =>
		recent.some((previous) => {
			switch (rule) {
				case 'recipe':
					return previous.recipe === theme.recipe;
				case 'hue': {
					const d = Math.abs(theme.baseHue - previous.baseHue);
					return Math.min(d, 360 - d) < 60;
				}
				case 'style':
					return previous.style.id === theme.style.id;
				case 'container':
					return previous.container === theme.container;
				case 'symbols': {
					const a = new Set(previous.symbols.map(({ family }) => family));
					const b = new Set(theme.symbols.map(({ family }) => family));
					const shared = [...a].filter((family) => b.has(family)).length;
					return shared / new Set([...a, ...b]).size >= 0.8;
				}
			}
		})
	);
}
export function freshnessScore(
	theme: ResolvedTheme,
	history: readonly ResolvedTheme[],
	config: Readonly<ThemeConfig> = THEME_CONFIG
): number {
	const { weights } = themeProfile(config, theme.family).freshness;
	return freshnessViolations(theme, history, config).reduce((sum, rule) => sum + weights[rule], 0);
}
export function drawFreshTheme(
	family: ResolvedTheme['family'],
	history: readonly ResolvedTheme[],
	drawSeed: () => string,
	config: Readonly<ThemeConfig> = THEME_CONFIG
) {
	let best: ResolvedTheme | undefined;
	let bestScore = Infinity;
	for (let attempt = 0; attempt < themeProfile(config, family).freshness.candidates; attempt++) {
		const candidate = generateTheme(drawSeed(), family, config);
		const score = freshnessScore(candidate, history, config);
		if (score < bestScore) {
			best = candidate;
			bestScore = score;
		}
		if (score === 0) break;
	}
	return best!;
}
