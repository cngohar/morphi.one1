import { puzzleVariant } from '#lib/scoring.js';
import { puzzleMetadata } from '#lib/puzzle-metadata.js';
import { t, type MessageKey } from '#lib/i18n/messages.js';
import type { PuzzlePresentation } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';

export function familyName(family: string, variant?: string) {
	const name = Object.hasOwn(puzzleMetadata, family) && puzzleMetadata[family].presentation?.name;
	const base = name ? t(name as MessageKey) : family;
	const entry = variant === undefined ? undefined : puzzleVariant(family, variant);
	return entry ? `${base} · ${t(entry.name as MessageKey)}` : base;
}

export function scoreGuideValue(
	row: PuzzlePresentation['help']['rows'][number],
	values: ScoreValues
) {
	return row.field
		? `${row.sign ?? '+'}${new Intl.NumberFormat('en').format(values[row.field]!)}`
		: t(row.value as MessageKey);
}
