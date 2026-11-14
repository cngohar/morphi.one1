import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: [
		'wasteTableau',
		'foundation',
		'flip',
		'foundationReturn',
		'recycleDraw1',
		'recycleDraw3',
		'timeBonus',
		'hint'
	],
	defaults: {
		wasteTableau: 5,
		foundation: 10,
		flip: 5,
		foundationReturn: 15,
		recycleDraw1: 100,
		recycleDraw3: 20,
		timeBonus: 7000,
		hint: 20
	}
} as const satisfies ScoreDefinition;
