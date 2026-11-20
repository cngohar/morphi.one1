import { expect, it } from 'vitest';
import {
	applyShapeDivisionMove,
	canFinishByCheck,
	createShapeDivisionRound,
	equalityPercent,
	inspectDivision,
	scoreForEquality,
	SHAPE_DIVISION_MAX_MOVES,
	SHAPE_DIVISION_VARIANTS,
	type DivisionBoard,
	type ShapeDivisionVariant
} from './logic.js';
import { manifest } from './manifest.js';

const check = { action: 2, first: 0, second: 0 };
const hint = { action: 3, first: 0, second: 0 };
const timeout = { action: 5, first: 0, second: 0 };
const restart = { action: 6, first: 0, second: 0 };

function cuts(board: DivisionBoard, partition = board.solution) {
	const assignment = board.cells.map((_, index) =>
		partition.findIndex((part) => part.includes(index))
	);
	return board.links
		.filter(({ cells: [a, b] }) => assignment[a] !== assignment[b])
		.map(({ edge: [first, second] }) => ({ action: 0, first, second }));
}

function deal(id: ShapeDivisionVariant, seed = '24') {
	return createShapeDivisionRound(seed, id);
}

it('has one Easy witness per preset and only Classic is daily-eligible', () => {
	const seeds = ['24', '0', '5', '2', '4', '12', '1', '24', '24', '1'];
	expect(manifest.variants).toHaveLength(10);
	expect(manifest.variants.filter((preset) => !('daily' in preset) || preset.daily)).toHaveLength(
		1
	);
	for (const [i, variant] of SHAPE_DIVISION_VARIANTS.entries()) {
		const round = deal(variant, seeds[i]);
		expect(round.board.easy, variant).toBe(true);
		expect(manifest.resolveVariantFromRules(round.rules)).toBe(variant);
		expect(manifest.dailySeedOk(round.seed, variant)).toBe(i === 0);
		expect(
			manifest.replay(round.seed, [...cuts(round.board), check], 25, undefined, variant).won
		).toBe(true);
	}
});

it.each([
	['shape-division:pieces-2', '0', 2],
	['shape-division:pieces-5', '5', 5]
] as const)('changes the required count in %s', (id, seed, count) => {
	const round = deal(id, seed);
	const solved = manifest.resumeRound(seed, cuts(round.board), undefined, id);
	expect(solved.pieces).toHaveLength(count);
	expect(applyShapeDivisionMove(solved, check).status).toBe('won');
	const four = [...solved.pieces];
	while (four.length < 4) {
		const part = four.shift()!;
		four.push(part.slice(0, 1), part.slice(1));
	}
	if (four.length > 4) four[0] = [...four[0]!, ...four.pop()!];
	expect(applyShapeDivisionMove({ ...solved, pieces: four }, check)).toMatchObject({
		verdict: 'count',
		mistakes: 1
	});
});

it('uses tetrominoes for the four-square preset', () => {
	const id = 'shape-division:piece-size-4';
	const round = deal(id, '2');
	const solved = manifest.resumeRound('2', cuts(round.board), undefined, id);
	expect(solved.pieces.map((part) => part.length)).toEqual([4, 4, 4, 4]);
	expect(applyShapeDivisionMove(solved, check).status).toBe('won');
	const [a, b, ...rest] = solved.pieces;
	const uneven = [a!.slice(1), [...b!, a![0]!], ...rest];
	expect(applyShapeDivisionMove({ ...solved, pieces: uneven }, check).verdict).toBe('size');
});

it('accepts noncongruent equal-area divisions and rejects unequal areas', () => {
	const id = 'shape-division:equal-area';
	const seed = '4';
	const round = deal(id, seed);
	const { answers, forced } = inspectDivision(round.board.cells, 3, { equalArea: true });
	expect(forced).toBe(true);
	expect(answers).toHaveLength(2);
	const alternate = answers.find((parts) =>
		parts.some((part) => {
			const [x, y] = round.board.cells[part[0]!]!;
			return (
				!part.every((i) => round.board.cells[i]![0] === x) &&
				!part.every((i) => round.board.cells[i]![1] === y)
			);
		})
	)!;
	const sameArea = manifest.resumeRound(seed, cuts(round.board, alternate), undefined, id);
	expect(applyShapeDivisionMove(sameArea, check).status).toBe('won');
	expect(
		applyShapeDivisionMove({ ...sameArea, rules: { ...sameArea.rules, relation: 0 } }, check)
			.verdict
	).toBe('shape');
	const [a, b, ...rest] = sameArea.pieces;
	expect(
		applyShapeDivisionMove({ ...sameArea, pieces: [a!.slice(1), [...b!, a![0]!], ...rest] }, check)
			.verdict
	).toBe('size');
});

