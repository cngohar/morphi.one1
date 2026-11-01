<script lang="ts">
	import { resolve } from '$app/paths';
	import { explainers, type ExplainerId } from '#lib/content-explainers.js';
	import { t } from '#lib/i18n/messages.js';
	import Seo from '#lib/components/Seo.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import ContentBlocks from '#lib/components/ContentBlocks.svelte';
	let { page }: { page: ExplainerId } = $props();
	const content = $derived(explainers[page]);
</script>

<Seo title={t(content.title)} description={t(content.intro)} path={`/${page}`} />
<div class="explainer-page">
	<SiteHeader />
	<main>
		<p class="eyebrow">{t('explainer.eyebrow')}</p>
		<h1>{t(content.title)}</h1>
		<p class="intro">{t(content.intro)}</p>
		<ContentBlocks blocks={content.blocks} />
		<aside class="play-band">
			<div>
				<h2>{t('explainer.cta.title')}</h2>
				<p>{t('explainer.cta.body')}</p>
			</div>
			<a href={resolve('/')}>{t('home.play')}</a>
		</aside>
	</main>
	<SiteFooter />
</div>

<style>
	.explainer-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	main {
		width: min(100%, 1120px);
		margin: 0 auto;
		padding: 28px clamp(20px, 4vw, 48px) 40px;
		flex: 1;
	}
	h1 {
		font-size: clamp(34px, 5vw, 52px);
		letter-spacing: -0.04em;
		line-height: 1.15;
		margin: 10px 0 18px;
	}
	.intro {
		color: var(--ink-2);
		font-size: 18px;
		line-height: 1.65;
		max-width: 72ch;
		margin-bottom: 30px;
	}
	.play-band {
		margin-top: 36px;
		padding: 24px;
		border-radius: 18px;
		background: var(--ink);
		color: var(--surface);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
	}
	.play-band h2 {
		font-size: 24px;
		margin: 0 0 8px;
	}
	.play-band p {
		line-height: 1.5;
	}
	.play-band a {
		padding: 14px 30px;
		border-radius: 999px;
		background: var(--primary);
		color: var(--surface);
		font-weight: 900;
		text-decoration: none;
	}
	a:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
	@media (max-width: 600px) {
		main {
			padding-top: 16px;
		}
		.play-band {
			flex-direction: column;
			align-items: start;
		}
	}
</style>
