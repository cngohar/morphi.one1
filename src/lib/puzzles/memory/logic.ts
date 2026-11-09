import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring as scoringDefinition, triosScoring, quadsScoring } from './scoring.js';
import { createRng, shuffle } from '#lib/engine/rng.js';
import { SYMBOLS, type SymbolId } from '#lib/puzzles/memory/symbols.js';

export const PAIR_COUNTS = [6, 8, 10] as const;
export type PairCount = (typeof PAIR_COUNTS)[number];
export const QUAD_COUNTS = [4, 5, 6] as const;
/** Transport/checkpoint ceiling, not an attempt or survival rule. */
export const MEMORY_TIME_STRATA_MAX_ACTIONS = 10000;
export const MEMORY_STRATA_VARIANTS = [
	'memory:strata-linked',
	'memory:strata-sweep',
	'memory:strata-shelf',
	'memory:strata-cycle',
	'memory:strata-empty-well',
	'memory:strata-glimpse',
	'memory:strata-chain',
	'memory:strata-echo',
	'memory:strata-slip',
	'memory:strata-order'
] as const;

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
	kvSyncing?: boolean;
	vectorCluster?: 'ai' | 'db' | 'sec' | 'net';
	clearanceTier?: 1 | 2 | 3;
	isGlaciated?: boolean;
	zone?: 'meadow' | 'grove';
	isBriarLocked?: boolean;
	isDewdrop?: boolean;
	isWilted?: boolean;
	sporeSymmetry?: 'even' | 'odd';
	partition?: 0 | 1 | 2;
	blurLevel?: number;
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
	'memory:burst-transmission',
	'memory:kv-consistency',
	'memory:durable-object',
	'memory:vectorize-knn',
	'memory:fifo-queue',
	'memory:ai-tokens',
	'memory:hyperdrive-pool',
	'memory:turnstile-verify',
	'memory:zero-trust',
	'memory:argo-reroute',
	'memory:r2-glacier',
	'memory:cross-pollination',
	'memory:mycelium-network',
	'memory:photosynthesis',
	'memory:seed-dispersal',
	'memory:seasonal-bloom',
	'memory:bee-waggle',
	'memory:carnivorous-briar',
	'memory:chlorophyll-meter',
	'memory:bioluminescent',
	'memory:botanical-graft',
	'memory:workflows-step',
	'memory:browser-rendering',
	'memory:ai-gateway',
	'memory:k2-streams',
	'memory:basin-catalog',
	'memory:edge-snippets',
	'memory:images-transform',
	'memory:waiting-room',
	'memory:privacy-pass',
	'memory:agents-sdk',
	'memory:time-strata',
	...MEMORY_STRATA_VARIANTS
] as const;
export type MemoryVariant = (typeof MEMORY_VARIANTS)[number];

/** Anonymous gameplay settings; identity stays in the server/legacy issuance envelope. */
export type MemoryRules = {
	readonly matchSize: 2 | 3 | 4;
	readonly previewMs: number;
	readonly attemptsPerCard: number;
	readonly enforceMoveLimit?: boolean;
	readonly shuffleOnMiss?: boolean;
	readonly lockLastMissedCard?: boolean;
	readonly swapTwoOnResolve?: boolean;
	readonly oppositeCardBacks?: boolean;
	readonly removeMatchedCards?: boolean;
	readonly timeLimitPerPair?: number;
	readonly missLives?: number;
	readonly wildMatching?: boolean;
	readonly revealNeighborsOnMatch?: boolean;
	readonly oppositeShadesOnly?: boolean;
	readonly driftFirstRowOnMiss?: boolean;
	readonly seenCardTurns?: number;
	readonly keepOneRevealOnMiss?: boolean;
	readonly growMatchMultiplier?: boolean;
	readonly hazardShuffle?: boolean;
	readonly blockedRowPeriod?: number;
	readonly lockAtHeat?: number;
	readonly orderedTiers?: boolean;
	readonly spectralCardBacks?: boolean;
	readonly spendFlipEnergy?: boolean;
	readonly swapEndpointsOnAnomaly?: boolean;
	readonly shuffleColumnOnRiskMiss?: boolean;
	readonly growSpeedMultiplier?: boolean;
	readonly revealNeighborCone?: boolean;
	readonly shuffleEveryFlips?: number;
	readonly missGhostTurns?: number;
	readonly revealTwin?: boolean;
	readonly cooldownEveryMisses?: number;
	readonly canStoreCard?: boolean;
	readonly unlockAdjacentCards?: boolean;
	readonly perimeterShiftEveryMisses?: number;
	readonly requireBothHandshakeStages?: boolean;
	readonly quarantineAtTrace?: number;
	readonly transposeAfterMisses?: number;
	readonly revealAfterStreak?: number;
	readonly replicateSeenCards?: boolean;
	readonly differentRowsOnly?: boolean;
	readonly matchClusters?: boolean;
	readonly queueMissedCards?: boolean;
	readonly spendFlipTokens?: boolean;
	readonly growPoolMultiplier?: boolean;
	readonly challengeEveryMisses?: number;
	readonly clearanceTiers?: boolean;
	readonly quadrantShiftAfterMisses?: number;
	readonly freezeAfterUntouched?: number;
	readonly crossBedOnly?: boolean;
	readonly hintPartnerOnFlip?: boolean;
	readonly movingSunbeam?: boolean;
	readonly dormancyAfterUntouched?: number;
	readonly hintPartnerRowOnFlip?: boolean;
	readonly unlockWithDewdrop?: boolean;
	readonly spendSap?: boolean;
	readonly parityCardBacks?: boolean;
	readonly growGardenMultiplier?: boolean;
	readonly retryFailedPairOnce?: boolean;
	readonly snapshotEveryFlips?: number;
	readonly rememberViewedCards?: boolean;
	readonly cycleTargetOnMatch?: boolean;
	readonly samePartitionOnly?: boolean;
	readonly swapAdjacentAfterMatch?: boolean;
	readonly sharpenOnFlip?: boolean;
	readonly flipSlots?: number;
	readonly privacyAllowance?: number;
	readonly hintEveryMatches?: number;
	readonly topOnly?: boolean;
	readonly adjacentStacksOnly?: boolean;
	readonly deepestStackOnly?: boolean;
	readonly canLiftTop?: boolean;
	readonly canCycleTop?: boolean;
	readonly canMoveToEmptyStack?: boolean;
	readonly peekBelowTop?: boolean;
	readonly chainExposedMatches?: boolean;
	readonly revealExposedTops?: boolean;
	readonly sinkMissedTops?: boolean;
	readonly orderedSymbols?: boolean;
};

