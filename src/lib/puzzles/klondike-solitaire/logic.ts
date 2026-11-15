import type { Move, ReplayedResult } from '#lib/engine/contract.js';
import { createRng, shuffle } from '#lib/engine/rng.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring as defaultScoringDef } from './scoring.js';

export const KLONDIKE_ENGINE_VERSION = 'klondike-solitaire-1';

export const KLONDIKE_VARIANTS = [
	'klondike-solitaire:classic',
	'klondike-solitaire:draw-3',
	'klondike-solitaire:pass-3',
	'klondike-solitaire:pass-1',
	'klondike-solitaire:any-card',
	'klondike-solitaire:thoughtful',
	'klondike-solitaire:same-colour',
	'klondike-solitaire:different-suit',
	'klondike-solitaire:no-undo',
	'klondike-solitaire:hint-budget-3',
	'klondike-solitaire:draw-3-pass-3'
] as const;

export type KlondikeVariantId = (typeof KLONDIKE_VARIANTS)[number];

export const KLONDIKE_ACTION = {
	draw: 0,
	move: 1,
	recycle: 2,
	hint: 3,
	undo: 4,
	autoFinish: 5,
	restart: 6
} as const;

export const KLONDIKE_PILE = {
	stock: 0,
	waste: 1,
	foundation0: 2, // spades
	foundation1: 3, // hearts
	foundation2: 4, // diamonds
	foundation3: 5, // clubs
	tableau0: 6,
	tableau1: 7,
	tableau2: 8,
	tableau3: 9,
	tableau4: 10,
	tableau5: 11,
	tableau6: 12
} as const;

export interface KlondikeRules {
	draw: 1 | 3;
	passes: 0 | 1 | 3; // 0 = unlimited passes
	anyCard: boolean;
	thoughtful: boolean;
	build: 0 | 1 | 2; // 0 = alternating colour, 1 = same colour, 2 = different suit
	undo: boolean;
	hintBudget: 0 | 3; // 0 = on demand, 3 = max 3 hints per attempt
}

export function parseRules(variantId?: string): KlondikeRules {
	switch (variantId) {
		case 'klondike-solitaire:draw-3':
			return {
				draw: 3,
				passes: 0,
				anyCard: false,
				thoughtful: false,
				build: 0,
				undo: true,
				hintBudget: 0
			};
		case 'klondike-solitaire:pass-3':
			return {
				draw: 1,
				passes: 3,
				anyCard: false,
				thoughtful: false,
				build: 0,
				undo: true,
				hintBudget: 0
			};
		case 'klondike-solitaire:pass-1':
			return {
				draw: 1,
				passes: 1,
				anyCard: false,
				thoughtful: false,
				build: 0,
				undo: true,
				hintBudget: 0
			};
		case 'klondike-solitaire:any-card':
			return {
				draw: 1,
				passes: 0,
				anyCard: true,
				thoughtful: false,
				build: 0,
				undo: true,
				hintBudget: 0
			};
		case 'klondike-solitaire:thoughtful':
			return {
				draw: 1,
				passes: 0,
				anyCard: false,
				thoughtful: true,
				build: 0,
				undo: true,
				hintBudget: 0
			};
		case 'klondike-solitaire:same-colour':
			return {
				draw: 1,
				passes: 0,
				anyCard: false,
				thoughtful: false,
				build: 1,
				undo: true,
				hintBudget: 0
			};
		case 'klondike-solitaire:different-suit':
			return {
				draw: 1,
				passes: 0,
				anyCard: false,
				thoughtful: false,
				build: 2,
				undo: true,
				hintBudget: 0
			};
		case 'klondike-solitaire:no-undo':
			return {
				draw: 1,
				passes: 0,
				anyCard: false,
				thoughtful: false,
				build: 0,
				undo: false,
				hintBudget: 0
			};
		case 'klondike-solitaire:hint-budget-3':
			return {
				draw: 1,
				passes: 0,
				anyCard: false,
				thoughtful: false,
				build: 0,
				undo: true,
				hintBudget: 3
			};
		case 'klondike-solitaire:draw-3-pass-3':
			return {
				draw: 3,
				passes: 3,
				anyCard: false,
				thoughtful: false,
				build: 0,
				undo: true,
				hintBudget: 0
			};
		case 'klondike-solitaire:classic':
		default:
			return {
				draw: 1,
				passes: 0,
				anyCard: false,
				thoughtful: false,
				build: 0,
				undo: true,
				hintBudget: 0
			};
	}
}

export function encodeRules(rules: KlondikeRules): Record<string, number | boolean> {
	return {
		draw: rules.draw,
		passes: rules.passes,
		anyCard: rules.anyCard,
		thoughtful: rules.thoughtful,
		build: rules.build,
		undo: rules.undo,
		hintBudget: rules.hintBudget
	};
}

/** Exact rules-tuple match: zero or multiple matches both return undefined (never guess). */
export function resolveVariantFromRules(
	rules: Record<string, number | boolean>
): string | undefined {
	const keys = Object.keys(rules).sort();
	if (
		keys.join(',') !== 'anyCard,build,draw,hintBudget,passes,thoughtful,undo' ||
		typeof rules.draw !== 'number' ||
		typeof rules.passes !== 'number' ||
		typeof rules.build !== 'number' ||
		typeof rules.hintBudget !== 'number' ||
		typeof rules.anyCard !== 'boolean' ||
		typeof rules.thoughtful !== 'boolean' ||
		typeof rules.undo !== 'boolean'
	)
		return undefined;
	const matching = KLONDIKE_VARIANTS.filter((id) => {
		const encoded = encodeRules(parseRules(id));
		return keys.every((key) => encoded[key] === rules[key]);
	});
	return matching.length === 1 ? matching[0] : undefined;
}

