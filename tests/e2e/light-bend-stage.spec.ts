import { expect, test } from '@playwright/test';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';

const families = familyIndex.filter((family) => family.enabled && family.weight > 0);
const ids = families.map((family) => family.id);

test('stage registry loads each registered stage and leaves the other families unregistered', async ({
	page
}) => {
	await page.goto('/play');
	const result = await page.evaluate(async () => {
		const registryPath = '/src/lib/registry.ts';
		const registry = (await import(/* @vite-ignore */ registryPath)) as {
			puzzleStages: Record<string, () => Promise<{ default: unknown }>>;
		};
		const entries = Object.entries(registry.puzzleStages);
		const loaded = await Promise.all(
			entries.map(async ([id, load]) => [id, typeof (await load()).default])
		);
		return { keys: entries.map(([id]) => id).sort(), loaded };
	});
	expect(result.keys).toEqual([
		'klondike-solitaire',
		'light-bend',
		'mahjong-solitaire',
		'nonogram',
		'tangram'
	]);
	expect(result.loaded.every(([, type]) => type === 'function')).toBe(true);
});

for (const family of ['block', 'memory', 'connect'] as const) {
	test(`${family} renders the shared fallback stage`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.route('**/api/play/availability**', (route) => {
			const requested = new URL(route.request().url()).searchParams.get('family');
			return route.fulfill({
				json: requested
					? { available: true }
					: {
							available: ids,
							weights: Object.fromEntries(families.map((entry) => [entry.id, entry.weight])),
							variants: Object.fromEntries(
								families.map((entry) => [
									entry.id,
									(puzzleMetadata[entry.id]?.variants ?? [])
										.filter((variant) => variant.enabled !== false)
										.map((variant) => variant.id)
								])
							)
						}
			});
		});
		await page.addInitScript(
			({ selected, eligible }) => {
				localStorage.setItem('morphi.sound', 'off');
				localStorage.setItem(
					'morphi.selector.v2.guest',
					JSON.stringify({
						version: 1,
						eligible,
						queue: [selected, ...eligible.filter((id) => id !== selected)],
						recent: [],
						cyclePosition: 0
					})
				);
			},
			{ selected: family, eligible: ids }
		);
		await page.goto('/play');
		await expect(page.locator(`.game[data-family="${family}"]`)).toHaveAttribute(
			'data-phase',
			'playing',
			{ timeout: 20000 }
		);
		await expect(page.locator('.round-panel')).toBeVisible();
		await expect(page.locator('[data-family-stage]')).toHaveCount(0);
	});
}
