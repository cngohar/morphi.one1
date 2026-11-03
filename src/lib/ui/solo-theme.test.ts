import { afterEach, expect, it, vi } from 'vitest';
import { soloTheme } from './solo-theme.js';
import { generateTheme } from '#lib/engine/theme/generator.js';
import { THEME_CONFIG } from '#lib/engine/theme/config.js';
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
it('reports unavailable browser Workers instead of blocking the main thread', async () => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.stubGlobal(
		'Worker',
		class {
			constructor() {
				throw new Error('blocked');
			}
		}
	);
	await expect(soloTheme('memory', [], new AbortController().signal)).rejects.toThrow('blocked');
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

it('passes the same configuration snapshot to its worker and keeps the resolved version', async () => {
	const config = { ...THEME_CONFIG, version: 'theme-preview' };
	const theme = generateTheme('42', 'memory', config);
	const terminate = vi.fn();
	const postMessage = vi.fn();
	vi.stubGlobal(
		'Worker',
		class {
			onmessage?: (event: { data: { theme: typeof theme } }) => void;
			terminate = terminate;
			postMessage(value: unknown) {
				postMessage(value);
				queueMicrotask(() => this.onmessage?.({ data: { theme } }));
			}
		}
	);
	expect(await soloTheme('memory', [], new AbortController().signal, config)).toEqual(theme);
	expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ config }));
	expect(terminate).toHaveBeenCalledOnce();
});
