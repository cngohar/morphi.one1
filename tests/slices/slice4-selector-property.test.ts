import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import type {
	PuzzleFamilyEntry,
	PuzzleManifest,
	PuzzleMetadata
} from '../../src/lib/engine/contract.js';
import { createRng, type Rng } from '../../src/lib/engine/rng.js';
import { familyIndex } from '../../src/lib/family-index.js';
import { puzzlePools } from '../../src/lib/registry.js';
import { catalog } from '../../src/lib/catalog.js';
import { puzzleMetadata } from '../../src/lib/puzzle-metadata.js';
import { createPuzzleSelector, selectorGap, type FamilyWeight } from '../../src/lib/selector.js';
import { eligibleFamilies, selectorAvailability } from '../../src/lib/ui/selector-eligibility.js';

const families: FamilyWeight<string>[] = [
	{ family: 'block', weight: 1 },
	{ family: 'memory', weight: 1 },
	{ family: 'connect', weight: 1 }
];

let storage: typeof import('../../src/lib/ui/storage.js');
let disk: Map<string, string>;

beforeEach(async () => {
	vi.resetModules();
	disk = new Map();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => disk.get(key) ?? null,
		setItem: (key: string, value: string) => disk.set(key, value)
	});
	storage = await import('../../src/lib/ui/storage.js');
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('Slice 4 selector rotation', () => {
	it('uses the clamped gap formula and the one-family repeat exception', () => {
		expect(selectorGap(1)).toBe(0);
		for (let count = 2; count <= 50; count++)
			expect(selectorGap(count)).toBe(Math.min(5, Math.max(1, Math.floor(count / 3))));

		const only = createPuzzleSelector({
			families: [{ family: 'only', weight: 1 }],
			rng: createRng('1')
		});
		expect(Array.from({ length: 6 }, () => only.next())).toEqual(Array(6).fill('only'));
	});

	it.each([2, 3, 4, 6, 9, 18, 50])(
		'deals each of %i families once per cycle without short gaps',
		(count) => {
			const entries = Array.from({ length: count }, (_, index) => ({
				family: `family-${index}`,
				weight: index + 1
			}));
			const ids = entries.map((entry) => entry.family).sort();
			const gap = selectorGap(count);
			for (let seed = 0; seed < 20; seed++) {
				const selector = createPuzzleSelector({ families: entries, rng: createRng(String(seed)) });
				const picks = Array.from({ length: count * 6 }, () => selector.next());
				for (let cycle = 0; cycle < 6; cycle++)
					expect(picks.slice(cycle * count, (cycle + 1) * count).sort()).toEqual(ids);
				for (let index = 1; index < picks.length; index++) {
					expect(picks[index]).not.toBe(picks[index - 1]);
					expect(picks.slice(Math.max(0, index - gap), index)).not.toContain(picks[index]);
				}
			}
		}
	);

	it('uses a dynamic discovery boost to move an unplayed family earlier', () => {
		const entries = [
			{ family: 'discovery', weight: 1 },
			{ family: 'other-a', weight: 1 },
			{ family: 'other-b', weight: 1 },
			{ family: 'other-c', weight: 1 }
		];
		const averageDiscoveryPosition = (boostAfterFirstCycle: boolean) => {
			let positionTotal = 0;
			for (let seed = 0; seed < 1000; seed++) {
				let discoveryWeight = 1;
				const selector = createPuzzleSelector({
					families: entries,
					rng: createRng(String(seed)),
					weight: (entry) => entry.weight * (entry.family === 'discovery' ? discoveryWeight : 1)
				});
				for (let pick = 0; pick < entries.length; pick++) selector.next();
				if (boostAfterFirstCycle) discoveryWeight = 2;
				const nextCycle = Array.from({ length: entries.length }, () => selector.next());
				positionTotal += nextCycle.indexOf('discovery');
			}
			return positionTotal / 1000;
		};

		expect(averageDiscoveryPosition(true)).toBeLessThan(averageDiscoveryPosition(false) - 0.1);
	});

	it('restores exact queued state despite a different RNG and isolates guest/account keys', () => {
		const original = createPuzzleSelector({ families, rng: createRng('31') });
		original.next();
		original.next();
		const guestState = original.snapshot();
		const accountSelector = createPuzzleSelector({ families, rng: createRng('17') });
		accountSelector.next();
		const accountState = accountSelector.snapshot();

		storage.saveSelectorState(null, guestState);
		storage.saveSelectorState('owner / one', accountState);
		expect(disk.get('morphi.selector.v2.guest')).toBe(JSON.stringify(guestState));
		expect(disk.get('morphi.selector.v2.account:owner%20%2F%20one')).toBe(
			JSON.stringify(accountState)
		);
		expect(storage.loadSelectorState(null)).toEqual(guestState);
		expect(storage.loadSelectorState('owner / one')).toEqual(accountState);

		const restored = createPuzzleSelector({
			families,
			rng: createRng('999'),
			state: storage.loadSelectorState(null)
		});
		expect(restored.snapshot()).toEqual(guestState);
		expect(restored.next()).toBe(guestState.queue[0]);
		expect(restored.snapshot().cyclePosition).toBe(guestState.cyclePosition + 1);
	});

	it('drops malformed or stale snapshots and keeps storage failures scoped by owner', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		disk.set('morphi.selector.v2.guest', '{broken');
		expect(storage.loadSelectorState(null)).toBeUndefined();

		const stale = {
			version: 2,
			eligible: ['memory'],
			queue: ['not-a-family'],
			recent: [],
			cyclePosition: 0
		};
		const reset = createPuzzleSelector({ families, rng: createRng('43'), state: stale });
		expect(reset.snapshot()).toEqual({
			version: 1,
			eligible: families.map((entry) => entry.family),
			queue: [],
			recent: [],
			cyclePosition: 0
		});
		expect(families.map((entry) => entry.family)).toContain(reset.next());

		const state = reset.snapshot();
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		storage.saveSelectorState(null, state);
		expect(storage.loadSelectorState(null)).toEqual(state);
		expect(storage.loadSelectorState('another-owner')).toBeUndefined();
	});
});

