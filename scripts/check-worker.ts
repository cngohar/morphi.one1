import { createServer } from 'node:net';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { getPlatformProxy } from 'wrangler';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { createAuth } from '../src/lib/server/auth.js';
import { savePlayerName } from '../src/lib/server/players.js';
import { digest } from '../src/lib/server/runs.js';
import { catalog } from '../src/lib/catalog.js';
import type { CompletedRun } from '../src/lib/engine/contract.js';

const directory = await mkdtemp(join(tmpdir(), 'morphi-built-worker-'));
const configPath = join(directory, 'wrangler.jsonc');
const persistPath = join(directory, 'state');
const portProbe = createServer();
await new Promise<void>((resolve, reject) => {
	portProbe.once('error', reject);
	portProbe.listen(0, '127.0.0.1', resolve);
});
const address = portProbe.address();
if (!address || typeof address === 'string') throw new Error('No isolated test port');
const testPort = address.port;
await new Promise<void>((resolve) => portProbe.close(() => resolve()));
const origin = `http://127.0.0.1:${testPort}`;
const secret = 'isolated-built-worker-smoke-secret-never-used-by-the-app';
await writeFile(
	configPath,
	JSON.stringify({
		name: 'morphi-built-worker-check',
		main: resolve('.svelte-kit/cloudflare/_worker.js'),
		compatibility_date: '2026-10-22',
		compatibility_flags: ['nodejs_als'],
		workers_dev: false,
		assets: { binding: 'ASSETS', directory: resolve('.svelte-kit/cloudflare') },
		vars: {
			BETTER_AUTH_URL: origin,
			BETTER_AUTH_SECRET: secret,
			GOOGLE_CLIENT_ID: '',
			GOOGLE_CLIENT_SECRET: ''
		},
		d1_databases: [
			{
				binding: 'DB',
				database_name: 'isolated-smoke',
				database_id: 'local-morphi-smoke',
				remote: false
			}
		]
	})
);
await writeFile(
	join(directory, '.dev.vars'),
	`BETTER_AUTH_URL=${origin}\nBETTER_AUTH_SECRET=${secret}\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n`,
	{ mode: 0o600 }
);
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>> | undefined;
let worker: ReturnType<typeof spawn> | undefined;
try {
	proxy = await getPlatformProxy<Cloudflare.Env>({
		configPath,
		persist: { path: join(persistPath, 'v3') },
		remoteBindings: false
	});
	for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
		await proxy.env.DB.batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => proxy!.env.DB.prepare(part))
		);
	}
	const auth = betterAuth({
		...createAuth(proxy.env.DB, {
			baseURL: origin,
			secret,
			googleClientId: '',
			googleClientSecret: ''
		}).options,
		plugins: [testUtils()]
	});
	const helpers = (await auth.$context).test;
	const user = await helpers.saveUser(
		helpers.createUser({ email: 'worker-smoke@example.test', name: 'Private fixture' })
	);
	const login = await helpers.login({ userId: user.id });
	await savePlayerName(proxy.env.DB, user.id, 'worker_smoke');
	const ownerKey = await digest(`${secret}\0progress\0${user.id}`);
	worker = spawn(
		'bunx',
		[
			'wrangler',
			'dev',
			'--config',
			configPath,
			'--local',
			'--persist-to',
			persistPath,
			'--port',
			String(testPort),
			'--inspector-port',
			'0',
			'--log-level',
			'error'
		],
		{ stdio: ['ignore', 'ignore', 'pipe'] }
	);
	let diagnostics = '';
	worker.stderr?.on('data', (chunk: Buffer) => {
		diagnostics = (diagnostics + chunk.toString()).slice(-4000);
	});
	let ready = false;
	for (let i = 0; i < 120; i++) {
		if (worker.exitCode !== null)
			throw new Error('Isolated Worker exited before readiness: ' + diagnostics);
		try {
			if ((await fetch(origin)).ok) {
				ready = true;
				break;
			}
		} catch {
			/* Built Worker booting. */
		}
		await delay(250);
	}
	if (!ready) throw new Error('Built Worker did not become ready.');
	const evidence: string[] = [];
	function check(condition: unknown, label: string) {
		if (!condition) throw new Error(label);
		evidence.push(label);
	}
	const publicPages = ['/', '/privacy', '/terms', '/how-it-works', '/about', '/faq'];
	for (const path of [...publicPages, '/account/sign-in', '/leaderboard']) {
		const response = await fetch(origin + path);
		if (response.status !== 200)
			throw new Error(
				`guest ${path}: ${response.status} ${(await response.text()).slice(0, 1500)} ${diagnostics}`
			);
		check(true, `guest ${path}`);
	}
	const slugs = ['block', 'memory', 'connect', 'block-puzzle'];
	for (const slug of slugs) {
		const response = await fetch(`${origin}/${slug}?game=${slug}`, { redirect: 'manual' });
		const location = response.headers.get('location');
		const destination = location ? new URL(location, `${origin}/${slug}`).pathname : null;
		check(
			response.status === 308 && destination === '/',
			`built family route ${slug} redirects Home (got ${response.status}, ${location ?? 'no location'})`
		);
	}
	const sitemap = await (await fetch(origin + '/sitemap.xml')).text();
	const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/morphi\.one([^<]*)<\/loc>/g)].map(
		(match) => match[1]
	);
	check(
		JSON.stringify(sitemapPaths) === JSON.stringify(publicPages),
		'built sitemap lists only Home and static public documents'
	);
	const robots = await (await fetch(origin + '/robots.txt')).text();
	check(
		slugs.every((slug) => !robots.includes(`/${slug}`)),
		'built robots output has no game routes'
	);
	for (const path of publicPages) {
		const html = await (await fetch(origin + path)).text();
		const links = [...html.matchAll(/href="([^"]*)"/g)].map((match) => new URL(match[1]!, origin));
		check(
			links.every(
				(url) =>
					url.origin !== origin ||
					(!slugs.includes(url.pathname.slice(1).replace(/\/$/, '')) &&
						!url.pathname.startsWith('/play/') &&
						(url.pathname !== '/play' || url.search === ''))
			),
			`built page links do not expose a family route: ${path}`
		);
	}
	check((await fetch(origin + '/api/progress')).status === 401, 'anonymous history refused');
	const headers = new Headers(login.headers);
	headers.set('origin', origin);
	headers.set('content-type', 'application/json');
	async function post(path: string, body: unknown) {
		return fetch(origin + path, { method: 'POST', headers, body: JSON.stringify(body) });
	}
	const accountResponse = await fetch(origin + '/account', { headers, redirect: 'manual' });
	if (accountResponse.status !== 200)
		throw new Error(
			'profile status ' +
				accountResponse.status +
				' location ' +
				accountResponse.headers.get('location')
		);
	check(
		accountResponse.headers.get('cache-control')?.includes('no-store'),
		'private built profile'
	);
	const start = await post('/api/play/start', { family: 'memory', ownerKey });
	if (start.status !== 200)
		throw new Error('built ranked start: ' + start.status + ' ' + (await start.text()));
	check(true, 'built ranked start');
	const issued = (await start.json()) as { id: string; seed: string; engineVersion: string };
	const round = catalog.memory.createRound(issued.seed);
	const moves = [...new Set(round.cards.map((card) => card.symbol))].flatMap((symbol) =>
		round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
	);
	const run: CompletedRun = {
		version: 1,
		id: issued.id,
		family: 'memory',
		engineVersion: issued.engineVersion,
		seed: issued.seed,
		moves,
		elapsedSeconds: 0,
		rankedSession: issued.id
	};
	await delay(14500);
	const saved = await post('/api/progress', { ownerKey, run });
	check(saved.status === 200, 'built ranked replay/save');
	const result = (await saved.json()) as { score: number; ranked: boolean; group: string };
	check(
		result.ranked && result.score < round.pairs * 1000,
		'built server timing overrides client zero'
	);
	const retried = await post('/api/progress', { ownerKey, run });
	check(
		retried.status === 200 && JSON.stringify(await retried.json()) === JSON.stringify(result),
		'built idempotent retry'
	);
	const history = (await (await fetch(origin + '/api/progress', { headers })).json()) as {
		history: unknown[];
	};
	check(history.history.length === 1, 'built single owned history row');
	const board = await fetch(`${origin}/leaderboard?group=${encodeURIComponent(result.group)}`, {
		headers
	});
	check((await board.text()).includes('worker_smoke'), 'built public leaderboard');
	check((await post('/api/auth/delete-user', {})).status === 200, 'built fresh account deletion');
	check(
		(await fetch(origin + '/api/progress', { headers })).status === 401,
		'built session revoked after deletion'
	);
	check(
		!(
			await (await fetch(`${origin}/leaderboard?group=${encodeURIComponent(result.group)}`)).text()
		).includes('worker_smoke'),
		'built deletion removes ranked entry'
	);
	console.info(
		JSON.stringify(
			{ target: 'built Worker, isolated temporary local D1', checks: evidence },
			null,
			2
		)
	);
} finally {
	worker?.kill();
	await proxy?.dispose();
	await rm(directory, { recursive: true, force: true });
}
