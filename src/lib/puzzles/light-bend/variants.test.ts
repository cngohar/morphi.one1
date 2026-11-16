import { expect, it } from 'vitest';
import { t, type MessageKey } from '#lib/i18n/messages.js';
import type { Move } from '#lib/engine/contract.js';
import { manifest } from './manifest.js';
import {
	applyLightBendMove,
	createLightBendRound,
	lightBendHints,
	lightBendScore,
	lightBendTurned,
	lightBendWitness,
	LIGHT_BEND_ACTION,
	LIGHT_BEND_BANDS,
	LIGHT_BEND_COUNTDOWN,
	LIGHT_BEND_VARIANTS,
	traceBoard,
	encodeRules,
	variantRules,
	type LightBendBoard,
	type LightBendRound
} from './logic.js';

const SEEDS = ['1', '42', '314159'];

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

/** The board a round actually traces: `place-your-own` only counts placed mirrors. */
const liveBoard = (round: LightBendRound): LightBendBoard =>
	round.rules.mirror === 1
		? { ...boardOf(round), active: round.placed, through: true }
		: boardOf(round);

function solve(round: LightBendRound): LightBendRound {
	let state = round;
	for (const move of lightBendWitness(round)) state = applyLightBendMove(state, move);
	return state;
}

/** One rotation that keeps the round in play, so a variant delta can be observed mid-round. */
function firstSafeRotation(round: LightBendRound) {
	for (const cell of round.mirrors) {
		const rotated = applyLightBendMove(round, { action: LIGHT_BEND_ACTION.rotate, cell, value: 0 });
		if (rotated.status === 'playing') return rotated;
	}
	return null;
}

it('registers exactly eleven enabled presets with distinct plain-language teaching and zero groups', () => {
	expect(LIGHT_BEND_VARIANTS).toHaveLength(11);
	expect(new Set(LIGHT_BEND_VARIANTS).size).toBe(11);
	expect(manifest.variants).toHaveLength(11);
	expect(manifest.presentation.groups).toEqual({});
	expect(manifest).not.toHaveProperty('leaderboardGroups');
	const baseline = manifest.presentation.help.steps.join('|');
	for (const variant of manifest.variants!) {
		expect(variant.enabled).toBe(true);
		expect(variant.weight).toBe(1);
		expect(variant).not.toHaveProperty('leaderboardGroups');
		// Every variant has a real message, and no user-facing text says "Prism".
		const name = t(variant.name as MessageKey);
		expect(name.length).toBeGreaterThan(0);
		expect(name.toLowerCase()).not.toContain('prism');
		expect(variant.help).toBeDefined();
		if (variant.id !== 'light-bend:classic') {
			// A variant teaches its own round rule in plain language (v1.4 §5A).
			const differing = variant.help!.steps.find((step) => !baseline.includes(step));
			expect(differing, variant.id).toBeDefined();
			const line = t(differing as MessageKey);
			expect(line.length, variant.id).toBeGreaterThan(0);
			expect(line, variant.id).not.toContain(variant.id);
			expect(line, variant.id).not.toContain('light-bend');
		}
	}
	expect(t('v1.game.light-bend')).toBe('Light Bend');
});

for (const variant of LIGHT_BEND_VARIANTS) {
	it(`${variant} plays its own rules and replays to a win without a board group`, () => {
		for (const seed of SEEDS) {
			const round = createLightBendRound(seed, variant);
			expect(round.rules).toEqual(encodeRules(variantRules(variant)));
			const solved = solve(round);
			expect(solved.status).toBe('won');
			// The win is judged from the live trace, never from the planted path.
			expect(traceBoard(liveBoard(solved), solved.orientations).complete).toBe(true);
			const result = manifest.replay(
				seed,
				lightBendWitness(round) as Move[],
				10,
				undefined,
				variant
			);
			expect(result.crystals).toBe(round.crystalCells.length);
			expect(result).not.toHaveProperty('group');
			expect(result.stars).toBeGreaterThanOrEqual(1);
			expect(result.stars).toBeLessThanOrEqual(3);
		}
	});
}

it('place-your-own starts from an empty board with a tray, and placement is its only setup move', () => {
	const round = createLightBendRound('42', 'light-bend:place-your-own');
	expect(round.rules.mirror).toBe(1);
	expect(round.placed.every((value) => value === 0)).toBe(true);
	expect(round.orientations.every((value) => value === 0)).toBe(true);
	// `mirrors` is every legal placement cell; the tray is the hand the band allows.
	expect(round.tray).toBe(LIGHT_BEND_BANDS[0]!.turns + LIGHT_BEND_BANDS[0]!.decoys);
	expect(round.mirrors.length).toBeGreaterThan(round.tray);
	expect(round.par).toBeGreaterThanOrEqual(1);
	expect(round.par).toBeLessThanOrEqual(round.tray);
	expect(() =>
		applyLightBendMove(round, {
			action: LIGHT_BEND_ACTION.rotate,
			cell: round.mirrors[0]!,
			value: 0
		})
	).toThrow(RangeError);
	const placed = applyLightBendMove(round, {
		action: LIGHT_BEND_ACTION.place,
		cell: round.mirrors[0]!,
		value: 1
	});
	expect(placed.placed[0]).toBe(1);
	expect(placed.orientations[0]).toBe(1);
	expect(placed.tray).toBe(round.tray - 1);
	// Reset empties the board again and refills the tray.
	const reset = applyLightBendMove(placed, { action: LIGHT_BEND_ACTION.reset, cell: 0, value: 0 });
	expect(reset.placed.every((value) => value === 0)).toBe(true);
	expect(reset.tray).toBe(round.tray);
	// Placement is Gentle-only (L17 calibration), so one tray never spans a big board.
	expect(round.band).toBe(0);
});

