import { catalog } from '../../src/lib/catalog.js';
// eslint-disable-next-line morphi/boundaries -- The square fixture exercises geometry outside the ranked manifest contract.
import {
	applyShapeDivisionMove,
	boardGeometry,
	findCutPath,
	type Cell
} from '../../src/lib/puzzles/shape-division/logic.js';

import expected from './shape-division.json';

const manifest = catalog['shape-division'];

async function fingerprint(value: unknown) {
	const bytes = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
	);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyVectors() {
	for (const { seed, variant, board, moves, seconds, result } of expected.rounds) {
		if (
			(await fingerprint(manifest.createRound(seed, variant).board)) !== board ||
			JSON.stringify(manifest.replay(seed, moves, seconds, undefined, variant)) !==
				JSON.stringify(result)
		)
			throw new Error(`Shape Division replay mismatch: ${variant}/${seed}/${seconds}`);
	}
	for (const { seed, variant, moves, seconds } of expected.rejected) {
		try {
			manifest.replay(seed, moves, seconds, undefined, variant);
		} catch (error) {
			if (error instanceof RangeError) continue;
			throw error;
		}
		throw new Error(`Shape Division accepted rejected replay: ${variant}/${seed}/${seconds}`);
	}
	const cells: Cell[] = Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)]);
	const board = boardGeometry(cells);
	const base = manifest.createRound('24');
	const square = {
		...base,
		rules: { ...base.rules, pieceSize: 4 },
		board,
		pieces: [cells.map((_, i) => i)]
	};
	const result = expected.square.blocked.reduce(
		(round, move) => applyShapeDivisionMove(round, move),
		square
	);
	if (
		result.verdict !== 'shape' ||
		result.mistakes !== 1 ||
		result.pieces.some((part) => part.length !== 4)
	)
		throw new Error('Shape Division accepted the square’s bars-and-squares division');
	for (const { first, second, edges } of expected.square.routes) {
		if (JSON.stringify(findCutPath(board, first, second)) !== JSON.stringify(edges))
			throw new Error(`Shape Division square route mismatch: ${first}/${second}`);
	}
	return {
		rounds: expected.rounds.length,
		rejected: expected.rejected.length,
		fixtureRoutes: expected.square.routes.length,
		blocked: 1,
		fingerprint: await fingerprint(expected)
	};
}
