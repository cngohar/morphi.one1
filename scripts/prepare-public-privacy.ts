import { cp, mkdir, readFile, readdir, rm, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const built = spawnSync('bunx', ['vite', 'build', '--mode', 'public-guest'], { stdio: 'inherit' });
if (built.status !== 0) throw new Error('Guest publication build failed.');
if (spawnSync('bun', ['scripts/finish-build.ts'], { stdio: 'inherit' }).status !== 0)
	throw new Error('Build cleanup failed');
const target = 'build/public-privacy';
const directory = 'build/public-privacy-staging';
const assets = join(directory, 'assets');
await rm(directory, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
// Explicit allowlist: no Worker, server bundle, auth routes, local database,
// review demos, environment files, or generated Wrangler configuration.
await cp('.svelte-kit/output/client/_app', join(assets, '_app'), { recursive: true });
await cp('.svelte-kit/output/prerendered/pages/index.html', join(assets, 'index.html'));
await cp('.svelte-kit/output/prerendered/pages/privacy.html', join(assets, 'privacy.html'));
for (const page of ['play', 'terms', 'how-it-works', 'about', 'faq'])
	await cp(`.svelte-kit/output/prerendered/pages/${page}.html`, join(assets, `${page}.html`));
await cp('static/audio', join(assets, 'audio'), { recursive: true });
await cp('static/og', join(assets, 'og'), { recursive: true });
for (const endpoint of ['robots.txt', 'sitemap.xml'])
	await cp(`.svelte-kit/output/prerendered/pages/${endpoint}`, join(assets, endpoint));
for (const path of [
	'__data.json',
	'play/__data.json',
	'how-it-works/__data.json',
	'about/__data.json',
	'faq/__data.json',
	'privacy/__data.json',
	'terms/__data.json'
]) {
	const destination = join(assets, path);
	await mkdir(join(destination, '..'), { recursive: true });
	await cp(join('.svelte-kit/output/prerendered/dependencies', path), destination);
}
await writeFile(
	join(assets, '_redirects'),
	['block', 'memory', 'connect', 'block-puzzle'].map((slug) => `/${slug} / 308\n`).join('')
);
await writeFile(
	join(assets, '_headers'),
	await readFile('.svelte-kit/cloudflare/_headers', 'utf8')
);
const policy = await readFile(join(assets, 'privacy.html'), 'utf8');
const home = await readFile(join(assets, 'index.html'), 'utf8');
if (
	!policy.includes('https://morphi.one/privacy') ||
	!/href="(?:\.\/|\/)privacy"/.test(home) ||
	/Local review draft|under review|local preview|localhost|127\.0\.0\.1|noindex/i.test(policy) ||
	/<script\b/i.test(policy) ||
	/href="(?:\.\/|\/)account/.test(home)
)
	throw new Error('Publication document checks failed.');
const files: { path: string; sha256: string }[] = [];
async function inventory(path: string, relative = '') {
	for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) =>
		a.name.localeCompare(b.name)
	)) {
		const name = join(relative, entry.name);
		if (entry.isDirectory()) await inventory(join(path, entry.name), name);
		else {
			if (/\.map$/.test(name)) throw new Error('Source maps are not publication assets.');
			files.push({
				path: name,
				sha256: createHash('sha256')
					.update(await readFile(join(path, entry.name)))
					.digest('hex')
			});
		}
	}
}
await inventory(assets);
const config = await readFile('wrangler.public-privacy.jsonc', 'utf8');
await writeFile(
	join(directory, 'manifest.json'),
	JSON.stringify(
		{
			target: 'morphi-one',
			publicOrigin: 'https://morphi.one',
			status: 'prepared locally; deployment approval required',
			configSha256: createHash('sha256').update(config).digest('hex'),
			files
		},
		null,
		2
	) + '\n'
);
await rm(target, { recursive: true, force: true });
await rename(directory, target);
console.info(`Prepared ${files.length} static files in ${target}; no upload or deployment.`);
