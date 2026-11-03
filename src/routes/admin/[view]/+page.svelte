<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import ThemeEditor from '#lib/components/ThemeEditor.svelte';
	import ScoringEditor from '#lib/components/ScoringEditor.svelte';
	import Brand from '#lib/components/Brand.svelte';
	import { resolve } from '$app/paths';
	import AccountForm from '#lib/components/account/AccountForm.svelte';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { can } from '#lib/operator-permissions.js';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	const views = [
		'dashboard',
		'users',
		'games',
		'status',
		'moderation',
		'queue',
		'audit',
		'privacy',
		'scoring',
		'themes'
	];
	let ref = $state('');
	const key = (suffix: string) => `v1.admin.${suffix}` as MessageKey;
	const count = (name: string) => new Intl.NumberFormat('en').format(data.metrics[name] ?? 0);
	let selectedAction = $state('hide');
	let detailTab = $state(untrack(() => data.detailTab));
	let preview = $state<(typeof data.directory.rows)[number] | null>(null);
	let drawer = $state<HTMLDialogElement>();
	function viewUser(user: (typeof data.directory.rows)[number]) {
		preview = user;
		drawer?.showModal();
	}
</script>

<svelte:head
	><title>{t(key(`nav.${data.view === 'privacy' ? 'operator' : data.view}`))} · Morphi.One</title
	><meta name="robots" content="noindex" /></svelte:head
