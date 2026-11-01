import type { PuzzleManifest } from '#lib/engine/contract.js';
import { createMemoryRound, flipCard, resolveMismatch, scoreRound } from './logic.js';

export const manifest: PuzzleManifest = {
	id: 'memory',
	engineVersion: 'memory-1',
	maxMoves: 120,
	ending: {
		kind: 'completion',
		headlines: { default: 'ending.memory.headline' },
		subline: { key: 'ending.memory.subline', values: ['pairs', 'time'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition: 'All pairs have been matched.'
	},
	replay(seed, moves, seconds, scoring) {
		let round = createMemoryRound(seed);
		if (moves.length > 12 * round.pairs) throw new RangeError('move_limit');
		for (const move of moves) {
			if (Object.keys(move).length !== 1 || !Number.isInteger(move.index))
				throw new RangeError('move');
			const result = flipCard(round, move.index!);
			if (result.effect === 'ignored') throw new RangeError('move');
			round = result.effect === 'mismatch' ? resolveMismatch(result.round) : result.round;
		}
		if (round.status !== 'won') throw new RangeError('incomplete');
		return {
			score: scoreRound(round, seconds, scoring),
			group: `memory-1:${round.pairs}`,
			pairs: round.pairs,
			moves: round.moves
		};
	}
};
