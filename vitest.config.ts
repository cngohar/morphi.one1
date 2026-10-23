import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Pure rules and UI helpers do not need SvelteKit or a local Worker runtime.
export default defineConfig({
	resolve: {
		alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) }
	},
	test: {
		environment: 'node',
		expect: { requireAssertions: true },
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
	}
});
