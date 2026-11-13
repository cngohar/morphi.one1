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
	data-family-stage="mahjong-solitaire"
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
<footer class="round-panel">
	<div class="round-panel-inner">{@render footerContent?.()}</div>
</footer>

<style>
	:global(.design-public .active-round[data-family='mahjong-solitaire']) {
		--game-gap: 12px;
	}
	:global(.design-public .active-round[data-family='mahjong-solitaire'] .game) {
		width: min(100%, 1200px);
		padding: 12px;
		gap: 8px;
		background: #f8f1df !important;
		color: #193f34;
	}
	:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .hud > .stats) {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .stat) {
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 6px;
		border: 1px solid #ddcfad;
		border-radius: 20px;
		background: #fff8e9;
	}
	:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .stat-label) {
		font-size: 10px;
		color: #526154;
	}
	:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .stat strong) {
		font-size: 22px;
		line-height: 1.1;
	}
	@media (max-width: 600px) and (orientation: portrait) {
		:global(.design-public .active-round[data-family='mahjong-solitaire'] .game) {
			padding: 4px;
			gap: 6px;
		}
		:global(.design-public .active-round[data-family='mahjong-solitaire'] .entrance-rule) {
			font-size: 10px;
			line-height: 1.2;
			padding: 1px 8px;
		}
		:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .hud > .stats) {
			gap: 4px;
		}
		:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .stat strong) {
			font-size: 18px;
		}
	}
	@media (orientation: landscape) and (max-height: 560px) {
		:global(.design-public .active-round[data-family='mahjong-solitaire']) {
			--game-gap: 4px;
		}
		:global(.design-public .active-round[data-family='mahjong-solitaire'] .game) {
			display: grid;
			grid-template-columns: 88px minmax(0, 1fr) 124px;
			grid-template-rows: minmax(0, 1fr) auto;
			gap: 4px 8px;
			padding: 4px 8px;
		}
		:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .hud > .stats) {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}
		:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .stat strong) {
			font-size: 17px;
		}
		:global(.design-public .active-round[data-family='mahjong-solitaire'] .game .mahjong-tools) {
			grid-column: 3;
			grid-row: 1;
			flex-direction: column;
			gap: 3px;
		}
		:global(
			.design-public .active-round[data-family='mahjong-solitaire'] .game .mahjong-tools button
		) {
			min-height: 32px;
			padding: 3px 9px;
			font-size: 11px;
		}
		:global(
			.design-public .active-round[data-family='mahjong-solitaire'] .game .mahjong-announcement
		) {
			grid-column: 1 / -1;
			grid-row: 2;
			font-size: 10px;
			min-height: 12px;
		}
	}
</style>
