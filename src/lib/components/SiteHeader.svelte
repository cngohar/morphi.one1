<script lang="ts">
	import Brand from '#lib/components/Brand.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import { t } from '#lib/i18n/messages.js';
	let {
		soundEnabled = true,
		ontogglesound,
		onhome
	}: { soundEnabled?: boolean; ontogglesound?: () => void; onhome?: () => void } = $props();
	const accountsEnabled = import.meta.env.MODE !== 'public-guest';
	let signedIn = $state(false);
	onMount(() => {
		if (!accountsEnabled) return;
		void fetch(resolve('/api/account/status'))
			.then(async (response) => {
				if (response.ok)
					signedIn = Boolean(((await response.json()) as { signedIn?: boolean }).signedIn);
			})
			.catch(() => console.warn('morphi:header_session_unavailable'));
	});
</script>

<header class="public-header" data-safe>
	{#if onhome}<button class="brand" aria-label={t('game.home')} onclick={onhome}><Brand /></button
		>{:else}<a class="brand" href={resolve('/')}><Brand /></a>{/if}
	<nav aria-label={t('account.profile.label')}>
		{#if accountsEnabled}<a class="account-entry" href={resolve('/account')}
				>{t(signedIn ? 'account.profile.label' : 'v1.nav.account')}</a
			>{/if}{#if ontogglesound}<SoundToggle enabled={soundEnabled} ontoggle={ontogglesound} />{/if}
	</nav>
</header>

<style>
	.public-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		height: 80px;
		padding: 18px 40px;
		flex-shrink: 0;
		position: relative;
		z-index: 3;
	}
	.brand {
		border: 0;
		background: none;
		text-decoration: none;
		color: var(--ink);
		font-size: 28px;
		font-weight: 950;
		letter-spacing: -0.035em;
		padding: 0;
		cursor: pointer;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.account-entry {
		display: grid;
		place-items: center;
		min-width: 94px;
		min-height: 38px;
		border: 1px solid var(--border-strong);
		border-radius: 20px;
		font-size: 13px;
		text-decoration: none;
		color: var(--ink);
		font-weight: 800;
	}
	:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
	@media (max-width: 600px) {
		.public-header {
			height: 64px;
			padding: 12px 20px;
		}
		.brand {
			font-size: 24px;
		}
		.account-entry {
			min-width: 80px;
			min-height: 34px;
			font-size: 12px;
		}
		nav {
			gap: 9px;
		}
	}
	@media (orientation: landscape) and (max-height: 560px) {
		.public-header {
			height: 52px;
			padding: 8px 20px;
		}
	}
</style>
