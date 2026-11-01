import { describe, expect, it } from 'vitest';
import { validateEnding as validateEndingMessages } from '../../scripts/validate-ending.js';
import { catalog } from './catalog.js';
import { messages } from './i18n/messages.js';

const { block, memory, connect } = catalog;
const validateEnding = (id: string, ending: unknown) =>
	validateEndingMessages(id, ending, messages);

describe('puzzle ending declarations', () => {
	it('validates a new family against its own message bundle', () => {
		const bundle = { 'future.title': 'Finished', 'future.summary': '{moves} moves' };
		const ending = {
			...memory.ending,
			headlines: { default: 'future.title' },
			subline: { key: 'future.summary', values: ['moves'] }
		};
		expect(() => validateEndingMessages('future', ending, bundle)).not.toThrow();
		expect(() => validateEndingMessages('future', ending, messages)).toThrow();
	});

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
