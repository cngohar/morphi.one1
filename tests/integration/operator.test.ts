import { beforeAll, afterAll, it, expect } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { readFile, readdir } from 'node:fs/promises';
import {
	can,
	permissions,
	encryptOperatorSecret,
	totpAt,
	verifyOperator,
	requireOperator,
	enrollOperator
} from '../../src/lib/server/operator.js';
import { totp } from '../../src/lib/server/admin-totp.js';
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const now = 1800000000000,
	secret = new Uint8Array(20).fill(7),
	appSecret = 'local-test-secret-for-operator-tests-only';
beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort())
		await proxy.env.DB.batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((s) => s.trim())
				.map((s) => proxy.env.DB.prepare(s))
		);
});
afterAll(async () => {
	await proxy?.dispose();
});
async function identity(role = 'admin') {
	const id = crypto.randomUUID(),
		session = crypto.randomUUID(),
		db = proxy.env.DB;
	await db.batch([
		db
			.prepare(
				'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,?,?)'
			)
			.bind(id, 'Fixture', `${id}@example.test`, now, now),
		db
			.prepare(
				'INSERT INTO session(id,token,user_id,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?)'
			)
			.bind(session, crypto.randomUUID(), id, now, now, now + 3600000),
		db.prepare('INSERT INTO admin_actor(id,role) VALUES(?,?)').bind(id, role),
		db
			.prepare('INSERT INTO admin_web_operator(user_id,secret_cipher) VALUES(?,?)')
			.bind(id, await encryptOperatorSecret(secret, appSecret))
	]);
	return { id, session };
}
it('covers every role and permission, with no ordinary-player grants', () => {
	const all = [...new Set(Object.values(permissions).flat())];
	for (const role of ['admin', 'moderator', 'support', 'player', 'unknown'])
		for (const action of [...all, 'impersonate', 'role-edit', 'audit-delete'])
			expect(can(role, action)).toBe(
				role in permissions &&
					(permissions[role as keyof typeof permissions] as readonly string[]).includes(action)
			);
});
it('matches the established TOTP vectors, denies replay and binds privileged sessions to the Google session', async () => {
	const fixture = await identity(),
		db = proxy.env.DB;
	const code = await totpAt(secret, Math.floor(now / 30000));
	expect(code).toBe(totp(secret, now));
	const token = await verifyOperator(db, fixture.id, fixture.session, code, false, appSecret, now);
	const current = { userId: fixture.id, authSession: fixture.session, authCreatedAt: now, token };
	await expect(
		requireOperator(db, { ...current, authCreatedAt: now - 16 * 60000 }, 'dashboard', true, now)
	).rejects.toMatchObject({ code: 'operator_reauth', status: 403 });
	expect((await requireOperator(db, current, 'dashboard', true, now)).role).toBe('admin');
	await expect(
		verifyOperator(db, fixture.id, fixture.session, code, false, appSecret, now)
	).rejects.toMatchObject({ code: 'operator_code' });
	await expect(
		requireOperator(db, { ...current, authSession: 'another' }, 'dashboard', false, now)
	).rejects.toMatchObject({ code: 'signed_out', status: 401 });
	await expect(
		requireOperator(db, current, 'dashboard', true, now + 16 * 60000)
	).rejects.toMatchObject({ code: 'signed_out', status: 401 });
	const audit = await db
		.prepare("SELECT count(*) n FROM admin_audit WHERE actor=? AND action='operator-login'")
		.bind(fixture.id)
		.first<{ n: number }>();
	expect(audit?.n).toBe(1);
});
it('requires a new operator sign-in after idle or absolute expiry and keeps fresh-auth limits', async () => {
	const fixture = await identity(),
		db = proxy.env.DB;
	const token = await verifyOperator(
		db,
		fixture.id,
		fixture.session,
		await totpAt(secret, Math.floor(now / 30000)),
		false,
		appSecret,
		now
	);
	const current = { userId: fixture.id, authSession: fixture.session, authCreatedAt: now, token };
	await expect(
		requireOperator(db, current, 'dashboard', false, now + 10 * 60000)
	).rejects.toMatchObject({ code: 'signed_out', status: 401 });
	for (const minutes of [9, 15])
		await requireOperator(db, current, 'dashboard', false, now + minutes * 60000);
	await expect(
		requireOperator(db, current, 'dashboard', true, now + 16 * 60000)
	).rejects.toMatchObject({ code: 'operator_reauth', status: 403 });
	await expect(
		requireOperator(
			db,
			{ ...current, authCreatedAt: now + 16 * 60000 },
			'dashboard',
			true,
			now + 16 * 60000
		)
	).rejects.toMatchObject({ code: 'operator_reauth', status: 403 });
	for (const minutes of [24, 29])
		await requireOperator(db, current, 'dashboard', false, now + minutes * 60000);
	await expect(
		requireOperator(db, current, 'dashboard', false, now + 30 * 60000)
	).rejects.toMatchObject({ code: 'signed_out', status: 401 });
});
it('locks repeated failures and consumes recovery codes once with an audit record', async () => {
	const fixture = await identity(),
		db = proxy.env.DB;
	for (let i = 0; i < 5; i++)
		await expect(
			verifyOperator(db, fixture.id, fixture.session, 'wrong', false, appSecret, now)
		).rejects.toMatchObject({ status: 403 });
	await expect(
		verifyOperator(
			db,
			fixture.id,
			fixture.session,
			await totpAt(secret, Math.floor(now / 30000)),
			false,
			appSecret,
			now
		)
	).rejects.toMatchObject({ code: 'operator_locked' });
	const code = crypto.randomUUID().replaceAll('-', '');
	const { digest } = await import('../../src/lib/server/runs.js');
	await db
		.prepare('INSERT INTO admin_recovery(code_hash,user_id) VALUES(?,?)')
		.bind(await digest(`recovery:${fixture.id}:${code}`), fixture.id)
		.run();
	await db
		.prepare('UPDATE admin_web_operator SET locked_until=0 WHERE user_id=?')
		.bind(fixture.id)
		.run();
	expect(
		await verifyOperator(db, fixture.id, fixture.session, code, true, appSecret, now)
	).toHaveLength(72);
	await expect(
		verifyOperator(db, fixture.id, fixture.session, code, true, appSecret, now)
	).rejects.toMatchObject({ status: 403 });
});
it('rejects enrollment without explicit OS-owner permission and rejects moderator dashboard access', async () => {
	await expect(
		enrollOperator(proxy.env.DB, 'unknown', 'unknown', 'owner@example.test', appSecret, secret, [])
	).rejects.toMatchObject({ status: 403 });
	const fixture = await identity('moderator');
	const token = await verifyOperator(
		proxy.env.DB,
		fixture.id,
		fixture.session,
		await totpAt(secret, Math.floor(now / 30000)),
		false,
		appSecret,
		now
	);
	await expect(
		requireOperator(
			proxy.env.DB,
			{ userId: fixture.id, authSession: fixture.session, authCreatedAt: now, token },
			'dashboard',
			false,
			now
		)
	).rejects.toMatchObject({ code: 'permission', status: 403 });
	expect(
		await requireOperator(
			proxy.env.DB,
			{ userId: fixture.id, authSession: fixture.session, authCreatedAt: now, token },
			'moderation',
			false,
			now
		)
	).toMatchObject({ role: 'moderator' });
});
