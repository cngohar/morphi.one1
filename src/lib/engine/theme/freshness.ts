import { generateTheme, type ResolvedTheme } from './generator.js';

export const FRESHNESS_RULES = ['recipe', 'hue', 'style', 'container', 'symbols'] as const;
export function freshnessViolations(theme: ResolvedTheme, history: readonly ResolvedTheme[]) {
	const recent = history.slice(-3);
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
				case 'symbols':
					return previous.symbols.some((a) => theme.symbols.some((b) => a.family === b.family));
			}
		})
	);
}
export function drawFreshTheme(
	family: ResolvedTheme['family'],
	history: readonly ResolvedTheme[],
	drawSeed: () => string
) {
	let theme: ResolvedTheme | undefined;
	for (let attempt = 0; attempt < 8; attempt++) {
		theme = generateTheme(drawSeed(), family);
		if (!freshnessViolations(theme, history).length) break;
	}
	return theme!;
}
