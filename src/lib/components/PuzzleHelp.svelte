<script lang="ts">
	import { dismissOnBackdrop } from '#lib/ui/dismiss-dialog.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { familyName, scoreGuideValue } from '#lib/ui/puzzle-presentation.js';
	import PuzzleGuide from '#lib/components/PuzzleGuide.svelte';
	import { motion } from '#lib/ui/motion.js';
	let {
		family,
		variant,
		help,
		ruleLine = '',
		scoring,
		onpause = () => {}
	}: {
		variant?: string;
		help?: import('#lib/engine/contract.js').PuzzlePresentation['help'];
		ruleLine?: string;
		scoring?: import('#lib/engine/scoring.js').ScoreValues;
		family: import('#lib/engine/contract.js').PuzzleId;
		onpause?: (paused: boolean) => void;
	} = $props();
	let dialog: HTMLDialogElement, anchor: HTMLElement;
	let kind = $state<'how' | 'scoring'>('how');
	function open(event: MouseEvent, section: 'how' | 'scoring') {
		try {
			kind = section;
			anchor = event.currentTarget as HTMLElement;
			dialog.showModal();
			onpause(true);
			motion.dialog(dialog, anchor);
		} catch {
			console.error('morphi:help_open_failed');
			onpause(false);
		}
	}
	function close() {
		try {
			motion.dialogExit(dialog, anchor);
			dialog.close();
			onpause(false);
			anchor?.focus();
		} catch {
			console.error('morphi:help_close_failed');
			onpause(false);
		}
	}
</script>

<div class="help-controls">
	<button class="btn" onclick={(event) => open(event, 'how')}>{t('v1.game.how')}</button><button
		class="btn"
		onclick={(event) => open(event, 'scoring')}>{t('v1.game.helpScoring')}</button
	>
</div>
<dialog
	use:dismissOnBackdrop={close}
	class="help-dialog"
	bind:this={dialog}
	oncancel={(event) => {
		event.preventDefault();
		close();
	}}
	onclose={() => onpause(false)}
	aria-labelledby="help-title"
>
	<header>
		<p>{familyName(family)}</p>
		<h2 id="help-title">{t(kind === 'how' ? 'v1.game.how' : 'v1.game.helpScoring')}</h2>
	</header>
	{#if ruleLine}<p class="round-rule">{ruleLine}</p>{/if}
	{#if help}
		{#if kind === 'how'}
			<ol>
				{#each help.steps as step (step)}<li>{t(step as MessageKey)}</li>{/each}
			</ol>
		{:else}
			<dl>
				{#each help.rows as row (row.label)}<dt>{t(row.label as MessageKey)}</dt>
					<dd>{scoreGuideValue(row, scoring ?? {})}</dd>{/each}
			</dl>
			<p>{t(help.note as MessageKey)}</p>
			<p>{t(help.tips as MessageKey)}</p>
		{/if}
	{:else}<PuzzleGuide
			{family}
			{variant}
			{scoring}
			section={kind === 'scoring' ? 'scoring-tips' : kind}
		/>{/if}<button class="btn" onclick={close}>{t('v1.game.back')}</button>
</dialog>
