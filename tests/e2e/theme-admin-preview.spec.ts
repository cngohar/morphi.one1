import { expect, test, type Locator } from '@playwright/test';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { getPlatformProxy } from 'wrangler';
import { createAuth } from '../../src/lib/server/auth.js';
import { totp } from '../../src/lib/server/admin-totp.js';
import type { ThemeConfig } from '../../src/lib/engine/theme/config.js';
type LiveTheme = { liveVersion: string; version: string; values: ThemeConfig };

test.use({ baseURL: 'http://localhost:5173' });

async function apply(form: Locator, action: string, reason: string) {
	await form.locator('input[name=reason]').fill(reason);
	await form.locator('input[name=confirm]').check();
	await Promise.all([
		form
			.page()
			.waitForResponse(
				(response) =>
					response.request().method() === 'POST' && response.url().includes('/admin/themes')
			),
		form.locator(`button[value="${action}"]`).click()
	]);
	await expect(form).toHaveAttribute('aria-busy', 'false');
}

test('operator previews worker themes at three sizes, checks, publishes and rolls back without a redeploy', async ({
	browser
}, testInfo) => {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	const db = proxy.env.DB;
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	let userId: string | undefined;
	let original: LiveTheme | undefined;
	let restored = false;
	async function readLive(): Promise<LiveTheme> {
		const response = await context.request.get('/api/play/theme');
		expect(response.ok()).toBe(true);
		const snapshot: { version: string; values: ThemeConfig } = await response.json();
		const pointer = await db
			.prepare("SELECT version FROM config_live WHERE key='theme'")
			.first<{ version: string }>();
		return { liveVersion: pointer?.version ?? snapshot.version, ...snapshot };
	}
	async function restoreOriginal(current: LiveTheme, reason: string) {
		const response = await context.request.post('/admin/themes', {
			headers: { Origin: 'http://localhost:5173' },
			form: {
				action: 'theme-rollback',
				target: 'theme',
				expected: current.liveVersion,
				sourceVersion: original!.version,
				reason,
				confirm: 'yes'
			}
		});
		expect(response.ok()).toBe(true);
		const restoredSnapshot = await readLive();
		expect(restoredSnapshot.values).toEqual({
			...original!.values,
			version: restoredSnapshot.version
		});
	}
	try {
		const helpers = (
			await betterAuth({
				...createAuth(db, {
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
				name: 'Theme operator fixture'
			})
		);
		userId = user.id;
		const login = await helpers.login({ userId });
		const secret = new Uint8Array(20).fill(17);
		const iv = randomBytes(12);
		const cipher = createCipheriv(
			'aes-256-gcm',
			createHash('sha256').update(`operator-v1:${proxy.env.BETTER_AUTH_SECRET}`).digest(),
			iv
		);
		const data = Buffer.concat([cipher.update(secret), cipher.final(), cipher.getAuthTag()]);
		await db.batch([
			db.prepare("INSERT INTO admin_actor(id,role) VALUES(?,'admin')").bind(userId),
			db
				.prepare('INSERT INTO admin_web_operator(user_id,secret_cipher) VALUES(?,?)')
				.bind(userId, JSON.stringify({ iv: Array.from(iv), data: Array.from(data) }))
		]);
		const denied = await context.request.get('/admin/theme-preview?draft=unavailable', {
			maxRedirects: 0
		});
		expect(denied.status()).toBe(401);
		await context.addCookies(login.cookies);
		const noTotp = await context.request.get('/admin/theme-preview?draft=unavailable', {
			maxRedirects: 0
		});
		expect(noTotp.status()).toBe(401);
		const page = await context.newPage();
		await page.goto('/admin/sign-in');
		await page.getByRole('textbox').fill(totp(secret, Date.now()));
		await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/dashboard$/);
		await page.goto('/admin/themes');
		await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
		original = await readLive();
		const changed = structuredClone(original.values);
		changed.styles[0]!.radius = changed.styles[0]!.radius === 13 ? 14 : 13;
		const edit = page.locator('.theme-editor').first().locator('form');
		await edit.locator('textarea[name=values]').fill(JSON.stringify(changed));
		await apply(edit, 'theme-draft', 'CASE-PREVIEW-DRAFT');
		const previewLink = page
			.locator('.theme-editor a[href*="/admin/theme-preview?draft="]')
			.first();
		await expect(previewLink).toBeVisible();
		const href = await previewLink.getAttribute('href');
		const draftId = new URL(href!, 'http://localhost:5173').searchParams.get('draft')!;
		expect(await readLive()).toEqual(original);
		const preview = await context.newPage();
		const workers: string[] = [];
		const errors: string[] = [];
		preview.on('worker', (worker) => workers.push(worker.url()));
		preview.on('pageerror', (error) => errors.push(error.message));
		await preview.goto(href!);
		const sheet = preview.locator('.theme-preview');
		await expect(sheet).toHaveAttribute('data-ready', 'true');
		await expect(sheet).toHaveAttribute('data-theme-version', draftId);
		await expect(sheet.locator('[data-family]')).toHaveCount(3);
		expect(workers.some((url) => url.includes('theme-worker'))).toBe(true);
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await preview.setViewportSize(viewport);
			for (const family of ['memory', 'block', 'connect']) {
				const familyPreview = sheet.locator(`[data-family="${family}"]`);
				await expect(familyPreview).toBeVisible();
				expect(await familyPreview.locator('svg path').count()).toBeGreaterThan(0);
			}
			expect(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await preview.screenshot({
				path: testInfo.outputPath(`theme-preview-${viewport.width}x${viewport.height}.png`),
				fullPage: true
			});
		}
		expect(errors).toEqual([]);
		await preview.close();
		const draft = page
			.locator('.theme-editor')
			.filter({ has: page.locator(`input[name=target][value="${draftId}"]`) });
		await apply(draft.locator('form'), 'theme-check', 'CASE-PREVIEW-CHECK');
		await expect(
			page.getByRole('status').filter({ hasText: 'Palette and configuration checks passed.' })
		).toBeVisible();
		expect(await readLive()).toEqual(original);
		await apply(draft.locator('form'), 'theme-publish', 'CASE-PREVIEW-PUBLISH');
		await expect(page.locator('.theme-editor').first().locator('code')).toHaveText(draftId);
		expect((await readLive()).version).toBe(draftId);
		// Bypass the publishing gate to model a corrupt live palette after responsive preview.
		const brokenVersion = crypto.randomUUID();
		const broken = { ...structuredClone(changed), version: brokenVersion };
		for (const recipe of broken.recipes) {
			recipe.chroma = [0, 0];
			recipe.targets = [3.3, 3.4, 3.5];
		}
		await db.batch([
			db
				.prepare('INSERT INTO theme_config(version,parent,values_json,created_at) VALUES(?,?,?,?)')
				.bind(brokenVersion, draftId, JSON.stringify(broken), Date.now()),
			db.prepare("UPDATE config_live SET version=? WHERE key='theme'").bind(brokenVersion)
		]);
		const fallbackResponse = await context.request.get('/api/play/theme');
		expect(fallbackResponse.ok()).toBe(true);
		expect((await fallbackResponse.json()).version).toBe(draftId);
		await page.reload();
		await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
		expect((await readLive()).liveVersion).toBe(brokenVersion);
		const rollback = page
			.locator('.theme-editor')
			.filter({ has: page.locator('select[name=sourceVersion]') });
		await rollback.locator('select[name=sourceVersion]').selectOption(draftId);
		await apply(rollback.locator('form'), 'theme-rollback', 'CASE-PREVIEW-ROLLBACK');
		await expect(page.locator('.theme-editor').first().locator('code')).not.toHaveText(draftId);
		const live = await readLive();
		expect(live.version).not.toBe(brokenVersion);
		expect(live.values).toEqual({ ...changed, version: live.version });
		await restoreOriginal(live, 'CASE-PREVIEW-RESTORE-BASELINE');
		restored = true;
		const audit = await db
			.prepare('SELECT action FROM admin_audit WHERE actor=? ORDER BY rowid')
			.bind(userId)
			.all<{ action: string }>();
		expect(audit.results.map(({ action }) => action)).toEqual(
			expect.arrayContaining([
				'theme-draft',
				'theme-preview',
				'theme-check',
				'theme-publish',
				'theme-rollback'
			])
		);
	} finally {
		try {
			if (original && !restored && userId) {
				const current = await readLive();
				if (current.liveVersion !== original.liveVersion)
					await restoreOriginal(current, 'CASE-PREVIEW-CLEANUP');
			}
		} finally {
			try {
				if (userId)
					await db.batch([
						db.prepare('DELETE FROM admin_web_operator WHERE user_id=?').bind(userId),
						db.prepare('DELETE FROM admin_actor WHERE id=?').bind(userId),
						db.prepare('DELETE FROM user WHERE id=?').bind(userId)
					]);
			} finally {
				await context.close();
				await proxy.dispose();
			}
		}
	}
});
