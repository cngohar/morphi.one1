import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, firefox, webkit } from '@playwright/test';
import type { verifyVectors } from '../tests/vectors/runner.js';
const run = promisify(execFile);
const memoryOnly = process.argv.includes('--memory');
const directory = await mkdtemp(join(tmpdir(), 'morphi-vectors-'));
const server = createServer((_request, response) => {
	response.setHeader('Content-Type', 'text/html');
	response.end('<!doctype html><title>Local vectors</title>');
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Local server address missing.');
let worker: ReturnType<typeof spawn> | undefined;
const results: { runtime: string; result: unknown }[] = [];
try {
	for (const [entry, target] of [
		['node', 'node'],
		['browser', 'browser'],
		['worker', 'browser']
	] as const) {
		await run('bun', [
			'build',
			`tests/vectors/${memoryOnly ? 'memory-' : ''}${entry}.ts`,
			'--target',
			target,
			'--format',
			entry === 'browser' ? 'iife' : 'esm',
			'--outfile',
			join(directory, `${entry}.mjs`)
		]);
	}
	for (const executable of ['node', 'bun']) {
		const { stdout } = await run(executable, [join(directory, 'node.mjs')]);
		results.push({ runtime: executable, result: JSON.parse(stdout) });
	}
	for (const [name, browserType] of [
		['Chromium', chromium],
		['Firefox', firefox],
		['WebKit', webkit]
	] as const) {
		const browser = await browserType.launch();
		try {
			const page = await browser.newPage();
			await page.goto(`http://127.0.0.1:${address.port}`);
			await page.addScriptTag({ content: await readFile(join(directory, 'browser.mjs'), 'utf8') });
			const result = await page.evaluate(() =>
				(
					globalThis as typeof globalThis & { verifyMorphiVectors: typeof verifyVectors }
				).verifyMorphiVectors()
			);
			results.push({ runtime: name, result });
		} finally {
			await browser.close();
		}
	}
	await writeFile(
		join(directory, 'wrangler.jsonc'),
		JSON.stringify({
			name: 'morphi-local-vector-check',
			main: './worker.mjs',
			compatibility_date: '2026-10-22',
			workers_dev: false
		})
	);
	// Reuse the OS-assigned test port once browser vectors finish. A fixed
	// Worker port can collide with another local project on the same machine.
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
	worker = spawn(
		'bunx',
		[
			'wrangler',
			'dev',
			'--config',
			join(directory, 'wrangler.jsonc'),
			'--local',
			'--port',
			String(address.port),
			'--inspector-port',
			'0',
			'--log-level',
			'error'
		],
		{ stdio: ['ignore', 'ignore', 'pipe'] }
	);
	let startupError = '';
	worker.stderr?.on('data', (chunk) => {
		startupError = (startupError + chunk.toString()).slice(-8192);
	});
	worker.on('error', (error) => {
		startupError = error.message;
	});
	let result;
	for (let attempt = 0; attempt < 120; attempt++) {
		if (worker.exitCode !== null)
			throw new Error(`Local Worker exited (${worker.exitCode}): ${startupError}`);
		try {
			const response = await fetch(`http://127.0.0.1:${address.port}`);
			if (response.ok) {
				result = await response.json();
				break;
			}
		} catch {
			/* Local Worker booting. */
		}
		await delay(250);
	}
	if (!result) throw new Error(`Local Worker vector harness did not become ready. ${startupError}`);
	results.push({ runtime: 'Worker (workerd)', result });
	if (new Set(results.map(({ result }) => JSON.stringify(result))).size !== 1)
		throw new Error('Runtime vector results differ.');
	console.info(JSON.stringify(results, null, 2));
} finally {
	worker?.kill();
	if (server.listening) server.close();
	await rm(directory, { recursive: true, force: true });
}
