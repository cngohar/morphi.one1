import { afterEach, expect, it, vi } from 'vitest';
import { checkpointMatchesIssued, validCheckpoint, type RoundCheckpoint } from './checkpoint.js';
import { manifest as memory } from '#lib/puzzles/memory/manifest.js';
import { triosScoring } from '#lib/puzzles/memory/scoring.js';
import { manifest as block } from '#lib/puzzles/block-placement/manifest.js';
import { manifest as connect } from '#lib/puzzles/connect/manifest.js';

const checkpoint = (): RoundCheckpoint => ({
	version: 1,
	id: 'round',
	owner: null,
	family: 'memory',
	seed: '42',
	engineVersion: 'memory-1',
	difficulty: null,
	modifiers: {},
	theme: null,
	scoring: { version: 'brief-v1', values: memory.scoring.defaults },
	moves: [{ index: 0 }],
	state: { phase: 'playing', elapsedMs: 1234, clockStarted: true, pending: { mismatch: 300 } },
	status: 'active',
	savedAt: Date.now(),
	rankedSession: null,
	rankedStartedAt: null
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it('rejects stale, future-version, malformed and different-owner checkpoints', () => {
	const value = checkpoint();
	expect(validCheckpoint(value, null)).toBe(true);
	for (const invalid of [
		{ ...value, version: 2 },
		{ ...value, savedAt: Date.now() - 86400000 },
		{ ...value, owner: 'another' },
		{ ...value, seed: '18446744073709551616' },
		{ ...value, moves: [{ index: Number.NaN }] },
		{ ...value, state: { ...value.state, elapsedMs: -1 } },
		{ ...value, state: { ...value.state, pending: { mismatch: -1 } } }
	])
		expect(validCheckpoint(invalid, null)).toBe(false);
});
it('accepts only the exact issued Memory identity and score snapshot for ranked recovery', () => {
	for (const variant of ['memory:classic', 'memory:no-preview', 'memory:trios', 'memory:moving']) {
		const local = { ...checkpoint(), owner: 'player', rankedSession: 'round', variant };
		const scoring = variant === 'memory:trios' ? triosScoring : memory.scoring;
		local.scoring = { version: scoring.version, values: scoring.defaults };
		const issued = {
			id: 'round',
			family: 'memory',
			variant,
			seed: '42',
			engineVersion: 'memory-1',
			scoring: local.scoring
		};
		expect(checkpointMatchesIssued(local, issued)).toBe(true);
		if (variant === 'memory:classic')
			expect(checkpointMatchesIssued({ ...local, variant: undefined }, issued)).toBe(true);
		for (const changed of [
			{ ...local, id: 'other' },
			{ ...local, rankedSession: null },
			{ ...local, variant: 'memory:unknown' },
			{ ...local, seed: '43' },
			{ ...local, engineVersion: 'memory-future' },
			{ ...local, scoring: { ...local.scoring, version: 'other' } },
			{ ...local, scoring: { ...local.scoring, values: { ...local.scoring.values, mismatch: 1 } } },
			{ ...local, scoring: { ...local.scoring, values: { mismatch: 1 } } }
		])
			expect(checkpointMatchesIssued(changed, issued)).toBe(false);
	}
});
it('accepts family-owned checkpoint phases while rejecting malformed or unbounded phases', () => {
	const value = checkpoint();
	expect(
		validCheckpoint(
			{ ...value, family: 'novel-family', state: { ...value.state, phase: 'solving' } },
			null
		)
	).toBe(true);
	for (const phase of ['', ' ', 'a'.repeat(81), null, 1])
		expect(validCheckpoint({ ...value, state: { ...value.state, phase } }, null)).toBe(false);
});
it('retains the latest checkpoint in memory when storage fails and clears exact ids only', async () => {
	vi.resetModules();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.stubGlobal('indexedDB', {
		open: () => {
			throw new Error('blocked');
		}
	});
	const storage = await import('./checkpoint.js');
	const lease = { token: 'fence', owns: () => true, release: () => {} };
	const value = checkpoint();
	await storage.saveCheckpoint(value, lease);
	await storage.saveCheckpoint({ ...value, state: { ...value.state, elapsedMs: 2000 } }, lease);
	expect((await storage.loadCheckpoint(null))?.state.elapsedMs).toBe(2000);
	expect(storage.checkpointDurable).toBe(false);
	await storage.clearCheckpoint(null, 'different-round');
	expect((await storage.loadCheckpoint(null))?.id).toBe(value.id);
	await storage.clearCheckpoint(null, value.id);
	expect(await storage.loadCheckpoint(null)).toBeNull();
});
it('bounds stalled IndexedDB and closes connections that finish opening too late', async () => {
	vi.resetModules();
	vi.useFakeTimers();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	const close = vi.fn();
	const opening = { result: { close }, onsuccess: () => {} };
	vi.stubGlobal('indexedDB', { open: () => opening });
	const storage = await import('./checkpoint.js');
	const reading = storage.loadCheckpoint(null);
	await vi.advanceTimersByTimeAsync(1500);
	expect(await reading).toBeNull();
	opening.onsuccess();
	expect(close).toHaveBeenCalledOnce();
});
it('reconstructs a single Memory card and a pending mismatch without losing the next move', () => {
	const original = memory.createRound('42');
	const second = original.cards.findIndex((card) => card.symbol !== original.cards[0]!.symbol);
	const single = memory.resumeRound('42', [{ index: 0 }]);
	expect(single.revealed).toEqual([0]);
	const mismatch = memory.resumeRound('42', [{ index: 0 }, { index: second }]);
	expect(mismatch.revealed).toEqual([0, second]);
	const next = memory.resumeRound('42', [{ index: 0 }, { index: second }, { index: 0 }]);
	expect(next.revealed).toEqual([0]);
	expect(next.mismatches).toBe(1);
	expect(() => memory.resumeRound('42', [{ index: -1 }])).toThrow();
});
it('replays partial Block and Connect rounds through their existing reducers', () => {
	const placed = block.resumeRound('42', [{ trayIndex: 0, x: 0, y: 0 }]);
	expect(placed.placements).toBe(1);
	const round = connect.createRound('42');
	const path = round.solution[0]!;
	const restored = connect.resumeRound('42', [
		{ pair: 0, cell: path[0]!, stroke: 0, at: 0 },
		{ pair: 0, cell: path[1]!, stroke: 0, at: 200 }
	]);
	expect(restored.paths[0]).toEqual(path.slice(0, 2));
	expect(restored.lastAt).toBe(200);
});
