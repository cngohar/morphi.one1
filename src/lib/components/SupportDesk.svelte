<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import '#lib/ui/account.css';
	import { resolve } from '$app/paths';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import type { SupportTicket, SupportMessage, SupportTaxonomyEntry } from '#lib/server/support.js';
	let {
		staff = false,
		manageTaxonomy = false,
		ownerKey
	}: { staff?: boolean; manageTaxonomy?: boolean; ownerKey: string } = $props();
	const endpoint = $derived(staff ? resolve('/admin/support/data') : resolve('/api/support'));
	let tickets = $state<SupportTicket[]>([]);
	let categories = $state<SupportTaxonomyEntry[]>([]);
	let priorities = $state<SupportTaxonomyEntry[]>([]);
	let conversation = $state<SupportTicket | null>(null);
	let messages = $state<SupportMessage[]>([]);
	let listPage = $state(1),
		messagePage = $state(1);
	let listMore = $state(false),
		messageMore = $state(false);
	let pending = $state(true),
		loaded = $state(false);
	let notice = $state(''),
		expired = $state(false);
	let subject = $state(''),
		message = $state(''),
		categoryId = $state(''),
		priorityId = $state('');
	let replyDrafts = $state<Record<string, string>>({});
	let selectedCategory = $state(''),
		selectedPriority = $state('');
	let taxonomyNames = $state<Record<string, string>>({});
	let newCategory = $state(''),
		newPriority = $state('');
	const attempts = new SvelteMap<string, string>();
	function failure(cause: unknown) {
		const error = cause as { code?: string; status?: number; retryAfter?: number };
		expired =
			error.status === 401 || error.code === 'operator_reauth' || error.code === 'account_changed';
		let key: MessageKey = expired
			? 'support.expired'
			: error.status === 403
				? 'support.denied'
				: error.status === 409
					? 'support.conflict'
					: error.status === 400 || error.status === 413
						? 'support.invalid'
						: 'support.error';
		if (error.code?.includes('taxonomy') || error.code?.includes('choice')) key = 'support.stale';
		if (error.code === 'support_name_conflict') key = 'support.duplicate';
		if (error.code === 'support_default') key = 'support.protected';
		notice =
			error.code === 'support_open_limit'
				? t('support.openLimit')
				: error.status === 429
					? t('support.limit', { seconds: error.retryAfter ?? 60 })
					: t(key);
	}
	async function request<T>(path = '', body?: Record<string, unknown>): Promise<T> {
		let options: RequestInit = { cache: 'no-store' };
		const value = body ? JSON.stringify({ path, ...body }) : '';
		if (body) {
			if (!attempts.has(value)) attempts.set(value, crypto.randomUUID());
			options = {
				...options,
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...body, ownerKey, requestId: attempts.get(value) })
			};
		}
		const response = await fetch(`${endpoint}${path}`, options);
		const result = await response.json();
		if (!result || typeof result !== 'object' || Array.isArray(result))
			throw { status: response.status };
		if (!response.ok) throw { ...result, status: response.status };
		if (body) attempts.delete(value);
		return result as T;
	}
	async function list(page = listPage) {
		const result = await request<{
			tickets: SupportTicket[];
			page: number;
			hasMore: boolean;
			categories: SupportTaxonomyEntry[];
			priorities: SupportTaxonomyEntry[];
		}>(`?page=${page}`);
		tickets = result.tickets;
		listPage = result.page;
		listMore = result.hasMore;
		categories = result.categories;
		priorities = result.priorities;
		if (!categoryId) categoryId = categories.find((entry) => entry.isDefault)?.id ?? '';
		if (!priorityId) priorityId = priorities.find((entry) => entry.isDefault)?.id ?? '';
		loaded = true;
	}
	async function open(id: string, page = 1) {
		const result = await request<{
			ticket: SupportTicket;
			messages: SupportMessage[];
			page: number;
			hasMore: boolean;
		}>(`/${encodeURIComponent(id)}?page=${page}`);
		conversation = result.ticket;
		messages = result.messages;
		messagePage = result.page;
		messageMore = result.hasMore;
		selectedCategory = result.ticket.categoryId;
		selectedPriority = result.ticket.priorityId;
		if (!Object.hasOwn(replyDrafts, id)) replyDrafts[id] = '';
		if (!staff)
			tickets = tickets.map((ticket) =>
				ticket.id === id ? { ...ticket, unread: result.ticket.unread } : ticket
			);
	}
	async function perform(action: () => Promise<void>) {
		if (pending) return;
		pending = true;
		notice = '';
		expired = false;
		try {
			await action();
		} catch (cause) {
			failure(cause);
		} finally {
			pending = false;
		}
	}
	async function refresh() {
		await list();
		if (conversation) await open(conversation.id, messagePage);
	}
	async function create() {
		const result = await request<{ ticketId: string }>('', {
			subject,
			message,
			categoryId,
			priorityId
		});
		subject = '';
		message = '';
		await list(1);
		await open(result.ticketId);
		notice = t('support.saved');
	}
	async function reply(close = false) {
		if (!conversation) return;
		const id = conversation.id;
		await request(`/${encodeURIComponent(id)}`, {
			action: 'reply',
			message: replyDrafts[id],
			close
		});
		replyDrafts[id] = '';
		await list();
		await open(id, messagePage);
		notice = t('support.saved');
	}
	async function close() {
		if (!conversation) return;
		const id = conversation.id;
		await request(`/${encodeURIComponent(id)}`, { action: 'close' });
		await list();
		await open(id, messagePage);
		notice = t('support.saved');
	}
	async function update() {
		if (!conversation) return;
		await request(`/${encodeURIComponent(conversation.id)}`, {
			action: 'update',
			categoryId: selectedCategory,
			priorityId: selectedPriority
		});
		await refresh();
		notice = t('support.saved');
	}
	async function taxonomy(kind: 'category' | 'priority', action: 'save' | 'delete', id?: string) {
		const name = id ? taxonomyNames[id] : kind === 'category' ? newCategory : newPriority;
		await request('/taxonomy', {
			action,
			kind,
			...(id ? { id } : {}),
			...(action === 'save' ? { name } : {})
		});
		if (!id) {
			if (kind === 'category') newCategory = '';
			else newPriority = '';
		}
		await refresh();
		notice = t('support.saved');
	}
	onMount(() => {
		pending = false;
		void perform(() => list());
	});
