import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'build/v1.3.5.15/preview');
const fixturePath = resolve(root, 'static/demo/v1.3.5.15-batch-h.html');
const html = await readFile(fixturePath, 'utf8');
const fingerprint = createHash('sha256').update(html).digest('hex');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
assert(script, 'Fixture supplies one inline script for scoped lint');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'fixture.js'), script);
if (process.argv.includes('--extract-only')) process.exit(0);

const modes = [
	'strata-linked',
	'strata-sweep',
	'strata-shelf',
	'strata-cycle',
	'strata-empty-well',
	'strata-glimpse',
	'strata-chain',
	'strata-echo',
	'strata-slip',
	'strata-order'
] as const;
type Mode = (typeof modes)[number];
type Outcome = 'match' | 'mismatch' | 'order-blocked' | 'echo' | null;
interface PreviewState {
	mode: Mode;
	pairCount: number;
	deal: number;
	stacks: number[][];
	selected: number[];
	outcome: Outcome;
	attempts: number;
	misses: number;
	cleared: number;
	shelf: { symbol: number; origin: number } | null;
	clues: number[];
	order: number[];
	guideStep: number | null;
	finished: boolean;
}
interface FixtureWindow {
	BatchHPreview: { getState: () => PreviewState };
}
type Action =
	| { kind: 'select'; stack: number }
	| { kind: 'continue' }
	| { kind: 'utility'; source: number; destination?: number };
