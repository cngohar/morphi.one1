/** Cache immutable snapshots only; live pointers and enforcement always read D1. */
export async function cachedConfigRow<T>(
	cache: KVNamespace | undefined,
	key: string,
	load: () => Promise<T | null>,
	parse: (value: unknown) => T | null
): Promise<T | null> {
	if (cache) {
		try {
			const row = parse(await cache.get(key, 'json'));
			if (row) return row;
		} catch {
			console.warn('morphi:config_cache_read_failed');
		}
	}
	const row = await load();
	if (cache && row && parse(row)) {
		try {
			await cache.put(key, JSON.stringify(row), { expirationTtl: 86400 });
		} catch {
			console.warn('morphi:config_cache_write_failed');
		}
	}
	return row;
}
