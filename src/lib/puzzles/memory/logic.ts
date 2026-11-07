import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring as scoringDefinition, triosScoring, quadsScoring } from './scoring.js';
import { createRng, shuffle } from '#lib/engine/rng.js';
import { SYMBOLS, type SymbolId } from '#lib/puzzles/memory/symbols.js';

export const PAIR_COUNTS = [6, 8, 10] as const;
export type PairCount = (typeof PAIR_COUNTS)[number];
export const QUAD_COUNTS = [4, 5, 6] as const;

export interface MemoryCard {
	id: string;
	symbol: SymbolId;
	color: string;
	/** Two-backs only: 0 is dotted, 1 is striped; a partner always has the other. */
	back?: 0 | 1;
	isWild?: boolean;
	isHazard?: boolean;
	zebra?: 'light' | 'dark';
	spectral?: 'flora' | 'fauna' | 'mineral' | 'tech';
	tier?: number;
	isGravitino?: boolean;
	isAnomaly?: boolean;
	isQuantum?: boolean;
	isFirewall?: boolean;
	tlsStage?: 'syn' | 'ack';
}

export const MEMORY_VARIANTS = [
	'memory:classic',
	'memory:no-preview',
	'memory:trios',
	'memory:moving',
	'memory:budget',
	'memory:lockout',
	'memory:swaps',
	'memory:two-backs',
	'memory:quads',
	'memory:collapse',
	'memory:countdown',
	'memory:three-strikes',
	'memory:wild-card',
	'memory:sonar',
	'memory:zebra',
	'memory:drift',
	'memory:decay',
	'memory:one-flip',
	'memory:combo',
	'memory:hazard',
	'memory:superstorm',
	'memory:sentinel-heat',
	'memory:glyph-chain',
	'memory:analysis-visor',
	'memory:life-support',
	'memory:hyperdrive-warp',
	'memory:gravitino-risk',
	'memory:pulse-drive',
	'memory:derelict-fog',
	'memory:atlas-terminal',
	'memory:edge-cache',
	'memory:quantum-entangle',
	'memory:rate-limiter',
	'memory:register-buffer',
	'memory:firewall-ice',
	'memory:anycast-route',
	'memory:tls-handshake',
	'memory:trace-route',
	'memory:bit-rot',
	'memory:burst-transmission'
] as const;
export type MemoryVariant = (typeof MEMORY_VARIANTS)[number];

export function memoryVariant(round: { variant?: string }): MemoryVariant {
	return parseMemoryVariant(round.variant);
}

export function parseMemoryVariant(variant?: string): MemoryVariant {
	if (variant === undefined) return 'memory:classic';
	if (!MEMORY_VARIANTS.includes(variant as MemoryVariant)) throw new RangeError('variant');
	return variant as MemoryVariant;
}

export function memoryVariantName(variant?: string): `variant.${MemoryVariant}` {
	return `variant.${parseMemoryVariant(variant)}`;
}

export function cardsPerMatch(round: { variant?: string }): number {
	const variant = memoryVariant(round);
	return variant === 'memory:quads' ? 4 : variant === 'memory:trios' ? 3 : 2;
}

/** Attempts allowed per group: budget is strict, everything else keeps six. */
export function memoryMoveLimit(round: MemoryRound): number {
	return round.pairs * cardsPerMatch(round) * (memoryVariant(round) === 'memory:budget' ? 2 : 6);
}

/** Trios, quads and budget stop accepting flips at their attempt cap; a final-attempt win still counts. */
export function memoryCapReached(round: MemoryRound): boolean {
	const size = cardsPerMatch(round);
	return (
		['memory:trios', 'memory:quads', 'memory:budget'].includes(memoryVariant(round)) &&
		round.status !== 'won' &&
		round.moves * size + (round.revealed.length < size ? round.revealed.length : 0) >=
			memoryMoveLimit(round)
	);
}

export type MemoryStatus = 'playing' | 'won' | 'lost';

