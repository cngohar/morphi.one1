import { describe, expect, it } from 'vitest';
import {
	applyMahjongMove,
	createMahjongRound,
	MAHJONG_ACTION,
	MAHJONG_MAX_MOVES,
	MAHJONG_VARIANTS,
	mahjongAvalanche,
	mahjongFreeTiles,
	mahjongHint,
	mahjongMatches,
	mahjongRemainingMs,
	mahjongScore,
	mahjongWitness,
	validateMahjongWitness,
	type MahjongMove,
	type MahjongRound
} from './logic.js';

function round(variant: string, seed = '1') {
	return createMahjongRound(seed, `mahjong-solitaire:${variant}`);
}
function pair(game: MahjongRound, ids = mahjongHint(game)): MahjongMove {
	return {
		tileA: ids[0]!,
		tileB: ids[1]!,
		...(game.rules.groupSize === 3 ? { tileC: ids[2]! } : {}),
		...(game.rules.timeLimit ? { at: Math.max(0, game.lastAt) } : {})
	};
}
function solve(game: MahjongRound) {
	const witness = mahjongWitness(game);
	for (const ids of witness) {
		for (const id of ids) if (game.tiles[id]!.faceDown) game = applyMahjongMove(game, { tile: id });
		game = applyMahjongMove(game, pair(game, ids));
	}
	return game;
}

