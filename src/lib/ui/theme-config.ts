import { resolve } from '$app/paths';
import { THEME_CONFIG, validateThemeConfig, type ThemeConfig } from '#lib/engine/theme/config.js';

let current: Readonly<ThemeConfig> = THEME_CONFIG;
let pending: Promise<Readonly<ThemeConfig>> | null = null;

export function applySiteTokens(config: Readonly<ThemeConfig>): void {
	for (const [name, value] of Object.entries(config.siteTokens))
		document.documentElement.style.setProperty(name, value);
}

/** Each candidate holds one immutable snapshot; an unavailable read retains the last valid snapshot. */
export function loadThemeConfig(): Promise<Readonly<ThemeConfig>> {
	if (import.meta.env.MODE === 'public-guest') return Promise.resolve(THEME_CONFIG);
	pending ??= (async () => {
		try {
			const response = await fetch(resolve('/api/play/theme'), {
				cache: 'no-store',
				signal: AbortSignal.timeout(3000)
			});
			if (!response.ok) throw new Error('theme_config_unavailable');
			const snapshot: unknown = await response.json();
			if (
				!snapshot ||
				typeof snapshot !== 'object' ||
				!('version' in snapshot) ||
				typeof snapshot.version !== 'string' ||
				!('values' in snapshot)
			)
				throw new Error('theme_config_invalid');
			current = validateThemeConfig(snapshot.values, snapshot.version);
			applySiteTokens(current);
		} catch {
			console.warn('morphi:theme_config_unavailable');
		}
		return current;
	})().finally(() => {
		pending = null;
	});
	return pending;
}
