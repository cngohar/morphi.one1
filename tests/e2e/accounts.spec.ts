import { expect, test, type Page } from '@playwright/test';
import { fixSelectorSeed } from './entropy.js';
import { getPlatformProxy } from 'wrangler';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { createAuth } from '../../src/lib/server/auth.js';
import { createDatabase } from '../../src/lib/server/db/index.js';
import { session } from '../../src/lib/server/db/schema.js';

// These helpers run in the Playwright process. No fixture/bypass route ships in the app.
test.use({ baseURL: 'http://localhost:5173' });
const createdUsers: string[] = [];
function fixtureAuth(proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>) {
	return betterAuth({
		...createAuth(proxy.env.DB, {
			baseURL: 'http://localhost:5173',
			secret: proxy.env.BETTER_AUTH_SECRET,
			googleClientId: '',
			googleClientSecret: ''
		}).options,
		plugins: [testUtils()]
	});
}
async function fixtureUser(stale = false) {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		const helpers = (await fixtureAuth(proxy).$context).test;
		const user = await helpers.saveUser(
			helpers.createUser({
				email: `${crypto.randomUUID()}@example.test`,
				name: 'Private Google Name'
			})
		);
		createdUsers.push(user.id);
		const login = await helpers.login({ userId: user.id });
		if (stale)
			await createDatabase(proxy.env.DB)
				.update(session)
				.set({ createdAt: new Date(Date.now() - 3600_000) })
				.where(eq(session.id, login.session.id));
		return { user, login };
	} finally {
		await proxy.dispose();
	}
}

test.afterAll(async () => {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		const helpers = (await fixtureAuth(proxy).$context).test;
		for (const userId of createdUsers) await helpers.deleteUser(userId);
	} finally {
		await proxy.dispose();
	}
});

async function openAccount(page: Page, path: string) {
	await page.goto(path);
	await expect(page.locator('.account-shell')).toHaveAttribute('data-ready', 'true');
}

test('guest sign-in and game remain available in all approved layouts', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800]
	]) {
		await page.setViewportSize({ width, height });
		await openAccount(page, '/account/sign-in');
		await expect(
			page.getByRole('heading', { name: 'Keep your high scores.', exact: true })
		).toBeVisible();
		await expect(
			page.getByRole('link', { name: 'Keep playing as a guest', exact: true })
		).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	}
	await page.getByRole('link', { name: 'Keep playing as a guest', exact: true }).click();
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	// Mix can deal Block, Memory or Connect first.
	await expect(
		page
			.getByRole('grid')
			.or(page.getByRole('button', { name: /^Card 1,/ }))
			.or(page.getByRole('group', { name: 'Connect puzzle grid' }))
	).toBeVisible({ timeout: 12000 });
	expect(errors).toEqual([]);
});

