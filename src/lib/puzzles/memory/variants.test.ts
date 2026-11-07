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
	type MemoryRound,
	type MemoryVariant
} from './logic.js';
import { manifest } from './manifest.js';
import { messages } from './messages.js';
import { quadsScoring, triosScoring } from './scoring.js';

function matchingMoves(round: MemoryRound) {
	return [...new Set(round.cards.map((card) => card.symbol))].flatMap((symbol) =>
		round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
	);
}

/** Plays a miss-free game on the live board, so collapse positions stay correct. */
function solve(seed: string, variant: string) {
	let round = createMemoryRound(seed, variant);
	const moves: { index: number }[] = [];
	while (round.status === 'playing') {
		let live = round.cards.flatMap((card, index) =>
			round.matched.includes(index) ? [] : [{ card, index }]
		);
		if (variant === 'memory:glyph-chain') {
			const activeTier = round.glyphTier ?? 1;
			const target = live.find(({ card }) => card.tier === activeTier);
			if (target) {
				live = live.filter(({ card }) => card.symbol === target.card.symbol);
			}
		}
		if (variant === 'memory:firewall-ice') {
			const unshielded = live.find(({ card }) => !card.isFirewall);
			if (unshielded) {
				live = live.filter(({ card }) => card.symbol === unshielded.card.symbol);
			}
		}
		if (variant === 'memory:zero-trust') {
			const activeTier = round.clearanceTier ?? 1;
			const target = live.find(({ card }) => (card.clearanceTier ?? 1) === activeTier);
			if (target) {
				live = live.filter(({ card }) => card.symbol === target.card.symbol);
			}
		}
		for (const { index } of live.filter(({ card }) => card.symbol === live[0].card.symbol)) {
			if (round.matched.includes(index)) continue;
			moves.push({ index });
			round = flipCard(round, index).round;
		}
	}
	return moves;
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
		expect(new Set(manifest.leaderboardGroups).size).toBe(150);
		for (const variant of manifest.variants) {
			expect(MEMORY_VARIANTS).toContain(variant.id);
			expect(messages[variant.name as keyof typeof messages]).toBeTruthy();
			for (const group of variant.leaderboardGroups)
				expect(manifest.leaderboardGroups).toContain(group);
			const round = createMemoryRound('42', variant.id);
			const replay = manifest.replay(
				round.seed,
				solve(round.seed, variant.id),
				10,
				undefined,
				variant.id
			);
			expect(variant.leaderboardGroups).toContain(replay.group);
			expect(replay.score).toBe(
				round.pairs * ({ 'memory:trios': 1500, 'memory:quads': 2000 }[variant.id] ?? 1000) - 50
			);
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

describe('Memory v1.3.5.5 pilot rules', () => {
	const classicDeck = (seed: string) => createMemoryRound(seed).cards.map((card) => card.id);

	it('keeps the classic deck for the four new pair identities and adds only their own state', () => {
		for (const seed of ['0', '42', '18446744073709551615']) {
			for (const variant of [
				'memory:budget',
				'memory:lockout',
				'memory:swaps',
				'memory:two-backs',
				'memory:collapse'
			]) {
				const round = createMemoryRound(seed, variant);
				expect(round.cards.map((card) => card.id)).toEqual(classicDeck(seed));
				expect(round.variant).toBe(variant);
			}
			expect(createMemoryRound(seed, 'memory:lockout').lock).toBeNull();
			expect(createMemoryRound(seed, 'memory:swaps').marked).toEqual([]);
			expect(createMemoryRound(seed, 'memory:collapse').cleared).toBe(0);
		}
	});

	it('budget gives two attempts per pair, lets the last attempt win and never scores a loss', () => {
		let round = createMemoryRound('42', 'memory:budget');
		const limit = round.pairs * 2;
		expect(memoryMoveLimit(round)).toBe(limit * 2);
		const moves: { index: number }[] = [];
		for (let attempt = 0; attempt < limit; attempt++) {
			expect(memoryCapReached(round)).toBe(false);
			round = mismatch(round);
			moves.push(...round.revealed.map((index) => ({ index })));
			round = resolveMismatch(round);
		}
		expect(memoryCapReached(round)).toBe(true);
		expect(round.status).toBe('playing');
		expect(flipCard(round, 0).effect).toBe('ignored');
		expect(() => manifest.replay('42', moves, 10, undefined, 'memory:budget')).toThrow(
			'incomplete'
		);
		expect(() =>
			manifest.replay('42', [...moves, { index: 0 }], 10, undefined, 'memory:budget')
		).toThrow('move_limit');

		const winning = createMemoryRound('42', 'memory:budget');
		const finalSymbol = winning.cards[0].symbol;
		winning.matched = winning.cards.flatMap((card, index) =>
			card.symbol === finalSymbol ? [] : [index]
		);
		winning.moves = limit - 1;
		let result = winning;
		for (const move of matchingMoves(winning).filter(
			(move) => !winning.matched.includes(move.index)
		))
			result = flipCard(result, move.index).round;
		expect(result.status).toBe('won');
		expect(memoryCapReached(result)).toBe(false);
	});

	it('lockout blocks only the last missed card for exactly one completed attempt', () => {
		let round = createMemoryRound('42', 'memory:lockout');
		round = mismatch(round);
		const locked = round.revealed[1];
		expect(round.lock).toBe(locked);
		round = resolveMismatch(round);
		expect(round.lock).toBe(locked);
		const ignored = flipCard(round, locked);
		expect(ignored.effect).toBe('ignored');
		expect(ignored.round).toBe(round);
		const free = round.cards.map((_, index) => index).filter((index) => index !== locked);
		const first = flipCard(round, free[0]);
		expect(first.round.lock).toBe(locked);
		expect(flipCard(first.round, locked).effect).toBe('ignored');
		const partner = free.find(
			(index) => index !== free[0] && round.cards[index].symbol === round.cards[free[0]].symbol
		)!;
		const matched = flipCard(first.round, partner);
		expect(matched.effect).toBe('match');
		expect(matched.round.lock).toBeNull();
		expect(flipCard(matched.round, locked).effect).toBe('flip');
	});

	it('lockout never locks when fewer than two other unmatched cards remain', () => {
		const round = createMemoryRound('42', 'memory:lockout');
		const pair = round.cards.findIndex((card) => card.symbol !== round.cards[0].symbol);
		round.matched = round.cards.flatMap((_, index) =>
			index === 0 || index === pair ? [] : [index]
		);
		const result = flipCard(flipCard(round, 0).round, pair);
		expect(result.effect).toBe('mismatch');
		expect(result.round.lock).toBeNull();
	});

	it('swaps exchange exactly two hidden unmatched cards from the continued logic stream', () => {
		let round = createMemoryRound('42', 'memory:swaps');
		for (const move of matchingMoves(round).slice(0, 2)) round = flipCard(round, move.index).round;
		for (let attempt = 0; attempt < 4; attempt++) {
			const missed = mismatch(round);
			expect(missed.cards).toEqual(round.cards);
			expect(missed.rngDraws).toBe(round.rngDraws);
			const before = missed.cards;
			const eligible = before
				.map((_, index) => index)
				.filter((index) => !missed.matched.includes(index));
			const rng = createRng(missed.seed);
			for (let draw = 0; draw < missed.rngDraws!; draw++) rng.nextU64();
			const first = rng.nextInt(eligible.length);
			let second = rng.nextInt(eligible.length - 1);
			if (second >= first) second += 1;
			const after = resolveMismatch(missed);
			const changed = before.flatMap((card, index) => (after.cards[index] === card ? [] : [index]));
			expect(changed).toEqual([eligible[first], eligible[second]].sort((a, b) => a - b));
			expect(after.marked).toEqual(changed);
			expect(after.cards[eligible[first]]).toBe(before[eligible[second]]);
			for (const index of missed.matched) expect(after.cards[index]).toBe(before[index]);
			expect(after.rngDraws).toBeGreaterThan(missed.rngDraws!);
			const next = flipCard(after, eligible.find((index) => !changed.includes(index)) ?? 0);
			expect(next.round.marked).toEqual([]);
			round = after;
		}
	});

	it('swaps make no draw and no mark when fewer than two cards can swap', () => {
		const round = createMemoryRound('42', 'memory:swaps');
		round.matched = round.cards.flatMap((_, index) => (index === 1 ? [] : [index]));
		round.revealed = [0, 1];
		const result = resolveMismatch(round);
		expect(result.revealed).toEqual([]);
		expect(result.rngDraws).toBe(round.rngDraws);
		expect(result.marked).toEqual([]);
		expect(result.cards).toBe(round.cards);
	});

	it('two-backs puts one dotted and one striped card in every pair', () => {
		for (const seed of ['0', '42', '18446744073709551615']) {
			const round = createMemoryRound(seed, 'memory:two-backs');
			for (const symbol of new Set(round.cards.map((card) => card.symbol)))
				expect(
					round.cards
						.filter((card) => card.symbol === symbol)
						.map((card) => card.back)
						.sort()
				).toEqual([0, 1]);
			const sameBack = round.cards.findIndex((card, index) =>
				round.cards.some(
					(other, otherIndex) =>
						otherIndex > index && other.back === card.back && other.symbol !== card.symbol
				)
			);
			expect(sameBack).toBeGreaterThanOrEqual(0);
		}
	});

	it('quads match four identical cards over 4/5/6 groups with six attempts each', () => {
		const sizes = new Set<number>();
		for (let seed = 0; seed < 40; seed++) {
			const round = createMemoryRound(String(seed), 'memory:quads');
			sizes.add(round.pairs);
			expect(round.cards).toHaveLength(round.pairs * 4);
			for (const symbol of new Set(round.cards.map((card) => card.symbol)))
				expect(round.cards.filter((card) => card.symbol === symbol)).toHaveLength(4);
			expect(memoryMoveLimit(round)).toBe(round.pairs * 24);
			const indices = matchingMoves(round)
				.slice(0, 4)
				.map((move) => move.index);
			let next = round;
			for (const index of indices.slice(0, 3)) {
				const flipped = flipCard(next, index);
				expect(flipped.effect).toBe('flip');
				expect(resolveMismatch(flipped.round)).toBe(flipped.round);
				next = flipped.round;
			}
			const match = flipCard(next, indices[3]);
			expect(match.effect).toBe('match');
			expect(match.round.moves).toBe(1);
			expect(match.round.matched).toHaveLength(4);
		}
		expect([...sizes].sort()).toEqual([4, 5, 6]);
		const mixed = createMemoryRound('42', 'memory:quads');
		const miss = [0, 1, 2, 3].reduce((round, index) => flipCard(round, index).round, mixed);
		expect(miss.mismatches).toBe(
			mixed.cards.slice(0, 4).every((card) => card.symbol === mixed.cards[0].symbol) ? 0 : 1
		);
		expect(
			manifest.rankedTiming.minimumSeconds(
				{ score: 0, group: '', pairs: 6, moves: 6 },
				'memory:quads'
			)
		).toBeCloseTo(4.8);
		expect(quadsScoring.defaults).toEqual({ quad: 2000, mismatch: 150, second: 5 });
	});

	it('collapse removes matched cards, keeps survivor identity and order, and wins when none remain', () => {
		let round = createMemoryRound('42', 'memory:collapse');
		const order = round.cards.map((card) => card.id);
		const symbol = round.cards[0].symbol;
		const partner = round.cards.findIndex((card, index) => index > 0 && card.symbol === symbol);
		round = flipCard(round, 0).round;
		const result = flipCard(round, partner);
		expect(result.effect).toBe('match');
		expect(result.round.matched).toEqual([]);
		expect(result.round.cleared).toBe(2);
		expect(result.round.cards.map((card) => card.id)).toEqual(
			order.filter((id) => !id.startsWith(`${symbol}:`))
		);
		const moves = solve('42', 'memory:collapse');
		const final = manifest.resumeRound!('42', moves, undefined, 'memory:collapse') as MemoryRound;
		expect(final.status).toBe('won');
		expect(final.cards).toHaveLength(0);
		expect(manifest.replay('42', moves, 10, undefined, 'memory:collapse').group).toBe(
			`memory-1:collapse:${final.pairs}`
		);
	});

	it('replays every new identity from seed and accepted flips alone', () => {
		for (const variant of [
			'memory:budget',
			'memory:lockout',
			'memory:swaps',
			'memory:two-backs',
			'memory:collapse'
		] as MemoryVariant[]) {
			for (const seed of ['0', '42', '99']) {
				let round = createMemoryRound(seed, variant);
				const moves: { index: number }[] = [];
				for (
					let attempt = 0;
					attempt < 16 && round.status === 'playing' && !memoryCapReached(round);
					attempt++
				) {
					if (round.revealed.length === 2) round = resolveMismatch(round);
					const open = round.cards
						.map((_, index) => index)
						.filter((index) => !round.matched.includes(index) && index !== round.lock);
					const pairs = open.flatMap((i) =>
						open
							.filter((j) => j > i && round.cards[j].symbol === round.cards[i].symbol)
							.map((j) => [i, j])
					);
					const miss = open.flatMap((i) =>
						open
							.filter((j) => j > i && round.cards[j].symbol !== round.cards[i].symbol)
							.map((j) => [i, j])
					);
					const [a, b] = (attempt % 2 === 0 ? miss : pairs)[0] ?? miss[0] ?? pairs[0];
					for (const index of [a, b]) {
						moves.push({ index });
						round = flipCard(round, index).round;
					}
				}
				expect(
					JSON.parse(JSON.stringify(manifest.resumeRound!(seed, moves, undefined, variant)))
				).toEqual(JSON.parse(JSON.stringify(round)));
			}
		}
	});

	it('correctly implements the 10 Batch A ruleset mechanics', () => {
		// 1. Countdown
		const cd = createMemoryRound('42', 'memory:countdown');
		expect(cd.timeLimit).toBeGreaterThanOrEqual(60);

		// 2. Three Strikes
		let ts = createMemoryRound('42', 'memory:three-strikes');
		expect(ts.lives).toBe(3);
		ts = mismatch(ts);
		expect(ts.lives).toBe(2);
		ts = resolveMismatch(ts);
		ts = mismatch(ts);
		expect(ts.lives).toBe(1);
		ts = resolveMismatch(ts);
		ts = mismatch(ts);
		expect(ts.lives).toBe(0);
		expect(ts.status).toBe('lost');

		// 3. Wild Card
		const wc = createMemoryRound('42', 'memory:wild-card');
		const wildIdx = wc.cards.findIndex((c) => c.isWild);
		expect(wildIdx).toBeGreaterThanOrEqual(0);
		const nonWildIdx = wc.cards.findIndex((c, i) => i !== wildIdx);
		const resWc = flipCard(flipCard(wc, wildIdx).round, nonWildIdx);
		expect(resWc.effect).toBe('match');

		// 4. Sonar
		const sn = createMemoryRound('42', 'memory:sonar');
		const snPair = [0, sn.cards.findIndex((c, i) => i > 0 && c.symbol === sn.cards[0].symbol)];
		const resSn = flipCard(flipCard(sn, snPair[0]).round, snPair[1]);
		expect(resSn.effect).toBe('match');
		expect(Array.isArray(resSn.round.sonar)).toBe(true);

		// 5. Zebra
		const zb = createMemoryRound('42', 'memory:zebra');
		const zb0 = zb.cards[0];
		const sameColor = zb.cards.findIndex(
			(c, i) => i > 0 && c.symbol === zb0.symbol && c.zebra === zb0.zebra
		);
		expect(sameColor).toBe(-1); // no duplicate colors for same symbol
		const diffColor = zb.cards.findIndex(
			(c, i) => i > 0 && c.symbol === zb0.symbol && c.zebra !== zb0.zebra
		);
		expect(diffColor).toBeGreaterThan(0);
		const resZb = flipCard(flipCard(zb, 0).round, diffColor);
		expect(resZb.effect).toBe('match');

		// 6. Drift
		let df = createMemoryRound('42', 'memory:drift');
		const card0 = df.cards[0];
		df = mismatch(df);
		df = resolveMismatch(df);
		// Row 0 shifted right
		expect(df.cards[1].id).toBe(card0.id);

		// 7. Decay
		let dc = createMemoryRound('42', 'memory:decay');
		dc = mismatch(dc);
		dc = resolveMismatch(dc);
		expect(Object.keys(dc.decay ?? {}).length).toBe(2);

		// 8. One Flip
		const of = createMemoryRound('42', 'memory:one-flip');
		const resOf1 = flipCard(of, 0);
		expect(resOf1.effect).toBe('flip');
		expect(resOf1.round.revealed).toEqual([0]);

		// 9. Combo
		const cb = createMemoryRound('42', 'memory:combo');
		expect(cb.combo).toBe(1);
		const cbPair = [0, cb.cards.findIndex((c, i) => i > 0 && c.symbol === cb.cards[0].symbol)];
		const resCb = flipCard(flipCard(cb, cbPair[0]).round, cbPair[1]);
		expect(resCb.round.combo).toBe(2);

		// 10. Hazard
		const hz = createMemoryRound('42', 'memory:hazard');
		const hzIdx = hz.cards.findIndex((c) => c.isHazard);
		expect(hzIdx).toBeGreaterThanOrEqual(0);
		const otherHz = hz.cards.findIndex((c, i) => i > hzIdx && c.isHazard);
		expect(otherHz).toBeGreaterThan(hzIdx);
		const resHz = flipCard(flipCard(hz, hzIdx).round, otherHz);
		expect(resHz.effect).toBe('match');
	});

	it('verifies Batch B 10 exploration ruleset mechanics', () => {
		// 1. Superstorm
		let ss = createMemoryRound('42', 'memory:superstorm');
		for (let i = 0; i < 4; i++) {
			ss = mismatch(ss);
			ss = resolveMismatch(ss);
		}
		expect(ss.stormFrostedRow).toBeGreaterThanOrEqual(0);
		const lockedCardIdx = ss.stormFrostedRow! * 4;
		expect(flipCard(ss, lockedCardIdx).effect).toBe('ignored');

		// 2. Sentinel Heat
		let sh = createMemoryRound('42', 'memory:sentinel-heat');
		expect(sh.sentinelHeat).toBe(0);
		sh = mismatch(sh);
		expect(sh.sentinelHeat).toBe(1);
		sh = resolveMismatch(sh);
		sh = mismatch(sh);
		expect(sh.sentinelHeat).toBe(2);
		sh = resolveMismatch(sh);
		sh = mismatch(sh);
		expect(sh.sentinelHeat).toBe(3);
		expect(sh.lock).not.toBeNull();

		// 3. Glyph Chain
		const gc = createMemoryRound('42', 'memory:glyph-chain');
		expect(gc.glyphTier).toBe(1);
		const tier2Card = gc.cards.findIndex((c) => c.tier === 2);
		const otherTier2 = gc.cards.findIndex(
			(c, i) => i > tier2Card && c.symbol === gc.cards[tier2Card].symbol
		);
		if (tier2Card >= 0 && otherTier2 >= 0) {
			const resGc = flipCard(flipCard(gc, tier2Card).round, otherTier2);
			expect(resGc.effect).toBe('mismatch'); // out of tier order
		}

		// 4. Analysis Visor
		const av = createMemoryRound('42', 'memory:analysis-visor');
		expect(av.cards[0].spectral).toBeDefined();

		// 5. Life Support
		const ls = createMemoryRound('42', 'memory:life-support');
		expect(ls.lifeSupport).toBe(100);
		const resLs = flipCard(ls, 0);
		expect(resLs.round.lifeSupport).toBe(97);

		// 6. Hyperdrive Warp
		const hw = createMemoryRound('42', 'memory:hyperdrive-warp');
		const anomalyIdx = hw.cards.findIndex((c) => c.isAnomaly);
		expect(anomalyIdx).toBeGreaterThanOrEqual(0);

		// 7. Gravitino Risk
		const gr = createMemoryRound('42', 'memory:gravitino-risk');
		const gravIdx = gr.cards.findIndex((c) => c.isGravitino);
		expect(gravIdx).toBeGreaterThanOrEqual(0);

		// 8. Pulse Drive
		const pd = createMemoryRound('42', 'memory:pulse-drive');
		expect(pd.pulseStreak).toBe(1);
		const pdPair = [0, pd.cards.findIndex((c, i) => i > 0 && c.symbol === pd.cards[0].symbol)];
		const resPd = flipCard(flipCard(pd, pdPair[0]).round, pdPair[1]);
		expect(resPd.round.pulseStreak).toBe(2);

		// 9. Derelict Fog
		const df = createMemoryRound('42', 'memory:derelict-fog');
		const resDf = flipCard(df, 0);
		expect(resDf.round.illuminated).toBeDefined();
		expect(resDf.round.illuminated!.length).toBeGreaterThan(1);

		// 10. Atlas Terminal
		const at = createMemoryRound('42', 'memory:atlas-terminal');
		expect(at.cards.length).toBeGreaterThanOrEqual(12);
	});

	it('verifies Batch C 10 network & cybernetic protocol ruleset mechanics', () => {
		// 1. Edge Cache
		let ec = createMemoryRound('42', 'memory:edge-cache');
		expect(ec.edgeCache).toEqual({});
		ec = mismatch(ec);
		expect(Object.keys(ec.edgeCache ?? {}).length).toBe(2);
		ec = resolveMismatch(ec);
		expect(Object.keys(ec.edgeCache ?? {}).length).toBe(2);

		// 2. Quantum Entangle
		const qe = createMemoryRound('42', 'memory:quantum-entangle');
		const qIdx = qe.cards.findIndex((c) => c.isQuantum);
		expect(qIdx).toBeGreaterThanOrEqual(0);
		const resQe = flipCard(qe, qIdx);
		expect(resQe.effect).toBe('match'); // twin flipped together

		// 3. Rate Limiter
		let rl = createMemoryRound('42', 'memory:rate-limiter');
		expect(rl.rateLimited).toBe(false);
		rl = mismatch(rl);
		rl = resolveMismatch(rl);
		rl = mismatch(rl);
		rl = resolveMismatch(rl);
		rl = mismatch(rl);
		expect(rl.rateLimited).toBe(true);

		// 4. Register Buffer
		const rb = createMemoryRound('42', 'memory:register-buffer');
		const card0 = rb.cards[0];
		const partnerIdx = rb.cards.findIndex((c, i) => i > 0 && c.symbol === card0.symbol);
		// Flip card 0, then flip card 0 again to stash in buffer
		const f1 = flipCard(rb, 0).round;
		const fStash = flipCard(f1, 0).round;
		expect(fStash.bufferCard?.symbol).toBe(card0.symbol);
		expect(fStash.matched).toContain(0);
		// Later flip partner -> matches directly with buffer!
		const fMatch = flipCard(fStash, partnerIdx);
		expect(fMatch.effect).toBe('match');
		expect(fMatch.round.bufferCard).toBeNull();

		// 5. Firewall ICE
		const fi = createMemoryRound('42', 'memory:firewall-ice');
		const fwIdx = fi.cards.findIndex((c) => c.isFirewall);
		expect(fwIdx).toBeGreaterThanOrEqual(0);
		expect(flipCard(fi, fwIdx).effect).toBe('ignored');

		// 6. Anycast Route
		let ar = createMemoryRound('42', 'memory:anycast-route');
		const initialFirst = ar.cards[0].id;
		ar = mismatch(ar);
		ar = resolveMismatch(ar);
		ar = mismatch(ar);
		ar = resolveMismatch(ar);
		ar = mismatch(ar);
		expect(ar.cards[0].id).not.toBe(initialFirst);

		// 7. TLS Handshake
		const tls = createMemoryRound('42', 'memory:tls-handshake');
		const synCard = tls.cards.find((c) => c.tlsStage === 'syn');
		const ackCard = tls.cards.find((c) => c.tlsStage === 'ack');
		expect(synCard).toBeDefined();
		expect(ackCard).toBeDefined();

		// 8. Trace Route
		let tr = createMemoryRound('42', 'memory:trace-route');
		expect(tr.traceMeter).toBe(0);
		tr = mismatch(tr);
		expect(tr.traceMeter).toBe(15);

		// 9. Bit Rot
		let br = createMemoryRound('42', 'memory:bit-rot');
		expect(br.bitRot).toEqual({});
		br = mismatch(br);
		expect(Object.keys(br.bitRot ?? {}).length).toBe(2);

		// 10. Burst Transmission
		const bt = createMemoryRound('42', 'memory:burst-transmission');
		expect(bt.burstStreak).toBe(0);
		const p1 = [0, bt.cards.findIndex((c, i) => i > 0 && c.symbol === bt.cards[0].symbol)];
		const res1 = flipCard(flipCard(bt, p1[0]).round, p1[1]).round;
		expect(res1.burstStreak).toBe(1);
		const remaining = res1.cards.findIndex((c, i) => !res1.matched.includes(i));
		const p2 = [
			remaining,
			res1.cards.findIndex(
				(c, i) =>
					i !== remaining && !res1.matched.includes(i) && c.symbol === res1.cards[remaining].symbol
			)
		];
		const res2 = flipCard(flipCard(res1, p2[0]).round, p2[1]).round;
		expect(res2.burstStreak).toBe(2);
		expect(res2.burstPing).toBeDefined();
		expect(res2.burstPing!.length).toBe(3);
	});

	it('verifies Batch D 10 distributed cloud & edge architecture ruleset mechanics', () => {
		// 1. KV Consistency
		let kv = createMemoryRound('42', 'memory:kv-consistency');
		expect(kv.kvReplicas).toEqual({});
		kv = mismatch(kv);
		expect(Object.keys(kv.kvReplicas ?? {}).length).toBe(2);

		// 2. Durable Object Actor Row Lock
		const doRound = createMemoryRound('42', 'memory:durable-object');
		expect(doRound.lockedActorRow).toBeNull();
		const f1 = flipCard(doRound, 0).round;
		expect(f1.lockedActorRow).toBe(0);
		// Same row (index 1) should be ignored due to actor lock
		const sameRowFlip = flipCard(f1, 1);
		expect(sameRowFlip.effect).toBe('ignored');
		// Different row (index 4 = row 1) should proceed
		const diffRowFlip = flipCard(f1, 4);
		expect(diffRowFlip.effect).not.toBe('ignored');

		// 3. Vectorize KNN Semantic Clustering
		const vec = createMemoryRound('42', 'memory:vectorize-knn');
		const c0 = vec.cards[0];
		expect(c0.vectorCluster).toBeDefined();
		const sameClusterIdx = vec.cards.findIndex(
			(c, i) => i > 0 && c.vectorCluster === c0.vectorCluster
		);
		expect(sameClusterIdx).toBeGreaterThan(0);
		const vecMatch = flipCard(flipCard(vec, 0).round, sameClusterIdx);
		expect(vecMatch.effect).toBe('match');

		// 4. FIFO Queue & DLQ Shelf
		let fq = createMemoryRound('42', 'memory:fifo-queue');
		expect(fq.dlqQueue).toEqual([]);
		fq = mismatch(fq);
		expect(fq.dlqQueue!.length).toBe(1);

		// 5. Workers AI Token Budget
		let ai = createMemoryRound('42', 'memory:ai-tokens');
		expect(ai.aiTokens).toBe(120);
		ai = flipCard(ai, 0).round;
		expect(ai.aiTokens).toBe(116); // 120 - 4
		ai = mismatch(ai);
		expect(ai.aiTokens).toBe(104); // 116 - 4 (second flip) - 8 (mismatch)

		// 6. Hyperdrive Connection Pool Multipliers
		let hd = createMemoryRound('42', 'memory:hyperdrive-pool');
		expect(hd.hyperdriveMultiplier).toBe(2);
		hd = mismatch(hd);
		expect(hd.hyperdriveMultiplier).toBe(1); // reset to cold

		// 7. Turnstile Bot Challenge Gate
		let tv = createMemoryRound('42', 'memory:turnstile-verify');
		expect(tv.turnstileActive).toBe(false);
		tv = mismatch(tv);
		tv = resolveMismatch(tv);
		tv = mismatch(tv);
		tv = resolveMismatch(tv);
		tv = mismatch(tv);
		tv = resolveMismatch(tv);
		tv = mismatch(tv);
		expect(tv.turnstileActive).toBe(true); // 4th mismatch triggers challenge

		// 8. Zero Trust RBAC Clearance Gating
		const zt = createMemoryRound('42', 'memory:zero-trust');
		expect(zt.clearanceTier).toBe(1);
		const t2Idx = zt.cards.findIndex((c) => c.clearanceTier === 2);
		expect(t2Idx).toBeGreaterThanOrEqual(0);
		expect(flipCard(zt, t2Idx).effect).toBe('ignored'); // Tier 2 blocked initially

		// 9. Argo Smart Routing Dynamic Reroute
		const argo = createMemoryRound('42', 'memory:argo-reroute');
		expect(argo.quadrantHits).toBeDefined();

		// 10. R2 Glacier Cold Archive
		let r2 = createMemoryRound('42', 'memory:r2-glacier');
		expect(r2.glacierUntouched).toBeDefined();
		for (let i = 0; i < 4; i++) {
			r2 = mismatch(r2);
			r2 = resolveMismatch(r2);
		}
		const glaciatedCount = r2.cards.filter((c) => c.isGlaciated).length;
		expect(glaciatedCount).toBeGreaterThan(0);
	});
});
