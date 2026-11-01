import {
	defaultScoreConfig,
	SCORE_DEFAULT_VERSION,
	validateScoreValues,
	type ScoreConfig
} from '#lib/engine/scoring.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import { RunError } from './runs.js';

type ScoreRow = { version: string; parent: string; values_json: string; created_at: number };

function parseScoreRow(family: PuzzleId, row: ScoreRow): ScoreConfig | null {
	try {
		return {
			version: row.version,
			values: validateScoreValues(family, JSON.parse(row.values_json))
		};
	} catch {
		return null;
	}
}

export async function readLiveScoreConfig(db: D1Database, family: PuzzleId) {
	const live = await db
		.prepare('SELECT version FROM score_live WHERE family=?')
		.bind(family)
		.first<{ version: string }>();
	const liveVersion = live?.version ?? SCORE_DEFAULT_VERSION;
	let version = liveVersion;
	const seen = new Set<string>();
	while (version !== SCORE_DEFAULT_VERSION && !seen.has(version)) {
		seen.add(version);
		const row = await db
			.prepare(
				'SELECT version,parent,values_json,created_at FROM score_config WHERE family=? AND version=?'
			)
			.bind(family, version)
			.first<ScoreRow>();
		if (!row) break;
		const config = parseScoreRow(family, row);
		if (config) {
			if (version !== liveVersion) console.warn('morphi:score_live_invalid', family);
			return { liveVersion, config };
		}
		version = row.parent;
	}
	if (liveVersion !== SCORE_DEFAULT_VERSION) console.warn('morphi:score_live_invalid', family);
	return { liveVersion, config: defaultScoreConfig(family) };
}

export async function readScoreConfig(
	db: D1Database,
	family: PuzzleId,
	version?: string
): Promise<ScoreConfig> {
	if (!version) return (await readLiveScoreConfig(db, family)).config;
	if (version === SCORE_DEFAULT_VERSION) return defaultScoreConfig(family);
	const row = await db
		.prepare(
			'SELECT version,parent,values_json,created_at FROM score_config WHERE family=? AND version=?'
		)
		.bind(family, version)
		.first<ScoreRow>();
	const config = row && parseScoreRow(family, row);
	if (!config) throw new RunError('score_version', 409);
	return config;
}

export async function listScoreVersions(db: D1Database, family: PuzzleId) {
	const rows = await db
		.prepare(
			'SELECT version,parent,values_json,created_at FROM score_config WHERE family=? ORDER BY created_at DESC, version DESC'
		)
		.bind(family)
		.all<ScoreRow>();
	return [
		{ version: SCORE_DEFAULT_VERSION, createdAt: null },
		...rows.results
			.filter((row) => parseScoreRow(family, row))
			.map((row) => ({ version: row.version, createdAt: row.created_at }))
	];
}

/** Caller must have a fresh sensitive operator session. Batch and parent uniqueness prevent lost edits. */
export async function saveScoreConfig(
	db: D1Database,
	actor: string,
	family: PuzzleId,
	expected: string,
	input: unknown,
	reason: string,
	reset = false,
	rollbackSource?: string
) {
	const values = validateScoreValues(family, input);
	const { config: before, liveVersion } = await readLiveScoreConfig(db, family);
	if (liveVersion !== expected) throw new RunError('score_conflict', 409);
	const version = crypto.randomUUID(),
		now = Date.now();
	try {
		await db.batch([
			db
				.prepare(
					'INSERT INTO score_config(version,family,parent,values_json,created_at) VALUES(?,?,?,?,?)'
				)
				.bind(version, family, expected, JSON.stringify(values), now),
			db
				.prepare(
					'INSERT INTO score_live(family,version) VALUES(?,?) ON CONFLICT(family) DO UPDATE SET version=excluded.version'
				)
				.bind(family, version),
			db
				.prepare(
					'INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at) VALUES(?,?,?,?,?,?,?,?)'
				)
				.bind(
					crypto.randomUUID(),
					actor,
					rollbackSource ? 'score-rollback' : reset ? 'score-defaults' : 'score-change',
					family,
					reason,
					JSON.stringify(liveVersion === before.version ? before : { ...before, liveVersion }),
					JSON.stringify(
						rollbackSource
							? { version, values, sourceVersion: rollbackSource }
							: { version, values }
					),
					now
				)
		]);
	} catch (e) {
		if (String(e).includes('UNIQUE constraint failed')) throw new RunError('score_conflict', 409);
		throw e;
	}
	return { version, values };
}

export async function rollbackScoreConfig(
	db: D1Database,
	actor: string,
	family: PuzzleId,
	expected: string,
	sourceVersion: string,
	reason: string
) {
	const source = await readScoreConfig(db, family, sourceVersion || '__invalid__');
	return saveScoreConfig(db, actor, family, expected, source.values, reason, false, source.version);
}
