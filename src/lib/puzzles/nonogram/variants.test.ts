import { expect, it } from 'vitest';
import {
	applyNonogramMove,
	countNonogramSolutions,
	createNonogramRound,
	nonogramRemainingMs,
	nonogramScore,
	nonogramSolverRules,
	NONOGRAM_ACTION,
	NONOGRAM_VARIANTS,
	solveNonogramLines,
	type NonogramRound
} from './logic.js';
import { manifest } from './manifest.js';

const solution = (round: NonogramRound) =>
	solveNonogramLines(
		round.size,
		round.rowClues,
		round.columnClues,
		undefined,
		undefined,
		nonogramSolverRules(round)
	).grid;
const action = (round: NonogramRound, mark: number, cell = -1, at = round.lastAt + 1) =>
	applyNonogramMove(round, { at: Math.max(0, at), cell, mark, stroke: round.strokes });
function clear(round: NonogramRound) {
	for (const [cell, value] of solution(round).entries())
		if (value > 0 || round.rules.allDecided) round = action(round, value || -1, cell);
	return round;
}

for (const variant of NONOGRAM_VARIANTS) {
	it(`${variant} passes its actual solver and unique replay without board groups`, () => {
		for (const seed of ['1', '42', '314159']) {
			const round = createNonogramRound(seed, variant),
				rules = nonogramSolverRules(round);
			const solved = solveNonogramLines(
				round.size,
				round.rowClues,
				round.columnClues,
				undefined,
				undefined,
				rules
			);
			expect(solved.complete).toBe(true);
			expect(solved.steps).toBeGreaterThan(0);
			expect(
				countNonogramSolutions(round.size, round.rowClues, round.columnClues, undefined, rules)
			).toBe(1);
			expect(clear(round).status).toBe('won');
			expect(manifest.variants.find((entry) => entry.id === variant)).not.toHaveProperty(
				'leaderboardGroups'
			);
		}
	});
}

for (const colours of [2, 5]) {
	it(`${colours} colours change matching rather than only appearance`, () => {
		const round = createNonogramRound('42', `nonogram:colour-${colours}`),
			answer = solution(round);
		expect(new Set(answer.filter((colour) => colour > 0)).size).toBe(colours);
		const cell = answer.findIndex((colour) => colour > 1);
		const wrong = action(round, 1, cell);
		expect(wrong.mistakes).toBe(1);
		expect(wrong.cells[cell]).toBe(0);
		expect(action(wrong, answer[cell]!, cell).cells[cell]).toBe(answer[cell]);
	});
}

it('partial clues remove seeded information and solve against physically reduced clues', () => {
	const round = createNonogramRound('42', 'nonogram:partial-clues');
	const hidden = [...(round.hiddenRows ?? []), ...(round.hiddenColumns ?? [])];
	expect(hidden.filter(Boolean)).toHaveLength(Math.floor((round.size * 2) / 4));
	for (const [axis, mask] of [
		[round.rowClues, round.hiddenRows],
		[round.columnClues, round.hiddenColumns]
	] as const)
		mask?.forEach((value, index) => {
			if (value) expect(axis[index]).toEqual([]);
		});
	expect(solveNonogramLines(round.size, round.rowClues, round.columnClues).contradiction).toBe(
		true
	);
	expect(clear(round).status).toBe('won');
});

it('totals-only uses filled totals and rejects ambiguous totals independently of run clues', () => {
	const round = createNonogramRound('42', 'nonogram:totals-only');
	expect(round.rules.totalsOnly).toBe(true);
	expect([...round.rowClues, ...round.columnClues].every((line) => line.length <= 1)).toBe(true);
	const clues = [[{ length: 1, colour: 1 }], [{ length: 1, colour: 1 }]];
	expect(
		solveNonogramLines(2, clues, clues, undefined, undefined, { totalsOnly: true }).complete
	).toBe(false);
	expect(countNonogramSolutions(2, clues, clues, undefined, { totalsOnly: true })).toBe(2);
});

