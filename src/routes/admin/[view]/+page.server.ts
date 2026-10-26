import { error, fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { operatorRequest } from '#lib/server/operator-http.js';
import { auditOperatorRead } from '#lib/server/operator.js';
import { moderate, type ModerationAction } from '#lib/server/moderation.js';
import { validatePlayerName } from '#lib/server/players.js';
import { deleteAccountForPrivacy } from '#lib/server/retention.js';
import { RunError } from '#lib/server/runs.js';
import type { Actions, PageServerLoad } from './$types';
const views = ['dashboard', 'status', 'moderation', 'queue', 'audit', 'privacy'] as const;
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
	const page = Number(event.url.searchParams.get('page') ?? 0);
	if (!Number.isSafeInteger(page) || page < 0 || page > 1000) error(400, 'Invalid page');
	const ranked = await env.DB.prepare("SELECT enabled FROM site_control WHERE key='ranked'").first<{
		enabled: number;
	}>();
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
			created_at: number;
		}[] = [];
	try {
		if (event.params.view === 'dashboard') {
			const rows = await env.DB.prepare(
				`SELECT (SELECT count(*) FROM user) accounts,(SELECT count(*) FROM completed_run) runs,(SELECT count(*) FROM play_session) starts,(SELECT count(*) FROM play_session WHERE payload_hash IS NOT NULL) claims,(SELECT count(*) FROM (SELECT user_id,rules_group FROM completed_run WHERE ranked=1 AND hidden=0 AND NOT EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=completed_run.user_id) GROUP BY user_id,rules_group)) entries,(SELECT count(*) FROM completed_run WHERE hidden=1) hidden,(SELECT count(*) FROM player_ban) bans,(SELECT count(DISTINCT target) FROM admin_audit WHERE action IN ('privacy-delete','account-deleted')) deletions`
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
						'SELECT r.id,p.name,r.family,r.score,r.hidden,EXISTS(SELECT 1 FROM player_ban b WHERE b.user_id=p.user_id) ban FROM player p LEFT JOIN completed_run r ON r.user_id=p.user_id WHERE p.normalized_name=? OR r.id=? ORDER BY r.created_at DESC LIMIT 25'
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
		if (event.params.view === 'audit')
			audit = (
				await env.DB.prepare(
					'SELECT id,actor,action,target,reason,created_at FROM admin_audit ORDER BY created_at DESC,id LIMIT 26 OFFSET ?'
				)
					.bind(page * 25)
					.all<(typeof audit)[number]>()
			).results;
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
		view: event.params.view,
		ranked: ranked?.enabled !== 0,
		metrics,
		daily,
		split,
		lookup,
		cases: cases.slice(0, 25),
		audit: audit.slice(0, 25),
		more: cases.length > 25 || audit.length > 25,
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
						!['action', 'target', 'reason', 'name', 'kind', 'confirm', 'offset'].includes(key)
				)
			)
				return fail(400, { code: 'input' });
			const action = String(body.get('action') ?? '');
			if (
				![
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
					'logout'
				].includes(action)
			)
				return fail(400, { code: 'input' });
			const permission =
				action === 'logout' ? event.params.view : action.startsWith('ranked-') ? 'ranked' : action;
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
				await moderate(env.DB, actor.id, action as ModerationAction, resolved, reason);
			} else if (action === 'rename') {
				const name = validatePlayerName(body.get('name'));
				if (!name) return fail(400, { code: 'input' });
				const old = await env.DB.prepare('SELECT user_id,name FROM player WHERE normalized_name=?')
					.bind(target.toLowerCase())
					.first<{ user_id: string; name: string }>();
				if (!old) return fail(404, { code: 'missing' });
				await env.DB.batch([
					env.DB.prepare(
						'UPDATE player SET name=?,normalized_name=?,updated_at=? WHERE user_id=?'
					).bind(name, name.toLowerCase(), Date.now(), old.user_id),
					env.DB.prepare(
						"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'rename',?,?,?,?,?)"
					).bind(
						crypto.randomUUID(),
						actor.id,
						old.user_id,
						reason,
						JSON.stringify({ name: old.name }),
						JSON.stringify({ name }),
						Date.now()
					)
				]);
			} else if (action === 'case-add') {
				const kind = String(body.get('kind'));
				if (!['username', 'score'].includes(kind) || !/^CASE-[A-Za-z0-9_-]{3,55}$/.test(reason))
					return fail(400, { code: 'input' });
				await env.DB.batch([
					env.DB.prepare(
						"INSERT INTO moderation_case(id,kind,target,state,created_at) VALUES(?,?,?,'open',?)"
					).bind(reason, kind, target, Date.now()),
					env.DB.prepare(
						"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'case-add',?,?,NULL,?,?)"
					).bind(
						crypto.randomUUID(),
						actor.id,
						reason,
						reason,
						JSON.stringify({ kind, target, state: 'open' }),
						Date.now()
					)
				]);
			} else if (action === 'case-resolve') {
				const current = await env.DB.prepare('SELECT id FROM moderation_case WHERE id=?')
					.bind(target)
					.first();
				if (!current) return fail(404, { code: 'missing' });
				await env.DB.batch([
					env.DB.prepare("UPDATE moderation_case SET state='resolved' WHERE id=?").bind(target),
					env.DB.prepare(
						"INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,'case-resolve',?,?,?, ?,?)"
					).bind(crypto.randomUUID(), actor.id, target, reason, '"open"', '"resolved"', Date.now())
				]);
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
