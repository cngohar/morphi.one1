import { catalog } from './catalog.js';
import type { PuzzleId } from './engine/contract.js';
import {
	defaultScoreConfig as configFromDefinition,
	validateScoreValues as validateDefinition,
	type ScoreConfig,
	type ScoreValues
} from './engine/scoring.js';

export type { ScoreConfig, ScoreValues } from './engine/scoring.js';

export function validateScoreValues(family: PuzzleId, input: unknown): ScoreValues {
	const definition = catalog[family]?.scoring;
	if (!definition) throw new RangeError('score_family');
	return validateDefinition(definition, input);
}

export function defaultScoreConfig(family: PuzzleId): ScoreConfig {
	const definition = catalog[family]?.scoring;
	if (!definition) throw new RangeError('score_family');
	return configFromDefinition(definition);
}
