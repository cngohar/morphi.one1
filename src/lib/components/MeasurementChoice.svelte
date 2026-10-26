<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/messages.js';
	import { measurementAllowed, setMeasurement } from '#lib/ui/measurement.js';
	let enabled = $state(false),
		pending = $state(false),
		failed = $state(false);
	onMount(() => {
		enabled = measurementAllowed();
	});
	async function change(event: Event) {
		if (pending) return;
		enabled = (event.currentTarget as HTMLInputElement).checked;
		pending = true;
		try {
			failed = !(await setMeasurement(enabled));
		} catch {
			failed = true;
		} finally {
			pending = false;
		}
	}
</script>

<section class="measurement-choice">
	<h2>{t('v1.measurement.title')}</h2>
	<p>{t('v1.measurement.body')}</p>
	<label
		><input type="checkbox" checked={enabled} disabled={pending} onchange={change} />{t(
			'v1.measurement.enable'
		)}</label
	>{#if failed}<p role="status">{t('v1.measurement.failed')}</p>{/if}
</section>

<style>
	.measurement-choice {
		margin: 30px 0;
		padding-top: 24px;
		border-top: 1px solid var(--border);
	}
	h2 {
		font-size: 24px;
		margin: 0 0 14px;
	}
	p {
		font-size: 14px;
		color: var(--muted);
		line-height: 1.7;
	}
	label {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
		margin: 18px 0;
	}
</style>
