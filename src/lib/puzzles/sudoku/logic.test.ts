import { describe, expect, it } from 'vitest';
import {
	applySudokuMove,
	candidateMask,
	countSolutions,
	createSudokuRound,
	logicSolvable,
	sudokuScore
} from './logic.js';

describe('Sudoku baseline', () => {
	it('generates a deterministic unique logic-solvable board and accepts its solution', () => {
		let round = createSudokuRound('42');
		expect(createSudokuRound('42').givens).toEqual(round.givens);
		expect(countSolutions(round.givens)).toBe(1);
		expect(logicSolvable(round.givens)).toBe(true);
		for (let cell = 0; cell < 81; cell++)
			if (!round.givens[cell])
				round = applySudokuMove(round, { action: 0, cell, value: round.solution[cell]! });
		expect(round.status).toBe('won');
		expect(sudokuScore(round, 300)).toBe(700);
	});
	it('does not guess on an empty board', () => {
		expect(logicSolvable(Array<number>(81).fill(0))).toBe(false);
	});
	it('retains hint and restart deductions through undo', () => {
		let round = createSudokuRound('42');
		round = applySudokuMove(round, { action: 4, cell: 0, value: 0 });
		round = applySudokuMove(round, { action: 3, cell: 0, value: 0 });
		round = applySudokuMove(round, { action: 6, cell: 0, value: 0 });
		expect(round.hints).toBe(1);
		expect(round.hintUsedSession).toBe(true);
		expect(round.restarts).toBe(1);
		expect(round.cells).toEqual(round.givens);
	});
});

it('applies issued scoring values and settings to both scoring paths', () => {
	const values = {
		completion: 990,
		second: 2,
		floor: 140,
		hint: 25,
		mistake: 15,
		restart: 10,
		countdown: 3,
		hintSolvedRanks: 2,
		mistakeLimit: 1,
		hintCap: 1
	};
	const round = createSudokuRound('42');
	const hint = { action: 4, cell: 0, value: 0 };
	const hinted = applySudokuMove(round, hint, values);
	expect(() => applySudokuMove(hinted, hint, values)).toThrow('hint');
	const won = { ...round, status: 'won' as const, hints: 1, mistakes: 1, restarts: 1 };
	expect(sudokuScore(won, 100, values)).toBe(740);
	expect(sudokuScore(won, 900, values)).toBe(90);
	expect(sudokuScore({ ...won, rules: { ...won.rules, timing: 1 } }, 590, values)).toBe(970);
	const wrong = round.givens.flatMap((given, cell) =>
		given
			? []
			: [1, 2, 3, 4, 5, 6, 7, 8, 9]
					.filter(
						(value) =>
							value !== round.solution[cell] && candidateMask(round.cells, cell) & (1 << value)
					)
					.map((value) => ({ action: 0, cell, value }))
	)[0]!;
	expect(applySudokuMove(round, wrong, values)).toMatchObject({ mistakes: 1, status: 'lost' });
});

it('distinguishes advanced logical solving from a unique board that stalls', () => {
	const advanced = Array.from(
		'008000020093006000000040006030000047000090002604100800000050104000200003005031000',
		Number
	);
	const stalled = Array.from(
		'000320670000090510603000000002000001040700300900004008001009000004800000806040020',
		Number
	);
	expect(countSolutions(advanced)).toBe(1);
	expect(logicSolvable(advanced, true)).toBe(false);
	expect(logicSolvable(advanced)).toBe(true);
	expect(countSolutions(stalled)).toBe(1);
	expect(logicSolvable(stalled)).toBe(false);
	expect(countSolutions(Array<number>(81).fill(0))).toBe(2);
});
