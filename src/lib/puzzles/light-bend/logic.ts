import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { createRng, shuffle, type Rng } from '#lib/engine/rng.js';
import { scoring as scoringDefinition } from './scoring.js';

export const LIGHT_BEND_ENGINE_VERSION = 'light-bend-1';

export const LIGHT_BEND_VARIANTS = [
	'light-bend:classic',
	'light-bend:place-your-own',
	'light-bend:colour',
	'light-bend:splitter',
	'light-bend:portal',
	'light-bend:two-sources',
	'light-bend:no-preview',
	'light-bend:countdown-120',
	'light-bend:no-undo',
	'light-bend:no-hint',
	'light-bend:checkpoint'
] as const;
export type LightBendVariant = (typeof LIGHT_BEND_VARIANTS)[number];

export function parseLightBendVariant(variant?: string): LightBendVariant {
	if (variant === undefined) return 'light-bend:classic';
	if (!LIGHT_BEND_VARIANTS.includes(variant as LightBendVariant)) throw new RangeError('variant');
	return variant as LightBendVariant;
}

/** The eight rules keys are fixed by the brief; every value is a safe integer. */
export interface LightBendRules extends Record<string, number> {
	mirror: number;
	beam: number;
	sources: number;
	info: number;
	limit: number;
	undo: number;
	hint: number;
	win: number;
}

export const LIGHT_BEND_ACTION = {
	rotate: 0,
	place: 1,
	undo: 2,
	hint: 3,
	reset: 4,
	fire: 5
} as const;

export const LIGHT_BEND_HINTS = 3;
export const LIGHT_BEND_COUNTDOWN = 120;
export const LIGHT_BEND_ATTEMPTS = 100;
export const LIGHT_BEND_MOVE_CAP = 10000;
/** Traced-state budget for the par search; a board without a proven par is rejected. */
export const LIGHT_BEND_PAR_NODES = 200000;

export const LIGHT_BEND_CELL = {
	empty: 0,
	wall: 1,
	crystal: 2,
	mirror: 3,
	source: 4,
	checkpoint: 5,
	splitter: 6,
	portal: 7,
	filter: 8
} as const;

const EMPTY = LIGHT_BEND_CELL.empty;
const WALL = LIGHT_BEND_CELL.wall;
const CRYSTAL = LIGHT_BEND_CELL.crystal;
const MIRROR = LIGHT_BEND_CELL.mirror;
const SOURCE = LIGHT_BEND_CELL.source;
const CHECKPOINT = LIGHT_BEND_CELL.checkpoint;
const SPLITTER = LIGHT_BEND_CELL.splitter;
const PORTAL = LIGHT_BEND_CELL.portal;
const FILTER = LIGHT_BEND_CELL.filter;

/** Directions: 0 = east, 1 = north, 2 = west, 3 = south. */
const DX = [1, 0, -1, 0];
const DY = [0, -1, 0, 1];
/** Mirror orientation 0 = `/`, 1 = `\`. Row = orientation, column = incoming direction. */
const REFLECT = [
	[1, 0, 3, 2],
	[3, 2, 1, 0]
];

export interface LightBendBand {
	width: number;
	height: number;
	crystals: number;
	/** Turns planted on the solution walk; difficulty grows with turns (L17). */
	turns: number;
	/** Rotatable mirrors the solution does not need. */
	decoys: number;
	walls: number;
	/** Path mirrors that start flipped, which bounds the par search depth. */
	scramble: number;
	/** Par window the band gates on (L17): a board outside it is the wrong band. */
	parMin: number;
	parMax: number;
}

/**
 * Bands are difficulty bands drawn from the seed stream, never variants. The
 * counts are the brief's build values, with Gentle calibration locked at 10x7
 * (L17). A board ships `turns + decoys` rotatable mirrors, and its par must fall
 * inside the band's window — that window, not the board size, is what makes a
 * board Gentle rather than Expert.
 */
export const LIGHT_BEND_BANDS: readonly LightBendBand[] = [
	{
		width: 10,
		height: 7,
		crystals: 3,
		turns: 3,
		decoys: 1,
		walls: 0,
		scramble: 2,
		parMin: 1,
		parMax: 3
	},
	{
		width: 14,
		height: 10,
		crystals: 5,
		turns: 5,
		decoys: 3,
		walls: 0,
		scramble: 3,
		parMin: 2,
		parMax: 5
	},
	{
		width: 18,
		height: 12,
		crystals: 7,
		turns: 8,
		decoys: 6,
		walls: 2,
		scramble: 4,
		parMin: 3,
		parMax: 7
	},
	{
		width: 20,
		height: 14,
		crystals: 9,
		turns: 10,
		decoys: 10,
		walls: 4,
		scramble: 5,
		parMin: 4,
		parMax: 9
	}
];

/** Band draw weights: bigger boards stay rarer so round creation stays interactive. */
const BAND_WEIGHTS = [4, 4, 2, 1];

/**
 * `place-your-own` draws only the Gentle band. Its exact-placement search costs
 * `cells x 4 x 2^crystals` states, so a wider band would put round creation
 * beyond the interactive bound; the tray matches the band (4 mirrors).
 */
const PLACE_YOUR_OWN_BANDS = 1;

/** Mirror count a band ships. */
export function lightBendMirrorCount(band: number): number {
	const entry = LIGHT_BEND_BANDS[band] ?? LIGHT_BEND_BANDS[0]!;
	return entry.turns + entry.decoys;
}

export interface LightBendRound {
	seed: string;
	variant?: LightBendVariant;
	rules: LightBendRules;
	band: number;
	width: number;
	height: number;
	/** Static cell kinds, row-major. */
	cells: number[];
	crystalCells: number[];
	crystalColours: number[];
	checkpoints: number[];
	/** Rotatable mirror cells. In `place-your-own` these are the legal placement cells. */
	mirrors: number[];
	orientations: number[];
	/** Starting orientations, used by Reset. */
	start: number[];
	/** `place-your-own`: 1 where a mirror now occupies that legal cell. */
	placed: number[];
	tray: number;
	splitters: number[];
	/** Flat portal pairs: entry, exit. */
	portals: number[];
	/** Flat filter pairs: cell, colour. */
	filters: number[];
	/** Flat source triples: cell, direction, colour. */
	sources: number[];
	par: number;
	status: 'playing' | 'won';
	moves: number;
	/** Flat pairs of cell, previous value; the most recent action is last. */
	undo: number[];
	undos: number;
	hintsUsed: number;
	hintCell: number;
	resets: number;
	fired: boolean;
	/** The live (or last fired) trace polyline in half-cell units. */
	beam: number[];
	lit: number;
	touched: number;
	/** The shortest solution's orientations; never used to judge a player's win. */
	solution: number[];
	/** `place-your-own` shortest plan: flat pairs of mirror index, orientation. */
	plan: number[];
	/** Entrance flavour drawn from the seed stream: 0 = top, 1 = bottom. */
	entrance: number;
	crossings: number;
	attempts: number;
	nodes: number;
}

export interface LightBendTrace {
	/** Polyline in half-cell units (2 per cell), x then y. */
	beam: number[];
	/** Cells the beam entered, in visit order. */
	path: number[];
	lit: number;
	touched: number;
	steps: number;
	complete: boolean;
	/** Mirror indices the beam actually reaches, in visit order. */
	hit: number[];
}

