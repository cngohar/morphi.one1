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

/** Differing steps, then notes, then scoring rows teach this round without naming it. */
export function roundRuleLine(family: string, variant?: string): string {
	const baseline = puzzleVariant(family)?.help ?? puzzleMetadata[family]?.presentation.help;
	const help = puzzleVariant(family, variant)?.help ?? baseline;
	const step = help?.steps.find((key) => !baseline?.steps.includes(key));
	if (step) return t(step as MessageKey);
	if (help?.note && help.note !== baseline?.note) return t(help.note as MessageKey);
	const row = help?.rows.find(
		({ value }) => value && !baseline?.rows.some((baselineRow) => baselineRow.value === value)
	);
	if (!row?.value) return '';
	const value = t(row.value as MessageKey);
	const board = value.match(/^(\d+ × \d+) grid, (\d+ pairs)$/);
	if (board) return `This board is ${board[1]} with ${board[2]}.`;
	return /[.!?]$/.test(value) ? value : `${t(row.label as MessageKey)}: ${value}.`;
}

export function scoreGuideValue(
	row: PuzzlePresentation['help']['rows'][number],
	values: ScoreValues
) {
	return row.field
		? `${row.sign ?? '+'}${new Intl.NumberFormat('en').format(values[row.field]!)}`
		: t(row.value as MessageKey);
}