>
<div class="operator-shell" data-ready={ready}>
	<aside class="operator-sidebar">
		<a class="brand" href={resolve('/')}><Brand /></a>
		<p class="eyebrow">{t('v1.admin.workspace')}</p>
		<nav>
			{#each views.filter((view) => can(data.actor.role, view)) as view (view)}
				{#if view === 'users' || view === 'audit'}
					<details class="sidebar-group" open={data.view === view}>
						<summary class:active={data.view === view}>{t(key(`nav.${view}`))}</summary>
						<div class="sidebar-subnav">
							<a
								class:active={data.view === view &&
									data.subview !== (view === 'users' ? 'directory' : 'viewer') &&
									!data.detail}
								href={resolve('/admin/[view]', { view })}>{t('v1.admin.users.overview')}</a
							>
							<a
								class:active={data.view === view &&
									(data.subview === (view === 'users' ? 'directory' : 'viewer') || !!data.detail)}
								href="{resolve('/admin/[view]', { view })}?subview={view === 'users'
									? 'directory'
									: 'viewer'}"
								>{t(view === 'users' ? 'v1.admin.users.directory' : 'v1.admin.audit.viewer')}</a
							>
						</div>
					</details>
				{:else}<a
						class:active={data.view === view}
						aria-current={data.view === view ? 'page' : undefined}
						href={resolve('/admin/[view]', { view })}
						>{t(key(`nav.${view === 'privacy' ? 'operator' : view}`))}</a
					>{/if}
			{/each}
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
		<header>
			<h1>{t(key(`${data.view === 'privacy' ? 'operator' : data.view}.title`))}</h1>
			<span>{new Date().toISOString().slice(0, 10)}</span>
		</header>
		<main>
			{#if data.unavailable}<p class="notice" role="alert">{t('v1.admin.error')}</p>{/if}
			{#if form && 'code' in form}<p class="notice" role="alert">
					{t(
						form.code === 'operator_reauth' || form.code === 'signed_out'
							? 'v1.admin.reauth'
							: 'v1.admin.error'
					)}
					<a href={resolve('/admin/sign-in')}>{t('v1.admin.login.title')}</a>
				</p>{:else if form && 'success' in form}<p class="notice success" role="status">
					{t('v1.operator.saved')}
				</p>{/if}
			{#if data.view === 'dashboard'}
				<div class="metric-grid">
					{#each ['accounts', 'runs', 'entries', 'starts', 'claims', 'hidden', 'bans', 'deletions'] as metric (metric)}<article
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
								<span>{t(`v1.game.${game.family}` as MessageKey)}</span><strong>{game.total}</strong
								>
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
				</section>{:else if data.view === 'users'}
				<nav class="section-tabs" aria-label={t('v1.admin.users.section')}>
					<a
						class:active={data.subview !== 'directory' && !data.detail}
						aria-current={data.subview !== 'directory' && !data.detail ? 'page' : undefined}
						href={resolve('/admin/[view]', { view: 'users' })}>{t('v1.admin.users.overview')}</a
					>
					<a
						class:active={data.subview === 'directory' || !!data.detail}
						aria-current={data.subview === 'directory' || data.detail ? 'page' : undefined}
						href="{resolve('/admin/[view]', { view: 'users' })}?subview=directory"
						>{t('v1.admin.users.directory')}</a
					>
				</nav>
				{#if data.detail}
					<section class="admin-card user-detail">
						<a
							class="back-link"
							href="{resolve('/admin/[view]', { view: 'users' })}?subview=directory"
							><span aria-hidden="true">←</span> {t('v1.admin.users.back')}</a
						>
						<div class="user-heading">
							<div>
								<p class="user-kicker">{t('v1.admin.users.title')}</p>
								<h2>{data.detail.user.public_name ?? '—'}</h2>
							</div>
							<div class="user-badges">
								<span
									class:warning={!!data.detail.user.banned || !!data.detail.user.restore_until}
									class="user-badge"
									>{t(
										key(
											`users.status.${data.detail.user.restore_until ? 'deleted' : data.detail.user.banned ? 'banned' : 'active'}`
										)
									)}</span
								>{#if data.detail.user.banned && data.detail.user.restore_until}<span
										class="user-badge warning">{t('v1.admin.users.status.banned')}</span
									>{/if}
							</div>
						</div>
						<dl class="identity-fields">
							<div>
								<dt>{t('v1.admin.users.google')}</dt>
								<dd>{data.detail.user.google_name}</dd>
							</div>
							<div>
								<dt>{t('v1.admin.users.email')}</dt>
								<dd>{data.detail.user.email}</dd>
							</div>
							<div>
								<dt>{t('v1.admin.users.joined')}</dt>
								<dd>{new Date(data.detail.user.created_at).toISOString()}</dd>
							</div>
						</dl>
						<div class="user-metrics">
							{#each ['completions', 'ranked', 'solo', 'hidden'] as metric (metric)}<div>
									<span>{t(key(`games.${metric === 'completions' ? 'completed' : metric}`))}</span
									><strong
										>{data.detail.stats.reduce(
											(sum, stat) =>
												sum + stat[metric as 'completions' | 'ranked' | 'solo' | 'hidden'],
											0
										)}</strong
									>
								</div>{/each}
						</div>
						<nav class="detail-tabs" aria-label={t('v1.admin.users.detailSections')}>
							{#each ['stats', 'activity', 'rounds', 'actions'] as tab (tab)}<button
									class="btn"
									aria-pressed={detailTab === tab}
									onclick={() => (detailTab = tab)}>{t(key(`users.tab.${tab}`))}</button
								>{/each}
						</nav>
						<div hidden={detailTab !== 'stats'} class="detail-content">
							<h2>{t('v1.admin.users.saved')}</h2>
							<div class="table-wrap">
								<table>
									<thead
										><tr
											><th>{t('v1.admin.users.game')}</th><th>{t('v1.admin.games.rulesGroup')}</th
											><th>{t('v1.admin.games.version')}</th><th>{t('v1.admin.games.completed')}</th
											><th>{t('v1.admin.games.best')}</th><th>{t('v1.admin.games.average')}</th><th
												>{t('v1.admin.games.ranked')}</th
											><th>{t('v1.admin.games.solo')}</th><th>{t('v1.admin.games.hidden')}</th></tr
										></thead
									><tbody
										>{#each data.detail.stats as stat (`${stat.family}:${stat.rules_group}:${stat.score_config_version}`)}<tr
												><td>{stat.family}</td><td>{stat.rules_group}</td><td
													>{stat.score_config_version}</td
												><td>{stat.completions}</td><td>{stat.best}</td><td
													>{stat.average.toFixed(1)}</td
												><td>{stat.ranked}</td><td>{stat.solo}</td><td>{stat.hidden}</td></tr
											>{:else}<tr><td colspan="9">{t('v1.admin.empty')}</td></tr>{/each}</tbody
									>
								</table>
							</div>
							<p>{t('v1.admin.users.unavailable')}</p>
							<dl class="tracking-fields">
								<div>
									<dt>{t('v1.admin.users.trackingSince')}</dt>
									<dd>
										{data.detail.tracking
											? new Date(data.detail.tracking.tracking_since).toISOString()
											: t('v1.admin.users.notRecorded')}
									</dd>
								</div>
								<div>
									<dt>{t('v1.admin.users.lastRequest')}</dt>
									<dd>
										{data.detail.tracking
											? new Date(data.detail.tracking.last_activity_at).toISOString()
											: t('v1.admin.users.notRecorded')}
									</dd>
								</div>
							</dl>
							<p>{t('v1.admin.users.tracked')}</p>
							<div class="table-wrap">
								<table>
									<thead
										><tr
											><th>{t('v1.admin.users.game')}</th><th>{t('v1.admin.users.starts')}</th><th
												>{t('v1.admin.games.completed')}</th
											><th>{t('v1.admin.users.abandoned')}</th></tr
										></thead
									><tbody
										>{#each data.detail.tracked as row (row.family)}<tr
												><td>{row.family}</td><td>{row.starts}</td><td>{row.completed}</td><td
													>{row.abandoned}</td
												></tr
											>{:else}<tr><td colspan="4">{t('v1.admin.users.notRecorded')}</td></tr
											>{/each}</tbody
									>
								</table>
							</div>
						</div>
						<div hidden={detailTab !== 'activity'} class="detail-content">
							<h2>{t('v1.admin.users.activity')}</h2>
							<div class="table-wrap">
								<table>
									<thead
										><tr
											><th>{t('v1.admin.users.date')}</th><th>{t('v1.admin.games.completed')}</th
											></tr
										></thead
									><tbody
										>{#each data.detail.activity as day (day.day)}<tr
												><td>{day.day}</td><td>{day.total}</td></tr
											>{:else}<tr><td colspan="2">{t('v1.admin.empty')}</td></tr>{/each}</tbody
									>
								</table>
							</div>
							<h2>{t('v1.admin.users.history')}</h2>
							<div class="table-wrap">
								<table>
									<thead
										><tr
											><th>{t('v1.operator.time')}</th><th>{t('v1.operator.action')}</th><th
												>{t('v1.operator.reason')}</th
											></tr
										></thead
									><tbody
										>{#each data.detail.moderation as item (item.id)}<tr
												><td>{new Date(item.created_at).toISOString()}</td><td>{item.action}</td><td
													>{item.reason}</td
												></tr
											>{:else}<tr><td colspan="3">{t('v1.admin.empty')}</td></tr>{/each}</tbody
									>
								</table>
							</div>
						</div>
						<div hidden={detailTab !== 'rounds'} class="detail-content round-list">
							<h2>{t('v1.admin.users.rounds')}</h2>
							{#each data.detail.rounds as round (round.id)}<details>
									<summary
										>{round.family} · {round.score} · {round.id} · {t(
											round.hidden ? 'v1.operator.hidden' : 'v1.operator.eligible'
										)}</summary
									><AccountForm
										>{#snippet children(pending)}<input
												type="hidden"
												name="action"
												value={round.hidden ? 'restore' : 'hide'}
											/><input
												type="hidden"
												name="target"
												value={round.id}
											/>{@render reason()}<button class="btn" disabled={pending}
												>{t(round.hidden ? 'v1.operator.restore' : 'v1.operator.hide')}</button
											>{/snippet}</AccountForm
									>
								</details>{:else}<p>{t('v1.admin.empty')}</p>{/each}
						</div>
						{#if detailTab === 'activity' || detailTab === 'rounds'}<nav class="pagination">
								{#if data.page > 0}<form
										method="GET"
										action={resolve('/admin/[view]', { view: 'users' })}
									>
										<input type="hidden" name="id" value={data.detail.user.id} /><input
											type="hidden"
											name="tab"
											value={detailTab}
										/><button class="btn" name="page" value={data.page - 1}
											>{t('leaderboard.previous')}</button
										>
									</form>{/if}
								{#if data.detail.more}<form
										method="GET"
										action={resolve('/admin/[view]', { view: 'users' })}
									>
										<input type="hidden" name="id" value={data.detail.user.id} /><input
											type="hidden"
											name="tab"
											value={detailTab}
										/><button class="btn" name="page" value={data.page + 1}
											>{t('leaderboard.next')}</button
										>
									</form>{/if}
							</nav>{/if}
					</section>
					{#if detailTab === 'actions'}
						<div class="user-action-grid">
							{#if data.detail.user.public_name}
								<section class="admin-card" class:action-danger={!data.detail.user.banned}>
									<h2>
										{t(data.detail.user.banned ? 'v1.admin.users.unban' : 'v1.admin.users.ban')}
									</h2>
									<AccountForm
										>{#snippet children(pending)}<input
												type="hidden"
												name="action"
												value={data.detail!.user.banned ? 'unban' : 'ban'}
											/><input type="hidden" name="target" value={data.detail!.user.public_name} />
											{#if !data.detail!.user.banned}<label
													>{t('v1.admin.users.duration')}<input
														name="duration"
														type="number"
														min="1"
														max="36500"
														step="1"
													/></label
												>
												<p>{t('v1.admin.users.permanent')}</p>{/if}
											{@render reason()}<button class="btn primary" disabled={pending}
												>{t('v1.operator.apply')}</button
											>{/snippet}</AccountForm
									>
								</section>
								<section class="admin-card">
									<h2>{t('v1.admin.users.rename')}</h2>
									<AccountForm
										>{#snippet children(pending)}<input
												type="hidden"
												name="action"
												value="rename"
											/><input
												type="hidden"
												name="target"
												value={data.detail!.user.public_name}
											/><label
												>{t('account.name.label')}<input
													name="name"
													maxlength="20"
													required
												/></label
											>{@render reason()}<button class="btn primary" disabled={pending}
												>{t('v1.operator.apply')}</button
											>{/snippet}</AccountForm
									>
								</section>
							{/if}
							<section class="admin-card" class:action-danger={!data.detail.user.restore_until}>
								<h2>
									{t(
										data.detail.user.restore_until
											? 'v1.admin.users.restore'
											: 'v1.admin.users.delete'
									)}
								</h2>
								{#if data.detail.user.restore_until}<p>
										{t('v1.admin.users.deadline')}: {new Date(
											data.detail.user.restore_until
										).toISOString()}
									</p>{/if}
								<AccountForm
									>{#snippet children(pending)}<input
											type="hidden"
											name="action"
											value={data.detail!.user.restore_until ? 'user-restore' : 'user-delete'}
										/><input
											type="hidden"
											name="target"
											value={data.detail!.user.id}
										/>{#if !data.detail!.user.restore_until}<label
												>{t('v1.admin.users.duration')}<input
													name="duration"
													type="number"
													min="1"
													max="365"
													step="1"
													value="7"
													required
												/></label
											>{/if}{@render reason()}<button class="btn primary" disabled={pending}
											>{t('v1.operator.apply')}</button
										>{/snippet}</AccountForm
								>
							</section>
						</div>
					{/if}
				{:else if data.subview === 'directory'}
					<section class="admin-card">
						<form method="GET" class="directory-filters">
							<input type="hidden" name="subview" value="directory" />
							<label
								>{t('v1.admin.users.search')}<input
									name="search"
									maxlength="80"
									value={data.userSearch}
								/></label
							>
							<label
								>{t('v1.admin.users.status')}<select name="status"
									>{#each ['all', 'active', 'banned', 'deleted'] as status (status)}<option
											value={status}
											selected={data.userStatus === status}
											>{t(key(`users.status.${status}`))}</option
										>{/each}</select
								></label
							>
							<button class="btn">{t('v1.admin.users.filter')}</button>
						</form>
						<div class="table-wrap directory-table">
							<table>
								<thead
									><tr
										><th>{t('leaderboard.player')}</th><th>{t('v1.admin.users.joined')}</th><th
											>{t('v1.admin.users.completions')}</th
										><th>{t('v1.admin.users.status')}</th><th>{t('v1.operator.action')}</th></tr
									></thead
								><tbody>
									{#each data.directory.rows as user (user.id)}<tr
											><td
												><a
													href="{resolve('/admin/[view]', {
														view: 'users'
													})}?id={encodeURIComponent(user.id)}">{user.name ?? user.id}</a
												></td
											><td>{new Date(user.created_at).toISOString().slice(0, 10)}</td><td
												>{user.completions}</td
											><td
												>{t(
													key(
														`users.status.${user.deleted ? 'deleted' : user.banned ? 'banned' : 'active'}`
													)
												)}</td
											><td
												><button class="btn" onclick={() => viewUser(user)}
													>{t('v1.admin.users.view')}</button
												></td
											></tr
										>{:else}<tr><td colspan="5">{t('v1.admin.empty')}</td></tr>{/each}
								</tbody>
							</table>
						</div>
						<nav class="pagination">
							{#each [data.page - 1, data.page + 1] as next (next)}{#if next >= 0 && (next < data.page || data.directory.more)}<form
										method="GET"
									>
										<input type="hidden" name="subview" value="directory" /><input
											type="hidden"
											name="search"
											value={data.userSearch}
										/><input type="hidden" name="status" value={data.userStatus} /><button
											class="btn"
											name="page"
											value={next}
											>{t(next < data.page ? 'leaderboard.previous' : 'leaderboard.next')}</button
										>
									</form>{/if}{/each}
						</nav>
						<dialog bind:this={drawer} class="user-drawer" aria-labelledby="drawer-title">
							<button class="btn drawer-close" onclick={() => drawer?.close()}
								>{t('v1.admin.users.close')}</button
							>
							{#if preview}<p class="drawer-kicker">{t('v1.admin.users.title')}</p>
								<div class="user-heading">
									<h2 id="drawer-title">{preview.name ?? preview.id}</h2>
									<span class="user-badge" class:warning={!!preview.deleted || !!preview.banned}
										>{t(
											key(
												`users.status.${preview.deleted ? 'deleted' : preview.banned ? 'banned' : 'active'}`
											)
										)}</span
									>
								</div>
								{#if preview.deleted && preview.banned}<p>
										<span class="user-badge warning">{t('v1.admin.users.status.banned')}</span>
									</p>{/if}
								<div class="drawer-metric">
									<span>{t('v1.admin.users.completions')}</span><strong
										>{preview.completions}</strong
									>
								</div>
								<dl class="identity-fields">
									<div>
										<dt>{t('v1.admin.users.joined')}</dt>
										<dd>{new Date(preview.created_at).toISOString().slice(0, 10)}</dd>
									</div>
								</dl>
								<a
									class="btn primary drawer-action"
									href="{resolve('/admin/[view]', { view: 'users' })}?id={encodeURIComponent(
										preview.id
									)}">{t('v1.admin.users.fullDetail')}</a
								>{/if}
						</dialog>
					</section>
				{:else if data.usersOverview}
					<div class="metric-grid">
						<article class="metric">
							<p>{t('v1.admin.users.total')}</p>
							<strong>{data.usersOverview.totals?.users ?? 0}</strong>
						</article>
						<article class="metric">
							<p>{t('v1.admin.users.activeBans')}</p>
							<strong>{data.usersOverview.totals?.bans ?? 0}</strong>
						</article>
						<article class="metric">
							<p>{t('v1.admin.users.deletedCount')}</p>
							<strong>{data.usersOverview.totals?.deleted ?? 0}</strong>
						</article>
						<article class="metric">
							<p>{t('v1.admin.users.completions')}</p>
							<strong>{data.usersOverview.totals?.completions ?? 0}</strong>
						</article>
					</div>
					<section class="admin-card">
						<h2>{t('v1.admin.users.topPlayer')}</h2>
						<p>
							{data.usersOverview.top
								? `${data.usersOverview.top.name} · ${data.usersOverview.top.completions}`
								: t('v1.admin.empty')}
						</p>
						<a href="{resolve('/admin/[view]', { view: 'users' })}?subview=directory"
							>{t('v1.admin.users.directory')}</a
						>
					</section>
				{/if}
			{:else if data.view === 'status'}
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
				<nav class="section-tabs" aria-label={t('v1.admin.audit.section')}>
					<a
						class:active={data.subview !== 'viewer'}
						href={resolve('/admin/[view]', { view: 'audit' })}>{t('v1.admin.users.overview')}</a
					><a
						class:active={data.subview === 'viewer'}
						href="{resolve('/admin/[view]', { view: 'audit' })}?subview=viewer"
						>{t('v1.admin.audit.viewer')}</a
					>
				</nav>
				{#if data.subview !== 'viewer' && data.auditOverview}<div class="metric-grid">
						<article class="metric">
							<p>{t('v1.admin.audit.total')}</p>
							<strong>{data.auditOverview.total}</strong>
						</article>
						<article class="metric">
							<p>{t('v1.admin.audit.recent')}</p>
							<strong>{data.auditOverview.recent ?? 0}</strong>
						</article>
						<article class="metric">
							<p>{t('v1.admin.audit.operators')}</p>
							<strong>{data.auditOverview.operators}</strong>
						</article>
					</div>

					<h2>{t('v1.admin.audit.latest')}</h2>{/if}
				{#if data.subview === 'viewer'}
					<div class="audit-controls">
						<section class="admin-card audit-filter">
							<h2>{t('v1.admin.audit.filter')}</h2>
							<form method="GET" class="audit-filter-grid">
								<input type="hidden" name="subview" value="viewer" />
								<label
									>{t('v1.operator.actor')}<input
										name="actor"
										value={data.filters.actor}
										maxlength="80"
									/></label
								>
								<label
									>{t('v1.operator.action')}<input
										name="audit_action"
										value={data.filters.audit_action}
										maxlength="80"
									/></label
								>
								<label
									>{t('v1.operator.target')}<input
										name="audit_target"
										value={data.filters.audit_target}
										maxlength="80"
									/></label
								>
								<label
									>{t('v1.admin.audit.from')}<input
										type="date"
										name="from"
										value={data.filters.from}
									/></label
								>
								<label
									>{t('v1.admin.audit.to')}<input
										type="date"
										name="to"
										value={data.filters.to}
									/></label
								>
								<button class="btn">{t('v1.admin.audit.filter')}</button>
							</form>
						</section>
						<section class="admin-card audit-export">
							<h2>{t('v1.admin.audit.yearlyExport')}</h2>
							<AccountForm
								>{#snippet children(pending)}<input
										type="hidden"
										name="action"
										value="audit-export"
									/><input type="hidden" name="target" value="audit" /><label
										>{t('v1.admin.audit.year')}<input
											type="number"
											name="year"
											min="1970"
											max="9999"
											required
										/></label
									><label>{t('v1.admin.audit.cursor')}<input name="cursor" /></label
									>{@render reason()}<button class="btn primary" disabled={pending}
										>{t('v1.admin.audit.yearlyExport')}</button
									>{/snippet}</AccountForm
							>
							{#if form && 'exported' in form && typeof form.exported === 'string'}<p>
									<a
										download="morphi-audit.json"
										href={`data:application/json;charset=utf-8,${encodeURIComponent(form.exported)}`}
										>{t('v1.admin.audit.download')}</a
									>
								</p>
								<textarea readonly rows="6" value={form.exported}></textarea>{/if}
						</section>
					</div>
				{/if}
				<section class="admin-card table-wrap audit-table">
					<table>
						<thead
							><tr
								>{#each ['time', 'actor', 'action', 'target', 'reason'] as field (field)}<th
										>{t(`v1.operator.${field}` as MessageKey)}</th
									>{/each}</tr
							></thead
						><tbody
							>{#each data.subview === 'viewer' ? data.audit : data.audit.slice(0, 5) as row (row.id)}<tr
									><td>{new Date(row.created_at).toISOString()}</td><td>{row.actor}</td><td
										>{row.action}</td
									><td>{row.target}</td><td
										>{row.reason}{#if row.before || row.after}<details>
												<summary>{t('scoring.changes')}</summary>
												<pre>{row.before} → {row.after}</pre>
											</details>{/if}{#if ['ban', 'unban', 'hide', 'restore'].includes(row.action)}<details
											>
												<summary>{t('v1.admin.audit.undo')}</summary><AccountForm
													>{#snippet children(pending)}<input
															type="hidden"
															name="action"
															value="undo"
														/><input
															type="hidden"
															name="target"
															value={row.id}
														/>{@render reason()}<button class="btn" disabled={pending}
															>{t('v1.admin.audit.undo')}</button
														>{/snippet}</AccountForm
												>
											</details>{/if}</td
									></tr
								>{/each}</tbody
						>
					</table>
				</section>
			{:else if data.view === 'games'}
				<nav class="section-tabs" aria-label={t('v1.admin.games.section')}>
					<a
						class:active={!data.selectedGame}
						aria-current={!data.selectedGame ? 'page' : undefined}
						href={resolve('/admin/[view]', { view: 'games' })}>{t('v1.admin.games.overview')}</a
					>
					{#each data.games as game (game.family)}<a
							class:active={data.selectedGame === game.family}
							aria-current={data.selectedGame === game.family ? 'page' : undefined}
							href="{resolve('/admin/[view]', { view: 'games' })}?game={game.family}"
							>{t(`v1.game.${game.family}` as MessageKey)}</a
						>{/each}
				</nav>
				<p>{t('v1.admin.games.stats')}</p>
				{#if !data.selectedGame}
					<div class="game-grid">
						{#each data.games as game (game.family)}<a
								class="admin-card game-card"
								href="{resolve('/admin/[view]', { view: 'games' })}?game={game.family}"
								><h2>
									{t(`v1.game.${game.family}` as MessageKey)} · {t(
										`v1.admin.games.${game.state}` as MessageKey
									)}
								</h2>
								<p>{t('v1.admin.games.completed')}: {game.completed}</p>
								<p>
									{t('v1.admin.games.ranked')}: {game.ranked} · {t('v1.admin.games.solo')}: {game.completed -
										game.ranked}
								</p>
								<span>{t('v1.admin.games.open')}</span></a
							>{/each}
					</div>
				{:else}
					{#each data.games.filter((game) => game.family === data.selectedGame) as game (game.family)}
						<nav class="section-tabs" aria-label={t('v1.admin.games.detailSections')}>
							<a
								class:active={data.subview !== 'settings'}
								href="{resolve('/admin/[view]', { view: 'games' })}?game={game.family}"
								>{t('v1.admin.games.statistics')}</a
							><a
								class:active={data.subview === 'settings'}
								href="{resolve('/admin/[view]', {
									view: 'games'
								})}?game={game.family}&subview=settings">{t('v1.admin.games.settings')}</a
							>
						</nav>
						<section class="admin-card">
							<h2>
								{t(`v1.game.${game.family}` as MessageKey)} · {t(
									`v1.admin.games.${game.state}` as MessageKey
								)}
							</h2>
							{#if data.subview === 'settings'}
								{#if game.restoreUntil}<p>
										{t('v1.admin.users.deadline')}: {new Date(game.restoreUntil).toISOString()}
									</p>{/if}
								{#if game.state !== 'hard-deleted'}
									<AccountForm
										>{#snippet children(pending)}<input
												type="hidden"
												name="target"
												value={game.family}
											/>{#if game.state === 'deleted'}<input
													type="hidden"
													name="action"
													value={game.restoreUntil && game.restoreUntil > Date.now()
														? 'game-restore'
														: 'game-hard-delete'}
												/>{:else}<input
													type="hidden"
													name="action"
													value={game.state === 'enabled' ? 'game-disable' : 'game-enable'}
												/>{/if}{@render reason()}<button class="btn primary" disabled={pending}
												>{t(
													game.state === 'enabled'
														? 'v1.admin.games.disable'
														: game.state === 'disabled'
															? 'v1.admin.games.enable'
															: game.restoreUntil && game.restoreUntil > Date.now()
																? 'v1.admin.games.restore'
																: 'v1.admin.games.hardDelete'
												)}</button
											>{/snippet}</AccountForm
									>
									{#if game.state === 'disabled'}<details>
											<summary>{t('v1.admin.games.delete')}</summary><AccountForm
												>{#snippet children(pending)}<input
														type="hidden"
														name="action"
														value="game-delete"
													/><input type="hidden" name="target" value={game.family} /><label
														>{t('v1.admin.users.duration')}<input
															name="duration"
															type="number"
															min="1"
															max="365"
															step="1"
															value="7"
															required
														/></label
													>{@render reason()}<button class="btn" disabled={pending}
														>{t('v1.admin.games.delete')}</button
													>{/snippet}</AccountForm
											>
										</details>{/if}
								{/if}
							{:else}
								<p>
									{t('v1.admin.games.completed')}: {game.completed} · {t('v1.admin.games.ranked')}: {game.ranked}
									· {t('v1.admin.games.solo')}: {game.completed - game.ranked}
								</p>
								<p>{t('v1.admin.games.unavailable')}</p>
								<div class="table-wrap game-stats-table">
									<table>
										<thead
											><tr
												><th>{t('v1.admin.games.rulesGroup')}</th><th
													>{t('v1.admin.games.version')}</th
												><th>{t('v1.admin.games.completed')}</th><th
													>{t('v1.admin.games.ranked')}</th
												><th>{t('v1.admin.games.solo')}</th><th>{t('v1.admin.games.best')}</th><th
													>{t('v1.admin.games.average')}</th
												><th>{t('v1.admin.games.duration')}</th><th>{t('v1.admin.games.hidden')}</th
												></tr
											></thead
										><tbody
											>{#each data.gameStats.rows as row (`${row.rules_group}:${row.score_config_version}`)}<tr
													><td>{row.rules_group}</td><td>{row.score_config_version}</td><td
														>{row.completed}</td
													><td>{row.ranked}</td><td>{row.completed - row.ranked}</td><td
														>{row.bestScore}</td
													><td>{row.averageScore.toFixed(1)}</td><td
														>{row.averageSeconds.toFixed(1)}</td
													><td>{row.hidden}</td></tr
												>{:else}<tr><td colspan="9">{t('v1.admin.empty')}</td></tr>{/each}</tbody
										>
									</table>
								</div>
								{#if data.gameStats.more}<p>{t('v1.admin.games.limited')}</p>{/if}
							{/if}
						</section>
						{#if data.subview === 'settings' && (game.state === 'enabled' || game.state === 'disabled')}{#each data.scoring as config (`${config.family}:${config.version}`)}<ScoringEditor
									{config}
								/>{/each}{/if}
					{/each}
				{/if}
			{:else if data.view === 'themes' && data.themes}
				{#if form && 'themeIssues' in form}<p role="status">
						{form.themeIssues?.length ? form.themeIssues.join(', ') : t('themes.checked')}
					</p>{/if}
				<ThemeEditor config={data.themes} />
			{:else if data.view === 'scoring'}
				{#each data.scoring as config (`${config.family}:${config.version}`)}<ScoringEditor
						{config}
					/>{/each}
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
			{#if (data.view === 'audit' && data.subview === 'viewer') || data.view === 'queue'}<nav
					class="pagination"
				>
					{#if data.page > 0}<form method="GET">
							{#if data.view === 'audit'}<input
									type="hidden"
									name="subview"
									value="viewer"
								/>{/if}{#each Object.entries(data.filters) as [key, value] (key)}{#if value}<input
										type="hidden"
										name={key}
										{value}
									/>{/if}{/each}
							<button class="btn" name="page" value={data.page - 1}
								>{t('leaderboard.previous')}</button
							>
						</form>{/if}{#if data.more}<form method="GET">
							{#if data.view === 'audit'}<input
									type="hidden"
									name="subview"
									value="viewer"
								/>{/if}{#each Object.entries(data.filters) as [key, value] (key)}{#if value}<input
										type="hidden"
										name={key}
										{value}
									/>{/if}{/each}
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
	.section-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0 0 22px;
		padding: 5px;
		background: var(--surface-2);
		border-radius: 10px;
		width: fit-content;
		max-width: 100%;
	}
	.section-tabs a {
		padding: 10px 14px;
		border-radius: 7px;
		font-size: 13px;
		font-weight: 800;
		text-decoration: none;
	}
	.section-tabs a.active {
		background: var(--surface);
		color: var(--primary-strong);
	}
	.game-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
		gap: 16px;
	}
	.game-card {
		display: block;
		text-decoration: none;
		margin: 0;
	}
	.game-card:hover {
		border-color: var(--primary);
	}
	.game-card span {
		color: var(--primary-strong);
		font-size: 13px;
		font-weight: 800;
	}
	.sidebar-group summary {
		padding: 12px;
		color: var(--ink-2);
		font-size: 13px;
		font-weight: 800;
		border-radius: 8px;
		cursor: pointer;
	}
	.sidebar-group summary.active {
		background: var(--surface-2);
		color: var(--primary-strong);
	}
	.sidebar-subnav {
		display: flex;
		flex-direction: column;
		padding-left: 12px;
	}
	.operator-sidebar nav .sidebar-subnav a {
		padding: 9px 12px;
		font-size: 12px;
	}
	.detail-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 24px 0;
		padding: 5px;
		background: var(--surface-2);
		border-radius: 10px;
	}
	.detail-tabs .btn {
		border: 0;
		background: transparent;
		color: var(--ink-2);
		font-size: 13px;
		font-weight: 800;
	}
	.detail-tabs [aria-pressed='true'] {
		background: var(--surface);
		color: var(--primary-strong);
	}
	.back-link {
		display: inline-block;
		font-size: 13px;
		font-weight: 800;
		margin-bottom: 22px;
	}
	.user-heading {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.user-detail .user-kicker {
		margin: 0 0 4px;
		color: var(--label);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 10px;
		font-weight: 800;
	}
	.user-detail .user-heading h2 {
		margin: 0;
		font-size: 28px;
		overflow-wrap: anywhere;
	}
	.user-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.user-badge {
		padding: 7px 11px;
		border: 1px solid var(--success);
		color: var(--success);
		border-radius: 999px;
		font-size: 12px;
		font-weight: 800;
	}
	.user-badge.warning {
		border-color: var(--danger);
		color: var(--danger);
	}
	.identity-fields,
	.tracking-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
		gap: 16px;
		margin: 24px 0;
	}
	.identity-fields div,
	.tracking-fields div {
		min-width: 0;
	}
	.identity-fields dt,
	.tracking-fields dt {
		color: var(--muted);
		font-size: 11px;
		font-weight: 800;
	}
	.identity-fields dd,
	.tracking-fields dd {
		margin: 6px 0 0;
		font-size: 13px;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.user-metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
	}
	.user-metrics > div {
		padding: 16px;
		background: var(--surface-2);
		border-radius: 10px;
		min-width: 0;
	}
	.user-metrics span {
		display: block;
		font-size: 11px;
		color: var(--muted);
		font-weight: 800;
	}
	.user-metrics strong {
		display: block;
		margin-top: 8px;
		font-size: 26px;
	}
	.detail-content h2:not(:first-child) {
		margin-top: 28px;
	}
	.detail-content .table-wrap {
		border: 1px solid var(--border);
		border-radius: 9px;
	}
	.detail-content th {
		background: var(--surface-2);
	}
	.round-list details {
		border: 1px solid var(--border);
		border-radius: 9px;
		padding: 14px;
		margin-bottom: 10px;
	}
	.round-list summary {
		cursor: pointer;
		font-size: 13px;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.user-action-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 16px;
		align-items: start;
	}
	.user-action-grid .admin-card {
		margin: 0;
	}
	.action-danger {
		border-top: 3px solid var(--danger);
	}
	.directory-table table {
		min-width: 690px;
	}
	.audit-table table {
		min-width: 850px;
	}
	.game-stats-table table {
		min-width: 980px;
	}
	.directory-table th,
	.audit-table th,
	.game-stats-table th {
		white-space: nowrap;
		background: var(--surface-2);
	}
	.directory-table td:first-child {
		min-width: 160px;
	}
	.drawer-kicker {
		margin: 24px 0 8px;
		color: var(--label);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 10px;
		font-weight: 800;
	}
	.user-drawer .user-heading h2 {
		margin: 0;
		font-size: 24px;
		overflow-wrap: anywhere;
	}
	.drawer-metric {
		margin-top: 28px;
		padding: 18px;
		background: var(--surface-2);
		border-radius: 10px;
	}
	.drawer-metric span {
		display: block;
		color: var(--muted);
		font-size: 12px;
		font-weight: 800;
	}
	.drawer-metric strong {
		display: block;
		margin-top: 8px;
		font-size: 28px;
	}
	.drawer-action {
		display: inline-block;
		text-decoration: none;
		text-align: center;
	}
	.user-drawer {
		position: fixed;
		margin: 0 0 0 auto;
		inset: 0 0 0 auto;
		height: 100%;
		max-height: none;
		width: min(420px, 100%);
		border: 0;
		padding: 28px;
		background: var(--surface);
		color: var(--ink);
	}
	.user-drawer::backdrop {
		background: rgb(0 0 0 / 45%);
	}
	.drawer-close {
		float: right;
	}
	.directory-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 12px;
	}
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
		overflow-y: auto;
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
		min-height: 72px;
		padding: 16px 32px;
		display: flex;
		align-items: center;
		gap: 16px;
		justify-content: space-between;
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		color: var(--muted);
	}
	main {
		padding: 28px 32px 48px;
	}
	h1 {
		font-size: 20px;
		line-height: 1.1;
		letter-spacing: -0.02em;
		margin: 0;
		color: var(--ink);
	}
	.operator-body > header span {
		flex: none;
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
	.audit-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(410px, 100%), 1fr));
		gap: 16px;
		margin-bottom: 20px;
		align-items: start;
	}
	.audit-controls .admin-card {
		margin: 0;
	}
	.audit-filter-grid,
	.audit-export :global(form) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(145px, 100%), 1fr));
		gap: 12px;
		align-items: end;
	}
	.audit-controls label {
		margin: 0;
		min-width: 0;
	}
	.audit-controls input:not([type='checkbox']) {
		min-width: 0;
	}
	.audit-controls button {
		justify-self: start;
	}
	.audit-export :global(form p) {
		grid-column: 1 / -1;
		margin: 0;
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
		.user-metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.user-detail .user-heading h2 {
			font-size: 24px;
		}
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
		.sidebar-group {
			flex: none;
		}
		.sidebar-group summary {
			white-space: nowrap;
			padding: 10px;
		}
		.sidebar-subnav {
			padding-left: 0;
		}
		.operator-sidebar > .eyebrow,
		.operator-person {
			display: none;
		}
		.operator-body > header {
			min-height: 56px;
			padding: 12px 16px;
		}
		.brand {
			font-size: 24px;
		}
		main {
			padding: 20px 16px;
		}
		h1 {
			font-size: 18px;
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
