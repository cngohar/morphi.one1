<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';
	import { motion } from '#lib/ui/motion.js';
	let {
		family,
		title,
		summary,
		score,
		best,
		previousBest,
		isNewBest,
		isSoClose,
		gap,
		signedIn,
		accountsEnabled = true,
		starting = false,
		syncStatus = '',
		savedScore = null,
		stats,
		onnext,
		onhome
	}: {
		family: 'memory' | 'block';
		title: string;
		summary: string;
		score: number;
		best: number;
		previousBest: number;
		isNewBest: boolean;
		isSoClose: boolean;
		gap: number;
		signedIn: boolean;
		accountsEnabled?: boolean;
		starting?: boolean;
		syncStatus?: string;
		savedScore?: number | null;
		stats: { label: string; value: string }[];
		onnext: () => void;
		onhome: () => void;
	} = $props();
	let main: HTMLElement;
	onMount(() => motion.arrive(main));
</script>

<div class="result-page result">
	<SiteHeader {onhome} />
	<main class="result-main" bind:this={main}>
		<p class="eyebrow">{title} · {t(family === 'memory' ? 'v1.game.memory' : 'v1.game.block')}</p>
		<h1>{t('v1.result.title')}</h1>
		<section class="result-score" aria-label={t('result.score')}>
			<p class="eyebrow">{t(isNewBest ? 'result.newBest' : 'result.score')}</p>
			<div class="result-number score">{formatNumber(score)}</div>
			<p class="result-high">{t('v1.game.best')} <strong>{formatNumber(best)}</strong></p>
			{#if isNewBest && previousBest > 0}<p class="muted">
					{t('result.previousBest', { score: formatNumber(previousBest) })}
				</p>{:else if isSoClose}<p class="muted">
					{t('result.soClose', { points: formatNumber(gap) })}
				</p>{/if}
		</section>
		<dl class="result-stats" aria-label={summary}>
			{#each stats as stat (stat.label)}<div>
					<dt>{stat.label}</dt>
					<dd>{stat.value}</dd>
				</div>{/each}
		</dl>
		<div class="result-next">
			<button class="btn primary next" onclick={onnext} disabled={starting} aria-busy={starting}
				>{t(starting ? 'round.starting' : 'result.next')}</button
			>
			<p>{t('v1.result.mystery')}</p>
		</div>
		{#if accountsEnabled}<section class="result-save account-prompt">
				<div>
					<h2>{t(signedIn ? 'account.profile.label' : 'v1.result.save')}</h2>
					{#if !signedIn}<p>{t('v1.result.saveBody')}</p>{/if}
					<p class="device-note local-status" aria-live="polite">
						{syncStatus
							? t(syncStatus as MessageKey, {
									score: savedScore === null ? '' : formatNumber(savedScore)
								})
							: t('v1.result.local')}
					</p>
				</div>
				{#if accountsEnabled}<a
						class="google-ink account-link"
						href={resolve(signedIn ? '/account' : '/account/sign-in')}
						>{#if !signedIn}<span aria-hidden="true">G</span>{/if}{t(
							signedIn ? 'account.profile.label' : 'v1.result.google'
						)}</a
					>{/if}
			</section>{:else}<p class="guest-note">{t('result.localBest')}</p>{/if}
	</main>
	<SiteFooter />
</div>

<style>
	.guest-note {
		order: 4;
		margin-top: 18px;
		color: var(--muted);
		font-size: 13px;
	}
	.result-page {
		display: flex;
		flex-direction: column;
	}
	.eyebrow {
		text-transform: uppercase;
	}
	.google-ink {
		text-decoration: none;
	}
	.muted {
		color: var(--muted);
		font-size: 13px;
		margin-top: 6px;
	}
</style>
