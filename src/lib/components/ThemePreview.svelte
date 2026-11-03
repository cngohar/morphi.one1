<script lang="ts">
	import { onMount } from 'svelte';
	import { workerTheme } from '#lib/ui/solo-theme.js';
	import { themeProfile } from '#lib/engine/theme/config.js';
	import type { ThemeConfig } from '#lib/engine/theme/config.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle } from '#lib/engine/theme/style.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	let { config }: { config: ThemeConfig } = $props();
	let themes = $state<ResolvedTheme[]>([]);
	let failed = $state(false);
	const families = ['memory', 'block', 'connect'];
	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				for (const family of families) {
					const seeds = Array.from(
						{ length: themeProfile(config, family).freshness.candidates },
						(_, i) => String(42 + i)
					);
					const theme = await workerTheme(family, [], seeds, controller.signal, config);
					if (controller.signal.aborted) return;
					themes = [...themes, theme];
				}
			} catch {
				if (!controller.signal.aborted) failed = true;
			}
		})();
		return () => controller.abort();
	});
</script>

<div
	class="theme-preview"
	data-theme-version={config.version}
	data-ready={themes.length === families.length}
	style={Object.entries(config.siteTokens)
		.map(([key, value]) => `${key}:${value}`)
		.join(';')}
>
	<h1>{t('themes.preview')}</h1>
	<p>{t('themes.previewNote')}</p>
	{#if failed}<p role="alert">{t('themes.failed')}</p>{/if}
	{#each themes as theme (theme.family)}
		<section
			class="preview-family"
			data-family={theme.family}
			style={`background:${theme.background};${themeStyle(theme)}`}
		>
			<h2>{t(`v1.game.${theme.family}` as MessageKey)}</h2>
			<div class="preview-items">
				{#each theme.symbols as symbol, i (symbol.path)}
					<div
						class="preview-item"
						style={`background:${theme.face};border-color:${theme.edge};color:${theme.colors[i % theme.colors.length]}`}
					>
						<svg viewBox="0 0 48 48" aria-hidden="true"
							><path
								d={symbol.path}
								fill={theme.style.fill === 'solid' ? 'currentColor' : 'none'}
								stroke="currentColor"
								stroke-width="3"
								fill-rule="evenodd"
							/></svg
						>
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.theme-preview {
		min-height: 100svh;
		padding: 20px;
		background: var(--bg);
		color: var(--ink);
	}
	h1 {
		margin: 0 0 12px;
	}
	.preview-family {
		padding: 16px;
		margin: 16px 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-12, 12px);
	}
	h2 {
		font-size: 16px;
		margin: 0 0 12px;
	}
	.preview-items {
		display: flex;
		flex-wrap: wrap;
		gap: var(--theme-gap);
	}
	.preview-item {
		width: 48px;
		aspect-ratio: var(--theme-aspect);
		border: var(--theme-border) solid;
		border-radius: var(--memory-radius);
		clip-path: var(--theme-clip);
		display: grid;
		place-items: center;
	}
	svg {
		width: 32px;
		height: 32px;
	}
</style>
