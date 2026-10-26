import type { PuzzleManifest } from '#lib/engine/contract.js';
import { BLOCK_ENGINE_VERSION, replayBlockMoves } from './logic.js';

export const manifest: PuzzleManifest = {
	id: 'block',
	engineVersion: BLOCK_ENGINE_VERSION,
	maxMoves: 300,
	replay(seed, moves) {
		for (const move of moves) {
			if (
				Object.keys(move).sort().join(',') !== 'trayIndex,x,y' ||
				![move.trayIndex, move.x, move.y].every(Number.isInteger)
			)
				throw new RangeError('move');
		}
		const round = replayBlockMoves(seed, moves as { trayIndex: number; x: number; y: number }[]);
		if (round.status !== 'ended') throw new RangeError('incomplete');
		return {
			score: round.score,
			group: BLOCK_ENGINE_VERSION,
			pairs: null,
			moves: round.placements
		};
	}
};
