<script lang="ts">
	import Symbol from '#lib/puzzles/memory/Symbol.svelte';
	import type { MemoryCard as Card } from '#lib/puzzles/memory/logic.js';
	import { symbolLabel } from '#lib/puzzles/memory/symbols.js';
	import { t } from '#lib/i18n/messages.js';
	import type { ThemeSymbol } from '#lib/engine/theme/symbols.js';

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
		lockedOut = false,
		marked = false,
		dealDelay,
		matchDelay,
		waveDelay,
		onflip,
		glyph,
		fillMode = 'solid'
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
		/** Lockout: this card cannot be flipped on the next attempt. */
		lockedOut?: boolean;
		/** Swaps: this position was exchanged by the last miss. */
		marked?: boolean;
		dealDelay: number;
		matchDelay: number;
		waveDelay: number;
		onflip: (index: number) => void;
		glyph?: ThemeSymbol;
		fillMode?: 'solid' | 'outline';
	} = $props();

	const name = $derived(t(glyph ? `symbol.${glyph.label}` : symbolLabel(card.symbol)));
	const label = $derived(
		matched
			? t('card.matched', { symbol: name })
			: faceUp
				? t('card.up', { number: index + 1, symbol: name })
				: lockedOut
					? t('card.lockedDown', { number: index + 1 })
					: marked
						? t('card.swappedDown', { number: index + 1 })
						: card.back === undefined
							? t('card.down', { number: index + 1 })
							: t('card.downBack', {
									number: index + 1,
									back: t(card.back === 0 ? 'back.dotted' : 'back.striped')
								})
	);
</script>

<button
	type="button"
	class="memory-card"
	class:is-procedural={!!glyph}
	class:is-up={faceUp}
	class:is-matched={matched}
	class:is-shaking={shaking}
	class:is-selected={selected}
	class:is-delayed-flip={delayedFlip}
	class:is-lockout={lockedOut}
	class:is-marked={marked}
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
			{#if card.back === undefined}
				<span class="back-mark"></span>
			{:else}
				<svg class="back-pattern" viewBox="0 0 40 40" focusable="false">
					{#if card.back === 0}
						{#each [8, 20, 32] as y (y)}{#each [8, 20, 32] as x (x)}<circle
									cx={x}
									cy={y}
									r="3.5"
									fill="currentColor"
								/>{/each}{/each}
					{:else}
						<path d="M5 9H35M5 20H35M5 31H35" stroke="currentColor" stroke-width="5" fill="none" />
					{/if}
				</svg>
			{/if}
			{#if lockedOut}
				<svg class="badge" viewBox="0 0 24 24" focusable="false">
					<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
					<path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.5" fill="none" />
				</svg>
			{:else if marked}
				<svg class="badge" viewBox="0 0 24 24" focusable="false">
					<path
						d="M3 8H19M15 4L19 8L15 12M21 17H5M9 13L5 17L9 21"
						stroke="currentColor"
						stroke-width="2.5"
						fill="none"
					/>
				</svg>
			{/if}
		</span>
		<span class="card-face card-front" aria-hidden="true">
			<Symbol symbol={card.symbol} color={symbolColor} {glyph} {fillMode} />
		</span>
	</span>
</button>

<style>
	.memory-card {
		position: relative;
		display: block;
		aspect-ratio: var(--theme-aspect, 0.78);
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
		clip-path: var(--theme-clip, none);
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		border-radius: var(--memory-radius);
		backface-visibility: hidden;
	}

	.card-back {
		background: var(--memory-back);
		border: var(--theme-border, 2px) solid var(--memory-edge);
	}

	.is-procedural .card-face {
		border: 0;
		background: var(--memory-edge);
	}
	.is-procedural .card-face::before {
		content: '';
		position: absolute;
		inset: var(--theme-border);
		border-radius: inherit;
		clip-path: inherit;
		background: var(--memory-back);
	}
	.is-procedural .card-front::before {
		background: var(--memory-face);
	}
	.is-procedural .card-face > :global(*) {
		position: relative;
	}
	.is-procedural.is-matched .card-front {
		background: var(--memory-mark);
	}

	.card-front {
		background: var(--memory-face);
		border: var(--theme-border, 2px) solid var(--memory-edge);
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
		opacity: 1;
	}

	.back-mark {
		width: 24%;
		aspect-ratio: 1;
		border: 3px solid var(--memory-mark, rgba(255, 255, 255, 0.62));
		border-radius: 3px;
		transform: rotate(45deg);
	}

	.back-pattern {
		width: 52%;
		color: var(--memory-mark, rgba(255, 255, 255, 0.62));
	}

	/* Outranks the procedural theme's relative-position rule for face children. */
	.card-face > .badge {
		position: absolute;
		right: 6%;
		bottom: 6%;
		width: 34%;
		color: var(--memory-mark, var(--ink));
	}

	.is-lockout .card-back {
		border-style: dashed;
	}

	.is-marked .card-back {
		border-width: 4px;
	}

	.memory-card:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
		border-radius: var(--memory-radius);
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
