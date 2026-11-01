import type { PuzzleId } from './contract.js';
export type ScoreValues = Readonly<Record<string, number>>;
export interface ScoreConfig {
	version: string;
	values: ScoreValues;
}
export const SCORE_DEFAULT_VERSION = 'brief-v1';
export const SCORE_DEFAULTS = {
	block: { line: 100, extraLine: 50, combo: 50 },
	memory: { pair: 1000, mismatch: 150, second: 5 },
	connect: { pair: 200, grid: 1000, second: 10, redraw: 50 }
} as const;
export const SCORE_FAMILIES: PuzzleId[] = ['block', 'memory', 'connect'];
/** Integer coefficients only. At most 1,000 moves keeps totals safely bounded. */
export const SCORE_MAX = 10000;
export function validateScoreValues(family: PuzzleId, input: unknown): ScoreValues {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new RangeError('score_values');
	const values = input as Record<string, number>;
	const fields = Object.keys(SCORE_DEFAULTS[family]);
	if (
		Object.keys(values).sort().join(',') !== fields.slice().sort().join(',') ||
		fields.some(
			(field) =>
				!Number.isSafeInteger(values[field]) || values[field] < 0 || values[field] > SCORE_MAX
		)
	)
		throw new RangeError('score_values');
	return Object.fromEntries(fields.map((field) => [field, values[field]]));
}
export function defaultScoreConfig(family: PuzzleId): ScoreConfig {
	return { version: SCORE_DEFAULT_VERSION, values: SCORE_DEFAULTS[family] };
}
