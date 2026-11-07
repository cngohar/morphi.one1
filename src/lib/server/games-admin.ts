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
	selectedGame: PuzzleId | null
) {
	let games: Awaited<ReturnType<typeof gameOverview>>;
	let gamesOverview: Awaited<ReturnType<typeof cachedGameOverview>> | null = null;
	let gameStats: Awaited<ReturnType<typeof gameStatistics>> = {
		rows: [],
		more: false,
		variants: []
	};
	if (selectedGame) {
		games = await gameOverview(db, selectedGame);
		gameStats = await gameStatistics(db, selectedGame, games[0]);
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
