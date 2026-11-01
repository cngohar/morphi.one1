import type { PuzzleFamily } from '#lib/selector.js';

/** One speculative solo candidate. Never consumes a selector draw or reserves a ranked run. */
export function createPreparationSlot<T>(
	prepare: (family: PuzzleFamily, signal: AbortSignal) => Promise<T>
) {
	let slot: {
		family: PuzzleFamily;
		controller: AbortController;
		promise: Promise<T | null>;
	} | null = null;
	let disposed = false;
	function clear() {
		slot?.controller.abort();
		slot = null;
	}
	function warm(family: PuzzleFamily) {
		if (disposed) return Promise.resolve(null);
		if (slot?.family === family) return slot.promise;
		clear();
		const controller = new AbortController();
		const promise = Promise.resolve()
			.then(() => prepare(family, controller.signal))
			.then((value) => (controller.signal.aborted ? null : value))
			.catch(() => {
				if (!controller.signal.aborted) console.warn('morphi:next_preparation_unavailable');
				return null;
			});
		slot = { family, controller, promise };
		return promise;
	}
	return {
		warm,
		async take(family: PuzzleFamily) {
			const promise = warm(family);
			const entry = slot;
			const value = await promise;
			if (slot === entry) slot = null;
			return value;
		},
		clear,
		dispose() {
			disposed = true;
			clear();
		}
	};
}
