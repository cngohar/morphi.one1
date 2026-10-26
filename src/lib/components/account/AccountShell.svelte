<script lang="ts">
	import Brand from '#lib/components/Brand.svelte';
	import { resolve } from '$app/paths';
	import { onMount, type Snippet } from 'svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { t } from '#lib/i18n/messages.js';
	import '#lib/ui/account.css';
	let { children, showLeaderboard = false }: { children: Snippet; showLeaderboard?: boolean } =
		$props();
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>
<div class="account-shell" data-ready={ready}>
	<header class="account-header">
		<a class="account-wordmark" href={resolve('/')} aria-label={t('result.home')}><Brand /></a>
		<nav class="account-header-actions">
			{#if showLeaderboard}<a class="board-link" href={resolve('/leaderboard')}
					>{t('leaderboard.title')}</a
				>{/if}
			<a class="account-close" href={resolve('/')} aria-label={t('account.backToPlay')}>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg
				>
			</a>
		</nav>
	</header>
	{@render children()}
	<SiteFooter />
</div>

<style>
	.account-header-actions {
		display: flex;
		align-items: center;
		gap: 20px;
	}
	.board-link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-size: 13px;
		font-weight: 800;
		color: var(--ink-2);
		text-decoration: none;
	}
	.board-link:hover {
		text-decoration: underline;
	}
	.board-link:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
	@media (max-width: 600px) {
		.account-header-actions {
			gap: 12px;
		}
	}
</style>
