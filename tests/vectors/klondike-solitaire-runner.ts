import { catalog } from '../../src/lib/catalog.js';
import expected from './klondike-solitaire.json';
const manifest = catalog['klondike-solitaire'];

export async function verifyVectors() {
	const records = expected.generation.map((vector) => {
		const round = manifest.createRound(vector.seed, vector.variant);
		const result = manifest.replay(vector.seed, vector.moves, 60, undefined, vector.variant);
		const actual = {
			seed: round.seed,
			variant: vector.variant,
			rules: round.rules,
			moves: vector.moves,
			result
		};
		if ('group' in result || JSON.stringify(actual) !== JSON.stringify(vector))
			throw new Error(`Klondike Solitaire vector mismatch ${vector.variant}/${vector.seed}`);
		for (const bad of [
			vector.moves.slice(0, -1),
			[{ action: -1, at: 0, card: 0, count: 0, dst: 0, src: 0 }]
		]) {
			let threw = false;
			try {
				manifest.replay(vector.seed, bad, 60, undefined, vector.variant);
			} catch (error) {
				if (!(error instanceof RangeError)) throw error;
				threw = true;
			}
			if (!threw) throw new Error('Klondike Solitaire incomplete/illegal replay was accepted');
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
