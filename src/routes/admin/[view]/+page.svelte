<script lang="ts">
	import Brand from '#lib/components/Brand.svelte';
	import { resolve } from '$app/paths';
	import AccountForm from '#lib/components/account/AccountForm.svelte';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { can } from '#lib/operator-permissions.js';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const views = ['dashboard', 'status', 'moderation', 'queue', 'audit', 'privacy'];
	let ref = $state('');
	const key = (suffix: string) => `v1.admin.${suffix}` as MessageKey;
	const count = (name: string) => new Intl.NumberFormat('en').format(data.metrics[name] ?? 0);
	let selectedAction = $state('hide');
</script>

<svelte:head
	><title>{t(key(`nav.${data.view === 'privacy' ? 'operator' : data.view}`))} · Morphi.One</title
	><meta name="robots" content="noindex" /></svelte:head
>
<div class="operator-shell">
	<aside class="operator-sidebar">
		<a class="brand" href={resolve('/')}><Brand /></a>
		<p class="eyebrow">{t('v1.admin.workspace')}</p>
		<nav>
			{#each views.filter((view) => can(data.actor.role, view)) as view (view)}<a
					class:active={data.view === view}
					aria-current={data.view === view ? 'page' : undefined}
					href={resolve('/admin/[view]', { view })}
					>{t(key(`nav.${view === 'privacy' ? 'operator' : view}`))}</a
				>{/each}
		</nav>
		<div class="operator-person">
			<strong>{t('v1.admin.brand')}</strong>
			<p>{data.actor.role}</p>
			<AccountForm
				>{#snippet children(pending)}<input type="hidden" name="action" value="logout" /><button
						disabled={pending}>{t('v1.admin.logout')}</button
					>{/snippet}</AccountForm
			>
		</div>
	</aside>
	<div class="operator-body">
		<header>{t('v1.admin.brand')}<span>{new Date().toISOString().slice(0, 10)}</span></header>
		<main>
			{#if data.unavailable}<p class="notice" role="alert">{t('v1.admin.error')}</p>{/if}
			{#if form && 'code' in form}<p class="notice" role="alert">
					{t(form.code === 'operator_reauth' ? 'v1.admin.reauth' : 'v1.admin.error')}
					<a href={resolve('/admin/sign-in')}>{t('v1.admin.login.title')}</a>
				</p>{:else if form && 'success' in form}<p class="notice success" role="status">
					{t('v1.operator.saved')}
				</p>{/if}
			<div class="admin-heading">
				<p class="eyebrow">{t('v1.admin.workspace')}</p>
				<h1>{t(key(`${data.view === 'privacy' ? 'operator' : data.view}.title`))}</h1>
				<p>{t(key(`${data.view === 'privacy' ? 'operator' : data.view}.description`))}</p>
			</div>
			{#if data.view === 'dashboard'}
				<div class="metric-grid">
					{#each ['accounts', 'runs', 'completion', 'entries', 'starts', 'claims', 'hidden', 'bans', 'deletions'] as metric (metric)}<article
							class="metric"
						>
							<p>{t(key(`metric.${metric}`))}</p>
							<strong
								>{metric === 'completion'
									? data.metrics.starts
										? `${(((data.metrics.claims ?? 0) * 100) / data.metrics.starts).toFixed(1)}%`
										: '—'
									: count(metric)}</strong
							>
						</article>{/each}
				</div>
				<div class="dashboard-columns">
					<section class="admin-card">
						<h2>{t('v1.admin.dashboard.chart')}</h2>
						{#if data.daily.length}<div class="chart">
								{#each data.daily as day (day.day)}<div>
										<span>{day.total}</span><i
											style={`height:${Math.max(2, (100 * day.total) / Math.max(...data.daily.map((item) => item.total)))}px`}
										></i><small>{day.day.slice(5)}</small>
									</div>{/each}
							</div>{:else}<p>{t('v1.admin.empty')}</p>{/if}
					</section>
					<section class="admin-card">
						<h2>{t('v1.admin.dashboard.split')}</h2>
						{#each data.split as game (game.family)}<p class="summary-row">
								<span>{t(game.family === 'memory' ? 'v1.game.memory' : 'v1.game.block')}</span
								><strong>{game.total}</strong>
							</p>{/each}
						<p>
							<a href="https://dash.cloudflare.com" rel="external noreferrer"
								>{t('v1.admin.dashboard.traffic')}</a
							>
						</p>
					</section>
				</div>
				<section class="admin-card">
					<h2>{t('v1.admin.dashboard.funnel')}</h2>
					<p>{t('v1.measurement.sample')}</p>
					{#each ['play_clicked', 'round_started', 'round_completed', 'next_clicked', 'error'] as event (event)}<p
							class="summary-row"
						>
							<span>{t(`v1.measurement.${event}` as MessageKey)}</span><strong
								>{count(event)}</strong
							>
						</p>{/each}
				</section>{:else if data.view === 'status'}
				<section class="admin-card">
					<h2>{t('v1.admin.status.ranked')}</h2>
					<p class="status">{t(data.ranked ? 'v1.admin.status.on' : 'v1.admin.status.off')}</p>
					<p>{t('v1.admin.status.description')}</p>
					<AccountForm
						>{#snippet children(pending)}<input
								type="hidden"
								name="action"
								value={data.ranked ? 'ranked-off' : 'ranked-on'}
							/><input type="hidden" name="target" value="ranked" />{@render reason()}<button
								class="btn primary"
								disabled={pending}
								>{t(data.ranked ? 'v1.admin.status.disable' : 'v1.admin.status.enable')}</button
							>{/snippet}</AccountForm
					>
				</section>
			{:else if data.view === 'moderation'}
				<section class="admin-card">
					<h2>{t('v1.admin.lookup.title')}</h2>
					<form method="GET">
						<label
							>{t('v1.admin.lookup.label')}<input
								name="ref"
								maxlength="80"
								bind:value={ref}
								pattern={'[A-Za-z0-9_-]{3,80}'}
								required
							/></label
						><button class="btn">{t('v1.admin.lookup.action')}</button>
					</form>
					{#if data.lookup.length}<div class="table-wrap">
							<table>
								<thead
									><tr
										><th>{t('leaderboard.player')}</th><th>{t('v1.operator.run')}</th><th
											>{t('leaderboard.score')}</th
										><th>{t('v1.operator.state')}</th></tr
									></thead
								><tbody
									>{#each data.lookup as row (row.id)}<tr
											><td>{row.name}</td><td>{row.id ?? '—'}</td><td>{row.score ?? '—'}</td><td
												>{t(
													row.ban
														? 'v1.operator.banned'
														: row.hidden
															? 'v1.operator.hidden'
															: 'v1.operator.eligible'
												)}</td
											></tr
										>{/each}</tbody
								>
							</table>
						</div>{:else}<p>{t('v1.admin.empty')}</p>{/if}
				</section>
				{#if can(data.actor.role, 'hide')}<section class="admin-card">
						<h2>{t('v1.operator.action')}</h2>
						<AccountForm
							>{#snippet children(pending)}<label
									>{t('v1.operator.action')}<select name="action" bind:value={selectedAction}
										>{#each ['hide', 'restore', 'ban', 'unban', 'rename'] as action (action)}<option
												value={action}>{t(`v1.operator.${action}` as MessageKey)}</option
											>{/each}</select
									></label
								><label
									>{t('v1.admin.lookup.label')}<input
										name="target"
										maxlength="80"
										required
									/></label
								>{#if selectedAction === 'rename'}<label
										>{t('account.name.label')}<input name="name" maxlength="20" required /></label
									>{/if}{@render reason()}<button class="btn primary" disabled={pending}
									>{t('v1.operator.apply')}</button
								>{/snippet}</AccountForm
						>
					</section>{/if}
			{:else if data.view === 'queue'}
				<section class="admin-card">
					<h2>{t('v1.admin.queue.title')}</h2>
					{#each data.cases as row (row.id)}<article class="case-row">
							<strong>{row.id}</strong><span>{row.kind} · {row.target} · {row.state}</span
							>{#if row.state === 'open'}<AccountForm
									>{#snippet children(pending)}<input
											type="hidden"
											name="action"
											value="case-resolve"
										/><input type="hidden" name="target" value={row.id} /><input
											type="hidden"
											name="reason"
											value={row.id}
										/><label
											><input type="checkbox" name="confirm" value="yes" required />{t(
												'v1.operator.confirm'
											)}</label
										><button class="btn" disabled={pending}>{t('v1.operator.resolve')}</button
										>{/snippet}</AccountForm
								>{/if}
						</article>{:else}<p>{t('v1.admin.empty')}</p>{/each}
				</section>
				<section class="admin-card">
					<h2>{t('v1.operator.addCase')}</h2>
					<AccountForm
						>{#snippet children(pending)}<input
								type="hidden"
								name="action"
								value="case-add"
							/><label
								>{t('v1.operator.kind')}<select name="kind"
									><option value="username">{t('v1.operator.username')}</option><option
										value="score">{t('leaderboard.score')}</option
									></select
								></label
							><label
								>{t('v1.admin.lookup.label')}<input name="target" maxlength="80" required /></label
							>{@render reason()}<button class="btn primary" disabled={pending}
								>{t('v1.operator.addCase')}</button
							>{/snippet}</AccountForm
					>
				</section>
			{:else if data.view === 'audit'}
				<section class="admin-card table-wrap">
					<table>
						<thead
							><tr
								>{#each ['time', 'actor', 'action', 'target', 'reason'] as field (field)}<th
										>{t(`v1.operator.${field}` as MessageKey)}</th
									>{/each}</tr
							></thead
						><tbody
							>{#each data.audit as row (row.id)}<tr
									><td>{new Date(row.created_at).toISOString()}</td><td>{row.actor}</td><td
										>{row.action}</td
									><td>{row.target}</td><td>{row.reason}</td></tr
								>{/each}</tbody
						>
					</table>
				</section>
			{:else if data.view === 'privacy'}
				<section class="admin-card">
					<p>{t('v1.admin.operator.warning')}</p>
					<AccountForm
						>{#snippet children(pending)}<label
								>{t('v1.operator.action')}<select name="action"
									><option value="export">{t('v1.operator.export')}</option><option value="delete"
										>{t('account.profile.delete')}</option
									></select
								></label
							><label
								>{t('account.name.label')}<input name="target" maxlength="80" required /></label
							><label
								>{t('v1.operator.exportOffset')}<input
									name="offset"
									type="number"
									min="0"
									step="100"
									max="100000"
									value="0"
								/></label
							>{@render reason()}<button class="btn primary" disabled={pending}
								>{t('v1.operator.apply')}</button
							>{/snippet}</AccountForm
					>{#if form && 'exported' in form}<label
							>{t('v1.operator.export')}<textarea readonly rows="8" value={form.exported}
							></textarea></label
						>{/if}
				</section>
			{/if}
			{#if data.view === 'audit' || data.view === 'queue'}<nav class="pagination">
					{#if data.page > 0}<form method="GET">
							<button class="btn" name="page" value={data.page - 1}
								>{t('leaderboard.previous')}</button
							>
						</form>{/if}{#if data.more}<form method="GET">
							<button class="btn" name="page" value={data.page + 1}>{t('leaderboard.next')}</button>
						</form>{/if}
				</nav>{/if}
		</main>
	</div>
</div>
{#snippet reason()}<label
		>{t('v1.operator.reason')}<input
			name="reason"
			minlength="3"
			maxlength="240"
			required
			placeholder="CASE-..."
		/></label
	>
	<p class="form-note">{t('v1.operator.reasonNote')}</p>
	<label class="confirmation"
		><input type="checkbox" name="confirm" value="yes" required />{t('v1.operator.confirm')}</label
	>{/snippet}

<style>
	.operator-shell {
		display: grid;
		grid-template-columns: 230px minmax(0, 1fr);
		min-height: 100svh;
		background: var(--bg);
	}
	.operator-sidebar {
		position: sticky;
		top: 0;
		height: 100svh;
		background: var(--surface);
		border-right: 1px solid var(--border);
		padding: 28px 22px;
		display: flex;
		flex-direction: column;
	}
	.brand {
		font-size: 26px;
		font-weight: 950;
		text-decoration: none;
		color: var(--ink);
		letter-spacing: -0.04em;
	}
	.eyebrow {
		font-size: 10px;
		letter-spacing: 0.16em;
		color: var(--muted);
		text-transform: uppercase;
		margin: 22px 0 12px;
	}
	.operator-sidebar nav {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.operator-sidebar nav a {
		padding: 12px;
		color: var(--ink-2);
		font-size: 13px;
		font-weight: 800;
		text-decoration: none;
		border-radius: 8px;
	}
	.operator-sidebar nav .active {
		background: var(--surface-2);
		color: var(--primary-strong);
	}
	.operator-person {
		margin-top: auto;
		padding-top: 24px;
		border-top: 1px solid var(--border);
		font-size: 12px;
	}
	.operator-person p {
		color: var(--muted);
		margin: 8px 0;
	}
	.operator-person button {
		border: 0;
		background: transparent;
		color: var(--ink-2);
		padding: 8px 0;
		text-decoration: underline;
		cursor: pointer;
	}
	.operator-body > header {
		height: 72px;
		padding: 24px 32px;
		display: flex;
		justify-content: space-between;
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		color: var(--muted);
	}
	main {
		max-width: 1400px;
		margin: auto;
		padding: 28px 32px 48px;
	}
	.admin-heading {
		margin-bottom: 24px;
	}
	.admin-heading .eyebrow {
		margin-top: 0;
	}
	h1 {
		font-size: 36px;
		line-height: 1.1;
		letter-spacing: -0.035em;
		margin-bottom: 12px;
	}
	.admin-heading > p:last-child {
		font-size: 14px;
		color: var(--muted);
	}
	.metric-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
		margin-bottom: 24px;
	}
	.metric,
	.admin-card {
		padding: 22px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
	}
	.metric p {
		font-size: 12px;
		color: var(--muted);
	}
	.metric strong {
		font-size: 34px;
		font-weight: 950;
		display: block;
		margin-top: 10px;
	}
	.admin-card {
		margin-bottom: 20px;
		min-width: 0;
	}
	.admin-card h2 {
		font-size: 19px;
		margin: 0 0 18px;
	}
	.admin-card p {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.6;
		margin: 12px 0;
	}
	.dashboard-columns {
		display: grid;
		grid-template-columns: 1.6fr 1fr;
		gap: 20px;
	}
	.chart {
		display: flex;
		gap: 16px;
		align-items: end;
		min-height: 160px;
	}
	.chart > div {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}
	.chart i {
		display: block;
		width: 100%;
		background: var(--accent);
		border-radius: 5px 5px 0 0;
	}
	.summary-row {
		display: flex;
		justify-content: space-between;
		border-bottom: 1px solid var(--border);
		padding-bottom: 12px;
	}
	.table-wrap {
		overflow: auto;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 12px;
	}
	th {
		text-align: left;
		font-size: 10px;
		color: var(--label);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	td,
	th {
		padding: 12px 10px;
		border-bottom: 1px solid var(--border);
	}
	td {
		max-width: 280px;
		overflow-wrap: anywhere;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 12px;
		font-weight: 800;
		margin: 16px 0;
	}
	input:not([type='checkbox']),
	select,
	textarea {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		width: 100%;
		max-width: 600px;
		background: var(--surface);
		font-size: 14px;
	}
	.confirmation {
		flex-direction: row;
		align-items: center;
		font-weight: 600;
	}
	.primary {
		background: var(--primary);
		color: var(--surface);
		border: 0;
	}
	.notice {
		padding: 14px;
		background: var(--surface);
		border: 1px solid var(--danger);
		border-radius: 9px;
		color: var(--danger);
		font-size: 13px;
		margin-bottom: 20px;
	}
	.success {
		border-color: var(--success);
		color: var(--success);
	}
	.case-row {
		display: grid;
		gap: 8px;
		padding: 16px 0;
		border-top: 1px solid var(--border);
		font-size: 13px;
	}
	.pagination {
		display: flex;
		gap: 24px;
	}
	a {
		color: var(--ink-2);
	}
	:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
	}
	@media (max-width: 900px) {
		.operator-shell {
			grid-template-columns: 180px minmax(0, 1fr);
		}
		.operator-sidebar {
			padding: 24px 14px;
		}
		main {
			padding: 24px 20px;
		}
		.metric-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.dashboard-columns {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		.operator-shell {
			display: block;
		}
		.operator-sidebar {
			position: static;
			height: auto;
			padding: 16px;
			border: 0;
			border-bottom: 1px solid var(--border);
		}
		.operator-sidebar nav {
			flex-direction: row;
			overflow: auto;
			margin-top: 8px;
		}
		.operator-sidebar nav a {
			white-space: nowrap;
			padding: 10px;
		}
		.operator-sidebar > .eyebrow,
		.operator-person {
			display: none;
		}
		.operator-body > header {
			height: 48px;
			padding: 16px;
		}
		.brand {
			font-size: 24px;
		}
		main {
			padding: 20px 16px;
		}
		h1 {
			font-size: 29px;
		}
		.metric {
			padding: 16px;
		}
		.metric strong {
			font-size: 28px;
		}
		.admin-card {
			padding: 16px;
		}
	}
</style>
