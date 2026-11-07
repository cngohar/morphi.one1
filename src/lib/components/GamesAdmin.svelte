<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { familyName } from '#lib/ui/puzzle-presentation.js';
	import { dismissOnBackdrop } from '#lib/ui/dismiss-dialog.js';
	import { puzzleMetadata } from '#lib/puzzle-metadata.js';
	import { puzzleVariant } from '#lib/scoring.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { can } from '#lib/operator-permissions.js';
	import AccountForm from '#lib/components/account/AccountForm.svelte';
	import AdminTestPlay from '#lib/components/AdminTestPlay.svelte';
	import GameSwitch from '#lib/components/GameSwitch.svelte';
	import MemoryDirectory from '#lib/components/MemoryDirectory.svelte';
	import MemoryPolicy from '#lib/components/MemoryPolicy.svelte';
	import ScoringEditor from '#lib/components/ScoringEditor.svelte';
	import type { PageData } from '../../routes/admin/[view]/$types';

	let {
		data,
		reason
	}: {
		data: Pick<
			PageData,
			| 'actor'
			| 'gameFamilies'
			| 'selectedGame'
			| 'gamesOverview'
			| 'games'
			| 'subview'
			| 'gameStats'
			| 'memoryPolicy'
			| 'memoryDirectory'
			| 'directoryFilter'
			| 'testPlayFamilies'
			| 'scoring'
		>;
		reason: Snippet;
	} = $props();
	const activityMetrics = ['shown', 'ignored', 'played', 'abandoned', 'finished', 'open'] as const;
	type VariantStat = NonNullable<PageData['gameStats']>['variants'][number];
	let inspectedVariant = $state<VariantStat | null>(null);
	let variantDrawer = $state<HTMLDialogElement>();
	let variantTriggerEl = $state<HTMLButtonElement | null>(null);
	let variantDrawerFailed = $state(false);

	let historyPage = $state(0);
	const historyPageSize = 10;
	let pagedHistoryRows = $derived(
		(data.gameStats.rows ?? []).slice(
			historyPage * historyPageSize,
			(historyPage + 1) * historyPageSize
		)
	);
	let totalHistoryPages = $derived(
		Math.max(1, Math.ceil((data.gameStats.rows ?? []).length / historyPageSize))
	);

	let drawerHistoryPage = $state(0);
	const drawerHistoryPageSize = 10;
	let pagedDrawerRows = $derived(
		(inspectedVariant?.rows ?? []).slice(
			drawerHistoryPage * drawerHistoryPageSize,
			(drawerHistoryPage + 1) * drawerHistoryPageSize
		)
	);
	let totalDrawerHistoryPages = $derived(
		Math.max(1, Math.ceil((inspectedVariant?.rows ?? []).length / drawerHistoryPageSize))
	);

	async function openVariantDrawer(variant: VariantStat, event: MouseEvent) {
		try {
			variantDrawerFailed = false;
			inspectedVariant = variant;
			drawerHistoryPage = 0;
			variantTriggerEl = event.currentTarget as HTMLButtonElement;
			await tick();
			variantDrawer?.showModal();
		} catch {
			console.error('morphi:variant_drawer_dialog_failed');
			variantDrawerFailed = true;
		}
	}
	function closeVariantDrawer() {
		try {
			variantDrawer?.close();
		} catch {
			console.error('morphi:variant_drawer_dialog_failed');
			variantDrawerFailed = true;
		}
	}
	function trapVariantTab(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;
		try {
			const controls = [
				...variantDrawer!.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(
					'button:enabled, a[href]'
				)
			].filter(
				(control) =>
					control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden'
			);
			const first = controls[0],
				last = controls.at(-1);
			if (!first || !last) {
				event.preventDefault();
				return;
			}
			if (document.activeElement === (event.shiftKey ? first : last)) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			}
		} catch {
			event.preventDefault();
			console.error('morphi:variant_drawer_focus_failed');
			variantDrawerFailed = true;
		}
	}
	async function restoreVariantFocus() {
		try {
			inspectedVariant = null;
			await tick();
			if (variantTriggerEl?.isConnected && !variantDrawer?.open) variantTriggerEl.focus();
		} catch {
			console.error('morphi:variant_drawer_focus_failed');
			variantDrawerFailed = true;
		}
	}
</script>

