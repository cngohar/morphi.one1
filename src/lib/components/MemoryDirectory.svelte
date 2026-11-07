<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { can } from '#lib/operator-permissions.js';
	import { dismissOnBackdrop } from '#lib/ui/dismiss-dialog.js';
	import AccountForm from '#lib/components/account/AccountForm.svelte';
	import type { MemoryDirectoryResult, DirectoryVariant } from '#lib/server/memory-directory.js';

	let {
		directory,
		role,
		familyEnabled,
		filterParams,
		reason
	}: {
		directory: MemoryDirectoryResult;
		role: string;
		familyEnabled: boolean;
		filterParams: {
			q: string;
			status: string;
			archetype: string;
			source: string;
		};
		reason: Snippet;
	} = $props();

	let inspectedVariant = $state<DirectoryVariant | null>(null);
	let drawer = $state<HTMLDialogElement>();
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let searchQuery = $state(filterParams.q);

	$effect(() => {
		searchQuery = filterParams.q;
	});

	async function openDrawer(variant: DirectoryVariant, event: MouseEvent) {
		inspectedVariant = variant;
		triggerEl = event.currentTarget as HTMLButtonElement;
		await tick();
		drawer?.showModal();
	}

	function closeDrawer() {
		drawer?.close();
	}

	async function restoreFocus() {
		inspectedVariant = null;
		await tick();
		if (triggerEl?.isConnected && !drawer?.open) triggerEl.focus();
	}

	function trapTab(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;
		try {
			const controls = [
				...drawer!.querySelectorAll<HTMLButtonElement | HTMLAnchorElement | HTMLInputElement>(
					'button:enabled, a[href], input:enabled'
				)
			].filter(
				(control) =>
					control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden'
			);
			const first = controls[0];
			const last = controls.at(-1);
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
		}
	}

	function filterQuery(cursor?: string) {
		const parts = ['game=memory', 'subview=directory'];
		if (filterParams.q) parts.push(`q=${encodeURIComponent(filterParams.q)}`);
		if (filterParams.status && filterParams.status !== 'all')
			parts.push(`status=${encodeURIComponent(filterParams.status)}`);
		if (filterParams.archetype && filterParams.archetype !== 'all')
			parts.push(`archetype=${encodeURIComponent(filterParams.archetype)}`);
		if (filterParams.source && filterParams.source !== 'all')
			parts.push(`source=${encodeURIComponent(filterParams.source)}`);
		if (cursor) parts.push(`cursor=${encodeURIComponent(cursor)}`);
		return parts.join('&');
	}
</script>

