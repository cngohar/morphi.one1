import type { ScoreDefinition } from '#lib/engine/scoring.js';

const defaults = {
	completionPoints: 1000,
	pointsPerSecond: 1,
	timeFloorPoints: 200,
	hintCost: 100,
	hintSolvedRanks: 1,
	hintCap: 3,
	mistakeCost: 50,
	mistakeLimit: 3,
	restartCost: 50,
	countdownBonusPerSecond: 1
} as const;

export const scoring = {
	version: 'brief-v1',
	fields: Object.keys(defaults),
	defaults
} satisfies ScoreDefinition;
