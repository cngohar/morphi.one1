import { eq } from 'drizzle-orm';
import { createDatabase } from './db/index.js';
import { adminActor, adminAudit, completedRun, playerBan, siteControl } from './db/schema.js';
import { RunError } from './runs.js';
export type ModerationAction = 'ban' | 'unban' | 'hide' | 'restore' | 'ranked-on' | 'ranked-off';
export async function moderate(
	binding: D1Database,
	actor: string,
	action: ModerationAction,
	target: string,
	reason: string
) {
	const db = createDatabase(binding);
	const identity = await db.select().from(adminActor).where(eq(adminActor.id, actor)).get();
	if (
		!identity ||
		!['admin', 'moderator'].includes(identity.role) ||
		(action.startsWith('ranked-') && identity.role !== 'admin')
	)
		throw new RunError('permission', 403);
	if (reason.trim().length < 3 || reason.length > 240) throw new RunError('reason');
	const now = Date.now();
	const audit = (before: unknown, after: unknown) =>
		db.insert(adminAudit).values({
			id: crypto.randomUUID(),
			actor,
			action,
			target,
			reason: reason.trim(),
			before: JSON.stringify(before ?? null),
			after: JSON.stringify(after ?? null),
			createdAt: now
		});
	if (action === 'ban' || action === 'unban') {
		const before = await db.select().from(playerBan).where(eq(playerBan.userId, target)).get();
		const after =
			action === 'ban' ? { userId: target, reason: reason.trim(), createdAt: now } : null;
		await db.batch([
			after
				? db
						.insert(playerBan)
						.values(after)
						.onConflictDoUpdate({ target: playerBan.userId, set: after })
				: db.delete(playerBan).where(eq(playerBan.userId, target)),
			audit(before, after)
		]);
	} else if (action === 'hide' || action === 'restore') {
		const before = await db
			.select({ hidden: completedRun.hidden })
			.from(completedRun)
			.where(eq(completedRun.id, target))
			.get();
		if (!before) throw new RunError('missing', 404);
		const after = { hidden: action === 'hide' };
		await db.batch([
			db.update(completedRun).set(after).where(eq(completedRun.id, target)),
			audit(before, after)
		]);
	} else if (action === 'ranked-on' || action === 'ranked-off') {
		const before = await db.select().from(siteControl).where(eq(siteControl.key, 'ranked')).get();
		const after = { key: 'ranked', enabled: action === 'ranked-on' };
		await db.batch([
			db
				.insert(siteControl)
				.values(after)
				.onConflictDoUpdate({ target: siteControl.key, set: after }),
			audit(before, after)
		]);
	} else throw new RunError('action');
}
