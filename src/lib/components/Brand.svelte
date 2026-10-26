<script lang="ts">
	import { t } from '#lib/i18n/messages.js';
	const word = t('home.title');
	const dot = word.indexOf('.');
</script>

{word.slice(0, dot)}<span class="dot">{word.slice(dot, dot + 1)}</span>{word.slice(dot + 1)}

<style>
	.dot {
		color: var(--primary);
	}
</style>
