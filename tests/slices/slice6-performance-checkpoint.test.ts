import { expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	loadPerformanceCheckpoint,
	savePerformanceCheckpoint
} from '../../scripts/performance-checkpoint.js';

it('resumes matching samples and preserves stale or corrupt checkpoints without partial writes', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'morphi-performance-checkpoint-'));
	const path = join(directory, 'checkpoint.json');
	try {
		expect(await loadPerformanceCheckpoint(path, 'first')).toBeNull();
		const checkpoint = { fingerprint: 'first', samples: [{ lcpMs: 123 }] };
		await savePerformanceCheckpoint(path, checkpoint);
		expect(await loadPerformanceCheckpoint(path, 'first')).toEqual(checkpoint);
		expect(await readdir(directory)).toEqual(['checkpoint.json']);
		expect(await loadPerformanceCheckpoint(path, 'second')).toBeNull();
		const [stale] = await readdir(directory);
		expect(stale).toMatch(/^checkpoint\.stale-/);
		expect(JSON.parse(await readFile(join(directory, stale), 'utf8'))).toEqual(checkpoint);
		await writeFile(path, '{interrupted old write');
		expect(await loadPerformanceCheckpoint(path, 'second')).toBeNull();
		expect(await readdir(directory)).toHaveLength(2);
		expect((await readdir(directory)).every((file) => file.startsWith('checkpoint.stale-'))).toBe(
			true
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
