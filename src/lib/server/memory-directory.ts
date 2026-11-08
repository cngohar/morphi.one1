import { catalog } from '#lib/catalog.js';
import { dimensionChange } from '#lib/engine/contract.js';
import { puzzleVariant } from '#lib/scoring.js';
import { readMemoryPolicy, memoryBlockers } from './memory-policy.js';
import { queryActivityCounts, type ActivityMappingEntry } from './games.js';

export type DirectoryFilter = {
	q?: string;
	status?: 'all' | 'enabled' | 'disabled' | 'blocked' | 'unplayed';
	archetype?: string;
	source?: 'all' | 'curated' | 'observed';
	cursor?: string;
	pageSize?: number;
};

export type DimensionItem = {
	key: string;
	labelKey: string;
	valueId: string;
	valueLabelKey: string;
	isBlocked: boolean;
};

export type DirectoryVariant = {
	id: string;
	nameKey?: string;
	name: string;
	archetype: string;
	archetypeKey: string;
	source: 'curated' | 'observed';
	state: 'enabled' | 'disabled' | 'blocked' | 'unplayed';
	lifecycleState: 'enabled' | 'disabled';
	dims: DimensionItem[];
	policyBlocker?: string;
	shown: number;
	played: number;
	finished: number;
	abandoned: number;
	open: number;
	imported: number;
	totalCompleted: number;
	ranked: number;
	rulesGroup: string;
	rows: Array<{
		rules_group: string;
		score_config_version: string;
		completed: number;
		ranked: number;
		bestScore: number;
		averageScore: number;
		averageSeconds: number;
	}>;
};

export type MemoryDirectoryResult = {
	items: DirectoryVariant[];
	total: number;
	curatedCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
	cursorToken: string;
	prevCursor?: string;
	nextCursor?: string;
	firstCursor?: string;
	lastCursor?: string;
};

