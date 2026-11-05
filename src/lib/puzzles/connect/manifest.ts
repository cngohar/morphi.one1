import { messages } from './messages.js';
import type { PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring } from './scoring.js';
import { CONNECT_ENTRANCE_MS } from '#lib/round-timing.js';
import {
	applyConnectMove,
	connectScore,
	CONNECT_ENGINE_VERSION,
	createConnectRound,
	type ConnectMove
} from './logic.js';

const help = {
	steps: ['v1.game.connect.step1', 'v1.game.connect.step2', 'v1.game.connect.step3'],
	rows: [
		{ label: 'v1.game.connect.row1', field: 'pair', sign: '+' },
		{ label: 'v1.game.connect.row2', field: 'grid', sign: '+' },
		{ label: 'v1.game.connect.row3', field: 'second', sign: '+' },
		{ label: 'v1.game.connect.row4', field: 'redraw', sign: '−' }
	],
	note: 'v1.game.connect.scoringNote',
	tips: 'v1.game.connect.tips'
} satisfies PuzzlePresentation['help'];

export const manifest = {
	id: 'connect',
	presentation: {
		name: 'v1.game.connect',
		scoringLabels: {
			pair: 'scoring.connect.pair',
			grid: 'scoring.connect.grid',
			second: 'scoring.connect.second',
			redraw: 'scoring.connect.redraw'
		},
		groups: {
			'connect-1:1': 'leaderboard.connect1',
			'connect-1:2': 'leaderboard.connect2',
			'connect-1:3': 'leaderboard.connect3',
			'connect-1:full-grid': 'variant.connect:full-grid',
			'connect-1:board-8': 'variant.connect:board-8',
			'connect-1:rush-60': 'variant.connect:rush-60'
		},
		help,
		backdrop: {
			items: [
				{
					id: 'dot-path',
					path: 'M8 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M13 17v27h34V17M42 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0'
				}
			],
			fill: 'outline'
		}
	},
	selectionOrder: 2,
	orientation: 'any',
	titleAfterEntrance: true,
	engineVersion: CONNECT_ENGINE_VERSION,
	scoring,
	variants: [
		{
			id: 'connect:classic',
			name: 'variant.connect:classic',
			weight: 1,
			maxMoves: 1000,
			leaderboardGroups: [1, 2, 3].map((band) => `${CONNECT_ENGINE_VERSION}:${band}`)
		},
		{
			id: 'connect:full-grid',
			name: 'variant.connect:full-grid',
			weight: 1,
			maxMoves: 1000,
			leaderboardGroups: [`${CONNECT_ENGINE_VERSION}:full-grid`],
			help: {
				...help,
				steps: ['v1.game.connect.step1', 'v1.game.connect.step2', 'connect.fullGrid.step3'],
				note: 'connect.fullGrid.scoringNote'
			}
		},
		{
			id: 'connect:board-8',
			name: 'variant.connect:board-8',
			weight: 1,
			maxMoves: 1000,
			leaderboardGroups: [`${CONNECT_ENGINE_VERSION}:board-8`],
			help: {
				...help,
				rows: [...help.rows, { label: 'connect.help.boardSize', value: 'connect.board8.size' }]
			}
		},
		{
			id: 'connect:rush-60',
			name: 'variant.connect:rush-60',
			weight: 1,
			maxMoves: 1000,
			maxSeconds: 60,
			leaderboardGroups: [`${CONNECT_ENGINE_VERSION}:rush-60`],
			help: {
				...help,
				rows: [...help.rows, { label: 'block.help.clock', value: 'block.rush.clock' }],
				note: 'connect.rush.scoringNote',
				tips: 'connect.rush.tips'
			}
		}
	],
	maxMoves: 1000,
	parseMove(move) {
		if (Object.keys(move).sort().join(',') !== 'at,cell,pair,stroke') throw new RangeError('move');
		return { pair: move.pair, cell: move.cell, stroke: move.stroke, at: move.at };
	},
	leaderboardGroups: [
		'connect-1:1',
		'connect-1:2',
		'connect-1:3',
		'connect-1:full-grid',
		'connect-1:board-8',
		'connect-1:rush-60'
	],
	rankedTiming: {
		openingMs: () => CONNECT_ENTRANCE_MS,
		minimumSeconds: () => 0
	},
	messages,
	createRound: createConnectRound,
	resumeRound(seed, moves, _scoring?: ScoreValues, variant?: string) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createConnectRound(seed, variant);
		for (const move of moves) {
			if (Object.keys(move).sort().join(',') !== 'at,cell,pair,stroke')
				throw new RangeError('move');
			round = applyConnectMove(round, move as ConnectMove);
		}
		return round;
	},
	ending: {
		kind: 'completion',
		headlines: {
			default: 'ending.connect.headline'
		},
		subline: { key: 'ending.connect.subline', values: ['filled'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition: 'Every pair is connected; filling every cell is not required except in full-grid.'
	},
	replay(seed, moves, seconds, scoring?: ScoreValues, variant?: string) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createConnectRound(seed, variant);
		for (const move of moves) {
			if (Object.keys(move).sort().join(',') !== 'at,cell,pair,stroke')
				throw new RangeError('move');
			round = applyConnectMove(round, move as ConnectMove);
		}
		if (round.status !== 'won') throw new RangeError('incomplete');
		const group =
			variant && variant !== 'connect:classic'
				? `${CONNECT_ENGINE_VERSION}:${variant.replace('connect:', '')}`
				: `${CONNECT_ENGINE_VERSION}:${round.band}`;
		return {
			score: connectScore(round, seconds, scoring),
			group,
			pairs: round.pairs.length,
			moves: round.strokes
		};
	}
} satisfies PuzzleManifest;
