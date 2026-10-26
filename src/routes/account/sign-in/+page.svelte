<script lang="ts">
	import { resolve } from '$app/paths';
	import AccountShell from '#lib/components/account/AccountShell.svelte';
	import AccountArt from '#lib/components/account/AccountArt.svelte';
	import AccountForm from '#lib/components/account/AccountForm.svelte';
	import { t } from '#lib/i18n/messages.js';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t('account.signin.pageTitle')}</title></svelte:head>
<AccountShell>
	<main class="account-main account-signin">
		<section class="account-intro">
			<p class="account-eyebrow">{t('account.signin.label')}</p>
			<h1 class="account-title">{t('account.signin.title')}</h1>
			<p class="account-description">{t('account.signin.description')}</p>
			<AccountArt />
		</section>
		<section class="account-auth" aria-labelledby="account-auth-title">
			<h2 class="account-heading" id="account-auth-title">{t('account.signin.account')}</h2>
			<p>{t('account.signin.detail')}</p>
			{#if data.deleted}<p class="account-notice" role="status">{t('account.deleted')}</p>{/if}
			{#if data.reauth}<p class="account-notice" role="status">{t('account.reauth')}</p>{/if}
			{#if data.status !== 'ready'}<p class="account-notice" role="status">
					{t('account.unavailable')}
				</p>
			{:else if form?.failed || data.oauthError}<p class="account-notice" role="alert">
					{t('account.signin.error')}
				</p>{/if}
			<AccountForm action="?/google">
				{#snippet children(pending)}
					<button
						class="account-button secondary account-google"
						type="submit"
						disabled={pending || data.status !== 'ready'}
						>{t(pending ? 'account.signin.pending' : 'account.signin.google')}</button
					>
				{/snippet}
			</AccountForm>
			<a class="account-link account-guest" href={resolve('/')}>{t('account.signin.guest')}</a>
			<p class="account-privacy">{t('account.signin.privacy')}</p>
			<p class="account-optional">{t('account.signin.optional')}</p>
		</section>
	</main>
</AccountShell>
