import { messages } from './messages.js';
import { memoryDimensions, memoryArchetypes, memoryPolicyVariants } from './dimensions.js';
import type { PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring, triosScoring, quadsScoring } from './scoring.js';
import { memoryOpeningMs } from '#lib/round-timing.js';
import {
	PAIR_COUNTS,
	QUAD_COUNTS,
	cardsPerMatch,
	createMemoryRound,
	flipCard,
	memoryMoveLimit,
	memoryVariant,
	parseMemoryVariant,
	resolveMismatch,
	scoreRound
} from './logic.js';

const pairHelp = {
	steps: ['v1.game.memory.step1', 'v1.game.memory.step2', 'v1.game.memory.step3'],
	rows: [
		{ label: 'v1.game.memory.row1', field: 'pair', sign: '+' },
		{ label: 'v1.game.memory.row2', field: 'mismatch', sign: '−' },
		{ label: 'v1.game.memory.row3', field: 'second', sign: '−' },
		{ label: 'v1.game.memory.row4', value: 'v1.game.memory.value4' }
	],
	note: 'v1.game.memory.scoringNote',
	tips: 'v1.game.memory.tips'
} satisfies PuzzlePresentation['help'];

/** Leaderboard groups for one variant suffix; every identity keeps its own cohorts. */
const groupIds = (suffix: string, counts: readonly number[]) =>
	counts.map((count) => `memory-1:${suffix}:${count}`);
const NEW_PAIR_SUFFIXES = ['budget', 'lockout', 'swaps', 'two-backs', 'collapse'] as const;
const NEW_GROUPS = [
	...NEW_PAIR_SUFFIXES.flatMap((suffix) => groupIds(suffix, PAIR_COUNTS)),
	...groupIds('quads', QUAD_COUNTS)
];
const newGroupLabels = Object.fromEntries(
	NEW_GROUPS.map((group) => [
		group,
		`leaderboard.memory.${group.slice('memory-1:'.length).replace(/:(\d+)$/, '.$1')}`
	])
);
const pairVariant = (
	suffix: (typeof NEW_PAIR_SUFFIXES)[number],
	maxMoves: number,
	help: Partial<PuzzlePresentation['help']>
) => ({
	id: `memory:${suffix}`,
	name: `variant.memory:${suffix}`,
	weight: 1,
	maxMoves,
	leaderboardGroups: groupIds(suffix, PAIR_COUNTS),
	help: { ...pairHelp, ...help }
});

