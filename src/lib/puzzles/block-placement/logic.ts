import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring as scoringDefinition } from './scoring.js';
import { createRng, shuffle } from '#lib/engine/rng.js';

export const BLOCK_ENGINE_VERSION = 'block-placement-1';
export const BLOCK_BOARD_SIZE = 8;
export const BLOCK_TRAY_SIZE = 3;
export const BLOCK_MOVE_CAP = 300;
export const BLOCK_OPENING_TURNS = 10;
export const BLOCK_SO_CLOSE_GAP = 250;

export const PIECE_IDS = [
	'single',
	'domino',
	'bar3',
	'l3',
	'bar4',
	'square',
	'l4',
	't4',
	's4'
] as const;

export type PieceId = (typeof PIECE_IDS)[number];

export interface CellOffset {
	x: number;
	y: number;
}

export interface PieceShape {
	id: PieceId;
	cells: readonly CellOffset[];
	width: number;
	height: number;
}

function shape(id: PieceId, cells: readonly CellOffset[]): PieceShape {
	return {
		id,
		cells,
		width: Math.max(...cells.map((cell) => cell.x)) + 1,
		height: Math.max(...cells.map((cell) => cell.y)) + 1
	};
}

export const PIECES: readonly PieceShape[] = [
	shape('single', [{ x: 0, y: 0 }]),
	shape('domino', [
		{ x: 0, y: 0 },
		{ x: 0, y: 1 }
	]),
	shape('bar3', [
		{ x: 0, y: 0 },
		{ x: 0, y: 1 },
		{ x: 0, y: 2 }
	]),
	shape('l3', [
		{ x: 0, y: 0 },
		{ x: 0, y: 1 },
		{ x: 1, y: 1 }
	]),
	shape('bar4', [
		{ x: 0, y: 0 },
		{ x: 0, y: 1 },
		{ x: 0, y: 2 },
		{ x: 0, y: 3 }
	]),
	shape('square', [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 0, y: 1 },
		{ x: 1, y: 1 }
	]),
	shape('l4', [
		{ x: 0, y: 0 },
		{ x: 0, y: 1 },
		{ x: 0, y: 2 },
		{ x: 1, y: 2 }
	]),
	shape('t4', [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 2, y: 0 },
		{ x: 1, y: 1 }
	]),
	shape('s4', [
		{ x: 1, y: 0 },
		{ x: 2, y: 0 },
		{ x: 0, y: 1 },
		{ x: 1, y: 1 }
	])
];

export const PIECE_BY_ID: Readonly<Record<PieceId, PieceShape>> = {
	single: PIECES[0],
	domino: PIECES[1],
	bar3: PIECES[2],
	l3: PIECES[3],
	bar4: PIECES[4],
	square: PIECES[5],
	l4: PIECES[6],
	t4: PIECES[7],
	s4: PIECES[8]
} as const;

export type BoardCell = PieceId | null;
export type BlockStatus = 'playing' | 'ended';
export type BlockEndReason = 'none' | 'no-fit' | 'cap';

export interface BlockRound {
	engineVersion: string;
	seed: string;
	board: BoardCell[];
	tray: (PieceId | null)[];
	supply: PieceId[];
	supplyIndex: number;
	score: number;
	lines: number;
	combo: number;
	placements: number;
	status: BlockStatus;
	endReason: BlockEndReason;
}

export interface BlockMove extends Move {
	trayIndex: number;
	x: number;
	y: number;
}

export interface ClearedCell {
	index: number;
	piece: PieceId;
}

export type PlaceEffect = 'placed' | 'cleared' | 'invalid';

export interface PlaceResult {
	round: BlockRound;
	effect: PlaceEffect;
	placed: number[];
	cleared: ClearedCell[];
	lines: number;
	gained: number;
}

export function isPieceId(value: string): value is PieceId {
	return (PIECE_IDS as readonly string[]).includes(value);
}

