import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { createRng, shuffle, type Rng } from '#lib/engine/rng.js';
import { scoring as scoringDefinition } from './scoring.js';

export const NONOGRAM_ENGINE_VERSION = 'nonogram-1';
export const NONOGRAM_BANDS = [
	{ size: 5, par: 180 },
	{ size: 10, par: 600 },
	{ size: 15, par: 1500 }
] as const;
export const NONOGRAM_VARIANTS = [
	'nonogram:classic',
	'nonogram:colour-2',
	'nonogram:colour-5',
	'nonogram:partial-clues',
	'nonogram:totals-only',
	'nonogram:unchecked',
	'nonogram:strict-count',
	'nonogram:countdown',
	'nonogram:three-hearts',
	'nonogram:no-undo',
	'nonogram:hint-budget'
] as const;
export type NonogramVariant = (typeof NONOGRAM_VARIANTS)[number];

export function parseNonogramVariant(variant?: string): NonogramVariant {
	if (variant === undefined) return 'nonogram:classic';
	if (!NONOGRAM_VARIANTS.includes(variant as NonogramVariant)) throw new RangeError('variant');
	return variant as NonogramVariant;
}

export interface NonogramClue {
	length: number;
	colour: number;
}
export interface NonogramMove extends Move {
	cell: number;
	mark: number;
	stroke: number;
	at: number;
}
export const NONOGRAM_ACTION = {
	undo: 6,
	check: 7,
	hint: 8,
	autoXOff: 9,
	autoXOn: 10,
	restart: 11,
	tick: 12
} as const;
interface UndoEntry {
	cells: number[];
	autoX: boolean;
}
export interface NonogramRound {
	seed: string;
	variant?: NonogramVariant;
	rules: {
		colours: number;
		checked: boolean;
		timeLimit: number;
		hearts: number;
		undo: boolean;
		hintLimit: number;
		strict?: boolean;
		allDecided?: boolean;
		totalsOnly?: boolean;
	};
	band: number;
	size: number;
	par: number;
	rowClues: NonogramClue[][];
	columnClues: NonogramClue[][];
	hiddenRows?: boolean[];
	hiddenColumns?: boolean[];
	/** Zero is unknown; -1 is X; positive integers are fill colours. */
	cells: number[];
	filledCells: number;
	mistakes: number;
	hintsUsed: number;
	autoX: boolean;
	strokes: number;
	lastAt: number;
	lastCell: number;
	strokeStart: number;
	strokeMark: number;
	strokeAxis: number;
	strokeStopped: boolean;
	lastMistake: number;
	lastHint: number;
	checkCells: number[];
	checkCount: number;
	/** Inspected fills include correct positions too, so strict Check exposes no cell identity. */
	reportedMistakes?: number[];
	timePenaltyMs?: number;
	hearts?: number;
	history: UndoEntry[];
	status: 'playing' | 'won' | 'lost';
}
type PlacementCache = Map<string, number[][] | number[]>;
export interface NonogramSolverRules {
	hiddenRows?: readonly boolean[];
	hiddenColumns?: readonly boolean[];
	totalsOnly?: boolean;
}
export function nonogramSolverRules(round: NonogramRound): NonogramSolverRules {
	return {
		hiddenRows: round.hiddenRows,
		hiddenColumns: round.hiddenColumns,
		totalsOnly: round.rules.totalsOnly
	};
}
export interface NonogramLineResult {
	grid: number[];
	complete: boolean;
	contradiction: boolean;
	steps: number;
}

export function deriveLineClues(line: readonly number[]): NonogramClue[] {
	const clues: NonogramClue[] = [];
	let previous = 0;
	for (const colour of line) {
		if (!Number.isSafeInteger(colour) || colour < 0 || colour > 5) throw new RangeError('cell');
		if (colour > 0) {
			if (colour === previous) clues[clues.length - 1]!.length++;
			else clues.push({ length: 1, colour });
		}
		previous = colour;
	}
	return clues;
}

