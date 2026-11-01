import type { ResolvedTheme } from './generator.js';
export function themeStyle(theme: ResolvedTheme): string {
	const radius =
		theme.container === 'circle'
			? '50%'
			: theme.container === 'squircle'
				? '30%'
				: `${theme.style.radius}%`;
	return [
		`--memory-radius:${radius}`,
		`--block-radius:${radius}`,
		`--connect-radius:${radius}`,
		`--theme-face:${theme.face}`,
		`--theme-border:${theme.style.border}px`,
		`--theme-gap:${theme.style.gap}px`,
		`--theme-aspect:${theme.style.aspect}`,
		`--theme-clip:${theme.container === 'hexagon' ? 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)' : 'none'}`
	].join(';');
}
