import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { catalog } from '../../src/lib/catalog.js';
import { createBlockRound, findAnyPlacement } from '../../src/lib/puzzles/block-placement/logic.js';
import { BLOCK_ENTRANCE_MS, CARD_RANKED_OPENING_MS } from '../../src/lib/round-timing.js';
import { activeRanked } from '../../src/lib/server/ranked-session.js';
import { saveRun, startRanked, parseRun } from '../../src/lib/server/runs.js';
import { changeVariant, enabledVariants, gameAvailable } from '../../src/lib/server/games.js';
import type { CompletedRun } from '../../src/lib/engine/contract.js';
import cap from '../vectors/block-cap.json';

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Cloudflare.Env>>>;
const now = 1800000000000;
async function owner() {
	const id = crypto.randomUUID();
	await proxy.env.DB.batch([
		proxy.env.DB.prepare(
			'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)'
		).bind(id, 'Block fixture', `${id}@example.test`, 1, now, now),
		proxy.env.DB.prepare(
			'INSERT INTO player(user_id,name,normalized_name,updated_at) VALUES(?,?,?,?)'
		).bind(id, id, id, now)
	]);
	return id;
}
beforeAll(async () => {
	proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: 'wrangler.jsonc', persist: false });
	for (const file of (await readdir('migrations')).filter((file) => file.endsWith('.sql')).sort())
		await proxy.env.DB.batch(
			(await readFile(`migrations/${file}`, 'utf8'))
				.split('--> statement-breakpoint')
				.filter((part) => part.trim())
				.map((part) => proxy.env.DB.prepare(part))
		);
	await proxy.env.DB.prepare(
		"INSERT INTO admin_actor(id,role) VALUES('block-operator','admin')"
	).run();
});
afterAll(async () => {
	await proxy?.dispose();
});

it('enforces the exact ranked rush ceiling after the fixed openings without another network allowance', async () => {
	for (const gameplayMs of [60000, 62000, 62001]) {
		const userId = await owner();
		const issued = await startRanked(
			proxy.env.DB,
			userId,
			'block',
			userId,
			now,
			null,
			undefined,
			'block:rush-60'
		);
		const round = createBlockRound(issued.seed, 'block:rush-60');
		const run: CompletedRun = {
			version: 1,
			id: issued.id,
			family: 'block',
			engineVersion: 'block-placement-1',
			seed: issued.seed,
			variant: 'block:rush-60',
			moves: [findAnyPlacement(round)!],
			elapsedSeconds: 60,
			rankedSession: issued.id
		};
		const submittedAt = now + CARD_RANKED_OPENING_MS + BLOCK_ENTRANCE_MS + gameplayMs;
		if (gameplayMs > 62000) {
			await expect(saveRun(proxy.env.DB, userId, run, submittedAt)).rejects.toMatchObject({
				code: 'too_slow'
			});
			expect(await activeRanked(proxy.env.DB, userId, submittedAt)).toBeNull();
			expect(
				await proxy.env.DB.prepare('SELECT id FROM completed_run WHERE id=?').bind(run.id).first()
			).toBeNull();
		} else {
			expect(await saveRun(proxy.env.DB, userId, run, submittedAt)).toMatchObject({
				ranked: true,
				group: 'block',
				score: 0
			});
			expect(
				await proxy.env.DB.prepare('SELECT seconds,rules_group FROM completed_run WHERE id=?')
					.bind(run.id)
					.first()
			).toEqual({ seconds: gameplayMs / 1000, rules_group: 'block-placement-1:rush-60' });
		}
	}
});

