import { expect, test, type Page } from '@playwright/test';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { getPlatformProxy } from 'wrangler';
import { mkdir } from 'node:fs/promises';
import { catalog } from '../../src/lib/catalog.js';
import { defaultScoreConfig } from '../../src/lib/scoring.js';
import { createAuth } from '../../src/lib/server/auth.js';
import { utcDate } from '../../src/lib/server/daily.js';
import { roundRuleLine } from '../../src/lib/ui/puzzle-presentation.js';
import { fixSelectorSeed, selectorSeedFor } from './entropy.js';

test.use({ baseURL: 'http://localhost:5173' });
const sizes = [
	[390, 844],
	[844, 390],
	[1280, 800]
] as const;
const ids = Object.values(catalog).flatMap(
	(family) => family.variants?.map((variant) => variant.id) ?? []
);
const names = Object.values(catalog).flatMap((family) =>
	(family.variants ?? [])
		.slice(1)
		.map((variant) =>
			String(family.messages[variant.name as keyof typeof family.messages] ?? variant.name)
		)
);
const users: string[] = [];
const pinned = new Map<string, Record<string, unknown> | null>();
const archiveDate = '1999-04-01';
let oldArchive: Record<string, unknown>[] = [];
let oldSnapshot: Record<string, unknown> | null;

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
async function fixtureUser() {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		const helpers = (await fixtureAuth(proxy).$context).test;
		const user = await helpers.saveUser(
			helpers.createUser({
				email: `${crypto.randomUUID()}@example.test`,
				name: 'Private provider name'
			})
		);
		users.push(user.id);
		const name = `daily_${crypto.randomUUID().slice(0, 8)}`;
		await proxy.env.DB.prepare(
			'INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)'
		)
			.bind(user.id, name, name, Date.now())
			.run();
		return { user, name, login: await helpers.login({ userId: user.id }) };
	} finally {
		await proxy.dispose();
	}
}
async function pinDaily(family: string, variant: string) {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	const date = utcDate();
	try {
		const key = `${family}:${date}`;
		if (!pinned.has(key))
			pinned.set(
				key,
				await proxy.env.DB.prepare('SELECT * FROM daily_puzzle WHERE family=? AND date=?')
					.bind(family, date)
					.first()
			);
		await proxy.env.DB.prepare(
			`INSERT INTO daily_puzzle(family,date,variant,seed,engine_version,score_config_version,created_at)
			VALUES(?,?,?,?,?,?,?) ON CONFLICT(family,date) DO UPDATE SET variant=excluded.variant,seed=excluded.seed,
			engine_version=excluded.engine_version,score_config_version=excluded.score_config_version`
		)
			.bind(
				family,
				date,
				variant,
				'42',
				catalog[family].engineVersion,
				defaultScoreConfig(family, variant).version,
				Date.now()
			)
			.run();
	} finally {
		await proxy.dispose();
	}
}
async function restoreRow(db: D1Database, table: string, row: Record<string, unknown>) {
	const columns = Object.keys(row);
	await db
		.prepare(
			`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`
		)
		.bind(...Object.values(row))
		.run();
}
test.beforeAll(async () => {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		oldArchive = (
			await proxy.env.DB.prepare("SELECT * FROM daily_best WHERE family='memory' AND date=?")
				.bind(archiveDate)
				.all<Record<string, unknown>>()
		).results;
		oldSnapshot = await proxy.env.DB.prepare(
			"SELECT * FROM daily_board_snapshot WHERE family='memory' AND date=?"
		)
			.bind(archiveDate)
			.first();
		await proxy.env.DB.batch([
			proxy.env.DB.prepare("DELETE FROM daily_best WHERE family='memory' AND date=?").bind(
				archiveDate
			),
			proxy.env.DB.prepare(
				"DELETE FROM daily_board_snapshot WHERE family='memory' AND date=?"
			).bind(archiveDate),
			proxy.env.DB.prepare(
				`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<200)
				INSERT INTO daily_best(family,date,user_id,score,seconds,moves,created_at,updated_at)
				SELECT 'memory',?,'daily-browser-'||x,10001-x,10,12,x,x FROM n`
			).bind(archiveDate)
		]);
		await proxy.env.CONFIG_CACHE.delete(`daily-board:memory:${archiveDate}`);
	} finally {
		await proxy.dispose();
	}
});
test.afterAll(async () => {
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		const helpers = (await fixtureAuth(proxy).$context).test;
		for (const userId of users) {
			const dates = (
				await proxy.env.DB.prepare('SELECT family,date FROM daily_best WHERE user_id=?')
					.bind(userId)
					.all<{ family: string; date: string }>()
			).results;
			await proxy.env.DB.prepare('DELETE FROM daily_best WHERE user_id=?').bind(userId).run();
			for (const row of dates) {
				await proxy.env.DB.prepare('DELETE FROM daily_board_snapshot WHERE family=? AND date=?')
					.bind(row.family, row.date)
					.run();
				await proxy.env.CONFIG_CACHE.delete(`daily-board:${row.family}:${row.date}`);
			}
			await helpers.deleteUser(userId);
		}
		for (const [key, original] of pinned) {
			const [family, date] = key.split(':');
			await proxy.env.DB.prepare('DELETE FROM daily_puzzle WHERE family=? AND date=?')
				.bind(family, date)
				.run();
			if (original) await restoreRow(proxy.env.DB, 'daily_puzzle', original);
		}
		await proxy.env.DB.batch([
			proxy.env.DB.prepare("DELETE FROM daily_best WHERE family='memory' AND date=?").bind(
				archiveDate
			),
			proxy.env.DB.prepare(
				"DELETE FROM daily_board_snapshot WHERE family='memory' AND date=?"
			).bind(archiveDate)
		]);
		for (const row of oldArchive) await restoreRow(proxy.env.DB, 'daily_best', row);
		if (oldSnapshot) await restoreRow(proxy.env.DB, 'daily_board_snapshot', oldSnapshot);
		await proxy.env.CONFIG_CACHE.delete(`daily-board:memory:${archiveDate}`);
	} finally {
		await proxy.dispose();
	}
});

