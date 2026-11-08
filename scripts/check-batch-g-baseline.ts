import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'build/v1.3.5.14/new-baseline');
const html = await readFile(resolve(root, 'static/demo/v1.3.5.14-batch-g.html'), 'utf8');
const fingerprint = createHash('sha256').update(html).digest('hex');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
assert(script, 'Fixture has an inline script to lint');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'fixture.js'), script);
if (process.argv.includes('--extract-only')) process.exit(0);

interface PreviewState {
	pairCount: number;
	deal: number;
	stacks: number[][];
	selected: number[];
	outcome: 'match' | 'mismatch' | null;
	attempts: number;
	misses: number;
	cleared: number;
	guideStep: number | null;
	finished: boolean;
}
interface FixtureWindow {
	TimeStrataPreview: { getState: () => PreviewState };
}
const checks: string[] = [];
const errors: string[] = [];
const consoleErrors: string[] = [];
const requests: { method: string; url: string }[] = [];
const layouts: unknown[] = [];
const screenshots: string[] = [];
function check(value: unknown, label: string) {
	assert(value, label);
	checks.push(label);
}
async function state(page: Page): Promise<PreviewState> {
	return page.evaluate(() => (window as unknown as FixtureWindow).TimeStrataPreview.getState());
}
function topPair(stacks: number[][], equal: boolean): [number, number] {
	for (let first = 0; first < stacks.length; first++) {
		for (let second = first + 1; second < stacks.length; second++) {
			if (
				stacks[first].length &&
				stacks[second].length &&
				(stacks[first].at(-1) === stacks[second].at(-1)) === equal
			)
				return [first, second];
		}
	}
	throw new Error(equal ? 'Generated deal deadlocked' : 'Review deal needs a mismatch example');
}
async function clickPair(page: Page, pair: [number, number]) {
	for (const index of pair) await page.locator('button[data-stack="' + index + '"]').click();
}
async function capture(page: Page, name: string) {
	await page.evaluate(() => scrollTo(0, 0));
	await page.screenshot({ path: resolve(output, name + '.png') });
	screenshots.push(name + '.png');
}
async function bounds(page: Page, label: string, columns: number) {
	const layout = await page.evaluate(() => {
		const box = (element: Element) => {
			const rect = element.getBoundingClientRect();
			return {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
				right: rect.right,
				bottom: rect.bottom
			};
		};
		return {
			width: innerWidth,
			height: innerHeight,
			overflow: document.documentElement.scrollWidth - innerWidth,
			columns: getComputedStyle(document.getElementById('board')!).gridTemplateColumns.split(' ')
				.length,
			cards: Array.from(document.querySelectorAll<HTMLButtonElement>('.top-card'))
				.filter((card) => !card.hidden)
				.map(box),
			controls: Array.from(document.querySelectorAll('.play .btn')).map(box),
			play: box(document.querySelector('.play')!),
			cardBackground: getComputedStyle(document.querySelector('.top-card')!).backgroundColor
		};
	});
	check(layout.overflow <= 0, label + ': no horizontal overflow');
	check(layout.columns === columns, label + ': expected stack reflow');
	for (const item of [...layout.cards, ...layout.controls]) {
		check(item.width >= 44 && item.height >= 44, label + ': touch target >=44px');
		check(
			item.x >= 0 && item.right <= layout.width && item.y >= 0 && item.bottom <= layout.height,
			label + ': game target inside viewport'
		);
	}
	layouts.push({ label, ...layout });
}
function assertSolvable(value: PreviewState) {
	const stacks = value.stacks.map((stack) => stack.slice());
	assert.equal(stacks.length, 4);
	assert(stacks.every((stack) => stack.length === value.pairCount / 2));
	const counts = new Map<number, number>();
	for (const symbol of stacks.flat()) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
	assert.equal(counts.size, value.pairCount);
	assert([...counts.values()].every((count) => count === 2));
	for (let step = 0; step < value.pairCount; step++) {
		const pair = topPair(stacks, true);
		for (const index of pair) stacks[index].pop();
	}
	assert(stacks.every((stack) => stack.length === 0));
}

