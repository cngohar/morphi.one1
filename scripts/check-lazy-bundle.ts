import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BundleChunk {
	imports: string[];
	dynamicImports: string[];
	modules: string[];
}
export type ClientChunks = Record<string, BundleChunk>;

export function checkLazyBundle(chunks: ClientChunks, directories: string[]): void {
	function closure(roots: string[]): Set<string> {
		const visited = new Set<string>();
		const pending = [...roots];
		while (pending.length) {
			const name = pending.pop()!;
			if (visited.has(name)) continue;
			assert(chunks[name], `Missing client chunk: ${name}`);
			visited.add(name);
			pending.push(...chunks[name].imports);
		}
		return visited;
	}
	function modules(names: Set<string>): string[] {
		return [...names].flatMap((name) => chunks[name].modules);
	}
	const entries = Object.entries(chunks);
	const shell = entries
		.filter(([, chunk]) =>
			chunk.modules.some((id) => /\/src\/(?:routes\/|lib\/(?!puzzles\/))/.test(id))
		)
		.map(([name]) => name);
	assert(shell.length, 'Missing application shell in client bundle report');
	assert(
		modules(closure(shell)).some((id) => id.endsWith('/screens/PlaySession.svelte')),
		'Missing PlaySession in client bundle report'
	);
	const game = /\/src\/lib\/puzzles\/([^/]+)\/Game\.svelte(?:\?|$)/;
	const eager = modules(closure(shell)).filter((id) => game.test(id));
	assert.deepEqual(eager, [], `Shell statically loads Game views: ${eager.join(', ')}`);
	const dynamic = new Set(entries.flatMap(([, chunk]) => chunk.dynamicImports));
	assert(directories.length, 'No puzzle directories to check');
	for (const directory of directories) {
		const suffix = `/src/lib/puzzles/${directory}/View.svelte`;
		const views = entries
			.filter(([, chunk]) => chunk.modules.some((id) => id.split('?')[0].endsWith(suffix)))
			.map(([name]) => name);
		assert.equal(views.length, 1, `Missing or duplicated lazy View: ${directory}`);
		assert(
			[...dynamic].some((name) => closure([name]).has(views[0])),
			`View has no dynamic import: ${directory}`
		);
		const families = modules(closure(views))
			.map((id) => game.exec(id)?.[1])
			.filter((id) => id !== undefined);
		assert.deepEqual(
			[...new Set(families)],
			[directory],
			`Lazy View statically loads another family (or misses its Game): ${directory}`
		);
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const chunks: ClientChunks = JSON.parse(
		await readFile('build/slice2/client-chunks.json', 'utf8')
	);
	const directories = (await readdir('src/lib/puzzles', { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	checkLazyBundle(chunks, directories);
	console.log(`Lazy client bundle: shell isolated; ${directories.length} independent Game views.`);
}
