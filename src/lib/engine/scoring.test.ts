import { expect, it } from 'vitest';
import { SCORE_DEFAULTS, validateScoreValues } from './scoring.js';
it('validates exact per-family bounded integer scoring fields', () => {
	for (const family of ['memory', 'block', 'connect'] as const) {
		expect(validateScoreValues(family, SCORE_DEFAULTS[family])).toEqual(SCORE_DEFAULTS[family]);
		const field = Object.keys(SCORE_DEFAULTS[family])[0]!;
		for (const value of [-1, 0.5, 10001, NaN, Infinity, '200', null])
			expect(() =>
				validateScoreValues(family, { ...SCORE_DEFAULTS[family], [field]: value })
			).toThrow();
		expect(() => validateScoreValues(family, {})).toThrow();
		expect(() => validateScoreValues(family, { ...SCORE_DEFAULTS[family], par: 30 })).toThrow();
	}
});
