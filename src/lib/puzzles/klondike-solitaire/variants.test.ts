import { describe, expect, it } from 'vitest';
import {
	applyKlondikeMove,
	canBuildOn,
	canFillEmpty,
	createInitialDeal,
	klondikeDeal,
	parseRules,
	KLONDIKE_ACTION,
	KLONDIKE_PILE,
	type KlondikeState
} from './logic.js';
import type { Move } from '#lib/engine/contract.js';

describe('Klondike Solitaire - 11 Variants C2 Invariant & Rule Deltas', () => {
	it('variant 1 (classic): draw 1, unlimited passes, alternating colour, King-only empty fill', () => {
		const rules = parseRules('klondike-solitaire:classic');
		expect(rules.draw).toBe(1);
		expect(rules.passes).toBe(0);
		expect(rules.build).toBe(0);
		expect(rules.anyCard).toBe(false);
		expect(rules.thoughtful).toBe(false);
		expect(rules.undo).toBe(true);
		expect(rules.hintBudget).toBe(0);
	});

	it('variant 2 (draw-3): draws 3 cards at a time from stock', () => {
		const rules = parseRules('klondike-solitaire:draw-3');
		expect(rules.draw).toBe(3);
		const { deck } = klondikeDeal('2001', 'klondike-solitaire:draw-3', 4000);
		const s0 = createInitialDeal(deck, rules);
		const drawnCards = s0.stock.slice(-3).reverse();
		const top = drawnCards[drawnCards.length - 1];

		const m: Move = {
			action: KLONDIKE_ACTION.draw,
			src: KLONDIKE_PILE.stock,
			dst: KLONDIKE_PILE.waste,
			card: top,
			count: 3,
			at: 100
		};
		const { nextState } = applyKlondikeMove(s0, m, rules, deck);
		expect(nextState.waste).toHaveLength(3);
	});

	it('variant 3 (pass-3): restricts stock passes to 3 (2 recycles max)', () => {
		const rules = parseRules('klondike-solitaire:pass-3');
		expect(rules.passes).toBe(3);
		const { deck } = klondikeDeal('2002', 'klondike-solitaire:pass-3', 4000);
		let state: KlondikeState = {
			...createInitialDeal(deck, rules),
			stock: [],
			waste: [10, 20]
		};

		// Recycle 1
		state = applyKlondikeMove(
			state,
			{
				action: KLONDIKE_ACTION.recycle,
				src: KLONDIKE_PILE.waste,
				dst: KLONDIKE_PILE.stock,
				card: 10,
				count: 2,
				at: 100
			},
			rules,
			deck
		).nextState;
		expect(state.recyclesDone).toBe(1);

		// Recycle 2
		state.stock = [];
		state.waste = [10, 20];
		state = applyKlondikeMove(
			state,
			{
				action: KLONDIKE_ACTION.recycle,
				src: KLONDIKE_PILE.waste,
				dst: KLONDIKE_PILE.stock,
				card: 10,
				count: 2,
				at: 200
			},
			rules,
			deck
		).nextState;
		expect(state.recyclesDone).toBe(2);

		// Recycle 3 -> exceeds 3 passes (2 recycles) -> throws RangeError
		state.stock = [];
		state.waste = [10, 20];
		expect(() => {
			applyKlondikeMove(
				state,
				{
					action: KLONDIKE_ACTION.recycle,
					src: KLONDIKE_PILE.waste,
					dst: KLONDIKE_PILE.stock,
					card: 10,
					count: 2,
					at: 300
				},
				rules,
				deck
			);
		}).toThrowError(RangeError);
	});

	it('variant 4 (pass-1): restricts to single pass through stock (0 recycles)', () => {
		const rules = parseRules('klondike-solitaire:pass-1');
		expect(rules.passes).toBe(1);
		const { deck } = klondikeDeal('2003', 'klondike-solitaire:pass-1', 4000);
		const state: KlondikeState = {
			...createInitialDeal(deck, rules),
			stock: [],
			waste: [5]
		};
		expect(() => {
			applyKlondikeMove(
				state,
				{
					action: KLONDIKE_ACTION.recycle,
					src: KLONDIKE_PILE.waste,
					dst: KLONDIKE_PILE.stock,
					card: 5,
					count: 1,
					at: 100
				},
				rules,
				deck
			);
		}).toThrowError(RangeError);
	});

	it('variant 5 (any-card): allows any rank on empty column', () => {
		const rules = parseRules('klondike-solitaire:any-card');
		expect(rules.anyCard).toBe(true);
		// Card 1 is rank 2 (2 of Spades)
		expect(canFillEmpty(1, rules.anyCard)).toBe(true);
		// In classic, rank 2 cannot fill empty
		expect(canFillEmpty(1, false)).toBe(false);
	});

	it('variant 6 (thoughtful): opens with all 28 tableau cards face up', () => {
		const rules = parseRules('klondike-solitaire:thoughtful');
		expect(rules.thoughtful).toBe(true);
		const { deck } = klondikeDeal('2004', 'klondike-solitaire:thoughtful', 4000);
		const state = createInitialDeal(deck, rules);
		for (const col of state.tableau) {
			expect(col.down).toHaveLength(0);
		}
	});

	it('variant 7 (same-colour): builds down in same colour (red on red, black on black)', () => {
		const rules = parseRules('klondike-solitaire:same-colour');
		expect(rules.build).toBe(1);
		// 8 of Hearts (id 20, rank 8, red)
		// 7 of Diamonds (id 32, rank 7, red)
		// 7 of Spades (id 6, rank 7, black)
		expect(canBuildOn(32, 20, rules.build)).toBe(true);
		expect(canBuildOn(6, 20, rules.build)).toBe(false);
	});

	it('variant 8 (different-suit): builds down in any different suit', () => {
		const rules = parseRules('klondike-solitaire:different-suit');
		expect(rules.build).toBe(2);
		// 8 of Hearts (id 20, suit 1)
		// 7 of Diamonds (id 32, suit 2) -> different suit, same color -> valid in different-suit!
		expect(canBuildOn(32, 20, rules.build)).toBe(true);
		// 7 of Hearts (id 19, suit 1) -> same suit -> invalid!
		expect(canBuildOn(19, 20, rules.build)).toBe(false);
	});

	it('variant 9 (no-undo): flags undo as false in rules', () => {
		const rules = parseRules('klondike-solitaire:no-undo');
		expect(rules.undo).toBe(false);
	});

	it('variant 10 (hint-budget-3): limits hints to 3 and enforces budget', () => {
		const rules = parseRules('klondike-solitaire:hint-budget-3');
		expect(rules.hintBudget).toBe(3);
		const { deck } = klondikeDeal('2005', 'klondike-solitaire:hint-budget-3', 4000);
		let state = createInitialDeal(deck, rules);

		// Use 3 hints
		for (let i = 1; i <= 3; i++) {
			state = applyKlondikeMove(
				state,
				{ action: KLONDIKE_ACTION.hint, at: i * 100 },
				rules,
				deck
			).nextState;
			expect(state.hintsUsed).toBe(i);
		}

		// 4th hint -> throws RangeError
		expect(() => {
			applyKlondikeMove(state, { action: KLONDIKE_ACTION.hint, at: 400 }, rules, deck);
		}).toThrowError(RangeError);
	});

	it('variant 11 (draw-3-pass-3): combines draw 3 and at most 3 passes', () => {
		const rules = parseRules('klondike-solitaire:draw-3-pass-3');
		expect(rules.draw).toBe(3);
		expect(rules.passes).toBe(3);
	});
});
