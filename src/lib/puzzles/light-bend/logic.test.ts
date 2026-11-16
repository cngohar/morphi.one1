import { describe, expect, it, vi } from 'vitest';
import type { Move } from '#lib/engine/contract.js';
import { manifest } from './manifest.js';
import { scoring } from './scoring.js';
import {
	applyLightBendMove,
	createLightBendRound,
	createLightBendRoundInner,
	dailySeedOk,
	encodeRules,
	hintCell,
	lightBendHints,
	lightBendRejections,
	lightBendScore,
	lightBendStarGrade,
	lightBendTurned,
	lightBendWitness,
	LIGHT_BEND_ACTION,
	LIGHT_BEND_BANDS,
	LIGHT_BEND_CELL,
	LIGHT_BEND_COUNTDOWN,
	LIGHT_BEND_HINTS,
	LIGHT_BEND_VARIANTS,
	parseLightBendMove,
	parseLightBendVariant,
	reachableCells,
	resetLightBendRejections,
	resolveVariantFromRules,
	searchPar,
	traceBoard,
	validateLightBendReachability,
	validateLightBendWitness,
	variantRules,
	type LightBendBoard,
	type LightBendRound
} from './logic.js';

const SEEDS = ['1', '42', '314159'];

/** Static board data the tracer reads, extracted from a generated round. */
const boardOf = (round: LightBendRound): LightBendBoard => ({
	width: round.width,
	height: round.height,
	cells: round.cells,
	crystalCells: round.crystalCells,
	crystalColours: round.crystalColours,
	checkpoints: round.checkpoints,
	mirrors: round.mirrors,
	splitters: round.splitters,
	portals: round.portals,
	filters: round.filters,
	sources: round.sources
});

function solve(round: LightBendRound): LightBendRound {
	let state = round;
	for (const move of lightBendWitness(round)) state = applyLightBendMove(state, move);
	return state;
}

/** Exhaustive minimum over orientation sets: par must equal this on small boards. */
function brutePar(round: LightBendRound): number {
	const board = boardOf(round);
	const count = round.mirrors.length;
	let best = Number.POSITIVE_INFINITY;
	for (let bits = 0; bits < 1 << count; bits++) {
		let flips = 0;
		const orientations = round.start.map((value, index) => {
			const flipped = (bits >> index) & 1;
			if (flipped) flips++;
			return value ^ flipped;
		});
		if (flips >= best) continue;
		if (traceBoard(board, orientations).complete) best = flips;
	}
	return best;
}

/** A crafted board: `mirror` cells marked, a `source` triple, and optional extras. */
function crafted(
	width: number,
	height: number,
	options: {
		mirrors?: number[];
		crystals?: [number, number][];
		checkpoints?: number[];
		splitters?: number[];
		portals?: number[];
		filters?: number[];
		walls?: number[];
		sources: number[];
	}
): LightBendBoard {
	const cells = Array<number>(width * height).fill(0);
	const crystals = options.crystals ?? [];
	for (const [cell] of crystals) cells[cell] = LIGHT_BEND_CELL.crystal;
	for (const cell of options.mirrors ?? []) cells[cell] = LIGHT_BEND_CELL.mirror;
	for (const cell of options.splitters ?? []) cells[cell] = LIGHT_BEND_CELL.splitter;
	for (const cell of options.portals ?? []) cells[cell] = LIGHT_BEND_CELL.portal;
	for (const cell of options.checkpoints ?? []) cells[cell] = LIGHT_BEND_CELL.checkpoint;
	for (const cell of options.walls ?? []) cells[cell] = LIGHT_BEND_CELL.wall;
	return {
		width,
		height,
		cells,
		crystalCells: crystals.map(([cell]) => cell),
		crystalColours: crystals.map(([, colour]) => colour),
		checkpoints: options.checkpoints ?? [],
		mirrors: options.mirrors ?? [],
		splitters: options.splitters ?? [],
		portals: options.portals ?? [],
		filters: options.filters ?? [],
		sources: options.sources
	};
}

