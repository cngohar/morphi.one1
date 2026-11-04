import { expect, it } from 'vitest';
import { createPuzzleSelector } from './selector.js';
import { createRng } from './engine/rng.js';
import { puzzleMetadata } from './puzzle-metadata.js';
import { defaultScoreConfig, puzzleVariant, scoreScope, validateScoreValues } from './scoring.js';
import { selectorAvailability } from './ui/selector-eligibility.js';
import { familyIndex } from './family-index.js';
import { familyName } from './ui/puzzle-presentation.js';
import { validCheckpoint, type RoundCheckpoint } from './ui/checkpoint.js';

const variants = () => puzzleMetadata.memory.variants!;
const selector = (state?: unknown) =>
	createPuzzleSelector({
		families: [{ family: 'memory', weight: 1 }],
		rng: createRng('13'),
		state
	});

it('draws variants after family, holds retry choice, avoids last served across reload', () => {
	let rotation = selector();
	let last: string | undefined;
	const served = new Set<string>();
	for (let i = 0; i < 40; i++) {
		expect(rotation.peek()).toBe('memory');
		const variant = rotation.peekVariant(
			'memory',
			variants(),
			variants().map((v) => v.id)
		);
		expect(variant).not.toBe(last);
		expect(
			rotation.peekVariant(
				'memory',
				variants(),
				variants().map((v) => v.id)
			)
		).toBe(variant);
		rotation.commitVariant('memory', variant);
		expect(rotation.next()).toBe('memory');
		served.add(variant!);
		last = variant;
		rotation = selector(rotation.snapshot());
	}
	expect(served.size).toBeGreaterThan(1);
});

it('honours enabled variants, single-variant fallback, and manifest weights', () => {
	const rotation = selector();
	const weighted = variants().map((v, i) => ({ ...v, weight: i === 1 ? 20 : 1 }));
	const counts = new Map<string, number>();
	for (let i = 0; i < 300; i++) {
		const chosen = rotation.peekVariant(
			'memory',
			weighted,
			weighted.map((v) => v.id)
		)!;
		counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
		rotation.commitVariant('memory', chosen);
	}
	expect(counts.get('memory:no-preview')).toBeGreaterThan(counts.get('memory:trios')!);
	const only = ['memory:trios'];
	expect(rotation.peekVariant('memory', variants(), only)).toBe('memory:trios');
	rotation.commitVariant('memory', 'memory:trios');
	expect(rotation.peekVariant('memory', variants(), only)).toBe('memory:trios');
	expect(() => rotation.peekVariant('memory', variants(), [])).toThrow('variant_unavailable');
});

it('removes a family with no enabled variants while preserving other eligible families', () => {
	const available = familyIndex.map((v) => v.id);
	expect(
		selectorAvailability(familyIndex, { available, variants: { memory: [] } }).available
	).not.toContain('memory');
	expect(() =>
		selectorAvailability(familyIndex, { available, variants: { memory: ['other:classic'] } })
	).toThrow();
});

it('keeps codes family-scoped and shares only declared scoring configuration', () => {
	expect(puzzleVariant('memory')?.id).toBe('memory:classic');
	expect(() => puzzleVariant('block', 'memory:moving')).toThrow('variant');
	for (const variant of ['memory:classic', 'memory:no-preview', 'memory:moving']) {
		expect(scoreScope('memory', variant)).toBe('memory');
		expect(defaultScoreConfig('memory', variant)).toEqual({
			version: 'brief-v1',
			values: { pair: 1000, mismatch: 150, second: 5 }
		});
	}
	expect(scoreScope('memory', 'memory:trios')).toBe('memory:trios');
	expect(defaultScoreConfig('memory', 'memory:trios')).toEqual({
		version: 'memory-trios-v1',
		values: { trio: 1500, mismatch: 150, second: 5 }
	});
	expect(() =>
		validateScoreValues('memory', { pair: 1000, mismatch: 150, second: 5 }, 'memory:trios')
	).toThrow();
	expect(familyName('memory', 'memory:moving')).toBe('Memory · Moving cards');
});

it('retains valid variant checkpoints and rejects codes owned by another family', () => {
	const checkpoint: RoundCheckpoint = {
		version: 1,
		id: 'test',
		owner: null,
		family: 'memory',
		variant: 'memory:trios',
		seed: '13',
		engineVersion: 'memory-1',
		difficulty: null,
		modifiers: {},
		theme: null,
		scoring: defaultScoreConfig('memory', 'memory:trios'),
		moves: [{ index: 0 }],
		state: { phase: 'playing', elapsedMs: 10, clockStarted: true, pending: {} },
		status: 'active',
		savedAt: Date.now(),
		rankedSession: null,
		rankedStartedAt: null
	};
	expect(validCheckpoint(JSON.parse(JSON.stringify(checkpoint)), null)).toBe(true);
	expect(validCheckpoint({ ...checkpoint, variant: 'connect:trios' }, null)).toBe(false);
	const legacy = { ...checkpoint };
	delete legacy.variant;
	expect(validCheckpoint(legacy, null)).toBe(true);
});
