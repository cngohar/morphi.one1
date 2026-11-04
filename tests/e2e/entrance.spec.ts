import { expect, test, type Page } from '@playwright/test';
import { fixSelectorSeed, selectorSeedFor } from './entropy.js';
async function fixedPuzzleSeed(page: Page, pairs: number) {
	const seed = pairs === 6 ? 3 : pairs === 8 ? 0 : 1;
	await page.addInitScript(
		({ value, selectorSeed }) => {
			const original = crypto.getRandomValues.bind(crypto);
			let first = true;
			crypto.getRandomValues = (array) => {
				if (array instanceof Uint32Array && array.length === 2) {
					array[0] = 0;
					array[1] = first ? selectorSeed : value;
					first = false;
					return array;
				}
				return original(array);
			};
		},
		{ value: seed, selectorSeed: selectorSeedFor('memory') }
	);
}
for (const pairs of [6, 8, 10])
	test(`Memory ${pairs} pairs settles before a full free preview and timer start`, async ({
		page
	}) => {
		await fixedPuzzleSeed(page, pairs);
		await page.goto('/', { waitUntil: 'networkidle' });
		await page.evaluate(() => {
			const phases: { phase: string; time: number }[] = [];
			Object.assign(window, { entrancePhases: phases });
			new MutationObserver(() => {
				const phase = document.querySelector('.game')?.getAttribute('data-phase');
				if (phase && phases.at(-1)?.phase !== phase)
					phases.push({ phase, time: performance.now() });
			}).observe(document.body, {
				subtree: true,
				childList: true,
				attributes: true,
				attributeFilter: ['data-phase']
			});
		});
		await page.getByRole('button', { name: 'Play', exact: true }).click();
		const game = page.locator('.game');
		await expect(game).toHaveAttribute('data-phase', 'dealing');
		const began = Date.now();
		const cards = page.locator('.memory-card');
		await expect(cards).toHaveCount(pairs * 2);
		await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
		await expect(cards.first()).toBeDisabled();
		await expect(game).toHaveAttribute('data-phase', 'preview', { timeout: 7000 });
		expect(Date.now() - began).toBeGreaterThanOrEqual(
			(pairs === 6 ? 3000 : pairs === 8 ? 4000 : 5000) - 300
		);
		await expect(page.locator('.stat').nth(1)).toContainText('0:00');

		await expect(cards.first()).toBeDisabled();
		await expect(game).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
		const phases = await page.evaluate(
			() => Reflect.get(window, 'entrancePhases') as { phase: string; time: number }[]
		);
		const preview = phases.find((value) => value.phase === 'preview')!,
			hiding = phases.find((value) => value.phase === 'hiding')!;
		// MutationObserver delivery can trail the scheduled phase by a display frame.
		expect(hiding.time - preview.time).toBeGreaterThanOrEqual(2950);
		await expect(cards.first()).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('.stat').nth(1)).toContainText('0:00');
		await cards.first().click();
		await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
	});
test('hidden entrance pauses and reduced-motion changes reveal safely without skipping preview', async ({
	page
}) => {
	await fixedPuzzleSeed(page, 6);
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'dealing');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(3400);
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'dealing');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'preview');
	await page.waitForTimeout(2000);
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'preview');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 2500 });
});
test('Block entrance locks placement, then supports real selection', async ({ page }) => {
	await fixSelectorSeed(page, selectorSeedFor('block'));
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'dealing');
	const slot = page.locator('button.tray-slot').first();
	await expect(slot).toHaveAttribute('aria-disabled', 'true');
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
	await slot.click();
	await expect(slot).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.board .cell.is-filled')).toHaveCount(0);
});
test('measurement is opt-in, bounded and can be withdrawn', async ({ page }) => {
	const sent: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/api/measurement' && request.method() === 'POST')
			sent.push(request.postData() ?? '');
	});
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.locator('.game')).toBeVisible();
	expect(sent).toHaveLength(0);
	await page.goto('/privacy', { waitUntil: 'networkidle' });
	const toggle = page.getByRole('checkbox', { name: 'Allow anonymous gameplay measurement' });
	await expect(toggle).not.toBeChecked();
	await toggle.check();
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await page.getByRole('button', { name: 'Abandon + New', exact: true }).click();
	await expect(page.locator('.game')).toBeVisible();
	await expect.poll(() => sent.length).toBeGreaterThanOrEqual(2);
	for (const body of sent) {
		expect(Object.keys(JSON.parse(body)).sort()).toEqual([
			'code',
			'consent',
			'event',
			'family',
			'id'
		]);
		expect(body).not.toMatch(/seed|email|player|score/);
	}
	await page.goto('/privacy', { waitUntil: 'networkidle' });
	await page.getByRole('checkbox', { name: 'Allow anonymous gameplay measurement' }).uncheck();
	expect(await page.evaluate(() => localStorage.getItem('morphi.measurement'))).toBe('deny');
});
test('every operator view denies guests without exposing records', async ({ request }) => {
	for (const view of ['dashboard', 'status', 'moderation', 'queue', 'audit', 'privacy']) {
		const response = await request.get(`/admin/${view}`, { maxRedirects: 0 });
		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toBe('/admin/sign-in');
		expect(response.headers()['x-robots-tag']).toBe('noindex');
	}
});

test('failed cosmetic entropy keeps Memory visible and playable after its preview', async ({
	page
}) => {
	await fixSelectorSeed(page, selectorSeedFor('memory'));
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length > 8)
				throw new Error('Test-only decorative entropy failure');
			return original(array);
		};
	});
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.locator('.memory-card').first()).toBeVisible();
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 10000 });
	await expect(page.locator('.memory-card').first()).toBeEnabled();
});
