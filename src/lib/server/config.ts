import { catalog } from '#lib/catalog.js';
import { THEME_CONFIG, type ThemeConfig } from '#lib/engine/theme/config.js';
import { cachedConfigRow } from './config-cache.js';
import { RunError } from './runs.js';

export interface GameConfig {
	weight: number;
}
type Snapshot = { version: string; parent: string; values_json: string };
type ConfigKind = 'game' | 'theme' | 'style';
const GAME_CONFIG_VERSION = 'catalog-v1';

export function defaultGameConfig(family: string): GameConfig {
	if (!Object.hasOwn(catalog, family)) throw new RunError('input');
	return { weight: 1 };
}

/** Insert missing catalog entries only; never revive disabled/deleted families. */
export async function ensureCatalogFamily(db: D1Database, family: string) {
	defaultGameConfig(family);
	if (await db.prepare('SELECT family FROM game_lifecycle WHERE family=?').bind(family).first())
		return;
	await db
		.prepare(
			"INSERT INTO game_lifecycle(family,state) VALUES (?,'enabled') ON CONFLICT(family) DO NOTHING"
		)
		.bind(family)
		.run();
}

export function validateGameConfig(value: unknown): GameConfig {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new RangeError('game_config');
	const config = value as GameConfig;
	if (
		Object.keys(config).join(',') !== 'weight' ||
		!Number.isSafeInteger(config.weight) ||
		config.weight < 0 ||
		config.weight > 10000
	)
		throw new RangeError('game_config');
	return { weight: config.weight };
}

function finite(value: unknown, min: number, max: number): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function strings(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.length <= 64 &&
		value.every((item) => typeof item === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(item)) &&
		new Set(value).size === value.length
	);
}
export function validateStyleConfig(value: unknown): ThemeConfig['styles'] {
	if (!Array.isArray(value) || value.length === 0 || value.length > 64)
		throw new RangeError('style_config');
	const styles = value as ThemeConfig['styles'];
	if (
		styles.some(
			(style) =>
				!style ||
				Object.keys(style).sort().join(',') !== 'aspect,border,fill,gap,id,radius' ||
				!strings([style.id]) ||
				!finite(style.radius, 0, 32) ||
				!finite(style.border, 1, 4) ||
				!finite(style.gap, 0, 16) ||
				!finite(style.aspect, 0.8, 1.2) ||
				!['solid', 'outline'].includes(style.fill)
		) ||
		new Set(styles.map((style) => style.id)).size !== styles.length
	)
		throw new RangeError('style_config');
	return styles;
}
export function validateThemeConfig(value: unknown, version?: string): ThemeConfig {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new RangeError('theme_config');
	const config = value as ThemeConfig;
	if (
		Object.keys(config).sort().join(',') !== 'backdrops,containers,recipes,styles,version' ||
		typeof config.version !== 'string' ||
		!/^[a-zA-Z0-9-]{1,80}$/.test(config.version) ||
		(version !== undefined && config.version !== version) ||
		!strings(config.containers) ||
		!strings(config.backdrops) ||
		!Array.isArray(config.recipes) ||
		config.recipes.length === 0 ||
		config.recipes.length > 64
	)
		throw new RangeError('theme_config');
	validateStyleConfig(config.styles);
	for (const recipe of config.recipes) {
		if (
			!recipe ||
			Object.keys(recipe).sort().join(',') !== 'chroma,id,jitter,offsets,targets' ||
			!strings([recipe.id]) ||
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
			throw new RangeError('theme_config');
	}
	if (new Set(config.recipes.map((recipe) => recipe.id)).size !== config.recipes.length)
		throw new RangeError('theme_config');
	return config;
}

async function readConfig<T>(
	db: D1Database,
	cache: KVNamespace | undefined,
	kind: ConfigKind,
	family: string | null,
	defaultVersion: string,
	fallback: T,
	validate: (value: unknown, version?: string) => T
): Promise<{ version: string; values: T }> {
	const key = family === null ? kind : `${kind}:${family}`;
	try {
		const live = await db
			.prepare('SELECT version FROM config_live WHERE key=?')
			.bind(key)
			.first<{ version: string }>();
		let version = live?.version ?? defaultVersion;
		const seen = new Set<string>();
		while (version !== defaultVersion && !seen.has(version) && seen.size < 32) {
			seen.add(version);
			const expectedVersion = version;
			const parse = (value: unknown): Snapshot | null => {
				if (!value || typeof value !== 'object') return null;
				const row = value as Snapshot;
				if (
					row.version !== expectedVersion ||
					typeof row.parent !== 'string' ||
					typeof row.values_json !== 'string'
				)
					return null;
				try {
					validate(JSON.parse(row.values_json), row.version);
					return row;
				} catch {
					return null;
				}
			};
			const row = await cachedConfigRow(
				cache,
				`config-v1:${key}:${version}`,
				() => {
					// The table name is a closed internal enum, never user input.
					const query = db.prepare(
						`SELECT version,parent,values_json FROM ${kind}_config WHERE version=?${family === null ? '' : ' AND family=?'}`
					);
					return (
						family === null ? query.bind(expectedVersion) : query.bind(expectedVersion, family)
					).first<Snapshot>();
				},
				parse
			);
			if (!row) break;
			try {
				return { version, values: validate(JSON.parse(row.values_json), row.version) };
			} catch {
				console.warn('morphi:config_invalid', key);
				version = row.parent;
			}
		}
	} catch {
		console.warn('morphi:config_unavailable', key);
	}
	return { version: defaultVersion, values: fallback };
}

export function readGameConfig(db: D1Database, family: string, cache?: KVNamespace) {
	return readConfig(
		db,
		cache,
		'game',
		family,
		GAME_CONFIG_VERSION,
		defaultGameConfig(family),
		validateGameConfig
	);
}
// Storage/read contracts only. Theme generation and admin publishing belong to Slice 5.
export function readThemeConfig(db: D1Database, cache?: KVNamespace) {
	return readConfig(
		db,
		cache,
		'theme',
		null,
		THEME_CONFIG.version,
		THEME_CONFIG,
		validateThemeConfig
	);
}
export function readStyleConfig(db: D1Database, family: string, cache?: KVNamespace) {
	defaultGameConfig(family);
	return readConfig(
		db,
		cache,
		'style',
		family,
		THEME_CONFIG.version,
		THEME_CONFIG.styles,
		validateStyleConfig
	);
}
