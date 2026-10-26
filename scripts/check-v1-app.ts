import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'build/v1-integration-review';
await mkdir(output, { recursive: true });
const findings: unknown[] = [];
const origin = process.env.MORPHI_REVIEW_ORIGIN ?? 'http://localhost:5173';
for (const [browserName, launcher] of [
	['chromium', chromium],
	['firefox', firefox],
	['webkit', webkit]
] as const) {
	const browser = await launcher.launch();
	for (const [width, height] of [
		[390, 844],
		[844, 390],
		[1280, 800],
		[568, 320],
		[320, 480]
	]) {
		const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.addInitScript(() => {
			const original = crypto.getRandomValues.bind(crypto);
			crypto.getRandomValues = (array) => {
				if (array instanceof Uint32Array && array.length === 2) {
					array[0] = 0;
					array[1] = 3;
					return array;
				}
				return original(array);
			};
		});
		const capture = async (name: string) => {
			const dimensions = await page.evaluate(() => ({
				width: innerWidth,
				height: innerHeight,
				scrollWidth: document.documentElement.scrollWidth,
				scrollHeight: document.documentElement.scrollHeight,
				heading: document.querySelector('h1')?.textContent,
				board: document.querySelector('.board')?.getBoundingClientRect().toJSON()
			}));
			findings.push({ browserName, name, ...dimensions, errors: [...errors] });
			if (browserName === 'chromium')
				await page.screenshot({ path: `${output}/${name}-${width}x${height}.png`, fullPage: true });
		};
		await page.goto(origin, { waitUntil: 'networkidle' });
		await capture('app-home');
		if (browserName === 'chromium') {
			await page.goto(`${origin}/demo/v1-screen.html?screen=home`, { waitUntil: 'networkidle' });
			await capture('demo-home');
		}
		for (const [path, family] of [
			['/memory', 'memory'],
			['/block-puzzle', 'block']
		] as const) {
			await page.goto(origin + path, { waitUntil: 'networkidle' });
			await capture(`app-${family}-ready`);
			await page.getByRole('button', { name: 'Play', exact: true }).click();
			await page.locator('.game').waitFor();
			await page.waitForFunction(
				() => document.querySelector('.game')?.getAttribute('data-phase') === 'playing'
			);
			await capture(`app-${family}-active`);
			if (family === 'memory') {
				const cards = page.locator('.memory-card');
				const symbols = await cards.evaluateAll((nodes) =>
					nodes.map((node) => node.querySelector('.card-front svg')?.outerHTML)
				);
				const pairs = new Map<string, number[]>();
				symbols.forEach((symbol, index) => {
					if (symbol) pairs.set(symbol, [...(pairs.get(symbol) ?? []), index]);
				});
				for (const indices of pairs.values()) {
					await cards.nth(indices[0]!).click();
					await cards.nth(indices[1]!).click();
				}
				await page.locator('.result').waitFor();
				await capture('app-result');
			}
		}
		if (browserName === 'chromium') {
			for (const screen of ['memory', 'block', 'result']) {
				await page.goto(`${origin}/demo/v1-screen.html?screen=${screen}`, {
					waitUntil: 'networkidle'
				});
				await capture(`demo-${screen}`);
			}
		}
		await page.close();
	}
	await browser.close();
}
await writeFile(`${output}/results.json`, JSON.stringify(findings, null, 2) + '\n');
console.log(`${findings.length} viewport/browser captures written to ${output}`);
