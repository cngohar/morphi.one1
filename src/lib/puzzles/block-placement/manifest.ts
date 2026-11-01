import { messages } from './messages.js';
import type { PuzzleManifest } from '#lib/engine/contract.js';
import { scoring } from './scoring.js';
import { BLOCK_ENGINE_VERSION, replayBlockMoves } from './logic.js';

export const manifest = {
	id: 'block',
	engineVersion: BLOCK_ENGINE_VERSION,
	scoring,
	maxMoves: 300,
	messages,
	ending: {
		kind: 'run_over',
		headlines: { default: 'ending.block.noMoves', cap: 'ending.block.cap' },
		subline: { key: 'ending.block.subline', values: ['score', 'pieces'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition:
			'Cap when placements reach BLOCK_MOVE_CAP; otherwise no-fit when the tray is empty or no tray piece fits.'
	},
	replay(seed, moves, _seconds, scoring) {
		for (const move of moves) {
			if (
				Object.keys(move).sort().join(',') !== 'trayIndex,x,y' ||
				![move.trayIndex, move.x, move.y].every(Number.isInteger)
			)
				throw new RangeError('move');
		}
		const round = replayBlockMoves(
			seed,
			moves as { trayIndex: number; x: number; y: number }[],
			scoring
		);
		if (round.status !== 'ended') throw new RangeError('incomplete');
		return {
			score: round.score,
			group: BLOCK_ENGINE_VERSION,
			pairs: null,
			moves: round.placements
		};
	}
} satisfies PuzzleManifest;
