import { describe, expect, it, vi } from 'vitest';
import {
	deriveDailyPuzzle,
	dailyPuzzle,
	dailyBoard,
	dailyFreezeAt,
	dailyCompletionStatements,
	dailySessionId,
	isDailyFrozen,
	midnightDailyGeneration,
	nextStreak,
	percentileCutoffs,
	rankPercentile,
	streakFreezeEligible,
	utcDate,
	validateDailyDate
} from './daily.js';
import { cachedConfigRow, dailyBoardKey, invalidateDailyBoard } from './config-cache.js';
import { catalog } from '#lib/catalog.js';
import type { PuzzlePresentation } from '#lib/engine/contract.js';
import { t, type MessageKey } from '#lib/i18n/messages.js';
import { roundRuleLine } from '#lib/ui/puzzle-presentation.js';

const choices = [
	{ id: 'first', weight: 1 },
	{ id: 'second', weight: 3 }
];

describe('daily puzzle and board boundaries', () => {
	it('uses UTC dates and rejects impossible or noncanonical dates', () => {
		expect(utcDate(Date.parse('2026-11-09T00:30:00+05:00'))).toBe('2026-11-08');
		expect(validateDailyDate('2028-02-29')).toBe('2028-02-29');
		for (const date of ['2026-02-29', '2026-13-01', '2026-11-9', 'today'])
			expect(() => validateDailyDate(date)).toThrow();
	});
	it('pins identical HMAC input and changes seed across dates and families', async () => {
		const a = await deriveDailyPuzzle('2026-11-09', 'memory', 'test-key', choices);
		expect(await deriveDailyPuzzle('2026-11-09', 'memory', 'test-key', choices)).toEqual(a);
		expect((await deriveDailyPuzzle('2026-11-10', 'memory', 'test-key', choices)).seed).not.toBe(
			a.seed
		);
		expect((await deriveDailyPuzzle('2026-11-09', 'connect', 'test-key', choices)).seed).not.toBe(
			a.seed
		);
		expect(BigInt(a.seed)).toBeLessThan(1n << 64n);
		await expect(deriveDailyPuzzle('2026-11-09', 'memory', '', choices)).rejects.toMatchObject({
			code: 'daily_unavailable'
		});
	});
	it('keeps yesterday open at midnight and freezes it exactly at 02:00 UTC', () => {
		const midnight = Date.parse('2026-11-10T00:00:00Z');
		expect(dailyFreezeAt('2026-11-09')).toBe(midnight + 7_200_000);
		expect(isDailyFrozen('2026-11-09', midnight)).toBe(false);
		expect(isDailyFrozen('2026-11-09', midnight + 7_199_999)).toBe(false);
		expect(isDailyFrozen('2026-11-09', midnight + 7_200_000)).toBe(true);
		expect(midnightDailyGeneration(midnight)).toBe(true);
		expect(midnightDailyGeneration(midnight + 300_000)).toBe(false);
		expect(midnightDailyGeneration(midnight + 7_200_000)).toBe(false);
	});
	it('guards best writes at the final freeze and derives streak day from the stored completion timestamp', () => {
		const statements: { query: string; values: unknown[] }[] = [];
		const binding = {
			prepare(query: string) {
				return {
					bind(...values: unknown[]) {
						statements.push({ query, values });
						return {};
					}
				};
			}
		} as unknown as D1Database;
		const freeze = dailyFreezeAt('2026-11-09');
		expect(
			dailyCompletionStatements(binding, 'player', 'run', 'memory', '2026-11-09', freeze)
		).toHaveLength(3);
		expect(statements[0].values.slice(-3)).toEqual([freeze, freeze, freeze]);
		expect(statements[0].query).toContain('AND ?<?');
		expect(statements[1].query).toContain('changes()>0');
		expect(statements[2].query).toContain("strftime('%Y-%m-%d',r.created_at/1000,'unixepoch')");
	});
	it('teaches every changed round and prioritizes differing help steps', () => {
		for (const [family, manifest] of Object.entries(catalog)) {
			const baseline: PuzzlePresentation['help'] =
				manifest.variants?.[0]?.help ?? manifest.presentation.help;
			expect(roundRuleLine(family), family).toBe('');
			for (const [index, variant] of (manifest.variants ?? []).entries()) {
				const help: PuzzlePresentation['help'] = variant.help ?? baseline;
				const key = help.steps.find((step) => !baseline.steps.includes(step));
				const line = roundRuleLine(family, variant.id);
				if (key) expect(line, variant.id).toBe(t(key as MessageKey));
				else if (help.note !== baseline.note)
					expect(line, variant.id).toBe(t(help.note as MessageKey));
				else if (index > 0) {
					expect(
						help.rows.some(
							(row) => row.value && !baseline.rows.some((base) => base.value === row.value)
						),
						variant.id
					).toBe(true);
					expect(line, variant.id).toMatch(/[.!?]$/);
				} else expect(line, variant.id).toBe('');
				if (index > 0) expect(line.length, variant.id).toBeGreaterThan(0);
				expect(line, variant.id).not.toContain(variant.id);
			}
		}
	});
	it('renders exact Connect teaching with step, note and size fallback priority', () => {
		expect(roundRuleLine('connect', 'connect:full-grid')).toBe(
			'Connect every pair and fill every cell on the grid to finish.'
		);
		expect(roundRuleLine('connect', 'connect:rush-60')).toBe(
			'Connect all pairs before the 60-second clock runs out.'
		);
		expect(roundRuleLine('connect', 'connect:board-8')).toBe('This board is 8 × 8 with 8 pairs.');
	});
	it('picks only supplied enabled choices with their existing weights', async () => {
		const counts = { first: 0, second: 0 };
		for (let day = 0; day < 180; day++) {
			const date = utcDate(Date.parse('2026-01-01T00:00:00Z') + day * 86_400_000);
			const selected = await deriveDailyPuzzle(date, 'memory', 'test-key', choices);
			expect(Object.hasOwn(counts, selected.variant)).toBe(true);
			counts[selected.variant as keyof typeof counts]++;
		}
		expect(counts.first).toBeGreaterThan(20);
		expect(counts.second).toBeGreaterThan(counts.first * 2);
		await expect(deriveDailyPuzzle('2026-11-09', 'memory', 'test-key', [])).rejects.toMatchObject({
			code: 'game_disabled'
		});
	});
	it('reads an existing puzzle without deriving again after secret rotation or disablement', async () => {
		const pinned = {
			family: 'memory',
			date: '2026-11-09',
			variant: 'memory:classic',
			seed: '42',
			engineVersion: 'memory-1',
			scoreConfigVersion: 'brief-v1',
			createdAt: 0
		};
		const first = vi.fn().mockResolvedValue(pinned);
		const binding = {
			prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ first }) })
		} as unknown as D1Database;
		expect(await dailyPuzzle(binding, 'memory', pinned.date, '')).toEqual(pinned);
		expect(binding.prepare).toHaveBeenCalledTimes(1);
	});
	it('makes one deterministic valid session id per user/family/day', async () => {
		const id = await dailySessionId('account-a', 'memory', '2026-11-09');
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(await dailySessionId('account-a', 'memory', '2026-11-09')).toBe(id);
		expect(await dailySessionId('account-b', 'memory', '2026-11-09')).not.toBe(id);
		expect(await dailySessionId('account-a', 'connect', '2026-11-09')).not.toBe(id);
	});
	it('awards percentile tiers only to qualifying ranks, including one-player and 25/26 boundaries', () => {
		expect(rankPercentile(1, percentileCutoffs(1))).toBeUndefined();
		expect(rankPercentile(1, percentileCutoffs(25))).toBe(5);
		expect(rankPercentile(2, percentileCutoffs(25))).toBe(10);
		expect(rankPercentile(12, percentileCutoffs(25))).toBe(50);
		expect(rankPercentile(13, percentileCutoffs(25))).toBeUndefined();
		expect(rankPercentile(13, percentileCutoffs(26))).toBe(50);
		expect(rankPercentile(1, percentileCutoffs(100))).toBe(1);
		expect(rankPercentile(2, percentileCutoffs(100))).toBe(5);
		expect(rankPercentile(0, percentileCutoffs(100))).toBeUndefined();
	});
	it('advances once a day, restarts after a skipped UTC day, and ignores delayed older completions', () => {
		expect(nextStreak(7, 9, '2026-11-08', '2026-11-09')).toEqual({
			current: 8,
			longest: 9,
			lastDate: '2026-11-09'
		});
		expect(nextStreak(7, 9, '2026-11-08', '2026-11-08')).toEqual({
			current: 7,
			longest: 9,
			lastDate: '2026-11-08'
		});
		expect(nextStreak(9, 9, '2026-11-08', '2026-11-09')).toEqual({
			current: 10,
			longest: 10,
			lastDate: '2026-11-09'
		});
		expect(nextStreak(7, 9, '2026-11-08', '2026-11-10')).toEqual({
			current: 1,
			longest: 9,
			lastDate: '2026-11-10'
		});
		expect(nextStreak(7, 9, '2026-11-08', '2026-11-07')).toEqual({
			current: 7,
			longest: 9,
			lastDate: '2026-11-08'
		});
	});
	it('leaves pro streak freeze explicitly unavailable for every account', () => {
		for (const account of ['', 'account-a', 'pro'])
			expect(streakFreezeEligible(account)).toEqual({
				eligible: false,
				reason: 'premium-not-launched'
			});
	});
	it('uses a five-minute board cache and invalidates only the selected family/day', async () => {
		const row = { updatedAt: 0 };
		const cache = {
			get: vi.fn().mockResolvedValue(null),
			put: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined)
		} as unknown as KVNamespace;
		const key = dailyBoardKey('memory', '2026-11-09');
		expect(
			await cachedConfigRow(
				cache,
				key,
				async () => row,
				(value) => (value === row ? row : null),
				300
			)
		).toBe(row);
		expect(cache.put).toHaveBeenCalledWith(key, JSON.stringify(row), { expirationTtl: 300 });
		await invalidateDailyBoard(cache, 'memory', '2026-11-09');
		expect(cache.delete).toHaveBeenCalledWith(key);
	});
	it('keeps an outside-top rank, resolves equal scores by submission/user order, and strips internal row ids', async () => {
		const now = Date.parse('2026-11-09T12:00:00Z');
		const top = {
			rows: [{ userId: 'first', name: 'Old name', score: 100, position: 1 }],
			cutoffs: percentileCutoffs(26)
		};
		const statements: { query: string; values: unknown[] }[] = [];
		const binding = {
			prepare(query: string) {
				return {
					bind(...values: unknown[]) {
						statements.push({ query, values });
						return {
							async first() {
								if (query.includes('top_json'))
									return { top_json: JSON.stringify(top), total_players: 26, updated_at: now };
								if (query.includes('COUNT(*) AS higher')) return { higher: 2 };
								return { score: 100, createdAt: 200 };
							},
							async all() {
								return { results: [] };
							}
						};
					}
				};
			}
		} as unknown as D1Database;
		const board = await dailyBoard(binding, 'memory', '2026-11-09', 'viewer', undefined, 25, now);
		expect(board.own).toEqual({ score: 100, position: 3, percentile: 25 });
		expect(board.rows).toEqual([{ name: 'Anonymous', score: 100, position: 1, own: false }]);
		expect(statements.find((row) => row.query.includes('COUNT(*) AS higher'))?.values).toEqual([
			'memory',
			'2026-11-09',
			100,
			100,
			100,
			200,
			200,
			'viewer'
		]);
		expect(statements.filter((row) => row.query.includes('COUNT(*) AS higher'))).toHaveLength(1);
		expect(statements.every((row) => !/completed_run|OVER\s*\(/.test(row.query))).toBe(true);
		expect(JSON.stringify(board)).not.toContain('userId');
	});
});
