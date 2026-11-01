import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, type Page } from '@playwright/test';
import { fixSelectorSeed } from '../tests/e2e/entropy.js';

const directory = 'build/public-privacy';
const live = process.argv.includes('--live');
let localPort = 8796;
if (!live) {
	const probe = createServer();
	await new Promise<void>((resolve, reject) => {
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', resolve);
	});
	const address = probe.address();
	if (!address || typeof address === 'string') throw new Error('No local test port');
	localPort = address.port;
	await new Promise<void>((resolve) => probe.close(() => resolve()));
}
const origin = live ? 'https://morphi.one' : `http://127.0.0.1:${localPort}`;
const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8')) as {
	configSha256: string;
	files: { path: string; sha256: string }[];
};
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
async function assetPaths(path: string, relative = ''): Promise<string[]> {
	const paths: string[] = [];
	for (const entry of await readdir(path, { withFileTypes: true })) {
		const name = join(relative, entry.name);
		if (entry.isDirectory()) paths.push(...(await assetPaths(join(path, entry.name), name)));
		else {
			assert(entry.isFile(), 'Only regular publication files are allowed');
			paths.push(name);
		}
	}
	return paths;
}
assert.deepEqual(
	(await assetPaths(`${directory}/assets`)).sort(),
	manifest.files.map((file) => file.path).sort(),
	'No unlisted files in the publication payload'
);
assert.equal(hash(await readFile('wrangler.public-privacy.jsonc')), manifest.configSha256);
for (const file of manifest.files)
	assert.equal(hash(await readFile(`${directory}/assets/${file.path}`)), file.sha256, file.path);
const config = JSON.parse(await readFile('wrangler.public-privacy.jsonc', 'utf8'));
assert.equal(config.name, 'morphi-one');
assert.equal(config.main, undefined);
assert.equal(config.vars, undefined);
assert.equal(config.d1_databases, undefined);
const worker = live
	? undefined
	: spawn(
			'bunx',
			[
				'wrangler',
				'dev',
				'--config',
				'wrangler.public-privacy.jsonc',
				'--local',
				'--port',
				String(localPort),
				'--inspector-port',
				'0',
				'--log-level',
				'error'
			],
			{ stdio: 'ignore' }
		);
