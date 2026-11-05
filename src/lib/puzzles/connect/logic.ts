import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring as scoringDefinition } from './scoring.js';
import { createRng, shuffle } from '#lib/engine/rng.js';

export const CONNECT_ENGINE_VERSION = 'connect-1';
export const CONNECT_BANDS = [
	{ size: 5, pairs: 5, par: 90 },
	{ size: 6, pairs: 6, par: 125 },
	{ size: 7, pairs: 8, par: 165 }
] as const;

export const CONNECT_VARIANTS = [
	'connect:classic',
	'connect:full-grid',
	'connect:board-8',
	'connect:rush-60'
] as const;
export type ConnectVariant = (typeof CONNECT_VARIANTS)[number];

export function parseConnectVariant(variant?: string): ConnectVariant {
	if (variant === undefined) return 'connect:classic';
	if (!CONNECT_VARIANTS.includes(variant as ConnectVariant)) throw new RangeError('variant');
	return variant as ConnectVariant;
}

export interface ConnectPair {
	a: number;
	b: number;
}
export interface ConnectMove extends Move {
	pair: number;
	cell: number;
	stroke: number;
	at: number;
}
export interface ConnectRound {
	seed: string;
	variant?: ConnectVariant;
	band: number;
	size: number;
	par: number;
	pairs: ConnectPair[];
	/** A witness for generation tests; never used to judge a player's solution. */
	solution: number[][];
	paths: number[][];
	everConnected: boolean[];
	penalties: number;
	strokes: number;
	lastAt: number;
	lastCell: number;
	status: 'playing' | 'won';
}

function neighbors(cell: number, size: number): number[] {
	const row = Math.floor(cell / size),
		column = cell % size;
	const result: number[] = [];
	if (row > 0) result.push(cell - size);
	if (row + 1 < size) result.push(cell + size);
	if (column > 0) result.push(cell - 1);
	if (column + 1 < size) result.push(cell + 1);
	return result;
}
function adjacent(a: number, b: number, size: number): boolean {
	return neighbors(a, size).includes(b);
}

export function createConnectRound(seed: string, variant?: string): ConnectRound {
	const selectedVariant = parseConnectVariant(variant);
	const rng = createRng(seed);
	let band: number;
	let size: number;
	let pairs: number;
	let par: number;
	if (selectedVariant === 'connect:board-8') {
		band = 4;
		size = 8;
		pairs = 8;
		par = 210;
	} else {
		const bandIndex = rng.nextInt(CONNECT_BANDS.length);
		const bandConfig = CONNECT_BANDS[bandIndex]!;
		band = bandIndex + 1;
		size = bandConfig.size;
		pairs = bandConfig.pairs;
		par = bandConfig.par;
	}
	const total = size * size;
	let path: number[] = [];
	for (let row = 0; row < size; row++) {
		for (let step = 0; step < size; step++)
			path.push(row * size + (row % 2 === 0 ? step : size - step - 1));
	}
	// A bounded backbite preserves a Hamiltonian path after every step.
	for (let step = 0; step < total * 6; step++) {
		const end = path[total - 1]!;
		const options = neighbors(end, size)
			.map((cell) => path.indexOf(cell))
			.filter((at) => at < total - 2);
		if (options.length) {
			const at = options[rng.nextInt(options.length)]!;
			path = [...path.slice(0, at + 1), ...path.slice(at + 1).reverse()];
		}
	}
	if (rng.nextInt(2)) path.reverse();
	const lengths = Array<number>(pairs).fill(3);
	let rest = total - 3 * pairs;
	const maxLength = selectedVariant === 'connect:board-8' ? 16 : 12;
	while (rest > 0) {
		const at = rng.nextInt(pairs);
		if (lengths[at]! < maxLength) {
			lengths[at]!++;
			rest--;
		}
	}
	const segments: number[][] = [];
	let offset = 0;
	for (const length of shuffle(rng, lengths)) {
		segments.push(path.slice(offset, offset + length));
		offset += length;
	}
	const order = shuffle(rng, segments);
	return {
		seed,
		...(selectedVariant === 'connect:classic' ? {} : { variant: selectedVariant }),
		band,
		size,
		par,
		pairs: order.map((cells) => ({ a: cells[0]!, b: cells[cells.length - 1]! })),
		solution: order,
		paths: order.map(() => []),
		everConnected: order.map(() => false),
		penalties: 0,
		strokes: 0,
		lastAt: -1,
		lastCell: -1,
		status: 'playing'
	};
}

