<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { dealSteps } from '#lib/content-explainers.js';
	import { t } from '#lib/i18n/messages.js';
	import { motion } from '#lib/ui/motion.js';
	let step = $state(0);
	let playing = $state(false);
	let pageVisible = $state(false);
	let scene = $state<HTMLDivElement>();
	let reducedMotion = $state(true);
	const current = $derived(dealSteps[step]!);
	function choose(index: number) {
		playing = false;
		step = index;
	}
	$effect(() => {
		const node = scene,
			selected = step,
			staticMode = reducedMotion;
		if (!node) return;
		let active = true;
		let stop = () => {};
		void tick()
			.then(() => {
				if (active) stop = motion.explainer(node, selected, staticMode);
			})
			.catch(() => console.warn('morphi:explainer_motion_unavailable'));
		return () => {
			active = false;
			stop();
		};
	});
	$effect(() => {
		const selected = step;
		if (!playing || reducedMotion || !pageVisible) return;
		const timer = setTimeout(() => (step = (selected + 1) % dealSteps.length), 3800);
		return () => clearTimeout(timer);
	});
	onMount(() => {
		const preference = matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = preference.matches;
		playing = !preference.matches;
		const visibility = () => (pageVisible = !document.hidden);
		visibility();
		document.addEventListener('visibilitychange', visibility);
		const change = () => {
			reducedMotion = preference.matches;
			if (preference.matches) playing = false;
		};
		preference.addEventListener('change', change);
		return () => {
			preference.removeEventListener('change', change);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
</script>

<section class="deal-explainer" aria-label={t('explainer.animation.label')}>
	<div class="illustration">
		<div class="scene" bind:this={scene} aria-hidden="true" data-step={step}>
			{#key step}
				<div class="scene-content">
					{#if step === 0}
						<div class="example-play">{t('home.play')}</div>
						<div class="mysteries"><i>?</i><i>?</i><i>?</i></div>
					{:else}
						{#if step === 1}<div class="example-card">?</div>{/if}
						<div class="abstract-board" class:alternate={step === 3} class:scored={step === 2}>
							{#each Array.from({ length: 9 }, (_, index) => index) as index (index)}
								<i class:marked={step === 2 && [0, 1, 4, 7].includes(index)}></i>
							{/each}
						</div>
						{#if step === 2}
							<div class="example-score">
								<span>{t('explainer.animation.score')}</span><strong>240</strong>
							</div>
						{:else if step === 3}
							<span class="different-kind">{t('explainer.animation.next')}</span>
						{/if}
					{/if}
				</div>
			{/key}
		</div>
		<p class="caption">{t(`explainer.step.${current}.title`)}</p>
		<p class="note">{t('explainer.animation.note')}</p>
	</div>
	<div class="step-list">
		{#each dealSteps as key, index (key)}
			<button class="step-card" aria-pressed={step === index} onclick={() => choose(index)}>
				<span class="step-number" aria-hidden="true">{index + 1}</span>
				<span
					><strong>{t(`explainer.step.${key}.title`)}</strong><span class="step-body"
						>{t(`explainer.step.${key}.body`)}</span
					></span
				>
			</button>
		{/each}
		<div class="controls">
			<button aria-pressed={playing} onclick={() => (playing = !playing)}
				>{t(playing ? 'explainer.animation.pause' : 'explainer.animation.autoplay')}</button
			>
			<button
				onclick={() => {
					step = 0;
					playing = !motion.reduced();
				}}>{t('explainer.animation.replay')}</button
			>
		</div>
	</div>
</section>

<style>
	.deal-explainer {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(270px, 1fr);
		gap: 24px;
	}
	.illustration {
		border: 1px solid var(--border);
		border-radius: 20px;
		padding: 18px;
		background: var(--surface);
	}
	.scene {
		height: 360px;
		overflow: hidden;
		border-radius: 14px;
		background: var(--bg);
	}
	.scene-content {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 22px;
		padding: 20px;
	}
	.example-play {
		display: grid;
		place-items: center;
		border-radius: 50%;
		width: 142px;
		height: 142px;
		background: var(--primary);
		color: var(--surface);
		font-size: 36px;
		font-weight: 900;
	}
	.mysteries {
		display: flex;
		gap: 14px;
	}
	.mysteries i,
	.example-card {
		display: grid;
		place-items: center;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		font-weight: 900;
		font-style: normal;
		color: var(--ink-2);
	}
	.mysteries i {
		width: 44px;
		height: 56px;
		font-size: 24px;
	}
	.example-card {
		width: 54px;
		height: 72px;
		font-size: 30px;
	}
	.abstract-board {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 9px;
		width: 200px;
		padding: 12px;
		background: var(--surface);
		border: 2px solid var(--border-strong);
		border-radius: 16px;
	}
	.abstract-board i {
		aspect-ratio: 1;
		border: 2px solid var(--border-strong);
		background: var(--surface-2);
		border-radius: 6px;
	}
	.abstract-board .marked {
		background: var(--success);
		border-color: var(--ink-2);
	}
	.alternate {
		transform: rotate(-4deg);
	}
	.alternate i {
		border-radius: 50%;
		background: var(--warning-fill);
	}
	.example-score {
		display: flex;
		align-items: center;
		gap: 14px;
		color: var(--ink-2);
	}
	.example-score strong {
		font-size: 32px;
		color: var(--ink);
	}
	.different-kind {
		font-size: 16px;
		font-weight: 800;
	}
	.caption {
		font-size: 18px;
		text-align: center;
		font-weight: 900;
		margin: 18px 0 8px;
	}
	.note {
		font-size: 12px;
		color: var(--muted);
		text-align: center;
		line-height: 1.5;
	}
	.step-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.step-card {
		display: flex;
		gap: 12px;
		align-items: start;
		text-align: start;
		border: 2px solid var(--border);
		background: var(--surface);
		border-radius: 14px;
		padding: 14px;
		cursor: pointer;
		color: var(--ink);
		flex: 1;
	}
	.step-card[aria-pressed='true'] {
		border-color: var(--primary);
	}
	.step-number {
		border-radius: 50%;
		background: var(--surface-2);
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		font-weight: 900;
	}
	.step-card[aria-pressed='true'] .step-number {
		background: var(--ink);
		color: var(--surface);
	}
	.step-card strong {
		font-size: 16px;
	}
	.step-body {
		display: block;
		font-size: 13px;
		line-height: 1.5;
		color: var(--ink-2);
		margin-top: 4px;
	}
	.controls {
		display: flex;
		gap: 10px;
	}
	.controls button {
		flex: 1;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		color: var(--ink);
		border-radius: 999px;
		padding: 12px;
		min-height: 44px;
		font-weight: 800;
		cursor: pointer;
	}
	button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
	}
	@media (max-width: 760px) {
		.deal-explainer {
			grid-template-columns: 1fr;
			gap: 18px;
		}
		.scene {
			height: 280px;
		}
		.illustration {
			padding: 12px;
		}
		.abstract-board {
			width: 156px;
			gap: 7px;
			padding: 9px;
		}
		.scene-content {
			gap: 14px;
			padding: 12px;
		}
	}
</style>
