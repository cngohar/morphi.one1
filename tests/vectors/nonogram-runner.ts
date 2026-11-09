import { catalog } from '../../src/lib/catalog.js';
import expected from './nonogram.json';
const manifest = catalog.nonogram;

export async function verifyVectors() {
	const records = expected.generation.map((vector) => {
		const round = manifest.createRound(vector.seed, vector.variant);
		let stroke = 0;
		const moves = vector.solution.flatMap((mark, cell) =>
			mark > 0 || round.rules.allDecided
				? [{ at: stroke, cell, mark: mark || -1, stroke: stroke++ }]
				: []
		);
		const result = manifest.replay(round.seed, moves, 10, undefined, vector.variant);
		const actual = {
			seed: round.seed,
			variant: vector.variant,
			size: round.size,
			rowClues: round.rowClues,
			columnClues: round.columnClues,
			solution: vector.solution,
			moves,
			result
		};
		if ('group' in result || JSON.stringify(actual) !== JSON.stringify(vector))
			throw new Error(`Nonogram vector mismatch ${vector.variant}/${vector.seed}`);
		for (const bad of [
			moves.slice(0, -1),
			[{ at: 0, cell: round.cells.length, mark: 1, stroke: 0 }]
		]) {
			let threw = false;
			try {
				manifest.replay(round.seed, bad, 10, undefined, vector.variant);
			} catch (error) {
				if (!(error instanceof RangeError)) throw error;
				threw = true;
			}
			if (!threw) throw new Error('Nonogram incomplete/illegal replay was accepted');
		}
		return actual;
	});
	const hash = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(JSON.stringify(records))
	);
	return {
		generation: records.length,
		solved: records.length,
		rejected: records.length * 2,
		fingerprint: Array.from(new Uint8Array(hash), (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('')
	};
}
