import { expect, it } from 'vitest';
import type { Move } from '#lib/engine/contract.js';
import { manifest } from './manifest.js';
import {
	applyTangramMove,
	createTangramRound,
	parseTangramMove,
	tangramArea2,
	tangramArrivalAt,
	tangramAvailablePieces,
	tangramCoverage,
	tangramPiecePolygon,
	tangramPieces,
	tangramRules,
	tangramScore,
	tangramWitness,
	TANGRAM_ACTION,
	TANGRAM_PIECES,
	TANGRAM_SEI_PIECES,
	TANGRAM_SEI_SILHOUETTES,
	TANGRAM_SEI_SQUARE,
	TANGRAM_DOUBLE_SILHOUETTES,
	TANGRAM_VARIANTS,
	validateTangramWitness,
	type TangramRound
} from './logic.js';

function solution(round: TangramRound): Move[] {
	const timed = round.rules.timeLimit > 0 || round.rules.falling;
	return tangramWitness(round).map((move, index) => ({
		...move,
		...(timed ? { at: 8000 + index * 100 } : {})
	}));
}
function solve(variant: string, seed = '1') {
	let round = createTangramRound(seed, variant);
	for (const move of solution(round)) round = applyTangramMove(round, move);
	return round;
}

it('registers exactly eleven enabled presets with distinct plain-language teaching and zero groups', () => {
	expect(TANGRAM_VARIANTS).toHaveLength(11);
	expect(new Set(TANGRAM_VARIANTS).size).toBe(11);
	expect(manifest.variants).toHaveLength(11);
	for (const variant of manifest.variants) {
		expect(variant.enabled).toBe(true);
		expect(variant.maxMoves).toBe(10000);
		expect(variant).not.toHaveProperty('leaderboardGroups');
		expect(manifest.messages[variant.name as keyof typeof manifest.messages]).toBeTruthy();
		if (variant.id !== 'tangram:classic')
			expect(
				variant.help.steps.some((step) => !manifest.presentation.help.steps.includes(step))
			).toBe(true);
	}
	expect(manifest.presentation.groups).toEqual({});
});

it('replays at least three seeds of every preset and rejects incomplete or illegal replays', () => {
	for (const variant of TANGRAM_VARIANTS)
		for (const seed of ['1', '2', '3']) {
			const round = createTangramRound(seed, variant);
			const moves = solution(round);
			const result = manifest.replay(seed, moves, 10, undefined, variant);
			expect(Object.keys(result).sort()).toEqual(['moves', 'pairs', 'score']);
			expect(result.score).toBeGreaterThan(0);
			expect(() => manifest.replay(seed, moves.slice(0, -1), 10, undefined, variant)).toThrow(
				RangeError
			);
			expect(() =>
				manifest.replay(seed, [{ ...moves[0]!, piece: -1 }], 10, undefined, variant)
			).toThrow(RangeError);
		}
});

it('filters flip-dependent witnesses and rejects a forbidden flip in replay', () => {
	for (let seed = 1; seed <= 40; seed++) {
		const round = createTangramRound(String(seed), 'tangram:flip-off');
		expect(round.rules.flip).toBe(false);
		expect(tangramWitness(round).every((move) => move.flip === 0)).toBe(true);
	}
	const round = createTangramRound('1', 'tangram:flip-off');
	const parallelogram = tangramWitness(round).find((move) => move.piece === 6)!;
	expect(() => applyTangramMove(round, { ...parallelogram, flip: 1 })).toThrow(RangeError);
});

