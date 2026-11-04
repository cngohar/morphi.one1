import { chromium, devices, type Browser } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpus, platform, release, totalmem } from 'node:os';
import {
	installPerformanceObservers,
	percentiles,
	type BrowserPerformanceSample
} from './performance-metrics.js';
import { loadPerformanceCheckpoint, savePerformanceCheckpoint } from './performance-checkpoint.js';

// An externally managed built Worker avoids sharing dev-server, build or D1 setup with verification.
const origin = new URL(process.env.PERF_ORIGIN ?? 'http://127.0.0.1:8787');
if (
	!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
	!['http:', 'https:'].includes(origin.protocol) ||
	origin.pathname !== '/' ||
	origin.search ||
	origin.username ||
	origin.password
)
	throw new Error('PERF_ORIGIN must be a loopback built-Worker origin');
const runs = Number(process.env.PERF_RUNS ?? 5);
if (!Number.isSafeInteger(runs) || runs < 5)
	throw new Error('PERF_RUNS must be an integer of at least 5');
const response = await fetch(origin);
const html = await response.text();
if (!response.ok || /@vite\/client|\/src\//.test(html) || !html.includes('/_app/immutable/'))
	throw new Error(
		'Start the production build with a local Worker; Vite dev output is not evidence'
	);

const profiles = [
	{
		name: 'Desktop Chromium — local host CPU',
		device: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
		cpuSlowdown: 1,
		network: { name: 'fast', latency: 20, downloadMbps: 40, uploadMbps: 10 }
	},
	{
		name: 'Google Pixel 7a reference — Chromium emulation, not physical hardware',
		device: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } },
		cpuSlowdown: 4,
		network: { name: 'throttled 4G', latency: 150, downloadMbps: 1.6, uploadMbps: 0.75 }
	}
];

async function sample(browser: Browser, profile: (typeof profiles)[number], preloaded: boolean) {
	const context = await browser.newContext({ ...profile.device, serviceWorkers: 'block' });
	try {
		const page = await context.newPage();
		page.setDefaultTimeout(30_000);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const failedRequests: string[] = [];
		const cancelledRequests: string[] = [];
		page.on('requestfailed', (request) => {
			const paths =
				request.failure()?.errorText === 'net::ERR_ABORTED' ? cancelledRequests : failedRequests;
			paths.push(new URL(request.url()).pathname);
		});
		const encodings = new Set<string>();
		const cdp = await context.newCDPSession(page);
		await cdp.send('Network.enable');
		await cdp.send('Network.clearBrowserCache');
		await cdp.send('Network.setCacheDisabled', { cacheDisabled: !preloaded });
		await cdp.send('Network.emulateNetworkConditions', {
			offline: false,
			latency: profile.network.latency,
			downloadThroughput: (profile.network.downloadMbps * 1_000_000) / 8,
			uploadThroughput: (profile.network.uploadMbps * 1_000_000) / 8,
			connectionType: 'cellular4g'
		});
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown });
		cdp.on('Network.responseReceived', ({ response }) => {
			const header = Object.entries(response.headers).find(
				([name]) => name.toLowerCase() === 'content-encoding'
			);
			encodings.add(header ? String(header[1]) : 'identity');
		});
		await page.addInitScript(installPerformanceObservers);
		await page.goto(origin.href, { waitUntil: 'domcontentloaded' });
		await page.locator('.play-circle:not([disabled])').waitFor({ state: 'visible' });
		await page.waitForFunction(
			() =>
				(window as unknown as { __morphiPerformance: BrowserPerformanceSample }).__morphiPerformance
					.lcp !== null
		);
		let preloadStatus = 'not awaited (cold immediate Play)';
		if (preloaded) {
			try {
				await page.waitForFunction(
					() => performance.getEntriesByName('morphi:first-puzzle-preloaded').length > 0,
					undefined,
					{ timeout: 30_000 }
				);
				preloadStatus = 'ready mark observed';
			} catch {
				preloadStatus = 'unavailable after 30 seconds; sample is not confirmed preloaded';
			}
		}
		const home = await page.evaluate(() => {
			const state = (window as unknown as { __morphiPerformance: BrowserPerformanceSample })
				.__morphiPerformance;
			const navigation = performance.getEntriesByType(
				'navigation'
			)[0] as PerformanceNavigationTiming;
			const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
			const critical = resources.filter((entry) => entry.startTime <= (state.lcp ?? 0));
			const mark = performance.getEntriesByName('morphi:first-puzzle-preloaded')[0];
			return {
				lcpMs: state.lcp,
				cls: state.cls,
				preloadReadyMs: mark?.startTime ?? null,
				criticalTransferredBytes:
					navigation.transferSize + critical.reduce((sum, entry) => sum + entry.transferSize, 0),
				homeTransferredBytesAtPlay:
					navigation.transferSize + resources.reduce((sum, entry) => sum + entry.transferSize, 0),
				resources: resources.map((entry) => ({
					path: new URL(entry.name).pathname,
					initiator: entry.initiatorType,
					startMs: entry.startTime,
					endMs: entry.responseEnd,
					transferredBytes: entry.transferSize,
					encodedBodyBytes: entry.encodedBodySize,
					decodedBodyBytes: entry.decodedBodySize
				}))
			};
		});
		await page.locator('.play-circle').click();
		await page.waitForFunction(
			() =>
				(window as unknown as { __morphiPerformance: BrowserPerformanceSample }).__morphiPerformance
					.playable !== null
		);
		// Allow buffered Event Timing delivery after the next rendering opportunity.
		await page.waitForTimeout(500);
		const play = await page.evaluate(() => {
			const state = (window as unknown as { __morphiPerformance: BrowserPerformanceSample })
				.__morphiPerformance;
			const interactions = Object.values(state.interactions);
			return {
				inpLabProxyMs: interactions.length ? Math.max(...interactions) : null,
				observedInteractions: interactions.length,
				playFeedbackMs: state.feedback! - state.click!,
				playToPlayableMs: state.playable! - state.click!,
				clsThroughPlay: state.cls,
				family: document.querySelector<HTMLElement>('.game')?.dataset.family ?? null
			};
		});
		if (errors.length || failedRequests.length)
			throw new Error(JSON.stringify({ errors, failedRequests }));
		if (home.lcpMs === null) throw new Error('Home LCP was not observed');
		return { ...home, ...play, preloadStatus, cancelledRequests, contentEncodings: [...encodings] };
	} finally {
		await context.close();
	}
}