export function cardSuit(id: number): number {
	return Math.floor(id / 13);
}

export function cardRank(id: number): number {
	return (id % 13) + 1;
}

export function isRedSuit(suit: number): boolean {
	return suit === 1 || suit === 2;
}

export function canBuildOn(cardId: number, targetId: number, build: number): boolean {
	const cRank = cardRank(cardId);
	const tRank = cardRank(targetId);
	if (tRank !== cRank + 1) return false;
	const cSuit = cardSuit(cardId);
	const tSuit = cardSuit(targetId);
	if (build === 0) return isRedSuit(cSuit) !== isRedSuit(tSuit);
	if (build === 1) return isRedSuit(cSuit) === isRedSuit(tSuit);
	if (build === 2) return cSuit !== tSuit;
	return false;
}

export function canFillEmpty(cardId: number, anyCard: boolean): boolean {
	return anyCard || cardRank(cardId) === 13;
}

export function canOnFoundation(
	cardId: number,
	foundationIndex: number,
	currentRank: number
): boolean {
	return cardSuit(cardId) === foundationIndex && cardRank(cardId) === currentRank + 1;
}

export interface KlondikeTableauCol {
	down: number[];
	up: number[];
}

export interface KlondikeState {
	foundations: number[]; // 4 numbers: top rank in each suit (0..13)
	tableau: KlondikeTableauCol[];
	stock: number[]; // cards remaining in stock, last element is next to draw
	waste: number[]; // cards in waste, last element is top playable card
	recyclesDone: number;
	/** Scoring counters. Score is derived from these plus the active scoring values. */
	wasteToTableau: number;
	foundationCards: number;
	flips: number;
	foundationReturns: number;
	hintsUsed: number;
	movesCount: number;
	lastFlip: { col: number; idx: number } | null;
}

export interface KlondikeDeal {
	deck: number[];
	attempts: number;
	nodes: number;
}

/** Standard deal: row by row, left to right; top card of each column face up. */
export function createInitialDeal(deck: readonly number[], rules: KlondikeRules): KlondikeState {
	if (deck.length !== 52) throw new RangeError('Deck must hold 52 cards');
	const tableau: KlondikeTableauCol[] = Array.from({ length: 7 }, () => ({ down: [], up: [] }));
	let k = 0;
	for (let row = 0; row < 7; row++) {
		for (let col = row; col < 7; col++) {
			const card = deck[k++]!;
			if (rules.thoughtful || row === col) tableau[col]!.up.push(card);
			else tableau[col]!.down.push(card);
		}
	}
	return {
		foundations: [0, 0, 0, 0],
		tableau,
		stock: deck.slice(k).reverse(), // pop() draws the first stock card
		waste: [],
		recyclesDone: 0,
		wasteToTableau: 0,
		foundationCards: 0,
		flips: 0,
		foundationReturns: 0,
		hintsUsed: 0,
		movesCount: 0,
		lastFlip: null
	};
}

function maxRecycles(rules: KlondikeRules): number {
	return rules.passes === 1 ? 0 : rules.passes === 3 ? 2 : Infinity;
}

function cloneState(state: KlondikeState): KlondikeState {
	return {
		foundations: state.foundations.slice(),
		tableau: state.tableau.map((col) => ({ down: col.down.slice(), up: col.up.slice() })),
		stock: state.stock.slice(),
		waste: state.waste.slice(),
		recyclesDone: state.recyclesDone,
		wasteToTableau: state.wasteToTableau,
		foundationCards: state.foundationCards,
		flips: state.flips,
		foundationReturns: state.foundationReturns,
		hintsUsed: state.hintsUsed,
		movesCount: state.movesCount,
		lastFlip: null
	};
}

function canPlaceOnColumn(state: KlondikeState, dst: number, card: number, rules: KlondikeRules) {
	const col = state.tableau[dst]!;
	if (col.up.length === 0) return canFillEmpty(card, rules.anyCard);
	return canBuildOn(card, col.up[col.up.length - 1]!, rules.build);
}

/** A move is legal if it changes the board in a useful way. */
export function hasLegalMove(state: KlondikeState, rules: KlondikeRules): boolean {
	if (state.stock.length > 0) return true;
	if (state.waste.length > 0) {
		const top = state.waste[state.waste.length - 1]!;
		if (canOnFoundation(top, cardSuit(top), state.foundations[cardSuit(top)]!)) return true;
		for (let dst = 0; dst < 7; dst++) if (canPlaceOnColumn(state, dst, top, rules)) return true;
		if (state.recyclesDone < maxRecycles(rules)) return true;
	}
	for (let src = 0; src < 7; src++) {
		const col = state.tableau[src]!;
		if (col.up.length === 0) continue;
		const top = col.up[col.up.length - 1]!;
		if (canOnFoundation(top, cardSuit(top), state.foundations[cardSuit(top)]!)) return true;
		for (let idx = 0; idx < col.up.length; idx++) {
			const card = col.up[idx]!;
			if (idx > 0 && !canBuildOn(card, col.up[idx - 1]!, rules.build)) break;
			for (let dst = 0; dst < 7; dst++) {
				if (dst === src) continue;
				if (state.tableau[dst]!.up.length === 0 && idx === 0 && col.down.length === 0) continue;
				if (canPlaceOnColumn(state, dst, card, rules)) return true;
			}
		}
	}
	for (let f = 0; f < 4; f++) {
		const rank = state.foundations[f]!;
		if (rank === 0) continue;
		const card = f * 13 + (rank - 1);
		for (let dst = 0; dst < 7; dst++) if (canPlaceOnColumn(state, dst, card, rules)) return true;
	}
	return false;
}

