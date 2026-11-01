import { expect, it } from 'vitest';
import { defaultScoreConfig, validateScoreValues } from './scoring.js';

const definition = {
	version: 'synthetic-v2',
	fields: ['turn', 'bonus'],
	defaults: { turn: 500, bonus: 20 }
};

it('validates exact bounded integer fields supplied by a scoring definition', () => {
	expect(validateScoreValues(definition, definition.defaults)).toEqual(definition.defaults);
	for (const value of [-1, 0.5, 10001, NaN, Infinity, '200', null])
		expect(() =>
			validateScoreValues(definition, { ...definition.defaults, turn: value })
		).toThrow();
	for (const input of [undefined, null, [], 'score', {}, { ...definition.defaults, par: 30 }])
		expect(() => validateScoreValues(definition, input)).toThrow();
	expect(validateScoreValues(definition, { turn: 0, bonus: 10000 })).toEqual({
		turn: 0,
		bonus: 10000
	});
});

it('takes the immutable default version and values from the scoring definition', () => {
	expect(defaultScoreConfig(definition)).toEqual({
		version: 'synthetic-v2',
		values: definition.defaults
	});
});
