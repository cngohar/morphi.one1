<script lang="ts">
	import PlaySession from '#lib/screens/PlaySession.svelte';
	import { t } from '#lib/i18n/messages.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head
	><title>{t('v1.play.title')}</title><meta name="robots" content="noindex" /></svelte:head
>
<PlaySession {data} />