export function isBlocked(state: KlondikeState, rules: KlondikeRules): boolean {
	return !hasLegalMove(state, rules);
}

export interface AutoFinishResult {
	won: boolean;
	moves: Move[];
	flips: number;
	finalState: KlondikeState;
}

/** Deterministic greedy sweep; foundation move-back is never used. */
export function autoFinishSweep(state: KlondikeState): AutoFinishResult {
	const next = cloneState(state);
	const moves: Move[] = [];
	let progress = true;
	while (progress) {
		progress = false;
		if (next.waste.length > 0) {
			const top = next.waste[next.waste.length - 1]!;
			const suit = cardSuit(top);
			if (canOnFoundation(top, suit, next.foundations[suit]!)) {
				next.waste.pop();
				next.foundations[suit] = cardRank(top);
				next.foundationCards++;
				moves.push({
					action: KLONDIKE_ACTION.move,
					at: 0,
					card: top,
					count: 1,
					dst: 2 + suit,
					src: 1
				});
				progress = true;
				continue;
			}
		}
		for (let col = 0; col < 7; col++) {
			const column = next.tableau[col]!;
			if (column.up.length === 0) continue;
			const top = column.up[column.up.length - 1]!;
			const suit = cardSuit(top);
			if (!canOnFoundation(top, suit, next.foundations[suit]!)) continue;
			column.up.pop();
			if (column.up.length === 0 && column.down.length > 0) {
				column.up.push(column.down.pop()!);
				next.flips++;
			}
			next.foundations[suit] = cardRank(top);
			next.foundationCards++;
			moves.push({
				action: KLONDIKE_ACTION.move,
				at: 0,
				card: top,
				count: 1,
				dst: 2 + suit,
				src: 6 + col
			});
			progress = true;
			break;
		}
	}
	const won =
		next.foundations[0] === 13 &&
		next.foundations[1] === 13 &&
		next.foundations[2] === 13 &&
		next.foundations[3] === 13;
	return { won, moves, flips: next.flips - state.flips, finalState: next };
}

// ---------------------------------------------------------------------------
// Fairness solver: deterministic multi-playout search.
// A found winning line is a real line; a failed search is reported as
// undecided, never as proof that the deal is unwinnable.
// ---------------------------------------------------------------------------

export interface SolverResult {
	outcome: 'won' | 'undecided';
	nodes: number;
	moves?: Move[];
}

interface SearchState {
	foundations: number[];
	tableau: KlondikeTableauCol[];
	stock: number[];
	waste: number[];
	recyclesDone: number;
	h: number;
	parent?: SearchState;
	move?: Move;
}

function isSafeToFoundation(rank: number, suit: number, foundations: readonly number[]): boolean {
	if (rank <= 2) return true;
	const opp = isRedSuit(suit) ? [0, 3] : [1, 2];
	return (foundations[opp[0]] ?? 0) >= rank - 1 && (foundations[opp[1]] ?? 0) >= rank - 1;
}

function calcH(s: SearchState): number {
	let score = 0;
	for (let f = 0; f < 4; f++) score += s.foundations[f] * 100;
	for (let c = 0; c < 7; c++) {
		score -= s.tableau[c].down.length * 30;
		score += s.tableau[c].up.length * 10;
	}
	return score;
}

function stateKey(s: SearchState): string {
	let key = s.foundations.join('.') + '|';
	for (let c = 0; c < 7; c++) {
		const col = s.tableau[c];
		key += col.down.length + ':' + col.up.join(',') + ';';
	}
	key += '|' + s.waste.slice(-3).join(',') + '|' + s.stock.length + '|' + s.recyclesDone;
	return key;
}

class MaxHeap {
	private items: SearchState[] = [];

	push(s: SearchState) {
		this.items.push(s);
		this.up(this.items.length - 1);
	}

	pop(): SearchState | undefined {
		if (this.items.length === 0) return undefined;
		const top = this.items[0];
		const bottom = this.items.pop()!;
		if (this.items.length > 0) {
			this.items[0] = bottom;
			this.down(0);
		}
		return top;
	}

	get length() {
		return this.items.length;
	}

	private up(i: number) {
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (this.items[i].h > this.items[p].h) {
				const tmp = this.items[i];
				this.items[i] = this.items[p];
				this.items[p] = tmp;
				i = p;
			} else break;
		}
	}

	private down(i: number) {
		const len = this.items.length;
		while ((i << 1) + 1 < len) {
			let best = (i << 1) + 1;
			const right = best + 1;
			if (right < len && this.items[right].h > this.items[best].h) {
				best = right;
			}
			if (this.items[best].h > this.items[i].h) {
				const tmp = this.items[i];
				this.items[i] = this.items[best];
				this.items[best] = tmp;
				i = best;
			} else break;
		}
	}
}

