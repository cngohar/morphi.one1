import data from './config-v1.json' with { type: 'json' };
import siteTokens from './site-tokens.json' with { type: 'json' };
import { SYMBOL_FAMILIES } from './symbols.js';
import { validateSiteTokens } from './site-tokens.js';

export const FRESHNESS_RULES = ['recipe', 'hue', 'style', 'container', 'symbols'] as const;
export interface FamilyThemeProfile {
	recipes: string[];
	styles: string[];
	containers: string[];
	backdrops: string[];
	symbolFamilies: string[];
	symbolCount: number;
	freshness: {
		candidates: number;
		history: number;
		weights: Record<(typeof FRESHNESS_RULES)[number], number>;
	};
}
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
	profiles: Record<string, FamilyThemeProfile>;
	siteTokens: Record<string, string>;
}
function freeze<T>(value: T): T {
	if (value && typeof value === 'object') {
		Object.values(value).forEach(freeze);
		Object.freeze(value);
	}
	return value;
}
const profile: FamilyThemeProfile = {
	recipes: data.recipes.map(({ id }) => id),
	styles: data.styles.map(({ id }) => id),
	containers: data.containers,
	backdrops: data.backdrops,
	symbolFamilies: [...SYMBOL_FAMILIES],
	symbolCount: 10,
	freshness: {
		candidates: 8,
		history: 3,
		weights: { recipe: 3, hue: 2, style: 2, container: 1, symbols: 2 }
	}
};
export const THEME_GENERATOR_VERSION = 'oklch-machado-2';
export const themeProfile = (config: Readonly<ThemeConfig>, family: string): FamilyThemeProfile =>
	Object.hasOwn(config.profiles, family) ? config.profiles[family] : config.profiles.default;
const finite = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: unknown, expected: string): boolean {
	return record(value) && Object.keys(value).sort().join(',') === expected;
}
function ids(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.length <= 64 &&
		value.every((id) => typeof id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(id)) &&
		new Set(value).size === value.length
	);
}
export function validateStyleConfig(value: unknown): ThemeConfig['styles'] {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.length > 64 ||
		value.some(
			(style) =>
				!keys(style, 'aspect,border,fill,gap,id,radius') ||
				!ids([style.id]) ||
				!finite(style.radius, 0, 32) ||
				!finite(style.border, 1, 4) ||
				!finite(style.gap, 0, 16) ||
				!finite(style.aspect, 0.8, 1.2) ||
				!['solid', 'outline'].includes(style.fill)
		) ||
		new Set(value.map(({ id }) => id)).size !== value.length
	)
		throw new RangeError('style_config');
	return value;
}
export function validateThemeConfig(value: unknown, version?: string): ThemeConfig {
	const fail = () => {
		throw new RangeError('theme_config');
	};
	if (!keys(value, 'backdrops,containers,profiles,recipes,siteTokens,styles,version'))
		return fail();
	const config = value as ThemeConfig;
	if (
		typeof config.version !== 'string' ||
		!/^[a-zA-Z0-9-]{1,80}$/.test(config.version) ||
		(version !== undefined && config.version !== version) ||
		!ids(config.containers) ||
		config.containers.some((id) => !['rounded', 'squircle', 'circle', 'hexagon'].includes(id)) ||
		!ids(config.backdrops) ||
		config.backdrops.some(
			(id) => !['corners', 'columns', 'diagonal', 'edges', 'none'].includes(id)
		) ||
		!Array.isArray(config.recipes) ||
		config.recipes.length === 0 ||
		config.recipes.length > 64
	)
		return fail();
	validateStyleConfig(config.styles);
	for (const recipe of config.recipes) {
		if (
			!keys(recipe, 'chroma,id,jitter,offsets,targets') ||
			!ids([recipe.id]) ||
			!Array.isArray(recipe.offsets) ||
			recipe.offsets.length > 16 ||
			!recipe.offsets.every((n) => finite(n, -360, 360)) ||
			!finite(recipe.jitter, 0, 30) ||
			!Array.isArray(recipe.chroma) ||
			recipe.chroma.length !== 2 ||
			!recipe.chroma.every((n) => finite(n, 0, 0.19)) ||
			recipe.chroma[0] > recipe.chroma[1] ||
			!Array.isArray(recipe.targets) ||
			recipe.targets.length < 3 ||
			recipe.targets.length > 16 ||
			!recipe.targets.every((n) => finite(n, 3.3, 21))
		)
			return fail();
	}
	if (
		new Set(config.recipes.map(({ id }) => id)).size !== config.recipes.length ||
		!record(config.profiles) ||
		!Object.hasOwn(config.profiles, 'default') ||
		Object.keys(config.profiles).length > 128
	)
		return fail();
	// Current renderers index ten symbol slots; lower counts would silently lose identities.
	for (const [family, p] of Object.entries(config.profiles)) {
		if (
			!ids([family]) ||
			!keys(p, 'backdrops,containers,freshness,recipes,styles,symbolCount,symbolFamilies') ||
			!Number.isSafeInteger(p.symbolCount) ||
			!finite(p.symbolCount, 10, 12) ||
			!ids(p.symbolFamilies) ||
			p.symbolFamilies.length < 3 ||
			p.symbolFamilies.some((id) => !SYMBOL_FAMILIES.includes(id)) ||
			p.symbolCount > p.symbolFamilies.length ||
			!keys(p.freshness, 'candidates,history,weights') ||
			!Number.isSafeInteger(p.freshness.candidates) ||
			!finite(p.freshness.candidates, 1, 16) ||
			!Number.isSafeInteger(p.freshness.history) ||
			!finite(p.freshness.history, 1, 8) ||
			!keys(p.freshness.weights, 'container,hue,recipe,style,symbols') ||
			Object.values(p.freshness.weights).some((n) => !finite(n, 0, 100))
		)
			return fail();
		for (const axis of ['recipes', 'styles', 'containers', 'backdrops'] as const) {
			const available =
				axis === 'recipes' || axis === 'styles' ? config[axis].map(({ id }) => id) : config[axis];
			if (!ids(p[axis]) || p[axis].some((id) => !available.includes(id))) return fail();
		}
	}
	if (!validateSiteTokens(config.siteTokens)) return fail();
	return config;
}

/** Bundled safe defaults; published snapshots carry their own immutable version. */
export const THEME_CONFIG: Readonly<ThemeConfig> = freeze(
	validateThemeConfig({
		...data,
		version: 'theme-2026-11-02-1',
		profiles: { default: profile },
		siteTokens
	})
);
export const THEME_CONFIG_VERSION = THEME_CONFIG.version;
