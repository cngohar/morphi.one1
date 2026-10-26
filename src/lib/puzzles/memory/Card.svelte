<script lang="ts">
	import Symbol from '#lib/puzzles/memory/Symbol.svelte';
	import type { MemoryCard as Card } from '#lib/puzzles/memory/logic.js';
	import { symbolLabel } from '#lib/puzzles/memory/symbols.js';
	import { t } from '#lib/i18n/messages.js';

	let {
		card,
		index,
		symbolColor,
		faceUp,
		matched,
		shaking,
		selected,
		delayedFlip,
		celebrating,
		winWave,
		locked,
		dealDelay,
		matchDelay,
		waveDelay,
		onflip
	}: {
		card: Card;
		index: number;
		symbolColor: string;
		faceUp: boolean;
		matched: boolean;
		shaking: boolean;
		selected: boolean;
		delayedFlip: boolean;
		celebrating: boolean;
		winWave: boolean;
		locked: boolean;
		dealDelay: number;
		matchDelay: number;
		waveDelay: number;
		onflip: (index: number) => void;
	} = $props();

	const name = $derived(t(symbolLabel(card.symbol)));
	const label = $derived(
		matched
			? t('card.matched', { symbol: name })
			: faceUp
				? t('card.up', { number: index + 1, symbol: name })
				: t('card.down', { number: index + 1 })
	);
</script>

<button
	type="button"
	class="memory-card"
	class:is-up={faceUp}
	class:is-matched={matched}
	class:is-shaking={shaking}
	class:is-selected={selected}
	class:is-delayed-flip={delayedFlip}
	class:is-celebrating={celebrating}
	class:is-win-wave={winWave}
	style={`--deal-delay:${dealDelay}ms;--match-delay:${matchDelay}ms;--wave-delay:${waveDelay}ms`}
	aria-label={label}
	aria-pressed={faceUp}
	disabled={locked || matched}
	onclick={() => onflip(index)}
>
	<span class="card-inner">
		<span class="card-face card-back" aria-hidden="true">
			<span class="back-mark"></span>
		</span>
		<span class="card-face card-front" aria-hidden="true">
			<Symbol symbol={card.symbol} color={symbolColor} />
		</span>
	</span>
</button>

<style>
	.memory-card {
		position: relative;
		display: block;
		aspect-ratio: 0.78;
		padding: 0;
		border: 0;
		background: none;
		perspective: 700px;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		transform: translateY(0) scale(1);
		transition: transform var(--dur-fast) var(--ease-out);
		/* The shared motion wrapper owns the entrance. */
	}

	.memory-card:disabled {
		cursor: default;
	}

	.memory-card:not(:disabled):active {
		transform: translateY(1px) scale(0.97);
		transition-duration: var(--dur-instant);
	}

	.memory-card.is-selected {
		transform: translateY(-4px);
	}

	.card-inner {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
		transition: transform var(--dur-base) var(--ease-out);
	}

	.is-delayed-flip .card-inner {
		transition-delay: 40ms;
	}

	.is-up .card-inner {
		transform: rotateY(180deg);
	}

	.card-face {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		border-radius: var(--memory-radius);
		backface-visibility: hidden;
	}

	.card-back {
		background: var(--memory-back);
		border: 2px solid var(--memory-edge);
	}

	.card-front {
		background: var(--memory-face);
		border: 2px solid var(--memory-edge);
		transform: rotateY(180deg);
	}

	.is-matched .card-front {
		background: var(--memory-matched);
		border-color: var(--memory-mark, var(--success));
		transition:
			background-color var(--dur-fast) linear,
			border-color var(--dur-fast) linear;
	}

	.is-celebrating .card-front {
		animation: match-pop 250ms var(--ease-out) var(--match-delay, 0ms);
	}

	.is-win-wave .card-front {
		animation: win-wave 1000ms var(--ease-out) var(--wave-delay, 0ms);
	}

	.card-front :global(.symbol) {
		transition: opacity var(--dur-fast) linear;
	}

	.is-matched .card-front :global(.symbol) {
		opacity: 0.55;
	}

	.back-mark {
		width: 24%;
		aspect-ratio: 1;
		border: 3px solid var(--memory-mark, rgba(255, 255, 255, 0.62));
		border-radius: 3px;
		transform: rotate(45deg);
	}

	.memory-card:focus-visible {
		outline: none;
	}

	.memory-card:focus-visible .card-face {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
	}

	.is-shaking .card-inner {
		animation: card-shake 200ms var(--ease-in-out);
	}

	@keyframes deal-in {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.94);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes card-shake {
		0%,
		100% {
			transform: rotateY(180deg) translateX(0) scale(1);
		}
		25% {
			transform: rotateY(180deg) translateX(-7%) scale(0.97);
		}
		75% {
			transform: rotateY(180deg) translateX(7%) scale(0.97);
		}
	}

	@keyframes match-pop {
		0%,
		100% {
			transform: rotateY(180deg) scale(1);
		}
		50% {
			transform: rotateY(180deg) scale(1.06);
		}
	}

	@keyframes win-wave {
		0%,
		100% {
			transform: rotateY(180deg) translateY(0) scale(1);
		}
		35% {
			transform: rotateY(180deg) translateY(-3px) scale(1.04);
		}
		70% {
			transform: rotateY(180deg) translateY(0) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.memory-card,
		.memory-card.is-selected,
		.memory-card:not(:disabled):active {
			animation: none;
			transform: none;
			transition: none;
		}

		.card-inner {
			transition: none;
		}

		.is-delayed-flip .card-inner {
			transition-delay: 0ms;
		}

		.is-shaking .card-inner,
		.is-celebrating .card-front,
		.is-win-wave .card-front {
			animation: none;
		}
	}
</style>