describe('Light Bend beam trace', () => {
	it('reflects on both mirror faces and exits east/north/west/south without float math', () => {
		const row = (width: number) => (x: number, y: number) => y * width + x;
		for (const [orientation, expected] of [
			[0, 'north'],
			[1, 'south']
		] as const) {
			const width = 5;
			const at = row(width);
			const crystal = at(2, 0);
			const board = crafted(width, 5, {
				mirrors: [at(2, 2)],
				crystals: [[crystal, 1]],
				sources: [at(0, 2), 0, 1]
			});
			const trace = traceBoard(board, [orientation]);
			// `/` (0) turns a westward-facing... eastward beam north: it lights the crystal above.
			expect(trace.complete, expected).toBe(orientation === 0);
			expect(trace.lit).toBe(orientation === 0 ? 1 : 0);
			// Beam coordinates are integers in half-cell units.
			expect(trace.beam.every(Number.isInteger)).toBe(true);
			expect(trace.beam.length % 2).toBe(0);
		}
		// All four incoming directions resolve through both faces.
		const width = 5;
		const at = row(width);
		const centre = at(2, 2);
		for (const direction of [0, 1, 2, 3]) {
			for (const orientation of [0, 1]) {
				const trace = traceBoard(
					crafted(width, 5, {
						mirrors: [centre, at(2, 4), at(4, 2), at(0, 2)],
						sources: [centre, direction, 1]
					}),
					[orientation, 0, 0, 0]
				);
				expect(trace.beam.every(Number.isInteger)).toBe(true);
				expect(trace.steps).toBeGreaterThan(0);
			}
		}
	});

	it('passes through a crystal and lights it once, and a lit crystal stays lit for the trace', () => {
		const width = 6;
		const at = (x: number, y: number) => y * width + x;
		const trace = traceBoard(
			crafted(width, 3, {
				crystals: [
					[at(2, 1), 1],
					[at(4, 1), 1]
				],
				sources: [at(0, 1), 0, 1]
			}),
			[]
		);
		expect(trace.lit).toBe(0b11);
		expect(trace.path).toContain(at(2, 1));
		expect(trace.path).toContain(at(4, 1));
		expect(trace.complete).toBe(true);
	});

	it('stops at a wall and exits at the board edge, and never reads input from the beam', () => {
		const width = 5;
		const at = (x: number, y: number) => y * width + x;
		const walled = traceBoard(
			crafted(width, 3, { walls: [at(3, 1)], sources: [at(0, 1), 0, 1] }),
			[]
		);
		expect(walled.path).not.toContain(at(3, 1));
		expect(walled.path).toContain(at(2, 1));
		const open = traceBoard(crafted(width, 3, { sources: [at(0, 1), 0, 1] }), []);
		expect(open.path).toContain(at(4, 1));
		// Every cell is entered plus one final step out of the board.
		expect(open.steps).toBe(width);
		// The last beam point is one half-cell past the edge cell.
		expect(open.beam.at(-2)).toBe(4 * 2 + 1 + 1);
	});

	it('bounds a looping trace at the state guard instead of hanging, and reports it blocked', () => {
		// Four mirrors round a 3x3 ring; this orientation set sends the beam round it.
		const width = 3;
		const height = 3;
		const at = (x: number, y: number) => y * width + x;
		const board = crafted(width, height, {
			mirrors: [at(0, 0), at(1, 0), at(2, 0), at(0, 1)],
			crystals: [[at(2, 2), 1]],
			sources: [at(2, 1), 2, 1]
		});
		const trace = traceBoard(board, [0, 1, 0, 1]);
		const guard = 4 * width * height;
		expect(trace.steps).toBeLessThanOrEqual(guard);
		expect(trace.complete).toBe(false);
		expect(trace.lit).toBe(0);
		// The walk revisited a cell, which is exactly what the state guard exists for.
		expect(new Set(trace.path).size).toBeLessThan(trace.path.length);
	});

	it('splits one beam into two branches and merges two beams into one splitter', () => {
		const width = 5;
		const at = (x: number, y: number) => y * width + x;
		const splitter = at(3, 2);
		const split = traceBoard(
			crafted(width, 5, {
				splitters: [splitter],
				crystals: [
					[at(3, 1), 1],
					[at(3, 3), 1]
				],
				sources: [at(0, 2), 0, 1]
			}),
			[]
		);
		// Both perpendicular branches light their crystal.
		expect(split.lit).toBe(0b11);
		expect(split.complete).toBe(true);
		const merged = traceBoard(
			crafted(width, 5, {
				splitters: [splitter],
				crystals: [
					[at(1, 2), 1],
					[at(3, 0), 1]
				],
				sources: [at(0, 2), 0, 1, at(3, 4), 1, 1]
			}),
			[]
		);
		expect(merged.lit).toBe(0b11);
	});

	it('teleports through a portal pair in the same direction and stops if the exit is blocked', () => {
		const width = 6;
		const at = (x: number, y: number) => y * width + x;
		const entry = at(1, 1);
		const exit = at(4, 1);
		const through = traceBoard(
			crafted(width, 3, {
				portals: [entry, exit],
				walls: [at(2, 1), at(3, 1)],
				crystals: [[at(5, 1), 1]],
				sources: [at(0, 1), 0, 1]
			}),
			[]
		);
		expect(through.lit).toBe(1);
		// The beam polyline jumps between the pair, so the exit point is drawn, not walked.
		expect(through.beam).toContain((exit % width) * 2 + 1);
		const blocked = traceBoard(
			crafted(4, 3, {
				portals: [at(1, 1), at(2, 1)],
				walls: [at(3, 1)],
				sources: [at(0, 1), 0, 1]
			}),
			[]
		);
		expect(blocked.steps).toBeLessThan(6);
	});

	it('lights a crystal only in its own colour, including after a filter changes the beam', () => {
		const width = 6;
		const at = (x: number, y: number) => y * width + x;
		const crystal = at(3, 1);
		const wrong = traceBoard(
			crafted(width, 3, { crystals: [[crystal, 2]], sources: [at(0, 1), 0, 1] }),
			[]
		);
		expect(wrong.lit).toBe(0);
		expect(wrong.complete).toBe(false);
		const right = traceBoard(
			crafted(width, 3, { crystals: [[crystal, 1]], sources: [at(0, 1), 0, 1] }),
			[]
		);
		expect(right.lit).toBe(1);
		const filtered = traceBoard(
			crafted(width, 3, {
				crystals: [[crystal, 2]],
				filters: [at(1, 1), 2],
				sources: [at(0, 1), 0, 1]
			}),
			[]
		);
		expect(filtered.lit).toBe(1);
	});

	it('keeps two simultaneous sources separate: their beams cross without mixing', () => {
		const width = 5;
		const at = (x: number, y: number) => y * width + x;
		const trace = traceBoard(
			crafted(width, 4, {
				crystals: [
					[at(3, 2), 1],
					[at(1, 2), 2]
				],
				sources: [at(0, 2), 0, 1, at(4, 2), 2, 2]
			}),
			[]
		);
		expect(trace.lit).toBe(0b11);
		expect(trace.complete).toBe(true);
	});

	it('requires every checkpoint token to be touched as well as every crystal', () => {
		const width = 6;
		const at = (x: number, y: number) => y * width + x;
		const crystal = at(2, 1);
		const checkpoint = at(2, 2);
		const missed = traceBoard(
			crafted(width, 4, {
				crystals: [[crystal, 1]],
				checkpoints: [checkpoint],
				sources: [at(0, 1), 0, 1]
			}),
			[]
		);
		expect(missed.lit).toBe(1);
		expect(missed.touched).toBe(0);
		expect(missed.complete).toBe(false);
		const hit = traceBoard(
			crafted(width, 4, {
				crystals: [[crystal, 1]],
				checkpoints: [at(4, 1)],
				sources: [at(0, 1), 0, 1]
			}),
			[]
		);
		expect(hit.touched).toBe(0b1);
		expect(hit.complete).toBe(true);
	});
});

