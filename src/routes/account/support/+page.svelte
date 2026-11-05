<script lang="ts">
	import { resolve } from '$app/paths';
	import AccountShell from '#lib/components/account/AccountShell.svelte';
	import SupportDesk from '#lib/components/SupportDesk.svelte';
	import { t } from '#lib/i18n/messages.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head><title>{t('support.title')} · Morphi.One</title></svelte:head>
<AccountShell
	><main class="account-main">
		<a class="account-link" href={resolve('/account')}>{t('account.profile.label')}</a>
		<h1 class="account-heading">{t('support.title')}</h1>
		<SupportDesk ownerKey={data.account.ownerKey ?? ''} />
	</main></AccountShell
>
