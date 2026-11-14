import type { PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import { TANGRAM_ENTRANCE_MS } from '#lib/round-timing.js';
import { messages } from './messages.js';
import { scoring, scoringForTangram } from './scoring.js';
import {
	applyTangramMove,
	createTangramRound,
	parseTangramMove,
	tangramScore,
	TANGRAM_ENGINE_VERSION,
	TANGRAM_VARIANTS
} from './logic.js';

function helpFor(variant: string): PuzzlePresentation['help'] {
	const definition = scoringForTangram(variant);
	return {
		steps: [
			variant === 'tangram:double-14' ? 'tangram.step1.double' : 'tangram.step1',
			'tangram.step2',
			variant === 'tangram:classic'
				? 'tangram.step3'
				: `tangram.rule.${variant.slice('tangram:'.length)}`
		],
		rows: definition.fields.map((field) => ({
			label:
				field === 'second' && variant === 'tangram:countdown-120'
					? 'scoring.tangram.remaining'
					: `scoring.tangram.${field}`,
			field,
			sign: field === 'hint' ? ('−' as const) : ('+' as const)
		})),
		note: 'tangram.note',
		tips: 'tangram.tips'
	};
}
const ending = {
	kind: 'completion',
	headlines: { default: 'ending.tangram.headline' },
	subline: { key: 'ending.tangram.subline', values: [] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition: 'Every piece exactly covers the silhouette, with no overlap or gap.'
} satisfies PuzzleManifest['ending'];

export const manifest = {
	id: 'tangram',
	selectionOrder: 5,
	enabled: true,
	orientation: 'any',
	titleAfterEntrance: true,
	engineVersion: TANGRAM_ENGINE_VERSION,
	maxMoves: 10000,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.tangram',
		groups: {},
		help: helpFor('tangram:classic'),
		scoringLabels: Object.fromEntries(
			scoring.fields.map((field) => [field, `scoring.tangram.${field}`])
		),
		backdrop: {
			items: [{ id: 'tan', path: 'M8 8H56L32 32ZM8 40L24 24L40 40L24 56ZM40 40H56V56Z' }],
			fill: 'solid'
		}
	},
	variants: TANGRAM_VARIANTS.map((id) => ({
		id,
		name: `variant.${id}`,
		weight: 1,
		enabled: true,
		maxMoves: 10000,
		scoring: scoringForTangram(id),
		help: helpFor(id),
		...(id === 'tangram:countdown-120' ? { maxSeconds: 120 } : {}),
		...(id === 'tangram:countdown-120' || id === 'tangram:mistake-limit-4'
			? {
					ending: {
						...ending,
						kind: 'run_over' as const,
						headlines: {
							default: 'ending.tangram.headline',
							cap:
								id === 'tangram:countdown-120' ? 'ending.tangram.timeUp' : 'ending.tangram.mistakes'
						},
						condition:
							id === 'tangram:countdown-120'
								? 'Complete before 120 seconds; timeout keeps the failed board with no score saved.'
								: 'Complete before four rejected wrong-slot snap attempts; exhaustion keeps the failed board with no score saved.'
					}
				}
			: {})
	})),
	parseMove: parseTangramMove,
	createRound: createTangramRound,
	resumeRound(seed, moves, _values, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createTangramRound(seed, variant);
		for (const move of moves) round = applyTangramMove(round, this.parseMove(move));
		return round;
	},
	rankedTiming: { openingMs: () => TANGRAM_ENTRANCE_MS, minimumSeconds: () => 5 },
	ending,
	replay(seed, moves, seconds, values, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createTangramRound(seed, variant);
		for (const move of moves) round = applyTangramMove(round, this.parseMove(move));
		if (round.status !== 'won') throw new RangeError('incomplete');
		if (round.rules.timeLimit > 0 && seconds >= round.rules.timeLimit)
			throw new RangeError('timeout');
		// Zero is the server's opening-time preflight; ranked claims replay again with elapsed time.
		if (seconds > 0 && round.lastAt >= (seconds + 1) * 1000) throw new RangeError('time');
		return { score: tangramScore(round, seconds, values), pairs: null, moves: round.moves };
	}
} satisfies PuzzleManifest;
