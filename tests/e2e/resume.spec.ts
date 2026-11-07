import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';
import { generateTheme } from '../../src/lib/engine/theme/generator.js';
import type { RoundCheckpoint } from '../../src/lib/ui/checkpoint.js';

const memory = puzzleMetadata.memory;
const vector = (
	JSON.parse(readFileSync('tests/vectors/reference.json', 'utf8')) as {
		memory: { seed: string; deck: string[] }[];
	}
).memory.find((entry) => entry.seed === '42')!;
const initial = {
	seed: vector.seed,
	cards: vector.deck.map((card) => ({ symbol: card.split(':')[0] }))
};
const different = initial.cards.findIndex((card) => card.symbol !== initial.cards[0]!.symbol);
function checkpoint(moves = [{ index: 0 }]): RoundCheckpoint {
	return {
		version: 1,
		id: '4f87bbdc-5ccc-441f-a9a0-14be85cc30be',
		owner: null,
		family: 'memory',
		seed: initial.seed,
		engineVersion: memory.engineVersion,
		difficulty: null,
		modifiers: {},
		theme: { ...generateTheme('42', 'memory'), themeConfigVersion: 'saved-look-version' },
		scoring: { version: 'brief-v1', values: memory.scoring.defaults },
		moves,
		state: { phase: 'playing', elapsedMs: 1234, clockStarted: true, pending: {} },
		status: 'active',
		savedAt: Date.now(),
		rankedSession: null,
		rankedStartedAt: null
	};
}
async function seed(page: Page, value: RoundCheckpoint) {
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await page.evaluate(async (checkpoint) => {
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open('morphi-checkpoint', 1);
			opening.onupgradeneeded = () => opening.result.createObjectStore('active');
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => {
				const db = opening.result;
				const tx = db.transaction('active', 'readwrite');
				tx.objectStore('active').put(checkpoint, checkpoint.owner ?? 'guest');
				tx.oncomplete = () => {
					db.close();
					resolve();
				};
				tx.onerror = () => {
					db.close();
					reject(tx.error);
				};
			};
		});
	}, value);
}
async function savedCheckpoint(page: Page): Promise<RoundCheckpoint | null> {
	return page.evaluate(
		() =>
			new Promise<RoundCheckpoint | null>((resolve, reject) => {
				const opening = indexedDB.open('morphi-checkpoint', 1);
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const db = opening.result;
					const tx = db.transaction('active', 'readonly');
					const request = tx.objectStore('active').get('guest');
					tx.oncomplete = () => {
						db.close();
						resolve((request.result as RoundCheckpoint | undefined) ?? null);
					};
					tx.onerror = () => {
						db.close();
						reject(tx.error);
					};
				};
			})
	);
}
async function resume(page: Page) {
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(page.locator('.game[data-family="memory"]')).toHaveAttribute(
		'data-phase',
		'playing'
	);
}
test.beforeEach(async ({ context }) => {
	await context.route('**/api/play/availability**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(
				new URL(route.request().url()).searchParams.has('family')
					? { available: true }
					: {
							available: ['memory', 'block', 'connect'],
							weights: { memory: 1, block: 1, connect: 1 }
						}
			)
		})
	);
});

