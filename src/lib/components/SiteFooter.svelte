<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/messages.js';
</script>

<footer class="site-footer" data-safe>
	<a href={resolve('/privacy')}>{t('v1.nav.privacy')}</a><span aria-hidden="true">·</span><a
		href={resolve('/terms')}>{t('v1.nav.terms')}</a
	>
</footer>

<style>
	.site-footer {
		display: flex;
		justify-content: center;
		padding: 4px 20px calc(8px + var(--safe-bottom));
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--muted);
		font-size: var(--text-13);
		text-underline-offset: 4px;
	}
	a:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
</style>
