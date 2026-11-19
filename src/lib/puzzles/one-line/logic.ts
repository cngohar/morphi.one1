import { createRng, shuffle, type Rng } from '../../engine/rng.js';
import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring } from './scoring.js';

export const ONE_LINE_ENGINE_VERSION = 'one-line-1';
export const ONE_LINE_COUNTDOWN = 120;
export const ONE_LINE_VARIANTS = [
	'one-line:classic',
	'one-line:one-way',
	'one-line:double-trace',
	'one-line:closed-loop',
	'one-line:two-stroke',
	'one-line:crossings-are-junctions',
	'one-line:countdown',
	'one-line:no-hint',
	'one-line:degree-hidden',
	'one-line:lift-resume',
	'one-line:verdict'
] as const;

export type OneLineVariant = (typeof ONE_LINE_VARIANTS)[number];
export type OneLineRules = ReturnType<typeof encodeRules>;
export type Dot = { x: number; y: number };
export type Edge = { from: number; to: number; directed?: true; double?: true };
type Step = { edge: number; to: number };
type Trail = { start: number; path: Step[] };
export interface OneLineMove extends Move {
	action: number;
	edge: number;
	value: number;
}
export interface OneLineRound {
	seed: string;
	variant?: OneLineVariant;
	rules: OneLineRules;
	dots: Dot[];
	edges: Edge[];
	odd: number[];
	strokes: Trail[];
	lifted: boolean;
	undoFloor: number;
	status: 'playing' | 'won' | 'stranded' | 'timeout' | 'wrong-verdict';
	edgesCovered: number;
	hintsUsed: number;
	hintUsedSession: boolean;
	restarts: number;
	verdict: 'drawable' | 'impossible' | null;
	solution: OneLineMove[];
}

export function parseOneLineVariant(variant = ONE_LINE_VARIANTS[0] as string): OneLineVariant {
	const match = ONE_LINE_VARIANTS.find((id) => id === variant);
	if (!match) throw new RangeError('variant');
	return match;
}

export function encodeRules(variant: OneLineVariant) {
	return {
		direction: Number(variant === 'one-line:one-way'),
		double: Number(variant === 'one-line:double-trace'),
		loop: Number(variant === 'one-line:closed-loop'),
		start: 0,
		strokes: variant === 'one-line:two-stroke' ? (2 as const) : (1 as const),
		crossings: Number(variant === 'one-line:crossings-are-junctions'),
		undo: 0,
		hint: variant === 'one-line:no-hint' ? 2 : 0,
		degree: Number(variant === 'one-line:degree-hidden'),
		timing: Number(variant === 'one-line:countdown'),
		lives: 0,
		lift: Number(variant === 'one-line:lift-resume'),
		stars: 0,
		win: Number(variant === 'one-line:verdict')
	};
}

export function resolveVariantFromRules(rules: Record<string, number | boolean>) {
	return ONE_LINE_VARIANTS.find((variant) => {
		const expected = Object.entries(encodeRules(variant));
		return (
			expected.length === Object.keys(rules).length &&
			expected.every(([key, value]) => rules[key] === value)
		);
	});
}

function traversals(edges: readonly Edge[]) {
	return edges.flatMap((edge, id) => (edge.double ? [id, id] : [id]));
}

function oddDots(edges: readonly Edge[], remaining: readonly number[]) {
	const odd = new Set<number>();
	for (const id of remaining) {
		const { from, to } = edges[id];
		for (const dot of [from, to]) {
			if (odd.has(dot)) odd.delete(dot);
			else odd.add(dot);
		}
	}
	return [...odd].sort((a, b) => a - b);
}

function eligibleStarts(edges: readonly Edge[], remaining: readonly number[]) {
	const odd = oddDots(edges, remaining);
	if (odd.length) return odd;
	return [...new Set(remaining.flatMap((id) => [edges[id].from, edges[id].to]))].sort(
		(a, b) => a - b
	);
}

