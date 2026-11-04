import { puzzleVariant, validateScoreValues, type ScoreConfig } from '#lib/scoring.js';
import type { CompletedRun, PuzzleId } from '#lib/engine/contract.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
import { paletteIssues } from '#lib/engine/theme/generator.js';
import { THEME_GENERATOR_VERSION } from '#lib/engine/theme/config.js';
export interface PendingRun {
	id: string;
	owner: string | null;
	run: CompletedRun;
	attempts: number;
	retryAt: number;
	rejected?: boolean;
	resolvedTheme?: ResolvedTheme;
}
export interface SavedResult {
	id: string;
	score: number;
	ranked: boolean;
	group: string;
}
const fallback = new Map<string, PendingRun>();
const shadow = new Set<string>();
let syncing = false;
export let durableStorage = true;

async function store<T>(
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	return new Promise((resolve, reject) => {
		const opening = indexedDB.open('morphi-progress', 1);
		opening.onupgradeneeded = () => opening.result.createObjectStore('pending', { keyPath: 'id' });
		opening.onerror = () => reject(opening.error);
		opening.onblocked = () => reject(new Error('storage_blocked'));
		opening.onsuccess = () => {
			const db = opening.result;
			try {
				db.onversionchange = () => db.close();
				const transaction = db.transaction('pending', mode);
				const request = action(transaction.objectStore('pending'));
				transaction.oncomplete = () => {
					db.close();
					resolve(request.result);
				};
				transaction.onerror = transaction.onabort = () => {
					db.close();
					reject(transaction.error);
				};
			} catch (error) {
				db.close();
				reject(error);
			}
		};
	});
}
export async function enqueue(entry: PendingRun): Promise<boolean> {
	const plain = JSON.parse(JSON.stringify(entry)) as PendingRun;
	fallback.set(entry.id, plain);
	try {
		await store('readwrite', (store) => store.put(plain));
		shadow.delete(entry.id);
		return true;
	} catch {
		durableStorage = false;
		shadow.add(entry.id);
		console.warn(JSON.stringify({ event: 'progress_storage_failed' }));
		return false;
	}
}
export async function pendingRuns(): Promise<PendingRun[]> {
	try {
		const entries = await store<PendingRun[]>('readonly', (store) => store.getAll());
		for (const entry of entries) {
			if (entry?.run?.version === 1 && typeof entry.id === 'string' && !shadow.has(entry.id))
				fallback.set(entry.id, entry);
		}
	} catch {
		durableStorage = false;
	}
	return [...fallback.values()];
}
export async function removePending(id: string) {
	try {
		await store('readwrite', (store) => store.delete(id));
		fallback.delete(id);
		shadow.delete(id);
	} catch {
		// An acknowledged run may remain queued; the server makes its next retry harmless.
		durableStorage = false;
	}
}
export interface ActiveRankedSession {
	id: string;
	expiresAt: number;
	saving: boolean;
}
export class RankedSessionConflict extends Error {
	constructor(public active: ActiveRankedSession) {
		super('ranked_active');
	}
}
export interface ResumableRankedSession extends ActiveRankedSession {
	variant?: string;
	family: PuzzleId;
	seed: string;
	engineVersion: string;
	startedAt: number;
	theme: ResolvedTheme;
	scoring: ScoreConfig;
}
export async function activeSession(
	owner: string
): Promise<ActiveRankedSession | ResumableRankedSession | null> {
	const response = await fetch(`/api/play/active?ownerKey=${encodeURIComponent(owner)}`, {
		credentials: 'same-origin',
		cache: 'no-store',
		signal: AbortSignal.timeout(8000)
	});
	if (!response.ok) throw new Error('ranked_resume_unavailable');
	const value = (await response.json()) as ResumableRankedSession | null;
	if (value === null) return null;
	if (
		typeof value.id !== 'string' ||
		!Number.isSafeInteger(value.expiresAt) ||
		typeof value.saving !== 'boolean'
	)
		throw new Error('ranked_response');
	if (value.saving || !('family' in value)) return value;
	if (
		typeof value.family !== 'string' ||
		typeof value.seed !== 'string' ||
		typeof value.engineVersion !== 'string' ||
		!Number.isSafeInteger(value.startedAt) ||
		!value.theme ||
		value.theme.family !== value.family ||
		value.theme.seed !== value.seed ||
		typeof value.theme.themeConfigVersion !== 'string' ||
		!/^[a-zA-Z0-9-]{1,80}$/.test(value.theme.themeConfigVersion) ||
		value.theme.themeGeneratorVersion !== THEME_GENERATOR_VERSION ||
		paletteIssues(value.theme).length ||
		typeof value.scoring?.version !== 'string'
	)
		throw new Error('ranked_response');
	puzzleVariant(value.family, value.variant);
	validateScoreValues(value.family, value.scoring.values, value.variant);
	return value;
}
export async function abandonSession(session: string, owner: string): Promise<void> {
	const response = await fetch('/api/play/abandon', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ session, ownerKey: owner }),
		keepalive: true,
		signal: AbortSignal.timeout(8000)
	});
	if (!response.ok) throw new Error('ranked_abandon_unavailable');
}
export async function startSession(
	family: PuzzleId,
	owner: string,
	takeoverSession?: string,
	variant?: string
) {
	const response = await fetch('/api/play/start', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			family,
			...(variant ? { variant } : {}),
			ownerKey: owner,
			...(takeoverSession ? { takeoverSession } : {})
		}),
		signal: AbortSignal.timeout(8000)
	});
	if (!response.ok) {
		const failure = (await response.json().catch(() => null)) as {
			code?: string;
			active?: ActiveRankedSession;
		} | null;
		if (
			response.status === 409 &&
			failure?.code === 'ranked_active' &&
			failure.active &&
			typeof failure.active.id === 'string' &&
			typeof failure.active.saving === 'boolean' &&
			Number.isSafeInteger(failure.active.expiresAt)
		)
			throw new RankedSessionConflict(failure.active);
		throw new Error(
			['game_disabled', 'variant_disabled'].includes(failure?.code ?? '')
				? 'game_disabled'
				: 'ranked_unavailable'
		);
	}
	const value = (await response.json()) as Record<string, unknown>;
	if (
		!value ||
		typeof value !== 'object' ||
		typeof value.id !== 'string' ||
		typeof value.seed !== 'string' ||
		value.family !== family ||
		typeof value.engineVersion !== 'string'
	)
		throw new Error('ranked_response');
	const theme = value.theme as ResolvedTheme | undefined;
	if (
		!theme ||
		theme.seed !== value.seed ||
		theme.family !== family ||
		typeof theme.themeConfigVersion !== 'string' ||
		!/^[a-zA-Z0-9-]{1,80}$/.test(theme.themeConfigVersion) ||
		theme.themeGeneratorVersion !== THEME_GENERATOR_VERSION ||
		paletteIssues(theme).length
	)
		throw new Error('ranked_theme');
	const scoring = value.scoring as ScoreConfig | undefined;
	if (!scoring || typeof scoring.version !== 'string') throw new Error('ranked_scoring');
	if (
		puzzleVariant(family, value.variant as string | undefined)?.id !==
		puzzleVariant(family, variant)?.id
	)
		throw new Error('ranked_variant');
	validateScoreValues(family, scoring.values, variant);
	return value as {
		variant?: string;
		id: string;
		seed: string;
		engineVersion: string;
		startedAt: number;
		expiresAt: number;
		family: PuzzleId;
		theme: ResolvedTheme;
		scoring: import('#lib/engine/scoring.js').ScoreConfig;
	};
}
export async function syncProgress(
	owner: string,
	onresult: (result: SavedResult) => void = () => {},
	importGuests = false,
	onproblem: (message: string) => void = () => {}
): Promise<void> {
	if (syncing) return;
	syncing = true;
	try {
		for (const entry of await pendingRuns()) {
			if (entry.owner !== owner && !(importGuests && entry.owner === null)) continue;
			if (entry.rejected || entry.retryAt > Date.now()) continue;
			if (entry.owner === null) {
				entry.owner = owner;
				await enqueue(entry);
			}
			try {
				const response = await fetch('/api/progress', {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ownerKey: owner, run: entry.run }),
					signal: AbortSignal.timeout(10000)
				});
				if (response.status === 410 && entry.run.rankedSession) {
					entry.run.rankedSession = null;
					entry.retryAt = 0;
					await enqueue(entry);
					onproblem('progress.unranked');
					continue;
				}
				if (!response.ok) {
					if (response.status === 401) {
						onproblem('account.expired');
						return;
					}
					if (response.status === 409) {
						const detail = (await response.json()) as { code?: string };
						if (detail.code === 'account_changed') {
							onproblem('account.expired');
							return;
						}
					}
					if (response.status >= 400 && response.status < 500 && response.status !== 429)
						entry.rejected = true;
					const retry = Number(response.headers.get('Retry-After'));
					entry.retryAt =
						Date.now() +
						(retry > 0 ? retry * 1000 : Math.min(60000, 1000 * 2 ** Math.min(entry.attempts, 6)));
					throw new Error('save_failed');
				}
				const saved = (await response.json()) as SavedResult;
				if (
					saved.id !== entry.id ||
					!Number.isSafeInteger(saved.score) ||
					saved.score < 0 ||
					typeof saved.ranked !== 'boolean' ||
					typeof saved.group !== 'string'
				)
					throw new Error('save_response');
				await removePending(entry.id);
				onresult(saved);
			} catch {
				entry.attempts += 1;
				entry.retryAt = Math.max(
					entry.retryAt,
					Date.now() + Math.min(60000, 1000 * 2 ** Math.min(entry.attempts, 6))
				);
				await enqueue(entry);
				onproblem(entry.rejected ? 'progress.rejected' : 'progress.pending');
				console.warn(JSON.stringify({ event: 'progress_save_pending' }));
			}
		}
	} finally {
		syncing = false;
	}
}
