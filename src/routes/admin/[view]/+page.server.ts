import { readLiveThemeConfig } from '#lib/server/config.js';
import {
	listThemeDrafts,
	listThemeVersions,
	saveThemeDraft,
	checkThemeDraft,
	publishThemeDraft,
	rollbackThemeConfig
} from '#lib/server/theme-admin.js';
import { gameOverview, gameStatistics, changeGame } from '#lib/server/games.js';
import { readAudit, exportAuditYear } from '#lib/server/audit.js';
import { softDeleteUser, restoreDeletedUser } from '#lib/server/user-lifecycle.js';
import { userDirectory, userDetail, userOverview } from '#lib/server/admin-users.js';
import {
	readLiveScoreConfig,
	listScoreVersions,
	rollbackScoreConfig,
	saveScoreConfig
} from '#lib/server/scoring.js';
import { catalog } from '#lib/catalog.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { operatorRequest } from '#lib/server/operator-http.js';
import { auditOperatorRead } from '#lib/server/operator.js';
import {
	moderate,
	renamePlayerByOperator,
	addModerationCase,
	resolveModerationCase,
	undoModeration,
	type ModerationAction
} from '#lib/server/moderation.js';
import { validatePlayerName } from '#lib/server/players.js';
import { deleteAccountForPrivacy } from '#lib/server/retention.js';
import { RunError } from '#lib/server/runs.js';
import type { Actions, PageServerLoad } from './$types';
const views = [
	'dashboard',
	'users',
	'status',
	'moderation',
	'queue',
	'audit',
	'privacy',
	'scoring',
	'themes',
	'games'
] as const;
const identifier = (value: unknown) =>
	typeof value === 'string' && /^[A-Za-z0-9_-]{3,80}$/.test(value) ? value : null;
const reasonValue = (value: unknown) =>
	typeof value === 'string' &&
	value.trim().length >= 3 &&
	value.length <= 240 &&
	!/[\r\n@]/.test(value)
		? value.trim()
		: null;
