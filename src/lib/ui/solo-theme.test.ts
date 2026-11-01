import { afterEach, expect, it, vi } from 'vitest';
import { soloTheme } from './solo-theme.js';
import { paletteIssues } from '#lib/engine/theme/generator.js';
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
it('uses the accessible deterministic fallback when browser Workers are unavailable', async () => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.stubGlobal(
		'Worker',
		class {
			constructor() {
				throw new Error('blocked');
			}
		}
	);
	const theme = await soloTheme('memory', [], new AbortController().signal);
	expect(theme.family).toBe('memory');
	expect(paletteIssues(theme)).toEqual([]);
	expect(console.warn).toHaveBeenCalledWith('morphi:theme_worker_unavailable');
});
it('terminates a cancelled worker without starting a synchronous fallback', async () => {
	const terminate = vi.fn();
	vi.stubGlobal(
		'Worker',
		class {
			terminate = terminate;
		}
	);
	const controller = new AbortController();
	controller.abort();
	await expect(soloTheme('block', [], controller.signal)).rejects.toThrow('theme_worker_cancelled');
	expect(terminate).toHaveBeenCalledOnce();
});