it('unchecked preserves wrong fills, counts Check once and requires every cell decided', () => {
	const round = createNonogramRound('42', 'nonogram:unchecked'),
		answer = solution(round);
	const empty = answer.indexOf(0);
	let wrong = action(round, 1, empty);
	expect(wrong.cells[empty]).toBe(1);
	expect(wrong.mistakes).toBe(0);
	wrong = action(wrong, NONOGRAM_ACTION.check);
	expect(wrong.checkCells).toContain(empty);
	expect(wrong.mistakes).toBe(1);
	expect(action(wrong, NONOGRAM_ACTION.check).mistakes).toBe(1);
	let filled = round;
	for (const [cell, value] of answer.entries()) if (value) filled = action(filled, value, cell);
	expect(filled.status).toBe('playing');
	for (const [cell, value] of answer.entries()) if (!value) filled = action(filled, -1, cell);
	expect(filled.status).toBe('won');
});

it('strict Check returns only a count and wins automatically from correct filled cells', () => {
	const round = createNonogramRound('42', 'nonogram:strict-count');
	const wrong = action(round, 1, solution(round).indexOf(0));
	expect(wrong.cells).not.toEqual(round.cells);
	expect(wrong.lastMistake).toBe(-1);
	const checked = action(wrong, NONOGRAM_ACTION.check);
	expect(checked.checkCount).toBe(1);
	expect(checked.checkCells).toEqual([]);
	expect(clear(round).status).toBe('won');
});

it('countdown penalties double then cap, timeout loses and remaining seconds add to scoring', () => {
	let round = createNonogramRound('42', 'nonogram:countdown');
	const empty = solution(round).indexOf(0);
	for (const penalty of [120000, 360000, 840000, 1320000]) {
		round = action(round, 1, empty, 0);
		expect(round.timePenaltyMs).toBe(penalty);
	}
	expect(nonogramRemainingMs(round, 0)).toBe(480000);
	const lost = action(round, NONOGRAM_ACTION.tick, -1, 480000);
	expect(lost.status).toBe('lost');
	expect(nonogramScore(lost, 480)).toBe(0);
	const won = clear(createNonogramRound('42', 'nonogram:countdown'));
	expect(nonogramScore(won, 10)).toBe(
		1000 + won.filledCells * 10 + Math.max(0, won.par - 10) * 10 + 1790 * 10
	);
	expect(() => nonogramScore(won, 1800)).toThrow(RangeError);
});

it('three hearts refuse wrong fills, lose exactly at zero and pay surviving hearts', () => {
	let round = createNonogramRound('42', 'nonogram:three-hearts');
	const empty = solution(round).indexOf(0);
	for (const hearts of [2, 1, 0]) {
		round = action(round, 1, empty);
		expect(round.hearts).toBe(hearts);
		expect(round.cells[empty]).toBe(0);
	}
	expect(round.status).toBe('lost');
	expect(nonogramScore(round, 10)).toBe(0);
	const won = clear(createNonogramRound('42', 'nonogram:three-hearts'));
	expect(nonogramScore(won, 10)).toBe(
		1000 + won.filledCells * 10 + Math.max(0, won.par - 10) * 10 + 750
	);
});

it('no-undo rejects rollback but allows individual erase', () => {
	const round = action(createNonogramRound('42', 'nonogram:no-undo'), -1, 0);
	expect(() => action(round, NONOGRAM_ACTION.undo)).toThrow(RangeError);
	expect(action(round, 0, 0).cells[0]).toBe(0);
});

it('hint budget ends at three and Undo/Restart cannot restore spent hints', () => {
	let round = createNonogramRound('42', 'nonogram:hint-budget');
	for (let i = 0; i < 3; i++) round = action(round, NONOGRAM_ACTION.hint);
	expect(round.hintsUsed).toBe(3);
	expect(() => action(round, NONOGRAM_ACTION.hint)).toThrow(RangeError);
	const restarted = action(round, NONOGRAM_ACTION.restart);
	expect(restarted.hintsUsed).toBe(3);
	expect(() => action(restarted, NONOGRAM_ACTION.hint)).toThrow(RangeError);
});
