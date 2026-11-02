import { test, expect, type Page } from '@playwright/test';
import { getPlatformProxy } from 'wrangler';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { createAuth } from '../../src/lib/server/auth.js';
import { totp } from '../../src/lib/server/admin-totp.js';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
test.use({ baseURL: 'http://localhost:5173' });
const ids: string[] = [];
async function captureAdmin(page: Page, name: string) {
	if (!process.env.ADMIN_REVIEW_CAPTURE_STAGE) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 844, height: 390 },
		{ width: 1280, height: 800 },
		{ width: 1920, height: 923 }
	]) {
		await page.setViewportSize(viewport);
		await page.screenshot({
			path: `build/combined-review/${process.env.ADMIN_REVIEW_CAPTURE_STAGE ?? 'after'}/admin-${name}-${viewport.width}x${viewport.height}.png`,
			fullPage: true,
			animations: 'disabled'
		});
	}
}
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
			return { login, code: totp(secret, Date.now()), id: user.id, email: user.email };
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
		return { login, code: '', id: user.id, email: user.email };
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
				proxy.env.DB.prepare('DELETE FROM user WHERE id=?').bind(id)
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
	for (const view of [
		'dashboard',
		'users',
		'status',
		'moderation',
		'queue',
		'audit',
		'privacy',
		'scoring',
		'games'
	]) {
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
	const noSecondFactor = await context.request.get('/admin/dashboard', { maxRedirects: 0 });
	expect(noSecondFactor.status()).toBe(303);
	expect(noSecondFactor.headers().location).toBe('/admin/sign-in');
	const page = await context.newPage();
	await page.goto('/admin/sign-in');
	await expect(
		page.getByText('Use the Morphi.One authenticator entry', { exact: false })
	).toBeVisible();
	await page.getByRole('textbox').fill('123');
	await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('That code was not accepted.');
	await page.getByRole('textbox').fill(operator.code);
	await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/dashboard$/);
	await expect(
		page.getByRole('heading', { name: 'A view of Morphi.One.', exact: true })
	).toBeVisible();
	await page.goto('/admin/scoring');
	const memoryEditor = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Memory', exact: true }) });
	await memoryEditor.getByLabel('Points per pair').fill('1250');
	await memoryEditor.locator('form').first().locator('input[name=reason]').fill('Score test');
	await memoryEditor.locator('form').first().locator('input[name=confirm]').check();
	await memoryEditor.getByRole('button', { name: 'Save scoring' }).click();
	await expect(page.getByRole('status')).toContainText('Action recorded.');
	await page.goto('/admin/audit');
	await expect(page.getByText('score-change').first()).toBeVisible();
	await page.goto('/admin/scoring');
	const restoredEditor = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Memory', exact: true }) });
	await restoredEditor.locator('form').first().locator('input[name=reason]').fill('Restore test');
	await restoredEditor.locator('form').first().locator('input[name=confirm]').check();
	await restoredEditor.getByRole('button', { name: 'Restore brief defaults' }).click();
	await expect(page.getByRole('status')).toContainText('Action recorded.');
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

test('operator sign-in explains temporary locks and request limits', async ({ browser }) => {
	const operator = await fixture('admin'),
		context = await browser.newContext({ baseURL: 'http://localhost:5173' }),
		proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		await context.addCookies(operator.login.cookies);
		await proxy.env.DB.prepare('UPDATE admin_web_operator SET locked_until=? WHERE user_id=?')
			.bind(Date.now() + 15 * 60000, operator.id)
			.run();
		const page = await context.newPage();
		await page.goto('/admin/sign-in');
		await page.getByRole('textbox').fill(operator.code);
		await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('Wait 15 minutes');
		await expect(page).toHaveURL(/\/admin\/sign-in(?:\?.*)?$/);
		await proxy.env.DB.prepare(
			'INSERT INTO admin_web_limit(key,count,expires_at) VALUES(?,5,?) ON CONFLICT(key) DO UPDATE SET count=5'
		)
			.bind(`${Math.floor(Date.now() / 60000)}:verify:${operator.id}`, Date.now() + 120000)
			.run();
		await page.getByRole('textbox').fill(operator.code);
		await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('Wait a minute');
	} finally {
		await proxy.dispose();
		await context.close();
	}
});