describe('Slice 4 family index and availability', () => {
	it('keeps the runtime-free family index in sync with catalog and lazy pools', async () => {
		const ids = Object.keys(catalog).sort();
		const manifests = Object.values(catalog) as (PuzzleManifest &
			Pick<PuzzleMetadata, 'backdropPieces'>)[];
		expect(familyIndex.map((entry) => entry.id).sort()).toEqual(ids);
		expect(Object.keys(puzzlePools).sort()).toEqual(ids);

		const expected = manifests
			.map((manifest) => ({
				id: manifest.id,
				weight: manifest.weight ?? 1,
				enabled: manifest.enabled ?? true,
				orientation: manifest.orientation ?? 'any',
				...(manifest.selectionOrder === undefined
					? {}
					: { selectionOrder: manifest.selectionOrder }),
				...(manifest.minViewportWidth === undefined
					? {}
					: { minViewportWidth: manifest.minViewportWidth }),
				...(manifest.minViewportHeight === undefined
					? {}
					: { minViewportHeight: manifest.minViewportHeight })
			}))
			.sort(
				(a, b) =>
					(a.selectionOrder ?? Number.MAX_SAFE_INTEGER) -
					(b.selectionOrder ?? Number.MAX_SAFE_INTEGER)
			);
		expect(familyIndex).toEqual(expected);
		for (const manifest of manifests)
			expect(puzzleMetadata[manifest.id]).toEqual({
				engineVersion: manifest.engineVersion,
				...(manifest.titleAfterEntrance === undefined
					? {}
					: { titleAfterEntrance: manifest.titleAfterEntrance }),
				scoring: manifest.scoring,
				ending: manifest.ending,
				...(manifest.presentation === undefined ? {} : { presentation: manifest.presentation }),
				...(manifest.backdropPieces === undefined
					? {}
					: { backdropPieces: manifest.backdropPieces })
			});

		const source = await readFile('src/lib/family-index.ts', 'utf8');
		expect(source).not.toMatch(/^\s*import\s+(?!type\b)/m);
		expect(source).not.toMatch(/\b(createRound|replay|messages|PuzzleManifest)\b/);
		for (const path of [
			'src/lib/screens/PlaySession.svelte',
			'src/lib/scoring.ts',
			'src/lib/i18n/messages.ts',
			'src/lib/components/PuzzleGuide.svelte',
			'src/lib/components/ScoringEditor.svelte',
			'src/lib/ui/puzzle-backdrop.ts',
			'src/lib/registry.ts'
		])
			expect(await readFile(path, 'utf8')).not.toContain('catalog.js');

		for (const id of ids) {
			const loaded = (await puzzlePools[id]!()).manifest;
			const manifest = catalog[id];
			expect(loaded.id).toBe(manifest.id);
			expect(loaded.engineVersion).toBe(manifest.engineVersion);
			expect(loaded.scoring).toEqual(manifest.scoring);
			expect(loaded.messages).toEqual(manifest.messages);
			expect(loaded.ending).toEqual(manifest.ending);
			expect(loaded.createRound('17')).toEqual(manifest.createRound('17'));
		}
	});

	it('filters availability by weight, enablement, orientation, and viewport size', () => {
		const index: PuzzleFamilyEntry[] = [
			{ id: 'block', weight: 1, enabled: true, orientation: 'any' },
			{
				id: 'memory',
				weight: 1,
				enabled: true,
				orientation: 'portrait',
				minViewportWidth: 400,
				minViewportHeight: 600
			},
			{
				id: 'connect',
				weight: 1,
				enabled: true,
				orientation: 'landscape',
				minViewportWidth: 800,
				minViewportHeight: 350
			},
			{ id: 'disabled', weight: 1, enabled: false, orientation: 'any' },
			{ id: 'zero-weight', weight: 0, enabled: true, orientation: 'any' }
		];
		const ids = index.map((entry) => entry.id);
		expect(eligibleFamilies(index, ids, 390, 844)).toEqual(['block']);
		expect(eligibleFamilies(index, ids, 430, 844)).toEqual(['block', 'memory']);
		expect(eligibleFamilies(index, ids, 844, 390)).toEqual(['block', 'connect']);
		expect(eligibleFamilies(index, ['memory', 'connect'], 844, 390)).toEqual(['connect']);
	});

	it('validates availability responses, allows zero weights, and accepts legacy lists', () => {
		const index: PuzzleFamilyEntry[] = [
			{ id: 'block', weight: 1, enabled: true, orientation: 'any' },
			{ id: 'memory', weight: 1, enabled: true, orientation: 'any' }
		];
		expect(selectorAvailability(index, { available: ['block'] })).toEqual({
			available: ['block'],
			weights: {}
		});
		expect(
			selectorAvailability(index, { available: ['block'], weights: { block: 0 } }).weights
		).toEqual({ block: 0 });

		for (const response of [
			null,
			{},
			{ available: ['unknown'] },
			{ available: ['block'], weights: {} },
			{ available: ['block'], weights: null },
			{ available: ['block'], weights: [] },
			...[-1, 1.5, 10001, NaN, Infinity, '1'].map((weight) => ({
				available: ['block'],
				weights: { block: weight }
			}))
		])
			expect(() => selectorAvailability(index, response)).toThrow('game_unavailable');

		const allZero = selectorAvailability(index, {
			available: ['block', 'memory'],
			weights: { block: 0, memory: 0 }
		});
		expect(
			eligibleFamilies(
				index,
				allZero.available.filter((id) => allZero.weights[id]! > 0),
				1280,
				800
			)
		).toEqual([]);
	});
});

