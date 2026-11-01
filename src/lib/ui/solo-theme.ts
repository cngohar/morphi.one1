import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
import { drawFreshTheme } from '#lib/engine/theme/freshness.js';
import { randomSeed } from '#lib/seeds.js';

/** Keep palette solving off the interaction thread. Entropy stays outside the engine. */
export async function soloTheme(
	family: ResolvedTheme['family'],
	history: ResolvedTheme[],
	signal: AbortSignal
): Promise<ResolvedTheme> {
	const seeds = Array.from({ length: 8 }, randomSeed);
	try {
		return await new Promise<ResolvedTheme>((resolve, reject) => {
			const worker = new Worker(new URL('./theme-worker.ts', import.meta.url), { type: 'module' });
			const cleanup = () => {
				clearTimeout(timeout);
				signal.removeEventListener('abort', abort);
				worker.terminate();
			};
			const fail = () => {
				cleanup();
				reject(new Error('theme_worker_failed'));
			};
			const abort = () => {
				cleanup();
				reject(new Error('theme_worker_cancelled'));
			};
			const timeout = setTimeout(fail, 5000);
			worker.onerror = worker.onmessageerror = fail;
			worker.onmessage = (event: MessageEvent<{ theme?: ResolvedTheme }>) => {
				if (!event.data?.theme) {
					fail();
					return;
				}
				cleanup();
				resolve(event.data.theme);
			};
			signal.addEventListener('abort', abort, { once: true });
			if (signal.aborted) {
				abort();
				return;
			}
			try {
				worker.postMessage({ family, history, seeds });
			} catch {
				fail();
			}
		});
	} catch (error) {
		if (signal.aborted) throw error;
		console.warn('morphi:theme_worker_unavailable');
		let index = 0;
		return drawFreshTheme(family, history, () => seeds[index++]);
	}
}
