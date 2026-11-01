import type { Page } from '@playwright/test';

export async function captureGameReview(page: Page, name: string) {
	const stage = process.env.ADMIN_REVIEW_CAPTURE_STAGE;
	if (!stage) return;
	const wasHidden = await page.evaluate(() => document.hidden);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	try {
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 844, height: 390 },
			{ width: 1280, height: 800 }
		]) {
			await page.setViewportSize(viewport);
			await page.screenshot({
				path: `build/combined-review/${stage}/${name}-${viewport.width}x${viewport.height}.png`,
				fullPage: true,
				animations: 'disabled'
			});
		}
	} finally {
		await page.evaluate((hidden) => {
			Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
			document.dispatchEvent(new Event('visibilitychange'));
		}, wasHidden);
	}
}