it('uses the genuine Sei cut, proves sixteen convex witnesses, and admits a strip impossible for classic large tans', () => {
	const rules = tangramRules('tangram:sei-shonagon');
	expect(TANGRAM_SEI_PIECES).toHaveLength(7);
	expect(TANGRAM_SEI_PIECES.map((piece) => tangramArea2(piece.polygon)).sort()).not.toEqual(
		TANGRAM_PIECES.map((piece) => tangramArea2(piece.polygon)).sort()
	);
	expect(TANGRAM_SEI_SILHOUETTES).toHaveLength(16);
	expect(validateTangramWitness(TANGRAM_SEI_SQUARE, rules)).toBe(true);
	for (const target of TANGRAM_SEI_SILHOUETTES)
		expect(validateTangramWitness(target, rules), target.id).toBe(true);
	for (let piece = 0; piece < 7; piece++)
		for (let rot = 0; rot < 8; rot++) {
			const polygon = tangramPiecePolygon(
				piece,
				{ xp: 0, xq: 0, yp: 0, yq: 0, rot, flip: 0 },
				rules
			);
			expect(polygon.every((point) => Object.values(point).every(Number.isSafeInteger))).toBe(true);
			expect(tangramArea2(polygon)).toEqual(tangramArea2(TANGRAM_SEI_PIECES[piece]!.polygon));
		}
	const strip = TANGRAM_SEI_SILHOUETTES[0]!;
	expect(strip.outline).toEqual([
		{ xp: 0, xq: 0, yp: 0, yq: 0 },
		{ xp: 32, xq: 0, yp: 0, yq: 0 },
		{ xp: 32, xq: 0, yp: 4, yq: 0 },
		{ xp: 0, xq: 0, yp: 4, yq: 0 }
	]);
	// Classic large triangles have minimum altitude √2, wider than this unit-height strip.
	for (let rot = 0; rot < 8; rot++) {
		const polygon = tangramPiecePolygon(0, { xp: 0, xq: 0, yp: 0, yq: 0, rot, flip: 0 });
		const rational = polygon.every((point) => point.yq === 0);
		const heights = polygon.map((point) => (rational ? point.yp : point.yq));
		expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThanOrEqual(rational ? 5 : 4);
	}
});

it('requires all fourteen pieces, exact area sixteen and a default fifty points per piece', () => {
	const round = solve('tangram:double-14');
	for (const target of TANGRAM_DOUBLE_SILHOUETTES)
		expect(validateTangramWitness(target, round.rules)).toBe(true);
	expect(tangramPieces(round)).toHaveLength(14);
	expect(round.placements.filter(Boolean)).toHaveLength(14);
	expect(tangramArea2(round.silhouette.outline)).toEqual([512n, 0n]);
	expect(tangramCoverage(round.silhouette, round.placements, round.rules)).toBe(true);
	expect(tangramCoverage(round.silhouette, round.placements.slice(0, 7), round.rules)).toBe(false);
	expect(tangramScore(round, 10)).toBe(2250);
});

it('shows a coloured map without a par/time score field or bonus', () => {
	const round = solve('tangram:coloured-map');
	expect(round.rules.map).toBe(true);
	const definition = manifest.variants.find(
		(variant) => variant.id === 'tangram:coloured-map'
	)!.scoring;
	expect(definition.fields).not.toContain('second');
	expect(tangramScore(round, 0)).toBe(1700);
	expect(tangramScore(round, 100)).toBe(1700);
});

it('changes target information for the smaller-reference preset while retaining classic pieces', () => {
	const round = createTangramRound('1', 'tangram:no-full-size');
	expect(round.rules.fullSize).toBe(false);
	expect(tangramPieces(round)).toEqual(TANGRAM_PIECES);
	expect(createTangramRound('1').rules.fullSize).toBe(true);
	expect(solve('tangram:no-full-size').status).toBe('won');
});

it('uses a single countdown coefficient, exact timestamp validation and authoritative timeout', () => {
	let round = createTangramRound('1', 'tangram:countdown-120');
	const moves = solution(round);
	expect(() => applyTangramMove(round, tangramWitness(round)[0]!)).toThrow(RangeError);
	round = applyTangramMove(round, moves[0]!);
	expect(() => applyTangramMove(round, { ...moves[1]!, at: 7999 })).toThrow(RangeError);
	expect(() =>
		applyTangramMove(round, { action: TANGRAM_ACTION.tick, at: 120000, extra: 1 })
	).toThrow(RangeError);
	const lost = applyTangramMove(round, { action: TANGRAM_ACTION.tick, at: 120000 });
	expect(lost.status).toBe('lost');
	expect(() => manifest.replay('1', moves, 120, undefined, 'tangram:countdown-120')).toThrow(
		RangeError
	);
	expect(manifest.replay('1', moves, 10, undefined, 'tangram:countdown-120').score).toBe(2250);
	expect(
		manifest.variants.find((variant) => variant.id === 'tangram:countdown-120')!.scoring.fields
	).toHaveLength(4);
});