export interface MemoryRound {
	seed: string;
	variant?: MemoryVariant;
	/** Only moving, swaps and hazard rounds persist the number of actual logic-stream draws. */
	rngDraws?: number;
	/** Lockout only: the card that cannot be flipped on the next completed attempt. */
	lock?: number | null;
	/** Swaps only: the two positions exchanged by the last miss, until the next accepted flip. */
	marked?: number[];
	/** Collapse only: cards already removed from `cards`. */
	cleared?: number;
	/** Three strikes only: remaining lives (out of 3). */
	lives?: number;
	/** Combo only: current streak multiplier. */
	combo?: number;
	/** Decay only: mapping of seen card index -> attempts remaining. */
	decay?: Record<number, number>;
	/** Sonar only: orthogonally adjacent card indices to pulse. */
	sonar?: number[];
	/** Countdown only: total allowed seconds (60, 80, 100). */
	timeLimit?: number;
	/** Superstorm only: row index currently frosted over. */
	stormFrostedRow?: number;
	/** Sentinel heat only: alert level from 0 to 3. */
	sentinelHeat?: number;
	/** Glyph chain only: active portal tier required to match. */
	glyphTier?: number;
	/** Life support only: remaining suit power percentage (0 to 100). */
	lifeSupport?: number;
	/** Pulse drive only: rapid match multiplier (1 to 4). */
	pulseStreak?: number;
	/** Derelict fog only: orthogonally illuminated card indices. */
	illuminated?: number[];
	/** Edge cache only: ghost imprint of recently inspected cards. */
	edgeCache?: Record<number, { symbol: SymbolId; turns: number }>;
	/** Rate limiter only: penalty cooldown and rate limit flag. */
	rateLimited?: boolean;
	rateLimitPenalty?: number;
	/** Register buffer only: stashed 1-card buffer. */
	bufferCard?: MemoryCard | null;
	/** Trace route only: security trace percentage and quarantined card indices. */
	traceMeter?: number;
	quarantine?: number[];
	/** Bit rot only: stale attempt tracking. */
	bitRot?: Record<number, number>;
	/** Burst transmission only: consecutive streak and pinged card indices. */
	burstStreak?: number;
	burstPing?: number[];
	/** Group count: pairs (6/8/10), trios (6/8/10) or quads (4/5/6). */
	pairs: number;
	cards: MemoryCard[];
	revealed: number[];
	matched: number[];
	mismatches: number;
	moves: number;
	status: MemoryStatus;
}

export type FlipEffect = 'ignored' | 'flip' | 'match' | 'mismatch' | 'win';

export interface FlipResult {
	round: MemoryRound;
	effect: FlipEffect;
}

