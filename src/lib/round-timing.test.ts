import { describe, it, expect } from 'vitest';
import { memoryEntranceMs, memoryOpeningMs } from './round-timing.js';
describe('Memory opening allowance', () => {
	it('gives each supported board its full entrance plus preview and hide', () => {
		expect([6, 8, 10].map(memoryEntranceMs)).toEqual([3000, 4000, 5000]);
		expect([6, 8, 10].map(memoryOpeningMs)).toEqual([6250, 7250, 8250]);
	});
});
