import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { createRng, shuffle, type Rng } from '../../engine/rng.js';
import { scoring } from './scoring.js';

export const SUDOKU_ENGINE_VERSION = 'sudoku-1';
export const SUDOKU_MAX_MOVES = 10000;
export const SUDOKU_COUNTDOWN = 600;
export interface SudokuMove extends Move {
	action: number;
	cell: number;
	value: number;
}
type SudokuGrade = 'easy' | 'medium' | 'hard';
type Snapshot = { cells: number[]; notes: number[] };
export interface SudokuRound extends SudokuGeometry {
	seed: string;
	variant: string;
	rules: ReturnType<typeof encodeRules>;
	grade: SudokuGrade;
	givens: number[];
	solution: number[];
	cells: number[];
	notes: number[];
	history: Snapshot[];
	mistakes: number;
	hints: number;
	restarts: number;
	loggedMoves: number;
	hintUsedSession: boolean;
	status: 'playing' | 'won' | 'lost' | 'timeout';
}
export const SUDOKU_VARIANTS = [
	'sudoku:classic',
	'sudoku:diagonal',
	'sudoku:irregular',
	'sudoku:killer',
	'sudoku:thermo',
	'sudoku:anti-knight',
	'sudoku:kropki',
	'sudoku:countdown-600',
	'sudoku:no-hint',
	'sudoku:odd-even',
	'sudoku:xv'
] as const;
type SudokuVariant = (typeof SUDOKU_VARIANTS)[number];
export function parseSudokuVariant(variant = 'sudoku:classic'): SudokuVariant {
	const preset = SUDOKU_VARIANTS.find((id) => id === variant);
	if (!preset) throw new RangeError('variant');
	return preset;
}

