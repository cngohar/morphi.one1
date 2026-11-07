import legacyThemeDefaults from '#lib/engine/theme/config-v1.json' with { type: 'json' };
import { catalog } from '#lib/catalog.js';
import {
	THEME_CONFIG,
	validateThemeConfig,
	validateStyleConfig,
	type ThemeConfig
} from '#lib/engine/theme/config.js';
import { checkThemeConfig } from '#lib/engine/theme/generator.js';
export { validateThemeConfig, validateStyleConfig };
import { cachedConfigRow } from './config-cache.js';
import { RunError } from './runs.js';

export interface GameConfig {
	weight: number;
	dimensions?: Record<string, boolean>;
}
type Snapshot = { version: string; parent: string; values_json: string };
type ConfigKind = 'game' | 'theme' | 'style';
const GAME_CONFIG_VERSION = 'catalog-v1';

export function defaultGameConfig(family: string): GameConfig {
	if (!Object.hasOwn(catalog, family)) throw new RunError('input');
	return { weight: catalog[family].weight ?? 1 };
}

/** Insert missing catalog entries only; never revive disabled/deleted families. */
export async function ensureCatalogFamily(db: D1Database, family: string) {
	defaultGameConfig(family);
	if (await db.prepare('SELECT family FROM game_lifecycle WHERE family=?').bind(family).first())
		return;
	await db
		.prepare('INSERT INTO game_lifecycle(family,state) VALUES (?,?) ON CONFLICT(family) DO NOTHING')
		.bind(family, catalog[family].enabled === false ? 'disabled' : 'enabled')
		.run();
}

export function validateGameConfig(value: unknown): GameConfig {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new RangeError('game_config');
	const config = value as GameConfig;
	if (
		Object.keys(config).some((key) => key !== 'weight' && key !== 'dimensions') ||
		!Number.isSafeInteger(config.weight) ||
		config.weight < 0 ||
		config.weight > 10000
	)
		throw new RangeError('game_config');
	if (config.dimensions !== undefined) {
		const keys = catalog.memory.dimensionPolicy.dimensions.flatMap((dimension) =>
			dimension.values.map((value) => `${dimension.key}:${value.id}`)
		);
		if (
			!config.dimensions ||
			typeof config.dimensions !== 'object' ||
			Array.isArray(config.dimensions) ||
			Object.keys(config.dimensions).length !== keys.length ||
			keys.some((key) => typeof config.dimensions![key] !== 'boolean')
		)
			throw new RangeError('game_config');
		return {
			weight: config.weight,
			dimensions: Object.fromEntries(keys.map((key) => [key, config.dimensions![key]]))
		};
	}
	return { weight: config.weight };
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
				return row;
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
// CPU-only cache of immutable public snapshots; live pointers still come from D1.
const themeSafety = new Map<string, boolean>();
function safeTheme(value: unknown, version?: string): ThemeConfig {
	const config = validateThemeConfig(value, version);
	const key = JSON.stringify(config);
	let safe = themeSafety.get(key);
	if (safe === undefined) {
		safe = checkThemeConfig(config).length === 0;
		if (themeSafety.size >= 16) themeSafety.delete(themeSafety.keys().next().value!);
		themeSafety.set(key, safe);
	}
	if (!safe) throw new RangeError('theme_palette');
	return config;
}
export function readThemeConfig(db: D1Database, cache?: KVNamespace) {
	return readConfig(db, cache, 'theme', null, THEME_CONFIG.version, THEME_CONFIG, safeTheme);
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

export async function readLiveThemeConfig(db: D1Database, cache?: KVNamespace) {
	const live = await db
		.prepare("SELECT version FROM config_live WHERE key='theme'")
		.first<{ version: string }>();
	return {
		liveVersion: live?.version ?? THEME_CONFIG.version,
		...(await readThemeConfig(db, cache))
	};
}
export async function readThemeVersion(db: D1Database, version: string): Promise<ThemeConfig> {
	if (version === THEME_CONFIG.version) return THEME_CONFIG;
	// Queued solo results from the previous build retain their version and safe cosmetics.
	if (version === legacyThemeDefaults.version) return { ...THEME_CONFIG, version };
	const row = await db
		.prepare('SELECT values_json FROM theme_config WHERE version=?')
		.bind(version)
		.first<{ values_json: string }>();
	if (!row) throw new RunError('theme_version', 409);
	return safeTheme(JSON.parse(row.values_json), version);
}
