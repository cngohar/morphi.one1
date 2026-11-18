import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { createRng } from '#lib/engine/rng.js';
import { scoring } from './scoring.js';
import { WORD_LISTS } from './words.js';

export const WORD_GUESS_ENGINE_VERSION = 'word-guess-1';
export const WORD_GUESS_VARIANTS = [
	'word-guess:classic',
	'word-guess:hard-mode',
	'word-guess:ultra-hard',
	'word-guess:length-4',
	'word-guess:length-6',
	'word-guess:length-7',
	'word-guess:boards-2',
	'word-guess:boards-4',
	'word-guess:boards-8',
	'word-guess:countdown-120',
	'word-guess:hint-budget-3'
] as const;
export type WordGuessVariant = (typeof WORD_GUESS_VARIANTS)[number];
export type WordLength = keyof typeof WORD_LISTS;
export type Feedback = 0 | 1 | 2;
export type WordGuessRules = {
	length: WordLength;
	boards: number;
	constraint: number;
	timing: number;
	hint: number;
};
export interface WordGuessMove extends Move {
	action: number;
	code: number;
}
export interface WordGuessBoard {
	answer: string;
	feedback: Feedback[][];
	solvedAt: number;
	revealed: (string | null)[];
}
export interface WordGuessRound {
	seed: string;
	variant?: WordGuessVariant;
	rules: WordGuessRules;
	budget: number;
	boards: WordGuessBoard[];
	guesses: string[];
	hintsUsed: number;
	hintUsedSession: boolean;
	status: 'playing' | 'won' | 'lost';
}

export function parseWordGuessVariant(variant?: string): WordGuessVariant {
	if (variant === undefined) return 'word-guess:classic';
	if (!WORD_GUESS_VARIANTS.includes(variant as WordGuessVariant)) throw new RangeError('variant');
	return variant as WordGuessVariant;
}
export function encodeRules(variant?: string): WordGuessRules {
	const id = parseWordGuessVariant(variant);
	const rules: WordGuessRules = { length: 5, boards: 1, constraint: 0, timing: 0, hint: 0 };
	switch (id) {
		case 'word-guess:hard-mode':
			rules.constraint = 1;
			break;
		case 'word-guess:ultra-hard':
			rules.constraint = 2;
			break;
		case 'word-guess:length-4':
			rules.length = 4;
			break;
		case 'word-guess:length-6':
			rules.length = 6;
			break;
		case 'word-guess:length-7':
			rules.length = 7;
			break;
		case 'word-guess:boards-2':
			rules.boards = 2;
			break;
		case 'word-guess:boards-4':
			rules.boards = 4;
			break;
		case 'word-guess:boards-8':
			rules.boards = 8;
			break;
		case 'word-guess:countdown-120':
			rules.timing = 1;
			break;
		case 'word-guess:hint-budget-3':
			rules.hint = 1;
			break;
	}
	return rules;
}
export function resolveVariantFromRules(rules: Record<string, number | boolean>) {
	if (Object.keys(rules).sort().join(',') !== 'boards,constraint,hint,length,timing')
		throw new RangeError('rules');
	const variant = WORD_GUESS_VARIANTS.find((id) =>
		Object.entries(encodeRules(id)).every(([key, value]) => rules[key] === value)
	);
	if (!variant) throw new RangeError('rules');
	return variant;
}

export function encodeWord(word: string): number {
	if (!/^[A-Z]{4,7}$/.test(word)) throw new RangeError('word');
	let code = 0;
	for (const letter of word) code = code * 26 + letter.charCodeAt(0) - 65;
	return code;
}
export function decodeWord(code: number, length: number): string {
	if (
		!Number.isSafeInteger(code) ||
		code < 0 ||
		!Number.isSafeInteger(length) ||
		length < 4 ||
		length > 7
	)
		throw new RangeError('code');
	let word = '';
	for (let at = 0; at < length; at++) {
		word = String.fromCharCode(65 + (code % 26)) + word;
		code = Math.floor(code / 26);
	}
	if (code !== 0) throw new RangeError('code');
	return word;
}
/** Exact positions consume copies first, then present copies left to right. */
export function wordFeedback(guess: string, answer: string): Feedback[] {
	if (guess.length !== answer.length || !/^[A-Z]{4,7}$/.test(guess) || !/^[A-Z]{4,7}$/.test(answer))
		throw new RangeError('word');
	const remaining = Array<number>(26).fill(0);
	const marks: Feedback[] = Array<Feedback>(guess.length).fill(0);
	for (let at = 0; at < answer.length; at++) {
		if (guess[at] === answer[at]) marks[at] = 2;
		else remaining[answer.charCodeAt(at) - 65]!++;
	}
	for (let at = 0; at < guess.length; at++) {
		const letter = guess.charCodeAt(at) - 65;
		if (marks[at] !== 2 && remaining[letter]! > 0) {
			marks[at] = 1;
			remaining[letter]!--;
		}
	}
	return marks;
}
export function feedbackCode(guess: string, answer: string): number {
	let code = 0;
	for (const mark of wordFeedback(guess, answer)) code = code * 3 + mark;
	return code;
}
const legalLists = new Map<WordLength, Set<string>>();
export function legalWord(word: string, length: WordLength): boolean {
	let set = legalLists.get(length);
	if (!set) {
		set = new Set(WORD_LISTS[length].guesses);
		legalLists.set(length, set);
	}
	return set.has(word);
}

