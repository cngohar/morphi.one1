import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import type { Component } from 'svelte';
import { checkLazyBundle, type ClientChunks } from '../../scripts/check-lazy-bundle.js';
import { catalog } from '../../src/lib/catalog.js';
import { loadPuzzleView, type PuzzleViewProps } from '../../src/lib/ui/puzzle-view.js';
import * as storage from '../../src/lib/ui/storage.js';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function lazyImports(source: string): Record<string, string> {
	const result: Record<string, string> = {};
	const tree = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.Latest, true);
	function visit(node: ts.Node) {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			expect(node.moduleSpecifier.text).not.toContain('/puzzles/');
		}
		if (
			ts.isPropertyAssignment(node) &&
			ts.isArrowFunction(node.initializer) &&
			ts.isCallExpression(node.initializer.body) &&
			node.initializer.body.expression.kind === ts.SyntaxKind.ImportKeyword
		) {
			const argument = node.initializer.body.arguments[0];
			expect(ts.isStringLiteral(argument)).toBe(true);
			if (ts.isStringLiteral(argument)) {
				const name = node.name;
				if (ts.isIdentifier(name) || ts.isStringLiteral(name)) result[name.text] = argument.text;
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return result;
}

it('discovers every manifest id and gives it an independent dynamic view import', async () => {
	const expected: Record<string, string> = {};
	for (const entry of await readdir('src/lib/puzzles', { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const { manifest } = await import(`../../src/lib/puzzles/${entry.name}/manifest.ts`);
		expected[manifest.id] = `./puzzles/${entry.name}/View.svelte`;
		expect(catalog[manifest.id]).toBe(manifest);
	}
	const registry = await readFile('src/lib/registry.ts', 'utf8');
	expect(lazyImports(registry)).toEqual(expected);
	for (const file of ['src/lib/registry.ts', 'src/lib/catalog.ts']) {
		const source = await readFile(file, 'utf8');
		expect(source).not.toMatch(/Game\.svelte|\/logic\.js|create(?:Block|Memory|Connect)Round/);
	}
	const shell = await readFile('src/lib/screens/PlaySession.svelte', 'utf8');
	expect(shell).not.toMatch(/BlockRound|MemoryRound|ConnectRound|BlockGame|MemoryGame|ConnectGame/);
	expect(shell).not.toMatch(/family\s*===\s*['"](?:block|memory|connect)['"]/);
});

it('generates a novel id independently of its folder and rejects duplicate or missing ids', async () => {
	const fixture = await mkdtemp(join(tmpdir(), 'morphi-slice2-'));
	const directory = join(fixture, 'src/lib/puzzles/novel-folder');
	const manifest = {
		id: 'novel-id',
		engineVersion: 'novel-1',
		maxMoves: 1,
		scoring: { version: 'novel-score-1', fields: ['novel'], defaults: { novel: 7 } },
		messages: { 'novel.headline': 'Finished', 'novel.subline': 'Score {score}' },
		ending: {
			kind: 'completion',
			headlines: { default: 'novel.headline' },
			subline: { key: 'novel.subline', values: ['score'] },
			animation: 'fade-rise',
			continue: 'auto_500ms',
			condition: 'Synthetic fixture finishes.'
		}
	};
	const declaration = (id: string | null) =>
		`export const manifest = {...${JSON.stringify({ ...manifest, id })}, createRound: seed => ({seed}), replay: () => ({score:7,group:'novel-1',pairs:null,moves:1})};`;
	const generate = () =>
		spawnSync('bun', [resolve('scripts/generate-registry.ts')], {
			cwd: fixture,
			encoding: 'utf8'
		});
	try {
		await mkdir(directory, { recursive: true });
		await writeFile(join(directory, 'manifest.ts'), declaration('novel-id'));
		await writeFile(join(directory, 'View.svelte'), '<p>Fixture</p>');
		const generated = generate();
		expect(generated.status, generated.stderr).toBe(0);
		expect(lazyImports(await readFile(join(fixture, 'src/lib/registry.ts'), 'utf8'))).toEqual({
			'novel-id': './puzzles/novel-folder/View.svelte'
		});
		const loaded = spawnSync(
			'bun',
			[
				'-e',
				`import { catalog } from ${JSON.stringify(join(fixture, 'src/lib/catalog.ts'))}; console.log(JSON.stringify(catalog['novel-id'].createRound('123')));`
			],
			{ cwd: fixture, encoding: 'utf8' }
		);
		expect(loaded.status, loaded.stderr).toBe(0);
		expect(JSON.parse(loaded.stdout)).toEqual({ seed: '123' });
		const duplicate = join(fixture, 'src/lib/puzzles/other-folder');
		await mkdir(duplicate);
		await writeFile(join(duplicate, 'manifest.ts'), declaration('novel-id'));
		const repeated = generate();
		expect(repeated.status).not.toBe(0);
		expect(repeated.stderr).toContain('Missing or duplicate puzzle id');
		await writeFile(join(duplicate, 'manifest.ts'), declaration(null));
		const missing = generate();
		expect(missing.status).not.toBe(0);
		expect(missing.stderr).toContain('Missing or duplicate puzzle id');
	} finally {
		await rm(fixture, { recursive: true, force: true });
	}
}, 30000);

function fixtureChunks(): ClientChunks {
	return {
		'shell.js': {
			imports: ['shared.js'],
			dynamicImports: ['alpha.js', 'beta.js'],
			modules: ['/repo/src/lib/screens/PlaySession.svelte']
		},
		'shared.js': {
			imports: [],
			dynamicImports: [],
			modules: ['/repo/node_modules/svelte/index.js']
		},
		'alpha.js': {
			imports: ['shared.js'],
			dynamicImports: [],
			modules: [
				'/repo/src/lib/puzzles/alpha/View.svelte',
				'/repo/src/lib/puzzles/alpha/Game.svelte'
			]
		},
		'beta.js': {
			imports: ['shared.js'],
			dynamicImports: [],
			modules: ['/repo/src/lib/puzzles/beta/View.svelte', '/repo/src/lib/puzzles/beta/Game.svelte']
		}
	};
}

it('checks the emitted static graph, including indirect imports, merged views and missing chunks', () => {
	const valid = fixtureChunks();
	expect(() => checkLazyBundle(valid, ['alpha', 'beta'])).not.toThrow();
	const indirect = fixtureChunks();
	indirect['shared.js'].imports.push('alpha.js');
	expect(() => checkLazyBundle(indirect, ['alpha', 'beta'])).toThrow('Shell statically loads');
	const merged = fixtureChunks();
	merged['alpha.js'].imports.push('beta.js');
	expect(() => checkLazyBundle(merged, ['alpha', 'beta'])).toThrow('another family');
	const eager = fixtureChunks();
	eager['shell.js'].modules.push('/repo/src/lib/puzzles/alpha/Game.svelte');
	expect(() => checkLazyBundle(eager, ['alpha', 'beta'])).toThrow('Shell statically loads');
	const missing = fixtureChunks();
	delete missing['shared.js'];
	expect(() => checkLazyBundle(missing, ['alpha', 'beta'])).toThrow('Missing client chunk');
	const notDynamic = fixtureChunks();
	notDynamic['shell.js'].dynamicImports = ['alpha.js'];
	expect(() => checkLazyBundle(notDynamic, ['alpha', 'beta'])).toThrow('no dynamic import');
});

it('derives new-family best and played keys while retaining existing saved values and versions', () => {
	const disk = new Map([['morphi.block.best', '31']]);
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => disk.get(key) ?? null,
		setItem: (key: string, value: string) => disk.set(key, value)
	});
	expect(storage.loadBestScore('block')).toBe(31);
	expect(storage.loadFamilyPlayed('slice2-novel-id')).toBe(false);
	storage.saveBestScore(37, 'slice2-novel-id');
	storage.saveBestScore(57, 'slice2-novel-id', 'alternate');
	storage.markFamilyPlayed('slice2-novel-id');
	expect(disk.get('morphi.slice2-novel-id.best')).toBe('37');
	expect(disk.get('morphi.slice2-novel-id.best.alternate')).toBe('57');
	expect(disk.get('morphi.slice2-novel-id.played')).toBe('1');
	expect(storage.loadBestScore('slice2-novel-id')).toBe(37);
	expect(storage.loadBestScore('slice2-novel-id', 'alternate')).toBe(57);
	expect(storage.loadFamilyPlayed('slice2-novel-id')).toBe(true);
	expect(storage.loadBestScore('block')).toBe(31);
});

it('loads a view and clears its timeout and abort listener on success or rejection', async () => {
	vi.useFakeTimers();
	const view = vi.fn() as unknown as Component<PuzzleViewProps>;
	const controller = new AbortController();
	const remove = vi.spyOn(controller.signal, 'removeEventListener');
	await expect(loadPuzzleView(async () => ({ default: view }), controller.signal)).resolves.toBe(
		view
	);
	expect(vi.getTimerCount()).toBe(0);
	expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
	await expect(
		loadPuzzleView(() => Promise.reject(new Error('chunk_failed')), controller.signal)
	).rejects.toThrow('chunk_failed');
	expect(vi.getTimerCount()).toBe(0);
	await expect(
		loadPuzzleView(() => {
			throw new Error('sync_failed');
		}, controller.signal)
	).rejects.toThrow('sync_failed');
	expect(vi.getTimerCount()).toBe(0);
});

it('bounds hanging view loads and ignores late resolution after timeout or navigation', async () => {
	vi.useFakeTimers();
	let finish!: (value: { default: Component<PuzzleViewProps> }) => void;
	const pending = new Promise<{ default: Component<PuzzleViewProps> }>((resolve) => {
		finish = resolve;
	});
	const controller = new AbortController();
	const timedOut = expect(loadPuzzleView(() => pending, controller.signal)).rejects.toThrow(
		'view_load_timeout'
	);
	await vi.advanceTimersByTimeAsync(8000);
	await timedOut;
	expect(vi.getTimerCount()).toBe(0);
	finish({ default: vi.fn() as unknown as Component<PuzzleViewProps> });
	const leaving = new AbortController();
	const cancelled = expect(
		loadPuzzleView(() => new Promise(() => {}), leaving.signal)
	).rejects.toThrow('round_cancelled');
	leaving.abort();
	await cancelled;
	expect(vi.getTimerCount()).toBe(0);
	const load = vi.fn();
	await expect(loadPuzzleView(load, leaving.signal)).rejects.toThrow('round_cancelled');
	expect(load).not.toHaveBeenCalled();
});
