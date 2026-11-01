import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: ['pair', 'mismatch', 'second'],
	defaults: { pair: 1000, mismatch: 150, second: 5 }
} as const satisfies ScoreDefinition;
