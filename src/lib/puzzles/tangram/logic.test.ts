import { describe, expect, it } from 'vitest';
import { manifest } from './manifest.js';
import {
	applyTangramMove,
	createTangramRound,
	parseTangramMove,
	tangramArea2,
	tangramCoverage,
	tangramPiecePolygon,
	tangramPolygonInside,
	tangramPolygonsOverlap,
	tangramScore,
	tangramWitness,
	TANGRAM_ACTION,
	TANGRAM_PIECES,
	TANGRAM_SILHOUETTES,
	validateTangramWitness,
	type TangramPlacement,
	type TangramPlacementMove,
	type TangramPoint
} from './logic.js';

const point = (xp: number, yp: number): TangramPoint => ({ xp, xq: 0, yp, yq: 0 });
function solve(seed: string) {
	let round = createTangramRound(seed);
	for (const move of tangramWitness(round)) round = applyTangramMove(round, move);
	return round;
}
function placements(witness: readonly TangramPlacementMove[]) {
	const result = Array<TangramPlacement | null>(7).fill(null);
	for (const move of witness) result[move.piece] = move;
	return result;
}

describe('Tangram baseline exact geometry and replay', () => {
	it('keeps every tan exact in all eight rigid orientations and preserves its area', () => {
		for (let piece = 0; piece < TANGRAM_PIECES.length; piece++) {
			const original = tangramArea2(TANGRAM_PIECES[piece]!.polygon);
			for (let rot = 0; rot < 8; rot++) {
				const polygon = tangramPiecePolygon(piece, { xp: 0, xq: 0, yp: 0, yq: 0, rot, flip: 0 });
				expect(polygon.every((vertex) => Object.values(vertex).every(Number.isSafeInteger))).toBe(
					true
				);
				expect(tangramArea2(polygon)).toEqual(original);
			}
		}
	});

	it('has all thirteen convex shapes and the five required picture instances, each with a proven witness', () => {
		expect(TANGRAM_SILHOUETTES).toHaveLength(18);
		expect(new Set(TANGRAM_SILHOUETTES.map(({ id }) => id)).size).toBe(18);
		for (const name of ['Cat', 'House', 'Bird', 'Boat', 'Swan'])
			expect(TANGRAM_SILHOUETTES.some((target) => target.name === name)).toBe(true);
		for (const target of TANGRAM_SILHOUETTES) {
			expect(validateTangramWitness(target), target.id).toBe(true);
			expect(tangramArea2(target.outline), target.id).toEqual([256n, 0n]);
		}
	});

	it('rejects a tampered witness and a missing piece', () => {
		const target = TANGRAM_SILHOUETTES[0]!;
		const witness = target.witness.map((move) => ({ ...move }));
		witness[0]!.xp += 1;
		expect(validateTangramWitness({ ...target, witness })).toBe(false);
		expect(validateTangramWitness({ ...target, witness: target.witness.slice(1) })).toBe(false);
	});

	it('accepts edge and point contact but rejects positive-area overlap', () => {
		const square = [point(0, 0), point(4, 0), point(4, 4), point(0, 4)];
		const translated = (dx: number, dy: number) => square.map((p) => point(p.xp + dx, p.yp + dy));
		expect(tangramPolygonsOverlap(square, translated(4, 0))).toBe(false);
		expect(tangramPolygonsOverlap(square, translated(4, 4))).toBe(false);
		expect(tangramPolygonsOverlap(square, translated(3, 0))).toBe(true);
	});

	it('rejects a segment crossing a concave notch even when its endpoints lie on the boundary', () => {
		const target = [
			[0, 0],
			[12, 0],
			[12, 12],
			[8, 12],
			[8, 4],
			[4, 4],
			[4, 12],
			[0, 12]
		].map(([xp, yp]) => point(xp!, yp!));
		const triangle = [point(0, 12), point(12, 12), point(6, 0)];
		expect(tangramPolygonInside(triangle, target)).toBe(false);
	});

	it('rejects outside, incomplete and overlapping arrangements despite unchanged piece areas', () => {
		const target = TANGRAM_SILHOUETTES.find(({ id }) => id === 'square')!;
		const outside = placements(target.witness);
		outside[0] = { ...outside[0]!, xp: 100 };
		expect(tangramCoverage(target, outside)).toBe(false);
		const incomplete = placements(target.witness);
		incomplete[0] = null;
		expect(tangramCoverage(target, incomplete)).toBe(false);
		const overlap = placements(target.witness);
		overlap[1] = { ...overlap[0]! };
		expect(tangramCoverage(target, overlap)).toBe(false);
	});

	it('accepts the square exchanged with the two small triangles in a different valid solution', () => {
		const target = TANGRAM_SILHOUETTES.find(({ id }) => id === 'pentagon-wide')!;
		const alternative = placements(target.witness);
		for (const piece of [3, 4, 5]) {
			const offset = piece === 5 ? 2 : -2;
			alternative[piece] = {
				...alternative[piece]!,
				xq: alternative[piece]!.xq + offset,
				yq: alternative[piece]!.yq + offset
			};
		}
		expect(alternative).not.toEqual(placements(target.witness));
		expect(tangramCoverage(target, alternative)).toBe(true);
	});

	it('draws deterministic varied rounds and replays their actual placements', () => {
		const ids = new Set<string>();
		for (let seed = 0; seed < 40; seed++) {
			const value = String(seed);
			expect(createTangramRound(value)).toEqual(createTangramRound(value));
			ids.add(createTangramRound(value).silhouette.id);
			const round = solve(value);
			expect(round.status).toBe('won');
			expect(manifest.replay(value, tangramWitness(round), 10, undefined, undefined)).toEqual({
				score: 1950,
				pairs: null,
				moves: 7
			});
		}
		expect(ids.size).toBeGreaterThan(8);
	});

	it('keeps the witness out of issued JSON and registers without variant groups', () => {
		const round = createTangramRound('1');
		expect(JSON.stringify(round)).not.toContain('witness');
		expect(manifest).not.toHaveProperty('leaderboardGroups');
		expect(manifest.presentation.groups).toEqual({});
		expect(manifest.rankedTiming.minimumSeconds()).toBe(5);
	});

	it('validates exact numeric wire keys, rejecting fractions, extras, invalid rotations and forbidden flips', () => {
		const move = tangramWitness(createTangramRound('1'))[0]!;
		for (const bad of [
			{ ...move, extra: 1 },
			{ ...move, xp: 0.5 },
			{ ...move, rot: 8 },
			{ ...move, piece: -1 },
			{ ...move, flip: 1 }
		])
			expect(() => parseTangramMove(bad)).toThrow(RangeError);
		expect(parseTangramMove(move)).toEqual(move);
		expect(() => createTangramRound('1', 'tangram:unknown')).toThrow(RangeError);
	});

	it('replays hints and peek assistance and resets the same silhouette without refunding help', () => {
		const initial = createTangramRound('2');
		let round = applyTangramMove(initial, { action: TANGRAM_ACTION.peek });
		round = applyTangramMove(round, { action: TANGRAM_ACTION.hint });
		expect(round.hintsUsed).toBe(2);
		expect(round.placements.filter(Boolean)).toHaveLength(1);
		round = applyTangramMove(round, { action: TANGRAM_ACTION.reset });
		expect(round.silhouette).toEqual(initial.silhouette);
		expect(round.seed).toBe(initial.seed);
		expect(round.hintsUsed).toBe(2);
		for (let n = 0; n < 7; n++) round = applyTangramMove(round, { action: TANGRAM_ACTION.hint });
		expect(round.status).toBe('won');
		expect(round.hintsUsed).toBe(9);
		expect(tangramScore(round, 10)).toBe(1050);
	});

	it('preserves legal geometry after a wrong drop and rejects incomplete or post-win replay', () => {
		let round = createTangramRound('3');
		const move = tangramWitness(round)[0]!;
		round = applyTangramMove(round, { ...move, xp: 400 });
		expect(round.placements.every((placement) => placement === null)).toBe(true);
		expect(() => manifest.replay('3', [move], 10, undefined, undefined)).toThrow(RangeError);
		const won = solve('3');
		expect(() => applyTangramMove(won, { action: TANGRAM_ACTION.reset })).toThrow(RangeError);
	});
});
