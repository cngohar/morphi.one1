import type { Rng } from '#lib/engine/rng.js';

export type PuzzleFamily = 'block' | 'memory';

export interface FamilyWeight<Family extends string = PuzzleFamily> {
	family: Family;
	weight: number;
}

export interface PuzzleSelector<Family extends string = PuzzleFamily> {
	next(): Family;
	peek(): Family;
}

export interface PuzzleSelectorOptions<Family extends string = PuzzleFamily> {
	families: readonly FamilyWeight<Family>[];
	rng: Rng;
}

export function createPuzzleSelector<Family extends string = PuzzleFamily>(
	options: PuzzleSelectorOptions<Family>
): PuzzleSelector<Family> {
	const ids = new Set<Family>();
	let totalWeight = 0;
	for (const entry of options.families) {
		if (ids.has(entry.family)) throw new Error('Puzzle families must be unique.');
		ids.add(entry.family);
		if (!Number.isSafeInteger(entry.weight) || entry.weight < 0)
			throw new Error('Puzzle weights must be nonnegative safe integers.');
		totalWeight += entry.weight;
	}
	if (!Number.isSafeInteger(totalWeight)) throw new Error('Puzzle weight total is too large.');
	const eligible = options.families.filter((entry) => entry.weight > 0);
	if (eligible.length === 0) throw new Error('At least one puzzle family must be eligible.');

	const gap = eligible.length === 1 ? 0 : Math.min(5, Math.max(1, Math.floor(eligible.length / 3)));
	let recent: Family[] = [];
	let queue: Family[] = [];

	function weightedOrder(entries: readonly FamilyWeight<Family>[]): Family[] {
		const remaining = entries.slice();
		const ordered: Family[] = [];
		while (remaining.length) {
			let draw = options.rng.nextInt(remaining.reduce((sum, entry) => sum + entry.weight, 0));
			const index = remaining.findIndex((entry) => {
				draw -= entry.weight;
				return draw < 0;
			});
			ordered.push(remaining.splice(index, 1)[0]!.family);
		}
		return ordered;
	}

	function refill(): Family[] {
		const ordered = weightedOrder(eligible);
		// Plan the whole cycle before exposing a pick. If its tail violates the
		// minimum gap, revisit earlier positions without dropping/duplicating a family.
		function arrange(remaining: Family[], history: Family[]): Family[] | null {
			if (remaining.length === 0) return [];
			for (let index = 0; index < remaining.length; index += 1) {
				const family = remaining[index]!;
				if (history.includes(family)) continue;
				const rest = arrange(
					remaining.filter((_, position) => position !== index),
					gap === 0 ? [] : [...history, family].slice(-gap)
				);
				if (rest) return [family, ...rest];
			}
			return null;
		}
		const cycle = arrange(ordered, recent);
		if (!cycle) throw new Error('No puzzle rotation satisfies the minimum gap.');
		return cycle;
	}

	function peek(): Family {
		if (queue.length === 0) queue = refill();
		return queue[0]!;
	}

	return {
		peek,
		next() {
			const family = peek();
			queue.shift();
			recent = gap === 0 ? [] : [...recent, family].slice(-gap);
			return family;
		}
	};
}