function buildSupply(seed: string): PieceId[] {
	const rng = createRng(seed);
	const supply: PieceId[] = [];

	while (supply.length < BLOCK_MOVE_CAP) {
		supply.push(...shuffle(rng, PIECE_IDS));
	}

	return supply.slice(0, BLOCK_MOVE_CAP);
}

export function canPlace(
	board: readonly BoardCell[],
	pieceId: PieceId,
	x: number,
	y: number
): boolean {
	if (
		!Number.isSafeInteger(x) ||
		!Number.isSafeInteger(y) ||
		x < 0 ||
		y < 0 ||
		board.length !== BLOCK_BOARD_SIZE * BLOCK_BOARD_SIZE
	) {
		return false;
	}

	const piece = PIECE_BY_ID[pieceId];
	if (x + piece.width > BLOCK_BOARD_SIZE || y + piece.height > BLOCK_BOARD_SIZE) {
		return false;
	}

	return piece.cells.every((cell) => board[(y + cell.y) * BLOCK_BOARD_SIZE + x + cell.x] === null);
}

export function findPlacement(
	board: readonly BoardCell[],
	pieceId: PieceId
): { x: number; y: number } | null {
	const piece = PIECE_BY_ID[pieceId];

	for (let y = 0; y <= BLOCK_BOARD_SIZE - piece.height; y += 1) {
		for (let x = 0; x <= BLOCK_BOARD_SIZE - piece.width; x += 1) {
			if (canPlace(board, pieceId, x, y)) {
				return { x, y };
			}
		}
	}

	return null;
}

export function canPlaceAnywhere(board: readonly BoardCell[], pieceId: PieceId): boolean {
	return findPlacement(board, pieceId) !== null;
}

export function findAnyPlacement(round: BlockRound): BlockMove | null {
	for (let trayIndex = 0; trayIndex < round.tray.length; trayIndex += 1) {
		const pieceId = round.tray[trayIndex];
		if (!pieceId) {
			continue;
		}

		const placement = findPlacement(round.board, pieceId);
		if (placement) {
			return { trayIndex, x: placement.x, y: placement.y };
		}
	}

	return null;
}

export function dealBlockTray(
	board: readonly BoardCell[],
	supply: readonly PieceId[],
	supplyIndex: number,
	placements: number
): { tray: (PieceId | null)[]; supplyIndex: number } {
	const tray: (PieceId | null)[] = [];
	let nextIndex = supplyIndex;

	for (let slot = 0; slot < BLOCK_TRAY_SIZE; slot += 1) {
		tray.push(supply[nextIndex] ?? null);
		nextIndex += 1;
	}

	const opening = placements < BLOCK_OPENING_TURNS;
	const hasFit = tray.some((pieceId) => pieceId !== null && canPlaceAnywhere(board, pieceId));

	if (opening && !hasFit) {
		tray[BLOCK_TRAY_SIZE - 1] = 'single';
	}

	return { tray, supplyIndex: nextIndex };
}

function withStatus(round: BlockRound): BlockRound {
	if (round.status === 'ended') {
		return round;
	}

	if (round.placements >= BLOCK_MOVE_CAP) {
		return { ...round, status: 'ended', endReason: 'cap' };
	}

	if (round.tray.every((pieceId) => pieceId === null) || findAnyPlacement(round) === null) {
		return { ...round, status: 'ended', endReason: 'no-fit' };
	}

	return round;
}

export function createBlockRound(seed: string): BlockRound {
	const supply = buildSupply(seed);
	const board: BoardCell[] = Array.from(
		{ length: BLOCK_BOARD_SIZE * BLOCK_BOARD_SIZE },
		() => null
	);
	const dealt = dealBlockTray(board, supply, 0, 0);

	return withStatus({
		engineVersion: BLOCK_ENGINE_VERSION,
		seed,
		board,
		tray: dealt.tray,
		supply,
		supplyIndex: dealt.supplyIndex,
		score: 0,
		lines: 0,
		combo: 0,
		placements: 0,
		status: 'playing',
		endReason: 'none'
	});
}

