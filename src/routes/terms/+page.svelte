<script lang="ts">
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	const sections = ['play', 'names', 'data', 'service', 'contact'];
</script>

<Seo title={t('v1.terms.title')} description={t('v1.terms.intro')} path="/terms" />
<div class="terms-page">
	<SiteHeader />
	<main class="content-page">
		<h1>{t('v1.terms.title')}</h1>
		<p class="updated">{t('v1.terms.updated')}</p>
		<p>{t('v1.terms.intro')}</p>
		{#each sections as key (key)}<section>
				<h2>{t(`v1.terms.${key}.title` as MessageKey)}</h2>
				<p>{t(`v1.terms.${key}.body` as MessageKey)}</p>
			</section>{/each}
	</main>
	<SiteFooter />
</div>

<style>
	.terms-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.content-page {
		width: min(100%, 760px);
		margin: auto;
		padding: 24px 28px 48px;
		flex: 1;
	}
	h1 {
		font-size: 48px;
		letter-spacing: -0.04em;
	}
	p {
		line-height: 1.7;
		color: var(--ink-2);
		margin-top: 16px;
	}
	section {
		margin-top: 30px;
	}
	h2 {
		font-size: 24px;
		margin: 0;
	}
	.updated {
		font-size: 13px;
		color: var(--muted);
	}
</style>
