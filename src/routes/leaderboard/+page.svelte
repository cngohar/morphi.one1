<script lang="ts">
	import { resolve } from '$app/paths';
	import AccountShell from '#lib/components/account/AccountShell.svelte';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const groups: [string, MessageKey][] = [
		['block-placement-1', 'leaderboard.block'],
		['memory-1:6', 'leaderboard.memory6'],
		['memory-1:8', 'leaderboard.memory8'],
		['memory-1:10', 'leaderboard.memory10']
	];
</script>

<svelte:head><title>{t('leaderboard.pageTitle')}</title></svelte:head>
<AccountShell>
	<main class="account-main">
		<p class="account-eyebrow">{t('leaderboard.description')}</p>
		<h1 class="account-title">{t('leaderboard.title')}</h1>
		<form method="GET" action={resolve('/leaderboard')}>
			<label for="board-group">{t('leaderboard.group')}</label>
			<select id="board-group" name="group" value={data.group}>
				{#each groups as [value, label] (value)}<option {value}>{t(label)}</option>{/each}
			</select>
			<button type="submit" class="account-button">{t('leaderboard.show')}</button>
		</form>
		{#if data.unavailable}<p class="account-notice" role="alert">{t('leaderboard.error')}</p>
		{:else if !data.rows.length}<p class="account-empty">{t('leaderboard.empty')}</p>
		{:else}
			<table>
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
			</table>
		{/if}
		{#if data.account.signedIn}<p class="account-notice">
				{data.own
					? t('leaderboard.own', { rank: data.own.position, score: formatNumber(data.own.score) })
					: t('leaderboard.noPosition')}
			</p>{/if}
		<nav aria-label={t('leaderboard.title')}>
			{#if data.offset > 0}<a
					class="account-link"
					href={resolve(`/leaderboard?group=${data.group}&offset=${data.offset - 25}`)}
					>{t('leaderboard.previous')}</a
				>{/if}
			{#if data.rows.length === 25 && data.offset < 9900}<a
					class="account-link"
					href={resolve(`/leaderboard?group=${data.group}&offset=${data.offset + 25}`)}
					>{t('leaderboard.next')}</a
				>{/if}
			<a class="account-link" href={resolve('/account')}>{t('account.profile.label')}</a>
		</nav>
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
	select {
		min-height: 44px;
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
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: 14px 8px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		overflow-wrap: anywhere;
	}
	th:last-child,
	td:last-child {
		text-align: right;
	}
	.own {
		background: var(--surface);
		font-weight: 800;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
	}
</style>