function fullLines(board: readonly BoardCell[]): { rows: number[]; columns: number[] } {
	const rows: number[] = [];
	const columns: number[] = [];

	for (let y = 0; y < BLOCK_BOARD_SIZE; y += 1) {
		let full = true;
		for (let x = 0; x < BLOCK_BOARD_SIZE; x += 1) {
			if (board[y * BLOCK_BOARD_SIZE + x] === null) {
				full = false;
				break;
			}
		}
		if (full) {
			rows.push(y);
		}
	}

	for (let x = 0; x < BLOCK_BOARD_SIZE; x += 1) {
		let full = true;
		for (let y = 0; y < BLOCK_BOARD_SIZE; y += 1) {
			if (board[y * BLOCK_BOARD_SIZE + x] === null) {
				full = false;
				break;
			}
		}
		if (full) {
			columns.push(x);
		}
	}

	return { rows, columns };
}

export function scorePlacement(
	lines: number,
	combo: number,
	scoring: ScoreValues = scoringDefinition.defaults
): number {
	if (lines <= 0) {
		return 0;
	}

	return lines * scoring.line! + (lines - 1) * scoring.extraLine! + (combo - 1) * scoring.combo!;
}

export function placeBlockPiece(
	round: BlockRound,
	trayIndex: number,
	x: number,
	y: number,
	scoring: ScoreValues = scoringDefinition.defaults
): PlaceResult {
	const pieceId = round.tray[trayIndex];

	if (round.status !== 'playing' || !pieceId || !canPlace(round.board, pieceId, x, y)) {
		return { round, effect: 'invalid', placed: [], cleared: [], lines: 0, gained: 0 };
	}

	const piece = PIECE_BY_ID[pieceId];
	const board = round.board.slice();
	const tray = round.tray.slice();
	const placed = piece.cells.map((cell) => (y + cell.y) * BLOCK_BOARD_SIZE + x + cell.x);

	for (const index of placed) {
		board[index] = pieceId;
	}
	tray[trayIndex] = null;

	const { rows, columns } = fullLines(board);
	const lineCount = rows.length + columns.length;
	const clearedIndexes = new Set<number>();

	for (const row of rows) {
		for (let column = 0; column < BLOCK_BOARD_SIZE; column += 1) {
			clearedIndexes.add(row * BLOCK_BOARD_SIZE + column);
		}
	}

	for (const column of columns) {
		for (let row = 0; row < BLOCK_BOARD_SIZE; row += 1) {
			clearedIndexes.add(row * BLOCK_BOARD_SIZE + column);
		}
	}

	const cleared = Array.from(clearedIndexes)
		.sort((a, b) => a - b)
		.map((index) => ({ index, piece: board[index] as PieceId }));

	for (const index of clearedIndexes) {
		board[index] = null;
	}

	const combo = lineCount > 0 ? round.combo + 1 : 0;
	const gained = scorePlacement(lineCount, combo, scoring);
	const placements = round.placements + 1;
	let next: BlockRound = {
		...round,
		board,
		tray,
		score: round.score + gained,
		lines: round.lines + lineCount,
		combo,
		placements
	};

	if (tray.every((piece) => piece === null) && placements < BLOCK_MOVE_CAP) {
		const dealt = dealBlockTray(board, round.supply, round.supplyIndex, placements);
		next = { ...next, tray: dealt.tray, supplyIndex: dealt.supplyIndex };
	}

	return {
		round: withStatus(next),
		effect: lineCount > 0 ? 'cleared' : 'placed',
		placed,
		cleared,
		lines: lineCount,
		gained
	};
}

export function replayBlockMoves(
	seed: string,
	moves: readonly BlockMove[],
	scoring: ScoreValues = scoringDefinition.defaults
): BlockRound {
	let round = createBlockRound(seed);

	for (let index = 0; index < moves.length; index += 1) {
		const move = moves[index];
		if (!move) {
			throw new RangeError(`Move ${index} is missing.`);
		}

		const result = placeBlockPiece(round, move.trayIndex, move.x, move.y, scoring);
		if (result.effect === 'invalid') {
			throw new RangeError(`Move ${index} is invalid.`);
		}

		round = result.round;
	}

	return round;
}
