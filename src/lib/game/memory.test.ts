import { describe, expect, it } from 'vitest';
import {
	PAIR_COUNTS,
	createMemoryRound,
	currentScore,
	flipCard,
	isFaceUp,
	resolveMismatch,
	scoreFor,
	scoreRound,
	type MemoryRound,
	type PairCount
} from '#lib/game/memory.js';

function fixedRound(): MemoryRound {
	return {
		seed: '7',
		pairs: 2 as PairCount,
		cards: [
			{ id: 'circle:0', symbol: 'circle', color: '#009A86' },
			{ id: 'circle:1', symbol: 'circle', color: '#009A86' },
			{ id: 'triangle:0', symbol: 'triangle', color: '#7D61AE' },
			{ id: 'triangle:1', symbol: 'triangle', color: '#7D61AE' }
		],
		revealed: [],
		matched: [],
		mismatches: 0,
		moves: 0,
		status: 'playing'
	};
}

describe('createMemoryRound', () => {
	it('builds a valid deck for many seeds', () => {
		for (let seed = 0; seed < 200; seed += 1) {
			const round = createMemoryRound(String(seed));
			const counts = new Map<string, number>();

			expect(PAIR_COUNTS).toContain(round.pairs);
			expect(round.cards).toHaveLength(round.pairs * 2);
			expect(new Set(round.cards.map((card) => card.id)).size).toBe(round.cards.length);

			for (const card of round.cards) {
				counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1);
			}

			expect(counts.size).toBe(round.pairs);
			for (const count of counts.values()) {
				expect(count).toBe(2);
			}
		}
	});

	it('is deterministic for a seed', () => {
		const first = createMemoryRound('123456789');
		const second = createMemoryRound('123456789');

		expect(JSON.stringify(first)).toBe(JSON.stringify(second));
	});

	it('varies the board across seeds', () => {
		const boards = new Set<string>();

		for (let seed = 0; seed < 100; seed += 1) {
			const round = createMemoryRound(String(seed * 7919));
			boards.add(round.cards.map((card) => card.symbol).join(','));
		}

		expect(boards.size).toBeGreaterThan(30);
	});

	it('is solvable by construction', () => {
		for (let seed = 0; seed < 150; seed += 1) {
			let round = createMemoryRound(String(seed * 104729));
			const bySymbol = new Map<string, number[]>();

			round.cards.forEach((card, index) => {
				const indices = bySymbol.get(card.symbol) ?? [];
				indices.push(index);
				bySymbol.set(card.symbol, indices);
			});

			for (const indices of bySymbol.values()) {
				const [first, second] = indices;
				round = flipCard(round, first).round;
				round = flipCard(round, second).round;
			}

			expect(round.status).toBe('won');
			expect(round.matched).toHaveLength(round.cards.length);
			expect(round.mismatches).toBe(0);
		}
	});
});

describe('flipCard', () => {
	it('reveals one card at a time', () => {
		const initial = fixedRound();
		const result = flipCard(initial, 0);

		expect(result.effect).toBe('flip');
		expect(result.round.revealed).toEqual([0]);
		expect(result.round.moves).toBe(0);
		expect(isFaceUp(result.round, 0)).toBe(true);
	});

	it('ignores a second tap on the same card', () => {
		const once = flipCard(fixedRound(), 0).round;
		const result = flipCard(once, 0);

		expect(result.effect).toBe('ignored');
		expect(result.round).toBe(once);
	});

	it('ignores a third card while two are showing', () => {
		const first = flipCard(fixedRound(), 0).round;
		const second = flipCard(first, 2).round;
		const result = flipCard(second, 1);

		expect(result.effect).toBe('ignored');
		expect(result.round).toBe(second);
	});

	it('matches a pair', () => {
		const first = flipCard(fixedRound(), 0).round;
		const result = flipCard(first, 1);

		expect(result.effect).toBe('match');
		expect(result.round.matched).toEqual([0, 1]);
		expect(result.round.revealed).toEqual([]);
		expect(isFaceUp(result.round, 1)).toBe(true);
	});

	it('counts a mismatch and flips the cards back', () => {
		const first = flipCard(fixedRound(), 0).round;
		const result = flipCard(first, 2);

		expect(result.effect).toBe('mismatch');
		expect(result.round.revealed).toEqual([0, 2]);
		expect(result.round.mismatches).toBe(1);

		const resolved = resolveMismatch(result.round);
		expect(resolved.revealed).toEqual([]);
		expect(isFaceUp(resolved, 0)).toBe(false);
		expect(resolved.mismatches).toBe(1);
	});

	it('counts one move per two-card attempt, not per card', () => {
		let round = flipCard(fixedRound(), 0).round;
		expect(round.moves).toBe(0);

		round = flipCard(round, 2).round;
		expect(round.moves).toBe(1);

		const ignored = flipCard(round, 1);
		expect(ignored.effect).toBe('ignored');
		expect(ignored.round.moves).toBe(1);

		round = resolveMismatch(round);
		round = flipCard(round, 0).round;
		expect(round.moves).toBe(1);

		const match = flipCard(round, 1);
		expect(match.effect).toBe('match');
		expect(match.round.moves).toBe(2);
	});

	it('ignores taps on matched cards', () => {
		const first = flipCard(fixedRound(), 0).round;
		const matched = flipCard(first, 1).round;
		const result = flipCard(matched, 0);

		expect(result.effect).toBe('ignored');
	});

	it('wins after the final pair', () => {
		let round = flipCard(fixedRound(), 0).round;
		round = flipCard(round, 1).round;
		round = flipCard(round, 2).round;
		const result = flipCard(round, 3);

		expect(result.effect).toBe('win');
		expect(result.round.status).toBe('won');
		expect(result.round.matched).toEqual([0, 1, 2, 3]);
	});
});

describe('scoring', () => {
	it('starts at 1000 per pair', () => {
		expect(scoreFor(6, 0, 0)).toBe(6000);
		expect(scoreFor(10, 0, 0)).toBe(10000);
	});

	it('subtracts 150 per mismatch and 5 per second', () => {
		expect(scoreFor(6, 2, 30)).toBe(6000 - 300 - 150);
		expect(scoreFor(10, 4, 100)).toBe(10000 - 600 - 500);
	});

	it('never goes below zero', () => {
		expect(scoreFor(6, 40, 1000)).toBe(0);
	});

	it('only scores a won round', () => {
		const playing = fixedRound();
		expect(scoreRound(playing, 10)).toBe(0);
		expect(scoreFor(2, 0, 10)).toBe(1950);
	});

	it('shows the projected score from the start of the round', () => {
		const playing = fixedRound();
		expect(currentScore(playing, 0)).toBe(2000);
		expect(currentScore(playing, 3)).toBe(1985);
	});

	it('is deterministic for a fixed round and clock', () => {
		const won = fixedRound();
		won.status = 'won';
		won.mismatches = 1;

		expect(scoreRound(won, 42)).toBe(scoreRound(won, 42));
	});
});
