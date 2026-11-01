<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { formatNumber } from '#lib/ui/format.js';
	let {
		name,
		history,
		bests,
		summary,
		settings
	}: {
		name: string;
		history: {
			id: string;
			family: string;
			score: number;
			ranked: boolean;
			createdAt: number;
			group: string;
		}[];
		bests: { family: string; score: number }[];
		summary: { family: string; rounds: number; ranked: number; lastPlayed: number }[];
		settings: Snippet;
	} = $props();
	let tab = $state('overview'),
		detail = $state<string | null>(null);
	const tabs = ['overview', 'games', 'activity', 'settings'];
	const familyName = (family: string) =>
		t(
			family === 'block'
				? 'v1.game.block'
				: family === 'connect'
					? 'v1.game.connect'
					: 'v1.game.memory'
		);
	const high = (family: string) =>
		Math.max(0, ...bests.filter((row) => row.family === family).map((row) => row.score));
	const date = (timestamp: number) =>
		new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
			timestamp
		);
	function navigate(event: KeyboardEvent, index: number) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? tabs.length - 1
					: (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
		tab = tabs[next]!;
		(event.currentTarget as HTMLElement).parentElement
			?.querySelectorAll<HTMLButtonElement>('button')
			[next]?.focus();
	}
</script>

<div class="foundation">
	<section class="identity-band">
		<div class="preset-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
		<div class="identity-name">
			<h1>{name}.</h1>
			<p>{t('account.profile.connection')}</p>
		</div>
		<div class="identity-actions">
			<a class="text-button" href={resolve('/account/name')}>{t('account.profile.edit')}</a><a
				class="account-button"
				href={resolve('/play')}>{t('home.play')}</a
			>
		</div>
	</section>
	<div class="profile-tabs" role="tablist" aria-label={t('account.profile.label')}>
		{#each tabs as item, index (item)}<button
				role="tab"
				id={`profile-tab-${item}`}
				aria-controls="profile-panel"
				aria-selected={tab === item}
				tabindex={tab === item ? 0 : -1}
				onclick={() => {
					tab = item;
					detail = null;
				}}
				onkeydown={(event) => navigate(event, index)}
				>{t(`v1.profile.${item}` as MessageKey)}</button
			>{/each}
	</div>
	<div class="aggregate-strip">
		<div>
			<strong>{formatNumber(summary.reduce((n, row) => n + row.rounds, 0))}</strong><span
				>{t('v1.profile.rounds')}</span
			>
		</div>
		<div>
			<strong>{formatNumber(summary.reduce((n, row) => n + row.ranked, 0))}</strong><span
				>{t('v1.profile.ranked')}</span
			>
		</div>
		<div><strong>{summary.length}</strong><span>{t('v1.profile.games')}</span></div>
	</div>
	<div class="profile-grid">
		<div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${tab}`}>
			{#if tab === 'overview' || tab === 'games'}<section class="foundation-card">
					<h2>{detail ? familyName(detail) : t('v1.profile.games')}</h2>
					<div class="family-head">
						<span>{t('leaderboard.group')}</span><span>{t('v1.game.best')}</span><span
							>{t('v1.profile.rounds')}</span
						><span>{t('v1.profile.last')}</span>
					</div>
					{#each ['block', 'memory', 'connect'] as family (family)}<button
							class="family-row"
							onclick={() => (detail = detail === family ? null : family)}
							aria-expanded={detail === family}
							><span class="family-name"
								><i class:memory={family === 'memory'} aria-hidden="true"></i>{familyName(
									family
								)}</span
							><strong
								>{bests.some((row) => row.family === family)
									? formatNumber(high(family))
									: t('account.noScore')}</strong
							><span>{summary.find((row) => row.family === family)?.rounds ?? 0}</span><span
								>{summary.some((row) => row.family === family)
									? date(summary.find((row) => row.family === family)!.lastPlayed)
									: '—'}</span
							></button
						>{/each}{#if detail}<ul class="recent-activity history-list">
							{#each history.filter((row) => row.family === detail) as row (row.id)}<li>
									<span
										>{date(row.createdAt)} · {row.group.startsWith('memory-1:')
											? row.group.split(':')[1]
											: familyName(row.family)}</span
									><strong>{formatNumber(row.score)}</strong>
								</li>{/each}
						</ul>
						{#if !history.some((row) => row.family === detail)}<p>
								{t('v1.profile.empty')}
							</p>{/if}{/if}
				</section>{/if}
			{#if tab === 'overview' || tab === 'activity'}<section class="foundation-card">
					<h2>{t('account.profile.history')}</h2>
					<ul class="recent-activity history-list">
						{#each history as row (row.id)}<li>
								<span
									><strong>{familyName(row.family)}</strong><small
										>{date(row.createdAt)} · {t(
											row.ranked ? 'progress.rankedLabel' : 'progress.unrankedLabel'
										)}</small
									></span
								><strong>{formatNumber(row.score)}</strong>
							</li>{/each}
					</ul>
					{#if !history.length}<p>{t('v1.profile.empty')}</p>{/if}
				</section>{/if}
			{#if tab === 'settings'}<section class="foundation-card">
					<h2>{t('v1.profile.settings')}</h2>
					{@render settings()}
				</section>{/if}
		</div>
		<aside class="profile-rail">
			<section class="foundation-card">
				<h2>{t('v1.profile.account')}</h2>
				<p>{t('account.profile.connection')}</p>
				<a href={resolve('/leaderboard')}>{t('leaderboard.title')}</a><button
					class="text-button"
					onclick={() => (tab = 'settings')}>{t('v1.profile.settings')}</button
				>
			</section>
		</aside>
	</div>
</div>

<style>
	.foundation {
		width: 100%;
		max-width: 1390px;
		margin: auto;
	}
	.identity-band {
		display: grid;
		grid-template-columns: 60px minmax(0, 1fr) auto;
		align-items: center;
		gap: 18px;
		padding: 22px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 15px;
	}
	.preset-avatar {
		width: 60px;
		height: 60px;
		border-radius: 15px;
		background: var(--primary);
		color: var(--surface);
		font-size: 34px;
		font-weight: 950;
		display: grid;
		place-items: center;
	}
	.identity-name h1 {
		overflow-wrap: anywhere;
		font-size: 32px;
		font-weight: 950;
		line-height: 1.1;
		letter-spacing: -0.025em;
	}
	.identity-name p {
		font-size: 11px;
		color: var(--muted);
		margin-top: 8px;
	}
	.identity-actions {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.identity-actions a {
		margin: 0;
		width: auto;
		font-size: 12px;
		min-height: 42px;
		padding: 8px 14px;
		display: grid;
		place-items: center;
	}
	.text-button {
		border: 1px solid var(--border);
		border-radius: 9px;
		color: var(--ink-2);
		text-decoration: none;
		background: transparent;
		cursor: pointer;
		padding: 10px 14px;
		font-weight: 800;
	}
	.profile-tabs {
		display: flex;
		gap: 26px;
		border-bottom: 1px solid var(--border);
		margin: 14px 0 16px;
	}
	.profile-tabs button {
		padding: 12px 0;
		border: 0;
		border-bottom: 4px solid transparent;
		background: none;
		color: var(--muted);
		font-size: 13px;
		font-weight: 850;
		cursor: pointer;
		white-space: nowrap;
	}
	.profile-tabs button:last-child {
		margin-left: auto;
	}
	.profile-tabs [aria-selected='true'] {
		border-color: var(--primary);
		color: var(--ink);
	}
	.aggregate-strip {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-bottom: 20px;
	}
	.aggregate-strip > div {
		padding: 12px 17px;
		border: 1px solid var(--border);
		border-radius: 15px;
		background: var(--surface);
	}
	.aggregate-strip strong {
		font-size: 28px;
		display: block;
		font-weight: 950;
	}
	.aggregate-strip span {
		font-size: 11px;
		color: var(--label);
		font-weight: 800;
	}
	.profile-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 270px;
		gap: 20px;
		align-items: start;
	}
	.foundation-card {
		padding: 22px;
		border: 1px solid var(--border);
		border-radius: 15px;
		background: var(--surface);
		margin-bottom: 18px;
	}
	.foundation-card h2 {
		font-size: 19px;
		letter-spacing: -0.02em;
		margin: 0 0 18px;
	}
	.family-head,
	.family-row {
		display: grid;
		grid-template-columns: minmax(140px, 1.7fr) 1fr 0.6fr 0.85fr;
		gap: 16px;
		align-items: center;
	}
	.family-head {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--label);
		padding: 0 0 12px;
		font-weight: 900;
	}
	.family-row {
		width: 100%;
		text-align: left;
		padding: 18px 0;
		border: 0;
		border-top: 1px solid var(--border);
		background: transparent;
		cursor: pointer;
		font-size: 13px;
	}
	.family-name {
		font-weight: 900;
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.family-name i {
		display: block;
		width: 24px;
		height: 24px;
		border-radius: 6px;
		background: var(--primary);
	}
	.family-name .memory {
		background: var(--accent);
		transform: rotate(8deg);
	}
	.recent-activity {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.recent-activity li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 18px;
		border-top: 1px solid var(--border);
		padding: 14px 0;
		font-size: 13px;
	}
	.recent-activity small {
		display: block;
		color: var(--muted);
		margin-top: 5px;
	}
	.profile-rail p {
		font-size: 13px;
		color: var(--muted);
	}
	.profile-rail a {
		display: block;
		margin: 18px 0;
		color: var(--ink-2);
		font-size: 13px;
	}
	:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
	@media (max-width: 1023px) {
		.profile-grid {
			grid-template-columns: 1fr;
		}
		.profile-rail {
			display: none;
		}
	}
	@media (max-width: 600px) {
		.identity-band {
			grid-template-columns: 44px minmax(0, 1fr);
			padding: 16px;
			gap: 12px;
		}
		.preset-avatar {
			width: 44px;
			height: 44px;
			font-size: 26px;
		}
		.identity-name h1 {
			overflow-wrap: anywhere;
			font-size: 26px;
		}
		.identity-actions {
			grid-column: 1/-1;
		}
		.identity-actions a {
			flex: 1;
		}
		.profile-tabs {
			gap: 18px;
		}
		.profile-tabs button {
			font-size: 12px;
		}
		.aggregate-strip {
			gap: 8px;
		}
		.aggregate-strip > div {
			padding: 10px;
		}
		.aggregate-strip strong {
			font-size: 24px;
		}
		.aggregate-strip span {
			font-size: 10px;
		}
		.foundation-card {
			padding: 16px;
		}
		.family-head,
		.family-row {
			grid-template-columns: minmax(100px, 1.3fr) 1fr 0.5fr;
			gap: 10px;
		}
		.family-head > span:last-child,
		.family-row > span:last-child {
			display: none;
		}
		.family-head {
			font-size: 9px;
		}
		.family-row {
			font-size: 12px;
		}
		.family-name {
			gap: 8px;
		}
		.family-name i {
			width: 18px;
			height: 18px;
			flex-shrink: 0;
		}
	}
</style>
