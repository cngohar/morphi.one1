import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: ['completion', 'cell', 'second', 'mistake', 'hint', 'countdown', 'heart'],
	defaults: {
		completion: 1000,
		cell: 10,
		second: 10,
		mistake: 50,
		hint: 100,
		countdown: 10,
		heart: 250
	}
} as const satisfies ScoreDefinition;
