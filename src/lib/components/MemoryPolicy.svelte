<script lang="ts">
	import { tick } from 'svelte';
	import { can } from '#lib/operator-permissions.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import AccountForm from './account/AccountForm.svelte';
	import type { PageData } from '../../routes/admin/[view]/$types';

	let {
		policy,
		role,
		familyEnabled
	}: {
		policy: NonNullable<PageData['memoryPolicy']>;
		role: string;
		familyEnabled: boolean;
	} = $props();
	let draft = $derived<Record<string, boolean>>({ ...policy.values });
	let dialog = $state<HTMLDialogElement>();
	let trigger = $state<HTMLButtonElement>();
	let reason = $state('');
	let acknowledged = $state(false);
	let failed = $state(false);
	const editable = $derived(can(role, 'games'));
	const rows = $derived(
		policy.variants.map((variant) => {
			const change = 'change' in variant ? variant.change : undefined;
			const keys = policy.dimensions.map(
				(dimension) =>
					`${dimension.key}:${change?.[0] === dimension.key ? change[1] : dimension.values[0].id}`
			);
			return {
				id: variant.id,
				archetype: variant.archetype,
				enabled: policy.lifecycle.find((row) => row.id === variant.id)?.state !== 'disabled',
				blocked: keys.filter((key) => !draft[key]),
				previous: keys.filter((key) => !policy.values[key])
			};
		})
	);
	const remaining = $derived(rows.filter((row) => row.enabled && row.blocked.length === 0).length);
	const valid = $derived(!familyEnabled || remaining > 0);
	const changed = $derived(Object.keys(draft).some((key) => draft[key] !== policy.values[key]));
	const newlyDisabled = $derived(
		rows.filter((row) => row.enabled && !row.previous.length && row.blocked.length)
	);
	const newlyEnabled = $derived(
		rows.filter((row) => row.enabled && row.previous.length && !row.blocked.length)
	);
	const reasonValid = $derived(
		reason.trim().length >= 3 && reason.length <= 240 && !/[\r\n@]/.test(reason)
	);

	function explain(key: string) {
		const [name, id] = key.split(':');
		const dimension = policy.dimensions.find((item) => item.key === name);
		return dimension
			? `${t(dimension.label as MessageKey)} = ${t(dimension.values.find((item) => item.id === id)!.label as MessageKey)}`
			: key;
	}
	async function open(event: MouseEvent) {
		try {
			trigger = event.currentTarget as HTMLButtonElement;
			reason = '';
			acknowledged = false;
			failed = false;
			await tick();
			dialog?.showModal();
			dialog?.querySelector('textarea')?.focus();
		} catch {
			console.error('morphi:policy_dialog_failed');
			failed = true;
		}
	}
</script>