export function deriveNonogramClues(grid: readonly number[], size: number) {
	if (!Number.isSafeInteger(size) || size < 1 || size > 15 || grid.length !== size * size)
		throw new RangeError('grid');
	return {
		rowClues: Array.from({ length: size }, (_, row) =>
			deriveLineClues(grid.slice(row * size, (row + 1) * size))
		),
		columnClues: Array.from({ length: size }, (_, column) =>
			deriveLineClues(Array.from({ length: size }, (_, row) => grid[row * size + column]!))
		)
	};
}

function clueKey(clues: readonly NonogramClue[]): string {
	return clues.map(({ length, colour }) => `${length}:${colour}`).join(',');
}

/** Known cells use -1 for unknown, 0 for empty, and 1–5 for a fill colour. */
export function linePlacements(
	size: number,
	clues: readonly NonogramClue[],
	known: readonly number[] = Array<number>(size).fill(-1),
	cache: PlacementCache = new Map(),
	totalsOnly = false
): number[][] {
	if (
		!Number.isSafeInteger(size) ||
		size < 1 ||
		size > 15 ||
		known.length !== size ||
		known.some((cell) => !Number.isSafeInteger(cell) || cell < -1 || cell > 5) ||
		clues.some(
			({ length, colour }) =>
				!Number.isSafeInteger(length) ||
				length < 1 ||
				length > size ||
				!Number.isSafeInteger(colour) ||
				colour < 1 ||
				colour > 5
		)
	)
		throw new RangeError('line');
	if (totalsOnly) {
		const masks = totalPlacements(
			size,
			clues.reduce((sum, clue) => sum + clue.length, 0),
			known,
			cache
		);
		return masks.map((mask) =>
			Array.from({ length: size }, (_, cell) => Number((mask & (1 << cell)) !== 0))
		);
	}
	const baseKey = `${size}|${clueKey(clues)}`;
	const key = `${baseKey}|${known.join(',')}`;
	const existing = cache.get(key) as number[][] | undefined;
	if (existing) return existing;
	if (!known.includes(-1)) {
		const result = clueKey(deriveLineClues(known)) === clueKey(clues) ? [known.slice()] : [];
		cache.set(key, result);
		return result;
	}
	let base = cache.get(baseKey) as number[][] | undefined;
	if (!base) {
		base = [];
		const suffix = Array<number>(clues.length + 1).fill(0);
		for (let index = clues.length - 1; index >= 0; index--)
			suffix[index] =
				clues[index]!.length +
				suffix[index + 1]! +
				Number(index + 1 < clues.length && clues[index]!.colour === clues[index + 1]!.colour);
		const place = (index: number, from: number, cells: number[]) => {
			if (index === clues.length) {
				base!.push(cells);
				return;
			}
			const clue = clues[index]!;
			for (let start = from; start + suffix[index]! <= size; start++) {
				const next = cells.slice();
				next.fill(clue.colour, start, start + clue.length);
				const gap = Number(index + 1 < clues.length && clue.colour === clues[index + 1]!.colour);
				place(index + 1, start + clue.length + gap, next);
			}
		};
		place(0, 0, Array<number>(size).fill(0));
		cache.set(baseKey, base);
	}
	const result = base.filter((placement) =>
		known.every((cell, at) => cell === -1 || cell === placement[at])
	);
	cache.set(key, result);
	return result;
}

function totalPlacements(
	size: number,
	total: number,
	known: readonly number[],
	cache: PlacementCache
): number[] {
	let filled = 0,
		empty = 0,
		remaining = total;
	const unknown: number[] = [];
	for (let cell = 0; cell < size; cell++) {
		if (known[cell] === 1) {
			filled |= 1 << cell;
			remaining--;
		} else if (known[cell] === 0) empty |= 1 << cell;
		else if (known[cell] === -1) unknown.push(cell);
		else return [];
	}
	const key = `total:${size}:${total}:${filled}:${empty}`;
	const existing = cache.get(key) as number[] | undefined;
	if (existing) return existing;
	const placements: number[] = [];
	const place = (index: number, left: number, mask: number) => {
		if (left < 0 || left > unknown.length - index) return;
		if (left === 0) {
			placements.push(mask);
			return;
		}
		if (left === unknown.length - index) {
			for (let at = index; at < unknown.length; at++) mask |= 1 << unknown[at]!;
			placements.push(mask);
			return;
		}
		place(index + 1, left - 1, mask | (1 << unknown[index]!));
		place(index + 1, left, mask);
	};
	place(0, remaining, filled);
	cache.set(key, placements);
	return placements;
}