test('signed sessions support name setup, account isolation, fresh deletion and cookie revocation', async ({
	browser
}) => {
	const first = await fixtureUser();
	const second = await fixtureUser();
	const a = await browser.newContext({ baseURL: 'http://localhost:5173' });
	const b = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await a.addCookies(first.login.cookies);
	await b.addCookies(second.login.cookies);
	const page = await a.newPage();
	const other = await b.newPage();
	const playerName = `p_${crypto.randomUUID().slice(0, 8)}`;
	await openAccount(page, '/account');
	await expect(page).toHaveURL(/\/account\/name$/);
	await page.getByRole('textbox', { name: 'Player name', exact: true }).fill(playerName);
	await page.getByRole('button', { name: 'Save player name', exact: true }).click();
	await expect(page.getByRole('heading', { name: `${playerName}.`, exact: true })).toBeVisible();
	await expect(page.getByText('Private Google Name', { exact: true })).toHaveCount(0);
	await openAccount(other, '/account');
	await other
		.getByRole('textbox', { name: 'Player name', exact: true })
		.fill(playerName.toUpperCase());
	await other.getByRole('button', { name: 'Save player name', exact: true }).click();
	await expect(other.getByRole('alert')).toHaveText('That player name is taken. Try another.');
	await other.getByRole('textbox', { name: 'Player name', exact: true }).fill(`${playerName}_b`);
	await other.getByRole('button', { name: 'Save player name', exact: true }).click();
	await expect(other.getByRole('heading', { name: `${playerName}_b.`, exact: true })).toBeVisible();
	await page.reload();
	await expect(page.locator('.account-shell')).toHaveAttribute('data-ready', 'true');
	await expect(page.getByRole('heading', { name: `${playerName}.`, exact: true })).toBeVisible();
	await page.getByRole('tab', { name: 'Settings', exact: true }).click();
	await page.getByRole('button', { name: 'Delete account', exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.mouse.click(2, 2);
	await expect(page.getByRole('dialog')).not.toBeVisible();
	await page.getByRole('button', { name: 'Delete account', exact: true }).click();
	await page.getByRole('button', { name: 'Keep my account', exact: true }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();
	await page.getByRole('tab', { name: 'Settings', exact: true }).click();
	await page.getByRole('button', { name: 'Delete account', exact: true }).click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Delete account', exact: true })
		.click();
	await expect(page).toHaveURL(/deleted=1/);
	await openAccount(page, '/account');
	await expect(page).toHaveURL(/\/account\/sign-in$/);
	await other.reload();
	await expect(other.locator('.account-shell')).toHaveAttribute('data-ready', 'true');
	await expect(other.getByRole('heading', { name: `${playerName}_b.`, exact: true })).toBeVisible();
	await other.getByRole('tab', { name: 'Settings', exact: true }).click();
	await other.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(other).toHaveURL('http://localhost:5173/');
	await openAccount(other, '/account');
	await expect(other).toHaveURL(/\/account\/sign-in$/);
	await a.close();
	await b.close();
});

test('stale deletion requires a new Google session and a revoked session cannot edit a profile', async ({
	browser
}) => {
	const fixture = await fixtureUser(true);
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await context.addCookies(fixture.login.cookies);
	const page = await context.newPage();
	await openAccount(page, '/account/name');
	await page
		.getByRole('textbox', { name: 'Player name', exact: true })
		.fill(`p_${crypto.randomUUID().slice(0, 8)}`);
	await page.getByRole('button', { name: 'Save player name', exact: true }).click();
	await expect(page).toHaveURL('http://localhost:5173/account');
	await page.reload();
	await expect(page.locator('.account-shell')).toHaveAttribute('data-ready', 'true');
	await page.getByRole('tab', { name: 'Settings', exact: true }).click();
	await page.getByRole('button', { name: 'Delete account', exact: true }).click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Delete account', exact: true })
		.click();
	await expect(
		page
			.getByRole('dialog')
			.getByText('Please sign in with Google again before deleting your account.', { exact: true })
	).toBeVisible();
	const peer = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await peer.addCookies(fixture.login.cookies);
	const peerPage = await peer.newPage();
	await openAccount(peerPage, '/account');
	await peerPage.getByRole('tab', { name: 'Settings', exact: true }).click();
	await peerPage.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(peerPage).toHaveURL('http://localhost:5173/');
	await peer.close();
	await openAccount(page, '/account/name');
	await expect(page).toHaveURL(/\/account\/sign-in$/);
	const response = await context.request.post('/account/name', {
		form: { playerName: 'intruder' },
		headers: { origin: 'http://localhost:5173' }
	});
	expect(response.status()).toBe(401);
	await context.close();
});

async function finishMemory(page: Page, reloadBeforeResult = false) {
	await fixSelectorSeed(page, 0);
	await page.goto('/play', { waitUntil: 'domcontentloaded' });
	const cards = page.locator('.memory-card');
	await expect(cards.first()).toBeVisible({ timeout: 12000 });
	const symbols = await cards.evaluateAll((elements) =>
		elements.map((element) => element.querySelector('.card-front svg')?.outerHTML)
	);
	const pairs = new Map<string, number[]>();
	for (const [index, symbol] of symbols.entries()) {
		if (!symbol) throw new Error('The Memory preview must expose each symbol');
		pairs.set(symbol, [...(pairs.get(symbol) ?? []), index]);
	}
	const submission = reloadBeforeResult
		? page.waitForRequest(
				(request) =>
					new URL(request.url()).pathname === '/api/progress' && request.method() === 'POST'
			)
		: null;
	await expect(cards.first()).toBeEnabled({ timeout: 10000 });
	await page.waitForTimeout(4500);
	for (const indices of pairs.values()) {
		if (indices.length !== 2) throw new Error('Every Memory symbol must have one pair');
		await expect(cards.nth(indices[0]!)).toBeEnabled({ timeout: 10000 });
		await cards.nth(indices[0]!).click();
		await cards.nth(indices[1]!).click();
	}
	if (submission) {
		await submission;
		await expect(page.locator('.result')).toHaveCount(0);
		await page.reload();
		return;
	}
	await expect(page.getByRole('heading', { name: 'Well played.', exact: true })).toBeVisible();
}

async function chooseName(page: Page, name: string) {
	await openAccount(page, '/account');
	await page.getByRole('textbox', { name: 'Player name', exact: true }).fill(name);
	await page.getByRole('button', { name: 'Save player name', exact: true }).click();
	await expect(page.getByRole('heading', { name: `${name}.`, exact: true })).toBeVisible();
}

test('reading the static privacy page preserves signed-in account access on return', async ({
	browser
}) => {
	const { login } = await fixtureUser();
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await context.addCookies(login.cookies);
	const page = await context.newPage();
	await chooseName(page, `p_${crypto.randomUUID().slice(0, 8)}`);
	await page.getByRole('link', { name: 'Privacy', exact: true }).click();
	await expect(page).toHaveURL(/\/privacy$/);
	await page.getByRole('link', { name: 'Back to play', exact: true }).first().click();
	const started = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === '/api/play/start' &&
			response.request().method() === 'POST'
	);
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	expect((await started).status()).toBe(200);
	await expect(page.locator('.game')).toBeVisible();
	await context.close();
});

test('a logically completed round is saved before the win animation or result screen', async ({
	browser
}) => {
	const { login } = await fixtureUser();
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await context.addCookies(login.cookies);
	const page = await context.newPage();
	await chooseName(page, `p_${crypto.randomUUID().slice(0, 8)}`);
	await finishMemory(page, true);
	await openAccount(page, '/account');
	await expect(page.locator('.history-list li')).toHaveCount(1, { timeout: 25000 });
	expect(
		await page.evaluate(() =>
			Math.max(
				0,
				...Object.keys(localStorage)
					.filter((key) => key === 'morphi.memory.best' || key.startsWith('morphi.memory.best.'))
					.map((key) => Number(localStorage.getItem(key)))
			)
		)
	).toBeGreaterThan(0);
	await context.close();
});

test('blocked device storage keeps play working and gives an honest result warning', async ({
	page
}) => {
	await page.addInitScript(() =>
		Object.defineProperty(window, 'indexedDB', {
			get() {
				throw new DOMException('Blocked', 'SecurityError');
			}
		})
	);
	await finishMemory(page);
	await expect(page.locator('.local-status')).toHaveText(
		'Device storage is unavailable. Keep this tab open until your round is saved.'
	);
	await expect(page.getByRole('button', { name: 'Next puzzle', exact: true })).toBeEnabled();
});

test('ranked progress survives a failed response and reload, syncs across contexts, and is removed on deletion', async ({
	browser
}) => {
	const { login } = await fixtureUser();
	const first = await browser.newContext({ baseURL: 'http://localhost:5173' });
	const second = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await first.addCookies(login.cookies);
	await second.addCookies(login.cookies);
	const page = await first.newPage(),
		peer = await second.newPage();
	const name = `p_${crypto.randomUUID().slice(0, 8)}`;
	await chooseName(page, name);
	// Lose the response after the server has committed. The browser must retry the same run.
	await page.route('**/api/progress', async (route) => {
		await route.fetch();
		await route.abort();
	});
	await finishMemory(page);
	await expect(page.locator('.local-status')).toContainText('Saving when connected');
	await page.unroute('**/api/progress');
	await page.reload();
	await openAccount(page, '/account');
	await expect(page.locator('.history-list li')).toHaveCount(1, { timeout: 35000 });
	await expect(page.locator('.history-list')).toContainText('Ranked');
	await openAccount(peer, '/account');
	await expect(peer.locator('.history-list li')).toHaveCount(1);
	const response = await peer.request.get('/api/progress');
	const saved = await response.json();
	expect(saved.history).toHaveLength(1);
	await peer.goto(`/leaderboard?group=${encodeURIComponent(saved.history[0].group)}`);
	await expect(peer.getByRole('cell', { name, exact: true })).toBeVisible();
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800]
	]) {
		await peer.setViewportSize({ width, height });
		expect(await peer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	}
	const hostile = await page.request.post('/api/progress', {
		headers: { origin: 'https://untrusted.example' },
		data: { ownerKey: 'x', run: {} }
	});
	expect(hostile.status()).toBe(403);
	const oversized = await page.request.post('/api/progress', {
		headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
		data: JSON.stringify({ padding: 'x'.repeat(70000) })
	});
	expect(oversized.status()).toBe(413);
	const thirdUser = await fixtureUser();
	const other = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await other.addCookies(thirdUser.login.cookies);
	const isolated = await other.newPage();
	await chooseName(isolated, `${name}_b`);
	await expect(isolated.locator('.history-list li')).toHaveCount(0);
	await page.getByRole('tab', { name: 'Settings', exact: true }).click();
	await page.getByRole('button', { name: 'Delete account', exact: true }).click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Delete account', exact: true })
		.click();
	await expect(page).toHaveURL(/deleted=1/);
	await peer.reload();
	await expect(peer.getByRole('cell', { name, exact: true })).toHaveCount(0);
	await first.close();
	await second.close();
	await other.close();
});

