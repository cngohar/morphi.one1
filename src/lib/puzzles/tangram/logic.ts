import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { createRng, shuffle } from '#lib/engine/rng.js';
import { scoring as scoringDefinition, doubleScoring, mapScoring } from './scoring.js';

export const TANGRAM_ENGINE_VERSION = 'tangram-1';
export const TANGRAM_VARIANTS = [
	'tangram:classic',
	'tangram:flip-off',
	'tangram:sei-shonagon',
	'tangram:double-14',
	'tangram:coloured-map',
	'tangram:no-full-size',
	'tangram:countdown-120',
	'tangram:mistake-limit-4',
	'tangram:falling-pieces',
	'tangram:hint-budget-3',
	'tangram:no-hint'
] as const;
export type TangramVariant = (typeof TANGRAM_VARIANTS)[number];
export const TANGRAM_ACTION = { hint: 1, reset: 2, remove: 3, peek: 4, tick: 5 } as const;
export type TangramRules = {
	cut: number;
	copies: number;
	flip: boolean;
	map: boolean;
	fullSize: boolean;
	timeLimit: number;
	mistakeLimit: number;
	falling: boolean;
	hintLimit: number;
	par: number;
};
export function tangramRules(variant?: string): TangramRules {
	const selected = parseTangramVariant(variant);
	return {
		cut: Number(selected === 'tangram:sei-shonagon'),
		copies: selected === 'tangram:double-14' ? 2 : 1,
		flip: selected !== 'tangram:flip-off',
		map: selected === 'tangram:coloured-map',
		fullSize: selected !== 'tangram:no-full-size',
		timeLimit: selected === 'tangram:countdown-120' ? 120 : 0,
		mistakeLimit: selected === 'tangram:mistake-limit-4' ? 4 : 0,
		falling: selected === 'tangram:falling-pieces',
		hintLimit: selected === 'tangram:hint-budget-3' ? 3 : selected === 'tangram:no-hint' ? 0 : -1,
		par:
			selected === 'tangram:double-14'
				? 120
				: selected === 'tangram:no-full-size' || selected === 'tangram:falling-pieces'
					? 90
					: selected === 'tangram:coloured-map'
						? 30
						: selected === 'tangram:countdown-120'
							? 0
							: 60
	};
}

/** Each coordinate is (p + q√2) / 4, in small-triangle-leg units. */
export interface TangramPoint {
	xp: number;
	xq: number;
	yp: number;
	yq: number;
}
export interface TangramPlacement extends TangramPoint {
	rot: number;
	flip: number;
}
export interface TangramPlacementMove extends TangramPlacement, Move {
	piece: number;
}
export type TangramMove = Move;
export interface TangramSilhouette {
	id: string;
	name: string;
	outline: readonly TangramPoint[];
	witness: readonly TangramPlacementMove[];
}
export interface TangramRound {
	seed: string;
	variant?: TangramVariant;
	rules: TangramRules;
	silhouette: Pick<TangramSilhouette, 'id' | 'name' | 'outline'>;
	placements: (TangramPlacement | null)[];
	status: 'playing' | 'won' | 'lost';
	hintsUsed: number;
	mistakes: number;
	moves: number;
	lastAt: number;
	arrivalOrder: number[];
}

type Scalar = readonly [bigint, bigint];
const add = (a: Scalar, b: Scalar): Scalar => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Scalar, b: Scalar): Scalar => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Scalar, b: Scalar): Scalar => [
	a[0] * b[0] + 2n * a[1] * b[1],
	a[0] * b[1] + a[1] * b[0]
];
function sign([p, q]: Scalar): number {
	if (p === 0n) return q > 0n ? 1 : q < 0n ? -1 : 0;
	if (q === 0n || p > 0n === q > 0n) return p > 0n ? 1 : -1;
	const squared = p * p - 2n * q * q;
	return (squared > 0n ? 1 : -1) * (p > 0n ? 1 : -1);
}
const x = (point: TangramPoint): Scalar => [BigInt(point.xp), BigInt(point.xq)];
const y = (point: TangramPoint): Scalar => [BigInt(point.yp), BigInt(point.yq)];
const compareX = (a: TangramPoint, b: TangramPoint): number => sign(sub(x(a), x(b)));
const compareY = (a: TangramPoint, b: TangramPoint): number => sign(sub(y(a), y(b)));
function cross(a: TangramPoint, b: TangramPoint, c: TangramPoint): Scalar {
	return sub(mul(sub(x(b), x(a)), sub(y(c), y(a))), mul(sub(y(b), y(a)), sub(x(c), x(a))));
}
function onSegment(point: TangramPoint, a: TangramPoint, b: TangramPoint): boolean {
	return (
		sign(cross(a, b, point)) === 0 &&
		compareX(point, a) * compareX(point, b) <= 0 &&
		compareY(point, a) * compareY(point, b) <= 0
	);
}
function properIntersection(
	a: TangramPoint,
	b: TangramPoint,
	c: TangramPoint,
	d: TangramPoint
): boolean {
	return (
		sign(cross(a, b, c)) * sign(cross(a, b, d)) < 0 &&
		sign(cross(c, d, a)) * sign(cross(c, d, b)) < 0
	);
}
export function tangramPointInside(point: TangramPoint, polygon: readonly TangramPoint[]): boolean {
	let winding = 0;
	for (let index = 0; index < polygon.length; index++) {
		const a = polygon[index]!,
			b = polygon[(index + 1) % polygon.length]!;
		if (onSegment(point, a, b)) return true;
		if (compareY(a, point) <= 0 && compareY(b, point) > 0 && sign(cross(a, b, point)) > 0)
			winding++;
		if (compareY(a, point) > 0 && compareY(b, point) <= 0 && sign(cross(a, b, point)) < 0)
			winding--;
	}
	return winding !== 0;
}
function scalePoint(point: TangramPoint, scale: number): TangramPoint {
	return { xp: point.xp * scale, xq: point.xq * scale, yp: point.yp * scale, yq: point.yq * scale };
}
function segmentInside(
	a: TangramPoint,
	b: TangramPoint,
	polygon: readonly TangramPoint[]
): boolean {
	if (!tangramPointInside(a, polygon) || !tangramPointInside(b, polygon)) return false;
	for (let index = 0; index < polygon.length; index++)
		if (properIntersection(a, b, polygon[index]!, polygon[(index + 1) % polygon.length]!))
			return false;
	const cuts = [a, b, ...polygon.filter((point) => onSegment(point, a, b))];
	cuts.sort(compareX(a, b) === 0 ? compareY : compareX);
	const doubled = polygon.map((point) => scalePoint(point, 2));
	for (let index = 1; index < cuts.length; index++) {
		const p = cuts[index - 1]!,
			q = cuts[index]!;
		// Doubling the polygon keeps interval midpoints in the integer-pair encoding.
		if (
			!tangramPointInside(
				{ xp: p.xp + q.xp, xq: p.xq + q.xq, yp: p.yp + q.yp, yq: p.yq + q.yq },
				doubled
			)
		)
			return false;
	}
	return true;
}
export function tangramPolygonInside(
	inner: readonly TangramPoint[],
	outer: readonly TangramPoint[]
): boolean {
	return inner.every((point, index) =>
		segmentInside(point, inner[(index + 1) % inner.length]!, outer)
	);
}
/** Strict SAT: an edge or point contact is permitted, an interior overlap is not. */
export function tangramPolygonsOverlap(
	a: readonly TangramPoint[],
	b: readonly TangramPoint[]
): boolean {
	for (const polygon of [a, b]) {
		for (let index = 0; index < polygon.length; index++) {
			const origin = polygon[index]!,
				end = polygon[(index + 1) % polygon.length]!;
			const first = a.map((point) => cross(origin, end, point)).sort((u, v) => sign(sub(u, v)));
			const second = b.map((point) => cross(origin, end, point)).sort((u, v) => sign(sub(u, v)));
			if (
				sign(sub(first[first.length - 1]!, second[0]!)) <= 0 ||
				sign(sub(second[second.length - 1]!, first[0]!)) <= 0
			)
				return false;
		}
	}
	return true;
}
function polygonsTouch(a: readonly TangramPoint[], b: readonly TangramPoint[]): boolean {
	return (
		a.some((point) =>
			b.some((vertex, index) => onSegment(point, vertex, b[(index + 1) % b.length]!))
		) ||
		b.some((point) =>
			a.some((vertex, index) => onSegment(point, vertex, a[(index + 1) % a.length]!))
		)
	);
}
/** Twice the area, with the coordinate denominator 16 retained. */
export function tangramArea2(polygon: readonly TangramPoint[]): Scalar {
	let area: Scalar = [0n, 0n];
	for (let index = 0; index < polygon.length; index++) {
		const a = polygon[index]!,
			b = polygon[(index + 1) % polygon.length]!;
		area = add(area, sub(mul(x(a), y(b)), mul(y(a), x(b))));
	}
	return sign(area) < 0 ? [-area[0], -area[1]] : area;
}

