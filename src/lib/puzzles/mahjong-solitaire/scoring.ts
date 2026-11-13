import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: ['completion', 'pair', 'triple', 'second', 'hint', 'shuffle', 'countdown', 'heart'],
	defaults: {
		completion: 1000,
		pair: 100,
		triple: 150,
		second: 5,
		hint: 100,
		shuffle: 50,
		countdown: 5,
		heart: 250
	}
} as const satisfies ScoreDefinition;
