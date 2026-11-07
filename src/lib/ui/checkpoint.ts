import { puzzleVariant, validateScoreValues } from '#lib/scoring.js';
import type { ResumableRankedSession } from './progress.js';
import type { Move } from '#lib/engine/contract.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
import type { ScoreConfig } from '#lib/engine/scoring.js';

export interface CheckpointState {
	phase: string;
	elapsedMs: number;
	clockStarted: boolean;
	pending: Record<string, number>;
}
export interface RoundCheckpoint {
	version: 1;
	id: string;
	owner: string | null;
	family: string;
	variant?: string;
	seed: string;
	engineVersion: string;
	difficulty: number | null;
	modifiers: Record<string, number>;
	theme: ResolvedTheme | null;
	scoring: ScoreConfig;
	moves: Move[];
	state: CheckpointState;
	status: 'active';
	savedAt: number;
	rankedSession: string | null;
	rankedStartedAt: number | null;
}
export function checkpointMatchesIssued(
	checkpoint: RoundCheckpoint,
	issued: Pick<
		ResumableRankedSession,
		'id' | 'family' | 'variant' | 'seed' | 'engineVersion' | 'scoring'
	>
): boolean {
	if (
		checkpoint.id !== issued.id ||
		checkpoint.rankedSession !== issued.id ||
		checkpoint.family !== issued.family ||
		checkpoint.seed !== issued.seed ||
		checkpoint.engineVersion !== issued.engineVersion ||
		checkpoint.scoring.version !== issued.scoring.version
	)
		return false;
	try {
		if (
			puzzleVariant(issued.family, checkpoint.variant)?.id !==
			puzzleVariant(issued.family, issued.variant)?.id
		)
			return false;
		const values = validateScoreValues(issued.family, checkpoint.scoring.values, issued.variant);
		return Object.entries(values).every(([field, value]) => issued.scoring.values[field] === value);
	} catch {
		return false;
	}
}
const memory = new Map<string, RoundCheckpoint | null>();
const shadow = new Set<string>();
let writes = Promise.resolve();
export let checkpointDurable = true;
const keyFor = (owner: string | null) => owner ?? 'guest';

export function validCheckpoint(
	value: unknown,
	owner: string | null,
	now = Date.now()
): value is RoundCheckpoint {
	if (!value || typeof value !== 'object') return false;
	const v = value as RoundCheckpoint;
	try {
		puzzleVariant(v.family, v.variant);
	} catch {
		return false;
	}
	return (
		v.version === 1 &&
		v.status === 'active' &&
		v.owner === owner &&
		typeof v.id === 'string' &&
		typeof v.family === 'string' &&
		typeof v.seed === 'string' &&
		/^(0|[1-9]\d{0,19})$/.test(v.seed) &&
		BigInt(v.seed) <= 18446744073709551615n &&
		typeof v.engineVersion === 'string' &&
		Number.isSafeInteger(v.savedAt) &&
		v.savedAt <= now + 60000 &&
		now - v.savedAt < 86400000 &&
		(v.difficulty === null || Number.isSafeInteger(v.difficulty)) &&
		!!v.modifiers &&
		typeof v.modifiers === 'object' &&
		!Array.isArray(v.modifiers) &&
		Object.values(v.modifiers).every(Number.isSafeInteger) &&
		!!v.scoring &&
		typeof v.scoring.version === 'string' &&
		!!v.scoring.values &&
		typeof v.scoring.values === 'object' &&
		Array.isArray(v.moves) &&
		v.moves.length <= 10000 &&
		v.moves.every(
			(move) =>
				!!move &&
				typeof move === 'object' &&
				!Array.isArray(move) &&
				Object.values(move).every(Number.isSafeInteger)
		) &&
		!!v.state &&
		typeof v.state.phase === 'string' &&
		v.state.phase.trim().length > 0 &&
		v.state.phase.length <= 80 &&
		Number.isFinite(v.state.elapsedMs) &&
		v.state.elapsedMs >= 0 &&
		v.state.elapsedMs <= 86400000 &&
		typeof v.state.clockStarted === 'boolean' &&
		!!v.state.pending &&
		typeof v.state.pending === 'object' &&
		!Array.isArray(v.state.pending) &&
		Object.values(v.state.pending).every((ms) => Number.isFinite(ms) && ms >= 0 && ms <= 60000) &&
		(v.rankedSession === null || typeof v.rankedSession === 'string') &&
		(v.rankedStartedAt === null || Number.isSafeInteger(v.rankedStartedAt))
	);
}