const diagonalPoint = ([xq, yq]: readonly number[]): TangramPoint => ({
	xp: 0,
	xq: xq!,
	yp: 0,
	yq: yq!
});
export const TANGRAM_PIECES = [
	{
		id: 'large1',
		name: 'tangram.piece.large1',
		polygon: [
			[0, 0],
			[8, 0],
			[4, 4]
		].map(diagonalPoint)
	},
	{
		id: 'large2',
		name: 'tangram.piece.large2',
		polygon: [
			[0, 0],
			[8, 0],
			[4, 4]
		].map(diagonalPoint)
	},
	{
		id: 'medium',
		name: 'tangram.piece.medium',
		polygon: [
			[0, 0],
			[4, 0],
			[4, 4]
		].map(diagonalPoint)
	},
	{
		id: 'small1',
		name: 'tangram.piece.small1',
		polygon: [
			[0, 0],
			[4, 0],
			[2, 2]
		].map(diagonalPoint)
	},
	{
		id: 'small2',
		name: 'tangram.piece.small2',
		polygon: [
			[0, 0],
			[4, 0],
			[2, 2]
		].map(diagonalPoint)
	},
	{
		id: 'square',
		name: 'tangram.piece.square',
		polygon: [
			[0, 0],
			[2, 2],
			[0, 4],
			[-2, 2]
		].map(diagonalPoint)
	},
	{
		id: 'para',
		name: 'tangram.piece.para',
		polygon: [
			[0, 0],
			[4, 0],
			[6, 2],
			[2, 2]
		].map(diagonalPoint)
	}
] as const;

export interface TangramPiece {
	id: string;
	name: string;
	polygon: readonly TangramPoint[];
}
// Fox-Epstein & Uehara, CCCG 2014, Figure 1 (right); local origins only are changed.
export const TANGRAM_SEI_PIECES: readonly TangramPiece[] = [
	{
		id: 'right-trapezoid',
		name: 'tangram.piece.sei.right-trapezoid',
		polygon: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 0, xq: -2, yp: 0, yq: -2 },
			{ xp: 0, xq: 2, yp: 0, yq: -6 },
			{ xp: 0, xq: 2, yp: 0, yq: -2 }
		]
	},
	{
		id: 'square',
		name: 'tangram.piece.sei.square',
		polygon: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 0, xq: 2, yp: 0, yq: -2 },
			{ xp: 0, xq: 4, yp: 0, yq: 0 },
			{ xp: 0, xq: 2, yp: 0, yq: 2 }
		]
	},
	{
		id: 'small',
		name: 'tangram.piece.sei.small',
		polygon: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 0, xq: -4, yp: 0, yq: 0 },
			{ xp: 0, xq: -2, yp: 0, yq: -2 }
		]
	},
	{
		id: 'triangle-a',
		name: 'tangram.piece.sei.triangle-a',
		polygon: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 0, xq: 4, yp: 0, yq: 0 },
			{ xp: 0, xq: 0, yp: 0, yq: 4 }
		]
	},
	{
		id: 'large-trapezoid',
		name: 'tangram.piece.sei.large-trapezoid',
		polygon: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 0, xq: -6, yp: 0, yq: 6 },
			{ xp: 0, xq: -6, yp: 0, yq: 2 },
			{ xp: 0, xq: -4, yp: 0, yq: 0 }
		]
	},
	{
		id: 'triangle-b',
		name: 'tangram.piece.sei.triangle-b',
		polygon: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 0, xq: 0, yp: 0, yq: -4 },
			{ xp: 0, xq: -4, yp: 0, yq: 0 }
		]
	},
	{
		id: 'parallelogram',
		name: 'tangram.piece.sei.parallelogram',
		polygon: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 0, xq: -2, yp: 0, yq: 2 },
			{ xp: 0, xq: -6, yp: 0, yq: 2 },
			{ xp: 0, xq: -4, yp: 0, yq: 0 }
		]
	}
];
const doublePieces: readonly TangramPiece[] = [...TANGRAM_PIECES, ...TANGRAM_PIECES];
export function tangramPieces(roundOrRules: TangramRound | TangramRules): readonly TangramPiece[] {
	const rules = 'rules' in roundOrRules ? roundOrRules.rules : roundOrRules;
	return rules.cut ? TANGRAM_SEI_PIECES : rules.copies === 2 ? doublePieces : TANGRAM_PIECES;
}