function destination(edge: Edge, dot: number) {
	if (edge.from === dot) return edge.to;
	if (edge.to === dot && !edge.directed) return edge.from;
	return undefined;
}

/** Assign each flexible traversal a tail to fit the fixed arrows' Euler degree demands. */
function orient(edges: readonly Edge[], ids: readonly number[], start: number, end: number) {
	const balance = new Map<number, number>();
	const flexible = new Map<number, number>();
	const add = (map: Map<number, number>, dot: number, delta: number) =>
		map.set(dot, (map.get(dot) ?? 0) + delta);
	const open: number[] = [];
	const tails: number[] = [];
	for (let index = 0; index < ids.length; index++) {
		const edge = edges[ids[index]];
		if (edge.directed) {
			tails[index] = edge.from;
			add(balance, edge.from, 1);
			add(balance, edge.to, -1);
		} else {
			open.push(index);
			add(flexible, edge.from, 1);
			add(flexible, edge.to, 1);
		}
	}
	const slots = new Map<number, number[]>();
	let capacity = 0;
	for (const dot of new Set([...balance.keys(), ...flexible.keys()])) {
		const degree = flexible.get(dot) ?? 0;
		const demand =
			(degree + Number(dot === start) - Number(dot === end) - (balance.get(dot) ?? 0)) / 2;
		if (!Number.isInteger(demand) || demand < 0 || demand > degree) return null;
		slots.set(
			dot,
			Array.from({ length: demand }, () => capacity++)
		);
	}
	if (capacity !== open.length) return null;
	const assigned = Array<number>(capacity).fill(-1);
	function assign(index: number, seen: Set<number>): boolean {
		const { from, to } = edges[ids[index]];
		for (const dot of [from, to]) {
			for (const slot of slots.get(dot) ?? []) {
				if (seen.has(slot)) continue;
				seen.add(slot);
				if (assigned[slot] !== -1 && !assign(assigned[slot], seen)) continue;
				assigned[slot] = index;
				tails[index] = dot;
				return true;
			}
		}
		return false;
	}
	return open.every((index) => assign(index, new Set())) ? tails : null;
}

/** Hierholzer walks traversal slots, so the same physical edge can carry two strands. */
function oneTrail(edges: readonly Edge[], ids: readonly number[], forced?: number): Trail | null {
	if (!ids.length) return null;
	const odd = oddDots(edges, ids);
	if (odd.length > 2 || (forced !== undefined && odd.length && !odd.includes(forced))) return null;
	const starts = forced === undefined ? eligibleStarts(edges, ids) : [forced];
	const directed = ids.some((id) => edges[id].directed);
	for (const start of starts) {
		const end = odd.find((dot) => dot !== start) ?? start;
		const tails = directed ? orient(edges, ids, start, end) : undefined;
		if (tails === null) continue;
		const adjacency = new Map<number, { index: number; to: number }[]>();
		const link = (from: number, to: number, index: number) => {
			const list = adjacency.get(from) ?? [];
			list.push({ index, to });
			adjacency.set(from, list);
		};
		for (let index = ids.length - 1; index >= 0; index--) {
			const edge = edges[ids[index]];
			const from = tails?.[index] ?? edge.from;
			const to = from === edge.from ? edge.to : edge.from;
			link(from, to, index);
			if (!tails) link(to, from, index);
		}
		const visited = new Uint8Array(ids.length);
		const stack: { to: number; edge?: number }[] = [{ to: start }];
		const path: Step[] = [];
		while (stack.length) {
			const current = stack.at(-1)!;
			const list = adjacency.get(current.to);
			const next = list?.pop();
			if (next) {
				if (visited[next.index]) continue;
				visited[next.index] = 1;
				stack.push({ edge: ids[next.index], to: next.to });
			} else {
				stack.pop();
				if (current.edge !== undefined) path.push({ edge: current.edge, to: current.to });
			}
		}
		if (path.length === ids.length) return { start, path: path.reverse() };
		if (!directed) break;
	}
	return null;
}