function validateClues(
	size: number,
	rows: readonly NonogramClue[][],
	columns: readonly NonogramClue[][]
) {
	if (
		!Number.isSafeInteger(size) ||
		size < 1 ||
		size > 15 ||
		rows.length !== size ||
		columns.length !== size
	)
		throw new RangeError('clues');
	if (
		[...rows, ...columns].some((clues) =>
			clues.some(
				({ length, colour }) =>
					!Number.isSafeInteger(length) ||
					length < 1 ||
					length > size ||
					!Number.isSafeInteger(colour) ||
					colour < 1 ||
					colour > 5
			)
		)
	)
		throw new RangeError('clues');
}

export function solveNonogramLines(
	size: number,
	rows: readonly NonogramClue[][],
	columns: readonly NonogramClue[][],
	known: readonly number[] = Array<number>(size * size).fill(-1),
	cache: PlacementCache = new Map(),
	rules: NonogramSolverRules = {}
): NonogramLineResult {
	validateClues(size, rows, columns);
	if (
		known.length !== size * size ||
		known.some((cell) => !Number.isSafeInteger(cell) || cell < -1 || cell > 5)
	)
		throw new RangeError('grid');
	if (
		(rules.hiddenRows && rules.hiddenRows.length !== size) ||
		(rules.hiddenColumns && rules.hiddenColumns.length !== size)
	)
		throw new RangeError('clues');
	const grid = known.slice();
	const order = Array.from({ length: 2 * size }, (_, index) => index);
	const opening = (index: number) => {
		const clues = (index < size ? rows : columns)[index % size]!;
		const required = clues.reduce(
			(sum, clue, at) =>
				sum + clue.length + Number(at > 0 && clue.colour === clues[at - 1]!.colour),
			0
		);
		return clues.length === 0 || required === size ? 0 : clues.length === 1 ? 1 : 2;
	};
	order.sort((a, b) => opening(a) - opening(b));
	let steps = 0;
	let changed: boolean;
	do {
		changed = false;
		for (const index of order) {
			const axis = Number(index >= size),
				line = index % size;
			// A hidden line has no constraints; its placements cannot force a cell.
			if ((axis === 0 ? rules.hiddenRows : rules.hiddenColumns)?.[line]) continue;
			const indices = Array.from({ length: size }, (_, offset) =>
				axis === 0 ? line * size + offset : offset * size + line
			);
			const clues = (axis === 0 ? rows : columns)[line]!;
			const values = indices.map((cell) => grid[cell]!);
			if (rules.totalsOnly) {
				const total = clues.reduce((sum, clue) => sum + clue.length, 0);
				const filled = values.filter((value) => value === 1).length;
				const unknown = values.filter((value) => value === -1).length;
				if (values.some((value) => value > 1) || filled > total || filled + unknown < total)
					return { grid, complete: false, contradiction: true, steps };
				// Totals placements have this exact intersection; avoid materializing C(15,7) masks.
				const forced = filled === total ? 0 : filled + unknown === total ? 1 : -1;
				for (let offset = 0; offset < size; offset++) {
					const cell = indices[offset]!;
					if (grid[cell] === -1 && forced !== -1) {
						grid[cell] = forced;
						steps++;
						changed = true;
					}
				}
				continue;
			}
			const placements = linePlacements(size, clues, values, cache);
			if (!placements.length) return { grid, complete: false, contradiction: true, steps };
			for (let offset = 0; offset < size; offset++) {
				const cell = indices[offset]!;
				const value = placements[0]![offset]!;
				if (grid[cell] === -1 && placements.every((placement) => placement[offset] === value)) {
					grid[cell] = value;
					steps++;
					changed = true;
				}
			}
		}
	} while (changed);
	return { grid, complete: !grid.includes(-1), contradiction: false, steps };
}

