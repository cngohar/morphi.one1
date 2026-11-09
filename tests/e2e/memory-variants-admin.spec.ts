import { expect, test, type Locator, type Page } from '@playwright/test';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { getPlatformProxy } from 'wrangler';
import { mkdir, writeFile } from 'node:fs/promises';
import { messages } from '../../src/lib/i18n/messages.js';
import { createAuth } from '../../src/lib/server/auth.js';
import { totp } from '../../src/lib/server/admin-totp.js';
import { variantAvailable } from '../../src/lib/server/games.js';

test.use({ baseURL: 'http://localhost:5173' });

async function apply(form: Locator, button: string, reason: string) {
	if (await form.locator('input[name=reason]').count())
		await form.locator('input[name=reason]').fill(reason);
	await form.locator('input[name=confirm]').check();
	await Promise.all([
		form
			.page()
			.waitForResponse(
				(response) =>
					response.request().method() === 'POST' && response.url().includes('/admin/games')
			),
		form.getByRole('button', { name: button, exact: true }).click()
	]);
	await expect(form).toHaveAttribute('aria-busy', 'false');
}

async function inspectDrawer(page: Page, row: Locator) {
	const trigger = row.getByRole('button', { name: 'Inspect', exact: true });
	const drawer = page.locator('dialog.variant-drawer');
	const close = drawer.getByRole('button', { name: 'Close variant details', exact: true });
	await trigger.click();
	await expect(drawer).toBeVisible();
	await expect(drawer).toHaveAccessibleName('Moving cards');
	await expect(drawer.locator('.drawer-kicker')).toHaveText('Memory');
	await expect(drawer.locator('.drawer-description')).toContainText(
		'After a mismatch, the still face-down unmatched cards shuffle.'
	);
	const bounds = await drawer.boundingBox();
	const viewport = page.viewportSize()!;
	expect(bounds).not.toBeNull();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.y).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
	expect(await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
	await page.screenshot({
		path: `build/v1.3.5.1/drawer-${viewport.width}x${viewport.height}.png`
	});
	for (const key of ['Tab', 'Shift+Tab']) {
		await close.focus();
		for (let i = 0; i < 6; i++) {
			await page.keyboard.press(key);
			await expect
				.poll(() => drawer.evaluate((node) => node.contains(document.activeElement)))
				.toBe(true);
		}
	}
	const rules = drawer.locator('.drawer-rules');
	await rules.scrollIntoViewIfNeeded();
	await expect(rules.getByRole('heading', { name: 'Rules group', exact: true })).toBeInViewport();
	if (viewport.height === 390)
		expect(await drawer.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
	const table = rules.locator('.table-wrap');
	await table.evaluate((node) => {
		node.scrollLeft = node.scrollWidth;
	});
	await expect(
		table.getByRole('columnheader', { name: 'Average duration (seconds)' })
	).toBeInViewport();
	if (viewport.height === 390)
		await page.screenshot({ path: 'build/v1.3.5.1/drawer-landscape-scrolled.png' });
	await drawer.evaluate((node) => {
		node.scrollTop = 0;
	});
	await page.mouse.click(bounds!.x + 8, bounds!.y + 8);
	await expect(drawer).toBeVisible();
	if (bounds!.x > 4) {
		await page.mouse.move(bounds!.x + 8, bounds!.y + 8);
		await page.mouse.down();
		await page.mouse.move(bounds!.x / 2, bounds!.y + 8);
		await page.mouse.up();
		await expect(drawer).toBeVisible();
	}
	await page.keyboard.press('Escape');
	await expect(drawer).not.toBeVisible();
	await expect(trigger).toBeFocused();
	await trigger.click();
	await close.click();
	await expect(drawer).not.toBeVisible();
	await expect(trigger).toBeFocused();
	if (bounds!.x > 4) {
		await trigger.click();
		await page.mouse.click(bounds!.x / 2, bounds!.y + 8);
		await expect(drawer).not.toBeVisible();
		await expect(trigger).toBeFocused();
	}
}

const legacyVariants = ['memory:classic', 'memory:no-preview', 'memory:trios'];
const memoryVariants = [
	'memory:classic',
	'memory:no-preview',
	'memory:trios',
	'memory:moving',
	'memory:budget',
	'memory:lockout',
	'memory:swaps',
	'memory:two-backs',
	'memory:quads',
	'memory:collapse'
];
const allMemoryVariants = [
	...memoryVariants,
	'memory:countdown',
	'memory:three-strikes',
	'memory:wild-card',
	'memory:sonar',
	'memory:zebra',
	'memory:drift',
	'memory:decay',
	'memory:one-flip',
	'memory:combo',
	'memory:hazard',
	'memory:superstorm',
	'memory:sentinel-heat',
	'memory:glyph-chain',
	'memory:analysis-visor',
	'memory:life-support',
	'memory:hyperdrive-warp',
	'memory:gravitino-risk',
	'memory:pulse-drive',
	'memory:derelict-fog',
	'memory:atlas-terminal',
	'memory:edge-cache',
	'memory:quantum-entangle',
	'memory:rate-limiter',
	'memory:register-buffer',
	'memory:firewall-ice',
	'memory:anycast-route',
	'memory:tls-handshake',
	'memory:trace-route',
	'memory:bit-rot',
	'memory:burst-transmission',
	'memory:kv-consistency',
	'memory:durable-object',
	'memory:vectorize-knn',
	'memory:fifo-queue',
	'memory:ai-tokens',
	'memory:hyperdrive-pool',
	'memory:turnstile-verify',
	'memory:zero-trust',
	'memory:argo-reroute',
	'memory:r2-glacier',
	'memory:cross-pollination',
	'memory:mycelium-network',
	'memory:photosynthesis',
	'memory:seed-dispersal',
	'memory:seasonal-bloom',
	'memory:bee-waggle',
	'memory:carnivorous-briar',
	'memory:chlorophyll-meter',
	'memory:bioluminescent',
	'memory:botanical-graft',
	'memory:workflows-step',
	'memory:browser-rendering',
	'memory:ai-gateway',
	'memory:k2-streams',
	'memory:basin-catalog',
	'memory:edge-snippets',
	'memory:images-transform',
	'memory:waiting-room',
	'memory:privacy-pass',
	'memory:agents-sdk',
	'memory:time-strata',
	'memory:strata-linked',
	'memory:strata-sweep',
	'memory:strata-shelf',
	'memory:strata-cycle',
	'memory:strata-empty-well',
	'memory:strata-glimpse',
	'memory:strata-chain',
	'memory:strata-echo',
	'memory:strata-slip',
	'memory:strata-order'
];

test('closeout Directory retains late preset cohorts and reports bounded score history across three viewports', async ({
	browser
}) => {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	const db = proxy.env.DB;
	const context = await browser.newContext({
		baseURL: 'http://localhost:5173',
		reducedMotion: 'reduce'
	});
	let userId: string | undefined;
	const target = {
		id: 'memory:strata-order',
		leaderboardGroups: [
			'memory-1:strata-order:6',
			'memory-1:strata-order:8',
			'memory-1:strata-order:10'
		]
	};
	const prefix = `closeout-${crypto.randomUUID()}`;
	const samples: unknown[] = [];
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
			helpers.createUser({ email: `${prefix}@example.test`, name: 'Closeout directory operator' })
		);
		userId = user.id;
		await context.addCookies((await helpers.login({ userId })).cookies);
		const secret = new Uint8Array(20).fill(29),
			iv = randomBytes(12);
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
		const insert = (group: string, version: string) =>
			db
				.prepare(
					`INSERT INTO completed_run(id,user_id,family,engine_version,rules_group,score,moves,seconds,seed,move_log,payload_hash,ranked,hidden,created_at,score_config_version)
			VALUES(?,?,'memory','memory-1',?,1234,2,10,'42','[]',?,0,0,?,?)`
				)
				.bind(crypto.randomUUID(), userId, group, crypto.randomUUID(), Date.now(), version);
		await db.batch([
			...Array.from({ length: 102 }, (_, index) =>
				insert('memory-1:6', `${prefix}-earlier-${index.toString().padStart(3, '0')}`)
			),
			...target.leaderboardGroups.map((group) => insert(group, `${prefix}-selected`))
		]);
		const page = await context.newPage();
		await page.goto('/admin/sign-in');
		await page.getByRole('textbox').fill(totp(secret, Date.now()));
		await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/dashboard$/);
		await mkdir('build/v1.3.5.17/browser', { recursive: true });
		for (const overflow of [false, true]) {
			if (overflow)
				await db.batch(
					Array.from({ length: 102 }, (_, index) =>
						insert(
							[...target.leaderboardGroups].sort()[0],
							`${prefix}-overflow-${index.toString().padStart(3, '0')}`
						)
					)
				);
			for (const viewport of [
				{ width: 390, height: 844 },
				{ width: 844, height: 390 },
				{ width: 1280, height: 800 }
			]) {
				await page.setViewportSize(viewport);
				await page.goto(
					`/admin/games?game=memory&subview=directory&q=${encodeURIComponent(target.id)}`
				);
				await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
				const trigger = page
					.locator(`.variant-row[data-id="${target.id}"]`)
					.getByRole('button', { name: 'Inspect', exact: true });
				await trigger.click();
				const drawer = page.locator('dialog.drawer');
				await expect(drawer).toBeVisible();
				await expect(drawer.locator('#drawer-title')).toHaveText('Excavation Order');
				const selectedRows = drawer.locator('.drawer-table tbody tr');
				if (overflow) {
					await expect(selectedRows).toHaveCount(100);
					await expect(drawer.getByText(messages['v1.admin.games.limited'])).toBeVisible();
				} else {
					for (const group of target.leaderboardGroups)
						await expect(
							selectedRows.filter({ hasText: group }).filter({ hasText: `${prefix}-selected` })
						).toHaveCount(1);
				}
				const displayedGroups = await selectedRows.locator('td:first-child').allTextContents();
				expect(displayedGroups.every((group) => target.leaderboardGroups.includes(group))).toBe(
					true
				);
				await expect(drawer).not.toContainText(`${prefix}-earlier-`);
				const scoringLink = drawer.getByRole('link', { name: /Scoring Editor/i });
				await scoringLink.scrollIntoViewIfNeeded();
				await expect(scoringLink).toBeInViewport();
				expect(await scoringLink.getAttribute('href')).toContain('game=memory&subview=scoring');
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
				expect(await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
				const bounds = await drawer.boundingBox();
				expect(bounds).not.toBeNull();
				expect(bounds!.x).toBeGreaterThanOrEqual(0);
				expect(bounds!.y).toBeGreaterThanOrEqual(0);
				expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
				expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
				await page.screenshot({
					path: `build/v1.3.5.17/browser/directory-${overflow ? 'overflow' : 'late'}-${viewport.width}x${viewport.height}.png`
				});
				samples.push({ viewport, overflow, bounds, displayedRows: displayedGroups.length });
				await page.keyboard.press('Escape');
				await expect(drawer).not.toBeVisible();
				await expect(trigger).toBeFocused();
			}
		}
		await writeFile(
			'build/v1.3.5.17/browser/directory-bounds.json',
			JSON.stringify(samples, null, 2)
		);
	} finally {
		if (userId)
			await db.batch([
				db.prepare('DELETE FROM completed_run WHERE user_id=?').bind(userId),
				db.prepare('DELETE FROM admin_web_operator WHERE user_id=?').bind(userId),
				db.prepare('DELETE FROM admin_actor WHERE id=?').bind(userId),
				db.prepare('DELETE FROM user WHERE id=?').bind(userId)
			]);
		await context.close();
		await proxy.dispose();
	}
});

