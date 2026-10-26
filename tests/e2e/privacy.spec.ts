import { expect, test } from '@playwright/test';

test('privacy policy is readable without JavaScript or sign-in and contains the reviewed publication copy', async ({
	browser
}) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		baseURL: 'http://127.0.0.1:5173'
	});
	const page = await context.newPage();
	const response = await page.goto('/privacy');
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Privacy policy', exact: true })).toBeVisible();
	await expect(
		page.getByText('Morphi.One is operated by Ali Gohar.', { exact: true })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'cngohar@gmail.com', exact: true })).toHaveAttribute(
		'href',
		'mailto:cngohar@gmail.com'
	);
	await expect(page.locator('.draft')).toHaveCount(0);
	await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'https://morphi.one/privacy'
	);
	await expect(
		page.getByRole('heading', { name: 'Children and families', exact: true })
	).toBeVisible();
	await expect(page.locator('article')).toContainText('Updated: 2026-10-26');
	await expect(page.locator('article')).not.toContainText('local preview');
	await expect(page.locator('article')).not.toContainText('under review');
	await expect(page.locator('a[href*="localhost"], a[href*="127.0.0.1"]')).toHaveCount(0);
	await expect(page.locator('article')).toContainText('general-audience puzzle site');
	await expect(page.locator('article')).toContainText('do not ask guest players for their age');
	await expect(page.getByRole('heading', { name: 'Website analytics', exact: true })).toBeVisible();
	await expect(page.locator('article')).toContainText('Cloudflare’s automatic setup');
	await expect(page.locator('article')).not.toContainText('intended audience includes children');
	await context.close();
});

test('privacy links fit the approved layouts, remain available on content pages, and stay out of gameplay', async ({
	page
}) => {
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800],
		[320, 480]
	]) {
		await page.setViewportSize({ width, height });
		await page.goto('/', { waitUntil: 'networkidle' });
		const link = page.getByRole('link', { name: 'Privacy', exact: true });
		await expect(link).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
			true
		);
		await link.click();
		await expect(page.getByRole('heading', { name: 'Privacy policy', exact: true })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	}
	await page.goto('/account/sign-in');
	await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute(
		'href',
		'/privacy'
	);
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.locator('.game')).toBeVisible();
	await expect(page.locator('.site-footer')).toHaveCount(0);
});
