import type { Move } from '#lib/engine/contract.js';
import { createRng, shuffle, type Rng } from '../../engine/rng.js';
import { SCORE_MAX, type ScoreValues } from '../../engine/scoring.js';
import { scoring } from './scoring.js';

export const SHAPE_DIVISION_ENGINE_VERSION = 'shape-division-1';
export const SHAPE_DIVISION_MAX_MOVES = 10000;
export const SHAPE_DIVISION_COUNTDOWN = 300;
export const SHAPE_DIVISION_VARIANTS = [
	'shape-division:classic',
	'shape-division:pieces-2',
	'shape-division:pieces-5',
	'shape-division:piece-size-4',
	'shape-division:equal-area',
	'shape-division:one-tree',
	'shape-division:shape-given',
	'shape-division:countdown-300',
	'shape-division:no-hint',
	'shape-division:equality-score'
] as const;
export type ShapeDivisionVariant = (typeof SHAPE_DIVISION_VARIANTS)[number];

export type Cell = readonly [x: number, y: number];
export type Edge = readonly [first: number, second: number];
type Link = { edge: Edge; cells: readonly [number, number] };
type Cut = { first: number; second: number; edges: Edge[] };

export interface DivisionBoard {
	width: number;
	height: number;
	cells: Cell[];
	solution: number[][];
	trees: number[];
	given: Cell[];
	easy: boolean;
	perimeter: number;
	edges: Edge[];
	vertices: number[];
	boundary: Edge[];
	links: Link[];
}

const classic = {
	pieces: 4,
	pieceSize: 3,
	relation: 0,
	mirror: 0,
	symbols: 0,
	cut: 0,
	content: 0,
	given: 0,
	grid: 0,
	repTile: 0,
	mistake: 3,
	hint: 1,
	timing: 0,
	scoring: 0
};

const ruleChanges: Record<ShapeDivisionVariant, Partial<typeof classic>> = {
	'shape-division:classic': {},
	'shape-division:pieces-2': { pieces: 2 },
	'shape-division:pieces-5': { pieces: 5 },
	'shape-division:piece-size-4': { pieceSize: 4 },
	'shape-division:equal-area': { relation: 1 },
	'shape-division:one-tree': { content: 1 },
	'shape-division:shape-given': { given: 1 },
	'shape-division:countdown-300': { timing: 1 },
	'shape-division:no-hint': { hint: 0 },
	'shape-division:equality-score': { scoring: 1 }
};

export type ShapeDivisionVerdict =
	'count' | 'size' | 'shape' | 'connected' | 'tree' | 'given' | 'equality';

export interface ShapeDivisionRound {
	seed: string;
	variant?: ShapeDivisionVariant;
	rules: typeof classic;
	board: DivisionBoard;
	cuts: Cut[];
	history: { cut: Cut; added: boolean }[];
	pieces: number[][];
	mistakes: number;
	hints: number[];
	restarts: number;
	moves: number;
	status: 'playing' | 'won' | 'lost' | 'timeout';
	verdict: ShapeDivisionVerdict | null;
}

export interface ShapeDivisionMove extends Move {
	action: number;
	first: number;
	second: number;
}

export function parseShapeDivisionVariant(variant?: string): ShapeDivisionVariant {
	const resolved = variant ?? SHAPE_DIVISION_VARIANTS[0];
	const match = SHAPE_DIVISION_VARIANTS.find((id) => id === resolved);
	if (!match) throw new RangeError('variant');
	return match;
}

export function encodeRules(variant?: string) {
	return { ...classic, ...ruleChanges[parseShapeDivisionVariant(variant)] };
}

export function resolveVariantFromRules(rules: Record<string, number | boolean>) {
	if (Object.keys(rules).length !== Object.keys(classic).length) return undefined;
	return SHAPE_DIVISION_VARIANTS.find((id) =>
		Object.entries(encodeRules(id)).every(([key, value]) => rules[key] === value)
	);
}

