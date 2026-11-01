import data from './config-v1.json' with { type: 'json' };

export interface ThemeConfig {
	version: string;
	recipes: {
		id: string;
		offsets: number[];
		jitter: number;
		chroma: [number, number];
		targets: number[];
	}[];
	styles: {
		id: string;
		radius: number;
		border: number;
		gap: number;
		aspect: number;
		fill: 'solid' | 'outline';
	}[];
	containers: string[];
	backdrops: string[];
}
/** Immutable snapshot: edits require a new file and a new version. */
function freeze<T>(value: T): T {
	if (value && typeof value === 'object') {
		Object.values(value).forEach(freeze);
		Object.freeze(value);
	}
	return value;
}
export const THEME_CONFIG: Readonly<ThemeConfig> = freeze(data as ThemeConfig);
export const THEME_CONFIG_VERSION = THEME_CONFIG.version;
export const THEME_GENERATOR_VERSION = 'oklch-machado-1';
