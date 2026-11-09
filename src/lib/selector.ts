import type { PuzzleVariant } from '#lib/engine/contract.js';
import type { Rng } from '#lib/engine/rng.js';

export type PuzzleFamily = import('#lib/engine/contract.js').PuzzleId;

export interface FamilyWeight<Family extends string = PuzzleFamily> {
	family: Family;
	weight: number;
}

export interface PuzzleSelectorState<Family extends string = PuzzleFamily> {
	version: 1;
	eligible: Family[];
	queue: Family[];
	recent: Family[];
	cyclePosition: number;
	lastVariants?: Record<string, string>;
}

export interface PuzzleSelector<Family extends string = PuzzleFamily> {
	next(): Family;
	peekVariant(
		family: Family,
		variants: readonly Pick<PuzzleVariant, 'id' | 'weight' | 'enabled'>[] | undefined,
		enabled: readonly string[]
	): string | undefined;
	commitVariant(family: Family, variant?: string): void;
	peek(): Family;
	setAvailable(families: readonly Family[]): void;
	snapshot(): PuzzleSelectorState<Family>;
}

export interface PuzzleSelectorOptions<Family extends string = PuzzleFamily> {
	families: readonly FamilyWeight<Family>[];
	rng: Rng;
	state?: unknown;
	weight?: (entry: FamilyWeight<Family>) => number;
	onChange?: (state: PuzzleSelectorState<Family>) => void;
}

