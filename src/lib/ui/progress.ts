import type { CompletedRun, PuzzleId } from '#lib/engine/contract.js';
export interface PendingRun {
	id: string;
	owner: string | null;
	run: CompletedRun;
	attempts: number;
	retryAt: number;
	rejected?: boolean;
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
export async function enqueue(entry: PendingRun): Promise<void> {
	const plain = JSON.parse(JSON.stringify(entry)) as PendingRun;
	fallback.set(entry.id, plain);
	try {
		await store('readwrite', (store) => store.put(plain));
		shadow.delete(entry.id);
	} catch {
		durableStorage = false;
		shadow.add(entry.id);
		console.warn(JSON.stringify({ event: 'progress_storage_failed' }));
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
export async function startSession(family: PuzzleId, owner: string) {
	const response = await fetch('/api/play/start', {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ family, ownerKey: owner }),
		signal: AbortSignal.timeout(8000)
	});
	if (!response.ok) throw new Error('ranked_unavailable');
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
	return value as {
		id: string;
		seed: string;
		engineVersion: string;
		startedAt: number;
		expiresAt: number;
		family: PuzzleId;
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