function without(ids: readonly number[], edge: number) {
	const index = ids.indexOf(edge);
	return [...ids.slice(0, index), ...ids.slice(index + 1)];
}

/** Two-stroke figures grow by subdividing K4: only its four degree-three dots branch. */
export function completion(
	edges: readonly Edge[],
	ids: readonly number[],
	start: number | undefined,
	budget: 1 | 2
): Trail[] | null {
	if (budget === 1) {
		const trail = oneTrail(edges, ids, start);
		return trail ? [trail] : null;
	}
	function finish(
		first: number,
		current: number,
		remaining: readonly number[],
		path: Step[]
	): Trail[] | null {
		if (path.length || start !== undefined) {
			const last = oneTrail(edges, remaining);
			if (last) return [{ start: first, path }, last];
		}
		for (const edge of remaining) {
			const to = destination(edges[edge], current);
			if (to === undefined) continue;
			const rest = without(remaining, edge);
			if (!rest.some((id) => destination(edges[id], to) !== undefined)) continue;
			const result = finish(first, to, rest, [...path, { edge, to }]);
			if (result) return result;
		}
		return null;
	}
	for (const first of start === undefined ? eligibleStarts(edges, ids) : [start]) {
		const result = finish(first, first, ids, []);
		if (result) return result;
	}
	return null;
}

function activeStroke(round: OneLineRound) {
	return round.lifted && round.strokes.length === 1 ? undefined : round.strokes.at(-1);
}

function remainingEdges(round: OneLineRound) {
	let remaining = traversals(round.edges);
	for (const stroke of round.strokes)
		for (const { edge } of stroke.path) remaining = without(remaining, edge);
	return remaining;
}

export function applyOneLineMove(round: OneLineRound, move: OneLineMove): OneLineRound {
	if (round.status !== 'playing') throw new RangeError('finished');
	const { action, edge, value } = move;
	if (action === 5 && round.rules.timing) return { ...round, status: 'timeout' };
	if (action === 4 && round.rules.win && round.verdict === null) {
		if (value === 0) return { ...round, verdict: 'drawable' };
		if (value === 1)
			return {
				...round,
				verdict: 'impossible',
				status: round.odd.length > 2 ? 'won' : 'wrong-verdict'
			};
	}
	if (round.rules.win && round.verdict === null) throw new RangeError('verdict');
	if (action === 2 && round.rules.hint !== 2 && round.hintsUsed < 3)
		return { ...round, hintsUsed: round.hintsUsed + 1, hintUsedSession: true };
	if (action === 3)
		return {
			...round,
			strokes: [],
			lifted: false,
			undoFloor: 0,
			edgesCovered: 0,
			restarts: round.restarts + 1
		};
	const stroke = activeStroke(round);
	if (action === 1) {
		if (!stroke || stroke.path.length <= round.undoFloor) throw new RangeError('undo');
		const previous = stroke.path.length > 1 ? [{ ...stroke, path: stroke.path.slice(0, -1) }] : [];
		return {
			...round,
			strokes: [...round.strokes.slice(0, -1), ...previous],
			edgesCovered: round.edgesCovered - 1
		};
	}
	const remaining = remainingEdges(round);
	if (action === 6) {
		if (!stroke) throw new RangeError('lift');
		if (round.rules.strokes === 2) {
			if (round.lifted) throw new RangeError('lift');
			return {
				...round,
				lifted: true,
				status: oneTrail(round.edges, remaining) ? 'playing' : 'stranded'
			};
		}
		if (round.rules.lift) {
			if (round.undoFloor === stroke.path.length) throw new RangeError('lift');
			return { ...round, undoFloor: stroke.path.length };
		}
		return { ...round, strokes: [], edgesCovered: 0 };
	}
	if (action !== 0 || !round.edges[edge]) throw new RangeError('trace');
	if (!remaining.includes(edge)) throw new RangeError('retraced');
	if (stroke && value !== 0) throw new RangeError('trace');
	const current = stroke?.path.at(-1)?.to ?? stroke?.start ?? value;
	const next = destination(round.edges[edge], current);
	if (next === undefined)
		throw new RangeError(
			round.edges[edge].directed && round.edges[edge].to === current ? 'direction' : 'trace'
		);
	if (!stroke && !eligibleStarts(round.edges, remaining).includes(value))
		throw new RangeError('start');
	const nextStroke = {
		start: stroke?.start ?? value,
		path: [...(stroke?.path ?? []), { edge, to: next }]
	};
	const strokes = [...(stroke ? round.strokes.slice(0, -1) : round.strokes), nextStroke];
	const rest = without(remaining, edge);
	let status: OneLineRound['status'] = 'playing';
	if (!rest.length)
		status =
			strokes.length === round.rules.strokes && (!round.rules.loop || next === nextStroke.start)
				? 'won'
				: 'stranded';
	else if (!rest.some((id) => destination(round.edges[id], next) !== undefined))
		status = 'stranded';
	return { ...round, strokes, edgesCovered: round.edgesCovered + 1, status };
}