/** Static board data the tracer reads. */
export interface LightBendBoard {
	width: number;
	height: number;
	cells: number[];
	crystalCells: number[];
	crystalColours: number[];
	checkpoints: number[];
	mirrors: number[];
	/** 0 = not placed yet (treated as absent). Omitted means every mirror is active. */
	active?: readonly number[];
	/** True when a mirror cell may also be travelled straight through (`place-your-own`). */
	through?: boolean;
	splitters: number[];
	portals: number[];
	filters: number[];
	sources: number[];
}

export interface LightBendMove extends Move {
	action: number;
	cell: number;
	value: number;
}

function mask(count: number): number {
	return count >= 31 ? 0x7fffffff : (1 << count) - 1;
}

/**
 * A board flattened into typed arrays once, so the par search can trace
 * thousands of candidate states without re-indexing the board each time.
 */
interface Prepared {
	width: number;
	height: number;
	size: number;
	limit: number;
	cells: Uint8Array;
	crystalAt: Int32Array;
	crystalColour: Int32Array;
	checkpointAt: Int32Array;
	mirrorAt: Int32Array;
	filterAt: Int32Array;
	portalAt: Int32Array;
	splitterAt: Uint8Array;
	active: readonly number[] | undefined;
	through: boolean;
	sources: number[];
	target: number;
}

/**
 * Reusable visit stamp. A trace marks `stamp[cell * 16 + dir * 4 + colour]` with
 * the current pass number, so no allocation happens per traced state.
 */
interface Scratch {
	stamp: Int32Array;
	pass: number;
}

function prepare(board: LightBendBoard): Prepared {
	const { width, height, cells } = board;
	const size = width * height;
	const crystalAt = new Int32Array(size).fill(-1);
	board.crystalCells.forEach((cell, index) => {
		if (cell >= 0 && cell < size) crystalAt[cell] = index;
	});
	const checkpointAt = new Int32Array(size).fill(-1);
	board.checkpoints.forEach((cell, index) => {
		if (cell >= 0 && cell < size) checkpointAt[cell] = index;
	});
	const mirrorAt = new Int32Array(size).fill(-1);
	board.mirrors.forEach((cell, index) => {
		if (cell >= 0 && cell < size) mirrorAt[cell] = index;
	});
	const filterAt = new Int32Array(size).fill(-1);
	for (let index = 0; index + 1 < board.filters.length; index += 2) {
		const cell = board.filters[index]!;
		if (cell >= 0 && cell < size) filterAt[cell] = board.filters[index + 1]!;
	}
	const portalAt = new Int32Array(size).fill(-1);
	for (let index = 0; index + 1 < board.portals.length; index += 2) {
		const entry = board.portals[index]!;
		const exit = board.portals[index + 1]!;
		portalAt[entry] = exit;
		portalAt[exit] = entry;
	}
	const splitterAt = new Uint8Array(size);
	for (const cell of board.splitters) splitterAt[cell] = 1;
	return {
		width,
		height,
		size,
		limit: 4 * size,
		cells: Uint8Array.from(cells),
		crystalAt,
		crystalColour: Int32Array.from(board.crystalColours),
		checkpointAt,
		mirrorAt,
		filterAt,
		portalAt,
		splitterAt,
		active: board.active,
		through: board.through === true,
		sources: board.sources.slice(),
		target: mask(board.crystalCells.length) | (mask(board.checkpoints.length) << 24)
	};
}

function makeScratch(): Scratch {
	return { stamp: new Int32Array(0), pass: 0 };
}

function resetScratch(scratch: Scratch, board: Prepared): void {
	if (scratch.stamp.length < board.size * 16) scratch.stamp = new Int32Array(board.size * 16);
	scratch.pass = 0;
}

type WalkMode = 'trace' | 'cells' | 'fast';

interface WalkResult {
	beam: number[];
	path: number[];
	hit: number[];
	lit: number;
	touched: number;
	steps: number;
}

/**
 * Deterministic, integer-only beam walk over prepared arrays. Every beam visits
 * (cell, direction, colour) states, so it stops at the 4 x width x height step
 * guard (L6) or as soon as it repeats one of its own states — a loop is a
 * blocked trace, never a hung one. Beam points use half-cell integer units (2 per
 * cell), so no float appears anywhere in the trace.
 */
function walkPrepared(
	board: Prepared,
	orientations: readonly number[],
	mode: WalkMode,
	scratch: Scratch
): WalkResult {
	const { width, height, cells, limit } = board;
	const beam: number[] = [];
	const path: number[] = [];
	const hit: number[] = [];
	const hitSeen = new Set<number>();
	const trace = mode === 'trace';
	const record = mode !== 'fast';
	let lit = 0;
	let touched = 0;
	let steps = 0;
	const queueX: number[] = [];
	const queueY: number[] = [];
	const queueDir: number[] = [];
	const queueColour: number[] = [];
	for (let index = 0; index + 2 < board.sources.length; index += 3) {
		const cell = board.sources[index]!;
		queueX.push(cell % width);
		queueY.push(Math.floor(cell / width));
		queueDir.push(board.sources[index + 1]!);
		queueColour.push(board.sources[index + 2]!);
	}
	const stamp = scratch.stamp;
	const pass = ++scratch.pass;
	let head = 0;
	while (head < queueX.length && steps < limit) {
		let x = queueX[head]!;
		let y = queueY[head]!;
		let dir = queueDir[head]!;
		let colour = queueColour[head++]!;
		stamp[(y * width + x) * 16 + dir * 4 + colour] = pass;
		if (trace) beam.push(x * 2 + 1, y * 2 + 1);
		while (steps < limit) {
			steps++;
			const nx = x + DX[dir]!;
			const ny = y + DY[dir]!;
			// Board edge: the beam exits and stops.
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
				if (trace) beam.push(x * 2 + 1 + DX[dir]!, y * 2 + 1 + DY[dir]!);
				break;
			}
			const next = ny * width + nx;
			// Wall: the beam stops with no reflection.
			if (cells[next] === WALL) {
				if (trace) beam.push(x * 2 + 1 + DX[dir]!, y * 2 + 1 + DY[dir]!);
				break;
			}
			x = nx;
			y = ny;
			const key = next * 16 + dir * 4 + colour;
			if (stamp[key] === pass) {
				if (trace) beam.push(x * 2 + 1, y * 2 + 1);
				break;
			}
			stamp[key] = pass;
			if (record) path.push(next);
			const crystal = board.crystalAt[next]!;
			if (crystal >= 0 && board.crystalColour[crystal] === colour) lit |= 1 << crystal;
			const checkpoint = board.checkpointAt[next]!;
			if (checkpoint >= 0) touched |= 1 << checkpoint;
			const filter = board.filterAt[next]!;
			if (filter >= 0) colour = filter;
			const portal = board.portalAt[next]!;
			if (portal >= 0) {
				if (trace)
					beam.push(
						x * 2 + 1,
						y * 2 + 1,
						(portal % width) * 2 + 1,
						Math.floor(portal / width) * 2 + 1
					);
				const exitKey = portal * 16 + dir * 4 + colour;
				if (stamp[exitKey] === pass) break;
				stamp[exitKey] = pass;
				x = portal % width;
				y = Math.floor(portal / width);
				continue;
			}
			if (board.splitterAt[next]) {
				// A splitter stops the incoming beam and emits the two perpendicular beams.
				if (trace) beam.push(x * 2 + 1, y * 2 + 1);
				queueX.push(x);
				queueY.push(y);
				queueDir.push((dir + 1) & 3);
				queueColour.push(colour);
				queueX.push(x);
				queueY.push(y);
				queueDir.push((dir + 3) & 3);
				queueColour.push(colour);
				break;
			}
			const mirror = board.mirrorAt[next]!;
			if (mirror >= 0 && (!board.active || board.active[mirror])) {
				if (trace) beam.push(x * 2 + 1, y * 2 + 1);
				if (record && !hitSeen.has(mirror)) {
					hitSeen.add(mirror);
					hit.push(mirror);
				}
				dir = REFLECT[orientations[mirror] ?? 0]![dir]!;
			}
		}
	}
	return { beam, path, hit, lit, touched, steps };
}

