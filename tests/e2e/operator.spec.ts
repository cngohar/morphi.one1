import { test, expect } from '@playwright/test';
import { getPlatformProxy } from 'wrangler';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { createAuth } from '../../src/lib/server/auth.js';
import { totp } from '../../src/lib/server/admin-totp.js';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
test.use({ baseURL: 'http://localhost:5173' });
const ids: string[] = [];
async function fixture(role: 'admin' | 'moderator' | 'support' | null) {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		const helpers = (
			await betterAuth({
				...createAuth(proxy.env.DB, {
					baseURL: 'http://localhost:5173',
					secret: proxy.env.BETTER_AUTH_SECRET,
					googleClientId: '',
					googleClientSecret: ''
				}).options,
				plugins: [testUtils()]
			}).$context
		).test;
		const user = await helpers.saveUser(
			helpers.createUser({
				email: `${crypto.randomUUID()}@example.test`,
				name: 'Private operator fixture'
			})
		);
		ids.push(user.id);
		const login = await helpers.login({ userId: user.id });
		if (role) {
			const secret = new Uint8Array(20).fill(11),
				iv = randomBytes(12),
				cipher = createCipheriv(
					'aes-256-gcm',
					createHash('sha256').update(`operator-v1:${proxy.env.BETTER_AUTH_SECRET}`).digest(),
					iv
				);
			const data = Buffer.concat([cipher.update(secret), cipher.final(), cipher.getAuthTag()]);
			await proxy.env.DB.batch([
				proxy.env.DB.prepare('INSERT INTO admin_actor(id,role) VALUES(?,?)').bind(user.id, role),
				proxy.env.DB.prepare(
					'INSERT INTO admin_web_operator(user_id,secret_cipher) VALUES(?,?)'
				).bind(user.id, JSON.stringify({ iv: Array.from(iv), data: Array.from(data) }))
			]);
			return { login, code: totp(secret, Date.now()), id: user.id };
		}
		await proxy.env.DB.prepare(
			'INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)'
		)
			.bind(
				user.id,
				`p_${user.id.slice(0, 8)}`,
				`p_${user.id.slice(0, 8)}`.toLowerCase(),
				Date.now()
			)
			.run();
		return { login, code: '', id: user.id };
	} finally {
		await proxy.dispose();
	}
}
test.afterAll(async () => {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		for (const id of ids)
			await proxy.env.DB.batch([
				proxy.env.DB.prepare('DELETE FROM admin_web_operator WHERE user_id=?').bind(id),
				proxy.env.DB.prepare('DELETE FROM admin_actor WHERE id=?').bind(id),
				proxy.env.DB.prepare('DELETE FROM user WHERE id=?').bind(id),
				proxy.env.DB.prepare('DELETE FROM admin_audit WHERE actor=? OR target=?').bind(id, id)
			]);
	} finally {
		await proxy.dispose();
	}
});
test('ordinary signed-in players get 403 on every operator view and action', async ({
	browser
}) => {
	const fixtureUser = await fixture(null),
		context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await context.addCookies(fixtureUser.login.cookies);
	for (const view of ['dashboard', 'status', 'moderation', 'queue', 'audit', 'privacy']) {
		const response = await context.request.get(`/admin/${view}`, { maxRedirects: 0 });
		expect(response.status()).toBe(403);
		const changed = await context.request.post(`/admin/${view}`, {
			headers: { origin: 'http://localhost:5173' },
			form: { action: 'ranked-off', target: 'ranked', reason: 'CASE-TEST', confirm: 'yes' }
		});
		expect(changed.status()).toBe(403);
	}
	await context.close();
});
test('real Google-session fixture plus TOTP opens the native dashboard and audits a ranked switch', async ({
	browser
}) => {
	const operator = await fixture('admin'),
		context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await context.addCookies(operator.login.cookies);
	const page = await context.newPage();
	await page.goto('/admin/sign-in');
	await page.getByRole('textbox').fill(operator.code);
	await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/dashboard$/);
	await expect(
		page.getByRole('heading', { name: 'A view of Morphi.One.', exact: true })
	).toBeVisible();
	await page.goto('/admin/status');
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		const old = await proxy.env.DB.prepare(
			"SELECT enabled FROM site_control WHERE key='ranked'"
		).first<{ enabled: number }>();
		await page.locator('input[name=reason]').fill('CASE-TEST-STATUS');
		await page.locator('input[name=confirm]').check();
		await page.locator('button.primary').click();
		await expect(page.getByRole('status')).toContainText('Action recorded.');
		const audit = await proxy.env.DB.prepare(
			"SELECT action FROM admin_audit WHERE actor=? AND reason='CASE-TEST-STATUS'"
		)
			.bind(operator.id)
			.first<{ action: string }>();
		expect(audit?.action).toMatch(/^ranked-(on|off)$/);
		await proxy.env.DB.prepare(
			"INSERT INTO site_control(key,enabled) VALUES('ranked',?) ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled"
		)
			.bind(old?.enabled ?? 1)
			.run();
		const target = await fixture(null);
		const playerName = `p_${target.id.slice(0, 8)}`,
			newName = `ren_${target.id.slice(0, 8)}`;
		const rename = await context.request.post('/admin/moderation', {
			headers: { origin: 'http://localhost:5173' },
			form: {
				action: 'rename',
				target: playerName,
				name: newName,
				reason: 'CASE-TEST-RENAME',
				confirm: 'yes'
			}
		});
		expect(rename.status()).toBe(200);
		expect(
			await proxy.env.DB.prepare('SELECT name FROM player WHERE user_id=?').bind(target.id).first()
		).toMatchObject({ name: newName });
		const reference = `CASE-${target.id.slice(0, 8)}`;
		const record = await context.request.post('/admin/queue', {
			headers: { origin: 'http://localhost:5173' },
			form: {
				action: 'case-add',
				target: newName,
				kind: 'username',
				reason: reference,
				confirm: 'yes'
			}
		});
		expect(record.status()).toBe(200);
		const resolved = await context.request.post('/admin/queue', {
			headers: { origin: 'http://localhost:5173' },
			form: { action: 'case-resolve', target: reference, reason: reference, confirm: 'yes' }
		});
		expect(resolved.status()).toBe(200);
		expect(
			await proxy.env.DB.prepare('SELECT state FROM moderation_case WHERE id=?')
				.bind(reference)
				.first()
		).toMatchObject({ state: 'resolved' });
		await proxy.env.DB.prepare('DELETE FROM moderation_case WHERE id=?').bind(reference).run();
		const exported = await context.request.post('/admin/privacy', {
			headers: { origin: 'http://localhost:5173' },
			form: { action: 'export', target: newName, reason: reference, confirm: 'yes', offset: '0' }
		});
		expect(exported.status()).toBe(200);
		expect(await exported.text()).toContain('nextOffset');
		const denied = await context.request.post('/admin/status', {
			headers: { origin: 'https://other.example' },
			form: { action: 'ranked-off', target: 'ranked', reason: 'CASE-TEST-ORIGIN', confirm: 'yes' }
		});
		expect(denied.status()).toBe(403);
	} finally {
		await proxy.dispose();
		await context.close();
	}
});