test('refresh resumes one open Memory card and autosaves the next accepted match with its saved look', async ({
	page
}) => {
	await seed(page, checkpoint());
	await page.goto('/play');
	await resume(page);
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(1);
	await expect(page.locator('.game')).toHaveAttribute('data-theme-version', 'saved-look-version');
	const matching = initial.cards.findIndex(
		(card, index) => index !== 0 && card.symbol === initial.cards[0]!.symbol
	);
	await page.locator('.memory-card').nth(matching).click();
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(2);
	await page.reload();
	await resume(page);
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(2);
	await expect(page.locator('.game')).toHaveAttribute('data-theme-version', 'saved-look-version');
});
test('hidden-page checkpoint preserves the remaining Memory mismatch deadline after refresh', async ({
	page
}) => {
	await page.clock.install();
	await page.clock.pauseAt(new Date());
	const value = checkpoint([{ index: 0 }, { index: different }]);
	value.state.pending.mismatch = 500;
	await seed(page, value);
	await page.goto('/play');
	await resume(page);
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(2);
	await page.clock.runFor(200);
	// Visibility loss is the specified save boundary; reload may skip lifecycle events.
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect.poll(async () => (await savedCheckpoint(page))?.state.pending.mismatch).toBe(300);
	await page.reload();
	await resume(page);
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(2);
	await page.clock.runFor(299);
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(2);
	await page.clock.runFor(1);
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(0);
});
test('an engine-version mismatch offers a new puzzle and never replays old moves', async ({
	page
}) => {
	await seed(page, { ...checkpoint(), engineVersion: 'memory-future' });
	await page.goto('/play');
	await expect(
		page.getByText('This saved puzzle can no longer be resumed. Choose a new puzzle.')
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Abandon + New', exact: true }).click();
	await expect(page.locator('.game')).toBeVisible({ timeout: 20000 });
});
test('an invalid local score version cannot replay saved Memory moves', async ({ page }) => {
	await seed(page, {
		...checkpoint(),
		scoring: { version: 'unrecognized-score', values: memory.scoring.defaults }
	});
	await page.goto('/play');
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(
		page.getByText('This saved puzzle can no longer be resumed. Choose a new puzzle.')
	).toBeVisible();
	await expect(page.locator('.game')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Abandon + New', exact: true })).toBeVisible();
});
test('leaving during checkpoint ownership acquisition releases its late live-tab lock', async ({
	page
}) => {
	await seed(page, checkpoint());
	await page.goto('/play');
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
	await page.evaluate(() => {
		const open = indexedDB.open.bind(indexedDB);
		let stalled = false;
		indexedDB.open = (name, version) => {
			if (name === 'morphi-checkpoint' && !stalled) {
				stalled = true;
				return {} as IDBOpenDBRequest;
			}
			return version === undefined ? open(name) : open(name, version);
		};
	});
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	const heldRoundLocks = () =>
		page.evaluate(async () => {
			const { held = [] } = await navigator.locks.query();
			return held.filter((lock) => lock.name === 'morphi-round:guest').length;
		});
	await expect.poll(heldRoundLocks).toBe(1);
	await page.getByRole('button', { name: 'Return Home', exact: true }).click();
	await expect(page).toHaveURL('/');
	await expect.poll(heldRoundLocks).toBe(0);
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Continue your puzzle?', exact: true })
	).toBeVisible();
	await resume(page);
	await expect(
		page.getByRole('heading', { name: 'This puzzle is open in another tab.' })
	).toHaveCount(0);
});
test('takeover replays the latest accepted moves instead of the displaced tab board', async ({
	page,
	context
}) => {
	const value = checkpoint();
	value.state.elapsedMs = 1234.5;
	await seed(page, value);
	await page.goto('/play');
	await resume(page);
	const matching = initial.cards.findIndex(
		(card, index) => index !== 0 && card.symbol === initial.cards[0]!.symbol
	);
	await page.locator('.memory-card').nth(matching).click();
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(2);
	await expect.poll(async () => (await savedCheckpoint(page))?.moves.length).toBe(2);
	const second = await context.newPage();
	await second.goto('/play');
	await second.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(
		second.getByRole('heading', { name: 'This puzzle is open in another tab.' })
	).toBeVisible();
	await second.getByRole('button', { name: 'Take over', exact: true }).click();
	await expect(second.locator('.game')).toHaveAttribute('data-phase', 'playing');
	await expect(
		page.getByRole('heading', { name: 'This puzzle is open in another tab.' })
	).toBeVisible();
	await expect(page.locator('.active-round')).toHaveAttribute('inert', '');
	await expect(second.locator('.memory-card[aria-pressed="true"]')).toHaveCount(2);
	await second.locator('.memory-card').nth(different).click();
	await expect(second.locator('.memory-card[aria-pressed="true"]')).toHaveCount(3);
	await expect.poll(async () => (await savedCheckpoint(second))?.moves.length).toBe(3);
	expect((await savedCheckpoint(second))?.rankedStartedAt).toBeNull();
	await page.bringToFront();
	await page.getByRole('button', { name: 'Take over', exact: true }).click();
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing');
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(3);
	await expect.poll(async () => (await savedCheckpoint(page))?.moves.length).toBe(3);
	await expect(
		second.getByRole('heading', { name: 'This puzzle is open in another tab.' })
	).toBeVisible();
});
test('Abandon + New takes ownership from the active tab and protects the new checkpoint', async ({
	page,
	context
}) => {
	const value = checkpoint();
	await seed(page, value);
	await page.goto('/play');
	await resume(page);
	const matching = initial.cards.findIndex(
		(card, index) => index !== 0 && card.symbol === initial.cards[0]!.symbol
	);
	await page.locator('.memory-card').nth(matching).click();
	await expect.poll(async () => (await savedCheckpoint(page))?.moves.length).toBe(2);
	const second = await context.newPage();
	await second.route('**/api/play/availability**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(
				new URL(route.request().url()).searchParams.has('family')
					? { available: true }
					: { available: ['memory'], weights: { memory: 1, block: 0, connect: 0 } }
			)
		})
	);
	await second.goto('/play');
	await second.getByRole('button', { name: 'Abandon + New', exact: true }).click();
	await expect(second.locator('.game[data-family="memory"]')).toHaveAttribute(
		'data-phase',
		'playing',
		{ timeout: 20000 }
	);
	await expect(second.locator('.ranked-conflict')).toHaveCount(0);
	await expect(second.locator('.active-round')).not.toHaveAttribute('inert', '');
	await expect(
		page.getByRole('heading', { name: 'This puzzle is open in another tab.' })
	).toBeVisible();
	await expect(page.locator('.active-round')).toHaveAttribute('inert', '');
	await second.locator('.memory-card').first().click();
	await expect.poll(async () => (await savedCheckpoint(second))?.moves.length).toBe(1);
	const fresh = await savedCheckpoint(second);
	expect(fresh?.id).toBeTruthy();
	expect(fresh?.id).not.toBe(value.id);
	// A save boundary in the displaced tab must not restore its accepted old moves.
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	expect((await savedCheckpoint(page))?.id).toBe(fresh?.id);
	expect((await savedCheckpoint(page))?.moves).toEqual([{ index: 0 }]);
});
test('recovery of a final accepted move queues completion before showing the result', async ({
	page
}) => {
	const pairs = new Map<string, number[]>();
	initial.cards.forEach((card, index) =>
		pairs.set(card.symbol, [...(pairs.get(card.symbol) ?? []), index])
	);
	const value = checkpoint([...pairs.values()].flat().map((index) => ({ index })));
	await seed(page, value);
	await page.goto('/play');
	await page.getByRole('button', { name: 'Resume', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Next puzzle', exact: true })).toBeVisible({
		timeout: 10000
	});
	await page.reload();
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
});
for (const failure of ['stalled', 'failed'] as const)
	test(`the final live move survives a ${failure} completed-run write and refresh`, async ({
		page
	}) => {
		const pairs = new Map<string, number[]>();
		initial.cards.forEach((card, index) =>
			pairs.set(card.symbol, [...(pairs.get(card.symbol) ?? []), index])
		);
		const moves = [...pairs.values()].flat().map((index) => ({ index }));
		const final = moves.pop()!;
		await seed(page, checkpoint(moves));
		await page.goto('/play');
		await resume(page);
		await page.evaluate((failure) => {
			const open = indexedDB.open.bind(indexedDB);
			indexedDB.open = (name, version) => {
				if (name === 'morphi-progress') {
					const request = {} as IDBOpenDBRequest;
					if (failure === 'failed') queueMicrotask(() => request.onerror?.(new Event('error')));
					return request;
				}
				return version === undefined ? open(name) : open(name, version);
			};
		}, failure);
		await page.locator('.memory-card').nth(final.index).click();
		if (failure === 'failed')
			await expect(page.getByRole('button', { name: 'Next puzzle', exact: true })).toBeVisible({
				timeout: 10000
			});
		await expect
			.poll(() =>
				page.evaluate(async () => {
					return new Promise<number>((resolve, reject) => {
						const opening = indexedDB.open('morphi-checkpoint', 1);
						opening.onerror = () => reject(opening.error);
						opening.onsuccess = () => {
							const db = opening.result;
							const tx = db.transaction('active', 'readonly');
							const reading = tx.objectStore('active').get('guest');
							reading.onsuccess = () =>
								resolve((reading.result as RoundCheckpoint | undefined)?.moves.length ?? 0);
							tx.oncomplete = () => db.close();
						};
					});
				})
			)
			.toBe(moves.length + 1);
		await page.reload();
		await page.getByRole('button', { name: 'Resume', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Next puzzle', exact: true })).toBeVisible({
			timeout: 10000
		});
	});

