import { expect, it } from 'vitest';
import { createRng } from '#lib/engine/rng.js';
import {
	applyOneLineMove,
	createOneLineRound,
	encodeRules,
	ONE_LINE_VARIANTS,
	oneLineHint,
	oneLineScore,
	type OneLineMove
} from './logic.js';
import { manifest } from './manifest.js';

const move = (action: number, value = 0): OneLineMove => ({ action, edge: 0, value });

it('offers ten enabled single-rule deltas and excludes verdict from the daily pool', () => {
	const baseline = encodeRules('one-line:classic');
	expect(manifest.variants).toHaveLength(11);
	expect(manifest.presentation.groups).toEqual({});
	for (const variant of ONE_LINE_VARIANTS.slice(1)) {
		const rules = encodeRules(variant);
		expect(
			Object.keys(baseline).filter(
				(key) => rules[key as keyof typeof rules] !== baseline[key as keyof typeof baseline]
			)
		).toHaveLength(1);
		expect(manifest.resolveVariantFromRules(rules)).toBe(variant);
	}
	expect(manifest.variants.every((variant) => variant.enabled)).toBe(true);
	expect(
		manifest.variants
			.filter((variant) => 'daily' in variant && variant.daily === false)
			.map(({ id }) => id)
	).toEqual(['one-line:verdict']);
});

it.each(ONE_LINE_VARIANTS.slice(1, -1))(
	'%s generates and plays its changed rule',
	(variant) => {
		const round = createOneLineRound('1', variant);
		const solved = round.solution.reduce(applyOneLineMove, round);
		expect(solved.status).toBe('won');
		expect(solved.edgesCovered).toBe(
			round.edges.length + round.edges.filter((edge) => edge.double).length
		);
		switch (variant) {
			case 'one-line:one-way': {
				const index = round.edges.findIndex((edge) => edge.directed);
				expect(index).toBeGreaterThanOrEqual(0);
				const edge = round.edges[index];
				const backwards = { ...round, strokes: [{ start: edge.to, path: [] }] };
				expect(() => applyOneLineMove(backwards, { action: 0, edge: index, value: 0 })).toThrow(
					'direction'
				);
				break;
			}
			case 'one-line:double-trace':
				expect(round.edges.filter((edge) => edge.double)).toHaveLength(1);
				expect(new Set(round.solution.map(({ edge }) => edge)).size).toBe(round.edges.length);
				break;
			case 'one-line:closed-loop':
				expect(round.odd).toHaveLength(0);
				expect(solved.strokes[0].path.at(-1)!.to).toBe(solved.strokes[0].start);
				break;
			case 'one-line:two-stroke': {
				expect(round.odd).toHaveLength(4);
				const lift = round.solution.findIndex(({ action }) => action === 6);
				expect(lift).toBeGreaterThan(0);
				const lifted = round.solution.slice(0, lift + 1).reduce(applyOneLineMove, round);
				expect(lifted.lifted).toBe(true);
				expect(solved.strokes).toHaveLength(2);
				const second = applyOneLineMove(lifted, round.solution[lift + 1]);
				expect(() => applyOneLineMove(second, move(6))).toThrow('lift');
				break;
			}
			case 'one-line:crossings-are-junctions': {
				const center = round.dots.findIndex(({ x, y }) => x === 4 && y === 3);
				expect(round.edges.filter(({ from, to }) => from === center || to === center)).toHaveLength(
					4
				);
				break;
			}
			case 'one-line:countdown':
				expect(oneLineScore(solved, 119)).toBe(round.edges.length * 100 + 10);
				expect(applyOneLineMove(round, move(5)).status).toBe('timeout');
				break;
			case 'one-line:no-hint':
				expect(() => applyOneLineMove(round, move(2))).toThrow(RangeError);
				break;
			case 'one-line:degree-hidden':
				expect(oneLineHint(round)!.start.length).toBeLessThanOrEqual(1);
				break;
			case 'one-line:lift-resume': {
				const traced = applyOneLineMove(round, round.solution[0]);
				const lifted = applyOneLineMove(traced, move(6));
				expect(lifted.edgesCovered).toBe(1);
				expect(() => applyOneLineMove(lifted, move(1))).toThrow('undo');
				expect(round.solution.slice(1).reduce(applyOneLineMove, lifted).status).toBe('won');
				break;
			}
		}
	},
	120000
);

it('enforces the countdown replay deadline and timeout grace', () => {
	const round = createOneLineRound('1', 'one-line:countdown');
	const replay = (moves: OneLineMove[], seconds: number) =>
		manifest.replay('1', moves, seconds, undefined, 'one-line:countdown');
	expect(replay(round.solution, 119).won).toBe(true);
	expect(() => replay(round.solution, 120)).toThrow('timeout');
	for (const seconds of [0, 30, 119, 123])
		expect(() => replay([move(5)], seconds)).toThrow('timeout');
	for (const seconds of [120, 121, 122])
		expect(replay([move(5)], seconds)).toMatchObject({ won: false, score: 0 });
}, 120000);

it('scores correct and wrong verdicts and allows a drawable figure to be traced', () => {
	const seeds = Array.from({ length: 100 }, (_, i) => String(i));
	const impossible = (seed: string) => {
		const rng = createRng(seed);
		rng.nextInt(29);
		return rng.nextInt(5) === 0;
	};
	const impossibleSeed = seeds.find(impossible)!;
	const drawableSeed = seeds.find((seed) => !impossible(seed))!;
	const impossibleRound = createOneLineRound(impossibleSeed, 'one-line:verdict');
	const drawableRound = createOneLineRound(drawableSeed, 'one-line:verdict');
	expect(impossibleRound.odd.length).toBeGreaterThanOrEqual(4);
	expect(
		manifest.replay(impossibleSeed, [move(4, 1)], 5, undefined, 'one-line:verdict')
	).toMatchObject({ won: true, score: 500 });
	expect(
		manifest.replay(drawableSeed, [move(4, 1)], 5, undefined, 'one-line:verdict')
	).toMatchObject({ won: false, score: 0 });
	expect(
		manifest.replay(drawableSeed, drawableRound.solution, 5, undefined, 'one-line:verdict')
	).toMatchObject({ won: true, score: drawableRound.edges.length * 100 });
}, 120000);
