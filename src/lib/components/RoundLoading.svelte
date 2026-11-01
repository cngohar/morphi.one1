<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/messages.js';
	import { motion } from '#lib/ui/motion.js';
	let {
		failed = false,
		overlay = false,
		onretry
	}: {
		failed?: boolean;
		overlay?: boolean;
		onretry?: () => void;
	} = $props();
	let card: HTMLDivElement;
	onMount(() => motion.loadingCard(card));
</script>

<div class="round-loading" class:overlay data-safe>
	<div class="loading-card" bind:this={card} aria-hidden="true"><span></span></div>
	<p role={failed ? 'alert' : 'status'}>{t(failed ? 'round.startError' : 'round.starting')}</p>
	<div class="loading-actions">
		{#if failed}<button class="btn primary" onclick={onretry}>{t('account.retry')}</button>{/if}
		<a class="btn" href={resolve('/')}>{t('game.home')}</a>
	</div>
</div>

<style>
	.round-loading {
		min-height: 100dvh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 20px;
		text-align: center;
		background: var(--bg);
		padding: 24px;
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 20;
	}
	.loading-card {
		width: 112px;
		height: 150px;
		border: 2px solid var(--ink);
		border-radius: 16px;
		display: grid;
		place-items: center;
		background: var(--surface-2);
	}
	.loading-card span {
		width: 28px;
		height: 28px;
		border: 3px solid var(--ink);
		border-radius: 8px;
		transform: rotate(45deg);
	}
	.loading-actions {
		display: flex;
		gap: 12px;
	}
</style>
