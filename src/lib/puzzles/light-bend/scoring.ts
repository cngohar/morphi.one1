import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: ['completion', 'second', 'hint', 'reset', 'countdown', 'hintSolvedRanks'],
	defaults: {
		completion: 1000,
		second: 4,
		hint: 100,
		reset: 50,
		countdown: 10,
		hintSolvedRanks: 1
	}
} as const satisfies ScoreDefinition;
