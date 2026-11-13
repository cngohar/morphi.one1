import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { createRng, shuffle, type Rng } from '#lib/engine/rng.js';
import { scoring as scoringDefinition } from './scoring.js';

export const MAHJONG_ENGINE_VERSION = 'mahjong-solitaire-1';
export const MAHJONG_MAX_MOVES = 10000;
export const MAHJONG_VARIANTS = [
	'mahjong-solitaire:classic',
	'mahjong-solitaire:triple-match',
	'mahjong-solitaire:exact-only',
	'mahjong-solitaire:face-down-peek',
	'mahjong-solitaire:no-highlight',
	'mahjong-solitaire:countdown',
	'mahjong-solitaire:three-hearts',
	'mahjong-solitaire:no-undo',
	'mahjong-solitaire:hint-budget',
	'mahjong-solitaire:shuffle-budget',
	'mahjong-solitaire:avalanche'
] as const;
export type MahjongVariant = (typeof MAHJONG_VARIANTS)[number];
export const MAHJONG_ACTION = { hint: 1, undo: 2, shuffle: 3, restart: 4, tick: 5 } as const;

export interface MahjongPosition {
	x: number;
	y: number;
	z: number;
}
export interface MahjongTile extends MahjongPosition {
	id: number;
	face: string;
	removed: boolean;
	faceDown: boolean;
}
export interface MahjongLayout {
	name: string;
	width: number;
	height: number;
	positions: readonly MahjongPosition[];
}
export interface MahjongRules extends Record<string, number | boolean> {
	groupSize: number;
	exactOnly: boolean;
	peek: boolean;
	highlight: boolean;
	timeLimit: number;
	hearts: number;
	undo: boolean;
	hintLimit: number;
	shuffleLimit: number;
	avalanche: boolean;
}
export interface MahjongMove extends Move {
	tileA?: number;
	tileB?: number;
	tileC?: number;
	tile?: number;
	action?: number;
	at?: number;
}
export interface MahjongRound {
	seed: string;
	variant?: MahjongVariant;
	band: number;
	layout: MahjongLayout;
	rules: MahjongRules;
	tiles: MahjongTile[];
	par: number;
	removals: number;
	hintsUsed: number;
	shufflesUsed: number;
	moves: number;
	lastAt: number;
	status: 'playing' | 'won' | 'lost';
	history: MahjongTile[][];
	lastHint: number[];
	lastMismatch: number[];
	hearts: number;
	rngDraws: number;
}