const directions: readonly Cell[] = [
	[1, 0],
	[0, 1],
	[-1, 0],
	[0, -1]
];
const cellKey = ([x, y]: Cell) => `${x},${y}`;
const cellOrder = (a: Cell, b: Cell) => a[1] - b[1] || a[0] - b[0];
const edgeKey = ([a, b]: Edge) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const pair = (a: number, b: number): Edge => (a < b ? [a, b] : [b, a]);

function neighbors([x, y]: Cell): Cell[] {
	return directions.map(([dx, dy]) => [x + dx, y + dy]);
}

function normalise(cells: readonly Cell[]): Cell[] {
	const x = Math.min(...cells.map((cell) => cell[0]));
	const y = Math.min(...cells.map((cell) => cell[1]));
	return cells.map(([cx, cy]): Cell => [cx - x, cy - y]).sort(cellOrder);
}

function orientations(cells: readonly Cell[]): Cell[][] {
	return [
		(c: Cell): Cell => [c[0], c[1]],
		(c: Cell): Cell => [-c[1], c[0]],
		(c: Cell): Cell => [-c[0], -c[1]],
		(c: Cell): Cell => [c[1], -c[0]],
		(c: Cell): Cell => [-c[0], c[1]],
		(c: Cell): Cell => [-c[1], -c[0]],
		(c: Cell): Cell => [c[0], -c[1]],
		(c: Cell): Cell => [c[1], c[0]]
	].map((transform) => normalise(cells.map(transform)));
}

function shapeKey(cells: readonly Cell[]) {
	return orientations(cells)
		.map((points) => points.map(cellKey).join(';'))
		.sort()[0]!;
}

function sides([x, y]: Cell, stride: number): Edge[] {
	const top = y * stride + x;
	return [
		[top, top + 1],
		[top + 1, top + stride + 1],
		[top + stride + 1, top + stride],
		[top + stride, top]
	];
}

export function boardGeometry(cells: readonly Cell[]): DivisionBoard {
	const width = Math.max(...cells.map(([x]) => x)) + 1;
	const height = Math.max(...cells.map(([, y]) => y)) + 1;
	const exposed = new Map<string, { edge: Edge; cell: number }>();
	const links: Link[] = [];
	cells.forEach((cell, index) => {
		for (const edge of sides(cell, width + 1)) {
			const key = edgeKey(edge);
			const other = exposed.get(key);
			if (other) {
				links.push({ edge: pair(...edge), cells: [other.cell, index] });
				exposed.delete(key);
			} else exposed.set(key, { edge, cell: index });
		}
	});
	const boundary = [...exposed.values()].map(({ edge }) => edge);
	const edges = [...boundary, ...links.map(({ edge }) => edge)];
	const vertices = [...new Set(edges.flat())].sort((a, b) => a - b);
	return {
		width,
		height,
		cells: [...cells],
		solution: [],
		trees: [],
		given: [],
		easy: false,
		perimeter: boundary.length,
		edges,
		vertices,
		boundary,
		links
	};
}

export function vertexPoint(board: Pick<DivisionBoard, 'width'>, vertex: number): Cell {
	return [vertex % (board.width + 1), Math.floor(vertex / (board.width + 1))];
}

function traceOutline(edges: Edge[]): number[][] {
	const outgoing = new Map<number, number[]>();
	for (const [first, second] of edges) {
		const ends = outgoing.get(first) ?? [];
		ends.push(second);
		outgoing.set(first, ends);
	}
	const loops: number[][] = [];
	for (const [start] of edges) {
		if (!outgoing.get(start)?.length) continue;
		const loop = [start];
		let vertex = start;
		do {
			vertex = outgoing.get(vertex)!.pop()!;
			loop.push(vertex);
		} while (vertex !== start);
		loops.push(loop);
	}
	return loops;
}

