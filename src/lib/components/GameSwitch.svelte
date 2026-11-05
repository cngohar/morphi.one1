<script lang="ts">
	import { tick } from 'svelte';
	import AccountForm from './account/AccountForm.svelte';
	import { t } from '#lib/i18n/messages.js';
	import { dismissOnBackdrop } from '#lib/ui/dismiss-dialog.js';
	import type { PuzzleId } from '#lib/engine/contract.js';
	let { family, enabled, allowed }: { family: PuzzleId; enabled: boolean; allowed: boolean } =
		$props();
	let dialog: HTMLDialogElement;
	let toggle: HTMLButtonElement;
	let reason = $state('');
	let confirmed = $state(false);
	let pending = $state(false);
	let failed = $state(false);
	let returnFocus = $state(false);
	$effect(() => {
		if (returnFocus && !pending) {
			returnFocus = false;
			void focusSwitch();
		}
	});
	async function focusSwitch() {
		try {
			await tick();
			if (toggle?.isConnected && !dialog?.open) toggle.focus();
		} catch {
			console.error('morphi:game_switch_focus_failed');
		}
	}
	const validReason = $derived(
		reason.trim().length >= 3 && reason.length <= 240 && !/[\r\n@]/.test(reason)
	);
	function open() {
		try {
			reason = '';
			confirmed = false;
			failed = false;
			dialog.showModal();
		} catch {
			console.error('morphi:game_switch_dialog_failed');
			failed = true;
		}
	}
	function close() {
		dialog.close();
	}
	function trapTab(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;
		try {
			const controls = [
				...dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
					'input:not([type="hidden"]):enabled, button:enabled'
				)
			].filter(
				(control) =>
					control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden'
			);
			const first = controls[0],
				last = controls.at(-1);
			if (!first || !last) {
				event.preventDefault();
				return;
			}
			if (document.activeElement === (event.shiftKey ? first : last)) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			}
		} catch {
			event.preventDefault();
			console.error('morphi:game_switch_focus_failed');
			failed = true;
		}
	}
</script>

<div class="game-switch">
	<button
		bind:this={toggle}
		type="button"
		role="switch"
		aria-checked={enabled}
		aria-label={t(enabled ? 'admin.games.enabledSwitch' : 'admin.games.disabledSwitch')}
		disabled={!allowed || pending}
		onclick={open}>{t(enabled ? 'admin.games.on' : 'admin.games.off')}</button
	>
	{#if failed}<p role="alert">{t('v1.admin.error')}</p>{/if}
</div>
<dialog
	bind:this={dialog}
	aria-labelledby="game-switch-title"
	use:dismissOnBackdrop={close}
	onkeydown={trapTab}
	onclose={() => {
		returnFocus = true;
	}}
>
	<h2 id="game-switch-title">{t(enabled ? 'v1.admin.games.disable' : 'v1.admin.games.enable')}</h2>
	<AccountForm
		bind:pending
		oncomplete={(success) => {
			if (success) close();
		}}
	>
		{#snippet children(submitting)}
			<input type="hidden" name="target" value={family} />
			<input type="hidden" name="action" value={enabled ? 'game-disable' : 'game-enable'} />
			{#if enabled}<label
					>{t('v1.operator.reason')}<input
						name="reason"
						required
						minlength="3"
						maxlength="240"
						pattern="[^@\r\n]*"
						bind:value={reason}
					/></label
				>{/if}
			<label
				><input type="checkbox" name="confirm" value="yes" required bind:checked={confirmed} />{t(
					'admin.variants.confirm'
				)}</label
			>
			<div class="actions">
				<button type="button" disabled={submitting} onclick={close}>{t('v1.dialog.cancel')}</button>
				<button disabled={submitting || !confirmed || (enabled && !validReason)}
					>{t(enabled ? 'v1.admin.games.disable' : 'v1.admin.games.enable')}</button
				>
			</div>
		{/snippet}
	</AccountForm>
</dialog>

<style>
	button {
		min-height: 44px;
		padding: 10px 18px;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}
	button[aria-checked='true'] {
		background: var(--primary);
		color: var(--surface);
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
	}
	dialog {
		width: min(420px, calc(100vw - 32px));
		max-height: calc(100dvh - 32px);
		padding: 24px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--ink);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 35%);
	}
	dialog :global(form) {
		display: grid;
		gap: 16px;
	}
	label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	input[name='reason'] {
		width: 100%;
		min-height: 44px;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}
</style>
