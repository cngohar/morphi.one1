<script lang="ts">
	import { dismissOnBackdrop } from '#lib/ui/dismiss-dialog.js';
	import { t } from '#lib/i18n/messages.js';
	import PuzzleGuide from '#lib/components/PuzzleGuide.svelte';
	import { motion } from '#lib/ui/motion.js';
	let {
		family,
		scoring,
		onpause = () => {}
	}: {
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
		<h2 id="help-title">{t(kind === 'how' ? 'v1.game.how' : 'v1.game.helpScoring')}</h2>
	</header>
	<PuzzleGuide {family} {scoring} section={kind === 'scoring' ? 'scoring-tips' : kind} /><button
		class="btn"
		onclick={close}>{t('v1.game.back')}</button
	>
</dialog>
