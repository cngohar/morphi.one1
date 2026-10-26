import { catalog, createMemoryRound, replayBlockMoves } from '../../src/lib/catalog.js';
import { createRng } from '../../src/lib/engine/rng.js';
import expected from './reference.json';

export async function verifyVectors() {
	const rng = createRng('0');
	const vectors = {
		rng: Array.from({ length: 5 }, () => rng.nextU64().toString(16)),
		memory: expected.memory.map(({ seed }) => {
			const round = createMemoryRound(seed);
			const symbols = [...new Set(round.cards.map((card) => card.symbol))];
			const moves = symbols.flatMap((symbol) =>
				round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
			);
			return {
				seed,
				pairs: round.pairs,
				deck: round.cards.map((card) => card.id),
				score: catalog.memory.replay(seed, moves, 10).score
			};
		}),
		block: (() => {
			const coordinates = [
				[0, 0, 0],
				[1, 1, 0],
				[2, 2, 0],
				[0, 4, 0],
				[1, 6, 0],
				[2, 0, 2],
				[0, 3, 2],
				[1, 4, 2],
				[2, 5, 3],
				[0, 3, 0],
				[1, 7, 0],
				[2, 2, 3],
				[0, 0, 0],
				[1, 3, 0],
				[2, 5, 0],
				[0, 6, 0],
				[1, 0, 1],
				[2, 0, 1],
				[0, 2, 1],
				[1, 6, 1]
			];
			const round = replayBlockMoves(
				'0',
				coordinates.map(([trayIndex, x, y]) => ({ trayIndex: trayIndex!, x: x!, y: y! }))
			);
			return {
				score: round.score,
				lines: round.lines,
				combo: round.combo,
				placements: round.placements,
				status: round.status,
				supplyIndex: round.supplyIndex,
				tray: round.tray
			};
		})()
	};
	if (JSON.stringify(vectors) !== JSON.stringify(expected))
		throw new Error('Known replay vector mismatch');
	const bytes = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(vectors)))
	);
	return {
		passed: true,
		fingerprint: [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
		vectors: 5
	};
}
