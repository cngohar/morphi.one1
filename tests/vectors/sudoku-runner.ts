import { catalog } from '../../src/lib/catalog.js';
import expected from './sudoku.json';

const manifest = catalog.sudoku;

export async function fingerprint(value: unknown) {
	const bytes = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
	);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function boardFingerprint({
	rules,
	givens,
	solution,
	regions,
	cages,
	thermos,
	marks,
	parity,
	grade
}: ReturnType<typeof manifest.createRound>) {
	return fingerprint({ rules, givens, solution, regions, cages, thermos, marks, parity, grade });
}

export async function verifyVectors() {
	for (const { seed, variant, board, moves, result, loss } of expected.generation) {
		const round = manifest.createRound(seed, variant);
		const replay = manifest.replay(seed, moves, 300, undefined, variant);
		if (
			(await boardFingerprint(round)) !== board ||
			!replay.won ||
			JSON.stringify(replay) !== JSON.stringify(result)
		)
			throw new Error(`Sudoku solution mismatch ${variant}/${seed}`);
		const lost = manifest.replay(seed, loss, 300, undefined, variant);
		if (lost.won || lost.score !== 0 || lost.mistakes !== 3)
			throw new Error(`Sudoku mistake loss mismatch ${variant}/${seed}`);
		for (const invalid of [
			moves.slice(0, -1),
			[{ action: 0, cell: round.givens.findIndex(Boolean), value: 1 }]
		]) {
			try {
				manifest.replay(seed, invalid, 300, undefined, variant);
			} catch (error) {
				if (error instanceof RangeError) continue;
				throw error;
			}
			throw new Error(`Sudoku accepted incomplete or illegal replay ${variant}/${seed}`);
		}
	}
	for (const seed of expected.timeouts) {
		const result = manifest.replay(
			seed,
			[{ action: 5, cell: 0, value: 0 }],
			600,
			undefined,
			'sudoku:countdown-600'
		);
		if (result.won || result.score !== 0) throw new Error(`Sudoku timeout mismatch ${seed}`);
	}
	return {
		generation: expected.generation.length,
		solved: expected.generation.length,
		lost: expected.generation.length,
		timeouts: expected.timeouts.length,
		rejected: expected.generation.length * 2,
		fingerprint: await fingerprint(expected)
	};
}