<div class="directory-container">
	<p class="hint">{t('admin.directory.intro')}</p>

	<!-- Multi-Filter Toolbar -->
	<form
		method="GET"
		action={resolve('/admin/[view]', { view: 'games' })}
		class="filter-bar"
		role="search"
		aria-label="Directory filters"
	>
		<input type="hidden" name="game" value="memory" />
		<input type="hidden" name="subview" value="directory" />

		<input
			type="search"
			name="q"
			bind:value={searchQuery}
			placeholder={t('admin.directory.search')}
			aria-label="Search variant"
		/>

		<select
			name="status"
			aria-label="Filter by status"
			onchange={(e) => e.currentTarget.form?.submit()}
		>
			<option value="all" selected={filterParams.status === 'all'}
				>{t('admin.directory.statusAll')}</option
			>
			<option value="enabled" selected={filterParams.status === 'enabled'}
				>{t('admin.directory.statusEnabled')}</option
			>
			<option value="disabled" selected={filterParams.status === 'disabled'}
				>{t('admin.directory.statusDisabled')}</option
			>
			<option value="blocked" selected={filterParams.status === 'blocked'}
				>{t('admin.directory.statusBlocked')}</option
			>
			<option value="unplayed" selected={filterParams.status === 'unplayed'}
				>{t('admin.directory.statusUnplayed')}</option
			>
		</select>

		<select
			name="archetype"
			aria-label="Filter by archetype"
			onchange={(e) => e.currentTarget.form?.submit()}
		>
			<option value="all" selected={filterParams.archetype === 'all'}
				>{t('admin.directory.archetypeAll')}</option
			>
			<option value="core" selected={filterParams.archetype === 'core'}>{t('policy.core')}</option>
			<option value="information" selected={filterParams.archetype === 'information'}
				>{t('policy.information')}</option
			>
			<option value="grouping" selected={filterParams.archetype === 'grouping'}
				>{t('policy.grouping')}</option
			>
			<option value="dynamics" selected={filterParams.archetype === 'dynamics'}
				>{t('policy.dynamics')}</option
			>
			<option value="pressure" selected={filterParams.archetype === 'pressure'}
				>{t('policy.pressure')}</option
			>
			<option value="constraints" selected={filterParams.archetype === 'constraints'}
				>{t('policy.constraints')}</option
			>
		</select>

		<select
			name="source"
			aria-label="Filter by source"
			onchange={(e) => e.currentTarget.form?.submit()}
		>
			<option value="all" selected={filterParams.source === 'all'}
				>{t('admin.directory.sourceAll')}</option
			>
			<option value="curated" selected={filterParams.source === 'curated'}
				>{t('admin.directory.sourceCurated')}</option
			>
			<option value="observed" selected={filterParams.source === 'observed'}
				>{t('admin.directory.sourceObserved')}</option
			>
		</select>

		<div class="filter-actions">
			<button type="submit" class="btn sm primary">Filter</button>
			<a
				href="{resolve('/admin/[view]', { view: 'games' })}?game=memory&subview=directory"
				class="btn sm"
			>
				{t('admin.directory.reset')}
			</a>
		</div>
	</form>

	<!-- Directory Summary Bar -->
	<div class="dir-summary" aria-live="polite">
		<span>
			{t('admin.directory.summary', {
				start: directory.total ? directory.page * directory.pageSize + 1 : 0,
				end: Math.min((directory.page + 1) * directory.pageSize, directory.total),
				total: directory.total
			})}
		</span>
		<span class="muted">
			{t('admin.directory.curatedCount', { count: directory.curatedCount })}
		</span>
	</div>

	<!-- Variants List / Empty State -->
	{#if directory.items.length === 0}
		<div class="empty-box" role="status">
			<p>{t('admin.directory.empty')}</p>
			<a
				href="{resolve('/admin/[view]', { view: 'games' })}?game=memory&subview=directory"
				class="btn sm"
			>
				{t('admin.directory.clearFilters')}
			</a>
		</div>
	{:else}
		<div class="variant-list">
			{#each directory.items as item (item.id)}
				{@const playRate =
					item.shown > 0 ? `${Math.round((item.played / item.shown) * 100)}%` : '—'}
				<article class="variant-row" data-id={item.id}>
					<div class="v-info">
						<strong>{item.nameKey ? t(item.nameKey as MessageKey) : item.name}</strong>
						<code>{item.id}</code>
						<div class="v-badges">
							<span class="pill source-{item.source}">
								{t(
									item.source === 'curated' ? 'admin.directory.curated' : 'admin.directory.observed'
								)}
							</span>
							<span class="pill status-{item.state}">
								{item.state === 'enabled'
									? t('v1.admin.games.enabled')
									: item.state === 'disabled'
										? t('v1.admin.games.disabled')
										: item.state === 'blocked'
											? t('policy.groupDisabled')
											: t('admin.directory.statusUnplayed')}
							</span>
							<span class="pill archetype">{t(item.archetypeKey as MessageKey)}</span>
						</div>
					</div>

					<div class="v-dims">
						{#each item.dims as dim (dim.key)}
							<span class="dim-tag" class:blocked={dim.isBlocked}>
								{t(dim.labelKey as MessageKey)}: {t(dim.valueLabelKey as MessageKey)}
							</span>
						{/each}
					</div>

					<div class="v-stats">
						<div>
							<small>{t('admin.variants.shown')}</small>
							<strong>{item.shown}</strong>
						</div>
						<div>
							<small>{t('admin.variants.played')}</small>
							<strong>{item.played}</strong>
						</div>
						<div>
							<small>{t('admin.variants.playRate')}</small>
							<strong>{playRate}</strong>
						</div>
					</div>

					<div class="v-actions">
						<button
							type="button"
							class="btn sm"
							onclick={(e) => openDrawer(item, e)}
							aria-haspopup="dialog"
						>
							{t('admin.variants.inspect')}
						</button>
						{#if can(role, item.lifecycleState === 'enabled' ? 'variant-disable' : 'variant-enable')}
							<AccountForm>
								{#snippet children(pending)}
									<input type="hidden" name="target" value="memory" />
									<input type="hidden" name="variant" value={item.id} />
									<input
										type="hidden"
										name="action"
										value={item.lifecycleState === 'enabled' ? 'variant-disable' : 'variant-enable'}
									/>
									{@render reason()}
									<input type="hidden" name="confirm" value="yes" />
									<button class="btn sm" disabled={pending || !familyEnabled}>
										{t(
											item.lifecycleState === 'enabled'
												? 'admin.variants.disable'
												: 'admin.variants.enable'
										)}
									</button>
								{/snippet}
							</AccountForm>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		<!-- Keyset / Cursor Pagination Bar -->
		<nav class="pagination" aria-label="Directory pagination">
			<span class="status-text">
				{t('admin.directory.boundedPage', {
					page: directory.page + 1,
					total: directory.totalPages
				})}
			</span>
			<span class="cursor-badge" title="Opaque keyset cursor token">
				cursor:{directory.cursorToken ? directory.cursorToken.slice(0, 16) + '…' : 'none'}
			</span>
			<a
				class="btn"
				class:disabled={directory.page === 0}
				aria-disabled={directory.page === 0 ? 'true' : undefined}
				tabindex={directory.page === 0 ? -1 : undefined}
				href="{resolve('/admin/[view]', { view: 'games' })}?{filterQuery(directory.firstCursor)}"
			>
				{t('admin.variants.first')}
			</a>
			<a
				class="btn"
				class:disabled={!directory.prevCursor}
				aria-disabled={!directory.prevCursor ? 'true' : undefined}
				tabindex={!directory.prevCursor ? -1 : undefined}
				href="{resolve('/admin/[view]', { view: 'games' })}?{filterQuery(directory.prevCursor)}"
			>
				{t('admin.variants.previous')}
			</a>
			<a
				class="btn"
				class:disabled={!directory.nextCursor}
				aria-disabled={!directory.nextCursor ? 'true' : undefined}
				tabindex={!directory.nextCursor ? -1 : undefined}
				href="{resolve('/admin/[view]', { view: 'games' })}?{filterQuery(directory.nextCursor)}"
			>
				{t('admin.variants.next')}
			</a>
			<a
				class="btn"
				class:disabled={directory.page >= directory.totalPages - 1}
				aria-disabled={directory.page >= directory.totalPages - 1 ? 'true' : undefined}
				tabindex={directory.page >= directory.totalPages - 1 ? -1 : undefined}
				href="{resolve('/admin/[view]', { view: 'games' })}?{filterQuery(directory.lastCursor)}"
			>
				{t('admin.variants.last')}
			</a>
		</nav>
	{/if}
</div>

<!-- Accessible Inspection Drawer Dialog -->
<dialog
	bind:this={drawer}
	use:dismissOnBackdrop={closeDrawer}
	onclose={restoreFocus}
	onkeydown={trapTab}
	class="drawer"
	aria-labelledby="drawer-title"
>
	{#if inspectedVariant}
		<div class="drawer-header">
			<div>
				<span class="pill source-{inspectedVariant.source}">
					{t(
						inspectedVariant.source === 'curated'
							? 'admin.directory.curated'
							: 'admin.directory.observed'
					)}
				</span>
				<h2 id="drawer-title">
					{inspectedVariant.nameKey
						? t(inspectedVariant.nameKey as MessageKey)
						: inspectedVariant.name}
				</h2>
				<code>{inspectedVariant.id}</code>
			</div>
			<button
				type="button"
				class="btn sm"
				onclick={closeDrawer}
				aria-label={t('admin.variants.closeDetails')}
			>
				{t('v1.admin.users.close')}
			</button>
		</div>

		<div class="drawer-section">
			<span class="pill status-{inspectedVariant.state}">
				{inspectedVariant.state === 'enabled'
					? t('v1.admin.games.enabled')
					: inspectedVariant.state === 'disabled'
						? t('v1.admin.games.disabled')
						: inspectedVariant.state === 'blocked'
							? t('policy.groupDisabled')
							: t('admin.directory.statusUnplayed')}
			</span>
			<span class="pill archetype">{t(inspectedVariant.archetypeKey as MessageKey)}</span>

			{#if inspectedVariant.policyBlocker}
				<div class="policy-warning" role="alert">
					{t('admin.directory.policyBlockerWarning', {
						blocker: inspectedVariant.policyBlocker
					})}
				</div>
			{/if}
		</div>

		<div class="drawer-section">
			<h3>{t('admin.directory.dimensions')}</h3>
			<div class="dim-grid">
				{#each inspectedVariant.dims as dim (dim.key)}
					<div class="dim-card" class:is-blocked={dim.isBlocked}>
						<small>{t(dim.labelKey as MessageKey)}</small>
						<strong>{t(dim.valueLabelKey as MessageKey)}</strong>
					</div>
				{/each}
			</div>
		</div>

		<div class="drawer-section">
			<h3>{t('admin.variants.telemetry')}</h3>
			<div class="v-stats" style="grid-template-columns:repeat(4,1fr);padding:12px">
				<div>
					<small>{t('admin.variants.shown')}</small>
					<strong>{inspectedVariant.shown}</strong>
				</div>
				<div>
					<small>{t('admin.variants.played')}</small>
					<strong>{inspectedVariant.played}</strong>
				</div>
				<div>
					<small>{t('admin.variants.finished')}</small>
					<strong>{inspectedVariant.finished}</strong>
				</div>
				<div>
					<small>{t('admin.variants.playRate')}</small>
					<strong>
						{inspectedVariant.shown > 0
							? `${Math.round((inspectedVariant.played / inspectedVariant.shown) * 100)}%`
							: '—'}
					</strong>
				</div>
			</div>
			<p class="reconciliation-line">
				{t('admin.variants.completedTotal', {
					total: inspectedVariant.totalCompleted,
					finished: inspectedVariant.finished,
					imported: inspectedVariant.imported
				})}
			</p>
		</div>

		<div class="drawer-section">
			<h3>{t('v1.admin.games.rulesGroup')}</h3>
			<p class="hint">Leaderboard rules group: <code>{inspectedVariant.rulesGroup}</code></p>
			<div class="table-wrap">
				<table class="drawer-table">
					<thead>
						<tr>
							<th>{t('v1.admin.games.rulesGroup')}</th>
							<th>{t('v1.admin.games.version')}</th>
							<th>{t('v1.admin.games.completed')}</th>
							<th>{t('v1.admin.games.best')}</th>
							<th>{t('v1.admin.games.duration')}</th>
						</tr>
					</thead>
					<tbody>
						{#each inspectedVariant.rows as row (`${row.rules_group}:${row.score_config_version}`)}
							<tr>
								<td>{row.rules_group}</td>
								<td>{row.score_config_version}</td>
								<td>{row.completed}</td>
								<td>{row.bestScore}</td>
								<td>{row.averageSeconds.toFixed(1)}s</td>
							</tr>
						{:else}
							<tr><td colspan="5">{t('v1.admin.empty')}</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div style="margin-top:10px">
				<a
					class="btn sm"
					href="{resolve('/admin/[view]', {
						view: 'games'
					})}?game=memory&subview=scoring#{inspectedVariant.rulesGroup}"
				>
					{t('admin.directory.scoringLink')}
				</a>
			</div>
		</div>

		{#if can(role, inspectedVariant.lifecycleState === 'enabled' ? 'variant-disable' : 'variant-enable')}
			<div class="drawer-section" style="border-top:1px solid var(--border);padding-top:16px">
				<h3>{t('admin.directory.inlineAction')}</h3>
				<p class="hint">{t('admin.directory.inlineActionHint')}</p>
				<AccountForm>
					{#snippet children(pending)}
						<input type="hidden" name="target" value="memory" />
						<input type="hidden" name="variant" value={inspectedVariant?.id} />
						<input
							type="hidden"
							name="action"
							value={inspectedVariant?.lifecycleState === 'enabled'
								? 'variant-disable'
								: 'variant-enable'}
						/>
						{#if inspectedVariant?.lifecycleState === 'enabled'}
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
						<button
							class="btn"
							disabled={pending || !familyEnabled}
							style="width:100%;margin-top:8px"
						>
							{t(
								inspectedVariant?.lifecycleState === 'enabled'
									? 'admin.variants.disable'
									: 'admin.variants.enable'
							)}
						</button>
					{/snippet}
				</AccountForm>
			</div>
		{/if}
	{/if}
</dialog>

<style>
	.directory-container {
		display: grid;
		gap: 16px;
	}
	.hint {
		color: var(--muted);
		font-size: 13px;
		line-height: 1.5;
		margin: 0;
	}
	.filter-bar {
		display: grid;
		grid-template-columns: minmax(180px, 1.5fr) repeat(3, minmax(130px, 1fr)) auto;
		gap: 10px;
		align-items: center;
		padding: 14px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.filter-bar input,
	.filter-bar select {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--surface);
		font-size: 13px;
	}
	.filter-actions {
		display: flex;
		gap: 6px;
	}
	.dir-summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		font-size: 13px;
		color: var(--muted);
	}
	.variant-list {
		display: grid;
		gap: 12px;
	}
	.variant-row {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 16px;
		display: grid;
		grid-template-columns: minmax(160px, 1.4fr) minmax(200px, 2fr) minmax(170px, 1.2fr) auto;
		gap: 14px;
		align-items: center;
	}
	.v-info strong {
		display: block;
		font-size: 15px;
		color: var(--ink);
	}
	.v-info code {
		font-size: 11px;
		color: var(--muted);
		overflow-wrap: anywhere;
	}
	.v-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 6px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		font-size: 11px;
		font-weight: 800;
		padding: 2px 8px;
		border-radius: 99px;
		white-space: nowrap;
	}
	.pill.source-curated {
		background: #d7efea;
		color: #0e6251;
	}
	.pill.source-observed {
		background: #d0e2ff;
		color: #0f4c81;
	}
	.pill.status-enabled {
		background: #d7efea;
		color: #0e6251;
	}
	.pill.status-disabled {
		background: #fef0c7;
		color: #8a5a00;
	}
	.pill.status-blocked {
		background: #fee4e2;
		color: #b42318;
	}
	.pill.status-unplayed {
		background: var(--surface-2);
		color: var(--muted);
	}
	.pill.archetype {
		background: var(--surface-2);
		color: var(--ink-2);
		font-weight: 700;
	}
	.v-dims {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.dim-tag {
		font-size: 11px;
		background: var(--surface-2);
		color: var(--ink-2);
		padding: 3px 7px;
		border-radius: 5px;
		border: 1px solid var(--border);
	}
	.dim-tag.blocked {
		background: #fee4e2;
		color: #b42318;
		border-color: #fecdca;
	}
	.v-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
		background: var(--surface-2);
		padding: 8px 10px;
		border-radius: 7px;
		text-align: center;
	}
	.v-stats small {
		display: block;
		font-size: 11px;
		color: var(--muted);
	}
	.v-stats strong {
		font-size: 13px;
		color: var(--ink);
	}
	.v-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
	.pagination {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 8px;
		padding-top: 14px;
		border-top: 1px solid var(--border);
	}
	.pagination .status-text {
		font-size: 13px;
		color: var(--muted);
		margin-right: auto;
	}
	.pagination .cursor-badge {
		font-size: 11px;
		color: var(--muted);
		background: var(--surface-2);
		padding: 4px 8px;
		border-radius: 6px;
		font-family: monospace;
	}
	.empty-box {
		padding: 32px 20px;
		text-align: center;
		background: var(--surface-2);
		border: 1px dashed var(--border);
		border-radius: 10px;
	}
	.empty-box p {
		margin-bottom: 12px;
		color: var(--muted);
	}
	.drawer {
		position: fixed;
		margin: 0 0 0 auto;
		inset: 0 0 0 auto;
		width: min(540px, 100%);
		height: 100%;
		max-height: none;
		border: 0;
		padding: 24px;
		background: var(--surface);
		color: var(--ink);
		overflow-y: auto;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
	}
	.drawer::backdrop {
		background: rgb(27 36 51 / 45%);
	}
	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 16px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 14px;
	}
	.drawer-header h2 {
		font-size: 22px;
		margin: 4px 0;
	}
	.drawer-header code {
		font-size: 12px;
		color: var(--muted);
	}
	.drawer-section {
		margin-bottom: 20px;
	}
	.drawer-section h3 {
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--muted);
		margin: 0 0 8px;
	}
	.dim-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
		margin-top: 8px;
	}
	.dim-card {
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
	}
	.dim-card small {
		display: block;
		font-size: 11px;
		color: var(--muted);
	}
	.dim-card strong {
		font-size: 13px;
		color: var(--ink);
	}
	.dim-card.is-blocked {
		border-color: #b42318;
		background: #fee4e2;
	}
	.dim-card.is-blocked strong {
		color: #b42318;
	}
	.policy-warning {
		margin-top: 8px;
		padding: 8px 12px;
		border-radius: 6px;
		background: #fffaeb;
		border: 1px solid #fedf89;
		color: #b54708;
		font-size: 12px;
		font-weight: 700;
	}
	.table-wrap {
		overflow-x: auto;
		max-width: 100%;
		margin-top: 8px;
	}
	table.drawer-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	table.drawer-table th,
	table.drawer-table td {
		padding: 8px 10px;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}
	table.drawer-table th {
		background: var(--surface-2);
		color: var(--muted);
		text-transform: uppercase;
		font-size: 10px;
	}
	.reconciliation-line {
		font-size: 12px;
		color: var(--muted);
		margin-top: 8px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 800;
		color: var(--ink);
		text-decoration: none;
	}
	.btn:hover {
		background: var(--surface-2);
	}
	.btn.primary {
		background: var(--primary);
		color: #fff;
		border-color: var(--primary);
	}
	.btn.sm {
		padding: 5px 9px;
		min-height: 30px;
		font-size: 12px;
	}
	.btn.disabled,
	.btn[aria-disabled='true'] {
		pointer-events: none;
		opacity: 0.5;
	}
	@media (max-width: 1024px) {
		.filter-bar {
			grid-template-columns: repeat(2, 1fr);
		}
		.variant-row {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.v-stats {
			text-align: left;
		}
		.v-actions {
			justify-content: flex-start;
		}
	}
	@media (max-width: 768px) {
		.filter-bar {
			grid-template-columns: 1fr;
		}
	}
</style>
