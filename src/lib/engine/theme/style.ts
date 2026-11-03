import type { ResolvedTheme } from './generator.js';
import defaults from './site-tokens.json' with { type: 'json' };

export function containerStyle(
	theme: Pick<ResolvedTheme, 'container' | 'style'>,
	tokens: Record<string, string> = defaults
) {
	return {
		radius:
			theme.container === 'circle'
				? tokens['--shape-circle-radius']
				: theme.container === 'squircle'
					? tokens['--shape-squircle-radius']
					: `${theme.style.radius}%`,
		clip: theme.container === 'hexagon' ? tokens['--shape-hexagon-clip'] : 'none'
	};
}

export function themeStyle(theme: ResolvedTheme): string {
	const shape = theme.containerStyle ?? containerStyle(theme);
	return [
		`--memory-radius:${shape.radius}`,
		`--block-radius:${shape.radius}`,
		`--connect-radius:${shape.radius}`,
		`--theme-face:${theme.face}`,
		`--theme-border:${theme.style.border}px`,
		`--theme-gap:${theme.style.gap}px`,
		`--theme-aspect:${theme.style.aspect}`,
		`--theme-clip:${shape.clip}`
	].join(';');
}
