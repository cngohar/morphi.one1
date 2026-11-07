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
	isWild?: boolean;
	isHazard?: boolean;
	zebra?: 'light' | 'dark';
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
	'memory:collapse',
	'memory:countdown',
	'memory:three-strikes',
	'memory:wild-card',
	'memory:sonar',
	'memory:zebra',
	'memory:drift',
	'memory:decay',
	'memory:one-flip',
	'memory:combo',
	'memory:hazard'
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

export type MemoryStatus = 'playing' | 'won' | 'lost';

export interface MemoryRound {
	seed: string;
	variant?: MemoryVariant;
	/** Only moving, swaps and hazard rounds persist the number of actual logic-stream draws. */
	rngDraws?: number;
	/** Lockout only: the card that cannot be flipped on the next completed attempt. */
	lock?: number | null;
	/** Swaps only: the two positions exchanged by the last miss, until the next accepted flip. */
	marked?: number[];
	/** Collapse only: cards already removed from `cards`. */
	cleared?: number;
	/** Three strikes only: remaining lives (out of 3). */
	lives?: number;
	/** Combo only: current streak multiplier. */
	combo?: number;
	/** Decay only: mapping of seen card index -> attempts remaining. */
	decay?: Record<number, number>;
	/** Sonar only: orthogonally adjacent card indices to pulse. */
	sonar?: number[];
	/** Countdown only: total allowed seconds (60, 80, 100). */
	timeLimit?: number;
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
	if (
		selectedVariant === 'memory:moving' ||
		selectedVariant === 'memory:swaps' ||
		selectedVariant === 'memory:hazard'
	) {
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
				...(selectedVariant === 'memory:two-backs' ? { back: copy as 0 | 1 } : {}),
				...(selectedVariant === 'memory:zebra'
					? { zebra: (copy === 0 ? 'light' : 'dark') as 'light' | 'dark' }
					: {})
			});

	if (selectedVariant === 'memory:wild-card') {
		const lastSymbol = selected[selected.length - 1];
		const wildCard = deck.find((c) => c.id === `${lastSymbol.id}:1`);
		if (wildCard) {
			wildCard.isWild = true;
			wildCard.color = '#f59e0b';
		}
	} else if (selectedVariant === 'memory:hazard') {
		const lastSymbol = selected[selected.length - 1];
		for (const card of deck) {
			if (card.symbol === lastSymbol.id) {
				card.isHazard = true;
				card.color = '#ef4444';
			}
		}
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
	if (
		selectedVariant === 'memory:moving' ||
		selectedVariant === 'memory:swaps' ||
		selectedVariant === 'memory:hazard'
	)
		round.rngDraws = rngDraws;
	if (selectedVariant === 'memory:lockout') round.lock = null;
	if (selectedVariant === 'memory:swaps') round.marked = [];
	if (selectedVariant === 'memory:collapse') round.cleared = 0;
	if (selectedVariant === 'memory:countdown')
		round.timeLimit = pairs === 10 ? 100 : pairs === 8 ? 80 : 60;
	if (selectedVariant === 'memory:three-strikes') round.lives = 3;
	if (selectedVariant === 'memory:combo') round.combo = 1;
	if (selectedVariant === 'memory:decay') round.decay = {};
	if (selectedVariant === 'memory:sonar') round.sonar = [];
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

function driftRow(round: MemoryRound, cardIndex: number): MemoryRound {
	const cols = 4;
	const row = Math.floor(cardIndex / cols);
	const rowStart = row * cols;
	if (rowStart + cols > round.cards.length) return round;
	const cards = round.cards.slice();
	const last = cards[rowStart + cols - 1];
	for (let c = cols - 1; c > 0; c--) {
		cards[rowStart + c] = cards[rowStart + c - 1];
	}
	cards[rowStart] = last;
	return { ...round, cards };
}

function updateDecay(round: MemoryRound, revealedIndices: number[]): MemoryRound {
	const decay = { ...(round.decay ?? {}) };
	revealedIndices.forEach((pos) => {
		decay[pos] = 3;
	});
	for (const key of Object.keys(decay)) {
		const pos = Number(key);
		decay[pos] -= 1;
		if (decay[pos] <= 0) {
			delete decay[pos];
		}
	}
	return { ...round, decay };
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

	const variant = memoryVariant(round);

	// Single-flip continuity
	if (variant === 'memory:one-flip') {
		const base = round.marked?.length ? { ...round, marked: [] } : round;
		if (round.revealed.length === 1) {
			const prevIdx = round.revealed[0];
			const prevCard = round.cards[prevIdx];
			const moves = round.moves + 1;
			if (prevCard && (prevCard.symbol === card.symbol || prevCard.isWild || card.isWild)) {
				const matched = [...round.matched, prevIdx, index].sort((a, b) => a - b);
				const won = matched.length === round.cards.length;
				return {
					round: {
						...base,
						revealed: [],
						matched,
						moves,
						status: won ? 'won' : 'playing'
					},
					effect: won ? 'win' : 'match'
				};
			} else {
				return {
					round: {
						...base,
						revealed: [index],
						mismatches: round.mismatches + 1,
						moves
					},
					effect: 'mismatch'
				};
			}
		}
		return {
			round: { ...base, revealed: [index] },
			effect: 'flip'
		};
	}

	const revealed = [...round.revealed, index];
	// Any accepted flip ends the marked-swap highlight and clears sonar flash.
	const base =
		round.marked?.length || round.sonar?.length ? { ...round, marked: [], sonar: [] } : round;

	if (revealed.length < matchSize) {
		return {
			round: { ...base, revealed },
			effect: 'flip'
		};
	}

	const moves = round.moves + 1;

	const first = round.cards[revealed[0]];
	if (!first) return { round, effect: 'ignored' };

	const isMatch =
		card.isWild || first.isWild
			? true
			: variant === 'memory:zebra'
				? card.symbol === first.symbol && card.zebra !== first.zebra
				: revealed.every((position) => round.cards[position]?.symbol === first.symbol);

	if (isMatch) {
		const collapse = variant === 'memory:collapse';
		const matched = collapse ? [] : [...round.matched, ...revealed].sort((a, b) => a - b);
		const cards = collapse
			? round.cards.filter((_, position) => !revealed.includes(position))
			: round.cards;
		const won = collapse ? cards.length === 0 : matched.length === cards.length;
		const combo = variant === 'memory:combo' ? (round.combo ?? 1) + 1 : round.combo;

		let sonar: number[] | undefined;
		if (variant === 'memory:sonar') {
			const cols = 4;
			sonar = revealed
				.flatMap((pos) => {
					const r = Math.floor(pos / cols);
					const c = pos % cols;
					const neighbors: number[] = [];
					if (r > 0) neighbors.push(pos - cols);
					if (r < Math.floor(round.cards.length / cols) - 1) neighbors.push(pos + cols);
					if (c > 0) neighbors.push(pos - 1);
					if (c < cols - 1) neighbors.push(pos + 1);
					return neighbors;
				})
				.filter((pos) => !matched.includes(pos) && !revealed.includes(pos));
		}

		return {
			round: {
				...base,
				cards,
				revealed: [],
				matched,
				moves,
				status: won ? 'won' : 'playing',
				...(collapse ? { cleared: round.cleared! + matchSize } : {}),
				...(variant === 'memory:lockout' ? { lock: null } : {}),
				...(combo !== undefined ? { combo } : {}),
				...(sonar ? { sonar } : {})
			},
			effect: won ? 'win' : 'match'
		};
	}

	const mismatched: MemoryRound = {
		...base,
		revealed,
		mismatches: round.mismatches + 1,
		moves,
		...(variant === 'memory:combo' ? { combo: 1 } : {})
	};

	if (variant === 'memory:three-strikes') {
		const lives = (round.lives ?? 3) - 1;
		mismatched.lives = lives;
		if (lives <= 0) mismatched.status = 'lost';
	}

	// Lock the last card only while two other unmatched cards keep a legal attempt open.
	if (variant === 'memory:lockout')
		mismatched.lock =
			round.cards.length - round.matched.length - 1 >= 2 ? revealed[matchSize - 1] : null;

	const isHazardMismatch = variant === 'memory:hazard' && (card.isHazard || first.isHazard);
	return {
		round:
			variant === 'memory:moving' || isHazardMismatch ? moveFaceDownCards(mismatched) : mismatched,
		effect: 'mismatch'
	};
}

export function resolveMismatch(round: MemoryRound): MemoryRound {
	if (round.revealed.length !== cardsPerMatch(round)) {
		return round;
	}

	const hidden = { ...round, revealed: [] };
	const variant = memoryVariant(round);
	if (variant === 'memory:swaps') return swapHiddenCards(hidden);
	if (variant === 'memory:drift') return driftRow(hidden, round.revealed[0]);
	if (variant === 'memory:decay') return updateDecay(hidden, round.revealed);
	return hidden;
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
	if (round.variant === 'memory:countdown' && elapsedSeconds > (round.timeLimit ?? 60)) {
		return 0;
	}

	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}
