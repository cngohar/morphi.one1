import type { Move, PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import { KLONDIKE_ENTRANCE_MS } from '#lib/round-timing.js';
import { messages } from './messages.js';
import { scoring } from './scoring.js';
import {
	createKlondikeRound,
	encodeRules,
	klondikeDeal,
	parseRules,
	replayKlondikeMoves,
	dailySeedOk,
	KLONDIKE_ENGINE_VERSION,
	KLONDIKE_VARIANTS,
	replayKlondike,
	resolveVariantFromRules
} from './logic.js';

const help = {
	steps: ['klondike-solitaire.step1', 'klondike-solitaire.step2', 'klondike-solitaire.step3'],
	rows: [
		{ label: 'scoring.klondike-solitaire.wasteTableau', field: 'wasteTableau', sign: '+' as const },
		{ label: 'scoring.klondike-solitaire.foundation', field: 'foundation', sign: '+' as const },
		{ label: 'scoring.klondike-solitaire.flip', field: 'flip', sign: '+' as const },
		{
			label: 'scoring.klondike-solitaire.foundationReturn',
			field: 'foundationReturn',
			sign: '−' as const
		},
		{
			label: 'scoring.klondike-solitaire.recycleDraw1',
			field: 'recycleDraw1',
			sign: '−' as const
		},
		{
			label: 'scoring.klondike-solitaire.recycleDraw3',
			field: 'recycleDraw3',
			sign: '−' as const
		},
		{ label: 'scoring.klondike-solitaire.timeBonus', field: 'timeBonus', sign: '+' as const },
		{ label: 'scoring.klondike-solitaire.hint', field: 'hint', sign: '−' as const }
	],
	note: 'klondike-solitaire.note',
	tips: 'klondike-solitaire.tips'
} satisfies PuzzlePresentation['help'];

const ending = {
	kind: 'completion',
	headlines: { default: 'ending.klondike-solitaire.headline' },
	subline: { key: 'ending.klondike-solitaire.subline', values: ['moves'] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition: 'All 52 cards are moved to the four foundations.'
} satisfies PuzzleManifest['ending'];

export const manifest = {
	id: 'klondike-solitaire',
	selectionOrder: 6,
	enabled: true,
	orientation: 'any',
	titleAfterEntrance: true,
	engineVersion: KLONDIKE_ENGINE_VERSION,
	maxMoves: 10000,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.klondike-solitaire',
		scoringLabels: Object.fromEntries(
			scoring.fields.map((field) => [field, `scoring.klondike-solitaire.${field}`])
		),
		groups: {},
		help,
		backdrop: {
			items: [
				{
					id: 'spade-motif',
					path: 'M32 8 C26 18 16 26 16 36 C16 43 21 48 28 48 C30 48 31 47 32 46 C33 47 34 48 36 48 C43 48 48 43 48 36 C48 26 38 18 32 8 Z M30 46 L27 56 L37 56 L34 46 Z'
				},
				{
					id: 'diamond-motif',
					path: 'M32 10 L48 32 L32 54 L16 32 Z'
				}
			],
			fill: 'outline'
		}
	},
	variants: KLONDIKE_VARIANTS.map((id) => ({
		id,
		name: `variant.${id}`,
		weight: 1,
		enabled: true,
		maxMoves: 10000,
		scoring,
		help:
			id === 'klondike-solitaire:classic'
				? help
				: {
						...help,
						steps: [
							help.steps[0],
							`klondike-solitaire.rule.${id.slice('klondike-solitaire:'.length)}`
						]
					},
		ending: {
			...ending,
			kind: 'run_over' as const,
			headlines: {
				default: 'ending.klondike-solitaire.headline',
				cap: 'ending.klondike-solitaire.over'
			},
			condition: 'No legal moves remaining and stock is exhausted; round ends with no saved score.'
		}
	})),
	parseMove(raw: Move): Move {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			throw new RangeError('Invalid move payload');
		}
		const keys = Object.keys(raw).sort().join(',');
		if (keys !== 'action,at,card,count,dst,src') {
			throw new RangeError(`Invalid move keys: ${keys}`);
		}
		const move = raw as Record<string, number>;
		for (const key of ['action', 'at', 'card', 'count', 'dst', 'src']) {
			if (!Number.isSafeInteger(move[key]) || move[key] < 0) {
				throw new RangeError(`Invalid move value for ${key}`);
			}
		}
		return {
			action: move.action,
			at: move.at,
			card: move.card,
			count: move.count,
			dst: move.dst,
			src: move.src
		};
	},
	createRound: createKlondikeRound,
	resumeRound(seed, moves, _scoring, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		const rules = parseRules(variant);
		const { deck } = klondikeDeal(seed, variant);
		return {
			seed,
			variant,
			rules: encodeRules(rules),
			...replayKlondikeMoves(
				deck,
				rules,
				moves.map((move) => this.parseMove(move))
			)
		};
	},
	resolveVariantFromRules,
	dailySeedOk,
	rankedTiming: {
		openingMs: () => KLONDIKE_ENTRANCE_MS,
		minimumSeconds: () => 60
	},
	ending,
	replay(seed, moves, seconds, values, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		const parsedMoves = moves.map((m) => this.parseMove(m));
		return replayKlondike(seed, parsedMoves, seconds, values, variant);
	}
} satisfies PuzzleManifest;