export function encodeRules(variant?: string) {
	variant = parseSudokuVariant(variant);
	return {
		region: Number(variant === 'sudoku:irregular'),
		diagonal: Number(variant === 'sudoku:diagonal'),
		hyper: 0,
		antiKnight: Number(variant === 'sudoku:anti-knight'),
		antiKing: 0,
		nonConsecutive: 0,
		killer: Number(variant === 'sudoku:killer'),
		line: Number(variant === 'sudoku:thermo'),
		outside: 0,
		adjacent: variant === 'sudoku:kropki' ? 1 : variant === 'sudoku:xv' ? 2 : 0,
		parity: Number(variant === 'sudoku:odd-even'),
		clone: 0,
		clue: 0,
		mistake: 0,
		hint: variant === 'sudoku:no-hint' ? 2 : 0,
		timing: Number(variant === 'sudoku:countdown-600')
	};
}
const regions = classicRegions();
const units = geometryUnits(regions, false);
const classic: SudokuGeometry = {
	regions,
	units,
	peers: geometryPeers(units, false),
	cages: [],
	thermos: [],
	marks: [],
	parity: Array<number>(81).fill(0)
};
export function candidateMask(cells: number[], cell: number): number {
	return entryMask(cells, cell, classic);
}
export function countSolutions(board: number[], limit = 2): number {
	return countGeometrySolutions(board, classic, limit);
}
export function logicSolvable(board: number[], easyOnly = false): boolean {
	return geometryLogicSolvable(board, classic, easyOnly);
}
export function createSudokuRound(
	seed: string,
	variant = 'sudoku:classic',
	diagnostics: SudokuDiagnostics = {
		nodes: 0,
		rejectedUniqueness: 0,
		rejectedLogic: 0,
		rejectedEasy: 0,
		rejectedStructure: 0
	}
): SudokuRound {
	const rules = encodeRules(variant);
	const candidate = generateGeometryCandidate(seed, variant, diagnostics);
	if (!candidate) throw new RangeError('generation');
	const { solution, givens, geometry, grade } = candidate;
	return {
		seed,
		variant,
		rules,
		grade,
		...geometry,
		givens,
		solution,
		cells: givens.slice(),
		notes: Array<number>(81).fill(0),
		history: [],
		mistakes: 0,
		hints: 0,
		restarts: 0,
		loggedMoves: 0,
		hintUsedSession: false,
		status: 'playing'
	};
}
export function dailySeedOk(seed: string, variant?: string): boolean {
	try {
		return createSudokuRound(seed, variant).grade === 'easy';
	} catch {
		return false;
	}
}
export function applySudokuMove(
	round: SudokuRound,
	move: SudokuMove,
	values: ScoreValues = scoring.defaults
): SudokuRound {
	const { action, cell, value } = move;
	if (
		round.status !== 'playing' ||
		![action, cell, value].every(Number.isSafeInteger) ||
		action < 0 ||
		action > 7 ||
		cell < 0 ||
		cell > 80 ||
		round.loggedMoves >= SUDOKU_MAX_MOVES
	)
		throw new RangeError('move');
	if (action >= 3 && (cell !== 0 || value !== 0)) throw new RangeError('move');
	if (round.loggedMoves === SUDOKU_MAX_MOVES - 1 && action !== 0 && action !== 5)
		throw new RangeError('moves');
	const next: SudokuRound = {
		...round,
		cells: round.cells.slice(),
		notes: round.notes.slice(),
		history: round.history.slice(),
		loggedMoves: round.loggedMoves + 1
	};
	if (action <= 2) {
		if (round.givens[cell]) throw new RangeError('given');
		if ((action === 1 && value !== 0) || (action !== 1 && (value < 1 || value > 9)))
			throw new RangeError('move');
		if (action === 0 && round.cells[cell] === value) return round;
		if (action === 0 && !(entryMask(round.cells, cell, round) & (1 << value)))
			throw new RangeError('conflict');
		if (action === 2 && round.cells[cell]) throw new RangeError('move');
		if (action === 1 && !round.cells[cell] && !round.notes[cell]) throw new RangeError('move');
		next.history.push({ cells: round.cells, notes: round.notes });
		if (action === 2) next.notes[cell] = next.notes[cell]! ^ (1 << value);
		else {
			next.cells[cell] = action === 0 ? value : 0;
			next.notes[cell] = 0;
		}
		if (action === 0) {
			cleanNotes(next, cell, value);
			if (value !== round.solution[cell]) next.mistakes++;
		}
	} else if (action === 3) {
		const previous = next.history.pop();
		if (!previous) throw new RangeError('move');
		next.cells = previous.cells;
		next.notes = previous.notes;
	} else if (action === 4) {
		if (round.rules.hint === 2 || (values.hintCap! > 0 && next.hints >= values.hintCap!))
			throw new RangeError('hint');
		const hint = geometryHint(next.cells, next.solution, round);
		if (!hint) throw new RangeError('hint');
		next.history.push({ cells: round.cells, notes: round.notes });
		for (const blocker of hint.cleared) {
			next.cells[blocker] = 0;
			next.notes[blocker] = 0;
		}
		next.cells[hint.cell] = next.solution[hint.cell]!;
		next.notes[hint.cell] = 0;
		cleanNotes(next, hint.cell, next.solution[hint.cell]!);
		next.hints++;
		next.hintUsedSession = true;
	} else if (action === 5) {
		if (!round.rules.timing) throw new RangeError('timeout');
		next.status = 'timeout';
	} else if (action === 6) {
		next.cells = round.givens.slice();
		next.notes.fill(0);
		next.history = [];
		next.restarts++;
	} else {
		next.history.push({ cells: round.cells, notes: round.notes });
		for (let i = 0; i < 81; i++)
			if (!next.cells[i]) next.notes[i] = geometryCandidates(next.cells, i, round);
	}
	if (values.mistakeLimit! > 0 && next.mistakes >= values.mistakeLimit!) next.status = 'lost';
	else if (next.cells.every((v, i) => v === next.solution[i])) next.status = 'won';
	if (next.loggedMoves === SUDOKU_MAX_MOVES && (next.status === 'playing' || action === 4))
		throw new RangeError('moves');
	return next;
}
export function canEndSudoku(round: SudokuRound, values: ScoreValues = scoring.defaults): boolean {
	if (round.rules.timing) return true;
	const incorrect = round.cells.reduce((n, v, i) => n + Number(v !== round.solution[i]), 0);
	for (let cell = 0; cell < 81; cell++)
		if (!round.givens[cell]) {
			const mask = entryMask(round.cells, cell, round);
			for (let value = 1; value <= 9; value++)
				if (value !== round.cells[cell] && mask & (1 << value)) {
					if (value === round.solution[cell] && incorrect === 1) return true;
					if (
						value !== round.solution[cell] &&
						values.mistakeLimit! > 0 &&
						round.mistakes + 1 >= values.mistakeLimit!
					)
						return true;
				}
		}
	return false;
}
export function sudokuScore(
	round: SudokuRound,
	seconds: number,
	values: ScoreValues = scoring.defaults
): number {
	if (!Number.isSafeInteger(seconds) || seconds < 0) throw new RangeError('elapsed');
	if (round.status !== 'won') return 0;
	const base = round.rules.timing
		? values.completion! + values.countdown! * Math.max(0, SUDOKU_COUNTDOWN - seconds)
		: Math.max(values.floor!, values.completion! - values.second! * seconds);
	return Math.max(
		0,
		base -
			values.hint! * round.hints -
			values.mistake! * round.mistakes -
			values.restart! * round.restarts
	);
}
export interface SudokuGeometry {
	regions: number[];
	units: number[][];
	peers: number[][];
	cages: { cells: number[]; sum: number }[];
	thermos: number[][];
	marks: { cells: [number, number]; kind: 'white' | 'black' | 'X' | 'V' }[];
	parity: number[];
}
export function geometryPeers(units: number[][], antiKnight: boolean): number[][] {
	return Array.from({ length: 81 }, (_, cell) => {
		const set = new Set(units.filter((u) => u.includes(cell)).flat());
		if (antiKnight) {
			const r = Math.floor(cell / 9),
				c = cell % 9;
			for (const [dr, dc] of [
				[-2, -1],
				[-2, 1],
				[-1, -2],
				[-1, 2],
				[1, -2],
				[1, 2],
				[2, -1],
				[2, 1]
			]) {
				const row = r + dr!,
					column = c + dc!;
				if (row >= 0 && row < 9 && column >= 0 && column < 9) set.add(row * 9 + column);
			}
		}
		set.delete(cell);
		return [...set];
	});
}
function related(a: number, b: number, kind: 'white' | 'black' | 'X' | 'V'): boolean {
	return kind === 'white'
		? Math.abs(a - b) === 1
		: kind === 'black'
			? a === 2 * b || b === 2 * a
			: a + b === (kind === 'X' ? 10 : 5);
}
export function geometryCandidates(
	cells: number[],
	cell: number,
	geometry: SudokuGeometry
): number {
	let mask = 0x3fe;
	for (const peer of geometry.peers[cell]!) mask &= ~(1 << cells[peer]!);
	if (geometry.parity[cell])
		for (let d = 1; d <= 9; d++) if ((d % 2 ? 1 : 2) !== geometry.parity[cell]) mask &= ~(1 << d);
	for (const thermo of geometry.thermos) {
		const index = thermo.indexOf(cell);
		if (index < 0) continue;
		for (let d = 1; d <= 9; d++) {
			if (
				d <= index ||
				d > 9 - (thermo.length - 1 - index) ||
				thermo.some(
					(p, i) =>
						cells[p] &&
						(i < index
							? cells[p]! >= d - (index - i - 1)
							: i > index && cells[p]! <= d + (i - index - 1))
				)
			)
				mask &= ~(1 << d);
		}
	}
	for (const mark of geometry.marks) {
		const [a, b] = mark.cells;
		if (cell !== a && cell !== b) continue;
		const other = cells[cell === a ? b : a]!;
		if (other) for (let d = 1; d <= 9; d++) if (!related(d, other, mark.kind)) mask &= ~(1 << d);
	}
	for (const cage of geometry.cages)
		if (cage.cells.includes(cell)) {
			const used = cage.cells.reduce((sum, i) => sum + (i === cell ? 0 : cells[i]!), 0);
			const remaining = cage.cells.filter((i) => i !== cell && !cells[i]).length;
			for (let d = 1; d <= 9; d++) {
				if (cage.cells.some((i) => i !== cell && cells[i] === d)) {
					mask &= ~(1 << d);
					continue;
				}
				const available = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
					(n) => n !== d && !cage.cells.some((i) => i !== cell && cells[i] === n)
				);
				function possible(start: number, left: number, sum: number): boolean {
					if (!left) return sum === cage.sum;
					for (let i = start; i <= available.length - left; i++)
						if (possible(i + 1, left - 1, sum + available[i]!)) return true;
					return false;
				}
				if (!possible(0, remaining, used + d)) mask &= ~(1 << d);
			}
		}
	return mask;
}
export interface SudokuDiagnostics {
	nodes: number;
	rejectedUniqueness: number;
	rejectedLogic: number;
	rejectedEasy: number;
	rejectedStructure: number;
}
export function validGeometryGivens(board: number[], geometry: SudokuGeometry): boolean {
	if (board.length !== 81 || board.some((v) => !Number.isSafeInteger(v) || v < 0 || v > 9))
		return false;
	const cells = board.slice();
	for (let i = 0; i < 81; i++)
		if (cells[i]) {
			const value = cells[i]!;
			cells[i] = 0;
			const valid = Boolean(geometryCandidates(cells, i, geometry) & (1 << value));
			cells[i] = value;
			if (!valid) return false;
		}
	return true;
}
export function countGeometrySolutions(
	board: number[],
	geometry: SudokuGeometry,
	limit = 2,
	diagnostics?: SudokuDiagnostics
): number {
	if (!validGeometryGivens(board, geometry)) return 0;
	const cells = board.slice();
	let count = 0,
		nodes = 0;
	function search(): void {
		if (++nodes > 200000) {
			count = -1;
			return;
		}
		if (diagnostics) diagnostics.nodes++;
		let best = -1,
			chosen = 0,
			width = 10;
		for (let i = 0; i < 81; i++)
			if (!cells[i]) {
				const mask = geometryCandidates(cells, i, geometry);
				let n = 0;
				for (let d = 1; d <= 9; d++) if (mask & (1 << d)) n++;
				if (n < width) {
					best = i;
					chosen = mask;
					width = n;
					if (n <= 1) break;
				}
			}
		if (best < 0) {
			count++;
			return;
		}
		for (let d = 1; d <= 9 && count >= 0 && count < limit; d++)
			if (chosen & (1 << d)) {
				cells[best] = d;
				search();
				cells[best] = 0;
			}
	}
	search();
	return count;
}
export function geometryDomains(
	cells: number[],
	geometry: SudokuGeometry,
	previous?: number[]
): number[] {
	const domains = cells.map((value, i) =>
		value ? 1 << value : geometryCandidates(cells, i, geometry) & (previous?.[i] ?? 0x3fe)
	);
	let changed = true;
	const restrict = (cell: number, mask: number) => {
		const old = domains[cell]!;
		domains[cell] = old & mask;
		if (old !== domains[cell]) changed = true;
	};
	while (changed) {
		changed = false;
		for (let i = 0; i < 81; i++)
			if (domains[i] && !(domains[i]! & (domains[i]! - 1)))
				for (const p of geometry.peers[i]!) if (!cells[p]) restrict(p, ~domains[i]!);
		function arc(a: number, b: number, test: (x: number, y: number) => boolean): void {
			let aMask = 0,
				bMask = 0;
			for (let x = 1; x <= 9; x++)
				if (domains[a]! & (1 << x))
					for (let y = 1; y <= 9; y++)
						if (domains[b]! & (1 << y) && test(x, y)) {
							aMask |= 1 << x;
							bMask |= 1 << y;
						}
			restrict(a, aMask);
			restrict(b, bMask);
		}
		for (const mark of geometry.marks)
			arc(mark.cells[0], mark.cells[1], (a, b) => related(a, b, mark.kind));
		for (const thermo of geometry.thermos)
			for (let i = 0; i < thermo.length - 1; i++) arc(thermo[i]!, thermo[i + 1]!, (a, b) => a < b);
		for (const cage of geometry.cages) {
			const allowed = cage.cells.map(() => 0);
			function enumerate(index: number, sum: number, used: number, digits: number[]): void {
				if (index === cage.cells.length) {
					if (sum === cage.sum)
						digits.forEach((d, i) => {
							allowed[i] = allowed[i]! | (1 << d);
						});
					return;
				}
				for (let d = 1; d <= 9; d++)
					if (domains[cage.cells[index]!]! & (1 << d) && !(used & (1 << d)) && sum + d <= cage.sum)
						enumerate(index + 1, sum + d, used | (1 << d), [...digits, d]);
			}
			enumerate(0, 0, 0, []);
			cage.cells.forEach((cell, i) => restrict(cell, allowed[i]!));
		}
	}
	return domains;
}
export function geometryUnits(regions: number[], diagonal: boolean): number[][] {
	const rows = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => 9 * r + c));
	const columns = Array.from({ length: 9 }, (_, c) =>
		Array.from({ length: 9 }, (_, r) => 9 * r + c)
	);
	const groups = Array.from({ length: 9 }, (_, region) =>
		Array.from({ length: 81 }, (_, i) => i).filter((i) => regions[i] === region)
	);
	return diagonal
		? [
				...rows,
				...columns,
				...groups,
				Array.from({ length: 9 }, (_, i) => i * 10),
				Array.from({ length: 9 }, (_, i) => (i + 1) * 8)
			]
		: [...rows, ...columns, ...groups];
}
export function classicRegions(): number[] {
	return Array.from({ length: 81 }, (_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));
}
// Two border cells are exchanged; both affected nine-cell regions stay connected.
export function irregularRegions(): number[] {
	const regions = classicRegions();
	[regions[20], regions[27]] = [regions[27]!, regions[20]!];
	return regions;
}
function transformedRegions(regions: number[], transform: number): number[] {
	const result = Array<number>(81);
	for (let i = 0; i < 81; i++) {
		let r = Math.floor(i / 9),
			c = i % 9;
		if (transform >= 4) c = 8 - c;
		for (let turn = 0; turn < transform % 4; turn++) [r, c] = [c, 8 - r];
		result[r * 9 + c] = regions[i]!;
	}
	return result;
}
function fillGeometry(
	rng: Rng,
	geometry: SudokuGeometry,
	nodeLimit = 200000,
	diagnostics?: SudokuDiagnostics
): number[] | null {
	const cells = Array<number>(81).fill(0);
	// The complete grid is filled before clues are drawn, so only peers constrain it.
	const masks = Array<number>(81).fill(0x3fe);
	let nodes = 0;
	function fill(): boolean {
		if (++nodes > nodeLimit) return false;
		if (diagnostics) diagnostics.nodes++;
		let best = -1,
			mask = 0,
			count = 10;
		for (let i = 0; i < 81; i++)
			if (!cells[i]) {
				const m = masks[i]!;
				let n = 0;
				for (let d = 1; d <= 9; d++) if (m & (1 << d)) n++;
				if (n < count) {
					best = i;
					mask = m;
					count = n;
					if (n <= 1) break;
				}
			}
		if (best === -1) return true;
		for (const d of shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]))
			if (mask & (1 << d)) {
				cells[best] = d;
				const bit = 1 << d;
				const changed = [];
				for (const peer of geometry.peers[best]!) {
					if (cells[peer] || !(masks[peer]! & bit)) continue;
					masks[peer] = masks[peer]! & ~bit;
					changed.push(peer);
				}
				if (fill()) return true;
				for (const peer of changed) masks[peer] = masks[peer]! | bit;
				cells[best] = 0;
			}
		return false;
	}
	return fill() ? cells : null;
}
export function decorateGeometry(
	rng: Rng,
	variant: string,
	solution: number[],
	geometry: SudokuGeometry
): boolean {
	const adjacent = (cell: number) =>
		[
			cell - 9,
			cell + 9,
			...(cell % 9 ? [cell - 1] : []),
			...(cell % 9 < 8 ? [cell + 1] : [])
		].filter((i) => i >= 0 && i < 81);
	if (variant === 'sudoku:odd-even') {
		for (const cell of shuffle(
			rng,
			Array.from({ length: 81 }, (_, i) => i)
		).slice(0, 30))
			geometry.parity[cell] = solution[cell]! % 2 ? 1 : 2;
	}
	if (variant === 'sudoku:kropki' || variant === 'sudoku:xv') {
		const edges: SudokuGeometry['marks'] = [];
		for (let cell = 0; cell < 81; cell++)
			for (const other of adjacent(cell))
				if (other > cell) {
					const a = solution[cell]!,
						b = solution[other]!;
					if (variant === 'sudoku:kropki') {
						if (Math.abs(a - b) === 1) edges.push({ cells: [cell, other], kind: 'white' });
						else if (a === 2 * b || b === 2 * a)
							edges.push({ cells: [cell, other], kind: 'black' });
					} else if (a + b === 10 || a + b === 5)
						edges.push({ cells: [cell, other], kind: a + b === 10 ? 'X' : 'V' });
				}
		geometry.marks = shuffle(rng, edges).slice(0, 20);
		return geometry.marks.length > 0;
	}
	if (variant === 'sudoku:thermo') {
		for (const start of shuffle(
			rng,
			Array.from({ length: 81 }, (_, i) => i)
		)) {
			const path = [start];
			while (path.length < 4) {
				const options = adjacent(path[path.length - 1]!).filter(
					(i) => !path.includes(i) && solution[i]! > solution[path[path.length - 1]!]!
				);
				if (!options.length) break;
				path.push(options[rng.nextInt(options.length)]!);
			}
			if (path.length >= 3) geometry.thermos.push(path);
			if (geometry.thermos.length === 5) break;
		}
		return geometry.thermos.length > 0;
	}
	if (variant === 'sudoku:killer') {
		const cages: SudokuGeometry['cages'] = [];
		for (let row = 0; row < 9; row++) {
			const sizes = shuffle(
				rng,
				[
					[2, 3, 4],
					[3, 3, 3],
					[2, 2, 2, 3]
				][rng.nextInt(3)]!
			);
			let column = 0;
			for (const size of sizes) {
				const cells = Array.from({ length: size }, (_, i) => row * 9 + column + i);
				cages.push({ cells, sum: cells.reduce((sum, i) => sum + solution[i]!, 0) });
				column += size;
			}
		}
		geometry.cages = cages;
	}
	return true;
}
// Relax each extra rule or clue to check that it affects the solution.
export function geometryHasLoadBearingClue(
	givens: number[],
	geometry: SudokuGeometry,
	variant: string,
	diagnostics?: SudokuDiagnostics
): boolean {
	const relaxed = (changes: Partial<SudokuGeometry>) => ({ ...geometry, ...changes });
	if (
		variant === 'sudoku:diagonal' ||
		variant === 'sudoku:irregular' ||
		variant === 'sudoku:anti-knight'
	) {
		const units =
			variant === 'sudoku:diagonal'
				? geometry.units.slice(0, 27)
				: variant === 'sudoku:irregular'
					? geometry.units.slice(0, 18)
					: geometry.units;
		return (
			countGeometrySolutions(
				givens,
				relaxed({ units, peers: geometryPeers(units, false) }),
				2,
				diagnostics
			) > 1
		);
	}
	if (variant === 'sudoku:kropki' || variant === 'sudoku:xv')
		return geometry.marks.some(
			(_, i) =>
				countGeometrySolutions(
					givens,
					relaxed({ marks: geometry.marks.filter((_, j) => i !== j) }),
					2,
					diagnostics
				) > 1
		);
	if (variant === 'sudoku:thermo')
		return geometry.thermos.some(
			(_, i) =>
				countGeometrySolutions(
					givens,
					relaxed({ thermos: geometry.thermos.filter((_, j) => i !== j) }),
					2,
					diagnostics
				) > 1
		);
	// Cage sums partition the board's total, so removing just one sum leaves it implied.
	if (variant === 'sudoku:killer')
		return (
			countGeometrySolutions(
				givens,
				relaxed({ cages: [], peers: geometryPeers(geometry.units, false) }),
				2,
				diagnostics
			) > 1
		);
	if (variant === 'sudoku:odd-even')
		return geometry.parity.some((mark, i) => {
			if (!mark) return false;
			const parity = geometry.parity.slice();
			parity[i] = 0;
			return countGeometrySolutions(givens, relaxed({ parity }), 2, diagnostics) > 1;
		});
	return true;
}

