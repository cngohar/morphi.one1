import { messages } from './messages.js';
import type { PuzzleManifest } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring } from './scoring.js';
import { memoryOpeningMs } from '#lib/round-timing.js';
import { createMemoryRound, flipCard, resolveMismatch, scoreRound } from './logic.js';

export const manifest = {
	id: 'memory',
	presentation: {
		name: 'v1.game.memory',
		scoringLabels: {
			pair: 'scoring.memory.pair',
			mismatch: 'scoring.memory.mismatch',
			second: 'scoring.memory.second'
		},
		groups: {
			'memory-1:6': 'leaderboard.memory6',
			'memory-1:8': 'leaderboard.memory8',
			'memory-1:10': 'leaderboard.memory10'
		},
		help: {
			steps: ['v1.game.memory.step1', 'v1.game.memory.step2', 'v1.game.memory.step3'],
			rows: [
				{ label: 'v1.game.memory.row1', field: 'pair', sign: '+' },
				{ label: 'v1.game.memory.row2', field: 'mismatch', sign: '−' },
				{ label: 'v1.game.memory.row3', field: 'second', sign: '−' },
				{ label: 'v1.game.memory.row4', value: 'v1.game.memory.value4' }
			],
			note: 'v1.game.memory.scoringNote',
			tips: 'v1.game.memory.tips'
		},
		backdrop: {
			items: [
				{ id: 'card', path: 'M17 5H43Q48 5 48 10V50Q48 55 43 55H17Q12 55 12 50V10Q12 5 17 5Z' }
			],
			fill: 'solid',
			symbol: true
		},
		profileIcon: { color: 'var(--accent)', rotation: 8 }
	},
	selectionOrder: 1,
	orientation: 'any',
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
	resumeRound(seed, moves) {
		let round = createMemoryRound(seed);
		if (moves.length > 12 * round.pairs) throw new RangeError('move_limit');
		for (const move of moves) {
			if (round.revealed.length === 2) round = resolveMismatch(round);
			if (Object.keys(move).join(',') !== 'index' || !Number.isInteger(move.index))
				throw new RangeError('move');
			const next = flipCard(round, move.index!);
			if (next.effect === 'ignored') throw new RangeError('move');
			round = next.round;
		}
		return round;
	},
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
