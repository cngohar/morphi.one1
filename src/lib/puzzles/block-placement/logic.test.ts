import { describe, expect, it } from 'vitest';
import {
	BLOCK_BOARD_SIZE,
	BLOCK_ENGINE_VERSION,
	BLOCK_MOVE_CAP,
	BLOCK_OPENING_TURNS,
	PIECES,
	PIECE_IDS,
	canPlace,
	canPlaceAnywhere,
	createBlockRound,
	dealBlockTray,
	findAnyPlacement,
	findPlacement,
	placeBlockPiece,
	replayBlockMoves,
	scorePlacement,
	type BlockMove,
	type BlockRound,
	type BoardCell
} from '#lib/puzzles/block-placement/logic.js';

function emptyBoard(): BoardCell[] {
	return Array.from({ length: BLOCK_BOARD_SIZE * BLOCK_BOARD_SIZE }, () => null);
}

function filledBoard(): BoardCell[] {
	return Array.from({ length: BLOCK_BOARD_SIZE * BLOCK_BOARD_SIZE }, () => 'single');
}

function almostFilledBoard(): BoardCell[] {
	const board = filledBoard();

	for (const [x, y] of [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1],
		[2, 2],
		[3, 3],
		[4, 4],
		[5, 5],
		[6, 6],
		[7, 7]
	]) {
		board[y * BLOCK_BOARD_SIZE + x] = null;
	}

	return board;
}

function roundWith(overrides: Partial<BlockRound> = {}): BlockRound {
	return {
		...createBlockRound('7'),
		status: 'playing',
		endReason: 'none',
		...overrides
	};
}

function fillRow(board: BoardCell[], row: number, except = -1): void {
	for (let x = 0; x < BLOCK_BOARD_SIZE; x += 1) {
		if (x !== except) {
			board[row * BLOCK_BOARD_SIZE + x] = 'domino';
		}
	}
}

function fillColumn(board: BoardCell[], column: number, except = -1): void {
	for (let y = 0; y < BLOCK_BOARD_SIZE; y += 1) {
		if (y !== except) {
			board[y * BLOCK_BOARD_SIZE + column] = 'domino';
		}
	}
}

describe('piece definitions', () => {
	it('has nine unique normalized shapes of one to four cells', () => {
		expect(PIECE_IDS).toHaveLength(9);
		expect(new Set(PIECE_IDS).size).toBe(9);

		for (const piece of PIECES) {
			expect(piece.cells.length).toBeGreaterThanOrEqual(1);
			expect(piece.cells.length).toBeLessThanOrEqual(4);
			expect(new Set(piece.cells.map((cell) => `${cell.x},${cell.y}`)).size).toBe(
				piece.cells.length
			);
			expect(Math.min(...piece.cells.map((cell) => cell.x))).toBe(0);
			expect(Math.min(...piece.cells.map((cell) => cell.y))).toBe(0);
			expect(piece.width).toBe(Math.max(...piece.cells.map((cell) => cell.x)) + 1);
			expect(piece.height).toBe(Math.max(...piece.cells.map((cell) => cell.y)) + 1);
		}
	});
});

