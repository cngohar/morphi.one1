<script lang="ts">
	import ThemePreview from '#lib/components/ThemePreview.svelte';
	import { t } from '#lib/i18n/messages.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head
	><title>{t('themes.preview')} · Morphi.One</title><meta
		name="robots"
		content="noindex"
	/></svelte:head
>
<ThemePreview config={data.draft.values} />
