<script lang="ts">
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { puzzleBackdrop } from '#lib/ui/puzzle-backdrop.js';
	import { setBackdropBounds } from '#lib/ui/backdrop-layout.js';
	let { theme, visible = true }: { theme: ResolvedTheme; visible?: boolean } = $props();
	const backdrop = $derived(puzzleBackdrop(theme));
	let layer = $state<HTMLDivElement>();
	$effect(() => {
		if (!theme || !layer || !visible) return;
		const element = layer;
		const panel = layer.parentElement?.querySelector<HTMLElement>('.game');
		if (!panel) return;
		const layout = () => {
			try {
				setBackdropBounds(element, panel.getBoundingClientRect());
			} catch {
				console.warn('morphi:backdrop_layout_unavailable');
			}
		};
		layout();
		const observer = new ResizeObserver(layout);
		observer.observe(element);
		observer.observe(panel);
		return () => observer.disconnect();
	});
</script>

<div
	class="theme-backdrop"
	class:concealed={!visible}
	bind:this={layer}
	aria-hidden="true"
	data-backdrop={backdrop.kind}
	data-backdrop-version="own-items-4"
>
	{#each backdrop.items as item, i (i)}
		<svg
			viewBox="0 0 60 60"
			data-item={item.kind}
			data-band={item.band}
			style={`--item-x:${item.x};--item-y:${item.y}%;transform:translate(-50%,-50%) rotate(${item.rotate}deg);color:${backdrop.color}`}
		>
			<path
				d={item.path}
				fill={backdrop.fill === 'solid' ? 'currentColor' : 'none'}
				stroke={backdrop.fill === 'outline' ? 'currentColor' : undefined}
				stroke-width={backdrop.fill === 'outline' ? 4 : undefined}
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			{#if backdrop.symbol}<path
					d={item.glyph}
					transform="translate(18 18) scale(.5)"
					fill="none"
					stroke={theme.background}
					stroke-width="2"
				/>{/if}
		</svg>
	{/each}
</div>

<style>
	.theme-backdrop {
		position: absolute;
		inset: var(--game-header-height, 0px) 0 var(--game-footer-height, 0px);
		overflow: hidden;
		pointer-events: none;
		opacity: 0.2;
		z-index: 0;
	}
	.concealed {
		opacity: 0;
	}
	.theme-backdrop {
		transition: opacity 300ms ease-out;
	}
	@media (prefers-reduced-motion: reduce) {
		.theme-backdrop {
			transition: none;
		}
	}
	svg {
		position: absolute;
		top: var(--item-y);
		width: clamp(28px, 7vw, 100px);
		height: auto;
	}
	svg[data-band='left'] {
		left: calc(28px + max(0px, var(--scatter-left-space, 10vw) - 56px) * var(--item-x));
	}
	svg[data-band='right'] {
		left: calc(100% - 28px - max(0px, var(--scatter-right-space, 10vw) - 56px) * var(--item-x));
	}
	@media (max-width: 900px), (orientation: landscape) and (max-height: 560px) {
		.theme-backdrop {
			display: none;
		}
	}
</style>