export function createMemoryRound(seed: string, variant?: string): MemoryRound {
	const selectedVariant = parseMemoryVariant(variant);
	const rng = createRng(seed);
	let rngDraws = 0;
	if (
		selectedVariant === 'memory:moving' ||
		selectedVariant === 'memory:swaps' ||
		selectedVariant === 'memory:hazard' ||
		selectedVariant === 'memory:hyperdrive-warp' ||
		selectedVariant === 'memory:gravitino-risk' ||
		selectedVariant === 'memory:atlas-terminal' ||
		selectedVariant === 'memory:anycast-route' ||
		selectedVariant === 'memory:bit-rot'
	) {
		const nextU64 = rng.nextU64;
		rng.nextU64 = () => {
			rngDraws += 1;
			return nextU64();
		};
	}
	const counts = selectedVariant === 'memory:quads' ? QUAD_COUNTS : PAIR_COUNTS;
	const pairs = counts[rng.nextInt(counts.length)] ?? 6;
	const selected = shuffle(rng, SYMBOLS).slice(0, pairs);
	const deck: MemoryCard[] = [];
	const size = cardsPerMatch({ variant: selectedVariant });

	for (const symbol of selected)
		for (let copy = 0; copy < size; copy += 1)
			deck.push({
				id: `${symbol.id}:${copy}`,
				symbol: symbol.id,
				color: symbol.color,
				...(selectedVariant === 'memory:two-backs' ? { back: copy as 0 | 1 } : {}),
				...(selectedVariant === 'memory:zebra'
					? { zebra: (copy === 0 ? 'light' : 'dark') as 'light' | 'dark' }
					: {})
			});

	if (selectedVariant === 'memory:wild-card') {
		const lastSymbol = selected[selected.length - 1];
		const wildCard = deck.find((c) => c.id === `${lastSymbol.id}:1`);
		if (wildCard) {
			wildCard.isWild = true;
			wildCard.color = '#f59e0b';
		}
	} else if (selectedVariant === 'memory:hazard') {
		const lastSymbol = selected[selected.length - 1];
		for (const card of deck) {
			if (card.symbol === lastSymbol.id) {
				card.isHazard = true;
				card.color = '#ef4444';
			}
		}
	} else if (selectedVariant === 'memory:analysis-visor') {
		const spectrals: ('flora' | 'fauna' | 'mineral' | 'tech')[] = [
			'flora',
			'fauna',
			'mineral',
			'tech'
		];
		for (let sIdx = 0; sIdx < selected.length; sIdx++) {
			const spec = spectrals[sIdx % spectrals.length];
			for (const c of deck) {
				if (c.symbol === selected[sIdx].id) c.spectral = spec;
			}
		}
	} else if (selectedVariant === 'memory:glyph-chain') {
		for (let sIdx = 0; sIdx < selected.length; sIdx++) {
			const tier = sIdx + 1;
			for (const c of deck) {
				if (c.symbol === selected[sIdx].id) c.tier = tier;
			}
		}
	} else if (selectedVariant === 'memory:hyperdrive-warp') {
		const anomalySymbol = selected[selected.length - 1];
		for (const c of deck) {
			if (c.symbol === anomalySymbol.id) c.isAnomaly = true;
		}
	} else if (selectedVariant === 'memory:gravitino-risk') {
		const gravSymbol = selected[0];
		for (const c of deck) {
			if (c.symbol === gravSymbol.id) c.isGravitino = true;
		}
	} else if (selectedVariant === 'memory:quantum-entangle') {
		const qSymbol = selected[0];
		for (const c of deck) {
			if (c.symbol === qSymbol.id) c.isQuantum = true;
		}
	} else if (selectedVariant === 'memory:tls-handshake') {
		for (const symbol of selected) {
			const cards = deck.filter((c) => c.symbol === symbol.id);
			if (cards[0]) cards[0].tlsStage = 'syn';
			if (cards[1]) cards[1].tlsStage = 'ack';
		}
	} else if (selectedVariant === 'memory:firewall-ice') {
		const mid = Math.floor(deck.length / 2);
		if (deck[mid - 1]) deck[mid - 1].isFirewall = true;
		if (deck[mid]) deck[mid].isFirewall = true;
	}

	const round: MemoryRound = {
		seed,
		pairs,
		cards: shuffle(rng, deck),
		revealed: [],
		matched: [],
		mismatches: 0,
		moves: 0,
		status: 'playing'
	};
	if (selectedVariant !== 'memory:classic') round.variant = selectedVariant;
	if (
		selectedVariant === 'memory:moving' ||
		selectedVariant === 'memory:swaps' ||
		selectedVariant === 'memory:hazard' ||
		selectedVariant === 'memory:hyperdrive-warp' ||
		selectedVariant === 'memory:gravitino-risk' ||
		selectedVariant === 'memory:atlas-terminal' ||
		selectedVariant === 'memory:anycast-route' ||
		selectedVariant === 'memory:bit-rot'
	)
		round.rngDraws = rngDraws;
	if (selectedVariant === 'memory:lockout') round.lock = null;
	if (selectedVariant === 'memory:swaps') round.marked = [];
	if (selectedVariant === 'memory:collapse') round.cleared = 0;
	if (selectedVariant === 'memory:countdown')
		round.timeLimit = pairs === 10 ? 100 : pairs === 8 ? 80 : 60;
	if (selectedVariant === 'memory:three-strikes') round.lives = 3;
	if (selectedVariant === 'memory:combo') round.combo = 1;
	if (selectedVariant === 'memory:decay') round.decay = {};
	if (selectedVariant === 'memory:sonar') round.sonar = [];
	if (selectedVariant === 'memory:superstorm') round.stormFrostedRow = -1;
	if (selectedVariant === 'memory:sentinel-heat') round.sentinelHeat = 0;
	if (selectedVariant === 'memory:glyph-chain') round.glyphTier = 1;
	if (selectedVariant === 'memory:life-support') round.lifeSupport = 100;
	if (selectedVariant === 'memory:pulse-drive') round.pulseStreak = 1;
	if (selectedVariant === 'memory:derelict-fog') round.illuminated = [];
	if (selectedVariant === 'memory:edge-cache') round.edgeCache = {};
	if (selectedVariant === 'memory:rate-limiter') {
		round.rateLimited = false;
		round.rateLimitPenalty = 0;
	}
	if (selectedVariant === 'memory:register-buffer') round.bufferCard = null;
	if (selectedVariant === 'memory:trace-route') {
		round.traceMeter = 0;
		round.quarantine = [];
	}
	if (selectedVariant === 'memory:bit-rot') round.bitRot = {};
	if (selectedVariant === 'memory:burst-transmission') {
		round.burstStreak = 0;
		round.burstPing = [];
	}
	return round;
}