it('makes trees load-bearing while preserving a forced starting placement', () => {
	const id = 'shape-division:one-tree';
	const seed = '12';
	const round = deal(id, seed);
	const { cells, trees, solution } = round.board;
	const unrestricted = inspectDivision(cells, 3);
	const withClue = inspectDivision(cells, 3, { trees });
	expect(unrestricted.answers).toHaveLength(2);
	expect(withClue).toEqual({ answers: [solution], forced: true });
	const prohibited = unrestricted.answers.find((parts) =>
		parts.some((piece) => piece.filter((cell) => trees.includes(cell)).length !== 1)
	)!;
	const wrong = manifest.resumeRound(
		seed,
		[...cuts(round.board, prohibited), check],
		undefined,
		id
	);
	expect(wrong).toMatchObject({ status: 'playing', verdict: 'tree', mistakes: 1 });
	expect(manifest.replay(seed, [...cuts(round.board), check], 1, undefined, id).won).toBe(true);
});

it('requires every piece to match the shown shape', () => {
	const id = 'shape-division:shape-given';
	const seed = '1';
	const round = deal(id, seed);
	const solved = manifest.resumeRound(seed, cuts(round.board), undefined, id);
	const given = inspectDivision(round.board.cells, 3, { given: round.board.given });
	expect(given.answers).toEqual([round.board.solution]);
	expect(applyShapeDivisionMove(solved, check).status).toBe('won');
	const wrongClue = [
		[0, 0],
		[1, 0],
		[2, 0]
	] as const;
	expect(
		applyShapeDivisionMove({ ...solved, board: { ...solved.board, given: [...wrongClue] } }, check)
			.verdict
	).toBe('given');
});

it('accepts only deadlines and never resets countdown timing via Restart', () => {
	const id = 'shape-division:countdown-300';
	const seed = '24';
	const win = [...cuts(deal(id, seed).board), check];
	expect(manifest.replay(seed, win, 299, undefined, id)).toMatchObject({ won: true, score: 702 });
	expect(() => manifest.replay(seed, win, 300, undefined, id)).toThrow('timeout');
	expect(() => manifest.replay(seed, [timeout], 299, undefined, id)).toThrow('timeout');
	expect(manifest.replay(seed, [restart, timeout], 300, undefined, id)).toMatchObject({
		won: false,
		score: 0
	});
	expect(manifest.replay(seed, [timeout], 302, undefined, id).won).toBe(false);
	expect(() => manifest.replay(seed, [timeout], 303, undefined, id)).toThrow('timeout');
});

it('rejects replayed hints in the no-hint preset', () => {
	const round = deal('shape-division:no-hint');
	expect(round.rules.hint).toBe(0);
	expect(() => applyShapeDivisionMove(round, hint)).toThrow('hint');
});

it('scales a completed 50% division and gives the full score for a perfect division', () => {
	const id = 'shape-division:equality-score';
	const seed = '1';
	const round = deal(id, seed);
	const fifty = [
		{ action: 0, first: 10, second: 17 },
		{ action: 0, first: 12, second: 19 },
		{ action: 0, first: 24, second: 25 },
		check
	];
	const finished = manifest.resumeRound(seed, fifty, undefined, id);
	expect(finished.pieces.map((part) => part.length).sort()).toEqual([2, 2, 4, 4]);
	expect(equalityPercent(finished)).toBe(50);
	expect(manifest.replay(seed, fifty, 10, undefined, id)).toMatchObject({ won: true, score: 495 });
	expect(manifest.replay(seed, [...cuts(round.board), check], 10, undefined, id)).toMatchObject({
		won: true,
		score: 990
	});
	expect(scoreForEquality(990, 42)).toBe(415);
});

it('never spends mistakes on an incomplete Equality-score Check and reserves the final slot', () => {
	const id = 'shape-division:equality-score';
	const round = deal(id, '1');
	expect(applyShapeDivisionMove(round, check, { mistakeLimit: 1 })).toMatchObject({
		status: 'playing',
		verdict: 'equality',
		mistakes: 0
	});
	const last = { ...round, moves: SHAPE_DIVISION_MAX_MOVES - 1 };
	expect(canFinishByCheck(last, { mistakeLimit: 1 })).toBe(false);
	expect(() => applyShapeDivisionMove(last, check, { mistakeLimit: 1 })).toThrow('move_limit');
	const ready = {
		...manifest.resumeRound('1', cuts(round.board), undefined, id),
		moves: last.moves
	};
	expect(canFinishByCheck(ready, { mistakeLimit: 1 })).toBe(true);
	expect(applyShapeDivisionMove(ready, check, { mistakeLimit: 1 }).status).toBe('won');
});
