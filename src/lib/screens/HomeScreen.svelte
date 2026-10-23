<script lang="ts">
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import { t } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';

	let {
		best,
		soundEnabled,
		onplay,
		ontogglesound
	}: {
		best: number;
		soundEnabled: boolean;
		onplay: () => void;
		ontogglesound: () => void;
	} = $props();
</script>

<div class="home">
	<div class="controls">
		<SoundToggle enabled={soundEnabled} ontoggle={ontogglesound} />
	</div>

	<div class="decor" aria-hidden="true">
		<span class="shape shape-a"></span>
		<span class="shape shape-b"></span>
		<span class="shape shape-c"></span>
	</div>

	<main class="content">
		<h1>{t('home.title')}</h1>
		<p class="tagline">{t('home.tagline')}</p>

		<button type="button" class="play" onclick={onplay}>
			<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path d="M8 5v14l11-7Z" fill="currentColor" />
			</svg>
			<span>{t('home.play')}</span>
		</button>

		{#if best > 0}
			<p class="best">{t('home.best', { score: formatNumber(best) })}</p>
		{/if}
	</main>
</div>

<style>
	.home {
		position: relative;
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: calc(16px + var(--safe-top)) calc(20px + var(--safe-right))
			calc(20px + var(--safe-bottom)) calc(20px + var(--safe-left));
		overflow: hidden;
	}

	.controls {
		position: absolute;
		top: calc(16px + var(--safe-top));
		right: calc(20px + var(--safe-right));
		z-index: 2;
	}

	.content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	h1 {
		font-size: clamp(2.75rem, 9vw, 5.5rem);
		font-weight: 900;
		line-height: 0.95;
		letter-spacing: -0.035em;
	}

	.tagline {
		margin-top: 12px;
		color: var(--muted);
		font-size: var(--text-16);
		font-weight: 700;
	}

	.play {
		width: clamp(176px, 46vw, 224px);
		aspect-ratio: 1;
		margin-top: clamp(44px, 9vh, 88px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		border: 0;
		border-radius: 50%;
		background: var(--primary);
		color: var(--surface);
		font-size: clamp(1.75rem, 5vw, 2.25rem);
		font-weight: 900;
		letter-spacing: -0.01em;
		cursor: pointer;
		transition:
			background var(--dur-fast) linear,
			transform var(--dur-instant) ease-out;
	}

	.play:hover {
		background: var(--primary-strong);
	}

	.play:active {
		transform: scale(0.97);
	}

	.play:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}

	.play svg {
		width: clamp(42px, 12vw, 58px);
		height: clamp(42px, 12vw, 58px);
	}

	.best {
		margin-top: 20px;
		color: var(--muted);
		font-size: var(--text-15);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.decor {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.shape {
		position: absolute;
		display: block;
	}

	.shape-a {
		top: 16%;
		left: 9%;
		width: clamp(34px, 8vw, 54px);
		aspect-ratio: 1;
		border-radius: 24%;
		background: var(--accent);
		opacity: 0.18;
		transform: rotate(-12deg);
	}

	.shape-b {
		top: 24%;
		right: 11%;
		width: clamp(30px, 7vw, 46px);
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--warning-fill);
		opacity: 0.28;
	}

	.shape-c {
		bottom: 15%;
		left: 15%;
		width: clamp(38px, 9vw, 60px);
		aspect-ratio: 1;
		border-radius: 20%;
		background: var(--success);
		opacity: 0.16;
		transform: rotate(14deg);
	}

	@media (max-height: 560px) {
		h1 {
			font-size: 2.25rem;
		}

		.tagline {
			margin-top: 4px;
			font-size: var(--text-15);
		}

		.play {
			width: 140px;
			margin-top: 14px;
			font-size: 1.5rem;
		}

		.play svg {
			width: 34px;
			height: 34px;
		}

		.best {
			margin-top: 8px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.play {
			transition: none;
		}

		.play:active {
			transform: none;
		}
	}
</style>
