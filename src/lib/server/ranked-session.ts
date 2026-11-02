import { desc, eq } from 'drizzle-orm';
import { catalog } from '#lib/catalog.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import { randomSeed } from '#lib/seeds.js';
import { defaultScoreConfig } from '#lib/scoring.js';
import { CARD_RANKED_OPENING_MS } from '#lib/round-timing.js';
import { drawFreshTheme } from '#lib/engine/theme/freshness.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
import { createDatabase } from './db/index.js';
import { playSession } from './db/schema.js';
import { readLiveScoreConfig } from './scoring.js';
import { RunError } from './runs.js';
import { ensureCatalogFamily } from './config.js';

export async function activeRanked(binding: D1Database, userId: string, now = Date.now()) {
	const row = await binding
		.prepare(
			`SELECT id, expires_at AS expiresAt, payload_hash IS NOT NULL AS saving
		FROM play_session active WHERE user_id=? AND abandoned_at IS NULL AND expires_at>?
		AND NOT EXISTS (SELECT 1 FROM completed_run finished WHERE finished.id=active.id)
		ORDER BY (payload_hash IS NOT NULL) DESC, sequence DESC LIMIT 1`
		)
		.bind(userId, now)
		.first<{ id: string; expiresAt: number; saving: number }>();
	return row ? { ...row, saving: Boolean(row.saving) } : null;
}

export async function abandonRanked(
	binding: D1Database,
	userId: string,
	id: string,
	now = Date.now()
) {
	await binding
		.prepare(
			`UPDATE play_session SET abandoned_at=? WHERE user_id=? AND id=?
		AND payload_hash IS NULL AND abandoned_at IS NULL`
		)
		.bind(now, userId, id)
		.run();
	// Exact-id updates make delayed/stale abandons harmless to the replacement.
	return { ok: true };
}

export async function startRanked(
	binding: D1Database,
	userId: string,
	family: PuzzleId,
	ipHash: string,
	now = Date.now(),
	takeoverSession: string | null = null,
	cache?: KVNamespace
) {
	await ensureCatalogFamily(binding, family);
	const db = createDatabase(binding);
	const id = crypto.randomUUID();
	const recent = await db
		.select({ snapshot: playSession.themeSnapshot })
		.from(playSession)
		.where(eq(playSession.userId, userId))
		.orderBy(desc(playSession.sequence))
		.limit(3);
	const history = recent.flatMap((row) =>
		row.snapshot ? [JSON.parse(row.snapshot) as ResolvedTheme] : []
	);
	const theme = drawFreshTheme(family, history, randomSeed);
	const seed = theme.seed;
	// One conditional statement serializes caps and insertion. No read/check/write gap.
	for (let attempt = 0; attempt < 3; attempt++) {
		const { config: scoring, liveVersion } = await readLiveScoreConfig(binding, family, cache);
		const issue = binding
			.prepare(
				`
		INSERT INTO play_session (id,user_id,family,seed,engine_version,created_at,expires_at,ip_hash,theme_config_version,theme_generator_version,theme_snapshot,card_opening_ms,score_config_version)
		SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?
		WHERE EXISTS (SELECT 1 FROM player WHERE user_id=?)
		AND NOT EXISTS (SELECT 1 FROM player_ban WHERE user_id=? AND (expires_at IS NULL OR expires_at>?))
		AND NOT EXISTS (SELECT 1 FROM user_lifecycle WHERE user_id=?)
		AND EXISTS (SELECT 1 FROM game_lifecycle WHERE family=? AND state='enabled')
		AND NOT EXISTS (SELECT 1 FROM play_session active WHERE active.user_id=? AND active.abandoned_at IS NULL AND active.expires_at>?
			AND NOT EXISTS (SELECT 1 FROM completed_run finished WHERE finished.id=active.id)
			AND NOT (active.id=COALESCE(?, '') AND active.payload_hash IS NULL))
		AND COALESCE((SELECT version FROM score_live WHERE family=?),?)=?
		AND NOT EXISTS (SELECT 1 FROM site_control WHERE key='ranked' AND enabled=0)
		AND (SELECT count(*) FROM play_session WHERE user_id=? AND created_at>?) < 30
		AND (SELECT count(*) FROM play_session WHERE ip_hash=? AND created_at>?) < 30
		AND (SELECT count(*) FROM play_session s WHERE s.user_id=? AND s.created_at>?
			AND (s.abandoned_at IS NOT NULL OR (s.payload_hash IS NULL AND EXISTS
			(SELECT 1 FROM play_session newer WHERE newer.user_id=s.user_id AND newer.family=s.family AND newer.sequence>s.sequence))))
 + CASE WHEN EXISTS (SELECT 1 FROM play_session current WHERE current.user_id=? AND (current.family=? OR (current.id=COALESCE(?, '') AND current.expires_at>?)) AND current.payload_hash IS NULL AND current.abandoned_at IS NULL AND current.created_at>? AND NOT EXISTS (SELECT 1 FROM play_session newer WHERE newer.user_id=current.user_id AND newer.family=current.family AND newer.sequence>current.sequence)) THEN 1 ELSE 0 END <= 10
		RETURNING id`
			)
			.bind(
				id,
				userId,
				family,
				seed,
				catalog[family].engineVersion,
				now,
				now + 7200000,
				ipHash,
				theme.themeConfigVersion,
				theme.themeGeneratorVersion,
				JSON.stringify(theme),
				CARD_RANKED_OPENING_MS,
				scoring.version,
				userId,
				userId,
				now,
				userId,
				family,
				userId,
				now,
				takeoverSession,
				family,
				defaultScoreConfig(family).version,
				liveVersion,
				userId,
				now - 3600000,
				ipHash,
				now - 3600000,
				userId,
				now - 3600000,
				userId,
				family,
				takeoverSession,
				now,
				now - 3600000
			);
		// Both statements commit together; a failed issuance never abandons the old round.
		const results = await binding.batch([
			issue,
			binding
				.prepare(
					`UPDATE play_session SET abandoned_at=? WHERE id=? AND user_id=?
				AND payload_hash IS NULL AND abandoned_at IS NULL
				AND EXISTS (SELECT 1 FROM play_session replacement WHERE replacement.id=?)`
				)
				.bind(now, takeoverSession, userId, id)
		]);
		if (!results[0]!.results.length) {
			const available = await binding
				.prepare('SELECT state FROM game_lifecycle WHERE family=?')
				.bind(family)
				.first<{ state: string }>();
			if (available?.state !== 'enabled') throw new RunError('game_disabled', 409);
			const current = await binding
				.prepare('SELECT version FROM score_live WHERE family=?')
				.bind(family)
				.first<{ version: string }>();
			if ((current?.version ?? defaultScoreConfig(family).version) !== liveVersion) continue;
			const active = await activeRanked(binding, userId, now);
			if (active && (active.id !== takeoverSession || active.saving))
				throw new RunError('ranked_active', 409);
			throw new RunError('start_limited', 429);
		}
		return {
			scoring,
			id,
			seed,
			family,
			theme,
			engineVersion: catalog[family].engineVersion,
			startedAt: now,
			expiresAt: now + 7200000
		};
	}
	throw new RunError('score_conflict', 409);
}
