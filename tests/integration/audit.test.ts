import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { exportAuditYear, readAudit } from '../../src/lib/server/audit.js';
import { moderate, undoModeration } from '../../src/lib/server/moderation.js';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	const db = proxy.env.DB;
	for (const file of (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort())
		await db.batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((s) => s.trim())
				.map((s) => db.prepare(s))
		);
	await db.batch([
		db.prepare(
			"INSERT INTO admin_actor(id,role) VALUES('admin','admin'),('moderator','moderator')"
		),
		db.prepare(
			"INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('player','Player','player@example.test',1,1,1)"
		)
	]);
});
afterAll(async () => {
	await proxy?.dispose();
});

it('captures changes and undoes an unban as a fresh ban while rejecting stale undo', async () => {
	const db = proxy.env.DB;
	await moderate(db, 'moderator', 'ban', 'player', 'first reason');
	const unban = await moderate(db, 'moderator', 'unban', 'player', 'review completed');
	const result = await undoModeration(db, 'moderator', unban.id, 'new reason');
	const ban = await db
		.prepare("SELECT reason,created_at,expires_at FROM player_ban WHERE user_id='player'")
		.first<{ reason: string; created_at: number; expires_at: number | null }>();
	const audit = await db
		.prepare('SELECT before,after,created_at FROM admin_audit WHERE id=?')
		.bind(result.id)
		.first<{ before: string; after: string; created_at: number }>();
	expect(ban).toEqual({ reason: 'new reason', created_at: audit?.created_at, expires_at: null });
	expect(JSON.parse(audit!.before)).toBeNull();
	expect(JSON.parse(audit!.after)).toEqual({
		userId: 'player',
		reason: 'new reason',
		createdAt: ban!.created_at,
		expiresAt: null
	});
	await expect(undoModeration(db, 'moderator', unban.id, 'duplicate undo')).rejects.toMatchObject({
		code: 'undo_conflict'
	});
	await expect(
		db.prepare('UPDATE admin_audit SET reason=? WHERE id=?').bind('edited', result.id).run()
	).rejects.toThrow();
	await expect(
		db.prepare('DELETE FROM admin_audit WHERE id=?').bind(result.id).run()
	).rejects.toThrow();
});

it('restricts audit reads and filters UTC intervals, with a frozen paged export', async () => {
	const db = proxy.env.DB;
	await expect(readAudit(db, 'moderator')).rejects.toMatchObject({ status: 403 });
	await expect(exportAuditYear(db, 'moderator', 2025)).rejects.toMatchObject({ status: 403 });
	const start = Date.UTC(2025, 0, 1);
	await db
		.prepare(
			`WITH RECURSIVE fixtures(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM fixtures WHERE i<1000)
		INSERT INTO admin_audit(id,actor,action,target,reason,created_at)
		SELECT 'fixture-'||i,'admin','fixture','target','test',?+i FROM fixtures`
		)
		.bind(start)
		.run();
	const filtered = await readAudit(db, 'admin', {
		actor: 'admin',
		action: 'fixture',
		target: 'target',
		from: start + 1,
		to: start + 3
	});
	expect(filtered.rows.map((row) => row.id)).toEqual(['fixture-2', 'fixture-1']);
	await expect(readAudit(db, 'admin', { from: start, to: start })).rejects.toMatchObject({
		code: 'input'
	});
	const first = await exportAuditYear(db, 'admin', 2025);
	expect(first.rows).toHaveLength(1000);
	expect(first.nextCursor).not.toBeNull();
	await db
		.prepare(
			"INSERT INTO admin_audit(id,actor,action,target,reason,created_at) VALUES('late','admin','fixture','target','test',?)"
		)
		.bind(start)
		.run();
	const second = await exportAuditYear(db, 'admin', 2025, first.nextCursor!);
	expect(second.rows.map((row) => row.id)).toEqual(['fixture-1000']);
	expect(second.nextCursor).toBeNull();
});
