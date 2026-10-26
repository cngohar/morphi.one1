export function randomSeed(): string {
	if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
		throw new Error('Secure randomness is unavailable.');
	}

	const words = new Uint32Array(2);
	crypto.getRandomValues(words);
	return ((BigInt(words[0]) << 32n) | BigInt(words[1])).toString(10);
}