function isComplete(board: Prepared, lit: number, touched: number): boolean {
	return (lit | (touched << 24)) === board.target;
}

/** Presentation trace: the polyline the beam draws plus what it lights. */
export function traceBoard(board: LightBendBoard, orientations: readonly number[]): LightBendTrace {
	const prepared = prepare(board);
	const scratch = makeScratch();
	resetScratch(scratch, prepared);
	const result = walkPrepared(prepared, orientations, 'trace', scratch);
	return {
		beam: result.beam,
		path: result.path,
		lit: result.lit,
		touched: result.touched,
		steps: result.steps,
		complete: isComplete(prepared, result.lit, result.touched),
		hit: result.hit
	};
}

/** Reachability closure with every mirror treated as both orientations (gates d, e). */
export function reachableCells(board: LightBendBoard): Uint8Array {
	const prepared = prepare(board);
	const { width, height, cells } = prepared;
	const size = prepared.size;
	const seen = new Uint8Array(size * 4);
	const open: number[] = [];
	for (let index = 0; index + 2 < prepared.sources.length; index += 3)
		open.push(prepared.sources[index]! * 4 + prepared.sources[index + 1]!);
	let head = 0;
	while (head < open.length) {
		const state = open[head++]!;
		if (seen[state]) continue;
		seen[state] = 1;
		const cell = state >> 2;
		const dir = state & 3;
		const nx = (cell % width) + DX[dir]!;
		const ny = Math.floor(cell / width) + DY[dir]!;
		if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
		const next = ny * width + nx;
		if (cells[next] === WALL) continue;
		const mirror = prepared.mirrorAt[next]!;
		if (mirror >= 0) {
			open.push(next * 4 + REFLECT[0]![dir]!);
			open.push(next * 4 + REFLECT[1]![dir]!);
			// A placement cell may also be travelled straight through.
			if (prepared.through) open.push(next * 4 + dir);
			continue;
		}
		const portal = prepared.portalAt[next]!;
		if (portal >= 0) {
			open.push(portal * 4 + dir);
			continue;
		}
		if (prepared.splitterAt[next]) {
			open.push(next * 4 + ((dir + 1) & 3));
			open.push(next * 4 + ((dir + 3) & 3));
			continue;
		}
		open.push(next * 4 + dir);
	}
	const visited = new Uint8Array(size);
	for (let state = 0; state < size * 4; state++) if (seen[state]) visited[state >> 2] = 1;
	return visited;
}

interface RouteTurn {
	cell: number;
	orientation: number;
}

interface Route {
	cells: number[];
	turns: RouteTurn[];
}

/** Free cells ahead of `(x, y)` in `dir`, stopping at an edge or a taken cell. */
function freeRun(
	x: number,
	y: number,
	dir: number,
	width: number,
	height: number,
	seen: ReadonlySet<number>
): number {
	let run = 0;
	while (run < width + height) {
		const nx = x + DX[dir]! * (run + 1);
		const ny = y + DY[dir]! * (run + 1);
		if (nx < 0 || ny < 0 || nx >= width || ny >= height) break;
		if (seen.has(ny * width + nx)) break;
		run++;
	}
	return run;
}

/**
 * One trial walk. A right-angle walk can spiral into its own trail, so the
 * caller retries; this returns null instead of forcing a bad route.
 */
function walkRoute(
	rng: Rng,
	width: number,
	height: number,
	startX: number,
	startY: number,
	startDir: number,
	turns: number,
	used: ReadonlySet<number>
): Route | null {
	let x = startX;
	let y = startY;
	let dir = startDir;
	const seen = new Set<number>(used);
	const cells: number[] = [];
	const routeTurns: RouteTurn[] = [];
	for (let turn = 0; turn <= turns; turn++) {
		const run = freeRun(x, y, dir, width, height, seen);
		if (turn === turns) {
			// The last leg only has to reach the edge; a zero-length leg still exits.
			for (let step = 1; step <= run; step++)
				cells.push((y + DY[dir]! * step) * width + x + DX[dir]! * step);
			return { cells, turns: routeTurns };
		}
		// The leg must land on a fresh cell, which becomes the turn mirror.
		if (run < 1) return null;
		// Prefer a longer leg while bends remain: a short leg traps the walk early.
		const floor = Math.max(1, Math.floor(run / 3));
		const length = floor + rng.nextInt(run - floor + 1);
		for (let step = 1; step <= length; step++) {
			const cell = (y + DY[dir]! * step) * width + x + DX[dir]! * step;
			cells.push(cell);
			seen.add(cell);
		}
		x += DX[dir]! * length;
		y += DY[dir]! * length;
		const options = [(dir + 1) & 3, (dir + 3) & 3].filter((next) => {
			const nx = x + DX[next]!;
			const ny = y + DY[next]!;
			return nx >= 0 && ny >= 0 && nx < width && ny < height && !seen.has(ny * width + nx);
		});
		if (options.length === 0) return null;
		// Take the roomier perpendicular exit when the other one is nearly sealed.
		const open = options.map(
			(next) => freeRun(x, y, next, width, height, seen) + (next === dir ? 0 : 0)
		);
		let choice = 0;
		if (options.length === 2 && open[0] !== open[1]) {
			const wider = open[0]! > open[1]! ? 0 : 1;
			// Wider exits are preferred but not forced, so routes stay varied.
			choice = rng.nextInt(4) === 0 ? 1 - wider : wider;
		} else if (options.length === 2) choice = rng.nextInt(2);
		const next = options[choice]!;
		routeTurns.push({ cell: y * width + x, orientation: REFLECT[0]![dir] === next ? 0 : 1 });
		dir = next;
	}
	return null;
}

/**
 * Walks one light route: `turns` right-angle bends, then straight out of the
 * board. Every turn cell is on the walk, so a mirror planted there reproduces
 * the route exactly. Self-trapping is handled by bounded internal retries, so a
 * large band is no likelier to be discarded than a small one.
 */
function buildRoute(
	rng: Rng,
	width: number,
	height: number,
	startX: number,
	startY: number,
	startDir: number,
	turns: number,
	used: ReadonlySet<number>
): Route | null {
	for (let trial = 0; trial < 32; trial++) {
		const route = walkRoute(rng, width, height, startX, startY, startDir, turns, used);
		if (route) return route;
	}
	return null;
}

/**
 * Rejection tally per fairness gate. It is the generation tuning signal, and
 * tests assert each gate can fire.
 */
export const lightBendRejections: Record<string, number> = {
	path: 0,
	crystal: 0,
	unsolved: 0,
	solved: 0,
	bend: 0,
	dead: 0,
	unreachable: 0,
	par: 0,
	band: 0
};