export function generateGeometryCandidate(
	seed: string,
	variant: string,
	diagnostics: SudokuDiagnostics
): {
	solution: number[];
	givens: number[];
	geometry: SudokuGeometry;
	grade: SudokuGrade;
} | null {
	const rng = createRng(seed);
	for (let attempt = 0; attempt < 100; attempt++) {
		const regions =
			variant === 'sudoku:irregular'
				? transformedRegions(irregularRegions(), rng.nextInt(8))
				: classicRegions();
		const units = geometryUnits(regions, variant === 'sudoku:diagonal');
		const geometry: SudokuGeometry = {
			regions,
			units,
			peers: geometryPeers(units, variant === 'sudoku:anti-knight'),
			cages: [],
			thermos: [],
			marks: [],
			parity: Array<number>(81).fill(0)
		};
		const solution = fillGeometry(rng, geometry, 200000, diagnostics);
		if (!solution || !decorateGeometry(rng, variant, solution, geometry)) {
			diagnostics.rejectedStructure++;
			continue;
		}
		geometry.peers = cagePeers(geometry.peers, geometry.cages);
		const givens = solution.slice();
		if (variant === 'sudoku:killer') {
			const rectangles: number[][] = [];
			for (let r1 = 0; r1 < 9; r1++)
				for (let r2 = r1 + 1; r2 < 9; r2++)
					for (let c1 = 0; c1 < 9; c1++)
						for (let c2 = c1 + 1; c2 < 9; c2++) {
							const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
							if (
								solution[cells[0]!] === solution[cells[3]!] &&
								solution[cells[1]!] === solution[cells[2]!] &&
								(Math.floor(r1 / 3) === Math.floor(r2 / 3) ||
									Math.floor(c1 / 3) === Math.floor(c2 / 3))
							)
								rectangles.push(cells);
						}
			let found = false;
			for (const cells of shuffle(rng, rectangles)) {
				for (const cell of cells) givens[cell] = 0;
				if (
					countGeometrySolutions(givens, geometry, 2, diagnostics) === 1 &&
					geometryHasLoadBearingClue(givens, geometry, variant, diagnostics)
				) {
					found = true;
					break;
				}
				for (const cell of cells) givens[cell] = solution[cell]!;
			}
			if (!found) {
				diagnostics.rejectedStructure++;
				continue;
			}
		}
		for (const cell of shuffle(
			rng,
			Array.from({ length: 81 }, (_, i) => i)
		)) {
			if (givens.filter(Boolean).length <= (variant === 'sudoku:killer' ? 34 : 40)) break;
			if (!givens[cell]) continue;
			givens[cell] = 0;
			if (countGeometrySolutions(givens, geometry, 2, diagnostics) !== 1) {
				diagnostics.rejectedUniqueness++;
				givens[cell] = solution[cell]!;
			}
		}
		if (
			givens.every(Boolean) ||
			!geometryHasLoadBearingClue(givens, geometry, variant, diagnostics)
		) {
			diagnostics.rejectedStructure++;
			continue;
		}
		const grade = logicalGrade(givens, geometry);
		if (!grade) {
			diagnostics.rejectedLogic++;
			continue;
		}
		return { solution, givens, geometry, grade };
	}
	return null;
}

