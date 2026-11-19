import { describe, expect, it } from 'vitest';
import {
	SUDOKU_VARIANTS,
	applySudokuMove,
	canEndSudoku,
	candidateMask,
	createSudokuRound,
	dailySeedOk,
	geometryHasLoadBearingClue,
	geometryLogicSolvable,
	classicRegions,
	countGeometrySolutions,
	encodeRules,
	entryMask,
	geometryCandidates,
	geometryPeers,
	geometryUnits,
	irregularRegions,
	validGeometryGivens,
	type SudokuGeometry
} from './logic.js';

function geometry(regions = classicRegions()): SudokuGeometry {
	const units = geometryUnits(regions, false);
	return {
		regions,
		units,
		peers: geometryPeers(units, false),
		cages: [],
		thermos: [],
		marks: [],
		parity: Array<number>(81).fill(0)
	};
}
describe('Sudoku variant geometry', () => {
	it('uses distinct rule encodings', () => {
		expect(new Set(SUDOKU_VARIANTS.map((v) => JSON.stringify(encodeRules(v)))).size).toBe(11);
	});
	it('rejects duplicate givens even on a complete grid', () => {
		const cells = Array<number>(81).fill(1);
		expect(validGeometryGivens(cells, geometry())).toBe(false);
		expect(countGeometrySolutions(cells, geometry())).toBe(0);
	});
	it('creates nine connected irregular regions', () => {
		const regions = irregularRegions();
		for (let region = 0; region < 9; region++) {
			const cells = regions.map((v, i) => (v === region ? i : -1)).filter((i) => i >= 0);
			expect(cells).toHaveLength(9);
			const seen = new Set([cells[0]!]);
			for (const cell of seen)
				for (const neighbor of [
					cell - 9,
					cell + 9,
					...(cell % 9 ? [cell - 1] : []),
					...(cell % 9 < 8 ? [cell + 1] : [])
				])
					if (cells.includes(neighbor)) seen.add(neighbor);
			expect(seen.size).toBe(9);
		}
	});
});

describe('Sudoku generated variant boards', () => {
	for (const variant of SUDOKU_VARIANTS)
		it(`${variant}: deterministic, unique and logical`, () => {
			const round = createSudokuRound('42', variant);
			const again = createSudokuRound('42', variant);
			expect(round.givens).toEqual(again.givens);
			expect(round.solution).toEqual(again.solution);
			expect(validGeometryGivens(round.solution, round)).toBe(true);
			expect(countGeometrySolutions(round.givens, round)).toBe(1);
			expect(geometryLogicSolvable(round.givens, round)).toBe(true);
			expect(dailySeedOk('42', variant)).toBe(round.grade === 'easy');
			expect(geometryHasLoadBearingClue(round.givens, round, variant)).toBe(true);
		});
	it('disallows hints on no-hint rounds', () => {
		const round = createSudokuRound('42', 'sudoku:no-hint');
		expect(() => applySudokuMove(round, { action: 4, cell: 0, value: 0 })).toThrow();
	});
	it('reserves the last action for a placement win or loss', () => {
		const round = createSudokuRound('42');
		round.loggedMoves = 9999;
		expect(() => applySudokuMove(round, { action: 6, cell: 0, value: 0 })).toThrow();
		expect(typeof canEndSudoku(round)).toBe('boolean');
	});
});

function emptyRound(variant: string) {
	const round = createSudokuRound('42', variant);
	return { ...round, cells: Array<number>(81).fill(0), givens: Array<number>(81).fill(0) };
}

for (const [variant, cell, peer] of [
	['sudoku:diagonal', 0, 40],
	['sudoku:anti-knight', 4, 15]
] as const) {
	it(`refuses ${variant} peer conflicts even outside shared Classic units`, () => {
		const round = emptyRound(variant);
		round.cells[peer] = 1;
		expect(candidateMask(round.cells, cell) & (1 << 1)).toBeTruthy();
		expect(() => applySudokuMove(round, { action: 0, cell, value: 1 })).toThrow('conflict');
		expect(round.mistakes).toBe(0);
		expect(round.cells[cell]).toBe(0);
	});
}