/** Continues the logic stream after every draw already made, counting new ones. */
function continueStream(round: MemoryRound) {
	const rng = createRng(round.seed);
	let draws = round.rngDraws!;
	for (let draw = 0; draw < draws; draw += 1) rng.nextU64();
	const nextU64 = rng.nextU64;
	rng.nextU64 = () => {
		draws += 1;
		return nextU64();
	};
	return { rng, draws: () => draws };
}

function swapHiddenCards(round: MemoryRound): MemoryRound {
	const eligible = round.cards.map((_, index) => index).filter((index) => !isFaceUp(round, index));
	// A deterministic no-op (no draw) when fewer than two cards can swap.
	if (eligible.length < 2) return round;
	const { rng, draws } = continueStream(round);
	const first = rng.nextInt(eligible.length);
	let second = rng.nextInt(eligible.length - 1);
	if (second >= first) second += 1;
	const cards = round.cards.slice();
	[cards[eligible[first]], cards[eligible[second]]] = [
		cards[eligible[second]],
		cards[eligible[first]]
	];
	return {
		...round,
		cards,
		marked: [eligible[first], eligible[second]].sort((a, b) => a - b),
		rngDraws: draws()
	};
}

function moveFaceDownCards(round: MemoryRound): MemoryRound {
	const { rng, draws } = continueStream(round);
	const positions = round.cards.map((_, index) => index).filter((index) => !isFaceUp(round, index));
	const shuffled = shuffle(
		rng,
		positions.map((index) => round.cards[index])
	);
	const cards = round.cards.slice();
	positions.forEach((index, offset) => {
		cards[index] = shuffled[offset];
	});
	return { ...round, cards, rngDraws: draws() };
}

function driftRow(round: MemoryRound, cardIndex: number): MemoryRound {
	const cols = 4;
	const row = Math.floor(cardIndex / cols);
	const rowStart = row * cols;
	if (rowStart + cols > round.cards.length) return round;
	const cards = round.cards.slice();
	const last = cards[rowStart + cols - 1];
	for (let c = cols - 1; c > 0; c--) {
		cards[rowStart + c] = cards[rowStart + c - 1];
	}
	cards[rowStart] = last;
	return { ...round, cards };
}

function updateDecay(round: MemoryRound, revealedIndices: number[]): MemoryRound {
	const decay = { ...(round.decay ?? {}) };
	revealedIndices.forEach((pos) => {
		decay[pos] = 3;
	});
	for (const key of Object.keys(decay)) {
		const pos = Number(key);
		decay[pos] -= 1;
		if (decay[pos] <= 0) {
			delete decay[pos];
		}
	}
	return { ...round, decay };
}

function scrambleColumn(round: MemoryRound, col: number): MemoryRound {
	const cols = 4;
	const eligible = round.cards
		.map((_, index) => index)
		.filter((index) => index % cols === col && !isFaceUp(round, index));
	if (eligible.length < 2) return round;
	const { rng, draws } = continueStream(round);
	const shuffled = shuffle(
		rng,
		eligible.map((index) => round.cards[index])
	);
	const cards = round.cards.slice();
	eligible.forEach((pos, offset) => {
		cards[pos] = shuffled[offset];
	});
	return { ...round, cards, rngDraws: draws() };
}

function warpAnomalyCards(round: MemoryRound): MemoryRound {
	const eligible = round.cards.map((_, index) => index).filter((index) => !isFaceUp(round, index));
	if (eligible.length < 2) return round;
	const cards = round.cards.slice();
	const first = eligible[0];
	const last = eligible[eligible.length - 1];
	[cards[first], cards[last]] = [cards[last], cards[first]];
	return { ...round, cards };
}