/** A bounded counting proof, stopping as soon as a second solution exists. */
export function countNonogramSolutions(
	size: number,
	rows: readonly NonogramClue[][],
	columns: readonly NonogramClue[][],
	cache: PlacementCache = new Map(),
	rules: NonogramSolverRules = {}
): number {
	validateClues(size, rows, columns);
	let count = 0;
	let nodes = 0;
	const colours =
		rules.totalsOnly || rules.hiddenRows || rules.hiddenColumns
			? [1]
			: [...new Set([...rows, ...columns].flat().map((clue) => clue.colour))];
	const visit = (known: number[]) => {
		if (count >= 2) return;
		// shortcut: 10,000 search nodes; raise only if a future accepted puzzle needs a deeper proof.
		if (++nodes > 10_000) throw new RangeError('solver_limit');
		const result = solveNonogramLines(size, rows, columns, known, cache, rules);
		if (result.contradiction) return;
		const cell = result.grid.indexOf(-1);
		if (cell === -1) {
			count++;
			return;
		}
		for (const value of [0, ...colours]) {
			const next = result.grid.slice();
			next[cell] = value;
			visit(next);
			if (count >= 2) return;
		}
	};
	visit(Array<number>(size * size).fill(-1));
	return count;
}

function picture(rng: Rng, size: number, colours: number) {
	const target = Math.floor((size * size * (50 + rng.nextInt(11))) / 100);
	const widths = Array.from({ length: size }, () => 1 + rng.nextInt(size));
	let count = widths.reduce((sum, width) => sum + width, 0);
	let cursor = rng.nextInt(size);
	while (count !== target) {
		const direction = count < target ? 1 : -1;
		if ((direction > 0 && widths[cursor]! < size) || (direction < 0 && widths[cursor]! > 1)) {
			widths[cursor]! += direction;
			count += direction;
		}
		cursor = (cursor + 1) % size;
	}
	const grid = Array<number>(size * size).fill(0);
	const right = rng.nextInt(2);
	for (let row = 0; row < size; row++) {
		const width = widths[row]!;
		// One shared edge gives the line solver an anchor, without skipping either fairness gate.
		const start = right ? size - width : 0;
		grid.fill(1, row * size + start, row * size + start + width);
	}
	// Keep colour runs above the grid so portrait clue gutters leave room for the cells.
	const transposed = rng.nextInt(2) !== 0 && colours === 1;
	return {
		grid: transposed
			? Array.from(
					{ length: size * size },
					(_, cell) => grid[(cell % size) * size + Math.floor(cell / size)]!
				)
			: grid,
		anchorAxis: transposed ? 0 : 1,
		anchorLine: right ? size - 1 : 0
	};
}

// The answer is a clue-derived proof cache, never part of an issued round or checkpoint.
const proofs = new WeakMap<NonogramClue[][], number[]>();
function proof(round: NonogramRound): number[] {
	const cached = proofs.get(round.rowClues);
	if (cached) return cached;
	const result = solveNonogramLines(
		round.size,
		round.rowClues,
		round.columnClues,
		undefined,
		undefined,
		nonogramSolverRules(round)
	);
	if (!result.complete || result.contradiction) throw new RangeError('clues');
	proofs.set(round.rowClues, result.grid);
	return result.grid;
}

