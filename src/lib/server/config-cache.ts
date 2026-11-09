/** Cache immutable snapshots only; live pointers and enforcement always read D1. */
export async function cachedConfigRow<T>(
	cache: KVNamespace | undefined,
	key: string,
	load: () => Promise<T | null>,
	parse: (value: unknown) => T | null,
	expirationTtl = 86400
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
			await cache.put(key, JSON.stringify(row), { expirationTtl });
		} catch {
			console.warn('morphi:config_cache_write_failed');
		}
	}
	return row;
}

export const dailyBoardKey = (family: string, date: string) => `daily-board:${family}:${date}`;

export async function invalidateDailyBoard(
	cache: KVNamespace | undefined,
	family: string,
	date: string
) {
	try {
		await cache?.delete(dailyBoardKey(family, date));
	} catch {
		console.warn('morphi:daily_board_cache_delete_failed');
	}
}
