import { expect, it } from 'vitest';
import { puzzleMetadata } from '#lib/puzzle-metadata.js';
import { familyIndex } from '#lib/family-index.js';
import { messages } from '#lib/i18n/messages.js';
import { generateTheme } from '#lib/engine/theme/generator.js';
import { familyName, scoreGuideValue } from './puzzle-presentation.js';
import { puzzleBackdrop } from './puzzle-backdrop.js';

it('every shipped family supplies valid help, scoring, name and leaderboard copy', () => {
	for (const { id } of familyIndex) {
		const metadata = puzzleMetadata[id];
		const presentation = metadata.presentation!;
		expect(presentation).toBeDefined();
		for (const key of [
			presentation.name,
			...Object.values(presentation.scoringLabels),
			...Object.values(presentation.groups),
			...presentation.help.steps,
			presentation.help.note,
			presentation.help.tips,
			...presentation.help.rows.flatMap((row) => [row.label, ...(row.value ? [row.value] : [])])
		])
			expect(Object.hasOwn(messages, key), `${id}: ${key}`).toBe(true);
		for (const row of presentation.help.rows) {
			if (row.field) expect(metadata.scoring.fields).toContain(row.field);
			expect(scoreGuideValue(row, metadata.scoring.defaults).length).toBeGreaterThan(0);
		}
	}
});

it('renders a new family from its metadata and keeps its backdrop objects isolated', () => {
	const id = 'slice6-novel';
	const source = puzzleMetadata[familyIndex[0].id];
	puzzleMetadata[id] = {
		...source,
		presentation: {
			...source.presentation!,
			name: 'home.play',
			backdrop: { items: [{ id: 'novel-only', path: 'M1 1h10v10Z' }], fill: 'outline' }
		}
	};
	try {
		expect(familyName(id)).toBe('Play');
		const backdrop = puzzleBackdrop({ ...generateTheme('42', familyIndex[0].id), family: id });
		expect(backdrop.items.every((item) => item.kind === 'novel-only')).toBe(true);
		expect(backdrop.fill).toBe('outline');
		expect(scoreGuideValue({ label: 'unused', field: 'cost', sign: '−' }, { cost: 73 })).toBe(
			'−73'
		);
	} finally {
		delete puzzleMetadata[id];
	}
	for (const unknown of ['legacy-retired-family', '__proto__', 'constructor'])
		expect(familyName(unknown)).toBe(unknown);
});
