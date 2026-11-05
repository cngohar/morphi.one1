<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { t } from '#lib/i18n/messages.js';
	let {
		action = '',
		children,
		oncomplete,
		pending = $bindable(false)
	}: {
		action?: string;
		children: Snippet<[boolean]>;
		oncomplete?: (success: boolean) => void;
		pending?: boolean;
	} = $props();
	let failed = $state(false);
	const submit: SubmitFunction = ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}
		pending = true;
		failed = false;
		return async ({ result, update }) => {
			try {
				if (result.type === 'error') failed = true;
				else await update({ reset: false });
				oncomplete?.(result.type === 'success' || result.type === 'redirect');
			} catch {
				console.error('morphi:account_form_failed');
				failed = true;
			} finally {
				pending = false;
			}
		};
	};
</script>

<form method="POST" {action} use:enhance={submit} aria-busy={pending}>
	{@render children(pending)}
	{#if failed}<p class="account-notice" role="alert">{t('account.error')}</p>{/if}
</form>
