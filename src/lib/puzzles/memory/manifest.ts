import { messages } from './messages.js';
import type { PuzzleManifest } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring } from './scoring.js';
import { memoryOpeningMs } from '#lib/round-timing.js';
import { createMemoryRound, flipCard, resolveMismatch, scoreRound } from './logic.js';

export const manifest = {
	id: 'memory',
	selectionOrder: 1,
	engineVersion: 'memory-1',
	scoring,
	maxMoves: 120,
	parseMove(move) {
		if (Object.keys(move).sort().join(',') !== 'index') throw new RangeError('move');
		return { index: move.index };
	},
	leaderboardGroups: ['memory-1:6', 'memory-1:8', 'memory-1:10'],
	rankedTiming: {
		openingMs: (result) => memoryOpeningMs(result.pairs!),
		minimumSeconds: (result) => result.pairs! * 0.4
	},
	messages,
	createRound: createMemoryRound,
	ending: {
		kind: 'completion',
		headlines: { default: 'ending.memory.headline' },
		subline: { key: 'ending.memory.subline', values: ['pairs', 'time'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition: 'All pairs have been matched.'
	},
	replay(seed, moves, seconds, scoring?: ScoreValues) {
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
} satisfies PuzzleManifest;