describe('Light Bend generation and fairness', () => {
	it('is deterministic per seed and varies across seeds, with the band drawn from the seed stream', () => {
		for (const variant of LIGHT_BEND_VARIANTS) {
			for (const seed of SEEDS) {
				const first = createLightBendRound(seed, variant);
				const second = createLightBendRound(seed, variant);
				expect(second).toEqual(first);
				// Restart must not re-roll: same seed, same board, same band, same par.
				expect(second.band).toBe(first.band);
				expect(second.par).toBe(first.par);
			}
		}
		expect(createLightBendRound('1')).toEqual(createLightBendRound('1', 'light-bend:classic'));
		const boards = new Set(
			Array.from({ length: 24 }, (_, index) =>
				JSON.stringify(createLightBendRound(String(index + 1)).cells)
			)
		);
		expect(boards.size).toBeGreaterThan(12);
		const bands = new Set(
			Array.from({ length: 60 }, (_, index) => createLightBendRound(String(index + 1)).band)
		);
		expect(bands.size).toBeGreaterThan(1);
	});

	it('validates the returned solution and issues only boards that pass every fairness gate', () => {
		for (const variant of LIGHT_BEND_VARIANTS) {
			for (const seed of SEEDS) {
				const round = createLightBendRound(seed, variant);
				// The returned shortest solution lights every crystal and touches every checkpoint.
				const solution = traceBoard(
					round.rules.mirror === 1
						? {
								...boardOf(round),
								active: round.mirrors.map((_, index) => {
									for (let at = 0; at + 1 < round.plan.length; at += 2)
										if (round.plan[at] === index) return 1;
									return 0;
								}),
								through: true
							}
						: boardOf(round),
					round.rules.mirror === 1
						? round.mirrors.map((_, index) => {
								for (let at = 0; at + 1 < round.plan.length; at += 2)
									if (round.plan[at] === index) return round.plan[at + 1]!;
								return 0;
							})
						: round.solution
				);
				expect(solution.complete, `${variant}/${seed}`).toBe(true);
				if (round.rules.mirror !== 1)
					expect(solution.hit.length, `${variant}/${seed} bends`).toBeGreaterThan(0);
				// (b) not already solved from the starting orientations.
				if (round.rules.mirror !== 1)
					expect(traceBoard(boardOf(round), round.start).complete, `${variant}/${seed}`).toBe(
						false
					);
				// (d)+(e) every mirror, crystal and checkpoint is inside the reachability closure.
				const closure = reachableCells(boardOf(round));
				for (const cell of round.crystalCells) {
					expect(closure[cell], `${variant}/${seed} crystal`).toBe(1);
					expect(round.cells[cell], `${variant}/${seed} crystal on wall`).not.toBe(
						LIGHT_BEND_CELL.wall
					);
				}
				for (const cell of round.checkpoints)
					expect(closure[cell], `${variant}/${seed} checkpoint`).toBe(1);
				if (round.rules.mirror !== 1)
					for (const cell of round.mirrors)
						expect(closure[cell], `${variant}/${seed} mirror`).toBe(1);
				// (f)/L17 a proven par inside the band's own window.
				const band = LIGHT_BEND_BANDS[round.band]!;
				expect(round.par).toBeGreaterThanOrEqual(band.parMin);
				expect(round.par).toBeLessThanOrEqual(band.parMax);
				expect(round.width).toBe(band.width);
				expect(round.height).toBe(band.height);
				expect(round.crystalCells).toHaveLength(band.crystals);
				// The board is bigger than a phone by design (full-screen proof, §6).
				if (round.band > 0) expect(round.width * round.height).toBeGreaterThan(70);
			}
		}
	});

	it('records a rejection tally per gate, so generation failures are a tuning signal', () => {
		resetLightBendRejections();
		for (const key of Object.keys(lightBendRejections)) expect(lightBendRejections[key]).toBe(0);
		for (let seed = 1; seed <= 12; seed++)
			for (const variant of LIGHT_BEND_VARIANTS) {
				try {
					createLightBendRoundInner(String(seed), variant);
				} catch {
					/* an exhausted seed is a recorded rejection, not a test failure */
				}
			}
		const gates = Object.keys(lightBendRejections);
		expect(gates.sort()).toEqual([
			'band',
			'bend',
			'crystal',
			'dead',
			'par',
			'path',
			'solved',
			'unreachable',
			'unsolved'
		]);
		expect(lightBendRejections.path! + lightBendRejections.band!).toBeGreaterThan(0);
		expect(lightBendRejections.solved!).toBeGreaterThan(0);
	});

	it('illustrates straight-line solutions and unreachable cells', () => {
		// (c) the planted walk must bend: a straight board has no mirror on the path.
		const straight = crafted(6, 3, {
			crystals: [[8, 1]],
			sources: [6, 0, 1]
		});
		expect(traceBoard(straight, []).complete).toBe(true);
		expect(straight.mirrors).toHaveLength(0);
		// (d) a mirror outside the closure is dead.
		const width = 6;
		const deadAt = 3;
		const walledOff = crafted(width, 3, {
			mirrors: [deadAt],
			walls: [2, 4, width + 3],
			crystals: [[5, 1]],
			sources: [0, 0, 1]
		});
		const closure = reachableCells(walledOff);
		expect(closure[deadAt]).toBe(0);
		// (e) a crystal outside the closure is unreachable.
		const unreachableCrystal = 14;
		const sealed = crafted(width, 3, {
			walls: [8, 13, 15],
			crystals: [[unreachableCrystal, 1]],
			sources: [6, 0, 1]
		});
		expect(reachableCells(sealed)[unreachableCrystal]).toBe(0);
	});

	it('rejects crafted failing witnesses, solved starts, dead mirrors and unreachable crystals', () => {
		const board = crafted(5, 3, {
			mirrors: [6],
			crystals: [[1, 1]],
			sources: [5, 0, 1]
		});
		expect(() => validateLightBendWitness(board, [1], [1], [], false)).toThrow('unsolved');
		expect(() => validateLightBendWitness(board, [0], [0], [], false)).toThrow('solved');
		expect(() => validateLightBendWitness(board, [1], [0], [], false)).not.toThrow();
		const dead = crafted(5, 3, {
			mirrors: [14],
			crystals: [[7, 1]],
			sources: [5, 0, 1]
		});
		expect(() => validateLightBendReachability(dead, false)).toThrow('dead');
		const unreachable = crafted(5, 3, {
			crystals: [[14, 1]],
			sources: [5, 0, 1]
		});
		expect(() => validateLightBendReachability(unreachable, false)).toThrow('unreachable');
	});

	it('finds a shorter solution than a valid planted orientation', () => {
		const board = crafted(5, 3, {
			mirrors: [6, 11],
			crystals: [[1, 1]],
			sources: [5, 0, 1]
		});
		const start = [1, 0];
		const planted = [0, 1];
		expect(traceBoard(board, planted).complete).toBe(true);
		expect(() => validateLightBendWitness(board, start, planted, [], false)).not.toThrow();
		const shortest = searchPar(board, start, 100)!;
		expect(shortest.par).toBe(1);
		expect(traceBoard(board, shortest.solution).complete).toBe(true);
		expect(planted.filter((value, index) => value !== start[index])).toHaveLength(2);
	});

	it('computes par as the true minimum over all solutions', () => {
		let proven = 0;
		for (let seed = 1; seed <= 200 && proven < 24; seed++) {
			const round = createLightBendRoundInner(String(seed * 7919));
			if (round.band > 1 || round.mirrors.length > 10) continue;
			proven++;
			expect(round.par).toBe(brutePar(round));
			let solutionCost = 0;
			for (let index = 0; index < round.mirrors.length; index++)
				if (round.solution[index] !== round.start[index]) solutionCost++;
			expect(solutionCost).toBe(round.par);
		}
		expect(proven).toBeGreaterThan(8);
	});

	it('never issues a crystal-order board combined with splitters or two sources (E1/E2)', () => {
		for (const variant of LIGHT_BEND_VARIANTS) {
			const rules = variantRules(variant);
			// `win` 1..3 are the crystal-order/chain/latching axes Batch A does not build.
			expect(rules.win === 0 || rules.win === 4, variant).toBe(true);
			if (rules.win === 1 || rules.win === 2) {
				expect(rules.beam, variant).not.toBe(2);
				expect(rules.sources, variant).not.toBe(2);
			}
		}
	});

	it('treats a dead seed as a generation failure and gates the daily walk on the same pipeline', () => {
		expect(dailySeedOk('1')).toBe(true);
		expect(dailySeedOk('42', 'light-bend:splitter')).toBe(true);
		expect(dailySeedOk('not-a-seed')).toBe(false);
		// A seed that exhausts its 100 attempts must throw, and dailySeedOk must say no.
		const exhausted = Array.from({ length: 40 }, (_, index) => String(index + 1)).find(
			(seed) => !dailySeedOk(seed, 'light-bend:place-your-own')
		);
		if (exhausted !== undefined) {
			expect(() => createLightBendRoundInner(exhausted, 'light-bend:place-your-own')).toThrow(
				RangeError
			);
		}
		// dailySeedOk never throws: it reports failure as false.
		expect(typeof dailySeedOk('999999999999', 'light-bend:checkpoint')).toBe('boolean');
	});

	it('bounds generation exhaustion and makes dailySeedOk reject it', async () => {
		vi.resetModules();
		vi.doMock('#lib/engine/rng.js', async (importOriginal) => ({
			...(await importOriginal<typeof import('#lib/engine/rng.js')>()),
			createRng: () => ({ nextU64: () => 0n, nextInt: () => 0 })
		}));
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const isolated = await import('./logic.js');
			isolated.resetLightBendRejections();
			expect(isolated.dailySeedOk('1')).toBe(false);
			expect(Object.values(isolated.lightBendRejections).reduce((a, b) => a + b, 0)).toBe(100);
			expect(logged).toHaveBeenCalledOnce();
		} finally {
			logged.mockRestore();
			vi.doUnmock('#lib/engine/rng.js');
			vi.resetModules();
		}
	});
});

