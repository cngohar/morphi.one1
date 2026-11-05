import { messages } from './messages.js';
import type { PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring } from './scoring.js';
import { BLOCK_ENTRANCE_MS } from '#lib/round-timing.js';
import {
	BLOCK_ENGINE_VERSION,
	BLOCK_RUSH_SECONDS,
	createBlockRound,
	parseBlockVariant,
	PIECES,
	replayBlockMoves
} from './logic.js';

const help = {
	steps: ['v1.game.block.step1', 'v1.game.block.step2', 'v1.game.block.step3'],
	rows: [
		{ label: 'v1.game.block.row1', field: 'line', sign: '+' },
		{ label: 'v1.game.block.row2', field: 'extraLine', sign: '+' },
		{ label: 'v1.game.block.row3', field: 'combo', sign: '+' },
		{ label: 'v1.game.block.row4', value: 'v1.game.block.value4' }
	],
	note: 'v1.game.block.scoringNote',
	tips: 'v1.game.block.tips'
} satisfies PuzzlePresentation['help'];

export const manifest = {
	id: 'block',
	presentation: {
		name: 'v1.game.block',
		scoringLabels: {
			line: 'scoring.block.line',
			extraLine: 'scoring.block.extraLine',
			combo: 'scoring.block.combo'
		},
		groups: {
			'block-placement-1': 'leaderboard.block',
			'block-placement-1:board-10': 'variant.block:board-10',
			'block-placement-1:rows-only': 'variant.block:rows-only',
			'block-placement-1:rush-60': 'variant.block:rush-60'
		},
		help,
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
	variants: [
		{
			id: 'block:classic',
			name: 'variant.block:classic',
			weight: 1,
			maxMoves: 300,
			leaderboardGroups: [BLOCK_ENGINE_VERSION]
		},
		{
			id: 'block:board-10',
			name: 'variant.block:board-10',
			weight: 1,
			maxMoves: 300,
			leaderboardGroups: [`${BLOCK_ENGINE_VERSION}:board-10`],
			help: {
				...help,
				steps: ['block.board10.step1', 'v1.game.block.step2', 'v1.game.block.step3'],
				rows: [...help.rows, { label: 'block.help.boardSize', value: 'block.board10.size' }]
			}
		},
		{
			id: 'block:rows-only',
			name: 'variant.block:rows-only',
			weight: 1,
			maxMoves: 300,
			leaderboardGroups: [`${BLOCK_ENGINE_VERSION}:rows-only`],
			help: {
				...help,
				steps: ['v1.game.block.step1', 'block.rowsOnly.step2', 'v1.game.block.step3'],
				rows: [...help.rows, { label: 'block.help.columns', value: 'block.rowsOnly.columns' }],
				tips: 'block.rowsOnly.tips'
			}
		},
		{
			id: 'block:rush-60',
			name: 'variant.block:rush-60',
			weight: 1,
			maxMoves: 300,
			maxSeconds: BLOCK_RUSH_SECONDS,
			leaderboardGroups: [`${BLOCK_ENGINE_VERSION}:rush-60`],
			help: {
				...help,
				steps: ['v1.game.block.step1', 'v1.game.block.step2', 'block.rush.step3'],
				rows: [...help.rows, { label: 'block.help.clock', value: 'block.rush.clock' }],
				note: 'block.rush.scoringNote',
				tips: 'block.rush.tips'
			}
		}
	],
	maxMoves: 300,
	parseMove(move) {
		if (Object.keys(move).sort().join(',') !== 'trayIndex,x,y') throw new RangeError('move');
		return { trayIndex: move.trayIndex, x: move.x, y: move.y };
	},
	leaderboardGroups: [
		BLOCK_ENGINE_VERSION,
		`${BLOCK_ENGINE_VERSION}:board-10`,
		`${BLOCK_ENGINE_VERSION}:rows-only`,
		`${BLOCK_ENGINE_VERSION}:rush-60`
	],
	rankedTiming: {
		openingMs: (_result, variant?: string) =>
			parseBlockVariant(variant) === 'block:rush-60' ? BLOCK_ENTRANCE_MS : null,
		minimumSeconds: () => 0
	},
	messages,
	createRound: createBlockRound,
	resumeRound(seed, moves, scoring?: ScoreValues, variant?: string) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		for (const move of moves) {
			if (
				Object.keys(move).sort().join(',') !== 'trayIndex,x,y' ||
				![move.trayIndex, move.x, move.y].every(Number.isInteger)
			)
				throw new RangeError('move');
		}
		return replayBlockMoves(
			seed,
			moves as { trayIndex: number; x: number; y: number }[],
			scoring,
			variant
		);
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
	replay(seed, moves, _seconds, scoring?: ScoreValues, variant?: string) {
		const selectedVariant = parseBlockVariant(variant);
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
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
			scoring,
			selectedVariant
		);
		if (round.status !== 'ended' && !(selectedVariant === 'block:rush-60' && moves.length > 0))
			throw new RangeError('incomplete');
		return {
			score: round.score,
			group:
				selectedVariant === 'block:classic'
					? BLOCK_ENGINE_VERSION
					: `${BLOCK_ENGINE_VERSION}:${selectedVariant.slice('block:'.length)}`,
			pairs: null,
			moves: round.placements
		};
	}
} satisfies PuzzleManifest & {
	replayRound: typeof replayBlockMoves;
	backdropPieces: typeof PIECES;
};