function grid(x: number, y: number, z: number, columns: number, rows: number): MahjongPosition[] {
	return Array.from({ length: columns * rows }, (_, index) => ({
		x: x + (index % columns) * 2,
		y: y + Math.floor(index / columns) * 2,
		z
	}));
}
const turtleFloor = [
	[2, 12],
	[6, 8],
	[3, 11],
	[0, 13],
	[2, 13],
	[3, 11],
	[7, 7],
	[2, 12]
].flatMap(([x, columns], row) => grid(x!, row * 2, 0, columns!, 1));
const fortressCorners = [
	[0, 0],
	[24, 0],
	[0, 14],
	[24, 14]
] as const;
function frozenLayout(
	name: string,
	width: number,
	height: number,
	positions: MahjongPosition[]
): MahjongLayout {
	return Object.freeze({
		name,
		width,
		height,
		positions: Object.freeze(positions.map((position) => Object.freeze(position)))
	});
}
// Frozen fixture geometry in integer half-steps; changing it requires an engine version bump.
export const MAHJONG_LAYOUTS = {
	triple: frozenLayout('Triple Turtle', 19, 14, [
		...grid(0, 0, 0, 9, 7),
		...grid(1, 5, 1, 9, 3),
		...grid(7, 6, 2, 4, 3),
		...grid(7, 9, 3, 5, 1),
		{ x: 12, y: 10, z: 4 }
	]),
	quick: frozenLayout('Quick', 15, 12, [...grid(0, 0, 0, 7, 6), ...grid(1, 5, 1, 7, 2)]),
	turtle: frozenLayout('Turtle', 28, 16, [
		...turtleFloor,
		...grid(9, 3, 1, 6, 6),
		...grid(12, 6, 2, 4, 4),
		...grid(15, 9, 3, 2, 2),
		{ x: 17, y: 11, z: 4 }
	]),
	fortress: frozenLayout('Fortress', 29, 19, [
		...Array.from({ length: 14 }, (_, column) => [
			{ x: column * 2, y: 0, z: 0 },
			{ x: column * 2, y: 16, z: 0 }
		]).flat(),
		...Array.from({ length: 7 }, (_, row) => [
			{ x: 0, y: (row + 1) * 2, z: 0 },
			{ x: 26, y: (row + 1) * 2, z: 0 }
		]).flat(),
		...grid(4, 4, 0, 10, 5),
		...fortressCorners.flatMap(([x, y]) => grid(x + 1, y + 1, 1, 2, 2)),
		...Array.from({ length: 6 }, (_, column) => [
			{ x: (column + 4) * 2 + 1, y: 1, z: 1 },
			{ x: (column + 4) * 2 + 1, y: 17, z: 1 }
		]).flat(),
		...Array.from({ length: 4 }, (_, row) => [
			{ x: 1, y: (row + 3) * 2 + 1, z: 1 },
			{ x: 25, y: (row + 3) * 2 + 1, z: 1 }
		]).flat(),
		...grid(13, 7, 1, 2, 2),
		...fortressCorners.map(([x, y]) => ({ x: x + 2, y: y + 2, z: 2 })),
		{ x: 14, y: 2, z: 2 },
		{ x: 14, y: 16, z: 2 },
		{ x: 2, y: 10, z: 2 },
		{ x: 26, y: 10, z: 2 },
		...grid(14, 8, 2, 2, 2)
	])
} as const;
export const MAHJONG_BANDS = [
	{ layout: MAHJONG_LAYOUTS.quick, par: 180 },
	{ layout: MAHJONG_LAYOUTS.turtle, par: 600 },
	{ layout: MAHJONG_LAYOUTS.fortress, par: 600 }
] as const;
export const MAHJONG_FACES = [
	...Array.from({ length: 9 }, (_, index) => [
		`C${index + 1}`,
		`B${index + 1}`,
		`K${index + 1}`
	]).flat(),
	'WE',
	'WS',
	'WW',
	'WN',
	'DR',
	'DG',
	'DW',
	'F1',
	'F2',
	'F3',
	'F4',
	'S1',
	'S2',
	'S3',
	'S4'
];