test('Home to Play refreshes account status and offers the active ranked session before starting', async ({
	page
}) => {
	const value = checkpoint();
	const actions: string[] = [];
	let starts = 0;
	let releases = 0;
	await page.route('**/api/account/status', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ signedIn: true, ownerKey: 'signed-owner' })
		})
	);
	await page.route('**/api/play/active**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				id: value.id,
				family: value.family,
				seed: value.seed,
				engineVersion: value.engineVersion,
				startedAt: Date.now() - 10000,
				expiresAt: Date.now() + 7200000,
				saving: false,
				theme: value.theme,
				scoring: value.scoring
			})
		})
	);
	await page.route('**/api/play/start', (route) => {
		starts++;
		return route.abort();
	});
	await page.route('**/api/play/abandon', (route) => {
		releases++;
		return route.abort();
	});
	await page.route('**/api/play/activity', (route) => {
		actions.push((route.request().postDataJSON() as { action: string }).action);
		return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
	expect(starts).toBe(0);
	await resume(page);
	await expect.poll(() => actions).toContain('start');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect.poll(() => actions).toContain('abandon');
	expect(releases).toBe(0);
	expect(starts).toBe(0);
});
test('a stale same-id ranked checkpoint cannot replace the issued Memory variant on resume', async ({
	page
}) => {
	const local = checkpoint();
	local.owner = 'signed-owner';
	local.rankedSession = local.id;
	local.variant = 'memory:trios';
	local.scoring = { version: 'memory-trios-v1', values: { trio: 1500, mismatch: 150, second: 5 } };
	await page.route('**/api/account/status', (route) =>
		route.fulfill({ json: { signedIn: true, ownerKey: 'signed-owner' } })
	);
	await page.route('**/api/play/active**', (route) =>
		route.fulfill({
			json: {
				id: local.id,
				family: 'memory',
				variant: 'memory:classic',
				seed: local.seed,
				engineVersion: local.engineVersion,
				startedAt: Date.now() - 10000,
				expiresAt: Date.now() + 7200000,
				saving: false,
				theme: local.theme,
				scoring: { version: 'brief-v1', values: memory.scoring.defaults }
			}
		})
	);
	await page.route('**/api/play/activity', (route) => route.fulfill({ json: { ok: true } }));
	await seed(page, local);
	await page.goto('/play');
	await resume(page);
	await expect(page.locator('.game')).toHaveAttribute('data-variant', 'memory:classic');
	await expect(page.locator('.memory-card[aria-pressed="true"]')).toHaveCount(0);
});
test('an incompatible active ranked issuance offers explicit abandonment without replay or automatic start', async ({
	page
}) => {
	let starts = 0;
	await page.route('**/api/account/status', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ signedIn: true, ownerKey: 'signed-owner' })
		})
	);
	await page.route('**/api/play/active**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: checkpoint().id, expiresAt: Date.now() + 7200000, saving: false })
		})
	);
	await page.route('**/api/play/start', (route) => {
		starts++;
		return route.abort();
	});
	await page.goto('/play');
	await expect(
		page.getByRole('button', { name: 'Abandon previous round and play here', exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
	await expect(page.locator('.game')).toHaveCount(0);
	expect(starts).toBe(0);
});
