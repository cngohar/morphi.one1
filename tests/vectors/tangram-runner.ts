import { catalog } from '../../src/lib/catalog.js';
import expected from './tangram.json';
const manifest = catalog.tangram;

export async function verifyVectors() {
	const records = expected.generation.map((vector) => {
		const round = manifest.createRound(vector.seed, vector.variant);
		const result = manifest.replay(vector.seed, vector.moves, 10, undefined, vector.variant);
		const actual = {
			seed: round.seed,
			variant: vector.variant,
			silhouette: round.silhouette,
			moves: vector.moves,
			result
		};
		if ('group' in result || JSON.stringify(actual) !== JSON.stringify(vector))
			throw new Error(`Tangram vector mismatch ${vector.variant}/${vector.seed}`);
		for (const bad of [
			vector.moves.slice(0, -1),
			[{ piece: -1, xp: 0, xq: 0, yp: 0, yq: 0, rot: 0, flip: 0 }]
		]) {
			let rejected = false;
			try {
				manifest.replay(vector.seed, bad, 10, undefined, vector.variant);
			} catch (error) {
				if (!(error instanceof RangeError)) throw error;
				rejected = true;
			}
			if (!rejected) throw new Error('Tangram incomplete or illegal replay accepted');
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
		rejected: records.length * 2,
		fingerprint: Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('')
	};
}
