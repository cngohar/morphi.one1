import { catalog } from '../../src/lib/catalog.js';
import expected from './light-bend.json';

const manifest = catalog['light-bend'];

/**
 * Vector spec for Light Bend. Each record pins the generated board, the par, the
 * witness move list and the replayed result, so a divergence in the RNG stream,
 * the tracer or the par search fails in every runtime.
 */
export async function verifyVectors() {
	const records = expected.generation.map((vector) => {
		const round = manifest.createRound(vector.seed, vector.variant);
		const result = manifest.replay(vector.seed, vector.moves, 10, undefined, vector.variant);
		const actual = {
			seed: round.seed,
			variant: vector.variant,
			band: round.band,
			width: round.width,
			height: round.height,
			rules: round.rules,
			cells: round.cells,
			crystalCells: round.crystalCells,
			crystalColours: round.crystalColours,
			checkpoints: round.checkpoints,
			mirrors: round.mirrors,
			start: round.start,
			tray: round.tray,
			splitters: round.splitters,
			portals: round.portals,
			filters: round.filters,
			sources: round.sources,
			par: round.par,
			plan: round.plan,
			moves: vector.moves,
			result
		};
		if (JSON.stringify(actual) !== JSON.stringify(vector))
			throw new Error(`Light Bend vector mismatch ${vector.variant}/${vector.seed}`);
		for (const bad of [
			// Incomplete: every move except the last.
			vector.moves.slice(0, -1),
			// Illegal: a move that cannot be applied.
			[{ action: 0, cell: 0, value: 0 }],
			// Tampered shape: a missing key.
			[{ action: 0, cell: 0 }],
			// Out of range action.
			[{ action: 9, cell: 0, value: 0 }]
		]) {
			let rejected = false;
			try {
				manifest.replay(vector.seed, bad as never, 10, undefined, vector.variant);
			} catch (error) {
				if (!(error instanceof RangeError)) throw error;
				rejected = true;
			}
			if (!rejected) throw new Error('Light Bend incomplete or illegal replay accepted');
		}
		return actual;
	});
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(JSON.stringify(records))
	);
	return {
		generation: records.length,
		solved: records.length,
		rejected: records.length * 4,
		fingerprint: Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('')
	};
}