/**
 * Deterministic A* priority queue search using MaxHeap.
 * A found winning line is a real line; a failed search is reported as undecided.
 */
export function solveKlondike(
	deck: readonly number[],
	rules: KlondikeRules,
	maxNodes = 400000
): SolverResult {
	const tableau: KlondikeTableauCol[] = Array.from({ length: 7 }, () => ({ down: [], up: [] }));
	let k = 0;
	for (let r = 0; r < 7; r++) {
		for (let c = r; c < 7; c++) {
			const card = deck[k++];
			if (rules.thoughtful) {
				tableau[c].up.push(card);
			} else if (r === c) {
				tableau[c].up.push(card);
			} else {
				tableau[c].down.push(card);
			}
		}
	}
	const stock = deck.slice(k).reverse();
	const waste: number[] = [];
	const foundations = [0, 0, 0, 0];

	const initialState: SearchState = {
		foundations,
		tableau,
		stock,
		waste,
		recyclesDone: 0,
		h: 0
	};
	initialState.h = calcH(initialState);

	const pq = new MaxHeap();
	pq.push(initialState);

	const visited = new Set<string>();
	visited.add(stateKey(initialState));

	let nodes = 0;

	while (pq.length > 0) {
		nodes++;
		if (nodes >= maxNodes) break;

		const s = pq.pop()!;

		if (
			s.foundations[0] === 13 &&
			s.foundations[1] === 13 &&
			s.foundations[2] === 13 &&
			s.foundations[3] === 13
		) {
			const moves: Move[] = [];
			let curr: SearchState | undefined = s;
			while (curr?.move) {
				moves.unshift(curr.move);
				curr = curr.parent;
			}
			return { outcome: 'won', nodes, moves };
		}

		// 1. Safe foundation moves from tableau
		let safeMoveFound = false;
		for (let c = 0; c < 7; c++) {
			const col = s.tableau[c];
			if (col.up.length > 0) {
				const top = col.up[col.up.length - 1];
				const suit = cardSuit(top);
				const rank = cardRank(top);
				if (s.foundations[suit] === rank - 1 && isSafeToFoundation(rank, suit, s.foundations)) {
					const nextCol = { down: col.down.slice(), up: col.up.slice(0, -1) };
					if (nextCol.up.length === 0 && nextCol.down.length > 0) {
						nextCol.up.push(nextCol.down.pop()!);
					}
					const nextTableau = s.tableau.slice();
					nextTableau[c] = nextCol;
					const nextFound = s.foundations.slice();
					nextFound[suit] = rank;
					const nextState: SearchState = {
						foundations: nextFound,
						tableau: nextTableau,
						stock: s.stock,
						waste: s.waste,
						recyclesDone: s.recyclesDone,
						h: 0,
						parent: s,
						move: {
							action: KLONDIKE_ACTION.move,
							at: 0,
							card: top,
							count: 1,
							dst: 2 + suit,
							src: 6 + c
						}
					};
					nextState.h = calcH(nextState);
					const key = stateKey(nextState);
					if (!visited.has(key)) {
						visited.add(key);
						pq.push(nextState);
					}
					safeMoveFound = true;
					break;
				}
			}
		}
		if (safeMoveFound) continue;

		// 2. Safe foundation moves from waste
		if (s.waste.length > 0) {
			const top = s.waste[s.waste.length - 1];
			const suit = cardSuit(top);
			const rank = cardRank(top);
			if (s.foundations[suit] === rank - 1 && isSafeToFoundation(rank, suit, s.foundations)) {
				const nextFound = s.foundations.slice();
				nextFound[suit] = rank;
				const nextState: SearchState = {
					foundations: nextFound,
					tableau: s.tableau,
					stock: s.stock,
					waste: s.waste.slice(0, -1),
					recyclesDone: s.recyclesDone,
					h: 0,
					parent: s,
					move: {
						action: KLONDIKE_ACTION.move,
						at: 0,
						card: top,
						count: 1,
						dst: 2 + suit,
						src: 1
					}
				};
				nextState.h = calcH(nextState);
				const key = stateKey(nextState);
				if (!visited.has(key)) {
					visited.add(key);
					pq.push(nextState);
				}
				continue;
			}
		}

		const nextStates: SearchState[] = [];

		// 3. Other foundation moves from tableau
		for (let c = 0; c < 7; c++) {
			const col = s.tableau[c];
			if (col.up.length > 0) {
				const top = col.up[col.up.length - 1];
				const suit = cardSuit(top);
				const rank = cardRank(top);
				if (s.foundations[suit] === rank - 1) {
					const nextCol = { down: col.down.slice(), up: col.up.slice(0, -1) };
					if (nextCol.up.length === 0 && nextCol.down.length > 0) {
						nextCol.up.push(nextCol.down.pop()!);
					}
					const nextTableau = s.tableau.slice();
					nextTableau[c] = nextCol;
					const nextFound = s.foundations.slice();
					nextFound[suit] = rank;
					const nextState: SearchState = {
						foundations: nextFound,
						tableau: nextTableau,
						stock: s.stock,
						waste: s.waste,
						recyclesDone: s.recyclesDone,
						h: 0,
						parent: s,
						move: {
							action: KLONDIKE_ACTION.move,
							at: 0,
							card: top,
							count: 1,
							dst: 2 + suit,
							src: 6 + c
						}
					};
					nextState.h = calcH(nextState);
					nextStates.push(nextState);
				}
			}
		}

		// 4. Other foundation moves from waste
		if (s.waste.length > 0) {
			const top = s.waste[s.waste.length - 1];
			const suit = cardSuit(top);
			const rank = cardRank(top);
			if (s.foundations[suit] === rank - 1) {
				const nextFound = s.foundations.slice();
				nextFound[suit] = rank;
				const nextState: SearchState = {
					foundations: nextFound,
					tableau: s.tableau,
					stock: s.stock,
					waste: s.waste.slice(0, -1),
					recyclesDone: s.recyclesDone,
					h: 0,
					parent: s,
					move: {
						action: KLONDIKE_ACTION.move,
						at: 0,
						card: top,
						count: 1,
						dst: 2 + suit,
						src: 1
					}
				};
				nextState.h = calcH(nextState);
				nextStates.push(nextState);
			}
		}

		// 5. Tableau to tableau
		for (let src = 0; src < 7; src++) {
			const srcCol = s.tableau[src];
			if (srcCol.up.length === 0) continue;
			let validRunStart = srcCol.up.length - 1;
			while (
				validRunStart > 0 &&
				canBuildOn(srcCol.up[validRunStart], srcCol.up[validRunStart - 1], rules.build)
			) {
				validRunStart--;
			}
			for (let idx = validRunStart; idx < srcCol.up.length; idx++) {
				const bottomCard = srcCol.up[idx];
				const leavesEmpty = idx === 0 && srcCol.down.length === 0;

				for (let dst = 0; dst < 7; dst++) {
					if (src === dst) continue;
					const dstCol = s.tableau[dst];
					if (dstCol.up.length === 0) {
						if (leavesEmpty) continue;
						if (canFillEmpty(bottomCard, rules.anyCard)) {
							const run = srcCol.up.slice(idx);
							const nextSrc = { down: srcCol.down.slice(), up: srcCol.up.slice(0, idx) };
							if (nextSrc.up.length === 0 && nextSrc.down.length > 0) {
								nextSrc.up.push(nextSrc.down.pop()!);
							}
							const nextDst = { down: dstCol.down.slice(), up: dstCol.up.concat(run) };
							const nextTableau = s.tableau.slice();
							nextTableau[src] = nextSrc;
							nextTableau[dst] = nextDst;
							const nextState: SearchState = {
								foundations: s.foundations,
								tableau: nextTableau,
								stock: s.stock,
								waste: s.waste,
								recyclesDone: s.recyclesDone,
								h: 0,
								parent: s,
								move: {
									action: KLONDIKE_ACTION.move,
									at: 0,
									card: bottomCard,
									count: run.length,
									dst: 6 + dst,
									src: 6 + src
								}
							};
							nextState.h = calcH(nextState);
							nextStates.push(nextState);
						}
					} else {
						const dstTop = dstCol.up[dstCol.up.length - 1];
						if (canBuildOn(bottomCard, dstTop, rules.build)) {
							const run = srcCol.up.slice(idx);
							const nextSrc = { down: srcCol.down.slice(), up: srcCol.up.slice(0, idx) };
							if (nextSrc.up.length === 0 && nextSrc.down.length > 0) {
								nextSrc.up.push(nextSrc.down.pop()!);
							}
							const nextDst = { down: dstCol.down.slice(), up: dstCol.up.concat(run) };
							const nextTableau = s.tableau.slice();
							nextTableau[src] = nextSrc;
							nextTableau[dst] = nextDst;
							const nextState: SearchState = {
								foundations: s.foundations,
								tableau: nextTableau,
								stock: s.stock,
								waste: s.waste,
								recyclesDone: s.recyclesDone,
								h: 0,
								parent: s,
								move: {
									action: KLONDIKE_ACTION.move,
									at: 0,
									card: bottomCard,
									count: run.length,
									dst: 6 + dst,
									src: 6 + src
								}
							};
							nextState.h = calcH(nextState);
							nextStates.push(nextState);
						}
					}
				}
			}
		}

		// 6. Waste to tableau
		if (s.waste.length > 0) {
			const top = s.waste[s.waste.length - 1];
			for (let dst = 0; dst < 7; dst++) {
				const dstCol = s.tableau[dst];
				if (dstCol.up.length === 0) {
					if (canFillEmpty(top, rules.anyCard)) {
						const nextDst = { down: dstCol.down.slice(), up: [top] };
						const nextTableau = s.tableau.slice();
						nextTableau[dst] = nextDst;
						const nextState: SearchState = {
							foundations: s.foundations,
							tableau: nextTableau,
							stock: s.stock,
							waste: s.waste.slice(0, -1),
							recyclesDone: s.recyclesDone,
							h: 0,
							parent: s,
							move: {
								action: KLONDIKE_ACTION.move,
								at: 0,
								card: top,
								count: 1,
								dst: 6 + dst,
								src: 1
							}
						};
						nextState.h = calcH(nextState);
						nextStates.push(nextState);
					}
				} else {
					const dstTop = dstCol.up[dstCol.up.length - 1];
					if (canBuildOn(top, dstTop, rules.build)) {
						const nextDst = { down: dstCol.down.slice(), up: dstCol.up.concat([top]) };
						const nextTableau = s.tableau.slice();
						nextTableau[dst] = nextDst;
						const nextState: SearchState = {
							foundations: s.foundations,
							tableau: nextTableau,
							stock: s.stock,
							waste: s.waste.slice(0, -1),
							recyclesDone: s.recyclesDone,
							h: 0,
							parent: s,
							move: {
								action: KLONDIKE_ACTION.move,
								at: 0,
								card: top,
								count: 1,
								dst: 6 + dst,
								src: 1
							}
						};
						nextState.h = calcH(nextState);
						nextStates.push(nextState);
					}
				}
			}
		}

		// 7. Stock draw
		if (s.stock.length > 0) {
			const count = Math.min(rules.draw, s.stock.length);
			const nextStock = s.stock.slice(0, s.stock.length - count);
			const drawn = s.stock.slice(s.stock.length - count).reverse();
			const nextWaste = s.waste.concat(drawn);
			const nextState: SearchState = {
				foundations: s.foundations,
				tableau: s.tableau,
				stock: nextStock,
				waste: nextWaste,
				recyclesDone: s.recyclesDone,
				h: 0,
				parent: s,
				move: {
					action: KLONDIKE_ACTION.draw,
					at: 0,
					card: nextWaste[nextWaste.length - 1],
					count,
					dst: 0,
					src: 0
				}
			};
			nextState.h = calcH(nextState);
			nextStates.push(nextState);
		} else if (s.waste.length > 0) {
			const maxPass = rules.passes === 1 ? 0 : rules.passes === 3 ? 2 : Infinity;
			if (s.recyclesDone < maxPass) {
				const nextStock = s.waste.slice().reverse();
				const nextState: SearchState = {
					foundations: s.foundations,
					tableau: s.tableau,
					stock: nextStock,
					waste: [],
					recyclesDone: s.recyclesDone + 1,
					h: 0,
					parent: s,
					move: { action: KLONDIKE_ACTION.recycle, at: 0, card: 0, count: 0, dst: 0, src: 0 }
				};
				nextState.h = calcH(nextState);
				nextStates.push(nextState);
			}
		}

		for (const ns of nextStates) {
			const key = stateKey(ns);
			if (!visited.has(key)) {
				visited.add(key);
				pq.push(ns);
			}
		}
	}

	return { outcome: 'undecided', nodes };
}