<nav class="section-tabs" aria-label={t('v1.admin.games.section')}>
	<a
		class:active={!data.selectedGame}
		aria-current={!data.selectedGame ? 'page' : undefined}
		href={resolve('/admin/[view]', { view: 'games' })}>{t('v1.admin.games.overview')}</a
	>
	{#each data.gameFamilies as family (family)}<a
			class:active={data.selectedGame === family}
			aria-current={data.selectedGame === family ? 'page' : undefined}
			href="{resolve('/admin/[view]', { view: 'games' })}?game={family}">{familyName(family)}</a
		>{/each}
</nav>
{#if !data.selectedGame}
	{#if data.gamesOverview}
		<div class="metric-grid">
			<article class="metric">
				<p>{t('admin.games.families')}</p>
				<strong>{data.gamesOverview.families.total}</strong>
				<p>{t('admin.games.familyStates', data.gamesOverview.families)}</p>
			</article>
			<article class="metric">
				<p>{t('admin.variants.title')}</p>
				<strong>{data.gamesOverview.variants.total}</strong>
				<p>{t('admin.games.enabledCount', data.gamesOverview.variants)}</p>
			</article>
			{#each activityMetrics as metric (metric)}<article class="metric">
					<p>{t(`admin.variants.${metric}` as MessageKey)}</p>
					<strong>{data.gamesOverview.totals[metric]}</strong>
				</article>{/each}
			<article class="metric">
				<p>{t('admin.games.totalCompleted')}</p>
				<strong>{data.gamesOverview.totals.totalCompleted}</strong>
				<p>
					{t('v1.admin.games.ranked')}: {data.gamesOverview.totals.ranked} · {t(
						'v1.admin.games.solo'
					)}: {data.gamesOverview.totals.totalCompleted - data.gamesOverview.totals.ranked}
				</p>
			</article>
		</div>
		<p>
			{t('admin.games.overviewNote', {
				time: new Date(data.gamesOverview.updatedAt).toISOString()
			})}
		</p>
	{/if}
	<div class="game-list">
		{#each data.games as game (game.family)}<a
				class="admin-card game-row"
				href="{resolve('/admin/[view]', { view: 'games' })}?game={game.family}"
			>
				<div>
					<h2>{familyName(game.family)}</h2>
					<span class="state-badge">{t(`v1.admin.games.${game.state}` as MessageKey)}</span>
				</div>
				<dl class="variant-counts">
					<div>
						<dt>{t('admin.variants.title')}</dt>
						<dd>{game.variantCount}</dd>
					</div>
					<div>
						<dt>{t('admin.variants.played')}</dt>
						<dd>{game.played}</dd>
					</div>
					<div>
						<dt>{t('admin.variants.finished')}</dt>
						<dd>{game.finished}</dd>
					</div>
					<div>
						<dt>{t('admin.games.totalCompleted')}</dt>
						<dd>{game.totalCompleted}</dd>
					</div>
				</dl>
			</a>{/each}
	</div>
{:else}
	{#each data.games.filter((game) => game.family === data.selectedGame) as game (game.family)}
		<header class="game-heading">
			<div>
				<h2>{familyName(game.family)}</h2>
				<span class="state-badge">{t(`v1.admin.games.${game.state}` as MessageKey)}</span>
			</div>
			{#if game.state === 'enabled' || game.state === 'disabled'}<GameSwitch
					family={game.family}
					enabled={game.state === 'enabled'}
					allowed={can(data.actor.role, game.state === 'enabled' ? 'game-disable' : 'game-enable')}
				/>{/if}
		</header>
		<nav class="section-tabs" aria-label={t('v1.admin.games.detailSections')}>
			<a
				class:active={!data.subview ||
					(data.subview !== 'scoring' &&
						data.subview !== 'settings' &&
						data.subview !== 'policy' &&
						data.subview !== 'directory')}
				href="{resolve('/admin/[view]', { view: 'games' })}?game={game.family}"
				>{t('v1.admin.games.statistics')}</a
			>
			{#if game.family === 'memory'}<a
					class:active={data.subview === 'directory'}
					href="{resolve('/admin/[view]', { view: 'games' })}?game=memory&subview=directory"
					>{t('admin.directory.title')}</a
				>{/if}<a
				class:active={data.subview === 'scoring'}
				href="{resolve('/admin/[view]', {
					view: 'games'
				})}?game={game.family}&subview=scoring">{t('v1.admin.nav.scoring')}</a
			>
			{#if game.family === 'memory'}<a
					class:active={data.subview === 'policy'}
					href="{resolve('/admin/[view]', { view: 'games' })}?game=memory&subview=policy"
					>{t('policy.title')}</a
				>{/if}<a
				class:active={data.subview === 'settings'}
				href="{resolve('/admin/[view]', {
					view: 'games'
				})}?game={game.family}&subview=settings">{t('v1.admin.games.settings')}</a
			>
		</nav>
		<section class="admin-card">
			{#if data.subview === 'directory' && game.family === 'memory' && data.memoryDirectory}
				<MemoryDirectory
					directory={data.memoryDirectory}
					role={data.actor.role}
					familyEnabled={game.state === 'enabled'}
					filterParams={data.directoryFilter}
					{reason}
				/>
			{:else if data.subview === 'policy' && data.memoryPolicy}
				<MemoryPolicy
					policy={data.memoryPolicy}
					role={data.actor.role}
					familyEnabled={game.state === 'enabled'}
				/>
			{:else if data.subview === 'settings'}
				{#if game.restoreUntil}<p>
						{t('v1.admin.users.deadline')}: {new Date(game.restoreUntil).toISOString()}
					</p>{/if}
				{#if game.state !== 'hard-deleted'}
					{#if game.state === 'deleted'}<AccountForm
							>{#snippet children(pending)}<input
									type="hidden"
									name="target"
									value={game.family}
								/><input
									type="hidden"
									name="action"
									value={game.restoreUntil && game.restoreUntil > Date.now()
										? 'game-restore'
										: 'game-hard-delete'}
								/>{@render reason()}<button class="btn primary" disabled={pending}
									>{t(
										game.restoreUntil && game.restoreUntil > Date.now()
											? 'v1.admin.games.restore'
											: 'v1.admin.games.hardDelete'
									)}</button
								>{/snippet}</AccountForm
						>{/if}
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
				<p>{t('admin.variants.registered')}</p>
				<p>{t('admin.variants.reconcile')}</p>
				<dl class="variant-counts">
					{#each activityMetrics as metric (metric)}<div>
							<dt>{t(`admin.variants.${metric}` as MessageKey)}</dt>
							<dd>{game[metric]}</dd>
						</div>{/each}
					<div>
						<dt>{t('admin.games.totalCompleted')}</dt>
						<dd>{game.totalCompleted}</dd>
					</div>
				</dl>
				<p>
					{t('v1.admin.games.ranked')}: {game.ranked} · {t('v1.admin.games.solo')}: {game.totalCompleted -
						game.ranked}
				</p>
				<div class="table-wrap game-stats-table">
					<table>
						<thead>
							<tr>
								<th>{t('v1.admin.games.rulesGroup')}</th>
								<th>{t('v1.admin.games.version')}</th>
								<th>{t('v1.admin.games.completed')}</th>
								<th>{t('v1.admin.games.ranked')}</th>
								<th>{t('v1.admin.games.solo')}</th>
								<th>{t('v1.admin.games.best')}</th>
								<th>{t('v1.admin.games.average')}</th>
								<th>{t('v1.admin.games.duration')}</th>
								<th>{t('v1.admin.games.hidden')}</th>
							</tr>
						</thead>
						<tbody>
							{#each pagedHistoryRows as row (`${row.rules_group}:${row.score_config_version}`)}
								<tr>
									<td>{row.rules_group}</td>
									<td>{row.score_config_version}</td>
									<td>{row.completed}</td>
									<td>{row.ranked}</td>
									<td>{row.completed - row.ranked}</td>
									<td>{row.bestScore}</td>
									<td>{row.averageScore.toFixed(1)}</td>
									<td>{row.averageSeconds.toFixed(1)}</td>
									<td>{row.hidden}</td>
								</tr>
							{:else}
								<tr><td colspan="9">{t('v1.admin.empty')}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if (data.gameStats.rows ?? []).length > 0}
					<nav class="pagination" aria-label={t('admin.variants.historyNav')}>
						<span>
							{t('admin.variants.historyStatus', {
								current: historyPage + 1,
								total: totalHistoryPages,
								count: data.gameStats.rows.length
							})}
						</span>
						<button
							type="button"
							class="btn"
							disabled={historyPage === 0}
							onclick={() => (historyPage = 0)}
						>
							{t('admin.variants.first')}
						</button>
						<button
							type="button"
							class="btn"
							disabled={historyPage === 0}
							onclick={() => (historyPage = Math.max(0, historyPage - 1))}
						>
							{t('admin.variants.previous')}
						</button>
						<button
							type="button"
							class="btn"
							disabled={historyPage >= totalHistoryPages - 1}
							onclick={() => (historyPage = Math.min(totalHistoryPages - 1, historyPage + 1))}
						>
							{t('admin.variants.next')}
						</button>
						<button
							type="button"
							class="btn"
							disabled={historyPage >= totalHistoryPages - 1}
							onclick={() => (historyPage = totalHistoryPages - 1)}
						>
							{t('admin.variants.last')}
						</button>
					</nav>
				{/if}
				{#if data.gameStats.more}<p>{t('v1.admin.games.limited')}</p>{/if}
			{/if}
		</section>
		{#if data.subview !== 'policy' && data.subview !== 'directory' && (data.gameStats.variants.length || (data.gameStats.totalVariants ?? 0) > 0)}
			<section class="admin-card variant-section">
				<h2>{t('admin.variants.title')}</h2>
				{#if data.subview === 'settings'}
					<p>{t('admin.variants.registered')}</p>
					<p>{t('admin.variants.reconcile')}</p>
				{/if}
				{#if data.gameStats.variants.length === 0}
					<div class="empty-variants" role="status">
						<p>{t('admin.variants.emptyPage')}</p>
						<a
							class="btn"
							href="{resolve('/admin/[view]', { view: 'games' })}?game={game.family}&variant_page=0"
						>
							{t('admin.variants.returnFirst')}
						</a>
					</div>
				{:else}
					<div class="variant-list">
						{#each data.gameStats.variants as variant (variant.id)}
							{@const def = puzzleVariant(game.family, variant.id)}
							{@const playRate =
								variant.shown > 0 ? `${Math.round((variant.played / variant.shown) * 100)}%` : '—'}
							<div class="variant-row" data-variant={variant.id}>
								<div class="variant-row-header">
									<div class="variant-name-group">
										<span class="variant-title">{t(def!.name as MessageKey)}</span>
										<code class="variant-slug">{variant.id}</code>
										<span class="pill status-pill status-{variant.state}">
											{t(`v1.admin.games.${variant.state}` as MessageKey)}
										</span>
									</div>
									<div class="variant-row-stats">
										<div class="stat-col">
											<span class="stat-label">{t('admin.variants.shown')}</span>
											<span class="stat-val">{variant.shown}</span>
										</div>
										<div class="stat-col">
											<span class="stat-label">{t('admin.variants.played')}</span>
											<span class="stat-val">{variant.played}</span>
										</div>
										<div class="stat-col">
											<span class="stat-label">{t('admin.variants.playRate')}</span>
											<span class="stat-val">{playRate}</span>
										</div>
										<div class="stat-col">
											<span class="stat-label">{t('admin.games.totalCompleted')}</span>
											<span class="stat-val">{variant.totalCompleted}</span>
										</div>
									</div>
									<div class="variant-actions">
										<button
											type="button"
											class="btn inspect-btn"
											aria-haspopup="dialog"
											onclick={(e) => openVariantDrawer(variant, e)}
										>
											{t('admin.variants.inspect')}
										</button>
										{#if can(data.actor.role, variant.state === 'enabled' ? 'variant-disable' : 'variant-enable')}
											<AccountForm>
												{#snippet children(pending)}
													<input type="hidden" name="target" value={game.family} />
													<input type="hidden" name="variant" value={variant.id} />
													<input
														type="hidden"
														name="action"
														value={variant.state === 'enabled'
															? 'variant-disable'
															: 'variant-enable'}
													/>
													{#if variant.state === 'enabled'}
														<label class="reason-field">
															{t('v1.operator.reason')}
															<input
																name="reason"
																required
																minlength="3"
																maxlength="240"
																placeholder={t('admin.variants.disableReason')}
															/>
														</label>
													{/if}
													<label class="confirm">
														<input type="checkbox" name="confirm" value="yes" required />
														{t('admin.variants.confirm')}
													</label>
													<button class="btn" disabled={pending}>
														{t(
															variant.state === 'enabled'
																? 'admin.variants.disable'
																: 'admin.variants.enable'
														)}
													</button>
												{/snippet}
											</AccountForm>
										{/if}
									</div>
								</div>
								<p class="reconciliation-line">
									{t('admin.variants.completedTotal', {
										total: variant.totalCompleted,
										finished: variant.finished,
										imported: variant.imported
									})}
								</p>
							</div>
						{/each}
					</div>
					{#if (data.gameStats.totalVariants ?? 0) > 0}
						{@const currentPage = data.gameStats.variantPage ?? 0}
						{@const totalPages = data.gameStats.totalVariantPages ?? 1}
						{@const totalVariants = data.gameStats.totalVariants ?? data.gameStats.variants.length}
						<nav class="pagination" aria-label={t('admin.variants.pageNav')}>
							<span>
								{t('admin.variants.pageStatus', {
									current: currentPage + 1,
									total: totalPages,
									count: totalVariants
								})}
							</span>
							<a
								class="btn"
								class:disabled={currentPage === 0}
								aria-disabled={currentPage === 0 ? 'true' : undefined}
								tabindex={currentPage === 0 ? -1 : undefined}
								href="{resolve('/admin/[view]', {
									view: 'games'
								})}?game={game.family}&variant_page=0"
							>
								{t('admin.variants.first')}
							</a>
							<a
								class="btn"
								class:disabled={currentPage === 0}
								aria-disabled={currentPage === 0 ? 'true' : undefined}
								tabindex={currentPage === 0 ? -1 : undefined}
								href="{resolve('/admin/[view]', {
									view: 'games'
								})}?game={game.family}&variant_page={Math.max(0, currentPage - 1)}"
							>
								{t('admin.variants.previous')}
							</a>
							<a
								class="btn"
								class:disabled={currentPage >= totalPages - 1}
								aria-disabled={currentPage >= totalPages - 1 ? 'true' : undefined}
								tabindex={currentPage >= totalPages - 1 ? -1 : undefined}
								href="{resolve('/admin/[view]', {
									view: 'games'
								})}?game={game.family}&variant_page={Math.min(totalPages - 1, currentPage + 1)}"
							>
								{t('admin.variants.next')}
							</a>
							<a
								class="btn"
								class:disabled={currentPage >= totalPages - 1}
								aria-disabled={currentPage >= totalPages - 1 ? 'true' : undefined}
								tabindex={currentPage >= totalPages - 1 ? -1 : undefined}
								href="{resolve('/admin/[view]', {
									view: 'games'
								})}?game={game.family}&variant_page={totalPages - 1}"
							>
								{t('admin.variants.last')}
							</a>
						</nav>
					{/if}
				{/if}

				{#if variantDrawerFailed}<p role="alert">{t('v1.admin.error')}</p>{/if}
				<dialog
					bind:this={variantDrawer}
					use:dismissOnBackdrop={closeVariantDrawer}
					onclose={restoreVariantFocus}
					onkeydown={trapVariantTab}
					class="variant-drawer"
					aria-labelledby="variant-drawer-title"
				>
					{#if inspectedVariant}
						{@const def = puzzleVariant(game.family, inspectedVariant.id)}
						{#if variantDrawerFailed}<p role="alert">{t('v1.admin.error')}</p>{/if}
						<div class="drawer-header">
							<button
								type="button"
								class="btn drawer-close"
								onclick={closeVariantDrawer}
								aria-label={t('admin.variants.closeDetails')}
							>
								{t('v1.admin.users.close')}
							</button>
							<p class="drawer-kicker">{familyName(game.family)}</p>
							<h2 id="variant-drawer-title">{t(def!.name as MessageKey)}</h2>
							<code class="variant-slug">{inspectedVariant.id}</code>
							<span class="pill status-pill status-{inspectedVariant.state}">
								{t(`v1.admin.games.${inspectedVariant.state}` as MessageKey)}
							</span>
						</div>

						<div class="drawer-description">
							{#each (def?.help ?? puzzleMetadata[game.family].presentation!.help).steps as step (step)}
								<p>{t(step as MessageKey)}</p>
							{/each}
						</div>
						<div class="drawer-metrics">
							<h3>{t('admin.variants.telemetry')}</h3>
							<dl class="variant-counts">
								{#each ['shown', 'ignored', 'played', 'abandoned', 'finished', 'open'] as metric (metric)}
									<div>
										<dt>{t(`admin.variants.${metric}` as MessageKey)}</dt>
										<dd>
											{inspectedVariant[
												metric as 'shown' | 'ignored' | 'played' | 'abandoned' | 'finished' | 'open'
											]}
										</dd>
									</div>
								{/each}
							</dl>
							<p>
								{t('admin.variants.imported')}: <strong>{inspectedVariant.imported}</strong>
							</p>
							<p>{t('admin.variants.importedNote')}</p>
						</div>

						<div class="drawer-section">
							<a
								class="btn drawer-scoring-link"
								href="{resolve('/admin/[view]', {
									view: 'games'
								})}?game={encodeURIComponent(game.family)}&subview=scoring"
							>
								{t('admin.variants.sharedScoring')}
							</a>
						</div>

						<div class="drawer-rules">
							<h3>{t('v1.admin.games.rulesGroup')}</h3>
							<div class="table-wrap game-stats-table">
								<table>
									<thead>
										<tr>
											{#each ['rulesGroup', 'version', 'completed', 'ranked', 'solo', 'best', 'average', 'duration'] as heading (heading)}
												<th>{t(`v1.admin.games.${heading}` as MessageKey)}</th>
											{/each}
										</tr>
									</thead>
									<tbody>
										{#each pagedDrawerRows as row (`${row.rules_group}:${row.score_config_version}`)}
											<tr>
												<td>{row.rules_group}</td>
												<td>{row.score_config_version}</td>
												<td>{row.completed}</td>
												<td>{row.ranked}</td>
												<td>{row.completed - row.ranked}</td>
												<td>{row.bestScore}</td>
												<td>{row.averageScore.toFixed(1)}</td>
												<td>{row.averageSeconds.toFixed(1)}</td>
											</tr>
										{:else}
											<tr><td colspan="8">{t('v1.admin.empty')}</td></tr>
										{/each}
									</tbody>
								</table>
							</div>
							{#if (inspectedVariant.rows ?? []).length > 0}
								<nav class="pagination" aria-label={t('admin.variants.detailHistoryNav')}>
									<span>
										{t('admin.variants.historyStatus', {
											current: drawerHistoryPage + 1,
											total: totalDrawerHistoryPages,
											count: inspectedVariant.rows.length
										})}
									</span>
									<button
										type="button"
										class="btn"
										disabled={drawerHistoryPage === 0}
										onclick={() => (drawerHistoryPage = 0)}
									>
										{t('admin.variants.first')}
									</button>
									<button
										type="button"
										class="btn"
										disabled={drawerHistoryPage === 0}
										onclick={() => (drawerHistoryPage = Math.max(0, drawerHistoryPage - 1))}
									>
										{t('admin.variants.previous')}
									</button>
									<button
										type="button"
										class="btn"
										disabled={drawerHistoryPage >= totalDrawerHistoryPages - 1}
										onclick={() =>
											(drawerHistoryPage = Math.min(
												totalDrawerHistoryPages - 1,
												drawerHistoryPage + 1
											))}
									>
										{t('admin.variants.next')}
									</button>
									<button
										type="button"
										class="btn"
										disabled={drawerHistoryPage >= totalDrawerHistoryPages - 1}
										onclick={() => (drawerHistoryPage = totalDrawerHistoryPages - 1)}
									>
										{t('admin.variants.last')}
									</button>
								</nav>
							{/if}
							{#if inspectedVariant.more}
								<p>{t('v1.admin.games.limited')}</p>
							{/if}
						</div>
					{/if}
				</dialog>
			</section>
		{/if}
		{#if data.subview !== 'policy' && data.testPlayFamilies.some((family) => family === game.family)}<AdminTestPlay
				family={game.family}
				scoring={data.scoring}
			/>{/if}
		{#if data.subview === 'scoring' && (game.state === 'enabled' || game.state === 'disabled')}{#each data.scoring as config (`${config.family}:${config.variant ?? ''}:${config.version}`)}<ScoringEditor
					{config}
				/>{/each}{/if}
	{/each}
{/if}

<style>
	.game-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin: 24px 0 16px;
	}
	.game-heading h2,
	.game-row h2 {
		margin: 0 0 8px;
	}
	.state-badge {
		display: inline-block;
		padding: 4px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 12px;
	}
	.game-list {
		display: grid;
		gap: 12px;
	}
	.game-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}
	.game-row .variant-counts {
		flex: 1;
		min-width: 0;
		max-width: 640px;
		margin: 0;
	}
	@media (max-width: 700px) {
		.game-heading,
		.game-row {
			flex-direction: column;
			align-items: flex-start;
		}
		.game-row .variant-counts {
			width: 100%;
		}
	}

	.variant-section {
		container-type: inline-size;
	}
	.variant-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 16px;
	}
	.variant-row {
		padding: 16px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.variant-row-header {
		display: grid;
		grid-template-columns: minmax(140px, 1.2fr) minmax(240px, 2fr) auto;
		gap: 16px;
		align-items: center;
	}
	.variant-name-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-start;
	}
	.variant-title {
		font-weight: 800;
		font-size: 15px;
		color: var(--ink);
	}
	.variant-slug {
		font-size: 11px;
		color: var(--muted);
		font-family: monospace;
	}
	.status-pill {
		display: inline-block;
		font-size: 11px;
		font-weight: 800;
		padding: 2px 8px;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.status-pill.status-enabled {
		background: var(--chip-teal);
		color: var(--ink);
	}
	.status-pill.status-disabled {
		background: var(--danger);
		color: var(--surface);
	}
	.variant-row-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		text-align: center;
		background: var(--surface-2);
		padding: 8px 12px;
		border-radius: 6px;
	}
	.stat-col {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat-label {
		font-size: 10px;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.stat-val {
		font-size: 14px;
		font-weight: 800;
		color: var(--ink);
	}
	.variant-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.inspect-btn {
		cursor: pointer;
	}
	.reason-field {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
	}
	.reason-field input {
		font-size: 12px;
		padding: 4px 8px;
	}
	.reconciliation-line {
		margin: 0;
		font-size: 12px;
		color: var(--muted);
		line-height: 1.4;
		border-top: 1px dashed var(--border);
		padding-top: 8px;
	}
	@container (max-width: 600px) {
		.variant-row-header {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.variant-row-stats {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}
		.variant-actions {
			justify-content: flex-start;
		}
	}
	.variant-drawer {
		max-width: 100%;
		position: fixed;
		margin: 0 0 0 auto;
		inset: 0 0 0 auto;
		height: 100%;
		max-height: none;
		width: min(500px, 100%);
		border: 0;
		padding: 28px;
		background: var(--surface);
		color: var(--ink);
		overflow-y: auto;
		box-sizing: border-box;
	}
	.variant-drawer::backdrop {
		background: rgb(0 0 0 / 45%);
	}
	.variant-drawer h2 {
		overflow-wrap: anywhere;
		font-size: 20px;
		margin: 4px 0 12px;
	}
	.variant-drawer h3 {
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		margin: 20px 0 10px;
	}
	.drawer-header {
		margin-bottom: 20px;
	}
	.drawer-section {
		margin: 16px 0;
	}
	.drawer-scoring-link {
		text-decoration: none;
		display: inline-block;
	}
	.variant-counts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 12px;
	}
	.variant-counts dd {
		margin: 4px 0 0;
		font-size: 24px;
		font-weight: 800;
	}

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
	.game-row {
		text-decoration: none;
		margin: 0;
	}
	.game-row:hover {
		border-color: var(--primary);
	}
	.game-row span {
		color: var(--primary-strong);
		font-size: 13px;
		font-weight: 800;
	}
	.game-stats-table table {
		min-width: 980px;
	}
	.game-stats-table th {
		white-space: nowrap;
		background: var(--surface-2);
	}
	.drawer-kicker {
		margin: 24px 0 8px;
		color: var(--label);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 10px;
		font-weight: 800;
	}
	.drawer-close {
		float: right;
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
	.admin-card p,
	.admin-card :global(.form-note) {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.6;
		margin: 12px 0;
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
	input:not([type='checkbox']) {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		width: 100%;
		max-width: 600px;
		background: var(--surface);
		font-size: 14px;
	}
	.primary {
		background: var(--primary);
		color: var(--surface);
		border: 0;
	}
	a {
		color: var(--ink-2);
	}
	:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
	}
	.pagination {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin: 18px 0;
	}
	.pagination span {
		font-size: 13px;
		color: var(--muted);
		margin-right: auto;
	}
	.pagination .btn {
		text-decoration: none;
	}
	.pagination .btn.disabled,
	.pagination button:disabled {
		opacity: 0.5;
		pointer-events: none;
		cursor: default;
	}
	.empty-variants {
		padding: 22px;
		background: var(--surface-2);
		border-radius: 8px;
		margin: 14px 0;
	}
	@media (max-width: 900px) {
		.metric-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 600px) {
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
