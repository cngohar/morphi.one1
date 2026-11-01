import { describe, expect, it } from 'vitest';
import { createRng } from '#lib/engine/rng.js';
import { createPuzzleSelector, type FamilyWeight } from '#lib/selector.js';

const families = [
	{ family: 'block', weight: 1 },
	{ family: 'memory', weight: 1 }
] satisfies FamilyWeight[];

function sequence(seed: string, count: number): string[] {
	const selector = createPuzzleSelector({ families, rng: createRng(seed) });
	return Array.from({ length: count }, () => selector.next());
}

describe('puzzle selector', () => {
	it('includes Connect once per three-family Mix cycle without immediate repeats', () => {
		const selector = createPuzzleSelector({
			families: [
				{ family: 'block', weight: 1 },
				{ family: 'memory', weight: 1 },
				{ family: 'connect', weight: 1 }
			],
			rng: createRng('1')
		});
		const picks = Array.from({ length: 30 }, () => selector.next());
		for (let i = 0; i < picks.length; i += 3)
			expect(new Set(picks.slice(i, i + 3))).toEqual(new Set(['block', 'memory', 'connect']));
		for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
	});
	it('draws either starting family from the injected RNG, then alternates', () => {
		expect(sequence('0', 4)).toEqual(['memory', 'block', 'memory', 'block']);
		expect(sequence('2', 4)).toEqual(['block', 'memory', 'block', 'memory']);
	});

	it('never repeats across refills in many seeded two-family sessions', () => {
		for (let seed = 0; seed < 100; seed++) {
			const picks = sequence(String(seed), 40);
			for (let index = 1; index < picks.length; index++)
				expect(picks[index]).not.toBe(picks[index - 1]);
		}
	});

	it('is reproducible from an injected RNG stream', () => {
		expect(sequence('42', 12)).toEqual(sequence('42', 12));
	});

	it('allows repetition with one eligible family and never serves disabled families', () => {
		const selector = createPuzzleSelector({
			families: [
				{ family: 'block', weight: 0 },
				{ family: 'memory', weight: 1 }
			],
			rng: createRng('7')
		});
		expect(Array.from({ length: 6 }, () => selector.next())).toEqual(Array(6).fill('memory'));
	});

	it('updates availability without consuming a stable pending choice and reintroduces games', () => {
		const selector = createPuzzleSelector({
			families: [...families, { family: 'connect', weight: 1 }],
			rng: createRng('1')
		});
		const pending = selector.peek();
		const other = (['block', 'memory', 'connect'] as const).filter((family) => family !== pending);
		selector.setAvailable([pending, other[0]!]);
		expect(selector.peek()).toBe(pending);
		selector.setAvailable(other);
		expect(other).toContain(selector.peek());
		expect(() => selector.setAvailable([])).toThrow('At least one puzzle family');
		expect(other).toContain(selector.next());
		selector.setAvailable(['block', 'memory', 'connect']);
		expect(Array.from({ length: 6 }, () => selector.next())).toContain(pending);
	});

	it('repeats the sole available family without a rotation deadlock', () => {
		const selector = createPuzzleSelector({ families, rng: createRng('2') });
		const first = selector.next();
		selector.setAvailable([first]);
		expect(Array.from({ length: 4 }, () => selector.next())).toEqual(Array(4).fill(first));
		selector.setAvailable(['block', 'memory']);
		expect(new Set(Array.from({ length: 4 }, () => selector.next()))).toEqual(
			new Set(['block', 'memory'])
		);
	});

	it('fails closed when no family is eligible', () => {
		expect(() => createPuzzleSelector({ families: [], rng: createRng('9') })).toThrow(
			'At least one puzzle family'
		);
		expect(() =>
			createPuzzleSelector({ families: [{ family: 'block', weight: 0 }], rng: createRng('9') })
		).toThrow('At least one puzzle family');
	});

	it('repeated peeks consume neither the pending pick nor additional entropy', () => {
		const rng = createRng('5');
		let draws = 0;
		const selector = createPuzzleSelector({
			families,
			rng: {
				...rng,
				nextInt: (max) => {
					draws++;
					return rng.nextInt(max);
				}
			}
		});
		const first = selector.peek();
		const initialDraws = draws;
		for (let retry = 0; retry < 10; retry++) expect(selector.peek()).toBe(first);
		expect(draws).toBe(initialDraws);
		expect(selector.next()).toBe(first);
		expect(selector.next()).not.toBe(first);
	});

	it.each([3, 4, 6, 9, 18])(
		'keeps exactly one of every family per cycle and a minimum gap with %i families',
		(count) => {
			const entries = Array.from({ length: count }, (_, index) => ({
				family: `family-${index}`,
				weight: index + 1
			}));
			const gap = Math.min(5, Math.max(1, Math.floor(count / 3)));
			for (let seed = 0; seed < 40; seed++) {
				const selector = createPuzzleSelector({ families: entries, rng: createRng(String(seed)) });
				const picks = Array.from({ length: count * 10 }, () => selector.next());
				for (let cycle = 0; cycle < 10; cycle++)
					expect(new Set(picks.slice(cycle * count, (cycle + 1) * count))).toEqual(
						new Set(entries.map((entry) => entry.family))
					);
				for (let index = 1; index < picks.length; index++)
					expect(picks.slice(Math.max(0, index - gap), index)).not.toContain(picks[index]);
			}
		}
	);

	it('uses weights to move families earlier without multiplying their cycle count', () => {
		let heavyPosition = 0,
			lightPosition = 0;
		for (let seed = 0; seed < 1000; seed++) {
			const selector = createPuzzleSelector({
				families: [
					{ family: 'heavy', weight: 8 },
					{ family: 'light', weight: 1 },
					{ family: 'other', weight: 1 }
				],
				rng: createRng(String(seed))
			});
			const cycle = Array.from({ length: 3 }, () => selector.next());
			expect(new Set(cycle).size).toBe(3);
			heavyPosition += cycle.indexOf('heavy');
			lightPosition += cycle.indexOf('light');
		}
		expect(heavyPosition / 1000).toBeLessThan(lightPosition / 1000 - 0.7);
	});

	it('rejects duplicate families and invalid or overflowing weights', () => {
		expect(() =>
			createPuzzleSelector({ families: [families[0]!, families[0]!], rng: createRng('1') })
		).toThrow('unique');
		for (const weight of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
			expect(() =>
				createPuzzleSelector({ families: [{ family: 'block', weight }], rng: createRng('1') })
			).toThrow('safe integers');
		expect(() =>
			createPuzzleSelector({
				families: [
					{ family: 'block', weight: Number.MAX_SAFE_INTEGER },
					{ family: 'memory', weight: 1 }
				],
				rng: createRng('1')
			})
		).toThrow('total is too large');
	});
});
