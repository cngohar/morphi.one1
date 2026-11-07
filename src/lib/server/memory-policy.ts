import { catalog } from '#lib/catalog.js';
import { defaultGameConfig, validateGameConfig } from './config.js';
import { RunError } from './runs.js';

const policy = catalog.memory.dimensionPolicy;
export const memoryPolicyKeys = policy.dimensions.flatMap((dimension) =>
	dimension.values.map((value) => `${dimension.key}:${value.id}`)
);
export const defaultMemoryPolicy = () =>
	Object.fromEntries(memoryPolicyKeys.map((key) => [key, true])) as Record<string, boolean>;

export function validateMemoryPolicy(value: unknown): Record<string, boolean> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new RangeError('dimension_policy');
	const row = value as Record<string, unknown>;
	if (
		Object.keys(row).length !== memoryPolicyKeys.length ||
		memoryPolicyKeys.some((key) => typeof row[key] !== 'boolean')
	)
		throw new RangeError('dimension_policy');
	return Object.fromEntries(memoryPolicyKeys.map((key) => [key, row[key] as boolean]));
}

export function memoryVariantKeys(id: string) {
	const variant = policy.variants.find((entry) => entry.id === id);
	if (!variant) throw new RunError('input');
	const change = 'change' in variant ? variant.change : undefined;
	return policy.dimensions.map((dimension) => {
		const value = change?.[0] === dimension.key ? change[1] : dimension.values[0].id;
		if (!dimension.values.some((item) => item.id === value))
			throw new RangeError('dimension_policy');
		return `${dimension.key}:${value}`;
	});
}
export const memoryBlockers = (id: string, values: Record<string, boolean>) =>
	memoryVariantKeys(id).filter((key) => values[key] !== true);

// JSON paths are derived solely from family-owned keys; SQL never embeds operator input.
export const memorySqlPaths = (id: string) =>
	memoryVariantKeys(id).map((key) => `$.dimensions.${JSON.stringify(key)}`);

/** D1 live pointer is authoritative. A missing/corrupt live snapshot fails closed. */
export async function readMemoryPolicy(db: D1Database) {
	const live = await db
		.prepare("SELECT version FROM config_live WHERE key='game:memory'")
		.first<{ version: string }>();
	if (!live)
		return {
			version: 'catalog-v1',
			values: defaultMemoryPolicy(),
			weight: defaultGameConfig('memory').weight
		};
	const row = await db
		.prepare('SELECT values_json FROM game_config WHERE version=? AND family=?')
		.bind(live.version, 'memory')
		.first<{ values_json: string }>();
	if (!row) throw new RunError('game_disabled', 503);
	try {
		const config = validateGameConfig(JSON.parse(row.values_json));
		return {
			version: live.version,
			values: config.dimensions ?? defaultMemoryPolicy(),
			weight: config.weight
		};
	} catch {
		console.error('morphi:memory_policy_invalid');
		throw new RunError('game_disabled', 503);
	}
}

export async function changeMemoryPolicy(
	db: D1Database,
	actor: string,
	expected: string,
	input: unknown,
	reason: string,
	now = Date.now()
) {
	if (reason.trim().length < 3 || reason.length > 240 || /[\r\n@]/.test(reason))
		throw new RunError('input');
	let values: Record<string, boolean>;
	try {
		values = validateMemoryPolicy(input);
	} catch {
		throw new RunError('input');
	}
	const previous = await readMemoryPolicy(db);
	if (previous.version !== expected) throw new RunError('game_conflict', 409);
	if (memoryPolicyKeys.every((key) => previous.values[key] === values[key]))
		throw new RunError('game_conflict', 409);
	const allowed = policy.variants
		.filter((variant) => !memoryBlockers(variant.id, values).length)
		.map((variant) => variant.id);
	const version = crypto.randomUUID(),
		auditId = crypto.randomUUID();
	const results = await db.batch([
		db
			.prepare(
				`INSERT INTO game_config(version,family,parent,values_json,created_at)
		SELECT ?,'memory',?,?,? WHERE COALESCE((SELECT version FROM config_live WHERE key='game:memory'),'catalog-v1')=?
		AND EXISTS(SELECT 1 FROM admin_actor WHERE id=? AND role='admin')
		AND ((SELECT state FROM game_lifecycle WHERE family='memory')!='enabled' OR EXISTS(
			SELECT 1 FROM json_each(?) allowed LEFT JOIN variant_lifecycle row
			ON row.family='memory' AND row.variant=allowed.value WHERE COALESCE(row.state,'enabled')='enabled'))`
			)
			.bind(
				version,
				expected,
				JSON.stringify({ weight: previous.weight, dimensions: values }),
				now,
				expected,
				actor,
				JSON.stringify(allowed)
			),
		db
			.prepare(
				`INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
		SELECT ?,?,'dimension-policy-update','memory',?,?,?,? WHERE EXISTS(SELECT 1 FROM game_config WHERE version=?)`
			)
			.bind(
				auditId,
				actor,
				reason.trim(),
				JSON.stringify({ version: expected, dimensions: previous.values }),
				JSON.stringify({ version, dimensions: values }),
				now,
				version
			),
		db
			.prepare(
				`INSERT INTO config_live(key,version) SELECT 'game:memory',? WHERE EXISTS(SELECT 1 FROM admin_audit WHERE id=?)
		ON CONFLICT(key) DO UPDATE SET version=excluded.version`
			)
			.bind(version, auditId)
	]);
	if (!results[2].meta.changes) throw new RunError('game_conflict', 409);
	return version;
}
