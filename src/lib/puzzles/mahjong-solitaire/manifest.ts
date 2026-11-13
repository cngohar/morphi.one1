import type { PuzzleManifest, PuzzlePresentation, ReplayedResult } from '#lib/engine/contract.js';
import { MAHJONG_ENTRANCE_MS } from '#lib/round-timing.js';
import { messages } from './messages.js';
import { scoring } from './scoring.js';
import {
	applyMahjongMove,
	createMahjongRound,
	mahjongScore,
	MAHJONG_ENGINE_VERSION,
	MAHJONG_MAX_MOVES,
	MAHJONG_VARIANTS,
	type MahjongMove
} from './logic.js';

const help = {
	steps: ['mahjong.step1', 'mahjong.step2', 'mahjong.step3'],
	rows: ['completion', 'pair', 'second', 'hint', 'shuffle'].map((field) => ({
		label: `scoring.mahjong.${field}`,
		field,
		sign: field === 'hint' || field === 'shuffle' ? ('−' as const) : ('+' as const)
	})),
	note: 'mahjong.note',
	tips: 'mahjong.tips'
} satisfies PuzzlePresentation['help'];

const ending = {
	kind: 'completion',
	headlines: { default: 'ending.mahjong.headline' },
	subline: { key: 'ending.mahjong.subline', values: ['pairs', 'elapsed'] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition: 'Legal matching removals leave no tiles on the board.'
} satisfies PuzzleManifest['ending'];

export const manifest = {
	id: 'mahjong-solitaire',
	selectionOrder: 4,
	enabled: true,
	orientation: 'any',
	titleAfterEntrance: true,
	engineVersion: MAHJONG_ENGINE_VERSION,
	maxMoves: MAHJONG_MAX_MOVES,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.mahjong-solitaire',
		scoringLabels: Object.fromEntries(
			scoring.fields.map((field) => [field, `scoring.mahjong.${field}`])
		),
		groups: {},
		help,
		backdrop: {
			items: [
				{ id: 'tile-pair', path: 'M6 8h22v40H6ZM32 16h22v40H32ZM12 18h10v20H12ZM38 26h10v20H38Z' }
			],
			fill: 'outline'
		}
	},
	variants: MAHJONG_VARIANTS.map((id) => ({
		id,
		name: `variant.${id}`,
		weight: 1,
		enabled: true,
		maxMoves: MAHJONG_MAX_MOVES,
		scoring,
		help:
			id === 'mahjong-solitaire:classic'
				? help
				: {
						...help,
						steps:
							id === 'mahjong-solitaire:triple-match'
								? ['mahjong.rule.triple-match', help.steps[1], help.steps[2]]
								: [
										help.steps[0],
										help.steps[1],
										`mahjong.rule.${id.slice('mahjong-solitaire:'.length)}`
									],
						rows: [
							...help.rows.map((row) =>
								id === 'mahjong-solitaire:triple-match' && row.field === 'pair'
									? { ...row, field: 'triple', label: 'scoring.mahjong.triple' }
									: row
							),
							...(id === 'mahjong-solitaire:countdown'
								? [{ label: 'scoring.mahjong.countdown', field: 'countdown', sign: '+' as const }]
								: []),
							...(id === 'mahjong-solitaire:three-hearts'
								? [{ label: 'scoring.mahjong.heart', field: 'heart', sign: '+' as const }]
								: [])
						]
					},
		...(id === 'mahjong-solitaire:countdown' ? { maxSeconds: 600 } : {}),
		...([
			'mahjong-solitaire:countdown',
			'mahjong-solitaire:three-hearts',
			'mahjong-solitaire:no-undo',
			'mahjong-solitaire:shuffle-budget'
		].includes(id)
			? {
					ending: {
						...ending,
						kind: 'run_over' as const,
						headlines: { default: 'ending.mahjong.headline', cap: 'ending.mahjong.over' },
						condition:
							'Clear the board; timeout, exhausted hearts or a blocked board without a rescue ends the run with no saved score.'
					}
				}
			: {})
	})),
	parseMove(move) {
		if (!Object.values(move).every(Number.isSafeInteger)) throw new RangeError('move');
		const keys = Object.keys(move).sort().join(',');
		if (keys === 'tileA,tileB') return { tileA: move.tileA, tileB: move.tileB };
		if (keys === 'tileA,tileB,tileC')
			return { tileA: move.tileA, tileB: move.tileB, tileC: move.tileC };
		if (keys === 'tile') return { tile: move.tile };
		if (keys === 'action') return { action: move.action };
		if (keys === 'action,at') return { action: move.action, at: move.at };
		if (keys === 'at,tileA,tileB') return { at: move.at, tileA: move.tileA, tileB: move.tileB };
		throw new RangeError('move');
	},
	createRound: createMahjongRound,
	resumeRound(seed, moves, _scoring, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createMahjongRound(seed, variant);
		for (const move of moves) round = applyMahjongMove(round, this.parseMove(move) as MahjongMove);
		return round;
	},
	rankedTiming: {
		openingMs: () => MAHJONG_ENTRANCE_MS,
		minimumSeconds(result: ReplayedResult) {
			return (result as ReplayedResult & { band: number }).band === 1 ? 2.5 : 10;
		}
	},
	ending,
	replay(seed, moves, seconds, values, variant) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createMahjongRound(seed, variant);
		for (const move of moves) round = applyMahjongMove(round, this.parseMove(move) as MahjongMove);
		if (round.status !== 'won') throw new RangeError('incomplete');
		return {
			score: mahjongScore(round, seconds, values),
			pairs: round.removals,
			moves: round.moves,
			band: round.band
		};
	}
} satisfies PuzzleManifest;
