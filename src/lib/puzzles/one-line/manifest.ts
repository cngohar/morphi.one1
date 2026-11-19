import type { Move, PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import {
	applyOneLineMove,
	createOneLineRound,
	dailySeedOk,
	oneLineScore,
	resolveVariantFromRules,
	ONE_LINE_COUNTDOWN,
	ONE_LINE_ENGINE_VERSION,
	ONE_LINE_VARIANTS,
	type OneLineMove
} from './logic.js';
import { messages } from './messages.js';
import { scoring } from './scoring.js';

const maxMoves = 10000;
const help = {
	steps: ['one-line.step1', 'one-line.step2', 'one-line.step3'],
	rows: ['edge', 'hint', 'restart'].map((field) => ({
		label: `scoring.one-line.${field}`,
		field,
		sign: field === 'edge' ? ('+' as const) : ('−' as const)
	})),
	note: 'one-line.note',
	tips: 'one-line.tips'
} satisfies PuzzlePresentation['help'];
const ending = {
	kind: 'completion',
	headlines: { default: 'ending.one-line.headline' },
	subline: { key: 'ending.one-line.subline', values: ['lines'] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition: 'Cover every required traversal or give the correct impossible verdict.'
} satisfies PuzzleManifest['ending'];

function parseMove(move: Move): OneLineMove {
	const { action, edge, value } = move;
	if (
		Object.keys(move).sort().join(',') !== 'action,edge,value' ||
		typeof action !== 'number' ||
		!Number.isSafeInteger(action) ||
		action < 0 ||
		action > 6 ||
		typeof edge !== 'number' ||
		!Number.isSafeInteger(edge) ||
		edge < 0 ||
		edge >= 34 ||
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < 0 ||
		value >= 63 ||
		(action !== 0 && (edge !== 0 || value > Number(action === 4)))
	)
		throw new RangeError('move');
	return { action, edge, value };
}

function resume(seed: string, moves: readonly Move[], variant?: string) {
	if (moves.length > maxMoves) throw new RangeError('move_limit');
	let round = createOneLineRound(seed, variant);
	for (const move of moves) round = applyOneLineMove(round, parseMove(move));
	return round;
}

export const manifest = {
	id: 'one-line',
	selectionOrder: 9,
	enabled: true,
	orientation: 'any',
	engineVersion: ONE_LINE_ENGINE_VERSION,
	maxMoves,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.one-line',
		scoringLabels: Object.fromEntries(
			scoring.fields.map((field) => [field, `scoring.one-line.${field}`])
		),
		groups: {},
		help,
		backdrop: {
			items: [
				{
					id: 'linked-dots',
					path: 'M12 14L51 21L23 50L12 14M8 14a4 4 0 1 1 8 0a4 4 0 1 1 -8 0M47 21a4 4 0 1 1 8 0a4 4 0 1 1 -8 0M19 50a4 4 0 1 1 8 0a4 4 0 1 1 -8 0'
				}
			],
			fill: 'outline'
		}
	},
	variants: ONE_LINE_VARIANTS.map((id) => ({
		id,
		name: `variant.${id}`,
		weight: 1,
		enabled: true,
		maxMoves,
		help:
			id === 'one-line:classic'
				? help
				: {
						...help,
						steps: [`one-line.rule.${id.slice('one-line:'.length)}`, ...help.steps.slice(1)]
					},
		...(id === 'one-line:verdict' ? { daily: false } : {}),
		...(id === 'one-line:countdown'
			? {
					maxSeconds: ONE_LINE_COUNTDOWN,
					ending: {
						...ending,
						kind: 'run_over' as const,
						headlines: { ...ending.headlines, cap: 'ending.one-line.timeUp' },
						condition: 'Complete the drawing before 120 seconds. A timeout saves as a loss.'
					}
				}
			: {})
	})),
	parseMove,
	createRound: createOneLineRound,
	resolveVariantFromRules,
	dailySeedOk,
	resumeRound(seed, moves, _values?, variant?) {
		return resume(seed, moves, variant);
	},
	rankedTiming: { openingMs: () => 0, minimumSeconds: () => 2.5 },
	ending,
	replay(seed, moves, seconds, values?, variant?) {
		const round = resume(seed, moves, variant);
		if (round.status === 'playing') throw new RangeError('incomplete');
		const won = round.status === 'won';
		if (
			round.rules.timing &&
			((won && seconds >= ONE_LINE_COUNTDOWN) ||
				(round.status === 'timeout' &&
					(seconds < ONE_LINE_COUNTDOWN || seconds > ONE_LINE_COUNTDOWN + 2)))
		)
			throw new RangeError('timeout');
		return {
			score: oneLineScore(round, seconds, values),
			pairs: round.edgesCovered,
			moves: moves.length,
			won,
			hintUsed: round.hintUsedSession
		};
	}
} satisfies PuzzleManifest;