export function oneLineHint(round: OneLineRound) {
	if (round.status !== 'playing' || (round.rules.win && round.verdict === null)) return null;
	const remaining = remainingEdges(round);
	const active = activeStroke(round)?.path.at(-1)?.to;
	const budget = round.lifted ? 1 : round.rules.strokes;
	const trail = completion(round.edges, remaining, active, budget);
	if (!trail) return null;
	const start =
		active === undefined
			? eligibleStarts(round.edges, remaining).filter((dot) =>
					completion(round.edges, remaining, dot, budget)
				)
			: [];
	return {
		start: round.rules.degree ? start.slice(0, 1) : start,
		trail: trail.map((part) => part.path)
	};
}

export function oneLineScore(
	round: OneLineRound,
	seconds: number,
	values: ScoreValues = scoring.defaults
) {
	if (round.status !== 'won') return 0;
	if (round.verdict === 'impossible') return values.verdict!;
	const bonus = round.rules.timing
		? Math.max(0, ONE_LINE_COUNTDOWN - seconds) * values.countdown!
		: 0;
	return Math.max(
		0,
		values.edge! * round.edgesCovered +
			bonus -
			values.hint! * round.hintsUsed -
			values.restart! * round.restarts
	);
}

function traceMoves(trails: readonly Trail[]) {
	return trails.flatMap(({ start, path }, index): OneLineMove[] => [
		...(index ? [{ action: 6, edge: 0, value: 0 }] : []),
		...path.map(({ edge }, step) => ({ action: 0, edge, value: step === 0 ? start : 0 }))
	]);
}

export function hasTrap(round: OneLineRound) {
	const { edges, rules } = round;
	const visited = new Set<string>();
	function find(remaining: number[], current: number | undefined, budget: 1 | 2): boolean {
		const key = `${current}/${budget}/${remaining.join(',')}`;
		if (visited.has(key)) return false;
		visited.add(key);
		if (
			budget === 2 &&
			current !== undefined &&
			oneTrail(edges, remaining) &&
			find(remaining, undefined, 1)
		)
			return true;
		for (const dot of current === undefined ? eligibleStarts(edges, remaining) : [current]) {
			for (const edge of new Set(remaining)) {
				const to = destination(edges[edge], dot);
				if (to === undefined) continue;
				const rest = without(remaining, edge);
				if (!rest.length) continue;
				if (!completion(edges, rest, to, budget)) return true;
				if (rest.some((id) => destination(edges[id], to) !== undefined) && find(rest, to, budget))
					return true;
			}
		}
		return false;
	}
	return find(traversals(edges), undefined, rules.strokes);
}

