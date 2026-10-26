import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, type Page } from '@playwright/test';
const origin = 'http://127.0.0.1:5175';
const directory = 'build/design-review-2026-10-25';
await mkdir(`${directory}/screenshots`, { recursive: true });
const server = spawn(
	'python3',
	['-m', 'http.server', '5175', '--bind', '127.0.0.1', '--directory', 'static'],
	{ stdio: 'ignore' }
);
const checks: string[] = [];
const errors: string[] = [];
const uploads: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
function check(value: unknown, label: string) {
	assert(value, label);
	checks.push(label);
}
async function visit(page: Page, view: string, state = 'normal') {
	const account = ['profile', 'signin', 'name', 'leaderboard'].includes(view);
	await page.goto(
		`${origin}/demo/${account ? 'accounts-screen' : 'v1-screen'}.html?screen=${view}&state=${state}`,
		{ waitUntil: 'networkidle' }
	);
	await page.evaluate(() => document.fonts.ready);
}
async function sampleEntrance(page: Page, action: string, target: string, length: number) {
	return page.evaluate(
		async ({ action, target, length }) => {
			const start = performance.now();
			(document.querySelector(action) as HTMLElement).click();
			const samples: { time: number; opacity: number; fits: boolean; playing: boolean }[] = [];
			const sample = () => {
				samples.push({
					time: performance.now() - start,
					opacity: Number(getComputedStyle(document.querySelector(target)!).opacity),
					fits:
						document.documentElement.scrollWidth <= innerWidth &&
						document.documentElement.scrollHeight <= innerHeight,
					playing: document.querySelector('.game-stage.playing') !== null
				});
			};
			sample();
			await new Promise<void>((resolve) => {
				const frame = () => {
					sample();
					if (performance.now() - start < length) requestAnimationFrame(frame);
					else resolve();
				};
				requestAnimationFrame(frame);
			});
			return samples;
		},
		{ action, target, length }
	);
}
try {
	let ready = false;
	for (let count = 0; count < 50; count++) {
		try {
			if ((await fetch(`${origin}/demo/v1.html`)).ok) {
				ready = true;
				break;
			}
		} catch {
			/* Local server booting. */
		}
		await delay(100);
	}
	assert(ready, 'Static demo server ready');
	browser = await chromium.launch();
	const page = await browser.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('request', (request) => {
		if (request.method() !== 'GET') uploads.push(request.url());
	});
	for (const [size, width, height] of [
		['portrait', 390, 844],
		['landscape', 844, 390],
		['desktop', 1280, 800]
	] as const) {
		await page.setViewportSize({ width, height });
		for (const view of [
			'home',
			'memory',
			'block',
			'play',
			'result',
			'profile',
			'signin',
			'name',
			'leaderboard',
			'terms',
			'privacy',
			'login',
			'recovery',
			'dashboard',
			'status',
			'moderation',
			'queue',
			'audit',
			'operator'
		]) {
			await visit(page, view);
			check(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
				`${view}/${size}: no horizontal overflow`
			);
			if (
				![
					'login',
					'recovery',
					'dashboard',
					'status',
					'moderation',
					'queue',
					'audit',
					'operator'
				].includes(view)
			) {
				const text = await page.locator('body').innerText();
				check(!/\bbests?\b/i.test(text), `${view}/${size}: high-score terminology`);
				check(
					(await page.locator('.brand,.wordmark').first().innerText()) === 'Morphi.One',
					`${view}/${size}: wordmark`
				);
				check(
					!text.includes('Contact Ali Gohar') &&
						!text.includes('Interactive preview · Sample data'),
					`${view}/${size}: clean user footer`
				);
			}
			if (view === 'home') {
				check(
					await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight),
					`Home/${size}: one screen`
				);
				check(
					(await page.locator('[data-view=memory],[data-view=block]').count()) === 0,
					`Home/${size}: no door navigation`
				);
				check(
					await page
						.locator('.site-footer a')
						.allTextContents()
						.then((values) => values.join('|') === 'Privacy|Terms'),
					`Home/${size}: Privacy and Terms only`
				);
				check(
					(await page.locator('.home-scatter').getAttribute('aria-hidden')) === 'true',
					`Home/${size}: decorative scatter`
				);
			}
			if (['home', 'memory', 'block', 'play', 'result', 'profile', 'dashboard'].includes(view))
				await page.screenshot({
					path: `${directory}/screenshots/${view}-${size}.png`,
					fullPage: true
				});
			if (view === 'memory' || view === 'block') {
				check(
					(await page.getByRole('heading', { level: 1 }).innerText()) ===
						(view === 'memory' ? 'Memory' : 'Block puzzle'),
					`${view}/${size}: game-name heading`
				);
				check(
					(await page.getByRole('button', { name: 'Surprise me', exact: true }).count()) === 0,
					`${view}/${size}: no surprise button`
				);
				check((await page.locator('.board-play').count()) === 1, `${view}/${size}: one board Play`);
				await page.locator('[data-action=door-start]').click();
				await page.waitForTimeout(1100);
				check(
					(await page.locator('.puzzle-copy').count()) === 0,
					`${view}/${size}: columns step aside`
				);
				check(
					(await page.locator('.help-controls button').count()) === 2,
					`${view}/${size}: help controls`
				);
				check(
					await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
					`${view}/${size}: active board fits`
				);
				await page.getByRole('button', { name: 'How to play', exact: true }).click();
				await page.waitForTimeout(600);
				check(
					(await page.locator('dialog[open]').count()) === 1,
					`${view}/${size}: help dialog opens`
				);
				await page.keyboard.press('Escape');
				check(
					(await page.locator('dialog[open]').count()) === 0,
					`${view}/${size}: Escape closes help`
				);
				check(
					await page
						.locator('[data-action=help-how]')
						.evaluate((node) => node === document.activeElement),
					`${view}/${size}: help restores focus`
				);
				await page.waitForTimeout(600);
				await page.screenshot({
					path: `${directory}/screenshots/${view}-active-${size}.png`,
					fullPage: true
				});
			}
			if (view === 'result' && size === 'portrait') {
				const boxes = await page.evaluate(() =>
					['.result-score', '.result-next', '.result-stats', '.result-save'].map(
						(selector) => document.querySelector(selector)!.getBoundingClientRect().top
					)
				);
				check(
					boxes.every((top, index) => index === 0 || top > boxes[index - 1]!),
					'Mobile result: score → Next → stats → sign-in'
				);
				check(
					(await page.locator('.result-save .device-note').count()) === 1,
					'Device-only note inside sign-in section'
				);
				check(
					(await page
						.locator('.google-ink')
						.evaluate((node) => getComputedStyle(node).backgroundColor)) === 'rgb(27, 36, 51)',
					'Morphi-themed ink sign-in button'
				);
			}
		}
	}
	// Decoration is re-dealt, bounded and outside all reserved foreground rectangles.
	await page.setViewportSize({ width: 1280, height: 800 });
	await visit(page, 'home');
	const scatter = () => page.locator('.home-scatter').innerHTML();
	const first = await scatter();
	await visit(page, 'home');
	check((await scatter()) !== first, 'Scatter re-deals per visit');
	check(
		await page.evaluate(() => {
			const safe = Array.from(document.querySelectorAll('[data-safe]')).map((node) =>
				node.getBoundingClientRect()
			);
			const items = Array.from(document.querySelectorAll('.home-scatter>i')).map((node) =>
				node.getBoundingClientRect()
			);
			return (
				items.length <= 18 &&
				items.length >= 6 &&
				items.every(
					(item, index) =>
						item.left >= 0 &&
						item.top >= 0 &&
						item.right <= innerWidth &&
						item.bottom <= innerHeight &&
						![...safe, ...items.slice(0, index)].some(
							(other) =>
								item.left < other.right &&
								item.right > other.left &&
								item.top < other.bottom &&
								item.bottom > other.top
						)
				)
			);
		}),
		'Scatter has viewport bounds, safe zones and minimum separation'
	);
	check(
		await page
			.locator('.home-scatter [data-shape]')
			.evaluateAll(
				(nodes) => new Set(nodes.map((node) => node.getAttribute('data-shape'))).size >= 5
			),
		'Scatter mixes at least five shape families'
	);
	await page.getByRole('link', { name: 'Play', exact: true }).click();
	check(
		(await page.locator('.core-page .game-stage.playing').count()) === 1,
		'Home Play starts once, without a second Play'
	);
	check((await page.locator('.board-play').count()) === 0, 'Mix mode has no double start');
	check(
		await page.evaluate(
			() =>
				document.activeElement?.hasAttribute('data-card') ||
				document.activeElement?.hasAttribute('data-piece')
		),
		'Dealt board receives focus'
	);
	await page.waitForTimeout(1600);
	check(
		(await page.locator('.motion-ghost').count()) === 0,
		'Home transition cleans up its decorative ghosts'
	);
	await visit(page, 'memory');
	await page.locator('[data-action=door-start]').click();
	await page.waitForTimeout(1100);
	await page.evaluate(() => window.postMessage({ type: 'morphi-v1-complete' }, location.origin));
	await page.locator('.result-page').waitFor();
	check(true, 'Door end commits results first');
	await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
	await page.locator('.door-ready').waitFor();
	check(
		(await page.locator('.puzzle-copy').count()) === 2,
		'Door result returns to ready guides in Stay mode'
	);
	await visit(page, 'profile');
	check((await page.getByRole('tab').count()) === 5, 'Profile has five foundation tabs');
	check((await page.locator('.family-row').count()) === 2, 'Profile uses one row per game');
	check(
		(await page.locator('.family-head').evaluate((node) => getComputedStyle(node).color)) ===
			'rgb(104, 121, 142)',
		'Profile labels use #68798E'
	);
	check(
		(await page.locator('.profile-rail>.foundation-card').count()) === 3,
		'Profile has three fixed right-rail slots'
	);
	await page.getByRole('tab', { name: 'My games', exact: true }).click();
	await page.locator('[data-action=detail-memory]').click();
	check(
		(await page.locator('dialog[open]').count()) === 1,
		'Per-family details open one level down'
	);
	await page.keyboard.press('Escape');
	await page.getByRole('tab', { name: 'Overview', exact: true }).click();
	await page.keyboard.press('ArrowRight');
	check(
		(await page
			.getByRole('tab', { name: 'My games', exact: true })
			.getAttribute('aria-selected')) === 'true',
		'Profile keyboard tabs'
	);
	// Reduced motion is immediate: no active travel/scale or orbit animation.
	const reduced = await browser.newPage({
		reducedMotion: 'reduce',
		viewport: { width: 390, height: 844 }
	});
	await visit(reduced, 'home');
	check(
		await reduced.evaluate(() => document.getAnimations().length === 0),
		'Reduced motion: no orbit animations'
	);
	await reduced.getByRole('link', { name: 'Play', exact: true }).click();
	check(
		(await reduced.locator('.core-page').count()) === 1,
		'Reduced motion: Home starts immediately'
	);
	check(
		(await reduced.locator('.motion-ghost').count()) === 0,
		'Reduced motion: no transition ghosts'
	);
	await reduced.close();
	// Force each demo family so random Mix draws cannot hide a phone regression.
	const phoneEvidence = [];
	for (const family of ['memory', 'block'] as const) {
		const phone = await browser.newPage({ reducedMotion: 'reduce' });
		phone.on('pageerror', (error) => errors.push(error.message));
		await phone.addInitScript(
			(choice) => {
				const draw = crypto.getRandomValues.bind(crypto);
				Object.defineProperty(crypto, 'getRandomValues', {
					value: (values: Uint32Array<ArrayBuffer>) => {
						if (values.length === 1) {
							values[0] = choice;
							return values;
						}
						return draw(values);
					}
				});
			},
			family === 'memory' ? 0 : 1
		);
		for (const [width, height] of [
			[390, 844],
			[844, 390],
			[667, 375],
			[568, 320],
			[320, 568],
			[320, 480]
		]) {
			await phone.setViewportSize({ width, height });
			for (const entry of ['door', 'mix']) {
				await visit(phone, entry === 'door' ? family : 'play');
				if (entry === 'door') await phone.locator('[data-action=door-start]').click();
				const layout = await phone.evaluate(() => {
					const board = document
						.querySelector('.memory-board,.block-board')!
						.getBoundingClientRect();
					const controls = [
						...document.querySelectorAll('.game-hud,.help-controls button,.block-piece')
					].map((node) => node.getBoundingClientRect());
					return {
						boardWidth: board.width,
						boardHeight: board.height,
						centred:
							Math.abs(board.x + board.width / 2 - innerWidth / 2) < 1 &&
							Math.abs(board.y + board.height / 2 - innerHeight / 2) < 1,
						fits:
							document.documentElement.scrollWidth <= innerWidth &&
							document.documentElement.scrollHeight <= innerHeight,
						controls: controls.every(
							(rect) =>
								rect.left >= 0 &&
								rect.top >= 0 &&
								rect.right <= innerWidth &&
								rect.bottom <= innerHeight
						),
						reachable: [
							...document.querySelectorAll(
								'.public-header button,.public-header a,.help-controls button,.block-piece,.memory-card:first-child,.block-cell:first-child'
							)
						].every((node) => {
							const rect = node.getBoundingClientRect();
							return node.contains(
								document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
							);
						})
					};
				});
				const label = `${family}/${entry}/${width}x${height}`;
				check(layout.centred, `${label}: board centred in viewport`);
				check(layout.fits && layout.controls, `${label}: no scrolling or clipped controls`);
				check(layout.reachable, `${label}: visible controls receive taps`);
				if (width > height)
					check(layout.boardHeight >= height - 116, `${label}: board uses landscape height`);
				phoneEvidence.push({ family, entry, width, height, ...layout });
				if (width === 844 || width === 390)
					await phone.screenshot({
						path: `${directory}/screenshots/${family}-${entry}-${width}.png`
					});
			}
		}
		// Rotation changes layout without replacing a partially played board.
		await phone.setViewportSize({ width: 390, height: 844 });
		await visit(phone, 'play');
		const move = family === 'memory' ? '[data-card="0"]' : '[data-cell="0"]';
		await phone.locator(move).click();
		for (const viewport of [
			{ width: 844, height: 390 },
			{ width: 390, height: 844 }
		]) {
			await phone.setViewportSize(viewport);
			check(
				await phone
					.locator(move)
					.evaluate(
						(node) => node.classList.contains('revealed') || node.classList.contains('filled')
					),
				`${family}: rotation preserves the current move at ${viewport.width}px`
			);
		}
		await phone.emulateMedia({ reducedMotion: 'no-preference' });
		await phone.setViewportSize({ width: 844, height: 390 });
		await visit(phone, 'home');
		const homeFrames = await sampleEntrance(phone, '.play-circle', '.core-page .game-stage', 1700);
		check(
			homeFrames[0]!.opacity === 0 && homeFrames.every((frame) => frame.playing),
			`${family}: Home commits once with the incoming board initially hidden`
		);
		check(
			homeFrames.filter((frame) => frame.time < 500).every((frame) => frame.opacity === 0),
			`${family}: no early board flash before arrival`
		);
		check(
			homeFrames.some((frame) => frame.time >= 1000 && frame.time < 1150 && frame.opacity < 0.99) &&
				homeFrames.at(-1)!.opacity === 1,
			`${family}: Home entrance continues beyond one second and completes at 1.5 seconds`
		);
		check(
			homeFrames.every(
				(frame, index) => index === 0 || frame.opacity >= homeFrames[index - 1]!.opacity
			),
			`${family}: board fades in once without restarting`
		);
		check(
			homeFrames.every((frame) => frame.fits),
			`${family}: Home animation never creates scrollbars`
		);
		check(
			(await phone.locator('.motion-layer').count()) === 0,
			`${family}: Home overlay cleaned up`
		);
		await visit(phone, family);
		const doorFrames = await sampleEntrance(phone, '.board-play', '.help-controls', 1150);
		check(
			doorFrames.some((frame) => frame.time > 800 && frame.time < 950 && frame.opacity < 1) &&
				doorFrames.at(-1)!.opacity === 1,
			`${family}: door presentation completes after one second`
		);
		check(
			doorFrames.every((frame) => frame.playing && frame.fits),
			`${family}: door animation neither delays play nor creates scrollbars`
		);
		const helpFrames = [];
		for (const kind of ['how', 'scoring']) {
			const frames = await sampleEntrance(phone, `[data-action=help-${kind}]`, '.help-dialog', 650);
			check(
				frames.some((frame) => frame.time > 150 && frame.time < 350 && frame.opacity < 1) &&
					frames.filter((frame) => frame.time > 550).every((frame) => frame.opacity === 1),
				`${family}/${kind}: help opens in half a second`
			);
			await phone.keyboard.press('Escape');
			await phone.waitForTimeout(600);
			check(
				(await phone.locator('.motion-layer,dialog[open]').count()) === 0,
				`${family}/${kind}: help close completes within half a second`
			);
			helpFrames.push({ kind, frames });
		}
		await visit(phone, 'home');
		await phone.locator('.play-circle').click();
		await phone.waitForTimeout(150);
		await phone.emulateMedia({ reducedMotion: 'reduce' });
		await phone.waitForTimeout(50);
		check(
			(await phone
				.locator('.game-stage')
				.evaluate((node) => getComputedStyle(node).opacity === '1')) &&
				(await phone.locator('.motion-layer').count()) === 0,
			`${family}: enabling reduced motion mid-arrival reveals board and cleans layers`
		);
		await writeFile(
			`${directory}/${family}-motion-frames.json`,
			JSON.stringify({ homeFrames, doorFrames, helpFrames }, null, 2)
		);
		await phone.close();
	}
	await writeFile(`${directory}/phone-layouts.json`, JSON.stringify(phoneEvidence, null, 2));
	// Missing animation cannot block a logical state transition.
	const fallback = await browser.newPage();
	await fallback.route('**/motion.js', (route) => route.abort());
	await visit(fallback, 'memory');
	await fallback.locator('[data-action=door-start]').click();
	check(
		(await fallback.locator('.door-playing').count()) === 1,
		'Unavailable animation bundle does not block round start'
	);
	await fallback.close();
	for (const [width, height] of [
		[320, 480],
		[360, 640]
	]) {
		await page.setViewportSize({ width, height });
		await visit(page, 'home');
		check(
			await page
				.locator('.site-footer')
				.evaluate((node) => node.getBoundingClientRect().bottom <= innerHeight),
			'Small phone footer remains visible'
		);
		check(
			await page.locator('.play-circle').evaluate((node) => node.getBoundingClientRect().top >= 0),
			'Small phone Play stays visible'
		);
	}
	await page.goto(`${origin}/demo/v1.html?screen=profile`, { waitUntil: 'networkidle' });
	await page.frameLocator('iframe').getByRole('tab', { name: 'Overview', exact: true }).waitFor();
	check(
		(await page.locator('#screen').inputValue()) === 'profile',
		'Profile stays accessible through the v1 harness'
	);
	const current = await readFile('static/demo/v1.css', 'utf8');
	check(
		createHash('sha256').update(current).digest('hex') ===
			'cd0555d60760fd27599ec7f983ecefe4563203f52dc6a8c2bbf5e2b086e14816',
		'Existing admin stylesheet unchanged'
	);
	check(errors.length === 0, 'No uncaught browser errors');
	check(uploads.length === 0, 'No backend or telemetry uploads');
	await writeFile(
		`${directory}/checks.json`,
		JSON.stringify(
			{
				status: 'pass',
				checks,
				errors,
				uploads,
				scope: 'Local synthetic demo; not integration or deployment acceptance'
			},
			null,
			2
		)
	);
	console.info(JSON.stringify({ checks: checks.length, errors, uploads }, null, 2));
} finally {
	await browser?.close();
	server.kill();
}
