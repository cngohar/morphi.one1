<script lang="ts">
	import { onDestroy, untrack, type Component } from 'svelte';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { familyName } from '#lib/ui/puzzle-presentation.js';
	import { puzzleMetadata } from '#lib/puzzle-metadata.js';
	import { puzzlePools, puzzleViews } from '#lib/registry.js';
	import {
		loadPuzzleModule,
		loadPuzzleView,
		type PuzzleViewProps,
		type PuzzleRound,
		type PuzzleResult
	} from '#lib/ui/puzzle-view.js';
	import type { Move, PuzzleManifest } from '#lib/engine/contract.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import { puzzleVariant } from '#lib/scoring.js';
	import { randomSeed } from '#lib/seeds.js';

	let {
		family,
		scoring
	}: { family: string; scoring: { family: string; variant?: string; values: ScoreValues }[] } =
		$props();
	const variants = $derived(puzzleMetadata[family].variants ?? []);
	let selected = $state(untrack(() => puzzleMetadata[family].variants?.[0]?.id ?? ''));
	let activeVariant = $state('');
	let View = $state<Component<PuzzleViewProps> | null>(null);
	let round = $state<PuzzleRound | null>(null);
	let result = $state<PuzzleResult | null>(null);
	let loading = $state(false);
	let failed = $state(false);
	let soundEnabled = $state(false);
	let roundNumber = $state(0);
	let manifest: PuzzleManifest | null = null;
	let moves: Move[] = [];
	let values = $state<ScoreValues>({});
	let replayedScore: number | null = null;
	let request: AbortController | null = null;

	function stop() {
		request?.abort();
		round = null;
		View = null;
		loading = false;
	}
	onDestroy(stop);

	async function start() {
		stop();
		const controller = new AbortController();
		request = controller;
		loading = true;
		failed = false;
		try {
			const [pool, view] = await Promise.all([
				loadPuzzleModule(puzzlePools[family], controller.signal),
				loadPuzzleView(puzzleViews[family], controller.signal)
			]);
			if (controller.signal.aborted) return;
			manifest = pool.manifest;
			activeVariant = puzzleVariant(family, selected)?.id ?? '';
			const configVariant = puzzleVariant(family, activeVariant)?.scoring
				? activeVariant
				: undefined;
			const config = scoring.find(
				(config) => config.family === family && config.variant === configVariant
			);
			if (!config) throw new Error('test_score_config');
			values = { ...config.values };
			moves = [];
			replayedScore = null;
			const next = manifest.createRound(randomSeed(), activeVariant);
			result = null;
			round = next;
			View = view;
			roundNumber++;
		} catch {
			if (!controller.signal.aborted) {
				console.error('morphi:admin_test_prepare_failed');
				failed = true;
			}
		} finally {
			if (request === controller) loading = false;
		}
	}

	function complete(_score: number, seconds: number) {
		try {
			if (!manifest || !round) throw new Error('test_round');
			replayedScore = manifest.replay(round.seed, moves, seconds, values, activeVariant).score;
		} catch {
			failed = true;
			console.error('morphi:admin_test_replay_failed');
		}
	}
	function finish(next: PuzzleResult) {
		if (failed || replayedScore === null) return;
		result = { ...next, score: replayedScore };
		round = null;
		View = null;
	}
</script>

<section class="admin-test" aria-labelledby="admin-test-title">
	<h2 id="admin-test-title">{t('admin.test.title')}</h2>
	<p>{t('admin.test.notice')}</p>
	<div class="test-controls">
		<label
			>{t('admin.test.family')}<select disabled={loading || !!round}
				><option value={family}>{familyName(family)}</option></select
			></label
		>
		<label
			>{t('admin.test.variant')}<select bind:value={selected} disabled={loading || !!round}
				>{#each variants as variant (variant.id)}<option value={variant.id}
						>{t(variant.name as MessageKey)}</option
					>{/each}</select
			></label
		>
		<button type="button" onclick={start} disabled={loading || !!round}
			>{t(result ? 'admin.test.next' : 'admin.test.start')}</button
		>
		{#if round || loading}<button type="button" onclick={stop}>{t('admin.test.stop')}</button>{/if}
	</div>
	{#if loading}<p role="status">{t('admin.test.loading')}</p>{/if}
	{#if failed}<p role="alert">{t('admin.test.failed')}</p>{/if}
	{#if round && View}
		<p class="test-banner">
			{t('admin.test.title')} · {familyName(family)} · {t(
				puzzleVariant(family, activeVariant)!.name as MessageKey
			)}
		</p>
		<div class="test-stage">
			{#key roundNumber}<View
					{round}
					{roundNumber}
					best={0}
					scoring={values}
					resolvedTheme={null}
					paused={false}
					rankedRound={false}
					{soundEnabled}
					entranceReady={true}
					ontogglesound={() => (soundEnabled = !soundEnabled)}
					onhome={stop}
					onready={() => {}}
					onmove={(move) => moves.push(move)}
					oncomplete={complete}
					onfinish={finish}
				/>{/key}
		</div>
	{/if}
	{#if result}
		<div role="status">
			<h3>{familyName(family)} · {t(puzzleVariant(family, activeVariant)!.name as MessageKey)}</h3>
			<p>{t('admin.test.result', { score: result.score })}</p>
			<p>{result.summary}</p>
			{#each result.stats as stat (stat.label)}<p>{stat.label}: {stat.value}</p>{/each}
		</div>
	{/if}
</section>

<style>
	.admin-test {
		min-width: 0;
		margin-bottom: 20px;
		padding: 22px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
	}
	.test-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 12px;
	}
	label {
		display: grid;
		gap: 6px;
	}
	select,
	button {
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.test-banner {
		font-weight: 800;
	}
	.test-stage {
		height: min(720px, 80dvh);
		min-height: 330px;
		overflow: hidden;
		border-radius: 12px;
	}
	.test-stage :global(.game) {
		height: 100%;
	}
	.test-stage :global(.board) {
		width: min(100%, 620px, calc((min(720px, 80dvh) - 140px) * var(--cols) * 0.72 / var(--rows)));
	}
	.test-stage :global(.stats) {
		gap: clamp(8px, 2vw, 24px);
	}
</style>
