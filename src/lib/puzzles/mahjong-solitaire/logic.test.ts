import { describe, expect, it } from 'vitest';
import {
	applyMahjongMove,
	createMahjongRound,
	MAHJONG_ACTION,
	MAHJONG_LAYOUTS,
	mahjongFreeTiles,
	mahjongHint,
	mahjongMatches,
	mahjongScore,
	mahjongWitness,
	validateMahjongWitness,
	type MahjongRound,
	type MahjongTile
} from './logic.js';
import { scoring } from './scoring.js';

function solve(round: MahjongRound) {
	for (const [tileA, tileB] of mahjongWitness(round))
		round = applyMahjongMove(round, { tileA, tileB });
	return round;
}
function tile(id: number, x: number, y: number, z = 0, face = 'C1'): MahjongTile {
	return { id, x, y, z, face, removed: false, faceDown: false };
}

describe('Mahjong Solitaire Classic baseline', () => {
	it('freezes the fixture layouts and their integer geometry', () => {
		for (const [layout, counts] of [
			[MAHJONG_LAYOUTS.quick, [42, 14]],
			[MAHJONG_LAYOUTS.turtle, [87, 36, 16, 4, 1]],
			[MAHJONG_LAYOUTS.fortress, [92, 40, 12]]
		] as const) {
			expect(
				counts.map((_, z) => layout.positions.filter((position) => position.z === z).length)
			).toEqual(counts);
			expect(
				layout.positions.every((position) => Object.values(position).every(Number.isInteger))
			).toBe(true);
			expect(Object.isFrozen(layout.positions[0])).toBe(true);
		}
		const tiles = MAHJONG_LAYOUTS.fortress.positions.map((position, id) => ({
			...tile(id, 0, 0),
			...position
		}));
		expect(mahjongFreeTiles({ tiles })).toHaveLength(29);
		expect(MAHJONG_LAYOUTS.turtle.positions[31]).toMatchObject({ x: 0, y: 6, z: 0 });
		expect(MAHJONG_LAYOUTS.turtle.positions[56]).toMatchObject({ x: 26, y: 8, z: 0 });
	});

	it('checks half-step cover and both long sides, ignoring vertical neighbours', () => {
		expect(mahjongFreeTiles({ tiles: [tile(0, 0, 0), tile(1, 2, 0), tile(2, 4, 0)] })).toEqual([
			0, 2
		]);
		expect(mahjongFreeTiles({ tiles: [tile(0, 0, 0), tile(1, 0, 2)] })).toEqual([0, 1]);
		expect(mahjongFreeTiles({ tiles: [tile(0, 0, 0), tile(1, 2, 0), tile(2, 1, 1, 1)] })).toEqual([
			2
		]);
		expect(mahjongFreeTiles({ tiles: [tile(0, 0, 0), tile(1, 2, 1), tile(2, 4, 0)] })).toEqual([
			0, 2
		]);
	});

	it('repeats seeds exactly, varies faces and validates removal witnesses before issuance', () => {
		const boards = new Set<string>(),
			bands = new Set<number>();
		for (const seed of ['1', '2', '3', '4', '5', '6', '42', '99', '18446744073709551615']) {
			const round = createMahjongRound(seed);
			expect(createMahjongRound(seed, 'mahjong-solitaire:classic')).toEqual(round);
			expect(validateMahjongWitness(round, mahjongWitness(round))).toBe(true);
			expect(mahjongHint(round)).toHaveLength(2);
			expect(JSON.stringify(round)).not.toContain('solution');
			expect(JSON.stringify(round)).not.toContain('witness');
			const counts = new Map<string, number>();
			for (const entry of round.tiles) counts.set(entry.face, (counts.get(entry.face) ?? 0) + 1);
			expect(
				[...counts].every(
					([face, count]) => count === (face.startsWith('F') || face.startsWith('S') ? 1 : 4)
				)
			).toBe(true);
			if (round.band === 1)
				expect(
					[...counts.keys()].some((face) => face.startsWith('F') || face.startsWith('S'))
				).toBe(false);
			boards.add(round.tiles.map((entry) => entry.face).join(','));
			bands.add(round.band);
		}
		expect(boards.size).toBeGreaterThan(3);
		expect(bands.size).toBe(3);
	});

	it('rejects incomplete and tampered witnesses', () => {
		const round = createMahjongRound('1'),
			witness = mahjongWitness(round);
		expect(validateMahjongWitness(round, witness.slice(1))).toBe(false);
		expect(
			validateMahjongWitness(round, [[witness[0]![0]!, witness[0]![0]!], ...witness.slice(1)])
		).toBe(false);
		expect(validateMahjongWitness(round, [[...witness[0]!, 999], ...witness.slice(1)])).toBe(false);
	});

	it('matches bonus groups but never mixes Flowers, Seasons or ordinary faces', () => {
		const rules = createMahjongRound('1').rules;
		for (const [a, b, expected] of [
			['F1', 'F4', true],
			['S1', 'S3', true],
			['F1', 'S1', false],
			['C1', 'B1', false],
			['C1', 'C1', true]
		] as const) {
			expect(
				mahjongMatches({ tiles: [tile(0, 0, 0, 0, a), tile(1, 2, 0, 0, b)], rules }, [0, 1])
			).toBe(expected);
		}
	});

	it('throws on blocked, repeated, nonmatching, malformed and terminal moves', () => {
		const round = createMahjongRound('1'),
			free = mahjongFreeTiles(round),
			blocked = round.tiles.find((entry) => !free.includes(entry.id))!.id;
		for (const move of [
			{ tileA: free[0], tileB: free[0] },
			{ tileA: blocked, tileB: free[0] },
			{ tileA: -1, tileB: free[0] },
			{ tileA: 0.5, tileB: free[0] },
			{ action: 99 },
			{ action: MAHJONG_ACTION.hint, extra: 1 }
		])
			expect(() => applyMahjongMove(round, move)).toThrow(RangeError);
		const first = mahjongHint(round),
			next = applyMahjongMove(round, { tileA: first[0], tileB: first[1] });
		expect(() => applyMahjongMove(next, { tileA: first[0], tileB: first[1] })).toThrow(RangeError);
		expect(() => applyMahjongMove(solve(round), { action: MAHJONG_ACTION.restart })).toThrow(
			RangeError
		);
	});

	it('picks a legal best-uncovering hint with deterministic ties and charges only usage', () => {
		const original = createMahjongRound('1');
		const round = {
			...original,
			tiles: [
				tile(0, 0, 0, 0, 'C1'),
				tile(1, 2, 0, 0, 'B1'),
				tile(2, 4, 0, 0, 'C1'),
				tile(3, 8, 0, 0, 'B1'),
				tile(4, 12, 0, 0, 'B1')
			]
		};
		expect(mahjongHint(round)).toEqual([0, 2]);
		const hinted = applyMahjongMove(round, { action: MAHJONG_ACTION.hint });
		expect(hinted.lastHint).toEqual([0, 2]);
		expect(hinted.hintsUsed).toBe(1);
		expect(hinted.tiles).toEqual(round.tiles);
	});

	it('undo restores the board, keeps spent helpers, and restart repeats the original deal', () => {
		const original = createMahjongRound('1'),
			ids = mahjongWitness(original)[0]!;
		const hinted = applyMahjongMove(original, { action: MAHJONG_ACTION.hint });
		const removed = applyMahjongMove(hinted, { tileA: ids[0], tileB: ids[1] });
		const undone = applyMahjongMove(removed, { action: MAHJONG_ACTION.undo });
		expect(undone.tiles).toEqual(original.tiles);
		expect(undone.removals).toBe(0);
		expect(undone.hintsUsed).toBe(1);
		const shuffled = applyMahjongMove(removed, { action: MAHJONG_ACTION.shuffle });
		expect(shuffled.history).toEqual([]);
		expect(validateMahjongWitness(shuffled, mahjongWitness(shuffled))).toBe(true);
		const restarted = applyMahjongMove(shuffled, { action: MAHJONG_ACTION.restart });
		expect(restarted.tiles).toEqual(original.tiles);
		expect(restarted.hintsUsed).toBe(1);
		expect(restarted.shufflesUsed).toBe(1);
	});

	it('scores only a player-cleared board with the locked formula and immutable supplied values', () => {
		const round = createMahjongRound('1');
		expect(mahjongScore(round, 10)).toBe(0);
		const won = solve(round);
		expect(won.status).toBe('won');
		expect(mahjongScore(won, 20)).toBe(1000 + (won.tiles.length / 2) * 100 + (won.par - 20) * 5);
		expect(mahjongScore(won, 20, { ...scoring.defaults, completion: 2000 })).toBe(
			mahjongScore(won, 20) + 1000
		);
		expect(mahjongScore({ ...won, hintsUsed: 1000 }, 20)).toBe(0);
		expect(() => mahjongScore(won, -1)).toThrow(RangeError);
	});
});