describe('Light Bend moves, replay and scoring', () => {
	it('rotates, undoes and resets, and throws on every illegal action', () => {
		const round = createLightBendRound('424242');
		const cell = round.mirrors[0]!;
		const rotated = applyLightBendMove(round, { action: LIGHT_BEND_ACTION.rotate, cell, value: 0 });
		expect(rotated.orientations[0]).not.toBe(round.orientations[0]);
		expect(rotated.moves).toBe(1);
		const undone = applyLightBendMove(rotated, {
			action: LIGHT_BEND_ACTION.undo,
			cell: 0,
			value: 0
		});
		expect(undone.orientations[0]).toBe(round.orientations[0]);
		expect(undone.undos).toBe(1);
		const reset = applyLightBendMove(rotated, {
			action: LIGHT_BEND_ACTION.reset,
			cell: 0,
			value: 0
		});
		expect(reset.orientations).toEqual(round.start);
		expect(reset.resets).toBe(1);
		expect(() =>
			applyLightBendMove(round, { action: LIGHT_BEND_ACTION.rotate, cell: 0, value: 0 })
		).toThrow(RangeError);
		expect(() =>
			applyLightBendMove(round, { action: LIGHT_BEND_ACTION.undo, cell: 0, value: 0 })
		).toThrow(RangeError);
		expect(() => applyLightBendMove(round, { action: 9, cell: 0, value: 0 })).toThrow(RangeError);
		const solved = solve(round);
		expect(() =>
			applyLightBendMove(solved, { action: LIGHT_BEND_ACTION.reset, cell: 0, value: 0 })
		).toThrow(RangeError);
	});

	it('validates the exact wire shape of a move and rejects tampered logs', () => {
		expect(parseLightBendMove({ action: 0, cell: 3, value: 0 } as Move)).toEqual({
			action: 0,
			cell: 3,
			value: 0
		});
		for (const bad of [
			null,
			[],
			'rotate',
			{ action: 0, cell: 0 },
			{ action: 0, cell: 0, value: 0, extra: 1 },
			{ action: -1, cell: 0, value: 0 },
			{ action: 0, cell: 1.5, value: 0 },
			{ action: 9, cell: 0, value: 0 }
		])
			expect(() => parseLightBendMove(bad as unknown as Move)).toThrow(RangeError);
	});

	it('replays a witness to a win and refuses an incomplete or illegal log', () => {
		for (const variant of LIGHT_BEND_VARIANTS) {
			for (const seed of SEEDS) {
				const moves = lightBendWitness(createLightBendRoundInner(seed, variant));
				const result = manifest.replay(seed, moves as Move[], 10, undefined, variant);
				expect(result.stars).toBeGreaterThanOrEqual(1);
				expect(result.stars).toBeLessThanOrEqual(3);
				expect(result.crystals).toBeGreaterThan(0);
				expect(result.score).toBeGreaterThan(0);
				expect(result).not.toHaveProperty('group');
				expect(() =>
					manifest.replay(seed, moves.slice(0, -1) as Move[], 10, undefined, variant)
				).toThrow(RangeError);
				expect(() =>
					manifest.replay(
						seed,
						[{ action: 0, cell: 0, value: 0 }] as Move[],
						10,
						undefined,
						variant
					)
				).toThrow(RangeError);
			}
		}
	});

	it('grades stars from the final board vs the start, so hints, undos and resets never move them', () => {
		const round = createLightBendRound('2024');
		const solved = solve(round);
		const plain = lightBendStarGrade(solved);
		const effort = lightBendTurned(solved);
		expect(plain).toBe(effort <= solved.par ? 3 : effort <= solved.par + 3 ? 2 : 1);
		// A hint costs points only: the grade is unchanged and no star is forfeited (L15).
		const hinted = applyLightBendMove(round, { action: LIGHT_BEND_ACTION.hint, cell: 0, value: 0 });
		const hintedWin = solve(hinted);
		expect(lightBendStarGrade(hintedWin)).toBe(lightBendStarGrade(solved));
		expect(lightBendScore(hintedWin, 10)).toBeLessThan(lightBendScore(solved, 10));
		// A rotation undone again leaves the state-diff count where it was.
		const flipped = round.mirrors.find((mirror) => {
			try {
				return (
					applyLightBendMove(round, { action: LIGHT_BEND_ACTION.rotate, cell: mirror, value: 0 })
						.status === 'playing'
				);
			} catch {
				return false;
			}
		});
		expect(flipped).toBeDefined();
		const roundTrip = applyLightBendMove(
			applyLightBendMove(round, { action: LIGHT_BEND_ACTION.rotate, cell: flipped!, value: 0 }),
			{ action: LIGHT_BEND_ACTION.undo, cell: 0, value: 0 }
		);
		expect(lightBendTurned(roundTrip)).toBe(lightBendTurned(round));
		// Stars downgrade as the state diff grows past par (3 at par, 2 at par+1..par+3, else 1).
		const effortful = Array.from({ length: 40 }, (_, index) =>
			solve(createLightBendRound(String(index + 1)))
		).reduce((best, round) => (lightBendTurned(round) > lightBendTurned(best) ? round : best));
		const diff = lightBendTurned(effortful);
		expect(diff).toBeGreaterThan(4);
		expect(lightBendStarGrade({ ...effortful, par: diff })).toBe(3);
		expect(lightBendStarGrade({ ...effortful, par: diff - 1 })).toBe(2);
		expect(lightBendStarGrade({ ...effortful, par: diff - 3 })).toBe(2);
		expect(lightBendStarGrade({ ...effortful, par: diff - 4 })).toBe(1);
		expect(lightBendStarGrade({ ...effortful, status: 'playing' })).toBe(0);
	});

	it('scores Classic against the clock floor and Countdown against remaining seconds', () => {
		const solved = solve(createLightBendRound('777'));
		expect(lightBendScore(solved, 0)).toBe(1000);
		expect(lightBendScore(solved, 60)).toBe(1000 - 4 * 60);
		// The win component floors at 200, so a slow clear still scores.
		expect(lightBendScore(solved, 1000)).toBe(200);
		expect(() => lightBendScore(solved, -1)).toThrow(RangeError);
		expect(() => lightBendScore(solved, 1.5)).toThrow(RangeError);
		// A rotation flips the board back to playing, so a half-finished round scores nothing.
		const midway = applyLightBendMove(createLightBendRound('777'), {
			action: LIGHT_BEND_ACTION.rotate,
			cell: createLightBendRound('777').mirrors[0]!,
			value: 0
		});
		if (midway.status === 'playing') expect(() => lightBendScore(midway, 10)).toThrow(RangeError);
		const timed = solve(createLightBendRound('777', 'light-bend:countdown-120'));
		expect(lightBendScore(timed, 0)).toBe(1000 + LIGHT_BEND_COUNTDOWN * 10);
		expect(lightBendScore(timed, 119)).toBe(1000 + 10);
		expect(() => lightBendScore(timed, LIGHT_BEND_COUNTDOWN)).toThrow(RangeError);
		expect(() => lightBendScore(timed, 121)).toThrow(RangeError);
		// Scoring never goes below zero, and the definition is the locked brief-v1 shape.
		expect(scoring.fields).toEqual([
			'completion',
			'second',
			'hint',
			'reset',
			'countdown',
			'hintSolvedRanks'
		]);
		expect(scoring.defaults).toEqual({
			completion: 1000,
			second: 4,
			hint: 100,
			reset: 50,
			countdown: 10,
			hintSolvedRanks: 1
		});
		expect(
			Math.min(...[-1, 0, 1].map((seconds) => lightBendScore(solved, Math.max(0, seconds))))
		).toBe(996);
	});

	it('hints against the shortest solution and never flags a mirror that is already correct', () => {
		for (const seed of ['11', '7919', '104729']) {
			const round = createLightBendRound(seed);
			const hint = hintCell(round);
			expect(round.mirrors).toContain(hint);
			const index = round.mirrors.indexOf(hint);
			expect(round.orientations[index]).not.toBe(round.solution[index]);
			// Already-correct mirrors are never the hint.
			const correct = round.mirrors.filter(
				(_, at) => round.orientations[at] === round.solution[at]
			);
			expect(correct).not.toContain(hint);
			// Once the board is solved there is nothing left to hint.
			expect(hintCell(solve(round))).toBe(-1);
		}
		// The hint budget is 3 per round and is sticky across a reset.
		let round = createLightBendRound('555');
		expect(lightBendHints(round.rules)).toBe(LIGHT_BEND_HINTS);
		for (let used = 0; used < LIGHT_BEND_HINTS; used++)
			round = applyLightBendMove(round, { action: LIGHT_BEND_ACTION.hint, cell: 0, value: 0 });
		expect(round.hintsUsed).toBe(LIGHT_BEND_HINTS);
		expect(() =>
			applyLightBendMove(round, { action: LIGHT_BEND_ACTION.hint, cell: 0, value: 0 })
		).toThrow(RangeError);
		const restarted = applyLightBendMove(round, {
			action: LIGHT_BEND_ACTION.reset,
			cell: 0,
			value: 0
		});
		expect(restarted.hintsUsed).toBe(LIGHT_BEND_HINTS);
	});

	it('refuses every hint and every undo when the round supplies none', () => {
		const noHint = createLightBendRound('424242', 'light-bend:no-hint');
		expect(lightBendHints(noHint.rules)).toBe(0);
		expect(() =>
			applyLightBendMove(noHint, { action: LIGHT_BEND_ACTION.hint, cell: 0, value: 0 })
		).toThrow(RangeError);
		const noUndo = createLightBendRound('424242', 'light-bend:no-undo');
		const moved = applyLightBendMove(noUndo, {
			action: LIGHT_BEND_ACTION.rotate,
			cell: noUndo.mirrors[0]!,
			value: 0
		});
		expect(() =>
			applyLightBendMove(moved, { action: LIGHT_BEND_ACTION.undo, cell: 0, value: 0 })
		).toThrow(RangeError);
		// Reset still recovers a wrong move when undo is gone.
		expect(
			applyLightBendMove(moved, { action: LIGHT_BEND_ACTION.reset, cell: 0, value: 0 }).orientations
		).toEqual(noUndo.start);
	});

	it('holds no-preview wins back until Fire, and clears the firing on any later edit', () => {
		const round = createLightBendRound('777001', 'light-bend:no-preview');
		let state = round;
		for (const move of lightBendWitness(round))
			if (move.action !== LIGHT_BEND_ACTION.fire) state = applyLightBendMove(state, move);
		// The trace is complete but the round has not been judged yet.
		expect(traceBoard(boardOf(state), state.orientations).complete).toBe(true);
		expect(state.status).toBe('playing');
		const fired = applyLightBendMove(state, { action: LIGHT_BEND_ACTION.fire, cell: 0, value: 0 });
		expect(fired.status).toBe('won');
		// A later rotation clears the firing and returns the round to play.
		const edited = applyLightBendMove(round, {
			action: LIGHT_BEND_ACTION.rotate,
			cell: round.mirrors[0]!,
			value: 0
		});
		expect(edited.fired).toBe(false);
		expect(edited.status).toBe('playing');
	});

	it('places and rotates a tray of mirrors in place-your-own, and par fits the tray', () => {
		const round = createLightBendRound('666001', 'light-bend:place-your-own');
		expect(round.rules.mirror).toBe(1);
		expect(round.placed.every((value) => value === 0)).toBe(true);
		expect(round.par).toBeGreaterThanOrEqual(1);
		expect(round.par).toBeLessThanOrEqual(round.tray);
		const cell = round.mirrors[0]!;
		const placed = applyLightBendMove(round, { action: LIGHT_BEND_ACTION.place, cell, value: 0 });
		expect(placed.placed[0]).toBe(1);
		expect(placed.tray).toBe(round.tray - 1);
		expect(() =>
			applyLightBendMove(placed, { action: LIGHT_BEND_ACTION.place, cell, value: 0 })
		).toThrow(RangeError);
		expect(() =>
			applyLightBendMove(placed, { action: LIGHT_BEND_ACTION.rotate, cell, value: 0 })
		).toThrow(RangeError);
		// Undo frees the mirror back into the tray.
		const freed = applyLightBendMove(placed, { action: LIGHT_BEND_ACTION.undo, cell: 0, value: 0 });
		expect(freed.tray).toBe(round.tray);
		expect(freed.placed[0]).toBe(0);
		expect(solve(round).status).toBe('won');
		// Placement is Gentle only, so the tray is a small hand, not a whole board.
		expect(round.band).toBe(0);
	});
});