function orientedPolygon(
	polygon: readonly TangramPoint[],
	rot: number,
	flip: number
): TangramPoint[] {
	return polygon.map((point) => {
		let { xp, xq, yp, yq } = point;
		if (flip) {
			xp = -xp;
			xq = -xq;
		}
		for (let step = 0; step < rot; step++) {
			const next = { xp: xq - yq, xq: (xp - yp) / 2, yp: xq + yq, yq: (xp + yp) / 2 };
			({ xp, xq, yp, yq } = next);
		}
		return { xp, xq, yp, yq };
	});
}
const orientations = [TANGRAM_PIECES, TANGRAM_SEI_PIECES].map((pieces) =>
	pieces.map(({ polygon }) =>
		[0, 1].map((flip) => Array.from({ length: 8 }, (_, rot) => orientedPolygon(polygon, rot, flip)))
	)
);
export function tangramPiecePolygon(
	piece: number,
	placement: TangramPlacement,
	rules: TangramRules = tangramRules()
): TangramPoint[] {
	if (piece < 0 || piece >= tangramPieces(rules).length) throw new RangeError('piece');
	const polygon = orientations[rules.cut]?.[piece % 7]?.[placement.flip]?.[placement.rot];
	if (!polygon) throw new RangeError('orientation');
	return polygon.map((point) => ({
		xp: point.xp + placement.xp,
		xq: point.xq + placement.xq,
		yp: point.yp + placement.yp,
		yq: point.yq + placement.yq
	}));
}