export function outlinePath(board: DivisionBoard, cells?: readonly number[]) {
	let edges = board.boundary;
	if (cells) {
		const exposed = new Map<string, Edge>();
		for (const index of cells) {
			for (const edge of sides(board.cells[index]!, board.width + 1)) {
				const key = edgeKey(edge);
				if (!exposed.delete(key)) exposed.set(key, edge);
			}
		}
		edges = [...exposed.values()];
	}
	return traceOutline(edges)
		.map(
			(loop) =>
				`M${loop
					.slice(0, -1)
					.map((vertex) => vertexPoint(board, vertex).join(' '))
					.join('L')}Z`
		)
		.join('');
}

interface Placement {
	mask: bigint;
	indices: number[];
	shape: string;
	straight: boolean;
}

function localPlacements(cells: readonly Cell[], size: number): Placement[] {
	const indices = new Map(cells.map((cell, index) => [cellKey(cell), index]));
	const adjacency = cells.map((cell) =>
		neighbors(cell).flatMap((neighbor) => {
			const index = indices.get(cellKey(neighbor));
			return index === undefined ? [] : [index];
		})
	);
	const bit = (index: number) => 1n << BigInt(index);
	let pieces = new Map(cells.map((_, index) => [bit(index), [index]]));
	for (let length = 1; length < size; length++) {
		const extended = new Map<bigint, number[]>();
		for (const [mask, members] of pieces) {
			for (const index of members.flatMap((member) => adjacency[member]!)) {
				const flag = bit(index);
				if ((mask & flag) === 0n && !extended.has(mask | flag))
					extended.set(
						mask | flag,
						[...members, index].sort((a, b) => a - b)
					);
			}
		}
		pieces = extended;
	}
	return [...pieces].map(([mask, indices]) => {
		const members = indices.map((index) => cells[index]!);
		const [x, y] = members[0]!;
		return {
			mask,
			indices,
			shape: shapeKey(members),
			straight: members.every((cell) => cell[0] === x) || members.every((cell) => cell[1] === y)
		};
	});
}

function cover(
	cells: readonly Cell[],
	placements: readonly Placement[],
	cap: number,
	congruent: boolean,
	bends = cells.length
) {
	const byCell: Placement[][] = cells.map(() => []);
	for (const placement of placements)
		for (const index of placement.indices) byCell[index]!.push(placement);
	const answers: number[][][] = [];
	const path: number[][] = [];

	function visit(remaining: bigint, shape: string | null, bentLeft: number) {
		if (remaining === 0n) {
			answers.push(path.slice());
			return;
		}
		let index = 0;
		while ((remaining & (1n << BigInt(index))) === 0n) index++;
		for (const placement of byCell[index]!) {
			const bent = Number(!placement.straight);
			if (
				bent > bentLeft ||
				(shape && shape !== placement.shape) ||
				(remaining & placement.mask) !== placement.mask
			)
				continue;
			path.push(placement.indices);
			visit(remaining ^ placement.mask, congruent ? placement.shape : null, bentLeft - bent);
			path.pop();
			if (answers.length >= cap) return;
		}
	}

	visit((1n << BigInt(cells.length)) - 1n, null, bends);
	return answers;
}

function forcedCorner(cells: readonly Cell[], placements: readonly Placement[]) {
	const occupied = new Set(cells.map(cellKey));
	return cells.some((cell, index) => {
		const missing = neighbors(cell).map((neighbor) => !occupied.has(cellKey(neighbor)));
		return (
			missing.some((value, direction) => value && missing[(direction + 1) % 4]) &&
			placements.filter((placement) => placement.indices.includes(index)).length === 1
		);
	});
}

type DivisionConstraints = {
	equalArea?: boolean;
	trees?: readonly number[];
	given?: readonly Cell[];
};

function withTrees(placements: readonly Placement[], trees: readonly number[]) {
	const marked = new Set(trees);
	return placements.filter(
		({ indices }) => indices.filter((index) => marked.has(index)).length === 1
	);
}

