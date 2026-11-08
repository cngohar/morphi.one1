import { catalog } from '../../src/lib/catalog.js';
import classic from './reference.json';
import expected from './memory-variants.json';
import strataExpected from './memory-time-strata.json';
import batchHExpected from './memory-batch-h.json';

const manifest = catalog.memory;
const createMemoryRound = manifest.createRound;

type Cards = { cards: { id: string; symbol: string }[]; matched: number[] };
function liveRound(seed: string, moves: { index: number }[], variant?: string) {
	return manifest.resumeRound!(seed, moves, undefined, variant) as unknown as Cards & {
		status: string;
	};
}

/** Miss-free solution on the live board, so collapse positions stay correct. */
function solvedMoves(round: { seed: string; variant?: string }) {
	const moves: { index: number }[] = [];
	let live = liveRound(round.seed, moves, round.variant);
	while (live.status !== 'won') {
		const open = live.cards.flatMap((card, index) =>
			live.matched.includes(index) ? [] : [{ card, index }]
		);
		for (const { index } of open.filter(({ card }) => card.symbol === open[0].card.symbol))
			moves.push({ index });
		live = liveRound(round.seed, moves, round.variant);
	}
	return moves;
}

export async function verifyVectors() {
	const baseline = classic.memory.map(({ seed }) => {
		const round = createMemoryRound(seed);
		if (JSON.stringify(round) !== JSON.stringify(createMemoryRound(seed, 'memory:classic')))
			throw new Error('Explicit classic changed legacy serialization');
		const moves = solvedMoves(round);
		const replay = manifest.replay(seed, moves, 10);
		if (
			replay.group !== `memory-1:${round.pairs}` ||
			JSON.stringify(replay) !==
				JSON.stringify(manifest.replay(seed, moves, 10, undefined, 'memory:classic'))
		)
			throw new Error('Legacy classic replay changed');
		return {
			seed,
			pairs: round.pairs,
			deck: round.cards.map((card) => card.id),
			score: replay.score
		};
	});
	if (JSON.stringify(baseline) !== JSON.stringify(classic.memory))
		throw new Error('Frozen classic memory vector mismatch');
	const generation = expected.generation.map(({ seed, variant }) => {
		const round = createMemoryRound(seed, variant);
		const replay = manifest.replay(seed, solvedMoves(round), 10, undefined, variant);
		if (replay.group !== `memory-1:${variant.slice('memory:'.length)}:${round.pairs}`)
			throw new Error('Variant leaderboard group mismatch');
		return {
			seed,
			variant,
			pairs: round.pairs,
			deck: round.cards.map((card) => card.id),
			score: replay.score,
			...(round.rngDraws === undefined ? {} : { rngDraws: round.rngDraws })
		};
	});
	const moving = expected.movingReplay;
	let round = createMemoryRound(moving.seed, moving.variant);
	for (let index = 0; index < moving.moves.length; index++) {
		const before = round;
		round = manifest.resumeRound(
			moving.seed,
			moving.moves.slice(0, index + 1),
			undefined,
			moving.variant
		);
		if (round.mismatches > before.mismatches) {
			for (const pinned of [...before.matched, ...round.revealed])
				if (round.cards[pinned].id !== before.cards[pinned].id)
					throw new Error('Moving replay moved a pinned card');
		}
	}
	const movingReplay = {
		seed: moving.seed,
		variant: moving.variant,
		moves: moving.moves,
		deck: round.cards.map((card) => card.id),
		rngDraws: round.rngDraws,
		result: manifest.replay(moving.seed, moving.moves, 10, undefined, moving.variant)
	};
	const pilotReplay = expected.pilotReplays.map(({ seed, variant, moves }) => {
		const live = liveRound(seed, moves, variant) as unknown as Record<string, unknown> & Cards;
		let result: unknown = null;
		if (live.status === 'won') result = manifest.replay(seed, moves, 10, undefined, variant);
		return {
			seed,
			variant,
			moves,
			deck: live.cards.map((card) => card.id),
			state: {
				status: live.status,
				mismatches: live.mismatches,
				attempts: live.moves,
				rngDraws: live.rngDraws ?? null,
				lock: live.lock ?? null,
				marked: live.marked ?? null,
				cleared: live.cleared ?? null
			},
			result
		};
	});
	const vectors = { generation, movingReplay, pilotReplays: pilotReplay };
	if (JSON.stringify(vectors) !== JSON.stringify(expected))
		throw new Error('Memory variant generation/replay vector mismatch');
	if (
		JSON.stringify(manifest.resumeRound(moving.seed, moving.moves, undefined, moving.variant)) !==
		JSON.stringify(round)
	)
		throw new Error('Moving resume stream mismatch');
	const bytes = new Uint8Array(
		await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(JSON.stringify({ baseline, ...vectors }))
		)
	);
	const strata = strataExpected.map((vector) => {
		const variant = 'memory:time-strata';
		const round = createMemoryRound(vector.seed, variant);
		const checkpoint = manifest.resumeRound(
			vector.seed,
			vector.checkpointMoves,
			undefined,
			variant
		);
		const actual = {
			seed: round.seed,
			pairs: round.pairs,
			deck: round.cards.map((card) => card.id),
			stacks: round.stacks,
			checkpointMoves: vector.checkpointMoves,
			checkpoint: {
				revealed: checkpoint.revealed,
				matched: checkpoint.matched,
				mismatches: checkpoint.mismatches,
				moves: checkpoint.moves,
				actions: checkpoint.actions,
				status: checkpoint.status
			},
			moves: vector.moves,
			result: manifest.replay(vector.seed, vector.moves, 10, undefined, variant)
		};
		if (JSON.stringify(actual) !== JSON.stringify(vector))
			throw new Error('Time Strata generation/control/replay vector mismatch');
		const final = manifest.resumeRound(vector.seed, vector.moves, undefined, variant);
		if (final.status !== 'won' || final.stacks?.some((stack) => stack.length))
			throw new Error('Time Strata final stacks not empty');
		try {
			manifest.replay(vector.seed, vector.moves.slice(0, -1), 10, undefined, variant);
			throw new Error('Time Strata accepted an unconfirmed final pair');
		} catch (error) {
			if (!(error instanceof RangeError) || error.message !== 'incomplete') throw error;
		}
		return actual;
	});
	const strataBytes = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(strata)))
	);
	const batchH = batchHExpected.map((vector) => {
		const initial = createMemoryRound(vector.seed, vector.variant);
		const checkpoint = manifest.resumeRound(
			vector.seed,
			vector.checkpointMoves,
			undefined,
			vector.variant
		);
		const actual = {
			seed: initial.seed,
			variant: initial.variant,
			pairs: initial.pairs,
			deck: initial.cards.map((card) => card.id),
			stacks: initial.stacks,
			checkpointMoves: vector.checkpointMoves,
			checkpoint: {
				stacks: checkpoint.stacks,
				revealed: checkpoint.revealed,
				matched: checkpoint.matched,
				mismatches: checkpoint.mismatches,
				moves: checkpoint.moves,
				actions: checkpoint.actions,
				status: checkpoint.status,
				shelf: checkpoint.shelf ?? null,
				echo: checkpoint.echo ?? null,
				chain: checkpoint.chain ?? null,
				excavationOrder: checkpoint.excavationOrder ?? null,
				orderCursor: checkpoint.orderCursor ?? null
			},
			moves: vector.moves,
			result: manifest.replay(vector.seed, vector.moves, 10, undefined, vector.variant)
		};
		if (JSON.stringify(actual) !== JSON.stringify(vector))
			throw new Error('Batch H generation/phase/replay vector mismatch');
		const final = manifest.resumeRound(vector.seed, vector.moves, undefined, vector.variant);
		if (
			final.status !== 'won' ||
			final.stacks?.some((well) => well.length) ||
			final.shelf ||
			final.echo?.length
		)
			throw new Error('Batch H final board or held phase not empty');
		try {
			manifest.replay(vector.seed, vector.moves.slice(0, -1), 10, undefined, vector.variant);
			throw new Error('Batch H accepted an unconfirmed final pair');
		} catch (error) {
			if (!(error instanceof RangeError) || error.message !== 'incomplete') throw error;
		}
		return actual;
	});
	const batchHBytes = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(batchH)))
	);

	return {
		passed: true,
		fingerprint: [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
		vectors: baseline.length + generation.length + 1 + pilotReplay.length,
		themeVectors: 0,
		batchHVectors: batchH.length,
		batchHFingerprint: [...batchHBytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
		timeStrataVectors: strata.length,
		timeStrataFingerprint: [...strataBytes]
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('')
	};
}
