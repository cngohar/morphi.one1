import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { THEME_CONFIG, type ThemeConfig } from '../../src/lib/engine/theme/config.js';
import { generateTheme } from '../../src/lib/engine/theme/generator.js';
import {
	readLiveThemeConfig,
	readThemeConfig,
	readThemeVersion
} from '../../src/lib/server/config.js';
import {
	checkThemeDraft,
	listThemeVersions,
	publishThemeDraft,
	readThemeDraft,
	rollbackThemeConfig,
	saveThemeDraft
} from '../../src/lib/server/theme-admin.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const actor = crypto.randomUUID();
const db = () => proxy.env.DB;
const values = (): ThemeConfig => structuredClone(THEME_CONFIG);

function unsafePalette(version = THEME_CONFIG.version): ThemeConfig {
	const config = values();
	config.version = version;
	for (const recipe of config.recipes) {
		recipe.chroma = [0, 0];
		recipe.targets = [3.3, 3.4, 3.5];
	}
	return config;
}

async function snapshot(version: string) {
	return db()
		.prepare('SELECT version,parent,values_json FROM theme_config WHERE version=?')
		.bind(version)
		.first<{ version: string; parent: string; values_json: string }>();
}

beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort())
		await db().batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => db().prepare(part))
		);
	await db().prepare("INSERT INTO admin_actor(id,role) VALUES(?,'admin')").bind(actor).run();
}, 30_000);

afterAll(async () => {
	await proxy?.dispose();
});

it('keeps draft/check separate from live values, then publishes an audited immutable snapshot', async () => {
	const before = await readLiveThemeConfig(db());
	const input = values();
	input.styles[0]!.radius = 13;
	input.profiles.memory = {
		...input.profiles.default,
		styles: [input.styles[0]!.id],
		containers: ['squircle'],
		symbolCount: 12
	};
	const draft = await saveThemeDraft(db(), actor, before.liveVersion, input, 'CASE-THEME-DRAFT');
	expect(await readThemeDraft(db(), draft.id)).toEqual(draft);
	expect(draft.values.version).toBe(draft.id);
	expect(await readLiveThemeConfig(db())).toEqual(before);
	expect(await checkThemeDraft(db(), actor, draft.id)).toEqual([]);
	expect(await readLiveThemeConfig(db())).toEqual(before);
	const published = await publishThemeDraft(
		db(),
		actor,
		draft.id,
		before.liveVersion,
		'CASE-THEME-PUBLISH'
	);
	expect(published).toEqual({ version: draft.id, values: draft.values });
	const memoryTheme = generateTheme('42', 'memory', published.values);
	expect(memoryTheme).toMatchObject({
		themeConfigVersion: draft.id,
		container: 'squircle',
		style: { radius: 13 }
	});
	expect(memoryTheme.symbols).toHaveLength(12);
	expect(generateTheme('42', 'block', published.values).symbols).toHaveLength(10);
	expect(await readLiveThemeConfig(db(), proxy.env.CONFIG_CACHE)).toEqual({
		liveVersion: draft.id,
		...published
	});
	expect(await readThemeVersion(db(), draft.id)).toEqual(draft.values);
	expect(await listThemeVersions(db())).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ version: THEME_CONFIG.version }),
			expect.objectContaining({ version: draft.id })
		])
	);
	for (const table of ['theme_config', 'theme_draft']) {
		const key = table === 'theme_config' ? 'version' : 'id';
		await expect(
			db().prepare(`UPDATE ${table} SET values_json='{}' WHERE ${key}=?`).bind(draft.id).run()
		).rejects.toThrow();
		await expect(
			db().prepare(`DELETE FROM ${table} WHERE ${key}=?`).bind(draft.id).run()
		).rejects.toThrow();
	}
	const audit = await db()
		.prepare('SELECT action,target,reason FROM admin_audit WHERE actor=? ORDER BY rowid')
		.bind(actor)
		.all<{ action: string; target: string; reason: string }>();
	expect(audit.results).toEqual([
		{ action: 'theme-draft', target: draft.id, reason: 'CASE-THEME-DRAFT' },
		{ action: 'theme-check', target: draft.id, reason: 'Theme publishing safety check' },
		{ action: 'theme-publish', target: 'theme', reason: 'CASE-THEME-PUBLISH' }
	]);
}, 30_000);

it('rejects an unsafe palette at publishing even when the draft was never checked', async () => {
	const before = await readLiveThemeConfig(db());
	const draft = await saveThemeDraft(
		db(),
		actor,
		before.liveVersion,
		unsafePalette(),
		'CASE-UNSAFE-DRAFT'
	);
	await expect(
		publishThemeDraft(db(), actor, draft.id, before.liveVersion, 'CASE-UNSAFE-PUBLISH')
	).rejects.toMatchObject({ code: 'theme_palette', status: 400 });
	expect(await checkThemeDraft(db(), actor, draft.id)).toEqual(
		expect.arrayContaining([expect.stringMatching(/^palette:/)])
	);
	expect(await readLiveThemeConfig(db())).toEqual(before);
	expect(await snapshot(draft.id)).toBeNull();
	expect(
		await db()
			.prepare("SELECT id FROM admin_audit WHERE actor=? AND reason='CASE-UNSAFE-PUBLISH'")
			.bind(actor)
			.first()
	).toBeNull();
	await expect(
		saveThemeDraft(
			db(),
			actor,
			before.liveVersion,
			{ ...values(), containers: ['unknown'] },
			'CASE-SCHEMA'
		)
	).rejects.toThrow();
}, 30_000);