export function resetLightBendRejections(): void {
	for (const key of Object.keys(lightBendRejections)) lightBendRejections[key] = 0;
}

/** Thrown inside generation only; the pipeline counts the gate and retries. */
class Rejected extends Error {
	readonly gate: string;
	constructor(gate: string) {
		super(gate);
		this.gate = gate;
	}
}

function fail(gate: string): never {
	throw new Rejected(gate);
}

function emptyCells(cells: readonly number[]): number[] {
	const result: number[] = [];
	for (let cell = 0; cell < cells.length; cell++) if (cells[cell] === EMPTY) result.push(cell);
	return result;
}

function drawBand(rng: Rng, limit: number): number {
	const weights = BAND_WEIGHTS.slice(0, limit);
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	let draw = rng.nextInt(total);
	for (let index = 0; index < weights.length; index++) {
		draw -= weights[index]!;
		if (draw < 0) return index;
	}
	return 0;
}

/** Colour cycle for the colour variant: red, then blue, then green, then red. */
const COLOUR_CYCLE = [2, 3, 1];

interface Generated {
	band: number;
	width: number;
	height: number;
	cells: number[];
	crystalCells: number[];
	crystalColours: number[];
	checkpoints: number[];
	/** Rotatable mirror cells; `place-your-own` uses its legal placement cells. */
	mirrors: number[];
	start: number[];
	solution: number[];
	/** `place-your-own`: flat pairs of mirror index, orientation. */
	plan: number[];
	tray: number;
	through: boolean;
	splitters: number[];
	portals: number[];
	filters: number[];
	sources: number[];
}

function boardOf(generated: Generated, active?: readonly number[]): LightBendBoard {
	return {
		width: generated.width,
		height: generated.height,
		cells: generated.cells,
		crystalCells: generated.crystalCells,
		crystalColours: generated.crystalColours,
		checkpoints: generated.checkpoints,
		mirrors: generated.mirrors,
		active,
		through: generated.through,
		splitters: generated.splitters,
		portals: generated.portals,
		filters: generated.filters,
		sources: generated.sources
	};
}

/** Straight cells of a walk, in beam order, that are still empty. */
function straightOf(cells: readonly number[], route: Route, bends: Set<number>): number[] {
	return route.cells.filter((cell) => cells[cell] === EMPTY && !bends.has(cell));
}

/** Lays single-colour crystals spread along one walk, in beam order. */
function layStraight(
	rng: Rng,
	cells: number[],
	route: Route,
	bends: Set<number>,
	want: number,
	crystals: number[],
	colours: number[]
): number {
	const picked = shuffle(rng, straightOf(cells, route, bends))
		.slice(0, want)
		.sort((a, b) => route.cells.indexOf(a) - route.cells.indexOf(b));
	for (const cell of picked) {
		cells[cell] = CRYSTAL;
		crystals.push(cell);
		colours.push(1);
	}
	return picked.length;
}

/**
 * Colour variant: crystals are laid in beam order in pairs, with a filter cell
 * between pairs, so the recorded colours are the colours the beam carries.
 */
function layCyclic(
	rng: Rng,
	cells: number[],
	route: Route,
	bends: Set<number>,
	want: number,
	crystals: number[],
	colours: number[],
	filters: number[]
): number {
	let colour = 1;
	let placed = 0;
	let group = 0;
	let skip = rng.nextInt(3);
	for (const cell of straightOf(cells, route, bends)) {
		if (placed >= want) break;
		if (skip > 0) {
			skip--;
			continue;
		}
		if (group === 2) {
			colour = COLOUR_CYCLE[colour % COLOUR_CYCLE.length]!;
			cells[cell] = FILTER;
			filters.push(cell, colour);
			group = 0;
			continue;
		}
		cells[cell] = CRYSTAL;
		crystals.push(cell);
		colours.push(colour);
		placed++;
		group++;
	}
	return placed;
}

/** Direction the walk travels when it arrives at `cells[at]`. */
function headingAt(cells: readonly number[], width: number, at: number): number {
	const here = cells[at]!;
	const before = cells[at - 1] ?? here;
	const dx = (here % width) - (before % width);
	return dx === 1 ? 0 : dx === -1 ? 2 : here > before ? 3 : 1;
}

/**
 * Path-first generation. The planted light walk comes first, the board is built
 * from it, and the tracer verifies every gate before the board is issued.
 *
 * `place-your-own` plants the same walk but leaves its turn cells empty: every
 * empty cell is a legal placement cell, the tray holds the band's mirror count,
 * and the solved board is reached by placing one mirror at each turn.
 */