const checks: string[] = [];
const errors: string[] = [];
const consoleErrors: string[] = [];
const requests: { method: string; url: string }[] = [];
const layouts: unknown[] = [];
const screenshots: string[] = [];
let sampleCount = 0;
let uiActions = 0;
function check(value: unknown, label: string) {
	assert(value, label);
	checks.push(label);
}
async function state(page: Page): Promise<PreviewState> {
	return page.evaluate(() => (window as unknown as FixtureWindow).BatchHPreview.getState());
}
function top(value: PreviewState, stack: number) {
	return stack === 4 ? value.shelf?.symbol : value.stacks[stack]?.at(-1);
}
function eligible(value: PreviewState, stack: number) {
	if (value.outcome !== null || value.finished || top(value, stack) === undefined) return false;
	if (stack === 4) return value.mode === 'strata-shelf';
	if (
		value.mode === 'strata-sweep' &&
		value.stacks[stack].length !== Math.max(...value.stacks.map((pile) => pile.length))
	)
		return false;
	if (value.mode === 'strata-linked' && value.selected.length === 1 && stack !== value.selected[0])
		return Math.abs(stack - value.selected[0]) % 2 === 1;
	return true;
}
function core(value: PreviewState) {
	return { ...value, guideStep: null };
}
// Independent review-rule model. The browser only supplies a snapshot; each predicted transition
// is replayed through native controls and compared with the real fixture state.
function expected(before: PreviewState, action: Action): PreviewState {
	const value = structuredClone(before);
	if (action.kind === 'select') {
		const stack = action.stack;
		if (!eligible(value, stack)) return value;
		if (value.selected.includes(stack)) {
			value.selected = [];
			return value;
		}
		value.selected.push(stack);
		if (value.selected.length === 2) {
			value.attempts++;
			value.outcome =
				top(value, value.selected[0]) === top(value, value.selected[1]) ? 'match' : 'mismatch';
			if (
				value.mode === 'strata-order' &&
				value.outcome === 'match' &&
				top(value, stack) !== value.order[value.cleared]
			)
				value.outcome = 'order-blocked';
			if (value.outcome !== 'match') value.misses++;
		}
	} else if (action.kind === 'utility') {
		if (value.selected.length || value.outcome !== null || value.finished) return value;
		const { source, destination } = action;
		if (value.mode === 'strata-shelf') {
			if (value.shelf) {
				value.stacks[value.shelf.origin].push(value.shelf.symbol);
				value.shelf = null;
			} else if (value.stacks[source]?.length)
				value.shelf = { symbol: value.stacks[source].pop()!, origin: source };
		} else if (value.mode === 'strata-cycle' || value.mode === 'strata-slip') {
			if (value.stacks[source]?.length) value.stacks[source].unshift(value.stacks[source].pop()!);
		} else if (
			value.mode === 'strata-empty-well' &&
			destination !== undefined &&
			source !== destination &&
			value.stacks[source]?.length &&
			value.stacks[destination]?.length === 0
		) {
			value.stacks[destination].push(value.stacks[source].pop()!);
		}
	} else {
		if (value.outcome === null) return value;
		const previous = value.outcome;
		const affected = value.selected.slice();
		if (previous === 'match') {
			for (const stack of affected) {
				if (stack === 4) value.shelf = null;
				else value.stacks[stack].pop();
			}
			value.cleared++;
		} else if (previous === 'mismatch' && value.mode === 'strata-slip') {
			for (const stack of affected) value.stacks[stack].unshift(value.stacks[stack].pop()!);
		}
		value.selected = [];
		value.outcome = null;
		value.clues = [];
		value.finished = value.cleared === value.pairCount;
		if (
			!value.finished &&
			previous === 'match' &&
			value.mode === 'strata-chain' &&
			affected.every((stack) => value.stacks[stack]?.length) &&
			top(value, affected[0]) === top(value, affected[1])
		) {
			value.selected = affected;
			value.outcome = 'match';
			value.attempts++;
		}
		if (!value.finished && previous === 'match' && value.mode === 'strata-echo') {
			value.clues = affected.filter((stack) => value.stacks[stack]?.length);
			if (value.clues.length) value.outcome = 'echo';
		}
	}
	return value;
}
function pair(value: PreviewState, equal: boolean, requireTarget = true): [number, number] {
	for (let first = 0; first < 5; first++) {
		if (!eligible(value, first)) continue;
		const selected = expected(value, { kind: 'select', stack: first });
		for (let second = first + 1; second < 5; second++) {
			if (!eligible(selected, second) || (top(value, first) === top(value, second)) !== equal)
				continue;
			if (
				requireTarget &&
				equal &&
				value.mode === 'strata-order' &&
				top(value, first) !== value.order[value.cleared]
			)
				continue;
			return [first, second];
		}
	}
	throw new Error(
		value.mode + ': no eligible ' + (equal ? 'matching' : 'mismatching') + ' exposed pair'
	);
}
function assertCards(value: PreviewState, balanced = false) {
	assert.equal(value.stacks.length, 4);
	if (balanced) assert(value.stacks.every((pile) => pile.length === value.pairCount / 2));
	const cards = value.stacks.flat().concat(value.shelf ? [value.shelf.symbol] : []);
	assert.equal(cards.length, (value.pairCount - value.cleared) * 2);
	const counts = new Map<number, number>();
	for (const symbol of cards) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
	assert([...counts.values()].every((count) => count === 2));
	if (balanced) {
		assert.equal(counts.size, value.pairCount);
		for (const symbol of counts.keys())
			assert.equal(
				value.stacks.filter((pile) => pile.includes(symbol)).length,
				2,
				'Copies occupy two different stacks'
			);
		assert.equal(new Set(value.order).size, value.pairCount);
		assert.deepEqual(
			[...value.order].sort((a, b) => a - b),
			[...counts.keys()].sort((a, b) => a - b)
		);
	}
}
function witness(initial: PreviewState): Action[] {
	let value = structuredClone(initial);
	const actions: Action[] = [];
	const apply = (action: Action) => {
		value = expected(value, action);
		assertCards(value);
		actions.push(action);
	};
	if (value.selected.length === 1) apply({ kind: 'select', stack: value.selected[0] });
	if (value.mode === 'strata-cycle' || value.mode === 'strata-slip') {
		if (value.outcome !== null) apply({ kind: 'continue' });
		const symbols = [...new Set(value.stacks.flat())].sort((a, b) => a - b);
		for (const symbol of symbols) {
			const members = value.stacks.flatMap((pile, stack) => (pile.includes(symbol) ? [stack] : []));
			assert.equal(members.length, 2);
			for (const stack of members) {
				let cycles = 0;
				while (top(value, stack) !== symbol) {
					apply({ kind: 'utility', source: stack });
					assert(++cycles <= 4, 'At most four cycles expose any card');
				}
			}
			for (const stack of members) apply({ kind: 'select', stack });
			assert.equal(value.outcome, 'match');
			apply({ kind: 'continue' });
		}
	} else {
		for (let step = 0; !value.finished; step++) {
			assert(step < 40, 'Bounded constructive full-clear witness');
			if (value.outcome !== null) {
				apply({ kind: 'continue' });
				continue;
			}
			const selected = pair(value, true);
			for (const stack of selected) apply({ kind: 'select', stack });
			assert.equal(value.outcome, 'match');
		}
	}
	assert(value.finished && value.stacks.every((pile) => !pile.length) && value.shelf === null);
	return actions;
}
async function perform(page: Page, action: Action, label: string) {
	const before = await state(page);
	const prediction = expected(before, action);
	if (action.kind === 'select')
		await page
			.locator(action.stack === 4 ? '#shelf' : '[data-stack="' + action.stack + '"]')
			.click();
	else if (action.kind === 'continue') await page.locator('#continue').click();
	else {
		if (!(before.mode === 'strata-shelf' && before.shelf))
			await page.locator('#source').selectOption(String(action.source));
		if (action.destination !== undefined)
			await page.locator('#destination').selectOption(String(action.destination));
		await page.locator('#utility').click();
	}
	const after = await state(page);
	assert.deepEqual(core(after), core(prediction), label + ': UI matches independent transition');
	assertCards(after);
	uiActions++;
	check(true, label + ': ' + action.kind + ' transition');
}
async function playPair(page: Page, selected: [number, number], label: string) {
	for (const stack of selected) await perform(page, { kind: 'select', stack }, label);
}
async function finish(page: Page, label: string) {
	for (const action of witness(await state(page))) await perform(page, action, label);
}
async function capture(page: Page, name: string) {
	await page.evaluate(() => scrollTo(0, 0));
	await page.screenshot({ path: resolve(output, name + '.png') });
	screenshots.push(name + '.png');
}
async function bounds(page: Page, label: string, columns: number) {
	await page.evaluate(() => scrollTo(0, 0));
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
		const visible = (element: Element) =>
			element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
		return {
			width: innerWidth,
			height: innerHeight,
			overflow: document.documentElement.scrollWidth - innerWidth,
			columns: getComputedStyle(document.getElementById('board')!).gridTemplateColumns.split(' ')
				.length,
			targets: Array.from(document.querySelectorAll('.play button,.play select'))
				.filter(visible)
				.map(box),
			play: box(document.querySelector('.play')!),
			cardBackground: getComputedStyle(document.querySelector('.top-card')!).backgroundColor
		};
	});
	check(layout.overflow <= 0, label + ': no horizontal overflow');
	check(layout.columns === columns, label + ': four logical stacks reflow correctly');
	for (const item of layout.targets) {
		check(item.width >= 44 && item.height >= 44, label + ': target >=44px');
		check(
			item.x >= 0 && item.right <= layout.width && item.y >= 0 && item.bottom <= layout.height,
			label + ': target inside viewport'
		);
		check(
			item.x >= layout.play.x &&
				item.right <= layout.play.right &&
				item.y >= layout.play.y &&
				item.bottom <= layout.play.bottom,
			label + ': target inside play frame'
		);
	}
	layouts.push({ label, ...layout });
}
async function selectMode(page: Page, mode: Mode, count = 6) {
	await page.locator('#variant').selectOption(mode);
	await page.locator('#pairCount').selectOption(String(count));
	await page.locator('#reset').click();
	await page.evaluate(() => scrollTo(0, 0));
}
async function contrast(page: Page, mode: Mode, label: string, columns: number) {
	await selectMode(page, mode);
	const initial = await state(page);
	if (mode === 'strata-linked') {
		await perform(page, { kind: 'select', stack: 0 }, label);
		check(
			await page.locator('[data-stack="2"]').isDisabled(),
			label + ': opposite stack blocked by logical ring'
		);
		const unchanged = await state(page);
		await page
			.locator('[data-stack="2"]')
			.evaluate((element) => (element as HTMLButtonElement).click());
		assert.deepEqual(await state(page), unchanged);
		check(true, label + ': blocked second top spends no attempt');
		await capture(page, mode + '-contrast-' + label);
		await perform(page, { kind: 'select', stack: 0 }, label);
	} else if (mode === 'strata-sweep') {
		await playPair(page, [0, 1], label);
		await perform(page, { kind: 'continue' }, label);
		check(
			top(await state(page), 0) === top(await state(page), 1),
			label + ': a lower equal pair is exposed'
		);
		check(
			(await page.locator('[data-stack="0"]').isDisabled()) &&
				(await page.locator('[data-stack="1"]').isDisabled()),
			label + ': lower equal pair cannot clear yet'
		);
		await capture(page, mode + '-contrast-' + label);
		await playPair(page, [2, 3], label);
		await perform(page, { kind: 'continue' }, label);
		check(
			await page.locator('[data-stack="0"]').isEnabled(),
			label + ': higher pair removal unlocks lower level'
		);
	} else if (mode === 'strata-shelf') {
		await perform(page, { kind: 'utility', source: 0 }, label);
		const parked = await state(page);
		check(
			parked.shelf?.symbol === initial.stacks[0].at(-1) &&
				parked.stacks[0].length === initial.stacks[0].length - 1,
			label + ': shelf uncovers a real layer'
		);
		check(
			await page.locator('#shelf').isVisible(),
			label + ': parked sample is visibly selectable'
		);
		await bounds(page, label + '/sample', columns);
		await capture(page, mode + '-contrast-' + label);
		await perform(page, { kind: 'select', stack: 4 }, label);
		check(await page.locator('#utility').isDisabled(), label + ': shelf utilities require idle');
		await page.locator('#cancel').click();
		assert.deepEqual(await state(page), parked);
		check(true, label + ': cancellation retains sample with no cost');
		await perform(page, { kind: 'utility', source: 0 }, label);
		assert.deepEqual(await state(page), initial);
		await perform(page, { kind: 'utility', source: 0 }, label);
		await playPair(page, [4, 1], label);
		await perform(page, { kind: 'continue' }, label);
		check(
			(await state(page)).shelf === null && (await state(page)).cleared === 1,
			label + ': sample match removes both real cards'
		);
		await finish(page, label + '/sample-clear');
	} else if (mode === 'strata-cycle' || mode === 'strata-slip') {
		if (mode === 'strata-slip') {
			await playPair(page, pair(initial, false), label);
			const pending = await state(page);
			assert.deepEqual(pending.stacks, initial.stacks);
			check(pending.outcome === 'mismatch', label + ': slipping is held until Continue');
			await perform(page, { kind: 'continue' }, label);
			check(
				JSON.stringify((await state(page)).stacks) !== JSON.stringify(initial.stacks),
				label + ': mismatched tops sink on Continue'
			);
		}
		const before = await state(page);
		await perform(page, { kind: 'utility', source: 0 }, label);
		const after = await state(page);
		check(
			after.stacks[0][0] === before.stacks[0].at(-1) && after.attempts === before.attempts,
			label + ': idle cycling costs no attempt'
		);
		await capture(page, mode + '-contrast-' + label);
		await finish(page, label + '/cycle-recovery');
	} else if (mode === 'strata-empty-well') {
		check(await page.locator('#utility').isDisabled(), label + ': no move without an empty well');
		for (let layer = 0; layer < 3; layer++) {
			await playPair(page, [0, 1], label);
			await perform(page, { kind: 'continue' }, label);
		}
		check(
			(await state(page)).stacks[0].length === 0 && (await state(page)).stacks[2].length === 3,
			label + ': reachable empty and deep wells coexist'
		);
		await perform(page, { kind: 'utility', source: 2, destination: 0 }, label);
		check(
			(await state(page)).stacks[0].length === 1 && (await state(page)).stacks[2].length === 2,
			label + ': empty well receives exactly one real top'
		);
		check(
			await page.locator('#destination option[value="0"]').isDisabled(),
			label + ': occupied destination cannot receive another top'
		);
		await capture(page, mode + '-contrast-' + label);
		await finish(page, label + '/empty-recovery');
	} else if (mode === 'strata-glimpse') {
		await perform(page, { kind: 'select', stack: 0 }, label);
		check(
			(await page.locator('.clue').filter({ hasText: 'Below:' }).count()) === 1,
			label + ': one immediately covered read-only clue'
		);
		check(
			(await page.locator('.clue button,.clue [tabindex]').count()) === 0,
			label + ': covered clue has no playable target'
		);
		await capture(page, mode + '-contrast-' + label);
		await page.locator('#cancel').click();
		assert.deepEqual(await state(page), initial);
		check(
			(await page.locator('.clue').filter({ hasText: 'Below:' }).count()) === 0,
			label + ': cancellation hides clue freely'
		);
		await playPair(page, pair(initial, true), label);
		check(
			(await page.locator('.clue').filter({ hasText: 'Below:' }).count()) === 0,
			label + ': second reveal hides clue'
		);
		await perform(page, { kind: 'continue' }, label);
	} else if (mode === 'strata-chain') {
		await playPair(page, [0, 1], label);
		await perform(page, { kind: 'continue' }, label);
		const chained = await state(page);
		check(
			chained.cleared === 1 &&
				chained.attempts === 2 &&
				chained.outcome === 'match' &&
				chained.selected.length === 2,
			label + ': next pair held with its own attempt'
		);
		check(await page.locator('#cancel').isDisabled(), label + ': held chain cannot cancel');
		await capture(page, mode + '-contrast-' + label);
		await perform(page, { kind: 'continue' }, label);
		check(
			(await state(page)).cleared === 2,
			label + ': each Continue removes just one chained pair'
		);
		await perform(page, { kind: 'continue' }, label);
		check(
			(await state(page)).outcome === null && (await state(page)).cleared === 3,
			label + ': exhausted chain releases normal play'
		);
	} else if (mode === 'strata-echo') {
		await playPair(page, pair(initial, true), label);
		await perform(page, { kind: 'continue' }, label);
		const echo = await state(page);
		check(
			echo.outcome === 'echo' &&
				echo.selected.length === 0 &&
				echo.clues.length === 2 &&
				echo.attempts === 1,
			label + ': new tops become separate read-only echoes'
		);
		check(
			(await page.locator('.top-card:disabled').count()) === 4 &&
				(await page.locator('#cancel').isDisabled()),
			label + ': echo blocks input until extra Continue'
		);
		await bounds(page, label + '/echo', columns);
		await capture(page, mode + '-contrast-' + label);
		await perform(page, { kind: 'continue' }, label);
		check(
			(await state(page)).attempts === 1 && (await state(page)).outcome === null,
			label + ': echo closes without an attempt'
		);
	} else if (mode === 'strata-order') {
		await playPair(page, [0, 1], label);
		check(
			(await state(page)).outcome === 'order-blocked' && (await state(page)).misses === 1,
			label + ': equal later symbol is a held blocked attempt'
		);
		await capture(page, mode + '-contrast-' + label);
		await perform(page, { kind: 'continue' }, label);
		assert.deepEqual((await state(page)).stacks, initial.stacks);
		check(
			(await state(page)).cleared === 0 && (await state(page)).order[0] === initial.order[0],
			label + ': blocked pair does not advance target'
		);
		await playPair(page, pair(await state(page), true), label);
		await perform(page, { kind: 'continue' }, label);
		check((await state(page)).cleared === 1, label + ': required symbol advances through Continue');
	}
	await bounds(page, label + '/contrast-end', columns);
}