it('permits one concurrent publisher and rejects stale drafts without orphan versions or audits', async () => {
	const { liveVersion: expected } = await readLiveThemeConfig(db());
	const a = await saveThemeDraft(db(), actor, expected, values(), 'CASE-RACE-DRAFT-A');
	const b = await saveThemeDraft(db(), actor, expected, values(), 'CASE-RACE-DRAFT-B');
	const results = await Promise.allSettled([
		publishThemeDraft(db(), actor, a.id, expected, 'CASE-RACE-PUBLISH-A'),
		publishThemeDraft(db(), actor, b.id, expected, 'CASE-RACE-PUBLISH-B')
	]);
	const winners = results.filter((result) => result.status === 'fulfilled');
	const losers = results.filter((result) => result.status === 'rejected');
	expect(winners).toHaveLength(1);
	expect(losers).toHaveLength(1);
	expect(losers[0]!.reason).toMatchObject({ code: 'theme_conflict', status: 409 });
	const live = await readLiveThemeConfig(db());
	expect(live.version).toBe(winners[0]!.value.version);
	const rows = await db()
		.prepare('SELECT version FROM theme_config WHERE parent=?')
		.bind(expected)
		.all<{ version: string }>();
	expect(rows.results).toEqual([{ version: live.version }]);
	const losingDraft = live.version === a.id ? b : a;
	expect(await snapshot(losingDraft.id)).toBeNull();
	await expect(
		publishThemeDraft(db(), actor, losingDraft.id, expected, 'CASE-STALE-PUBLISH')
	).rejects.toMatchObject({ code: 'theme_conflict', status: 409 });
	await expect(
		saveThemeDraft(db(), actor, expected, values(), 'CASE-STALE-DRAFT')
	).rejects.toMatchObject({ code: 'theme_conflict', status: 409 });
	const audit = await db()
		.prepare(
			"SELECT count(*) n FROM admin_audit WHERE actor=? AND action='theme-publish' AND reason LIKE 'CASE-RACE-PUBLISH-%'"
		)
		.bind(actor)
		.first<{ n: number }>();
	expect(audit?.n).toBe(1);
}, 30_000);

it('falls through bad D1 and cached palettes to the previous live theme, then rolls back without redeploying', async () => {
	const initial = await readLiveThemeConfig(db());
	const draft = await saveThemeDraft(
		db(),
		actor,
		initial.liveVersion,
		values(),
		'CASE-FALLBACK-DRAFT'
	);
	await publishThemeDraft(db(), actor, draft.id, initial.liveVersion, 'CASE-FALLBACK-PUBLISH');
	const before = await readLiveThemeConfig(db(), proxy.env.CONFIG_CACHE);
	const saved = await snapshot(before.version);
	const brokenPalette = crypto.randomUUID();
	const brokenJson = crypto.randomUUID();
	const invalid = {
		version: brokenPalette,
		parent: before.version,
		values_json: JSON.stringify(unsafePalette(brokenPalette))
	};
	// Fault injection bypasses the publishing gate to model corrupt stored configuration.
	await db().batch([
		db()
			.prepare('INSERT INTO theme_config(version,parent,values_json,created_at) VALUES(?,?,?,?)')
			.bind(invalid.version, invalid.parent, invalid.values_json, Date.now()),
		db().prepare("UPDATE config_live SET version=? WHERE key='theme'").bind(brokenPalette)
	]);
	await proxy.env.CONFIG_CACHE.put(`config-v1:theme:${brokenPalette}`, JSON.stringify(invalid));
	expect(await readLiveThemeConfig(db(), proxy.env.CONFIG_CACHE)).toEqual({
		...before,
		liveVersion: brokenPalette
	});
	await db().batch([
		db()
			.prepare('INSERT INTO theme_config(version,parent,values_json,created_at) VALUES(?,?,?,?)')
			.bind(brokenJson, brokenPalette, '{', Date.now()),
		db().prepare("UPDATE config_live SET version=? WHERE key='theme'").bind(brokenJson)
	]);
	expect(await readThemeConfig(db(), proxy.env.CONFIG_CACHE)).toEqual({
		version: before.version,
		values: before.values
	});
	expect(await readLiveThemeConfig(db(), proxy.env.CONFIG_CACHE)).toEqual({
		...before,
		liveVersion: brokenJson
	});
	const restored = await rollbackThemeConfig(
		db(),
		actor,
		brokenJson,
		before.version,
		'CASE-THEME-ROLLBACK'
	);
	expect(restored.version).not.toBe(before.version);
	expect(restored.values).toEqual({ ...before.values, version: restored.version });
	expect(await readLiveThemeConfig(db(), proxy.env.CONFIG_CACHE)).toEqual({
		liveVersion: restored.version,
		...restored
	});
	expect(await snapshot(before.version)).toEqual(saved);
	expect((await snapshot(restored.version))?.parent).toBe(brokenJson);
	const audit = await db()
		.prepare(
			"SELECT before,after FROM admin_audit WHERE actor=? AND action='theme-rollback' AND reason='CASE-THEME-ROLLBACK'"
		)
		.bind(actor)
		.first<{ before: string; after: string }>();
	expect(JSON.parse(audit!.before)).toEqual({ version: brokenJson });
	expect(JSON.parse(audit!.after)).toEqual({
		version: restored.version,
		sourceVersion: before.version
	});
}, 30_000);
