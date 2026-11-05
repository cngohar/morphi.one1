import { describe, expect, it } from 'vitest';
import {
	BLOCK_MOVE_CAP,
	BLOCK_RUSH_SECONDS,
	createBlockRound,
	canPlace,
	dealBlockTray,
	endBlockRush,
	findAnyPlacement,
	parseBlockVariant,
	placeBlockPiece,
	replayBlockMoves,
	type BlockRound
} from './logic.js';
import { manifest } from './manifest.js';

function prepared(variant: string, overrides: Partial<BlockRound> = {}): BlockRound {
	return { ...createBlockRound('42', variant), tray: ['single', 'single', 'single'], ...overrides };
}

describe('Block variants', () => {
	it('keeps omitted and explicit classic rounds byte-identical and rejects foreign codes', () => {
		for (const seed of ['0', '42', '18446744073709551615']) {
			const legacy = createBlockRound(seed);
			expect(JSON.stringify(createBlockRound(seed, 'block:classic'))).toBe(JSON.stringify(legacy));
			expect(Object.hasOwn(legacy, 'boardSize')).toBe(false);
			expect(Object.hasOwn(legacy, 'variant')).toBe(false);
		}
		expect(parseBlockVariant()).toBe('block:classic');
		for (const variant of ['memory:classic', 'block:unknown'])
			expect(() => createBlockRound('42', variant)).toThrow('variant');
	});

	it('places across the whole 10 × 10 board and preserves edge and opening checks', () => {
		const round = prepared('block:board-10');
		expect(round.boardSize).toBe(10);
		expect(round.board).toHaveLength(100);
		expect(canPlace(round.board, 'single', 9, 9, round.boardSize)).toBe(true);
		expect(placeBlockPiece(round, 0, 9, 9).round.board[99]).toBe('single');
		expect(placeBlockPiece(round, 0, 10, 9).effect).toBe('invalid');
		expect(canPlace(round.board, 'bar4', 9, 7, 10)).toBe(false);
		const board = Array.from({ length: 100 }, () => 'single' as const) as BlockRound['board'];
		board[99] = null;
		expect(dealBlockTray(board, ['bar4', 'bar4', 'bar4'], 0, 9, 10).tray).toEqual([
			'bar4',
			'bar4',
			'single'
		]);
	});

	it('clears 10-cell rows and columns together, counting their union only once', () => {
		const round = prepared('block:board-10');
		for (let i = 0; i < 9; i++) {
			round.board[90 + i] = 'single';
			round.board[i * 10 + 9] = 'single';
		}
		const result = placeBlockPiece(round, 0, 9, 9);
		expect(result.lines).toBe(2);
		expect(result.cleared).toHaveLength(19);
		expect(result.gained).toBe(250);
		expect(result.round.board.every((cell) => cell === null)).toBe(true);
		const capped = placeBlockPiece(
			prepared('block:board-10', { placements: BLOCK_MOVE_CAP - 1, tray: ['single', null, null] }),
			0,
			9,
			9
		);
		expect(capped.round).toMatchObject({
			status: 'ended',
			endReason: 'cap',
			placements: 300,
			supplyIndex: 3
		});
	});

	it('leaves full columns filled without scoring them or extending a combo', () => {
		const round = prepared('block:rows-only', { combo: 3 });
		for (let y = 0; y < 7; y++) round.board[y * 8] = 'single';
		const result = placeBlockPiece(round, 0, 0, 7);
		expect(result.lines).toBe(0);
		expect(result.cleared).toEqual([]);
		expect(result.round).toMatchObject({ score: 0, lines: 0, combo: 0 });
		expect(result.round.board.filter(Boolean)).toHaveLength(8);
		expect(canPlace(result.round.board, 'single', 0, 0)).toBe(false);
	});

	it('scores only rows when a placement also completes a column', () => {
		const round = prepared('block:rows-only', { combo: 2 });
		for (let i = 1; i < 8; i++) {
			round.board[i] = 'single';
			round.board[i * 8] = 'single';
		}
		const result = placeBlockPiece(round, 0, 0, 0);
		expect(result.lines).toBe(1);
		expect(result.cleared).toHaveLength(8);
		expect(result.round).toMatchObject({ score: 200, lines: 1, combo: 3 });
		expect(result.round.board[8]).toBe('single');
	});

	it('ends rush at the view-owned deadline, blocks further placement, and keeps replay time-free', () => {
		const initial = createBlockRound('42', 'block:rush-60');
		const move = findAnyPlacement(initial)!;
		const playing = placeBlockPiece(initial, move.trayIndex, move.x, move.y).round;
		const expired = endBlockRush(playing);
		expect(expired).toMatchObject({ status: 'ended', endReason: 'time-up' });
		expect(placeBlockPiece(expired, 1, 4, 4).effect).toBe('invalid');
		expect(endBlockRush(expired)).toBe(expired);
		const classic = createBlockRound('42');
		expect(endBlockRush(classic)).toBe(classic);
		expect(replayBlockMoves('42', [move], undefined, 'block:rush-60')).toEqual(playing);
		expect(manifest.replay('42', [move], 0, undefined, 'block:rush-60')).toMatchObject({
			score: 0,
			moves: 1
		});
		expect(
			manifest.replay('42', [move], BLOCK_RUSH_SECONDS, undefined, 'block:rush-60')
		).toMatchObject({ score: 0, moves: 1, group: 'block-placement-1:rush-60' });
		expect(() => manifest.replay('42', [], BLOCK_RUSH_SECONDS, undefined, 'block:rush-60')).toThrow(
			'incomplete'
		);
		expect(() => manifest.replay('42', [move], BLOCK_RUSH_SECONDS)).toThrow('incomplete');
	});
});
