import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring as scoringDefinition, triosScoring } from './scoring.js';
import { createRng, shuffle } from '#lib/engine/rng.js';
import { SYMBOLS, type SymbolId } from '#lib/puzzles/memory/symbols.js';

export const PAIR_COUNTS = [6, 8, 10] as const;
export type PairCount = (typeof PAIR_COUNTS)[number];

export interface MemoryCard {
	id: string;
	symbol: SymbolId;
	color: string;
}

export const MEMORY_VARIANTS = [
	'memory:classic',
	'memory:no-preview',
	'memory:trios',
	'memory:moving'
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
	return memoryVariant(round) === 'memory:trios' ? 3 : 2;
}

export function memoryMoveLimit(round: MemoryRound): number {
	return round.pairs * cardsPerMatch(round) * 6;
}

export function memoryCapReached(round: MemoryRound): boolean {
	return (
		memoryVariant(round) === 'memory:trios' &&
		round.status !== 'won' &&
		round.moves * 3 + (round.revealed.length < 3 ? round.revealed.length : 0) >=
			memoryMoveLimit(round)
	);
}

export type MemoryStatus = 'playing' | 'won';

export interface MemoryRound {
	seed: string;
	variant?: MemoryVariant;
	/** Only moving rounds persist the number of actual logic-stream draws. */
	rngDraws?: number;
	pairs: PairCount;
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
	if (selectedVariant === 'memory:moving') {
		const nextU64 = rng.nextU64;
		rng.nextU64 = () => {
			rngDraws += 1;
			return nextU64();
		};
	}
	const pairs = PAIR_COUNTS[rng.nextInt(PAIR_COUNTS.length)] ?? 6;
	const selected = shuffle(rng, SYMBOLS).slice(0, pairs);
	const deck: MemoryCard[] = [];

	for (const symbol of selected) {
		deck.push({ id: `${symbol.id}:0`, symbol: symbol.id, color: symbol.color });
		deck.push({ id: `${symbol.id}:1`, symbol: symbol.id, color: symbol.color });
		if (selectedVariant === 'memory:trios')
			deck.push({ id: `${symbol.id}:2`, symbol: symbol.id, color: symbol.color });
	}

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
	if (selectedVariant === 'memory:moving') round.rngDraws = rngDraws;
	return round;
}

function moveFaceDownCards(round: MemoryRound): MemoryRound {
	const rng = createRng(round.seed);
	let rngDraws = round.rngDraws!;
	for (let draw = 0; draw < rngDraws; draw += 1) rng.nextU64();
	const nextU64 = rng.nextU64;
	rng.nextU64 = () => {
		rngDraws += 1;
		return nextU64();
	};
	const positions = round.cards.map((_, index) => index).filter((index) => !isFaceUp(round, index));
	const shuffled = shuffle(
		rng,
		positions.map((index) => round.cards[index])
	);
	const cards = round.cards.slice();
	positions.forEach((index, offset) => {
		cards[index] = shuffled[offset];
	});
	return { ...round, cards, rngDraws };
}

export function flipCard(round: MemoryRound, index: number): FlipResult {
	const matchSize = cardsPerMatch(round);
	if (round.status !== 'playing' || round.revealed.length >= matchSize || memoryCapReached(round)) {
		return { round, effect: 'ignored' };
	}

	if (round.matched.includes(index) || round.revealed.includes(index)) {
		return { round, effect: 'ignored' };
	}

	const card = round.cards[index];
	if (!card) {
		return { round, effect: 'ignored' };
	}

	const revealed = [...round.revealed, index];

	if (revealed.length < matchSize) {
		return {
			round: { ...round, revealed },
			effect: 'flip'
		};
	}

	const moves = round.moves + 1;

	const first = round.cards[revealed[0]];
	if (!first) return { round, effect: 'ignored' };

	if (revealed.every((position) => round.cards[position]?.symbol === first.symbol)) {
		const matched = [...round.matched, ...revealed].sort((a, b) => a - b);
		const won = matched.length === round.cards.length;

		return {
			round: {
				...round,
				revealed: [],
				matched,
				moves,
				status: won ? 'won' : 'playing'
			},
			effect: won ? 'win' : 'match'
		};
	}

	const mismatched = {
		...round,
		revealed,
		mismatches: round.mismatches + 1,
		moves
	};
	return {
		round: memoryVariant(round) === 'memory:moving' ? moveFaceDownCards(mismatched) : mismatched,
		effect: 'mismatch'
	};
}

export function resolveMismatch(round: MemoryRound): MemoryRound {
	if (round.revealed.length !== cardsPerMatch(round)) {
		return round;
	}

	return { ...round, revealed: [] };
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
		pairs * (scoring.pair ?? scoring.trio)! -
			mismatches * scoring.mismatch! -
			seconds * scoring.second!
	);
}

export function currentScore(
	round: MemoryRound,
	elapsedSeconds: number,
	scoring: ScoreValues = memoryVariant(round) === 'memory:trios'
		? triosScoring.defaults
		: scoringDefinition.defaults
): number {
	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}

export function scoreRound(
	round: MemoryRound,
	elapsedSeconds: number,
	scoring: ScoreValues = memoryVariant(round) === 'memory:trios'
		? triosScoring.defaults
		: scoringDefinition.defaults
): number {
	if (round.status !== 'won') {
		return 0;
	}

	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}
