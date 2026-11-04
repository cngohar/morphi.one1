import { familyIndex } from '#lib/family-index.js';
import { puzzlePools, puzzleViews } from '#lib/registry.js';
import { createPuzzleSelector } from '#lib/selector.js';
import { createRng } from '#lib/engine/rng.js';
import { randomSeed } from '#lib/seeds.js';
import { eligibleFamilies, selectorAvailability } from './selector-eligibility.js';
import { loadFamilyPlayed, loadSelectorState, saveSelectorState } from './storage.js';
import { loadCheckpoint } from './checkpoint.js';

/** Peek persists the same first pick used by Play; speculation never issues a ranked seed. */
export async function preloadFirstPuzzle(signal: AbortSignal): Promise<void> {
	let owner: string | null = null;
	let available = familyIndex.map((entry) => entry.id);
	const weights = new Map(familyIndex.map((entry) => [entry.id, entry.weight]));
	if (import.meta.env.MODE !== 'public-guest') {
		const [status, availability] = await Promise.all([
			fetch('/api/account/status', { signal, cache: 'no-store' }),
			fetch('/api/play/availability', { signal, cache: 'no-store' })
		]);
		if (!status.ok || !availability.ok) throw new Error('preload_unavailable');
		const account: unknown = await status.json();
		if (
			!account ||
			typeof account !== 'object' ||
			!('ownerKey' in account) ||
			(account.ownerKey !== null && typeof account.ownerKey !== 'string')
		)
			throw new Error('preload_account');
		owner = account.ownerKey;
		const config = selectorAvailability(familyIndex, await availability.json());
		available = config.available;
		for (const entry of familyIndex)
			weights.set(entry.id, config.weights[entry.id] ?? entry.weight);
	}
	if (signal.aborted) return;
	const selector = createPuzzleSelector({
		families: familyIndex.map((entry) => ({ family: entry.id, weight: entry.weight })),
		rng: createRng(randomSeed()),
		state: loadSelectorState(owner),
		weight: (entry) =>
			(weights.get(entry.family) ?? entry.weight) * (loadFamilyPlayed(entry.family) ? 1 : 2),
		onChange: (state) => saveSelectorState(owner, state)
	});
	selector.setAvailable(
		eligibleFamilies(
			familyIndex,
			available.filter((id) => (weights.get(id) ?? 0) > 0),
			innerWidth,
			innerHeight
		)
	);
	const checkpoint = await loadCheckpoint(owner);
	if (signal.aborted) return;
	const family =
		checkpoint &&
		available.includes(checkpoint.family) &&
		Object.hasOwn(puzzleViews, checkpoint.family)
			? checkpoint.family
			: selector.peek();
	await Promise.all([puzzleViews[family](), puzzlePools[family]()]);
	if (!signal.aborted) performance.mark('morphi:first-puzzle-preloaded');
}