describe('Mahjong Solitaire Batch A rule deltas', () => {
	it('validates deterministic witnesses under all eleven rule sets and changes no other rule axis', () => {
		const baseline = round('classic');
		const axes: Record<string, string> = {
			'triple-match': 'groupSize',
			'exact-only': 'exactOnly',
			'face-down-peek': 'peek',
			'no-highlight': 'highlight',
			countdown: 'timeLimit',
			'three-hearts': 'hearts',
			'no-undo': 'undo',
			'hint-budget': 'hintLimit',
			'shuffle-budget': 'shuffleLimit',
			avalanche: 'avalanche'
		};
		for (const variant of MAHJONG_VARIANTS) {
			const game = createMahjongRound('1', variant);
			expect(createMahjongRound('1', variant)).toEqual(game);
			expect(validateMahjongWitness(game, mahjongWitness(game))).toBe(true);
			if (variant !== 'mahjong-solitaire:classic')
				expect(
					Object.keys(game.rules).filter((key) => game.rules[key] !== baseline.rules[key])
				).toEqual([axes[variant.split(':')[1]!]!]);
			expect(solve(game).status).toBe('won');
		}
	});

	it('deals Triple Turtle108 only, matching and scoring groups of three', () => {
		const game = round('triple-match');
		expect(game.band).toBe(4);
		expect(game.tiles).toHaveLength(108);
		expect(mahjongWitness(game)).toHaveLength(36);
		expect(game.tiles.filter((tile) => tile.z === 0)).toHaveLength(63);
		expect(game.tiles.filter((tile) => tile.face.startsWith('F'))).toHaveLength(3);
		const ids = mahjongWitness(game)[0]!;
		expect(() => applyMahjongMove(game, { tileA: ids[0], tileB: ids[1] })).toThrow(RangeError);
		expect(mahjongMatches(game, ids)).toBe(true);
		const won = solve(game);
		expect(mahjongScore(won, 600)).toBe(6400);
	});

	it('deals the paired bonus set for exact-only and disallows distinct Flower/Season faces', () => {
		const game = round('exact-only');
		const tiles = game.tiles.slice(0, 2).map((tile, id) => ({ ...tile, id, face: `F${id + 1}` }));
		expect(mahjongMatches({ ...game, tiles }, [0, 1])).toBe(false);
		expect(
			mahjongMatches({ ...game, rules: { ...game.rules, exactOnly: false }, tiles }, [0, 1])
		).toBe(true);
		for (const seed of ['1', '2', '3', '4', '5', '6']) {
			const generated = round('exact-only', seed);
			if (generated.band === 1) continue;
			expect(
				generated.tiles
					.filter((tile) => /^[FS]/.test(tile.face))
					.map((tile) => tile.face)
					.sort()
			).toEqual(['F1', 'F1', 'F2', 'F2', 'S1', 'S1', 'S2', 'S2']);
		}
	});

	it('records twelve hidden faces, permits only a free hidden peek, and never undoes information', () => {
		let game = round('face-down-peek');
		expect(game.tiles.filter((tile) => tile.faceDown)).toHaveLength(12);
		const witness = mahjongWitness(game);
		let hidden = -1;
		for (const ids of witness) {
			const id = ids.find((value) => game.tiles[value]!.faceDown);
			if (id !== undefined) {
				hidden = id;
				break;
			}
			game = applyMahjongMove(game, pair(game, ids));
		}
		expect(hidden).toBeGreaterThanOrEqual(0);
		expect(() =>
			applyMahjongMove(
				game,
				pair(game, [hidden, mahjongFreeTiles(game).find((id) => id !== hidden)!])
			)
		).toThrow(RangeError);
		const peeked = applyMahjongMove(game, { tile: hidden });
		expect(peeked.tiles[hidden]!.faceDown).toBe(false);
		expect(() => applyMahjongMove(peeked, { tile: hidden })).toThrow(RangeError);
		if (peeked.history.length)
			expect(
				applyMahjongMove(peeked, { action: MAHJONG_ACTION.undo }).tiles[hidden]!.faceDown
			).toBe(false);
	});

	it('hides highlights while keeping free geometry and blocked input identical', () => {
		const classic = round('classic'),
			hidden = round('no-highlight');
		expect(hidden.tiles).toEqual(classic.tiles);
		expect(mahjongFreeTiles(hidden)).toEqual(mahjongFreeTiles(classic));
		expect(hidden.rules.highlight).toBe(false);
		const blocked = hidden.tiles.find((tile) => !mahjongFreeTiles(hidden).includes(tile.id))!.id;
		expect(() =>
			applyMahjongMove(hidden, { tileA: blocked, tileB: mahjongFreeTiles(hidden)[0] })
		).toThrow(RangeError);
	});

	it('requires monotonic countdown timestamps, times out exactly, and rejects forged elapsed claims', () => {
		const game = round('countdown');
		expect(game.rules.timeLimit).toBe(game.band === 1 ? 180 : 600);
		expect(() => applyMahjongMove(game, { action: MAHJONG_ACTION.tick })).toThrow(RangeError);
		const ticked = applyMahjongMove(game, { action: MAHJONG_ACTION.tick, at: 1000 });
		expect(mahjongRemainingMs(ticked)).toBe(game.par * 1000 - 1000);
		expect(() => applyMahjongMove(ticked, { action: MAHJONG_ACTION.tick, at: 999 })).toThrow(
			RangeError
		);
		expect(() => applyMahjongMove(ticked, { action: 99, at: game.par * 1000 })).toThrow(RangeError);
		expect(() => applyMahjongMove(ticked, { tileA: -1, tileB: 0, at: game.par * 1000 })).toThrow(
			RangeError
		);
		expect(
			applyMahjongMove(ticked, { action: MAHJONG_ACTION.tick, at: game.par * 1000 }).status
		).toBe('lost');
		const won = solve(game);
		expect(mahjongScore(won, game.par - 1)).toBe(1000 + won.removals * 100 + 10);
		expect(() => mahjongScore(won, game.par)).toThrow(RangeError);
		expect(() =>
			applyMahjongMove(round('classic'), { action: MAHJONG_ACTION.hint, at: 0 })
		).toThrow(RangeError);
	});

	it('counts only recorded legal-free mismatches and loses on the third with no removal', () => {
		let game = round('three-hearts');
		const free = mahjongFreeTiles(game);
		const a = free[0]!,
			b = free.find((id) => !mahjongMatches(game, [a, id]) && id !== a)!;
		for (let count = 1; count <= 3; count++) {
			game = applyMahjongMove(game, { tileA: a, tileB: b });
			expect(game.hearts).toBe(3 - count);
			expect(game.lastMismatch).toEqual([a, b]);
		}
		expect(game.status).toBe('lost');
		expect(game.removals).toBe(0);
		expect(mahjongScore(game, 0)).toBe(0);
		expect(mahjongScore(solve(round('three-hearts')), 600)).toBe(
			1000 + (game.tiles.length / 2) * 100 + 750
		);
	});

	it('disables Undo only while preserving Shuffle and same-board Restart', () => {
		const initial = round('no-undo'),
			removed = applyMahjongMove(initial, pair(initial));
		expect(() => applyMahjongMove(removed, { action: MAHJONG_ACTION.undo })).toThrow(RangeError);
		const shuffled = applyMahjongMove(removed, { action: MAHJONG_ACTION.shuffle });
		expect(validateMahjongWitness(shuffled, mahjongWitness(shuffled))).toBe(true);
		expect(
			applyMahjongMove({ ...shuffled, variant: undefined }, { action: MAHJONG_ACTION.restart })
				.tiles
		).toEqual(initial.tiles);
	});

	it('limits hints to three only in hint-budget and keeps their costs across Restart', () => {
		let game = round('hint-budget');
		for (let index = 0; index < 3; index++)
			game = applyMahjongMove(game, { action: MAHJONG_ACTION.hint });
		expect(() => applyMahjongMove(game, { action: MAHJONG_ACTION.hint })).toThrow(RangeError);
		const restarted = applyMahjongMove(
			{ ...game, variant: undefined },
			{ action: MAHJONG_ACTION.restart }
		);
		expect(restarted.hintsUsed).toBe(3);
		expect(() => applyMahjongMove(restarted, { action: MAHJONG_ACTION.hint })).toThrow(RangeError);
		let classic = round('classic');
		for (let index = 0; index < 4; index++)
			classic = applyMahjongMove(classic, { action: MAHJONG_ACTION.hint });
		expect(classic.hintsUsed).toBe(4);
	});

	it('limits shuffles to three, validates each new witness, and clears Undo history', () => {
		let game = round('shuffle-budget');
		game = applyMahjongMove(game, pair(game));
		for (let index = 0; index < 3; index++) {
			game = applyMahjongMove(game, { action: MAHJONG_ACTION.shuffle });
			expect(game.history).toEqual([]);
			expect(validateMahjongWitness(game, mahjongWitness(game))).toBe(true);
		}
		expect(() => applyMahjongMove(game, { action: MAHJONG_ACTION.shuffle })).toThrow(RangeError);
	});

	it('cascades screen-above tiles in the same layer/column, recomputing free geometry and Undo', () => {
		const initial = round('avalanche');
		let moved = false,
			game = initial;
		for (const ids of mahjongWitness(initial)) {
			const previous = game;
			game = applyMahjongMove(game, pair(game, ids));
			if (game.tiles.some((tile, id) => !tile.removed && tile.y !== previous.tiles[id]!.y)) {
				expect(applyMahjongMove(game, { action: MAHJONG_ACTION.undo }).tiles).toEqual(
					previous.tiles
				);
				moved = true;
				break;
			}
		}
		expect(moved).toBe(true);
		const tiles = [
			{ id: 0, x: 0, y: 4, z: 0, removed: true, faceDown: false, face: 'C1' },
			{ id: 1, x: 0, y: 2, z: 0, removed: false, faceDown: false, face: 'C2' },
			{ id: 2, x: 0, y: 0, z: 0, removed: false, faceDown: false, face: 'C3' }
		];
		mahjongAvalanche(tiles, [0]);
		expect(tiles.map((tile) => tile.y)).toEqual([4, 4, 2]);
	});

	it('preserves anonymous Restart identities for every ruleset and retains penalties/time/hearts', () => {
		for (const variant of MAHJONG_VARIANTS) {
			const initial = createMahjongRound('1', variant),
				anonymous = {
					...initial,
					variant: undefined,
					hintsUsed: 2,
					shufflesUsed: 1,
					hearts: initial.rules.hearts ? 2 : 0,
					lastAt: initial.rules.timeLimit ? 1000 : -1
				};
			const restarted = applyMahjongMove(anonymous, {
				action: MAHJONG_ACTION.restart,
				...(initial.rules.timeLimit ? { at: 1001 } : {})
			});
			expect(restarted.tiles).toEqual(initial.tiles);
			expect(restarted.hintsUsed).toBe(2);
			expect(restarted.shufflesUsed).toBe(1);
			expect(restarted.hearts).toBe(anonymous.hearts);
			expect(restarted.variant).toBeUndefined();
		}
	});

	it('loses on accepted move10000, with clear taking precedence and terminal moves rejected', () => {
		const initial = round('classic');
		const capped = applyMahjongMove(
			{ ...initial, moves: MAHJONG_MAX_MOVES - 1 },
			{ action: MAHJONG_ACTION.hint }
		);
		expect(capped.status).toBe('lost');
		expect(() => applyMahjongMove(capped, { action: MAHJONG_ACTION.restart })).toThrow(RangeError);
		let game = initial;
		const witness = mahjongWitness(game);
		for (const ids of witness.slice(0, -1)) game = applyMahjongMove(game, pair(game, ids));
		expect(
			applyMahjongMove({ ...game, moves: MAHJONG_MAX_MOVES - 1 }, pair(game, witness.at(-1)!))
				.status
		).toBe('won');
	});

	it('chooses the best net free-tile gain after Avalanche slides, including newly blocked tiles', () => {
		for (const seed of ['1', '2', '3']) {
			let game = round('avalanche', seed);
			const witness = mahjongWitness(game);
			for (const [step, ids] of witness.entries()) {
				if (step % 4 === 0) {
					const free = mahjongFreeTiles(game);
					const gains: number[] = [];
					for (let a = 0; a < free.length; a++)
						for (let b = a + 1; b < free.length; b++) {
							const candidate = [free[a]!, free[b]!];
							if (mahjongMatches(game, candidate))
								gains.push(
									mahjongFreeTiles(applyMahjongMove(game, pair(game, candidate))).length -
										(free.length - 2)
								);
						}
					const hinted = mahjongHint(game);
					expect(hinted).toHaveLength(2);
					expect(
						mahjongFreeTiles(applyMahjongMove(game, pair(game, hinted))).length - (free.length - 2)
					).toBe(Math.max(...gains));
				}
				game = applyMahjongMove(game, pair(game, ids));
			}
		}
	});

	it('records blocked loss without a rescue and preserves rejected-shuffle source state', () => {
		const base = round('shuffle-budget');
		const tiles = base.tiles
			.slice(0, 2)
			.map((tile, id) => ({ ...tile, id, x: id * 4, y: 0, z: 0, face: `C${id + 1}` }));
		const blocked = { ...base, tiles, shufflesUsed: 3 };
		expect(applyMahjongMove(blocked, { action: MAHJONG_ACTION.restart }).status).toBe('playing');
		const noRescue = {
			...blocked,
			rules: { ...base.rules, undo: false },
			tiles: [
				...tiles,
				{ ...tiles[0]!, id: 2, x: 10, face: 'B1' },
				{ ...tiles[1]!, id: 3, x: 14, face: 'B1' }
			]
		};
		expect(applyMahjongMove(noRescue, { tileA: 2, tileB: 3 }).status).toBe('lost');
		const peekBase = round('face-down-peek');
		const single = {
			...peekBase,
			tiles: [{ ...peekBase.tiles[0]!, id: 0, x: 0, y: 0, z: 0, faceDown: true }],
			rules: { ...peekBase.rules, undo: false }
		};
		expect(applyMahjongMove(single, { tile: 0 }).status).toBe('lost');
		const stacked = {
			...base,
			tiles: tiles.map((tile, id) => ({ ...tile, x: 0, y: 0, z: id, face: 'C1' }))
		};
		const snapshot = JSON.stringify(stacked);
		expect(() => applyMahjongMove(stacked, { action: MAHJONG_ACTION.shuffle })).toThrow(RangeError);
		expect(JSON.stringify(stacked)).toBe(snapshot);
	});
});
