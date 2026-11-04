import { puzzleMetadata } from './puzzle-metadata.js';
import type { PuzzleId } from './engine/contract.js';
import {
	defaultScoreConfig as configFromDefinition,
	validateScoreValues as validateDefinition,
	type ScoreConfig,
	type ScoreValues
} from './engine/scoring.js';

export type { ScoreConfig, ScoreValues } from './engine/scoring.js';

export function validateScoreValues(
	family: PuzzleId,
	input: unknown,
	variant?: string
): ScoreValues {
	const definition = scoreDefinition(family, variant);
	if (!definition) throw new RangeError('score_family');
	return validateDefinition(definition, input);
}

export function defaultScoreConfig(family: PuzzleId, variant?: string): ScoreConfig {
	const definition = scoreDefinition(family, variant);
	if (!definition) throw new RangeError('score_family');
	return configFromDefinition(definition);
}

export function puzzleVariant(family: string, variant?: string) {
	const variants = puzzleMetadata[family]?.variants;
	if (!variants?.length) {
		if (variant !== undefined) throw new RangeError('variant');
		return undefined;
	}
	const found =
		variant === undefined ? variants[0] : variants.find((entry) => entry.id === variant);
	if (!found) throw new RangeError('variant');
	return found;
}
export function scoreDefinition(family: string, variant?: string) {
	return puzzleVariant(family, variant)?.scoring ?? puzzleMetadata[family]?.scoring;
}
export function scoreScope(family: string, variant?: string) {
	const entry = puzzleVariant(family, variant);
	return entry?.scoring ? entry.id : family;
}
