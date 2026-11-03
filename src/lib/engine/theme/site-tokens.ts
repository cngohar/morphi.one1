import defaults from './site-tokens.json' with { type: 'json' };
import { contrast } from './color.js';

const keys = Object.keys(defaults).sort().join(',');
const aliases = new Set(Object.values(defaults).filter((value) => value.startsWith('var(')));
const bounded = (value: string, max: number) =>
	Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max;

/** Values cannot introduce CSS declarations, URLs, arbitrary functions or new token names. */
export function validateSiteTokens(value: unknown): value is Record<string, string> {
	if (
		!value ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		Object.keys(value).sort().join(',') !== keys
	)
		return false;
	return Object.entries(value).every(([key, token]) => {
		if (typeof token !== 'string' || token.length > 80) return false;
		const fallback = defaults[key as keyof typeof defaults];
		if (key.endsWith('-opacity'))
			return (
				/^(?:0(?:\.\d+)?|1)$/.test(token) &&
				(key === '--disabled-opacity' ? Number(token) >= 0.35 : Number(token) <= 0.5)
			);
		if (fallback.startsWith('#')) return /^#[\da-f]{6}$/i.test(token);
		if (fallback.startsWith('var(')) return /^#[\da-f]{6}$/i.test(token) || aliases.has(token);
		if (fallback.startsWith('polygon(')) {
			if (
				!/^polygon\((?:\d+(?:\.\d+)?% \d+(?:\.\d+)?%,){5}\d+(?:\.\d+)?% \d+(?:\.\d+)?%\)$/.test(
					token
				)
			)
				return false;
			const points = token
				.slice(8, -1)
				.split(',')
				.map((point) => point.split(' ').map((part) => Number(part.slice(0, -1))));
			if (points.flat().some((n) => n < 0 || n > 100)) return false;
			let twiceArea = 0;
			const turns: number[] = [];
			for (let i = 0; i < points.length; i++) {
				const a = points[i],
					b = points[(i + 1) % points.length],
					c = points[(i + 2) % points.length];
				twiceArea += a[0] * b[1] - b[0] * a[1];
				turns.push((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]));
			}
			return (
				Math.abs(twiceArea) >= 6000 && (turns.every((n) => n >= 0) || turns.every((n) => n <= 0))
			);
		}
		if (fallback.startsWith('rgb(')) {
			const rgb = /^rgb\((\d+) (\d+) (\d+) \/ (0(?:\.\d+)?|1)\)$/.exec(token);
			return !!rgb && rgb.slice(1, 4).every((part) => bounded(part, 255));
		}
		if (fallback.startsWith('clamp(')) {
			const clamp = /^clamp\((\d+(?:\.\d+)?)px, (\d+(?:\.\d+)?)vmin, (\d+(?:\.\d+)?)px\)$/.exec(
				token
			);
			return (
				!!clamp &&
				bounded(clamp[1], 64) &&
				bounded(clamp[2], 10) &&
				bounded(clamp[3], 64) &&
				Number(clamp[1]) <= Number(clamp[3])
			);
		}
		const dimension = /^(\d+(?:\.\d+)?)(px|%)$/.exec(token);
		if (!dimension || dimension[2] !== (fallback.endsWith('%') ? '%' : 'px')) return false;
		const max =
			dimension[2] === '%'
				? 100
				: key.startsWith('--line-')
					? 4
					: key.startsWith('--radius-')
						? 64
						: 128;
		return bounded(dimension[1], max) && (!key.startsWith('--line-') || Number(dimension[1]) >= 1);
	});
}

export function siteTokenIssues(tokens: Record<string, string>): string[] {
	if (!validateSiteTokens(tokens)) return ['site_tokens'];
	const issues: string[] = [];
	for (const foreground of ['--ink', '--ink-2', '--muted'])
		for (const background of ['--bg', '--surface', '--surface-2'])
			if (contrast(tokens[foreground], tokens[background]) < 4.5)
				issues.push(`text_contrast:${foreground}:${background}`);
	return issues;
}