it('counts occupied-slot snap attempts on the server and ends exactly at the fourth mistake', () => {
	let round = createTangramRound('1', 'tangram:mistake-limit-4');
	const first = tangramWitness(round)[0]!;
	round = applyTangramMove(round, first);
	const overlap = { ...first, piece: 1 };
	for (let mistake = 1; mistake <= 4; mistake++) {
		round = applyTangramMove(round, overlap);
		expect(round.mistakes).toBe(mistake);
		expect(round.status).toBe(mistake === 4 ? 'lost' : 'playing');
		expect(round.placements.filter(Boolean)).toHaveLength(1);
	}
	expect(() => applyTangramMove(round, { action: TANGRAM_ACTION.reset })).toThrow(RangeError);
	expect(() => parseTangramMove({ action: 999 })).toThrow(RangeError);
});

it('counts silhouette-edge wrong snaps, ignores non-contact drops and retains mistakes through reset', () => {
	let round = createTangramRound('1', 'tangram:mistake-limit-4');
	const first = tangramWitness(round)[0]!;
	round = applyTangramMove(round, { ...first, xp: 400, yp: 400 });
	expect(round.mistakes).toBe(0);
	round = applyTangramMove(round, { ...first, yp: first.yp + 1 });
	expect(round.mistakes).toBe(1);
	round = applyTangramMove(round, { action: TANGRAM_ACTION.reset });
	expect(round.mistakes).toBe(1);
});

it('queues falling pieces at increasing tempo, prevents early placement and binds arrival time to replay elapsed', () => {
	let round = createTangramRound('1', 'tangram:falling-pieces');
	expect(tangramAvailablePieces(round, 0)).toEqual([round.arrivalOrder[0]]);
	const times = round.arrivalOrder.map((piece) => tangramArrivalAt(round, piece));
	const gaps = times.slice(1).map((at, index) => at - times[index]!);
	expect(gaps.every((gap) => gap > 0)).toBe(true);
	expect(gaps.slice(1).every((gap, index) => gap < gaps[index]!)).toBe(true);
	const last = round.arrivalOrder.at(-1)!;
	const move = tangramWitness(round).find((entry) => entry.piece === last)!;
	expect(() => applyTangramMove(round, { ...move, at: 0 })).toThrow(RangeError);
	round = applyTangramMove(round, { ...move, at: times.at(-1)! });
	expect(round.placements[last]).not.toBeNull();
	expect(tangramAvailablePieces(round, 60000)).toHaveLength(7);
	expect(round.status).toBe('playing');
	const initial = createTangramRound('1', 'tangram:falling-pieces');
	// The shared saver first calls replay at zero to determine the fixed opening allowance.
	expect(
		manifest.replay('1', solution(initial), 0, undefined, 'tangram:falling-pieces').moves
	).toBe(7);
	expect(() =>
		manifest.replay('1', solution(initial), 5, undefined, 'tangram:falling-pieces')
	).toThrow(RangeError);
	expect(solve('tangram:falling-pieces').status).toBe('won');
});

it('shares the three-help budget between hints and peeks without refunding it on reset', () => {
	let round = createTangramRound('1', 'tangram:hint-budget-3');
	for (const action of [TANGRAM_ACTION.hint, TANGRAM_ACTION.peek, TANGRAM_ACTION.hint])
		round = applyTangramMove(round, { action });
	expect(round.hintsUsed).toBe(3);
	expect(round.placements.filter(Boolean)).toHaveLength(2);
	for (const action of [TANGRAM_ACTION.hint, TANGRAM_ACTION.peek])
		expect(() => applyTangramMove(round, { action })).toThrow(RangeError);
	round = applyTangramMove(round, { action: TANGRAM_ACTION.reset });
	expect(round.hintsUsed).toBe(3);
	expect(() => applyTangramMove(round, { action: TANGRAM_ACTION.hint })).toThrow(RangeError);
});

it('forbids both hint and peek in the no-hint ruleset', () => {
	const round = createTangramRound('1', 'tangram:no-hint');
	for (const action of [TANGRAM_ACTION.hint, TANGRAM_ACTION.peek])
		expect(() => applyTangramMove(round, { action })).toThrow(RangeError);
	expect(solve('tangram:no-hint').status).toBe('won');
});

it('keeps untimed moves free of timestamps even though the timed wire shape is parseable', () => {
	const classic = createTangramRound('1');
	expect(() => applyTangramMove(classic, { ...tangramWitness(classic)[0]!, at: 1 })).toThrow(
		RangeError
	);
	expect(() => applyTangramMove(classic, { action: TANGRAM_ACTION.peek, at: 1 })).toThrow(
		RangeError
	);
	expect(() => parseTangramMove({ ...tangramWitness(classic)[0]!, xp: 0.1 })).toThrow(RangeError);
});
