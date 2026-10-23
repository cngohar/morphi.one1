<script lang="ts">
	import type { SymbolId } from '#lib/game/symbols.js';

	let { symbol, color }: { symbol: SymbolId; color: string } = $props();
</script>

<svg
	class="symbol"
	viewBox="0 0 48 48"
	role="presentation"
	aria-hidden="true"
	focusable="false"
	style:color
>
	{#if symbol === 'circle'}
		<circle cx="24" cy="24" r="15" fill="currentColor" />
	{:else if symbol === 'triangle'}
		<path d="M24 6 44 41H4Z" fill="currentColor" />
	{:else if symbol === 'square'}
		<rect x="8" y="8" width="32" height="32" rx="5" fill="currentColor" />
	{:else if symbol === 'diamond'}
		<path d="M24 3 45 24 24 45 3 24Z" fill="currentColor" />
	{:else if symbol === 'star'}
		<path
			d="M24 4 29.5 17.3 44 18.5 33 28 36.5 42 24 34.5 11.5 42 15 28 4 18.5 18.5 17.3Z"
			fill="currentColor"
		/>
	{:else if symbol === 'hexagon'}
		<path d="M24 4 41.3 14 41.3 34 24 44 6.7 34 6.7 14Z" fill="currentColor" />
	{:else if symbol === 'cross'}
		<path d="M18 6h12v12h12v12H30v12H18V30H6V18h12Z" fill="currentColor" />
	{:else if symbol === 'ring'}
		<circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="8" />
	{:else if symbol === 'pentagon'}
		<path d="M24 4 44 18.5 36.5 42 11.5 42 4 18.5Z" fill="currentColor" />
	{:else if symbol === 'heart'}
		<path
			d="M24 43S5 31.5 5 17.5C5 10.6 10.6 6 16.5 6c3.5 0 6.2 1.7 7.5 4.2C25.3 7.7 28 6 31.5 6 37.4 6 43 10.6 43 17.5 43 31.5 24 43 24 43Z"
			fill="currentColor"
		/>
	{/if}
</svg>

<style>
	.symbol {
		display: block;
		width: 62%;
		height: 62%;
		overflow: visible;
	}
</style>