/** Integer collision information gain: minimize sum of squared partition sizes.
 * Ties prefer a remaining answer, then ASCII word order. No answer oracle participates
 * in choosing a guess. Cached decisions only memoize this deterministic calculation. */
const decisions = new Map<string, string>();
export interface WordGuessSolution {
	guesses: string[];
	solved: boolean;
	nodes: number;
}
export function solveWord(answer: string, length: WordLength = 5): WordGuessSolution {
	if (!WORD_LISTS[length].answers.includes(answer) || !legalWord(answer, length))
		return { guesses: [], solved: false, nodes: 0 };
	let candidates = [...WORD_LISTS[length].answers];
	const guesses: string[] = [];
	let nodes = 0;
	for (let turn = 0; turn < 6; turn++) {
		const key = `${length}:${candidates.join(',')}`;
		let chosen = decisions.get(key);
		if (!chosen) {
			const possible = new Set(candidates);
			let best = Number.MAX_SAFE_INTEGER;
			for (const guess of candidates.length === 1 ? candidates : WORD_LISTS[length].guesses) {
				const counts = new Map<number, number>();
				let cost = 0;
				for (const candidate of candidates) {
					const code = feedbackCode(guess, candidate);
					const old = counts.get(code) ?? 0;
					counts.set(code, old + 1);
					cost += 2 * old + 1;
					nodes++;
					if (cost > best) break;
				}
				if (cost < best || (cost === best && possible.has(guess) && !possible.has(chosen ?? ''))) {
					best = cost;
					chosen = guess;
				}
			}
			decisions.set(key, chosen!);
		}
		if (!chosen) throw new RangeError('solver');
		const guess = chosen;
		guesses.push(guess);
		if (chosen === answer) return { guesses, solved: true, nodes };
		const observed = feedbackCode(guess, answer);
		candidates = candidates.filter((candidate) => feedbackCode(guess, candidate) === observed);
	}
	return { guesses, solved: false, nodes };
}

