import { describe, expect, it } from 'vitest';
import { validateEnding } from '../../scripts/validate-ending.js';
import { catalog } from './catalog.js';

const { block, memory, connect } = catalog;

describe('puzzle ending declarations', () => {
	it('requires complete declarations and catalog-backed output placeholders', () => {
		for (const manifest of [block, memory, connect]) {
			expect(() => validateEnding(manifest.id, manifest.ending)).not.toThrow();
		}
		expect(() =>
			validateEnding('future', { ...memory.ending, subline: { key: 'ending.none', values: [] } })
		).not.toThrow();
		expect(block.ending.headlines.cap).toBe('ending.block.cap');
		expect(() =>
			validateEnding('block', {
				...block.ending,
				headlines: { default: block.ending.headlines.default }
			})
		).toThrow();
		expect(() => validateEnding('missing', undefined)).toThrow();
		expect(() => validateEnding('missing', { ...memory.ending, condition: '' })).toThrow();
		expect(() =>
			validateEnding('missing', { ...memory.ending, continue: 'auto_2s_tap' })
		).toThrow();
		expect(() =>
			validateEnding('missing', { ...memory.ending, headlines: { default: 'missing' } })
		).toThrow();
		expect(() =>
			validateEnding('missing', {
				...memory.ending,
				subline: { ...memory.ending.subline, values: ['pairs'] }
			})
		).toThrow();
	});
});
