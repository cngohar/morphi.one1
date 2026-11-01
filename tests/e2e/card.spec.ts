import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

for (const [width, height] of [
	[390, 844],
	[844, 390],
	[1280, 800],
	[1920, 1080]
])
	test(`Card proofs: both families and played stack at ${width}×${height}`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width, height });
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto('/demo/card-proof.html');
		const proof = page.locator('#proof');
		await expect(proof).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
		const output = `build/v1.1-card/${info.project.name}`;
		await mkdir(output, { recursive: true });
		for (const [index, family] of ['memory', 'block'].entries()) {
			await expect(page.locator('.proof-board')).toHaveAttribute('data-family', family);
			const scatter = page.locator('.proof-scatter');
			if (width <= 900 || (width > height && height <= 560)) await expect(scatter).toBeHidden();
			else await expect(scatter).toBeVisible();
			for (const side of ['left', 'right']) {
				const count = await scatter.locator(`svg[data-band="${side}"]`).count();
				expect(count).toBeGreaterThanOrEqual(1);
				expect(count).toBeLessThanOrEqual(5);
			}
			const kinds = await page
				.locator('.proof-scatter svg')
				.evaluateAll((items) => items.map((item) => item.getAttribute('data-item')));
			if (family === 'memory') expect(new Set(kinds)).toEqual(new Set(['card']));
			else expect(kinds).not.toContain('card');
			const layout = await page.evaluate(() => {
				const rect = (selector: string) =>
					document.querySelector(selector)!.getBoundingClientRect();
				return {
					scroll: document.documentElement.scrollHeight,
					width: document.documentElement.scrollWidth,
					panel: rect('.proof-board').toJSON(),
					header: rect('header').toJSON(),
					footer: rect('footer').toJSON(),
					stack: rect('.played-stack').toJSON()
				};
			});
			expect(layout.scroll).toBeLessThanOrEqual(height);
			expect(layout.width).toBeLessThanOrEqual(width);
			expect(layout.panel.y).toBeGreaterThan(layout.header.bottom);
			expect(layout.panel.bottom).toBeLessThan(layout.footer.y);
			await page.screenshot({ path: `${output}/${family}-${width}x${height}.png` });
			await page.locator('summary').click();
			await page.locator('#finish').click();
			await page.locator('summary').click();
			await expect(proof).toHaveAttribute('data-phase', 'result');
			await expect(page.locator('#stack-label')).toHaveText(`Played · ${index + 1}`);
			await expect(page.locator('.sample-score')).toHaveText(family === 'memory' ? '1200' : '450');
			await expect(page.locator('.proof-result-stats dd')).toHaveCount(3);
			await expect(page.locator('.proof-card')).toBeHidden();
			await expect(page.locator('.sample-score')).toBeVisible();
			await expect(page.locator('.proof-result-stats > div').last()).toHaveCSS('opacity', '1');
			await expect(page.locator('.sample-score')).toHaveCSS('opacity', '1');
			await page.waitForTimeout(100);
			const returned = await page.evaluate(
				() =>
					new Promise<{ panel: number; score: number }>((resolve) => {
						Object.defineProperty(document, 'hidden', { configurable: true, value: true });
						document.dispatchEvent(new Event('visibilitychange'));
						Object.defineProperty(document, 'hidden', { configurable: true, value: false });
						document.dispatchEvent(new Event('visibilitychange'));
						let frames = 0,
							panel = 1,
							score = 1;
						const sample = () => {
							panel = Math.min(
								panel,
								Number(getComputedStyle(document.querySelector('.proof-result-inner')!).opacity)
							);
							score = Math.min(
								score,
								Number(getComputedStyle(document.querySelector('.sample-score')!).opacity)
							);
							if (++frames === 5) resolve({ panel, score });
							else requestAnimationFrame(sample);
						};
						requestAnimationFrame(sample);
					})
			);
			expect(returned).toEqual({ panel: 1, score: 1 });
			if (width >= 1024) {
				const summaryBox = await page.locator('.proof-result-summary').boundingBox();
				const nextBox = await page.locator('.proof-next-area').boundingBox();
				expect(nextBox!.x).toBeGreaterThan(summaryBox!.x + summaryBox!.width);
				expect(
					(await page.locator('.proof-result-inner').boundingBox())!.width
				).toBeGreaterThanOrEqual(800);
				expect((await page.locator('.waiting-card').boundingBox())!.width).toBeGreaterThanOrEqual(
					100
				);
			}
			const resultBox = await page.locator('.proof-result-inner').boundingBox();
			const headerBox = await page.locator('header').boundingBox();
			const footerBox = await page.locator('footer').boundingBox();
			expect(resultBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
			expect(resultBox!.y + resultBox!.height).toBeLessThanOrEqual(footerBox!.y);
			await page.screenshot({ path: `${output}/${family}-stack-${width}x${height}.png` });
			if (index === 0) {
				await page.locator('#next').click();
				await expect(page.locator('#puzzle-name')).toBeEmpty();
				await expect(proof).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
			}
		}
		expect(errors).toEqual([]);
	});

