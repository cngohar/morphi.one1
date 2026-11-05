import { expect, test, type Page } from '@playwright/test';

type PlayedSound = { kind: string; pitch: number; at: number };

async function memorySounds(page: Page, variant: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		localStorage.setItem('morphi.sound', 'off');
		const originalRandom = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 2) {
				array[0] = 0;
				array[1] = 42;
				return array;
			}
			return originalRandom(array);
		};
		const encoded = new WeakMap<ArrayBuffer, string>();
		const decoded = new WeakMap<AudioBuffer, string>();
		const played: PlayedSound[] = [];
		const loaded: string[] = [];
		Object.assign(window, { variantPlayedSounds: played, variantLoadedSounds: loaded });
		const arrayBuffer = Response.prototype.arrayBuffer;
		Response.prototype.arrayBuffer = async function () {
			const bytes = await arrayBuffer.call(this);
			const kind = this.url && new URL(this.url).pathname.match(/\/audio\/([^/]+)\.mp3$/)?.[1];
			if (kind) encoded.set(bytes, kind);
			return bytes;
		};
		const decode = AudioContext.prototype.decodeAudioData;
		AudioContext.prototype.decodeAudioData = function (bytes) {
			return decode.call(this, bytes).then((buffer) => {
				const kind = encoded.get(bytes);
				if (kind) {
					decoded.set(buffer, kind);
					loaded.push(kind);
				}
				return buffer;
			});
		};
		const createSource = AudioContext.prototype.createBufferSource;
		AudioContext.prototype.createBufferSource = function () {
			const node = createSource.call(this);
			const start = node.start.bind(node);
			node.start = (...arguments_) => {
				start(...arguments_);
				played.push({
					kind: node.buffer ? (decoded.get(node.buffer) ?? 'unknown') : 'unknown',
					pitch: node.playbackRate.value,
					at: performance.now()
				});
			};
			return node;
		};
	});
	await page.route('**/api/play/availability**', (route) =>
		route.fulfill({
			json: new URL(route.request().url()).searchParams.has('family')
				? { available: true }
				: { available: ['memory'], weights: { memory: 1 }, variants: { memory: [variant] } }
		})
	);
	await page.route('**/api/play/scoring**', (route) =>
		route.fulfill({
			json:
				variant === 'memory:trios'
					? { version: 'memory-trios-v1', values: { trio: 1500, mismatch: 150, second: 5 } }
					: { version: 'brief-v1', values: { pair: 1000, mismatch: 150, second: 5 } }
		})
	);
	const requests: string[] = [];
	page.on('request', (request) => requests.push(request.url()));
	await page.goto('/play');
	await expect(page.locator('.game')).toHaveAttribute('data-variant', variant);
	await expect(page.locator('.game')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await page.getByRole('button', { name: 'Turn sound on' }).click();
	await expect
		.poll(() => page.evaluate(() => Reflect.get(window, 'variantLoadedSounds').length))
		.toBe(25);
	return requests;
}

const played = (page: Page): Promise<PlayedSound[]> =>
	page.evaluate(() => Reflect.get(window, 'variantPlayedSounds'));
const symbols = (page: Page) =>
	page
		.locator('.memory-card')
		.evaluateAll((cards) => cards.map((card) => card.querySelector('.card-front svg')!.outerHTML));
const cue = async (page: Page, kind: string) =>
	(await played(page)).filter((item) => item.kind === kind);

function sameOrigin(page: Page, requests: string[]) {
	const origin = new URL(page.url()).origin;
	expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
}

for (const [variant, kind, matchSize] of [
	['memory:classic', 'match', 2],
	['memory:trios', 'trio-match', 3]
] as const) {
	test(`S4 ${variant} plays its match asset with the shared streak pitch`, async ({ page }) => {
		const requests = await memorySounds(page, variant);
		const groups = new Map<string, number[]>();
		for (const [index, symbol] of (await symbols(page)).entries())
			groups.set(symbol, [...(groups.get(symbol) ?? []), index]);
		for (const indices of [...groups.values()].slice(0, 2)) {
			expect(indices).toHaveLength(matchSize);
			for (const index of indices) await page.locator('.memory-card').nth(index).click();
		}
		const matches = await cue(page, kind);
		expect(matches).toHaveLength(2);
		expect(matches[0]!.pitch).toBe(1);
		expect(matches[1]!.pitch).toBeCloseTo(1.025, 6);
		expect(await cue(page, kind === 'match' ? 'trio-match' : 'match')).toEqual([]);
		expect(await cue(page, 'win')).toEqual([]);
		sameOrigin(page, requests);
	});
}

test('S4 moving miss plays reshuffle once after the active hold across repeated resume events', async ({
	page
}) => {
	const requests = await memorySounds(page, 'memory:moving');
	const deck = await symbols(page);
	const second = deck.findIndex((symbol) => symbol !== deck[0]);
	await page.locator('.memory-card').nth(0).click();
	await page.locator('.memory-card').nth(second).click();
	expect(await cue(page, 'mismatch')).toHaveLength(1);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(650);
	expect(await cue(page, 'reshuffle')).toEqual([]);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		for (let i = 0; i < 3; i++) document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect.poll(async () => (await cue(page, 'reshuffle')).length).toBe(1);
	const mismatch = (await cue(page, 'mismatch'))[0]!;
	const reshuffle = (await cue(page, 'reshuffle'))[0]!;
	expect(reshuffle.at - mismatch.at).toBeGreaterThanOrEqual(1000);
	await page.evaluate(() => {
		for (let i = 0; i < 3; i++) document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(650);
	expect(await cue(page, 'reshuffle')).toHaveLength(1);
	sameOrigin(page, requests);
});