const assets = new Map([
	['/demo/v1.3.5.15-batch-h.html', { body: Buffer.from(html), type: 'text/html; charset=utf-8' }],
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
	const url = 'http://127.0.0.1:' + address.port + '/demo/v1.3.5.15-batch-h.html';
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
		for (const mode of modes) {
			for (const count of [6, 8, 10]) {
				await selectMode(page, mode, count);
				const initial = await state(page);
				const label = mode + '/' + count + '/' + size;
				assertCards(initial, true);
				witness(initial);
				check(
					initial.selected.length === 0 &&
						initial.outcome === null &&
						initial.shelf === null &&
						initial.attempts === 0,
					label + ': clean face-down deal'
				);
				check(
					(await page.locator('.top-card').count()) === 4 &&
						(await page.locator('.buried button,.buried [tabindex]').count()) === 0,
					label + ': four top buttons only'
				);
				check(
					(await page.locator('.top-card[data-pair],.face-symbol').count()) === 0,
					label + ': hidden opening faces'
				);
				await bounds(page, label + '/ready', columns);
				await capture(page, mode + '-' + count + '-' + size);
				await perform(page, { kind: 'select', stack: 0 }, label);
				await page.locator('#cancel').click();
				assert.deepEqual(await state(page), initial);
				check(true, label + ': free single cancellation preserves all rule state');
				await perform(page, { kind: 'select', stack: 0 }, label);
				await perform(page, { kind: 'select', stack: 0 }, label);
				assert.deepEqual(await state(page), initial);
				check(true, label + ': repeat top cancels');
				await playPair(page, pair(initial, false), label);
				const pending = await state(page);
				check(
					pending.outcome === 'mismatch' && pending.attempts === 1 && pending.misses === 1,
					label + ': unequal legal attempt held'
				);
				assert.deepEqual(pending.stacks, initial.stacks);
				check(
					(await page.locator('.top-card:disabled').count()) === 4 &&
						(await page.locator('#cancel').isDisabled()),
					label + ': resolution blocks more input'
				);
				await bounds(page, label + '/mismatch', columns);
				await perform(page, { kind: 'continue' }, label);
				await finish(page, label + '/full-clear');
				const completed = await state(page);
				check(
					completed.finished &&
						completed.cleared === count &&
						completed.shelf === null &&
						completed.outcome === null &&
						completed.attempts === count + 1,
					label + ': full legal clear after mismatch'
				);
				check(
					(await page.locator('.empty-well').count()) === 4 &&
						(await page.locator('#completion').isVisible()),
					label + ': all four empty wells and result'
				);
				check(
					await page.locator('#reset').evaluate((element) => document.activeElement === element),
					label + ': completed focus on Reset'
				);
				await bounds(page, label + '/complete', columns);
				if (count === 6) await capture(page, mode + '-complete-' + size);
				await page.locator('#reset').click();
				assert.deepEqual(await state(page), initial);
				check(true, label + ': reset repeats same complete deal');
			}
			await contrast(page, mode, size, columns);
		}
	}
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(url);
	for (const mode of modes) {
		for (const count of [6, 8, 10]) {
			await selectMode(page, mode, count);
			const samples = await page.evaluate(() => {
				const values: PreviewState[] = [];
				for (let index = 0; index < 8; index++) {
					values.push((window as unknown as FixtureWindow).BatchHPreview.getState());
					(document.getElementById('newDeal') as HTMLButtonElement).click();
				}
				return values;
			});
			for (const sample of samples) {
				assertCards(sample, true);
				witness(sample);
				sampleCount++;
			}
			check(
				true,
				mode +
					'/' +
					count +
					': eight generated balanced deals have independently constructed legal full clears'
			);
		}
	}
	for (const mode of modes) {
		await selectMode(page, mode);
		const initial = await state(page);
		await page.locator('#newDeal').click();
		check(
			(await state(page)).deal === initial.deal + 1 &&
				JSON.stringify((await state(page)).stacks) !== JSON.stringify(initial.stacks),
			mode + ': New deal changes seed and deck'
		);
		const changed = await state(page);
		await perform(page, { kind: 'select', stack: 0 }, mode);
		await page.locator('#reset').click();
		assert.deepEqual(await state(page), changed);
		check(true, mode + ': reset clears single selection');
		await playPair(page, pair(changed, false), mode);
		await page.locator('#reset').click();
		assert.deepEqual(await state(page), changed);
		check(true, mode + ': reset clears pending mismatch');
		await selectMode(page, mode);
		await page.locator('#example').click();
		check((await state(page)).guideStep === 0, mode + ': guide starts with normal first action');
		for (let step = 0; (await state(page)).guideStep !== null; step++) {
			assert(step < 12, 'Guide is finite');
			await page.locator('#exampleNext').click();
		}
		check(true, mode + ': complete playable guide returns manual control');
		await finish(page, mode + '/after-guide');
		await selectMode(page, mode);
		await page.locator('[data-stack="0"]').focus();
		await page.keyboard.press('Space');
		check((await state(page)).selected[0] === 0, mode + ': keyboard Space selects a top');
		await page.locator('#cancel').focus();
		await page.keyboard.press('Enter');
		assert.deepEqual(await state(page), initial);
		check(true, mode + ': keyboard Enter cancels freely');
		await playPair(page, pair(await state(page), true), mode);
		check(
			await page.locator('#continue').evaluate((element) => document.activeElement === element),
			mode + ': pending pair focuses Continue'
		);
		await page.keyboard.press('Enter');
		check((await state(page)).cleared === 1, mode + ': keyboard Enter lifts pair');
		const pending = await state(page);
		await page.setViewportSize({ width: 390, height: 844 });
		assert.deepEqual(await state(page), pending);
		await page.setViewportSize({ width: 844, height: 390 });
		assert.deepEqual(await state(page), pending);
		check(true, mode + ': rotation retains pending and rule state');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		assert.deepEqual(await state(page), pending);
		await finish(page, mode + '/reduced-motion');
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.emulateMedia({ reducedMotion: 'no-preference' });
	}
	const fallback = await browser.newPage({
		viewport: { width: 390, height: 844 },
		reducedMotion: 'no-preference'
	});
	fallback.on('pageerror', (error) => errors.push(error.message));
	fallback.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	await fallback.route('**/anime.min.js', (route) =>
		route.fulfill({ contentType: 'text/javascript', body: '' })
	);
	await fallback.goto(url);
	for (const mode of modes) {
		await selectMode(fallback, mode);
		await finish(fallback, mode + '/missing-motion');
		check(
			(await state(fallback)).finished,
			mode + ': missing animation under ordinary motion retains full play'
		);
	}
	await fallback.close();
	check(errors.length === 0, 'Zero uncaught browser errors');
	check(consoleErrors.length === 0, 'Zero unexpected console errors');
	check(
		requests.every((request) => request.method === 'GET'),
		'Fixture sends no mutation requests'
	);
	check(
		createHash('sha256')
			.update(await readFile(fixturePath, 'utf8'))
			.digest('hex') === fingerprint,
		'Source stayed stable during checks'
	);
} catch (error) {
	failure = error instanceof Error ? error.message : String(error);
} finally {
	await browser?.close();
	if (server.listening)
		await new Promise<void>((done, reject) =>
			server.close((error) => (error ? reject(error) : done()))
		);
	await writeFile(
		resolve(output, 'verification.json'),
		JSON.stringify(
			{
				status: failure ? 'FAIL' : 'PASS',
				date: new Date().toISOString(),
				command: 'bun scripts/check-batch-h-strata.ts',
				browser: 'Chromium ' + version,
				execution: 'One Chromium browser; serial fixture checks',
				fingerprint,
				modes,
				sampleCount,
				uiActions,
				checks,
				layouts,
				screenshots,
				errors,
				consoleErrors,
				failure,
				limitations: [
					'Fixture-only rule/presentation checks; no app, D1 or engine-vector verification',
					'Responsive Chromium emulation; no physical-device review',
					'Finite generated-deal samples supplement constructive witnesses; no production generation/fairness claim'
				]
			},
			null,
			2
		) + '\n'
	);
}
if (failure) throw new Error(failure);
console.info(
	'Batch H fixture: ' +
		checks.length +
		' checks passed; ' +
		sampleCount +
		' independently solvable deals; ' +
		uiActions +
		' native UI actions; 10 modes / 3 sizes. Evidence: build/v1.3.5.15/preview/verification.json'
);
