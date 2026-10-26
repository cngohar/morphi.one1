<script lang="ts">
	import Brand from '#lib/components/Brand.svelte';
	import MeasurementChoice from '#lib/components/MeasurementChoice.svelte';
	import { resolve } from '$app/paths';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { privacyPolicy } from '#lib/content/privacy.js';
	import { t } from '#lib/i18n/messages.js';
</script>

<svelte:head>
	<title>{t('privacy.pageTitle')}</title>
	<meta name="description" content={t('privacy.description')} />
	<link rel="canonical" href="https://morphi.one/privacy" />
</svelte:head>

<div class="policy-page">
	<header>
		<a class="wordmark" href={resolve('/')}><Brand /></a>
		<a class="back" href={resolve('/')}>{t('account.backToPlay')}</a>
	</header>
	<main id="privacy-main">
		<article aria-labelledby="privacy-title">
			<h1 id="privacy-title">{t('privacy.title')}</h1>
			<p class="review-date">{t('privacy.updated', { date: privacyPolicy.updatedOn })}</p>
			<section aria-labelledby="privacy-contact-title">
				<h2 id="privacy-contact-title">{t('privacy.contact.title')}</h2>
				{#if privacyPolicy.operatorName}<p>
						{t('privacy.contact.operator', { name: privacyPolicy.operatorName })}
					</p>{/if}
				{#if privacyPolicy.contactEmail}
					<p>
						{t('privacy.contact.body')}
						<a href={`mailto:${privacyPolicy.contactEmail}`}>{privacyPolicy.contactEmail}</a>
					</p>
				{:else}<p>{t('privacy.contact.pending')}</p>{/if}
			</section>
			{#each privacyPolicy.sections as section (section.id)}
				<section aria-labelledby={`privacy-${section.id}`}>
					<h2 id={`privacy-${section.id}`}>{t(section.heading)}</h2>
					{#each section.paragraphs as paragraph (paragraph)}<p>{t(paragraph)}</p>{/each}
					{#if 'links' in section && section.links}
						<ul class="provider-links">
							{#each section.links as link (link.href)}<li>
									<a href={link.href} rel="external noreferrer">{t(link.label)}</a>
								</li>{/each}
						</ul>
					{/if}
				</section>
			{/each}
			<section aria-labelledby="privacy-audience-title">
				<h2 id="privacy-audience-title">{t('privacy.audience.title')}</h2>
				<p>{t('privacy.audience.general')}</p>
				<p>{t('privacy.audience.guest')}</p>
				<p>{t('privacy.audience.accounts')}</p>
			</section>
			{#if import.meta.env.MODE !== 'public-guest'}<MeasurementChoice />{/if}
			<a class="back end-link" href={resolve('/')}>{t('account.backToPlay')}</a>
		</article>
	</main>
	<SiteFooter />
</div>

<style>
	.policy-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: calc(20px + var(--safe-top)) calc(32px + var(--safe-right)) 20px
			calc(32px + var(--safe-left));
	}
	.wordmark {
		font-size: 28px;
		font-weight: 900;
		letter-spacing: -0.05em;
		text-decoration: none;
		color: var(--ink);
	}
	.back {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-size: var(--text-15);
		font-weight: 800;
	}
	main {
		flex: 1;
		width: min(720px, 100%);
		margin: 0 auto;
		padding: 32px 28px 48px;
	}
	h1 {
		font-size: clamp(36px, 6vw, 56px);
		font-weight: 900;
		line-height: 1.08;
		letter-spacing: -0.04em;
	}
	h2 {
		font-size: var(--text-28);
		line-height: 1.2;
		font-weight: 900;
		letter-spacing: -0.025em;
		margin: 0 0 12px;
	}
	.review-date {
		color: var(--muted);
		font-size: var(--text-13);
		margin-top: 12px;
	}
	section {
		margin-top: 36px;
	}
	section p + p {
		margin-top: 14px;
	}
	p,
	li {
		line-height: 1.7;
		overflow-wrap: anywhere;
	}
	section p {
		color: var(--ink-2);
	}
	a {
		color: var(--ink-2);
		text-underline-offset: 4px;
		overflow-wrap: anywhere;
	}
	a:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
	.provider-links {
		list-style: none;
		padding: 0;
		margin: 12px 0 0;
	}
	.provider-links a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
	.end-link {
		margin-top: 36px;
	}
	@media (max-width: 600px) {
		header {
			padding: calc(12px + var(--safe-top)) calc(20px + var(--safe-right)) 12px
				calc(20px + var(--safe-left));
		}
		main {
			padding: 24px 20px 36px;
		}
		h2 {
			font-size: 24px;
		}
	}
</style>