function shiftPerimeterClockwise(round: MemoryRound): MemoryRound {
	const cols = 4;
	const rows = Math.floor(round.cards.length / cols);
	const perimeter: number[] = [];
	for (let c = 0; c < cols; c++) perimeter.push(c);
	for (let r = 1; r < rows; r++) perimeter.push(r * cols + (cols - 1));
	for (let c = cols - 2; c >= 0; c--) perimeter.push((rows - 1) * cols + c);
	for (let r = rows - 2; r >= 1; r--) perimeter.push(r * cols);

	const cards = round.cards.slice();
	const firstCard = cards[perimeter[perimeter.length - 1]];
	for (let i = perimeter.length - 1; i > 0; i--) {
		cards[perimeter[i]] = cards[perimeter[i - 1]];
	}
	cards[perimeter[0]] = firstCard;
	return { ...round, cards };
}

export function flipCard(round: MemoryRound, index: number): FlipResult {
	const matchSize = cardsPerMatch(round);
	if (round.status !== 'playing' || round.revealed.length >= matchSize || memoryCapReached(round)) {
		return { round, effect: 'ignored' };
	}

	const variant = memoryVariant(round);
	const isBufferStash =
		variant === 'memory:register-buffer' &&
		round.revealed.length === 1 &&
		round.revealed[0] === index;

	if (
		round.matched.includes(index) ||
		(round.revealed.includes(index) && !isBufferStash) ||
		index === round.lock
	) {
		return { round, effect: 'ignored' };
	}

	const cols = 4;
	const row = Math.floor(index / cols);

	if (variant === 'memory:superstorm' && row === round.stormFrostedRow) {
		return { round, effect: 'ignored' };
	}
	if (variant === 'memory:firewall-ice' && round.cards[index]?.isFirewall) {
		return { round, effect: 'ignored' };
	}
	if (variant === 'memory:trace-route' && round.quarantine?.includes(index)) {
		return { round, effect: 'ignored' };
	}

	const card = round.cards[index];
	if (!card) {
		return { round, effect: 'ignored' };
	}

	let lifeSupport = round.lifeSupport;
	if (variant === 'memory:life-support') {
		lifeSupport = Math.max(0, (round.lifeSupport ?? 100) - 3);
	}

	let illuminated: number[] | undefined;
	if (variant === 'memory:derelict-fog') {
		const r = Math.floor(index / cols);
		const c = index % cols;
		illuminated = [index];
		if (r > 0) illuminated.push(index - cols);
		if (r < Math.floor(round.cards.length / cols) - 1) illuminated.push(index + cols);
		if (c > 0) illuminated.push(index - 1);
		if (c < cols - 1) illuminated.push(index + 1);
	}

	// Register buffer mechanics
	if (variant === 'memory:register-buffer') {
		const base = round.marked?.length ? { ...round, marked: [] } : round;
		if (round.bufferCard) {
			const moves = round.moves + 1;
			if (card.symbol === round.bufferCard.symbol) {
				const matched = [...round.matched, index].sort((a, b) => a - b);
				const won = matched.length === round.cards.length;
				return {
					round: {
						...base,
						revealed: [],
						matched,
						bufferCard: null,
						moves,
						status: won ? 'won' : 'playing'
					},
					effect: won ? 'win' : 'match'
				};
			} else {
				return {
					round: {
						...base,
						revealed: [index],
						mismatches: round.mismatches + 1,
						moves
					},
					effect: 'mismatch'
				};
			}
		} else if (round.revealed.length === 1 && round.revealed[0] === index) {
			return {
				round: {
					...base,
					bufferCard: card,
					matched: [...round.matched, index].sort((a, b) => a - b),
					revealed: [],
					moves: round.moves + 1
				},
				effect: 'flip'
			};
		}
	}

	// Single-flip continuity
	if (variant === 'memory:one-flip') {
		const base = round.marked?.length ? { ...round, marked: [] } : round;
		if (round.revealed.length === 1) {
			const prevIdx = round.revealed[0];
			const prevCard = round.cards[prevIdx];
			const moves = round.moves + 1;
			if (prevCard && (prevCard.symbol === card.symbol || prevCard.isWild || card.isWild)) {
				const matched = [...round.matched, prevIdx, index].sort((a, b) => a - b);
				const won = matched.length === round.cards.length;
				return {
					round: {
						...base,
						revealed: [],
						matched,
						moves,
						status: won ? 'won' : 'playing'
					},
					effect: won ? 'win' : 'match'
				};
			} else {
				return {
					round: {
						...base,
						revealed: [index],
						mismatches: round.mismatches + 1,
						moves
					},
					effect: 'mismatch'
				};
			}
		}
		return {
			round: { ...base, revealed: [index] },
			effect: 'flip'
		};
	}

	const revealed = [...round.revealed, index];
	if (variant === 'memory:quantum-entangle' && card.isQuantum && round.revealed.length === 0) {
		const twin = round.cards.findIndex(
			(c, i) => i !== index && c.symbol === card.symbol && !round.matched.includes(i)
		);
		if (twin >= 0) {
			revealed.push(twin);
		}
	}

	// Any accepted flip ends the marked-swap highlight, clears sonar flash and illuminated cone.
	const base =
		round.marked?.length || round.sonar?.length || round.illuminated?.length
			? { ...round, marked: [], sonar: [], illuminated: [] }
			: round;

	if (revealed.length < matchSize) {
		return {
			round: {
				...base,
				revealed,
				...(lifeSupport !== undefined ? { lifeSupport } : {}),
				...(illuminated ? { illuminated } : {})
			},
			effect: 'flip'
		};
	}

	const moves = round.moves + 1;

	const first = round.cards[revealed[0]];
	if (!first) return { round, effect: 'ignored' };

	let isMatch =
		card.isWild || first.isWild
			? true
			: variant === 'memory:zebra'
				? card.symbol === first.symbol && card.zebra !== first.zebra
				: revealed.every((position) => round.cards[position]?.symbol === first.symbol);

	if (variant === 'memory:glyph-chain' && isMatch) {
		if (first.tier !== (round.glyphTier ?? 1)) {
			isMatch = false;
		}
	}

	if (variant === 'memory:tls-handshake' && isMatch) {
		const stages = revealed.map((pos) => round.cards[pos].tlsStage);
		if (!stages.includes('syn') || !stages.includes('ack')) {
			isMatch = false;
		}
	}

	if (isMatch) {
		const collapse = variant === 'memory:collapse';
		const matched = collapse ? [] : [...round.matched, ...revealed].sort((a, b) => a - b);
		let cards = collapse
			? round.cards.filter((_, position) => !revealed.includes(position))
			: round.cards;
		const won = collapse ? cards.length === 0 : matched.length === cards.length;
		const combo = variant === 'memory:combo' ? (round.combo ?? 1) + 1 : round.combo;
		const glyphTier =
			variant === 'memory:glyph-chain' ? (round.glyphTier ?? 1) + 1 : round.glyphTier;
		const sentinelHeat =
			variant === 'memory:sentinel-heat'
				? Math.max(0, (round.sentinelHeat ?? 0) - 1)
				: round.sentinelHeat;
		const pulseStreak =
			variant === 'memory:pulse-drive'
				? Math.min(4, (round.pulseStreak ?? 1) + 1)
				: round.pulseStreak;

		if (variant === 'memory:life-support') {
			lifeSupport = Math.min(100, (lifeSupport ?? 100) + 12);
		}

		if (variant === 'memory:hyperdrive-warp' && (card.isAnomaly || first.isAnomaly)) {
			cards = warpAnomalyCards({ ...round, cards, matched }).cards;
		}

		if (variant === 'memory:firewall-ice') {
			cards = cards.map((c, i) => {
				if (!c.isFirewall) return c;
				const isAdj = revealed.some((pos) => {
					const r1 = Math.floor(pos / cols);
					const c1 = pos % cols;
					const r2 = Math.floor(i / cols);
					const c2 = i % cols;
					return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
				});
				return isAdj ? { ...c, isFirewall: false } : c;
			});
		}

		const traceMeter =
			variant === 'memory:trace-route'
				? Math.max(0, (round.traceMeter ?? 0) - 10)
				: round.traceMeter;

		let burstPing: number[] | undefined;
		const burstStreak =
			variant === 'memory:burst-transmission' ? (round.burstStreak ?? 0) + 1 : round.burstStreak;
		if (variant === 'memory:burst-transmission' && (burstStreak ?? 0) >= 2) {
			burstPing = cards
				.map((_, i) => i)
				.filter((i) => !matched.includes(i))
				.slice(0, 3);
		}

		let sonar: number[] | undefined;
		if (variant === 'memory:sonar') {
			sonar = revealed
				.flatMap((pos) => {
					const r = Math.floor(pos / cols);
					const c = pos % cols;
					const neighbors: number[] = [];
					if (r > 0) neighbors.push(pos - cols);
					if (r < Math.floor(round.cards.length / cols) - 1) neighbors.push(pos + cols);
					if (c > 0) neighbors.push(pos - 1);
					if (c < cols - 1) neighbors.push(pos + 1);
					return neighbors;
				})
				.filter((pos) => !matched.includes(pos) && !revealed.includes(pos));
		}

		return {
			round: {
				...base,
				cards,
				revealed: [],
				matched,
				moves,
				status: won ? 'won' : 'playing',
				...(collapse ? { cleared: round.cleared! + matchSize } : {}),
				...(variant === 'memory:lockout' || variant === 'memory:sentinel-heat'
					? { lock: null }
					: {}),
				...(combo !== undefined ? { combo } : {}),
				...(sonar ? { sonar } : {}),
				...(glyphTier !== undefined ? { glyphTier } : {}),
				...(sentinelHeat !== undefined ? { sentinelHeat } : {}),
				...(pulseStreak !== undefined ? { pulseStreak } : {}),
				...(lifeSupport !== undefined ? { lifeSupport } : {}),
				...(traceMeter !== undefined ? { traceMeter } : {}),
				...(burstStreak !== undefined ? { burstStreak } : {}),
				...(burstPing ? { burstPing } : {})
			},
			effect: won ? 'win' : 'match'
		};
	}

	const mismatched: MemoryRound = {
		...base,
		revealed,
		mismatches: round.mismatches + 1,
		moves,
		...(variant === 'memory:combo' ? { combo: 1 } : {}),
		...(variant === 'memory:pulse-drive' ? { pulseStreak: 1 } : {}),
		...(lifeSupport !== undefined ? { lifeSupport } : {}),
		...(illuminated ? { illuminated } : {})
	};

	if (variant === 'memory:three-strikes') {
		const lives = (round.lives ?? 3) - 1;
		mismatched.lives = lives;
		if (lives <= 0) mismatched.status = 'lost';
	}
	if (variant === 'memory:life-support') {
		if (lifeSupport === 0) mismatched.status = 'lost';
	}

	if (variant === 'memory:sentinel-heat') {
		const heat = Math.min(3, (round.sentinelHeat ?? 0) + 1);
		mismatched.sentinelHeat = heat;
		if (heat === 3) {
			mismatched.lock = revealed[matchSize - 1];
		}
	}

	if (variant === 'memory:superstorm' && (round.mismatches + 1) % 4 === 0) {
		mismatched.stormFrostedRow = row;
	} else if (variant === 'memory:superstorm') {
		mismatched.stormFrostedRow = -1;
	}

	if (variant === 'memory:rate-limiter') {
		const penalty = (round.rateLimitPenalty ?? 0) + 1;
		mismatched.rateLimitPenalty = penalty;
		if ((round.mismatches + 1) % 3 === 0) {
			mismatched.rateLimited = true;
		}
	}

	if (variant === 'memory:trace-route') {
		const trace = Math.min(100, (round.traceMeter ?? 0) + 15);
		mismatched.traceMeter = trace;
		if (trace === 100) {
			const unrevealed = round.cards
				.map((_, i) => i)
				.filter((i) => !round.matched.includes(i) && !revealed.includes(i));
			mismatched.quarantine = unrevealed.slice(0, 2);
		}
	}

	if (variant === 'memory:edge-cache') {
		const cache: Record<number, { symbol: SymbolId; turns: number }> = {
			...(round.edgeCache ?? {})
		};
		for (const pos of revealed) {
			cache[pos] = { symbol: round.cards[pos].symbol, turns: 2 };
		}
		mismatched.edgeCache = cache;
	}

	if (variant === 'memory:burst-transmission') {
		mismatched.burstStreak = 0;
		mismatched.burstPing = [];
	}

	// Lock the last card only while two other unmatched cards keep a legal attempt open.
	if (variant === 'memory:lockout')
		mismatched.lock =
			round.cards.length - round.matched.length - 1 >= 2 ? revealed[matchSize - 1] : null;

	const isHazardMismatch = variant === 'memory:hazard' && (card.isHazard || first.isHazard);
	const isGravitinoMismatch =
		variant === 'memory:gravitino-risk' && (card.isGravitino || first.isGravitino);
	const isAtlasLoop = variant === 'memory:atlas-terminal' && (moves * 2) % 16 === 0;

	let finalRound = mismatched;
	if (variant === 'memory:moving' || isHazardMismatch || isAtlasLoop) {
		finalRound = moveFaceDownCards(finalRound);
	} else if (isGravitinoMismatch) {
		finalRound = scrambleColumn(finalRound, index % cols);
	} else if (variant === 'memory:anycast-route' && (round.mismatches + 1) % 3 === 0) {
		finalRound = shiftPerimeterClockwise(finalRound);
	} else if (variant === 'memory:bit-rot') {
		const rot: Record<number, number> = { ...(round.bitRot ?? {}) };
		for (const pos of revealed) {
			rot[pos] = (rot[pos] ?? 0) + 1;
		}
		const cards = [...finalRound.cards];
		for (const [posStr, count] of Object.entries(rot)) {
			const pos = Number(posStr);
			if (count >= 3 && !round.matched.includes(pos)) {
				const swapTarget = (pos + 1) % cards.length;
				if (!round.matched.includes(swapTarget)) {
					const tmp = cards[pos];
					cards[pos] = cards[swapTarget];
					cards[swapTarget] = tmp;
					rot[pos] = 0;
					rot[swapTarget] = 0;
				}
			}
		}
		finalRound = { ...finalRound, cards, bitRot: rot };
	}

	return {
		round: finalRound,
		effect: 'mismatch'
	};
}

