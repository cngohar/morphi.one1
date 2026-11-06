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

const countKeys = [
	'shown',
	'ignored',
	'played',
	'abandoned',
	'finished',
	'open',
	'imported',
	'totalCompleted',
	'ranked'
] as const;
type Counts = Record<(typeof countKeys)[number], number>;
const emptyCounts = (): Counts => Object.fromEntries(countKeys.map((key) => [key, 0])) as Counts;
const variantDefinitions = (family: PuzzleId) =>
	catalog[family].variants?.length
		? catalog[family].variants!
		: [{ id: '', enabled: true, leaderboardGroups: catalog[family].leaderboardGroups }];
function sumCounts(rows: Counts[]): Counts {
	const total = emptyCounts();
	for (const row of rows) {
		if (
			row.shown !== row.ignored + row.played ||
			row.played !== row.abandoned + row.finished + row.open ||
			row.totalCompleted !== row.finished + row.imported
		)
			throw new Error('game_statistics_invariant');
		for (const key of countKeys) total[key] += row[key];
	}
	return total;
}

export type ActivityMappingEntry = {
	family: string;
	variant: string;
	defaultVariant: string;
	rulesGroup: string;
};

export function buildActivityMapping(family?: PuzzleId): ActivityMappingEntry[] {
	const families = family ? [family] : (Object.keys(catalog) as PuzzleId[]);
	return families.flatMap((family) => {
		const defs = variantDefinitions(family);
		const defaultVariant = defs[0].id;
		return defs.flatMap((variant) =>
			variant.leaderboardGroups.map((group) => ({
				family,
				variant: variant.id,
				defaultVariant,
				rulesGroup: group
			}))
		);
	});
}

export async function queryActivityCounts(
	db: D1Database,
	mapping: ActivityMappingEntry[]
): Promise<(Counts & { family: PuzzleId; variant: string })[]> {
	if (mapping.length === 0) return [];
	const rows = (
		await db
			.prepare(
				`WITH mapping(family,variant,default_variant,rules_group) AS (
 SELECT value ->> 'family', value ->> 'variant', value ->> 'defaultVariant', value ->> 'rulesGroup' FROM json_each(?)
 ), starts AS (
 SELECT id,user_id,family,variant,first_move_at,abandoned_at FROM play_session WHERE family IN (SELECT family FROM mapping)
 UNION ALL
 SELECT run_id,user_id,family,variant,first_move_at,abandoned_at FROM account_round_activity a
 WHERE a.family IN (SELECT family FROM mapping) AND NOT EXISTS(SELECT 1 FROM play_session p WHERE p.id=a.run_id AND p.user_id=a.user_id AND p.family=a.family)
 ), observed AS (
 SELECT s.*,m.variant mapped_variant,r.id completed FROM starts s
 JOIN (SELECT DISTINCT family,variant,default_variant FROM mapping) m ON m.family=s.family AND m.variant=COALESCE(s.variant,m.default_variant)
 LEFT JOIN completed_run r ON r.id=s.id AND r.user_id=s.user_id AND r.family=s.family
 AND EXISTS(SELECT 1 FROM mapping g WHERE g.family=m.family AND g.variant=m.variant AND g.rules_group=r.rules_group)
 ), starts_counts AS (
 SELECT family,mapped_variant variant,count(*) shown,
 COALESCE(sum(first_move_at IS NULL AND completed IS NULL),0) ignored,
 COALESCE(sum(first_move_at IS NOT NULL OR completed IS NOT NULL),0) played,
 COALESCE(sum((first_move_at IS NOT NULL OR completed IS NOT NULL) AND abandoned_at IS NOT NULL AND completed IS NULL),0) abandoned,
 COALESCE(sum(completed IS NOT NULL),0) finished,
 COALESCE(sum(first_move_at IS NOT NULL AND abandoned_at IS NULL AND completed IS NULL),0) open
 FROM observed GROUP BY family,mapped_variant
 ), completions AS (
 SELECT m.family,m.variant,count(r.id) totalCompleted,COALESCE(sum(r.ranked),0) ranked,
 COALESCE(sum(r.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM starts s WHERE s.id=r.id AND s.user_id=r.user_id AND s.family=r.family AND COALESCE(s.variant,m.default_variant)=m.variant)),0) imported
 FROM mapping m LEFT JOIN completed_run r ON r.family=m.family AND r.rules_group=m.rules_group GROUP BY m.family,m.variant
 ) SELECT c.*,COALESCE(s.shown,0) shown,COALESCE(s.ignored,0) ignored,COALESCE(s.played,0) played,
 COALESCE(s.abandoned,0) abandoned,COALESCE(s.finished,0) finished,COALESCE(s.open,0) open
 FROM completions c LEFT JOIN starts_counts s ON s.family=c.family AND s.variant=c.variant`
			)
			.bind(JSON.stringify(mapping))
			.all<Counts & { family: PuzzleId; variant: string }>()
	).results;
	sumCounts(rows);
	return rows;
}

