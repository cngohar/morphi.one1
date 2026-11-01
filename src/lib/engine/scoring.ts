export type ScoreValues = Readonly<Record<string, number>>;
export interface ScoreConfig {
	version: string;
	values: ScoreValues;
}
export interface ScoreDefinition {
	version: string;
	fields: readonly string[];
	defaults: ScoreValues;
}
export const SCORE_DEFAULT_VERSION = 'brief-v1';
/** Integer coefficients only. At most 1,000 moves keeps totals safely bounded. */
export const SCORE_MAX = 10000;
export function validateScoreValues(definition: ScoreDefinition, input: unknown): ScoreValues {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new RangeError('score_values');
	const values = input as Record<string, number>;
	const fields = definition.fields;
	if (
		Object.keys(values).sort().join(',') !== fields.slice().sort().join(',') ||
		fields.some(
			(field) =>
				!Number.isSafeInteger(values[field]) || values[field] < 0 || values[field] > SCORE_MAX
		)
	)
		throw new RangeError('score_values');
	return Object.fromEntries(fields.map((field) => [field, values[field]]));
}
export function defaultScoreConfig(definition: ScoreDefinition): ScoreConfig {
	return { version: definition.version, values: definition.defaults };
}