/** Same generation pipeline as createRound: deterministic for a seed + variant. */
export const KLONDIKE_SOLVER_BUDGET = 400000;

export function klondikeDeal(
	seed: string,
	variantId?: string,
	budget = KLONDIKE_SOLVER_BUDGET
): KlondikeDeal {
	const rules = parseRules(variantId);
	const rng = createRng(seed);
	let nodes = 0;
	for (let attempt = 0; attempt < 100; attempt++) {
		const deck = shuffle(
			rng,
			Array.from({ length: 52 }, (_, i) => i)
		);
		nodes += 52;
		const initial = createInitialDeal(deck, rules);
		if (!hasOpeningMove(initial, rules)) continue;
		const solved = solveKlondike(deck, rules, budget);
		nodes += solved.nodes;
		if (solved.outcome === 'won') return { deck, attempts: attempt + 1, nodes };
	}
	throw new RangeError('Deal generation exhausted');
}

function hasOpeningMove(state: KlondikeState, rules: KlondikeRules): boolean {
	for (let col = 0; col < 7; col++) {
		const column = state.tableau[col]!;
		if (column.up.length === 0) continue;
		const top = column.up[column.up.length - 1]!;
		if (canOnFoundation(top, cardSuit(top), state.foundations[cardSuit(top)]!)) return true;
		for (let idx = 0; idx < column.up.length; idx++) {
			const card = column.up[idx]!;
			if (idx > 0 && !canBuildOn(card, column.up[idx - 1]!, rules.build)) break;
			for (let dst = 0; dst < 7; dst++) {
				if (dst === col) continue;
				if (state.tableau[dst]!.up.length === 0) continue;
				if (canBuildOn(card, state.tableau[dst]!.up.at(-1)!, rules.build)) return true;
			}
		}
	}
	return false;
}

