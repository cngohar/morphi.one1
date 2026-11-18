import { expect, it } from 'vitest';
import { performance as diagnosticClock } from 'node:perf_hooks';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import {
	applyWordGuessMove,
	createWordGuessRound,
	dailySeedOk,
	decodeWord,
	encodeWord,
	solveWord,
	wordFeedback,
	wordGuessScore
} from './logic.js';
import {
	CURATION_SHORT_ROOTS,
	CURATION_PROPER_ONLY,
	CURATION_EDITORIAL_EXCLUSIONS,
	WORD_LISTS
} from './words.js';
import { manifest } from './manifest.js';

for (const [guess, answer, marks] of [
	['PAPER', 'APPLE', [1, 1, 2, 1, 0]],
	['BREAD', 'BERRY', [2, 1, 1, 0, 0]],
	['PUPPY', 'PEARL', [2, 0, 0, 0, 0]],
	['ERROR', 'BERRY', [1, 1, 2, 0, 0]]
] as const)
	it(`${guess} against ${answer} counts duplicate copies exactly`, () => {
		expect(wordFeedback(guess, answer)).toEqual(marks);
	});

it('rejects unknown words without spending a row and rejects numeric tampering', () => {
	const round = createWordGuessRound('1');
	expect(() => applyWordGuessMove(round, { action: 0, code: encodeWord('XXXXX') })).toThrow(
		RangeError
	);
	expect(round.guesses).toHaveLength(0);
	expect(() => manifest.parseMove({ action: 0, code: 0, extra: 1 })).toThrow(RangeError);
	expect(() => decodeWord(26 ** 5, 5)).toThrow(RangeError);
	expect(() => applyWordGuessMove(round, { action: 2, code: 0 })).toThrow(RangeError);
});

it('regenerates from the same seed, solves and replays the authoritative outcome', () => {
	const round = createWordGuessRound('123');
	expect(createWordGuessRound('123')).toEqual(round);
	const moves = [{ action: 0, code: encodeWord(round.boards[0]!.answer) }];
	expect(manifest.replay('123', moves, 4)).toMatchObject({ won: true, score: 100, pairs: 1 });
	expect(manifest.resumeRound('123', moves)).toEqual(applyWordGuessMove(round, moves[0]!));
	expect(() => manifest.replay('123', [], 4)).toThrow('incomplete');
});

it('a budget loss is complete with zero points and never throws incomplete', () => {
	const round = createWordGuessRound('1');
	const wrong = WORD_LISTS[5].guesses.find((word) => word !== round.boards[0]!.answer)!;
	const moves = Array.from({ length: 6 }, () => ({ action: 0, code: encodeWord(wrong) }));
	expect(manifest.replay('1', moves, 6)).toMatchObject({ won: false, score: 0, pairs: 0 });
	expect(() => manifest.replay('1', [...moves, moves[0]!], 6)).toThrow(RangeError);
});

it('the integer solver proves every curated answer of every length within six guesses', () => {
	const records: {
		length: number;
		answer: string;
		nodes: number;
		ms: number;
		guesses: string[];
	}[] = [];
	const proofs = ([4, 5, 6, 7] as const).flatMap((length) =>
		WORD_LISTS[length].answers.map((answer) => {
			const start = diagnosticClock.now();
			const proof = solveWord(answer, length);
			records.push({
				length,
				answer,
				nodes: proof.nodes,
				ms: Math.round((diagnosticClock.now() - start) * 1000) / 1000,
				guesses: proof.guesses
			});
			return proof;
		})
	);
	mkdirSync('build/v1.4.6', { recursive: true });
	writeFileSync('build/v1.4.6/solver-words.json', JSON.stringify(records));
	expect(proofs.every((proof) => proof.solved && proof.guesses.length <= 6)).toBe(true);
	expect(WORD_LISTS[5].answers.length).toBeGreaterThanOrEqual(365);
	expect(dailySeedOk('1')).toBe(true);
	expect(dailySeedOk('bad seed')).toBe(false);
}, 120000);

it('every list has at least a year of curated answers with no simple inflections or proper-only names', () => {
	const roots = new Set([
		...CURATION_SHORT_ROOTS,
		...Object.values(WORD_LISTS).flatMap((list) => list.guesses)
	]);
	const excluded = new Set([...CURATION_PROPER_ONLY, ...CURATION_EDITORIAL_EXCLUSIONS]);
	for (const [key, list] of Object.entries(WORD_LISTS)) {
		expect(list.answers.length).toBeGreaterThanOrEqual(365);
		expect(new Set(list.answers).size).toBe(list.answers.length);
		expect(list.answers).toEqual([...list.answers].sort());
		for (const word of list.answers) {
			expect(word).toMatch(new RegExp(`^[A-Z]{${key}}$`));
			expect(list.guesses).toContain(word);
			expect(excluded.has(word)).toBe(false);
			if (word.endsWith('S'))
				expect(
					roots.has(word.slice(0, -1)) ||
						roots.has(word.slice(0, -2)) ||
						(word.endsWith('IES') && roots.has(`${word.slice(0, -3)}Y`))
				).toBe(false);
			if (word.endsWith('ED'))
				expect(
					roots.has(word.slice(0, -1)) ||
						roots.has(word.slice(0, -2)) ||
						(word.endsWith('IED') && roots.has(`${word.slice(0, -3)}Y`))
				).toBe(false);
		}
	}
});

it('scores at the solve guess and rejects invalid elapsed time', () => {
	const round = createWordGuessRound('1');
	const wrong = WORD_LISTS[5].guesses.find((word) => word !== round.boards[0]!.answer)!;
	const after = applyWordGuessMove(
		applyWordGuessMove(round, { action: 0, code: encodeWord(wrong) }),
		{ action: 0, code: encodeWord(round.boards[0]!.answer) }
	);
	expect(wordGuessScore(after, 10)).toBe(90);
	expect(() => wordGuessScore(after, -1)).toThrow(RangeError);
});

it('the answer and allowed-guess arrays match their frozen source fingerprint', async () => {
	const frozen = JSON.parse(readFileSync('tests/vectors/word-guess.json', 'utf8')) as {
		wordsFingerprint: string;
	};
	const hash = Buffer.from(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(WORD_LISTS)))
	).toString('hex');
	expect(hash).toBe(frozen.wordsFingerprint);
});