<div class="policy-layout">
	<div>
		<h2>{t('policy.controls')}</h2>
		<p>{t('policy.intro')}</p>
		<p class:invalid={!valid} role="status" aria-live="polite">
			{valid ? t('policy.active', { count: remaining }) : t('policy.empty')}
		</p>
		<div class="policy-controls">
			{#each policy.dimensions as dimension (dimension.key)}
				<fieldset disabled={!editable}>
					<legend>{t(dimension.label as MessageKey)}</legend>
					{#each dimension.values as value (value.id)}
						{@const key = `${dimension.key}:${value.id}`}
						<label
							><input
								type="checkbox"
								checked={draft[key]}
								onchange={(event) => {
									draft = { ...draft, [key]: event.currentTarget.checked };
									failed = false;
								}}
							/>{t(value.label as MessageKey)}</label
						>
					{/each}
				</fieldset>
			{/each}
		</div>
		{#if editable}<button
				type="button"
				class="btn primary"
				bind:this={trigger}
				disabled={!valid || !changed}
				onclick={open}>{t('policy.review')}</button
			>{/if}
		{#if failed}<p role="alert">{t('policy.error')}</p>{/if}
		<h3>{t('policy.groups')}</h3>
		<p>{t('policy.groupHint')}</p>
		<ul class="policy-list">
			{#each policy.archetypes as archetype (archetype.id)}
				{@const group = rows.filter((row) => row.archetype === archetype.id)}
				{@const active = group.filter((row) => row.enabled && !row.blocked.length).length}
				<li>
					<span>{t(archetype.label as MessageKey)}</span><span
						>{t(
							active === group.length
								? 'policy.groupActive'
								: active
									? 'policy.groupPartial'
									: 'policy.groupDisabled'
						)} · {active}/{group.length}</span
					>
				</li>
			{/each}
		</ul>
	</div>
	<div>
		<h2>{t('policy.affected')}</h2>
		<ul class="policy-list variants">
			{#each rows as row (row.id)}
				<li>
					<div>
						<strong>{row.id}</strong><small
							>{!row.enabled
								? t('policy.lifecycle')
								: row.blocked.length
									? t('policy.blocked', { values: row.blocked.map(explain).join('; ') })
									: t('policy.available')}</small
						>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</div>

<dialog bind:this={dialog} aria-labelledby="policy-dialog-title" onclose={() => trigger?.focus()}>
	<h2 id="policy-dialog-title">{t('policy.review')}</h2>
	{#if failed}<p role="alert">{t('policy.error')}</p>{/if}
	<h3>{t('policy.disabled')}</h3>
	<ul>
		{#each newlyDisabled as row (row.id)}<li>{row.id}</li>{:else}<li>{t('policy.none')}</li>{/each}
	</ul>
	<h3>{t('policy.enabled')}</h3>
	<ul>
		{#each newlyEnabled as row (row.id)}<li>{row.id}</li>{:else}<li>{t('policy.none')}</li>{/each}
	</ul>
	<AccountForm
		oncomplete={(success) => {
			if (success) dialog?.close();
			else failed = true;
		}}
	>
		{#snippet children(pending)}
			<input type="hidden" name="action" value="dimension-policy-update" />
			<input type="hidden" name="target" value="memory" />
			<input type="hidden" name="expected" value={policy.version} />
			<input type="hidden" name="values" value={JSON.stringify(draft)} />
			<label
				>{t('policy.reason')}<textarea
					name="reason"
					bind:value={reason}
					required
					minlength="3"
					maxlength="240"></textarea></label
			>
			<label class="confirm"
				><input
					type="checkbox"
					name="confirm"
					value="yes"
					bind:checked={acknowledged}
					required
				/>{t('policy.ack')}</label
			>
			<div class="policy-actions">
				<button type="button" class="btn" onclick={() => dialog?.close()}
					>{t('policy.cancel')}</button
				><button class="btn primary" disabled={pending || !reasonValid || !acknowledged || !valid}
					>{t('policy.save')}</button
				>
			</div>
		{/snippet}
	</AccountForm>
</dialog>

<style>
	.policy-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(230px, 310px);
		gap: 22px;
	}
	.policy-layout > div {
		min-width: 0;
	}
	.policy-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin: 16px 0;
	}
	fieldset {
		min-width: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	legend {
		font-weight: 900;
	}
	fieldset label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
	}
	fieldset input {
		width: 18px;
		height: 18px;
	}
	.policy-list {
		list-style: none;
		padding: 0;
	}
	.policy-list li {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		border-top: 1px solid var(--border);
		padding: 9px 0;
	}
	.policy-list li span:last-child,
	small {
		color: var(--muted);
	}
	small {
		display: block;
		overflow-wrap: anywhere;
	}
	.invalid {
		color: var(--danger);
	}
	dialog {
		width: min(500px, calc(100% - 24px));
		max-height: calc(100dvh - 24px);
		overflow: auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 20px;
		background: var(--surface);
		color: var(--ink);
	}
	dialog::backdrop {
		background: rgb(27 36 51 / 50%);
	}
	dialog textarea {
		display: block;
		width: 100%;
		min-height: 68px;
	}
	.policy-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
	}
	@media (max-width: 1000px) {
		.policy-layout {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 550px) {
		.policy-controls {
			grid-template-columns: 1fr;
		}
	}
</style>
