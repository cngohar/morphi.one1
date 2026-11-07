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

it('maps exactly the ten Memory rules to six supported values without adding identities', () => {
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
