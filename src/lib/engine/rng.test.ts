import { describe, expect, it } from 'vitest';
import { createRng, normalizeSeed, randomSeed, shuffle } from '#lib/engine/rng.js';

describe('splitmix64', () => {
	it('matches known vectors for seed 0', () => {
		const rng = createRng('0');
		const expected = [
			0xe220a8397b1dcdafn,
			0x6e789e6aa1b965f4n,
			0x06c45d188009454fn,
			0xf88bb8a8724c81ecn,
			0x1b39896a51a8749bn
		];

		for (const value of expected) {
			expect(rng.nextU64()).toBe(value);
		}
	});

	it('accepts the full unsigned 64-bit seed range', () => {
		expect(normalizeSeed('0')).toBe(0n);
		expect(normalizeSeed('18446744073709551615')).toBe((1n << 64n) - 1n);
	});

	it('rejects malformed and out-of-range seeds', () => {
		expect(() => normalizeSeed('')).toThrow(RangeError);
		expect(() => normalizeSeed('-1')).toThrow(RangeError);
		expect(() => normalizeSeed('12.5')).toThrow(RangeError);
		expect(() => normalizeSeed('0x10')).toThrow(RangeError);
		expect(() => normalizeSeed('18446744073709551616')).toThrow(RangeError);
	});

	it('returns integers inside the requested range', () => {
		const rng = createRng('42');

		for (let draw = 0; draw < 500; draw += 1) {
			const value = rng.nextInt(6);
			expect(Number.isInteger(value)).toBe(true);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(6);
		}
	});

	it('rejects invalid ranges', () => {
		const rng = createRng('42');
		expect(() => rng.nextInt(0)).toThrow(RangeError);
		expect(() => rng.nextInt(-3)).toThrow(RangeError);
		expect(() => rng.nextInt(1.5)).toThrow(RangeError);
	});
});

describe('shuffle', () => {
	it('is deterministic for a seed', () => {
		const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
		const first = shuffle(createRng('123'), items);
		const second = shuffle(createRng('123'), items);

		expect(first).toEqual(second);
	});

	it('keeps every item exactly once', () => {
		const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
		const result = shuffle(createRng('999'), items);

		expect(result.slice().sort()).toEqual(items.slice().sort());
	});

	it('changes with the seed', () => {
		const items = Array.from({ length: 20 }, (_, index) => index);
		const first = shuffle(createRng('1'), items);
		const second = shuffle(createRng('2'), items);

		expect(first).not.toEqual(second);
	});

	it('handles empty and single-item lists', () => {
		expect(shuffle(createRng('1'), [])).toEqual([]);
		expect(shuffle(createRng('1'), ['only'])).toEqual(['only']);
	});
});

describe('randomSeed', () => {
	it('returns a decimal string that normalizes', () => {
		const seed = randomSeed();

		expect(seed).toMatch(/^\d+$/);
		expect(normalizeSeed(seed)).toBeGreaterThanOrEqual(0n);
	});

	it('returns different seeds on consecutive draws', () => {
		expect(randomSeed()).not.toBe(randomSeed());
	});
});
