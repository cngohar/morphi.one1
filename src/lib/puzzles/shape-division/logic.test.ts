import { expect, it } from 'vitest';
import {
	activeCutEdges,
	applyShapeDivisionMove,
	boardGeometry,
	createShapeDivisionRound,
	dailySeedOk,
	findCutPath,
	inspectDivision,
	nextHintCell,
	shapeDivisionEntranceMs,
	SHAPE_DIVISION_MAX_MOVES,
	type Cell,
	type ShapeDivisionMove
} from './logic.js';
import { manifest } from './manifest.js';

const check = { action: 2, first: 0, second: 0 };
const hint = { action: 3, first: 0, second: 0 };
const undo = { action: 4, first: 0, second: 0 };
const restart = { action: 6, first: 0, second: 0 };
const squareCells: Cell[] = Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)]);
const squareBoard = boardGeometry(squareCells);

function witness(seed = '24'): ShapeDivisionMove[] {
	const { board } = createShapeDivisionRound(seed);
	return board.links.flatMap(({ edge: [first, second], cells: [a, b] }) =>
		board.solution.some((piece) => piece.includes(a) && piece.includes(b))
			? []
			: [{ action: 0, first, second }]
	);
}

it('generates a deterministic, uniquely solvable Classic board with a forced corner', () => {
	const round = createShapeDivisionRound('24');
	expect(createShapeDivisionRound('24')).toEqual(round);
	expect(round.board).toMatchObject({ width: 7, height: 5, perimeter: 26 });
	expect(inspectDivision(round.board.cells, 3)).toEqual({
		answers: [round.board.solution],
		forced: true
	});
	expect(shapeDivisionEntranceMs('24')).toBe(2080);
	expect(dailySeedOk('24')).toBe(true);
	expect(dailySeedOk('0')).toBe(false);
});

it('distinguishes zero covers, a unique cover and ambiguity with no forced corner', () => {
	expect(inspectDivision(squareCells, 3).answers).toHaveLength(0);
	expect(inspectDivision(createShapeDivisionRound('24').board.cells, 3).answers).toHaveLength(1);
	expect(inspectDivision(squareCells, 4)).toMatchObject({
		answers: [expect.any(Array), expect.any(Array)],
		forced: false
	});
});

it('routes straight and stepped cuts, ignoring outline-only travel', () => {
	expect(findCutPath(squareBoard, 2, 22)).toEqual([
		[2, 7],
		[7, 12],
		[12, 17],
		[17, 22]
	]);
	expect(findCutPath(squareBoard, 0, 24)).toHaveLength(6);
	expect(findCutPath(squareBoard, 24, 0)).toEqual(findCutPath(squareBoard, 0, 24));
	expect(findCutPath(squareBoard, 0, 12)).toHaveLength(3);
	expect(findCutPath(squareBoard, 0, 4)).toBeNull();
	expect(findCutPath(squareBoard, 0, 25)).toBeNull();
});

it('checks properties on a square with four pieces at 25% but two shapes', () => {
	const initial = createShapeDivisionRound('24');
	let round = {
		...initial,
		rules: { ...initial.rules, pieceSize: 4 },
		board: squareBoard,
		pieces: [squareCells.map((_, i) => i)]
	};
	const cuts = [
		[5, 9],
		[10, 14],
		[12, 22]
	] as const;
	for (const [first, second] of cuts)
		round = applyShapeDivisionMove(round, { action: 0, first, second });
	expect(round.pieces.map((part) => part.length)).toEqual([4, 4, 4, 4]);
	const rejected = applyShapeDivisionMove(round, check);
	expect(rejected).toMatchObject({
		pieces: round.pieces,
		mistakes: 1,
		verdict: 'shape',
		status: 'playing'
	});
});

it('logs toggle, undo and restart without refunding hints or undoing mistakes', () => {
	const cut = witness()[0]!;
	const first = manifest.resumeRound('24', [hint, cut, { ...cut, action: 1 }, undo, check, undo]);
	expect(first).toMatchObject({ moves: 6, cuts: [], mistakes: 1, restarts: 0 });
	expect(first.hints).toEqual([nextHintCell(createShapeDivisionRound('24'))]);
	const reset = applyShapeDivisionMove(first, restart);
	expect(reset).toMatchObject({
		board: first.board,
		moves: 7,
		cuts: [],
		mistakes: 0,
		restarts: 1,
		hints: first.hints
	});
	expect(manifest.replay('24', [hint, check, restart, ...witness(), check], 10)).toEqual({
		score: 840,
		won: true,
		pairs: null,
		moves: witness().length + 4,
		hintUsed: true
	});
});

it('keeps the cuts on loss and honors a zero mistake limit', () => {
	const cut = witness()[0]!;
	const lost = manifest.resumeRound('24', [cut, check, check, check]);
	expect(lost).toMatchObject({ status: 'lost', mistakes: 3, verdict: 'count' });
	expect(activeCutEdges(lost)).toEqual([[cut.first, cut.second]]);
	expect(manifest.replay('24', [cut, check, check, check], 10)).toMatchObject({
		won: false,
		score: 0
	});
	expect(
		manifest.resumeRound('24', [check, check, check, check], { mistakeLimit: 0 })
	).toMatchObject({
		status: 'playing',
		mistakes: 4
	});
});

it('reserves the last move for a terminal check and rejects invalid wire state', () => {
	const start = { ...createShapeDivisionRound('24'), moves: SHAPE_DIVISION_MAX_MOVES - 1 };
	expect(() => applyShapeDivisionMove(start, check)).toThrow('move_limit');
	expect(() => applyShapeDivisionMove(start, restart)).toThrow('move_limit');
	expect(applyShapeDivisionMove({ ...start, mistakes: 2 }, check)).toMatchObject({
		status: 'lost',
		moves: SHAPE_DIVISION_MAX_MOVES
	});
	expect(() =>
		applyShapeDivisionMove({ ...start, mistakes: 2 }, check, { mistakeLimit: 0 })
	).toThrow('move_limit');
	expect(() => manifest.parseMove({ ...check, extra: 1 })).toThrow('move');
	expect(manifest.parseMove({ action: 0, first: -1, second: 100 })).toEqual({
		action: 0,
		first: -1,
		second: 100
	});
	expect(() => manifest.resumeRound('24', [{ action: 0, first: -1, second: 100 }])).toThrow('cut');
	expect(() => manifest.resumeRound('24', Array(SHAPE_DIVISION_MAX_MOVES + 1).fill(check))).toThrow(
		'move_limit'
	);
});

it('chooses a compatible hint after a cut and refuses when every witness piece was split', () => {
	const start = createShapeDivisionRound('24');
	const witnessInternals = start.board.solution.map((part) =>
		start.board.links.find(({ cells: [a, b] }) => part.includes(a) && part.includes(b))!
	);
	const cuts = witnessInternals.map(({ edge: [first, second] }) => ({ action: 0, first, second }));
	const split = applyShapeDivisionMove(start, cuts[0]!);
	expect(start.board.solution[0]).not.toContain(nextHintCell(split));
	const noCompatible = cuts
		.slice(1)
		.reduce((round, move) => applyShapeDivisionMove(round, move), split);
	expect(nextHintCell(noCompatible)).toBeNull();
	expect(() => applyShapeDivisionMove(noCompatible, hint)).toThrow('hint');
	expect(noCompatible.hints).toEqual([]);
});
