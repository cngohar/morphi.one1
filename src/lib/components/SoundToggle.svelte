<script lang="ts">
	import { t } from '#lib/i18n/messages.js';

	let { enabled, ontoggle }: { enabled: boolean; ontoggle: () => void } = $props();
	const label = $derived(enabled ? t('sound.off') : t('sound.on'));
</script>

<button
	type="button"
	class="icon-button"
	aria-label={label}
	title={label}
	aria-pressed={enabled}
	onclick={ontoggle}
>
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" />
		{#if enabled}
			<path
				d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{:else}
			<path
				d="m16 9 5 6M21 9l-5 6"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{/if}
	</svg>
</button>

<style>
	.icon-button {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
		transition:
			background var(--dur-instant) linear,
			transform var(--dur-instant) ease-out;
	}

	.icon-button:hover {
		background: var(--surface-2);
	}

	.icon-button:active {
		transform: scale(0.96);
	}

	.icon-button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	svg {
		width: 22px;
		height: 22px;
	}

	@media (prefers-reduced-motion: reduce) {
		.icon-button {
			transition: none;
		}

		.icon-button:active {
			transform: none;
		}
	}
</style>