export function createKlondikeRound(
	seed: string,
	variantId?: string,
	budget?: number
): {
	seed: string;
	variant?: string;
	rules: Record<string, number | boolean>;
} {
	const rules = parseRules(variantId);
	klondikeDeal(seed, variantId, budget);
	return { seed, variant: variantId, rules: encodeRules(rules) };
}

/** Daily gate: true iff the same createRound pipeline yields a solver-won deal. */
export function dailySeedOk(seed: string, variantId?: string, budget?: number): boolean {
	try {
		klondikeDeal(seed, variantId, budget);
		return true;
	} catch {
		return false;
	}
}

export function applyKlondikeMove(
	state: KlondikeState,
	move: Move,
	rules: KlondikeRules,
	initialDeck?: readonly number[]
): { nextState: KlondikeState } {
	if (move.action === KLONDIKE_ACTION.restart) {
		if (!initialDeck) throw new RangeError('Missing initial deck for restart');
		const reset = createInitialDeal(initialDeck, rules);
		return { nextState: { ...reset, movesCount: state.movesCount + 1 } };
	}

	if (move.action === KLONDIKE_ACTION.hint) {
		if (rules.hintBudget === 3 && state.hintsUsed >= 3)
			throw new RangeError('Hint budget exceeded');
		return {
			nextState: {
				...cloneState(state),
				hintsUsed: state.hintsUsed + 1,
				movesCount: state.movesCount + 1
			}
		};
	}

	if (move.action === KLONDIKE_ACTION.draw) {
		if (state.stock.length === 0) throw new RangeError('Cannot draw from empty stock');
		const count = Math.min(rules.draw, state.stock.length);
		if (move.count !== count) throw new RangeError('Mismatched draw count');
		const next = cloneState(state);
		const drawn: number[] = [];
		for (let i = 0; i < count; i++) drawn.push(next.stock.pop()!);
		next.waste.push(...drawn);
		const top = next.waste[next.waste.length - 1]!;
		if (move.card !== top) throw new RangeError('Mismatched drawn card');
		next.movesCount++;
		return { nextState: next };
	}

	if (move.action === KLONDIKE_ACTION.recycle) {
		if (state.stock.length > 0) throw new RangeError('Invalid recycle');
		if (state.waste.length === 0) {
			// No-op recycle: allowed, no penalty, still a logged move.
			return { nextState: { ...cloneState(state), movesCount: state.movesCount + 1 } };
		}
		if (state.recyclesDone >= maxRecycles(rules)) throw new RangeError('Pass limit exhausted');
		const next = cloneState(state);
		next.stock = next.waste.slice().reverse();
		next.waste = [];
		next.recyclesDone++;
		next.movesCount++;
		return { nextState: next };
	}

	if (move.action === KLONDIKE_ACTION.autoFinish) {
		const sweep = autoFinishSweep(state);
		if (!sweep.won) throw new RangeError('Auto-finish unavailable');
		return {
			nextState: {
				...sweep.finalState,
				movesCount: state.movesCount + 1
			}
		};
	}

	if (move.action === KLONDIKE_ACTION.move) {
		const src = move.src ?? 0;
		const dst = move.dst ?? 0;
		const card = move.card ?? 0;
		const count = move.count ?? 1;
		const next = cloneState(state);

		if (src === KLONDIKE_PILE.waste) {
			if (state.waste.length === 0) throw new RangeError('Waste is empty');
			const top = state.waste[state.waste.length - 1]!;
			if (top !== card || count !== 1) throw new RangeError('Invalid waste card');
			if (dst >= 2 && dst <= 5) {
				const suit = dst - 2;
				if (!canOnFoundation(card, suit, state.foundations[suit]!))
					throw new RangeError('Cannot move to foundation');
				next.foundations[suit] = cardRank(card);
				next.foundationCards++;
				next.waste.pop();
			} else if (dst >= 6 && dst <= 12) {
				if (!canPlaceOnColumn(state, dst - 6, card, rules))
					throw new RangeError('Cannot build on card');
				next.tableau[dst - 6]!.up.push(card);
				next.waste.pop();
				next.wasteToTableau++;
			} else throw new RangeError('Invalid destination pile');
			next.movesCount++;
			return { nextState: next };
		}

		if (src >= 2 && src <= 5) {
			const suit = src - 2;
			const rank = state.foundations[suit]!;
			if (rank === 0) throw new RangeError('Foundation is empty');
			const foundationCard = suit * 13 + (rank - 1);
			if (foundationCard !== card || count !== 1) throw new RangeError('Invalid foundation card');
			if (dst < 6 || dst > 12) throw new RangeError('Invalid destination for foundation card');
			if (!canPlaceOnColumn(state, dst - 6, card, rules))
				throw new RangeError('Cannot build on card');
			next.foundations[suit] = rank - 1;
			next.foundationReturns++;
			next.tableau[dst - 6]!.up.push(card);
			next.movesCount++;
			return { nextState: next };
		}

		if (src >= 6 && src <= 12) {
			const srcIdx = src - 6;
			const column = state.tableau[srcIdx]!;
			if (column.up.length === 0) throw new RangeError('Source column has no up cards');
			const cardIdx = column.up.indexOf(card);
			if (cardIdx === -1) throw new RangeError('Card not found in source column');
			const run = column.up.slice(cardIdx);
			if (run.length !== count) throw new RangeError('Mismatched run length');
			for (let i = 1; i < run.length; i++)
				if (!canBuildOn(run[i]!, run[i - 1]!, rules.build))
					throw new RangeError('Run is not a valid build');
			if (dst >= 2 && dst <= 5) {
				if (count !== 1 || cardIdx !== column.up.length - 1)
					throw new RangeError('Only top single card can go to foundation');
				const suit = dst - 2;
				if (!canOnFoundation(card, suit, state.foundations[suit]!))
					throw new RangeError('Cannot move to foundation');
				next.foundations[suit] = cardRank(card);
				next.foundationCards++;
				const destination = next.tableau[srcIdx]!;
				destination.up.pop();
				if (destination.up.length === 0 && destination.down.length > 0) {
					destination.up.push(destination.down.pop()!);
					next.flips++;
					next.lastFlip = { col: srcIdx, idx: 0 };
				}
			} else if (dst >= 6 && dst <= 12) {
				if (src === dst) throw new RangeError('Cannot move to same column');
				if (!canPlaceOnColumn(state, dst - 6, card, rules))
					throw new RangeError('Cannot build on card');
				const source = next.tableau[srcIdx]!;
				source.up.splice(cardIdx, count);
				if (source.up.length === 0 && source.down.length > 0) {
					source.up.push(source.down.pop()!);
					next.flips++;
					next.lastFlip = { col: srcIdx, idx: 0 };
				}
				next.tableau[dst - 6]!.up.push(...run);
			} else throw new RangeError('Invalid destination pile');
			next.movesCount++;
			return { nextState: next };
		}

		throw new RangeError('Invalid source pile');
	}

	throw new RangeError(`Unknown action ${move.action}`);
}

