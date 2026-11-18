import { catalog } from '../../src/lib/catalog.js';
import expected from './word-guess.json';
const manifest = catalog['word-guess'];

/** Frozen seeded words, shared guesses, completed wins/losses and illegal/incomplete logs. */
export async function verifyVectors() {
	const records = expected.generation.map((vector) => {
		const round = manifest.createRound(vector.seed, vector.variant);
		const result = manifest.replay(vector.seed, vector.moves, 10, undefined, vector.variant);
		const lossResult = manifest.replay(vector.seed, vector.loss, 10, undefined, vector.variant);
		const actual = {
			seed: round.seed,
			variant: vector.variant,
			rules: round.rules,
			budget: round.budget,
			answers: round.boards.map((board) => board.answer),
			moves: vector.moves,
			loss: vector.loss,
			result,
			lossResult
		};
		if (JSON.stringify(actual) !== JSON.stringify(vector))
			throw new Error(`Word Guess vector mismatch ${vector.variant}/${vector.seed}`);
		for (const bad of [vector.moves.slice(0, -1), [{ action: 9, code: 0 }]]) {
			let rejected = false;
			try {
				manifest.replay(vector.seed, bad, 10, undefined, vector.variant);
			} catch (error) {
				if (!(error instanceof RangeError)) throw error;
				rejected = true;
			}
			if (!rejected) throw new Error('Word Guess incomplete/illegal replay accepted');
		}
		if (result.won !== true || lossResult.won !== false || lossResult.score !== 0)
			throw new Error('Word Guess completed outcome mismatch');
		return actual;
	});
	const hash = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(JSON.stringify(records))
	);
	return {
		generation: records.length,
		solved: records.length,
		lost: records.length,
		rejected: records.length * 2,
		fingerprint: Array.from(new Uint8Array(hash), (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('')
	};
}