test('games admin manages availability and restores scoring without losing saved history', async ({
	browser
}) => {
	const operator = await fixture('admin');
	const player = await fixture(null);
	const roundId = crypto.randomUUID();
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	const originalState = await proxy.env.DB.prepare(
		"SELECT state,restore_until FROM game_lifecycle WHERE family='memory'"
	).first<{ state: string; restore_until: number | null }>();
	let scoreSource: string | undefined;
	let scoreRestored = false;
	const cleanupFailures: string[] = [];
	try {
		expect(originalState?.state).toBe('enabled');
		const before = await proxy.env.DB.prepare(
			"SELECT count(*) AS count FROM completed_run WHERE family='memory'"
		).first<{ count: number }>();
		await proxy.env.DB.prepare(
			`INSERT INTO completed_run(id,user_id,family,engine_version,rules_group,score,moves,seconds,seed,move_log,payload_hash,ranked,created_at)
			 VALUES(?,?,'memory','1','fixture',1234,8,30,'1','[]',?,0,?)`
		)
			.bind(roundId, player.id, crypto.randomUUID(), Date.now())
			.run();
		await context.addCookies(operator.login.cookies);
		const page = await context.newPage();
		await page.goto('/admin/sign-in');
		await page.getByRole('textbox').fill(totp(new Uint8Array(20).fill(11), Date.now()));
		await page.getByRole('button', { name: 'Verify and continue' }).click();
		await expect(page).toHaveURL(/\/admin\/dashboard$/);
		await page.goto('/admin/games');
		expect((await context.request.get('/admin/games?game=unknown')).status()).toBe(400);
		await expect(
			page.getByText('Retained saved account completions only', { exact: false })
		).toBeVisible();
		for (const family of ['Block puzzle', 'Memory', 'Connect']) {
			const card = page
				.locator('a.game-card')
				.filter({ has: page.getByRole('heading', { name: `${family} · Enabled`, exact: true }) });
			await expect(card).toBeVisible();
			await expect(card).toContainText('Saved completions');
		}
		await captureAdmin(page, 'games-overview');
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			await expect(page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
				false
			);
		}
		await page
			.locator('a.game-card')
			.filter({ has: page.getByRole('heading', { name: 'Memory · Enabled', exact: true }) })
			.click();
		await expect(page).toHaveURL(/game=memory/);
		const card = page
			.locator('section.admin-card')
			.filter({ has: page.getByRole('heading', { name: /^Memory ·/ }) });
		await expect(card).toContainText(`Saved completions: ${(before?.count ?? 0) + 1}`);
		await expect(card).toContainText('fixture');
		await expect(card).toContainText('1234');
		await captureAdmin(page, 'games-statistics');
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			await expect(card).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
				false
			);
		}
		await page
			.getByRole('navigation', { name: 'Game sections' })
			.getByRole('link', { name: 'Settings' })
			.click();
		await expect(card.getByRole('button', { name: 'Disable game' })).toBeVisible();
		await captureAdmin(page, 'games-settings');
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			await expect(card.getByRole('button', { name: 'Disable game' })).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
				false
			);
		}
		const apply = async (form: ReturnType<typeof page.locator>, button: string, reason: string) => {
			await form.locator('input[name=reason]').fill(reason);
			await form.locator('input[name=confirm]').check();
			await form.getByRole('button', { name: button, exact: true }).click();
		};
		await apply(card.locator('form').first(), 'Disable game', 'CASE-GAME-DISABLE');
		await expect(card).toContainText('Memory · Disabled');
		await apply(card.locator('form').first(), 'Enable game', 'CASE-GAME-ENABLE');
		await expect(card).toContainText('Memory · Enabled');
		await apply(card.locator('form').first(), 'Disable game', 'CASE-GAME-DISABLE-DELETE');
		await card.locator('summary').click();
		await apply(card.locator('details form'), 'Soft-delete game', 'CASE-GAME-DELETE');
		await expect(card).toContainText('Memory · Soft-deleted');
		expect(
			await proxy.env.DB.prepare('SELECT id FROM completed_run WHERE id=?').bind(roundId).first()
		).toBeTruthy();
		await apply(card.locator('form').first(), 'Restore game', 'CASE-GAME-RESTORE');
		await expect(card).toContainText('Memory · Disabled');
		await apply(card.locator('form').first(), 'Enable game', 'CASE-GAME-REENABLE');
		await expect(card).toContainText('Memory · Enabled');

		const editor = page
			.locator('section.scoring-card')
			.filter({ has: page.getByRole('heading', { name: 'Memory', exact: true }) });
		const save = editor.locator('form').first();
		const source = await save.locator('input[name=expected]').inputValue();
		scoreSource = source;
		const originalPoints = await save.getByLabel('Points per pair').inputValue();
		await save
			.getByLabel('Points per pair')
			.fill(originalPoints === '10000' ? '9999' : String(Number(originalPoints) + 1));
		await apply(save, 'Save scoring', 'CASE-GAME-SCORE');
		await expect(editor.locator('input[name=expected]').first()).not.toHaveValue(source);
		const changed = await editor.locator('input[name=expected]').first().inputValue();
		const rollback = editor.locator('form').nth(1);
		await rollback.getByLabel('Previous scoring version').selectOption(source);
		await apply(rollback, 'Restore selected version', 'CASE-GAME-ROLLBACK');
		await expect(editor.locator('input[name=expected]').first()).not.toHaveValue(changed);
		const restored = await editor.locator('input[name=expected]').first().inputValue();
		expect(restored).not.toBe(source);
		await expect(editor.getByLabel('Points per pair')).toHaveValue(originalPoints);
		const record = await proxy.env.DB.prepare(
			'SELECT parent, values_json FROM score_config WHERE version=?'
		)
			.bind(restored)
			.first<{ parent: string; values_json: string }>();
		const changedRecord = await proxy.env.DB.prepare(
			'SELECT values_json FROM score_config WHERE version=?'
		)
			.bind(changed)
			.first<{ values_json: string }>();
		expect(record?.parent).toBe(changed);
		expect(record?.values_json).not.toBe(changedRecord?.values_json);
		expect(
			await proxy.env.DB.prepare('SELECT id FROM completed_run WHERE id=?').bind(roundId).first()
		).toBeTruthy();
		scoreRestored = true;
	} finally {
		try {
			if (scoreSource && !scoreRestored) {
				const row = await proxy.env.DB.prepare(
					"SELECT version FROM score_live WHERE family='memory'"
				).first<{ version: string }>();
				const liveVersion = row?.version ?? 'brief-v1';
				if (liveVersion !== scoreSource) {
					const response = await context.request.post('/admin/games', {
						headers: { origin: 'http://localhost:5173' },
						form: {
							action: 'score-rollback',
							target: 'memory',
							expected: liveVersion,
							sourceVersion: scoreSource,
							reason: 'CASE-GAME-CLEANUP',
							confirm: 'yes'
						}
					});
					if (!response.ok()) cleanupFailures.push('Could not restore scoring after test');
				}
			}
		} finally {
			try {
				if (originalState?.state === 'enabled') {
					const current = await proxy.env.DB.prepare(
						"SELECT state FROM game_lifecycle WHERE family='memory'"
					).first<{ state: string }>();
					for (const action of current?.state === 'deleted'
						? ['game-restore', 'game-enable']
						: current?.state === 'disabled'
							? ['game-enable']
							: []) {
						const response = await context.request.post('/admin/games', {
							headers: { origin: 'http://localhost:5173' },
							form: { action, target: 'memory', reason: 'CASE-GAME-CLEANUP', confirm: 'yes' }
						});
						if (!response.ok()) cleanupFailures.push('Could not restore game after test');
					}
				}
				await proxy.env.DB.prepare('DELETE FROM completed_run WHERE id=?').bind(roundId).run();
			} finally {
				await proxy.dispose();
				await context.close();
			}
		}
	}
	expect(cleanupFailures).toEqual([]);
});

