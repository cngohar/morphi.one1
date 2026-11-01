import type { Rng } from '#lib/engine/rng.js';

export type PuzzleFamily = 'block' | 'memory' | 'connect';

export interface FamilyWeight<Family extends string = PuzzleFamily> {
	family: Family;
	weight: number;
}

export interface PuzzleSelector<Family extends string = PuzzleFamily> {
	next(): Family;
	peek(): Family;
	setAvailable(families: readonly Family[]): void;
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

	let available = eligible;
	const gap = () =>
		available.length === 1 ? 0 : Math.min(5, Math.max(1, Math.floor(available.length / 3)));
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
		const ordered = weightedOrder(available);
		// Plan the whole cycle before exposing a pick. If its tail violates the
		// minimum gap, revisit earlier positions without dropping/duplicating a family.
		function arrange(remaining: Family[], history: Family[]): Family[] | null {
			if (remaining.length === 0) return [];
			for (let index = 0; index < remaining.length; index += 1) {
				const family = remaining[index]!;
				if (history.includes(family)) continue;
				const rest = arrange(
					remaining.filter((_, position) => position !== index),
					gap() === 0 ? [] : [...history, family].slice(-gap())
				);
				if (rest) return [family, ...rest];
			}
			return null;
		}
		const cycle = arrange(ordered, gap() === 0 ? [] : recent.slice(-gap()));
		if (!cycle) throw new Error('No puzzle rotation satisfies the minimum gap.');
		return cycle;
	}

	function peek(): Family {
		if (queue.length === 0) queue = refill();
		return queue[0]!;
	}

	return {
		peek,
		setAvailable(families) {
			const selected = new Set(families);
			const nextAvailable = eligible.filter((entry) => selected.has(entry.family));
			if (!nextAvailable.length) throw new Error('At least one puzzle family must be eligible.');
			const previous = new Set(available.map((entry) => entry.family));
			queue = queue.filter((family) => selected.has(family));
			if (queue.length) {
				for (const entry of nextAvailable)
					if (!previous.has(entry.family)) queue.push(entry.family);
			}
			available = nextAvailable;
		},
		next() {
			const family = peek();
			queue.shift();
			recent = [...recent, family].slice(-5);
			return family;
		}
	};
}
