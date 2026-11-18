import { expect, it, vi } from 'vitest';
import * as rng from '#lib/engine/rng.js';
import {
	applyWordGuessMove,
	createWordGuessRound,
	encodeRules,
	encodeWord,
	generationDiagnostics,
	guessError,
	hintTarget,
	resolveVariantFromRules,
	wordGuessScore,
	WORD_GUESS_VARIANTS,
	type WordGuessRound
} from './logic.js';
import { manifest } from './manifest.js';
import { WORD_LISTS } from './words.js';
import { scoring } from './scoring.js';
const guess = (round: WordGuessRound, word: string) =>
	applyWordGuessMove(round, { action: 0, code: encodeWord(word) });
const fixture = (variant: string, answer = 'APPLE') => {
	const round = createWordGuessRound('1', variant);
	round.boards[0]!.answer = answer;
	return round;
};

it('Classic has exactly five numeric rule keys and no hints', () => {
	const round = fixture('word-guess:classic');
	expect(Object.keys(round.rules).sort()).toEqual([
		'boards',
		'constraint',
		'hint',
		'length',
		'timing'
	]);
	expect(() => applyWordGuessMove(round, { action: 1, code: 0 })).toThrow(RangeError);
});
it('hard-mode rejects missing confirmed letters while allowing grey reuse', () => {
	const hard = guess(fixture('word-guess:hard-mode'), 'PAPER');
	expect(guessError(hard, 'MUSIC')).toMatch(/^green:/);
	expect(() => guess(hard, 'MUSIC')).toThrow(RangeError);
	expect(guessError(guess(fixture('word-guess:classic'), 'PAPER'), 'MUSIC')).toBeNull();
	const grey = guess(fixture('word-guess:hard-mode', 'CRANE'), 'BLOOM');
	expect(guessError(grey, 'BLOOM')).toBeNull();
});
it('ultra-hard moves present positions and forbids surplus grey copies, preserving exact duplicates', () => {
	const ultra = guess(fixture('word-guess:ultra-hard'), 'PAPER');
	expect(guessError(ultra, 'PAPER')).toMatch(/^position:/);
	expect(guessError(guess(fixture('word-guess:hard-mode'), 'PAPER'), 'PAPER')).toBeNull();
	expect(guessError(guess(fixture('word-guess:ultra-hard', 'CRANE'), 'BLOOM'), 'BLOOM')).toMatch(
		/^grey:/
	);
	const duplicate = guess(fixture('word-guess:ultra-hard', 'PEARL'), 'PUPPY');
	expect(guess(duplicate, 'PEARL').status).toBe('won');
});
for (const length of [4, 6, 7] as const)
	it(`length-${length} changes the legal word length and solves`, () => {
		const round = createWordGuessRound('1', `word-guess:length-${length}`);
		expect(guessError(round, 'APPLE')).toBe('length');
		expect(round.boards[0]!.answer).toHaveLength(length);
		expect(guess(round, round.boards[0]!.answer).status).toBe('won');
	});
for (const [boards, budget] of [
	[2, 7],
	[4, 9],
	[8, 13]
] as const)
	it(`boards-${boards} shares each guess and budgets ${budget} tries`, () => {
		let round = createWordGuessRound('1', `word-guess:boards-${boards}`);
		expect(round.budget).toBe(budget);
		expect(new Set(round.boards.map((board) => board.answer)).size).toBe(boards);
		const answers = round.boards.map((board) => board.answer);
		round = guess(round, answers[0]!);
		expect(round.boards.every((board) => board.feedback.length === 1)).toBe(true);
		expect(round.status).toBe('playing');
		for (const answer of answers.slice(1)) round = guess(round, answer);
		expect(round.status).toBe('won');
		expect(round.boards.map((board) => board.solvedAt)).toEqual(
			Array.from({ length: boards }, (_, at) => at + 1)
		);
		expect(wordGuessScore(round, 10)).toBe(
			scoring.fields
				.slice(0, boards)
				.reduce((sum, field) => sum + scoring.defaults[field as keyof typeof scoring.defaults], 0)
		);
	});
