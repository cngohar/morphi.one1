<script lang="ts">
	import type { ContentBlock } from '#lib/content-explainers.js';
	import { t } from '#lib/i18n/messages.js';
	import DealExplainer from '#lib/components/DealExplainer.svelte';
	let { blocks }: { blocks: ContentBlock[] } = $props();
</script>

<div class="content-blocks">
	{#each blocks as block, index (index)}
		{#if block.kind === 'heading'}
			<h2>{t(block.text)}</h2>
		{:else if block.kind === 'paragraph'}
			<p>{t(block.text)}</p>
		{:else if block.kind === 'faq'}
			<details>
				<summary>{t(block.question)}</summary>
				<p>{t(block.answer)}</p>
			</details>
		{:else if block.kind === 'steps'}
			<DealExplainer />
		{/if}
	{/each}
</div>

<style>
	h2 {
		font-size: clamp(22px, 3vw, 28px);
		letter-spacing: -0.025em;
		margin: 32px 0 10px;
	}
	p {
		line-height: 1.75;
		color: var(--ink-2);
		max-width: 72ch;
	}
	details {
		border-bottom: 1px solid var(--border);
		padding: 18px 0;
	}
	summary {
		font-size: 18px;
		font-weight: 800;
		cursor: pointer;
		padding: 8px 0;
	}
	details p {
		margin: 12px 0 6px;
	}
	summary:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
</style>
