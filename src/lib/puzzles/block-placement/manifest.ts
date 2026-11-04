import { messages } from './messages.js';
import type { PuzzleManifest } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring } from './scoring.js';
import { BLOCK_ENGINE_VERSION, createBlockRound, PIECES, replayBlockMoves } from './logic.js';

export const manifest = {
	id: 'block',
	presentation: {
		name: 'v1.game.block',
		scoringLabels: {
			line: 'scoring.block.line',
			extraLine: 'scoring.block.extraLine',
			combo: 'scoring.block.combo'
		},
		groups: { 'block-placement-1': 'leaderboard.block' },
		help: {
			steps: ['v1.game.block.step1', 'v1.game.block.step2', 'v1.game.block.step3'],
			rows: [
				{ label: 'v1.game.block.row1', field: 'line', sign: '+' },
				{ label: 'v1.game.block.row2', field: 'extraLine', sign: '+' },
				{ label: 'v1.game.block.row3', field: 'combo', sign: '+' },
				{ label: 'v1.game.block.row4', value: 'v1.game.block.value4' }
			],
			note: 'v1.game.block.scoringNote',
			tips: 'v1.game.block.tips'
		},
		backdrop: {
			items: PIECES.map((piece) => ({
				id: piece.id,
				path: piece.cells
					.map(({ x, y }) => {
						const size = 46 / Math.max(piece.width, piece.height);
						return `M${7 + x * size} ${7 + y * size}h${size - 2}v${size - 2}h${2 - size}Z`;
					})
					.join('')
			})),
			fill: 'solid'
		}
	},
	selectionOrder: 0,
	orientation: 'any',
	engineVersion: BLOCK_ENGINE_VERSION,
	scoring,
	maxMoves: 300,
	parseMove(move) {
		if (Object.keys(move).sort().join(',') !== 'trayIndex,x,y') throw new RangeError('move');
		return { trayIndex: move.trayIndex, x: move.x, y: move.y };
	},
	leaderboardGroups: [BLOCK_ENGINE_VERSION],
	rankedTiming: null,
	messages,
	createRound: createBlockRound,
	resumeRound(seed, moves, scoring?: ScoreValues) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		for (const move of moves) {
			if (
				Object.keys(move).sort().join(',') !== 'trayIndex,x,y' ||
				![move.trayIndex, move.x, move.y].every(Number.isInteger)
			)
				throw new RangeError('move');
		}
		return replayBlockMoves(seed, moves as { trayIndex: number; x: number; y: number }[], scoring);
	},
	replayRound: replayBlockMoves,
	backdropPieces: PIECES,
	ending: {
		kind: 'run_over',
		headlines: { default: 'ending.block.noMoves', cap: 'ending.block.cap' },
		subline: { key: 'ending.block.subline', values: ['score', 'pieces'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition:
			'Cap when placements reach BLOCK_MOVE_CAP; otherwise no-fit when the tray is empty or no tray piece fits.'
	},
	replay(seed, moves, _seconds, scoring?: ScoreValues) {
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
} satisfies PuzzleManifest & {
	replayRound: typeof replayBlockMoves;
	backdropPieces: typeof PIECES;
};
