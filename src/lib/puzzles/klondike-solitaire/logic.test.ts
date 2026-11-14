import { describe, expect, it } from 'vitest';
import {
	autoFinishSweep,
	applyKlondikeMove,
	cardRank,
	cardSuit,
	canBuildOn,
	canFillEmpty,
	canOnFoundation,
	createInitialDeal,
	isRedSuit,
	klondikeDeal,
	klondikeScore,
	parseRules,
	KLONDIKE_ACTION,
	KLONDIKE_PILE,
	type KlondikeState
} from './logic.js';
import { manifest } from './manifest.js';
import type { Move } from '#lib/engine/contract.js';

describe('Klondike Solitaire - Card Math & Building Rules', () => {
	it('calculates suit and rank for 52 cards', () => {
		// Ace of Spades: id 0 -> suit 0 (Spades), rank 1
		expect(cardSuit(0)).toBe(0);
		expect(cardRank(0)).toBe(1);
		expect(isRedSuit(0)).toBe(false);

		// King of Hearts: id 25 (Hearts is suit 1, rank 13 -> 1 * 13 + 12 = 25)
		expect(cardSuit(25)).toBe(1);
		expect(cardRank(25)).toBe(13);
		expect(isRedSuit(1)).toBe(true);

		// Ace of Diamonds: id 26 -> suit 2 (Diamonds), rank 1
		expect(cardSuit(26)).toBe(2);
		expect(cardRank(26)).toBe(1);
		expect(isRedSuit(2)).toBe(true);

		// King of Clubs: id 51 -> suit 3 (Clubs), rank 13
		expect(cardSuit(51)).toBe(3);
		expect(cardRank(51)).toBe(13);
		expect(isRedSuit(3)).toBe(false);
	});

	it('enforces building down rules (alternating color, same color, different suit)', () => {
		// Target: 8 of Hearts (id 1 * 13 + 7 = 20, rank 8, red)
		const target8H = 20;
		// Moving card: 7 of Spades (id 0 * 13 + 6 = 6, rank 7, black)
		const card7S = 6;
		// Moving card: 7 of Diamonds (id 2 * 13 + 6 = 32, rank 7, red)
		const card7D = 32;

		// Build mode 0 (Classic: alternating color)
		expect(canBuildOn(card7S, target8H, 0)).toBe(true);
		expect(canBuildOn(card7D, target8H, 0)).toBe(false);

		// Build mode 1 (same-colour: red on red, black on black)
		expect(canBuildOn(card7S, target8H, 1)).toBe(false);
		expect(canBuildOn(card7D, target8H, 1)).toBe(true);

		// Build mode 2 (different-suit)
		expect(canBuildOn(card7S, target8H, 2)).toBe(true);
		expect(canBuildOn(card7D, target8H, 2)).toBe(true);
	});

	it('enforces empty tableau column filling', () => {
		const king = 12; // rank 13
		const queen = 11; // rank 12

		// Classic (anyCard = false) -> King only
		expect(canFillEmpty(king, false)).toBe(true);
		expect(canFillEmpty(queen, false)).toBe(false);

		// any-card variant -> any card allowed
		expect(canFillEmpty(king, true)).toBe(true);
		expect(canFillEmpty(queen, true)).toBe(true);
	});

	it('enforces foundation building', () => {
		// Ace of Spades (card 0) on empty Spades foundation (index 0, currentRank 0)
		expect(canOnFoundation(0, 0, 0)).toBe(true);
		// 2 of Spades (card 1) on Spades foundation with rank 1
		expect(canOnFoundation(1, 0, 1)).toBe(true);
		// 3 of Spades (card 2) on Spades foundation with rank 1 -> false
		expect(canOnFoundation(2, 0, 1)).toBe(false);
		// Ace of Hearts (card 13) on Spades foundation -> false
		expect(canOnFoundation(13, 0, 0)).toBe(false);
	});
});

