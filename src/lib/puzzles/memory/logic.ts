import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring as scoringDefinition } from './scoring.js';
import { createRng, shuffle } from '#lib/engine/rng.js';
import { SYMBOLS, type SymbolId } from '#lib/puzzles/memory/symbols.js';

export const PAIR_COUNTS = [6, 8, 10] as const;
export type PairCount = (typeof PAIR_COUNTS)[number];

export interface MemoryCard {
	id: string;
	symbol: SymbolId;
	color: string;
}

export type MemoryStatus = 'playing' | 'won';

export interface MemoryRound {
	seed: string;
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

export function createMemoryRound(seed: string): MemoryRound {
	const rng = createRng(seed);
	const pairs = PAIR_COUNTS[rng.nextInt(PAIR_COUNTS.length)] ?? 6;
	const selected = shuffle(rng, SYMBOLS).slice(0, pairs);
	const deck: MemoryCard[] = [];

	for (const symbol of selected) {
		deck.push({ id: `${symbol.id}:0`, symbol: symbol.id, color: symbol.color });
		deck.push({ id: `${symbol.id}:1`, symbol: symbol.id, color: symbol.color });
	}

	return {
		seed,
		pairs,
		cards: shuffle(rng, deck),
		revealed: [],
		matched: [],
		mismatches: 0,
		moves: 0,
		status: 'playing'
	};
}

export function flipCard(round: MemoryRound, index: number): FlipResult {
	if (round.status !== 'playing' || round.revealed.length >= 2) {
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

	if (revealed.length === 1) {
		return {
			round: { ...round, revealed },
			effect: 'flip'
		};
	}

	const moves = round.moves + 1;

	const firstIndex = revealed[0];
	const secondIndex = revealed[1];
	const first = round.cards[firstIndex];
	const second = round.cards[secondIndex];

	if (!first || !second) {
		return { round, effect: 'ignored' };
	}

	if (first.symbol === second.symbol) {
		const matched = [...round.matched, firstIndex, secondIndex].sort((a, b) => a - b);
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

	return {
		round: {
			...round,
			revealed,
			mismatches: round.mismatches + 1,
			moves
		},
		effect: 'mismatch'
	};
}

export function resolveMismatch(round: MemoryRound): MemoryRound {
	if (round.revealed.length !== 2) {
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
		pairs * scoring.pair! - mismatches * scoring.mismatch! - seconds * scoring.second!
	);
}

export function currentScore(
	round: MemoryRound,
	elapsedSeconds: number,
	scoring: ScoreValues = scoringDefinition.defaults
): number {
	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}

export function scoreRound(
	round: MemoryRound,
	elapsedSeconds: number,
	scoring: ScoreValues = scoringDefinition.defaults
): number {
	if (round.status !== 'won') {
		return 0;
	}

	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}