it('colour lights only same-colour crystals, and a filter carries a different colour through', () => {
	// Colour is drawn from the seed stream, so inspect a few seeds for a real two-colour board.
	const rounds = ['1', '314159', '7919', '2024'].map((seed) =>
		createLightBendRound(seed, 'light-bend:colour')
	);
	const round = rounds.find(
		(entry) =>
			new Set(entry.crystalColours).size > 1 && entry.filters.length >= 2 && entry.band === 0
	)!;
	expect(round).toBeDefined();
	expect(round.rules.beam).toBe(1);
	expect(new Set(round.crystalColours).size).toBeGreaterThan(1);
	expect(round.filters.length).toBeGreaterThanOrEqual(2);
	// Solved state lights every crystal, which is only possible on matching colour.
	const solved = solve(round);
	expect(solved.lit).toBe((1 << round.crystalCells.length) - 1);
	// Recolouring one crystal away from the source colour turns the win off again.
	const colours = round.crystalColours.slice();
	const moved = colours.findIndex((colour) => colour === 1);
	colours[moved] = 2;
	const recoloured = traceBoard(
		{ ...boardOf(solved), crystalColours: colours },
		solved.orientations
	);
	expect(recoloured.complete).toBe(false);
});

it('splitter ships one splitter and lights crystals on both branches', () => {
	const round = createLightBendRound('42', 'light-bend:splitter');
	expect(round.rules.beam).toBe(2);
	expect(round.splitters.length).toBeGreaterThanOrEqual(1);
	const solved = solve(round);
	expect(solved.status).toBe('won');
	expect(solved.lit).toBe((1 << round.crystalCells.length) - 1);
});

it('portal ships a portal pair the beam must teleport through', () => {
	const round = createLightBendRound('42', 'light-bend:portal');
	expect(round.rules.beam).toBe(3);
	expect(round.portals.length).toBe(2);
	const solved = solve(round);
	expect(solved.status).toBe('won');
	// Both portal cells belong to the solution trace.
	const board = boardOf(round);
	const trace = traceBoard(board, round.solution);
	expect(trace.path).toContain(round.portals[0]);
});

it('two-sources fires both sources at once and requires both beams', () => {
	const round = createLightBendRound('42', 'light-bend:two-sources');
	expect(round.rules.sources).toBe(2);
	expect(round.sources.length).toBe(6);
	const solved = solve(round);
	expect(solved.status).toBe('won');
	// Removing either source from the board leaves crystals unlit.
	for (const drop of [0, 3]) {
		const trimmed = round.sources.filter((_, index) => index < drop || index >= drop + 3);
		const trace = traceBoard({ ...boardOf(solved), sources: trimmed }, solved.orientations);
		expect(trace.complete, `drop ${drop}`).toBe(false);
	}
});

it('no-preview hides the live beam and only wins on a fired trace', () => {
	const round = createLightBendRound('42', 'light-bend:no-preview');
	expect(round.rules.info).toBe(1);
	expect(round.fired).toBe(false);
	let state = round;
	for (const move of lightBendWitness(round))
		if (move.action !== LIGHT_BEND_ACTION.fire) state = applyLightBendMove(state, move);
	expect(traceBoard(boardOf(state), state.orientations).complete).toBe(true);
	expect(state.status).toBe('playing');
	// The trace is known internally but the round withholds the win until Fire.
	expect(state.lit).toBe((1 << state.crystalCells.length) - 1);
	expect(
		applyLightBendMove(state, { action: LIGHT_BEND_ACTION.fire, cell: 0, value: 0 }).status
	).toBe('won');
	// Firing an unsolved board is legal but is not a win, and editing clears the firing.
	const firedEarly = applyLightBendMove(round, {
		action: LIGHT_BEND_ACTION.fire,
		cell: 0,
		value: 0
	});
	expect(firedEarly.fired).toBe(true);
	expect(firedEarly.status).toBe('playing');
	const edited = firstSafeRotation(round);
	expect(edited).not.toBeNull();
	expect(firstSafeRotation(round)!.fired).toBe(false);
});

