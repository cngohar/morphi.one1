import type { Move, PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import {
	applyShapeDivisionMove,
	createShapeDivisionRound,
	dailySeedOk,
	resolveVariantFromRules,
	shapeDivisionEntranceMs,
	shapeDivisionScore,
	SHAPE_DIVISION_COUNTDOWN,
	SHAPE_DIVISION_ENGINE_VERSION,
	SHAPE_DIVISION_MAX_MOVES,
	SHAPE_DIVISION_VARIANTS,
	type ShapeDivisionMove
} from './logic.js';
import { messages } from './messages.js';
import { scoring } from './scoring.js';

const help = {
	steps: ['shape-division.rule.classic', 'shape-division.teach', 'shape-division.rule.congruence'],
	rows: [
		{ label: 'scoring.shape-division.completionPoints', field: 'completionPoints', sign: '+' },
		{ label: 'scoring.shape-division.pointsPerSecond', field: 'pointsPerSecond', sign: '−' },
		{ label: 'scoring.shape-division.hintCost', field: 'hintCost', sign: '−' },
		{ label: 'scoring.shape-division.mistakeCost', field: 'mistakeCost', sign: '−' },
		{ label: 'scoring.shape-division.restartCost', field: 'restartCost', sign: '−' }
	],
	note: 'shape-division.help.note',
	tips: 'shape-division.help.tips'
} satisfies PuzzlePresentation['help'];

const ending = {
	kind: 'completion',
	headlines: { default: 'ending.shape-division.headline' },
	subline: { key: 'ending.shape-division.subline', values: ['pieces'] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition: 'The player submits a complete division of identical pieces via Check.'
} satisfies PuzzleManifest['ending'];

const equalAreaEnding = {
	...ending,
	headlines: { default: 'ending.shape-division.equalArea' },
	condition: 'The player submits four pieces of equal area via Check.'
} satisfies PuzzleManifest['ending'];

const equalityEnding = {
	...ending,
	headlines: { default: 'ending.shape-division.equality' },
	condition: 'The player submits any complete 4-piece division via Check.'
} satisfies PuzzleManifest['ending'];

function parseMove(move: Move): ShapeDivisionMove {
	const { action, first, second } = move;
	if (
		Object.keys(move).sort().join(',') !== 'action,first,second' ||
		typeof action !== 'number' ||
		!Number.isSafeInteger(action) ||
		action < 0 ||
		action > 6 ||
		typeof first !== 'number' ||
		!Number.isSafeInteger(first) ||
		typeof second !== 'number' ||
		!Number.isSafeInteger(second) ||
		(action > 1 && (first !== 0 || second !== 0))
	)
		throw new RangeError('move');
	return { action, first, second };
}

function resumeRound(
	seed: string,
	moves: readonly Move[],
	values?: Parameters<typeof applyShapeDivisionMove>[2],
	variant?: string
) {
	if (moves.length > SHAPE_DIVISION_MAX_MOVES) throw new RangeError('move_limit');
	let round = createShapeDivisionRound(seed, variant);
	for (const move of moves) round = applyShapeDivisionMove(round, parseMove(move), values);
	return round;
}

export const manifest = {
	id: 'shape-division',
	selectionOrder: 11,
	enabled: true,
	orientation: 'any',
	engineVersion: SHAPE_DIVISION_ENGINE_VERSION,
	maxMoves: SHAPE_DIVISION_MAX_MOVES,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.shape-division',
		scoringLabels: Object.fromEntries(
			scoring.fields.map((field) => [field, `scoring.shape-division.${field}`])
		),
		groups: {},
		help,
		backdrop: {
			items: [
				{ id: 'cut-outline', path: 'M6 10H33V26H57V42H36V56H20V35H6ZM20 10V35M33 26H20M36 42V26' }
			],
			fill: 'outline'
		}
	},
	variants: SHAPE_DIVISION_VARIANTS.map((id) => ({
		id,
		name: `variant.${id}`,
		weight: 1,
		enabled: true,
		maxMoves: SHAPE_DIVISION_MAX_MOVES,
		...(id === 'shape-division:classic'
			? { help }
			: {
					daily: false,
					help: {
						...help,
						steps: [
							`shape-division.rule.${id.slice('shape-division:'.length)}`,
							'shape-division.teach'
						]
					}
				}),
		...(id === 'shape-division:countdown-300' ? { maxSeconds: SHAPE_DIVISION_COUNTDOWN } : {}),
		...(id === 'shape-division:equality-score' ? { ending: equalityEnding } : {}),
		...(id === 'shape-division:equal-area' ? { ending: equalAreaEnding } : {})
	})),
	parseMove,
	createRound: createShapeDivisionRound,
	resumeRound,
	resolveVariantFromRules,
	dailySeedOk,
	rankedTiming: {
		openingMs: () => null,
		openingMsForSeed: shapeDivisionEntranceMs,
		minimumSeconds: () => 2.5
	},
	ending,
	replay(seed, moves, seconds, values?, variant?) {
		const round = resumeRound(seed, moves, values, variant);
		if (round.status === 'playing') throw new RangeError('incomplete');
		if (
			round.rules.timing &&
			(round.status === 'timeout'
				? seconds < SHAPE_DIVISION_COUNTDOWN || seconds > SHAPE_DIVISION_COUNTDOWN + 2
				: seconds >= SHAPE_DIVISION_COUNTDOWN)
		)
			throw new RangeError('timeout');
		return {
			score: shapeDivisionScore(round, seconds, values),
			won: round.status === 'won',
			pairs: null,
			moves: moves.length,
			hintUsed: round.hints.length > 0
		};
	}
} satisfies PuzzleManifest;
