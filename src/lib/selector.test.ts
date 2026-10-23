import { describe, expect, it } from 'vitest';
import { createRng } from '#lib/engine/rng.js';
import { createPuzzleSelector, type FamilyWeight } from '#lib/selector.js';

const families = [
	{ family: 'block', weight: 1 },
	{ family: 'memory', weight: 1 }
] satisfies FamilyWeight[];

function sequence(seed: string, count: number): string[] {
	const selector = createPuzzleSelector({ families, firstFamily: 'block', rng: createRng(seed) });
	return Array.from({ length: count }, () => selector.next());
}

describe('puzzle selector', () => {
	it('starts with the first-impression family and alternates two families', () => {
		const picks = sequence('1', 20);
		expect(picks[0]).toBe('block');
		for (let index = 1; index < picks.length; index += 1) {
			expect(picks[index]).not.toBe(picks[index - 1]);
		}
		expect(new Set(picks)).toEqual(new Set(['block', 'memory']));
	});

	it('never repeats the same family in a row across many seeded sessions', () => {
		for (let seed = 1; seed <= 50; seed += 1) {
			const picks = sequence(String(seed), 24);
			for (let index = 1; index < picks.length; index += 1) {
				expect(picks[index]).not.toBe(picks[index - 1]);
			}
		}
	});

	it('is reproducible from an injected RNG stream', () => {
		expect(sequence('42', 12)).toEqual(sequence('42', 12));
	});

	it('allows repetition when only one family is eligible', () => {
		const selector = createPuzzleSelector({
			families: [
				{ family: 'block', weight: 1 },
				{ family: 'memory', weight: 0 }
			],
			firstFamily: 'block',
			rng: createRng('7')
		});
		expect(Array.from({ length: 6 }, () => selector.next())).toEqual([
			'block',
			'block',
			'block',
			'block',
			'block',
			'block'
		]);
	});

	it('falls back to the first eligible family when the requested first family is disabled', () => {
		const selector = createPuzzleSelector({
			families: [
				{ family: 'block', weight: 0 },
				{ family: 'memory', weight: 1 }
			],
			firstFamily: 'block',
			rng: createRng('3')
		});
		expect(selector.next()).toBe('memory');
	});

	it('throws when no family is eligible', () => {
		expect(() =>
			createPuzzleSelector({
				families: [{ family: 'block', weight: 0 }],
				firstFamily: 'block',
				rng: createRng('9')
			})
		).toThrow('At least one puzzle family must be eligible.');
	});

	it('peek returns the same family as the next call', () => {
		const selector = createPuzzleSelector({ families, firstFamily: 'block', rng: createRng('5') });
		const first = selector.peek();
		expect(first).toBe('block');
		expect(selector.next()).toBe(first);
		const upcoming = selector.peek();
		expect(selector.next()).toBe(upcoming);
	});
});
