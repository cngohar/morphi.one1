import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring as scoringDefinition, triosScoring, quadsScoring } from './scoring.js';
import { createRng, shuffle } from '#lib/engine/rng.js';
import { SYMBOLS, type SymbolId } from '#lib/puzzles/memory/symbols.js';

export const PAIR_COUNTS = [6, 8, 10] as const;
export type PairCount = (typeof PAIR_COUNTS)[number];
export const QUAD_COUNTS = [4, 5, 6] as const;

export interface MemoryCard {
	id: string;
	symbol: SymbolId;
	color: string;
	/** Two-backs only: 0 is dotted, 1 is striped; a partner always has the other. */
	back?: 0 | 1;
}

export const MEMORY_VARIANTS = [
	'memory:classic',
	'memory:no-preview',
	'memory:trios',
	'memory:moving',
	'memory:budget',
	'memory:lockout',
	'memory:swaps',
	'memory:two-backs',
	'memory:quads',
	'memory:collapse'
] as const;
export type MemoryVariant = (typeof MEMORY_VARIANTS)[number];

export function memoryVariant(round: { variant?: string }): MemoryVariant {
	return parseMemoryVariant(round.variant);
}

export function parseMemoryVariant(variant?: string): MemoryVariant {
	if (variant === undefined) return 'memory:classic';
	if (!MEMORY_VARIANTS.includes(variant as MemoryVariant)) throw new RangeError('variant');
	return variant as MemoryVariant;
}

export function memoryVariantName(variant?: string): `variant.${MemoryVariant}` {
	return `variant.${parseMemoryVariant(variant)}`;
}

export function cardsPerMatch(round: { variant?: string }): number {
	const variant = memoryVariant(round);
	return variant === 'memory:quads' ? 4 : variant === 'memory:trios' ? 3 : 2;
}

/** Attempts allowed per group: budget is strict, everything else keeps six. */
export function memoryMoveLimit(round: MemoryRound): number {
	return round.pairs * cardsPerMatch(round) * (memoryVariant(round) === 'memory:budget' ? 2 : 6);
}

/** Trios, quads and budget stop accepting flips at their attempt cap; a final-attempt win still counts. */
export function memoryCapReached(round: MemoryRound): boolean {
	const size = cardsPerMatch(round);
	return (
		['memory:trios', 'memory:quads', 'memory:budget'].includes(memoryVariant(round)) &&
		round.status !== 'won' &&
		round.moves * size + (round.revealed.length < size ? round.revealed.length : 0) >=
			memoryMoveLimit(round)
	);
}

export type MemoryStatus = 'playing' | 'won';

export interface MemoryRound {
	seed: string;
	variant?: MemoryVariant;
	/** Only moving and swaps rounds persist the number of actual logic-stream draws. */
	rngDraws?: number;
	/** Lockout only: the card that cannot be flipped on the next completed attempt. */
	lock?: number | null;
	/** Swaps only: the two positions exchanged by the last miss, until the next accepted flip. */
	marked?: number[];
	/** Collapse only: cards already removed from `cards`. */
	cleared?: number;
	/** Group count: pairs (6/8/10), trios (6/8/10) or quads (4/5/6). */
	pairs: number;
	cards: MemoryCard[];
	revealed: number[];
	matched: number[];
	mismatches: number;
	moves: number;
	status: MemoryStatus;
}

export type FlipEffect = 'ignored' | 'flip' | 'match' | 'mismatch' | 'win';

export interface FlipResult {
	round: MemoryRound;
	effect: FlipEffect;
}

export function createMemoryRound(seed: string, variant?: string): MemoryRound {
	const selectedVariant = parseMemoryVariant(variant);
	const rng = createRng(seed);
	let rngDraws = 0;
	if (selectedVariant === 'memory:moving' || selectedVariant === 'memory:swaps') {
		const nextU64 = rng.nextU64;
		rng.nextU64 = () => {
			rngDraws += 1;
			return nextU64();
		};
	}
	const counts = selectedVariant === 'memory:quads' ? QUAD_COUNTS : PAIR_COUNTS;
	const pairs = counts[rng.nextInt(counts.length)] ?? 6;
	const selected = shuffle(rng, SYMBOLS).slice(0, pairs);
	const deck: MemoryCard[] = [];
	const size = cardsPerMatch({ variant: selectedVariant });

	for (const symbol of selected)
		for (let copy = 0; copy < size; copy += 1)
			deck.push({
				id: `${symbol.id}:${copy}`,
				symbol: symbol.id,
				color: symbol.color,
				...(selectedVariant === 'memory:two-backs' ? { back: copy as 0 | 1 } : {})
			});

	const round: MemoryRound = {
		seed,
		pairs,
		cards: shuffle(rng, deck),
		revealed: [],
		matched: [],
		mismatches: 0,
		moves: 0,
		status: 'playing'
	};
	if (selectedVariant !== 'memory:classic') round.variant = selectedVariant;
	if (selectedVariant === 'memory:moving' || selectedVariant === 'memory:swaps')
		round.rngDraws = rngDraws;
	if (selectedVariant === 'memory:lockout') round.lock = null;
	if (selectedVariant === 'memory:swaps') round.marked = [];
	if (selectedVariant === 'memory:collapse') round.cleared = 0;
	return round;
}