export function parseMahjongVariant(variant?: string): MahjongVariant {
	if (variant === undefined) return 'mahjong-solitaire:classic';
	if (!MAHJONG_VARIANTS.includes(variant as MahjongVariant)) throw new RangeError('variant');
	return variant as MahjongVariant;
}
function copyTiles(tiles: readonly MahjongTile[]) {
	return tiles.map((tile) => ({ ...tile }));
}
function overlaps(a: MahjongPosition, b: MahjongPosition): boolean {
	return Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
}
export function mahjongFreeTiles(round: Pick<MahjongRound, 'tiles'>): number[] {
	const remaining = round.tiles.filter((tile) => !tile.removed);
	return remaining
		.filter((tile) => {
			if (remaining.some((other) => other.z > tile.z && overlaps(tile, other))) return false;
			const beside = remaining.filter(
				(other) => other.z === tile.z && Math.abs(other.y - tile.y) < 2
			);
			return (
				!beside.some((other) => other.x + 2 === tile.x) ||
				!beside.some((other) => tile.x + 2 === other.x)
			);
		})
		.map((tile) => tile.id);
}
function matchKey(face: string, exactOnly: boolean): string {
	return !exactOnly && (face.startsWith('F') || face.startsWith('S')) ? face[0]! : face;
}
export function mahjongMatches(
	round: Pick<MahjongRound, 'tiles' | 'rules'>,
	ids: readonly number[]
): boolean {
	if (ids.length !== round.rules.groupSize || new Set(ids).size !== ids.length) return false;
	return ids.every((id) => {
		const tile = round.tiles[id];
		return (
			tile &&
			!tile.removed &&
			!tile.faceDown &&
			matchKey(tile.face, round.rules.exactOnly) ===
				matchKey(round.tiles[ids[0]!]!.face, round.rules.exactOnly)
		);
	});
}
function legalGroups(round: Pick<MahjongRound, 'tiles' | 'rules'>): number[][] {
	const free = mahjongFreeTiles(round),
		groups: number[][] = [];
	for (let a = 0; a < free.length; a++)
		for (let b = a + 1; b < free.length; b++) {
			const ids = [free[a]!, free[b]!];
			if (round.rules.groupSize === 2) {
				if (mahjongMatches(round, ids)) groups.push(ids);
			} else
				for (let c = b + 1; c < free.length; c++) {
					const triple = [...ids, free[c]!];
					if (mahjongMatches(round, triple)) groups.push(triple);
				}
		}
	return groups;
}
/** Column slides are screen-down within a layer, never a layer drop. */
export function mahjongAvalanche(tiles: MahjongTile[], removed: readonly number[]): void {
	const vacancies = removed.map((id) => ({ ...tiles[id]! }));
	for (let index = 0; index < vacancies.length; index++) {
		const slot = vacancies[index]!;
		if (
			tiles.some(
				(tile) => !tile.removed && tile.x === slot.x && tile.y === slot.y && tile.z === slot.z
			)
		)
			continue;
		const above = tiles.find(
			(tile) => !tile.removed && tile.z === slot.z && tile.x === slot.x && tile.y === slot.y - 2
		);
		if (above) {
			vacancies.push({ ...above });
			above.y = slot.y;
		}
	}
}
function removeTiles(tiles: MahjongTile[], ids: readonly number[], avalanche: boolean) {
	for (const id of ids) tiles[id]!.removed = true;
	if (avalanche) mahjongAvalanche(tiles, ids);
}
export function mahjongHint(round: Pick<MahjongRound, 'tiles' | 'rules'>): number[] {
	const before = mahjongFreeTiles(round).length;
	let best: number[] = [],
		bestFreed = -1;
	for (const ids of legalGroups(round)) {
		const tiles = copyTiles(round.tiles);
		removeTiles(tiles, ids, round.rules.avalanche);
		const freed = mahjongFreeTiles({ tiles }).length - (before - ids.length);
		if (!best.length || freed > bestFreed) {
			best = ids;
			bestFreed = freed;
		}
	}
	return best;
}

