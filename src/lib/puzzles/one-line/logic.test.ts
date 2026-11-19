import { expect, it } from 'vitest';
import { createRng } from '#lib/engine/rng.js';
import {
	applyOneLineMove,
	completion,
	createOneLineRound,
	dailySeedOk,
	hasTrap,
	oneLineHint,
	oneLineScore,
	type OneLineMove
} from './logic.js';
import { manifest } from './manifest.js';

const action = (value: number): OneLineMove => ({ action: value, edge: 0, value: 0 });

it('generates a connected deterministic figure and re-walks its witness', () => {
	const round = createOneLineRound('1');
	expect(createOneLineRound('1')).toEqual(round);
	const seen = new Set([round.edges[0].from]);
	for (const dot of seen)
		for (const edge of round.edges) {
			if (edge.from === dot) seen.add(edge.to);
			if (edge.to === dot) seen.add(edge.from);
		}
	expect(round.edges.every(({ from, to }) => seen.has(from) && seen.has(to))).toBe(true);
	const degrees = round.dots.map(
		(_, dot) => round.edges.filter(({ from, to }) => from === dot || to === dot).length
	);
	expect(round.odd).toEqual(degrees.flatMap((degree, dot) => (degree % 2 ? [dot] : [])));
	expect([0, 2]).toContain(round.odd.length);
	const solved = round.solution.reduce(applyOneLineMove, round);
	expect(solved.status).toBe('won');
	expect(solved.edgesCovered).toBe(round.edges.length);
	expect(new Set(round.solution.map(({ edge }) => edge)).size).toBe(round.edges.length);
	// Reversing an undirected witness is a valid alternate route, not a witness match.
	const path = solved.strokes[0];
	const reverse = [...path.path]
		.reverse()
		.map(({ edge }, index) => ({ action: 0, edge, value: index ? 0 : path.path.at(-1)!.to }));
	expect(reverse.reduce(applyOneLineMove, round).status).toBe('won');
}, 120000);

it('draws the size band from the seed and only accepts the daily band', () => {
	const seeds = Array.from({ length: 30 }, (_, i) => String(i));
	const band = (seed: string) => 6 + createRng(seed).nextInt(29);
	const daily = seeds.find((seed) => band(seed) >= 17 && band(seed) <= 24)!;
	const outside = seeds.find((seed) => band(seed) < 17 || band(seed) > 24)!;
	expect(createOneLineRound(daily).edges).toHaveLength(band(daily));
	expect(dailySeedOk(daily)).toBe(true);
	expect(dailySeedOk(outside)).toBe(false);
	expect(dailySeedOk('invalid')).toBe(false);
}, 120000);

it('replays undo, hints, restart, lift-reset and rejects retracing', () => {
	const round = createOneLineRound('1');
	const first = round.solution[0];
	const traced = applyOneLineMove(round, first);
	expect(() => applyOneLineMove(traced, { ...first, value: 0 })).toThrow('retraced');
	expect(applyOneLineMove(traced, action(1)).edgesCovered).toBe(0);
	expect(applyOneLineMove(traced, action(6)).edgesCovered).toBe(0);
	expect(oneLineHint(round)).toEqual(oneLineHint(round));
	const moves = [action(2), first, action(1), first, action(3), ...round.solution];
	const resumed = manifest.resumeRound('1', moves);
	expect(resumed).toMatchObject({ status: 'won', hintsUsed: 1, restarts: 1 });
	expect(manifest.replay('1', moves, 5)).toMatchObject({
		won: true,
		hintUsed: true,
		score: round.edges.length * 100 - 150
	});
	expect(() => manifest.replay('1', [], 5)).toThrow('incomplete');
}, 120000);

it('loses on arrival at a dead end with edges remaining', () => {
	const initial = createOneLineRound('1');
	const round = {
		...initial,
		dots: Array.from({ length: 5 }, () => ({ x: 0, y: 0 })),
		edges: [
			{ from: 1, to: 0 },
			{ from: 0, to: 2 },
			{ from: 2, to: 1 },
			{ from: 0, to: 3 },
			{ from: 3, to: 4 },
			{ from: 4, to: 0 }
		],
		odd: []
	};
	const lost = [
		{ action: 0, edge: 0, value: 1 },
		{ action: 0, edge: 1, value: 0 },
		{ action: 0, edge: 2, value: 0 }
	].reduce(applyOneLineMove, round);
	expect(lost.status).toBe('stranded');
	expect(oneLineScore(lost, 5)).toBe(0);
	expect(() => applyOneLineMove(lost, action(1))).toThrow('finished');
}, 120000);

it('parses exact bounded numeric moves and enforces the log limit', () => {
	expect(manifest.maxMoves).toBe(10000);
	expect(manifest.parseMove({ action: 0, edge: 33, value: 62 })).toEqual({
		action: 0,
		edge: 33,
		value: 62
	});
	for (const move of [
		{ action: 0, edge: 34, value: 0 },
		{ action: 0, edge: 0, value: 63 },
		{ action: 7, edge: 0, value: 0 },
		{ action: 2, edge: 1, value: 0 },
		{ action: 0, edge: 0, value: 0, extra: 1 },
		{ action: 0, edge: NaN, value: 0 }
	])
		expect(() => manifest.parseMove(move)).toThrow(RangeError);
	expect(() =>
		manifest.resumeRound(
			'1',
			Array.from({ length: 10001 }, () => action(3))
		)
	).toThrow('move_limit');
});

it('checks later bowtie traps and rejects a forced path', () => {
	const initial = createOneLineRound('1');
	const edges = [
		[1, 0],
		[0, 2],
		[2, 1],
		[0, 3],
		[3, 4],
		[4, 0]
	].map(([from, to]) => ({ from, to }));
	expect(hasTrap({ ...initial, edges })).toBe(true);
	for (let edge = 0; edge < edges.length; edge++) {
		const rest = edges.map((_, id) => id).filter((id) => id !== edge);
		expect(completion(edges, rest, edges[edge].to, 1)).not.toBeNull();
	}
	expect(completion(edges, [1, 2, 4, 5], 3, 1)).not.toBeNull();
	expect(completion(edges, [3, 4, 5], 1, 1)).toBeNull();
	expect(hasTrap({ ...initial, edges: edges.slice(3, 5) })).toBe(false);
});

it('distinguishes two-stroke completion from a genuine trap', () => {
	const initial = createOneLineRound('1', 'one-line:two-stroke');
	const edges = [
		[0, 1],
		[1, 2],
		[2, 3],
		[3, 0],
		[0, 2],
		[1, 3]
	].map(([from, to]) => ({ from, to }));
	expect(completion(edges, [1, 2, 3, 4, 5], 1, 1)).toBeNull();
	expect(completion(edges, [1, 2, 3, 4, 5], 1, 2)).not.toBeNull();
	expect(completion(edges, [2, 3, 4], 1, 1)).toBeNull();
	expect(hasTrap({ ...initial, edges })).toBe(true);
	const example = [
		[0, 3],
		[1, 3],
		[2, 4],
		[0, 1],
		[0, 2],
		[1, 5],
		[3, 4],
		[1, 2]
	].map(([from, to]) => ({ from, to }));
	expect(completion(example, [0, 2, 3, 4, 5, 6, 7], 3, 2)).toBeNull();
});