export function resolveMismatch(round: MemoryRound): MemoryRound {
	if (round.revealed.length !== cardsPerMatch(round)) {
		return round;
	}

	let hidden: MemoryRound = {
		...round,
		revealed: [],
		...(round.illuminated?.length ? { illuminated: [] } : {}),
		...(round.burstPing?.length ? { burstPing: [] } : {}),
		...(round.quarantine?.length ? { quarantine: [] } : {})
	};
	if (round.edgeCache) {
		const nextCache: Record<number, { symbol: SymbolId; turns: number }> = {};
		for (const [posStr, entry] of Object.entries(round.edgeCache)) {
			if (entry.turns > 1) {
				nextCache[Number(posStr)] = { symbol: entry.symbol, turns: entry.turns - 1 };
			}
		}
		hidden = { ...hidden, edgeCache: nextCache };
	}
	const variant = memoryVariant(round);
	if (variant === 'memory:swaps') return swapHiddenCards(hidden);
	if (variant === 'memory:drift') return driftRow(hidden, round.revealed[0]);
	if (variant === 'memory:decay') return updateDecay(hidden, round.revealed);
	return hidden;
}

/** Cards matched so far, including collapsed ones that left the board. */
export function matchedCount(round: MemoryRound): number {
	return round.matched.length + (round.cleared ?? 0);
}