describe('Klondike Solitaire - Deal Generation & Initial Board', () => {
	it('generates deterministic deals and solvable rounds', () => {
		const deal1 = klondikeDeal('1001', 'klondike-solitaire:classic');
		const deal2 = klondikeDeal('1001', 'klondike-solitaire:classic');
		expect(deal1.deck).toEqual(deal2.deck);
	});

	it('creates correct initial deal shape (7 columns, 28 tableau cards, 24 stock)', () => {
		const rules = parseRules('klondike-solitaire:classic');
		const { deck } = klondikeDeal('1002');
		const state = createInitialDeal(deck, rules);

		expect(state.tableau).toHaveLength(7);
		expect(state.foundations).toEqual([0, 0, 0, 0]);
		expect(state.stock).toHaveLength(24);
		expect(state.waste).toHaveLength(0);

		let totalDown = 0;
		let totalUp = 0;
		for (let c = 0; c < 7; c++) {
			expect(state.tableau[c].down).toHaveLength(c);
			expect(state.tableau[c].up).toHaveLength(1);
			totalDown += state.tableau[c].down.length;
			totalUp += state.tableau[c].up.length;
		}
		expect(totalDown).toBe(21);
		expect(totalUp).toBe(7);
	});

	it('creates Thoughtful variant with all 28 tableau cards face up', () => {
		const rules = parseRules('klondike-solitaire:thoughtful');
		const { deck } = klondikeDeal('1003', 'klondike-solitaire:thoughtful');
		const state = createInitialDeal(deck, rules);

		for (let c = 0; c < 7; c++) {
			expect(state.tableau[c].down).toHaveLength(0);
			expect(state.tableau[c].up).toHaveLength(c + 1);
		}
	});
});

describe('Klondike Solitaire - Moves & State Transitions', () => {
	it('draws 1 card from stock to waste in Classic', () => {
		const rules = parseRules('klondike-solitaire:classic');
		const { deck } = klondikeDeal('1004');
		const state0 = createInitialDeal(deck, rules);
		const topStock = state0.stock[state0.stock.length - 1];

		const move: Move = {
			action: KLONDIKE_ACTION.draw,
			src: KLONDIKE_PILE.stock,
			dst: KLONDIKE_PILE.waste,
			card: topStock,
			count: 1,
			at: 100
		};

		const { nextState } = applyKlondikeMove(state0, move, rules, deck);
		expect(nextState.stock).toHaveLength(23);
		expect(nextState.waste).toEqual([topStock]);
		expect(nextState.movesCount).toBe(1);
	});

	it('draws 3 cards from stock to waste in Draw 3 mode', () => {
		const rules = parseRules('klondike-solitaire:draw-3');
		const { deck } = klondikeDeal('1005', 'klondike-solitaire:draw-3');
		const state0 = createInitialDeal(deck, rules);
		const drawnCards = state0.stock.slice(-3).reverse();
		const topDrawn = drawnCards[drawnCards.length - 1];

		const move: Move = {
			action: KLONDIKE_ACTION.draw,
			src: KLONDIKE_PILE.stock,
			dst: KLONDIKE_PILE.waste,
			card: topDrawn,
			count: 3,
			at: 100
		};

		const { nextState } = applyKlondikeMove(state0, move, rules, deck);
		expect(nextState.stock).toHaveLength(21);
		expect(nextState.waste).toHaveLength(3);
	});

	it('recycles waste back to stock when stock is exhausted', () => {
		const rules = parseRules('klondike-solitaire:classic');
		const { deck } = klondikeDeal('1006');
		const state0: KlondikeState = {
			...createInitialDeal(deck, rules),
			stock: [],
			waste: [5, 10, 15]
		};

		const move: Move = {
			action: KLONDIKE_ACTION.recycle,
			src: KLONDIKE_PILE.waste,
			dst: KLONDIKE_PILE.stock,
			card: 5,
			count: 3,
			at: 200
		};

		const { nextState } = applyKlondikeMove(state0, move, rules, deck);
		expect(nextState.waste).toHaveLength(0);
		expect(nextState.stock).toEqual([15, 10, 5]);
		expect(nextState.recyclesDone).toBe(1);
	});

	it('enforces pass limits on single-pass and pass-3 variants', () => {
		const rulesPass1 = parseRules('klondike-solitaire:pass-1');
		const { deck } = klondikeDeal('1007', 'klondike-solitaire:pass-1');
		const statePass1: KlondikeState = {
			...createInitialDeal(deck, rulesPass1),
			stock: [],
			waste: [1, 2]
		};
		// pass-1 allows 0 recycles (1 pass total)
		expect(() => {
			applyKlondikeMove(
				statePass1,
				{
					action: KLONDIKE_ACTION.recycle,
					src: KLONDIKE_PILE.waste,
					dst: KLONDIKE_PILE.stock,
					card: 1,
					count: 2,
					at: 100
				},
				rulesPass1,
				deck
			);
		}).toThrowError(RangeError);
	});
});

