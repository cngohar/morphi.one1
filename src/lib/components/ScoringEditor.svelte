<script lang="ts">
	import { untrack } from 'svelte';
	import AccountForm from './account/AccountForm.svelte';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { SCORE_MAX, type ScoreConfig } from '#lib/engine/scoring.js';
	import { puzzleMetadata } from '#lib/puzzle-metadata.js';
	import type { PuzzleId } from '#lib/engine/contract.js';
	let {
		config
	}: {
		config: ScoreConfig & {
			family: PuzzleId;
			liveVersion: string;
			versions: { version: string; createdAt: number | null }[];
		};
	} = $props();
	let draft = $state(untrack(() => ({ ...config.values })));
</script>

<section class="scoring-card">
	<header class="scoring-heading">
		<div>
			<h2>{t(`v1.game.${config.family}` as MessageKey)}</h2>
			<p>{t('scoring.version')} <code>{config.version}</code></p>
			{#if config.liveVersion !== config.version}<p role="status">
					{t('scoring.liveInvalid')}
				</p>{/if}
		</div>
	</header>
	<AccountForm>
		{#snippet children(pending)}
			<input type="hidden" name="target" value={config.family} />
			<input type="hidden" name="expected" value={config.liveVersion} />
			<input type="hidden" name="values" value={JSON.stringify(draft)} />
			<div class="scoring-fields">
				{#each Object.keys(config.values) as field (field)}
					<label>
						<span>{t(`scoring.${config.family}.${field}` as MessageKey)}</span>
						<input
							type="number"
							min="0"
							max={SCORE_MAX}
							step="1"
							required
							bind:value={draft[field]}
						/>
					</label>
				{/each}
			</div>
			<div class="scoring-footer">
				<label class="reason-field">
					<span>{t('v1.operator.reason')}</span>
					<input name="reason" required minlength="3" maxlength="240" />
				</label>
				<div class="scoring-actions">
					<label class="confirmation">
						<input type="checkbox" name="confirm" value="yes" required />
						<span>{t('scoring.confirm')}</span>
					</label>
					<div class="buttons">
						<button class="save" name="action" value="score-change" disabled={pending}>
							{t('scoring.save')}
						</button>
						<button class="restore" name="action" value="score-defaults" disabled={pending}>
							{t('scoring.defaults')}
						</button>
					</div>
				</div>
			</div>
		{/snippet}
	</AccountForm>
	<AccountForm>
		{#snippet children(pending)}
			<input type="hidden" name="target" value={config.family} />
			<input type="hidden" name="expected" value={config.liveVersion} />
			<div class="rollback">
				<label>
					<span>{t('scoring.rollbackVersion')}</span>
					<select name="sourceVersion" required>
						{#each config.versions.filter((version) => version.version !== config.liveVersion || version.version === puzzleMetadata[config.family].scoring.version) as version (version.version)}
							<option value={version.version}
								>{version.version === puzzleMetadata[config.family].scoring.version
									? t('scoring.defaultVersion')
									: `${version.version} · ${new Date(version.createdAt!).toLocaleString()}`}</option
							>
						{/each}
					</select>
				</label>
				<label
					><span>{t('v1.operator.reason')}</span><input
						name="reason"
						required
						minlength="3"
						maxlength="240"
					/></label
				>
				<label class="confirmation"
					><input type="checkbox" name="confirm" value="yes" required /><span
						>{t('scoring.confirm')}</span
					></label
				>
				<div class="buttons">
					<button class="restore" name="action" value="score-rollback" disabled={pending}
						>{t('scoring.rollback')}</button
					>
				</div>
			</div>
		{/snippet}
	</AccountForm>
</section>

<style>
	.scoring-card {
		min-width: 0;
		margin-bottom: 20px;
		padding: 22px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
	}
	.scoring-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 20px;
	}
	.scoring-heading h2 {
		margin: 0 0 6px;
		color: var(--ink);
		font-size: 19px;
		line-height: 1.3;
	}
	.scoring-heading p {
		margin: 0;
		color: var(--muted);
		font-size: 12px;
	}
	.scoring-heading code {
		padding: 3px 7px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--surface-2);
		color: var(--ink-2);
		font-size: 11px;
	}
	:global(.scoring-card form) {
		display: grid;
		gap: 18px;
	}
	.scoring-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
		gap: 14px;
	}
	:global(.scoring-card label) {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		color: var(--ink-2);
		font-size: 12px;
		font-weight: 800;
	}
	:global(.scoring-card input[type='number']),
	:global(.scoring-card input[name='reason']),
	:global(.scoring-card select) {
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 15px;
	}
	.rollback {
		display: grid;
		gap: 14px;
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}
	:global(.scoring-card input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.scoring-footer {
		display: grid;
		grid-template-columns: minmax(220px, 1fr) minmax(280px, 1.2fr);
		align-items: end;
		gap: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}
	.scoring-actions {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}
	:global(.scoring-card label.confirmation) {
		flex-direction: row;
		align-items: center;
		gap: 9px;
		font-weight: 700;
	}
	:global(.scoring-card input[type='checkbox']) {
		width: 18px;
		height: 18px;
		margin: 0;
		accent-color: var(--primary);
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.buttons button {
		min-height: 42px;
		padding: 9px 14px;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink-2);
		font: inherit;
		font-size: 13px;
		font-weight: 800;
		cursor: pointer;
	}
	.buttons button.save {
		border-color: var(--primary);
		background: var(--primary);
		color: white;
	}
	.buttons button.restore {
		border-color: var(--border);
		background: var(--surface-2);
	}
	.buttons button:disabled {
		cursor: wait;
		opacity: 0.65;
	}
	.buttons button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
	}
	@media (max-width: 700px) {
		.scoring-card {
			padding: 16px;
		}
		.scoring-footer {
			grid-template-columns: 1fr;
			gap: 16px;
		}
	}
</style>
