/** Synthetic local review fixtures only; no bypass or enrollment endpoint ships. */
import { getPlatformProxy } from 'wrangler';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createAuth } from '../src/lib/server/auth.js';
import { savePlayerName } from '../src/lib/server/players.js';
import { createMemoryRound } from '../src/lib/catalog.js';
import { saveRun } from '../src/lib/server/runs.js';
import { encryptOperatorSecret, totpAt } from '../src/lib/server/operator.js';
const output = 'build/v1-integration-review';
await mkdir(output, { recursive: true });
const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
const browser = await chromium.launch();
let fixtureId: string | null = null;
try {
	const auth = betterAuth({
		...createAuth(proxy.env.DB, {
			baseURL: 'http://localhost:5173',
			secret: proxy.env.BETTER_AUTH_SECRET,
			googleClientId: '',
			googleClientSecret: ''
		}).options,
		plugins: [testUtils()]
	});
	const helpers = (await auth.$context).test;
	const user = await helpers.saveUser(
		helpers.createUser({
			email: `${crypto.randomUUID()}@example.test`,
			name: 'Private review fixture'
		})
	);
	fixtureId = user.id;
	const login = await helpers.login({ userId: user.id });
	const name = `WWWWWWWWWWWW${user.id.replaceAll('-', '').slice(0, 8)}`;
	await savePlayerName(proxy.env.DB, user.id, name);
	const round = createMemoryRound('3');
	const moves = [...new Set(round.cards.map((card) => card.symbol))].flatMap((symbol) =>
		round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
	);
	await saveRun(proxy.env.DB, user.id, {
		version: 1,
		id: crypto.randomUUID(),
		family: 'memory',
		engineVersion: 'memory-1',
		seed: '3',
		moves,
		elapsedSeconds: 20,
		rankedSession: null
	});
	const secret = new Uint8Array(20).fill(17);
	await proxy.env.DB.batch([
		proxy.env.DB.prepare("INSERT INTO admin_actor(id,role) VALUES(?,'admin')").bind(user.id),
		proxy.env.DB.prepare('INSERT INTO admin_web_operator(user_id,secret_cipher) VALUES(?,?)').bind(
			user.id,
			await encryptOperatorSecret(secret, proxy.env.BETTER_AUTH_SECRET)
		)
	]);
	const context = await browser.newContext({
		baseURL: 'http://localhost:5173',
		reducedMotion: 'reduce'
	});
	await context.addCookies(login.cookies);
	const page = await context.newPage();
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const findings: unknown[] = [];
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800]
	]) {
		await page.setViewportSize({ width, height });
		for (const [path, screen] of [
			['/account', 'profile'],
			['/account/name', 'name'],
			['/account/sign-in?reauth=1', 'signin'],
			['/leaderboard', 'leaderboard'],
			['/privacy', 'privacy'],
			['/terms', 'terms']
		]) {
			await page.goto(path!, { waitUntil: 'networkidle' });
			await page.screenshot({
				path: `${output}/app-${screen}-${width}x${height}.png`,
				fullPage: true
			});
			findings.push({
				screen,
				width,
				height,
				...(await page.evaluate(() => ({
					scrollWidth: document.documentElement.scrollWidth,
					errors: document.querySelectorAll('[role=alert]').length
				})))
			});
		}
	}
	await page.goto('/admin/sign-in', { waitUntil: 'networkidle' });
	await page.getByRole('textbox').fill(await totpAt(secret, Math.floor(Date.now() / 30000)));
	await page.getByRole('button', { name: 'Verify and continue', exact: true }).click();
	await page.waitForURL('**/admin/dashboard');
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800]
	]) {
		await page.setViewportSize({ width, height });
		for (const view of ['dashboard', 'status', 'moderation', 'queue', 'audit', 'privacy']) {
			await page.goto(`/admin/${view}`, { waitUntil: 'networkidle' });
			await page.screenshot({
				path: `${output}/app-admin-${view}-${width}x${height}.png`,
				fullPage: true
			});
			findings.push({
				screen: `admin-${view}`,
				width,
				height,
				...(await page.evaluate(() => ({
					scrollWidth: document.documentElement.scrollWidth,
					rawKeys: document.body.textContent?.match(/v1\.admin\.\w+/g) ?? []
				})))
			});
		}
	}
	await writeFile(
		`${output}/account-results.json`,
		JSON.stringify(
			{
				findings,
				errors,
				fixture: 'Synthetic local user with an engine-replayed saved round; removed after review'
			},
			null,
			2
		) + '\n'
	);
	console.log(
		`${findings.length} account/operator captures; ${errors.length} uncaught browser errors`
	);
	await context.close();
} finally {
	await browser.close();
	if (fixtureId) {
		await proxy.env.DB.batch([
			proxy.env.DB.prepare('DELETE FROM admin_web_operator WHERE user_id=?').bind(fixtureId),
			proxy.env.DB.prepare('DELETE FROM admin_actor WHERE id=?').bind(fixtureId),
			proxy.env.DB.prepare('DELETE FROM user WHERE id=?').bind(fixtureId)
		]);
	}
	await proxy.dispose();
}