it('uses the irregular region in place of the Classic box', () => {
	const round = emptyRound('sudoku:irregular');
	const clues = round.peers.flatMap((peers, cell) => peers.map((peer) => ({ cell, peer })));
	const different = clues.find(({ cell, peer }) => {
		const board = Array<number>(81).fill(0);
		board[peer] = 1;
		return (candidateMask(board, cell) & (1 << 1)) !== 0;
	})!;
	expect(different).toBeDefined();
	round.cells[different.peer] = 1;
	expect(() => applySudokuMove(round, { action: 0, cell: different.cell, value: 1 })).toThrow(
		'conflict'
	);
});

it('rejects an entry of the wrong parity', () => {
	const round = emptyRound('sudoku:odd-even');
	const cell = round.parity.findIndex(Boolean);
	const value = round.parity[cell] === 1 ? 2 : 1;
	expect(() => applySudokuMove(round, { action: 0, cell, value })).toThrow('conflict');
});

it('rejects a cage repeat and counts a non-repeating wrong cage sum as a mistake', () => {
	const round = emptyRound('sudoku:killer');
	const cage = round.cages[0]!;
	const cell = cage.cells.at(-1)!;
	for (const neighbor of cage.cells.slice(0, -1)) round.cells[neighbor] = round.solution[neighbor]!;
	const repeat = round.cells[cage.cells[0]!]!;
	expect(() => applySudokuMove(round, { action: 0, cell, value: repeat })).toThrow('conflict');
	const value = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
		(digit) =>
			digit !== round.solution[cell] &&
			!cage.cells.some((neighbor) => round.cells[neighbor] === digit)
	)!;
	expect(geometryCandidates(round.cells, cell, round) & (1 << value)).toBe(0);
	expect(applySudokuMove(round, { action: 0, cell, value })).toMatchObject({ mistakes: 1 });
});

for (const variant of ['sudoku:thermo', 'sudoku:kropki', 'sudoku:xv']) {
	it(`logs a conflict-free ${variant} clue violation as a mistake`, () => {
		const round = emptyRound(variant);
		const paths =
			variant === 'sudoku:thermo' ? round.thermos : round.marks.map(({ cells }) => cells);
		const [neighbor, cell] = paths[0]!;
		round.cells[neighbor!] = round.solution[neighbor!]!;
		const invalid = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
			(value) =>
				value !== round.solution[cell!] &&
				(entryMask(round.cells, cell!, round) & (1 << value)) !== 0 &&
				(geometryCandidates(round.cells, cell!, round) & (1 << value)) === 0
		)!;
		expect(invalid).toBeDefined();
		const next = applySudokuMove(round, { action: 0, cell: cell!, value: invalid });
		expect(next.cells[cell!]).toBe(invalid);
		expect(next.mistakes).toBe(1);
	});
}

it('counts Countdown expiry as a terminal move at the cap', () => {
	const round = createSudokuRound('42', 'sudoku:countdown-600');
	const capped = { ...round, loggedMoves: 9999 };
	expect(canEndSudoku(capped)).toBe(true);
	expect(applySudokuMove(capped, { action: 5, cell: 0, value: 0 })).toMatchObject({
		status: 'timeout',
		loggedMoves: 10000
	});
});

it('finds a terminal replacement win and a limit-reaching replacement loss', () => {
	const round = emptyRound('sudoku:classic');
	const cell = 0;
	round.loggedMoves = 9999;
	round.mistakes = 2;
	round.cells[cell] = round.solution[cell] === 1 ? 2 : 1;
	const value = [3, 4, 5].find((digit) => digit !== round.solution[cell])!;
	expect(canEndSudoku(round)).toBe(true);
	expect(applySudokuMove(round, { action: 0, cell, value })).toMatchObject({
		status: 'lost',
		loggedMoves: 10000
	});
	round.cells = round.solution.slice();
	round.cells[cell] = value;
	expect(canEndSudoku(round)).toBe(true);
	expect(applySudokuMove(round, { action: 0, cell, value: round.solution[cell]! })).toMatchObject({
		status: 'won',
		loggedMoves: 10000
	});
});

it('cannot end at the cap when two cells only accept their correct digit', () => {
	const round = createSudokuRound('42');
	round.cells = round.solution.slice();
	round.givens = round.solution.slice();
	for (const cell of [0, 80]) round.cells[cell] = round.givens[cell] = 0;
	round.loggedMoves = 9999;
	round.mistakes = 2;
	expect(canEndSudoku(round)).toBe(false);
	expect(() => applySudokuMove(round, { action: 0, cell: 0, value: round.solution[0]! })).toThrow(
		'moves'
	);
});