/** Continues the logic stream after every draw already made, counting new ones. */
function continueStream(round: MemoryRound) {
	const rng = createRng(round.seed);
	let draws = round.rngDraws!;
	for (let draw = 0; draw < draws; draw += 1) rng.nextU64();
	const nextU64 = rng.nextU64;
	rng.nextU64 = () => {
		draws += 1;
		return nextU64();
	};
	return { rng, draws: () => draws };
}

function swapHiddenCards(round: MemoryRound): MemoryRound {
	const eligible = round.cards.map((_, index) => index).filter((index) => !isFaceUp(round, index));
	// A deterministic no-op (no draw) when fewer than two cards can swap.
	if (eligible.length < 2) return round;
	const { rng, draws } = continueStream(round);
	const first = rng.nextInt(eligible.length);
	let second = rng.nextInt(eligible.length - 1);
	if (second >= first) second += 1;
	const cards = round.cards.slice();
	[cards[eligible[first]], cards[eligible[second]]] = [
		cards[eligible[second]],
		cards[eligible[first]]
	];
	return {
		...round,
		cards,
		marked: [eligible[first], eligible[second]].sort((a, b) => a - b),
		rngDraws: draws()
	};
}

function moveFaceDownCards(round: MemoryRound): MemoryRound {
	const { rng, draws } = continueStream(round);
	const positions = round.cards.map((_, index) => index).filter((index) => !isFaceUp(round, index));
	const shuffled = shuffle(
		rng,
		positions.map((index) => round.cards[index])
	);
	const cards = round.cards.slice();
	positions.forEach((index, offset) => {
		cards[index] = shuffled[offset];
	});
	return { ...round, cards, rngDraws: draws() };
}

export function flipCard(round: MemoryRound, index: number): FlipResult {
	const matchSize = cardsPerMatch(round);
	if (round.status !== 'playing' || round.revealed.length >= matchSize || memoryCapReached(round)) {
		return { round, effect: 'ignored' };
	}

	if (round.matched.includes(index) || round.revealed.includes(index) || index === round.lock) {
		return { round, effect: 'ignored' };
	}

	const card = round.cards[index];
	if (!card) {
		return { round, effect: 'ignored' };
	}

	const revealed = [...round.revealed, index];
	// Any accepted flip ends the marked-swap highlight.
	const base = round.marked?.length ? { ...round, marked: [] } : round;

	if (revealed.length < matchSize) {
		return {
			round: { ...base, revealed },
			effect: 'flip'
		};
	}

	const moves = round.moves + 1;

	const first = round.cards[revealed[0]];
	if (!first) return { round, effect: 'ignored' };

	const variant = memoryVariant(round);
	if (revealed.every((position) => round.cards[position]?.symbol === first.symbol)) {
		const collapse = variant === 'memory:collapse';
		const matched = collapse ? [] : [...round.matched, ...revealed].sort((a, b) => a - b);
		const cards = collapse
			? round.cards.filter((_, position) => !revealed.includes(position))
			: round.cards;
		const won = collapse ? cards.length === 0 : matched.length === cards.length;

		return {
			round: {
				...base,
				cards,
				revealed: [],
				matched,
				moves,
				status: won ? 'won' : 'playing',
				...(collapse ? { cleared: round.cleared! + matchSize } : {}),
				...(variant === 'memory:lockout' ? { lock: null } : {})
			},
			effect: won ? 'win' : 'match'
		};
	}

	const mismatched: MemoryRound = {
		...base,
		revealed,
		mismatches: round.mismatches + 1,
		moves
	};
	// Lock the last card only while two other unmatched cards keep a legal attempt open.
	if (variant === 'memory:lockout')
		mismatched.lock =
			round.cards.length - round.matched.length - 1 >= 2 ? revealed[matchSize - 1] : null;
	return {
		round: variant === 'memory:moving' ? moveFaceDownCards(mismatched) : mismatched,
		effect: 'mismatch'
	};
}

export function resolveMismatch(round: MemoryRound): MemoryRound {
	if (round.revealed.length !== cardsPerMatch(round)) {
		return round;
	}

	const hidden = { ...round, revealed: [] };
	return memoryVariant(round) === 'memory:swaps' ? swapHiddenCards(hidden) : hidden;
}

/** Cards matched so far, including collapsed ones that left the board. */
export function matchedCount(round: MemoryRound): number {
	return round.matched.length + (round.cleared ?? 0);
}

export function isFaceUp(round: MemoryRound, index: number): boolean {
	return round.matched.includes(index) || round.revealed.includes(index);
}

export function scoreFor(
	pairs: number,
	mismatches: number,
	elapsedSeconds: number,
	scoring: ScoreValues = scoringDefinition.defaults
): number {
	const seconds = Math.max(0, Math.floor(elapsedSeconds));
	return Math.max(
		0,
		pairs * (scoring.pair ?? scoring.trio ?? scoring.quad)! -
			mismatches * scoring.mismatch! -
			seconds * scoring.second!
	);
}

function defaultScoring(round: MemoryRound): ScoreValues {
	const variant = memoryVariant(round);
	return variant === 'memory:trios'
		? triosScoring.defaults
		: variant === 'memory:quads'
			? quadsScoring.defaults
			: scoringDefinition.defaults;
}

export function currentScore(
	round: MemoryRound,
	elapsedSeconds: number,
	scoring: ScoreValues = defaultScoring(round)
): number {
	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}

export function scoreRound(
	round: MemoryRound,
	elapsedSeconds: number,
	scoring: ScoreValues = defaultScoring(round)
): number {
	if (round.status !== 'won') {
		return 0;
	}

	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}