/** Score from engine counters and the active (admin-editable) scoring values. */
export function klondikeScore(
	state: KlondikeState,
	seconds: number,
	scoring: ScoreValues = defaultScoringDef.defaults,
	rules: KlondikeRules = parseRules()
): number {
	if (!Number.isSafeInteger(seconds) || seconds < 0) throw new RangeError('elapsed');
	const recycle =
		rules.draw === 1
			? state.recyclesDone * (scoring.recycleDraw1 ?? 0)
			: Math.max(0, state.recyclesDone - 2) * (scoring.recycleDraw3 ?? 0);
	const hint = rules.hintBudget === 3 ? state.hintsUsed * (scoring.hint ?? 0) : 0;
	const board =
		state.wasteToTableau * (scoring.wasteTableau ?? 0) +
		state.foundationCards * (scoring.foundation ?? 0) +
		state.flips * (scoring.flip ?? 0) -
		state.foundationReturns * (scoring.foundationReturn ?? 0) -
		recycle -
		hint;
	const bonus = seconds >= 30 ? Math.floor(((scoring.timeBonus ?? 0) * 100) / seconds) : 0;
	return Math.max(0, board) + bonus;
}

export function replayKlondikeMoves(
	deck: readonly number[],
	rules: KlondikeRules,
	moves: readonly Move[]
) {
	let state = createInitialDeal(deck, rules);
	const undoStack: KlondikeState[] = [];
	let hintUsed = false;

	for (const move of moves) {
		if (move.action === KLONDIKE_ACTION.hint) hintUsed = true;
		if (move.action === KLONDIKE_ACTION.undo) {
			if (!rules.undo) throw new RangeError('Undo disabled');
			if (undoStack.length === 0) throw new RangeError('Nothing to undo');
			const previous = undoStack.pop()!;
			const hintsUsed = state.hintsUsed;
			const movesCount = state.movesCount;
			state = previous;
			// Hints stay spent; the undo itself counts as a logged move.
			state.hintsUsed = hintsUsed;
			state.movesCount = movesCount + 1;
			continue;
		}
		if (move.action !== KLONDIKE_ACTION.restart) undoStack.push(cloneState(state));
		state = applyKlondikeMove(state, move, rules, deck).nextState;
		if (move.action === KLONDIKE_ACTION.restart) undoStack.length = 0;
	}

	return { state, undoStack, hintUsed };
}

