import { drawFreshTheme } from '#lib/engine/theme/freshness.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';

addEventListener(
	'message',
	(
		event: MessageEvent<{
			family: ResolvedTheme['family'];
			history: ResolvedTheme[];
			seeds: string[];
		}>
	) => {
		try {
			let index = 0;
			const { family, history, seeds } = event.data;
			postMessage({ theme: drawFreshTheme(family, history, () => seeds[index++]) });
		} catch {
			postMessage({ error: 'theme_generation_failed' });
		}
	}
);
