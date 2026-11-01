import type { ScoreDefinition } from '#lib/engine/scoring.js';

export const scoring = {
	version: 'brief-v1',
	fields: ['pair', 'grid', 'second', 'redraw'],
	defaults: { pair: 200, grid: 1000, second: 10, redraw: 50 }
} as const satisfies ScoreDefinition;