test('slow/failed preparation retains a face-down mystery and retries; static motion still works', async ({
	page
}) => {
	const warnings: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'warning') warnings.push(message.text());
	});
	await page.goto('/demo/card-proof.html');
	const proof = page.locator('#proof');
	await expect(proof).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await page.evaluate(() => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 3)
				throw new Error('fixture: cosmetic Card entropy unavailable');
			return original(array);
		};
	});
	await page.locator('summary').click();
	await page.locator('#load').selectOption('slow');
	await page.locator('#replay').click();
	await expect(proof).toHaveAttribute('data-phase', 'waiting');
	await expect(page.locator('.proof-card')).toBeVisible();
	expect(warnings).toContain('morphi:card_motion_unavailable');
	await expect(page.locator('#puzzle-name')).toBeEmpty();
	expect(await page.locator('.proof-scatter').evaluate((el) => getComputedStyle(el).opacity)).toBe(
		'0'
	);
	await expect(page.locator('#finish')).toBeDisabled();
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(proof).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
	await page.locator('#load').selectOption('fail');
	await page.locator('#replay').click();
	await expect(proof).toHaveAttribute('data-phase', 'failed');
	await expect(page.locator('#puzzle-name')).toBeEmpty();
	await page.locator('#retry').click();
	await expect(proof).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await page.locator('#finish').click();
	await expect(proof).toHaveAttribute('data-phase', 'result');
	await expect(page.locator('#stack-label')).toHaveText('Played · 1');
});