/** One catalog mapping keeps legacy defaults and all family/variant totals in the same cohort. */
async function activityCounts(db: D1Database, family?: PuzzleId) {
	return queryActivityCounts(db, buildActivityMapping(family));
}

export async function gameOverview(db: D1Database, selectedFamily?: PuzzleId) {
	if (selectedFamily !== undefined && !Object.hasOwn(catalog, selectedFamily))
		throw new RunError('input');
	const families = selectedFamily ? [selectedFamily] : Object.keys(catalog);
	const where = selectedFamily ? ' WHERE family=?' : '';
	const parameters = selectedFamily ? [selectedFamily] : [];
	for (const family of families) await ensureCatalogFamily(db, family);
	const states = (
		await db
			.prepare(`SELECT family,state,restore_until FROM game_lifecycle${where}`)
			.bind(...parameters)
			.all<{
				family: PuzzleId;
				state: 'enabled' | 'disabled' | 'deleted' | 'hard-deleted';
				restore_until: number | null;
			}>()
	).results;
	const lifecycle = (
		await db
			.prepare(`SELECT family,variant,state FROM variant_lifecycle${where}`)
			.bind(...parameters)
			.all<{
				family: PuzzleId;
				variant: string;
				state: 'enabled' | 'disabled';
			}>()
	).results;
	const stats = (
		await db
			.prepare(
				`SELECT family,count(*) completed,coalesce(sum(ranked),0) ranked,avg(score) averageScore,max(score) bestScore,avg(seconds) averageSeconds FROM completed_run${where} GROUP BY family`
			)
			.bind(...parameters)
			.all<{
				family: PuzzleId;
				completed: number;
				ranked: number;
				averageScore: number | null;
				bestScore: number | null;
				averageSeconds: number | null;
			}>()
	).results;
	const counts = await activityCounts(db, selectedFamily);
	return families.map((family) => {
		const state = states.find((row) => row.family === family);
		if (!state) throw new Error('missing_game_lifecycle');
		const variants = variantDefinitions(family).map((definition) => ({
			id: definition.id,
			state:
				lifecycle.find((row) => row.family === family && row.variant === definition.id)?.state ??
				(definition.enabled === false ? ('disabled' as const) : ('enabled' as const)),
			...counts.find((row) => row.family === family && row.variant === definition.id)!
		}));
		return {
			family,
			state: state.state,
			restoreUntil: state.restore_until,
			completed: 0,
			averageScore: null,
			bestScore: null,
			averageSeconds: null,
			...stats.find((row) => row.family === family),
			...sumCounts(variants),
			variants,
			variantCount: catalog[family].variants?.length ?? 0,
			enabledVariantCount: catalog[family].variants?.length
				? variants.filter((row) => row.state === 'enabled').length
				: 0
		};
	});
}
const overviewKey = 'admin:games-overview:v1';
type Overview = {
	updatedAt: number;
	games: Awaited<ReturnType<typeof gameOverview>>;
	totals: Counts;
	families: { total: number; enabled: number; disabled: number; deleted: number };
	variants: { total: number; enabled: number };
};
function validOverview(value: unknown, now: number): value is Overview {
	if (!value || typeof value !== 'object') return false;
	const row = value as Overview;
	if (
		!Number.isSafeInteger(row.updatedAt) ||
		row.updatedAt > now ||
		now - row.updatedAt >= 60_000 ||
		!Array.isArray(row.games) ||
		row.games.length !== Object.keys(catalog).length
	)
		return false;
	try {
		for (const [index, family] of Object.keys(catalog).entries()) {
			const game = row.games[index];
			if (
				game.family !== family ||
				!['enabled', 'disabled', 'deleted', 'hard-deleted'].includes(game.state) ||
				game.variants.map((entry) => entry.id).join() !==
					variantDefinitions(family)
						.map((entry) => entry.id)
						.join()
			)
				return false;
			for (const counts of [game, ...game.variants])
				if (!countKeys.every((key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0))
					return false;
			const total = sumCounts(game.variants);
			if (!countKeys.every((key) => game[key] === total[key])) return false;
		}
		const total = sumCounts(row.games);
		return (
			countKeys.every((key) => row.totals[key] === total[key]) &&
			JSON.stringify(row.families) === JSON.stringify(familyTotals(row.games)) &&
			JSON.stringify(row.variants) === JSON.stringify(variantTotals(row.games))
		);
	} catch {
		return false;
	}
}
const familyTotals = (games: Overview['games']) => ({
	total: games.length,
	enabled: games.filter((game) => game.state === 'enabled').length,
	disabled: games.filter((game) => game.state === 'disabled').length,
	deleted: games.filter((game) => game.state === 'deleted' || game.state === 'hard-deleted').length
});
const variantTotals = (games: Overview['games']) => ({
	total: games.reduce((sum, game) => sum + game.variantCount, 0),
	enabled: games.reduce((sum, game) => sum + game.enabledVariantCount, 0)
});
export async function cachedGameOverview(
	db: D1Database,
	cache?: KVNamespace,
	now = Date.now()
): Promise<Overview> {
	if (cache)
		try {
			const cached = await cache.get(overviewKey, 'json');
			if (validOverview(cached, now)) return cached;
		} catch {
			console.warn('morphi:games_overview_cache_read_failed');
		}
	const games = await gameOverview(db);
	const overview = {
		updatedAt: now,
		games,
		totals: sumCounts(games),
		families: familyTotals(games),
		variants: variantTotals(games)
	};
	if (cache)
		try {
			await cache.put(overviewKey, JSON.stringify(overview), { expirationTtl: 60 });
		} catch {
			console.warn('morphi:games_overview_cache_write_failed');
		}
	return overview;
}
async function invalidateOverview(cache?: KVNamespace) {
	if (cache)
		try {
			await cache.delete(overviewKey);
		} catch {
			console.warn('morphi:games_overview_cache_invalidation_failed');
		}
}

export async function gameStatistics(
	db: D1Database,
	family: PuzzleId,
	summary?: Awaited<ReturnType<typeof gameOverview>>[number]
) {
	if (summary && summary.family !== family) throw new RunError('input');
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
	const counts = summary?.variants ?? (await activityCounts(db, family));
	const variants = await Promise.all(
		(await variantOverview(db, family)).map(async (variant) => {
			const definition = puzzleVariant(family, variant.id)!;
			const groups = definition.leaderboardGroups;
			const placeholders = groups.map(() => '?').join(',');
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
				...counts.find((row) => row.family === family && row.variant === variant.id)!,
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
	reason = '',
	days = 7,
	now = Date.now(),
	cache?: KVNamespace
) {
	if (action === 'game-enable') reason = 'Resumed by operator (no reason entered)';
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
	await invalidateOverview(cache);
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
	reason = '',
	now = Date.now(),
	cache?: KVNamespace
) {
	if (action === 'variant-enable') reason = 'Resumed by operator (no reason entered)';
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
	await invalidateOverview(cache);
}