test('admin can inspect and manage a user and filter and export the audit', async ({ browser }) => {
	const operator = await fixture('admin');
	const target = await fixture(null);
	const roundId = crypto.randomUUID();
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		await proxy.env.DB.prepare(
			`INSERT INTO completed_run(id,user_id,family,engine_version,rules_group,score,moves,seconds,seed,move_log,payload_hash,ranked,created_at)
			 VALUES(?,?,'memory','1','fixture',1234,8,30,'1','[]',?,0,?)`
		)
			.bind(roundId, target.id, crypto.randomUUID(), Date.now())
			.run();
		await context.addCookies(operator.login.cookies);
		const page = await context.newPage();
		await page.goto('/admin/sign-in');
		await page.getByRole('textbox').fill(operator.code);
		await page.getByRole('button', { name: 'Verify and continue' }).click();
		await expect(page).toHaveURL(/\/admin\/dashboard$/);
		await page.goto('/admin/users');
		await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
		await expect(page.locator('.sidebar-group[open]')).toContainText('User directory');
		await expect(page.locator('main')).not.toContainText(target.email);
		await expect(page.getByText('Total users')).toBeVisible();
		await captureAdmin(page, 'users-overview');
		await page
			.getByRole('navigation', { name: 'Users section' })
			.getByRole('link', { name: 'User directory' })
			.click();
		await page.getByLabel('Search public name').fill(`p_${target.id.slice(0, 8)}`);
		await page.getByRole('button', { name: 'Apply filters' }).click();
		await expect(page.locator('main')).not.toContainText(target.email);
		await captureAdmin(page, 'users-directory');
		await page.getByRole('button', { name: 'View', exact: true }).first().click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByRole('dialog')).not.toContainText(target.email);
		await captureAdmin(page, 'users-drawer');
		await page.getByRole('button', { name: 'Close', exact: true }).click();
		await page.goto(`/admin/users?id=${encodeURIComponent(target.id)}`);
		await expect(page.locator('dl').filter({ hasText: 'Google name' })).toContainText(
			'Private operator fixture'
		);
		await expect(page.locator('dl').filter({ hasText: 'Email' })).toContainText(target.email);
		const savedStats = page.getByRole('row').filter({ hasText: 'fixture' });
		await expect(savedStats).toContainText('brief-v1');
		await expect(savedStats).toContainText('1234.0');
		await captureAdmin(page, 'users-detail-statistics');
		await page.getByRole('button', { name: 'Activity', exact: true }).click();
		await captureAdmin(page, 'users-detail-activity');
		await page.getByRole('button', { name: 'Statistics', exact: true }).click();
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			await expect(savedStats).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
				false
			);
		}

		await page.getByRole('button', { name: 'Saved rounds' }).click();
		await captureAdmin(page, 'users-detail-rounds');
		const score = page.locator('details').filter({ hasText: roundId });
		await score.locator('summary').click();
		await score.locator('input[name=reason]').fill('CASE-UI-HIDE');
		await score.locator('input[name=confirm]').check();
		await score.getByRole('button', { name: 'Hide score' }).click();
		await expect(score.locator('summary')).toContainText('Hidden');
		if (!(await score.evaluate((element) => (element as HTMLDetailsElement).open)))
			await score.locator('summary').click();
		await score.locator('input[name=reason]').fill('CASE-UI-RESTORE-SCORE');
		await score.locator('input[name=confirm]').check();
		await score.getByRole('button', { name: 'Restore score' }).click();
		await expect(score.locator('summary')).toContainText('Eligible');

		await page.getByRole('button', { name: 'Account actions' }).click();
		await captureAdmin(page, 'users-detail-actions');
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			await expect(page.getByRole('heading', { name: 'Ban player' })).toBeVisible();
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
			expect(overflow).toBe(false);
		}
		const ban = page
			.locator('section')
			.filter({ has: page.getByRole('heading', { name: 'Ban player' }) });
		await ban.locator('input[name=duration]').fill('3');
		await ban.locator('input[name=reason]').fill('CASE-UI-BAN');
		await ban.locator('input[name=confirm]').check();
		const before = Date.now();
		await ban.getByRole('button', { name: 'Apply action' }).click();
		await expect(page.getByRole('heading', { name: 'Unban player' })).toBeVisible();
		const banRow = await proxy.env.DB.prepare('SELECT expires_at FROM player_ban WHERE user_id=?')
			.bind(target.id)
			.first<{ expires_at: number }>();
		expect(banRow!.expires_at).toBeGreaterThanOrEqual(before + 3 * 86400000);
		expect(banRow!.expires_at).toBeLessThanOrEqual(Date.now() + 3 * 86400000);

		const deletion = page
			.locator('section')
			.filter({ has: page.getByRole('heading', { name: 'Delete account temporarily' }) });
		await deletion.locator('input[name=duration]').fill('5');
		await deletion.locator('input[name=reason]').fill('CASE-UI-DELETE');
		await deletion.locator('input[name=confirm]').check();
		await deletion.getByRole('button', { name: 'Apply action' }).click();
		await expect(page.getByRole('heading', { name: 'Restore account' })).toBeVisible();
		expect(
			await proxy.env.DB.prepare('SELECT user_id FROM user_lifecycle WHERE user_id=?')
				.bind(target.id)
				.first()
		).toBeTruthy();
		const restore = page
			.locator('section')
			.filter({ has: page.getByRole('heading', { name: 'Restore account' }) });
		await restore.locator('input[name=reason]').fill('CASE-UI-RESTORE');
		await restore.locator('input[name=confirm]').check();
		await restore.getByRole('button', { name: 'Apply action' }).click();
		await expect(page.getByRole('heading', { name: 'Delete account temporarily' })).toBeVisible();
		expect(
			await proxy.env.DB.prepare('SELECT user_id FROM user_lifecycle WHERE user_id=?')
				.bind(target.id)
				.first()
		).toBeNull();

		await page.goto('/admin/audit');
		await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
		await expect(page.locator('.sidebar-group[open]')).toContainText(
			'Open audit viewer and export'
		);
		await expect(page.getByText('Total audit entries')).toBeVisible();
		await captureAdmin(page, 'audit-overview');
		await page
			.getByRole('navigation', { name: 'Audit navigation' })
			.getByRole('link', { name: 'Open audit viewer and export' })
			.click();
		await expect(page.locator('input[name=actor]')).toBeVisible();
		await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
		await captureAdmin(page, 'audit-explorer');
		await page.locator('input[name=actor]').fill(operator.id);
		await page.locator('form[method=GET] input[name=audit_action]').fill('ban');
		await page.locator('form[method=GET] input[name=audit_target]').fill(target.id);
		const today = new Date().toISOString().slice(0, 10);
		await page.locator('input[name=from]').fill(today);
		await page.locator('input[name=to]').fill(today);
		await page.getByRole('button', { name: 'Filter audit' }).click();
		await expect(page).toHaveURL(/audit_action=ban/);
		await expect(page.locator('tbody')).toContainText('CASE-UI-BAN');
		await expect(page.locator('tbody')).not.toContainText('CASE-UI-DELETE');
		const archive = page.locator('section').filter({ has: page.locator('input[name=year]') });
		await archive.locator('input[name=year]').fill(today.slice(0, 4));
		await archive.locator('input[name=reason]').fill('CASE-UI-ARCHIVE');
		await archive.locator('input[name=confirm]').check();
		await archive.getByRole('button', { name: 'Export yearly archive' }).click();
		await expect(archive.getByRole('link', { name: 'Download archive page' })).toBeVisible();
		const exported = JSON.parse(await archive.locator('textarea').inputValue());
		expect(exported.rows.some((row: { reason: string }) => row.reason === 'CASE-UI-BAN')).toBe(
			true
		);
	} finally {
		await proxy.dispose();
		await context.close();
	}
});
