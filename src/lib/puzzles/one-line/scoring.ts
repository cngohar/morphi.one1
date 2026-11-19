import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: ['edge', 'hint', 'restart', 'countdown', 'verdict', 'hintSolvedRanks'],
	defaults: {
		edge: 100,
		hint: 100,
		restart: 50,
		countdown: 10,
		verdict: 500,
		hintSolvedRanks: 1
	}
} as const satisfies ScoreDefinition;