function generateBoard(rng: Rng, variant: LightBendVariant, bandIndex: number): Generated {
	const band = LIGHT_BEND_BANDS[bandIndex]!;
	const { width, height } = band;
	const placeYourOwn = variant === 'light-bend:place-your-own';
	const twoSources = variant === 'light-bend:two-sources';
	const splitter = variant === 'light-bend:splitter';
	const cyclic = variant === 'light-bend:colour';
	const cells: number[] = Array<number>(width * height).fill(EMPTY);

	const sourceRow = 1 + rng.nextInt(Math.max(1, height - 2));
	const sourceCell = sourceRow * width;
	cells[sourceCell] = SOURCE;
	const sources: number[] = [sourceCell, 0, 1];

	const used = new Set<number>([sourceCell]);
	const routes: Route[] = [];
	const main = buildRoute(
		rng,
		width,
		height,
		0,
		sourceRow,
		0,
		Math.max(1, splitter || twoSources ? band.turns - 2 : band.turns),
		used
	);
	if (!main) fail('path');
	if (main.turns.length < 1) fail('bend');
	routes.push(main);
	for (const cell of main.cells) used.add(cell);
	for (const turn of main.turns) used.add(turn.cell);

	if (twoSources) {
		const row = 1 + rng.nextInt(Math.max(1, height - 2));
		const cell = row * width + width - 1;
		if (used.has(cell)) fail('path');
		cells[cell] = SOURCE;
		sources.push(cell, 2, 1);
		used.add(cell);
		const second = buildRoute(rng, width, height, width - 1, row, 2, 2, used);
		if (!second) fail('path');
		if (second.turns.length < 1) fail('bend');
		routes.push(second);
		for (const entry of second.cells) used.add(entry);
		for (const turn of second.turns) used.add(turn.cell);
	}

	let splitterCell = -1;
	const branches: Route[] = [];
	if (splitter) {
		// The splitter sits on a straight trunk cell; the beam leaves it to both sides.
		const straight = main.cells.filter(
			(cell, index) =>
				cells[cell] === EMPTY &&
				index > 0 &&
				index < main.cells.length - 1 &&
				!main.turns.some((turn) => turn.cell === cell)
		);
		if (straight.length === 0) fail('path');
		splitterCell = straight[rng.nextInt(straight.length)]!;
		const at = main.cells.indexOf(splitterCell);
		if (at < 1) fail('path');
		const trunk = headingAt(main.cells, width, at);
		// Only the trunk is lit; the cells past the splitter are freed for branches.
		for (const cell of main.cells.slice(at + 1)) used.delete(cell);
		main.cells = main.cells.slice(0, at + 1);
		main.turns = main.turns.filter((turn) => main.cells.includes(turn.cell));
		for (const branchDir of [(trunk + 1) & 3, (trunk + 3) & 3]) {
			const branch = buildRoute(
				rng,
				width,
				height,
				splitterCell % width,
				Math.floor(splitterCell / width),
				branchDir,
				1 + rng.nextInt(Math.max(1, band.turns - 3)),
				new Set<number>(used)
			);
			if (!branch) fail('path');
			branches.push(branch);
			for (const turn of branch.turns) used.add(turn.cell);
			for (const cell of branch.cells) used.add(cell);
		}
		cells[splitterCell] = SPLITTER;
	}

	const bends = new Set<number>();
	const turns: RouteTurn[] = [];
	for (const route of [...routes, ...branches]) {
		for (const turn of route.turns) {
			bends.add(turn.cell);
			turns.push(turn);
			if (!placeYourOwn) cells[turn.cell] = MIRROR;
		}
	}

	const checkpoints: number[] = [];
	if (variant === 'light-bend:checkpoint') {
		for (const cell of shuffle(
			rng,
			main.cells.filter((cell) => cells[cell] === EMPTY && !bends.has(cell))
		)) {
			if (checkpoints.length >= 2) break;
			cells[cell] = CHECKPOINT;
			checkpoints.push(cell);
		}
		if (checkpoints.length < 2) fail('path');
	}

	const portals: number[] = [];
	if (variant === 'light-bend:portal') {
		// Enter on a straight leg of the walk and exit two cells later, wall between.
		let chosen = -1;
		for (let at = 1; at + 3 < main.cells.length; at++) {
			const step = main.cells[at + 1]! - main.cells[at]!;
			if (main.cells[at + 2]! - main.cells[at + 1]! !== step) continue;
			if (main.cells[at + 3]! - main.cells[at + 2]! !== step) continue;
			if (
				cells[main.cells[at]!] === EMPTY &&
				cells[main.cells[at + 1]!] === EMPTY &&
				cells[main.cells[at + 2]!] === EMPTY
			) {
				chosen = at;
				break;
			}
		}
		if (chosen < 0) fail('path');
		const entry = main.cells[chosen]!;
		const gap = main.cells[chosen + 1]!;
		const exit = main.cells[chosen + 2]!;
		cells[entry] = PORTAL;
		cells[gap] = WALL;
		cells[exit] = PORTAL;
		portals.push(entry, exit);
	}

	const crystalCells: number[] = [];
	const crystalColours: number[] = [];
	const filters: number[] = [];
	const lay = (route: Route, want: number) =>
		cyclic
			? layCyclic(rng, cells, route, bends, want, crystalCells, crystalColours, filters)
			: layStraight(rng, cells, route, bends, want, crystalCells, crystalColours);

	if (splitter) {
		lay(routes[0]!, Math.max(1, band.crystals - 2 * branches.length));
		for (const branch of branches) lay(branch, 1);
	} else if (twoSources) {
		lay(routes[0]!, Math.max(1, band.crystals - 2));
		lay(routes[1]!, 2);
	} else {
		lay(routes[0]!, band.crystals);
	}
	// A short walk can leave the plan under-filled; top up along the main walk.
	if (crystalCells.length < band.crystals) lay(routes[0]!, band.crystals - crystalCells.length);
	if (crystalCells.length !== band.crystals) fail('crystal');

	for (let count = 0; count < band.walls; count++) {
		const free = emptyCells(cells).filter((cell) => !used.has(cell));
		if (free.length === 0) break;
		cells[free[rng.nextInt(free.length)]!] = WALL;
	}

	const generated: Generated = {
		band: bandIndex,
		width,
		height,
		cells,
		crystalCells,
		crystalColours,
		checkpoints,
		mirrors: [],
		start: [],
		solution: [],
		plan: [],
		tray: placeYourOwn ? band.turns + band.decoys : 0,
		through: placeYourOwn,
		splitters: splitterCell >= 0 ? [splitterCell] : [],
		portals,
		filters,
		sources
	};

	if (placeYourOwn) {
		// Every legal cell is a placement cell; the planted turns become the plan.
		const placeable = emptyCells(cells);
		const plan: number[] = [];
		for (const turn of turns) {
			const index = placeable.indexOf(turn.cell);
			if (index < 0) fail('path');
			plan.push(index, turn.orientation);
		}
		if (new Set(turns.map((turn) => turn.cell)).size !== turns.length) fail('path');
		generated.mirrors = placeable;
		generated.plan = plan;
		return generated;
	}

	generated.mirrors = turns.map((turn) => turn.cell);
	generated.solution = turns.map((turn) => turn.orientation);
	// Decoys avoid the planted walk. A mirror blocks straight travel in the
	// reachability closure, so each decoy is added only if the closure still
	// reaches every crystal, checkpoint and mirror — which is exactly gate (d),
	// checked incrementally instead of rejecting the whole board afterwards.
	const planted = prepare(boardOf(generated));
	const scratch = makeScratch();
	resetScratch(scratch, planted);
	const walk = new Uint8Array(planted.size);
	for (const cell of walkPrepared(planted, generated.solution, 'cells', scratch).path)
		walk[cell] = 1;
	const spare = emptyCells(cells).filter((cell) => !walk[cell]);
	const total = band.turns + band.decoys;
	const closed = (): boolean => {
		const closure = reachableCells(boardOf(generated));
		for (const cell of generated.crystalCells) if (!closure[cell]) return false;
		for (const cell of generated.checkpoints) if (!closure[cell]) return false;
		for (const cell of generated.mirrors) if (!closure[cell]) return false;
		return true;
	};
	for (let count = generated.mirrors.length; count < total && spare.length > 0; count++) {
		const cell = spare.splice(rng.nextInt(spare.length), 1)[0]!;
		cells[cell] = MIRROR;
		generated.mirrors.push(cell);
		generated.solution.push(rng.nextInt(2));
		if (!closed()) {
			// Undo this decoy: it sealed off part of the board.
			cells[cell] = EMPTY;
			generated.mirrors.pop();
			generated.solution.pop();
			count--;
		}
	}
	if (generated.mirrors.length < total) fail('dead');

	// Decoys keep their face; a bounded share of the path mirrors start flipped.
	generated.start = generated.solution.slice();
	const order = shuffle(
		rng,
		Array.from({ length: turns.length }, (_, index) => index)
	);
	for (let index = 0; index < Math.min(turns.length, band.scramble); index++) {
		const at = order[index]!;
		generated.start[at] = generated.start[at] === 0 ? 1 : 0;
	}
	return generated;
}

interface ParResult {
	par: number;
	/** Fixed-mirror boards: the shortest solution's orientations. */
	solution: number[];
	/** `place-your-own` boards: flat pairs of mirror index, orientation. */
	plan: number[];
	nodes: number;
}

/**
 * Exact par for fixed-mirror boards: breadth-first search over orientation
 * states, one flip per edge, from the starting orientations. The first winning
 * layer is the minimum, and its state gives the hint's reference solution. The
 * planted solution is within `scramble` flips, so the search depth is bounded.
 */
