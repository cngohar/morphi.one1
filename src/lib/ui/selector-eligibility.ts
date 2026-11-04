import { puzzleMetadata } from '#lib/puzzle-metadata.js';
import type { PuzzleFamilyEntry } from '#lib/engine/contract.js';

export function selectorAvailability(index: readonly PuzzleFamilyEntry[], input: unknown) {
	const known = new Set(index.map((entry) => entry.id));
	if (
		!input ||
		typeof input !== 'object' ||
		!('available' in input) ||
		!Array.isArray(input.available) ||
		input.available.some((id: unknown) => typeof id !== 'string' || !known.has(id))
	)
		throw new Error('game_unavailable');
	const available = input.available as string[];
	const weights: Record<string, number> = {};
	if ('weights' in input) {
		if (!input.weights || typeof input.weights !== 'object' || Array.isArray(input.weights))
			throw new Error('game_unavailable');
		const values = input.weights as Record<string, unknown>;
		for (const id of available) {
			const weight = values[id];
			if (
				typeof weight !== 'number' ||
				!Number.isSafeInteger(weight) ||
				weight < 0 ||
				weight > 10000
			)
				throw new Error('game_unavailable');
			weights[id] = weight;
		}
	}
	const variants: Record<string, string[]> = {};
	const supplied = 'variants' in input ? input.variants : undefined;
	if (
		supplied !== undefined &&
		(!supplied || typeof supplied !== 'object' || Array.isArray(supplied))
	)
		throw new Error('game_unavailable');
	for (const id of available) {
		const definitions = puzzleMetadata[id]?.variants;
		if (!definitions?.length) continue;
		const enabled =
			supplied === undefined
				? definitions.filter((entry) => entry.enabled !== false).map((entry) => entry.id)
				: (supplied as Record<string, unknown>)[id];
		if (
			!Array.isArray(enabled) ||
			enabled.some(
				(value) => typeof value !== 'string' || !definitions.some((entry) => entry.id === value)
			)
		)
			throw new Error('game_unavailable');
		variants[id] = enabled;
	}
	return {
		available: available.filter((id) => !variants[id] || variants[id].length > 0),
		weights,
		variants
	};
}

/** Eligibility is checked between rounds; rotating a device never replaces an active board. */
export function eligibleFamilies(
	index: readonly PuzzleFamilyEntry[],
	available: readonly string[],
	width: number,
	height: number
): string[] {
	const enabled = new Set(available);
	const orientation = width >= height ? 'landscape' : 'portrait';
	return index
		.filter(
			(entry) =>
				entry.enabled &&
				entry.weight > 0 &&
				enabled.has(entry.id) &&
				(entry.orientation === 'any' || entry.orientation === orientation) &&
				width >= (entry.minViewportWidth ?? 0) &&
				height >= (entry.minViewportHeight ?? 0)
		)
		.map((entry) => entry.id);
}
