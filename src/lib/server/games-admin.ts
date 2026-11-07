import { catalog } from '#lib/catalog.js';
import type { PuzzleId } from '#lib/engine/contract.js';
import { fail } from '@sveltejs/kit';
import {
	gameOverview,
	cachedGameOverview,
	gameStatistics,
	changeGame,
	changeVariant
} from './games.js';

export async function loadGamesAdmin(
	db: D1Database,
	cache: KVNamespace | undefined,
	selectedGame: PuzzleId | null,
	variantPage = 0,
	pageSize = 10
) {
	let games: Awaited<ReturnType<typeof gameOverview>>;
	let gamesOverview: Awaited<ReturnType<typeof cachedGameOverview>> | null = null;
	let gameStats: Awaited<ReturnType<typeof gameStatistics>> & {
		totalVariants: number;
		variantPage: number;
		variantPageSize: number;
		totalVariantPages: number;
	} = {
		rows: [],
		more: false,
		variants: [],
		totalVariants: 0,
		variantPage: 0,
		variantPageSize: pageSize,
		totalVariantPages: 1
	};
	if (selectedGame) {
		games = await gameOverview(db, selectedGame);
		const stats = await gameStatistics(db, selectedGame, games[0]);
		const totalVariants = stats.variants.length;
		const totalVariantPages = Math.max(1, Math.ceil(totalVariants / pageSize));
		const pagedVariants = stats.variants.slice(
			variantPage * pageSize,
			(variantPage + 1) * pageSize
		);
		gameStats = {
			...stats,
			variants: pagedVariants,
			totalVariants,
			variantPage,
			variantPageSize: pageSize,
			totalVariantPages
		};
	} else {
		gamesOverview = await cachedGameOverview(db, cache);
		games = gamesOverview.games;
	}
	return { games, gamesOverview, gameStats };
}

export async function changeGamesAdmin(
	db: D1Database,
	cache: KVNamespace | undefined,
	context: {
		actor: string;
		view: string;
		action: string;
		target: string;
		reason: string;
		variant: string;
		days: number;
	}
) {
	const { actor, view, action, target, reason, variant, days } = context;
	if (action.startsWith('variant-')) {
		if (view !== 'games' || !Object.hasOwn(catalog, target)) return fail(400, { code: 'input' });
		await changeVariant(
			db,
			actor,
			target,
			variant,
			action as 'variant-enable' | 'variant-disable',
			reason,
			undefined,
			cache
		);
		return { success: true };
	}
	if (!Object.hasOwn(catalog, target)) return fail(400, { code: 'input' });
	await changeGame(
		db,
		actor,
		target as PuzzleId,
		action as Parameters<typeof changeGame>[3],
		reason,
		days,
		undefined,
		cache
	);
	return { success: true };
}