export function replayKlondike(
	seed: string,
	moves: readonly Move[],
	seconds: number,
	scoring?: ScoreValues,
	variantId?: string,
	budget?: number
): ReplayedResult {
	const rules = parseRules(variantId);
	const { deck } = klondikeDeal(seed, variantId, budget);
	const { state, hintUsed } = replayKlondikeMoves(deck, rules, moves);

	const totalHome = state.foundations.reduce((sum, rank) => sum + rank, 0);
	if (totalHome !== 52) throw new RangeError(`Game not won: only ${totalHome}/52 cards home`);

	return {
		score: klondikeScore(state, seconds, scoring ?? defaultScoringDef.defaults, rules),
		pairs: null,
		moves: moves.length,
		hintUsed
	};
}

/** Best playable move for the Hint button; null means draw/recycle is the best option. */
export function klondikeHint(state: KlondikeState, rules: KlondikeRules): Move | null {
	if (state.waste.length > 0) {
		const top = state.waste[state.waste.length - 1]!;
		const suit = cardSuit(top);
		if (canOnFoundation(top, suit, state.foundations[suit]!))
			return { action: 1, at: 0, card: top, count: 1, dst: 2 + suit, src: 1 };
	}
	for (let col = 0; col < 7; col++) {
		const column = state.tableau[col]!;
		if (column.up.length === 0) continue;
		const top = column.up[column.up.length - 1]!;
		const suit = cardSuit(top);
		if (canOnFoundation(top, suit, state.foundations[suit]!))
			return { action: 1, at: 0, card: top, count: 1, dst: 2 + suit, src: 6 + col };
	}
	for (let src = 0; src < 7; src++) {
		const column = state.tableau[src]!;
		if (column.up.length === 0) continue;
		for (let idx = 0; idx < column.up.length; idx++) {
			const card = column.up[idx]!;
			if (idx > 0 && !canBuildOn(card, column.up[idx - 1]!, rules.build)) break;
			for (let dst = 0; dst < 7; dst++) {
				if (dst === src) continue;
				if (column.up.length - idx === column.up.length && column.down.length === 0) continue;
				if (canPlaceOnColumn(state, dst, card, rules))
					return {
						action: 1,
						at: 0,
						card,
						count: column.up.length - idx,
						dst: 6 + dst,
						src: 6 + src
					};
			}
		}
	}
	if (state.waste.length > 0) {
		const top = state.waste[state.waste.length - 1]!;
		for (let dst = 0; dst < 7; dst++)
			if (canPlaceOnColumn(state, dst, top, rules))
				return { action: 1, at: 0, card: top, count: 1, dst: 6 + dst, src: 1 };
	}
	return null;
}
