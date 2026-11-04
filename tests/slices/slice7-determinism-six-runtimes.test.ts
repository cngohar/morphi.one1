import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { catalog } from '../../src/lib/catalog.js';
import { generateTheme } from '../../src/lib/engine/theme/generator.js';
import { verifyVectors } from '../vectors/runner.js';
import { createRng, shuffle } from '../../src/lib/engine/rng.js';

const run = promisify(execFile);
const base = 'v1.2-local-complete';

it('preserves frozen gameplay fixtures and the accepted Slice 5 cosmetic fixtures byte for byte', async () => {
	const { stdout } = await run('git', ['ls-tree', '-r', '--name-only', base, 'tests/vectors']);
	const fixtures = stdout
		.trim()
		.split('\n')
		.filter((path) => /\.(json|py)$/.test(path));
	expect(fixtures.length).toBeGreaterThan(0);
	for (const path of fixtures) {
		// Slice 5 intentionally versioned cosmetic output; gameplay remains frozen at Slice 0.
		const revision = path.endsWith('/themes.json') ? '5811356' : base;
		const frozen = await run('git', ['show', `${revision}:${path}`]);
		expect(await readFile(path, 'utf8'), path).toBe(frozen.stdout);
	}
});

it('rejects biased high draws and uses descending Fisher-Yates bounds without mutating input', () => {
	const rng = createRng('0');
	const draws = [(1n << 64n) - 1n, 7n];
	rng.nextU64 = () => draws.shift()!;
	expect(rng.nextInt(10)).toBe(7);
	expect(draws).toHaveLength(0);
	const bounds: number[] = [];
	const input = [0, 1, 2, 3];
	const shuffled = shuffle(
		{ nextU64: () => 0n, nextInt: (bound) => (bounds.push(bound), 0) },
		input
	);
	expect(bounds).toEqual([4, 3, 2]);
	expect(shuffled).toEqual([1, 2, 3, 0]);
	expect(input).toEqual([0, 1, 2, 3]);
});

it('reproduces frozen results in Node, Bun, Chromium, Firefox, WebKit and workerd', async () => {
	// Keep the existing six-runtime harness as the single implementation.
	const { stdout } = await run('bun', ['scripts/check-vectors.ts'], {
		timeout: 180_000,
		maxBuffer: 4 * 1024 * 1024
	});
	const results = JSON.parse(stdout) as {
		runtime: string;
		result: { passed: boolean; fingerprint: string; vectors: number; themeVectors: number };
	}[];
	expect(results.map(({ runtime }) => runtime)).toEqual([
		'node',
		'bun',
		'Chromium',
		'Firefox',
		'WebKit',
		'Worker (workerd)'
	]);
	const reference = JSON.parse(await readFile('tests/vectors/reference.json', 'utf8'));
	const fingerprint = createHash('sha256').update(JSON.stringify(reference)).digest('hex');
	for (const { result } of results) {
		expect(result).toEqual({ passed: true, fingerprint, vectors: 9, themeVectors: 6 });
	}
}, 200_000);

it('keeps cosmetic draws independent of every family board and authoritative replay', async () => {
	const before = await verifyVectors();
	for (const seed of ['0', '42', '18446744073709551615']) {
		for (const [family, manifest] of Object.entries(catalog)) {
			const board = manifest.createRound(seed);
			for (let draw = 0; draw < 3; draw++) generateTheme(String(draw), family);
			expect(manifest.createRound(seed)).toEqual(board);
		}
	}
	expect(await verifyVectors()).toEqual(before);
});
