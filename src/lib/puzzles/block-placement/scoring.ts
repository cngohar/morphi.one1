import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: ['line', 'extraLine', 'combo'],
	defaults: { line: 100, extraLine: 50, combo: 50 }
} as const satisfies ScoreDefinition;
