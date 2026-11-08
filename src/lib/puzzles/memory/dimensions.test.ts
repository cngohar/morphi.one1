import { expect, it } from 'vitest';
import { catalog } from '#lib/catalog.js';
import { memoryArchetypes, memoryDimensions, memoryPolicyVariants } from './dimensions.js';
import {
	defaultMemoryPolicy,
	memoryBlockers,
	memorySqlPaths,
	memoryVariantKeys,
	validateMemoryPolicy
} from '#lib/server/memory-policy.js';
import { validateGameConfig } from '#lib/server/config.js';
import { memoryVariantDimensions } from '#lib/server/memory-directory.js';

it('maps every Memory rule to six supported dimensions', () => {
	expect(memoryPolicyVariants.map((entry) => entry.id)).toEqual(
		catalog.memory.variants!.map((entry) => entry.id)
	);
	expect(memoryArchetypes).toHaveLength(6);
	expect(memoryDimensions).toHaveLength(6);
	for (const variant of memoryPolicyVariants) {
		expect(memoryVariantKeys(variant.id)).toHaveLength(6);
		expect(memorySqlPaths(variant.id)).toHaveLength(6);
		expect(memoryBlockers(variant.id, defaultMemoryPolicy())).toEqual([]);
	}
	const policy = defaultMemoryPolicy();
	policy['matchSize:4'] = false;
	expect(memoryBlockers('memory:quads', policy)).toEqual(['matchSize:4']);
	expect(memoryBlockers('memory:classic', policy)).toEqual([]);
	expect(validateMemoryPolicy(policy)).toEqual(policy);
	expect(() => validateMemoryPolicy({ ...policy, 'matchSize:5': true })).toThrow();
	expect(() => validateMemoryPolicy({ ...policy, 'matchSize:4': 'false' })).toThrow();
	expect(() => memoryVariantKeys('memory:unknown')).toThrow();
});

it('maps Time Strata opening and top-only access while preserving previous immutable policy snapshots', () => {
	const policy = defaultMemoryPolicy();
	expect(memoryVariantKeys('memory:time-strata')).toContain('opening:no-preview');
	expect(memoryVariantKeys('memory:time-strata')).toContain('availability:top-only');
	const historical = { ...policy };
	delete historical['availability:top-only'];
	expect(validateGameConfig({ weight: 1, dimensions: historical })).toEqual({
		weight: 1,
		dimensions: policy
	});
	policy['availability:top-only'] = false;
	expect(memoryBlockers('memory:time-strata', policy)).toEqual(['availability:top-only']);
	expect(
		memoryVariantDimensions('memory:time-strata', policy)
			.filter((row) => row.isBlocked)
			.map((row) => row.valueId)
	).toEqual(['top-only']);
	expect(memoryBlockers('memory:classic', policy)).toEqual([]);
	policy['opening:no-preview'] = false;
	expect(memoryBlockers('memory:time-strata', policy)).toEqual([
		'opening:no-preview',
		'availability:top-only'
	]);
	delete historical['opening:preview'];
	expect(() => validateGameConfig({ weight: 1, dimensions: historical })).toThrow('game_config');
	expect(() => validateMemoryPolicy({ ...policy, 'availability:top-only': undefined })).toThrow(
		'dimension_policy'
	);
});

it('maps Batch H rule controls and preserves immutable pre-batch policy snapshots', () => {
	const modes = [
		['linked', 'availability'],
		['sweep', 'availability'],
		['shelf', 'movement'],
		['cycle', 'movement'],
		['empty-well', 'movement'],
		['glimpse', 'backs'],
		['chain', 'availability'],
		['echo', 'backs'],
		['slip', 'movement'],
		['order', 'availability']
	];
	const historical = defaultMemoryPolicy();
	for (const [mode, dimension] of modes) delete historical[`${dimension}:strata-${mode}`];
	const hydrated = validateGameConfig({ weight: 1, dimensions: historical }).dimensions!;
	for (const [mode, dimension] of modes) {
		const id = `memory:strata-${mode}`;
		const key = `${dimension}:strata-${mode}`;
		expect(memoryVariantKeys(id)).toContain('opening:no-preview');
		expect(memoryVariantKeys(id)).toContain(key);
		expect(hydrated[key]).toBe(true);
		const narrowed = { ...hydrated, [key]: false };
		expect(memoryBlockers(id, narrowed)).toEqual([key]);
		expect(memoryBlockers('memory:time-strata', narrowed)).toEqual([]);
		expect(
			memoryVariantDimensions(id, narrowed)
				.filter((row) => row.isBlocked)
				.map((row) => row.valueId)
		).toEqual([`strata-${mode}`]);
		expect(() => validateMemoryPolicy(historical)).toThrow('dimension_policy');
		expect(() =>
			validateGameConfig({ weight: 1, dimensions: { ...hydrated, [key]: null } })
		).toThrow('game_config');
	}
	delete historical['movement:static'];
	expect(() => validateGameConfig({ weight: 1, dimensions: historical })).toThrow('game_config');
});
