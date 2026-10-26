import { test, expect } from '@playwright/test';
test('Help closes on backdrop, preserves inside clicks, and returns focus to its button', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/memory', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	const how = page.getByRole('button', { name: 'How to play', exact: true });
	await how.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	const box = await dialog.boundingBox();
	expect(box).not.toBeNull();
	await page.mouse.click(box!.x + 6, box!.y + 6);
	await expect(dialog).toBeVisible();
	await page.mouse.move(box!.x + box!.width / 2, box!.y + 20);
	await page.mouse.down();
	await page.mouse.move(2, 2);
	await page.mouse.up();
	await expect(dialog).toBeVisible();
	await page.mouse.click(2, 2);
	await expect(dialog).not.toBeVisible();
	await expect(how).toBeFocused();
	await page.getByRole('button', { name: 'Scoring & tips', exact: true }).click();
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
});
test('accepted demo Help and account confirmation dialogs close on backdrop', async ({ page }) => {
	await page.goto('/demo/v1-screen.html?screen=play', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'How to play', exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.mouse.click(2, 2);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.goto('/demo/accounts-screen.html?screen=profile', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Delete account', exact: true }).first().click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.mouse.click(2, 2);
	await expect(page.getByRole('dialog')).toHaveCount(0);
});
