<script lang="ts">
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import AccountShell from '#lib/components/account/AccountShell.svelte';
	import AccountForm from '#lib/components/account/AccountForm.svelte';
	import { t } from '#lib/i18n/messages.js';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let name = $state(untrack(() => form?.name ?? data.name));
</script>

<svelte:head><title>{t('account.name.pageTitle')}</title></svelte:head>
<AccountShell>
	<main class="account-main account-narrow">
		<p class="account-eyebrow">{t('account.name.label')}</p>
		<h1 class="account-title">{t('account.name.title')}</h1>
		<p class="account-description">{t('account.name.description')}</p>
		<div class="account-name-form">
			<AccountForm>
				{#snippet children(pending)}
					<label class="account-label" for="player-name">{t('account.name.field')}</label>
					<input
						class="account-input"
						id="player-name"
						name="playerName"
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						minlength="3"
						maxlength="20"
						pattern={'[A-Za-z0-9_]{3,20}'}
						required
						bind:value={name}
						disabled={pending}
						aria-invalid={form?.code === 'invalid' || form?.code === 'taken'}
						aria-describedby="name-hint name-error"
					/>
					<p class="account-hint" id="name-hint">{t('account.name.hint')}</p>
					<div id="name-error">
						{#if form?.code || data.unavailable}<p class="account-notice" role="alert">
								{t(
									form?.code === 'invalid'
										? 'account.name.invalid'
										: form?.code === 'taken'
											? 'account.name.taken'
											: form?.code === 'expired'
												? 'account.expired'
												: 'account.error'
								)}
							</p>{/if}
					</div>
					<button class="account-button" type="submit" disabled={pending}
						>{t(pending ? 'account.saving' : 'account.name.save')}</button
					>
				{/snippet}
			</AccountForm>
			{#if form?.code === 'expired'}<a class="account-link" href={resolve('/account/sign-in')}
					>{t('account.signin.google')}</a
				>{/if}
			{#if data.name}<a class="account-link" href={resolve('/account')}>{t('account.back')}</a>{/if}
		</div>
	</main>
</AccountShell>