function silhouette(
	id: string,
	name: string,
	outline: number[][],
	witness: number[][]
): TangramSilhouette {
	return {
		id,
		name,
		outline: outline.map(([xp, xq, yp, yq]) => ({ xp: xp!, xq: xq!, yp: yp!, yq: yq! })),
		witness: witness.map(([piece, xp, xq, yp, yq, rot, flip]) => ({
			piece: piece!,
			xp: xp!,
			xq: xq!,
			yp: yp!,
			yq: yq!,
			rot: rot!,
			flip: flip!
		}))
	};
}
// Convex mathematical outlines were redrawn from public-domain solution grids.
// Every frozen assembly is re-proven by this exact engine before issuance.
export const TANGRAM_SILHOUETTES: readonly TangramSilhouette[] = [
	silhouette(
		'right-trapezium-wide',
		'Wide right trapezium',
		[
			[0, 0, 0, 0],
			[0, 4, 0, 0],
			[0, 12, 0, 8],
			[0, 0, 0, 8]
		],
		[
			[0, 0, 12, 0, 8, 4, 0],
			[1, 0, 0, 0, 8, 6, 0],
			[2, 0, 4, 0, 4, 2, 0],
			[3, 0, 6, 0, 6, 6, 0],
			[4, 0, 0, 0, 0, 0, 0],
			[5, 0, 4, 0, 0, 0, 0],
			[6, 0, 6, 0, 2, 2, 0]
		]
	),
	silhouette(
		'pentagon-wide',
		'Wide pentagon',
		[
			[0, 0, 0, 6],
			[0, 6, 0, 0],
			[0, 14, 0, 0],
			[0, 14, 0, 4],
			[0, 12, 0, 6]
		],
		[
			[0, 0, 8, 0, 6, 4, 0],
			[1, 0, 6, 0, 0, 0, 0],
			[2, 0, 12, 0, 2, 2, 0],
			[3, 0, 6, 0, 4, 0, 0],
			[4, 0, 10, 0, 4, 4, 0],
			[5, 0, 6, 0, 0, 0, 0],
			[6, 0, 14, 0, 0, 2, 0]
		]
	),
	silhouette(
		'pentagon-tall',
		'Tall pentagon',
		[
			[0, 0, 8, 0],
			[8, 0, 0, 0],
			[16, 0, 8, 0],
			[16, 0, 12, 0],
			[0, 0, 12, 0]
		],
		[
			[0, 0, 0, 8, 0, 7, 0],
			[1, 8, 0, 0, 0, 1, 0],
			[2, 0, 0, 12, 0, 7, 0],
			[3, 4, 0, 8, 0, 3, 0],
			[4, 12, 0, 12, 0, 5, 0],
			[5, 16, 0, 8, 0, 1, 0],
			[6, 12, 0, 12, 0, 1, 1]
		]
	),
	silhouette(
		'parallelogram',
		'Parallelogram',
		[
			[0, 0, 0, 8],
			[0, 8, 0, 0],
			[0, 16, 0, 0],
			[0, 8, 0, 8]
		],
		[
			[0, 0, 8, 0, 8, 4, 0],
			[1, 0, 8, 0, 0, 0, 0],
			[2, 0, 12, 0, 4, 4, 0],
			[3, 0, 6, 0, 2, 2, 0],
			[4, 0, 8, 0, 4, 0, 0],
			[5, 0, 8, 0, 4, 0, 0],
			[6, 0, 8, 0, 0, 2, 0]
		]
	),
	silhouette(
		'hexagon-a',
		'Hexagon A',
		[
			[0, 0, 0, 4],
			[0, 4, 0, 0],
			[0, 12, 0, 0],
			[0, 14, 0, 2],
			[0, 10, 0, 6],
			[0, 2, 0, 6]
		],
		[
			[0, 0, 8, 0, 4, 4, 0],
			[1, 0, 4, 0, 0, 0, 0],
			[2, 0, 10, 0, 2, 2, 0],
			[3, 0, 4, 0, 4, 0, 0],
			[4, 0, 10, 0, 6, 6, 0],
			[5, 0, 12, 0, 0, 0, 0],
			[6, 0, 0, 0, 4, 0, 0]
		]
	),
	silhouette(
		'pyramid',
		'Pyramid',
		[
			[0, 0, 0, 8],
			[0, 8, 0, 0],
			[0, 16, 0, 8]
		],
		[
			[0, 0, 8, 0, 8, 4, 0],
			[1, 0, 16, 0, 8, 4, 0],
			[2, 0, 12, 0, 4, 4, 0],
			[3, 0, 6, 0, 6, 0, 0],
			[4, 0, 8, 0, 0, 2, 0],
			[5, 0, 6, 0, 2, 0, 0],
			[6, 0, 12, 0, 4, 0, 1]
		]
	),
	silhouette(
		'square',
		'Square',
		[
			[0, 0, 0, 0],
			[0, 8, 0, 0],
			[0, 8, 0, 8],
			[0, 0, 0, 8]
		],
		[
			[0, 0, 8, 0, 8, 4, 0],
			[1, 0, 8, 0, 0, 2, 0],
			[2, 0, 0, 0, 4, 6, 0],
			[3, 0, 2, 0, 6, 6, 0],
			[4, 0, 4, 0, 0, 0, 0],
			[5, 0, 4, 0, 0, 0, 0],
			[6, 0, 2, 0, 2, 2, 0]
		]
	),
	silhouette(
		'rectangle',
		'Rectangle',
		[
			[0, 0, 0, 0],
			[8, 0, 0, 0],
			[8, 0, 16, 0],
			[0, 0, 16, 0]
		],
		[
			[0, 8, 0, 16, 0, 5, 0],
			[1, 0, 0, 8, 0, 1, 0],
			[2, 0, 0, 8, 0, 7, 0],
			[3, 4, 0, 4, 0, 3, 0],
			[4, 8, 0, 4, 0, 5, 0],
			[5, 4, 0, 0, 0, 1, 0],
			[6, 4, 0, 0, 0, 1, 0]
		]
	),
	silhouette(
		'hexagon-b',
		'Hexagon B',
		[
			[0, 0, 0, 4],
			[0, 4, 0, 0],
			[0, 8, 0, 0],
			[0, 12, 0, 4],
			[0, 8, 0, 8],
			[0, 4, 0, 8]
		],
		[
			[0, 0, 0, 0, 4, 0, 0],
			[1, 0, 8, 0, 4, 4, 0],
			[2, 0, 4, 0, 0, 0, 0],
			[3, 0, 10, 0, 6, 6, 0],
			[4, 0, 8, 0, 8, 4, 0],
			[5, 0, 8, 0, 4, 0, 0],
			[6, 0, 10, 0, 6, 2, 1]
		]
	),
	silhouette(
		'hexagon-c',
		'Hexagon C',
		[
			[0, 0, 4, 0],
			[4, 0, 0, 0],
			[8, 0, 0, 0],
			[12, 0, 4, 0],
			[12, 0, 12, 0],
			[0, 0, 12, 0]
		],
		[
			[0, 0, 0, 12, 0, 7, 0],
			[1, 8, 0, 4, 0, 3, 0],
			[2, 0, 0, 4, 0, 7, 0],
			[3, 8, 0, 8, 0, 7, 0],
			[4, 12, 0, 4, 0, 3, 0],
			[5, 12, 0, 8, 0, 1, 0],
			[6, 12, 0, 4, 0, 1, 1]
		]
	),
	silhouette(
		'trapezium',
		'Trapezium',
		[
			[0, 0, 8, 0],
			[8, 0, 0, 0],
			[16, 0, 0, 0],
			[24, 0, 8, 0]
		],
		[
			[0, 0, 0, 8, 0, 7, 0],
			[1, 16, 0, 0, 0, 1, 0],
			[2, 16, 0, 8, 0, 5, 0],
			[3, 12, 0, 0, 0, 3, 0],
			[4, 12, 0, 4, 0, 1, 0],
			[5, 12, 0, 4, 0, 1, 0],
			[6, 16, 0, 0, 0, 3, 0]
		]
	),
	silhouette(
		'right-trapezium-long',
		'Long right trapezium',
		[
			[0, 0, 8, 0],
			[8, 0, 0, 0],
			[20, 0, 0, 0],
			[20, 0, 8, 0]
		],
		[
			[0, 0, 0, 8, 0, 7, 0],
			[1, 16, 0, 0, 0, 3, 0],
			[2, 12, 0, 8, 0, 7, 0],
			[3, 12, 0, 4, 0, 7, 0],
			[4, 20, 0, 8, 0, 5, 0],
			[5, 20, 0, 0, 0, 1, 0],
			[6, 16, 0, 4, 0, 3, 0]
		]
	),
	silhouette(
		'hexagon-d',
		'Hexagon D',
		[
			[0, 0, 4, 0],
			[4, 0, 0, 0],
			[16, 0, 0, 0],
			[20, 0, 4, 0],
			[16, 0, 8, 0],
			[4, 0, 8, 0]
		],
		[
			[0, 12, 0, 0, 0, 3, 0],
			[1, 4, 0, 8, 0, 7, 0],
			[2, 4, 0, 8, 0, 5, 0],
			[3, 12, 0, 0, 0, 1, 0],
			[4, 20, 0, 4, 0, 3, 0],
			[5, 16, 0, 4, 0, 1, 0],
			[6, 20, 0, 4, 0, 1, 1]
		]
	),
	silhouette(
		'house',
		'House',
		[
			[0, 0, 0, 0],
			[0, 0, 0, 12],
			[0, 8, 0, 4],
			[0, 8, 0, 0]
		],
		[
			[0, 0, 0, 0, 0, 0, 0],
			[1, 0, 0, 0, 8, 6, 0],
			[2, 0, 6, 0, 2, 2, 0],
			[3, 0, 2, 0, 6, 0, 0],
			[4, 0, 0, 0, 12, 6, 0],
			[5, 0, 2, 0, 6, 0, 0],
			[6, 0, 8, 0, 0, 2, 0]
		]
	),
	silhouette(
		'cat',
		'Cat',
		[
			[0, 2, 0, 10],
			[0, 4, 0, 12],
			[0, 4, 0, 8],
			[0, 2, 0, 6],
			[0, 10, 0, -2],
			[0, 6, 0, -2],
			[0, 4, 0, 0],
			[0, 4, 0, -4],
			[0, 0, 0, 0],
			[0, 0, 0, 12]
		],
		[
			[0, 0, 0, 0, 0, 0, 0],
			[1, 0, 0, 0, 8, 6, 0],
			[2, 0, 4, 0, -4, 2, 0],
			[3, 0, 0, 0, 12, 6, 0],
			[4, 0, 4, 0, 8, 2, 0],
			[5, 0, 2, 0, 6, 0, 0],
			[6, 0, 10, 0, -2, 0, 1]
		]
	),
	silhouette(
		'swan',
		'Swan',
		[
			[0, 0, 0, 0],
			[0, 4, 0, 0],
			[0, 6, 0, -2],
			[0, 10, 0, -2],
			[0, 10, 0, 2],
			[0, 8, 0, 4],
			[0, 4, 0, 4],
			[0, 4, 0, 12],
			[0, 0, 0, 8],
			[0, 2, 0, 6],
			[0, 0, 0, 4],
			[0, 2, 0, 2]
		],
		[
			[0, 0, 0, 0, 0, 0, 0],
			[1, 0, 4, 0, 4, 2, 0],
			[2, 0, 8, 0, 0, 2, 0],
			[3, 0, 6, 0, -2, 0, 0],
			[4, 0, 8, 0, 0, 4, 0],
			[5, 0, 2, 0, 2, 0, 0],
			[6, 0, 10, 0, -2, 2, 0]
		]
	),
	silhouette(
		'bird',
		'Bird',
		[
			[0, -4, 0, 0],
			[0, 0, 0, -4],
			[0, 4, 0, 0],
			[0, 6, 0, -2],
			[4, 6, 0, -2],
			[8, 6, 4, -2],
			[0, 6, 4, -2],
			[0, 6, 0, 2],
			[0, 0, 0, 8],
			[0, -2, 0, 6],
			[0, 0, 0, 4],
			[0, 0, 0, 0]
		],
		[
			[0, 0, 0, 0, 8, 6, 0],
			[1, 0, 4, 0, 0, 4, 0],
			[2, 0, 0, 0, 0, 0, 0],
			[3, 0, 0, 0, 4, 2, 0],
			[4, 4, 6, 0, -2, 1, 0],
			[5, 0, 6, 0, -2, 7, 0],
			[6, 0, 4, 0, 4, 6, 0]
		]
	),
	silhouette(
		'boat',
		'Boat',
		[
			[0, 0, 0, 0],
			[0, 8, 0, -8],
			[0, 8, 0, 0],
			[16, 0, 0, 0],
			[8, 0, 8, 0]
		],
		[
			[0, 0, 8, 0, 0, 4, 0],
			[1, 0, 8, 0, -8, 2, 0],
			[2, 12, 0, 4, 0, 3, 0],
			[3, 12, 0, 0, 0, 3, 0],
			[4, 4, 0, 4, 0, 5, 0],
			[5, 4, 0, 0, 0, 7, 0],
			[6, 8, 0, 4, 0, 7, 0]
		]
	)
];