type PerformanceResult = {
	profile: (typeof profiles)[number];
	state: string;
	samples: Awaited<ReturnType<typeof sample>>[];
};
type PerformanceCheckpoint = {
	fingerprint: string;
	identity: unknown;
	startedAt: string;
	updatedAt: string;
	results: PerformanceResult[];
};
const output = 'build/slice6/performance';
const checkpointPath = `${output}/checkpoint.json`;
await mkdir(output, { recursive: true });
const hash = (contents: string | Buffer) => createHash('sha256').update(contents).digest('hex');
const sourceFiles = execFileSync(
	'git',
	[
		'ls-files',
		'-co',
		'--exclude-standard',
		'-z',
		'--',
		'src',
		'static',
		'migrations',
		'package.json',
		'bun.lock',
		'vite.config.ts',
		'svelte.config.js',
		'wrangler.jsonc',
		'tsconfig.json',
		'scripts/measure-performance.ts',
		'scripts/performance-metrics.ts',
		'scripts/performance-checkpoint.ts'
	],
	{ encoding: 'utf8' }
)
	.split('\0')
	.filter(Boolean)
	.sort();
const source = createHash('sha256');
for (const path of sourceFiles) source.update(JSON.stringify([path, hash(await readFile(path))]));
const browser = await chromium.launch();
try {
	const identity = {
		version: 1,
		origin: origin.origin,
		runs,
		profiles,
		browser: browser.version(),
		host: { platform: platform(), release: release(), cpu: cpus()[0]?.model },
		sourceHash: source.digest('hex'),
		clientGraphHash: hash(await readFile('build/slice2/client-chunks.json')),
		workerHash: hash(await readFile('.svelte-kit/cloudflare/_worker.js')),
		servedHomeHash: hash(html)
	};
	const fingerprint = hash(JSON.stringify(identity));
	const saved = await loadPerformanceCheckpoint<PerformanceCheckpoint>(checkpointPath, fingerprint);
	const checkpoint: PerformanceCheckpoint = saved ?? {
		fingerprint,
		identity,
		startedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		results: profiles.flatMap((profile) =>
			['cold', 'idle-preloaded'].map((state) => ({ profile, state, samples: [] }))
		)
	};
	const results = checkpoint.results;
	if (
		!Array.isArray(results) ||
		results.length !== profiles.length * 2 ||
		results.some(
			(result, index) =>
				JSON.stringify(result.profile) !== JSON.stringify(profiles[Math.floor(index / 2)]) ||
				result.state !== (index % 2 ? 'idle-preloaded' : 'cold') ||
				!Array.isArray(result.samples) ||
				result.samples.length > runs
		)
	)
		throw new Error(
			`Invalid saved sample groups in ${checkpointPath}; preserve and inspect this file`
		);
	const resumedSamples = results.reduce((count, result) => count + result.samples.length, 0);
	console.info(`Performance fingerprint ${fingerprint}; reusing ${resumedSamples} saved samples`);
	for (const result of results) {
		while (result.samples.length < runs) {
			console.info(`${result.profile.name}: ${result.state} ${result.samples.length + 1}/${runs}`);
			result.samples.push(await sample(browser, result.profile, result.state === 'idle-preloaded'));
			checkpoint.updatedAt = new Date().toISOString();
			await savePerformanceCheckpoint(checkpointPath, checkpoint);
		}
	}
	const targets = [
		{ metric: 'lcpMs', label: 'Home LCP (ms)', limit: 2500 },
		{ metric: 'inpLabProxyMs', label: 'INP lab interaction proxy (ms)', limit: 200 },
		{ metric: 'cls', label: 'Home CLS', limit: 0.1 },
		{ metric: 'clsThroughPlay', label: 'CLS through Play', limit: 0.1 },
		{ metric: 'criticalTransferredBytes', label: 'Critical Home transfer (bytes)', limit: 150_000 },
		{
			metric: 'playToPlayableMs',
			label: 'Play to playable, including accepted entrances (ms)',
			limit: 300
		}
	] as const;
	const summary = results.map((result) => ({
		profile: result.profile.name,
		state: result.state,
		confirmedPreloadedRuns: result.samples.filter((sample) => sample.preloadReadyMs !== null)
			.length,
		metrics: targets.map((target) => {
			const values = result.samples.map((sample) => sample[target.metric]);
			const measured = values.filter((value): value is number => value !== null);
			const timing = measured.length ? percentiles(measured) : null;
			return {
				...target,
				classification: 'goal (local diagnostic); physical-device/public-launch gate remains open',
				...timing,
				result:
					measured.length !== runs ||
					(result.state === 'idle-preloaded' &&
						result.samples.some((sample) => sample.preloadReadyMs === null))
						? 'unavailable/incomplete'
						: timing!.p95 <= target.limit
							? 'met in this lab profile'
							: 'goal missed'
			};
		})
	}));
	const notes = [
		'Expected ERR_ABORTED cancellations when leaving Home are retained per sample; they are not failed loads. Other network failures and page errors fail the sample, and actual playable-stage arrival is required.',
		'Kill switches: per-family lifecycle/zero weights control availability; the global ranked switch is enforced by server issuance and replay. Play, recovery and Next recheck availability, and an availability failure serves no fallback family. Save-Data/slow connections skip idle speculation.',
		'Missing/invalid versioned configuration uses typed defaults or the previous valid parent. Unknown families are rejected; missing game weights default to 1. Existing local defaults initialize catalog games enabled and permit ranked play unless explicitly switched off, still requiring authentication, caps, TTL and authoritative replay. The guest publication has no account backend; anonymous measurement remains consent-gated and off by default. These local defaults do not authorize a public account release or production flag setup.',
		`Resumed ${resumedSamples} matching saved samples. Each new successful sample is saved atomically in checkpoint.json; source/build/profile/origin/browser/host fingerprints must match to reuse it. Checkpoints, including stale copies, remain until Slice 6 fully passes.`,
		'Built local Worker only; no deployment or production measurements. Sequential samples, one Chromium instance, fresh browser context per sample; browser caches explicitly cleared before every navigation.',
		'Cold: HTTP cache disabled, click as soon as Play is hydrated; preload may race ahead and its observed ready timestamp is retained. Idle-preloaded: HTTP cache enabled only inside the fresh context; await the actual first-puzzle preload mark, with a 30-second bound. No warmed page navigation is reused.',
		'Pixel 7a is a named midrange reference profile using Pixel 7 viewport/touch emulation and 4x host CPU slowdown, not calibrated Pixel 7a hardware. Physical phone, real network, GPU/thermal behavior and production edge compression remain unmeasured.',
		'LCP and Home CLS end at Play. CLS uses the largest session window (1-second gap, maximum 5 seconds) excluding recent-input shifts; clsThroughPlay is also retained.',
		'INP is an Event Timing lab interaction proxy for the short scripted Play interaction, not field INP or a full-session p75. Event durations use a 16-ms reporting threshold plus buffered first-input; null means no recorded interaction, never fabricated zero.',
		'Critical transfer is navigation.transferSize plus document resource entries started by Home LCP. This includes estimated HTTP headers and actual locally delivered encoded bodies, may include noncritical early requests, and excludes Worker-internal fetches. Full Home resource timings and transferred bytes at Play are retained separately; edge gzip/Brotli is not assumed.',
		'Play feedback is two requestAnimationFrame callbacks after the trusted click, a next-frame proxy; Play-to-playable waits for the actual playing stage and game plus a rendering opportunity. Normal accepted Card entrances and Memory preview remain enabled and count toward that timing.',
		'Next preparation/feedback/playability and full-session gameplay interactions are not measured by this Home/first-Play harness. Historical Next goals remain outstanding unless separately evidenced.',
		'Optional physical-device drill: use Chrome remote debugging on the local-network built Worker, install collector.js before reloading through DevTools Local Overrides or an automation init script, and collect window.__morphiPerformance plus navigation/resource timings. Run five fresh-cache and five marked-preload samples; report actual model/browser/network. This is a manual procedure, not physical evidence.'
	];
	const report = {
		createdAt: new Date().toISOString(),
		startedAt: checkpoint.startedAt,
		fingerprint,
		identity,
		origin: origin.origin,
		browser: browser.version(),
		host: {
			platform: platform(),
			release: release(),
			cpu: cpus()[0]?.model,
			logicalCpus: cpus().length,
			memoryBytes: totalmem()
		},
		runsPerState: runs,
		notes,
		sources: [
			'https://web.dev/articles/cls',
			'https://web.dev/articles/inp',
			'https://chromedevtools.github.io/devtools-protocol/tot/Network/',
			'https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session'
		],
		summary,
		results
	};
	const markdown = [
		'# Slice 6 local performance measurements',
		'',
		`Created: ${report.createdAt}. Chromium ${report.browser}. ${runs} runs per profile/state.`,
		`Host: ${report.host.cpu}, ${report.host.platform} ${report.host.release}.`,
		'',
		...profiles.map(
			(profile) =>
				`${profile.name}: ${profile.device.viewport.width}×${profile.device.viewport.height}, CPU ${profile.cpuSlowdown}×, ${profile.network.name} (${profile.network.latency} ms latency, ${profile.network.downloadMbps}/${profile.network.uploadMbps} Mbps down/up).`
		),
		'',
		'| Profile/state | Metric | n | p50 | p95 | Local goal | Result |',
		'| --- | --- | ---: | ---: | ---: | ---: | --- |',
		...summary.flatMap((result) =>
			result.metrics.map(
				(metric) =>
					`| ${result.profile} / ${result.state} | ${metric.label} | ${metric.samples ?? 0} | ${metric.p50?.toFixed(3) ?? 'unavailable'} | ${metric.p95?.toFixed(3) ?? 'unavailable'} | ${metric.limit} | ${metric.result} |`
			)
		),
		'',
		...notes.map((note) => `- ${note}`),
		'',
		...report.sources.map((source) => `- <${source}>`),
		''
	].join('\n');
	await writeFile('build/slice6/performance/report.json', JSON.stringify(report, null, 2) + '\n');
	await writeFile('build/slice6/performance/report.md', markdown);
	await writeFile(
		'build/slice6/performance/collector.js',
		`(${installPerformanceObservers.toString()})();\n`
	);
	console.info('Performance evidence: build/slice6/performance/report.{json,md}');
} finally {
	await browser.close();
}
