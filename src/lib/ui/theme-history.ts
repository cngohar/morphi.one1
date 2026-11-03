import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
import { THEME_CONFIG_VERSION, THEME_GENERATOR_VERSION } from '#lib/engine/theme/config.js';

const recent = new Map<string, ResolvedTheme[]>();
const shadow = new Set<string>();
const historyKey = (family: string, version: string) => `${family}:${version}`;
function valid(value: unknown, family: string, version: string): value is ResolvedTheme[] {
	return (
		Array.isArray(value) &&
		value.length <= 8 &&
		value.every(
			(t) =>
				t &&
				t.family === family &&
				t.themeConfigVersion === version &&
				t.themeGeneratorVersion === THEME_GENERATOR_VERSION &&
				typeof t.recipe === 'string' &&
				typeof t.baseHue === 'number' &&
				typeof t.style?.id === 'string' &&
				typeof t.container === 'string' &&
				Array.isArray(t.symbols) &&
				t.symbols.every((s: { family?: unknown }) => typeof s?.family === 'string')
		)
	);
}
async function access(key: string, write?: ResolvedTheme[]): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const opening = indexedDB.open('morphi-themes', 1);
		let settled = false;
		let connection: IDBDatabase | null = null;
		let transaction: IDBTransaction | null = null;
		const timeout = setTimeout(() => {
			settled = true;
			try {
				transaction?.abort();
			} catch {
				/* Transaction may already have completed. */
			}
			connection?.close();
			reject(new Error('theme_storage_timeout'));
		}, 1500);
		const fail = (error: unknown) => {
			clearTimeout(timeout);
			settled = true;
			reject(error);
		};
		opening.onupgradeneeded = () => opening.result.createObjectStore('history');
		opening.onerror = () => fail(opening.error);
		opening.onblocked = () => fail(new Error('theme_storage_blocked'));
		opening.onsuccess = () => {
			const db = opening.result;
			connection = db;
			if (settled) {
				db.close();
				return;
			}
			db.onversionchange = () => db.close();
			try {
				const tx = db.transaction('history', write ? 'readwrite' : 'readonly');
				transaction = tx;
				const store = tx.objectStore('history');
				const req = write ? store.put(write, key) : store.get(key);
				tx.oncomplete = () => {
					clearTimeout(timeout);
					settled = true;
					db.close();
					resolve(req.result);
				};
				tx.onabort = tx.onerror = () => {
					db.close();
					fail(tx.error);
				};
			} catch (error) {
				db.close();
				fail(error);
			}
		};
	});
}
export async function themeHistory(
	family = 'memory',
	version = THEME_CONFIG_VERSION,
	limit = 3
): Promise<ResolvedTheme[]> {
	const key = historyKey(family, version);
	if (!shadow.has(key))
		try {
			const stored = await access(key);
			if (valid(stored, family, version)) recent.set(key, stored);
		} catch {
			console.warn('morphi:theme_history_unavailable');
		}
	return (recent.get(key) ?? []).slice(-limit);
}
export async function rememberTheme(theme: ResolvedTheme): Promise<void> {
	const key = historyKey(theme.family, theme.themeConfigVersion);
	const history = [...(recent.get(key) ?? []), theme].slice(-8);
	recent.set(key, history);
	shadow.add(key);
	try {
		await access(key, JSON.parse(JSON.stringify(history)));
		shadow.delete(key);
	} catch {
		console.warn('morphi:theme_history_unavailable');
	}
}
