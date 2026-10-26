import { it, expect } from 'vitest';
import { parseMeasurement } from './measurement.js';
it('accepts only consented coarse events and rejects personal data or seeds', () => {
	const value = {
		id: crypto.randomUUID(),
		consent: true,
		event: 'round_started',
		family: 'memory',
		code: null
	};
	expect(parseMeasurement(value)).toMatchObject({ event: 'round_started', family: 'memory' });
	for (const addition of [
		{ seed: '42' },
		{ email: 'private@example.test' },
		{ score: 200 },
		{ consent: false },
		{ family: 'unknown' },
		{ code: 'private error message' }
	])
		expect(parseMeasurement({ ...value, ...addition })).toBeNull();
});
