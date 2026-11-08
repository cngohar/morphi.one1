import { describe, expect, it } from 'vitest';
import {
	MEMORY_TIME_STRATA_MAX_ACTIONS,
	MEMORY_STRATA_VARIANTS,
	timeStrataCanSelect,
	timeStrataClues,
	applyMemoryMove,
	createMemoryRound,
	flipCard,
	isFaceUp,
	memoryCapReached,
	memoryMoveLimit,
	resolveMismatch,
	scoreFor,
	timeStrataOutcome,
	timeStrataTops,
	type MemoryMove,
	type MemoryRound
} from './logic.js';
import { manifest } from './manifest.js';
import batchH from '../../../../tests/vectors/memory-batch-h.json';

const variant = 'memory:time-strata';

function exposedPairs(round: MemoryRound): number[][] {
	const tops = timeStrataTops(round).filter((index) => index >= 0);
	return tops.flatMap((first, offset) =>
		tops
			.slice(offset + 1)
			.flatMap((second) =>
				round.cards[first].symbol === round.cards[second].symbol ? [[first, second]] : []
			)
	);
}

function solve(initial: MemoryRound, moves: MemoryMove[] = []) {
	let round = initial;
	while (round.status === 'playing') {
		const pair = exposedPairs(round)[0];
		expect(pair).toBeDefined();
		for (const move of [{ index: pair[0] }, { index: pair[1] }, { continue: 1 }] as MemoryMove[]) {
			moves.push(move);
			round = applyMemoryMove(round, move).round;
		}
	}
	return { round, moves };
}