const assets = new Map([
	['/demo/v1.3.5.14-batch-g.html', { body: Buffer.from(html), type: 'text/html; charset=utf-8' }],
	[
		'/demo/anime.min.js',
		{ body: await readFile(resolve(root, 'static/demo/anime.min.js')), type: 'text/javascript' }
	],
	[
		'/demo/nunito-latin-wght-normal.woff2',
		{
			body: await readFile(resolve(root, 'static/demo/nunito-latin-wght-normal.woff2')),
			type: 'font/woff2'
		}
	]
]);
const server = createServer((request, response) => {
	const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
	if (pathname === '/favicon.ico') {
		response.writeHead(204).end();
		return;
	}
	const asset = assets.get(pathname);
	if (request.method !== 'GET' || !asset) {
		response.writeHead(404).end();
		return;
	}
	response.writeHead(200, { 'content-type': asset.type }).end(asset.body);
});
let browser: Browser | undefined;
let failure: string | null = null;
let version = '';
try {
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	assert(address && typeof address === 'object');
	const url = 'http://127.0.0.1:' + address.port + '/demo/v1.3.5.14-batch-g.html';
	browser = await chromium.launch();
	version = browser.version();
	const page = await browser.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));

	for (const [width, height, columns] of [
		[390, 844, 2],
		[844, 390, 4],
		[1280, 800, 4]
	]) {
		await page.setViewportSize({ width, height });
		await page.goto(url);
		await page.evaluate(() => document.fonts.ready);
		const size = width + 'x' + height;
		for (const count of [6, 8, 10]) {
			await page.locator('#pairCount').selectOption(String(count));
			const initial = await state(page);
			assertSolvable(initial);
			check(
				initial.selected.length === 0 && initial.outcome === null,
				size + '/' + count + ': clean deal'
			);
			check(
				(await page.locator('.top-card').count()) === 4 &&
					(await page.locator('.buried button,.buried [tabindex]').count()) === 0,
				size + '/' + count + ': only top buttons selectable'
			);
			check(
				(await page.locator('.top-card[data-pair],.face-symbol').count()) === 0,
				size + '/' + count + ': faces concealed'
			);
			await bounds(page, size + '/' + count + '/ready', columns);
			await capture(page, 'baseline-' + count + '-' + size);

			await page.locator('[data-stack="0"]').click();
			check((await state(page)).selected.length === 1, size + '/' + count + ': one reveal');
			await page.locator('#cancel').click();
			assert.deepEqual(await state(page), initial);
			check(true, size + '/' + count + ': free cancellation preserves deal');
			await page.locator('[data-stack="0"]').click();
			await page.locator('[data-stack="0"]').click();
			assert.deepEqual(await state(page), initial);
			check(true, size + '/' + count + ': repeated top cancels instead of supplying second card');

			await clickPair(page, topPair(initial.stacks, false));
			const mismatch = await state(page);
			check(
				mismatch.outcome === 'mismatch' && mismatch.attempts === 1 && mismatch.misses === 1,
				size + '/' + count + ': real mismatch'
			);
			assert.deepEqual(mismatch.stacks, initial.stacks);
			check(
				(await page.locator('.top-card:disabled').count()) === 4,
				size + '/' + count + ': resolution input guard'
			);
			await bounds(page, size + '/' + count + '/mismatch', columns);
			if (count === 6) await capture(page, 'mismatch-' + size);
			await page.locator('#continue').click();
			check(
				(await state(page)).outcome === null && (await state(page)).selected.length === 0,
				size + '/' + count + ': mismatch closes'
			);
			assert.deepEqual((await state(page)).stacks, initial.stacks);

			const pair = topPair(initial.stacks, true);
			await clickPair(page, pair);
			check((await state(page)).outcome === 'match', size + '/' + count + ': readable match');
			await bounds(page, size + '/' + count + '/match', columns);
			if (count === 6) await capture(page, 'match-' + size);
			await page.locator('#continue').click();
			const lifted = await state(page);
			check(
				lifted.cleared === 1 && lifted.stacks.flat().length === count * 2 - 2,
				size + '/' + count + ': pair lifted'
			);
			for (let index = 0; index < 4; index++) {
				const expected = pair.includes(index)
					? initial.stacks[index].slice(0, -1)
					: initial.stacks[index];
				assert.deepEqual(lifted.stacks[index], expected);
			}
			check(
				(await page.locator('.top-card[data-pair],.face-symbol').count()) === 0,
				size + '/' + count + ': new layers face down'
			);

			while (!(await state(page)).finished) {
				await clickPair(page, topPair((await state(page)).stacks, true));
				await page.locator('#continue').click();
			}
			const completed = await state(page);
			check(
				completed.cleared === count && completed.attempts === count + 1 && completed.misses === 1,
				size + '/' + count + ': full completion'
			);
			check(
				(await page.locator('.empty-well').count()) === 4 &&
					(await page.locator('#completion').isVisible()),
				size + '/' + count + ': empty stacks and finished result'
			);
			check(
				await page.locator('#reset').evaluate((element) => element === document.activeElement),
				size + '/' + count + ': completion focus'
			);
			await bounds(page, size + '/' + count + '/complete', columns);
			if (count === 6) await capture(page, 'complete-' + size);
			await page.locator('#reset').click();
			assert.deepEqual(await state(page), initial);
			check(true, size + '/' + count + ': completed-deal reset repeats layout');
		}
	}

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(url);
	for (const count of [6, 8, 10]) {
		await page.locator('#pairCount').selectOption(String(count));
		const samples = await page.evaluate(() => {
			const values: PreviewState[] = [];
			for (let index = 0; index < 32; index++) {
				values.push((window as unknown as FixtureWindow).TimeStrataPreview.getState());
				(document.getElementById('newDeal') as HTMLButtonElement).click();
			}
			return values;
		});
		samples.forEach(assertSolvable);
		check(
			true,
			count + ': 32 generated deals have pairs, balanced depths and a legal full-clear path'
		);
	}
	await page.goto(url);
	const initial = await state(page);
	await page.locator('#newDeal').click();
	check(
		(await state(page)).deal === 2 &&
			JSON.stringify((await state(page)).stacks) !== JSON.stringify(initial.stacks),
		'New deal changes a repeatable fixture deck'
	);
	await page.locator('[data-stack="0"]').click();
	await page.locator('#reset').click();
	check(
		(await state(page)).selected.length === 0 && (await state(page)).attempts === 0,
		'Reset clears single selection'
	);
	await clickPair(page, topPair((await state(page)).stacks, false));
	await page.locator('#reset').click();
	check(
		(await state(page)).outcome === null && (await state(page)).attempts === 0,
		'Reset clears unresolved outcome'
	);

	await page.goto(url);
	const first = page.locator('[data-stack="0"]');
	await first.focus();
	await page.keyboard.press('Space');
	check((await state(page)).selected[0] === 0, 'Keyboard Space reveals first top');
	await page.keyboard.press('Tab');
	check(
		await page
			.locator('[data-stack="1"]')
			.evaluate((element) => document.activeElement === element),
		'Keyboard Tab reaches next top'
	);
	await page.keyboard.press('Enter');
	check(
		await page.locator('#continue').evaluate((element) => document.activeElement === element),
		'Attempt transfers focus to Continue'
	);
	await page.keyboard.press('Enter');
	check((await state(page)).cleared === 1, 'Keyboard Enter lifts matching tops');
	await first.focus();
	await page.keyboard.press('Space');
	const beforeResize = await state(page);
	await page.setViewportSize({ width: 390, height: 844 });
	assert.deepEqual(await state(page), beforeResize);
	await page.setViewportSize({ width: 844, height: 390 });
	assert.deepEqual(await state(page), beforeResize);
	check(true, 'Rotation preserves selected top and stack state');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	assert.deepEqual(await state(page), beforeResize);
	await page.locator('#cancel').click();
	check((await state(page)).selected.length === 0, 'Reduced motion keeps cancellation available');

	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(url);
	await page.locator('#example').click();
	check(
		(await state(page)).guideStep === 0 && (await state(page)).outcome === 'match',
		'Example starts with a legal exposed pair'
	);
	await page.locator('#exampleNext').click();
	check(
		(await state(page)).cleared === 1 && (await state(page)).guideStep === 1,
		'Example lifts pair through normal handler'
	);
	const exampleDepth = (await state(page)).stacks;
	await page.locator('#exampleNext').click();
	check(
		(await state(page)).outcome === 'mismatch' && (await state(page)).guideStep === 2,
		'Example performs actual mismatch'
	);
	await page.locator('#exampleNext').click();
	assert.deepEqual((await state(page)).stacks, exampleDepth);
	check(
		(await state(page)).guideStep === 3 && (await state(page)).misses === 1,
		'Example mismatch preserves layer depths'
	);
	await capture(page, 'example-1280x800');
	await page.locator('#exampleNext').click();
	check((await state(page)).guideStep === null, 'Example hands back manual play');

	const fallback = await browser.newPage({
		viewport: { width: 390, height: 844 },
		reducedMotion: 'reduce'
	});
	fallback.on('pageerror', (error) => errors.push(error.message));
	await fallback.route('**/anime.min.js', (route) =>
		route.fulfill({ contentType: 'text/javascript', body: '' })
	);
	await fallback.goto(url);
	await clickPair(fallback, topPair((await state(fallback)).stacks, true));
	await fallback.locator('#continue').click();
	check(
		(await state(fallback)).cleared === 1,
		'Missing animation asset and reduced motion leave gameplay usable'
	);
	await fallback.close();

	check(errors.length === 0, 'Zero uncaught browser errors');
	check(consoleErrors.length === 0, 'Zero unexpected fixture console errors');
	check(
		requests.every((request) => request.method === 'GET'),
		'Fixture sends no mutation requests'
	);
	const after = await readFile(resolve(root, 'static/demo/v1.3.5.14-batch-g.html'), 'utf8');
	check(
		createHash('sha256').update(after).digest('hex') === fingerprint,
		'Source stayed stable during checks'
	);
} catch (error) {
	failure = error instanceof Error ? error.message : String(error);
} finally {
	await browser?.close();
	server.close();
	await writeFile(
		resolve(output, 'verification.json'),
		JSON.stringify(
			{
				status: failure ? 'FAIL' : 'PASS',
				date: new Date().toISOString(),
				command: 'bun scripts/check-batch-g-baseline.ts',
				browser: 'Chromium ' + version,
				execution: 'Direct parent; one browser, serial checks',
				fingerprint,
				checks,
				layouts,
				screenshots,
				errors,
				consoleErrors,
				failure,
				limitations: [
					'Fixture-only checks; no app/D1/engine vector verification',
					'Responsive emulation; no physical-device review'
				]
			},
			null,
			2
		) + '\n'
	);
}
if (failure) throw new Error(failure);
console.info(
	'Time Strata fixture: ' +
		checks.length +
		' checks passed; 96 solvable deals; 3 viewports. Evidence: build/v1.3.5.14/new-baseline/verification.json'
);