describe('Slice 4 selector work bound', () => {
	function measuredCycle(count: number, seed: string) {
		let draws = 0;
		let repairChecks = 0;
		const source = createRng(seed);
		const rng: Rng = {
			nextU64: () => source.nextU64(),
			nextInt(maxExclusive) {
				draws++;
				return source.nextInt(maxExclusive);
			}
		};
		const entries = Array.from({ length: count }, (_, index) => ({
			family: `family-${index}`,
			weight: index < 5 ? 10_000 : 1
		}));
		const selector = createPuzzleSelector({
			families: entries,
			rng,
			state: {
				version: 1,
				eligible: entries.map((entry) => entry.family),
				queue: [],
				recent: entries.slice(0, 5).map((entry) => entry.family),
				cyclePosition: 0
			}
		});
		const includes = Array.prototype.includes;
		const includesSpy = vi.spyOn(Array.prototype, 'includes');
		includesSpy.mockImplementation(function (this: unknown[], searchElement, fromIndex) {
			repairChecks++;
			return includes.call(this, searchElement as never, fromIndex);
		});
		try {
			const started = performance.now();
			for (let pick = 0; pick < count * 10; pick++) selector.next();
			return { elapsedMs: performance.now() - started, draws, repairChecks };
		} finally {
			includesSpy.mockRestore();
		}
	}

	it('bounds refill work linearly and reports adversarial 50-family median/p95 timing', () => {
		const cyclesPerRun = 10;
		for (const count of [10, 25, 50]) {
			const result = measuredCycle(count, '40404');
			expect(result.draws).toBeGreaterThan(0);
			expect(result.draws).toBeLessThanOrEqual(count * 2 * cyclesPerRun);
			expect(result.repairChecks).toBeLessThanOrEqual(selectorGap(count) * count * cyclesPerRun);
		}

		const runs = Array.from({ length: 25 }, (_, index) => measuredCycle(50, String(index)));
		const sorted = runs.map((run) => run.elapsedMs).sort((a, b) => a - b);
		const medianMs = sorted[Math.floor(sorted.length / 2)]!;
		const p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1]!;
		console.info(
			JSON.stringify({
				diagnostic: 'slice4-selector-50',
				runtime: {
					platform: process.platform,
					arch: process.arch,
					version: process.version
				},
				samples: runs.length,
				families: 50,
				cyclesPerSample: cyclesPerRun,
				medianMs: Number(medianMs.toFixed(3)),
				p95Ms: Number(p95Ms.toFixed(3)),
				rngDrawsPerCycle: runs[0]!.draws / cyclesPerRun,
				gapRepairChecksPerCycle: runs[0]!.repairChecks / cyclesPerRun,
				network: 'none',
				warmup: '10/25/50-family bounds ran before these samples',
				setup: 'family entries, recent state and selector construction excluded',
				timingIncludesRepairCounter: true
			})
		);
		expect(p95Ms).toBeLessThan(1000);
		expect(
			runs.every(
				(run) =>
					run.draws <= 50 * 2 * cyclesPerRun &&
					run.repairChecks <= selectorGap(50) * 50 * cyclesPerRun
			)
		).toBe(true);
	});
});
