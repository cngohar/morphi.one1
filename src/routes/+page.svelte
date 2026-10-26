<script lang="ts">
	import HomeScreen from '#lib/screens/HomeScreen.svelte';
	import { t } from '#lib/i18n/messages.js';
	import Seo from '#lib/components/Seo.svelte';
</script>

<Seo
	title={t('v1.home.titleTag')}
	description={t('v1.home.metaDescription')}
	ogTitle={t('v1.home.ogTitle')}
	ogDescription={t('v1.home.ogDescription')}
	path="/"
	image="home"
/>
<HomeScreen />