function inspectPlacements(
	cells: readonly Cell[],
	placements: readonly Placement[],
	equalArea: boolean
) {
	const answers = cover(cells, placements, 2, !equalArea);
	const forced = forcedCorner(cells, placements);
	return { answers, forced };
}

export function inspectDivision(
	cells: readonly Cell[],
	size: number,
	constraints: DivisionConstraints = {}
) {
	let placements = localPlacements(cells, size);
	if (constraints.given?.length) {
		const required = shapeKey(constraints.given);
		placements = placements.filter(({ shape }) => shape === required);
	}
	if (constraints.trees?.length) placements = withTrees(placements, constraints.trees);
	return inspectPlacements(cells, placements, Boolean(constraints.equalArea));
}

function growPart(rng: Rng, size: number) {
	const cells: Cell[] = [[0, 0]];
	while (cells.length < size) {
		const occupied = new Set(cells.map(cellKey));
		const frontier = cells.flatMap(neighbors).filter((cell) => !occupied.has(cellKey(cell)));
		cells.push(frontier[rng.nextInt(frontier.length)]!);
	}
	return cells;
}

function growBoard(rng: Rng, rules: typeof classic) {
	const part = growPart(rng, rules.pieceSize);
	const shapes = orientations(part);
	let cells = normalise(part);
	for (let index = 1; index < rules.pieces; index++) {
		const occupied = new Set(cells.map(cellKey));
		const frontier = shuffle(
			rng,
			cells.flatMap(neighbors).filter((cell) => !occupied.has(cellKey(cell)))
		);
		const variants = rules.relation ? orientations(growPart(rng, rules.pieceSize)) : shapes;
		const shape = variants[rng.nextInt(variants.length)]!;
		let joined = false;
		for (const [x, y] of frontier) {
			for (const [sx, sy] of shuffle(rng, shape)) {
				const translated = shape.map(([px, py]): Cell => [x + px - sx, y + py - sy]);
				if (translated.some((cell) => occupied.has(cellKey(cell)))) continue;
				const candidate = normalise([...cells, ...translated]);
				if (candidate.some(([cx, cy]) => cx >= 8 || cy >= 8)) continue;
				cells = candidate;
				joined = true;
				break;
			}
			if (joined) break;
		}
		if (!joined) return null;
	}
	// Keep long silhouettes horizontal so the shared centered frame can fit the board.
	if (Math.max(...cells.map(([, y]) => y)) > Math.max(...cells.map(([x]) => x)))
		cells = normalise(cells.map(([x, y]) => [y, x]));
	return { cells, given: rules.given ? normalise(part) : [] };
}

function grade(
	{ cells, given }: { cells: Cell[]; given: Cell[] },
	rules: typeof classic,
	rng: Rng
) {
	const board = boardGeometry(cells);
	if (
		new Set(board.boundary.map(([start]) => start)).size !== board.boundary.length ||
		traceOutline(board.boundary).length !== 1
	)
		return null;
	let placements = localPlacements(cells, rules.pieceSize);
	if (given.length) {
		const required = shapeKey(given);
		placements = placements.filter(({ shape }) => shape === required);
	}
	const base = inspectPlacements(cells, placements, Boolean(rules.relation));
	let { answers, forced } = base;
	let trees: number[] = [];
	if (rules.content) {
		if (base.answers.length < 2) return null;
		const first = base.answers[0]!;
		// Changing a tree within each witness part keeps that witness valid while ruling out alternatives.
		for (let attempt = 0; attempt < 24; attempt++) {
			trees = first.map((piece) => piece[rng.nextInt(piece.length)]!);
			({ answers, forced } = inspectPlacements(cells, withTrees(placements, trees), false));
			if (forced && answers.length === 1) break;
		}
	}
	if (!forced || !answers.length || (!rules.relation && answers.length !== 1)) return null;

	const fitsEasy = board.height <= 5;
	const extraContacts = cells.length + 1 - board.perimeter / 2;
	let easy = fitsEasy && extraContacts === 0;
	if (
		rules.pieces === 2 ||
		rules.pieces === 5 ||
		rules.pieceSize === 4 ||
		rules.content ||
		rules.given
	)
		easy = fitsEasy && extraContacts <= 1;
	if (rules.content) easy = fitsEasy && extraContacts <= 2;
	if (rules.relation)
		easy = answers.length > 1 && cover(cells, placements, 1, false, 1).length === 1;

	return { ...board, solution: answers[0]!, easy, trees, given };
}