export function createNonogramRound(seed: string, variant?: string): NonogramRound {
	const selected = parseNonogramVariant(variant);
	const rules: NonogramRound['rules'] = {
		colours: selected === 'nonogram:colour-2' ? 2 : selected === 'nonogram:colour-5' ? 5 : 1,
		checked: selected !== 'nonogram:unchecked' && selected !== 'nonogram:strict-count',
		timeLimit: selected === 'nonogram:countdown' ? 1800 : 0,
		hearts: selected === 'nonogram:three-hearts' ? 3 : 0,
		undo: selected !== 'nonogram:no-undo',
		hintLimit: selected === 'nonogram:hint-budget' ? 3 : 0,
		...(selected === 'nonogram:unchecked' ? { allDecided: true } : {}),
		...(selected === 'nonogram:strict-count' ? { strict: true } : {}),
		...(selected === 'nonogram:totals-only' ? { totalsOnly: true } : {})
	};
	const rng = createRng(seed);
	for (let bandIndex = rng.nextInt(NONOGRAM_BANDS.length); bandIndex >= 0; bandIndex--) {
		const { size, par } = NONOGRAM_BANDS[bandIndex]!;
		for (let attempt = 0; attempt < 100; attempt++) {
			const { grid: generated, anchorAxis, anchorLine } = picture(rng, size, rules.colours);
			if (rules.colours > 1) {
				const offset = rng.nextInt(rules.colours),
					direction = rng.nextInt(2) ? 1 : rules.colours - 1;
				for (let cell = 0; cell < generated.length; cell++)
					if (generated[cell]) {
						const line = Math.floor((Math.floor(cell / size) * rules.colours) / size);
						generated[cell] = 1 + ((offset + direction * line) % rules.colours);
					}
			}
			let { rowClues, columnClues } = deriveNonogramClues(generated, size);
			const hiddenRows = Array<boolean>(size).fill(false),
				hiddenColumns = Array<boolean>(size).fill(false);
			if (selected === 'nonogram:partial-clues') {
				const eligible = Array.from({ length: size }, (_, line) => line).filter(
					(line) => line !== anchorLine
				);
				for (const line of shuffle(rng, eligible).slice(0, Math.floor((2 * size) / 4)))
					(anchorAxis === 0 ? hiddenRows : hiddenColumns)[line] = true;
				rowClues = rowClues.map((clues, line) => (hiddenRows[line] ? [] : clues));
				columnClues = columnClues.map((clues, line) => (hiddenColumns[line] ? [] : clues));
			} else if (rules.totalsOnly) {
				const total = (clues: NonogramClue[]) => {
					const length = clues.reduce((sum, clue) => sum + clue.length, 0);
					return length ? [{ length, colour: 1 }] : [];
				};
				rowClues = rowClues.map(total);
				columnClues = columnClues.map(total);
			}
			const solverRules: NonogramSolverRules = {
				...(selected === 'nonogram:partial-clues' ? { hiddenRows, hiddenColumns } : {}),
				...(rules.totalsOnly ? { totalsOnly: true } : {})
			};
			const cache: PlacementCache = new Map();
			const solved = solveNonogramLines(size, rowClues, columnClues, undefined, cache, solverRules);
			if (!solved.complete || solved.contradiction || solved.steps === 0) continue;
			if (countNonogramSolutions(size, rowClues, columnClues, cache, solverRules) !== 1) continue;
			proofs.set(rowClues, solved.grid);
			return {
				seed,
				rules,
				...(selected !== 'nonogram:classic' ? { variant: selected } : {}),
				...(selected === 'nonogram:partial-clues' ? { hiddenRows, hiddenColumns } : {}),
				...(!rules.checked ? { reportedMistakes: [] } : {}),
				...(rules.timeLimit ? { timePenaltyMs: 0 } : {}),
				...(rules.hearts ? { hearts: rules.hearts } : {}),
				band: bandIndex + 1,
				size,
				par,
				rowClues,
				columnClues,
				cells: Array<number>(size * size).fill(0),
				filledCells: generated.filter((cell) => cell > 0).length,
				mistakes: 0,
				hintsUsed: 0,
				autoX: false,
				strokes: 0,
				lastAt: -1,
				lastCell: -1,
				strokeStart: -1,
				strokeMark: 0,
				strokeAxis: 0,
				strokeStopped: false,
				lastMistake: -1,
				lastHint: -1,
				checkCells: [],
				checkCount: 0,
				history: [],
				status: 'playing'
			};
		}
	}
	throw new RangeError('generation_exhausted');
}

