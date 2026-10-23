import { shuffle, type Rng } from '#lib/engine/rng.js';

export type PuzzleFamily = 'block' | 'memory';

export interface FamilyWeight {
	family: PuzzleFamily;
	weight: number;
}

export interface PuzzleSelector {
	next(): PuzzleFamily;
	peek(): PuzzleFamily;
}

export interface PuzzleSelectorOptions {
	families: readonly FamilyWeight[];
	firstFamily: PuzzleFamily;
	rng: Rng;
}

export function createPuzzleSelector(options: PuzzleSelectorOptions): PuzzleSelector {
	const eligible = options.families.filter((entry) => entry.weight > 0);
	if (eligible.length === 0) {
		throw new Error('At least one puzzle family must be eligible.');
	}

	const bag: PuzzleFamily[] = [];
	for (const entry of eligible) {
		const copies = Math.max(1, Math.floor(entry.weight));
		for (let copy = 0; copy < copies; copy += 1) {
			bag.push(entry.family);
		}
	}

	const first = eligible.some((entry) => entry.family === options.firstFamily)
		? options.firstFamily
		: eligible[0]!.family;

	let queue: PuzzleFamily[] = [];
	let last: PuzzleFamily | null = null;
	let pending: PuzzleFamily | null = null;
	let firstPending = true;

	function refill(): PuzzleFamily[] {
		const next = shuffle(options.rng, bag);
		if (eligible.length > 1 && next[0] === last) {
			const swapIndex = next.findIndex((family) => family !== last);
			if (swapIndex > 0) {
				const different = next[swapIndex]!;
				next[swapIndex] = next[0]!;
				next[0] = different;
			}
		}
		return next;
	}

	function computeNext(): PuzzleFamily {
		if (firstPending) {
			firstPending = false;
			last = first;
			return first;
		}

		if (queue.length === 0) {
			queue = refill();
		}

		let pick = queue.shift()!;
		if (eligible.length > 1 && pick === last) {
			const swapIndex = queue.findIndex((family) => family !== last);
			if (swapIndex >= 0) {
				const different = queue[swapIndex]!;
				queue[swapIndex] = pick;
				pick = different;
			}
		}

		last = pick;
		return pick;
	}

	return {
		next() {
			if (pending !== null) {
				const result = pending;
				pending = null;
				return result;
			}
			return computeNext();
		},
		peek() {
			if (pending === null) {
				pending = computeNext();
			}
			return pending;
		}
	};
}