function generateBoard(seed: string, rules: typeof classic) {
	const rng = createRng(seed);
	for (let attempt = 0; attempt < 24; attempt++) {
		const candidate = growBoard(rng, rules);
		const board = candidate && grade(candidate, rules, rng);
		if (board) return board;
	}
	return null;
}

export function dailySeedOk(seed: string, variant?: string) {
	const id = parseShapeDivisionVariant(variant);
	if (id !== SHAPE_DIVISION_VARIANTS[0]) return false;
	return generateBoard(seed, encodeRules(id))?.easy === true;
}

export function createShapeDivisionRound(seed: string, variant?: string): ShapeDivisionRound {
	const id = parseShapeDivisionVariant(variant);
	const rules = encodeRules(id);
	const board = generateBoard(seed, rules) ?? generateBoard('24', rules);
	if (!board) throw new RangeError('board');
	return {
		seed,
		variant: id,
		rules,
		board,
		cuts: [],
		history: [],
		pieces: [board.cells.map((_, index) => index)],
		mistakes: 0,
		hints: [],
		restarts: 0,
		moves: 0,
		status: 'playing',
		verdict: null
	};
}

export function entranceDuration(perimeter: number) {
	return Math.max(700, Math.min(2600, perimeter * 80));
}

export function shapeDivisionEntranceMs(seed: string, variant?: string) {
	return entranceDuration(createShapeDivisionRound(seed, variant).board.perimeter);
}

const routes = new WeakMap<DivisionBoard, Map<string, Edge[] | null>>();

export function findCutPath(board: DivisionBoard, first: number, second: number): Edge[] | null {
	if (first === second || !board.vertices.includes(first) || !board.vertices.includes(second))
		return null;
	const [start, end] = pair(first, second);
	const key = edgeKey([start, end]);
	let cache = routes.get(board);
	if (!cache) {
		cache = new Map();
		routes.set(board, cache);
	}
	if (!cache.has(key)) cache.set(key, shortestCut(board, start, end));
	return cache.get(key) ?? null;
}

function shortestCut(board: DivisionBoard, start: number, end: number): Edge[] | null {
	const internal = new Set(board.links.map(({ edge }) => edgeKey(edge)));
	const arcs = new Map<number, { vertex: number; direction: number; cut: boolean }[]>();
	function add(from: number, to: number, cut: boolean) {
		const neighbors = arcs.get(from) ?? [];
		neighbors.push({ vertex: to, direction: to - from, cut });
		arcs.set(from, neighbors);
	}
	for (const edge of board.edges) {
		const [a, b] = edge;
		const cut = internal.has(edgeKey(edge));
		add(a, b, cut);
		add(b, a, cut);
	}

	const queue: { vertex: number; direction: number; cost: number; cuts: Edge[] }[] = [
		{ vertex: start, direction: 0, cost: 0, cuts: [] }
	];
	const visited = new Set<string>();
	while (queue.length) {
		queue.sort((a, b) => b.cost - a.cost);
		const current = queue.pop()!;
		const key = `${current.vertex}:${current.direction}`;
		if (visited.has(key)) continue;
		visited.add(key);
		if (current.vertex === end) return current.cuts.length ? current.cuts : null;
		for (const arc of arcs.get(current.vertex)!) {
			if (visited.has(`${arc.vertex}:${arc.direction}`)) continue;
			const turn = current.direction !== 0 && current.direction !== arc.direction;
			queue.push({
				...arc,
				cost: current.cost + (arc.cut ? 101 : 251) + (turn ? 140 : 0),
				cuts: arc.cut ? [...current.cuts, pair(current.vertex, arc.vertex)] : current.cuts
			});
		}
	}
	return null;
}