export function nonogramLineSatisfied(
	cells: readonly number[],
	clues: readonly NonogramClue[],
	totalsOnly = false
): boolean {
	if (totalsOnly)
		return (
			cells.filter((cell) => cell > 0).length === clues.reduce((sum, clue) => sum + clue.length, 0)
		);
	return clueKey(deriveLineClues(cells.map((cell) => Math.max(0, cell)))) === clueKey(clues);
}
export function nonogramSolved(round: NonogramRound): boolean {
	if (round.rules.allDecided && round.cells.includes(0)) return false;
	for (let line = 0; line < round.size; line++) {
		if (
			!round.hiddenRows?.[line] &&
			!nonogramLineSatisfied(
				round.cells.slice(line * round.size, (line + 1) * round.size),
				round.rowClues[line]!,
				round.rules.totalsOnly
			)
		)
			return false;
		if (
			!round.hiddenColumns?.[line] &&
			!nonogramLineSatisfied(
				Array.from({ length: round.size }, (_, row) => round.cells[row * round.size + line]!),
				round.columnClues[line]!,
				round.rules.totalsOnly
			)
		)
			return false;
	}
	return true;
}
function autoCross(round: NonogramRound) {
	if (!round.autoX) return;
	for (let axis = 0; axis < 2; axis++) {
		for (let line = 0; line < round.size; line++) {
			if ((axis === 0 ? round.hiddenRows : round.hiddenColumns)?.[line]) continue;
			const indices = Array.from({ length: round.size }, (_, offset) =>
				axis === 0 ? line * round.size + offset : offset * round.size + line
			);
			if (
				nonogramLineSatisfied(
					indices.map((cell) => round.cells[cell]!),
					(axis === 0 ? round.rowClues : round.columnClues)[line]!,
					round.rules.totalsOnly
				)
			)
				for (const cell of indices) if (round.cells[cell] === 0) round.cells[cell] = -1;
		}
	}
}

export function nonogramRemainingMs(round: NonogramRound, at = round.lastAt): number {
	return Math.max(0, round.rules.timeLimit * 1000 - Math.max(0, at) - (round.timePenaltyMs ?? 0));
}

