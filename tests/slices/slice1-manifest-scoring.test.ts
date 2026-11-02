import { expect, it } from 'vitest';
import { mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { catalog } from '../../src/lib/catalog.js';
import type { PuzzleId, PuzzleManifest } from '../../src/lib/engine/contract.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';
import { defaultScoreConfig, validateScoreValues } from '../../src/lib/scoring.js';
import { messages, t, type MessageKey } from '../../src/lib/i18n/messages.js';

const puzzlesPath = resolve('src/lib/puzzles');
const syntheticId: PuzzleId = 'slice1-synthetic';
const synthetic: PuzzleManifest = {
	id: syntheticId,
	engineVersion: 'synthetic-engine-1',
	maxMoves: 1,
	parseMove: (move) => ({ novel: move.novel }),
	leaderboardGroups: ['synthetic-engine-1'],
	rankedTiming: null,
	scoring: { version: 'synthetic-score-1', fields: ['novel'], defaults: { novel: 37 } },
	messages: { 'synthetic.headline': 'Finished', 'synthetic.subline': 'Score {score}' },
	createRound: (seed) => ({ seed }),
	ending: {
		kind: 'completion',
		headlines: { default: 'synthetic.headline' },
		subline: { key: 'synthetic.subline', values: ['score'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition: 'Synthetic acceptance fixture.'
	},
	replay: () => ({ score: 37, group: 'synthetic-engine-1', pairs: null, moves: 1 })
};

it('discovers every puzzle manifest and uses its scoring fields, defaults, versions and messages', async () => {
	const folders = (await readdir(puzzlesPath, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.sort((a, b) => a.name.localeCompare(b.name));
	const ids = [];
	for (const folder of folders) {
		const { manifest } = (await import(`../../src/lib/puzzles/${folder.name}/manifest.ts`)) as {
			manifest: PuzzleManifest;
		};
		ids.push(manifest.id);
		expect(catalog[manifest.id]).toMatchObject({
			id: manifest.id,
			engineVersion: manifest.engineVersion,
			scoring: manifest.scoring,
			messages: manifest.messages,
			ending: manifest.ending
		});
		expect(manifest.engineVersion.length).toBeGreaterThan(0);
		expect(manifest.scoring.fields).toEqual(Object.keys(manifest.scoring.defaults));
		expect(defaultScoreConfig(manifest.id)).toEqual({
			version: manifest.scoring.version,
			values: manifest.scoring.defaults
		});
		expect(defaultScoreConfig(manifest.id).values).toEqual(manifest.scoring.defaults);
		expect(validateScoreValues(manifest.id, manifest.scoring.defaults)).toEqual(
			manifest.scoring.defaults
		);
		const changed = Object.fromEntries(manifest.scoring.fields.map((field) => [field, 7]));
		expect(validateScoreValues(manifest.id, changed)).toEqual(changed);
		expect(() => validateScoreValues(manifest.id, { ...changed, unexpected: 7 })).toThrow();
		const bundleSource = await readFile(join(puzzlesPath, folder.name, 'messages.ts'), 'utf8');
		expect(Object.keys(manifest.messages).length).toBeGreaterThan(0);
		for (const [key, value] of Object.entries(manifest.messages)) {
			expect(bundleSource).toContain(key);
			expect(messages[key as MessageKey]).toBe(value);
			expect(t(key as MessageKey)).toBe(value);
		}
	}
	expect(ids.sort()).toEqual(Object.keys(catalog).sort());
	const core = await readFile('src/lib/engine/scoring.ts', 'utf8');
	expect(core).not.toMatch(/SCORE_FAMILIES|SCORE_DEFAULTS|\bblock\b|\bmemory\b|\bconnect\b/);
	const shell = await readFile('src/lib/i18n/messages.ts', 'utf8');
	expect(shell).not.toMatch(
		/['"](?:ending\.(?:block|memory|connect)\.|v1\.game\.(?:block|memory|connect)(?:\.|['"]))/
	);
});

it('accepts a novel family and fields without extending the engine', () => {
	catalog[syntheticId] = synthetic;
	puzzleMetadata[syntheticId] = {
		engineVersion: synthetic.engineVersion,
		scoring: synthetic.scoring,
		ending: synthetic.ending
	};
	try {
		expect(defaultScoreConfig(syntheticId)).toEqual({
			version: 'synthetic-score-1',
			values: { novel: 37 }
		});
		expect(validateScoreValues(syntheticId, { novel: 0 })).toEqual({ novel: 0 });
		expect(() => validateScoreValues(syntheticId, { pair: 37 })).toThrow('score_values');
	} finally {
		delete catalog[syntheticId];
		delete puzzleMetadata[syntheticId];
	}
	for (const family of ['missing-family', '__proto__', 'constructor', 'toString']) {
		expect(() => defaultScoreConfig(family)).toThrow('score_family');
		expect(() => validateScoreValues(family, {})).toThrow('score_family');
	}
});

it('generates and type-checks a catalog with an extra manifest and its messages without engine edits', async () => {
	const fixture = await mkdtemp(join(tmpdir(), 'morphi-slice1-'));
	try {
		const fixtureLib = join(fixture, 'src/lib');
		const fixturePuzzles = join(fixtureLib, 'puzzles');
		await mkdir(join(fixturePuzzles, syntheticId), { recursive: true });
		for (const folder of await readdir(puzzlesPath)) {
			await symlink(join(puzzlesPath, folder), join(fixturePuzzles, folder));
		}
		await symlink(resolve('src/lib/engine'), join(fixtureLib, 'engine'));
		const declaration = JSON.stringify({ ...synthetic, replay: undefined }).slice(0, -1);
		await writeFile(
			join(fixturePuzzles, syntheticId, 'manifest.ts'),
			`import type { PuzzleManifest } from '${resolve('src/lib/engine/contract.js')}';\nexport const manifest = ${declaration}, createRound: (seed: string) => ({seed}), parseMove: (move) => ({novel:move.novel}), replay: () => ({score:37,group:"synthetic-engine-1",pairs:null,moves:1}) } satisfies PuzzleManifest;\n`
		);
		const generated = spawnSync('bun', [resolve('scripts/generate-registry.ts')], {
			cwd: fixture,
			encoding: 'utf8'
		});
		expect(generated.status, generated.stderr).toBe(0);
		const loaded = spawnSync(
			'bun',
			[
				'-e',
				`import {catalog,puzzleMessages} from ${JSON.stringify(join(fixtureLib, 'catalog.ts'))}; import {familyIndex} from ${JSON.stringify(join(fixtureLib, 'family-index.ts'))}; import {puzzleMetadata} from ${JSON.stringify(join(fixtureLib, 'puzzle-metadata.ts'))}; console.log(JSON.stringify({scoring:catalog[${JSON.stringify(syntheticId)}].scoring,message:puzzleMessages['synthetic.headline'],metadata:puzzleMetadata[${JSON.stringify(syntheticId)}],family:familyIndex.find(entry=>entry.id===${JSON.stringify(syntheticId)})}));`
			],
			{ cwd: fixture, encoding: 'utf8' }
		);
		expect(loaded.status, loaded.stderr).toBe(0);
		expect(JSON.parse(loaded.stdout)).toEqual({
			scoring: synthetic.scoring,
			message: 'Finished',
			metadata: {
				engineVersion: synthetic.engineVersion,
				scoring: synthetic.scoring,
				ending: synthetic.ending
			},
			family: { id: syntheticId, weight: 1, enabled: true, orientation: 'any' }
		});
		await writeFile(
			join(fixture, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: {
					target: 'ES2022',
					module: 'ESNext',
					moduleResolution: 'Bundler',
					strict: true,
					noEmit: true,
					skipLibCheck: true,
					types: [],
					paths: { '#lib/*': [resolve('src/lib/*')] }
				},
				files: [
					join(fixtureLib, 'catalog.ts'),
					join(fixtureLib, 'family-index.ts'),
					join(fixtureLib, 'puzzle-metadata.ts')
				]
			})
		);
		const checked = spawnSync(
			'bun',
			[resolve('node_modules/typescript/bin/tsc'), '-p', join(fixture, 'tsconfig.json')],
			{
				cwd: fixture,
				encoding: 'utf8'
			}
		);
		expect(checked.status, checked.stdout + checked.stderr).toBe(0);
	} finally {
		await rm(fixture, { recursive: true, force: true });
	}
}, 30000);
