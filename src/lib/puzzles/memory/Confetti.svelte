<script lang="ts">
	import { createRng } from '#lib/engine/rng.js';
	import { SYMBOL_COLORS } from '#lib/puzzles/memory/symbols.js';

	const DEFAULT_COLORS = [...SYMBOL_COLORS, '#E5532D', '#F5A524', '#2F6FED'];

	let { seed, colors = DEFAULT_COLORS }: { seed: string; colors?: readonly string[] } = $props();

	const palette = $derived(colors.length > 0 ? colors : DEFAULT_COLORS);
	const pieces = $derived.by(() => {
		const rng = createRng(seed);

		return Array.from({ length: 44 }, () => ({
			x: rng.nextInt(101),
			y: rng.nextInt(101),
			dx: rng.nextInt(93) - 46,
			dy: 12 + rng.nextInt(48),
			rotation: 180 + rng.nextInt(540),
			delay: rng.nextInt(80),
			duration: 450 + rng.nextInt(160),
			size: 7 + rng.nextInt(8),
			color: palette[rng.nextInt(palette.length)] ?? '#E5532D',
			shape: rng.nextInt(3)
		}));
	});
</script>

<div class="confetti" aria-hidden="true">
	{#each pieces as piece, index (index)}
		<span
			class="piece"
			class:circle={piece.shape === 0}
			class:triangle={piece.shape === 1}
			style={`left:${piece.x}%;top:${piece.y}%;--dx:${piece.dx}vw;--dy:${piece.dy}vh;--rot:${piece.rotation}deg;--delay:${piece.delay}ms;--duration:${piece.duration}ms;--size:${piece.size}px;--piece-color:${piece.color};`}
		></span>
	{/each}
</div>

<style>
	.confetti {
		position: fixed;
		inset: 0;
		z-index: 20;
		overflow: hidden;
		pointer-events: none;
	}

	.piece {
		position: absolute;
		width: var(--size);
		height: var(--size);
		border-radius: 2px;
		background: var(--piece-color);
		animation: burst var(--duration) var(--ease-out) var(--delay) both;
	}

	.circle {
		border-radius: 50%;
	}

	.triangle {
		border-radius: 0;
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
	}

	@keyframes burst {
		0% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(0.4) rotate(0);
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1)
				rotate(var(--rot));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.confetti {
			display: none;
		}
	}
</style>