describe('createBlockRound', () => {
	it('starts with an empty board and a full tray', () => {
		const round = createBlockRound('123');

		expect(round.engineVersion).toBe(BLOCK_ENGINE_VERSION);
		expect(round.board).toHaveLength(64);
		expect(round.board.every((cell) => cell === null)).toBe(true);
		expect(round.tray).toHaveLength(3);
		expect(round.tray.some((piece) => piece !== null)).toBe(true);
		expect(round.supply).toHaveLength(BLOCK_MOVE_CAP);
		expect(round.supplyIndex).toBe(3);
		expect(round.score).toBe(0);
		expect(round.lines).toBe(0);
		expect(round.combo).toBe(0);
		expect(round.placements).toBe(0);
		expect(round.status).toBe('playing');
		expect(round.endReason).toBe('none');
	});

	it('is deterministic for the same seed', () => {
		expect(JSON.stringify(createBlockRound('42'))).toBe(JSON.stringify(createBlockRound('42')));
	});

	it('changes the supply with the seed', () => {
		expect(createBlockRound('1').supply.slice(0, 20)).not.toEqual(
			createBlockRound('2').supply.slice(0, 20)
		);
	});

	it('always deals a placement to the initial tray', () => {
		for (let seed = 0; seed < 300; seed += 1) {
			const round = createBlockRound(String(seed));

			expect(
				round.tray.some((piece) => piece !== null && canPlaceAnywhere(round.board, piece))
			).toBe(true);
		}
	});

	it('builds each nine-piece bag from the full set', () => {
		const round = createBlockRound('999');

		for (let start = 0; start < 27; start += 9) {
			expect(
				round.supply
					.slice(start, start + 9)
					.slice()
					.sort()
			).toEqual(PIECE_IDS.slice().sort());
		}
	});

	it('matches the known seed 0 vector', () => {
		const round = createBlockRound('0');

		expect(round.tray).toEqual(['domino', 'single', 'l3']);
		expect(round.supply.slice(0, 18)).toEqual([
			'domino',
			'single',
			'l3',
			'square',
			'l4',
			's4',
			'bar3',
			'bar4',
			't4',
			'single',
			'domino',
			'bar3',
			't4',
			'l3',
			'bar4',
			'square',
			'l4',
			's4'
		]);
	});

	it('matches the known 20-placement seed 0 vector', () => {
		const moves: BlockMove[] = [
			{ trayIndex: 0, x: 0, y: 0 },
			{ trayIndex: 1, x: 1, y: 0 },
			{ trayIndex: 2, x: 2, y: 0 },
			{ trayIndex: 0, x: 4, y: 0 },
			{ trayIndex: 1, x: 6, y: 0 },
			{ trayIndex: 2, x: 0, y: 2 },
			{ trayIndex: 0, x: 3, y: 2 },
			{ trayIndex: 1, x: 4, y: 2 },
			{ trayIndex: 2, x: 5, y: 3 },
			{ trayIndex: 0, x: 3, y: 0 },
			{ trayIndex: 1, x: 7, y: 0 },
			{ trayIndex: 2, x: 2, y: 3 },
			{ trayIndex: 0, x: 0, y: 0 },
			{ trayIndex: 1, x: 3, y: 0 },
			{ trayIndex: 2, x: 5, y: 0 },
			{ trayIndex: 0, x: 6, y: 0 },
			{ trayIndex: 1, x: 0, y: 1 },
			{ trayIndex: 2, x: 0, y: 1 },
			{ trayIndex: 0, x: 2, y: 1 },
			{ trayIndex: 1, x: 6, y: 1 }
		];
		const round = replayBlockMoves('0', moves);

		expect(round.score).toBe(700);
		expect(round.lines).toBe(5);
		expect(round.combo).toBe(0);
		expect(round.placements).toBe(20);
		expect(round.status).toBe('playing');
		expect(round.supplyIndex).toBe(21);
		expect(round.tray).toEqual([null, null, 'single']);
	});
});

describe('placement validation', () => {
	it('accepts fits on the empty board and rejects edges', () => {
		const board = emptyBoard();

		expect(canPlace(board, 'single', 7, 7)).toBe(true);
		expect(canPlace(board, 'single', 8, 7)).toBe(false);
		expect(canPlace(board, 'bar4', 0, 4)).toBe(true);
		expect(canPlace(board, 'bar4', 0, 5)).toBe(false);
		expect(canPlace(board, 'square', 7, 0)).toBe(false);
		expect(canPlace(board, 'single', -1, 0)).toBe(false);
		expect(canPlace(board, 'single', 0, -1)).toBe(false);
		expect(canPlace(board, 'single', 1.5, 0)).toBe(false);
	});

	it('rejects occupied cells', () => {
		const board = emptyBoard();
		board[0] = 'single';

		expect(canPlace(board, 'single', 0, 0)).toBe(false);
		expect(canPlace(board, 'square', 0, 0)).toBe(false);
		expect(canPlace(board, 'single', 1, 0)).toBe(true);
	});

	it('finds the first legal placement', () => {
		const board = emptyBoard();
		board[0] = 'single';
		board[1] = 'single';

		expect(findPlacement(board, 'domino')).toEqual({ x: 2, y: 0 });
		expect(findPlacement(filledBoard(), 'single')).toBeNull();
	});

	it('rejects invalid and ended placements without consuming a piece', () => {
		const round = roundWith({
			board: filledBoard(),
			tray: ['single', null, null]
		});
		const occupied = placeBlockPiece(round, 0, 0, 0);

		expect(occupied.effect).toBe('invalid');
		expect(occupied.round).toBe(round);

		const ended = roundWith({
			status: 'ended',
			endReason: 'no-fit',
			tray: ['single', null, null]
		});
		expect(placeBlockPiece(ended, 0, 0, 0).effect).toBe('invalid');
		expect(placeBlockPiece(round, 1, 0, 0).effect).toBe('invalid');
		expect(placeBlockPiece(round, 0, 8, 0).effect).toBe('invalid');
	});
});

