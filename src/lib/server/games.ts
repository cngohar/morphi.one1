import { catalog } from '#lib/catalog.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import { RunError } from './runs.js';
import { ensureCatalogFamily } from './config.js';

type GameAction =
	'game-enable' | 'game-disable' | 'game-delete' | 'game-restore' | 'game-hard-delete';

export async function gameAvailable(db: D1Database, family: PuzzleId) {
	await ensureCatalogFamily(db, family);
	const row = await db
		.prepare('SELECT state FROM game_lifecycle WHERE family=?')
		.bind(family)
		.first<{ state: string }>();
	return row?.state === 'enabled';
}

export async function gameOverview(db: D1Database) {
	return Promise.all(
		Object.keys(catalog).map(async (family) => {
			await ensureCatalogFamily(db, family);
			const state = await db
				.prepare('SELECT state,restore_until FROM game_lifecycle WHERE family=?')
				.bind(family)
				.first<{
					state: 'enabled' | 'disabled' | 'deleted' | 'hard-deleted';
					restore_until: number | null;
				}>();
			if (!state) throw new Error('missing_game_lifecycle');
			const stats = await db
				.prepare(
					'SELECT count(*) completed,coalesce(sum(ranked),0) ranked,avg(score) averageScore,max(score) bestScore,avg(seconds) averageSeconds FROM completed_run WHERE family=?'
				)
				.bind(family)
				.first<{
					completed: number;
					ranked: number;
					averageScore: number | null;
					bestScore: number | null;
					averageSeconds: number | null;
				}>();
			if (!stats) throw new Error('missing_game_statistics');
			return { family, state: state.state, restoreUntil: state.restore_until, ...stats };
		})
	);
}

export async function gameStatistics(db: D1Database, family: PuzzleId) {
	if (!Object.hasOwn(catalog, family)) throw new RunError('input');
	const rows = (
		await db
			.prepare(
				`SELECT rules_group,score_config_version,count(*) completed,coalesce(sum(ranked),0) ranked,
			max(score) bestScore,avg(score) averageScore,avg(seconds) averageSeconds,coalesce(sum(hidden),0) hidden
			FROM completed_run WHERE family=? GROUP BY rules_group,score_config_version
			ORDER BY rules_group,score_config_version LIMIT 101`
			)
			.bind(family)
			.all<{
				rules_group: string;
				score_config_version: string;
				completed: number;
				ranked: number;
				bestScore: number;
				averageScore: number;
				averageSeconds: number;
				hidden: number;
			}>()
	).results;
	return { rows: rows.slice(0, 100), more: rows.length > 100 };
}

export async function changeGame(
	db: D1Database,
	actor: string,
	family: PuzzleId,
	action: GameAction,
	reason: string,
	days = 7,
	now = Date.now()
) {
	if (
		!Object.hasOwn(catalog, family) ||
		!['game-enable', 'game-disable', 'game-delete', 'game-restore', 'game-hard-delete'].includes(
			action
		) ||
		reason.trim().length < 3 ||
		reason.length > 240 ||
		/[\r\n@]/.test(reason) ||
		!Number.isSafeInteger(days) ||
		days < 1 ||
		days > 365
	)
		throw new RunError('input');
	await ensureCatalogFamily(db, family);
	const next =
		action === 'game-enable'
			? 'enabled'
			: action === 'game-disable' || action === 'game-restore'
				? 'disabled'
				: action === 'game-delete'
					? 'deleted'
					: 'hard-deleted';
	const condition =
		action === 'game-enable'
			? "state='disabled'"
			: action === 'game-disable'
				? "state='enabled'"
				: action === 'game-delete'
					? "state IN ('enabled','disabled')"
					: action === 'game-restore'
						? "state='deleted' AND restore_until>?"
						: "state='deleted' AND restore_until<=?";
	const operation = crypto.randomUUID();
	const until = action === 'game-delete' ? now + days * 86400000 : null;
	const parameters = action === 'game-restore' || action === 'game-hard-delete' ? [now] : [];
	const results = await db.batch([
		db
			.prepare(
				`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
		SELECT ?,?,?,family,?,json_object('state',state,'restoreUntil',restore_until),?,? FROM game_lifecycle WHERE family=? AND ${condition} AND EXISTS(SELECT 1 FROM admin_actor WHERE id=? AND role='admin')`
			)
			.bind(
				operation,
				actor,
				action,
				reason.trim(),
				JSON.stringify({ state: next, restoreUntil: until }),
				now,
				family,
				...parameters,
				actor
			),
		db
			.prepare(
				'UPDATE game_lifecycle SET state=?,restore_until=? WHERE family=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)'
			)
			.bind(next, until, family, operation)
	]);
	if (!results[1].meta.changes) throw new RunError('game_conflict', 409);
}