function noIds(value: string) {
	for (const id of ids) expect(value).not.toContain(id);
}
async function anonymousSurface(page: Page) {
	noIds(await page.locator('html').evaluate((node) => node.outerHTML));
	noIds(page.url());
	await expect(page.locator('[data-variant]')).toHaveCount(0);
	const labels = await page.locator('h1,h2,h3,option').allTextContents();
	for (const name of names) expect(labels.map((label) => label.trim())).not.toContain(name);
}
async function bounds(page: Page) {
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const targets = await page
		.locator(
			'.account-main button,.account-main select,.account-main input[type=date],.account-main a,.account-main summary'
		)
		.evaluateAll((nodes) =>
			nodes
				.filter((node) => node.getClientRects().length)
				.map((node) => ({
					name: node.textContent?.trim() || node.getAttribute('name'),
					width: node.getBoundingClientRect().width,
					height: node.getBoundingClientRect().height
				}))
		);
	for (const target of targets) {
		expect(target.height, target.name ?? 'control').toBeGreaterThanOrEqual(44);
		expect(target.width, target.name ?? 'control').toBeGreaterThanOrEqual(44);
	}
}
function watchDaily(page: Page) {
	const requests: string[] = [];
	const replies: Promise<string>[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/api/') || request.url().includes('/leaderboard?/'))
			requests.push(request.url() + (request.postData() ?? ''));
	});
	page.on('requestfinished', (request) => {
		if (request.url().includes('/api/') || request.url().includes('/leaderboard?/'))
			replies.push(
				request
					.response()
					.then((response) => response?.text() ?? '')
					.catch(() => '')
			);
	});
	return async () => {
		noIds(requests.join('\n'));
		noIds((await Promise.all(replies)).join('\n'));
	};
}