export function searchPar(
	board: LightBendBoard,
	start: readonly number[],
	limit: number
): ParResult | null {
	const prepared = prepare(board);
	const scratch = makeScratch();
	resetScratch(scratch, prepared);
	const k = board.mirrors.length;
	if (k > 24) return null;
	const orientations = start.slice();
	const first = walkPrepared(prepared, orientations, 'fast', scratch);
	if (isComplete(prepared, first.lit, first.touched)) return null;
	const seen = new Set<number>([0]);
	let layer: number[] = [0];
	let nodes = 0;
	for (let depth = 1; depth <= k; depth++) {
		const next: number[] = [];
		for (const bits of layer) {
			for (let index = 0; index < k; index++) {
				const child = bits ^ (1 << index);
				if (seen.has(child)) continue;
				seen.add(child);
				nodes++;
				if (nodes > limit) return null;
				for (let at = 0; at < k; at++) orientations[at] = start[at]! ^ ((child >> at) & 1);
				const result = walkPrepared(prepared, orientations, 'fast', scratch);
				if (isComplete(prepared, result.lit, result.touched))
					return { par: depth, solution: orientations.slice(), plan: [], nodes };
				next.push(child);
			}
		}
		if (next.length === 0) break;
		layer = next;
	}
	return null;
}

/**
 * Exact par for `place-your-own`: a 0-1 breadth-first search over
 * (cell, direction, lit mask). Travelling straight is free, and placing a mirror
 * — which turns the beam and ends that cell's travel — costs one. Because a
 * placement chooses its own orientation, the fewest placements is the par.
 */
function searchPlacementPar(board: LightBendBoard, limit: number): ParResult | null {
	const { width, height } = board;
	const size = width * height;
	const crystals = board.crystalCells.length;
	if (crystals > 16) return null;
	const masks = 1 << crystals;
	const total = size * 4 * masks;
	const target = masks - 1;
	const crystalAt = new Int32Array(size).fill(-1);
	board.crystalCells.forEach((cell, index) => {
		crystalAt[cell] = index;
	});
	const placeable = new Uint8Array(size);
	for (const cell of board.mirrors) if (cell >= 0 && cell < size) placeable[cell] = 1;
	const dist = new Int32Array(total).fill(-1);
	const from = new Int32Array(total).fill(-1);
	const mark = new Uint8Array(total);
	let current: number[] = [];
	let next: number[] = [];
	for (let index = 0; index + 2 < board.sources.length; index += 3) {
		const cell = board.sources[index]!;
		const state = (cell * 4 + board.sources[index + 1]!) * masks;
		if (dist[state] < 0) {
			dist[state] = 0;
			current.push(state);
		}
	}
	let cost = 0;
	let nodes = 0;
	while (current.length > 0 || next.length > 0) {
		while (current.length > 0) {
			const state = current.pop()!;
			if (dist[state] !== cost) continue;
			nodes++;
			if (nodes > limit) return null;
			const lit = state % masks;
			if (lit === target) return tracePlan(state);
			const dir = Math.floor(state / masks) % 4;
			const cell = Math.floor(state / (masks * 4));
			const nx = (cell % width) + DX[dir]!;
			const ny = Math.floor(cell / width) + DY[dir]!;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
			const into = ny * width + nx;
			if (board.cells[into] === WALL) continue;
			const carried = crystalAt[into]! >= 0 ? lit | (1 << crystalAt[into]!) : lit;
			relax((into * 4 + dir) * masks + carried, 0, 0, state);
			if (placeable[into]) {
				relax((into * 4 + REFLECT[0]![dir]!) * masks + carried, 1, 1, state);
				relax((into * 4 + REFLECT[1]![dir]!) * masks + carried, 1, 2, state);
			}
		}
		if (next.length === 0) break;
		current = next;
		next = [];
		cost++;
	}
	return null;

	function relax(state: number, step: number, flag: number, parent: number): void {
		const value = cost + step;
		if (dist[state] >= 0 && dist[state] <= value) return;
		dist[state] = value;
		from[state] = parent;
		mark[state] = flag;
		if (step === 0) current.push(state);
		else next.push(state);
	}

	function tracePlan(goal: number): ParResult | null {
		const path: number[] = [];
		const used = new Set<number>();
		let state = goal;
		while (state >= 0) {
			if (mark[state]! > 0) {
				const cell = Math.floor(state / (masks * 4));
				if (used.has(cell)) return null;
				used.add(cell);
				path.push(state);
			}
			state = from[state]!;
		}
		path.reverse();
		const plan: number[] = [];
		for (const entry of path) {
			const cell = Math.floor(entry / (masks * 4));
			const index = board.mirrors.indexOf(cell);
			if (index < 0) return null;
			plan.push(index, mark[entry]! - 1);
		}
		return { par: cost, solution: [], plan, nodes };
	}
}

/** The eight rules tuples, one per Batch A preset (brief §4). */
export function variantRules(variant: LightBendVariant): LightBendRules {
	const base: LightBendRules = {
		mirror: 0,
		beam: 0,
		sources: 1,
		info: 0,
		limit: 0,
		undo: 0,
		hint: 0,
		win: 0
	};
	switch (variant) {
		case 'light-bend:place-your-own':
			return { ...base, mirror: 1 };
		case 'light-bend:colour':
			return { ...base, beam: 1 };
		case 'light-bend:splitter':
			return { ...base, beam: 2 };
		case 'light-bend:portal':
			return { ...base, beam: 3 };
		case 'light-bend:two-sources':
			return { ...base, sources: 2 };
		case 'light-bend:no-preview':
			return { ...base, info: 1 };
		case 'light-bend:countdown-120':
			return { ...base, limit: 1 };
		case 'light-bend:no-undo':
			return { ...base, undo: 1 };
		case 'light-bend:no-hint':
			return { ...base, hint: 1 };
		case 'light-bend:checkpoint':
			return { ...base, win: 4 };
		default:
			return base;
	}
}

export function encodeRules(rules: LightBendRules): Record<string, number> {
	return {
		mirror: rules.mirror,
		beam: rules.beam,
		sources: rules.sources,
		info: rules.info,
		limit: rules.limit,
		undo: rules.undo,
		hint: rules.hint,
		win: rules.win
	};
}

/** Exact rules-tuple match: zero or multiple matches both return undefined. */
export function resolveVariantFromRules(
	rules: Record<string, number | boolean>
): string | undefined {
	const keys = Object.keys(rules).sort();
	if (
		keys.join(',') !== 'beam,hint,info,limit,mirror,sources,undo,win' ||
		!keys.every((key) => typeof rules[key] === 'number')
	)
		return undefined;
	const matches: string[] = [];
	for (const variant of LIGHT_BEND_VARIANTS) {
		const encoded = encodeRules(variantRules(variant));
		if (keys.every((key) => encoded[key as keyof LightBendRules] === rules[key]))
			matches.push(variant);
	}
	return matches.length === 1 ? matches[0] : undefined;
}

/** Hints available this round: 3 normally, 1 for `hint: 2`, none for `hint: 1`. */
export function lightBendHints(rules: LightBendRules): number {
	return rules.hint === 1 ? 0 : rules.hint === 2 ? 1 : LIGHT_BEND_HINTS;
}

function roundBoard(round: LightBendRound): LightBendBoard {
	return {
		width: round.width,
		height: round.height,
		cells: round.cells,
		crystalCells: round.crystalCells,
		crystalColours: round.crystalColours,
		checkpoints: round.checkpoints,
		mirrors: round.mirrors,
		active: round.rules.mirror === 1 ? round.placed : undefined,
		through: round.rules.mirror === 1,
		splitters: round.splitters,
		portals: round.portals,
		filters: round.filters,
		sources: round.sources
	};
}