export const manifest = {
	id: 'memory',
	dimensionPolicy: {
		dimensions: memoryDimensions,
		archetypes: memoryArchetypes,
		variants: memoryPolicyVariants
	},
	presentation: {
		name: 'v1.game.memory',
		scoringLabels: {
			pair: 'scoring.memory.pair',
			trio: 'scoring.memory.trio',
			quad: 'scoring.memory.quad',
			mismatch: 'scoring.memory.mismatch',
			second: 'scoring.memory.second'
		},
		groups: {
			'memory-1:6': 'leaderboard.memory6',
			'memory-1:8': 'leaderboard.memory8',
			'memory-1:10': 'leaderboard.memory10',
			'memory-1:no-preview:6': 'leaderboard.memory.no-preview.6',
			'memory-1:no-preview:8': 'leaderboard.memory.no-preview.8',
			'memory-1:no-preview:10': 'leaderboard.memory.no-preview.10',
			'memory-1:trios:6': 'leaderboard.memory.trios.6',
			'memory-1:trios:8': 'leaderboard.memory.trios.8',
			'memory-1:trios:10': 'leaderboard.memory.trios.10',
			'memory-1:moving:6': 'leaderboard.memory.moving.6',
			'memory-1:moving:8': 'leaderboard.memory.moving.8',
			'memory-1:moving:10': 'leaderboard.memory.moving.10',
			...newGroupLabels
		},
		help: pairHelp,
		backdrop: {
			items: [
				{ id: 'card', path: 'M17 5H43Q48 5 48 10V50Q48 55 43 55H17Q12 55 12 50V10Q12 5 17 5Z' }
			],
			fill: 'solid',
			symbol: true
		},
		profileIcon: { color: 'var(--accent)', rotation: 8 }
	},
	selectionOrder: 1,
	orientation: 'any',
	engineVersion: 'memory-1',
	scoring,
	variants: [
		{
			id: 'memory:classic',
			name: 'variant.memory:classic',
			weight: 1,
			maxMoves: 120,
			leaderboardGroups: ['memory-1:6', 'memory-1:8', 'memory-1:10']
		},
		{
			id: 'memory:no-preview',
			name: 'variant.memory:no-preview',
			weight: 1,
			maxMoves: 120,
			leaderboardGroups: [
				'memory-1:no-preview:6',
				'memory-1:no-preview:8',
				'memory-1:no-preview:10'
			],
			help: {
				...pairHelp,
				steps: ['v1.game.memory.step1', 'v1.game.memory.step2', 'memory.noPreview.step3'],
				note: 'memory.noPreview.scoringNote',
				tips: 'memory.noPreview.tips'
			}
		},
		{
			id: 'memory:trios',
			name: 'variant.memory:trios',
			weight: 1,
			maxMoves: 180,
			leaderboardGroups: ['memory-1:trios:6', 'memory-1:trios:8', 'memory-1:trios:10'],
			scoring: triosScoring,
			help: {
				steps: ['memory.trios.step1', 'memory.trios.step2', 'memory.trios.step3'],
				rows: [
					{ label: 'memory.trios.row1', field: 'trio', sign: '+' },
					{ label: 'v1.game.memory.row2', field: 'mismatch', sign: '−' },
					{ label: 'v1.game.memory.row3', field: 'second', sign: '−' },
					{ label: 'v1.game.memory.row4', value: 'v1.game.memory.value4' }
				],
				note: 'v1.game.memory.scoringNote',
				tips: 'memory.trios.tips'
			},
			ending: {
				kind: 'completion',
				headlines: { default: 'ending.memory.trios.headline' },
				subline: { key: 'ending.memory.trios.subline', values: ['pairs', 'time'] },
				animation: 'fade-rise',
				continue: 'auto_500ms',
				condition: 'All trios have been matched.'
			}
		},
		{
			id: 'memory:moving',
			name: 'variant.memory:moving',
			weight: 1,
			maxMoves: 120,
			leaderboardGroups: ['memory-1:moving:6', 'memory-1:moving:8', 'memory-1:moving:10'],
			help: {
				...pairHelp,
				steps: ['v1.game.memory.step1', 'memory.moving.step2', 'v1.game.memory.step3'],
				tips: 'memory.moving.tips'
			}
		},
		pairVariant('budget', 40, {
			steps: ['v1.game.memory.step1', 'memory.budget.step2', 'memory.budget.step3'],
			tips: 'memory.budget.tips'
		}),
		pairVariant('lockout', 120, {
			steps: ['v1.game.memory.step1', 'memory.lockout.step2', 'v1.game.memory.step3'],
			tips: 'memory.lockout.tips'
		}),
		pairVariant('swaps', 120, {
			steps: ['v1.game.memory.step1', 'memory.swaps.step2', 'v1.game.memory.step3'],
			tips: 'memory.swaps.tips'
		}),
		pairVariant('two-backs', 120, {
			steps: ['v1.game.memory.step1', 'memory.twoBacks.step2', 'v1.game.memory.step3'],
			tips: 'memory.twoBacks.tips'
		}),
		{
			id: 'memory:quads',
			name: 'variant.memory:quads',
			weight: 1,
			maxMoves: 144,
			leaderboardGroups: groupIds('quads', QUAD_COUNTS),
			scoring: quadsScoring,
			help: {
				steps: ['memory.quads.step1', 'memory.quads.step2', 'memory.quads.step3'],
				rows: [
					{ label: 'memory.quads.row1', field: 'quad', sign: '+' },
					{ label: 'v1.game.memory.row2', field: 'mismatch', sign: '−' },
					{ label: 'v1.game.memory.row3', field: 'second', sign: '−' },
					{ label: 'v1.game.memory.row4', value: 'v1.game.memory.value4' }
				],
				note: 'v1.game.memory.scoringNote',
				tips: 'memory.quads.tips'
			},
			ending: {
				kind: 'completion',
				headlines: { default: 'ending.memory.quads.headline' },
				subline: { key: 'ending.memory.quads.subline', values: ['pairs', 'time'] },
				animation: 'fade-rise',
				continue: 'auto_500ms',
				condition: 'All quads have been matched.'
			}
		},
		pairVariant('collapse', 120, {
			steps: ['v1.game.memory.step1', 'memory.collapse.step2', 'v1.game.memory.step3'],
			tips: 'memory.collapse.tips'
		})
	],
	maxMoves: 180,
	parseMove(move) {
		if (Object.keys(move).sort().join(',') !== 'index') throw new RangeError('move');
		return { index: move.index };
	},
	leaderboardGroups: [
		'memory-1:6',
		'memory-1:8',
		'memory-1:10',
		'memory-1:no-preview:6',
		'memory-1:no-preview:8',
		'memory-1:no-preview:10',
		'memory-1:trios:6',
		'memory-1:trios:8',
		'memory-1:trios:10',
		'memory-1:moving:6',
		'memory-1:moving:8',
		'memory-1:moving:10',
		...NEW_GROUPS
	],
	rankedTiming: {
		openingMs: (result, variant?: string) =>
			parseMemoryVariant(variant) === 'memory:no-preview' ? 0 : memoryOpeningMs(result.pairs!),
		minimumSeconds: (result, variant?: string) =>
			result.pairs! *
			(({ 'memory:trios': 0.6, 'memory:quads': 0.8 } as Record<string, number>)[
				parseMemoryVariant(variant)
			] ?? 0.4)
	},
	messages,
	createRound: createMemoryRound,
	resumeRound(seed, moves, _scoring?: ScoreValues, variant?: string) {
		let round = createMemoryRound(seed, variant);
		if (moves.length > memoryMoveLimit(round)) throw new RangeError('move_limit');
		for (const move of moves) {
			if (round.revealed.length === cardsPerMatch(round)) round = resolveMismatch(round);
			if (Object.keys(move).join(',') !== 'index' || !Number.isInteger(move.index))
				throw new RangeError('move');
			const next = flipCard(round, move.index!);
			if (next.effect === 'ignored') throw new RangeError('move');
			round = next.round;
		}
		return round;
	},
	ending: {
		kind: 'completion',
		headlines: { default: 'ending.memory.headline' },
		subline: { key: 'ending.memory.subline', values: ['pairs', 'time'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition: 'All pairs have been matched.'
	},
	replay(seed, moves, seconds, scoring?: ScoreValues, variant?: string) {
		let round = createMemoryRound(seed, variant);
		if (moves.length > memoryMoveLimit(round)) throw new RangeError('move_limit');
		for (const move of moves) {
			if (Object.keys(move).length !== 1 || !Number.isInteger(move.index))
				throw new RangeError('move');
			const result = flipCard(round, move.index!);
			if (result.effect === 'ignored') throw new RangeError('move');
			round = result.effect === 'mismatch' ? resolveMismatch(result.round) : result.round;
		}
		if (round.status !== 'won') throw new RangeError('incomplete');
		return {
			score: scoreRound(round, seconds, scoring),
			group:
				memoryVariant(round) === 'memory:classic'
					? `memory-1:${round.pairs}`
					: `memory-1:${memoryVariant(round).slice('memory:'.length)}:${round.pairs}`,
			pairs: round.pairs,
			moves: round.moves
		};
	}
} satisfies PuzzleManifest;
