import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { SCORE_DEFAULTS, SCORE_DEFAULT_VERSION } from '../../src/lib/engine/scoring.js';
import {
	listScoreVersions,
	readLiveScoreConfig,
	readScoreConfig,
	rollbackScoreConfig,
	saveScoreConfig
} from '../../src/lib/server/scoring.js';
import { saveRun, startRanked } from '../../src/lib/server/runs.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
		await proxy.env.DB.batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => proxy.env.DB.prepare(part))
		);
	}
});
afterAll(async () => {
	await proxy?.dispose();
});

it('rolls back by creating an audited version while preserving the old values', async () => {
	const db = proxy.env.DB;
	const edit = await saveScoreConfig(
		db,
		'operator',
		'memory',
		SCORE_DEFAULT_VERSION,
		{ ...SCORE_DEFAULTS.memory, pair: 2000 },
		'Edit'
	);
	const rollback = await rollbackScoreConfig(
		db,
		'operator',
		'memory',
		edit.version,
		SCORE_DEFAULT_VERSION,
		'Restore'
	);
	expect(rollback.version).not.toBe(SCORE_DEFAULT_VERSION);
	expect(rollback.values).toEqual(SCORE_DEFAULTS.memory);
	expect(await readScoreConfig(db, 'memory', edit.version)).toEqual(edit);
	const audit = await db
		.prepare("SELECT before,after FROM admin_audit WHERE action='score-rollback'")
		.first<{ before: string; after: string }>();
	expect(JSON.parse(audit!.before)).toEqual(edit);
	expect(JSON.parse(audit!.after).sourceVersion).toBe(SCORE_DEFAULT_VERSION);
	await expect(
		rollbackScoreConfig(db, 'operator', 'memory', edit.version, SCORE_DEFAULT_VERSION, 'Stale')
	).rejects.toMatchObject({ code: 'score_conflict' });
});

it('falls back to the last valid server version for a new ranked start and rejects an invalid exact version', async () => {
	const db = proxy.env.DB;
	const valid = await saveScoreConfig(
		db,
		'operator',
		'connect',
		SCORE_DEFAULT_VERSION,
		{ ...SCORE_DEFAULTS.connect, pair: 300 },
		'Edit'
	);
	const invalid = crypto.randomUUID();
	await db.batch([
		db
			.prepare(
				'INSERT INTO score_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
			)
			.bind(invalid, 'connect', valid.version, '{', Date.now()),
		db.prepare('UPDATE score_live SET version=? WHERE family=?').bind(invalid, 'connect')
	]);
	expect(await readLiveScoreConfig(db, 'connect')).toEqual({
		liveVersion: invalid,
		config: valid
	});
	await expect(readScoreConfig(db, 'connect', invalid)).rejects.toMatchObject({
		code: 'score_version'
	});
	expect((await listScoreVersions(db, 'connect')).map((item) => item.version)).not.toContain(
		invalid
	);
	const id = crypto.randomUUID(),
		now = Date.now();
	await db.batch([
		db
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(id, 'Test', `${id}@example.test`, 1, now, now),
		db
			.prepare('INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)')
			.bind(id, 'scoringplayer', 'scoringplayer', now)
	]);
	await expect(
		saveRun(db, id, {
			version: 1,
			id: crypto.randomUUID(),
			family: 'connect',
			engineVersion: 'connect-1',
			seed: '42',
			moves: [{ pair: 0, cell: 0, stroke: 0, at: 0 }],
			elapsedSeconds: 1,
			rankedSession: null,
			scoreConfigVersion: invalid
		})
	).rejects.toMatchObject({ code: 'score_version' });
	const started = await startRanked(db, id, 'connect', 'ip', now);
	expect(started.scoring).toEqual(valid);
	const session = await db
		.prepare('SELECT score_config_version FROM play_session WHERE id=?')
		.bind(started.id)
		.first<{ score_config_version: string }>();
	expect(session?.score_config_version).toBe(valid.version);
	const fixed = await rollbackScoreConfig(
		db,
		'operator',
		'connect',
		invalid,
		valid.version,
		'Repair'
	);
	expect(fixed.values).toEqual(valid.values);
	expect((await readLiveScoreConfig(db, 'connect')).liveVersion).toBe(fixed.version);
});
