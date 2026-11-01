<script lang="ts">
	import Brand from '#lib/components/Brand.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import { t } from '#lib/i18n/messages.js';
	let {
		soundEnabled = true,
		ontogglesound,
		onhome,
		gameTitle,
		gameMode = false
	}: {
		soundEnabled?: boolean;
		ontogglesound?: () => void;
		onhome?: () => void;
		gameTitle?: string;
		gameMode?: boolean;
	} = $props();
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

<header class="public-header" class:game-header={gameMode || !!gameTitle} data-safe>
	{#if onhome}<button class="brand" aria-label={t('game.home')} onclick={onhome}><Brand /></button
		>{:else}<a class="brand" href={resolve('/')}><Brand /></a>{/if}
	{#if gameTitle}<h1 class="puzzle-name">{gameTitle}</h1>{/if}
	<nav aria-label={t('account.profile.label')}>
		{#if accountsEnabled}<a
				class="account-entry"
				href={resolve('/account')}
				aria-label={t(signedIn ? 'account.profile.label' : 'v1.nav.account')}
				><span>{t(signedIn ? 'account.profile.label' : 'v1.nav.account')}</span><svg
					class="person-icon"
					viewBox="0 0 24 24"
					aria-hidden="true"
					><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8" /><path
						d="M4 22v-3a8 8 0 0 1 16 0v3"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
					/></svg
				></a
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
	.game-header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
	}
	.game-header nav {
		justify-self: end;
	}
	.game-header .brand {
		justify-self: start;
	}
	.puzzle-name {
		margin: 0;
		font-size: 30px;
		font-weight: 950;
		letter-spacing: -0.03em;
		line-height: 1.1;
	}
	.person-icon {
		display: none;
		width: 22px;
		height: 22px;
	}
	@media (max-width: 600px) {
		.public-header {
			height: 64px;
			padding: 12px 20px;
		}
		.game-header .account-entry {
			min-width: 40px;
			min-height: 40px;
		}
		.game-header .account-entry span {
			display: none;
		}
		.game-header .person-icon {
			display: block;
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
	@media (max-width: 600px) and (orientation: portrait) {
		.game-header {
			height: 100px;
			grid-template-columns: 1fr auto;
			grid-template-rows: 40px 28px;
			row-gap: 8px;
		}
		.game-header .puzzle-name {
			grid-column: 1 / -1;
			grid-row: 2;
			justify-self: center;
			font-size: 25px;
		}
		.game-header nav {
			grid-column: 2;
			grid-row: 1;
		}
	}
	@media (orientation: landscape) and (max-height: 560px) {
		.public-header {
			height: 52px;
			padding: 8px 20px;
		}
	}
</style>
