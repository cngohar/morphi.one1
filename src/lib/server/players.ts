import { eq } from 'drizzle-orm';
import { createDatabase } from './db/index.js';
import { player } from './db/schema.js';

export function validatePlayerName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const name = value.trim();
	if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return null;
	if (['admin', 'administrator', 'morphi', 'moderator', 'support'].includes(name.toLowerCase()))
		return null;
	return name;
}

export async function findPlayer(binding: D1Database, userId: string) {
	return createDatabase(binding)
		.select({ name: player.name })
		.from(player)
		.where(eq(player.userId, userId))
		.get();
}

export async function savePlayerName(
	binding: D1Database,
	userId: string,
	name: string
): Promise<'saved' | 'taken'> {
	const db = createDatabase(binding);
	try {
		await db
			.insert(player)
			.values({ userId, name, normalizedName: name.toLowerCase(), updatedAt: new Date() })
			.onConflictDoUpdate({
				target: player.userId,
				set: { name, normalizedName: name.toLowerCase(), updatedAt: new Date() }
			});
		return 'saved';
	} catch (error) {
		// Check the actual conflict. Other database failures must remain retryable errors.
		const existing = await db
			.select({ userId: player.userId })
			.from(player)
			.where(eq(player.normalizedName, name.toLowerCase()))
			.get();
		if (existing && existing.userId !== userId) return 'taken';
		throw error;
	}
}