// Figure 8 configurations are redrawn on their exact unit grid. Whole targets
// are reflected where necessary so only the parallelogram needs flipping.
export const TANGRAM_SEI_SILHOUETTES: readonly TangramSilhouette[] = [
	{
		id: 'sei-convex-1',
		name: 'Long rectangle',
		outline: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 32, xq: 0, yp: 0, yq: 0 },
			{ xp: 32, xq: 0, yp: 4, yq: 0 },
			{ xp: 0, xq: 0, yp: 4, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 28, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 28, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 0, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 3, xp: 16, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 0, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 5, xp: 20, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 16, xq: 0, yp: 0, yq: 0, rot: 3, flip: 1 }
		]
	},
	{
		id: 'sei-convex-2',
		name: 'Quadrilateral',
		outline: [
			{ xp: 0, xq: 0, yp: 4, yq: 0 },
			{ xp: 4, xq: 0, yp: 0, yq: 0 },
			{ xp: 32, xq: 0, yp: 0, yq: 0 },
			{ xp: 36, xq: 0, yp: 4, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 8, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 8, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 16, xq: 0, yp: 0, yq: 0, rot: 7, flip: 0 },
			{ piece: 3, xp: 28, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 16, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 5, xp: 16, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 6, xp: 36, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 }
		]
	},
	{
		id: 'sei-convex-3',
		name: 'Quadrilateral',
		outline: [
			{ xp: 0, xq: 0, yp: 4, yq: 0 },
			{ xp: 4, xq: 0, yp: 0, yq: 0 },
			{ xp: 36, xq: 0, yp: 0, yq: 0 },
			{ xp: 32, xq: 0, yp: 4, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 8, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 8, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 12, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 3, xp: 20, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 24, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 5, xp: 16, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 28, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 }
		]
	},
	{
		id: 'sei-convex-4',
		name: 'Quadrilateral',
		outline: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 8, yq: 0 },
			{ xp: 0, xq: 0, yp: 8, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 16, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 12, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 12, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 3, xp: 8, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 0, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 5, xp: 4, xq: 0, yp: 4, yq: 0, rot: 7, flip: 0 },
			{ piece: 6, xp: 8, xq: 0, yp: 4, yq: 0, rot: 3, flip: 1 }
		]
	},
	{
		id: 'sei-convex-5',
		name: 'Quadrilateral',
		outline: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 20, xq: 0, yp: 0, yq: 0 },
			{ xp: 20, xq: 0, yp: 8, yq: 0 },
			{ xp: 8, xq: 0, yp: 8, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 12, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 1, xp: 8, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 8, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 3, xp: 16, xq: 0, yp: 4, yq: 0, rot: 7, flip: 0 },
			{ piece: 4, xp: 20, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 5, xp: 8, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 8, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 }
		]
	},
	{
		id: 'sei-convex-6',
		name: 'Quadrilateral',
		outline: [
			{ xp: 0, xq: 0, yp: 8, yq: 0 },
			{ xp: 8, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 0, yq: 0 },
			{ xp: 24, xq: 0, yp: 8, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 8, xq: 0, yp: 4, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 8, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 16, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 3, xp: 8, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 24, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 5, xp: 12, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 12, xq: 0, yp: 8, yq: 0, rot: 3, flip: 0 }
		]
	},
	{
		id: 'sei-convex-7',
		name: 'Quadrilateral',
		outline: [
			{ xp: 0, xq: 0, yp: 8, yq: 0 },
			{ xp: 8, xq: 0, yp: 0, yq: 0 },
			{ xp: 24, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 8, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 12, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 12, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 16, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 3, xp: 12, xq: 0, yp: 8, yq: 0, rot: 5, flip: 0 },
			{ piece: 4, xp: 12, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 5, xp: 20, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 20, xq: 0, yp: 4, yq: 0, rot: 3, flip: 1 }
		]
	},
	{
		id: 'sei-convex-8',
		name: 'Hexagon',
		outline: [
			{ xp: 0, xq: 0, yp: 4, yq: 0 },
			{ xp: 4, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 0, yq: 0 },
			{ xp: 20, xq: 0, yp: 4, yq: 0 },
			{ xp: 16, xq: 0, yp: 8, yq: 0 },
			{ xp: 4, xq: 0, yp: 8, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 16, xq: 0, yp: 4, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 12, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 12, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 3, xp: 8, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 0, xq: 0, yp: 4, yq: 0, rot: 5, flip: 0 },
			{ piece: 5, xp: 20, xq: 0, yp: 4, yq: 0, rot: 7, flip: 0 },
			{ piece: 6, xp: 8, xq: 0, yp: 0, yq: 0, rot: 3, flip: 1 }
		]
	},
	{
		id: 'sei-convex-9',
		name: 'Pentagon',
		outline: [
			{ xp: 0, xq: 0, yp: 8, yq: 0 },
			{ xp: 8, xq: 0, yp: 0, yq: 0 },
			{ xp: 20, xq: 0, yp: 0, yq: 0 },
			{ xp: 8, xq: 0, yp: 12, yq: 0 },
			{ xp: 4, xq: 0, yp: 12, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 12, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 8, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 4, xq: 0, yp: 8, yq: 0, rot: 3, flip: 0 },
			{ piece: 3, xp: 16, xq: 0, yp: 4, yq: 0, rot: 3, flip: 0 },
			{ piece: 4, xp: 0, xq: 0, yp: 8, yq: 0, rot: 5, flip: 0 },
			{ piece: 5, xp: 16, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 8, xq: 0, yp: 4, yq: 0, rot: 3, flip: 1 }
		]
	},
	{
		id: 'sei-convex-10',
		name: 'Pentagon',
		outline: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 4, yq: 0 },
			{ xp: 8, xq: 0, yp: 12, yq: 0 },
			{ xp: 0, xq: 0, yp: 4, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 0, xq: 0, yp: 0, yq: 0, rot: 3, flip: 0 },
			{ piece: 1, xp: 8, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 4, xq: 0, yp: 8, yq: 0, rot: 3, flip: 0 },
			{ piece: 3, xp: 8, xq: 0, yp: 4, yq: 0, rot: 3, flip: 0 },
			{ piece: 4, xp: 4, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 5, xp: 8, xq: 0, yp: 12, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 12, xq: 0, yp: 8, yq: 0, rot: 3, flip: 0 }
		]
	},
	{
		id: 'sei-convex-11',
		name: 'Quadrilateral',
		outline: [
			{ xp: 0, xq: 0, yp: 8, yq: 0 },
			{ xp: 8, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 8, yq: 0 },
			{ xp: 8, xq: 0, yp: 16, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 8, xq: 0, yp: 12, yq: 0, rot: 1, flip: 0 },
			{ piece: 1, xp: 4, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 4, xq: 0, yp: 12, yq: 0, rot: 1, flip: 0 },
			{ piece: 3, xp: 8, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 12, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 5, xp: 8, xq: 0, yp: 16, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 16, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 }
		]
	},
	{
		id: 'sei-convex-12',
		name: 'Triangle',
		outline: [
			{ xp: 0, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 0, yq: 0 },
			{ xp: 0, xq: 0, yp: 16, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 4, xq: 0, yp: 8, yq: 0, rot: 7, flip: 0 },
			{ piece: 1, xp: 4, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 12, xq: 0, yp: 4, yq: 0, rot: 7, flip: 0 },
			{ piece: 3, xp: 4, xq: 0, yp: 12, yq: 0, rot: 3, flip: 0 },
			{ piece: 4, xp: 0, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 5, xp: 4, xq: 0, yp: 12, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 16, xq: 0, yp: 0, yq: 0, rot: 3, flip: 1 }
		]
	},
	{
		id: 'sei-convex-13',
		name: 'Hexagon',
		outline: [
			{ xp: 0, xq: 0, yp: 4, yq: 0 },
			{ xp: 4, xq: 0, yp: 0, yq: 0 },
			{ xp: 8, xq: 0, yp: 0, yq: 0 },
			{ xp: 12, xq: 0, yp: 4, yq: 0 },
			{ xp: 12, xq: 0, yp: 12, yq: 0 },
			{ xp: 0, xq: 0, yp: 12, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 8, xq: 0, yp: 8, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 8, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 8, xq: 0, yp: 8, yq: 0, rot: 3, flip: 0 },
			{ piece: 3, xp: 4, xq: 0, yp: 8, yq: 0, rot: 3, flip: 0 },
			{ piece: 4, xp: 12, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 5, xp: 4, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 12, xq: 0, yp: 4, yq: 0, rot: 3, flip: 1 }
		]
	},
	{
		id: 'sei-convex-14',
		name: 'Hexagon',
		outline: [
			{ xp: 0, xq: 0, yp: 8, yq: 0 },
			{ xp: 8, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 0, yq: 0 },
			{ xp: 16, xq: 0, yp: 4, yq: 0 },
			{ xp: 8, xq: 0, yp: 12, yq: 0 },
			{ xp: 0, xq: 0, yp: 12, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 0, xq: 0, yp: 12, yq: 0, rot: 1, flip: 0 },
			{ piece: 1, xp: 12, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 12, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 3, xp: 8, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 12, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 5, xp: 12, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 12, xq: 0, yp: 8, yq: 0, rot: 3, flip: 1 }
		]
	},
	{
		id: 'sei-convex-15',
		name: 'Hexagon',
		outline: [
			{ xp: 0, xq: 0, yp: 4, yq: 0 },
			{ xp: 4, xq: 0, yp: 0, yq: 0 },
			{ xp: 12, xq: 0, yp: 0, yq: 0 },
			{ xp: 12, xq: 0, yp: 8, yq: 0 },
			{ xp: 8, xq: 0, yp: 12, yq: 0 },
			{ xp: 0, xq: 0, yp: 12, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 4, xq: 0, yp: 12, yq: 0, rot: 1, flip: 0 },
			{ piece: 1, xp: 0, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 4, xq: 0, yp: 0, yq: 0, rot: 5, flip: 0 },
			{ piece: 3, xp: 8, xq: 0, yp: 4, yq: 0, rot: 7, flip: 0 },
			{ piece: 4, xp: 12, xq: 0, yp: 8, yq: 0, rot: 1, flip: 0 },
			{ piece: 5, xp: 8, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 0, xq: 0, yp: 8, yq: 0, rot: 3, flip: 0 }
		]
	},
	{
		id: 'sei-convex-16',
		name: 'Quadrilateral',
		outline: [
			{ xp: 0, xq: 0, yp: 12, yq: 0 },
			{ xp: 12, xq: 0, yp: 0, yq: 0 },
			{ xp: 20, xq: 0, yp: 8, yq: 0 },
			{ xp: 16, xq: 0, yp: 12, yq: 0 }
		],
		witness: [
			{ piece: 0, xp: 12, xq: 0, yp: 4, yq: 0, rot: 5, flip: 0 },
			{ piece: 1, xp: 12, xq: 0, yp: 4, yq: 0, rot: 1, flip: 0 },
			{ piece: 2, xp: 16, xq: 0, yp: 4, yq: 0, rot: 5, flip: 0 },
			{ piece: 3, xp: 12, xq: 0, yp: 0, yq: 0, rot: 1, flip: 0 },
			{ piece: 4, xp: 12, xq: 0, yp: 12, yq: 0, rot: 1, flip: 0 },
			{ piece: 5, xp: 12, xq: 0, yp: 12, yq: 0, rot: 1, flip: 0 },
			{ piece: 6, xp: 20, xq: 0, yp: 8, yq: 0, rot: 3, flip: 1 }
		]
	}
];
export const TANGRAM_SEI_SQUARE: TangramSilhouette = {
	id: 'sei-square',
	name: 'Sei square',
	outline: [
		{ xp: 0, xq: 0, yp: 0, yq: 0 },
		{ xp: 0, xq: 8, yp: 0, yq: 0 },
		{ xp: 0, xq: 8, yp: 0, yq: 8 },
		{ xp: 0, xq: 0, yp: 0, yq: 8 }
	],
	witness: [
		{ piece: 0, xp: 0, xq: 6, yp: 0, yq: 6, rot: 0, flip: 0 },
		{ piece: 1, xp: 0, xq: 2, yp: 0, yq: 6, rot: 0, flip: 0 },
		{ piece: 2, xp: 0, xq: 4, yp: 0, yq: 8, rot: 0, flip: 0 },
		{ piece: 3, xp: 0, xq: 0, yp: 0, yq: 0, rot: 0, flip: 0 },
		{ piece: 4, xp: 0, xq: 6, yp: 0, yq: 2, rot: 0, flip: 0 },
		{ piece: 5, xp: 0, xq: 8, yp: 0, yq: 8, rot: 0, flip: 0 },
		{ piece: 6, xp: 0, xq: 8, yp: 0, yq: 0, rot: 0, flip: 0 }
	]
};
const square = TANGRAM_SILHOUETTES.find(({ id }) => id === 'square')!;
const doubleWitness = [
	...square.witness.map((move) => ({ ...move })),
	...square.witness.map((move) => ({ ...move, piece: move.piece + 7, xq: move.xq + 8 }))
];
export const TANGRAM_DOUBLE_SILHOUETTES: readonly TangramSilhouette[] = Array.from(
	{ length: 8 },
	(_, rot) => ({
		id: `double-rectangle-${rot}`,
		name: 'Rectangle',
		outline: orientedPolygon(
			[
				[0, 0],
				[16, 0],
				[16, 8],
				[0, 8]
			].map(diagonalPoint),
			rot,
			0
		),
		witness: doubleWitness.map((move) => ({
			...move,
			...orientedPolygon([move], rot, 0)[0]!,
			rot: (move.rot + rot) % 8
		}))
	})
);
export function tangramTray(round: TangramRound): readonly TangramPlacementMove[] {
	return round.rules.cut
		? TANGRAM_SEI_SQUARE.witness
		: round.rules.copies === 2
			? doubleWitness
			: square.witness;
}
function silhouettes(rules: TangramRules): readonly TangramSilhouette[] {
	return rules.cut
		? TANGRAM_SEI_SILHOUETTES
		: rules.copies === 2
			? TANGRAM_DOUBLE_SILHOUETTES
			: TANGRAM_SILHOUETTES;
}

