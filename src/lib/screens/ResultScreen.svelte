<script lang="ts">
	import { familyName } from '#lib/ui/puzzle-presentation.js';
	import { resolve } from '$app/paths';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';
	let {
		family,
		ruleLine = '',
		streak = 0,
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
		onnext
	}: {
		ruleLine?: string;
		streak?: number;
		family: import('#lib/engine/contract.js').PuzzleId;
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
	} = $props();
</script>

<main class="result-main result">
	<section class="result-summary">
		<p class="eyebrow">
			{familyName(family)}
		</p>
		{#if ruleLine}<p class="round-rule">{ruleLine}</p>{/if}
		{#if streak > 0}<p>{t('daily.streak', { count: streak })}</p>{/if}
		<h1>{t('v1.result.title')}</h1>
		<section class="result-score" aria-label={t('result.score')}>
			<p class="eyebrow">{t('result.score')}</p>
			<div class="result-number score">{formatNumber(score)}</div>
			<p class="result-high">{t('v1.game.best')} <strong>{formatNumber(best)}</strong></p>
			{#if isNewBest}<p class="muted">{t('result.newBest')}</p>{:else if isSoClose}<p class="muted">
					{t('result.soClose', { points: formatNumber(gap) })}
				</p>{/if}
			{#if isNewBest && previousBest > 0}<p class="muted">
					{t('result.previousBest', { score: formatNumber(previousBest) })}
				</p>{/if}
		</section>
	</section>
	<dl class="result-stats" aria-label={summary}>
		{#each stats as stat (stat.label)}<div>
				<dt>{stat.label}</dt>
				<dd>{stat.value}</dd>
			</div>{/each}
	</dl>
	<div class="result-next">
		<div class="waiting-card" aria-hidden="true"><i></i></div>
		<button class="btn primary next" onclick={onnext} disabled={starting} aria-busy={starting}
			>{t('result.next')}</button
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

<style>
	.round-rule {
		margin: 0 0 4px;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.3;
	}
	.guest-note {
		order: 4;
		margin-top: 18px;
		color: var(--muted);
		font-size: 13px;
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
	@media (max-width: 600px) and (orientation: portrait) {
		.result-main:has(.round-rule) {
			padding-top: 0;
		}
		.result-summary:has(.round-rule) h1 {
			margin-bottom: 4px;
		}
	}
</style>