test('Memory games detail gates test play, edits independent scores, and plays disabled variants without recording rounds', async ({
	browser
}) => {
	test.setTimeout(300_000);
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	const db = proxy.env.DB;
	const context = await browser.newContext({
		baseURL: 'http://localhost:5173',
		reducedMotion: 'reduce'
	});
	let userId: string | undefined;
	const originalLifecycle = (
		await db
			.prepare("SELECT variant,state,reason FROM variant_lifecycle WHERE family='memory'")
			.all<{ variant: string; state: string; reason: string }>()
	).results;
	const originalScores: { scope: string; variant?: string; version: string }[] = [];
	const originalBlockLifecycle = (
		await db
			.prepare("SELECT variant,state,reason FROM variant_lifecycle WHERE family='block'")
			.all<{ variant: string; state: string; reason: string }>()
	).results;
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
				name: 'Memory variant operator fixture'
			})
		);
		userId = user.id;
		const login = await helpers.login({ userId });
		for (const family of ['memory', 'block'])
			expect(
				(await context.request.get(`/admin/games?game=${family}`, { maxRedirects: 0 })).status()
			).toBe(303);
		await context.addCookies(login.cookies);
		for (const family of ['memory', 'block'])
			expect(
				(await context.request.get(`/admin/games?game=${family}`, { maxRedirects: 0 })).status()
			).toBe(403);
		const secret = new Uint8Array(20).fill(19),
			iv = randomBytes(12);
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
		const page = await context.newPage();
		await page.goto('/admin/sign-in');
		await page.getByRole('textbox').fill(totp(secret, Date.now()));
		await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/dashboard$/);
		await page.goto('/admin/games?game=memory');
		await expect(page.getByRole('switch', { name: 'Game enabled' })).toBeVisible();
		await page
			.getByRole('navigation', { name: 'Game sections' })
			.getByRole('link', { name: 'Settings' })
			.click();
		await expect(page.getByRole('switch', { name: 'Game enabled' })).toBeVisible();
		await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
		await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
		await expect(
			page.getByText('Registered users only; guest solo starts are not counted.', { exact: true })
		).toBeVisible();
		await expect(page.locator('.scoring-card')).toHaveCount(0);
		await expect(page.locator('.variant-row')).toHaveCount(memoryVariants.length);
		const moving = page.locator('.variant-row[data-variant="memory:moving"]');
		await expect(moving.getByText('Total completed', { exact: true })).toBeVisible();
		await moving.getByRole('button', { name: 'Inspect' }).click();
		const drawer = page.locator('dialog.variant-drawer');
		await expect(drawer).toBeVisible();
		for (const label of [
			'Shown',
			'Ignored (zero flips)',
			'Played',
			'Abandoned',
			'Finished',
			'Still open / unknown exit'
		])
			await expect(drawer.getByText(label, { exact: true })).toBeVisible();
		await expect(drawer).toContainText('Imported guest completions');
		await page.keyboard.press('Escape');
		await expect(drawer).not.toBeVisible();
		const movingState = await moving.locator('input[name=action]').inputValue();
		for (const [path, variant] of [
			['/admin/games?game=memory', 'memory:unknown'],
			['/admin/users', 'memory:moving']
		] as const) {
			const rejected = await context.request.post(path, {
				headers: { Origin: 'http://localhost:5173' },
				form: {
					action: 'variant-disable',
					target: 'memory',
					variant,
					reason: 'CASE-EXTRACTION-REJECT',
					confirm: 'yes'
				}
			});
			expect(rejected.status()).toBe(400);
		}
		if (movingState === 'variant-enable') {
			await expect(moving.locator('input[name=reason]')).toHaveCount(0);
			await apply(moving.locator('form'), 'Enable variant', 'CASE-VARIANT-ENABLE');
		}
		await apply(moving.locator('form'), 'Disable variant', 'CASE-VARIANT-DISABLE');
		await expect(moving.locator('.status-pill')).toContainText('Disabled');
		await apply(moving.locator('form'), 'Enable variant', 'CASE-VARIANT-REENABLE');
		await expect(moving.locator('.status-pill')).toContainText('Enabled');
		await apply(moving.locator('form'), 'Disable variant', 'CASE-VARIANT-DISABLE-AGAIN');
		// Non-legacy variants are disabled directly: 60 operator requests per minute cannot
		// cover a click-through of every row. Their lifecycle is restored in `finally`.
		for (const id of allMemoryVariants) {
			if (!legacyVariants.includes(id) && id !== 'memory:moving') {
				await db
					.prepare(
						"INSERT INTO variant_lifecycle(family,variant,state,reason) VALUES('memory',?,'disabled','CASE-ALL-VARIANTS-DISABLED') ON CONFLICT(family,variant) DO UPDATE SET state='disabled'"
					)
					.bind(id)
					.run();
			}
		}
		for (const id of legacyVariants) {
			const row = page.locator(`.variant-row[data-variant="${id}"]`);
			if ((await row.locator('input[name=action]').inputValue()) === 'variant-disable')
				await apply(row.locator('form'), 'Disable variant', 'CASE-ALL-VARIANTS-DISABLED');
		}
		expect(
			(await (await context.request.get('/api/play/availability')).json()).available
		).not.toContain('memory');
		expect(
			(await (await context.request.get('/api/play/availability?family=memory')).json()).available
		).toBe(false);
		for (const id of legacyVariants) {
			const row = page.locator(`.variant-row[data-variant="${id}"]`);
			await apply(row.locator('form'), 'Enable variant', 'CASE-RESTORE-VARIANT');
		}
		expect(
			await db
				.prepare(
					"SELECT id FROM admin_audit WHERE actor=? AND action='variant-enable' AND target='memory:moving' AND reason='Resumed by operator (no reason entered)'"
				)
				.bind(userId)
				.first()
		).toBeTruthy();

		expect(
			await db
				.prepare(
					"SELECT id FROM admin_audit WHERE actor=? AND action='variant-disable' AND target='memory:moving' AND reason='CASE-VARIANT-DISABLE'"
				)
				.bind(userId)
				.first()
		).toBeTruthy();
		const beforeScores = (
			await db
				.prepare(
					"SELECT id,score,score_config_version FROM completed_run WHERE family='memory' ORDER BY id"
				)
				.all()
		).results;
		const beforeScoreIds = new Set(beforeScores.map((row) => row.id));
		await page
			.getByRole('navigation', { name: 'Game sections' })
			.getByRole('link', { name: 'Scoring' })
			.click();
		const editors = page.locator('.scoring-card');
		await expect(editors).toHaveCount(3);
		await expect(editors.first()).toContainText(
			'Edits affect Classic, No preview, Moving cards, Tight Budget, Lockout, Marked Swaps, Two Backs, Collapse'
		);
		for (const [index, variant, field, scope] of [
			[0, undefined, 'Points per pair', 'memory'],
			[1, 'memory:trios', 'Points per trio', 'memory:trios'],
			[2, 'memory:quads', 'Points per quad', 'memory:quads']
		] as const) {
			const editor = editors.nth(index),
				save = editor.locator('form').first();
			const source = await save.locator('input[name=expected]').inputValue();
			originalScores.push({ scope, variant, version: source });
			const initial = Number(await save.getByLabel(field).inputValue());
			await save.getByLabel(field).fill(String(initial === 10000 ? 9999 : initial + 1));
			await apply(save, 'Save scoring', `CASE-VARIANT-SCORE-${index}`);
			const live = await editor.locator('input[name=expected]').first().inputValue();
			expect(live).not.toBe(source);
			const conflict = await context.request.post('/admin/games?game=memory', {
				headers: { Origin: 'http://localhost:5173' },
				form: {
					action: 'score-defaults',
					target: 'memory',
					...(variant ? { variant } : {}),
					expected: source,
					reason: 'CASE-VARIANT-CONFLICT',
					confirm: 'yes'
				}
			});
			expect(conflict.status()).toBe(409);
			const rollback = editor.locator('form').nth(1);
			await rollback.getByLabel('Previous scoring version').selectOption(source);
			await apply(rollback, 'Restore selected version', `CASE-VARIANT-ROLLBACK-${index}`);
			await expect(editor.getByLabel(field)).toHaveValue(String(initial));
			const restored = await editor.locator('input[name=expected]').first().inputValue();
			expect(restored).not.toBe(source);
			expect(restored).not.toBe(live);
		}
		expect(
			(
				await db
					.prepare(
						"SELECT id,score,score_config_version FROM completed_run WHERE family='memory' ORDER BY id"
					)
					.all()
			).results.filter((row) => beforeScoreIds.has(row.id))
		).toEqual(beforeScores);
		const counts = async () =>
			await db
				.prepare(
					"SELECT (SELECT count(*) FROM completed_run WHERE family='memory' AND user_id=?) completed,(SELECT count(*) FROM play_session WHERE family='memory' AND user_id=?) sessions,(SELECT count(*) FROM account_round_activity WHERE family='memory' AND user_id=?) activity"
				)
				.bind(userId, userId, userId)
				.first();
		const beforeCounts = await counts();
		const testPlay = page.locator('.admin-test');
		const playerWrites: string[] = [];
		page.on('request', (request) => {
			if (request.method() === 'POST' && /\/api\/(play|progress)/.test(request.url()))
				playerWrites.push(request.url());
		});
		for (const variant of memoryVariants) {
			await testPlay.getByRole('combobox', { name: 'Variant', exact: true }).selectOption(variant);
			await testPlay.getByRole('button', { name: /^(Start test round|Next test round)$/ }).click();
			await expect(testPlay.locator('.game')).toHaveAttribute('data-phase', 'playing', {
				timeout: 12000
			});
			await expect(testPlay.locator('.test-banner')).toContainText('Admin test · Memory');
			const size = { 'memory:trios': 3, 'memory:quads': 4 }[variant] ?? 2;
			const open = testPlay.locator('.memory-card:not(.is-matched)');
			const symbolsOf = () =>
				open.evaluateAll((cards) =>
					cards.map((card) => card.querySelector('.card-front')!.innerHTML)
				);
			const first = await symbolsOf();
			expect(first.filter((symbol) => symbol === first[0])).toHaveLength(size);
			// Live solve: collapse removes matched cards, so positions are re-read after every group.
			while ((await testPlay.getByText(/^Test score:/).count()) === 0 && (await open.count()) > 0) {
				const deck = await symbolsOf();
				for (const [index, symbol] of deck.entries())
					if (symbol === deck[0]) await open.nth(index).click();
				await page.waitForTimeout(60);
			}
			await expect(testPlay.getByText(/^Test score:/)).toBeVisible({ timeout: 12000 });
			await expect(testPlay.getByRole('alert')).toHaveCount(0);
		}
		await testPlay
			.getByRole('combobox', { name: 'Variant', exact: true })
			.selectOption('memory:time-strata');
		await testPlay.getByRole('button', { name: 'Next test round', exact: true }).click();
		await expect(testPlay.locator('.game')).toHaveAttribute('data-phase', 'playing');
		for (
			let attempt = 0;
			attempt < 10 && !(await testPlay.getByText(/^Test score:/).count());
			attempt++
		) {
			const tops = await testPlay
				.locator('.strata-top')
				.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-card-index')!));
			const seen = new Map<string, string>();
			for (const index of tops) {
				const top = testPlay.locator(`[data-card-index="${index}"]`);
				await top.click();
				seen.set(index, (await top.locator('.face-name').textContent())!);
				await testPlay.getByRole('button', { name: 'Cancel selection', exact: true }).click();
			}
			const first = tops.find((index) =>
				tops.some((other) => index !== other && seen.get(index) === seen.get(other))
			)!;
			const second = tops.find((index) => index !== first && seen.get(index) === seen.get(first))!;
			expect(first).toBeDefined();
			await testPlay.locator(`[data-card-index="${first}"]`).click();
			await testPlay.locator(`[data-card-index="${second}"]`).click();
			await testPlay.getByRole('button', { name: 'Continue', exact: true }).click();
			if ((await testPlay.locator('.strata-top').count()) === 0)
				await expect(testPlay.getByText(/^Test score:/)).toBeVisible({ timeout: 12000 });
		}
		await expect(testPlay.getByText(/^Test score:/)).toBeVisible();
		await testPlay
			.getByRole('combobox', { name: 'Variant', exact: true })
			.selectOption('memory:strata-shelf');
		await testPlay.getByRole('button', { name: 'Next test round', exact: true }).click();
		await expect(testPlay.locator('.game')).toHaveAttribute('data-phase', 'playing');
		await testPlay.locator('[data-strata-utility="lift"]').click();
		await expect(testPlay.locator('[data-strata-shelf]')).toBeVisible();
		await testPlay.locator('[data-strata-utility="return"]').click();
		await expect(testPlay.locator('[data-strata-shelf]')).toHaveCount(0);
		await expect(testPlay.getByRole('alert')).toHaveCount(0);
		expect(playerWrites).toEqual([]);
		expect(await counts()).toEqual(beforeCounts);
		// Block uses the same protected test harness even when its rush variant is disabled.
		await page.goto('/admin/games?game=block&subview=scoring');
		await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
		await expect(page.locator('.scoring-card')).toContainText(
			'Shared with Block Classic, 10 x 10 board, Rows only and 60-second rush. A change applies to future rounds only.'
		);
		await page
			.getByRole('navigation', { name: 'Game sections' })
			.getByRole('link', { name: 'Settings' })
			.click();
		await expect(page).toHaveURL(/subview=settings/);
		const rush = page.locator('.variant-row[data-variant="block:rush-60"]');
		if ((await rush.locator('input[name=action]').inputValue()) === 'variant-disable')
			await apply(rush.locator('form'), 'Disable variant', 'CASE-BLOCK-TEST-DISABLED');
		await expect(rush.locator('.status-pill')).toContainText('Disabled');
		const blockCounts = async () =>
			await db
				.prepare(
					"SELECT (SELECT count(*) FROM completed_run WHERE family='block' AND user_id=?) completed,(SELECT count(*) FROM play_session WHERE family='block' AND user_id=?) sessions,(SELECT count(*) FROM account_round_activity WHERE family='block' AND user_id=?) activity,(SELECT count(*) FROM variant_lifecycle WHERE family='block') variants"
				)
				.bind(userId, userId, userId)
				.first();
		const beforeBlock = await blockCounts();
		playerWrites.length = 0;
		await page.clock.install();
		await testPlay
			.getByRole('combobox', { name: 'Variant', exact: true })
			.selectOption('block:rush-60');
		await testPlay.getByRole('button', { name: /^(Start test round|Next test round)$/ }).click();
		await expect(testPlay.locator('.game')).toHaveAttribute('data-family', 'block');
		await expect(testPlay.locator('.game')).not.toHaveAttribute('data-variant');
		await expect(testPlay.locator('.game')).toHaveAttribute('data-phase', 'playing');
		await testPlay.locator('.tray-slot:not(.is-empty)').first().click();
		await testPlay.locator('[role=gridcell]').first().click();
		await page.clock.fastForward(61000);
		await expect(testPlay.getByText(/^Test score:/)).toBeVisible();
		await expect(testPlay.getByRole('alert')).toHaveCount(0);
		expect(playerWrites).toEqual([]);
		expect(await blockCounts()).toEqual(beforeBlock);
		await page.goto('/admin/games?game=memory&subview=settings');
		await page.reload();
		await expect(moving.locator('.status-pill')).toContainText('Disabled');
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			for (const [state, query] of [
				['overview', ''],
				['statistics', '?game=memory'],
				['scoring', '?game=memory&subview=scoring'],
				['settings', '?game=memory&subview=settings']
			]) {
				await page.goto(`/admin/games${query}`);
				await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
				await expect(page.getByRole('alert')).toHaveCount(0);
				await expect(page.locator('.scoring-card')).toHaveCount(state === 'scoring' ? 3 : 0);
				expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
					false
				);
				await page.screenshot({
					path: `build/v1.3.5.1/games-${state}-${viewport.width}x${viewport.height}.png`,
					fullPage: true
				});
			}
			await inspectDrawer(page, moving);
		}
		await page.locator('dialog.variant-drawer').evaluate((node: HTMLDialogElement) => {
			node.showModal = () => {
				throw new Error('CASE-DIALOG-OPEN');
			};
		});
		await moving.getByRole('button', { name: 'Inspect', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('We couldn’t load this data. Try again.');
		await page.locator('dialog.variant-drawer').evaluate((node: HTMLDialogElement) => {
			delete (node as Partial<HTMLDialogElement>).showModal;
		});
		await moving.getByRole('button', { name: 'Inspect', exact: true }).click();
		await expect(drawer).toBeVisible();
		await expect(page.getByRole('alert')).toHaveCount(0);
		await page.keyboard.press('Escape');
	} finally {
		await db.prepare("DELETE FROM variant_lifecycle WHERE family='block'").run();
		for (const row of originalBlockLifecycle)
			await db
				.prepare("INSERT INTO variant_lifecycle(family,variant,state,reason) VALUES('block',?,?,?)")
				.bind(row.variant, row.state, row.reason)
				.run();
		for (const score of originalScores) {
			const live = await db
				.prepare('SELECT version FROM score_live WHERE family=?')
				.bind(score.scope)
				.first<{ version: string }>();
			if (live && live.version !== score.version && userId) {
				const response = await context.request.post('/admin/games?game=memory', {
					headers: { Origin: 'http://localhost:5173' },
					timeout: 10_000,
					form: {
						action: 'score-rollback',
						target: 'memory',
						expected: live.version,
						sourceVersion: score.version,
						reason: 'CASE-VARIANT-CLEANUP',
						confirm: 'yes',
						...(score.variant ? { variant: score.variant } : {})
					}
				});
				expect(response.ok()).toBe(true);
			}
		}
		await db.prepare("DELETE FROM variant_lifecycle WHERE family='memory'").run();
		for (const row of originalLifecycle)
			await db
				.prepare(
					"INSERT INTO variant_lifecycle(family,variant,state,reason) VALUES('memory',?,?,?)"
				)
				.bind(row.variant, row.state, row.reason)
				.run();
		if (userId)
			await db.batch([
				db.prepare('DELETE FROM admin_web_operator WHERE user_id=?').bind(userId),
				db.prepare('DELETE FROM admin_actor WHERE id=?').bind(userId),
				db.prepare('DELETE FROM user WHERE id=?').bind(userId)
			]);
		await context.close();
		await proxy.dispose();
	}
});

