import { afterEach, expect, it, vi } from 'vitest';
import { THEME_CONFIG } from '#lib/engine/theme/config.js';

vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it('shares an in-flight live read, applies only a validated snapshot and retains it on failed reload', async () => {
	vi.resetModules();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	const setProperty = vi.fn();
	vi.stubGlobal('document', { documentElement: { style: { setProperty } } });
	const live = {
		...THEME_CONFIG,
		version: 'published-theme',
		siteTokens: { ...THEME_CONFIG.siteTokens, '--radius-18': '22px' }
	};
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ version: live.version, values: live })
		})
		.mockRejectedValueOnce(new Error('offline'));
	vi.stubGlobal('fetch', fetchMock);
	const { loadThemeConfig } = await import('./theme-config.js');
	const first = loadThemeConfig();
	expect(loadThemeConfig()).toBe(first);
	expect(await first).toEqual(live);
	expect(setProperty).toHaveBeenCalledWith('--radius-18', '22px');
	expect(await loadThemeConfig()).toEqual(live);
	expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('keeps bundled defaults when the first snapshot has invalid token values', async () => {
	vi.resetModules();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	const setProperty = vi.fn();
	vi.stubGlobal('document', { documentElement: { style: { setProperty } } });
	const invalid = {
		...THEME_CONFIG,
		siteTokens: { ...THEME_CONFIG.siteTokens, '--bg': 'url(unsafe)' }
	};
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ version: invalid.version, values: invalid })
		})
	);
	const { loadThemeConfig } = await import('./theme-config.js');
	expect(await loadThemeConfig()).toEqual(THEME_CONFIG);
	expect(setProperty).not.toHaveBeenCalled();
});