it('countdown-120 pays remaining seconds and accepts no result at expiry', () => {
	const round = createWordGuessRound('1', 'word-guess:countdown-120');
	const won = guess(round, round.boards[0]!.answer);
	expect(wordGuessScore(won, 5)).toBe(1250);
	expect(() => wordGuessScore(won, 120)).toThrow('timeout');
	expect(wordGuessScore(guess(createWordGuessRound('1'), round.boards[0]!.answer), 5)).toBe(100);
});
it('hint-budget-3 reveals leftmost unknown positions, replays hints and can win at zero', () => {
	let round = fixture('word-guess:hint-budget-3');
	round = guess(round, 'PAPER');
	expect(hintTarget(round)).toEqual({ board: 0, position: 0, letter: 'A' });
	for (let at = 0; at < 3; at++) round = applyWordGuessMove(round, { action: 1, code: 0 });
	expect(round.guesses).toHaveLength(1);
	expect(round.boards[0]!.revealed).toEqual(['A', 'P', null, 'L', null]);
	expect(() => applyWordGuessMove(round, { action: 1, code: 0 })).toThrow(RangeError);
	expect(wordGuessScore(guess(round, 'APPLE'), 10)).toBe(0);
	const seeded = createWordGuessRound('1', 'word-guess:hint-budget-3');
	const moves = [
		{ action: 1, code: 0 },
		{ action: 0, code: encodeWord(seeded.boards[0]!.answer) }
	];
	expect(manifest.replay('1', moves, 10, undefined, 'word-guess:hint-budget-3')).toMatchObject({
		score: 0,
		won: true,
		hintUsed: true
	});
	expect(
		manifest.resumeRound('1', moves, undefined, 'word-guess:hint-budget-3').hintUsedSession
	).toBe(true);
});
it('hint targeting skips solved boards and no hint writes a guess', () => {
	let round = createWordGuessRound('1', 'word-guess:boards-2');
	round = guess(round, round.boards[0]!.answer);
	expect(hintTarget(round)?.board).toBe(1);
	round.rules.hint = 1;
	const after = applyWordGuessMove(round, { action: 1, code: 0 });
	expect(after.guesses).toEqual(round.guesses);
	expect(after.boards[0]).toEqual(round.boards[0]);
});
it('all eleven rules are unique single-axis deltas and E1 never resolves', () => {
	const baseline = encodeRules();
	expect(manifest.variants).toHaveLength(11);
	expect(manifest.variants.every((variant) => variant.enabled)).toBe(true);
	expect(
		new Set(WORD_GUESS_VARIANTS.map((variant) => JSON.stringify(encodeRules(variant)))).size
	).toBe(11);
	for (const variant of WORD_GUESS_VARIANTS.slice(1))
		expect(
			Object.entries(encodeRules(variant)).filter(
				([key, value]) => baseline[key as keyof typeof baseline] !== value
			)
		).toHaveLength(1);
	expect(() => resolveVariantFromRules({ ...baseline, constraint: 1, boards: 2 })).toThrow('rules');
	expect(() => resolveVariantFromRules({ ...baseline, timing: 2 })).toThrow('rules');
});
it('per-board guesses 7–13 use the configured extension, and a multi-board loss remains zero', () => {
	const round = createWordGuessRound('1', 'word-guess:boards-8');
	for (let turn = 7; turn <= 13; turn++) {
		const won = {
			...round,
			status: 'won' as const,
			boards: round.boards.map((board) => ({ ...board, solvedAt: turn }))
		};
		expect(wordGuessScore(won, 10)).toBe(8 * [25, 20, 15, 10, 5, 5, 5][turn - 7]!);
	}
	expect(wordGuessScore({ ...round, status: 'lost' }, 10)).toBe(0);
});
it('generation bounds duplicate draws and the solver rejects a deliberately unguessable answer', () => {
	const original = rng.createRng('1');
	const mock = vi.spyOn(rng, 'createRng').mockReturnValue({ ...original, nextU64: () => 0n });
	try {
		expect(generationDiagnostics('1', 'word-guess:boards-8')).toEqual({
			ok: false,
			tally: { answer: 0, solver: 0, curation: 0, distinct: 100, attempts: 101 }
		});
	} finally {
		mock.mockRestore();
	}
	const words = WORD_LISTS[5].answers;
	words.push('ZZZZZ');
	const reject = vi
		.spyOn(rng, 'createRng')
		.mockReturnValue({ ...original, nextU64: () => BigInt(words.length - 1) });
	try {
		expect(generationDiagnostics('1').tally.solver).toBe(1);
		expect(generationDiagnostics('1').ok).toBe(false);
	} finally {
		reject.mockRestore();
		words.pop();
	}
});