export function activeCutEdges(round: ShapeDivisionRound) {
	return [
		...new Map(
			round.cuts.flatMap((cut) => cut.edges.map((edge) => [edgeKey(edge), edge] as const))
		).values()
	];
}

function connectedPieces(round: ShapeDivisionRound) {
	const blocked = new Set(activeCutEdges(round).map(edgeKey));
	const adjacent: number[][] = round.board.cells.map(() => []);
	for (const {
		edge,
		cells: [a, b]
	} of round.board.links) {
		if (blocked.has(edgeKey(edge))) continue;
		adjacent[a]!.push(b);
		adjacent[b]!.push(a);
	}
	const visited = new Set<number>();
	const pieces: number[][] = [];
	for (let index = 0; index < adjacent.length; index++) {
		if (visited.has(index)) continue;
		const piece = [index];
		visited.add(index);
		for (const current of piece) {
			for (const next of adjacent[current]!) {
				if (visited.has(next)) continue;
				visited.add(next);
				piece.push(next);
			}
		}
		pieces.push(piece.sort((a, b) => a - b));
	}
	return pieces;
}

function pieceKey(round: ShapeDivisionRound, piece: readonly number[]) {
	return shapeKey(piece.map((index) => round.board.cells[index]!));
}

function verdict(round: ShapeDivisionRound): ShapeDivisionVerdict | null {
	const { pieces, rules } = round;
	if (pieces.length !== rules.pieces) return 'count';
	if (pieces.some((piece) => piece.length !== rules.pieceSize)) return 'size';
	if (rules.relation) return null;
	const kinds = new Set(pieces.map((piece) => pieceKey(round, piece)));
	if (kinds.size !== 1) return 'shape';
	if (rules.given && !kinds.has(shapeKey(round.board.given))) return 'given';
	if (
		rules.content &&
		pieces.some((piece) => piece.filter((index) => round.board.trees.includes(index)).length !== 1)
	)
		return 'tree';
	return null;
}