export function encodeCursor(payload: { after?: string; before?: string; page?: number }): string {
	return Buffer.from(JSON.stringify(payload))
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export function decodeCursor(token?: string | null): {
	after?: string;
	before?: string;
	page?: number;
} | null {
	if (!token) return null;
	try {
		const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
		const json = Buffer.from(base64, 'base64').toString('utf8');
		const data = JSON.parse(json);
		if (data && typeof data === 'object') return data;
	} catch {
		// Ignore malformed cursor safely
	}
	return null;
}

export function memoryVariantDimensions(
	id: string,
	policyValues: Record<string, boolean>
): DimensionItem[] {
	const policy = catalog.memory.dimensionPolicy;
	const variant = policy.variants.find((entry) => entry.id === id);
	return policy.dimensions.map((dimension) => {
		const valueId = dimensionChange(variant, dimension.key) ?? dimension.values[0].id;
		const valDef = dimension.values.find((item) => item.id === valueId);
		const isBlocked = policyValues[`${dimension.key}:${valueId}`] !== true;
		return {
			key: dimension.key,
			labelKey: dimension.label,
			valueId,
			valueLabelKey: valDef?.label ?? valueId,
			isBlocked
		};
	});
}

export async function loadMemoryDirectory(
	db: D1Database,
	filter: DirectoryFilter = {}
): Promise<MemoryDirectoryResult> {
	const curatedDefs = catalog.memory.variants ?? [];
	const policy = catalog.memory.dimensionPolicy;

	// 1. Fetch observed variant identities from D1.
	const observedRows = (
		await db
			.prepare(
				`SELECT DISTINCT variant FROM (
					SELECT variant FROM variant_lifecycle WHERE family='memory'
					UNION
					SELECT variant FROM play_session WHERE family='memory' AND variant IS NOT NULL
					UNION
					SELECT variant FROM account_round_activity WHERE family='memory' AND variant IS NOT NULL
				) WHERE variant IS NOT NULL ORDER BY variant`
			)
			.all<{ variant: string }>()
	).results;

	// 2. Fetch lifecycle states from D1.
	const lifecycleRows = (
		await db
			.prepare('SELECT variant, state, reason FROM variant_lifecycle WHERE family=?')
			.bind('memory')
			.all<{ variant: string; state: 'enabled' | 'disabled'; reason?: string }>()
	).results;

	// 3. Fetch active dimension policy values.
	const { values: policyValues } = await readMemoryPolicy(db);

	// 4. Merge curated and observed variant IDs (deterministic unique order).
	const allVariantIds = [
		...curatedDefs.map((v) => v.id),
		...observedRows.map((r) => r.variant).filter((id) => !curatedDefs.some((v) => v.id === id))
	].sort();

	// 5. Query activity telemetry counts for all variants.
	const defaultVariantId = curatedDefs[0]?.id ?? 'memory:classic';
	const activityMapping: ActivityMappingEntry[] = allVariantIds.flatMap((id) => {
		const def = curatedDefs.find((v) => v.id === id);
		const groups = def?.leaderboardGroups ?? ['memory-1'];
		return groups.map((rulesGroup) => ({
			family: 'memory',
			variant: id,
			defaultVariant: defaultVariantId,
			rulesGroup
		}));
	});
	const counts = await queryActivityCounts(db, activityMapping);

	// 6. Query completed run statistics for scoring rules groups.
	const historyRows = (
		await db
			.prepare(
				`SELECT rules_group, score_config_version, count(*) completed, coalesce(sum(ranked),0) ranked,
				max(score) bestScore, avg(score) averageScore, avg(seconds) averageSeconds
				FROM completed_run WHERE family='memory' GROUP BY rules_group, score_config_version
				ORDER BY rules_group, score_config_version LIMIT 101`
			)
			.all<{
				rules_group: string;
				score_config_version: string;
				completed: number;
				ranked: number;
				bestScore: number;
				averageScore: number;
				averageSeconds: number;
			}>()
	).results;

	// 7. Assemble full variant directory items.
	const allVariants: DirectoryVariant[] = allVariantIds.map((id) => {
		const isCurated = curatedDefs.some((v) => v.id === id);
		const def = isCurated ? puzzleVariant('memory', id) : undefined;
		const lifecycleRow = lifecycleRows.find((r) => r.variant === id);
		const lifecycleState: 'enabled' | 'disabled' =
			lifecycleRow?.state ?? (def?.enabled === false ? 'disabled' : 'enabled');

		const isPilot = policy.variants.some((v) => v.id === id);
		const blockers = isPilot ? memoryBlockers(id, policyValues) : [];
		const blockerDims = blockers.map((b) => {
			const [dimKey, valId] = b.split(':');
			const dim = policy.dimensions.find((d) => d.key === dimKey);
			const val = dim?.values.find((v) => v.id === valId);
			return `${dim?.label ? dim.label : dimKey} = ${val?.label ? val.label : valId}`;
		});

		const countRow = counts.find((r) => r.family === 'memory' && r.variant === id);
		const played = countRow?.played ?? 0;

		let state: 'enabled' | 'disabled' | 'blocked' | 'unplayed';
		if (lifecycleState === 'disabled') {
			state = 'disabled';
		} else if (blockers.length > 0) {
			state = 'blocked';
		} else if (played === 0) {
			state = 'unplayed';
		} else {
			state = 'enabled';
		}

		const policyVariant = policy.variants.find((v) => v.id === id);
		const archetype = policyVariant?.archetype ?? 'core';
		const archetypeDef = policy.archetypes.find((a) => a.id === archetype);

		const dims = isCurated
			? memoryVariantDimensions(id, policyValues)
			: policy.dimensions.map((dim) => ({
					key: dim.key,
					labelKey: dim.label,
					valueId: dim.values[0].id,
					valueLabelKey: dim.values[0].label,
					isBlocked: false
				}));

		const rulesGroup = def?.leaderboardGroups?.[0] ?? 'memory-1';
		const matchingHistory = historyRows.filter(
			(r) => def?.leaderboardGroups?.includes(r.rules_group) ?? r.rules_group === rulesGroup
		);

		return {
			id,
			nameKey: def?.name,
			name: def
				? (catalog.memory.messages[def.name as keyof typeof catalog.memory.messages] ??
					id.replace(/^memory:/, ''))
				: id,
			archetype,
			archetypeKey: archetypeDef?.label ?? 'policy.core',
			source: isCurated ? 'curated' : 'observed',
			state,
			lifecycleState,
			dims,
			policyBlocker: blockerDims.length ? blockerDims.join('; ') : undefined,
			shown: countRow?.shown ?? 0,
			played,
			finished: countRow?.finished ?? 0,
			abandoned: countRow?.abandoned ?? 0,
			open: countRow?.open ?? 0,
			imported: countRow?.imported ?? 0,
			totalCompleted: countRow?.totalCompleted ?? 0,
			ranked: countRow?.ranked ?? 0,
			rulesGroup,
			rows: matchingHistory
		};
	});

	// 8. Filter records.
	let filtered = allVariants;

	if (filter.q) {
		const q = filter.q.trim().toLowerCase();
		filtered = filtered.filter(
			(v) => v.id.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)
		);
	}

	if (filter.status && filter.status !== 'all') {
		if (filter.status === 'unplayed') {
			filtered = filtered.filter((v) => v.played === 0);
		} else {
			filtered = filtered.filter((v) => v.state === filter.status);
		}
	}

	if (filter.archetype && filter.archetype !== 'all') {
		const arch = filter.archetype.trim().toLowerCase();
		filtered = filtered.filter((v) => v.archetype.toLowerCase() === arch);
	}

	if (filter.source && filter.source !== 'all') {
		filtered = filtered.filter((v) => v.source === filter.source);
	}

	// 9. Keyset Cursor Pagination.
	const pageSize = filter.pageSize ?? 10;
	const total = filtered.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	let pageIndex = 0;
	const decoded = decodeCursor(filter.cursor);
	if (decoded?.page !== undefined && Number.isSafeInteger(decoded.page)) {
		pageIndex = Math.max(0, Math.min(totalPages - 1, decoded.page));
	} else if (decoded?.after) {
		const afterIdx = filtered.findIndex((v) => v.id === decoded.after);
		if (afterIdx >= 0) {
			pageIndex = Math.floor((afterIdx + 1) / pageSize);
		}
	} else if (decoded?.before) {
		const beforeIdx = filtered.findIndex((v) => v.id === decoded.before);
		if (beforeIdx >= 0) {
			pageIndex = Math.max(0, Math.floor((beforeIdx - pageSize) / pageSize));
		}
	}

	if (pageIndex >= totalPages) pageIndex = Math.max(0, totalPages - 1);
	const start = pageIndex * pageSize;
	const end = Math.min(start + pageSize, total);
	const pagedItems = filtered.slice(start, end);

	const currentFirst = pagedItems[0];
	const cursorToken = currentFirst ? encodeCursor({ after: currentFirst.id, page: pageIndex }) : '';
	const prevCursor = pageIndex > 0 ? encodeCursor({ page: pageIndex - 1 }) : undefined;
	const nextCursor = pageIndex < totalPages - 1 ? encodeCursor({ page: pageIndex + 1 }) : undefined;
	const firstCursor = encodeCursor({ page: 0 });
	const lastCursor = encodeCursor({ page: totalPages - 1 });

	return {
		items: pagedItems,
		total,
		curatedCount: curatedDefs.length,
		page: pageIndex,
		pageSize,
		totalPages,
		cursorToken,
		prevCursor,
		nextCursor,
		firstCursor,
		lastCursor
	};
}
