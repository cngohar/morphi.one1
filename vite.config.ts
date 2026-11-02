import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { mkdir, writeFile } from 'node:fs/promises';

export default defineConfig({
	plugins: [
		{
			name: 'morphi-client-chunk-report',
			apply: 'build',
			applyToEnvironment: (environment) => environment.name === 'client',
			async generateBundle(_options, bundle) {
				const chunks = Object.fromEntries(
					Object.entries(bundle)
						.filter(([, output]) => output.type === 'chunk')
						.map(([name, output]) => {
							if (output.type !== 'chunk') throw new Error('Expected client chunk');
							return [
								name,
								{
									imports: output.imports,
									dynamicImports: output.dynamicImports,
									modules: Object.keys(output.modules).map((id) => id.replaceAll('\\', '/'))
								}
							];
						})
				);
				await mkdir('build/slice2', { recursive: true });
				await writeFile('build/slice2/client-chunks.json', JSON.stringify(chunks, null, 2) + '\n');
			}
		},
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter()
		})
	]
});