test('one frame expands continuously, then Memory keeps its random deal and full preview', async ({
	page
}, info) => {
	await page.addInitScript(() => {
		const samples: {
			phase: string;
			width: number;
			height: number;
			count: number;
			same: boolean;
			time: number;
		}[] = [];
		Object.defineProperty(window, '__cardFrames', { value: samples });
		let frame: Element | null = null;
		const sample = () => {
			const board = document.querySelector('.proof-board');
			if (board) {
				frame ??= board;
				const rect = board.getBoundingClientRect();
				samples.push({
					phase: document.querySelector<HTMLElement>('#proof')!.dataset.phase ?? '',
					width: rect.width,
					height: rect.height,
					count: document.querySelectorAll('.proof-board').length,
					same: frame === board,
					time: performance.now()
				});
			}
			if (samples.length < 1200) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	await page.goto('/demo/card-proof.html');
	await expect(page.locator('#proof')).toHaveAttribute('data-phase', 'arriving', { timeout: 6000 });
	expect(
		await page
			.locator('.sample-memory')
			.evaluateAll((cards) =>
				cards.some(
					(card) =>
						getComputedStyle(card).opacity !== '1' || getComputedStyle(card).transform !== 'none'
				)
			)
	).toBe(true);
	await expect(page.locator('#proof')).toHaveAttribute('data-phase', 'preview', { timeout: 5000 });
	const output = `build/v1.1-card/${info.project.name}`;
	await mkdir(output, { recursive: true });
	await page.screenshot({ path: `${output}/memory-preview-1280x720.png` });
	await expect(page.locator('#proof')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
	const samples = await page.evaluate(
		() =>
			(
				window as unknown as {
					__cardFrames: {
						phase: string;
						width: number;
						height: number;
						count: number;
						same: boolean;
						time: number;
					}[];
				}
			).__cardFrames
	);
	expect(samples.every((frame) => frame.same && frame.count === 1)).toBe(true);
	const expansion = samples.filter((frame) => frame.phase === 'unfolding');
	expect(expansion.length).toBeGreaterThan(8);
	for (let i = 1; i < expansion.length; i++) {
		expect(expansion[i].width).toBeGreaterThanOrEqual(expansion[i - 1].width - 1);
		expect(expansion[i].height).toBeGreaterThanOrEqual(expansion[i - 1].height - 1);
	}
	expect(expansion.at(-1)!.width).toBeGreaterThan(expansion[0].width * 1.5);
	const preview = samples.find((frame) => frame.phase === 'preview')!;
	const hiding = samples.find((frame) => frame.phase === 'hiding')!;
	expect(hiding.time - preview.time).toBeGreaterThanOrEqual(2950);
	await writeFile(
		`${output}/continuous-frame.json`,
		JSON.stringify(
			{
				viewport: { width: 1280, height: 720 },
				sample:
					'one headless desktop run, unthrottled localhost; diagnostic, not a real-device smoothness gate',
				oneFrame: samples.every((frame) => frame.same && frame.count === 1),
				expansion,
				previewMs: hiding.time - preview.time
			},
			null,
			2
		) + '\n'
	);
});

test('hidden arrival and preview pause; reduced motion and rotation keep the same frame', async ({
	page
}) => {
	await page.goto('/demo/card-proof.html');
	const proof = page.locator('#proof');
	await expect(proof).toHaveAttribute('data-phase', 'arriving', { timeout: 6000 });
	await page.evaluate(() => {
		Object.defineProperty(window, '__originalCardFrame', {
			value: document.querySelector('.proof-board')
		});
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.waitForTimeout(3400);
	await expect(proof).toHaveAttribute('data-phase', 'arriving');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(proof).toHaveAttribute('data-phase', 'preview', { timeout: 5000 });
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.waitForTimeout(3400);
	await expect(proof).toHaveAttribute('data-phase', 'preview');
	await page.setViewportSize({ width: 844, height: 390 });
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(proof).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
	await expect(page.locator('.proof-scatter')).toBeHidden();
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect(page.locator('.proof-scatter')).toBeVisible();
	expect(
		await page.evaluate(
			() =>
				document.querySelector('.proof-board') ===
				(window as unknown as { __originalCardFrame: Element }).__originalCardFrame
		)
	).toBe(true);
	await page.locator('summary').click();
	await page.locator('#finish').click();
	await expect(proof).toHaveAttribute('data-phase', 'result');
	await expect(page.locator('.proof-card')).toBeHidden();
	await expect(page.locator('.sample-score')).toBeVisible();
});

test('desktop result scrambles once and exits before the next deal', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.addInitScript(() => {
		const phases: string[] = [];
		const origins: number[] = [];
		let deals = 0;
		Object.defineProperty(window, '__cardOrigins', { value: origins });
		const preparationPhases: string[] = [];
		Object.defineProperty(window, '__resultPhases', { value: phases });
		Object.defineProperty(window, '__preparationPhases', { value: preparationPhases });
		new MutationObserver((records) => {
			for (const record of records)
				if ((record.target as HTMLElement).id === 'proof') {
					const phase = (record.target as HTMLElement).dataset.phase ?? '';
					phases.push(phase);
					if (phase === 'dealing')
						origins.push(
							new DOMMatrix(getComputedStyle(document.querySelector('.proof-board')!).transform).e
						);
				}
		}).observe(document, {
			attributes: true,
			subtree: true,
			attributeFilter: ['data-phase']
		});
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 3) {
				array.set([deals++ % 4, 2147483648, 12]);
				return array;
			}
			if (array instanceof Uint32Array && array.length === 2)
				preparationPhases.push(document.querySelector<HTMLElement>('#proof')?.dataset.phase ?? '');
			return original(array);
		};
	});
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/demo/card-proof.html');
	await expect(page.locator('#proof')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await page.evaluate(() => {
		const root = document.querySelector<HTMLElement>('#proof')!;
		const probe: Record<string, unknown> = {};
		Object.defineProperty(window, '__earlyResultProbe', { value: probe });
		const observer = new MutationObserver(() => {
			if (root.dataset.phase !== 'result') return;
			observer.disconnect();
			const source = root.querySelector('.sample-score .scramble-source')!;
			Object.assign(probe, {
				score: source.textContent,
				sourceOpacity: getComputedStyle(source).opacity,
				overlays: root.querySelectorAll('.scramble-visual').length,
				title: root.querySelector('h2')!.textContent,
				high: root.querySelector('.sample-high')!.textContent,
				next: root.querySelector('#next')!.textContent
			});
			requestAnimationFrame(() => {
				const next = root.querySelector<HTMLButtonElement>('#next')!;
				probe.enabled = !next.disabled;
				probe.exitStartOpacity = Number(
					getComputedStyle(root.querySelector('.proof-result-inner')!).opacity
				);
				next.click();
				next.click();
				probe.phase = root.dataset.phase;
				probe.disabled = next.disabled;
				setTimeout(() => {
					probe.opacity = Number(
						getComputedStyle(root.querySelector('.proof-result-inner')!).opacity
					);
				}, 120);
			});
		});
		observer.observe(root, { attributes: true, attributeFilter: ['data-phase'] });
	});
	await page.locator('summary').click();
	await page.locator('#finish').click();
	await page.locator('summary').click();
	await expect(page.locator('#proof')).toHaveAttribute('data-phase', 'playing', { timeout: 12000 });
	await expect(page.locator('.proof-board')).toHaveAttribute('data-family', 'block');
	await expect(page.locator('#stack-label')).toHaveText('Played · 1');
	const probe = await page.evaluate(
		() => (window as unknown as { __earlyResultProbe: Record<string, unknown> }).__earlyResultProbe
	);
	expect(probe).toMatchObject({
		score: '1200',
		sourceOpacity: '0',
		overlays: 1,
		title: 'Well played.',
		high: '1200',
		next: 'Next puzzle',
		enabled: true,
		phase: 'result-leaving',
		disabled: true
	});
	expect(probe.opacity).toBeGreaterThanOrEqual(0);
	expect(probe.opacity).toBeLessThanOrEqual(Number(probe.exitStartOpacity) + 0.001);
	const recorded = await page.evaluate(() => ({
		origins: (window as unknown as { __cardOrigins: number[] }).__cardOrigins,
		phases: (window as unknown as { __resultPhases: string[] }).__resultPhases,
		preparation: (window as unknown as { __preparationPhases: string[] }).__preparationPhases
	}));
	expect(recorded.origins).toHaveLength(2);
	expect(recorded.origins[0]).toBeLessThan(-200);
	expect(recorded.origins[1]).toBeGreaterThan(200);
	expect(recorded.phases.filter((phase) => phase === 'result')).toHaveLength(1);
	expect(recorded.phases.filter((phase) => phase === 'result-leaving')).toHaveLength(1);
	expect(recorded.preparation).toContain('result-leaving');
	expect(errors).toEqual([]);
});

test('only the large score scrambles and resolves once within half a second', async ({
	page
}, info) => {
	await page.addInitScript(() => {
		const frames: {
			time: number;
			masked: boolean;
			sourceHidden: boolean;
			text: string;
			othersStatic: boolean;
		}[] = [];
		Object.defineProperty(window, '__scrambleFrames', { value: frames });
		const sample = () => {
			const root = document.querySelector<HTMLElement>('#proof');
			if (root?.dataset.phase === 'result') {
				const score = root.querySelector('.sample-score')!;
				const visual = score.querySelector('.scramble-visual');
				const source = score.querySelector('.scramble-source');
				frames.push({
					time: performance.now(),
					masked: Boolean(visual),
					sourceHidden: source ? getComputedStyle(source).opacity === '0' : false,
					text: visual?.textContent ?? score.textContent ?? '',
					othersStatic:
						root.querySelector('.proof-result-summary h2')?.textContent === 'Well played.' &&
						root.querySelector('.sample-high')?.textContent === '1200' &&
						root.querySelector('#next')?.textContent === 'Next puzzle' &&
						!root.querySelector('.proof-result-stats .scramble-visual')
				});
			}
			if (frames.length < 60) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	await page.goto('/demo/card-proof.html');
	await expect(page.locator('#proof')).toHaveAttribute('data-phase', 'playing', { timeout: 15000 });
	await page.locator('summary').click();
	await page.locator('#finish').click();
	await page.locator('summary').click();
	await expect(page.locator('#proof')).toHaveAttribute('data-phase', 'result');
	await expect(page.locator('.scramble-visual')).toHaveCount(0);
	await expect(page.locator('.sample-score')).toHaveText('1200');
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	const frames = await page.evaluate(
		() =>
			(
				window as unknown as {
					__scrambleFrames: {
						time: number;
						masked: boolean;
						sourceHidden: boolean;
						text: string;
						othersStatic: boolean;
					}[];
				}
			).__scrambleFrames
	);
	expect(frames.length).toBeGreaterThan(5);
	expect(frames[0]).toMatchObject({ masked: true, sourceHidden: true, othersStatic: true });
	expect(frames.every((frame) => frame.othersStatic)).toBe(true);
	const settled = frames.findIndex((frame) => !frame.masked);
	expect(settled).toBeGreaterThan(0);
	expect(frames[settled].time - frames[0].time).toBeLessThan(700);
	expect(frames.slice(settled).every((frame) => !frame.masked && frame.text === '1200')).toBe(true);
	const output = `build/v1.1-card/${info.project.name}`;
	await mkdir(output, { recursive: true });
	await writeFile(
		`${output}/result-scramble.json`,
		JSON.stringify({ durationMs: 500, frames }, null, 2) + '\n'
	);
});

test('desktop Cards arrive at centre, unfold there and fold only into the played stack across Next', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 1920, height: 923 });
	await page.clock.install({ time: new Date('2026-10-28T00:00:00Z') });
	await page.clock.pauseAt(new Date('2026-10-28T00:00:01Z'));
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		let direction = 0;
		crypto.getRandomValues = (array) => {
			if (array instanceof Uint32Array && array.length === 3) {
				array.set([direction++ % 4, 2147483648, 12]);
				return array;
			}
			if (array instanceof Uint32Array && array.length === 2) {
				array.set([0, 30]);
				return array;
			}
			return original(array);
		};
	});
	await page.goto('/demo/card-proof.html');
	const output = `build/v1.1-card/review-fix/${info.project.name}`;
	await mkdir(output, { recursive: true });
	const samples: unknown[] = [];
	const position = () =>
		page.evaluate(() => {
			const box = (selector: string) => {
				const r = document.querySelector(selector)!.getBoundingClientRect();
				return { x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height };
			};
			return {
				phase: document.querySelector<HTMLElement>('#proof')!.dataset.phase,
				board: box('.proof-board'),
				stage: box('.proof-stage'),
				stack: box('.stack-cards')
			};
		});
	const centred = async () => {
		const sample = await position();
		samples.push(sample);
		expect(Math.abs(sample.board.x - sample.stage.x)).toBeLessThan(1);
		expect(Math.abs(sample.board.y - sample.stage.y)).toBeLessThan(1);
		return sample;
	};
	for (let round = 0; round < 3; round++) {
		await page.clock.runFor(650);
		expect((await centred()).phase).toBe('flipping');
		await page.clock.runFor(500);
		for (const ms of [150, 150, 350]) {
			await page.clock.runFor(ms);
			expect((await centred()).phase).toBe('unfolding');
		}
		await page.screenshot({ path: `${output}/round-${round}-unfold.png` });
		await page.clock.runFor(100);
		expect((await centred()).phase).toBe('arriving');
		await page.clock.runFor(6500);
		expect((await centred()).phase).toBe('playing');
		if (round === 0) {
			const scatter = await page.locator('.proof-scatter').evaluate((layer) => {
				const bounds = layer.getBoundingClientRect();
				const panel = document.querySelector('.proof-board')!.getBoundingClientRect();
				return ['left', 'right'].map((side) => {
					const xs = [...layer.querySelectorAll(`svg[data-band="${side}"]`)].map((svg) => {
						const r = svg.getBoundingClientRect();
						return r.x + r.width / 2;
					});
					return {
						count: xs.length,
						spread: Math.max(...xs) - Math.min(...xs),
						space: side === 'left' ? panel.left - bounds.left : bounds.right - panel.right
					};
				});
			});
			for (const side of scatter) {
				expect(side.count).toBe(5);
				expect(side.spread).toBeGreaterThan(side.space * 0.4);
			}
			await page.screenshot({ path: `${output}/scattered-memory-desktop.png` });
		}
		await page.evaluate(() => document.querySelector<HTMLButtonElement>('#finish')!.click());
		await page.clock.runFor(350);
		expect((await centred()).phase).toBe('folding');
		await page.screenshot({ path: `${output}/round-${round}-fold.png` });
		await page.clock.runFor(500);
		const filed = await position();
		samples.push(filed);
		expect(Math.abs(filed.board.x - filed.stack.x - round * 2)).toBeLessThan(12);
		expect(Math.abs(filed.board.y - filed.stack.y + round)).toBeLessThan(12);
		await page.screenshot({ path: `${output}/round-${round}-file.png` });
		await page.clock.runFor(100);
		expect((await position()).phase).toBe('result');
		if (round < 2) {
			await page.evaluate(() => document.querySelector<HTMLButtonElement>('#next')!.click());
			await page.clock.runFor(350);
		}
	}
	await writeFile(`${output}/centred-transitions.json`, JSON.stringify(samples, null, 2) + '\n');
});

test('result panel fades and rises once while only the large score scrambles', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.clock.install({ time: new Date('2026-10-28T00:00:00Z') });
	await page.clock.pauseAt(new Date('2026-10-28T00:00:01Z'));
	await page.goto('/demo/card-proof.html');
	await page.clock.runFor(8400);
	await page.evaluate(() => document.querySelector<HTMLButtonElement>('#finish')!.click());
	await page.clock.runFor(900);
	const frame = () =>
		page.locator('.proof-result-inner').evaluate((panel) => {
			const style = getComputedStyle(panel);
			return {
				opacity: Number(style.opacity),
				y: style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42
			};
		});
	const start = await frame();
	// WebKit can advance one RAF when the fold deadline and its microtasks finish.
	// The first sampled result must still be near the hidden/lowered starting frame.
	expect(start.opacity).toBeGreaterThanOrEqual(0);
	expect(start.opacity).toBeLessThan(0.15);
	expect(start.y).toBeGreaterThan(17);
	expect(start.y).toBeLessThanOrEqual(20);
	await expect(page.locator('#next')).toBeEnabled();
	await page.clock.runFor(120);
	const middle = await frame();
	expect(middle.opacity).toBeGreaterThan(start.opacity);
	expect(middle.opacity).toBeLessThan(1);
	expect(middle.y).toBeGreaterThan(0);
	expect(middle.y).toBeLessThan(start.y);
	await expect(page.locator('.scramble-visual')).toHaveCount(1);
	await expect(page.locator('.proof-result-summary h2')).toHaveText('Well played.');
	await expect(page.locator('.sample-high')).toHaveText('1200');
	const output = `build/v1.1-card/review-fix/${info.project.name}`;
	await mkdir(output, { recursive: true });
	await page.screenshot({ path: `${output}/result-enter-middle.png` });
	await page.clock.runFor(400);
	const settled = await frame();
	expect(settled).toEqual({ opacity: 1, y: 0 });
	await expect(page.locator('.sample-score')).toHaveText('1200');
	await expect(page.locator('.scramble-visual')).toHaveCount(0);
	await page.screenshot({ path: `${output}/result-enter-settled.png` });
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.clock.runFor(100);
	expect(await frame()).toEqual(settled);
	await page.evaluate(() => document.querySelector<HTMLButtonElement>('#next')!.click());
	await page.clock.runFor(6000);
	await page.evaluate(() => document.querySelector<HTMLButtonElement>('#finish')!.click());
	await page.clock.runFor(1000);
	expect((await frame()).opacity).toBeLessThan(1);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.clock.runFor(20);
	expect(await frame()).toEqual({ opacity: 1, y: 0 });
	await expect(page.locator('.sample-score')).toHaveText('450');
	await expect(page.locator('.scramble-visual')).toHaveCount(0);
	await writeFile(
		`${output}/result-entrance.json`,
		JSON.stringify(
			{ durationMs: 420, start, middle, settled, reducedMotionSettles: true },
			null,
			2
		) + '\n'
	);
});