describe('dealBlockTray', () => {
	it('draws three pieces and advances the supply', () => {
		const board = emptyBoard();
		const result = dealBlockTray(board, PIECE_IDS, 0, 0);

		expect(result.tray).toEqual(PIECE_IDS.slice(0, 3));
		expect(result.supplyIndex).toBe(3);
	});

	it('forces the last piece to a monomino when the opening tray cannot fit', () => {
		const board = filledBoard();
		board[0] = null;
		const result = dealBlockTray(board, ['bar4', 'bar4', 'bar4'], 0, BLOCK_OPENING_TURNS - 1);

		expect(result.tray).toEqual(['bar4', 'bar4', 'single']);
		expect(result.supplyIndex).toBe(3);
	});

	it('does not guarantee a fit after the opening turns', () => {
		const board = filledBoard();
		board[0] = null;
		const result = dealBlockTray(board, ['bar4', 'bar4', 'bar4'], 0, BLOCK_OPENING_TURNS);

		expect(result.tray).toEqual(['bar4', 'bar4', 'bar4']);
	});

	it('leaves a fitting opening tray alone', () => {
		const result = dealBlockTray(emptyBoard(), ['bar4', 'bar4', 'bar4'], 0, 0);

		expect(result.tray).toEqual(['bar4', 'bar4', 'bar4']);
	});
});

describe('placing pieces', () => {
	it('places a piece, empties its slot, and does not score without a clear', () => {
		const round = roundWith({ tray: ['domino', 'single', null] });
		const result = placeBlockPiece(round, 0, 2, 2);

		expect(result.effect).toBe('placed');
		expect(result.round.board[18]).toBe('domino');
		expect(result.round.board[26]).toBe('domino');
		expect(result.round.tray).toEqual([null, 'single', null]);
		expect(result.round.placements).toBe(1);
		expect(result.round.score).toBe(0);
		expect(result.round.combo).toBe(0);
		expect(result.placed).toEqual([18, 26]);
		expect(result.cleared).toEqual([]);
	});

	it('refills only after the third placement', () => {
		const round = roundWith({
			tray: ['single', 'single', 'single'],
			supply: ['domino', 'bar3', 'square', 'l4', 't4', 's4'],
			supplyIndex: 0
		});

		const first = placeBlockPiece(round, 0, 0, 0);
		expect(first.round.tray).toEqual([null, 'single', 'single']);
		expect(first.round.supplyIndex).toBe(0);

		const second = placeBlockPiece(first.round, 1, 2, 0);
		expect(second.round.tray).toEqual([null, null, 'single']);
		expect(second.round.supplyIndex).toBe(0);

		const third = placeBlockPiece(second.round, 2, 4, 0);
		expect(third.round.tray).toEqual(['domino', 'bar3', 'square']);
		expect(third.round.supplyIndex).toBe(3);
		expect(third.round.placements).toBe(3);
	});

	it('clears a full row and returns the cleared cells', () => {
		const board = emptyBoard();
		fillRow(board, 0, 7);
		const result = placeBlockPiece(
			roundWith({ board, tray: ['single', null, null], placements: 20 }),
			0,
			7,
			0
		);

		expect(result.effect).toBe('cleared');
		expect(result.lines).toBe(1);
		expect(result.gained).toBe(100);
		expect(result.round.score).toBe(100);
		expect(result.round.lines).toBe(1);
		expect(result.round.combo).toBe(1);
		expect(result.cleared).toHaveLength(8);
		expect(result.round.board.slice(0, 8).every((cell) => cell === null)).toBe(true);
	});

	it('clears a row and a column at once', () => {
		const board = emptyBoard();
		fillRow(board, 0, 7);
		fillColumn(board, 7, 0);
		const result = placeBlockPiece(
			roundWith({ board, tray: ['single', null, null], placements: 20 }),
			0,
			7,
			0
		);

		expect(result.lines).toBe(2);
		expect(result.gained).toBe(250);
		expect(result.round.score).toBe(250);
		expect(result.round.lines).toBe(2);
		expect(result.cleared).toHaveLength(15);
		expect(result.round.board[0]).toBeNull();
		expect(result.round.board[7]).toBeNull();
		expect(result.round.board[63]).toBeNull();
	});

	it('scores multi-line combo examples from the brief', () => {
		const board = emptyBoard();

		for (let row = 0; row < 3; row += 1) {
			fillRow(board, row, 7);
		}

		const result = placeBlockPiece(
			roundWith({
				board,
				tray: ['bar3', null, null],
				combo: 2,
				score: 400,
				lines: 2,
				placements: 20
			}),
			0,
			7,
			0
		);

		expect(result.lines).toBe(3);
		expect(result.gained).toBe(500);
		expect(result.round.combo).toBe(3);
		expect(result.round.score).toBe(900);
		expect(scorePlacement(1, 1)).toBe(100);
		expect(scorePlacement(2, 1)).toBe(250);
		expect(scorePlacement(1, 2)).toBe(150);
		expect(scorePlacement(3, 3)).toBe(500);
		expect(scorePlacement(2, 3, { line: 300, extraLine: 20, combo: 30 })).toBe(680);
	});

	it('resets the combo when a placement clears nothing', () => {
		const result = placeBlockPiece(
			roundWith({ tray: ['single', null, null], combo: 2, score: 400, placements: 20 }),
			0,
			0,
			0
		);

		expect(result.round.combo).toBe(0);
		expect(result.round.score).toBe(400);
		expect(result.gained).toBe(0);
	});
});

