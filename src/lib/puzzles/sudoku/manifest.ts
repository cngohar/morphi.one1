import type { Move, PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import { SUDOKU_ENTRANCE_MS } from '#lib/round-timing.js';
import {
	applySudokuMove,
	createSudokuRound,
	dailySeedOk,
	sudokuScore,
	SUDOKU_COUNTDOWN,
	SUDOKU_ENGINE_VERSION,
	SUDOKU_MAX_MOVES,
	SUDOKU_VARIANTS,
	type SudokuMove
} from './logic.js';
import { messages } from './messages.js';
import { scoring } from './scoring.js';

const help = {
	steps: ['sudoku.rule.classic', 'sudoku.step.play'],
	rows: ['completion', 'second', 'hint', 'mistake', 'restart', 'countdown'].map((field) => ({
		label: `scoring.sudoku.${field}`,
		field,
		sign: field === 'completion' || field === 'countdown' ? ('+' as const) : ('−' as const)
	})),
	note: 'sudoku.help.note',
	tips: 'sudoku.help.tips'
} satisfies PuzzlePresentation['help'];
const ending = {
	kind: 'completion',
	headlines: { default: 'ending.sudoku.headline' },
	subline: { key: 'ending.sudoku.subline', values: ['time'] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition: 'Fill all 81 cells with their correct digits.'
} satisfies PuzzleManifest['ending'];

function parseMove(move: Move): SudokuMove {
	const { action, cell, value } = move;
	if (
		Object.keys(move).sort().join(',') !== 'action,cell,value' ||
		typeof action !== 'number' ||
		!Number.isSafeInteger(action) ||
		action < 0 ||
		action > 7 ||
		typeof cell !== 'number' ||
		!Number.isSafeInteger(cell) ||
		cell < 0 ||
		cell > 80 ||
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < 0 ||
		value > 9 ||
		(action === 0 || action === 2 ? value === 0 : value !== 0) ||
		(action >= 3 && cell !== 0)
	)
		throw new RangeError('move');
	return { action, cell, value };
}

function resumeRound(
	seed: string,
	moves: readonly Move[],
	values?: Parameters<typeof applySudokuMove>[2],
	variant?: string
) {
	if (moves.length > SUDOKU_MAX_MOVES) throw new RangeError('move_limit');
	let round = createSudokuRound(seed, variant);
	for (const move of moves) {
		const next = applySudokuMove(round, parseMove(move), values);
		if (next === round) throw new RangeError('move');
		round = next;
	}
	return round;
}

export const manifest = {
	id: 'sudoku',
	selectionOrder: 10,
	enabled: true,
	orientation: 'any',
	engineVersion: SUDOKU_ENGINE_VERSION,
	maxMoves: SUDOKU_MAX_MOVES,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.sudoku',
		scoringLabels: Object.fromEntries(
			scoring.fields.map((field) => [field, `scoring.sudoku.${field}`])
		),
		groups: {},
		help,
		backdrop: {
			items: [
				{
					id: 'digit-grid',
					path: 'M8 8h48v48H8ZM8 24h48M8 40h48M24 8v48M40 8v48'
				}
			],
			fill: 'outline'
		}
	},
	variants: SUDOKU_VARIANTS.map((id: string) => ({
		id,
		name: `variant.${id}`,
		weight: 1,
		enabled: true,
		maxMoves: SUDOKU_MAX_MOVES,
		help:
			id === 'sudoku:classic'
				? help
				: {
						...help,
						steps: [
							id === 'sudoku:irregular'
								? 'sudoku.rule.outline'
								: `sudoku.rule.${id.slice('sudoku:'.length)}`,
							id === 'sudoku:irregular' ? 'sudoku.rule.irregular' : help.steps[0],
							help.steps[1]
						]
					},
		...(id === 'sudoku:countdown-600'
			? {
					maxSeconds: SUDOKU_COUNTDOWN,
					ending: {
						...ending,
						kind: 'run_over' as const,
						headlines: { ...ending.headlines, cap: 'ending.sudoku.timeUp' },
						condition: 'Fill the grid before 600 seconds. A timeout saves a completed loss.'
					}
				}
			: {})
	})),
	parseMove,
	createRound: createSudokuRound,
	dailySeedOk,
	resumeRound,
	rankedTiming: { openingMs: () => SUDOKU_ENTRANCE_MS, minimumSeconds: () => 2.5 },
	ending,
	replay(seed, moves, seconds, values, variant) {
		const round = resumeRound(seed, moves, values, variant);
		if (round.status === 'playing') throw new RangeError('incomplete');
		const won = round.status === 'won';
		if (
			round.rules.timing &&
			((won && seconds >= SUDOKU_COUNTDOWN) ||
				(round.status === 'timeout' &&
					(seconds < SUDOKU_COUNTDOWN || seconds > SUDOKU_COUNTDOWN + 2)))
		)
			throw new RangeError('timeout');
		return {
			score: sudokuScore(round, seconds, values),
			pairs: null,
			moves: moves.length,
			won,
			hintUsed: round.hintUsedSession,
			mistakes: round.mistakes
		};
	}
} satisfies PuzzleManifest;