test('dimension policy editor previews and saves only supported Memory values', async ({
	browser
}) => {
	test.setTimeout(120_000);
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	const db = proxy.env.DB;
	const original = await db
		.prepare("SELECT version FROM config_live WHERE key='game:memory'")
		.first<{ version: string }>();
	const lifecycle = (
		await db
			.prepare("SELECT variant,state,reason FROM variant_lifecycle WHERE family='memory'")
			.all<{ variant: string; state: string; reason: string }>()
	).results;
	const context = await browser.newContext({
		baseURL: 'http://localhost:5173',
		reducedMotion: 'reduce'
	});
	let userId: string | undefined;
	try {
		await db.batch([
			db.prepare("DELETE FROM config_live WHERE key='game:memory'"),
			db.prepare("DELETE FROM variant_lifecycle WHERE family='memory'")
		]);
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
				name: 'Memory policy operator'
			})
		);
		userId = user.id;
		const login = await helpers.login({ userId });
		await context.addCookies(login.cookies);
		const secret = new Uint8Array(20).fill(23),
			iv = randomBytes(12);
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
		const page = await context.newPage();
		await page.goto('/admin/sign-in');
		await page.getByRole('textbox').fill(totp(secret, Date.now()));
		await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/dashboard$/);
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			await page.goto('/admin/games?game=memory&subview=policy');
			await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
			await expect(page.getByRole('heading', { name: 'Supported dimensions' })).toBeVisible();
			await expect(page.getByText('81 of 81 variants eligible')).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
				false
			);
			await page.screenshot({
				path: `build/v1.3.5.6/real-policy-${viewport.width}x${viewport.height}.png`,
				fullPage: true
			});
		}

		const linked = page.getByRole('checkbox', { name: 'Linked tops', exact: true });
		await linked.uncheck();
		await expect(page.getByText('80 of 81 variants eligible')).toBeVisible();
		await page.getByRole('button', { name: 'Review policy change' }).click();
		await expect(page.getByRole('dialog', { name: 'Review policy change' })).toContainText(
			'memory:strata-linked'
		);
		await page.keyboard.press('Escape');
		await linked.check();
		const topOnly = page.getByRole('checkbox', { name: 'Top cards only', exact: true });
		await topOnly.uncheck();
		await expect(page.getByText('74 of 81 variants eligible')).toBeVisible();
		await page.getByRole('button', { name: 'Review policy change' }).click();
		await expect(page.getByRole('dialog', { name: 'Review policy change' })).toContainText(
			'memory:time-strata'
		);
		await page.keyboard.press('Escape');
		await topOnly.check();
		await expect(page.getByText('81 of 81 variants eligible')).toBeVisible();
		await page
			.getByRole('group', { name: 'Match size' })
			.getByRole('checkbox', { name: 'Quads' })
			.uncheck();
		await expect(page.getByText('80 of 81 variants eligible')).toBeVisible();
		await page.getByRole('button', { name: 'Review policy change' }).click();
		const dialog = page.getByRole('dialog', { name: 'Review policy change' });
		await expect(dialog.getByText('memory:quads')).toBeVisible();
		await dialog.getByRole('textbox', { name: /Reason/ }).fill('Disable Quads for policy review');
		await dialog.getByRole('checkbox', { name: 'I have checked the affected presets' }).check();
		const [saved] = await Promise.all([
			page.waitForResponse(
				(response) =>
					response.request().method() === 'POST' && response.url().includes('/admin/games')
			),
			dialog.getByRole('button', { name: 'Apply policy' }).click()
		]);
		expect(saved.status()).toBe(200);
		await expect(dialog).not.toBeVisible();
		await expect(page.getByText('80 of 81 variants eligible')).toBeVisible();
		expect(await variantAvailable(db, 'memory', 'memory:quads')).toBe(false);
		const rejectedVariant = await context.request.get(
			'/api/play/availability?family=memory&variant=memory:quads'
		);
		expect(rejectedVariant.status()).toBe(400);
		const available = await context.request.get('/api/play/availability?family=memory');
		expect(available.status()).toBe(200);
		const familyAvailability = await available.json();
		expect(familyAvailability.available).toBe(true);
		expect(familyAvailability).not.toHaveProperty('variants');
		const stale = await context.request.post('/admin/games?game=memory&subview=policy', {
			headers: { Origin: 'http://localhost:5173' },
			form: {
				action: 'dimension-policy-update',
				target: 'memory',
				expected: original?.version ?? 'catalog-v1',
				values: await page.locator('input[name=values]').inputValue(),
				reason: 'Stale change',
				confirm: 'yes'
			}
		});
		expect(stale.status()).toBe(409);
		await page
			.getByRole('group', { name: 'Match size' })
			.getByRole('checkbox', { name: 'Pairs' })
			.uncheck();
		await page
			.getByRole('group', { name: 'Match size' })
			.getByRole('checkbox', { name: 'Trios' })
			.uncheck();
		await expect(page.getByText(/No playable Memory variants remain/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Review policy change' })).toBeDisabled();
	} finally {
		if (original)
			await db
				.prepare("UPDATE config_live SET version=? WHERE key='game:memory'")
				.bind(original.version)
				.run();
		else await db.prepare("DELETE FROM config_live WHERE key='game:memory'").run();
		await db.prepare("DELETE FROM variant_lifecycle WHERE family='memory'").run();
		for (const row of lifecycle)
			await db
				.prepare(
					"INSERT INTO variant_lifecycle(family,variant,state,reason) VALUES('memory',?,?,?)"
				)
				.bind(row.variant, row.state, row.reason)
				.run();
		if (userId)
			await db.batch([
				db.prepare('DELETE FROM admin_web_operator WHERE user_id=?').bind(userId),
				db.prepare('DELETE FROM admin_actor WHERE id=?').bind(userId),
				db.prepare('DELETE FROM user WHERE id=?').bind(userId)
			]);
		await context.close();
		await proxy.dispose();
	}
});