for (const [width, height] of sizes) {
	test(`public family/date board and monthly archive fit ${width}×${height} without variant identity`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(`/leaderboard?family=memory&date=${archiveDate}`);
		await expect(page.locator('.account-shell')).toHaveAttribute('data-ready', 'true');
		await expect(page.locator('tbody tr')).toHaveCount(25);
		await expect(page.locator('.snapshot-time')).toContainText('Frozen');
		const options = await page
			.locator('#board-family option')
			.evaluateAll((nodes) =>
				nodes.map((node) => ({ value: (node as HTMLOptionElement).value, label: node.textContent }))
			);
		expect(options.map((option) => option.value).sort()).toEqual(['block', 'connect', 'memory']);
		for (const option of options) noIds(JSON.stringify(option));
		await anonymousSurface(page);
		await bounds(page);
		await page.getByRole('link', { name: 'Show Top 100', exact: true }).click();
		await expect(page.locator('tbody tr')).toHaveCount(100);
		await expect(page).toHaveURL(/limit=100/);
		await page.locator('.archive summary').click();
		await expect(page.locator('.archive nav[aria-label="1999-04"]')).toBeVisible();
		await expect(
			page.locator('.archive').getByRole('link', { name: archiveDate, exact: true })
		).toBeVisible();
		await bounds(page);
		await mkdir('build/v1.4/browser', { recursive: true });
		await page.screenshot({
			path: `build/v1.4/browser/board-${width}x${height}.png`,
			fullPage: true
		});
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
		await expect(page.locator('select,option,[data-variant]')).toHaveCount(0);
		for (const name of ['Memory', 'Block', 'Connect'])
			await expect(
				page
					.getByRole('button', { name, exact: true })
					.or(page.getByRole('link', { name, exact: true }))
			).toHaveCount(0);
		await anonymousSurface(page);
	});
}

test('signed-in own rank and percentile remain visible outside Top 25 and profile uses family/date', async ({
	browser
}) => {
	const fixture = await fixtureUser();
	const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc' });
	try {
		await proxy.env.DB.prepare(
			"UPDATE daily_best SET user_id=? WHERE family='memory' AND date=? AND user_id='daily-browser-26'"
		)
			.bind(fixture.user.id, archiveDate)
			.run();
		await proxy.env.DB.prepare("DELETE FROM daily_board_snapshot WHERE family='memory' AND date=?")
			.bind(archiveDate)
			.run();
		await proxy.env.CONFIG_CACHE.delete(`daily-board:memory:${archiveDate}`);
	} finally {
		await proxy.dispose();
	}
	const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
	await context.addCookies(fixture.login.cookies);
	const page = await context.newPage();
	try {
		for (const [width, height] of sizes) {
			await page.setViewportSize({ width, height });
			await page.goto(`/leaderboard?family=memory&date=${archiveDate}`);
			await expect(page.locator('[data-own-rank]')).toContainText('Your position: 26');
			await expect(page.locator('.percentile')).toHaveText('Top 25%');
			await expect(page.locator('tbody tr.own')).toHaveCount(0);
			await anonymousSurface(page);
			await bounds(page);
		}
		await page.goto('/account');
		await expect(page.locator('.account-shell')).toHaveAttribute('data-ready', 'true');
		await anonymousSurface(page);
	} finally {
		await context.close();
	}
});

test('old group URLs return 404 and availability never exposes variant choices', async ({
	request
}) => {
	for (const id of ['memory-1', 'memory-1:trios', 'connect-1', 'block-1'])
		expect((await request.get(`/leaderboard?group=${encodeURIComponent(id)}`)).status()).toBe(404);
	for (const family of ['memory', 'block', 'connect']) {
		const response = await request.get(`/api/play/availability?family=${family}`);
		expect(response.ok()).toBe(true);
		const json = await response.json();
		expect(json).not.toHaveProperty('variants');
		noIds(JSON.stringify(json));
	}
});