test('new guest rounds import only after consent and stay unranked', async ({ browser }) => {
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	const page = await context.newPage();
	await finishMemory(page);
	const { login } = await fixtureUser();
	await context.addCookies(login.cookies);
	const name = `p_${crypto.randomUUID().slice(0, 8)}`;
	await chooseName(page, name);
	await expect(page.locator('.history-list li')).toHaveCount(0);
	await page.getByRole('tab', { name: 'Settings', exact: true }).click();
	await page
		.getByRole('button', { name: 'Save guest rounds from this browser', exact: true })
		.click();
	await page.getByRole('tab', { name: 'Overview', exact: true }).click();
	await expect(page.locator('.history-list li')).toHaveCount(1);
	await expect(page.locator('.history-list')).toContainText('Unranked');
	const progress = await (await page.request.get('/api/progress')).json();
	await page.goto(`/leaderboard?group=${encodeURIComponent(progress.history[0].group)}`);
	await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(0);
	await context.close();
});

test('a guest finishing Memory sees the real sign-in prompt and keeps their local best', async ({
	page
}) => {
	await finishMemory(page);
	await expect(page.locator('.result .scramble-visual')).toHaveCount(0);
	const score = await page.locator('.result .score').textContent();
	const best = await page.evaluate(() =>
		Object.entries(localStorage).filter(
			([key]) => key === 'morphi.memory.best' || key.startsWith('morphi.memory.best.')
		)
	);
	const bestValue = Math.max(0, ...best.map(([, value]) => Number(value)));
	expect(bestValue).toBeGreaterThanOrEqual(Number(score?.replaceAll(',', '')));
	await expect(page.getByRole('button', { name: 'Next puzzle', exact: true })).toBeVisible();
	await expect(
		page.getByRole('link', { name: 'Sign in with Google', exact: true })
	).toHaveAttribute('href', '/account/sign-in');
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800],
		[360, 640],
		[320, 480]
	]) {
		await page.setViewportSize({ width, height });
		if (height < 700 && width < height)
			await page
				.getByRole('link', { name: 'Sign in with Google', exact: true })
				.scrollIntoViewIfNeeded();
		await expect(
			page.getByRole('link', { name: 'Sign in with Google', exact: true })
		).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		expect(
			(height < 700 && width < height) ||
				(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight))
		).toBe(true);
	}
	await page.getByRole('link', { name: 'Sign in with Google', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Keep your high scores.', exact: true })
	).toBeVisible();
	expect(
		await page.evaluate(() =>
			Object.entries(localStorage).filter(
				([key]) => key === 'morphi.memory.best' || key.startsWith('morphi.memory.best.')
			)
		)
	).toEqual(best);
});

