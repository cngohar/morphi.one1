const U64_MASK = (1n << 64n) - 1n;
const U64_RANGE = 1n << 64n;
const GOLDEN_GAMMA = 0x9e3779b97f4a7c15n;
const MIX_1 = 0xbf58476d1ce4e5b9n;
const MIX_2 = 0x94d049bb133111ebn;

const DECIMAL_SEED = /^\d+$/;

export interface Rng {
	nextU64(): bigint;
	nextInt(maxExclusive: number): number;
}

export function normalizeSeed(seed: string): bigint {
	if (!DECIMAL_SEED.test(seed)) {
		throw new RangeError('Seed must be a decimal string.');
	}

	const value = BigInt(seed);
	if (value < 0n || value > U64_MASK) {
		throw new RangeError('Seed must fit in an unsigned 64-bit integer.');
	}

	return value;
}

export function createRng(seed: string): Rng {
	let state = normalizeSeed(seed);

	return {
		nextU64() {
			state = (state + GOLDEN_GAMMA) & U64_MASK;
			let z = state;
			z = ((z ^ (z >> 30n)) * MIX_1) & U64_MASK;
			z = ((z ^ (z >> 27n)) * MIX_2) & U64_MASK;
			return (z ^ (z >> 31n)) & U64_MASK;
		},
		nextInt(maxExclusive: number) {
			if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
				throw new RangeError('maxExclusive must be a positive safe integer.');
			}

			const bound = BigInt(maxExclusive);
			const limit = U64_RANGE - (U64_RANGE % bound);
			let draw = this.nextU64();

			while (draw >= limit) {
				draw = this.nextU64();
			}

			return Number(draw % bound);
		}
	};
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
	const result = items.slice();

	for (let index = result.length - 1; index > 0; index -= 1) {
		const swap = rng.nextInt(index + 1);
		const current = result[index];
		result[index] = result[swap];
		result[swap] = current;
	}

	return result;
}

export function randomSeed(): string {
	if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
		throw new Error('Secure randomness is unavailable.');
	}

	const words = new Uint32Array(2);
	crypto.getRandomValues(words);
	return ((BigInt(words[0]) << 32n) | BigInt(words[1])).toString(10);
}