/**
 * Recomputes the live trace and the win condition. `no-preview` only judges a
 * fired trace, and every later edit clears the firing.
 */
function refresh(round: LightBendRound): void {
	if (round.status !== 'playing') return;
	const trace = traceBoard(roundBoard(round), round.orientations);
	round.beam = trace.beam;
	round.lit = trace.lit;
	round.touched = trace.touched;
	if (!trace.complete) return;
	if (round.rules.info === 1 && !round.fired) return;
	round.status = 'won';
}

/** Validates a placement plan, so par is never a phantom. */
function planSolves(board: LightBendBoard, plan: readonly number[]): boolean {
	const active = Array<number>(board.mirrors.length).fill(0);
	const orientations = Array<number>(board.mirrors.length).fill(0);
	for (let index = 0; index + 1 < plan.length; index += 2) {
		const at = plan[index]!;
		if (at < 0 || at >= board.mirrors.length || active[at]) return false;
		active[at] = 1;
		orientations[at] = plan[index + 1]!;
	}
	return traceBoard({ ...board, active }, orientations).complete;
}

/** The same witness and reachability checks used before generation computes par. */
export function validateLightBendWitness(
	board: LightBendBoard,
	start: readonly number[],
	solution: readonly number[],
	plan: readonly number[],
	placeYourOwn: boolean
): void {
	if (placeYourOwn ? !planSolves(board, plan) : !traceBoard(board, solution).complete)
		fail('unsolved');
	if (traceBoard(board, placeYourOwn ? [] : start).complete) fail('solved');
	validateLightBendReachability(board, placeYourOwn);
}

export function validateLightBendReachability(board: LightBendBoard, placeYourOwn: boolean): void {
	const closure = reachableCells(board);
	for (const cell of board.crystalCells) if (!closure[cell]) fail('unreachable');
	for (const cell of board.checkpoints) if (!closure[cell]) fail('unreachable');
	if (!placeYourOwn) for (const cell of board.mirrors) if (!closure[cell]) fail('dead');
}

interface Attempt {
	round: LightBendRound;
}

/**
 * One full generation attempt: build a board, then verify the fairness gates.
 * Throws `Rejected` with the gate name; the caller retries with the next draw of
 * the same stream, so a seed always reproduces the same board or fails the same
 * way.
 */
function attempt(
	rng: Rng,
	variant: LightBendVariant,
	bandIndex: number,
	entrance: number,
	crossings: number
): Attempt {
	const generated = generateBoard(rng, variant, bandIndex);
	const rules = variantRules(variant);
	const placeYourOwn = variant === 'light-bend:place-your-own';
	const board = boardOf(generated);
	const empty = Array<number>(generated.mirrors.length).fill(0);

	validateLightBendWitness(
		placeYourOwn ? boardOf(generated, empty) : board,
		generated.start,
		generated.solution,
		generated.plan,
		placeYourOwn
	);

	let par: ParResult | null;
	if (placeYourOwn) {
		par = searchPlacementPar(boardOf(generated, empty), LIGHT_BEND_PAR_NODES);
		if (!par) fail('par');
		// (f) par must fit the tray, and must be a real solve.
		if (par.par < 1 || par.par > generated.tray) fail('par');
		if (!planSolves(boardOf(generated, empty), par.plan)) fail('par');
	} else {
		par = searchPar(board, generated.start, LIGHT_BEND_PAR_NODES);
		if (!par) fail('par');
	}
	// L17: the band is defined by its par window, not by its board size, so a
	// Gentle-shaped board whose par lands in Expert's window is the wrong band.
	const band = LIGHT_BEND_BANDS[generated.band]!;
	if (par.par < band.parMin || par.par > band.parMax) fail('band');

	const round: LightBendRound = {
		seed: '',
		variant: variant === 'light-bend:classic' ? undefined : variant,
		rules,
		band: generated.band,
		width: generated.width,
		height: generated.height,
		cells: generated.cells,
		crystalCells: generated.crystalCells,
		crystalColours: generated.crystalColours,
		checkpoints: generated.checkpoints,
		mirrors: generated.mirrors,
		orientations: placeYourOwn
			? Array<number>(generated.mirrors.length).fill(0)
			: generated.start.slice(),
		start: placeYourOwn ? Array<number>(generated.mirrors.length).fill(0) : generated.start.slice(),
		placed: placeYourOwn ? Array<number>(generated.mirrors.length).fill(0) : [],
		tray: generated.tray,
		splitters: generated.splitters,
		portals: generated.portals,
		filters: generated.filters,
		sources: generated.sources,
		par: par.par,
		status: 'playing',
		moves: 0,
		undo: [],
		undos: 0,
		hintsUsed: 0,
		hintCell: -1,
		resets: 0,
		fired: false,
		beam: [],
		lit: 0,
		touched: 0,
		solution: placeYourOwn ? [] : par.solution,
		plan: placeYourOwn ? par.plan : [],
		entrance,
		crossings,
		attempts: 0,
		nodes: par.nodes
	};
	refresh(round);
	return { round };
}

/**
 * Builds the full round for a seed. Up to 100 attempts share one stream, so the
 * same seed always produces the same board; an exhausted seed throws and the
 * daily walk advances to the next seed.
 */
export function createLightBendRoundInner(seed: string, variant?: string): LightBendRound {
	const selected = parseLightBendVariant(variant);
	const rng = createRng(seed);
	let nodes = 0;
	let lastGate = 'path';
	const bands =
		selected === 'light-bend:place-your-own'
			? Math.min(PLACE_YOUR_OWN_BANDS, LIGHT_BEND_BANDS.length)
			: LIGHT_BEND_BANDS.length;
	for (let count = 1; count <= LIGHT_BEND_ATTEMPTS; count++) {
		try {
			const band = drawBand(rng, bands);
			// The entrance flavour is part of the seeded stream, never wall-clock.
			const entrance = rng.nextInt(2);
			const crossings = 3 + rng.nextInt(2);
			const built = attempt(rng, selected, band, entrance, crossings);
			nodes += built.round.nodes;
			return { ...built.round, seed, attempts: count, nodes };
		} catch (error) {
			if (!(error instanceof Rejected)) throw error;
			lastGate = error.gate;
			lightBendRejections[error.gate] = (lightBendRejections[error.gate] ?? 0) + 1;
		}
	}
	console.error(
		JSON.stringify({
			event: 'light_bend_generation_exhausted',
			seed,
			variant: selected,
			gate: lastGate
		})
	);
	throw new RangeError('generation_exhausted');
}

/**
 * Public round factory. The full round is returned (Nonogram pattern) so the view
 * renders the same board the server replays; `rules` is always present because
 * replay and ranked issuance read it.
 */
export function createLightBendRound(seed: string, variant?: string): LightBendRound {
	return createLightBendRoundInner(seed, variant);
}

/** Daily gate: true iff the same pipeline yields a board with a proven par. */
export function dailySeedOk(seed: string, variant?: string): boolean {
	try {
		createLightBendRoundInner(seed, variant);
		return true;
	} catch {
		return false;
	}
}

