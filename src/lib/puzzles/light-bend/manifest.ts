import type { Move, PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import { LIGHT_BEND_ENTRANCE_MS } from '#lib/round-timing.js';
import { messages } from './messages.js';
import { scoring } from './scoring.js';
import {
	applyLightBendMove,
	createLightBendRound,
	createLightBendRoundInner,
	dailySeedOk,
	hintCell,
	lightBendScore,
	lightBendStarGrade,
	LIGHT_BEND_COUNTDOWN,
	LIGHT_BEND_ENGINE_VERSION,
	LIGHT_BEND_VARIANTS,
	parseLightBendMove,
	resolveVariantFromRules,
	type LightBendMove
} from './logic.js';

const help = {
	steps: ['light-bend.step1', 'light-bend.step2', 'light-bend.step3'],
	rows: ['completion', 'second', 'hint', 'reset', 'countdown'].map((field) => ({
		label: `scoring.light-bend.${field}`,
		field,
		sign:
			field === 'hint' || field === 'reset'
				? ('−' as const)
				: field === 'second' || field === 'countdown'
					? ('+' as const)
					: ('+' as const)
	})),
	note: 'light-bend.note',
	tips: 'light-bend.tips'
} satisfies PuzzlePresentation['help'];

function helpFor(variant: string): PuzzlePresentation['help'] {
	if (variant === 'light-bend:classic') return help;
	return {
		...help,
		steps: [help.steps[0], `light-bend.rule.${variant.slice('light-bend:'.length)}`]
	};
}

const ending = {
	kind: 'completion',
	headlines: { default: 'ending.light-bend.headline' },
	subline: { key: 'ending.light-bend.subline', values: ['crystals', 'stars'] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition: 'Every crystal is lit by the beam in one trace.'
} satisfies PuzzleManifest['ending'];

const timedOut = {
	...ending,
	kind: 'run_over' as const,
	headlines: { default: 'ending.light-bend.headline', cap: 'ending.light-bend.timeUp' },
	condition:
		'Light every crystal before the countdown reaches zero; timeout keeps the failed board with no score saved.'
} satisfies PuzzleManifest['ending'];

export const manifest = {
	id: 'light-bend',
	selectionOrder: 7,
	enabled: true,
	orientation: 'any',
	titleAfterEntrance: true,
	engineVersion: LIGHT_BEND_ENGINE_VERSION,
	maxMoves: 10000,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.light-bend',
		groups: {},
		scoringLabels: Object.fromEntries(
			scoring.fields
				.filter((field) => field !== 'hintSolvedRanks')
				.map((field) => [field, `scoring.light-bend.${field}`])
		),
		help,
		backdrop: {
			items: [
				{
					id: 'beam',
					path: 'M6 32h20l6-14 8 20h10l6-12h16'
				}
			],
			fill: 'outline'
		}
	},
	variants: LIGHT_BEND_VARIANTS.map((id) => ({
		id,
		name: `variant.${id}`,
		weight: 1,
		enabled: true,
		maxMoves: 10000,
		// No per-variant `scoring`: the brief's scope is the family, so all eleven
		// presets share one immutable `brief-v1` config and one live version.
		help: helpFor(id),
		...(id === 'light-bend:countdown-120'
			? { maxSeconds: LIGHT_BEND_COUNTDOWN, ending: timedOut }
			: {})
	})),
	parseMove(raw: Move): LightBendMove {
		return parseLightBendMove(raw);
	},
	createRound: createLightBendRound,
	resumeRound(seed, moves, _values, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createLightBendRoundInner(seed, variant);
		for (const move of moves) round = applyLightBendMove(round, parseLightBendMove(move));
		return round;
	},
	rankedTiming: {
		openingMs: () => LIGHT_BEND_ENTRANCE_MS,
		minimumSeconds: () => 2.5
	},
	dailySeedOk,
	resolveVariantFromRules,
	ending,
	replay(seed, moves, seconds, values, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createLightBendRoundInner(seed, variant);
		for (const move of moves) round = applyLightBendMove(round, parseLightBendMove(move));
		if (round.status !== 'won') throw new RangeError('incomplete');
		return {
			score: lightBendScore(round, seconds, values),
			pairs: null,
			moves: round.moves,
			crystals: round.crystalCells.length,
			stars: lightBendStarGrade(round),
			par: round.par,
			// The sticky session flag (§5 L10): a hint costs points, not rank.
			hintUsed: round.hintsUsed > 0,
			hintedCell: hintCell(round)
		};
	}
} satisfies PuzzleManifest;