export interface GenerationTally {
	answer: number;
	solver: number;
	curation: number;
	distinct: number;
	attempts: number;
}
export function createWordGuessRound(
	seed: string,
	variant?: string,
	tally?: GenerationTally
): WordGuessRound {
	const id = parseWordGuessVariant(variant);
	const rules = encodeRules(id);
	const rng = createRng(seed);
	const answers = WORD_LISTS[rules.length].answers;
	const boards: WordGuessBoard[] = [];
	for (let board = 0; board < rules.boards; board++) {
		let answer: string | undefined;
		for (let attempt = 0; attempt < 100; attempt++) {
			if (tally) tally.attempts++;
			const candidate = answers[Number(rng.nextU64() % BigInt(answers.length))]!;
			if (!boards.some((entry) => entry.answer === candidate)) {
				answer = candidate;
				break;
			}
			if (tally) tally.distinct++;
		}
		if (!answer) throw new RangeError('generation_exhausted');
		boards.push({
			answer,
			feedback: [],
			solvedAt: 0,
			revealed: Array<string | null>(rules.length).fill(null)
		});
	}
	return {
		seed,
		variant: id,
		rules,
		budget: rules.boards === 8 ? 13 : rules.boards === 4 ? 9 : rules.boards === 2 ? 7 : 6,
		boards,
		guesses: [],
		hintsUsed: 0,
		hintUsedSession: false,
		status: 'playing'
	};
}
/** The costly solver runs only in issuance's generation gate, never in play/replay. */
export function dailySeedOk(seed: string, variant?: string): boolean {
	return generationDiagnostics(seed, variant).ok;
}
export function generationDiagnostics(seed: string, variant?: string) {
	const tally: GenerationTally = { answer: 0, solver: 0, curation: 0, distinct: 0, attempts: 0 };
	try {
		const round = createWordGuessRound(seed, variant, tally);
		for (const board of round.boards) {
			if (!WORD_LISTS[round.rules.length].answers.includes(board.answer)) tally.answer++;
			if (!solveWord(board.answer, round.rules.length).solved) tally.solver++;
		}
		return { ok: tally.answer === 0 && tally.solver === 0, tally };
	} catch {
		return { ok: false, tally };
	}
}
export function hintTarget(round: WordGuessRound) {
	const board = round.boards.findIndex((entry) => entry.solvedAt === 0);
	if (board < 0) return null;
	const entry = round.boards[board]!;
	const position = entry.revealed.findIndex(
		(letter, at) => letter === null && !entry.feedback.some((row) => row[at] === 2)
	);
	return position < 0 ? null : { board, position, letter: entry.answer[position]! };
}
export function guessError(round: WordGuessRound, word: string): string | null {
	if (round.status !== 'playing') return 'complete';
	if (word.length !== round.rules.length) return 'length';
	if (!legalWord(word, round.rules.length)) return 'word';
	if (round.rules.constraint > 0) {
		if (round.boards.length !== 1) return 'constraint';
		const board = round.boards[0]!;
		for (const [row, marks] of board.feedback.entries()) {
			const old = round.guesses[row]!;
			const minimum = new Map<string, number>();
			for (const [at, mark] of marks.entries()) {
				const letter = old[at]!;
				if (mark > 0) minimum.set(letter, (minimum.get(letter) ?? 0) + 1);
				if (mark === 2 && word[at] !== letter) return `green:${at}:${letter}`;
				if (round.rules.constraint === 2 && mark === 1 && word[at] === letter)
					return `position:${at}:${letter}`;
			}
			for (const [letter, count] of minimum)
				if ([...word].filter((value) => value === letter).length < count)
					return `present:${count}:${letter}`;
			if (round.rules.constraint === 2)
				for (const [at, mark] of marks.entries()) {
					if (
						mark === 0 &&
						[...word].filter((letter) => letter === old[at]).length > (minimum.get(old[at]!) ?? 0)
					)
						return `grey:0:${old[at]}`;
				}
		}
	}
	return null;
}
export function applyWordGuessMove(round: WordGuessRound, move: WordGuessMove): WordGuessRound {
	if (
		Object.keys(move).sort().join(',') !== 'action,code' ||
		![move.action, move.code].every(Number.isSafeInteger) ||
		round.status !== 'playing'
	)
		throw new RangeError('move');
	if (move.action === 1) {
		const target = hintTarget(round);
		if (move.code !== 0 || round.rules.hint !== 1 || round.hintsUsed >= 3 || !target)
			throw new RangeError('hint');
		const boards = round.boards.map((board, at) =>
			at === target.board
				? {
						...board,
						revealed: board.revealed.map((letter, position) =>
							position === target.position ? target.letter : letter
						)
					}
				: board
		);
		return { ...round, boards, hintsUsed: round.hintsUsed + 1, hintUsedSession: true };
	}
	if (move.action !== 0) throw new RangeError('action');
	const word = decodeWord(move.code, round.rules.length);
	const error = guessError(round, word);
	if (error) throw new RangeError(error);
	const turn = round.guesses.length + 1;
	const boards = round.boards.map((board) =>
		board.solvedAt
			? board
			: {
					...board,
					feedback: [...board.feedback, wordFeedback(word, board.answer)],
					solvedAt: word === board.answer ? turn : 0
				}
	);
	const status = boards.every((board) => board.solvedAt > 0)
		? 'won'
		: turn === round.budget
			? 'lost'
			: 'playing';
	return { ...round, boards, guesses: [...round.guesses, word], status };
}
export function wordGuessScore(
	round: WordGuessRound,
	seconds: number,
	values: ScoreValues = scoring.defaults
): number {
	if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 7200)
		throw new RangeError('elapsed');
	if (round.rules.timing === 1 && seconds >= 120) throw new RangeError('timeout');
	if (round.status !== 'won') return 0;
	const fields = scoring.fields.slice(0, 13);
	const base = round.boards.reduce((sum, board) => sum + values[fields[board.solvedAt - 1]!]!, 0);
	return Math.max(
		0,
		base -
			round.hintsUsed * values.hint! +
			(round.rules.timing === 1 ? (120 - seconds) * values.countdown! : 0)
	);
}
