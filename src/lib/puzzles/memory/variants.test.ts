import { describe, expect, it } from 'vitest';
import { createRng, shuffle } from '#lib/engine/rng.js';
import { validateScoreValues } from '#lib/engine/scoring.js';
import {
	MEMORY_VARIANTS,
	cardsPerMatch,
	createMemoryRound,
	currentScore,
	flipCard,
	memoryCapReached,
	memoryMoveLimit,
	resolveMismatch,
	type MemoryRound
} from './logic.js';
import { manifest } from './manifest.js';
import { messages } from './messages.js';
import { triosScoring } from './scoring.js';

function matchingMoves(round: MemoryRound) {
	return [...new Set(round.cards.map((card) => card.symbol))].flatMap((symbol) =>
		round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
	);
}

function mismatch(round: MemoryRound) {
	const available = round.cards
		.map((_, index) => index)
		.filter((index) => !round.matched.includes(index));
	const first = available[0];
	const other = available.find((index) => round.cards[index].symbol !== round.cards[first].symbol)!;
	const indices =
		cardsPerMatch(round) === 3
			? [first, other, available.find((index) => index !== first && index !== other)!]
			: [first, other];
	for (const index of indices) round = flipCard(round, index).round;
	return round;
}

describe('Memory variants', () => {
	it('keeps omitted and explicit classic byte-compatible and rejects foreign variant codes', () => {
		for (const seed of ['0', '42', '18446744073709551615']) {
			const legacy = createMemoryRound(seed);
			expect(JSON.stringify(createMemoryRound(seed, 'memory:classic'))).toBe(
				JSON.stringify(legacy)
			);
			expect(Object.keys(legacy)).toEqual([
				'seed',
				'pairs',
				'cards',
				'revealed',
				'matched',
				'mismatches',
				'moves',
				'status'
			]);
			const moves = matchingMoves(legacy);
			expect(manifest.replay(seed, moves, 10)).toEqual(
				manifest.replay(seed, moves, 10, undefined, 'memory:classic')
			);
		}
		expect(() => createMemoryRound('0', 'block:classic')).toThrow('variant');
	});

	it('uses the classic deck and pair scoring for no-preview and moving', () => {
		const classic = createMemoryRound('42');
		for (const variant of ['memory:no-preview', 'memory:moving']) {
			const round = createMemoryRound('42', variant);
			expect(round.cards).toEqual(classic.cards);
			expect(currentScore(round, 10)).toBe(classic.pairs * 1000 - 50);
		}
	});

	it('only no-preview has zero opening allowance; trios uses the per-card minimum', () => {
		const result = { score: 0, group: '', pairs: 6, moves: 6 };
		expect(manifest.rankedTiming.openingMs(result)).toBe(6250);
		expect(manifest.rankedTiming.openingMs(result, 'memory:no-preview')).toBe(0);
		expect(manifest.rankedTiming.openingMs(result, 'memory:trios')).toBe(6250);
		expect(manifest.rankedTiming.minimumSeconds(result, 'memory:trios')).toBeCloseTo(3.6);
	});

	it('generates three of every symbol and only resolves an attempt after the third flip', () => {
		for (let seed = 0; seed < 30; seed++) {
			const round = createMemoryRound(String(seed), 'memory:trios');
			expect(round.cards).toHaveLength(round.pairs * 3);
			for (const symbol of new Set(round.cards.map((card) => card.symbol)))
				expect(round.cards.filter((card) => card.symbol === symbol)).toHaveLength(3);
			const indices = matchingMoves(round)
				.slice(0, 3)
				.map((move) => move.index);
			const one = flipCard(round, indices[0]);
			const two = flipCard(one.round, indices[1]);
			expect(two.effect).toBe('flip');
			expect(two.round.moves).toBe(0);
			expect(resolveMismatch(two.round)).toBe(two.round);
			const three = flipCard(two.round, indices[2]);
			expect(three.effect).toBe('match');
			expect(three.round.moves).toBe(1);
			expect(three.round.matched).toHaveLength(3);
		}
	});

	it('turns a mixed trio back and counts one mismatch per three-card attempt', () => {
		const round = mismatch(createMemoryRound('42', 'memory:trios'));
		expect(round.revealed).toHaveLength(3);
		expect(round.mismatches).toBe(1);
		expect(round.moves).toBe(1);
		expect(resolveMismatch(round).revealed).toEqual([]);
	});

	it('accepts exactly 18 flips per trio, with no false completion at the cap', () => {
		let round = createMemoryRound('42', 'memory:trios');
		const limit = memoryMoveLimit(round);
		for (let attempt = 0; attempt < limit / 3; attempt++) {
			expect(memoryCapReached(round)).toBe(false);
			round = resolveMismatch(mismatch(round));
		}
		expect(round.moves * 3).toBe(limit);
		expect(memoryCapReached(round)).toBe(true);
		expect(round.status).toBe('playing');
		expect(flipCard(round, 0).effect).toBe('ignored');
		const winning = createMemoryRound('42', 'memory:trios');
		const finalSymbol = winning.cards[0].symbol;
		winning.matched = winning.cards.flatMap((card, index) =>
			card.symbol === finalSymbol ? [] : [index]
		);
		winning.moves = limit / 3 - 1;
		let result = winning;
		for (const move of matchingMoves(winning).filter(
			(move) => !winning.matched.includes(move.index)
		))
			result = flipCard(result, move.index).round;
		expect(result.status).toBe('won');
		expect(memoryCapReached(result)).toBe(false);
	});

	it('continues the generation RNG stream and pins matched and currently revealed cards', () => {
		let round = createMemoryRound('42', 'memory:moving');
		for (const move of matchingMoves(round).slice(0, 2)) round = flipCard(round, move.index).round;
		for (let attempt = 0; attempt < 3; attempt++) {
			const before = round;
			const after = mismatch(round);
			const pinned = [...after.matched, ...after.revealed];
			const positions = before.cards
				.map((_, index) => index)
				.filter((index) => !pinned.includes(index));
			const rng = createRng(before.seed);
			for (let draw = 0; draw < before.rngDraws!; draw++) rng.nextU64();
			const expected = shuffle(
				rng,
				positions.map((index) => before.cards[index])
			);
			for (const index of pinned) expect(after.cards[index]).toEqual(before.cards[index]);
			expect(positions.map((index) => after.cards[index])).toEqual(expected);
			expect(after.rngDraws).toBeGreaterThan(before.rngDraws!);
			round = resolveMismatch(after);
		}
	});

	it('owns separate groups, complete messages, and trio scoring without changing pair scoring', () => {
		expect(new Set(manifest.leaderboardGroups).size).toBe(12);
		for (const variant of manifest.variants) {
			expect(MEMORY_VARIANTS).toContain(variant.id);
			expect(messages[variant.name as keyof typeof messages]).toBeTruthy();
			for (const group of variant.leaderboardGroups)
				expect(manifest.leaderboardGroups).toContain(group);
			const round = createMemoryRound('42', variant.id);
			const replay = manifest.replay(round.seed, matchingMoves(round), 10, undefined, variant.id);
			expect(variant.leaderboardGroups).toContain(replay.group);
			expect(replay.score).toBe(round.pairs * (variant.id === 'memory:trios' ? 1500 : 1000) - 50);
		}
		expect(triosScoring.version).toBe('memory-trios-v1');
		expect(validateScoreValues(triosScoring, { trio: 1800, mismatch: 75, second: 3 })).toEqual({
			trio: 1800,
			mismatch: 75,
			second: 3
		});
		expect(() =>
			validateScoreValues(triosScoring, { pair: 1000, mismatch: 150, second: 5 })
		).toThrow('score_values');
		const round = createMemoryRound('42', 'memory:trios');
		expect(
			manifest.replay(
				round.seed,
				matchingMoves(round),
				10,
				{ trio: 1800, mismatch: 75, second: 3 },
				'memory:trios'
			).score
		).toBe(round.pairs * 1800 - 30);
	});
});