export function connected(round: ConnectRound, pair: number): boolean {
	const path = round.paths[pair] ?? [];
	const endpoints = round.pairs[pair];
	return Boolean(
		endpoints &&
		path.length > 1 &&
		((path[0] === endpoints.a && path[path.length - 1] === endpoints.b) ||
			(path[0] === endpoints.b && path[path.length - 1] === endpoints.a))
	);
}
export function filledCount(round: ConnectRound): number {
	return round.paths.reduce((sum, path) => sum + path.length, 0);
}
export function connectedCount(round: ConnectRound): number {
	return round.pairs.reduce((count, _, pair) => count + Number(connected(round, pair)), 0);
}
export function connectScore(
	round: ConnectRound,
	seconds: number,
	scoring: ScoreValues = scoringDefinition.defaults
): number {
	if (!Number.isSafeInteger(seconds) || seconds < 0) throw new RangeError('elapsed');
	const pairs = connectedCount(round);
	return Math.max(
		0,
		pairs * scoring.pair! +
			(round.status === 'won'
				? (filledCount(round) === round.size * round.size ? scoring.grid! : 0) +
					Math.max(0, round.par - seconds) * scoring.second!
				: 0) -
			(round.penalties / 50) * scoring.redraw!
	);
}

/** A move is one visited cell in a pointer stroke. Invalid replay moves throw. */
export function applyConnectMove(round: ConnectRound, move: ConnectMove): ConnectRound {
	const { pair, cell, stroke, at } = move;
	if (
		round.status !== 'playing' ||
		![pair, cell, stroke, at].every(Number.isSafeInteger) ||
		pair < 0 ||
		pair >= round.pairs.length ||
		cell < 0 ||
		cell >= round.size * round.size ||
		stroke < 0 ||
		stroke > round.strokes ||
		at < 0 ||
		at < round.lastAt ||
		at > 7_200_000
	)
		throw new RangeError('move');
	const paths = round.paths.map((path) => path.slice());
	const owner = Array<number>(round.size * round.size).fill(-1);
	for (let i = 0; i < paths.length; i++) for (const used of paths[i]!) owner[used] = i;
	const endpoint = round.pairs.findIndex(({ a, b }) => a === cell || b === cell);
	let penalties = round.penalties;
	let strokes = round.strokes;
	if (stroke === round.strokes) {
		// The first cell of each stroke is an endpoint or a cell in that pair's path.
		if (endpoint !== pair && owner[cell] !== pair) throw new RangeError('stroke_start');
		if (round.everConnected[pair]) penalties += 50;
		strokes++;
		const old = paths[pair]!;
		paths[pair] = endpoint === pair ? [cell] : old.slice(0, old.indexOf(cell) + 1);
	} else {
		if (
			stroke !== round.strokes - 1 ||
			pair !== round.paths.findIndex((path) => path.includes(round.lastCell))
		)
			throw new RangeError('stroke_order');
		const path = paths[pair]!;
		const head = path[path.length - 1]!;
		if (!adjacent(head, cell, round.size) || cell === head || connected(round, pair))
			throw new RangeError('step');
		const previous = path.indexOf(cell);
		if (previous >= 0) paths[pair] = path.slice(0, previous + 1);
		else {
			if (endpoint >= 0 && endpoint !== pair) throw new RangeError('foreign_endpoint');
			if (owner[cell] >= 0 && owner[cell] !== pair) {
				const other = owner[cell];
				paths[other] = paths[other]!.slice(0, paths[other]!.indexOf(cell));
			}
			paths[pair] = [...path, cell];
		}
	}
	const next: ConnectRound = {
		...round,
		paths,
		penalties,
		strokes,
		lastAt: at,
		lastCell: cell,
		everConnected: round.everConnected.slice()
	};
	for (let i = 0; i < paths.length; i++) if (connected(next, i)) next.everConnected[i] = true;
	const allPairsConnected = connectedCount(next) === next.pairs.length;
	if (round.variant === 'connect:full-grid') {
		if (allPairsConnected && filledCount(next) === next.size * next.size) next.status = 'won';
	} else {
		if (allPairsConnected) next.status = 'won';
	}
	return next;
}