export function parseLightBendMove(move: Move): LightBendMove {
	if (!move || typeof move !== 'object' || Array.isArray(move)) throw new RangeError('move');
	const keys = Object.keys(move).sort().join(',');
	if (keys !== 'action,cell,value') throw new RangeError(`move_keys:${keys}`);
	const record = move as Record<string, unknown>;
	const action = record.action;
	const cell = record.cell;
	const value = record.value;
	for (const field of [action, cell, value])
		if (typeof field !== 'number' || !Number.isSafeInteger(field) || field < 0)
			throw new RangeError('move_value');
	const accepted = action as number;
	if (accepted > LIGHT_BEND_ACTION.fire) throw new RangeError('move_action');
	return { action: accepted, cell: cell as number, value: value as number };
}

function cloneRound(round: LightBendRound): LightBendRound {
	return {
		...round,
		orientations: round.orientations.slice(),
		start: round.start.slice(),
		placed: round.placed.slice(),
		undo: round.undo.slice(),
		solution: round.solution.slice(),
		plan: round.plan.slice(),
		beam: round.beam.slice()
	};
}

/**
 * Applies one move. Illegal moves throw `RangeError` so replay never accepts a
 * log the live game could not have produced.
 */
export function applyLightBendMove(round: LightBendRound, move: LightBendMove): LightBendRound {
	const next = cloneRound(round);
	if (next.status !== 'playing') throw new RangeError('finished');
	const placeYourOwn = next.rules.mirror === 1;
	const index = next.mirrors.indexOf(move.cell);
	switch (move.action) {
		case LIGHT_BEND_ACTION.rotate: {
			if (placeYourOwn || index < 0) throw new RangeError('rotate');
			next.undo.push(move.cell, next.orientations[index]!);
			next.orientations[index] = next.orientations[index] === 0 ? 1 : 0;
			next.fired = false;
			next.hintCell = -1;
			next.moves++;
			break;
		}
		case LIGHT_BEND_ACTION.place: {
			if (!placeYourOwn || index < 0) throw new RangeError('place');
			if (next.placed[index] || next.tray <= 0) throw new RangeError('place');
			if (move.value !== 0 && move.value !== 1) throw new RangeError('place');
			next.placed[index] = 1;
			next.orientations[index] = move.value;
			next.tray--;
			next.undo.push(move.cell, 2);
			next.fired = false;
			next.hintCell = -1;
			next.moves++;
			break;
		}
		case LIGHT_BEND_ACTION.undo: {
			if (next.rules.undo === 1) throw new RangeError('undo');
			if (next.undo.length < 2) throw new RangeError('undo');
			const value = next.undo.pop()!;
			const cell = next.undo.pop()!;
			const at = next.mirrors.indexOf(cell);
			if (at < 0) throw new RangeError('undo');
			if (value === 2) {
				next.placed[at] = 0;
				next.orientations[at] = 0;
				next.tray++;
			} else next.orientations[at] = value;
			next.undos++;
			next.fired = false;
			next.hintCell = -1;
			next.moves++;
			break;
		}
		case LIGHT_BEND_ACTION.hint: {
			const budget = lightBendHints(next.rules);
			if (budget === 0 || next.hintsUsed >= budget) throw new RangeError('hint');
			next.hintsUsed++;
			next.hintCell = hintCell(next);
			next.moves++;
			break;
		}
		case LIGHT_BEND_ACTION.reset: {
			next.orientations = next.start.slice();
			next.placed = next.placed.map(() => 0);
			next.tray = placeYourOwn ? lightBendMirrorCount(next.band) : 0;
			next.undo = [];
			next.fired = false;
			next.hintCell = -1;
			next.resets++;
			next.moves++;
			break;
		}
		case LIGHT_BEND_ACTION.fire: {
			next.fired = true;
			next.hintCell = -1;
			next.moves++;
			break;
		}
		default:
			throw new RangeError('action');
	}
	refresh(next);
	return next;
}

/**
 * The hint names the mirror the shortest solution disagrees with first. In
 * `place-your-own` it names the next placement cell, and never flags a mirror
 * the player already has right.
 */
export function hintCell(round: LightBendRound): number {
	if (round.rules.mirror === 1) {
		for (let index = 0; index + 1 < round.plan.length; index += 2) {
			const at = round.plan[index]!;
			const cell = round.mirrors[at];
			if (cell === undefined) continue;
			if (!round.placed[at]) return cell;
			if (round.orientations[at] !== round.plan[index + 1]) return cell;
		}
		return -1;
	}
	for (let index = 0; index < round.solution.length; index++) {
		const cell = round.mirrors[index];
		if (cell === undefined) continue;
		if (round.orientations[index] !== round.solution[index]) return cell;
	}
	return -1;
}

/**
 * Mirrors whose final state differs from the start, plus placements. This is the
 * LOCKED star metric (L11): the final board vs the starting board, so hints,
 * undos, resets and fire actions never move the grade.
 */
export function lightBendTurned(round: LightBendRound): number {
	if (round.rules.mirror === 1) {
		let placed = 0;
		for (const value of round.placed) if (value) placed++;
		return placed;
	}
	let flips = 0;
	for (let index = 0; index < round.orientations.length; index++)
		if (round.orientations[index] !== round.start[index]) flips++;
	return flips;
}

/** 3 stars at or under par, 2 up to par + 3, 1 for any clear. */
export function lightBendStarGrade(round: LightBendRound): number {
	if (round.status !== 'won') return 0;
	const effort = lightBendTurned(round);
	return effort <= round.par ? 3 : effort <= round.par + 3 ? 2 : 1;
}

/**
 * Points rank the board: win base floored at 200, minus seconds, minus hints and
 * resets; Countdown-120 adds a remaining-seconds bonus instead.
 */
export function lightBendScore(
	round: LightBendRound,
	seconds: number,
	values: ScoreValues = scoringDefinition.defaults
): number {
	if (!Number.isSafeInteger(seconds) || seconds < 0) throw new RangeError('elapsed');
	if (round.status !== 'won') throw new RangeError('incomplete');
	if (round.rules.limit === 1 && seconds >= LIGHT_BEND_COUNTDOWN) throw new RangeError('timeout');
	const completion = values.completion ?? 0;
	const perSecond = values.second ?? 0;
	const perHint = values.hint ?? 0;
	const perReset = values.reset ?? 0;
	const countdown = values.countdown ?? 0;
	const penalties = round.hintsUsed * perHint + round.resets * perReset;
	const score =
		round.rules.limit === 1
			? completion + (LIGHT_BEND_COUNTDOWN - seconds) * countdown - penalties
			: Math.max(200, completion - perSecond * seconds) - penalties;
	return Math.max(0, Math.min(10000, score));
}

/** The winning move list for a round: tests, vectors and scripted solves. */
export function lightBendWitness(round: LightBendRound): LightBendMove[] {
	const moves: LightBendMove[] = [];
	if (round.rules.mirror === 1) {
		for (let index = 0; index + 1 < round.plan.length; index += 2) {
			const cell = round.mirrors[round.plan[index]!];
			if (cell === undefined) continue;
			moves.push({ action: LIGHT_BEND_ACTION.place, cell, value: round.plan[index + 1]! });
		}
	} else {
		for (let index = 0; index < round.solution.length; index++) {
			const cell = round.mirrors[index];
			if (cell === undefined) continue;
			if (round.solution[index] !== round.start[index])
				moves.push({ action: LIGHT_BEND_ACTION.rotate, cell, value: 0 });
		}
	}
	if (round.rules.info === 1) moves.push({ action: LIGHT_BEND_ACTION.fire, cell: 0, value: 0 });
	return moves;
}