export function equalityPercent(round: ShapeDivisionRound) {
	const counts = new Map<string, number>();
	const sizes = round.pieces.map((piece) => piece.length);
	for (const piece of round.pieces) {
		const key = pieceKey(round, piece);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const max = Math.max(...sizes);
	const denominator = max * sizes.length;
	const numerator = Math.min(...sizes) * sizes.length + Math.max(...counts.values()) * max;
	return Math.floor((100 * numerator + denominator) / (2 * denominator));
}

export function nextHintCell(round: ShapeDivisionRound) {
	const assignment = new Map(
		round.board.solution.flatMap((part, index) => part.map((cell) => [cell, index] as const))
	);
	const blocked = new Set(activeCutEdges(round).map(edgeKey));
	const contradicted = new Set<number>();
	for (const {
		edge,
		cells: [a, b]
	} of round.board.links) {
		const part = assignment.get(a)!;
		if (part === assignment.get(b) && blocked.has(edgeKey(edge))) contradicted.add(part);
	}
	return (
		round.board.solution
			.flatMap((piece, index) => (contradicted.has(index) ? [] : piece))
			.find((cell) => !round.hints.includes(cell)) ?? null
	);
}

function setting(values: ScoreValues | undefined, field: keyof typeof scoring.defaults) {
	return values?.[field] ?? scoring.defaults[field];
}

export function canFinishByCheck(round: ShapeDivisionRound, values?: ScoreValues) {
	if (round.rules.scoring) return round.pieces.length === round.rules.pieces;
	const limit = setting(values, 'mistakeLimit');
	return !verdict(round) || (limit > 0 && round.mistakes + 1 === limit);
}

export function applyShapeDivisionMove(
	round: ShapeDivisionRound,
	move: ShapeDivisionMove,
	values?: ScoreValues
): ShapeDivisionRound {
	if (round.status !== 'playing' || round.moves >= SHAPE_DIVISION_MAX_MOVES)
		throw new RangeError('round_over');
	const { action, first, second } = move;
	if (
		round.moves === SHAPE_DIVISION_MAX_MOVES - 1 &&
		!(action === 2 && canFinishByCheck(round, values)) &&
		action !== 5
	)
		throw new RangeError('move_limit');
	const next: ShapeDivisionRound = { ...round, moves: round.moves + 1, verdict: null };
	if (action === 0 || action === 1) {
		const [a, b] = pair(first, second);
		const existing = round.cuts.find((cut) => cut.first === a && cut.second === b);
		const edges = findCutPath(round.board, a, b);
		if (!edges || Boolean(existing) !== (action === 1)) throw new RangeError('cut');
		const cut = existing ?? { first: a, second: b, edges };
		next.cuts = existing ? round.cuts.filter((item) => item !== existing) : [...round.cuts, cut];
		next.history = [...round.history, { cut, added: !existing }];
		next.pieces = connectedPieces(next);
	} else if (action === 4) {
		const last = round.history.at(-1);
		if (!last) throw new RangeError('undo');
		next.history = round.history.slice(0, -1);
		next.cuts = last.added
			? round.cuts.filter((cut) => cut.first !== last.cut.first || cut.second !== last.cut.second)
			: [...round.cuts, last.cut];
		next.pieces = connectedPieces(next);
	} else if (action === 2) {
		if (round.rules.scoring) {
			if (round.pieces.length === round.rules.pieces) next.status = 'won';
			else next.verdict = 'equality';
			return next;
		}
		next.verdict = verdict(round);
		if (!next.verdict) next.status = 'won';
		else {
			next.mistakes++;
			const limit = setting(values, 'mistakeLimit');
			if (limit > 0 && next.mistakes >= limit) next.status = 'lost';
		}
	} else if (action === 3) {
		if (!round.rules.hint || round.hints.length >= setting(values, 'hintCap'))
			throw new RangeError('hint');
		const cell = nextHintCell(round);
		if (cell === null) throw new RangeError('hint');
		next.hints = [...round.hints, cell];
	} else if (action === 5 && round.rules.timing) {
		next.status = 'timeout';
	} else if (action === 6) {
		next.cuts = [];
		next.history = [];
		next.pieces = [round.board.cells.map((_, index) => index)];
		next.mistakes = 0;
		next.restarts++;
	} else throw new RangeError('action');
	return next;
}

export function shapeDivisionScore(
	round: ShapeDivisionRound,
	seconds: number,
	values?: ScoreValues
) {
	if (round.status !== 'won') return 0;
	const points =
		Math.max(
			setting(values, 'timeFloorPoints'),
			setting(values, 'completionPoints') - seconds * setting(values, 'pointsPerSecond')
		) -
		round.hints.length * setting(values, 'hintCost') -
		round.mistakes * setting(values, 'mistakeCost') -
		round.restarts * setting(values, 'restartCost') +
		(round.rules.timing
			? Math.max(0, SHAPE_DIVISION_COUNTDOWN - seconds) * setting(values, 'countdownBonusPerSecond')
			: 0);
	const standard = Math.max(0, Math.min(SCORE_MAX, points));
	return round.rules.scoring ? scoreForEquality(standard, equalityPercent(round)) : standard;
}

export function scoreForEquality(standard: number, percentage: number) {
	return Math.floor((standard * percentage) / 100);
}
