import { catalog } from '../../src/lib/catalog.js';
import expected from './one-line.json';

const manifest = catalog['one-line'];

async function fingerprint(value: unknown) {
	const hash = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(JSON.stringify(value))
	);
	return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function graphFingerprint({ rules, dots, edges, odd }: ReturnType<typeof manifest.createRound>) {
	return fingerprint({ rules, dots, edges, odd });
}

export async function verifyVectors() {
	for (const vector of expected.generation) {
		const { seed, variant, moves } = vector;
		const round = manifest.createRound(seed, variant);
		const replay = manifest.replay(seed, moves, 10, undefined, variant);
		if (
			(await graphFingerprint(round)) !== vector.graph ||
			JSON.stringify(round.solution) !== JSON.stringify(moves) ||
			JSON.stringify(replay) !== JSON.stringify(vector.result) ||
			replay.won !== true
		)
			throw new Error(`One-line vector mismatch ${variant}/${seed}`);
		for (const bad of [moves.slice(0, -1), [{ action: 7, edge: 0, value: 0 }]]) {
			try {
				manifest.replay(seed, bad, 10, undefined, variant);
			} catch (error) {
				if (error instanceof RangeError) continue;
				throw error;
			}
			throw new Error(`One-line accepted incomplete or illegal replay ${variant}/${seed}`);
		}
	}
	for (const { seed, variant, moves, result } of expected.losses) {
		const replay = manifest.replay(seed, moves, 10, undefined, variant);
		if (JSON.stringify(replay) !== JSON.stringify(result) || replay.won || replay.score !== 0)
			throw new Error(`One-line loss mismatch ${variant}/${seed}`);
	}
	return {
		generation: expected.generation.length,
		solved: expected.generation.length,
		lost: expected.losses.length,
		rejected: expected.generation.length * 2,
		fingerprint: await fingerprint(expected)
	};
}