const checks: string[] = ['asset/config hashes match reviewed manifest; no backend bindings'];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
	let ready = false;
	for (let i = 0; i < 120; i++) {
		try {
			if ((await fetch(origin)).ok) {
				ready = true;
				break;
			}
		} catch {
			/* Booting. */
		}
		await delay(250);
	}
	assert(ready, 'Publication server ready');
	for (const path of [
		'/account',
		'/account/sign-in',
		'/leaderboard',
		'/api/auth/sign-in/social',
		'/api/auth/callback/google?code=fixture',
		'/api/progress',
		'/demo/accounts.html'
	])
		assert.equal((await fetch(origin + path)).status, 404, `unpublished route ${path}`);
	assert.equal(
		(await fetch(origin + '/api/auth/sign-in/social', { method: 'POST', body: '{}' })).status,
		404
	);
	checks.push('account/auth/API/leaderboard/demo routes unavailable, including OAuth POST');
	const response = await fetch(origin + '/privacy');
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
	if (!live) assert.equal(response.headers.get('set-cookie'), null);
	else assert(!response.headers.get('set-cookie')?.includes('better-auth'), 'No account cookie');
	const html = await response.text();
	assert(
		!/Local review draft|under review|local preview|localhost|127\.0\.0\.1|noindex/i.test(html)
	);
	if (!live)
		assert(
			!/<script\b/i.test(html),
			'Build has no scripts; Cloudflare injects its beacon only on delivery'
		);
	assert(html.includes('Website analytics') && html.includes('Cloudflare’s automatic setup'));
	checks.push('privacy disclosure/metadata present; no draft/local URLs or account cookies');
	if (!live) {
		const routes = ['/', '/privacy', '/terms', '/how-it-works', '/about', '/faq'];
		const slugs = ['block', 'memory', 'connect', 'block-puzzle'];
		const sitemap = await (await fetch(origin + '/sitemap.xml')).text();
		assert.deepEqual(
			[...sitemap.matchAll(/<loc>https:\/\/morphi\.one([^<]*)<\/loc>/g)].map((item) => item[1]),
			routes
		);
		const robots = await (await fetch(origin + '/robots.txt')).text();
		for (const slug of slugs) {
			const redirect = await fetch(`${origin}/${slug}?game=${slug}`, { redirect: 'manual' });
			assert.equal(redirect.status, 308, slug);
			assert.equal(new URL(redirect.headers.get('location')!, origin).pathname, '/');
			assert(!robots.includes(`/${slug}`));
			assert(!sitemap.includes(`https://morphi.one/${slug}<`));
		}
		for (const route of routes) {
			const document = await fetch(origin + route);
			assert.equal(document.status, 200, route);
			const source = await document.text();
			for (const [, href] of source.matchAll(/href="([^"]*)"/g)) {
				const url = new URL(href, origin);
				if (url.origin === origin) {
					assert(!slugs.includes(url.pathname.slice(1)), href);
					assert(!url.pathname.startsWith('/play/'), href);
					if (url.pathname === '/play') assert.equal(url.search, '');
				}
			}
		}
		checks.push(
			'exact guest assets: family redirects, static explainers, sitemap/robots and public-link crawl'
		);
	}
	browser = await chromium.launch();
	const noJS = await browser.newContext({ javaScriptEnabled: false });
	const policyPage = await noJS.newPage();
	await policyPage.goto(origin + '/privacy');
	assert.equal(
		await policyPage.locator('link[rel="canonical"]').getAttribute('href'),
		'https://morphi.one/privacy'
	);
	assert.equal(await policyPage.title(), 'Privacy policy · Morphi.One');
	assert.equal(
		await policyPage.getByRole('link', { name: 'cngohar@gmail.com' }).getAttribute('href'),
		'mailto:cngohar@gmail.com'
	);
	assert((await policyPage.locator('article').innerText()).includes('Updated: 2026-10-26'));
	await noJS.close();
	checks.push('no-JavaScript policy/contact/date/title/canonical');
	const page = await browser.newPage();
	const errors: string[] = [];
	const requests: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('request', (request) => requests.push(request.url()));
	await mkdir(`${directory}/checks`, { recursive: true });
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800]
	]) {
		await page.setViewportSize({ width, height });
		await page.goto(origin, { waitUntil: 'networkidle' });
		assert.equal(
			await page.locator('link[rel="canonical"]').getAttribute('href'),
			'https://morphi.one/'
		);
		assert.equal(await page.locator('a[href*="/account"]').count(), 0);
		assert.equal(
			new URL(
				(await page.getByRole('link', { name: 'Privacy', exact: true }).getAttribute('href'))!,
				origin + '/'
			).pathname,
			'/privacy'
		);
		await page.getByRole('link', { name: 'Privacy', exact: true }).click();
		await page.getByRole('heading', { name: 'Privacy policy', exact: true }).waitFor();
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		await page.screenshot({
			path: `${directory}/checks/${live ? 'live-' : ''}privacy-${width}.png`
		});
	}
	checks.push('home/privacy links and document layouts at three approved viewports');
	// The current Mix selector may deal either other family after Block.
	await fixSelectorSeed(page, live ? 2 : 7);
	await page.goto(origin, { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await page.locator('.game[data-family="block"]').waitFor();
	await page.waitForFunction(
		() => document.querySelector('.game')?.getAttribute('data-phase') === 'playing'
	);
	await finishBlock(page);
	assert.equal(await page.locator('a[href*="/account"]').count(), 0);
	assert(
		!(await page.evaluate(() => indexedDB.databases())).some(
			(database) => database.name === 'morphi-progress'
		),
		'Guest publication does not enable replay queues'
	);
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await page
		.locator(live ? '.game[data-family="memory"]' : '.game:not([data-family="block"])')
		.waitFor();
	assert.equal(await page.locator('.site-footer').count(), 0);
	assert.deepEqual(errors, []);
	const external = requests.filter((url) => new URL(url).origin !== origin);
	const isCloudflareBeacon = (url: string) => {
		const parsed = new URL(url);
		return (
			parsed.origin === 'https://static.cloudflareinsights.com' &&
			/^\/beacon\.min\.js(?:\/[^/]+)?$/.test(parsed.pathname)
		);
	};
	if (live) {
		assert(
			external.length > 0 && external.every(isCloudflareBeacon),
			'Only the intentional Cloudflare automatic Web Analytics beacon is external'
		);
		checks.push('intentional Cloudflare Web Analytics beacon observed; no other external requests');
	} else assert.deepEqual(external, [], 'No analytics script embedded in build assets');
	assert(
		!requests.some((url) => new URL(url).pathname.startsWith('/api/')),
		'No account API calls'
	);
	checks.push(
		'real Block round/result/Next to a different family; no account prompts, replay queue, account APIs, or browser errors'
	);
	await writeFile(
		`${directory}/checks/${live ? 'live-' : ''}results.json`,
		JSON.stringify({ checks }, null, 2) + '\n'
	);
	console.info(
		JSON.stringify(
			{ target: live ? origin : 'exact guest-only publication assets, local workerd', checks },
			null,
			2
		)
	);
} finally {
	await browser?.close();
	worker?.kill();
}

async function finishBlock(page: Page) {
	for (let step = 0; step < 320; step++) {
		if (await page.locator('.result').count()) return;
		const move = await page.evaluate(() => {
			const board = [...document.querySelectorAll('.board .cell')].map((c) =>
				c.classList.contains('is-filled')
			);
			for (const slot of document.querySelectorAll<HTMLElement>(
				'button.tray-slot:not(.is-empty)'
			)) {
				const cells = [...slot.querySelectorAll<HTMLElement>('.mini-cell')].map((c) => ({
					x: Number(c.style.gridColumn) - 1,
					y: Number(c.style.gridRow) - 1
				}));
				const w = Math.max(...cells.map((c) => c.x)) + 1,
					h = Math.max(...cells.map((c) => c.y)) + 1;
				for (let y = 0; y <= 8 - h; y++)
					for (let x = 0; x <= 8 - w; x++)
						if (cells.every((c) => !board[(y + c.y) * 8 + x + c.x]))
							return { slot: slot.dataset.trayIndex, index: y * 8 + x };
			}
			return null;
		});
		if (!move) {
			await page.locator('.result').waitFor();
			return;
		}
		await page.locator(`.tray [data-tray-index="${move.slot}"]`).click();
		await page.locator(`.board .cell[data-index="${move.index}"]`).click();
		await page.waitForTimeout(120);
		await page.waitForFunction(
			() =>
				document.querySelector('.result') ||
				[...document.querySelectorAll('button.tray-slot')].every(
					(slot) => slot.getAttribute('aria-disabled') !== 'true'
				)
		);
	}
	throw new Error('Block round did not finish');
}
