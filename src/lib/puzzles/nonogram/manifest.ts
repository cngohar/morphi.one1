import type { PuzzleManifest, PuzzlePresentation, ReplayedResult } from '#lib/engine/contract.js';
import { NONOGRAM_ENTRANCE_MS } from '#lib/round-timing.js';
import { messages } from './messages.js';
import { scoring } from './scoring.js';
import {
	applyNonogramMove,
	createNonogramRound,
	nonogramScore,
	NONOGRAM_ENGINE_VERSION,
	NONOGRAM_VARIANTS,
	type NonogramMove
} from './logic.js';

const help = {
	steps: ['nonogram.step1', 'nonogram.step2', 'nonogram.step3'],
	rows: ['completion', 'cell', 'second', 'mistake', 'hint'].map((field) => ({
		label: `scoring.nonogram.${field}`,
		field,
		sign: field === 'mistake' || field === 'hint' ? ('−' as const) : ('+' as const)
	})),
	note: 'nonogram.note',
	tips: 'nonogram.tips'
} satisfies PuzzlePresentation['help'];

const ending = {
	kind: 'completion',
	headlines: { default: 'ending.nonogram.headline' },
	subline: { key: 'ending.nonogram.subline', values: ['filled', 'mistakes'] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition: 'The player fills every solution cell according to the clues.'
} satisfies PuzzleManifest['ending'];

export const manifest = {
	id: 'nonogram',
	selectionOrder: 3,
	enabled: true,
	orientation: 'any',
	titleAfterEntrance: true,
	engineVersion: NONOGRAM_ENGINE_VERSION,
	maxMoves: 10000,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.nonogram',
		scoringLabels: Object.fromEntries(
			scoring.fields.map((field) => [field, `scoring.nonogram.${field}`])
		),
		groups: {},
		help,
		backdrop: {
			items: [
				{
					id: 'clue-grid',
					path: 'M8 8h48v48H8ZM8 24h48M8 40h48M24 8v48M40 8v48M24 24h16v16H24ZM8 40h16v16H8Z'
				}
			],
			fill: 'outline'
		}
	},
	variants: NONOGRAM_VARIANTS.map((id) => ({
		id,
		name: `variant.${id}`,
		weight: 1,
		enabled: true,
		maxMoves: 10000,
		scoring,
		help:
			id === 'nonogram:classic'
				? help
				: { ...help, steps: [help.steps[0], `nonogram.rule.${id.slice('nonogram:'.length)}`] },
		...(id === 'nonogram:countdown' ? { maxSeconds: 1800 } : {}),
		...(id === 'nonogram:countdown' || id === 'nonogram:three-hearts'
			? {
					ending: {
						...ending,
						kind: 'run_over' as const,
						headlines: { default: 'ending.nonogram.headline', cap: 'ending.nonogram.over' },
						condition:
							id === 'nonogram:countdown'
								? 'Clear before the countdown reaches zero; timeout leaves the failed board with no saved score.'
								: 'Clear with at least one heart; zero hearts leaves the failed board with no saved score.'
					}
				}
			: {})
	})),
	parseMove(move) {
		if (Object.keys(move).sort().join(',') !== 'at,cell,mark,stroke') throw new RangeError('move');
		return { at: move.at, cell: move.cell, mark: move.mark, stroke: move.stroke };
	},
	createRound: createNonogramRound,
	resumeRound(seed, moves, _scoring, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createNonogramRound(seed, variant);
		for (const move of moves)
			round = applyNonogramMove(round, this.parseMove(move) as NonogramMove);
		return round;
	},
	rankedTiming: {
		openingMs: () => NONOGRAM_ENTRANCE_MS,
		minimumSeconds(result: ReplayedResult) {
			const size = (result as ReplayedResult & { size: number }).size;
			return size === 15 ? 22.5 : size === 10 ? 10 : 2.5;
		}
	},
	ending,
	replay(seed, moves, seconds, values, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createNonogramRound(seed, variant);
		for (const move of moves)
			round = applyNonogramMove(round, this.parseMove(move) as NonogramMove);
		if (round.status !== 'won') throw new RangeError('incomplete');
		return {
			score: nonogramScore(round, seconds, values),
			pairs: null,
			moves: round.strokes,
			size: round.size
		};
	}
} satisfies PuzzleManifest;