</script>

<div class="support-desk" data-testid="support-desk" aria-busy={pending}>
	{#if !staff}<p>{t('support.intro')}</p>{/if}
	<p class="hint">{t('support.privacy')}</p>
	<p class="hint">{t(staff ? 'support.staffLimits' : 'support.limits')}</p>
	<div class="support-actions">
		{#if conversation}<button
				class="account-link"
				disabled={pending}
				onclick={() => {
					conversation = null;
				}}>{t('support.back')}</button
			>{/if}
		<button class="account-link" disabled={pending} onclick={() => void perform(refresh)}
			>{t('support.refresh')}</button
		>
	</div>
	{#if notice}<p class="account-notice" role="status">{notice}</p>{/if}
	{#if expired}<a
			class="account-link"
			target="_blank"
			rel="noopener"
			href={staff ? resolve('/admin/sign-in') : resolve('/account/sign-in')}
			>{t(staff ? 'support.staffSignin' : 'account.signin.google')}</a
		>{/if}
	{#if pending}<p role="status">{t('support.loading')}</p>{/if}
	{#if conversation}
		<section aria-labelledby="support-subject">
			<h2 id="support-subject">{conversation.subject}</h2>
			<p class="hint">
				{t(conversation.state === 'open' ? 'support.open' : 'support.closed')} · {conversation.categoryName}
				· {conversation.priorityName}
			</p>
			<ol class="conversation" aria-label={t('support.message')}>
				{#each messages as entry (entry.id)}<li data-testid="support-message">
						<div class="message-meta">
							<strong>{t(entry.authorKind === 'staff' ? 'support.staff' : 'support.member')}</strong
							><time datetime={new Date(entry.createdAt).toISOString()}
								>{new Date(entry.createdAt).toLocaleString('en')}</time
							>
						</div>
						<p class="message-body">{entry.body}</p>
					</li>{/each}
			</ol>
			<div class="support-actions" aria-label={t('support.message')}>
				<button
					class="account-link"
					disabled={pending || messagePage <= 1}
					onclick={() => void perform(() => open(conversation!.id, messagePage - 1))}
					>{t('support.previous')}</button
				>
				<span>{t('support.page', { page: messagePage })}</span>
				<button
					class="account-link"
					disabled={pending || !messageMore}
					onclick={() => void perform(() => open(conversation!.id, messagePage + 1))}
					>{t('support.next')}</button
				>
			</div>
			{#if staff}
				<form
					autocomplete="off"
					onsubmit={(event) => {
						event.preventDefault();
						void perform(update);
					}}
				>
					<div class="support-fields">
						<label class="account-label"
							>{t('support.category')}<select
								class="account-input"
								bind:value={selectedCategory}
								disabled={pending}
								required
								>{#each categories as entry (entry.id)}<option value={entry.id}>{entry.name}</option
									>{/each}</select
							></label
						>
						<label class="account-label"
							>{t('support.priority')}<select
								class="account-input"
								bind:value={selectedPriority}
								disabled={pending}
								required
								>{#each priorities as entry (entry.id)}<option value={entry.id}>{entry.name}</option
									>{/each}</select
							></label
						>
					</div>
					<button class="account-button secondary" disabled={pending}>{t('support.save')}</button>
				</form>
			{/if}
			{#if conversation.state === 'open'}
				<form
					autocomplete="off"
					onsubmit={(event) => {
						event.preventDefault();
						void perform(() => reply());
					}}
				>
					<label class="account-label"
						>{t('support.message')}<textarea
							class="account-input"
							rows="6"
							bind:value={replyDrafts[conversation.id]}
							maxlength="4000"
							required
							disabled={pending}></textarea></label
					>
					<div class="support-actions">
						<button class="account-button" disabled={pending}>{t('support.send')}</button>
						{#if staff}<button
								class="account-button secondary"
								type="button"
								disabled={pending || !replyDrafts[conversation.id]?.trim()}
								onclick={() => void perform(() => reply(true))}>{t('support.sendClose')}</button
							>{/if}
						<button
							class="account-button secondary"
							type="button"
							disabled={pending}
							onclick={() => void perform(close)}>{t('support.close')}</button
						>
					</div>
				</form>
			{:else}<p>{t('support.closedHint')}</p>
				{#if replyDrafts[conversation.id]}<label class="account-label"
						>{t('support.message')}<textarea
							class="account-input"
							rows="6"
							bind:value={replyDrafts[conversation.id]}
							maxlength="4000"></textarea></label
					>{/if}
			{/if}
		</section>
	{:else if loaded}
		<section aria-labelledby="support-list-title">
			<h2 id="support-list-title">{t('support.all')}</h2>
			{#if tickets.length}<ul class="ticket-list">
					{#each tickets as ticket (ticket.id)}<li>
							<button
								class="ticket-button"
								disabled={pending}
								onclick={() => void perform(() => open(ticket.id))}
							>
								<strong>{ticket.subject}</strong><span
									>{t(ticket.state === 'open' ? 'support.open' : 'support.closed')} · {ticket.categoryName}
									· {ticket.priorityName}</span
								>
								{#if !staff && ticket.unread}<span class="unread">{t('support.unread')}</span>{/if}
							</button>
						</li>{/each}
				</ul>{:else}<p>{t('support.empty')}</p>{/if}
			<div class="support-actions">
				<button
					class="account-link"
					disabled={pending || listPage <= 1}
					onclick={() => void perform(() => list(listPage - 1))}>{t('support.previous')}</button
				><span>{t('support.page', { page: listPage })}</span><button
					class="account-link"
					disabled={pending || !listMore}
					onclick={() => void perform(() => list(listPage + 1))}>{t('support.next')}</button
				>
			</div>
		</section>
	{/if}
	{#if !staff && !conversation && loaded}
		<section aria-labelledby="support-create-title">
			<h2 id="support-create-title">{t('support.create')}</h2>
			<form
				autocomplete="off"
				onsubmit={(event) => {
					event.preventDefault();
					void perform(create);
				}}
			>
				<label class="account-label"
					>{t('support.subject')}<input
						class="account-input"
						bind:value={subject}
						maxlength="120"
						required
						disabled={pending}
					/></label
				>
				<div class="support-fields">
					<label class="account-label"
						>{t('support.category')}<select
							class="account-input"
							bind:value={categoryId}
							disabled={pending}
							required
							>{#each categories as entry (entry.id)}<option value={entry.id}>{entry.name}</option
								>{/each}</select
						></label
					>
					<label class="account-label"
						>{t('support.priority')}<select
							class="account-input"
							bind:value={priorityId}
							disabled={pending}
							required
							>{#each priorities as entry (entry.id)}<option value={entry.id}>{entry.name}</option
								>{/each}</select
						></label
					>
				</div>
				<label class="account-label"
					>{t('support.message')}<textarea
						class="account-input"
						rows="6"
						bind:value={message}
						maxlength="4000"
						required
						disabled={pending}></textarea></label
				>
				<button class="account-button" disabled={pending}>{t('support.create')}</button>
			</form>
		</section>
	{/if}
	{#if staff && manageTaxonomy && loaded && !conversation}
		<section aria-labelledby="support-taxonomy-title">
			<h2 id="support-taxonomy-title">{t('support.taxonomy')}</h2>
			<p class="hint">{t('support.deleteHint')}</p>
			{#each ['category', 'priority'] as kind (kind)}
				<h3>{t(kind === 'category' ? 'support.categories' : 'support.priorities')}</h3>
				{#each kind === 'category' ? categories : priorities as entry (entry.id)}
					<form
						autocomplete="off"
						class="taxonomy-row"
						onsubmit={(event) => {
							event.preventDefault();
							void perform(() => taxonomy(kind as 'category' | 'priority', 'save', entry.id));
						}}
					>
						<label class="account-label"
							>{t('support.name')}<input
								class="account-input"
								aria-label={`${t('support.name')}: ${entry.name}`}
								value={taxonomyNames[entry.id] ?? entry.name}
								oninput={(event) => {
									taxonomyNames[entry.id] = event.currentTarget.value;
								}}
								maxlength="60"
								required
								disabled={pending || entry.isDefault}
							/></label
						>
						<button
							class="account-button secondary"
							disabled={pending || entry.isDefault || !taxonomyNames[entry.id]}
							>{t('support.save')}</button
						>
						{#if entry.isDefault}<span class="hint">{t('support.default')}</span>{:else}<button
								class="account-link"
								type="button"
								disabled={pending}
								onclick={() =>
									void perform(() => taxonomy(kind as 'category' | 'priority', 'delete', entry.id))}
								>{t('support.delete')}</button
							>{/if}
					</form>
				{/each}
				<form
					autocomplete="off"
					class="taxonomy-row"
					onsubmit={(event) => {
						event.preventDefault();
						void perform(() => taxonomy(kind as 'category' | 'priority', 'save'));
					}}
				>
					<label class="account-label"
						>{t('support.name')}{#if kind === 'category'}<input
								class="account-input"
								bind:value={newCategory}
								maxlength="60"
								required
								disabled={pending}
							/>{:else}<input
								class="account-input"
								bind:value={newPriority}
								maxlength="60"
								required
								disabled={pending}
							/>{/if}</label
					><button class="account-button secondary" disabled={pending}>{t('support.add')}</button>
				</form>
			{/each}
		</section>
	{/if}
</div>

<style>
	.support-desk {
		display: grid;
		gap: 16px;
		min-width: 0;
	}
	.support-desk p {
		line-height: 1.6;
	}
	.support-desk h2 {
		font-size: var(--text-24, 24px);
		overflow-wrap: anywhere;
	}
	.support-desk h3 {
		margin-top: 20px;
	}
	section {
		min-width: 0;
		padding: 24px;
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: var(--radius-16, 16px);
	}
	.hint,
	.message-meta {
		color: var(--muted);
		font-size: var(--text-13, 13px);
	}
	form {
		display: grid;
		gap: 16px;
		margin-top: 20px;
	}
	.support-fields {
		min-width: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.support-actions {
		display: flex;
		gap: 16px;
		align-items: center;
		flex-wrap: wrap;
	}
	.account-label,
	.account-input {
		min-width: 0;
	}
	textarea.account-input {
		height: auto;
		min-height: 140px;
		resize: vertical;
	}
	.ticket-list,
	.conversation {
		padding: 0;
		list-style: none;
		display: grid;
		gap: 12px;
	}
	.ticket-button {
		width: 100%;
		text-align: left;
		display: grid;
		gap: 6px;
		padding: 16px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink);
		border-radius: var(--radius-12, 12px);
		cursor: pointer;
		overflow-wrap: anywhere;
	}
	.ticket-button span {
		font-size: var(--text-13, 13px);
	}
	.unread {
		font-weight: 800;
		color: var(--primary);
	}
	.conversation li {
		border-bottom: 1px solid var(--border);
		padding: 16px 0;
		min-width: 0;
	}
	.message-meta {
		display: flex;
		gap: 12px;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	.message-body {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.taxonomy-row {
		display: flex;
		align-items: end;
		flex-wrap: wrap;
		gap: 12px;
	}
	.taxonomy-row label {
		flex: 1 1 200px;
	}
	:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
	@media (max-width: 600px) {
		section {
			padding: 16px;
		}
		.support-fields {
			grid-template-columns: 1fr;
		}
		.support-actions {
			gap: 12px;
		}
	}
</style>