/** Each stroke has one axis and mark; helper actions use cell -1 and a fresh stroke. */
export function applyNonogramMove(round: NonogramRound, move: NonogramMove): NonogramRound {
	const { cell, mark, stroke, at } = move;
	const action = mark >= NONOGRAM_ACTION.undo;
	if (
		round.status !== 'playing' ||
		![cell, mark, stroke, at].every(Number.isSafeInteger) ||
		at < 0 ||
		at < round.lastAt ||
		at > 7_200_000 ||
		stroke < 0 ||
		stroke > round.strokes ||
		(action
			? cell !== -1 ||
				mark > NONOGRAM_ACTION.tick ||
				(mark === NONOGRAM_ACTION.tick && !round.rules.timeLimit) ||
				stroke !== round.strokes
			: cell < 0 || cell >= round.cells.length || mark < -1 || mark > round.rules.colours)
	)
		throw new RangeError('move');
	const starting = stroke === round.strokes;
	if (!starting) {
		if (
			stroke !== round.strokes - 1 ||
			round.strokeStopped ||
			action ||
			mark !== round.strokeMark ||
			cell === round.lastCell
		)
			throw new RangeError('stroke');
		const row = Math.floor(cell / round.size),
			column = cell % round.size;
		const previousRow = Math.floor(round.lastCell / round.size),
			previousColumn = round.lastCell % round.size;
		if (
			Math.abs(row - previousRow) + Math.abs(column - previousColumn) !== 1 ||
			(round.strokeAxis === 1 && row !== Math.floor(round.strokeStart / round.size)) ||
			(round.strokeAxis === 2 && column !== round.strokeStart % round.size)
		)
			throw new RangeError('stroke');
	}
	const next: NonogramRound = {
		...round,
		cells: round.cells.slice(),
		history: round.history.slice(),
		lastAt: at,
		lastMistake: -1,
		lastHint: -1,
		checkCells: [],
		checkCount: 0,
		...(round.reportedMistakes ? { reportedMistakes: round.reportedMistakes.slice() } : {})
	};
	if (starting) {
		next.strokes++;
		next.strokeStart = cell;
		next.strokeMark = mark;
		next.strokeAxis = 0;
		next.strokeStopped = action;
		if (
			!action ||
			mark === NONOGRAM_ACTION.hint ||
			mark === NONOGRAM_ACTION.autoXOff ||
			mark === NONOGRAM_ACTION.autoXOn
		)
			next.history.push({ cells: round.cells.slice(), autoX: round.autoX });
	} else if (next.strokeAxis === 0) {
		next.strokeAxis =
			Math.floor(cell / round.size) === Math.floor(round.lastCell / round.size) ? 1 : 2;
	}
	next.lastCell = cell;
	if (round.rules.timeLimit && nonogramRemainingMs(next) === 0) {
		next.status = 'lost';
		return next;
	}
	if (!action) {
		if (next.reportedMistakes && next.cells[cell] !== mark)
			next.reportedMistakes = next.reportedMistakes.filter((position) => position !== cell);
		if (round.rules.checked && mark > 0 && proof(round)[cell] !== mark) {
			next.mistakes++;
			next.lastMistake = cell;
			next.strokeStopped = true;
			if (round.rules.timeLimit)
				next.timePenaltyMs =
					(round.timePenaltyMs ?? 0) +
					(next.mistakes === 1 ? 120_000 : next.mistakes === 2 ? 240_000 : 480_000);
			if (round.rules.hearts) next.hearts = (round.hearts ?? round.rules.hearts) - 1;
		} else next.cells[cell] = mark;
	} else if (mark === NONOGRAM_ACTION.undo) {
		if (!round.rules.undo || !next.history.length) throw new RangeError('undo');
		const previous = next.history.pop()!;
		next.cells = previous.cells.slice();
		next.autoX = previous.autoX;
	} else if (mark === NONOGRAM_ACTION.check) {
		const answer = proof(round);
		const wrong = next.cells.flatMap((value, index) =>
			value > 0 && value !== answer[index] ? [index] : []
		);
		next.checkCells = round.rules.strict ? [] : wrong;
		next.checkCount = wrong.length;
		if (!round.rules.checked) {
			next.mistakes += wrong.filter(
				(position) => !round.reportedMistakes?.includes(position)
			).length;
			next.reportedMistakes = next.cells.flatMap((value, index) => (value > 0 ? [index] : []));
		}
	} else if (mark === NONOGRAM_ACTION.hint) {
		if (round.rules.hintLimit > 0 && round.hintsUsed >= round.rules.hintLimit)
			throw new RangeError('hint_limit');
		const answer = proof(round);
		const known = round.cells.map((value, index) =>
			value === 0 || Math.max(0, value) !== answer[index] ? -1 : Math.max(0, value)
		);
		const deduced = solveNonogramLines(
			round.size,
			round.rowClues,
			round.columnClues,
			known,
			undefined,
			nonogramSolverRules(round)
		);
		const forced = deduced.grid.findIndex(
			(value, index) =>
				value !== -1 && (value > 0 ? round.cells[index] !== value : round.cells[index] !== -1)
		);
		if (forced === -1) throw new RangeError('hint');
		next.cells[forced] = deduced.grid[forced] === 0 ? -1 : deduced.grid[forced]!;
		next.lastHint = forced;
		next.hintsUsed++;
	} else if (mark === NONOGRAM_ACTION.autoXOff || mark === NONOGRAM_ACTION.autoXOn) {
		next.autoX = mark === NONOGRAM_ACTION.autoXOn;
	} else if (mark === NONOGRAM_ACTION.restart) {
		// Restart preserves the puzzle and spent penalties in the same replayed attempt.
		next.cells.fill(0);
		next.history = [];
		if (next.reportedMistakes) next.reportedMistakes = [];
	}
	autoCross(next);
	if (
		(round.rules.timeLimit && nonogramRemainingMs(next) === 0) ||
		(round.rules.hearts && next.hearts === 0)
	)
		next.status = 'lost';
	else if (nonogramSolved(next)) next.status = 'won';
	return next;
}

export function nonogramScore(
	round: NonogramRound,
	seconds: number,
	scoring: ScoreValues = scoringDefinition.defaults
): number {
	if (!Number.isSafeInteger(seconds) || seconds < 0) throw new RangeError('elapsed');
	if (round.status !== 'won') return 0;
	if (round.rules.timeLimit && nonogramRemainingMs(round, seconds * 1000) === 0)
		throw new RangeError('timeout');
	return Math.max(
		0,
		scoring.completion! +
			round.filledCells * scoring.cell! +
			Math.max(0, round.par - seconds) * scoring.second! -
			round.mistakes * scoring.mistake! -
			round.hintsUsed * scoring.hint! +
			(round.rules.timeLimit
				? Math.floor(nonogramRemainingMs(round, seconds * 1000) / 1000) * scoring.countdown!
				: 0) +
			(round.rules.hearts ? (round.hearts ?? 0) * scoring.heart! : 0)
	);
}