function connected(edges: readonly Edge[]) {
	if (!edges.length) return false;
	const seen = new Set([edges[0].from]);
	for (const dot of seen) {
		for (const { from, to } of edges) {
			if (dot === from) seen.add(to);
			if (dot === to) seen.add(from);
		}
	}
	return edges.every(({ from, to }) => seen.has(from) && seen.has(to));
}

type Rejection = 'candidate' | 'connectivity' | 'parity' | 'witness' | 'trap';

export function createOneLineRound(
	seed: string,
	variant?: string,
	rejected?: (gate: Rejection) => void
): OneLineRound {
	const id = parseOneLineVariant(variant);
	const rules = encodeRules(id);
	const rng = createRng(seed);
	const size = 6 + rng.nextInt(29);
	const impossible = Boolean(rules.win && rng.nextInt(5) === 0);
	for (let attempt = 0; attempt < 100; attempt++) {
		const deal = createRng(rng.nextU64().toString());
		const board = candidate(deal, size, rules, impossible);
		if (!board) {
			rejected?.('candidate');
			continue;
		}
		const edges = shuffle(deal, board.edges);
		if (!connected(edges)) {
			rejected?.('connectivity');
			continue;
		}
		if (rules.double) edges[deal.nextInt(edges.length)].double = true;
		const remaining = traversals(edges);
		const odd = oddDots(edges, remaining);
		if (
			impossible
				? odd.length < 4 || odd.length > 6
				: rules.strokes === 2
					? odd.length !== 4
					: odd.length > (rules.loop ? 0 : 2)
		) {
			rejected?.('parity');
			continue;
		}
		let trails = impossible ? null : completion(edges, remaining, undefined, rules.strokes);
		if (rules.direction && trails) {
			const steps = trails[0].path;
			for (const index of shuffle(
				deal,
				steps.map((_, i) => i)
			).slice(0, 2)) {
				const { edge, to } = steps[index];
				edges[edge] = { from: index ? steps[index - 1].to : trails[0].start, to, directed: true };
			}
			trails = completion(edges, remaining, undefined, 1);
		}
		if (!impossible && !trails) {
			rejected?.('witness');
			continue;
		}
		const verdict = rules.win ? [{ action: 4, edge: 0, value: Number(impossible) }] : [];
		const round: OneLineRound = {
			seed,
			variant: id,
			rules,
			dots: board.dots,
			edges,
			odd,
			strokes: [],
			lifted: false,
			undoFloor: 0,
			status: 'playing',
			edgesCovered: 0,
			hintsUsed: 0,
			hintUsedSession: false,
			restarts: 0,
			verdict: null,
			solution: [...verdict, ...traceMoves(trails ?? [])]
		};
		let solved;
		try {
			solved = round.solution.reduce(applyOneLineMove, round);
		} catch {
			rejected?.('witness');
			continue;
		}
		if (solved.status !== 'won' || (!impossible && solved.edgesCovered !== remaining.length)) {
			rejected?.('witness');
			continue;
		}
		if (!impossible && !hasTrap(round)) {
			rejected?.('trap');
			continue;
		}
		return round;
	}
	throw new RangeError('generation');
}

