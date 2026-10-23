<script lang="ts">
	import { t } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';

	let {
		title,
		summary,
		score,
		best,
		previousBest,
		isNewBest,
		isSoClose,
		gap,
		onnext,
		onhome
	}: {
		title: string;
		summary: string;
		score: number;
		best: number;
		previousBest: number;
		isNewBest: boolean;
		isSoClose: boolean;
		gap: number;
		onnext: () => void;
		onhome: () => void;
	} = $props();
</script>

<div class="result">
	<div class="decor" aria-hidden="true">
		<span class="shape shape-a"></span>
		<span class="shape shape-b"></span>
	</div>

	<main class="card">
		<h1 class="sr-only">{title}</h1>

		{#if isNewBest}
			<span class="badge">{t('result.newBest')}</span>
		{/if}

		<p class="score-label">{t('result.score')}</p>
		<p class="score" aria-label={t('result.score')}>{formatNumber(score)}</p>

		<p class="best">{t('result.best', { score: formatNumber(best) })}</p>
		{#if isNewBest && previousBest > 0}
			<p class="previous">{t('result.previousBest', { score: formatNumber(previousBest) })}</p>
		{:else if isSoClose}
			<p class="so-close">{t('result.soClose', { points: formatNumber(gap) })}</p>
		{/if}

		<p class="summary">{summary}</p>

		<button type="button" class="next" onclick={onnext}>{t('result.next')}</button>
		<button type="button" class="home" onclick={onhome}>{t('result.home')}</button>
	</main>
</div>

<style>
	.result {
		position: relative;
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: calc(20px + var(--safe-top)) calc(20px + var(--safe-right))
			calc(20px + var(--safe-bottom)) calc(20px + var(--safe-left));
		overflow: hidden;
	}

	.card {
		position: relative;
		z-index: 1;
		width: min(100%, 380px);
		padding: 28px 24px 24px;
		border: 1px solid var(--border);
		border-radius: 28px;
		background: var(--surface);
		text-align: center;
		animation: result-in var(--dur-base) var(--ease-out) both;
	}

	.badge {
		display: inline-block;
		padding: 6px 14px;
		border-radius: 999px;
		background: var(--warning-fill);
		color: var(--ink);
		font-size: var(--text-15);
		font-weight: 800;
		animation: badge-pop 320ms var(--ease-out);
	}

	.score-label {
		margin-top: 18px;
		color: var(--muted);
		font-size: var(--text-13);
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.score {
		font-size: clamp(3.5rem, 17vw, 5.5rem);
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
	}

	.best {
		margin-top: 8px;
		color: var(--ink-2);
		font-size: var(--text-16);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.previous,
	.summary {
		margin-top: 4px;
		color: var(--muted);
		font-size: var(--text-15);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.so-close {
		margin-top: 4px;
		color: var(--primary-strong);
		font-size: var(--text-15);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.next {
		width: 100%;
		height: 64px;
		margin-top: 26px;
		border: 0;
		border-radius: 20px;
		background: var(--primary);
		color: var(--surface);
		font-size: 1.375rem;
		font-weight: 900;
		cursor: pointer;
		transition:
			background var(--dur-fast) linear,
			transform var(--dur-instant) ease-out;
	}

	.next:hover {
		background: var(--primary-strong);
	}

	.next:active {
		transform: scale(0.98);
	}

	.next:focus-visible,
	.home:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	.home {
		height: 48px;
		margin-top: 10px;
		padding: 0 22px;
		border: 2px solid var(--border-strong);
		border-radius: 16px;
		background: var(--surface);
		color: var(--ink);
		font-size: var(--text-16);
		font-weight: 800;
		cursor: pointer;
	}

	.home:hover {
		background: var(--surface-2);
	}

	.decor {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.shape {
		position: absolute;
		display: block;
		border-radius: 18px;
		background: var(--memory-back);
		opacity: 0.38;
	}

	.shape-a {
		top: 9%;
		left: 8%;
		width: clamp(54px, 15vw, 86px);
		aspect-ratio: 0.78;
		transform: rotate(-8deg);
	}

	.shape-b {
		right: 8%;
		bottom: 10%;
		width: clamp(46px, 12vw, 74px);
		aspect-ratio: 0.78;
		transform: rotate(11deg);
	}

	@media (max-height: 560px) {
		.card {
			padding: 16px 20px;
		}

		.score-label {
			margin-top: 10px;
		}

		.score {
			font-size: 3.25rem;
		}

		.previous {
			display: none;
		}

		.summary {
			font-size: var(--text-13);
		}

		.next {
			height: 52px;
			margin-top: 14px;
			font-size: 1.125rem;
		}

		.home {
			height: 42px;
			margin-top: 6px;
		}
	}

	@keyframes result-in {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card,
		.badge {
			animation: none;
		}

		.next,
		.home {
			transition: none;
		}
	}

	@keyframes badge-pop {
		0% {
			opacity: 0.5;
			transform: scale(0.85);
		}
		65% {
			transform: scale(1.06);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card,
		.badge {
			animation: none;
		}

		.next {
			transition: none;
		}

		.next:active {
			transform: none;
		}
	}
</style>