export function isFaceUp(round: MemoryRound, index: number): boolean {
	return round.matched.includes(index) || round.revealed.includes(index);
}

export function scoreFor(
	pairs: number,
	mismatches: number,
	elapsedSeconds: number,
	scoring: ScoreValues = scoringDefinition.defaults
): number {
	const seconds = Math.max(0, Math.floor(elapsedSeconds));
	return Math.max(
		0,
		pairs * (scoring.pair ?? scoring.trio ?? scoring.quad)! -
			mismatches * scoring.mismatch! -
			seconds * scoring.second!
	);
}

function defaultScoring(round: MemoryRound): ScoreValues {
	const variant = memoryVariant(round);
	return variant === 'memory:trios'
		? triosScoring.defaults
		: variant === 'memory:quads'
			? quadsScoring.defaults
			: scoringDefinition.defaults;
}

export function currentScore(
	round: MemoryRound,
	elapsedSeconds: number,
	scoring: ScoreValues = defaultScoring(round)
): number {
	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}

export function scoreRound(
	round: MemoryRound,
	elapsedSeconds: number,
	scoring: ScoreValues = defaultScoring(round)
): number {
	if (round.status !== 'won') {
		return 0;
	}
	if (round.variant === 'memory:countdown' && elapsedSeconds > (round.timeLimit ?? 60)) {
		return 0;
	}

	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}