describe('Light Bend rules encoding and manifest', () => {
	it('encodes every Batch A variant as a unique eight-key integer tuple', () => {
		const seen = new Map<string, string>();
		for (const variant of LIGHT_BEND_VARIANTS) {
			const rules = variantRules(variant);
			expect(Object.keys(encodeRules(rules)).sort()).toEqual([
				'beam',
				'hint',
				'info',
				'limit',
				'mirror',
				'sources',
				'undo',
				'win'
			]);
			expect(Object.values(rules).every((value) => Number.isSafeInteger(value))).toBe(true);
			const key = JSON.stringify(encodeRules(rules));
			expect(seen.has(key), variant).toBe(false);
			seen.set(key, variant);
			expect(resolveVariantFromRules(encodeRules(rules))).toBe(variant);
			expect(resolveVariantFromRules(encodeRules(rules) as Record<string, number | boolean>)).toBe(
				variant
			);
		}
		expect(seen.size).toBe(LIGHT_BEND_VARIANTS.length);
		// Classic is all zeros; each other variant differs in exactly one key.
		const classic = encodeRules(variantRules('light-bend:classic'));
		expect(Object.values(classic).every((value) => value === 0 || value === 1)).toBe(true);
		for (const variant of LIGHT_BEND_VARIANTS) {
			if (variant === 'light-bend:classic') continue;
			const rules = encodeRules(variantRules(variant));
			const differing = Object.keys(classic).filter(
				(key) => rules[key as keyof typeof rules] !== classic[key as keyof typeof classic]
			);
			expect(differing, variant).toHaveLength(1);
		}
		// An inexact match never resolves to a variant.
		expect(resolveVariantFromRules({ ...classic, extra: 0 })).toBeUndefined();
		expect(resolveVariantFromRules({ ...classic, beam: 99 })).toBeUndefined();
		expect(resolveVariantFromRules({})).toBeUndefined();
	});

	it('rejects an unknown variant rather than guessing one', () => {
		expect(parseLightBendVariant(undefined)).toBe('light-bend:classic');
		expect(parseLightBendVariant('light-bend:classic')).toBe('light-bend:classic');
		expect(() => parseLightBendVariant('light-bend:nope')).toThrow(RangeError);
		expect(() => createLightBendRoundInner('1', 'light-bend:nope')).toThrow(RangeError);
		expect(() => lightBendWitness(createLightBendRoundInner('1', 'light-bend:nope'))).toThrow(
			RangeError
		);
	});

	it('declares eleven enabled presets with zero groups and a 2,500 ms ranked floor', () => {
		expect(manifest.id).toBe('light-bend');
		expect(manifest.enabled).toBe(true);
		expect(manifest.engineVersion).toBe('light-bend-1');
		expect(manifest.maxMoves).toBe(10000);
		expect(manifest.presentation.groups).toEqual({});
		expect(manifest).not.toHaveProperty('leaderboardGroups');
		expect(manifest.variants).toHaveLength(11);
		for (const variant of manifest.variants!)
			expect(variant).not.toHaveProperty('leaderboardGroups');
		expect(manifest.rankedTiming.minimumSeconds()).toBe(2.5);
		expect(manifest.rankedTiming.openingMs()).toBe(3000);
		expect(typeof manifest.dailySeedOk).toBe('function');
		expect(typeof manifest.resolveVariantFromRules).toBe('function');
		const timed = manifest.variants!.find((variant) => variant.id === 'light-bend:countdown-120');
		expect(timed?.maxSeconds).toBe(LIGHT_BEND_COUNTDOWN);
		expect(timed?.ending?.kind).toBe('run_over');
		expect(manifest.ending.kind).toBe('completion');
		for (const variant of manifest.variants!) {
			expect(variant.enabled).toBe(true);
			expect(variant.weight).toBe(1);
			// Scoring scope is the family (one `brief-v1` config for all eleven).
			expect(variant).not.toHaveProperty('scoring');
		}
	});
});