export function selectorGap(count: number): number {
	return count <= 1 ? 0 : Math.min(5, Math.max(1, Math.floor(count / 3)));
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
	const eligibleIds = new Set(eligible.map((entry) => entry.family));

	let available = eligible;
	let recent: Family[] = [];
	let queue: Family[] = [];
	let cursor = 0;
	let cyclePosition = 0;
	let lastVariants: Record<string, string> = {};
	const pendingVariants = new Map<Family, string>();

	function restore(value: unknown): boolean {
		if (!value || typeof value !== 'object') return false;
		const state = value as Record<string, unknown>;
		function familyList(value: unknown, allowed: Set<Family>, limit: number): value is Family[] {
			return (
				Array.isArray(value) &&
				value.length <= limit &&
				value.every((family) => typeof family === 'string' && allowed.has(family as Family))
			);
		}
		if (
			state.version !== 1 ||
			!familyList(state.eligible, eligibleIds, eligible.length) ||
			state.eligible.length === 0 ||
			new Set(state.eligible).size !== state.eligible.length ||
			!familyList(state.queue, new Set(state.eligible), state.eligible.length) ||
			new Set(state.queue).size !== state.queue.length ||
			!familyList(state.recent, ids, 5) ||
			typeof state.cyclePosition !== 'number' ||
			!Number.isSafeInteger(state.cyclePosition) ||
			state.cyclePosition < 0 ||
			(state.queue.length + state.cyclePosition !== state.eligible.length &&
				!(state.queue.length === 0 && state.cyclePosition === 0))
		)
			return false;
		if (
			state.lastVariants !== undefined &&
			(!state.lastVariants ||
				typeof state.lastVariants !== 'object' ||
				Array.isArray(state.lastVariants) ||
				Object.entries(state.lastVariants).some(
					([family, variant]) =>
						!ids.has(family as Family) ||
						typeof variant !== 'string' ||
						!variant.startsWith(`${family}:`) ||
						variant.length > 100
				))
		)
			return false;
		lastVariants = { ...(state.lastVariants as Record<string, string> | undefined) };
		const selected = new Set(state.eligible);
		const restored = state.queue.slice();
		if (!repair(restored, state.recent, selected.size)) return false;
		available = eligible.filter((entry) => selected.has(entry.family));
		queue = restored;
		recent = state.recent.slice();
		cyclePosition = state.cyclePosition;
		return true;
	}

	function snapshot(): PuzzleSelectorState<Family> {
		return {
			version: 1,
			eligible: available.map((entry) => entry.family),
			queue: queue.slice(cursor),
			recent: recent.slice(),
			cyclePosition,
			...(Object.keys(lastVariants).length ? { lastVariants: { ...lastVariants } } : {})
		};
	}

	function changed(): void {
		options.onChange?.(snapshot());
	}

	function weightedOrder(): Family[] {
		const view = new DataView(new ArrayBuffer(8));
		let ordered = available.map((entry) => {
			const weight = options.weight?.(entry) ?? entry.weight;
			if (!Number.isSafeInteger(weight) || weight <= 0)
				throw new Error('Eligible puzzle weights must be positive safe integers.');
			const uniform = (options.rng.nextInt(0x100000000) + 1) / 0x100000001;
			view.setFloat64(0, -Math.log(uniform) / weight);
			return { family: entry.family, high: view.getUint32(0), low: view.getUint32(4) };
		});
		let scratch = ordered.slice();
		const counts = new Uint32Array(256);
		// Positive exponential-race keys give weighted order; eight radix passes
		// keep the shuffle linear instead of sorting or repeatedly scanning weights.
		for (let byte = 0; byte < 8; byte++) {
			counts.fill(0);
			const shift = (byte % 4) * 8;
			const key = byte < 4 ? 'low' : 'high';
			for (const entry of ordered) counts[(entry[key] >>> shift) & 255]!++;
			let offset = 0;
			for (let bucket = 0; bucket < counts.length; bucket++) {
				const count = counts[bucket]!;
				counts[bucket] = offset;
				offset += count;
			}
			for (const entry of ordered) scratch[counts[(entry[key] >>> shift) & 255]!++] = entry;
			[ordered, scratch] = [scratch, ordered];
		}
		return ordered.map((entry) => entry.family);
	}

	function repair(pending: Family[], history: readonly Family[], count: number): boolean {
		const gap = selectorGap(count);
		const blocked = history.slice(-gap);
		if (gap === 0) return true;
		// A cycle contains unique families, so only its first <=5 positions can
		// conflict with the preceding cycle. Greedily swap in the first legal pick.
		for (let index = 0; index < Math.min(gap, pending.length); index++) {
			let candidate = index;
			while (candidate < pending.length && blocked.includes(pending[candidate]!)) candidate++;
			if (candidate === pending.length) return false;
			[pending[index], pending[candidate]] = [pending[candidate]!, pending[index]!];
			blocked.push(pending[index]!);
			if (blocked.length > gap) blocked.shift();
		}
		return true;
	}

	function ensureQueue(): boolean {
		if (cursor < queue.length) return false;
		const cycle = weightedOrder();
		if (!repair(cycle, recent, available.length))
			throw new Error('No puzzle rotation satisfies the minimum gap.');
		queue = cycle;
		cursor = 0;
		cyclePosition = 0;
		return true;
	}

	if (options.state !== undefined && !restore(options.state))
		console.warn('morphi:selector_state_invalid');

	return {
		snapshot,
		peekVariant(family, variants, enabled) {
			if (!variants?.length) return undefined;
			const candidates = variants.filter(
				(entry) => entry.enabled !== false && entry.weight > 0 && enabled.includes(entry.id)
			);
			const pending = pendingVariants.get(family);
			if (pending && candidates.some((entry) => entry.id === pending)) return pending;
			const choices =
				candidates.length > 1
					? candidates.filter((entry) => entry.id !== lastVariants[family])
					: candidates;
			const total = choices.reduce((sum, entry) => sum + entry.weight, 0);
			if (!Number.isSafeInteger(total) || total <= 0) throw new Error('variant_unavailable');
			let draw = options.rng.nextInt(total);
			for (const entry of choices) {
				if (
					!Number.isSafeInteger(entry.weight) ||
					entry.weight <= 0 ||
					!entry.id.startsWith(`${family}:`)
				)
					throw new Error('variant_invalid');
				if (draw < entry.weight) {
					pendingVariants.set(family, entry.id);
					return entry.id;
				}
				draw -= entry.weight;
			}
			throw new Error('variant_invalid');
		},
		commitVariant(family, variant) {
			if (variant !== undefined) {
				if (pendingVariants.get(family) !== variant) throw new Error('variant_invalid');
				lastVariants[family] = variant;
				pendingVariants.delete(family);
				changed();
			}
		},
		peek() {
			if (ensureQueue()) changed();
			return queue[cursor]!;
		},
		setAvailable(families) {
			const selected = new Set(families);
			const nextAvailable = eligible.filter((entry) => selected.has(entry.family));
			if (!nextAvailable.length) throw new Error('At least one puzzle family must be eligible.');
			const previous = new Set(available.map((entry) => entry.family));
			if (
				nextAvailable.length === available.length &&
				nextAvailable.every((entry) => previous.has(entry.family))
			)
				return;
			const pending = queue.slice(cursor).filter((family) => selected.has(family));
			if (pending.length) {
				for (const entry of nextAvailable)
					if (!previous.has(entry.family)) pending.push(entry.family);
			}
			available = nextAvailable;
			// Availability can make an incomplete cycle impossible; start a new
			// cycle only in that case, keeping the recent-family exclusion intact.
			queue = repair(pending, recent, available.length) ? pending : [];
			cursor = 0;
			cyclePosition = available.length - queue.length;
			changed();
		},
		next() {
			ensureQueue();
			const family = queue[cursor++]!;
			cyclePosition++;
			recent = [...recent, family].slice(-5);
			changed();
			return family;
		}
	};
}
