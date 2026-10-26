import { rm } from 'node:fs/promises';
// Design-review fixtures are available in development, never in a release bundle.
for (const path of ['.svelte-kit/cloudflare/demo', '.svelte-kit/output/client/demo'])
	await rm(path, { recursive: true, force: true });