test('daily no-preview Memory teaches before play, recovers anonymously, and saves a family-only result', async ({
	browser
}) => {
	await pinDaily('memory', 'memory:no-preview');
	const fixture = await fixtureUser();
	const context = await browser.newContext({
		baseURL: 'http://localhost:5173',
		reducedMotion: 'reduce'
	});
	await context.addCookies(fixture.login.cookies);
	const page = await context.newPage();
	const network = watchDaily(page);
	await fixSelectorSeed(page, selectorSeedFor('memory'));
	try {
		await page.goto('/play');
		const game = page.locator('.game[data-family="memory"]');
		await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15_000 });
		await expect(page.locator('.entrance-rule')).toHaveText(
			'Cards start face down. There is no free opening allowance.'
		);
		const cards = page.locator('.memory-card');
		await expect(cards.first()).toBeEnabled();
		await expect(page.locator('.memory-card.is-up')).toHaveCount(0);
		await anonymousSurface(page);
		await network();
		await cards.first().click();
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						new Promise<number>((resolve, reject) => {
							const opening = indexedDB.open('morphi-checkpoint', 1);
							opening.onerror = () => reject(opening.error);
							opening.onsuccess = () => {
								const db = opening.result;
								const request = db.transaction('active').objectStore('active').getAll();
								request.onsuccess = () => {
									resolve(request.result[0]?.moves?.length ?? 0);
									db.close();
								};
								request.onerror = () => {
									reject(request.error);
									db.close();
								};
							};
						})
				)
			)
			.toBe(1);
		await page.reload();
		await page.getByRole('button', { name: 'Resume', exact: true }).click();
		await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15_000 });
		await anonymousSurface(page);
		await network();
		await page.waitForTimeout(4500);
		const symbols = await cards.evaluateAll((nodes) =>
			nodes.map((node) => node.querySelector('.card-front svg')?.outerHTML)
		);
		const pairs = new Map<string, number[]>();
		for (const [index, symbol] of symbols.entries()) {
			if (!symbol) throw new Error('Memory card symbol missing');
			pairs.set(symbol, [...(pairs.get(symbol) ?? []), index]);
		}
		// Resume kept card zero face up. Complete that pair before the remaining pairs.
		const firstPair = [...pairs.values()].find((pair) => pair.includes(0))!;
		await cards.nth(firstPair.find((index) => index !== 0)!).click();
		for (const pair of pairs.values()) {
			if (pair.includes(0)) continue;
			await expect(cards.nth(pair[0])).toBeEnabled({ timeout: 10_000 });
			await cards.nth(pair[0]).click();
			await cards.nth(pair[1]).click();
		}
		await expect(page.locator('.result')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('.result-summary > .eyebrow')).toHaveText('Memory');
		await expect(page.locator('.result .round-rule')).toHaveText(
			'Cards start face down. There is no free opening allowance.'
		);
		await anonymousSurface(page);
		await network();
		await page.goto('/account');
		await expect(page.locator('.account-shell')).toHaveAttribute('data-ready', 'true');
		await expect(page.locator('.account-main')).toContainText('Memory');
		await anonymousSurface(page);
	} finally {
		await context.close();
	}
});

for (const [family, variant] of [
	['block', 'block:rush-60'],
	['memory', 'memory:time-strata']
] as const)
	test(`daily ${family} anonymous rules teach before the first move (${variant.split(':')[1]} fixture)`, async ({
		browser
	}) => {
		await pinDaily(family, variant);
		const fixture = await fixtureUser();
		const context = await browser.newContext({
			baseURL: 'http://localhost:5173',
			reducedMotion: 'reduce'
		});
		await context.addCookies(fixture.login.cookies);
		const page = await context.newPage();
		const network = watchDaily(page);
		await fixSelectorSeed(page, selectorSeedFor(family));
		try {
			for (const [width, height] of sizes) {
				await page.setViewportSize({ width, height });
				if (width === sizes[0][0]) await page.goto('/play');
				const game = page.locator(`.game[data-family="${family}"]`);
				await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 15_000 });
				await expect(page.locator('.entrance-rule')).toHaveText(roundRuleLine(family, variant));
				await anonymousSurface(page);
				await network();
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
				await mkdir('build/v1.4/browser', { recursive: true });
				await page.screenshot({
					path: `build/v1.4/browser/${family}-${variant.split(':')[1]}-${width}x${height}.png`
				});
			}
		} finally {
			await context.close();
		}
	});