async function access<T>(
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore, done: (value: T) => void) => void
): Promise<T> {
	return new Promise((resolve, reject) => {
		let db: IDBDatabase | undefined;
		let tx: IDBTransaction | undefined;
		let settled = false;
		let result: T;
		const fail = (error: unknown) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			db?.close();
			reject(error);
		};
		const timeout = setTimeout(() => {
			try {
				tx?.abort();
			} catch {
				/* Already completed. */
			}
			fail(new Error('checkpoint_timeout'));
		}, 1500);
		let opening: IDBOpenDBRequest;
		try {
			opening = indexedDB.open('morphi-checkpoint', 1);
		} catch (error) {
			fail(error);
			return;
		}
		opening.onupgradeneeded = () => opening.result.createObjectStore('active');
		opening.onerror = () => fail(opening.error);
		opening.onblocked = () => fail(new Error('checkpoint_blocked'));
		opening.onsuccess = () => {
			db = opening.result;
			if (settled) {
				db.close();
				return;
			}
			db.onversionchange = () => db?.close();
			try {
				tx = db.transaction('active', mode);
				tx.onabort = tx.onerror = () => fail(tx?.error);
				tx.oncomplete = () => {
					if (settled) return;
					settled = true;
					clearTimeout(timeout);
					db?.close();
					resolve(result);
				};
				action(tx.objectStore('active'), (value) => {
					result = value;
				});
			} catch (error) {
				fail(error);
			}
		};
	});
}
function unavailable() {
	if (checkpointDurable) console.warn('morphi:checkpoint_storage_unavailable');
	checkpointDurable = false;
}
export async function loadCheckpoint(
	owner: string | null,
	refresh = false
): Promise<RoundCheckpoint | null> {
	const key = keyFor(owner);
	await writes;
	if (refresh || !shadow.has(key))
		try {
			const value = await access<unknown>('readonly', (store, done) => {
				store.get(key).onsuccess = (event) => done((event.target as IDBRequest).result);
			});
			const valid = validCheckpoint(value, owner);
			if (value !== undefined && !valid)
				console.warn(
					JSON.stringify({ event: 'checkpoint_discarded', reason: 'invalid_or_expired' })
				);
			memory.set(key, valid ? value : null);
			shadow.delete(key);
			// A new round replaces stale storage; loading never deletes another tab's newer save.
		} catch {
			unavailable();
		}
	const value = memory.get(key);
	return validCheckpoint(value, owner) ? value : null;
}
export interface CheckpointLease {
	token: string;
	owns(): boolean;
	release(): void;
}
/** Web Locks owns the live view; the IDB fence rejects a displaced tab's queued saves. */
export async function claimCheckpoint(
	id: string,
	owner: string | null,
	lost: () => void,
	takeover = false
): Promise<CheckpointLease | null> {
	const token = crypto.randomUUID();
	let owns = true;
	let release = () => {
		owns = false;
	};
	let channel: BroadcastChannel | undefined;
	const name = `morphi-round:${keyFor(owner)}`;
	void id;
	let acquiredLock = false;
	if (typeof navigator !== 'undefined' && navigator.locks) {
		const acquired = await new Promise<boolean>((resolve) => {
			void navigator.locks
				.request(name, takeover ? { steal: true } : { ifAvailable: true }, async (lock) => {
					if (!lock) {
						resolve(false);
						return;
					}
					acquiredLock = true;
					await new Promise<void>((done) => {
						release = () => {
							owns = false;
							done();
						};
						resolve(true);
					});
				})
				.catch(() => {
					if (acquiredLock && owns) {
						release();
						shadow.delete(keyFor(owner));
						lost();
					}
					resolve(false);
				});
		});
		if (!acquired) return null;
	} else {
		// shortcut: insecure/older browsers keep solo play available; atomic live-tab exclusion needs Web Locks.
		console.warn('morphi:checkpoint_lock_unavailable');
	}
	try {
		await access<void>('readwrite', (store) => {
			store.put(token, `fence:${keyFor(owner)}`);
		});
	} catch {
		unavailable();
	}
	if (typeof BroadcastChannel !== 'undefined') {
		channel = new BroadcastChannel(name);
		channel.onmessage = (event) => {
			if (event.data !== token && owns) {
				release();
				shadow.delete(keyFor(owner));
				lost();
			}
		};
		channel.postMessage(token);
	}
	return {
		token,
		owns: () => owns,
		release() {
			release();
			channel?.close();
		}
	};
}
export function saveCheckpoint(value: RoundCheckpoint, lease: CheckpointLease): Promise<void> {
	const plain = JSON.parse(JSON.stringify(value)) as RoundCheckpoint;
	const key = keyFor(value.owner);
	if (!lease.owns()) return Promise.resolve();
	memory.set(key, plain);
	shadow.add(key);
	writes = writes.then(async () => {
		if (!lease.owns()) return;
		try {
			await access<void>('readwrite', (store) => {
				store.get(`fence:${key}`).onsuccess = (event) => {
					if ((event.target as IDBRequest).result === lease.token && lease.owns())
						store.put(plain, key);
				};
			});
			shadow.delete(key);
		} catch {
			unavailable();
		}
	});
	return writes;
}
export function clearCheckpoint(owner: string | null, id: string): Promise<void> {
	const key = keyFor(owner);
	if (memory.get(key)?.id === id) memory.set(key, null);
	shadow.add(key);
	writes = writes.then(async () => {
		try {
			await access<void>('readwrite', (store) => {
				store.get(key).onsuccess = (event) => {
					if ((event.target as IDBRequest<RoundCheckpoint | undefined>).result?.id === id)
						store.delete(key);
				};
			});
			shadow.delete(key);
		} catch {
			unavailable();
		}
	});
	return writes;
}
