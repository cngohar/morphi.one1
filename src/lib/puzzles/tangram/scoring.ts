import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: ['completion', 'piece', 'second', 'hint'],
	defaults: { completion: 1000, piece: 100, second: 5, hint: 100 }
} as const satisfies ScoreDefinition;

export const doubleScoring = {
	...scoring,
	defaults: { ...scoring.defaults, piece: 50 }
} as const satisfies ScoreDefinition;
export const mapScoring = {
	version: 'brief-v1',
	fields: ['completion', 'piece', 'hint'],
	defaults: { completion: 1000, piece: 100, hint: 100 }
} as const satisfies ScoreDefinition;
export function scoringForTangram(variant?: string): ScoreDefinition {
	return variant === 'tangram:coloured-map'
		? mapScoring
		: variant === 'tangram:double-14'
			? doubleScoring
			: scoring;
}