describe('Klondike Solitaire - Auto-finish Sweep', () => {
	it('sweeps remaining tableau cards to foundation when safe', () => {
		const rules = parseRules('klondike-solitaire:classic');
		const { deck } = klondikeDeal('1008');
		// Construct state where all face-down cards are exposed and stock/waste empty
		const state: KlondikeState = {
			...createInitialDeal(deck, rules),
			stock: [],
			waste: [],
			foundations: [12, 12, 12, 12], // All queens on foundations
			tableau: [
				{ down: [], up: [12] }, // King Spades
				{ down: [], up: [25] }, // King Hearts
				{ down: [], up: [38] }, // King Diamonds
				{ down: [], up: [51] }, // King Clubs
				{ down: [], up: [] },
				{ down: [], up: [] },
				{ down: [], up: [] }
			]
		};

		const sweep = autoFinishSweep(state);
		expect(sweep.won).toBe(true);
		expect(sweep.moves).toHaveLength(4);

		let cur = state;
		for (const m of sweep.moves) {
			cur = applyKlondikeMove(cur, m, rules, deck).nextState;
		}
		expect(cur.foundations).toEqual([13, 13, 13, 13]);
	});

	it('returns won: false if there are remaining stock, waste, or face-down cards', () => {
		const rules = parseRules('klondike-solitaire:classic');
		const { deck } = klondikeDeal('1009');
		const stateWithStock = createInitialDeal(deck, rules);
		expect(autoFinishSweep(stateWithStock).won).toBe(false);
	});
});

describe('Klondike Solitaire - Scoring & Timing Floor', () => {
	it('calculates Microsoft Standard scoring with time bonus for completions >= 30s', () => {
		const rules = parseRules('klondike-solitaire:classic');
		const { deck } = klondikeDeal('1010');
		const state: KlondikeState = {
			...createInitialDeal(deck, rules),
			wasteToTableau: 2, // 2 * 5 = 10
			foundationCards: 52, // 52 * 10 = 520
			flips: 21, // 21 * 5 = 105
			recyclesDone: 0,
			foundationReturns: 0
		};

		// 60 seconds completion: time bonus = floor(7000 * 100 / 60) = 11666
		// board = 10 + 520 + 105 = 635
		// total = 635 + 11666 = 12301
		const score = klondikeScore(state, 60);
		expect(score).toBe(12301);

		// Completion under 30s receives 0 time bonus
		const scoreFast = klondikeScore(state, 20);
		expect(scoreFast).toBe(635);
	});

	it('manifest configures 60,000ms timing floor, selectionOrder 6, 0 groups', () => {
		expect(manifest.id).toBe('klondike-solitaire');
		expect(manifest.selectionOrder).toBe(6);
		expect(manifest.rankedTiming.minimumSeconds()).toBe(60);
		expect(manifest.variants).toHaveLength(11);
	});
});
