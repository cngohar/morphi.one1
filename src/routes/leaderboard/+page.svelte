<script lang="ts">
	import { familyName } from '#lib/ui/puzzle-presentation.js';
	import { resolve } from '$app/paths';
	import AccountShell from '#lib/components/account/AccountShell.svelte';
	import { t } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const boardQuery = (date: string, limit = data.limit) =>
		new URLSearchParams({ family: data.family, date, limit: String(limit) }).toString();
	const stamp = (time: number) =>
		new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'UTC'
		}).format(time);
</script>

<svelte:head><title>{t('leaderboard.pageTitle')}</title></svelte:head>
<AccountShell>
	<main class="account-main">
		<p class="account-eyebrow">{t('daily.boardDescription')}</p>
		<h1 class="account-title">
			{data.date === data.today
				? t('daily.today', { family: familyName(data.family) })
				: familyName(data.family)}
		</h1>
		<p>{data.date} · UTC</p>
		{#if data.streak && data.streak.current > 0}<p>
				{t('daily.streak', { count: data.streak.current })}
			</p>{/if}
		<form method="GET" action={resolve('/leaderboard')}>
			<label for="board-family">{t('daily.family')}</label>
			<select id="board-family" name="family" value={data.family}>
				{#each data.families as family (family)}<option value={family}>{familyName(family)}</option
					>{/each}
			</select>
			<label for="board-date">{t('daily.date')}</label>
			<input id="board-date" name="date" type="date" value={data.date} max={data.today} required />
			<input type="hidden" name="limit" value={data.limit} />
			<button type="submit" class="account-button">{t('leaderboard.show')}</button>
		</form>
		{#if data.unavailable}<p class="account-notice" role="alert">{t('leaderboard.error')}</p>
		{:else}
			{#if data.updatedAt}<p class="snapshot-time">
					{t('daily.updated', { time: stamp(data.updatedAt) })}{#if data.frozen}
						· {t('daily.frozen')}{/if}
				</p>{/if}
			{#if !data.rows.length}<p class="account-empty">{t('leaderboard.empty')}</p>
			{:else}<table>
					<thead
						><tr
							><th scope="col">{t('leaderboard.rank')}</th><th scope="col"
								>{t('leaderboard.player')}</th
							><th scope="col">{t('leaderboard.score')}</th></tr
						></thead
					>
					<tbody
						>{#each data.rows as row (row.position)}<tr class:own={row.own}
								><td>{row.position}</td><td>{row.name}</td><td>{formatNumber(row.score)}</td></tr
							>{/each}</tbody
					>
				</table>{/if}
			<a
				class="account-link board-toggle"
				href={resolve(`/leaderboard?${boardQuery(data.date, data.limit === 25 ? 100 : 25)}`)}
				>{t(data.limit === 25 ? 'daily.top100' : 'daily.top25')}</a
			>
		{/if}
		{#if data.account.signedIn}<p class="account-notice" data-own-rank>
				{data.own
					? t('leaderboard.own', { rank: data.own.position, score: formatNumber(data.own.score) })
					: t('leaderboard.noPosition')}
				{#if data.own?.percentile}<strong class="percentile"
						>{t('daily.percentile', { percent: data.own.percentile })}</strong
					>{/if}
			</p>{/if}
		<details class="archive">
			<summary>{t('daily.archive')}</summary>
			{#each Object.entries(data.months) as [month, dates] (month)}
				<p>{month}</p>
				<nav aria-label={month}>
					{#each dates ?? [] as date (date)}<a
							class="account-link"
							href={resolve(`/leaderboard?${boardQuery(date)}`)}>{date}</a
						>{/each}
				</nav>
			{/each}
		</details>
		<nav><a class="account-link" href={resolve('/account')}>{t('account.profile.label')}</a></nav>
	</main>
</AccountShell>

<style>
	form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin: 24px 0;
	}
	select,
	input[type='date'] {
		min-height: 44px;
		min-width: 0;
		max-width: 100%;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: 14px 8px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		overflow-wrap: anywhere;
	}
	th:first-child,
	td:first-child {
		width: 55px;
	}
	th:last-child,
	td:last-child {
		width: 100px;
		text-align: right;
	}
	.own {
		background: var(--surface);
		font-weight: 800;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	nav a,
	.board-toggle,
	summary {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
	.archive {
		margin: 20px 0;
	}
	.archive summary {
		cursor: pointer;
	}
	.percentile {
		display: block;
	}
	.snapshot-time {
		color: var(--muted);
	}
</style>
