import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: [
		'completion',
		'second',
		'floor',
		'hint',
		'mistake',
		'restart',
		'countdown',
		'hintSolvedRanks',
		'mistakeLimit',
		'hintCap'
	],
	defaults: {
		completion: 1000,
		second: 1,
		floor: 200,
		hint: 100,
		mistake: 50,
		restart: 50,
		countdown: 1,
		hintSolvedRanks: 1,
		mistakeLimit: 3,
		hintCap: 0
	}
} as const satisfies ScoreDefinition;
