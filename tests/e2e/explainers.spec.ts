import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fixSelectorSeed } from './entropy.js';

const families = ['block', 'memory', 'connect'];
const doors = [...families, 'block-puzzle'];
const documents = ['/', '/privacy', '/terms', '/how-it-works', '/about', '/faq'];

test('family slugs redirect Home and play paths cannot choose a family', async ({ request }) => {
	for (const slug of doors) {
		for (const suffix of ['', '?game=memory&mode=stay']) {
			const response = await request.get(`/${slug}${suffix}`, { maxRedirects: 0 });
			expect(response.status()).toBe(308);
			expect(new URL(response.headers()['location']!, response.url()).pathname).toBe('/');
		}
		const response = await request.get(`/play/${slug}`);
		expect(response.status()).toBe(404);
	}
});

for (const requested of families) {
	test(`play parameters cannot request ${requested} ahead of the selector`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const expected = requested === 'memory' ? 'block' : 'memory';
		await fixSelectorSeed(page, expected === 'block' ? 7 : 0);
		for (const choice of [
			`?game=${requested}`,
			`?family=${requested}&mode=stay`,
			`?puzzle=${requested}&seed=1&stay=1`,
			`#${requested}`
		]) {
			await page.goto(`/play${choice}`);
			await expect(page.locator('.game')).toHaveAttribute('data-family', expected, {
				timeout: 15000
			});
			await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
		}
	});
}

test('sitemap, robots and a public-page crawl expose only the deal and static documents', async ({
	request
}) => {
	const sitemap = await (await request.get('/sitemap.xml')).text();
	expect(
		[...sitemap.matchAll(/<loc>https:\/\/morphi\.one([^<]*)<\/loc>/g)].map((item) => item[1])
	).toEqual(documents);
	const robots = await (await request.get('/robots.txt')).text();
	for (const route of [...doors.map((slug) => `/${slug}`), '/play']) {
		expect(sitemap).not.toContain(`https://morphi.one${route}<`);
		expect(robots).not.toContain(route);
	}
	for (const route of documents) {
		const response = await request.get(route);
		expect(response.status()).toBe(200);
		expect(response.headers()['x-robots-tag']).toBeUndefined();
		const html = await response.text();
		const links = [...html.matchAll(/href="([^"]*)"/g)].map((item) => item[1]);
		for (const href of links) {
			const url = new URL(href, 'https://morphi.one');
			if (url.origin !== 'https://morphi.one') continue;
			expect(doors).not.toContain(url.pathname.slice(1));
			expect(url.pathname).not.toMatch(/^\/play\//);
			if (url.pathname === '/play') expect(url.search).toBe('');
		}
	}
});

test('all explainers provide indexable text and navigation without JavaScript', async ({
	browser
}) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		baseURL: 'http://127.0.0.1:5173'
	});
	const page = await context.newPage();
	for (const [route, title] of [
		['/how-it-works', 'How Morphi.One works'],
		['/about', 'About Morphi.One'],
		['/faq', 'Frequently asked questions']
	]) {
		await page.goto(route);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
		await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			`https://morphi.one${route}`
		);
		await expect(page.locator('main')).not.toContainText(/Memory|Block|Connect|draft|CMS/);
		const playLink = page.locator('main a', { hasText: 'Play' });
		expect(new URL((await playLink.getAttribute('href'))!, page.url()).pathname).toBe('/');
		for (const label of ['How it works', 'About', 'FAQ'])
			await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
	}
	await page.getByText('Can I choose a particular puzzle?', { exact: true }).click();
	await expect(
		page.getByText('The selector deals a random puzzle.', { exact: false })
	).toBeVisible();
	await context.close();
});

test('the illustrated deal supports step selection, auto-play, pause and reduced motion', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/how-it-works');
	const scene = page.locator('.scene');
	await expect(scene).toHaveAttribute('data-step', '0');
	await expect(scene).toHaveAttribute('data-step', '1', { timeout: 6000 });
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await page.waitForTimeout(4000);
	await expect(scene).toHaveAttribute('data-step', '1');
	await page.locator('.step-card').nth(3).click();
	await expect(scene).toHaveAttribute('data-step', '3');
	await expect(page.locator('.step-card').nth(3)).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Replay', exact: true }).click();
	await expect(scene).toHaveAttribute('data-step', '0');
	await expect(scene).toHaveAttribute('data-step', '1', { timeout: 5000 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(page.getByRole('button', { name: 'Auto-play', exact: true })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await page.locator('.step-card').nth(2).click();
	await expect(scene).toHaveAttribute('data-step', '2');
	await expect(scene.locator('.example-score')).toBeVisible();
	await expect
		.poll(() =>
			scene.locator('.scene-content').evaluate((node) => node.getAttribute('style') ?? '')
		)
		.toBe('');
	await page.waitForTimeout(4000);
	await expect(scene).toHaveAttribute('data-step', '2');
	await page.getByRole('link', { name: 'About', exact: true }).click();
	expect(errors).toEqual([]);
});

for (const [width, height] of [
	[390, 844],
	[844, 390],
	[1280, 800]
]) {
	test(`explainer pages fit and stay usable at ${width}×${height}`, async ({ page }, info) => {
		await page.setViewportSize({ width, height });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const output = `build/v1.1-work5/${info.project.name}`;
		await mkdir(output, { recursive: true });
		for (const route of ['how-it-works', 'about', 'faq']) {
			await page.goto(`/${route}`);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await page.screenshot({ path: `${output}/${route}-${width}x${height}.png`, fullPage: true });
		}
	});
}