export function geometryLogicSolvable(board: number[], geometry: SudokuGeometry, easyOnly = false) {
	return logicalGrade(board, geometry, easyOnly) !== null;
}

function logicalGrade(
	board: number[],
	geometry: SudokuGeometry,
	easyOnly = false
): SudokuGrade | null {
	if (!validGeometryGivens(board, geometry)) return null;
	const cells = board.slice();
	let grade: SudokuGrade = 'easy';
	let masks = geometryDomains(cells, geometry);
	const units = geometry.units;
	const peers = geometry.peers;
	const bits = (mask: number) => {
		let n = 0;
		while (mask) {
			mask &= mask - 1;
			n++;
		}
		return n;
	};
	const remove = (i: number, mask: number) => {
		const before = masks[i]!;
		masks[i] = before & ~mask;
		return before !== masks[i];
	};
	while (cells.includes(0)) {
		masks = geometryDomains(cells, geometry, masks);
		let changed = false;
		for (let i = 0; i < 81; i++)
			if (!cells[i] && bits(masks[i]!) === 1) {
				let digit = 1;
				while (!(masks[i]! & (1 << digit))) digit++;
				cells[i] = digit;
				masks[i] = 1 << digit;
				for (const peer of peers[i]!) if (!cells[peer]) remove(peer, 1 << digit);
				changed = true;
				break;
			}
		if (changed) continue;
		if (cells.some((v, i) => !v && !masks[i])) return null;
		for (const unit of units) {
			for (let d = 1; d <= 9; d++) {
				if (unit.some((i) => cells[i] === d)) continue;
				const options = unit.filter((i) => masks[i]! & (1 << d));
				if (!options.length) return null;
				if (options.length === 1) {
					masks[options[0]!] = 1 << d;
					changed = true;
					break;
				}
				for (const other of units)
					if (other !== unit && options.every((i) => other.includes(i))) {
						for (const i of other) if (!unit.includes(i)) changed = remove(i, 1 << d) || changed;
					}
			}
			if (changed) break;
		}
		if (changed) continue;
		if (easyOnly) return null;
		// Naked and hidden pairs and triples.
		for (const unit of units) {
			const empty = unit.filter((i) => !cells[i]);
			for (let size = 2; size <= 3 && !changed; size++) {
				function combinations(
					items: number[],
					start: number,
					chosen: number[],
					visit: (v: number[]) => void
				): void {
					if (chosen.length === size) {
						visit(chosen);
						return;
					}
					for (let j = start; j <= items.length - (size - chosen.length); j++)
						combinations(items, j + 1, [...chosen, items[j]!], visit);
				}
				combinations(empty, 0, [], (group) => {
					const union = group.reduce((m, i) => m | masks[i]!, 0);
					if (bits(union) === size)
						for (const i of empty) if (!group.includes(i)) changed = remove(i, union) || changed;
				});
				combinations(
					[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !unit.some((i) => cells[i] === d)),
					0,
					[],
					(digits) => {
						const digitMask = digits.reduce((m, d) => m | (1 << d), 0);
						const targets = empty.filter((i) => masks[i]! & digitMask);
						if (
							targets.length === size &&
							digits.every((d) => targets.some((i) => masks[i]! & (1 << d)))
						)
							for (const i of targets) changed = remove(i, ~digitMask) || changed;
					}
				);
			}
			if (changed) break;
		}
		if (changed) {
			if (grade === 'easy') grade = 'medium';
			continue;
		}
		// X-wing: two rows or columns share exactly two candidate positions.
		for (let orientation = 0; orientation < 2 && !changed; orientation++)
			for (let d = 1; d <= 9 && !changed; d++) {
				const groups = units.slice(orientation * 9, orientation * 9 + 9);
				for (let a = 0; a < 9 && !changed; a++)
					for (let b = a + 1; b < 9 && !changed; b++) {
						const positions = (unit: number[]) =>
							unit
								.map((i, p) => (!cells[i] && masks[i]! & (1 << d) ? p : -1))
								.filter((p) => p >= 0);
						const x = positions(groups[a]!),
							y = positions(groups[b]!);
						if (x.length === 2 && y.length === 2 && x[0] === y[0] && x[1] === y[1])
							for (let g = 0; g < 9; g++)
								if (g !== a && g !== b)
									for (const p of x) changed = remove(groups[g]![p]!, 1 << d) || changed;
					}
			}
		if (!changed) return null;
		grade = 'hard';
	}
	return validGeometryGivens(cells, geometry) ? grade : null;
}
export function geometryHint(
	cells: number[],
	solution: number[],
	geometry: SudokuGeometry
): { cell: number; cleared: number[] } | null {
	const legal = cells.findIndex(
		(value, i) =>
			value !== solution[i] && (entryMask(cells, i, geometry) & (1 << solution[i]!)) !== 0
	);
	if (legal >= 0) return { cell: legal, cleared: [] };
	const cell = cells.findIndex((value, i) => value !== solution[i]);
	if (cell < 0) return null;
	// The unique solution has the correct parity. Only peers can block this value.
	return { cell, cleared: geometry.peers[cell]!.filter((peer) => cells[peer] === solution[cell]) };
}

export function entryMask(cells: number[], cell: number, geometry: SudokuGeometry): number {
	let mask = 0x3fe;
	for (const peer of geometry.peers[cell]!) mask &= ~(1 << cells[peer]!);
	if (geometry.parity[cell])
		for (let d = 1; d <= 9; d++) if ((d % 2 ? 1 : 2) !== geometry.parity[cell]) mask &= ~(1 << d);
	return mask;
}

function cleanNotes(round: SudokuRound, cell: number, value: number) {
	const bit = 1 << value;
	if (round.cells.filter((digit) => digit === value).length === 9) {
		for (let i = 0; i < 81; i++) round.notes[i] = round.notes[i]! & ~bit;
	} else {
		for (const peer of round.peers[cell]!) round.notes[peer] = round.notes[peer]! & ~bit;
	}
}

function cagePeers(peers: number[][], cages: SudokuGeometry['cages']): number[][] {
	return peers.map((list, cell) => {
		const result = new Set(list);
		for (const cage of cages)
			if (cage.cells.includes(cell))
				for (const other of cage.cells) if (other !== cell) result.add(other);
		return [...result];
	});
}