export const load: PageServerLoad = async (event) => {
	if (!views.includes(event.params.view as (typeof views)[number])) error(404, 'Not found');
	let actor;
	try {
		actor = await operatorRequest(event, event.params.view);
	} catch (e) {
		if (e instanceof RunError && e.status === 401) redirect(303, '/admin/sign-in');
		if (e instanceof RunError) error(e.status, 'Access unavailable');
		throw e;
	}
	const filters = Object.fromEntries(
		['actor', 'audit_action', 'audit_target', 'from', 'to'].map((key) => [
			key,
			event.url.searchParams.get(key) ?? ''
		])
	);
	const page = Number(event.url.searchParams.get('page') ?? 0);
	if (!Number.isSafeInteger(page) || page < 0 || page > 1000) error(400, 'Invalid page');
	const ranked = await env.DB.prepare("SELECT enabled FROM site_control WHERE key='ranked'").first<{
		enabled: number;
	}>();
	let directory: Awaited<ReturnType<typeof userDirectory>> = { rows: [], more: false };
	let detail: Awaited<ReturnType<typeof userDetail>> | null = null;
	let usersOverview: Awaited<ReturnType<typeof userOverview>> | null = null;
	let auditOverview: { total: number; recent: number; operators: number } | null = null;
	const subview = event.url.searchParams.get('subview') ?? '';
	const gameParam = event.url.searchParams.get('game');
	if (event.params.view === 'games' && gameParam !== null && !Object.hasOwn(catalog, gameParam))
		error(400, 'Invalid game');
	const selectedGame = event.params.view === 'games' ? (gameParam as PuzzleId | null) : null;
	const userSearch = event.url.searchParams.get('search') ?? '';
	const userStatus = event.url.searchParams.get('status') ?? 'all';
	const requestedTab = event.url.searchParams.get('tab') ?? 'stats';
	const detailTab = ['stats', 'activity', 'rounds', 'actions'].includes(requestedTab)
		? requestedTab
		: 'stats';
	let auditMore = false;
	let scoring: (Awaited<ReturnType<typeof readLiveScoreConfig>>['config'] & {
		family: PuzzleId;
		liveVersion: string;
		versions: Awaited<ReturnType<typeof listScoreVersions>>;
	})[] = [];
	let themes: {
		live: Awaited<ReturnType<typeof readLiveThemeConfig>>;
		drafts: Awaited<ReturnType<typeof listThemeDrafts>>;
		versions: Awaited<ReturnType<typeof listThemeVersions>>;
	} | null = null;
	let games: Awaited<ReturnType<typeof gameOverview>> = [];
	let gameStats: Awaited<ReturnType<typeof gameStatistics>> = { rows: [], more: false };
	let metrics: Record<string, number> = {},
		daily: { day: string; total: number }[] = [],
		split: { family: string; total: number }[] = [],
		lookup: {
			id: string;
			name: string;
			family: string | null;
			score: number | null;
			hidden: number;
			ban: number;
		}[] = [],
		cases: { id: string; kind: string; target: string; state: string }[] = [],
		audit: {
			id: string;
			actor: string;
			action: string;
			target: string;
			reason: string;
			before: string | null;
			after: string | null;
			created_at: number;
		}[] = [];
	try {
		if (event.params.view === 'themes')
			themes = {
				live: await readLiveThemeConfig(env.DB, env.CONFIG_CACHE),
				drafts: await listThemeDrafts(env.DB),
				versions: await listThemeVersions(env.DB)
			};
		if (event.params.view === 'users') {
			const id = event.url.searchParams.get('id');
			if (id) {
				if (!identifier(id)) error(400, 'Invalid reference');
				detail = await userDetail(env.DB, actor, id, page);
			} else if (subview === 'directory')
				directory = await userDirectory(env.DB, actor, page, userSearch, userStatus);
			else usersOverview = await userOverview(env.DB, actor);
		}
		if (event.params.view === 'games') {
			games = await gameOverview(env.DB);
			if (selectedGame) gameStats = await gameStatistics(env.DB, selectedGame);
		}
		if (event.params.view === 'scoring' || selectedGame)
			scoring = await Promise.all(
				(selectedGame ? [selectedGame] : Object.keys(catalog)).map(async (family) => {
					const { config, liveVersion } = await readLiveScoreConfig(env.DB, family);
					return {
						family,
						...config,
						liveVersion,
						versions: await listScoreVersions(env.DB, family)
					};
				})
			);
		if (event.params.view === 'dashboard') {
			const rows = await env.DB.prepare(
				`SELECT (SELECT count(*) FROM user) accounts,(SELECT count(*) FROM completed_run) runs,(SELECT count(*) FROM play_session) starts,(SELECT count(*) FROM play_session WHERE payload_hash IS NOT NULL) claims,(SELECT count(*) FROM (SELECT user_id,rules_group FROM completed_run WHERE ranked=1 AND hidden=0 AND NOT EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=completed_run.user_id AND (b.expires_at IS NULL OR b.expires_at>unixepoch()*1000)) AND NOT EXISTS(SELECT 1 FROM user_lifecycle l WHERE l.user_id=completed_run.user_id) GROUP BY user_id,rules_group)) entries,(SELECT count(*) FROM completed_run WHERE hidden=1) hidden,(SELECT count(*) FROM player_ban WHERE expires_at IS NULL OR expires_at>unixepoch()*1000) bans,(SELECT count(DISTINCT target) FROM admin_audit WHERE action IN ('privacy-delete','account-deleted')) deletions`
			).first<Record<string, number>>();
			metrics = rows ?? {};
			const events = await env.DB.prepare(
				'SELECT event,count(*) total FROM anonymous_event WHERE created_at>=? GROUP BY event'
			)
				.bind(Date.now() - 7 * 86400000)
				.all<{ event: string; total: number }>();
			for (const row of events.results) metrics[row.event] = row.total;
			daily = (
				await env.DB.prepare(
					"SELECT strftime('%Y-%m-%d',created_at/1000,'unixepoch') day,count(*) total FROM completed_run WHERE created_at>=? GROUP BY day ORDER BY day"
				)
					.bind(Date.now() - 7 * 86400000)
					.all<{ day: string; total: number }>()
			).results;
			split = (
				await env.DB.prepare(
					'SELECT family,count(*) total FROM completed_run GROUP BY family'
				).all<{ family: string; total: number }>()
			).results;
		}
		if (event.params.view === 'moderation') {
			const search = event.url.searchParams.get('ref');
			if (search) {
				if (!identifier(search)) error(400, 'Invalid reference');
				lookup = (
					await env.DB.prepare(
						'SELECT r.id,p.name,r.family,r.score,r.hidden,EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=p.user_id AND (b.expires_at IS NULL OR b.expires_at>unixepoch()*1000)) ban FROM player p LEFT JOIN completed_run r ON r.user_id=p.user_id WHERE p.normalized_name=? OR r.id=? ORDER BY r.created_at DESC LIMIT 25'
					)
						.bind(search.toLowerCase(), search)
						.all<(typeof lookup)[number]>()
				).results;
			}
		}
		if (event.params.view === 'queue')
			cases = (
				await env.DB.prepare(
					'SELECT id,kind,target,state FROM moderation_case ORDER BY created_at DESC,id LIMIT 26 OFFSET ?'
				)
					.bind(page * 25)
					.all<(typeof cases)[number]>()
			).results;
		if (event.params.view === 'audit') {
			if (subview !== 'viewer')
				auditOverview = await env.DB.prepare(
					`SELECT count(*) total, sum(CASE WHEN created_at>=? THEN 1 ELSE 0 END) recent, count(DISTINCT actor) operators FROM admin_audit`
				)
					.bind(Date.now() - 7 * 86400000)
					.first<{ total: number; recent: number; operators: number }>();
			const from = event.url.searchParams.get('from');
			const to = event.url.searchParams.get('to');
			const date = (value: string | null) => {
				if (!value) return undefined;
				if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) error(400, 'Invalid date');
				const timestamp = Date.parse(`${value}T00:00:00Z`);
				if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value)
					error(400, 'Invalid date');
				return timestamp;
			};
			const lower = date(from),
				upper = date(to);
			if (lower !== undefined && upper !== undefined && lower > upper)
				error(400, 'Invalid date range');
			const filter = {
				actor: event.url.searchParams.get('actor') || undefined,
				action: event.url.searchParams.get('audit_action') || undefined,
				target: event.url.searchParams.get('audit_target') || undefined,
				from: lower,
				to: upper === undefined ? undefined : upper + 86400000,
				page
			};
			const result = await readAudit(env.DB, actor.id, filter);
			audit = result.rows;
			auditMore = result.more;
		}
		await auditOperatorRead(
			env.DB,
			actor.id,
			`${event.params.view}:read`,
			event.params.view === 'moderation'
				? (event.url.searchParams.get('ref') ?? 'no-lookup')
				: `page-${page}`
		);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		console.error('morphi:operator_read_failed');
		return {
			actor,
			filters,
			subview,
			selectedGame,
			gameStats,
			detailTab,
			userSearch,
			userStatus,
			usersOverview,
			auditOverview,
			directory,
			detail,
			themes: null,
			scoring: [],
			games: [],
			view: event.params.view,
			ranked: ranked?.enabled !== 0,
			metrics,
			daily,
			split,
			lookup: [],
			cases: [],
			audit: [],
			page,
			unavailable: true
		};
	}
	return {
		actor,
		filters,
		subview,
		selectedGame,
		gameStats,
		detailTab,
		userSearch,
		userStatus,
		usersOverview,
		auditOverview,
		directory,
		detail,
		themes,
		scoring,
		games,
		view: event.params.view,
		ranked: ranked?.enabled !== 0,
		metrics,
		daily,
		split,
		lookup,
		cases: cases.slice(0, 25),
		audit: audit.slice(0, 25),
		more: cases.length > 25 || auditMore,
		page,
		unavailable: false
	};
};
export const actions: Actions = {
	default: async (event) => {
		try {
			const body = await event.request.formData();
			if (
				[...body.keys()].some(
					(key) =>
						![
							'action',
							'target',
							'reason',
							'name',
							'kind',
							'confirm',
							'offset',
							'expected',
							'values',
							'duration',
							'year',
							'cursor',
							'sourceVersion'
						].includes(key)
				)
			)
				return fail(400, { code: 'input' });
			const action = String(body.get('action') ?? '');
			if (
				![
					'theme-draft',
					'theme-check',
					'theme-publish',
					'theme-rollback',
					'score-change',
					'score-rollback',
					'game-enable',
					'game-disable',
					'game-delete',
					'game-restore',
					'game-hard-delete',
					'score-defaults',
					'ranked-on',
					'ranked-off',
					'hide',
					'restore',
					'ban',
					'unban',
					'rename',
					'case-add',
					'case-resolve',
					'export',
					'delete',
					'logout',
					'user-delete',
					'user-restore',
					'undo',
					'audit-export'
				].includes(action)
			)
				return fail(400, { code: 'input' });
			const permission =
				action === 'logout'
					? event.params.view
					: action.startsWith('theme-')
						? 'themes'
						: action.startsWith('game-')
							? 'games'
							: action.startsWith('score-')
								? 'scoring'
								: action.startsWith('ranked-')
									? 'ranked'
									: action;
			const actor = await operatorRequest(event, permission, action !== 'logout');
			const reason = reasonValue(body.get('reason')),
				target = identifier(body.get('target'));
			if (action === 'logout') {
				await env.DB.batch([
					env.DB.prepare('DELETE FROM admin_web_session WHERE user_id=?').bind(actor.id),
					env.DB.prepare(
						"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'operator-logout',?,'Operator sign-out',NULL,NULL,?)"
					).bind(crypto.randomUUID(), actor.id, actor.id, Date.now())
				]);
				event.cookies.delete('morphi_operator', { path: '/admin' });
				redirect(303, '/admin/sign-in');
			}
			if (!reason || !target || body.get('confirm') !== 'yes') return fail(400, { code: 'input' });
			if (action.startsWith('theme-')) {
				const expected = String(body.get('expected') ?? '');
				try {
					if (action === 'theme-draft')
						return {
							success: true,
							themeDraft: await saveThemeDraft(
								env.DB,
								actor.id,
								expected,
								JSON.parse(String(body.get('values'))),
								reason
							)
						};
					if (action === 'theme-check')
						return { success: true, themeIssues: await checkThemeDraft(env.DB, actor.id, target) };
					if (action === 'theme-publish')
						await publishThemeDraft(env.DB, actor.id, target, expected, reason);
					if (action === 'theme-rollback')
						await rollbackThemeConfig(
							env.DB,
							actor.id,
							expected,
							String(body.get('sourceVersion') ?? ''),
							reason
						);
				} catch (e) {
					if (e instanceof SyntaxError || e instanceof RangeError)
						return fail(400, { code: 'input' });
					throw e;
				}
				return { success: true };
			}
			if (action.startsWith('game-')) {
				if (!Object.hasOwn(catalog, target)) return fail(400, { code: 'input' });
				const days = action === 'game-delete' ? Number(body.get('duration')) : 7;
				await changeGame(
					env.DB,
					actor.id,
					target as PuzzleId,
					action as Parameters<typeof changeGame>[3],
					reason,
					days
				);
				return { success: true };
			}
			if (action === 'user-delete' || action === 'user-restore') {
				if (action === 'user-delete') {
					const duration = Number(body.get('duration'));
					if (!Number.isSafeInteger(duration) || duration < 1 || duration > 365)
						return fail(400, { code: 'input' });
					await softDeleteUser(env.DB, actor.id, target, reason, duration);
				} else await restoreDeletedUser(env.DB, actor.id, target, reason);
				return { success: true };
			}
			if (action === 'undo') {
				await undoModeration(env.DB, actor.id, target, reason);
				return { success: true };
			}
			if (action === 'audit-export') {
				const year = Number(body.get('year'));
				const cursor = String(body.get('cursor') ?? '') || undefined;
				const exported = await exportAuditYear(env.DB, actor.id, year, cursor);
				return { success: true, exported: JSON.stringify(exported) };
			}
			if (action.startsWith('score-')) {
				if (!Object.hasOwn(catalog, target)) return fail(400, { code: 'input' });
				const family = target as PuzzleId;
				if (action === 'score-rollback') {
					await rollbackScoreConfig(
						env.DB,
						actor.id,
						family,
						String(body.get('expected') ?? ''),
						String(body.get('sourceVersion') ?? ''),
						reason
					);
					return { success: true };
				}
				let values: unknown;
				try {
					values =
						action === 'score-defaults'
							? catalog[family].scoring.defaults
							: JSON.parse(String(body.get('values')));
				} catch {
					return fail(400, { code: 'input' });
				}
				try {
					await saveScoreConfig(
						env.DB,
						actor.id,
						family,
						String(body.get('expected')),
						values,
						reason,
						action === 'score-defaults'
					);
				} catch (e) {
					if (e instanceof RangeError) return fail(400, { code: 'input' });
					throw e;
				}
				return { success: true };
			}
			if (action.startsWith('ranked-') && target !== 'ranked') return fail(400, { code: 'input' });
			if (['ranked-on', 'ranked-off', 'hide', 'restore', 'ban', 'unban'].includes(action)) {
				let resolved = target;
				if (action === 'ban' || action === 'unban') {
					const player = await env.DB.prepare('SELECT user_id FROM player WHERE normalized_name=?')
						.bind(target.toLowerCase())
						.first<{ user_id: string }>();
					if (!player) return fail(404, { code: 'missing' });
					resolved = player.user_id;
				}
				const rawDuration = body.get('duration');
				const duration = rawDuration === null || rawDuration === '' ? null : Number(rawDuration);
				if (
					duration !== null &&
					(!Number.isSafeInteger(duration) || duration < 1 || duration > 36500 || action !== 'ban')
				)
					return fail(400, { code: 'input' });
				await moderate(
					env.DB,
					actor.id,
					action as ModerationAction,
					resolved,
					reason,
					duration === null ? null : Date.now() + duration * 86400000
				);
			} else if (action === 'rename') {
				const name = validatePlayerName(body.get('name'));
				if (!name) return fail(400, { code: 'input' });
				await renamePlayerByOperator(env.DB, actor.id, target, name, reason);
			} else if (action === 'case-add') {
				const kind = String(body.get('kind'));
				if (!['username', 'score'].includes(kind) || !/^CASE-[A-Za-z0-9_-]{3,55}$/.test(reason))
					return fail(400, { code: 'input' });
				await addModerationCase(env.DB, actor.id, reason, kind, target, reason);
			} else if (action === 'case-resolve') {
				await resolveModerationCase(env.DB, actor.id, target, reason);
			} else if (action === 'delete' || action === 'export') {
				if (!/^CASE-[A-Za-z0-9_-]{3,55}$/.test(reason)) return fail(400, { code: 'input' });
				const player = await env.DB.prepare('SELECT user_id FROM player WHERE normalized_name=?')
					.bind(target.toLowerCase())
					.first<{ user_id: string }>();
				if (!player) return fail(404, { code: 'missing' });
				if (action === 'delete')
					await deleteAccountForPrivacy(env.DB, actor.id, player.user_id, reason);
				else {
					const profile = await env.DB.prepare(
						'SELECT id,name,email,created_at FROM user WHERE id=?'
					)
						.bind(player.user_id)
						.first();
					const offset = Number(body.get('offset') ?? 0);
					if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || offset % 100)
						return fail(400, { code: 'input' });
					const rounds = (
						await env.DB.prepare(
							'SELECT family,seed,move_log,moves,score,seconds,created_at FROM completed_run WHERE user_id=? ORDER BY created_at DESC,id LIMIT 100 OFFSET ?'
						)
							.bind(player.user_id, offset)
							.all()
					).results;
					await env.DB.prepare(
						"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'privacy-export',?,?,NULL,NULL,?)"
					)
						.bind(crypto.randomUUID(), actor.id, player.user_id, reason, Date.now())
						.run();
					return {
						exported: JSON.stringify({
							profile,
							rounds,
							limit: 100,
							offset,
							nextOffset: rounds.length === 100 ? offset + 100 : null
						}),
						success: true
					};
				}
			}
			return { success: true };
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e && e.status === 303) throw e;
			console.warn('morphi:operator_action_failed');
			return fail(e instanceof RunError ? e.status : 503, {
				code: e instanceof RunError ? e.code : 'unavailable'
			});
		}
	}
};
