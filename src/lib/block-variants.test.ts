import { expect, it } from 'vitest';
import { createPuzzleSelector } from './selector.js';
import { createRng } from './engine/rng.js';
import { puzzleMetadata } from './puzzle-metadata.js';
import { puzzleVariant, scoreScope, defaultScoreConfig } from './scoring.js';
import { familyName } from './ui/puzzle-presentation.js';
import { puzzleMessages } from './puzzle-messages.js';
import { manifest } from './puzzles/block-placement/manifest.js';

it('rotates all four equal-weight Block variants without consecutive repeats during continued play', () => {
	const selector = createPuzzleSelector({
		families: [{ family: 'block', weight: 1 }],
		rng: createRng('42')
	});
	let previous: string | undefined;
	const seen = new Set<string>();
	for (let i = 0; i < 40; i++) {
		const variant = selector.peekVariant(
			'block',
			manifest.variants,
			manifest.variants.map((v) => v.id)
		);
		expect(variant).not.toBe(previous);
		selector.commitVariant('block', variant);
		selector.next();
		seen.add(variant!);
		previous = variant;
	}
	expect([...seen].sort()).toEqual(manifest.variants.map((v) => v.id).sort());
});

it('preserves last-served exclusion across reloads even when the injected RNG restarts', () => {
	let selector = createPuzzleSelector({
		families: [{ family: 'block', weight: 1 }],
		rng: createRng('42')
	});
	let previous: string | undefined;
	for (let i = 0; i < 10; i++) {
		const variant = selector.peekVariant(
			'block',
			manifest.variants,
			manifest.variants.map((v) => v.id)
		);
		expect(variant).not.toBe(previous);
		expect(
			selector.peekVariant(
				'block',
				manifest.variants,
				manifest.variants.map((v) => v.id)
			)
		).toBe(variant);
		selector.commitVariant('block', variant);
		selector.next();
		previous = variant;
		selector = createPuzzleSelector({
			families: [{ family: 'block', weight: 1 }],
			rng: createRng('42'),
			state: selector.snapshot()
		});
	}
});

it('projects every Block variant label, help, ending and shared scoring key', () => {
	expect(puzzleVariant('block')?.id).toBe('block:classic');
	for (const variant of manifest.variants) {
		expect(variant.weight).toBe(1);
		const { leaderboardGroups, ...clientVariant } = variant;
		expect(puzzleMetadata.block.variants!.find((entry) => entry.id === variant.id)).toEqual(
			clientVariant
		);
		expect(leaderboardGroups.length).toBeGreaterThan(0);
		expect(familyName('block', variant.id)).toBe(
			`Block · ${manifest.messages[variant.name as keyof typeof manifest.messages]}`
		);
		expect(scoreScope('block', variant.id)).toBe('block');
		expect(defaultScoreConfig('block', variant.id)).toEqual(defaultScoreConfig('block'));
		const help = ('help' in variant ? variant.help : undefined) ?? manifest.presentation.help;
		for (const key of [
			...help.steps,
			help.note,
			help.tips,
			...help.rows.flatMap((row) => [
				row.label,
				...('value' in row && row.value ? [row.value] : [])
			])
		])
			expect(puzzleMessages[key as keyof typeof puzzleMessages]).toBeTruthy();
	}
	for (const key of [
		'ending.block.noMoves',
		'ending.block.cap',
		'ending.block.subline',
		'ending.block.timeUp',
		'ending.block.timeUp.subline',
		'scoring.block.sharedNotice'
	] as const)
		expect(puzzleMessages[key]).toBeTruthy();
	expect(puzzleVariant('block', 'block:rush-60')?.maxSeconds).toBe(60);
	expect(
		manifest.rankedTiming.openingMs({ score: 0, group: '', pairs: null, moves: 1 })
	).toBeNull();
});
