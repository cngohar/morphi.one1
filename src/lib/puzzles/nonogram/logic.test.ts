import { describe, expect, it } from 'vitest';
import {
	applyNonogramMove,
	countNonogramSolutions,
	createNonogramRound,
	deriveLineClues,
	deriveNonogramClues,
	linePlacements,
	nonogramScore,
	NONOGRAM_ACTION,
	solveNonogramLines,
	type NonogramRound
} from './logic.js';
import { manifest } from './manifest.js';
import { scoring } from './scoring.js';

function answer(round: NonogramRound) {
	return solveNonogramLines(round.size, round.rowClues, round.columnClues).grid;
}
function move(round: NonogramRound, cell: number, mark: number, stroke = round.strokes) {
	return applyNonogramMove(round, { cell, mark, stroke, at: Math.max(0, round.lastAt + 1) });
}

describe('Nonogram baseline and group-less contract', () => {
	it('generates deterministically with recomputed clues, density and fair unique openings', () => {
		const pictures = new Set<string>();
		for (const seed of ['1', '2', '3', '42', '99', '123', '314159', '18446744073709551615']) {
			const round = createNonogramRound(seed);
			expect(createNonogramRound(seed, 'nonogram:classic')).toEqual(round);
			const solved = solveNonogramLines(round.size, round.rowClues, round.columnClues);
			expect(solved.complete).toBe(true);
			expect(solved.steps).toBeGreaterThan(0);
			expect(countNonogramSolutions(round.size, round.rowClues, round.columnClues)).toBe(1);
			expect(deriveNonogramClues(solved.grid, round.size)).toEqual({
				rowClues: round.rowClues,
				columnClues: round.columnClues
			});
			expect(round.filledCells).toBeGreaterThanOrEqual(Math.floor((round.size * round.size) / 2));
			expect(round.filledCells).toBeLessThanOrEqual(Math.ceil((round.size * round.size * 3) / 5));
			expect(round).not.toHaveProperty('solution');
			expect(round).not.toHaveProperty('deduced');
			pictures.add(JSON.stringify(solved.grid));
		}
		expect(pictures.size).toBeGreaterThan(3);
	});

	it('derives zero/full clues and separates equal colours while allowing different colours to touch', () => {
		expect(deriveLineClues([0, 0, 0])).toEqual([]);
		expect(deriveLineClues([1, 1, 1])).toEqual([{ length: 3, colour: 1 }]);
		expect(deriveLineClues([1, 0, 1, 2])).toEqual([
			{ length: 1, colour: 1 },
			{ length: 1, colour: 1 },
			{ length: 1, colour: 2 }
		]);
		expect(
			linePlacements(2, [
				{ length: 1, colour: 1 },
				{ length: 1, colour: 1 }
			])
		).toEqual([]);
		expect(
			linePlacements(3, [
				{ length: 1, colour: 1 },
				{ length: 1, colour: 1 }
			])
		).toEqual([[1, 0, 1]]);
		expect(
			linePlacements(2, [
				{ length: 1, colour: 1 },
				{ length: 1, colour: 2 }
			])
		).toEqual([[1, 2]]);
	});

	it('rejects the ambiguous 2×2 checkerboard instead of certifying a unique-only puzzle', () => {
		const rows = [[{ length: 1, colour: 1 }], [{ length: 1, colour: 1 }]];
		expect(solveNonogramLines(2, rows, rows).complete).toBe(false);
		expect(countNonogramSolutions(2, rows, rows)).toBe(2);
	});

	it('rejects illegal wire fields, coordinates, timestamps and bent strokes', () => {
		const round = createNonogramRound('1');
		expect(() => manifest.parseMove({ at: 0, cell: 0, mark: -1, stroke: 0, extra: 1 })).toThrow(
			RangeError
		);
		for (const cell of [-1, round.cells.length, 0.5])
			expect(() => move(round, cell, 1)).toThrow(RangeError);
		const first = move(round, 0, -1);
		const second = move(first, 1, -1, 0);
		expect(() => move(second, round.size + 1, -1, 0)).toThrow(RangeError);
		expect(() => applyNonogramMove(first, { at: -1, cell: 1, mark: -1, stroke: 1 })).toThrow(
			RangeError
		);
	});

	it('refuses wrong fills without penalizing X and stops the checked stroke', () => {
		const round = createNonogramRound('42');
		const empty = answer(round).indexOf(0);
		const wrong = move(round, empty, 1);
		expect(wrong.cells[empty]).toBe(0);
		expect(wrong.mistakes).toBe(1);
		expect(wrong.strokeStopped).toBe(true);
		const crossed = move(wrong, answer(round).indexOf(1), -1);
		expect(crossed.mistakes).toBe(1);
	});

	it('undo restores a complete stroke and Auto-X, keeping spent penalties and hints', () => {
		let round = createNonogramRound('1');
		const before = round;
		round = move(round, 0, -1);
		round = move(round, 1, -1, 0);
		round = move(round, -1, NONOGRAM_ACTION.undo);
		expect(round.cells).toEqual(before.cells);
		const hinted = move(round, -1, NONOGRAM_ACTION.hint);
		const undone = move(hinted, -1, NONOGRAM_ACTION.undo);
		expect(undone.cells).toEqual(round.cells);
		expect(undone.hintsUsed).toBe(1);
		const automatic = move(undone, -1, NONOGRAM_ACTION.autoXOn);
		const restored = move(automatic, -1, NONOGRAM_ACTION.undo);
		expect(restored.autoX).toBe(false);
		expect(restored.cells).toEqual(undone.cells);
	});

	it('restarts the same puzzle and retains spent hints, timing and counters', () => {
		const original = createNonogramRound('1');
		const hinted = move(original, -1, NONOGRAM_ACTION.hint);
		const restarted = move(hinted, -1, NONOGRAM_ACTION.restart);
		expect(restarted.seed).toBe(original.seed);
		expect(restarted.rowClues).toEqual(original.rowClues);
		expect(restarted.cells).toEqual(original.cells);
		expect(restarted.hintsUsed).toBe(1);
		expect(restarted.lastAt).toBeGreaterThan(hinted.lastAt);
	});

	it('undo restores a stroke that completed a line and automatically crossed its empty cells', () => {
		let round = move(createNonogramRound('42'), -1, NONOGRAM_ACTION.autoXOn);
		const solved = answer(round);
		const row = Array.from({ length: round.size }, (_, index) => index).find((index) => {
			const line = solved.slice(index * round.size, (index + 1) * round.size);
			return line.includes(0) && line.includes(1);
		})!;
		const before = round.cells.slice(),
			stroke = round.strokes;
		const cells = solved.flatMap((value, cell) =>
			value > 0 && Math.floor(cell / round.size) === row ? [cell] : []
		);
		for (const cell of cells) round = move(round, cell, 1, stroke);
		expect(round.cells.slice(row * round.size, (row + 1) * round.size).includes(0)).toBe(false);
		round = move(round, -1, NONOGRAM_ACTION.undo);
		expect(round.cells).toEqual(before);
		expect(round.autoX).toBe(true);
	});

	it('registers, resumes and replays without a group and scores only a complete player grid', () => {
		let round = createNonogramRound('42');
		const moves = answer(round).flatMap((mark, cell) =>
			mark > 0 ? [{ cell, mark, stroke: 0, at: 0 }] : []
		);
		moves.forEach((value, index) => {
			value.stroke = index;
			value.at = index;
			round = applyNonogramMove(round, value);
		});
		expect(round.status).toBe('won');
		expect(manifest.resumeRound('42', moves, undefined, undefined)).toEqual(round);
		const replay = manifest.replay('42', moves, 10, undefined, undefined);
		expect(replay).not.toHaveProperty('group');
		expect(manifest).not.toHaveProperty('leaderboardGroups');
		expect(replay.score).toBe(1000 + round.filledCells * 10 + (round.par - 10) * 10);
		expect(() => manifest.replay('42', moves.slice(0, -1), 10, undefined, undefined)).toThrow(
			RangeError
		);
		expect(() =>
			manifest.replay(
				'42',
				[...moves, { at: 1000, cell: 999, mark: 1, stroke: moves.length }],
				10,
				undefined,
				undefined
			)
		).toThrow(RangeError);
		expect(nonogramScore({ ...round, mistakes: 10000 }, 10, scoring.defaults)).toBe(0);
	});
});
