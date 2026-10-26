<script lang="ts">
	import '@fontsource-variable/nunito/wght.css';
	import '../app.css';
	import '#lib/ui/v1.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="design-public">{@render children()}</div>