describe('run end', () => {
	it('ends as no-fit when the remaining tray cannot be placed', () => {
		const result = placeBlockPiece(
			roundWith({
				board: almostFilledBoard(),
				tray: ['single', 'bar4', null],
				placements: 20
			}),
			0,
			0,
			0
		);

		expect(result.effect).toBe('placed');
		expect(result.round.status).toBe('ended');
		expect(result.round.endReason).toBe('no-fit');
		expect(result.round.tray).toEqual([null, 'bar4', null]);
	});

	it('ends at the 300-placement cap', () => {
		const result = placeBlockPiece(
			roundWith({
				tray: ['single', null, null],
				placements: BLOCK_MOVE_CAP - 1
			}),
			0,
			0,
			0
		);

		expect(result.round.placements).toBe(BLOCK_MOVE_CAP);
		expect(result.round.status).toBe('ended');
		expect(result.round.endReason).toBe('cap');
	});

	it('refills into a no-fit state after the opening guarantee', () => {
		const result = placeBlockPiece(
			roundWith({
				board: almostFilledBoard(),
				tray: ['single', null, null],
				supply: ['bar4', 'square', 'bar4'],
				supplyIndex: 0,
				placements: BLOCK_OPENING_TURNS
			}),
			0,
			0,
			0
		);

		expect(result.round.status).toBe('ended');
		expect(result.round.endReason).toBe('no-fit');
		expect(result.round.tray).toEqual(['bar4', 'square', 'bar4']);
	});
});

describe('replayBlockMoves', () => {
	it('reproduces a run from its seed and moves', () => {
		let forward = createBlockRound('123456789');
		const moves: BlockMove[] = [];

		while (forward.status === 'playing' && moves.length < 30) {
			const move = findAnyPlacement(forward);
			if (!move) {
				break;
			}

			moves.push(move);
			forward = placeBlockPiece(forward, move.trayIndex, move.x, move.y).round;
		}

		expect(replayBlockMoves('123456789', moves)).toEqual(forward);
	});

	it('rejects invalid and post-end moves', () => {
		expect(() => replayBlockMoves('0', [{ trayIndex: 0, x: 7, y: 7 }])).toThrow(RangeError);

		const round = roundWith({
			tray: ['single', null, null],
			placements: BLOCK_MOVE_CAP - 1
		});
		const ended = placeBlockPiece(round, 0, 0, 0).round;

		expect(ended.status).toBe('ended');
		expect(placeBlockPiece(ended, 0, 0, 0).effect).toBe('invalid');
	});
});