describe('Time Strata', () => {
	it('constructs balanced seeded deals that stay solvable after every possible exposed match', () => {
		const counts = new Set<number>();
		for (let seed = 0; seed < 32; seed += 1) {
			const initial = createMemoryRound(String(seed * 7919), variant);
			const serialized = JSON.stringify(initial);
			counts.add(initial.pairs);
			expect(createMemoryRound(initial.seed, variant)).toEqual(initial);
			expect(initial.stacks!.map((stack) => stack.length)).toEqual(
				Array(4).fill(initial.pairs / 2)
			);
			expect(initial.stacks!.flat().sort((a, b) => a - b)).toEqual(
				initial.cards.map((_, index) => index)
			);
			expect(new Set(initial.cards.map((card) => card.id)).size).toBe(initial.pairs * 2);
			for (const symbol of new Set(initial.cards.map((card) => card.symbol))) {
				expect(initial.cards.filter((card) => card.symbol === symbol)).toHaveLength(2);
			}
			const visited = new Set<string>();
			function explore(round: MemoryRound): void {
				const key = round.matched.join(',');
				if (visited.has(key)) return;
				visited.add(key);
				if (round.status === 'won') {
					expect(timeStrataTops(round)).toEqual([-1, -1, -1, -1]);
					expect(round.moves).toBe(round.pairs);
					return;
				}
				const pairs = exposedPairs(round);
				expect(pairs.length).toBeGreaterThan(0);
				for (const [first, second] of pairs) {
					const pending = flipCard(flipCard(round, first).round, second).round;
					expect(timeStrataOutcome(pending)).toBe('match');
					expect(pending.status).toBe('playing');
					expect(pending.stacks).toBe(round.stacks);
					expect(pending.matched).toEqual(round.matched);
					expect(resolveMismatch(pending)).toBe(pending);
					const next = applyMemoryMove(pending, { continue: 1 }).round;
					expect(next.cards).toBe(initial.cards);
					expect(next.matched).toHaveLength(round.matched.length + 2);
					for (const top of timeStrataTops(next).filter((index) => index >= 0)) {
						expect(isFaceUp(next, top)).toBe(false);
					}
					explore(next);
				}
			}
			explore(initial);
			expect(JSON.stringify(initial)).toBe(serialized);
		}
		expect([...counts].sort((a, b) => a - b)).toEqual([6, 8, 10]);
	});

	it('rejects covered, repeated and premature actions; a single reveal cancels for free', () => {
		const initial = createMemoryRound('42', variant);
		const tops = timeStrataTops(initial);
		for (const index of [initial.stacks![0][0], -1, initial.cards.length, 0.5, NaN]) {
			expect(flipCard(initial, index)).toEqual({ round: initial, effect: 'ignored' });
		}
		for (const move of [{ cancel: 1 }, { continue: 1 }] as MemoryMove[]) {
			expect(applyMemoryMove(initial, move).effect).toBe('ignored');
		}
		const selected = flipCard(initial, tops[0]).round;
		expect(selected.revealed).toEqual([tops[0]]);
		expect(flipCard(selected, tops[0]).effect).toBe('ignored');
		expect(flipCard(selected, initial.stacks![0].at(-2)!).effect).toBe('ignored');
		expect(applyMemoryMove(selected, { continue: 1 }).effect).toBe('ignored');
		const cancelled = applyMemoryMove(selected, { cancel: 1 });
		expect(cancelled.effect).toBe('cancel');
		expect(cancelled.round).toEqual({ ...initial, actions: 2 });
		expect(applyMemoryMove(createMemoryRound('42'), { cancel: 1 }).effect).toBe('ignored');
		expect(applyMemoryMove(createMemoryRound('42'), { continue: 1 }).effect).toBe('ignored');
		const pending = flipCard(selected, tops[1]).round;
		expect(applyMemoryMove(pending, { cancel: 1 }).effect).toBe('ignored');
		expect(flipCard(pending, tops[2]).effect).toBe('ignored');
	});

	it('counts controls against the transport ceiling and reserves room for a final Continue', () => {
		const initial = createMemoryRound('42', variant);
		expect(memoryMoveLimit(initial)).toBe(MEMORY_TIME_STRATA_MAX_ACTIONS);
		const selected = flipCard(initial, timeStrataTops(initial)[0]).round;
		expect(selected.actions).toBe(1);
		const cancelled = applyMemoryMove(selected, { cancel: 1 }).round;
		expect(cancelled.actions).toBe(2);
		expect(cancelled.moves).toBe(0);
		const blocked = { ...initial, actions: MEMORY_TIME_STRATA_MAX_ACTIONS - 2 };
		expect(memoryCapReached(blocked)).toBe(true);
		expect(flipCard(blocked, timeStrataTops(blocked)[0]).effect).toBe('ignored');
		let round = initial;
		while (round.matched.length < round.cards.length - 2) {
			const [first, second] = exposedPairs(round)[0];
			round = applyMemoryMove(flipCard(flipCard(round, first).round, second).round, {
				continue: 1
			}).round;
		}
		round = { ...round, actions: MEMORY_TIME_STRATA_MAX_ACTIONS - 3 };
		const [first, second] = exposedPairs(round)[0];
		const pending = flipCard(flipCard(round, first).round, second).round;
		expect(pending.actions).toBe(MEMORY_TIME_STRATA_MAX_ACTIONS - 1);
		expect(memoryCapReached(pending)).toBe(false);
		const won = applyMemoryMove(pending, { continue: 1 }).round;
		expect(won.actions).toBe(MEMORY_TIME_STRATA_MAX_ACTIONS);
		expect(won.status).toBe('won');
		expect(memoryCapReached(won)).toBe(false);
	});

	it('holds readable mismatches without changing layers and wins only on the final Continue', () => {
		const initial = createMemoryRound('42', variant);
		const tops = timeStrataTops(initial);
		const first = tops[0];
		const second = tops.find(
			(index) => initial.cards[index].symbol !== initial.cards[first].symbol
		)!;
		const pending = flipCard(flipCard(initial, first).round, second).round;
		expect(timeStrataOutcome(pending)).toBe('mismatch');
		expect(pending.moves).toBe(1);
		expect(pending.mismatches).toBe(1);
		expect(pending.stacks).toBe(initial.stacks);
		expect(pending.revealed).toEqual([first, second]);
		expect(resolveMismatch(pending)).toBe(pending);
		const continued = applyMemoryMove(pending, { continue: 1 });
		expect(continued.effect).toBe('continue');
		expect(continued.round.stacks).toBe(initial.stacks);
		expect(continued.round.revealed).toEqual([]);
		expect(continued.round.matched).toEqual([]);
		let round = continued.round;
		while (round.matched.length < round.cards.length - 2) {
			const [a, b] = exposedPairs(round)[0];
			round = applyMemoryMove(flipCard(flipCard(round, a).round, b).round, { continue: 1 }).round;
		}
		const [a, b] = exposedPairs(round)[0];
		const finalPending = flipCard(flipCard(round, a).round, b).round;
		expect(finalPending.status).toBe('playing');
		expect(finalPending.matched).toHaveLength(finalPending.cards.length - 2);
		const final = applyMemoryMove(finalPending, { continue: 1 });
		expect(final.effect).toBe('win');
		expect(final.round.status).toBe('won');
		expect(final.round.moves).toBe(final.round.pairs + 1);
		expect(applyMemoryMove(final.round, { continue: 1 }).effect).toBe('ignored');
	});

	it('replays explicit controls and pending checkpoints, rejecting forged or incomplete logs', () => {
		const seed = '42';
		const initial = createMemoryRound(seed, variant);
		const tops = timeStrataTops(initial);
		const miss = tops.find(
			(index) => initial.cards[index].symbol !== initial.cards[tops[0]].symbol
		)!;
		const moves: MemoryMove[] = [
			{ index: tops[0] },
			{ cancel: 1 },
			{ index: tops[0] },
			{ index: miss },
			{ continue: 1 }
		];
		let round = initial;
		for (const move of moves) round = applyMemoryMove(round, move).round;
		const solved = solve(round, moves);
		round = initial;
		for (let offset = 0; offset < moves.length; offset += 1) {
			round = applyMemoryMove(round, moves[offset]).round;
			expect(manifest.resumeRound(seed, moves.slice(0, offset + 1), undefined, variant)).toEqual(
				round
			);
		}
		expect(round).toEqual(solved.round);
		expect(manifest.replay(seed, moves, 10, undefined, variant)).toEqual({
			score: scoreFor(initial.pairs, 1, 10),
			group: `memory-1:time-strata:${initial.pairs}`,
			pairs: initial.pairs,
			moves: initial.pairs + 1
		});
		expect(() => manifest.replay(seed, moves.slice(0, -1), 10, undefined, variant)).toThrow(
			'incomplete'
		);
		for (const forged of [
			[{ continue: 1 }],
			[{ cancel: 1 }],
			[{ index: initial.stacks![0][0] }],
			[{ index: tops[0] }, { index: tops[0] }],
			[{ index: tops[0] }, { index: miss }, { index: tops[2] }],
			[{ index: tops[0], cancel: 1 }],
			[{ cancel: 0 }],
			[{ continue: 2 }],
			[...moves, { continue: 1 }]
		]) {
			expect(() => manifest.resumeRound(seed, forged, undefined, variant)).toThrow('move');
		}
		expect(() => manifest.resumeRound(seed, [{ cancel: 1 }], undefined, 'memory:classic')).toThrow(
			'move'
		);
	});
});