function simpleOutline(polygon: readonly TangramPoint[]): boolean {
	if (polygon.length < 3) return false;
	for (let index = 0; index < polygon.length; index++) {
		const a = polygon[index]!,
			b = polygon[(index + 1) % polygon.length]!,
			c = polygon[(index + 2) % polygon.length]!;
		if (onSegment(c, a, b) || onSegment(a, b, c)) return false;
		for (let other = index + 2; other < polygon.length; other++) {
			if (index === 0 && other === polygon.length - 1) continue;
			const p = polygon[other]!,
				q = polygon[(other + 1) % polygon.length]!;
			if (
				properIntersection(a, b, p, q) ||
				onSegment(a, p, q) ||
				onSegment(b, p, q) ||
				onSegment(p, a, b) ||
				onSegment(q, a, b)
			)
				return false;
		}
	}
	return true;
}
export function tangramCoverage(
	silhouette: Pick<TangramSilhouette, 'outline'>,
	placements: readonly (TangramPlacement | null)[],
	rules: TangramRules = tangramRules()
): boolean {
	const count = tangramPieces(rules).length;
	if (
		placements.length !== count ||
		placements.some(
			(placement, piece) =>
				placement === null ||
				!validPlacement({ ...placement, piece }, count) ||
				(!rules.flip && placement.flip !== 0)
		) ||
		!simpleOutline(silhouette.outline)
	)
		return false;
	const polygons = placements.map((placement, piece) =>
		tangramPiecePolygon(piece, placement!, rules)
	);
	if (!polygons.every((polygon) => tangramPolygonInside(polygon, silhouette.outline))) return false;
	let area: Scalar = [0n, 0n];
	for (let piece = 0; piece < polygons.length; piece++) {
		const polygon = polygons[piece]!;
		area = add(area, tangramArea2(polygon));
		for (let other = piece + 1; other < polygons.length; other++)
			if (tangramPolygonsOverlap(polygon, polygons[other]!)) return false;
		if (!polygons.some((other, index) => index !== piece && polygonsTouch(polygon, other)))
			return false;
	}
	return (
		sign(sub(area, tangramArea2(silhouette.outline))) === 0 &&
		area[0] === 256n * BigInt(rules.copies) &&
		area[1] === 0n
	);
}
export function validateTangramWitness(
	target: TangramSilhouette,
	rules: TangramRules = tangramRules()
): boolean {
	const count = tangramPieces(rules).length;
	if (
		target.witness.length !== count ||
		new Set(target.witness.map((move) => move.piece)).size !== count
	)
		return false;
	const placements = Array<TangramPlacement | null>(count).fill(null);
	for (const move of target.witness) {
		if (!validPlacement(move, count)) return false;
		placements[move.piece] = move;
	}
	return tangramCoverage(target, placements, rules);
}
export function parseTangramVariant(variant?: string): TangramVariant {
	if (variant === undefined) return 'tangram:classic';
	if (!TANGRAM_VARIANTS.includes(variant as TangramVariant)) throw new RangeError('variant');
	return variant as TangramVariant;
}
export function createTangramRound(seed: string, variant?: string): TangramRound {
	const selected = parseTangramVariant(variant),
		rules = tangramRules(selected),
		rng = createRng(seed);
	const library = silhouettes(rules);
	let target: TangramSilhouette | undefined;
	for (let attempt = 0; attempt < 100; attempt++) {
		const candidate = library[rng.nextInt(library.length)]!;
		if (!rules.flip && candidate.witness.some(({ flip }) => flip !== 0)) continue;
		if (!validateTangramWitness(candidate, rules)) throw new RangeError('witness');
		target = candidate;
		break;
	}
	if (!target) throw new RangeError('generation');
	const order = tangramPieces(rules).map((_, index) => index);
	return {
		seed,
		variant: selected,
		rules,
		silhouette: { id: target.id, name: target.name, outline: target.outline },
		placements: order.map(() => null),
		status: 'playing',
		hintsUsed: 0,
		mistakes: 0,
		moves: 0,
		lastAt: -1,
		arrivalOrder: rules.falling ? shuffle(rng, order) : order
	};
}
export function tangramWitness(round: TangramRound): readonly TangramPlacementMove[] {
	const target = silhouettes(round.rules).find(({ id }) => id === round.silhouette.id);
	if (!target) throw new RangeError('silhouette');
	return target.witness;
}
export const TANGRAM_FALLING_ARRIVALS = [0, 1800, 3400, 4800, 6000, 7000, 7800] as const;
export function tangramArrivalAt(round: TangramRound, piece: number): number {
	if (!Number.isSafeInteger(piece) || piece < 0 || piece >= round.placements.length)
		throw new RangeError('piece');
	return round.rules.falling ? TANGRAM_FALLING_ARRIVALS[round.arrivalOrder.indexOf(piece)]! : 0;
}
export function tangramAvailablePieces(round: TangramRound, at: number): number[] {
	if (!Number.isSafeInteger(at) || at < 0 || at > 7200000) throw new RangeError('time');
	return round.arrivalOrder.filter((piece) => at >= tangramArrivalAt(round, piece));
}
function validPlacement(move: Move, count = 14): move is TangramPlacementMove {
	return (
		['piece', 'xp', 'xq', 'yp', 'yq', 'rot', 'flip'].every((key) =>
			Number.isSafeInteger(move[key])
		) &&
		move.piece! >= 0 &&
		move.piece! < count &&
		move.rot! >= 0 &&
		move.rot! < 8 &&
		(move.flip === 0 || (move.flip === 1 && move.piece! % 7 === 6)) &&
		['xp', 'xq', 'yp', 'yq'].every((key) => Math.abs(move[key]!) <= 4096)
	);
}
export function parseTangramMove(move: Move): TangramMove {
	const { at, ...payload } = move;
	if (Object.hasOwn(move, 'at') && (!Number.isSafeInteger(at) || at! < 0 || at! > 7200000))
		throw new RangeError('time');
	const keys = Object.keys(payload).sort().join(',');
	let parsed: Move;
	if (keys === 'flip,piece,rot,xp,xq,yp,yq' && validPlacement(payload))
		parsed = {
			piece: payload.piece,
			xp: payload.xp,
			xq: payload.xq,
			yp: payload.yp,
			yq: payload.yq,
			rot: payload.rot,
			flip: payload.flip
		};
	else if (
		keys === 'action' &&
		[TANGRAM_ACTION.hint, TANGRAM_ACTION.reset, TANGRAM_ACTION.peek, TANGRAM_ACTION.tick].includes(
			payload.action as 1 | 2 | 4 | 5
		)
	)
		parsed = { action: payload.action };
	else if (
		keys === 'action,piece' &&
		payload.action === TANGRAM_ACTION.remove &&
		Number.isSafeInteger(payload.piece) &&
		payload.piece! >= 0 &&
		payload.piece! < 14
	)
		parsed = { action: payload.action, piece: payload.piece };
	else throw new RangeError('move');
	return at === undefined ? parsed : { ...parsed, at };
}
function canPlace(round: TangramRound, piece: number, placement: TangramPlacement): boolean {
	const polygon = tangramPiecePolygon(piece, placement, round.rules);
	return (
		tangramPolygonInside(polygon, round.silhouette.outline) &&
		round.placements.every(
			(other, index) =>
				index === piece ||
				other === null ||
				!tangramPolygonsOverlap(polygon, tangramPiecePolygon(index, other, round.rules))
		)
	);
}
function wrongSlot(round: TangramRound, piece: number, placement: TangramPlacement): boolean {
	const polygon = tangramPiecePolygon(piece, placement, round.rules),
		outline = round.silhouette.outline;
	if (
		round.placements.some(
			(other, index) =>
				index !== piece &&
				other !== null &&
				tangramPolygonsOverlap(polygon, tangramPiecePolygon(index, other, round.rules))
		)
	)
		return true;
	for (let first = 0; first < polygon.length; first++)
		for (let second = 0; second < outline.length; second++) {
			const a = polygon[first]!,
				b = polygon[(first + 1) % polygon.length]!,
				c = outline[second]!,
				d = outline[(second + 1) % outline.length]!;
			if (
				properIntersection(a, b, c, d) ||
				onSegment(a, c, d) ||
				onSegment(b, c, d) ||
				onSegment(c, a, b) ||
				onSegment(d, a, b)
			)
				return true;
		}
	return false;
}
export function applyTangramMove(round: TangramRound, input: TangramMove): TangramRound {
	const move = parseTangramMove(input),
		rules = round.rules;
	if (round.status !== 'playing' || round.moves >= 10000) throw new RangeError('round');
	const timed = rules.timeLimit > 0 || rules.falling;
	if (timed ? move.at === undefined || move.at < round.lastAt : move.at !== undefined)
		throw new RangeError('time');
	if (move.action === TANGRAM_ACTION.tick && !timed) throw new RangeError('tick');
	const available = tangramAvailablePieces(round, move.at ?? 0);
	if (
		move.piece !== undefined &&
		(move.piece >= round.placements.length || !available.includes(move.piece))
	)
		throw new RangeError('piece');
	if (move.action === undefined && !rules.flip && move.flip !== 0) throw new RangeError('flip');
	const helper = move.action === TANGRAM_ACTION.hint || move.action === TANGRAM_ACTION.peek;
	if (helper && rules.hintLimit >= 0 && round.hintsUsed >= rules.hintLimit)
		throw new RangeError('hint_limit');
	const next: TangramRound = {
		...round,
		placements: round.placements.slice(),
		moves: round.moves + 1,
		lastAt: move.at ?? round.lastAt
	};
	if (rules.timeLimit > 0 && move.at! >= rules.timeLimit * 1000) return { ...next, status: 'lost' };
	if (move.action === TANGRAM_ACTION.reset) next.placements.fill(null);
	else if (move.action === TANGRAM_ACTION.remove) next.placements[move.piece!] = null;
	else if (move.action === TANGRAM_ACTION.peek) next.hintsUsed++;
	else if (move.action === TANGRAM_ACTION.hint) {
		const witness = tangramWitness(round).find(({ piece, ...placement }) => {
			const current = next.placements[piece];
			return (
				available.includes(piece) &&
				(!current ||
					['xp', 'xq', 'yp', 'yq', 'rot', 'flip'].some(
						(key) =>
							current[key as keyof TangramPlacement] !== placement[key as keyof TangramPlacement]
					))
			);
		});
		if (!witness) throw new RangeError('hint');
		next.hintsUsed++;
		const polygon = tangramPiecePolygon(witness.piece, witness, rules);
		for (let piece = 0; piece < next.placements.length; piece++) {
			const placement = next.placements[piece];
			if (
				piece !== witness.piece &&
				placement &&
				tangramPolygonsOverlap(polygon, tangramPiecePolygon(piece, placement, rules))
			)
				next.placements[piece] = null;
		}
		next.placements[witness.piece] = {
			xp: witness.xp,
			xq: witness.xq,
			yp: witness.yp,
			yq: witness.yq,
			rot: witness.rot,
			flip: witness.flip
		};
	} else if (move.action !== TANGRAM_ACTION.tick) {
		const piece = move.piece!;
		const placement: TangramPlacement = {
			xp: move.xp!,
			xq: move.xq!,
			yp: move.yp!,
			yq: move.yq!,
			rot: move.rot!,
			flip: move.flip!
		};
		if (canPlace(round, piece, placement)) next.placements[piece] = placement;
		else if (rules.mistakeLimit > 0 && wrongSlot(round, piece, placement)) {
			next.mistakes++;
			if (next.mistakes >= rules.mistakeLimit) next.status = 'lost';
		}
	}
	if (next.status === 'playing' && tangramCoverage(next.silhouette, next.placements, rules))
		next.status = 'won';
	return next;
}
export function tangramScore(round: TangramRound, seconds: number, values?: ScoreValues): number {
	if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 7200)
		throw new RangeError('elapsed');
	const rules = round.rules;
	const active: ScoreValues =
		values ??
		(rules.map
			? mapScoring.defaults
			: rules.copies === 2
				? doubleScoring.defaults
				: scoringDefinition.defaults);
	const timeBonus = rules.map
		? 0
		: Math.max(0, (rules.timeLimit || rules.par) - seconds) * active.second!;
	return Math.max(
		0,
		(round.status === 'won' ? active.completion! + timeBonus : 0) +
			round.placements.filter(Boolean).length * active.piece! -
			round.hintsUsed * active.hint!
	);
}