const RULE_DELTAS = {
	'memory:classic': {},
	'memory:no-preview': { previewMs: 0 },
	'memory:trios': { matchSize: 3, enforceMoveLimit: true },
	'memory:moving': { shuffleOnMiss: true },
	'memory:budget': { attemptsPerCard: 2, enforceMoveLimit: true },
	'memory:lockout': { lockLastMissedCard: true },
	'memory:swaps': { swapTwoOnResolve: true },
	'memory:two-backs': { oppositeCardBacks: true },
	'memory:quads': { matchSize: 4, enforceMoveLimit: true },
	'memory:collapse': { removeMatchedCards: true },
	'memory:countdown': { timeLimitPerPair: 10 },
	'memory:three-strikes': { missLives: 3 },
	'memory:wild-card': { wildMatching: true },
	'memory:sonar': { revealNeighborsOnMatch: true },
	'memory:zebra': { oppositeShadesOnly: true },
	'memory:drift': { driftFirstRowOnMiss: true },
	'memory:decay': { seenCardTurns: 3 },
	'memory:one-flip': { keepOneRevealOnMiss: true },
	'memory:combo': { growMatchMultiplier: true },
	'memory:hazard': { hazardShuffle: true },
	'memory:superstorm': { blockedRowPeriod: 4 },
	'memory:sentinel-heat': { lockAtHeat: 3 },
	'memory:glyph-chain': { orderedTiers: true },
	'memory:analysis-visor': { spectralCardBacks: true },
	'memory:life-support': { spendFlipEnergy: true },
	'memory:hyperdrive-warp': { swapEndpointsOnAnomaly: true },
	'memory:gravitino-risk': { shuffleColumnOnRiskMiss: true },
	'memory:pulse-drive': { growSpeedMultiplier: true },
	'memory:derelict-fog': { revealNeighborCone: true },
	'memory:atlas-terminal': { shuffleEveryFlips: 16 },
	'memory:edge-cache': { missGhostTurns: 2 },
	'memory:quantum-entangle': { revealTwin: true },
	'memory:rate-limiter': { cooldownEveryMisses: 3 },
	'memory:register-buffer': { canStoreCard: true },
	'memory:firewall-ice': { unlockAdjacentCards: true },
	'memory:anycast-route': { perimeterShiftEveryMisses: 3 },
	'memory:tls-handshake': { requireBothHandshakeStages: true },
	'memory:trace-route': { quarantineAtTrace: 100 },
	'memory:bit-rot': { transposeAfterMisses: 3 },
	'memory:burst-transmission': { revealAfterStreak: 2 },
	'memory:kv-consistency': { replicateSeenCards: true },
	'memory:durable-object': { differentRowsOnly: true },
	'memory:vectorize-knn': { matchClusters: true },
	'memory:fifo-queue': { queueMissedCards: true },
	'memory:ai-tokens': { spendFlipTokens: true },
	'memory:hyperdrive-pool': { growPoolMultiplier: true },
	'memory:turnstile-verify': { challengeEveryMisses: 4 },
	'memory:zero-trust': { clearanceTiers: true },
	'memory:argo-reroute': { quadrantShiftAfterMisses: 3 },
	'memory:r2-glacier': { freezeAfterUntouched: 4 },
	'memory:cross-pollination': { crossBedOnly: true },
	'memory:mycelium-network': { crossBedOnly: true, hintPartnerOnFlip: true },
	'memory:photosynthesis': { crossBedOnly: true, movingSunbeam: true },
	'memory:seed-dispersal': { crossBedOnly: true, swapTwoOnResolve: true },
	'memory:seasonal-bloom': { crossBedOnly: true, dormancyAfterUntouched: 3 },
	'memory:bee-waggle': { crossBedOnly: true, hintPartnerRowOnFlip: true },
	'memory:carnivorous-briar': { crossBedOnly: true, unlockWithDewdrop: true },
	'memory:chlorophyll-meter': { crossBedOnly: true, spendSap: true },
	'memory:bioluminescent': { crossBedOnly: true, parityCardBacks: true },
	'memory:botanical-graft': { crossBedOnly: true, growGardenMultiplier: true },
	'memory:workflows-step': { retryFailedPairOnce: true },
	'memory:browser-rendering': { snapshotEveryFlips: 4 },
	'memory:ai-gateway': { rememberViewedCards: true },
	'memory:k2-streams': { cycleTargetOnMatch: true },
	'memory:basin-catalog': { samePartitionOnly: true },
	'memory:edge-snippets': { swapAdjacentAfterMatch: true },
	'memory:images-transform': { sharpenOnFlip: true },
	'memory:waiting-room': { flipSlots: 3 },
	'memory:privacy-pass': { privacyAllowance: 3 },
	'memory:agents-sdk': { hintEveryMatches: 3 },
	'memory:time-strata': { topOnly: true, previewMs: 0 },
	'memory:strata-linked': { topOnly: true, previewMs: 0, adjacentStacksOnly: true },
	'memory:strata-sweep': { topOnly: true, previewMs: 0, deepestStackOnly: true },
	'memory:strata-shelf': { topOnly: true, previewMs: 0, canLiftTop: true },
	'memory:strata-cycle': { topOnly: true, previewMs: 0, canCycleTop: true },
	'memory:strata-empty-well': { topOnly: true, previewMs: 0, canMoveToEmptyStack: true },
	'memory:strata-glimpse': { topOnly: true, previewMs: 0, peekBelowTop: true },
	'memory:strata-chain': { topOnly: true, previewMs: 0, chainExposedMatches: true },
	'memory:strata-echo': { topOnly: true, previewMs: 0, revealExposedTops: true },
	'memory:strata-slip': { topOnly: true, previewMs: 0, canCycleTop: true, sinkMissedTops: true },
	'memory:strata-order': { topOnly: true, previewMs: 0, orderedSymbols: true }
} satisfies Record<MemoryVariant, Partial<MemoryRules>>;

const MEMORY_RULES = Object.fromEntries(
	MEMORY_VARIANTS.map((id) => [
		id,
		Object.freeze({ matchSize: 2, previewMs: 3000, attemptsPerCard: 6, ...RULE_DELTAS[id] })
	])
) as Record<MemoryVariant, MemoryRules>;

/** Resolve an internal issuance identity once; the returned settings contain no identity. */
export function memoryRules(variant?: string): MemoryRules {
	return MEMORY_RULES[parseMemoryVariant(variant)];
}

/** Legacy headless fixtures may omit rules; newly issued rounds always supply them. */
export function memoryRoundRules({
	rules,
	variant
}: {
	rules?: MemoryRules;
	variant?: string;
}): MemoryRules {
	return rules ?? memoryRules(variant);
}

export function memoryVariant({ variant }: { variant?: string }): MemoryVariant {
	return parseMemoryVariant(variant);
}

export function parseMemoryVariant(variant?: string): MemoryVariant {
	if (variant === undefined) return 'memory:classic';
	if (!MEMORY_VARIANTS.includes(variant as MemoryVariant)) throw new RangeError('variant');
	return variant as MemoryVariant;
}

export function memoryVariantName(variant?: string): `variant.${MemoryVariant}` {
	return `variant.${parseMemoryVariant(variant)}`;
}

export function isTimeStrata(variant?: string): boolean {
	return Boolean(
		variant &&
		Object.hasOwn(MEMORY_RULES, variant) &&
		MEMORY_RULES[variant as MemoryVariant].topOnly
	);
}

export function cardsPerMatch(round: { rules?: MemoryRules; variant?: string }): number {
	return memoryRoundRules(round).matchSize;
}

/** Replay payload ceiling; Time Strata counts its explicit controls too. */
export function memoryMoveLimit(round: MemoryRound): number {
	const rules = memoryRoundRules(round);
	return rules.topOnly
		? MEMORY_TIME_STRATA_MAX_ACTIONS
		: round.pairs * rules.matchSize * rules.attemptsPerCard;
}

/** A final-attempt win counts; Time Strata reserves room to resolve every accepted attempt. */
export function memoryCapReached(round: MemoryRound): boolean {
	const rules = memoryRoundRules(round);
	if (rules.topOnly) {
		return (
			round.status !== 'won' &&
			(round.actions ?? 0) + strataResolutionRoom(round) > MEMORY_TIME_STRATA_MAX_ACTIONS
		);
	}
	const size = cardsPerMatch(round);
	return (
		Boolean(rules.enforceMoveLimit) &&
		round.status !== 'won' &&
		round.moves * size + (round.revealed.length < size ? round.revealed.length : 0) >=
			memoryMoveLimit(round)
	);
}

export type MemoryStatus = 'playing' | 'won' | 'lost';

export interface MemoryRound {
	seed: string;
	variant?: MemoryVariant;
	rules?: MemoryRules;
	/** Time Strata only: four bottom-to-top lists of stable card indices. */
	stacks?: number[][];
	/** Time Strata only: accepted flips and explicit controls in the replay log. */
	actions?: number;
	/** Sample Shelf: one lifted card and its original well. */
	shelf?: { index: number; stack: number } | null;
	/** Layer Echo: read-only exposed tops awaiting their own Continue. */
	echo?: number[];
	/** Chain Reaction: the current revealed pair came from the preceding removal. */
	chain?: boolean;
	/** Excavation Order: immutable target sequence and completed-target cursor. */
	excavationOrder?: SymbolId[];
	orderCursor?: number;
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
	/** KV consistency only: replica synchronization tracker. */
	kvReplicas?: Record<number, boolean>;
	/** Durable object only: active actor row coordinator mutex lock. */
	lockedActorRow?: number | null;
	/** FIFO queue only: dead-letter holding queue. */
	dlqQueue?: number[];
	/** Workers AI only: context window inference token budget. */
	aiTokens?: number;
	/** Hyperdrive only: connection pool score multiplier. */
	hyperdriveMultiplier?: number;
	/** Turnstile only: active human verification challenge flag. */
	turnstileActive?: boolean;
	/** Zero trust only: current unlocked clearance tier (1, 2, or 3). */
	clearanceTier?: 1 | 2 | 3;
	/** Argo route only: per-quadrant attempt counter for congestion bypass. */
	quadrantHits?: Record<number, number>;
	/** R2 glacier only: consecutive untouched turn counter per card. */
	glacierUntouched?: Record<number, number>;
	/** Botanical ecosystem properties */
	myceliumPulse?: number | null;
	sunbeamRow?: number;
	bloomDormancy?: Record<number, number>;
	beeWaggleRow?: number | null;
	briarsCleared?: boolean;
	sap?: number;
	graftMultiplier?: number;
	seedBreezeSwapped?: [number, number];
	/** Cloudflare developer platform properties */
	workflowStep?: 1 | 2 | 3;
	workflowRetryUsed?: boolean;
	renderScanCountdown?: number;
	snapshotQuad?: number[];
	cacheKnown?: number[];
	streamTarget?: SymbolId;
	streamBurst?: boolean;
	partitionFilter?: number | null;
	activeHeader?: string | null;
	sharpness?: Record<number, number>;
	waitingTokens?: number;
	privacyTokens?: number;
	agentCycles?: number;
	agentHint?: number | null;
	/** Group count: pairs (6/8/10), trios (6/8/10) or quads (4/5/6). */
	pairs: number;
	cards: MemoryCard[];
	revealed: number[];
	matched: number[];
	mismatches: number;
	moves: number;
	status: MemoryStatus;
}