function batchHState(round: MemoryRound) {
	return {
		stacks: round.stacks,
		revealed: round.revealed,
		matched: round.matched,
		mismatches: round.mismatches,
		moves: round.moves,
		actions: round.actions,
		status: round.status,
		shelf: round.shelf ?? null,
		echo: round.echo ?? null,
		chain: round.chain ?? null,
		excavationOrder: round.excavationOrder ?? null,
		orderCursor: round.orderCursor ?? null
	};
}

function confirmedPair(round: MemoryRound, first: number, second: number): MemoryRound {
	return applyMemoryMove(flipCard(flipCard(round, first).round, second).round, { continue: 1 })
		.round;
}

describe('Time Strata Batch H', () => {
	it('pins thirty independently authored deals, held checkpoints and full authoritative replay routes', () => {
		for (const vector of batchH) {
			const initial = createMemoryRound(vector.seed, vector.variant);
			const serialized = JSON.stringify(initial);
			expect(initial.pairs).toBe(vector.pairs);
			expect(initial.cards.map((card) => card.id)).toEqual(vector.deck);
			expect(initial.stacks).toEqual(vector.stacks);
			expect(initial.stacks!.map((well) => well.length)).toEqual(Array(4).fill(vector.pairs / 2));
			let round = initial;
			for (let offset = 0; offset < vector.moves.length; offset += 1) {
				const move = manifest.parseMove(vector.moves[offset]);
				const result = applyMemoryMove(round, move as MemoryMove);
				expect(result.effect).not.toBe('ignored');
				round = result.round;
				const remaining = [...round.stacks!.flat(), ...(round.shelf ? [round.shelf.index] : [])];
				expect([...remaining, ...round.matched].sort((a, b) => a - b)).toEqual(
					initial.cards.map((_, index) => index)
				);
				expect(new Set(remaining).size).toBe(remaining.length);
				expect(
					manifest.resumeRound(
						vector.seed,
						vector.moves.slice(0, offset + 1),
						undefined,
						vector.variant
					)
				).toEqual(round);
				if (offset + 1 === vector.checkpointMoves.length)
					expect(batchHState(round)).toEqual(vector.checkpoint);
			}
			expect(round.status).toBe('won');
			expect(round.actions).toBe(vector.moves.length);
			expect(manifest.replay(vector.seed, vector.moves, 10, undefined, vector.variant)).toEqual(
				vector.result
			);
			expect(() =>
				manifest.replay(vector.seed, vector.moves.slice(0, -1), 10, undefined, vector.variant)
			).toThrow('incomplete');
			expect(JSON.stringify(initial)).toBe(serialized);
		}
	});

	it('keeps the logical neighbor ring and tallest-layer gate independent of visible equality', () => {
		const linked = createMemoryRound('3', 'memory:strata-linked');
		const tops = timeStrataTops(linked);
		const selected = flipCard(linked, tops[0]).round;
		expect(timeStrataCanSelect(selected, tops[2])).toBe(false);
		expect(flipCard(selected, tops[2])).toEqual({ round: selected, effect: 'ignored' });
		expect(timeStrataCanSelect(selected, tops[1])).toBe(true);
		expect(timeStrataCanSelect(selected, tops[3])).toBe(true);
		const sweep = createMemoryRound('3', 'memory:strata-sweep');
		const swept = confirmedPair(sweep, timeStrataTops(sweep)[0], timeStrataTops(sweep)[1]);
		const lower = timeStrataTops(swept);
		expect(swept.cards[lower[0]].symbol).toBe(swept.cards[lower[1]].symbol);
		expect(timeStrataCanSelect(swept, lower[0])).toBe(false);
		expect(flipCard(swept, lower[0]).effect).toBe('ignored');
		expect(timeStrataCanSelect(swept, lower[2])).toBe(true);
	});

	it('returns a visible sample after mismatch and deeper removals without overwriting its shelf', () => {
		const initial = createMemoryRound('3', 'memory:strata-shelf');
		const sample = initial.stacks![0].at(-1)!;
		let round = applyMemoryMove(initial, { lift: 0 }).round;
		expect(round.shelf).toEqual({ index: sample, stack: 0 });
		expect(isFaceUp(round, sample)).toBe(true);
		expect(applyMemoryMove(round, { lift: 1 }).effect).toBe('ignored');
		const selected = flipCard(round, sample).round;
		expect(applyMemoryMove(selected, { return: 1 }).effect).toBe('ignored');
		round = applyMemoryMove(selected, { cancel: 1 }).round;
		expect(round.shelf?.index).toBe(sample);
		const mismatch = timeStrataTops(round).find(
			(index) => round.cards[index].symbol !== round.cards[sample].symbol
		)!;
		round = confirmedPair(round, sample, mismatch);
		expect(round.shelf?.index).toBe(sample);
		expect(round.mismatches).toBe(1);
		// Clear F, then the covered C revealed by the lift; E returns above the remaining A.
		round = confirmedPair(round, 10, 11);
		round = confirmedPair(round, 4, 5);
		const remaining = round.stacks![0].slice();
		round = applyMemoryMove(round, { return: 1 }).round;
		expect(round.stacks![0]).toEqual([...remaining, sample]);
		expect(round.shelf).toBeNull();
		expect(round.moves).toBe(3);
	});

	it('moves only to an empty destination and persists manual or mismatching rotations', () => {
		let empty = createMemoryRound('3', 'memory:strata-empty-well');
		expect(applyMemoryMove(empty, { from: 0, to: 1 }).effect).toBe('ignored');
		while (empty.stacks![0].length)
			empty = confirmedPair(empty, timeStrataTops(empty)[0], timeStrataTops(empty)[1]);
		const source = empty.stacks![2];
		const moved = applyMemoryMove(empty, { from: 2, to: 0 }).round;
		expect(moved.stacks![0]).toEqual([source.at(-1)]);
		expect(moved.stacks![2]).toEqual(source.slice(0, -1));
		expect(moved.moves).toBe(empty.moves);
		expect(applyMemoryMove(moved, { from: 2, to: 0 }).effect).toBe('ignored');
		const slip = createMemoryRound('3', 'memory:strata-slip');
		const first = timeStrataTops(slip)[0];
		const second = timeStrataTops(slip).find(
			(index) => slip.cards[index].symbol !== slip.cards[first].symbol
		)!;
		const slipped = confirmedPair(slip, first, second);
		for (const [stack, well] of slip.stacks!.entries()) {
			expect(slipped.stacks![stack]).toEqual(
				[first, second].includes(well.at(-1)!) ? [well.at(-1), ...well.slice(0, -1)] : well
			);
		}
		const cycled = applyMemoryMove(slipped, { cycle: 0 }).round;
		expect(cycled.stacks![0]).toEqual([
			slipped.stacks![0].at(-1),
			...slipped.stacks![0].slice(0, -1)
		]);
		expect(cycled.moves).toBe(slipped.moves);
	});

	it('keeps clue phases read-only and requires one counted Continue per chained pair', () => {
		const glimpse = createMemoryRound('3', 'memory:strata-glimpse');
		const top = timeStrataTops(glimpse)[0];
		const selected = flipCard(glimpse, top).round;
		expect(timeStrataClues(selected)).toEqual([glimpse.stacks![0].at(-2)]);
		expect(timeStrataCanSelect(selected, glimpse.stacks![0].at(-2)!)).toBe(false);
		expect(timeStrataClues(applyMemoryMove(selected, { cancel: 1 }).round)).toEqual([]);
		const echo = createMemoryRound('3', 'memory:strata-echo');
		const echoed = confirmedPair(echo, 10, 11);
		expect(echoed.echo).toEqual([5, 7]);
		expect(timeStrataClues(echoed)).toEqual(echoed.echo);
		for (const index of timeStrataTops(echoed))
			expect(flipCard(echoed, index).effect).toBe('ignored');
		expect(applyMemoryMove(echoed, { cancel: 1 }).effect).toBe('ignored');
		const closed = applyMemoryMove(echoed, { continue: 1 }).round;
		expect(closed.moves).toBe(echoed.moves);
		expect(closed.echo).toEqual([]);
		const chain = createMemoryRound('3', 'memory:strata-chain');
		const chained = confirmedPair(chain, 8, 9);
		expect(chained.chain).toBe(true);
		expect(chained.revealed).toEqual([4, 5]);
		expect(chained.moves).toBe(2);
		expect(chained.matched).toEqual([8, 9]);
		expect(applyMemoryMove(chained, { cancel: 1 }).effect).toBe('ignored');
		const deeper = applyMemoryMove(chained, { continue: 1 }).round;
		expect(deeper.revealed).toEqual([0, 1]);
		expect(deeper.moves).toBe(3);
		expect(deeper.matched).toHaveLength(4);
	});

	it('counts equal off-target excavation attempts as misses without advancing the cursor', () => {
		const initial = createMemoryRound('3', 'memory:strata-order');
		const pending = flipCard(flipCard(initial, 8).round, 9).round;
		expect(timeStrataOutcome(pending)).toBe('order-blocked');
		expect(pending.moves).toBe(1);
		expect(pending.mismatches).toBe(1);
		const blocked = applyMemoryMove(pending, { continue: 1 }).round;
		expect(blocked.orderCursor).toBe(0);
		expect(blocked.matched).toEqual([]);
		expect(blocked.stacks).toEqual(initial.stacks);
		const advanced = confirmedPair(blocked, 10, 11);
		expect(advanced.orderCursor).toBe(1);
		expect(advanced.mismatches).toBe(1);
	});

	it('reserves the whole cascade or echo close and keeps utilities from spending required wire room', () => {
		let chain = createMemoryRound('3', 'memory:strata-chain');
		chain = confirmedPair(chain, 8, 9);
		chain = applyMemoryMove(applyMemoryMove(chain, { continue: 1 }).round, { continue: 1 }).round;
		chain = { ...chain, actions: MEMORY_TIME_STRATA_MAX_ACTIONS - 5 };
		expect(memoryCapReached(chain)).toBe(false);
		const pending = flipCard(flipCard(chain, 10).round, 11).round;
		let final = pending;
		for (let confirmations = 0; confirmations < 3; confirmations += 1) {
			expect(memoryCapReached(final)).toBe(false);
			final = applyMemoryMove(final, { continue: 1 }).round;
		}
		expect(final.status).toBe('won');
		expect(final.actions).toBe(MEMORY_TIME_STRATA_MAX_ACTIONS);
		const echo = {
			...createMemoryRound('3', 'memory:strata-echo'),
			actions: MEMORY_TIME_STRATA_MAX_ACTIONS - 4
		};
		const echoed = confirmedPair(echo, 10, 11);
		expect(echoed.actions).toBe(MEMORY_TIME_STRATA_MAX_ACTIONS - 1);
		expect(memoryCapReached(echoed)).toBe(false);
		const closed = applyMemoryMove(echoed, { continue: 1 }).round;
		expect(closed.echo).toEqual([]);
		expect(closed.actions).toBe(MEMORY_TIME_STRATA_MAX_ACTIONS);
		const cycle = {
			...createMemoryRound('3', 'memory:strata-cycle'),
			actions: MEMORY_TIME_STRATA_MAX_ACTIONS - 3
		};
		expect(memoryCapReached(cycle)).toBe(false);
		expect(applyMemoryMove(cycle, { cycle: 0 }).effect).toBe('ignored');
	});

	it('rejects invalid utility wire fields, wrong modes and held-phase edits in authoritative recovery', () => {
		for (const identity of MEMORY_STRATA_VARIANTS) {
			const initial = createMemoryRound('3', identity);
			for (const move of [
				{ lift: -1 },
				{ lift: 4 },
				{ cycle: 0.5 },
				{ return: 0 },
				{ from: 0 },
				{ from: 0, to: 1, cancel: 1 },
				{ index: timeStrataTops(initial)[0], lift: 0 }
			]) {
				expect(() => manifest.resumeRound('3', [move], undefined, identity)).toThrow('move');
			}
			for (const move of [{ return: 1 }, { from: 0, to: 0 }, { from: 0, to: 1 }]) {
				expect(() => manifest.resumeRound('3', [move], undefined, identity)).toThrow('move');
			}
			const first = timeStrataTops(initial)[0];
			for (const move of [{ lift: 1 }, { cycle: 1 }, { return: 1 }, { from: 1, to: 0 }]) {
				expect(() =>
					manifest.resumeRound('3', [{ index: first }, move], undefined, identity)
				).toThrow('move');
			}
		}
		for (const identity of ['memory:classic', 'memory:time-strata']) {
			for (const move of [{ lift: 0 }, { cycle: 0 }, { return: 1 }, { from: 0, to: 1 }])
				expect(() => manifest.resumeRound('3', [move], undefined, identity)).toThrow('move');
		}
	});
});
