import type { PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import { messages } from './messages.js';
import { scoring } from './scoring.js';
import {
	applyWordGuessMove,
	createWordGuessRound,
	dailySeedOk,
	resolveVariantFromRules,
	wordGuessScore,
	WORD_GUESS_ENGINE_VERSION,
	WORD_GUESS_VARIANTS,
	encodeRules,
	type WordGuessMove
} from './logic.js';

const help = {
	steps: ['word-guess.step1', 'word-guess.step2', 'word-guess.step3'],
	rows: scoring.fields
		.slice(0, 6)
		.map((field) => ({ label: `scoring.word-guess.${field}`, field, sign: '+' as const })),
	note: 'word-guess.note',
	tips: 'word-guess.tips'
} satisfies PuzzlePresentation['help'];
const ending = {
	kind: 'completion',
	headlines: { default: 'ending.word-guess.headline' },
	subline: { key: 'ending.word-guess.subline', values: ['tries'] },
	animation: 'fade-rise',
	continue: 'auto_500ms',
	condition:
		'Every word is solved within the shared guess budget; exhausted guesses complete a loss with zero points.'
} satisfies PuzzleManifest['ending'];
export const manifest = {
	id: 'word-guess',
	selectionOrder: 8,
	enabled: true,
	orientation: 'any',
	titleAfterEntrance: true,
	engineVersion: WORD_GUESS_ENGINE_VERSION,
	maxMoves: 10000,
	scoring,
	messages,
	presentation: {
		name: 'v1.game.word-guess',
		scoringLabels: Object.fromEntries(
			scoring.fields.map((field) => [field, `scoring.word-guess.${field}`])
		),
		groups: {},
		help,
		backdrop: {
			items: [{ id: 'letter-tile', path: 'M12 8h40v48H12ZM22 42l10-20 10 20M26 34h12' }],
			fill: 'outline'
		}
	},
	variants: WORD_GUESS_VARIANTS.map((id) => ({
		id,
		name: `variant.${id}`,
		enabled: true,
		weight: 1,
		maxMoves: 10000,
		help:
			id === 'word-guess:classic'
				? help
				: {
						...help,
						steps: [help.steps[0], `word-guess.rule.${id.slice('word-guess:'.length)}`],
						...(encodeRules(id).hint
							? {
									rows: [
										...help.rows,
										{ label: 'scoring.word-guess.hint', field: 'hint', sign: '−' as const }
									]
								}
							: {})
					},
		...(id === 'word-guess:countdown-120'
			? {
					maxSeconds: 120,
					ending: {
						...ending,
						kind: 'run_over' as const,
						headlines: { default: ending.headlines.default, cap: 'ending.word-guess.timeUp' },
						condition:
							'Solve before 120 seconds; timeout retains the failed board and saves no score.'
					}
				}
			: {})
	})),
	parseMove(move) {
		if (
			Object.keys(move).sort().join(',') !== 'action,code' ||
			!Number.isSafeInteger(move.action) ||
			!Number.isSafeInteger(move.code) ||
			(move.action !== 0 && move.action !== 1) ||
			move.code! < 0 ||
			move.code! >= 26 ** 7 ||
			(move.action === 1 && move.code !== 0)
		)
			throw new RangeError('move');
		return { action: move.action, code: move.code };
	},
	createRound: createWordGuessRound,
	resolveVariantFromRules,
	dailySeedOk,
	resumeRound(seed, moves, _values = scoring.defaults, variant?: string) {
		void _values;
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createWordGuessRound(seed, variant);
		for (const move of moves)
			round = applyWordGuessMove(round, this.parseMove(move) as WordGuessMove);
		return round;
	},
	rankedTiming: { openingMs: () => 0, minimumSeconds: () => 2.5 },
	ending,
	replay(seed, moves, seconds, values = scoring.defaults, variant?: string) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createWordGuessRound(seed, variant);
		for (const move of moves)
			round = applyWordGuessMove(round, this.parseMove(move) as WordGuessMove);
		if (round.status === 'playing') throw new RangeError('incomplete');
		return {
			score: wordGuessScore(round, seconds, values),
			pairs: round.boards.filter((board) => board.solvedAt > 0).length,
			moves: moves.length,
			hintUsed: round.hintUsedSession,
			won: round.status === 'won'
		};
	}
} satisfies PuzzleManifest;
