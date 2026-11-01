import { afterEach, expect, it, vi } from 'vitest';
import { generateTheme } from '#lib/engine/theme/generator.js';
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it('bounds a stalled IndexedDB open and closes a late connection', async () => {
	vi.resetModules();
	vi.useFakeTimers();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	const close = vi.fn();
	const opening = { result: { close }, onsuccess: () => {} };
	vi.stubGlobal('indexedDB', { open: () => opening });
	const { themeHistory, rememberTheme } = await import('./theme-history.js');
	const pending = themeHistory();
	await vi.advanceTimersByTimeAsync(1500);
	expect(await pending).toEqual([]);
	opening.onsuccess();
	expect(close).toHaveBeenCalledOnce();
	const theme = generateTheme('42', 'memory');
	const write = rememberTheme(theme);
	await vi.advanceTimersByTimeAsync(1500);
	await write;
	expect(await themeHistory()).toEqual([theme]);
});
it('retains the latest three themes when persistent storage is blocked', async () => {
	vi.resetModules();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.stubGlobal('indexedDB', {
		open: () => {
			throw new Error('blocked');
		}
	});
	const { themeHistory, rememberTheme } = await import('./theme-history.js');
	expect(await themeHistory()).toEqual([]);
	const themes = ['1', '2', '3', '4'].map((seed) => generateTheme(seed, 'memory'));
	for (const t of themes) await rememberTheme(t);
	expect(await themeHistory()).toEqual(themes.slice(-3));
});
