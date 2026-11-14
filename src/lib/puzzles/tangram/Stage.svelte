<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';
	import { cardSceneMotion, motion } from '#lib/ui/motion.js';
	export type CardPhase =
		| 'dealing'
		| 'waiting'
		| 'flipping'
		| 'unfolding'
		| 'arriving'
		| 'playing'
		| 'folding'
		| 'ending'
		| 'result'
		| 'result-leaving'
		| 'failed';
	let {
		phase,
		title,
		best,
		ready,
		failed = false,
		stack,
		playedCount,
		onretry,
		children,
		endingContent,
		resultContent,
		footerContent
	}: {
		phase: CardPhase;
		title: string;
		best: number;
		ready: boolean;
		failed?: boolean;
		stack: { family: string; best: number; color: string }[];
		playedCount: number;
		onretry: () => void;
		children: Snippet;
		endingContent: Snippet;
		resultContent: Snippet;
		footerContent?: Snippet;
	} = $props();
	let root: HTMLDivElement;
	let frame: HTMLDivElement;
	let card: HTMLDivElement;
	let content: HTMLDivElement;
	let pile: HTMLDivElement;
	let current: ReturnType<typeof cardSceneMotion> | null = null;
	export function stop() {
		try {
			current?.destroy();
		} catch {
			console.warn('morphi:card_motion_unavailable');
		} finally {
			current = null;
		}
	}
	export function measureFrame() {
		const game = content?.querySelector<HTMLElement>('.game');
		if (!game) return;
		frame.dataset.measuring = 'true';
		const width = game.getBoundingClientRect().width + 2;
		frame.style.setProperty('--frame-width', `${width}px`);
		delete frame.dataset.measuring;
	}
	export function present(beat: Parameters<typeof cardSceneMotion>[1]) {
		try {
			const exitFrom = beat === 'result-exit' ? current?.resultFrame() : undefined;
			stop();
			if (beat === 'unfold') measureFrame();
			current = cardSceneMotion(
				{
					root,
					frame,
					card,
					content,
					backdrop: null,
					stack: pile,
					stackIndex: Math.min(playedCount, 7),
					result: root.querySelector<HTMLElement>('.result-main'),
					score: root.querySelector<HTMLElement>('.result-number')
				},
				beat,
				motion.reduced(),
				exitFrom
			);
		} catch {
			stop();
			console.warn('morphi:card_motion_unavailable');
		}
	}
	onMount(() => {
		let resizeFrame = 0;
		const visibility = () => {
			try {
				if (document.hidden) current?.pause();
				else current?.resume();
			} catch {
				stop();
				console.warn('morphi:card_motion_unavailable');
			}
		};
		const resize = () => {
			stop();
			cancelAnimationFrame(resizeFrame);
			// Let the game's reactive media-query layout update its row/column count first.
			resizeFrame = requestAnimationFrame(() => {
				try {
					measureFrame();
				} catch {
					console.warn('morphi:card_layout_unavailable');
				}
			});
		};
		const reduced = matchMedia('(prefers-reduced-motion: reduce)');
		const preference = () => {
			if (reduced.matches) stop();
		};
		document.addEventListener('visibilitychange', visibility);
		window.addEventListener('resize', resize);
		reduced.addEventListener('change', preference);
		return () => {
			stop();
			cancelAnimationFrame(resizeFrame);
			document.removeEventListener('visibilitychange', visibility);
			window.removeEventListener('resize', resize);
			reduced.removeEventListener('change', preference);
		};
	});
</script>

<div
	class="active-wrap round-stage"
	data-family-stage="tangram"
	data-card-phase={phase}
	bind:this={root}
