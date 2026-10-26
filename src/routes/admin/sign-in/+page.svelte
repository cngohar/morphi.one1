<script lang="ts">
	import Brand from '#lib/components/Brand.svelte';
	import { resolve } from '$app/paths';
	import AccountForm from '#lib/components/account/AccountForm.svelte';
	import { t } from '#lib/i18n/messages.js';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
</script>

<svelte:head
	><title>{t('v1.admin.login.title')} · Morphi.One</title><meta
		name="robots"
		content="noindex"
	/></svelte:head
>
<main class="operator-login">
	<section>
		<a href={resolve('/')} class="brand"><Brand /></a>
		<p class="eyebrow">{t('v1.admin.brand')}</p>
		<h1>
			{t(
				data.recovery
					? 'v1.admin.recovery.title'
					: data.signedIn && data.fresh
						? 'v1.admin.2fa.title'
						: 'v1.admin.login.title'
			)}
		</h1>
		<p>{t(data.recovery ? 'v1.admin.recovery.body' : 'v1.admin.login.body')}</p>
		{#if form?.code}<p role="alert">
				{t(form.code === 'reauth' ? 'v1.admin.reauth' : 'v1.admin.error')}
			</p>{/if}{#if data.signedIn && data.fresh}<AccountForm action="?/verify"
				>{#snippet children(pending)}<label
						>{t(data.recovery ? 'v1.admin.recovery.code' : 'v1.admin.code')}<input
							name="code"
							required
							maxlength={data.recovery ? 32 : 6}
							autocomplete={data.recovery ? 'off' : 'one-time-code'}
							inputmode={data.recovery ? 'text' : 'numeric'}
						/></label
					><input name="recovery" type="hidden" value={data.recovery ? '1' : '0'} /><button
						class="btn primary"
						disabled={pending}>{t('v1.admin.verify')}</button
					>{/snippet}</AccountForm
			><a href={resolve(data.recovery ? '/admin/sign-in' : '/admin/sign-in?recovery=1')}
				>{t(data.recovery ? 'v1.nav.back' : 'v1.admin.recovery')}</a
			>{:else}<AccountForm action="?/google"
				>{#snippet children(pending)}<button class="btn primary" disabled={pending}
						>{t('v1.admin.google')}</button
					>{/snippet}</AccountForm
			>{/if}
	</section>
</main>

<style>
	.operator-login {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 24px;
	}
	.operator-login > section {
		background: var(--surface);
		padding: 36px;
		border: 1px solid var(--border);
		border-radius: 16px;
		width: min(100%, 450px);
	}
	.brand {
		color: var(--ink);
		font-size: 28px;
		font-weight: 950;
		text-decoration: none;
	}
	.eyebrow {
		margin: 24px 0 12px;
		font-size: 11px;
		color: var(--muted);
		letter-spacing: 0.16em;
	}
	h1 {
		font-size: 32px;
		line-height: 1.1;
		margin-bottom: 16px;
	}
	p {
		font-size: 14px;
		color: var(--muted);
		margin: 12px 0;
	}
	label {
		display: flex;
		flex-direction: column;
		font-size: 13px;
		gap: 8px;
		margin: 20px 0;
	}
	input {
		width: 100%;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.primary {
		background: var(--primary);
		color: var(--surface);
		width: 100%;
		margin-bottom: 20px;
	}
	a {
		color: var(--ink-2);
		font-size: 13px;
	}
</style>