it('countdown-120 ends unsolved at 0:00 with no score, and pays remaining seconds on a win', () => {
	const round = createLightBendRound('42', 'light-bend:countdown-120');
	expect(round.rules.limit).toBe(1);
	expect(
		manifest.variants!.find((entry) => entry.id === 'light-bend:countdown-120')?.maxSeconds
	).toBe(LIGHT_BEND_COUNTDOWN);
	const solved = solve(round);
	// The scored time is the active seconds the session measures, so 119 s still ranks.
	expect(lightBendScore(solved, 0)).toBe(1000 + LIGHT_BEND_COUNTDOWN * 10);
	expect(lightBendScore(solved, 119)).toBe(1000 + 10);
	expect(() => lightBendScore(solved, LIGHT_BEND_COUNTDOWN)).toThrow(RangeError);
	// A timed end is a run_over ending with its own cap, not the win headline.
	const ending = manifest.variants!.find(
		(entry) => entry.id === 'light-bend:countdown-120'
	)?.ending;
	expect(ending?.kind).toBe('run_over');
	expect(ending?.headlines.cap).toBe('ending.light-bend.timeUp');
});

it('no-undo removes rollback and keeps Reset as the only recovery', () => {
	const round = createLightBendRound('42', 'light-bend:no-undo');
	expect(round.rules.undo).toBe(1);
	const moved = firstSafeRotation(round);
	expect(moved).not.toBeNull();
	expect(() =>
		applyLightBendMove(moved!, { action: LIGHT_BEND_ACTION.undo, cell: 0, value: 0 })
	).toThrow(RangeError);
	const reset = applyLightBendMove(moved!, { action: LIGHT_BEND_ACTION.reset, cell: 0, value: 0 });
	expect(reset.orientations).toEqual(round.start);
	// Undo remains available in the baseline, which is the rule delta.
	const baseline = firstSafeRotation(createLightBendRound('42'));
	expect(() =>
		applyLightBendMove(baseline!, { action: LIGHT_BEND_ACTION.undo, cell: 0, value: 0 })
	).not.toThrow();
});

it('no-hint removes the hint budget entirely while the baseline has three', () => {
	const round = createLightBendRound('42', 'light-bend:no-hint');
	expect(round.rules.hint).toBe(1);
	expect(lightBendHints(round.rules)).toBe(0);
	expect(() =>
		applyLightBendMove(round, { action: LIGHT_BEND_ACTION.hint, cell: 0, value: 0 })
	).toThrow(RangeError);
	expect(lightBendHints(createLightBendRound('42').rules)).toBe(3);
});

it('checkpoint requires every token touched, not only every crystal lit', () => {
	const round = createLightBendRound('42', 'light-bend:checkpoint');
	expect(round.rules.win).toBe(4);
	expect(round.checkpoints.length).toBeGreaterThanOrEqual(2);
	const solved = solve(round);
	expect(solved.status).toBe('won');
	expect(solved.touched).toBe((1 << round.checkpoints.length) - 1);
	// With the tokens removed the same board still wins on crystals alone, which proves
	// the delta is the extra condition rather than a different board.
	expect(traceBoard({ ...boardOf(solved), checkpoints: [] }, solved.orientations).complete).toBe(
		true
	);
	// Adding one token the trace never reaches blocks the win the crystals alone allow.
	const trace = traceBoard(boardOf(solved), solved.orientations);
	expect(trace.complete).toBe(true);
	const offPath = Array.from({ length: round.width * round.height }, (_, cell) => cell).find(
		(cell) => !trace.path.includes(cell)
	)!;
	expect(offPath).toBeDefined();
	const extra = traceBoard(
		{ ...boardOf(solved), checkpoints: [...round.checkpoints, offPath] },
		solved.orientations
	);
	expect(extra.complete).toBe(false);
	expect(extra.touched).not.toBe(extra.touched | (1 << round.checkpoints.length));
});

it('keeps scoring identical across all eleven presets and stars a display grade only', () => {
	const scores = new Set<number>();
	const grades = new Set<number>();
	for (const variant of LIGHT_BEND_VARIANTS) {
		const solved = solve(createLightBendRound('42', variant));
		const stars = manifest.replay(
			'42',
			lightBendWitness(createLightBendRound('42', variant)) as Move[],
			10,
			undefined,
			variant
		).stars!;
		grades.add(stars);
		// The star metric is the board state diff, never the action count.
		expect(lightBendTurned(solved)).toBeLessThanOrEqual(
			solved.rules.mirror === 1 ? solved.tray : solved.mirrors.length
		);
		// Countdown pays the remaining clock as well, so it is scored separately.
		if (variant === 'light-bend:countdown-120') {
			expect(lightBendScore(solved, 10)).toBe(1000 + (LIGHT_BEND_COUNTDOWN - 10) * 10);
			continue;
		}
		scores.add(lightBendScore(solved, 10));
	}
	// Same clock, same default config, so every untimed preset scores identically.
	expect(scores.size).toBe(1);
	expect(scores.has(1000 - 4 * 10)).toBe(true);
	expect([...grades].every((grade) => grade >= 1 && grade <= 3)).toBe(true);
});