export type MemoryMove =
	| { index: number }
	| { cancel: 1 }
	| { continue: 1 }
	| { lift: number }
	| { return: 1 }
	| { cycle: number }
	| { from: number; to: number };

export type FlipEffect = 'ignored' | 'flip' | 'match' | 'mismatch' | 'win' | 'cancel' | 'continue';

export interface FlipResult {
	round: MemoryRound;
	effect: FlipEffect;
}

export function isBotanical(variant?: string): boolean {
	return Boolean(
		variant &&
		Object.hasOwn(MEMORY_RULES, variant) &&
		MEMORY_RULES[variant as MemoryVariant].crossBedOnly
	);
}

export function createMemoryRound(seed: string, variant?: string): MemoryRound {
	const selectedVariant = parseMemoryVariant(variant);
	const rules = memoryRules(selectedVariant);
	const rng = createRng(seed);
	let rngDraws = 0;
	if (
		rules.shuffleOnMiss ||
		rules.swapTwoOnResolve ||
		rules.hazardShuffle ||
		rules.swapEndpointsOnAnomaly ||
		rules.shuffleColumnOnRiskMiss ||
		(rules.shuffleEveryFlips ?? 0) > 0 ||
		(rules.perimeterShiftEveryMisses ?? 0) > 0 ||
		(rules.transposeAfterMisses ?? 0) > 0 ||
		(rules.quadrantShiftAfterMisses ?? 0) > 0
	) {
		const nextU64 = rng.nextU64;
		rng.nextU64 = () => {
			rngDraws += 1;
			return nextU64();
		};
	}
	const counts = rules.matchSize === 4 ? QUAD_COUNTS : PAIR_COUNTS;
	const pairs = counts[rng.nextInt(counts.length)] ?? 6;
	const selected = shuffle(rng, SYMBOLS).slice(0, pairs);
	const deck: MemoryCard[] = [];
	const size = rules.matchSize;

	for (const symbol of selected)
		for (let copy = 0; copy < size; copy += 1)
			deck.push({
				id: `${symbol.id}:${copy}`,
				symbol: symbol.id,
				color: symbol.color,
				...(rules.oppositeCardBacks ? { back: copy as 0 | 1 } : {}),
				...(rules.oppositeShadesOnly
					? { zebra: (copy === 0 ? 'light' : 'dark') as 'light' | 'dark' }
					: {})
			});

	if (rules.topOnly) {
		const stacks: number[][] = [[], [], [], []];
		const schedule = rules.adjacentStacksOnly
			? [
					[0, 1],
					[2, 3],
					[1, 2],
					[3, 0]
				]
			: rules.deepestStackOnly || rules.canMoveToEmptyStack || rules.chainExposedMatches
				? [
						[0, 1],
						[2, 3]
					]
				: [
						[0, 1],
						[2, 3],
						[0, 2],
						[1, 3]
					];
		// Reverse insertion always exposes a pair; removing any exposed pair preserves that order.
		for (let pair = 0; pair < pairs; pair += 1) {
			const [first, second] = schedule[pair % schedule.length];
			stacks[first].push(pair * 2);
			stacks[second].push(pair * 2 + 1);
		}
		if (rules.canCycleTop) {
			for (let stack = 0; stack < stacks.length; stack += 1)
				stacks[stack] = shuffle(rng, stacks[stack]);
		}
		return {
			seed,
			variant: selectedVariant,
			rules,
			stacks,
			actions: 0,
			pairs,
			cards: deck,
			revealed: [],
			matched: [],
			mismatches: 0,
			moves: 0,
			status: 'playing',
			...(rules.canLiftTop ? { shelf: null } : {}),
			...(rules.revealExposedTops ? { echo: [] } : {}),
			...(rules.chainExposedMatches ? { chain: false } : {}),
			...(rules.orderedSymbols
				? { excavationOrder: selected.map((symbol) => symbol.id).reverse(), orderCursor: 0 }
				: {})
		};
	}

	if (rules.wildMatching) {
		const lastSymbol = selected[selected.length - 1];
		const wildCard = deck.find((c) => c.id === `${lastSymbol.id}:1`);
		if (wildCard) {
			wildCard.isWild = true;
			wildCard.color = '#f59e0b';
		}
	} else if (rules.hazardShuffle) {
		const lastSymbol = selected[selected.length - 1];
		for (const card of deck) {
			if (card.symbol === lastSymbol.id) {
				card.isHazard = true;
				card.color = '#ef4444';
			}
		}
	} else if (rules.spectralCardBacks) {
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
	} else if (rules.orderedTiers) {
		for (let sIdx = 0; sIdx < selected.length; sIdx++) {
			const tier = sIdx + 1;
			for (const c of deck) {
				if (c.symbol === selected[sIdx].id) c.tier = tier;
			}
		}
	} else if (rules.swapEndpointsOnAnomaly) {
		const anomalySymbol = selected[selected.length - 1];
		for (const c of deck) {
			if (c.symbol === anomalySymbol.id) c.isAnomaly = true;
		}
	} else if (rules.shuffleColumnOnRiskMiss) {
		const gravSymbol = selected[0];
		for (const c of deck) {
			if (c.symbol === gravSymbol.id) c.isGravitino = true;
		}
	} else if (rules.revealTwin) {
		const qSymbol = selected[0];
		for (const c of deck) {
			if (c.symbol === qSymbol.id) c.isQuantum = true;
		}
	} else if (rules.requireBothHandshakeStages) {
		for (const symbol of selected) {
			const cards = deck.filter((c) => c.symbol === symbol.id);
			if (cards[0]) cards[0].tlsStage = 'syn';
			if (cards[1]) cards[1].tlsStage = 'ack';
		}
	} else if (rules.unlockAdjacentCards) {
		const mid = Math.floor(deck.length / 2);
		if (deck[mid - 1]) deck[mid - 1].isFirewall = true;
		if (deck[mid]) deck[mid].isFirewall = true;
	} else if (rules.matchClusters) {
		const clusters: ('ai' | 'db' | 'sec' | 'net')[] = ['ai', 'db', 'sec', 'net'];
		for (let sIdx = 0; sIdx < selected.length; sIdx++) {
			const cluster = clusters[sIdx % clusters.length];
			for (const c of deck) {
				if (c.symbol === selected[sIdx].id) c.vectorCluster = cluster;
			}
		}
	} else if (rules.clearanceTiers) {
		for (let sIdx = 0; sIdx < selected.length; sIdx++) {
			const tier = (sIdx < 2 ? 1 : sIdx < 5 ? 2 : 3) as 1 | 2 | 3;
			for (const c of deck) {
				if (c.symbol === selected[sIdx].id) c.clearanceTier = tier;
			}
		}
	} else if (rules.crossBedOnly) {
		for (let sIdx = 0; sIdx < selected.length; sIdx++) {
			const cards = deck.filter((c) => c.symbol === selected[sIdx].id);
			if (cards[0]) cards[0].zone = 'meadow';
			if (cards[1]) cards[1].zone = 'grove';
			if (rules.parityCardBacks) {
				if (cards[0]) cards[0].sporeSymmetry = sIdx % 2 === 0 ? 'even' : 'odd';
				if (cards[1]) cards[1].sporeSymmetry = sIdx % 2 === 0 ? 'even' : 'odd';
			}
		}
		if (rules.unlockWithDewdrop) {
			const groveCards = deck.filter((c) => c.zone === 'grove');
			if (groveCards[0]) groveCards[0].isBriarLocked = true;
			if (groveCards[1]) groveCards[1].isBriarLocked = true;
			const meadowCards = deck.filter((c) => c.zone === 'meadow');
			if (meadowCards[0]) meadowCards[0].isDewdrop = true;
		}
	} else if (rules.samePartitionOnly) {
		for (let sIdx = 0; sIdx < selected.length; sIdx++) {
			const part = (sIdx % 3) as 0 | 1 | 2;
			for (const c of deck) {
				if (c.symbol === selected[sIdx].id) c.partition = part;
			}
		}
	} else if (rules.sharpenOnFlip) {
		for (const c of deck) {
			c.blurLevel = 5;
		}
	}

	const roundCards = rules.crossBedOnly
		? [
				...shuffle(
					rng,
					deck.filter((c) => c.zone === 'meadow')
				),
				...shuffle(
					rng,
					deck.filter((c) => c.zone === 'grove')
				)
			]
		: shuffle(rng, deck);
	if (rules.differentRowsOnly) {
		const cols = 4;
		let changed = true;
		let attempts = 0;
		while (changed && attempts < 50) {
			changed = false;
			attempts += 1;
			for (let i = 0; i < roundCards.length; i++) {
				for (let j = i + 1; j < roundCards.length; j++) {
					if (
						roundCards[i].symbol === roundCards[j].symbol &&
						Math.floor(i / cols) === Math.floor(j / cols)
					) {
						for (let k = 0; k < roundCards.length; k++) {
							const rowK = Math.floor(k / cols);
							const rowJ = Math.floor(j / cols);
							if (rowK !== rowJ) {
								const partnerK = roundCards.findIndex(
									(c, idx) => idx !== k && c.symbol === roundCards[k].symbol
								);
								const rowPartnerK = Math.floor(partnerK / cols);
								if (rowPartnerK !== rowJ && rowK !== Math.floor(i / cols)) {
									const tmp = roundCards[j];
									roundCards[j] = roundCards[k];
									roundCards[k] = tmp;
									changed = true;
									break;
								}
							}
						}
					}
				}
			}
		}
	}

	const round: MemoryRound = {
		seed,
		pairs,
		cards: roundCards,
		revealed: [],
		matched: [],
		mismatches: 0,
		moves: 0,
		status: 'playing'
	};
	if (selectedVariant !== 'memory:classic') {
		Object.assign(round, { variant: selectedVariant, rules });
	} else {
		// Preserve classic byte/key compatibility; daily serialization explicitly copies rules.
		Object.defineProperty(round, 'rules', {
			value: rules,
			enumerable: false,
			writable: true,
			configurable: true
		});
	}
	if (
		rules.shuffleOnMiss ||
		rules.swapTwoOnResolve ||
		rules.hazardShuffle ||
		rules.swapEndpointsOnAnomaly ||
		rules.shuffleColumnOnRiskMiss ||
		(rules.shuffleEveryFlips ?? 0) > 0 ||
		(rules.perimeterShiftEveryMisses ?? 0) > 0 ||
		(rules.transposeAfterMisses ?? 0) > 0 ||
		(rules.quadrantShiftAfterMisses ?? 0) > 0
	)
		round.rngDraws = rngDraws;
	if (rules.spendSap) round.sap = 100;
	if (rules.growGardenMultiplier) round.graftMultiplier = 1;
	if (rules.movingSunbeam) round.sunbeamRow = 0;
	if (rules.unlockWithDewdrop) round.briarsCleared = false;
	if (rules.lockLastMissedCard) round.lock = null;
	if (rules.swapTwoOnResolve && !rules.crossBedOnly) round.marked = [];
	if (rules.removeMatchedCards) round.cleared = 0;
	if ((rules.timeLimitPerPair ?? 0) > 0) round.timeLimit = pairs * rules.timeLimitPerPair!;
	if ((rules.missLives ?? 0) > 0) round.lives = rules.missLives;
	if (rules.growMatchMultiplier) round.combo = 1;
	if ((rules.seenCardTurns ?? 0) > 0) round.decay = {};
	if (rules.revealNeighborsOnMatch) round.sonar = [];
	if ((rules.blockedRowPeriod ?? 0) > 0) round.stormFrostedRow = -1;
	if ((rules.lockAtHeat ?? 0) > 0) round.sentinelHeat = 0;
	if (rules.orderedTiers) round.glyphTier = 1;
	if (rules.spendFlipEnergy) round.lifeSupport = 100;
	if (rules.growSpeedMultiplier) round.pulseStreak = 1;
	if (rules.revealNeighborCone) round.illuminated = [];
	if ((rules.missGhostTurns ?? 0) > 0) round.edgeCache = {};
	if ((rules.cooldownEveryMisses ?? 0) > 0) {
		round.rateLimited = false;
		round.rateLimitPenalty = 0;
	}
	if (rules.canStoreCard) round.bufferCard = null;
	if ((rules.quarantineAtTrace ?? 0) > 0) {
		round.traceMeter = 0;
		round.quarantine = [];
	}
	if ((rules.transposeAfterMisses ?? 0) > 0) round.bitRot = {};
	if ((rules.revealAfterStreak ?? 0) > 0) {
		round.burstStreak = 0;
		round.burstPing = [];
	}
	if (rules.replicateSeenCards) round.kvReplicas = {};
	if (rules.differentRowsOnly) round.lockedActorRow = null;
	if (rules.queueMissedCards) round.dlqQueue = [];
	if (rules.spendFlipTokens) round.aiTokens = 120;
	if (rules.growPoolMultiplier) round.hyperdriveMultiplier = 2;
	if ((rules.challengeEveryMisses ?? 0) > 0) round.turnstileActive = false;
	if (rules.clearanceTiers) round.clearanceTier = 1;
	if ((rules.quadrantShiftAfterMisses ?? 0) > 0) round.quadrantHits = { 0: 0, 1: 0, 2: 0, 3: 0 };
	if ((rules.freezeAfterUntouched ?? 0) > 0) round.glacierUntouched = {};
	if (rules.retryFailedPairOnce) {
		round.workflowStep = 1;
		round.workflowRetryUsed = false;
	}
	if ((rules.snapshotEveryFlips ?? 0) > 0) round.renderScanCountdown = rules.snapshotEveryFlips;
	if (rules.rememberViewedCards) round.cacheKnown = [];
	if (rules.cycleTargetOnMatch) round.streamTarget = selected[0]?.id;
	if (rules.samePartitionOnly) round.partitionFilter = null;
	if (rules.swapAdjacentAfterMatch) round.activeHeader = null;
	if ((rules.flipSlots ?? 0) > 0) round.waitingTokens = rules.flipSlots;
	if ((rules.privacyAllowance ?? 0) > 0) round.privacyTokens = rules.privacyAllowance;
	if ((rules.hintEveryMatches ?? 0) > 0) round.agentCycles = 0;
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
		decay[pos] = memoryRoundRules(round).seenCardTurns ?? 3;
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

function shiftQuadrantArgo(round: MemoryRound, qIdx: number): MemoryRound {
	const cols = 4;
	const oppositeQ = (qIdx + 2) % 4;
	const qCardIndices = round.cards
		.map((_, i) => i)
		.filter((i) => {
			const r = Math.floor(i / cols);
			const c = i % cols;
			const q = (r < 2 ? 0 : 2) + (c < 2 ? 0 : 1);
			return q === qIdx && !isFaceUp(round, i);
		});
	const oppCardIndices = round.cards
		.map((_, i) => i)
		.filter((i) => {
			const r = Math.floor(i / cols);
			const c = i % cols;
			const q = (r < 2 ? 0 : 2) + (c < 2 ? 0 : 1);
			return q === oppositeQ && !isFaceUp(round, i);
		});
	if (qCardIndices.length > 0 && oppCardIndices.length > 0) {
		const cards = round.cards.slice();
		const i1 = qCardIndices[0];
		const i2 = oppCardIndices[0];
		const tmp = cards[i1];
		cards[i1] = cards[i2];
		cards[i2] = tmp;
		return { ...round, cards };
	}
	return round;
}

/** One slot per stack; empty wells have no legal card. */
export function timeStrataTops(round: MemoryRound): number[] {
	return round.stacks?.map((stack) => stack.at(-1) ?? -1) ?? [];
}

/** Glimpse and Echo disclose cards without adding playable targets. */
export function timeStrataClues(round: MemoryRound): number[] {
	const rules = memoryRoundRules(round);
	if (round.echo?.length) return round.echo;
	if (!rules.peekBelowTop || round.revealed.length !== 1) return [];
	const stack = round.stacks?.find((well) => well.at(-1) === round.revealed[0]);
	const clue = stack?.at(-2);
	return clue === undefined ? [] : [clue];
}

export function timeStrataCanSelect(round: MemoryRound, index: number): boolean {
	const rules = memoryRoundRules(round);
	if (
		!rules.topOnly ||
		round.status !== 'playing' ||
		round.echo?.length ||
		round.revealed.length >= 2 ||
		memoryCapReached(round) ||
		!Number.isInteger(index) ||
		index < 0 ||
		round.revealed.includes(index)
	)
		return false;
	const tops = timeStrataTops(round);
	if (!tops.includes(index) && round.shelf?.index !== index) return false;
	const stack = tops.indexOf(index);
	if (
		rules.deepestStackOnly &&
		round.stacks![stack].length !== Math.max(...round.stacks!.map((well) => well.length))
	)
		return false;
	if (rules.adjacentStacksOnly && round.revealed.length === 1) {
		const first = tops.indexOf(round.revealed[0]);
		if ((stack - first + 4) % 4 !== 1 && (first - stack + 4) % 4 !== 1) return false;
	}
	return true;
}

export function timeStrataOutcome(
	round: MemoryRound
): 'match' | 'mismatch' | 'order-blocked' | null {
	const rules = memoryRoundRules(round);
	if (!rules.topOnly || round.revealed.length !== 2) return null;
	const symbol = round.cards[round.revealed[0]].symbol;
	if (symbol !== round.cards[round.revealed[1]].symbol) return 'mismatch';
	return rules.orderedSymbols && symbol !== round.excavationOrder?.[round.orderCursor ?? 0]
		? 'order-blocked'
		: 'match';
}

/** Enough wire slots for every confirmation already promised by a selection. */
function strataResolutionRoom(round: MemoryRound): number {
	if (round.echo?.length) return 1;
	const rules = memoryRoundRules(round);
	if (round.revealed.length === 2) {
		if (timeStrataOutcome(round) !== 'match') return 1;
		const wells = round.stacks!.filter((well) => round.revealed.includes(well.at(-1) ?? -1));
		if (rules.revealExposedTops) return wells.some((well) => well.length > 1) ? 2 : 1;
		if (rules.chainExposedMatches) {
			let confirmations = 1;
			while (
				wells.length === 2 &&
				wells[0].length > confirmations &&
				wells[1].length > confirmations &&
				round.cards[wells[0].at(-1 - confirmations)!].symbol ===
					round.cards[wells[1].at(-1 - confirmations)!].symbol
			)
				confirmations += 1;
			return confirmations;
		}
		return 1;
	}
	const extra = rules.chainExposedMatches
		? Math.max(...round.stacks!.map((well) => well.length)) - 1
		: rules.revealExposedTops && round.matched.length < round.cards.length - 2
			? 1
			: 0;
	return 3 - round.revealed.length + extra;
}

/** Control actions stay numeric to preserve the shared Move wire contract. */
export function applyMemoryMove(round: MemoryRound, move: MemoryMove): FlipResult {
	const rules = memoryRoundRules(round);
	if ('index' in move) return flipCard(round, move.index);
	if (!rules.topOnly || round.status !== 'playing' || memoryCapReached(round)) {
		return { round, effect: 'ignored' };
	}
	const actions = (round.actions ?? 0) + 1;
	if ('cancel' in move && move.cancel === 1 && round.revealed.length === 1 && !round.echo?.length) {
		return { round: { ...round, revealed: [], actions }, effect: 'cancel' };
	}
	if ('continue' in move && move.continue === 1) {
		if (round.echo?.length) return { round: { ...round, echo: [], actions }, effect: 'continue' };
		const outcome = timeStrataOutcome(round);
		if (outcome === null) return { round, effect: 'ignored' };
		if (outcome !== 'match') {
			const stacks = rules.sinkMissedTops
				? round.stacks!.map((well) =>
						round.revealed.includes(well.at(-1) ?? -1) ? [well.at(-1)!, ...well.slice(0, -1)] : well
					)
				: round.stacks;
			return { round: { ...round, revealed: [], stacks, actions }, effect: 'continue' };
		}
		const affected = round.stacks!.flatMap((well, stack) =>
			round.revealed.includes(well.at(-1) ?? -1) ? [stack] : []
		);
		const matched = [...round.matched, ...round.revealed].sort((a, b) => a - b);
		const won = matched.length === round.cards.length;
		let next: MemoryRound = {
			...round,
			actions,
			stacks: round.stacks!.map((well, stack) =>
				affected.includes(stack) ? well.slice(0, -1) : well
			),
			revealed: [],
			matched,
			status: won ? 'won' : 'playing',
			...(round.shelf && round.revealed.includes(round.shelf.index) ? { shelf: null } : {}),
			...(round.orderCursor !== undefined ? { orderCursor: round.orderCursor + 1 } : {}),
			...(round.chain !== undefined ? { chain: false } : {})
		};
		const exposed = affected.flatMap((stack) => {
			const top = next.stacks![stack].at(-1);
			return top === undefined ? [] : [top];
		});
		if (
			!won &&
			rules.chainExposedMatches &&
			exposed.length === 2 &&
			next.cards[exposed[0]].symbol === next.cards[exposed[1]].symbol
		) {
			next = { ...next, revealed: exposed, chain: true, moves: next.moves + 1 };
		}
		if (!won && rules.revealExposedTops && exposed.length) next = { ...next, echo: exposed };
		return { round: next, effect: won ? 'win' : 'match' };
	}
	if (round.revealed.length || round.echo?.length) return { round, effect: 'ignored' };
	const validStack = (stack: number) => Number.isInteger(stack) && stack >= 0 && stack < 4;
	let next: MemoryRound | null = null;
	if ('lift' in move && rules.canLiftTop && validStack(move.lift) && !round.shelf) {
		const index = round.stacks![move.lift].at(-1);
		if (index !== undefined)
			next = {
				...round,
				actions,
				shelf: { index, stack: move.lift },
				stacks: round.stacks!.map((well, stack) => (stack === move.lift ? well.slice(0, -1) : well))
			};
	} else if ('return' in move && move.return === 1 && rules.canLiftTop && round.shelf) {
		next = {
			...round,
			actions,
			shelf: null,
			stacks: round.stacks!.map((well, stack) =>
				stack === round.shelf!.stack ? [...well, round.shelf!.index] : well
			)
		};
	} else if (
		'cycle' in move &&
		rules.canCycleTop &&
		validStack(move.cycle) &&
		round.stacks![move.cycle].length
	) {
		next = {
			...round,
			actions,
			stacks: round.stacks!.map((well, stack) =>
				stack === move.cycle ? [well.at(-1)!, ...well.slice(0, -1)] : well
			)
		};
	} else if (
		'from' in move &&
		rules.canMoveToEmptyStack &&
		validStack(move.from) &&
		validStack(move.to) &&
		move.from !== move.to &&
		round.stacks![move.from].length &&
		!round.stacks![move.to].length
	) {
		const index = round.stacks![move.from].at(-1)!;
		next = {
			...round,
			actions,
			stacks: round.stacks!.map((well, stack) =>
				stack === move.from ? well.slice(0, -1) : stack === move.to ? [index] : well
			)
		};
	}
	// Utilities leave enough room to begin and confirm an ordinary attempt.
	return next && !memoryCapReached(next)
		? { round: next, effect: 'continue' }
		: { round, effect: 'ignored' };
}

export function flipCard(round: MemoryRound, index: number): FlipResult {
	const matchSize = cardsPerMatch(round);
	if (round.status !== 'playing' || round.revealed.length >= matchSize || memoryCapReached(round)) {
		return { round, effect: 'ignored' };
	}

	const rules = memoryRoundRules(round);
	if (rules.topOnly) {
		if (!timeStrataCanSelect(round, index)) return { round, effect: 'ignored' };
		const revealed = [...round.revealed, index];
		if (revealed.length === 1)
			return { round: { ...round, revealed, actions: (round.actions ?? 0) + 1 }, effect: 'flip' };
		const pending = { ...round, revealed };
		const isMatch = timeStrataOutcome(pending) === 'match';
		return {
			round: {
				...pending,
				actions: (round.actions ?? 0) + 1,
				moves: round.moves + 1,
				mismatches: round.mismatches + (isMatch ? 0 : 1)
			},
			effect: isMatch ? 'match' : 'mismatch'
		};
	}
	const isBufferStash =
		rules.canStoreCard && round.revealed.length === 1 && round.revealed[0] === index;

	if (
		round.matched.includes(index) ||
		(round.revealed.includes(index) && !isBufferStash) ||
		index === round.lock
	) {
		return { round, effect: 'ignored' };
	}

	const cols = 4;
	const row = Math.floor(index / cols);

	if ((rules.blockedRowPeriod ?? 0) > 0 && row === round.stormFrostedRow) {
		return { round, effect: 'ignored' };
	}
	if (rules.unlockAdjacentCards && round.cards[index]?.isFirewall) {
		return { round, effect: 'ignored' };
	}
	if ((rules.quarantineAtTrace ?? 0) > 0 && round.quarantine?.includes(index)) {
		return { round, effect: 'ignored' };
	}
	if (
		rules.clearanceTiers &&
		(round.cards[index]?.clearanceTier ?? 1) > (round.clearanceTier ?? 1)
	) {
		return { round, effect: 'ignored' };
	}
	if (rules.unlockWithDewdrop && round.cards[index]?.isBriarLocked && !round.briarsCleared) {
		return { round, effect: 'ignored' };
	}
	if (rules.crossBedOnly && round.revealed.length === 1) {
		const firstIdx = round.revealed[0];
		const firstInMeadow = firstIdx < round.pairs;
		const secondInMeadow = index < round.pairs;
		if (firstInMeadow === secondInMeadow) {
			return { round, effect: 'ignored' };
		}
	}
	if (
		rules.differentRowsOnly &&
		round.lockedActorRow !== null &&
		round.lockedActorRow !== undefined &&
		row === round.lockedActorRow
	) {
		return { round, effect: 'ignored' };
	}
	if ((rules.flipSlots ?? 0) > 0 && round.waitingTokens !== undefined && round.waitingTokens <= 0) {
		return { round, effect: 'ignored' };
	}
	if (
		rules.samePartitionOnly &&
		round.revealed.length === 1 &&
		round.partitionFilter !== null &&
		round.partitionFilter !== undefined &&
		round.cards[index]?.partition !== round.partitionFilter
	) {
		return { round, effect: 'ignored' };
	}

	const card = round.cards[index];
	if (!card) {
		return { round, effect: 'ignored' };
	}

	if (card.isWilted) {
		card.isWilted = false;
	}
	if (rules.sharpenOnFlip) {
		card.blurLevel = 0;
	}

	let waitingTokens = round.waitingTokens;
	if ((rules.flipSlots ?? 0) > 0 && waitingTokens !== undefined) {
		waitingTokens = Math.max(0, waitingTokens - 1);
	}
	let renderScanCountdown = round.renderScanCountdown;
	let snapshotQuad = round.snapshotQuad;
	if ((rules.snapshotEveryFlips ?? 0) > 0) {
		renderScanCountdown = (renderScanCountdown ?? rules.snapshotEveryFlips!) - 1;
		if (renderScanCountdown <= 0) {
			renderScanCountdown = rules.snapshotEveryFlips!;
			snapshotQuad = [0, 1, cols, cols + 1];
		}
	}
	let cacheKnown = round.cacheKnown;
	if (rules.rememberViewedCards) {
		cacheKnown = cacheKnown ? [...cacheKnown, index] : [index];
	}

	let lifeSupport = round.lifeSupport;
	if (rules.spendFlipEnergy) {
		lifeSupport = Math.max(0, (round.lifeSupport ?? 100) - 3);
	}

	let sap = round.sap;
	if (rules.spendSap) {
		sap = Math.max(0, (round.sap ?? 100) - 3);
		if (sap <= 0) {
			return {
				round: {
					...round,
					sap: 0,
					moves: round.moves + 1,
					status: 'lost'
				},
				effect: 'ignored'
			};
		}
	}

	let aiTokens = round.aiTokens;
	if (rules.spendFlipTokens) {
		aiTokens = Math.max(0, (round.aiTokens ?? 120) - 4);
		if (aiTokens <= 0) {
			return {
				round: {
					...round,
					aiTokens: 0,
					moves: round.moves + 1,
					status: 'lost'
				},
				effect: 'ignored'
			};
		}
	}

	let illuminated: number[] | undefined;
	if (rules.revealNeighborCone) {
		const r = Math.floor(index / cols);
		const c = index % cols;
		illuminated = [index];
		if (r > 0) illuminated.push(index - cols);
		if (r < Math.floor(round.cards.length / cols) - 1) illuminated.push(index + cols);
		if (c > 0) illuminated.push(index - 1);
		if (c < cols - 1) illuminated.push(index + 1);
	}

	// Register buffer mechanics
	if (rules.canStoreCard) {
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
	if (rules.keepOneRevealOnMiss) {
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
	if (rules.revealTwin && card.isQuantum && round.revealed.length === 0) {
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
		let lockedActorRow = round.lockedActorRow;
		if (rules.differentRowsOnly) {
			lockedActorRow = row;
		}
		let myceliumPulse = round.myceliumPulse;
		if (rules.hintPartnerOnFlip) {
			const partnerIdx = round.cards.findIndex(
				(c, i) => i !== index && c.symbol === card.symbol && !round.matched.includes(i)
			);
			myceliumPulse = partnerIdx >= 0 ? partnerIdx : null;
		}
		let beeWaggleRow = round.beeWaggleRow;
		if (rules.hintPartnerRowOnFlip && index >= round.pairs) {
			const partnerIdx = round.cards.findIndex(
				(c, i) => i !== index && c.symbol === card.symbol && !round.matched.includes(i)
			);
			beeWaggleRow = partnerIdx >= 0 ? Math.floor(partnerIdx / cols) : null;
		}
		const briarsCleared = rules.unlockWithDewdrop && card.isDewdrop ? true : round.briarsCleared;
		let partitionFilter = round.partitionFilter;
		if (rules.samePartitionOnly) {
			partitionFilter = card.partition ?? 0;
		}
		let workflowStep = round.workflowStep;
		if (rules.retryFailedPairOnce) {
			workflowStep = 2;
		}
		return {
			round: {
				...base,
				revealed,
				...(lifeSupport !== undefined ? { lifeSupport } : {}),
				...(aiTokens !== undefined ? { aiTokens } : {}),
				...(sap !== undefined ? { sap } : {}),
				...(lockedActorRow !== undefined ? { lockedActorRow } : {}),
				...(myceliumPulse !== undefined ? { myceliumPulse } : {}),
				...(beeWaggleRow !== undefined ? { beeWaggleRow } : {}),
				...(briarsCleared !== undefined ? { briarsCleared } : {}),
				...(illuminated ? { illuminated } : {}),
				...(partitionFilter !== undefined ? { partitionFilter } : {}),
				...(workflowStep !== undefined ? { workflowStep } : {}),
				...(waitingTokens !== undefined ? { waitingTokens } : {}),
				...(renderScanCountdown !== undefined ? { renderScanCountdown } : {}),
				...(snapshotQuad ? { snapshotQuad } : {}),
				...(cacheKnown ? { cacheKnown } : {})
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
			: rules.oppositeShadesOnly
				? card.symbol === first.symbol && card.zebra !== first.zebra
				: rules.matchClusters
					? card.vectorCluster !== undefined && card.vectorCluster === first.vectorCluster
					: revealed.every((position) => round.cards[position]?.symbol === first.symbol);

	if (rules.orderedTiers && isMatch) {
		if (first.tier !== (round.glyphTier ?? 1)) {
			isMatch = false;
		}
	}

	if (rules.requireBothHandshakeStages && isMatch) {
		const stages = revealed.map((pos) => round.cards[pos].tlsStage);
		if (!stages.includes('syn') || !stages.includes('ack')) {
			isMatch = false;
		}
	}

	if (rules.differentRowsOnly && isMatch) {
		const rows = revealed.map((pos) => Math.floor(pos / cols));
		if (new Set(rows).size < revealed.length) {
			isMatch = false;
		}
	}

	if (isMatch) {
		const collapse = rules.removeMatchedCards;
		const matched = collapse ? [] : [...round.matched, ...revealed].sort((a, b) => a - b);
		let cards = collapse
			? round.cards.filter((_, position) => !revealed.includes(position))
			: round.cards;
		const won = collapse ? cards.length === 0 : matched.length === cards.length;
		const combo = rules.growMatchMultiplier ? (round.combo ?? 1) + 1 : round.combo;
		const glyphTier = rules.orderedTiers ? (round.glyphTier ?? 1) + 1 : round.glyphTier;
		const sentinelHeat =
			(rules.lockAtHeat ?? 0) > 0 ? Math.max(0, (round.sentinelHeat ?? 0) - 1) : round.sentinelHeat;
		const pulseStreak = rules.growSpeedMultiplier
			? Math.min(4, (round.pulseStreak ?? 1) + 1)
			: round.pulseStreak;

		if (rules.spendFlipEnergy) {
			lifeSupport = Math.min(100, (lifeSupport ?? 100) + 12);
		}

		if (rules.spendFlipTokens) {
			aiTokens = Math.min(140, (aiTokens ?? 120) + 12);
		}

		let clearanceTier = round.clearanceTier;
		if (rules.clearanceTiers) {
			const activeT = round.clearanceTier ?? 1;
			const allTierMatched = cards.every(
				(c, idx) => (c.clearanceTier ?? 1) !== activeT || matched.includes(idx)
			);
			if (allTierMatched && activeT < 3) {
				clearanceTier = (activeT + 1) as 1 | 2 | 3;
			}
		}

		const hyperdriveMultiplier = rules.growPoolMultiplier
			? Math.min(3, (round.hyperdriveMultiplier ?? 2) + 1)
			: round.hyperdriveMultiplier;

		if (rules.spendSap) {
			sap = Math.min(120, (sap ?? 100) + 12);
		}
		const graftMultiplier = rules.growGardenMultiplier
			? Math.min(3, (round.graftMultiplier ?? 1) + 1)
			: round.graftMultiplier;
		const briarsCleared =
			rules.unlockWithDewdrop && (card.isDewdrop || first.isDewdrop) ? true : round.briarsCleared;

		if (rules.swapEndpointsOnAnomaly && (card.isAnomaly || first.isAnomaly)) {
			cards = warpAnomalyCards({ ...round, cards, matched }).cards;
		}

		if (rules.unlockAdjacentCards) {
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
			(rules.quarantineAtTrace ?? 0) > 0
				? Math.max(0, (round.traceMeter ?? 0) - 10)
				: round.traceMeter;

		let burstPing: number[] | undefined;
		const burstStreak =
			(rules.revealAfterStreak ?? 0) > 0 ? (round.burstStreak ?? 0) + 1 : round.burstStreak;
		if ((rules.revealAfterStreak ?? 0) > 0 && (burstStreak ?? 0) >= rules.revealAfterStreak!) {
			burstPing = cards
				.map((_, i) => i)
				.filter((i) => !matched.includes(i))
				.slice(0, 3);
		}

		let sonar: number[] | undefined;
		if (rules.revealNeighborsOnMatch) {
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

		let streamBurst = round.streamBurst;
		let streamTarget = round.streamTarget;
		if (rules.cycleTargetOnMatch) {
			if (card.symbol === round.streamTarget) {
				streamBurst = true;
				const symIdx = SYMBOLS.findIndex((s) => s.id === round.streamTarget);
				streamTarget = SYMBOLS[(symIdx + 1) % SYMBOLS.length]?.id;
			}
		}
		if ((rules.flipSlots ?? 0) > 0) {
			waitingTokens = Math.min(rules.flipSlots!, (waitingTokens ?? 1) + 2);
		}
		const activeHeader = rules.swapAdjacentAfterMatch
			? 'X-Transform: Swap-Adjacent'
			: round.activeHeader;
		let agentCycles = round.agentCycles;
		let agentHint = round.agentHint;
		if ((rules.hintEveryMatches ?? 0) > 0) {
			agentCycles = (round.agentCycles ?? 0) + 1;
			if (agentCycles >= rules.hintEveryMatches!) {
				agentCycles = 0;
				const un = cards.findIndex((_, i) => !matched.includes(i));
				agentHint = un >= 0 ? un : null;
			}
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
				...(rules.lockLastMissedCard || (rules.lockAtHeat ?? 0) > 0 ? { lock: null } : {}),
				...(combo !== undefined ? { combo } : {}),
				...(sonar ? { sonar } : {}),
				...(glyphTier !== undefined ? { glyphTier } : {}),
				...(sentinelHeat !== undefined ? { sentinelHeat } : {}),
				...(pulseStreak !== undefined ? { pulseStreak } : {}),
				...(lifeSupport !== undefined ? { lifeSupport } : {}),
				...(aiTokens !== undefined ? { aiTokens } : {}),
				...(sap !== undefined ? { sap } : {}),
				...(graftMultiplier !== undefined ? { graftMultiplier } : {}),
				...(briarsCleared !== undefined ? { briarsCleared } : {}),
				...(clearanceTier !== undefined ? { clearanceTier } : {}),
				...(hyperdriveMultiplier !== undefined ? { hyperdriveMultiplier } : {}),
				...(rules.differentRowsOnly ? { lockedActorRow: null } : {}),
				...(traceMeter !== undefined ? { traceMeter } : {}),
				...(burstStreak !== undefined ? { burstStreak } : {}),
				...(burstPing ? { burstPing } : {}),
				...(streamBurst !== undefined ? { streamBurst } : {}),
				...(streamTarget !== undefined ? { streamTarget } : {}),
				...(activeHeader !== undefined ? { activeHeader } : {}),
				...(agentCycles !== undefined ? { agentCycles } : {}),
				...(agentHint !== undefined ? { agentHint } : {}),
				...(waitingTokens !== undefined ? { waitingTokens } : {}),
				...(rules.samePartitionOnly ? { partitionFilter: null } : {}),
				...(rules.retryFailedPairOnce ? { workflowStep: 1, workflowRetryUsed: false } : {})
			},
			effect: won ? 'win' : 'match'
		};
	}

	if (rules.retryFailedPairOnce && (round.workflowStep ?? 1) === 2 && !round.workflowRetryUsed) {
		return {
			round: {
				...base,
				revealed: [revealed[0]],
				workflowStep: 3,
				workflowRetryUsed: true,
				moves
			},
			effect: 'flip'
		};
	}

	const mismatched: MemoryRound = {
		...base,
		revealed,
		mismatches: round.mismatches + 1,
		moves,
		...(rules.growMatchMultiplier ? { combo: 1 } : {}),
		...(rules.growSpeedMultiplier ? { pulseStreak: 1 } : {}),
		...(rules.growPoolMultiplier ? { hyperdriveMultiplier: 1 } : {}),
		...(lifeSupport !== undefined ? { lifeSupport } : {}),
		...(illuminated ? { illuminated } : {}),
		...(waitingTokens !== undefined ? { waitingTokens } : {}),
		...(renderScanCountdown !== undefined ? { renderScanCountdown } : {}),
		...(snapshotQuad ? { snapshotQuad } : {}),
		...(cacheKnown ? { cacheKnown } : {})
	};

	if ((rules.missLives ?? 0) > 0) {
		const lives = (round.lives ?? rules.missLives!) - 1;
		mismatched.lives = lives;
		if (lives <= 0) mismatched.status = 'lost';
	}
	if (rules.spendFlipEnergy) {
		if (lifeSupport === 0) mismatched.status = 'lost';
	}

	if ((rules.lockAtHeat ?? 0) > 0) {
		const heat = Math.min(rules.lockAtHeat!, (round.sentinelHeat ?? 0) + 1);
		mismatched.sentinelHeat = heat;
		if (heat === rules.lockAtHeat) {
			mismatched.lock = revealed[matchSize - 1];
		}
	}

	if ((rules.blockedRowPeriod ?? 0) > 0 && (round.mismatches + 1) % rules.blockedRowPeriod! === 0) {
		mismatched.stormFrostedRow = row;
	} else if ((rules.blockedRowPeriod ?? 0) > 0) {
		mismatched.stormFrostedRow = -1;
	}

	if ((rules.cooldownEveryMisses ?? 0) > 0) {
		const penalty = (round.rateLimitPenalty ?? 0) + 1;
		mismatched.rateLimitPenalty = penalty;
		if ((round.mismatches + 1) % rules.cooldownEveryMisses! === 0) {
			mismatched.rateLimited = true;
		}
	}

	if ((rules.quarantineAtTrace ?? 0) > 0) {
		const trace = Math.min(rules.quarantineAtTrace!, (round.traceMeter ?? 0) + 15);
		mismatched.traceMeter = trace;
		if (trace === rules.quarantineAtTrace) {
			const unrevealed = round.cards
				.map((_, i) => i)
				.filter((i) => !round.matched.includes(i) && !revealed.includes(i));
			mismatched.quarantine = unrevealed.slice(0, 2);
		}
	}

	if ((rules.missGhostTurns ?? 0) > 0) {
		const cache: Record<number, { symbol: SymbolId; turns: number }> = {
			...(round.edgeCache ?? {})
		};
		for (const pos of revealed) {
			cache[pos] = { symbol: round.cards[pos].symbol, turns: rules.missGhostTurns! };
		}
		mismatched.edgeCache = cache;
	}

	if ((rules.revealAfterStreak ?? 0) > 0) {
		mismatched.burstStreak = 0;
		mismatched.burstPing = [];
	}

	if (rules.spendFlipTokens) {
		const tokens = Math.max(0, (aiTokens ?? 120) - 8);
		mismatched.aiTokens = tokens;
		if (tokens <= 0) {
			mismatched.aiTokens = 0;
			mismatched.status = 'lost';
		}
	}

	if (rules.queueMissedCards) {
		mismatched.dlqQueue = [...(round.dlqQueue ?? []), index];
	}

	if ((rules.challengeEveryMisses ?? 0) > 0) {
		if ((round.mismatches + 1) % rules.challengeEveryMisses! === 0) {
			mismatched.turnstileActive = true;
		}
	}

	if (rules.replicateSeenCards) {
		const replicas: Record<number, boolean> = { ...(round.kvReplicas ?? {}) };
		for (const pos of revealed) {
			replicas[pos] = true;
		}
		mismatched.kvReplicas = replicas;
	}

	if (rules.spendSap) {
		const nextSap = Math.max(0, (sap ?? 100) - 6);
		mismatched.sap = nextSap;
		if (nextSap <= 0) {
			mismatched.sap = 0;
			mismatched.status = 'lost';
		}
	}

	if (rules.growGardenMultiplier) {
		mismatched.graftMultiplier = 1;
	}

	// Lock the last card only while two other unmatched cards keep a legal attempt open.
	if (rules.lockLastMissedCard)
		mismatched.lock =
			round.cards.length - round.matched.length - 1 >= 2 ? revealed[matchSize - 1] : null;

	const isHazardMismatch = rules.hazardShuffle && (card.isHazard || first.isHazard);
	const isGravitinoMismatch =
		rules.shuffleColumnOnRiskMiss && (card.isGravitino || first.isGravitino);
	const isAtlasLoop =
		(rules.shuffleEveryFlips ?? 0) > 0 && (moves * 2) % rules.shuffleEveryFlips! === 0;

	let finalRound = mismatched;
	if (rules.shuffleOnMiss || isHazardMismatch || isAtlasLoop) {
		finalRound = moveFaceDownCards(finalRound);
	} else if (isGravitinoMismatch) {
		finalRound = scrambleColumn(finalRound, index % cols);
	} else if (
		(rules.perimeterShiftEveryMisses ?? 0) > 0 &&
		(round.mismatches + 1) % rules.perimeterShiftEveryMisses! === 0
	) {
		finalRound = shiftPerimeterClockwise(finalRound);
	} else if ((rules.transposeAfterMisses ?? 0) > 0) {
		const rot: Record<number, number> = { ...(round.bitRot ?? {}) };
		for (const pos of revealed) {
			rot[pos] = (rot[pos] ?? 0) + 1;
		}
		const cards = [...finalRound.cards];
		for (const [posStr, count] of Object.entries(rot)) {
			const pos = Number(posStr);
			if (count >= rules.transposeAfterMisses! && !round.matched.includes(pos)) {
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
	} else if ((rules.quadrantShiftAfterMisses ?? 0) > 0) {
		const q = (Math.floor(index / cols) < 2 ? 0 : 2) + (index % cols < 2 ? 0 : 1);
		const hits = { ...(round.quadrantHits ?? { 0: 0, 1: 0, 2: 0, 3: 0 }) };
		hits[q] = (hits[q] ?? 0) + 1;
		if (hits[q] >= rules.quadrantShiftAfterMisses!) {
			hits[q] = 0;
			finalRound = shiftQuadrantArgo(finalRound, q);
		}
		finalRound = { ...finalRound, quadrantHits: hits };
	} else if ((rules.freezeAfterUntouched ?? 0) > 0) {
		const untouched: Record<number, number> = { ...(round.glacierUntouched ?? {}) };
		finalRound.cards.forEach((_, i) => {
			if (!finalRound.matched.includes(i) && !revealed.includes(i)) {
				untouched[i] = (untouched[i] ?? 0) + 1;
			} else {
				untouched[i] = 0;
			}
		});
		const cards = finalRound.cards.map((c, i) => {
			if ((untouched[i] ?? 0) >= rules.freezeAfterUntouched!) {
				return { ...c, isGlaciated: true };
			}
			return c;
		});
		finalRound = { ...finalRound, cards, glacierUntouched: untouched };
	} else if (rules.movingSunbeam) {
		finalRound = {
			...finalRound,
			sunbeamRow: Math.floor(finalRound.moves / 2) % Math.ceil(finalRound.cards.length / cols)
		};
	} else if ((rules.dormancyAfterUntouched ?? 0) > 0) {
		const dormancy: Record<number, number> = { ...(round.bloomDormancy ?? {}) };
		finalRound.cards.forEach((_, i) => {
			if (!finalRound.matched.includes(i) && !revealed.includes(i)) {
				dormancy[i] = (dormancy[i] ?? 0) + 1;
			} else {
				dormancy[i] = 0;
			}
		});
		const cards = finalRound.cards.map((c, i) => {
			if ((dormancy[i] ?? 0) >= rules.dormancyAfterUntouched!) {
				return { ...c, isWilted: true };
			}
			return c;
		});
		finalRound = { ...finalRound, cards, bloomDormancy: dormancy };
	}

	return {
		round: finalRound,
		effect: 'mismatch'
	};
}

export function resolveMismatch(round: MemoryRound): MemoryRound {
	const rules = memoryRoundRules(round);
	// Time Strata outcomes can only be resolved by a replayed Continue action.
	if (rules.topOnly) return round;
	if (round.revealed.length !== cardsPerMatch(round)) {
		return round;
	}

	let hidden: MemoryRound = {
		...round,
		revealed: [],
		...(round.illuminated?.length ? { illuminated: [] } : {}),
		...(round.burstPing?.length ? { burstPing: [] } : {}),
		...(round.quarantine?.length ? { quarantine: [] } : {}),
		...(round.lockedActorRow !== undefined ? { lockedActorRow: null } : {}),
		...(round.turnstileActive !== undefined ? { turnstileActive: false } : {}),
		...(round.myceliumPulse !== undefined ? { myceliumPulse: null } : {}),
		...(round.beeWaggleRow !== undefined ? { beeWaggleRow: null } : {}),
		...(round.snapshotQuad ? { snapshotQuad: [] } : {}),
		...(round.partitionFilter !== undefined ? { partitionFilter: null } : {}),
		...(round.agentHint !== undefined ? { agentHint: null } : {}),
		...(round.workflowStep !== undefined ? { workflowStep: 1, workflowRetryUsed: false } : {}),
		...(round.activeHeader ? { activeHeader: null } : {})
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
	if (rules.swapTwoOnResolve) return swapHiddenCards(hidden);
	if (rules.driftFirstRowOnMiss) return driftRow(hidden, round.revealed[0]);
	if ((rules.seenCardTurns ?? 0) > 0) return updateDecay(hidden, round.revealed);
	return hidden;
}

/** Cards matched so far, including collapsed ones that left the board. */
export function matchedCount(round: MemoryRound): number {
	return round.matched.length + (round.cleared ?? 0);
}

export function isFaceUp(round: MemoryRound, index: number): boolean {
	return (
		round.matched.includes(index) ||
		round.revealed.includes(index) ||
		round.shelf?.index === index ||
		timeStrataClues(round).includes(index)
	);
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
	const rules = memoryRoundRules(round);
	return rules.matchSize === 3
		? triosScoring.defaults
		: rules.matchSize === 4
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
	const rules = memoryRoundRules(round);
	if (round.status !== 'won') {
		return 0;
	}
	if ((rules.timeLimitPerPair ?? 0) > 0 && elapsedSeconds > (round.timeLimit ?? 60)) {
		return 0;
	}

	return scoreFor(round.pairs, round.mismatches, elapsedSeconds, scoring);
}
