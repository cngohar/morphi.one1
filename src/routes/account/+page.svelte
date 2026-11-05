<script lang="ts">
	import { dismissOnBackdrop } from '#lib/ui/dismiss-dialog.js';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { syncProgress, pendingRuns, durableStorage, removePending } from '#lib/ui/progress.js';
	import ProfileContent from '#lib/components/account/ProfileContent.svelte';
	import { resolve } from '$app/paths';
	import AccountShell from '#lib/components/account/AccountShell.svelte';
	import AccountForm from '#lib/components/account/AccountForm.svelte';
	import { t } from '#lib/i18n/messages.js';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let guestRounds = $state(false);
	let syncNotice = $state('');
	let syncing = $state(false);
	async function refreshProgress(importGuests = false) {
		if (!data.account.ownerKey || syncing) return;
		syncing = true;
		try {
			await syncProgress(data.account.ownerKey, () => {}, importGuests);
			const entries = await pendingRuns();
			guestRounds = entries.some((entry) => entry.owner === null);
			const owned = entries.filter((entry) => entry.owner === data.account.ownerKey);
			syncNotice = !durableStorage
				? 'progress.storage'
				: owned.some((entry) => entry.rejected)
					? 'progress.rejected'
					: owned.length
						? 'progress.pending'
						: '';
			await invalidateAll();
		} catch {
			syncNotice = 'account.error';
			console.error('morphi:profile_sync_failed');
		} finally {
			syncing = false;
		}
	}
	function retryProgress() {
		void refreshProgress();
	}
	onMount(() => {
		retryProgress();
		window.addEventListener('online', retryProgress);
		const timer = setInterval(retryProgress, 15000);
		return () => {
			clearInterval(timer);
			window.removeEventListener('online', retryProgress);
		};
	});
	let deleteOwner: string | null = null;
	function deleted(success: boolean) {
		if (success && deleteOwner)
			void pendingRuns()
				.then(async (entries) => {
					for (const entry of entries)
						if (entry.owner === deleteOwner) await removePending(entry.id);
				})
				.catch(() => console.error('morphi:local_deletion_cleanup_failed'));
	}
	let dialog: HTMLDialogElement;
	let dialogError = $state(false);
	function showDelete() {
		deleteOwner = data.account.ownerKey;
		try {
			dialog.showModal();
		} catch {
			console.error('morphi:account_dialog_failed');
			dialogError = true;
		}
	}
	function closeDelete() {
		try {
			dialog.close();
		} catch {
			console.error('morphi:account_dialog_failed');
			dialogError = true;
		}
	}
</script>

<svelte:head><title>{t('account.profile.pageTitle')}</title></svelte:head>
<AccountShell showLeaderboard>
	<main class="account-main">
		{#if data.unavailable}
			<h1 class="account-title">{t('account.profile.label')}</h1>
			<p class="account-notice" role="alert">{t('account.error')}</p>
			<a class="account-link" href={resolve('/account')}>{t('account.retry')}</a>
		{:else}
			<ProfileContent
				name={data.name}
				history={data.history}
				bests={data.bests}
				summary={data.summary}
			>
				{#snippet settings()}<div class="account-actions">
						<a class="account-link" href={resolve('/account/support')}>{t('support.title')}</a>
						<a class="account-link" href={resolve('/leaderboard')}>{t('leaderboard.title')}</a>
						<button class="account-link" type="button" disabled={syncing} onclick={retryProgress}
							>{t('progress.retry')}</button
						>
						<a class="account-link" href={resolve('/account/name')}>{t('account.profile.edit')}</a>
						<AccountForm action="?/signout"
							>{#snippet children(pending)}<button
									class="account-link"
									type="submit"
									disabled={pending}>{t('account.profile.signout')}</button
								>{/snippet}</AccountForm
						>
						<button class="account-link account-delete" type="button" onclick={showDelete}
							>{t('account.profile.delete')}</button
						>
					</div>
				{/snippet}</ProfileContent
			>
			{#if form?.code || dialogError}<p class="account-notice" role="alert">
					{t(
						form?.code === 'reauth'
							? 'account.reauth'
							: form?.code === 'expired'
								? 'account.expired'
								: 'account.error'
					)}
				</p>{/if}
			{#if form?.code === 'reauth'}<a
					class="account-link"
					href={resolve('/account/sign-in?reauth=1')}>{t('account.signin.google')}</a
				>{/if}
			{#if syncNotice}<p class="account-notice" role="status">
					{t(syncNotice as import('#lib/i18n/messages.js').MessageKey)}
				</p>{/if}
			{#if guestRounds}<p>{t('progress.importDescription')}</p>
				<button
					class="account-link"
					type="button"
					disabled={syncing}
					onclick={() => void refreshProgress(true)}>{t('progress.import')}</button
				>{/if}
		{/if}
	</main>
	<dialog
		use:dismissOnBackdrop={closeDelete}
		class="account-dialog"
		bind:this={dialog}
		aria-labelledby="delete-title"
		aria-describedby="delete-description"
	>
		<h2 class="account-heading" id="delete-title">{t('account.delete.title')}</h2>
		<p id="delete-description">{t('account.delete.description')}</p>
		<AccountForm action="?/delete" oncomplete={deleted}>
			{#snippet children(pending)}
				<input type="hidden" name="confirm" value="delete" />
				{#if form?.code}<p role="alert">
						{t(
							form.code === 'reauth'
								? 'account.reauth'
								: form.code === 'expired'
									? 'account.expired'
									: 'account.error'
						)}
					</p>{/if}
				{#if form?.code === 'reauth'}<a
						class="account-link"
						href={resolve('/account/sign-in?reauth=1')}>{t('account.signin.google')}</a
					>{/if}
				<button class="account-button" type="submit" disabled={pending}
					>{t('account.profile.delete')}</button
				>
				<button class="account-link" type="button" disabled={pending} onclick={closeDelete}
					>{t('account.delete.cancel')}</button
				>
			{/snippet}
		</AccountForm>
	</dialog>
</AccountShell>

<style>
	.account-main {
		width: min(1450px, 100%);
		padding: 0 30px 24px;
	}
	@media (max-width: 600px) {
		.account-main {
			padding: 0 16px 20px;
		}
	}
</style>