test('memory directory tab filters variants, inspects dimensions breakdown, and pages deterministically across viewports', async ({
	browser
}) => {
	test.setTimeout(120_000);
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	const db = proxy.env.DB;
	const original = await db
		.prepare("SELECT version FROM config_live WHERE key='game:memory'")
		.first<{ version: string }>();
	const lifecycle = (
		await db
			.prepare("SELECT variant,state,reason FROM variant_lifecycle WHERE family='memory'")
			.all<{ variant: string; state: string; reason: string }>()
	).results;
	const context = await browser.newContext({
		baseURL: 'http://localhost:5173',
		reducedMotion: 'reduce'
	});
	let userId: string | undefined;
	try {
		await db.batch([
			db.prepare("DELETE FROM config_live WHERE key='game:memory'"),
			db.prepare("DELETE FROM variant_lifecycle WHERE family='memory'")
		]);
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
				name: 'Memory directory operator'
			})
		);
		userId = user.id;
		const login = await helpers.login({ userId });
		await context.addCookies(login.cookies);
		const secret = new Uint8Array(20).fill(23),
			iv = randomBytes(12);
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
		const page = await context.newPage();
		await page.goto('/admin/sign-in');
		await page.getByRole('textbox').fill(totp(secret, Date.now()));
		await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/dashboard$/);
		// Test responsive rendering and zero horizontal scroll across three required viewports
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			await page.goto('/admin/games?game=memory&subview=directory');
			await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
			await expect(page.getByRole('link', { name: 'Directory' })).toHaveClass(/active/);
			await expect(page.locator('.directory-container')).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
				false
			);
			await page.screenshot({
				path: `build/v1.3.5.7/real-directory-${viewport.width}x${viewport.height}.png`,
				fullPage: true
			});
		}

		// Filter and drawer interaction on desktop
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/admin/games?game=memory&subview=directory');
		await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
		await expect(page.locator('.variant-row')).toHaveCount(10);

		// Search filter: 'quads'
		await page.locator('input[name="q"]').fill('quads');
		await page.locator('form.filter-bar button[type="submit"]').click();
		await page.waitForURL((url) => url.searchParams.get('q') === 'quads');
		await expect(page.locator('.operator-shell')).toHaveAttribute('data-ready', 'true');
		await expect(page.locator('.variant-row')).toHaveCount(1);
		await expect(page.locator('.variant-row[data-id="memory:quads"]')).toBeVisible();

		// Inspect drawer
		const quadsRow = page.locator('.variant-row[data-id="memory:quads"]');
		await quadsRow.getByRole('button', { name: 'Inspect' }).click();
		const drawer = page.locator('dialog.drawer');
		await expect(drawer).toBeVisible();
		await expect(drawer.locator('#drawer-title')).toContainText('Quads');
		await expect(drawer.locator('.dim-grid')).toBeVisible();
		const scoringLink = drawer.getByRole('link', {
			name: /Scoring Editor/i
		});
		await expect(scoringLink).toBeVisible();
		expect(await scoringLink.getAttribute('href')).toContain('subview=scoring');

		await page.screenshot({
			path: 'build/v1.3.5.7/real-directory-drawer-1280x800.png'
		});

		// Close drawer
		await drawer.getByRole('button', { name: 'Close variant details' }).click();
		await expect(drawer).not.toBeVisible();
		await page.locator('input[name="q"]').fill('Time Strata');
		await page.locator('form.filter-bar button[type="submit"]').click();
		await page.waitForURL((url) => url.searchParams.get('q') === 'Time Strata');
		await expect(page.locator('.variant-row')).toHaveCount(1);
		await page
			.locator('.variant-row[data-id="memory:time-strata"]')
			.getByRole('button', { name: 'Inspect' })
			.click();
		await expect(drawer.locator('.dim-grid')).toContainText('No preview');
		await expect(drawer.locator('.dim-grid')).toContainText('Top cards only');
		await page.screenshot({ path: 'build/v1.3.5.14/app/admin-time-strata-directory.png' });
	} finally {
		if (original)
			await db
				.prepare("UPDATE config_live SET version=? WHERE key='game:memory'")
				.bind(original.version)
				.run();
		else await db.prepare("DELETE FROM config_live WHERE key='game:memory'").run();
		await db.prepare("DELETE FROM variant_lifecycle WHERE family='memory'").run();
		for (const row of lifecycle)
			await db
				.prepare(
					"INSERT INTO variant_lifecycle(family,variant,state,reason) VALUES('memory',?,?,?)"
				)
				.bind(row.variant, row.state, row.reason)
				.run();
		if (userId)
			await db.batch([
				db.prepare('DELETE FROM admin_web_operator WHERE user_id=?').bind(userId),
				db.prepare('DELETE FROM admin_actor WHERE id=?').bind(userId),
				db.prepare('DELETE FROM user WHERE id=?').bind(userId)
			]);
		await context.close();
		await proxy.dispose();
	}
});
