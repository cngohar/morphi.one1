import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: [
		'first',
		'second',
		'third',
		'fourth',
		'fifth',
		'sixth',
		'seventh',
		'eighth',
		'ninth',
		'tenth',
		'eleventh',
		'twelfth',
		'thirteenth',
		'hint',
		'countdown',
		'hintSolvedRanks'
	],
	defaults: {
		first: 100,
		second: 90,
		third: 75,
		fourth: 60,
		fifth: 45,
		sixth: 30,
		seventh: 25,
		eighth: 20,
		ninth: 15,
		tenth: 10,
		eleventh: 5,
		twelfth: 5,
		thirteenth: 5,
		hint: 100,
		countdown: 10,
		hintSolvedRanks: 1
	}
} as const satisfies ScoreDefinition;
