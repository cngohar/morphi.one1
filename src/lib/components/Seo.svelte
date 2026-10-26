<script lang="ts">
	let {
		title,
		description,
		path,
		image = 'home',
		ogTitle,
		ogDescription
	}: {
		title: string;
		description: string;
		path: string;
		image?: string;
		ogTitle?: string;
		ogDescription?: string;
	} = $props();
	const url = $derived(`https://morphi.one${path}`);
</script>

<svelte:head>
	<title>{title}</title><meta name="description" content={description} /><link
		rel="canonical"
		href={url}
	/>
	<meta property="og:title" content={ogTitle ?? title} /><meta
		property="og:description"
		content={ogDescription ?? description}
	/><meta property="og:type" content="website" /><meta property="og:url" content={url} /><meta
		property="og:site_name"
		content="Morphi.One"
	/><meta property="og:image" content={`https://morphi.one/og/${image}.png`} /><meta
		name="twitter:card"
		content="summary_large_image"
	/>
</svelte:head>