test('a signed-in player finishing Memory sees their account link and can continue to Block', async ({
	browser
}) => {
	const { login } = await fixtureUser();
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await context.addCookies(login.cookies);
	const page = await context.newPage();
	await finishMemory(page);
	await expect(page.getByRole('link', { name: 'Sign in with Google', exact: true })).toHaveCount(0);
	await expect(
		page.locator('.result-main').getByRole('link', { name: 'Your account', exact: true })
	).toHaveAttribute('href', '/account');
	await expect(page.locator('.local-status')).toContainText(
		/Saved to your account|Saving when connected/
	);
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await expect(page.locator('.game[data-family="block"]')).toBeVisible();
	await context.close();
});

test('Google authorization leaves the real sign-in form with the canonical callback and basic scopes', async ({
	page,
	context
}) => {
	await openAccount(page, '/account/sign-in');
	const button = page.getByRole('button', { name: 'Continue with Google', exact: true });
	test.skip(await button.isDisabled(), 'Google OAuth credentials are not configured locally.');
	// Stop at the provider boundary: this checks the app's actual form redirect,
	// while the user's Google login and consent remain an interactive check.
	await page.route('https://accounts.google.com/**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'text/html',
			body: '<!doctype html><html lang="en"><title>OAuth boundary</title><body>Provider boundary reached</body></html>'
		})
	);
	await button.click();
	await page.waitForURL((url) => url.origin === 'https://accounts.google.com');
	const destination = new URL(page.url());
	expect(destination.searchParams.get('redirect_uri')).toBe(
		'http://localhost:5173/api/auth/callback/google'
	);
	expect(destination.searchParams.get('scope')?.split(' ').sort()).toEqual([
		'email',
		'openid',
		'profile'
	]);
	expect(destination.searchParams.has('client_secret')).toBe(false);
	const cookies = await context.cookies('http://localhost:5173');
	expect(
		cookies.some(
			(cookie) =>
				cookie.name.startsWith('better-auth.') && cookie.httpOnly && cookie.sameSite === 'Lax'
		)
	).toBe(true);
});
