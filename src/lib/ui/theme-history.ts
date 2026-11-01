import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
import { THEME_CONFIG_VERSION, THEME_GENERATOR_VERSION } from '#lib/engine/theme/config.js';

let recent: ResolvedTheme[] = [];
function valid(value: unknown): value is ResolvedTheme[] {
	return (
		Array.isArray(value) &&
		value.length <= 3 &&
		value.every(
			(t) =>
				t &&
				t.themeConfigVersion === THEME_CONFIG_VERSION &&
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
async function access(write?: ResolvedTheme[]): Promise<unknown> {
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
				const req = write ? store.put(write, 'recent') : store.get('recent');
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
let shadow = false;
export async function themeHistory(): Promise<ResolvedTheme[]> {
	if (!shadow)
		try {
			const stored = await access();
			if (valid(stored)) recent = stored;
		} catch {
			console.warn('morphi:theme_history_unavailable');
		}
	return recent.slice();
}
export async function rememberTheme(theme: ResolvedTheme): Promise<void> {
	recent = [...recent, theme].slice(-3);
	shadow = true;
	try {
		await access(JSON.parse(JSON.stringify(recent)));
		shadow = false;
	} catch {
		console.warn('morphi:theme_history_unavailable');
	}
}
