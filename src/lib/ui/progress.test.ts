import { afterEach, expect, it, vi } from 'vitest';
import { generateTheme } from '#lib/engine/theme/generator.js';
import { defaultScoreConfig } from '#lib/scoring.js';
import { activeSession, startSession } from './progress.js';

afterEach(() => vi.unstubAllGlobals());

it('accepts issued published configuration versions without falling back from ranked play', async () => {
	const theme = {
		...generateTheme('42', 'memory'),
		themeConfigVersion: '2d563cc3-c58d-49c7-9faa-d81c2a71b453'
	};
	const issued = {
		id: 'ranked',
		family: 'memory',
		seed: '42',
		engineVersion: 'memory-1',
		startedAt: 1,
		expiresAt: 1000,
		saving: false,
		theme,
		scoring: defaultScoreConfig('memory')
	};
	vi.stubGlobal(
		'fetch',
		vi.fn(() => Promise.resolve(Response.json(issued)))
	);
	expect((await startSession('memory', 'owner')).theme).toEqual(theme);
	expect(await activeSession('owner')).toMatchObject({ id: 'ranked', theme });
	for (const invalid of [
		{ ...theme, themeConfigVersion: '' },
		{ ...theme, themeConfigVersion: 'invalid version' },
		{ ...theme, themeConfigVersion: 'a'.repeat(81) },
		{ ...theme, themeGeneratorVersion: 'unsupported' },
		{ ...theme, seed: '43' }
	]) {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(Response.json({ ...issued, theme: invalid })))
		);
		await expect(startSession('memory', 'owner')).rejects.toThrow('ranked_theme');
		await expect(activeSession('owner')).rejects.toThrow('ranked_response');
	}
});