it('accepts a rush completion within the ceiling when reduced motion skips the fixed openings', async () => {
	const userId = await owner();
	const issued = await startRanked(
		proxy.env.DB,
		userId,
		'block',
		userId,
		now,
		null,
		undefined,
		'block:rush-60'
	);
	const run: CompletedRun = {
		version: 1,
		id: issued.id,
		family: 'block',
		engineVersion: 'block-placement-1',
		seed: issued.seed,
		variant: 'block:rush-60',
		moves: [findAnyPlacement(createBlockRound(issued.seed, 'block:rush-60'))!],
		elapsedSeconds: 60,
		rankedSession: issued.id
	};
	expect(await saveRun(proxy.env.DB, userId, run, now + 60000)).toMatchObject({
		ranked: true,
		group: 'block',
		score: 0
	});
	expect(
		await proxy.env.DB.prepare('SELECT seconds,rules_group FROM completed_run WHERE id=?')
			.bind(run.id)
			.first()
	).toEqual({ seconds: 55, rules_group: 'block-placement-1:rush-60' });
});

it('replays and saves a pre-variant Block completion under classic without changing its payload', async () => {
	const run: CompletedRun = {
		version: 1,
		id: crypto.randomUUID(),
		family: 'block',
		engineVersion: 'block-placement-1',
		seed: cap.seed,
		moves: cap.moves,
		elapsedSeconds: 123,
		rankedSession: null
	};
	expect(parseRun(run)).toEqual(run);
	const saved = await saveRun(proxy.env.DB, await owner(), run, now);
	expect(saved).toMatchObject({ group: 'block', score: cap.score, ranked: false });
	expect(
		await proxy.env.DB.prepare('SELECT rules_group FROM completed_run WHERE id=?')
			.bind(run.id)
			.first()
	).toEqual({ rules_group: 'block-placement-1' });
	expect(catalog.block.replay(cap.seed, cap.moves, 123, undefined, 'block:classic').score).toBe(
		saved.score
	);
});

it('retains classic ranked elapsed behavior and rejects family or variant substitution', async () => {
	const userId = await owner();
	const issued = await startRanked(proxy.env.DB, userId, 'block', userId, now);
	await proxy.env.DB.prepare('UPDATE play_session SET seed=?,variant=NULL WHERE id=?')
		.bind(cap.seed, issued.id)
		.run();
	const run: CompletedRun = {
		version: 1,
		id: issued.id,
		family: 'block',
		engineVersion: 'block-placement-1',
		seed: cap.seed,
		moves: cap.moves,
		elapsedSeconds: 123,
		rankedSession: issued.id
	};
	await expect(
		saveRun(proxy.env.DB, userId, { ...run, variant: 'block:rows-only' }, now + 120000)
	).rejects.toMatchObject({ code: 'session' });
	expect(await saveRun(proxy.env.DB, userId, run, now + 120000)).toMatchObject({
		ranked: true,
		group: 'block',
		score: cap.score
	});
	expect(
		await proxy.env.DB.prepare('SELECT seconds,rules_group FROM completed_run WHERE id=?')
			.bind(run.id)
			.first()
	).toEqual({ seconds: 119, rules_group: 'block-placement-1' });
});

it('removes Block from availability when every variant is disabled and restores it without a reason', async () => {
	for (const variant of catalog.block.variants)
		await changeVariant(
			proxy.env.DB,
			'block-operator',
			'block',
			variant.id,
			'variant-disable',
			'Block variant fixture',
			now
		);
	expect(await enabledVariants(proxy.env.DB, 'block')).toEqual([]);
	expect(await gameAvailable(proxy.env.DB, 'block')).toBe(false);
	await expect(
		startRanked(
			proxy.env.DB,
			await owner(),
			'block',
			'block-disabled',
			now,
			null,
			undefined,
			'block:board-10'
		)
	).rejects.toMatchObject({ code: 'game_disabled' });
	await changeVariant(
		proxy.env.DB,
		'block-operator',
		'block',
		'block:board-10',
		'variant-enable',
		undefined,
		now + 1
	);
	expect(await gameAvailable(proxy.env.DB, 'block')).toBe(true);
	expect(await enabledVariants(proxy.env.DB, 'block')).toEqual(['block:board-10']);
});