export function dailySeedOk(seed: string, variant?: string) {
	if (variant === 'one-line:verdict') return false;
	try {
		const size = 6 + createRng(seed).nextInt(29);
		return size >= 17 && size <= 24 && createOneLineRound(seed, variant).edges.length === size;
	} catch {
		return false;
	}
}
function candidate(
	rng: Rng,
	size: number,
	rules: OneLineRules,
	impossible: boolean
): { dots: Dot[]; edges: Edge[] } | undefined {
	const fourOdd = rules.strokes === 2 || impossible;
	const junction = rules.crossings === 1;
	const dots: Dot[] = fourOdd
		? [
				{ x: 3, y: 2 },
				{ x: 5, y: 2 },
				{ x: 5, y: 4 },
				{ x: 3, y: 4 }
			]
		: [
				{ x: 4, y: 3 },
				{ x: 3, y: 2 },
				{ x: 5, y: 2 },
				{ x: 3, y: 4 },
				{ x: 5, y: 4 }
			];
	const edges: Edge[] = fourOdd
		? [
				{ from: 0, to: 1 },
				{ from: 1, to: 2 },
				{ from: 2, to: 3 },
				{ from: 3, to: 0 },
				{ from: 0, to: 2 },
				{ from: 1, to: 3 }
			]
		: [
				{ from: 0, to: 1 },
				{ from: 1, to: 2 },
				{ from: 2, to: 0 },
				{ from: 0, to: 3 },
				{ from: 3, to: 4 },
				{ from: 4, to: 0 }
			];

	const wide = 1 + rng.nextInt(2);
	const tall = 1 + rng.nextInt(2);
	for (const dot of dots) {
		dot.x = 4 + (dot.x - 4) * wide;
		dot.y = 3 + (dot.y - 3) * tall;
	}
	if (!fourOdd && !rules.loop && size > 6 && rng.nextInt(2) === 0) {
		edges.push({ from: 1, to: 3 });
	}

	const cross = (a: Dot, b: Dot, c: Dot) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
	const onSegment = (a: Dot, b: Dot, p: Dot) =>
		cross(a, b, p) === 0 &&
		p.x >= Math.min(a.x, b.x) &&
		p.x <= Math.max(a.x, b.x) &&
		p.y >= Math.min(a.y, b.y) &&
		p.y <= Math.max(a.y, b.y);
	const clear = (a: Dot, b: Dot, skip: number) => {
		for (const p of dots) {
			if (p !== a && p !== b && onSegment(a, b, p)) return false;
		}
		for (let i = 0; i < edges.length; i++) {
			if (i === skip) continue;
			const c = dots[edges[i].from];
			const d = dots[edges[i].to];
			const abC = cross(a, b, c);
			const abD = cross(a, b, d);
			const cdA = cross(c, d, a);
			const cdB = cross(c, d, b);
			if (abC * abD < 0 && cdA * cdB < 0) return false;
			if (c !== a && c !== b && onSegment(a, b, c)) return false;
			if (d !== a && d !== b && onSegment(a, b, d)) return false;
			if (a !== c && a !== d && onSegment(c, d, a)) return false;
			if (b !== c && b !== d && onSegment(c, d, b)) return false;
		}
		return true;
	};

	while (edges.length < size) {
		const choices: { edge: number; dot: Dot }[] = [];
		for (let i = 0; i < edges.length; i++) {
			const { from, to } = edges[i];
			// Keep both uninterrupted diagonals through the junction.
			if (junction && !fourOdd && (from === 0 || to === 0)) continue;
			const a = dots[from];
			const b = dots[to];
			for (let y = 0; y <= 6; y++) {
				for (let x = 0; x <= 8; x++) {
					if (dots.some((p) => p.x === x && p.y === y)) continue;
					const p = { x, y };
					if (cross(a, b, p) === 0) continue;
					if (
						Math.abs(a.x - x) > 3 ||
						Math.abs(a.y - y) > 3 ||
						Math.abs(b.x - x) > 3 ||
						Math.abs(b.y - y) > 3
					)
						continue;
					if (clear(a, p, i) && clear(p, b, i)) choices.push({ edge: i, dot: p });
				}
			}
		}
		if (!choices.length) return undefined;
		const choice = choices[rng.nextInt(choices.length)];
		const old = edges[choice.edge];
		const next = dots.push(choice.dot) - 1;
		edges.splice(choice.edge, 1, { from: old.from, to: next }, { from: next, to: old.to });
	}
	return { dots, edges };
}
