import { THEME_CONFIG, validateThemeConfig, type ThemeConfig } from '#lib/engine/theme/config.js';
import { checkThemeConfig } from '#lib/engine/theme/generator.js';
import { readLiveThemeConfig, readThemeVersion } from './config.js';
import { RunError } from './runs.js';

export interface ThemeDraft {
	id: string;
	baseVersion: string;
	values: ThemeConfig;
	createdAt: number;
}
function audit(
	db: D1Database,
	actor: string,
	action: string,
	target: string,
	reason: string,
	before: unknown,
	after: unknown
) {
	return db
		.prepare(
			'INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,?,?,?,?,?,?)'
		)
		.bind(
			crypto.randomUUID(),
			actor,
			action,
			target,
			reason,
			JSON.stringify(before),
			JSON.stringify(after),
			Date.now()
		);
}
function requireReason(reason: string) {
	if (reason.trim().length < 3 || reason.length > 240 || /[\r\n@]/.test(reason))
		throw new RunError('input');
}
export async function saveThemeDraft(
	db: D1Database,
	actor: string,
	expected: string,
	input: unknown,
	reason: string
): Promise<ThemeDraft> {
	requireReason(reason);
	const { liveVersion } = await readLiveThemeConfig(db);
	if (liveVersion !== expected) throw new RunError('theme_conflict', 409);
	if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RunError('input');
	const id = crypto.randomUUID(),
		createdAt = Date.now();
	const values = validateThemeConfig({ ...(input as object), version: id }, id);
	await db.batch([
		db
			.prepare('INSERT INTO theme_draft(id,base_version,values_json,created_at) VALUES(?,?,?,?)')
			.bind(id, expected, JSON.stringify(values), createdAt),
		audit(db, actor, 'theme-draft', id, reason, { version: expected }, { version: id })
	]);
	return { id, baseVersion: expected, values, createdAt };
}
export async function readThemeDraft(db: D1Database, id: string): Promise<ThemeDraft> {
	const row = await db
		.prepare('SELECT id,base_version,values_json,created_at FROM theme_draft WHERE id=?')
		.bind(id)
		.first<{ id: string; base_version: string; values_json: string; created_at: number }>();
	if (!row) throw new RunError('missing', 404);
	return {
		id: row.id,
		baseVersion: row.base_version,
		values: validateThemeConfig(JSON.parse(row.values_json), id),
		createdAt: row.created_at
	};
}
export async function checkThemeDraft(db: D1Database, actor: string, id: string) {
	const draft = await readThemeDraft(db, id);
	const issues = checkThemeConfig(draft.values);
	await audit(db, actor, 'theme-check', id, 'Theme publishing safety check', null, {
		issues
	}).run();
	return issues;
}
export async function listThemeDrafts(db: D1Database) {
	return (
		await db
			.prepare(
				'SELECT id,base_version AS baseVersion,created_at AS createdAt FROM theme_draft ORDER BY created_at DESC,id DESC LIMIT 20'
			)
			.all<{ id: string; baseVersion: string; createdAt: number }>()
	).results;
}
export async function listThemeVersions(db: D1Database) {
	const rows = await db
		.prepare(
			'SELECT version,created_at AS createdAt FROM theme_config ORDER BY created_at DESC,version DESC LIMIT 100'
		)
		.all<{ version: string; createdAt: number }>();
	return [{ version: THEME_CONFIG.version, createdAt: null }, ...rows.results];
}
async function publish(
	db: D1Database,
	actor: string,
	expected: string,
	values: ThemeConfig,
	reason: string,
	source?: string
) {
	requireReason(reason);
	if (checkThemeConfig(validateThemeConfig(values)).length) throw new RunError('theme_palette');
	const { liveVersion } = await readLiveThemeConfig(db);
	if (liveVersion !== expected) throw new RunError('theme_conflict', 409);
	try {
		await db.batch([
			db
				.prepare('INSERT INTO theme_config(version,parent,values_json,created_at) VALUES(?,?,?,?)')
				.bind(values.version, expected, JSON.stringify(values), Date.now()),
			db
				.prepare(
					"INSERT INTO config_live(key,version) VALUES('theme',?) ON CONFLICT(key) DO UPDATE SET version=excluded.version"
				)
				.bind(values.version),
			audit(
				db,
				actor,
				source ? 'theme-rollback' : 'theme-publish',
				'theme',
				reason,
				{ version: expected },
				{ version: values.version, ...(source ? { sourceVersion: source } : {}) }
			)
		]);
	} catch (e) {
		if (String(e).includes('UNIQUE constraint failed')) throw new RunError('theme_conflict', 409);
		throw e;
	}
	return { version: values.version, values };
}
export async function publishThemeDraft(
	db: D1Database,
	actor: string,
	id: string,
	expected: string,
	reason: string
) {
	const draft = await readThemeDraft(db, id);
	if (draft.baseVersion !== expected) throw new RunError('theme_conflict', 409);
	return publish(db, actor, expected, draft.values, reason);
}
export async function rollbackThemeConfig(
	db: D1Database,
	actor: string,
	expected: string,
	sourceVersion: string,
	reason: string
) {
	const source = await readThemeVersion(db, sourceVersion);
	return publish(
		db,
		actor,
		expected,
		{ ...source, version: crypto.randomUUID() },
		reason,
		sourceVersion
	);
}
