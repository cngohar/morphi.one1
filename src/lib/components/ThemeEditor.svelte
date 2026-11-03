<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import AccountForm from './account/AccountForm.svelte';
	import { t } from '#lib/i18n/messages.js';
	import type { ThemeConfig } from '#lib/engine/theme/config.js';
	let {
		config
	}: {
		config: {
			live: { liveVersion: string; version: string; values: ThemeConfig };
			drafts: { id: string; baseVersion: string; createdAt: number }[];
			versions: { version: string; createdAt: number | null }[];
		};
	} = $props();
	let values = $state(untrack(() => JSON.stringify(config.live.values, null, 2)));
</script>

<section class="theme-editor">
	<h2>{t('v1.admin.nav.themes')}</h2>
	<p>{t('scoring.version')} <code>{config.live.version}</code></p>
	{#if config.live.liveVersion !== config.live.version}<p role="status">
			{t('scoring.liveInvalid')}
		</p>{/if}
	<AccountForm
		>{#snippet children(pending)}
			<input type="hidden" name="target" value="theme" /><input
				type="hidden"
				name="expected"
				value={config.live.liveVersion}
			/>
			<label
				>{t('themes.values')}<textarea name="values" rows="18" required bind:value={values}
				></textarea></label
			>
			{@render reason()}
			<button class="btn" name="action" value="theme-draft" disabled={pending}
				>{t('themes.saveDraft')}</button
			>
		{/snippet}</AccountForm
	>
</section>
{#each config.drafts as draft (draft.id)}
	<section class="theme-editor">
		<h3>{t('themes.draft')} <code>{draft.id}</code></h3>
		<a href="{resolve('/admin/theme-preview')}?draft={draft.id}" target="_blank" rel="noopener"
			>{t('themes.preview')}</a
		>
		<AccountForm
			>{#snippet children(pending)}
				<input type="hidden" name="target" value={draft.id} /><input
					type="hidden"
					name="expected"
					value={config.live.liveVersion}
				/>
				{@render reason()}
				<button class="btn" name="action" value="theme-check" disabled={pending}
					>{t('themes.check')}</button
				>
				<button
					class="btn"
					name="action"
					value="theme-publish"
					disabled={pending || draft.baseVersion !== config.live.liveVersion}
					>{t('themes.publish')}</button
				>
			{/snippet}</AccountForm
		>
	</section>
{/each}
<section class="theme-editor">
	<h3>{t('scoring.rollback')}</h3>
	<AccountForm
		>{#snippet children(pending)}
			<input type="hidden" name="target" value="theme" /><input
				type="hidden"
				name="expected"
				value={config.live.liveVersion}
			/>
			<label
				>{t('scoring.rollbackVersion')}<select name="sourceVersion"
					>{#each config.versions as version (version.version)}<option value={version.version}
							>{version.version}</option
						>{/each}</select
				></label
			>
			{@render reason()}
			<button class="btn" name="action" value="theme-rollback" disabled={pending}
				>{t('scoring.rollback')}</button
			>
		{/snippet}</AccountForm
	>
</section>
{#snippet reason()}
	<label
		>{t('v1.operator.reason')}<input name="reason" minlength="3" maxlength="240" required /></label
	>
	<label class="confirmation"
		><input type="checkbox" name="confirm" value="yes" required />{t('v1.operator.confirm')}</label
	>
{/snippet}

<style>
	.theme-editor {
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: var(--radius-12, 12px);
		background: var(--surface);
		margin-bottom: 20px;
		min-width: 0;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 16px 0;
	}
	input:not([type='checkbox']),
	select,
	textarea {
		width: 100%;
		min-width: 0;
		padding: 10px;
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--border);
	}
	textarea {
		font: 12px monospace;
	}
	.confirmation {
		flex-direction: row;
		align-items: center;
	}
	code {
		overflow-wrap: anywhere;
	}
</style>