// Test proof only; the issued JSON and player replay never contain or consult this witness.
const witnesses = new WeakMap<MahjongTile[], number[][]>();
export function mahjongWitness(round: MahjongRound): number[][] {
	const witness = witnesses.get(round.tiles);
	if (!witness) throw new RangeError('witness');
	return witness.map((ids) => ids.slice());
}
function roundRng(seed: string, consumed = 0) {
	const rng = createRng(seed);
	for (let index = 0; index < consumed; index++) rng.nextU64();
	const next = rng.nextU64.bind(rng);
	let draws = consumed;
	rng.nextU64 = () => {
		draws++;
		return next();
	};
	return { rng, draws: () => draws };
}
function deal(
	rng: Rng,
	initial: readonly MahjongTile[],
	rules: MahjongRules
): { tiles: MahjongTile[]; witness: number[][] } | null {
	const positions = copyTiles(initial),
		witness: number[][] = [];
	while (positions.some((tile) => !tile.removed)) {
		const free = shuffle(rng, mahjongFreeTiles({ tiles: positions }));
		if (free.length < rules.groupSize) return null;
		const ids = free.slice(0, rules.groupSize);
		witness.push(ids);
		removeTiles(positions, ids, rules.avalanche);
	}
	const byFace = new Map<string, string[]>();
	for (const tile of initial)
		if (!tile.removed) {
			const key = matchKey(tile.face, rules.exactOnly);
			byFace.set(key, [...(byFace.get(key) ?? []), tile.face]);
		}
	const faces: string[][] = [];
	for (const values of byFace.values()) {
		if (values.length % rules.groupSize !== 0) throw new RangeError('faces');
		for (let index = 0; index < values.length; index += rules.groupSize)
			faces.push(values.slice(index, index + rules.groupSize));
	}
	const units = shuffle(rng, faces),
		tiles = copyTiles(initial);
	for (let step = witness.length - 1; step >= 0; step--)
		for (let index = 0; index < rules.groupSize; index++)
			tiles[witness[step]![index]!]!.face = units[step]![index]!;
	return { tiles, witness };
}
export function validateMahjongWitness(
	round: MahjongRound,
	witness: readonly (readonly number[])[]
): boolean {
	let current: MahjongRound = {
		...round,
		status: 'playing',
		lastAt: -1,
		moves: 0,
		history: [],
		tiles: round.tiles.map((tile) => ({ ...tile, faceDown: false }))
	};
	try {
		for (const ids of witness) {
			if (ids.length !== round.rules.groupSize) return false;
			current = applyMahjongMove(current, {
				tileA: ids[0]!,
				tileB: ids[1]!,
				...(round.rules.groupSize === 3 ? { tileC: ids[2]! } : {}),
				...(round.rules.timeLimit ? { at: 0 } : {})
			});
		}
		return current.status === 'won';
	} catch {
		return false;
	}
}
function variantFromRules(rules: MahjongRules): MahjongVariant {
	const suffix =
		rules.groupSize === 3
			? 'triple-match'
			: rules.exactOnly
				? 'exact-only'
				: rules.peek
					? 'face-down-peek'
					: !rules.highlight
						? 'no-highlight'
						: rules.timeLimit
							? 'countdown'
							: rules.hearts
								? 'three-hearts'
								: !rules.undo
									? 'no-undo'
									: rules.hintLimit
										? 'hint-budget'
										: rules.shuffleLimit
											? 'shuffle-budget'
											: rules.avalanche
												? 'avalanche'
												: 'classic';
	return `mahjong-solitaire:${suffix}` as MahjongVariant;
}
function standardFaces(quick: boolean, rules: MahjongRules): string[] {
	const ordinary = quick
		? MAHJONG_FACES.slice(0, 21).filter((face) => !face.startsWith('K'))
		: MAHJONG_FACES.slice(0, 34);
	return [
		...ordinary.flatMap((face) => Array<string>(rules.groupSize === 3 ? 3 : 4).fill(face)),
		...(quick
			? []
			: rules.groupSize === 3
				? ['F1', 'F2', 'F3', 'S1', 'S2', 'S3']
				: rules.exactOnly
					? ['F1', 'F1', 'F2', 'F2', 'S1', 'S1', 'S2', 'S2']
					: MAHJONG_FACES.slice(34))
	];
}
export function createMahjongRound(seed: string, variant?: string): MahjongRound {
	const selected = parseMahjongVariant(variant),
		stream = roundRng(seed),
		{ rng } = stream;
	const rules: MahjongRules = {
		groupSize: selected === 'mahjong-solitaire:triple-match' ? 3 : 2,
		exactOnly: selected === 'mahjong-solitaire:exact-only',
		peek: selected === 'mahjong-solitaire:face-down-peek',
		highlight: selected !== 'mahjong-solitaire:no-highlight',
		timeLimit: 0,
		hearts: selected === 'mahjong-solitaire:three-hearts' ? 3 : 0,
		undo: selected !== 'mahjong-solitaire:no-undo',
		hintLimit: selected === 'mahjong-solitaire:hint-budget' ? 3 : 0,
		shuffleLimit: selected === 'mahjong-solitaire:shuffle-budget' ? 3 : 0,
		avalanche: selected === 'mahjong-solitaire:avalanche'
	};
	const triple = rules.groupSize === 3;
	for (
		let bandIndex = triple ? 3 : rng.nextInt(MAHJONG_BANDS.length);
		bandIndex >= 0;
		bandIndex--
	) {
		const { layout, par } = triple
			? { layout: MAHJONG_LAYOUTS.triple, par: 600 }
			: MAHJONG_BANDS[bandIndex]!;
		rules.timeLimit = selected === 'mahjong-solitaire:countdown' ? par : 0;
		const faces = standardFaces(bandIndex === 0, rules);
		const initial = layout.positions.map((position, id) => ({
			...position,
			id,
			face: faces[id]!,
			removed: false,
			faceDown: false
		}));
		for (let attempt = 0; attempt < 100; attempt++) {
			const generated = deal(rng, initial, rules);
			if (!generated) continue;
			const round: MahjongRound = {
				seed,
				variant: selected,
				band: bandIndex + 1,
				layout,
				rules,
				tiles: generated.tiles,
				par,
				removals: 0,
				hintsUsed: 0,
				shufflesUsed: 0,
				moves: 0,
				lastAt: -1,
				status: 'playing',
				history: [],
				lastHint: [],
				lastMismatch: [],
				hearts: rules.hearts,
				rngDraws: stream.draws()
			};
			if (!validateMahjongWitness(round, generated.witness)) continue;
			if (rules.peek)
				for (const id of shuffle(
					rng,
					round.tiles.map((tile) => tile.id)
				).slice(0, 12))
					round.tiles[id]!.faceDown = true;
			round.rngDraws = stream.draws();
			witnesses.set(round.tiles, generated.witness);
			return round;
		}
		if (triple) break;
	}
	throw new RangeError('generation_exhausted');
}
export function mahjongRemainingMs(round: MahjongRound, at = round.lastAt): number {
	return Math.max(0, round.rules.timeLimit * 1000 - Math.max(0, at));
}
export function applyMahjongMove(round: MahjongRound, move: MahjongMove): MahjongRound {
	if (
		round.status !== 'playing' ||
		Object.values(move).some((value) => !Number.isSafeInteger(value))
	)
		throw new RangeError('move');
	const keys = Object.keys(move)
		.filter((key) => key !== 'at')
		.sort()
		.join(',');
	const matchKeys = round.rules.groupSize === 3 ? 'tileA,tileB,tileC' : 'tileA,tileB';
	if (keys !== matchKeys && keys !== 'action' && !(round.rules.peek && keys === 'tile'))
		throw new RangeError('move');
	if (
		round.rules.timeLimit
			? move.at === undefined || move.at < 0 || move.at < round.lastAt || move.at > 7200000
			: 'at' in move
	)
		throw new RangeError('at');
	const free = mahjongFreeTiles(round);
	if (
		keys === 'action' &&
		(!Object.values(MAHJONG_ACTION).includes(move.action as 1 | 2 | 3 | 4 | 5) ||
			(move.action === MAHJONG_ACTION.tick && !round.rules.timeLimit))
	)
		throw new RangeError('action');
	if (move.action === MAHJONG_ACTION.undo && (!round.rules.undo || !round.history.length))
		throw new RangeError('undo');
	if (
		move.action === MAHJONG_ACTION.hint &&
		round.rules.hintLimit > 0 &&
		round.hintsUsed >= round.rules.hintLimit
	)
		throw new RangeError('hint_limit');
	if (
		move.action === MAHJONG_ACTION.shuffle &&
		round.rules.shuffleLimit > 0 &&
		round.shufflesUsed >= round.rules.shuffleLimit
	)
		throw new RangeError('shuffle_limit');
	if (keys === 'tile' && (!free.includes(move.tile!) || !round.tiles[move.tile!]!.faceDown))
		throw new RangeError('peek');
	if (keys === matchKeys) {
		const ids = [move.tileA!, move.tileB!, ...(round.rules.groupSize === 3 ? [move.tileC!] : [])];
		if (
			new Set(ids).size !== ids.length ||
			!ids.every((id) => free.includes(id) && !round.tiles[id]!.faceDown) ||
			(!round.rules.hearts && !mahjongMatches(round, ids))
		)
			throw new RangeError('match');
	}
	const next: MahjongRound = {
		...round,
		tiles: copyTiles(round.tiles),
		history: round.history.slice(),
		moves: round.moves + 1,
		lastAt: move.at ?? round.lastAt,
		lastHint: [],
		lastMismatch: []
	};
	if (round.rules.timeLimit && mahjongRemainingMs(next) === 0) {
		next.status = 'lost';
		return next;
	}
	if (keys === 'tile') {
		const id = move.tile!;
		if (!mahjongFreeTiles(round).includes(id) || !next.tiles[id]!.faceDown)
			throw new RangeError('peek');
		next.tiles[id]!.faceDown = false;
	} else if (keys === matchKeys) {
		const ids = [move.tileA!, move.tileB!, ...(round.rules.groupSize === 3 ? [move.tileC!] : [])],
			free = mahjongFreeTiles(round);
		if (
			new Set(ids).size !== ids.length ||
			!ids.every((id) => free.includes(id) && !round.tiles[id]!.faceDown)
		)
			throw new RangeError('match');
		if (!mahjongMatches(round, ids)) {
			if (!round.rules.hearts) throw new RangeError('match');
			next.hearts--;
			next.lastMismatch = ids;
		} else {
			next.history.push(copyTiles(round.tiles));
			removeTiles(next.tiles, ids, round.rules.avalanche);
			next.removals++;
		}
	} else if (move.action === MAHJONG_ACTION.hint) {
		if (round.rules.hintLimit && round.hintsUsed >= round.rules.hintLimit)
			throw new RangeError('hint_limit');
		next.lastHint = mahjongHint(round);
		if (!next.lastHint.length) throw new RangeError('hint');
		next.hintsUsed++;
	} else if (move.action === MAHJONG_ACTION.undo) {
		if (!round.rules.undo || !next.history.length) throw new RangeError('undo');
		next.tiles = copyTiles(next.history.pop()!).map((tile) => ({
			...tile,
			faceDown: tile.faceDown && round.tiles[tile.id]!.faceDown
		}));
		next.removals--;
	} else if (move.action === MAHJONG_ACTION.shuffle) {
		if (round.rules.shuffleLimit && round.shufflesUsed >= round.rules.shuffleLimit)
			throw new RangeError('shuffle_limit');
		const stream = roundRng(round.seed, round.rngDraws);
		let generated: ReturnType<typeof deal> = null;
		for (let attempt = 0; attempt < 100; attempt++) {
			const candidate = deal(stream.rng, round.tiles, round.rules);
			if (
				candidate &&
				validateMahjongWitness({ ...next, tiles: candidate.tiles }, candidate.witness)
			) {
				generated = candidate;
				break;
			}
		}
		if (!generated) throw new RangeError('generation_exhausted');
		next.tiles = generated.tiles;
		next.rngDraws = stream.draws();
		next.history = [];
		next.shufflesUsed++;
		witnesses.set(next.tiles, generated.witness);
	} else if (move.action === MAHJONG_ACTION.restart) {
		const original = createMahjongRound(round.seed, variantFromRules(round.rules));
		next.tiles = original.tiles;
		next.history = [];
		next.removals = 0;
	} else if (move.action !== MAHJONG_ACTION.tick || !round.rules.timeLimit)
		throw new RangeError('action');
	if (round.rules.hearts && next.hearts === 0) next.status = 'lost';
	else if (next.tiles.every((tile) => tile.removed)) next.status = 'won';
	else if (next.moves >= MAHJONG_MAX_MOVES) next.status = 'lost';
	else if (
		!legalGroups(next).length &&
		!next.tiles.some(
			(tile) => !tile.removed && tile.faceDown && mahjongFreeTiles(next).includes(tile.id)
		) &&
		!(next.rules.undo && next.history.length) &&
		((next.rules.shuffleLimit > 0 && next.shufflesUsed >= next.rules.shuffleLimit) ||
			mahjongFreeTiles(next).length < next.rules.groupSize)
	)
		next.status = 'lost';
	return next;
}
export function mahjongScore(
	round: MahjongRound,
	seconds: number,
	scoring: ScoreValues = scoringDefinition.defaults
): number {
	if (!Number.isSafeInteger(seconds) || seconds < 0) throw new RangeError('elapsed');
	if (round.status !== 'won') return 0;
	if (round.rules.timeLimit && mahjongRemainingMs(round, seconds * 1000) === 0)
		throw new RangeError('timeout');
	return Math.max(
		0,
		scoring.completion! +
			round.removals * (round.rules.groupSize === 3 ? scoring.triple! : scoring.pair!) +
			Math.max(0, round.par - seconds) * scoring.second! -
			round.hintsUsed * scoring.hint! -
			round.shufflesUsed * scoring.shuffle! +
			(round.rules.timeLimit
				? Math.floor(mahjongRemainingMs(round, seconds * 1000) / 1000) * scoring.countdown!
				: 0) +
			(round.rules.hearts ? round.hearts * scoring.heart! : 0)
	);
}