>
	<div class="round-frame" bind:this={frame}>
		<div class="round-card" aria-hidden="true" bind:this={card}>
			<div class="round-card-inner">
				<div class="round-card-back"><i></i></div>
				<div class="round-card-front">
					<strong>{title}</strong>{#if phase === 'folding'}<span
							>{t('v1.game.best')} {formatNumber(best)}</span
						>{/if}
				</div>
			</div>
		</div>
		<div
			class="round-content"
			inert={!ready || phase === 'folding' || phase === 'result' || phase === 'result-leaving'}
			bind:this={content}
		>
			{@render children()}
			<footer class="round-panel tangram-footer">
				<div class="round-panel-inner">{@render footerContent?.()}</div>
			</footer>
		</div>
	</div>
	<aside class="played-stack" aria-label={t('v11.card.played', { count: playedCount })}>
		<p>{t('v11.card.played', { count: playedCount })}</p>
		<div class="stack-cards" aria-hidden="true" bind:this={pile}>
			{#each stack as entry, i (entry)}<span
					style={`transform:translate(${i * 2}px,${-i}px) rotate(${i * 3 - 9}deg);background:${entry.color}`}
					><b>{entry.family}</b><strong>{formatNumber(entry.best)}</strong></span
				>{/each}
		</div>
	</aside>
	<div
		class="round-result"
		inert={phase !== 'result'}
		aria-hidden={phase !== 'result' && phase !== 'result-leaving'}
	>
		{@render resultContent()}
	</div>
	{#if phase === 'ending'}{@render endingContent()}{/if}
	{#if phase === 'waiting' || phase === 'failed'}<div
			class="card-loading"
			role={failed ? 'alert' : 'status'}
		>
			<p>{t(failed ? 'round.startError' : 'round.starting')}</p>
			<div>
				{#if failed}<button class="btn primary" onclick={onretry}>{t('account.retry')}</button
					>{/if}<a class="btn" href={resolve('/')}>{t('game.home')}</a>
			</div>
		</div>{/if}
</div>

<style>
	:global(.design-public .active-round[data-family='tangram']) {
		--game-footer-height: 0px;
		--game-gap: 16px;
	}
	:global(.design-public .active-round[data-family='tangram'] .active-wrap) {
		padding: var(--game-gap) clamp(12px, 2.5vw, 40px);
	}
	.round-content {
		position: relative;
	}
	:global(.design-public .active-round[data-family='tangram'] .round-panel.tangram-footer) {
		position: absolute;
		inset: auto 16px 12px auto;
		width: calc(40% - 24px);
		height: 64px;
		padding: 8px 0 0;
		background: transparent;
	}
	:global(.design-public .active-round[data-family='tangram'] .round-panel-inner) {
		gap: 8px;
	}
	:global(.design-public .active-round[data-family='tangram'] .round-panel .help-controls) {
		gap: 6px;
		flex-wrap: wrap;
	}
	:global(.design-public .active-round[data-family='tangram'] .round-panel .btn) {
		padding: 7px 10px;
		font-size: 12px;
	}
	:global(.design-public .active-round[data-family='tangram'] .family-high strong) {
		font-size: 20px;
	}
	.played-stack {
		left: 20px;
		right: auto;
		pointer-events: none;
	}
	@media (max-width: 600px) and (orientation: portrait) {
		:global(.design-public .active-round[data-family='tangram']) {
			--game-gap: 8px;
		}
		:global(.design-public .active-round[data-family='tangram'] .round-panel.tangram-footer) {
			inset: auto 12px 8px;
			width: auto;
			height: 58px;
		}
	}
	@media (orientation: landscape) and (max-height: 560px) {
		:global(.design-public .active-round[data-family='tangram']) {
			--game-gap: 6px;
		}
		:global(.design-public .active-round[data-family='tangram'] .round-panel.tangram-footer) {
			inset: auto 10px 6px auto;
			width: calc(43% - 20px);
			height: 48px;
		}
		:global(.design-public .active-round[data-family='tangram'] .round-panel .btn) {
			min-height: 36px;
			font-size: 10px;
			padding: 4px 7px;
		}
		:global(.design-public .active-round[data-family='tangram'] .family-high strong) {
			font-size: 16px;
		}
	}
</style>
