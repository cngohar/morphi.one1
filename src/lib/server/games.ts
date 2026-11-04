import { catalog } from '#lib/catalog.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import { RunError } from './runs.js';
import { puzzleVariant } from '#lib/scoring.js';
import { ensureCatalogFamily } from './config.js';

// Catalog ids drive reads and audited lifecycle writes; no family-specific dispatch.
type GameAction =
	'game-enable' | 'game-disable' | 'game-delete' | 'game-restore' | 'game-hard-delete';

export async function gameAvailable(db: D1Database, family: PuzzleId) {
	await ensureCatalogFamily(db, family);
	const row = await db
		.prepare('SELECT state FROM game_lifecycle WHERE family=?')
		.bind(family)
		.first<{ state: string }>();
	return (
		row?.state === 'enabled' &&
		(!catalog[family].variants?.length || (await enabledVariants(db, family)).length > 0)
	);
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
	const variants = await Promise.all(
		(await variantOverview(db, family)).map(async (variant) => {
			const definition = puzzleVariant(family, variant.id)!;
			const groups = definition.leaderboardGroups;
			const placeholders = groups.map(() => '?').join(',');
			const defaultId = catalog[family].variants![0].id;
			const counts = await db
				.prepare(
					`WITH starts AS (
 SELECT id,user_id,family,first_move_at,abandoned_at FROM play_session WHERE family=? AND COALESCE(variant,?)=?
 UNION ALL
 SELECT run_id,user_id,family,first_move_at,abandoned_at FROM account_round_activity a
 WHERE family=? AND COALESCE(variant,?)=? AND NOT EXISTS(SELECT 1 FROM play_session p WHERE p.id=a.run_id AND p.user_id=a.user_id AND p.family=a.family)
 ), observed AS (
 SELECT s.*,r.id completed FROM starts s LEFT JOIN completed_run r ON r.id=s.id AND r.user_id=s.user_id AND r.family=s.family AND r.rules_group IN (${placeholders})
 ) SELECT count(*) shown,
 COALESCE(sum(first_move_at IS NULL AND completed IS NULL),0) ignored,
 COALESCE(sum(first_move_at IS NOT NULL OR completed IS NOT NULL),0) played,
 COALESCE(sum((first_move_at IS NOT NULL OR completed IS NOT NULL) AND abandoned_at IS NOT NULL AND completed IS NULL),0) abandoned,
 COALESCE(sum(completed IS NOT NULL),0) finished,
 COALESCE(sum(first_move_at IS NOT NULL AND abandoned_at IS NULL AND completed IS NULL),0) open
 FROM observed`
				)
				.bind(family, defaultId, variant.id, family, defaultId, variant.id, ...groups)
				.first<{
					shown: number;
					ignored: number;
					played: number;
					abandoned: number;
					finished: number;
					open: number;
				}>();
			const imported = await db
				.prepare(
					`SELECT count(*) imported FROM completed_run r WHERE family=? AND rules_group IN (${placeholders})
 AND NOT EXISTS(SELECT 1 FROM play_session p WHERE p.id=r.id AND p.user_id=r.user_id AND p.family=r.family AND COALESCE(p.variant,?)=?)
 AND NOT EXISTS(SELECT 1 FROM account_round_activity a WHERE a.run_id=r.id AND a.user_id=r.user_id AND a.family=r.family AND COALESCE(a.variant,?)=?)`
				)
				.bind(family, ...groups, defaultId, variant.id, defaultId, variant.id)
				.first<{ imported: number }>();
			if (!counts || !imported) throw new Error('missing_variant_statistics');
			const variantRows = (
				await db
					.prepare(
						`SELECT rules_group,score_config_version,count(*) completed,coalesce(sum(ranked),0) ranked,
 max(score) bestScore,avg(score) averageScore,avg(seconds) averageSeconds,coalesce(sum(hidden),0) hidden
 FROM completed_run WHERE family=? AND rules_group IN (${placeholders}) GROUP BY rules_group,score_config_version
 ORDER BY rules_group,score_config_version LIMIT 101`
					)
					.bind(family, ...groups)
					.all<(typeof rows)[number]>()
			).results;
			return {
				...variant,
				...counts,
				imported: imported.imported,
				totalCompleted: counts.finished + imported.imported,
				rows: variantRows.slice(0, 100),
				more: variantRows.length > 100
			};
		})
	);
	return { rows: rows.slice(0, 100), more: rows.length > 100, variants };
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

export async function variantOverview(db: D1Database, family: PuzzleId) {
	if (!Object.hasOwn(catalog, family)) throw new RunError('input');
	const rows = (
		await db
			.prepare('SELECT variant,state FROM variant_lifecycle WHERE family=?')
			.bind(family)
			.all<{ variant: string; state: 'enabled' | 'disabled' }>()
	).results;
	return (catalog[family].variants ?? []).map((variant) => ({
		id: variant.id,
		state:
			rows.find((row) => row.variant === variant.id)?.state ??
			(variant.enabled === false ? ('disabled' as const) : ('enabled' as const))
	}));
}
export async function enabledVariants(db: D1Database, family: PuzzleId) {
	return (await variantOverview(db, family))
		.filter((variant) => variant.state === 'enabled')
		.map((variant) => variant.id);
}
export async function variantAvailable(db: D1Database, family: PuzzleId, variant?: string) {
	let definition;
	try {
		definition = puzzleVariant(family, variant);
	} catch {
		throw new RunError('input');
	}
	return (
		(await gameAvailable(db, family)) &&
		(!definition || (await enabledVariants(db, family)).includes(definition.id))
	);
}
export async function changeVariant(
	db: D1Database,
	actor: string,
	family: PuzzleId,
	variant: string,
	action: 'variant-enable' | 'variant-disable',
	reason: string,
	now = Date.now()
) {
	let definition;
	try {
		definition = puzzleVariant(family, variant);
	} catch {
		throw new RunError('input');
	}
	if (
		!definition ||
		!['variant-enable', 'variant-disable'].includes(action) ||
		reason.trim().length < 3 ||
		reason.length > 240 ||
		/[\r\n@]/.test(reason)
	)
		throw new RunError('input');
	const next = action === 'variant-enable' ? 'enabled' : 'disabled';
	const initial = definition.enabled === false ? 'disabled' : 'enabled';
	const operation = crypto.randomUUID();
	const results = await db.batch([
		db
			.prepare(
				`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
 SELECT ?,?,?,?,?,json_object('state',COALESCE((SELECT state FROM variant_lifecycle WHERE family=? AND variant=?),?)),?,?
 WHERE COALESCE((SELECT state FROM variant_lifecycle WHERE family=? AND variant=?),?)<>?
 AND EXISTS(SELECT 1 FROM admin_actor WHERE id=? AND role='admin')`
			)
			.bind(
				operation,
				actor,
				action,
				variant,
				reason.trim(),
				family,
				variant,
				initial,
				JSON.stringify({ state: next }),
				now,
				family,
				variant,
				initial,
				next,
				actor
			),
		db
			.prepare(
				`INSERT INTO variant_lifecycle(family,variant,state,reason) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_audit WHERE id=?)
 ON CONFLICT(family,variant) DO UPDATE SET state=excluded.state,reason=excluded.reason`
			)
			.bind(family, variant, next, reason.trim(), operation)
	]);
	if (!results[1].meta.changes) throw new RunError('game_conflict', 409);
}
