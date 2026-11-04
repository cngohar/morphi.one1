import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { createRng } from '../src/lib/engine/rng.js';
import { contrast, minimumDifference } from '../src/lib/engine/theme/color.js';
import {
	generateTheme,
	paletteIssues,
	PRESETS,
	type ResolvedTheme
} from '../src/lib/engine/theme/generator.js';
import {
	drawFreshTheme,
	FRESHNESS_RULES,
	freshnessViolations,
	freshnessScore
} from '../src/lib/engine/theme/freshness.js';
import {
	THEME_CONFIG,
	THEME_CONFIG_VERSION,
	THEME_GENERATOR_VERSION
} from '../src/lib/engine/theme/config.js';

// Read the documented anchors themselves: a stale, failing plan must fail verification.
const plan = await readFile('docs/PLAN.md', 'utf8');
for (const preset of PRESETS) {
	const row = plan
		.split('\n')
		.find((line) => line.startsWith(`| ${preset.id[0].toUpperCase() + preset.id.slice(1)} `));
	if (!row) throw new Error(`Missing documented preset: ${preset.id}`);
	const columns = row.split('|');
	const background = columns[2].match(/#[\da-f]{6}/i)?.[0];
	const back = columns[3].match(/#[\da-f]{6}/i)?.[0];
	const colors = columns[4].match(/#[\da-f]{6}/gi) ?? [];
	if (
		background?.toLowerCase() !== preset.background ||
		back?.toLowerCase() !== preset.back ||
		colors.join(',').toLowerCase() !== preset.colors.join(',')
	)
		throw new Error(`Preset drift: ${preset.id}`);
	if (
		minimumDifference(colors) < 22 ||
		colors.some((c) => contrast(c, '#ffffff') < 3.1) ||
		contrast(back!, background!) < 1.55
	)
		throw new Error(`Unsafe documented preset: ${preset.id}`);
}
const memoryOnly = process.argv.includes('--memory');
const directory = memoryOnly ? 'docs/evidence/v1.3' : 'docs/evidence/slice5-themes';
// Freshness is a best-effort diagnostic; the palette safety gate keeps 10,000 seeds.
const freshnessRounds = 1000;
const report: Record<string, unknown> = {
	config: THEME_CONFIG_VERSION,
	generator: THEME_GENERATOR_VERSION,
	seedsPerPuzzle: 10000,
	roundsPerPuzzle: freshnessRounds,
	colorModel:
		'Machado 2009 severity 1.0 on linear sRGB; CIE76 D65; 8-bit hex checked after conversion'
};
for (const family of memoryOnly
	? (['memory'] as const)
	: (['memory', 'block', 'connect'] as const)) {
	const buckets = Array.from({ length: 12 }, (_, i) => ({
		hue: `${i * 30}–${i * 30 + 29}`,
		seeds: 0,
		fallbacks: 0,
		rate: 0
	}));
	let totalFallbacks = 0;
	const times: number[] = [];
	for (let i = 0; i < 10000; i++) {
		const start = performance.now();
		const theme = generateTheme(String(i), family);
		times.push(performance.now() - start);
		const issues = paletteIssues(theme);
		if (issues.length) throw new Error(`${family} seed ${i}: ${issues.join(',')}`);
		const bucket = buckets[theme.initialHueBucket];
		bucket.seeds++;
		if (theme.fallback) {
			bucket.fallbacks++;
			totalFallbacks++;
		}
	}
	for (const bucket of buckets) {
		bucket.rate = Math.round((bucket.fallbacks / bucket.seeds) * 10000) / 100;
		if (bucket.rate > 5)
			throw new Error(`${family} ${bucket.hue} fallback rate ${bucket.rate}% > 5%`);
	}
	const rng = createRng('20261026');
	let history: ResolvedTheme[] = [];
	const violations = Object.fromEntries(FRESHNESS_RULES.map((rule) => [rule, 0]));
	let anyViolation = 0;
	const freshnessScores: number[] = [];
	const symbolSubsets = new Set<string>();
	for (let i = 0; i < freshnessRounds; i++) {
		const theme = drawFreshTheme(family, history, () => rng.nextU64().toString());
		const failed = freshnessViolations(theme, history);
		freshnessScores.push(freshnessScore(theme, history));
		symbolSubsets.add([...new Set(theme.symbols.map(({ family }) => family))].sort().join(','));
		if (failed.length) anyViolation++;
		for (const rule of failed) violations[rule]++;
		history = [...history, theme].slice(-3);
	}
	if (symbolSubsets.size < 2 || violations.symbols >= freshnessRounds - 1)
		throw new Error(`${family}: symbol freshness still fails by construction`);
	freshnessScores.sort((a, b) => a - b);
	times.sort((a, b) => a - b);
	const worstMs = times.at(-1)!;
	report[family] = {
		accessible: 10000,
		totalFallbacks,
		buckets,
		freshness: {
			anyViolation,
			violations,
			profile: THEME_CONFIG.profiles.default.freshness,
			symbolSubsets: symbolSubsets.size,
			weightedScore: {
				median: freshnessScores[Math.floor(freshnessRounds * 0.5)],
				p95: freshnessScores[Math.floor(freshnessRounds * 0.95)]
			},
			ratesPercent: Object.fromEntries(
				Object.entries(violations).map(([k, v]) => [k, (v * 100) / freshnessRounds])
			)
		},
		generationMs: {
			runs: 10000,
			median: times[5000],
			p95: times[9500],
			worst: worstMs,
			environment: `local ${process.platform} ${process.arch}, Bun ${process.versions.bun ?? 'unknown'}, preloaded generator, no network`,
			target: 'reported goal; no owner-approved gate'
		}
	};
	console.info(
		`${family}: 10,000 palettes pass; ${totalFallbacks} fallbacks; freshness violations ${JSON.stringify(violations)}`
	);
}
await mkdir(directory, { recursive: true });
await writeFile(
	`${directory}/palettes.json`,
	await format(JSON.stringify(report), {
		...(await resolveConfig(`${directory}/palettes.json`)),
		parser: 'json'
	})
);
