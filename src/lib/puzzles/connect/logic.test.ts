import { describe, expect, it } from 'vitest';
import {
	applyConnectMove,
	connectedCount,
	connectScore,
	createConnectRound,
	filledCount
} from './logic.js';

describe('Connect generation and replay', () => {
	it('constructs a valid full-grid solution across 1200 seeds', () => {
		for (let seed = 0; seed < 1200; seed++) {
			const round = createConnectRound(String(seed));
			const cells = round.solution.flat();
			expect(cells.length).toBe(round.size * round.size);
			expect(new Set(cells).size).toBe(cells.length);
			for (const path of round.solution) {
				expect(path.length).toBeGreaterThanOrEqual(3);
				for (let i = 1; i < path.length; i++) {
					const a = path[i - 1]!,
						b = path[i]!;
					expect(
						Math.abs(Math.floor(a / round.size) - Math.floor(b / round.size)) +
							Math.abs((a % round.size) - (b % round.size))
					).toBe(1);
				}
			}
		}
	});
	it('accepts the witness through the public move reducer and scores a full grid', () => {
		let round = createConnectRound('314159');
		for (const [pair, path] of round.solution.entries()) {
			for (const [at, cell] of path.entries())
				round = applyConnectMove(round, { pair, cell, stroke: pair, at: pair * 100 + at });
		}
		expect(round.status).toBe('won');
		expect(connectedCount(round)).toBe(round.pairs.length);
		expect(connectScore(round, 0)).toBe(round.pairs.length * 200 + 1000 + round.par * 10);
	});
	it('finishes when all pairs connect with gaps, awarding no full-grid bonus', () => {
		let round = createConnectRound('1');
		for (const [pair, path] of round.solution.entries()) {
			const cells = pair === 2 ? [path[0]!, path[1]!, path[2]!, path.at(-1)!] : path;
			for (const [at, cell] of cells.entries())
				round = applyConnectMove(round, { pair, cell, stroke: pair, at: pair * 100 + at });
		}
		expect(round.status).toBe('won');
		expect(connectedCount(round)).toBe(round.pairs.length);
		expect(filledCount(round)).toBe(45);
		expect(connectScore(round, 0)).toBe(round.pairs.length * 200 + round.par * 10);
	});
	it('rejects diagonals and foreign endpoints', () => {
		const round = createConnectRound('23');
		const pair = round.pairs[0]!;
		const started = applyConnectMove(round, { pair: 0, cell: pair.a, stroke: 0, at: 0 });
		expect(() => applyConnectMove(started, { pair: 0, cell: pair.b, stroke: 0, at: 1 })).toThrow();
	});
	it('cuts a crossed path and charges a later redraw of a connected pair', () => {
		let round = createConnectRound('314159');
		for (const [at, cell] of round.solution[0]!.entries())
			round = applyConnectMove(round, { pair: 0, cell, stroke: 0, at });
		expect(connectedCount(round)).toBe(1);
		for (const [at, cell] of [7, 6].entries())
			round = applyConnectMove(round, { pair: 2, cell, stroke: 1, at: 100 + at });
		expect(round.paths[0]).toEqual([0, 1]);
		expect(connectedCount(round)).toBe(0);
		round = applyConnectMove(round, { pair: 0, cell: 0, stroke: 2, at: 200 });
		expect(round.penalties).toBe(50);
	});
	it('requires full-grid coverage to win in connect:full-grid variant', () => {
		let round = createConnectRound('1', 'connect:full-grid');
		expect(round.variant).toBe('connect:full-grid');
		// Connect all pairs but with a shortcut that leaves empty cells
		for (const [pair, path] of round.solution.entries()) {
			const cells = pair === 2 ? [path[0]!, path[1]!, path[2]!, path.at(-1)!] : path;
			for (const [at, cell] of cells.entries())
				round = applyConnectMove(round, { pair, cell, stroke: pair, at: pair * 100 + at });
		}
		expect(connectedCount(round)).toBe(round.pairs.length);
		expect(filledCount(round)).toBeLessThan(round.size * round.size);
		expect(round.status).toBe('playing');

		// Recreate and solve with full grid
		let fullRound = createConnectRound('1', 'connect:full-grid');
		for (const [pair, path] of fullRound.solution.entries()) {
			for (const [at, cell] of path.entries())
				fullRound = applyConnectMove(fullRound, { pair, cell, stroke: pair, at: pair * 100 + at });
		}
		expect(fullRound.status).toBe('won');
		expect(filledCount(fullRound)).toBe(fullRound.size * fullRound.size);
	});
	it('generates an 8x8 board with 8 pairs for connect:board-8', () => {
		const round = createConnectRound('42', 'connect:board-8');
		expect(round.variant).toBe('connect:board-8');
		expect(round.size).toBe(8);
		expect(round.pairs.length).toBe(8);
		expect(round.solution.flat().length).toBe(64);
		expect(round.par).toBe(210);
	});
});
