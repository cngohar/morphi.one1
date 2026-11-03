import { validateThemeConfig, type ThemeConfig } from '#lib/engine/theme/config.js';
import { drawFreshTheme } from '#lib/engine/theme/freshness.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';

addEventListener(
	'message',
	(
		event: MessageEvent<{
			family: ResolvedTheme['family'];
			history: ResolvedTheme[];
			seeds: string[];
			config: ThemeConfig;
		}>
	) => {
		try {
			let index = 0;
			const { family, history, seeds, config } = event.data;
			validateThemeConfig(config);
			postMessage({ theme: drawFreshTheme(family, history, () => seeds[index++], config) });
		} catch {
			postMessage({ error: 'theme_generation_failed' });
		}
	}
);
