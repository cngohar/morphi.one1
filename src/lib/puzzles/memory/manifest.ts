import { messages } from './messages.js';
import { memoryDimensions, memoryArchetypes, memoryPolicyVariants } from './dimensions.js';
import type { PuzzleManifest, PuzzlePresentation } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import { scoring, triosScoring, quadsScoring } from './scoring.js';
import { memoryOpeningMs } from '#lib/round-timing.js';
import {
	PAIR_COUNTS,
	QUAD_COUNTS,
	cardsPerMatch,
	createMemoryRound,
	applyMemoryMove,
	MEMORY_TIME_STRATA_MAX_ACTIONS,
	MEMORY_STRATA_VARIANTS,
	isTimeStrata,
	type MemoryMove,
	flipCard,
	memoryMoveLimit,
	memoryVariant,
	parseMemoryVariant,
	resolveMismatch,
	scoreRound
} from './logic.js';

const pairHelp = {
	steps: ['v1.game.memory.step1', 'v1.game.memory.step2', 'v1.game.memory.step3'],
	rows: [
		{ label: 'v1.game.memory.row1', field: 'pair', sign: '+' },
		{ label: 'v1.game.memory.row2', field: 'mismatch', sign: '−' },
		{ label: 'v1.game.memory.row3', field: 'second', sign: '−' },
		{ label: 'v1.game.memory.row4', value: 'v1.game.memory.value4' }
	],
	note: 'v1.game.memory.scoringNote',
	tips: 'v1.game.memory.tips'
} satisfies PuzzlePresentation['help'];

/** Leaderboard groups for one variant suffix; every identity keeps its own cohorts. */
const groupIds = (suffix: string, counts: readonly number[]) =>
	counts.map((count) => `memory-1:${suffix}:${count}`);
const NEW_PAIR_SUFFIXES = [
	'budget',
	'lockout',
	'swaps',
	'two-backs',
	'collapse',
	'countdown',
	'three-strikes',
	'wild-card',
	'sonar',
	'zebra',
	'drift',
	'decay',
	'one-flip',
	'combo',
	'hazard',
	'superstorm',
	'sentinel-heat',
	'glyph-chain',
	'analysis-visor',
	'life-support',
	'hyperdrive-warp',
	'gravitino-risk',
	'pulse-drive',
	'derelict-fog',
	'atlas-terminal',
	'edge-cache',
	'quantum-entangle',
	'rate-limiter',
	'register-buffer',
	'firewall-ice',
	'anycast-route',
	'tls-handshake',
	'trace-route',
	'bit-rot',
	'burst-transmission',
	'kv-consistency',
	'durable-object',
	'vectorize-knn',
	'fifo-queue',
	'ai-tokens',
	'hyperdrive-pool',
	'turnstile-verify',
	'zero-trust',
	'argo-reroute',
	'r2-glacier',
	'cross-pollination',
	'mycelium-network',
	'photosynthesis',
	'seed-dispersal',
	'seasonal-bloom',
	'bee-waggle',
	'carnivorous-briar',
	'chlorophyll-meter',
	'bioluminescent',
	'botanical-graft',
	'workflows-step',
	'browser-rendering',
	'ai-gateway',
	'k2-streams',
	'basin-catalog',
	'edge-snippets',
	'images-transform',
	'waiting-room',
	'privacy-pass',
	'agents-sdk',
	'time-strata',
	'strata-linked',
	'strata-sweep',
	'strata-shelf',
	'strata-cycle',
	'strata-empty-well',
	'strata-glimpse',
	'strata-chain',
	'strata-echo',
	'strata-slip',
	'strata-order'
] as const;
const NEW_GROUPS = [
	...NEW_PAIR_SUFFIXES.flatMap((suffix) => groupIds(suffix, PAIR_COUNTS)),
	...groupIds('quads', QUAD_COUNTS)
];
const newGroupLabels = Object.fromEntries(
	NEW_GROUPS.map((group) => [
		group,
		`leaderboard.memory.${group.slice('memory-1:'.length).replace(/:(\d+)$/, '.$1')}`
	])
);
const pairVariant = (
	suffix: (typeof NEW_PAIR_SUFFIXES)[number],
	maxMoves: number,
	help: Partial<PuzzlePresentation['help']>
) => ({
	id: `memory:${suffix}`,
	name: `variant.memory:${suffix}`,
	weight: 1,
	maxMoves,
	leaderboardGroups: groupIds(suffix, PAIR_COUNTS),
	help: { ...pairHelp, ...help }
});

function parseMemoryMove(move: import('#lib/engine/contract.js').Move): MemoryMove {
	const keys = Object.keys(move);
	if (keys.length === 1 && keys[0] === 'index' && Number.isSafeInteger(move.index))
		return { index: move.index! };
	if (keys.length === 1 && keys[0] === 'cancel' && move.cancel === 1) return { cancel: 1 };
	if (keys.length === 1 && keys[0] === 'continue' && move.continue === 1) return { continue: 1 };
	for (const key of ['lift', 'cycle'] as const) {
		if (
			keys.length === 1 &&
			keys[0] === key &&
			Number.isSafeInteger(move[key]) &&
			move[key]! >= 0 &&
			move[key]! < 4
		)
			return key === 'lift' ? { lift: move.lift! } : { cycle: move.cycle! };
	}
	if (keys.length === 1 && keys[0] === 'return' && move.return === 1) return { return: 1 };
	if (
		keys.length === 2 &&
		keys.includes('from') &&
		keys.includes('to') &&
		Number.isSafeInteger(move.from) &&
		Number.isSafeInteger(move.to) &&
		move.from! >= 0 &&
		move.from! < 4 &&
		move.to! >= 0 &&
		move.to! < 4
	)
		return { from: move.from!, to: move.to! };
	throw new RangeError('move');
}

function resumeTimeStrata(
	seed: string,
	moves: readonly import('#lib/engine/contract.js').Move[],
	variant: string
) {
	let round = createMemoryRound(seed, variant);
	if (moves.length > memoryMoveLimit(round)) throw new RangeError('move_limit');
	for (const move of moves) {
		const result = applyMemoryMove(round, parseMemoryMove(move));
		if (result.effect === 'ignored') throw new RangeError('move');
		round = result.round;
	}
	return round;
}

export const manifest = {
	id: 'memory',
	dimensionPolicy: {
		dimensions: memoryDimensions,
		archetypes: memoryArchetypes,
		variants: memoryPolicyVariants
	},
	presentation: {
		name: 'v1.game.memory',
		scoringLabels: {
			pair: 'scoring.memory.pair',
			trio: 'scoring.memory.trio',
			quad: 'scoring.memory.quad',
			mismatch: 'scoring.memory.mismatch',
			second: 'scoring.memory.second'
		},
		groups: {
			'memory-1:6': 'leaderboard.memory6',
			'memory-1:8': 'leaderboard.memory8',
			'memory-1:10': 'leaderboard.memory10',
			'memory-1:no-preview:6': 'leaderboard.memory.no-preview.6',
			'memory-1:no-preview:8': 'leaderboard.memory.no-preview.8',
			'memory-1:no-preview:10': 'leaderboard.memory.no-preview.10',
			'memory-1:trios:6': 'leaderboard.memory.trios.6',
			'memory-1:trios:8': 'leaderboard.memory.trios.8',
			'memory-1:trios:10': 'leaderboard.memory.trios.10',
			'memory-1:moving:6': 'leaderboard.memory.moving.6',
			'memory-1:moving:8': 'leaderboard.memory.moving.8',
			'memory-1:moving:10': 'leaderboard.memory.moving.10',
			...newGroupLabels
		},
		help: pairHelp,
		backdrop: {
			items: [
				{ id: 'card', path: 'M17 5H43Q48 5 48 10V50Q48 55 43 55H17Q12 55 12 50V10Q12 5 17 5Z' }
			],
			fill: 'solid',
			symbol: true
		},
		profileIcon: { color: 'var(--accent)', rotation: 8 }
	},
	selectionOrder: 1,
	orientation: 'any',
	engineVersion: 'memory-1',
	scoring,
	variants: [
		{
			id: 'memory:classic',
			name: 'variant.memory:classic',
			weight: 1,
			maxMoves: 120,
			leaderboardGroups: ['memory-1:6', 'memory-1:8', 'memory-1:10']
		},
		{
			id: 'memory:no-preview',
			name: 'variant.memory:no-preview',
			weight: 1,
			maxMoves: 120,
			leaderboardGroups: [
				'memory-1:no-preview:6',
				'memory-1:no-preview:8',
				'memory-1:no-preview:10'
			],
			help: {
				...pairHelp,
				steps: ['v1.game.memory.step1', 'v1.game.memory.step2', 'memory.noPreview.step3'],
				note: 'memory.noPreview.scoringNote',
				tips: 'memory.noPreview.tips'
			}
		},
		{
			id: 'memory:trios',
			name: 'variant.memory:trios',
			weight: 1,
			maxMoves: 180,
			leaderboardGroups: ['memory-1:trios:6', 'memory-1:trios:8', 'memory-1:trios:10'],
			scoring: triosScoring,
			help: {
				steps: ['memory.trios.step1', 'memory.trios.step2', 'memory.trios.step3'],
				rows: [
					{ label: 'memory.trios.row1', field: 'trio', sign: '+' },
					{ label: 'v1.game.memory.row2', field: 'mismatch', sign: '−' },
					{ label: 'v1.game.memory.row3', field: 'second', sign: '−' },
					{ label: 'v1.game.memory.row4', value: 'v1.game.memory.value4' }
				],
				note: 'v1.game.memory.scoringNote',
				tips: 'memory.trios.tips'
			},
			ending: {
				kind: 'completion',
				headlines: { default: 'ending.memory.trios.headline' },
				subline: { key: 'ending.memory.trios.subline', values: ['pairs', 'time'] },
				animation: 'fade-rise',
				continue: 'auto_500ms',
				condition: 'All trios have been matched.'
			}
		},
		{
			id: 'memory:moving',
			name: 'variant.memory:moving',
			weight: 1,
			maxMoves: 120,
			leaderboardGroups: ['memory-1:moving:6', 'memory-1:moving:8', 'memory-1:moving:10'],
			help: {
				...pairHelp,
				steps: ['v1.game.memory.step1', 'memory.moving.step2', 'v1.game.memory.step3'],
				tips: 'memory.moving.tips'
			}
		},
		pairVariant('budget', 40, {
			steps: ['v1.game.memory.step1', 'memory.budget.step2', 'memory.budget.step3'],
			tips: 'memory.budget.tips'
		}),
		pairVariant('lockout', 120, {
			steps: ['v1.game.memory.step1', 'memory.lockout.step2', 'v1.game.memory.step3'],
			tips: 'memory.lockout.tips'
		}),
		pairVariant('swaps', 120, {
			steps: ['v1.game.memory.step1', 'memory.swaps.step2', 'v1.game.memory.step3'],
			tips: 'memory.swaps.tips'
		}),
		pairVariant('two-backs', 120, {
			steps: ['v1.game.memory.step1', 'memory.twoBacks.step2', 'v1.game.memory.step3'],
			tips: 'memory.twoBacks.tips'
		}),
		{
			id: 'memory:quads',
			name: 'variant.memory:quads',
			weight: 1,
			maxMoves: 144,
			leaderboardGroups: groupIds('quads', QUAD_COUNTS),
			scoring: quadsScoring,
			help: {
				steps: ['memory.quads.step1', 'memory.quads.step2', 'memory.quads.step3'],
				rows: [
					{ label: 'memory.quads.row1', field: 'quad', sign: '+' },
					{ label: 'v1.game.memory.row2', field: 'mismatch', sign: '−' },
					{ label: 'v1.game.memory.row3', field: 'second', sign: '−' },
					{ label: 'v1.game.memory.row4', value: 'v1.game.memory.value4' }
				],
				note: 'v1.game.memory.scoringNote',
				tips: 'memory.quads.tips'
			},
			ending: {
				kind: 'completion',
				headlines: { default: 'ending.memory.quads.headline' },
				subline: { key: 'ending.memory.quads.subline', values: ['pairs', 'time'] },
				animation: 'fade-rise',
				continue: 'auto_500ms',
				condition: 'All quads have been matched.'
			}
		},
		pairVariant('collapse', 120, {
			steps: ['v1.game.memory.step1', 'memory.collapse.step2', 'v1.game.memory.step3'],
			tips: 'memory.collapse.tips'
		}),
		pairVariant('countdown', 120, {
			steps: ['v1.game.memory.step1', 'memory.countdown.step2', 'v1.game.memory.step3'],
			tips: 'memory.countdown.tips'
		}),
		pairVariant('three-strikes', 120, {
			steps: ['v1.game.memory.step1', 'memory.threeStrikes.step2', 'v1.game.memory.step3'],
			tips: 'memory.threeStrikes.tips'
		}),
		pairVariant('wild-card', 120, {
			steps: ['v1.game.memory.step1', 'memory.wildCard.step2', 'v1.game.memory.step3'],
			tips: 'memory.wildCard.tips'
		}),
		pairVariant('sonar', 120, {
			steps: ['v1.game.memory.step1', 'memory.sonar.step2', 'v1.game.memory.step3'],
			tips: 'memory.sonar.tips'
		}),
		pairVariant('zebra', 120, {
			steps: ['v1.game.memory.step1', 'memory.zebra.step2', 'v1.game.memory.step3'],
			tips: 'memory.zebra.tips'
		}),
		pairVariant('drift', 120, {
			steps: ['v1.game.memory.step1', 'memory.drift.step2', 'v1.game.memory.step3'],
			tips: 'memory.drift.tips'
		}),
		pairVariant('decay', 120, {
			steps: ['v1.game.memory.step1', 'memory.decay.step2', 'v1.game.memory.step3'],
			tips: 'memory.decay.tips'
		}),
		pairVariant('one-flip', 120, {
			steps: ['v1.game.memory.step1', 'memory.oneFlip.step2', 'v1.game.memory.step3'],
			tips: 'memory.oneFlip.tips'
		}),
		pairVariant('combo', 120, {
			steps: ['v1.game.memory.step1', 'memory.combo.step2', 'v1.game.memory.step3'],
			tips: 'memory.combo.tips'
		}),
		pairVariant('hazard', 120, {
			steps: ['v1.game.memory.step1', 'memory.hazard.step2', 'v1.game.memory.step3'],
			tips: 'memory.hazard.tips'
		}),
		pairVariant('superstorm', 120, {
			steps: ['v1.game.memory.step1', 'memory.superstorm.step2', 'v1.game.memory.step3'],
			tips: 'memory.superstorm.tips'
		}),
		pairVariant('sentinel-heat', 120, {
			steps: ['v1.game.memory.step1', 'memory.sentinelHeat.step2', 'v1.game.memory.step3'],
			tips: 'memory.sentinelHeat.tips'
		}),
		pairVariant('glyph-chain', 120, {
			steps: ['v1.game.memory.step1', 'memory.glyphChain.step2', 'v1.game.memory.step3'],
			tips: 'memory.glyphChain.tips'
		}),
		pairVariant('analysis-visor', 120, {
			steps: ['v1.game.memory.step1', 'memory.analysisVisor.step2', 'v1.game.memory.step3'],
			tips: 'memory.analysisVisor.tips'
		}),
		pairVariant('life-support', 120, {
			steps: ['v1.game.memory.step1', 'memory.lifeSupport.step2', 'v1.game.memory.step3'],
			tips: 'memory.lifeSupport.tips'
		}),
		pairVariant('hyperdrive-warp', 120, {
			steps: ['v1.game.memory.step1', 'memory.hyperdriveWarp.step2', 'v1.game.memory.step3'],
			tips: 'memory.hyperdriveWarp.tips'
		}),
		pairVariant('gravitino-risk', 120, {
			steps: ['v1.game.memory.step1', 'memory.gravitinoRisk.step2', 'v1.game.memory.step3'],
			tips: 'memory.gravitinoRisk.tips'
		}),
		pairVariant('pulse-drive', 120, {
			steps: ['v1.game.memory.step1', 'memory.pulseDrive.step2', 'v1.game.memory.step3'],
			tips: 'memory.pulseDrive.tips'
		}),
		pairVariant('derelict-fog', 120, {
			steps: ['v1.game.memory.step1', 'memory.derelictFog.step2', 'v1.game.memory.step3'],
			tips: 'memory.derelictFog.tips'
		}),
		pairVariant('atlas-terminal', 120, {
			steps: ['v1.game.memory.step1', 'memory.atlasTerminal.step2', 'v1.game.memory.step3'],
			tips: 'memory.atlasTerminal.tips'
		}),
		pairVariant('edge-cache', 120, {
			steps: ['v1.game.memory.step1', 'memory.edgeCache.step2', 'v1.game.memory.step3'],
			tips: 'memory.edgeCache.tips'
		}),
		pairVariant('quantum-entangle', 120, {
			steps: ['v1.game.memory.step1', 'memory.quantumEntangle.step2', 'v1.game.memory.step3'],
			tips: 'memory.quantumEntangle.tips'
		}),
		pairVariant('rate-limiter', 120, {
			steps: ['v1.game.memory.step1', 'memory.rateLimiter.step2', 'v1.game.memory.step3'],
			tips: 'memory.rateLimiter.tips'
		}),
		pairVariant('register-buffer', 120, {
			steps: ['v1.game.memory.step1', 'memory.registerBuffer.step2', 'v1.game.memory.step3'],
			tips: 'memory.registerBuffer.tips'
		}),
		pairVariant('firewall-ice', 120, {
			steps: ['v1.game.memory.step1', 'memory.firewallIce.step2', 'v1.game.memory.step3'],
			tips: 'memory.firewallIce.tips'
		}),
		pairVariant('anycast-route', 120, {
			steps: ['v1.game.memory.step1', 'memory.anycastRoute.step2', 'v1.game.memory.step3'],
			tips: 'memory.anycastRoute.tips'
		}),
		pairVariant('tls-handshake', 120, {
			steps: ['v1.game.memory.step1', 'memory.tlsHandshake.step2', 'v1.game.memory.step3'],
			tips: 'memory.tlsHandshake.tips'
		}),
		pairVariant('trace-route', 120, {
			steps: ['v1.game.memory.step1', 'memory.traceRoute.step2', 'v1.game.memory.step3'],
			tips: 'memory.traceRoute.tips'
		}),
		pairVariant('bit-rot', 120, {
			steps: ['v1.game.memory.step1', 'memory.bitRot.step2', 'v1.game.memory.step3'],
			tips: 'memory.bitRot.tips'
		}),
		pairVariant('burst-transmission', 120, {
			steps: ['v1.game.memory.step1', 'memory.burstTransmission.step2', 'v1.game.memory.step3'],
			tips: 'memory.burstTransmission.tips'
		}),
		pairVariant('kv-consistency', 120, {
			steps: ['v1.game.memory.step1', 'memory.kvConsistency.step2', 'v1.game.memory.step3'],
			tips: 'memory.kvConsistency.tips'
		}),
		pairVariant('durable-object', 120, {
			steps: ['v1.game.memory.step1', 'memory.durableObject.step2', 'v1.game.memory.step3'],
			tips: 'memory.durableObject.tips'
		}),
		pairVariant('vectorize-knn', 120, {
			steps: ['v1.game.memory.step1', 'memory.vectorizeKnn.step2', 'v1.game.memory.step3'],
			tips: 'memory.vectorizeKnn.tips'
		}),
		pairVariant('fifo-queue', 120, {
			steps: ['v1.game.memory.step1', 'memory.fifoQueue.step2', 'v1.game.memory.step3'],
			tips: 'memory.fifoQueue.tips'
		}),
		pairVariant('ai-tokens', 120, {
			steps: ['v1.game.memory.step1', 'memory.aiTokens.step2', 'v1.game.memory.step3'],
			tips: 'memory.aiTokens.tips'
		}),
		pairVariant('hyperdrive-pool', 120, {
			steps: ['v1.game.memory.step1', 'memory.hyperdrivePool.step2', 'v1.game.memory.step3'],
			tips: 'memory.hyperdrivePool.tips'
		}),
		pairVariant('turnstile-verify', 120, {
			steps: ['v1.game.memory.step1', 'memory.turnstileVerify.step2', 'v1.game.memory.step3'],
			tips: 'memory.turnstileVerify.tips'
		}),
		pairVariant('zero-trust', 120, {
			steps: ['v1.game.memory.step1', 'memory.zeroTrust.step2', 'v1.game.memory.step3'],
			tips: 'memory.zeroTrust.tips'
		}),
		pairVariant('argo-reroute', 120, {
			steps: ['v1.game.memory.step1', 'memory.argoReroute.step2', 'v1.game.memory.step3'],
			tips: 'memory.argoReroute.tips'
		}),
		pairVariant('r2-glacier', 120, {
			steps: ['v1.game.memory.step1', 'memory.r2Glacier.step2', 'v1.game.memory.step3'],
			tips: 'memory.r2Glacier.tips'
		}),
		pairVariant('cross-pollination', 120, {
			steps: ['v1.game.memory.step1', 'memory.crossPollination.step2', 'v1.game.memory.step3'],
			tips: 'memory.crossPollination.tips'
		}),
		pairVariant('mycelium-network', 120, {
			steps: ['v1.game.memory.step1', 'memory.myceliumNetwork.step2', 'v1.game.memory.step3'],
			tips: 'memory.myceliumNetwork.tips'
		}),
		pairVariant('photosynthesis', 120, {
			steps: ['v1.game.memory.step1', 'memory.photosynthesis.step2', 'v1.game.memory.step3'],
			tips: 'memory.photosynthesis.tips'
		}),
		pairVariant('seed-dispersal', 120, {
			steps: ['v1.game.memory.step1', 'memory.seedDispersal.step2', 'v1.game.memory.step3'],
			tips: 'memory.seedDispersal.tips'
		}),
		pairVariant('seasonal-bloom', 120, {
			steps: ['v1.game.memory.step1', 'memory.seasonalBloom.step2', 'v1.game.memory.step3'],
			tips: 'memory.seasonalBloom.tips'
		}),
		pairVariant('bee-waggle', 120, {
			steps: ['v1.game.memory.step1', 'memory.beeWaggle.step2', 'v1.game.memory.step3'],
			tips: 'memory.beeWaggle.tips'
		}),
		pairVariant('carnivorous-briar', 120, {
			steps: ['v1.game.memory.step1', 'memory.carnivorousBriar.step2', 'v1.game.memory.step3'],
			tips: 'memory.carnivorousBriar.tips'
		}),
		pairVariant('chlorophyll-meter', 120, {
			steps: ['v1.game.memory.step1', 'memory.chlorophyllMeter.step2', 'v1.game.memory.step3'],
			tips: 'memory.chlorophyllMeter.tips'
		}),
		pairVariant('bioluminescent', 120, {
			steps: ['v1.game.memory.step1', 'memory.bioluminescent.step2', 'v1.game.memory.step3'],
			tips: 'memory.bioluminescent.tips'
		}),
		pairVariant('botanical-graft', 120, {
			steps: ['v1.game.memory.step1', 'memory.botanicalGraft.step2', 'v1.game.memory.step3'],
			tips: 'memory.botanicalGraft.tips'
		}),
		pairVariant('workflows-step', 120, {
			steps: ['v1.game.memory.step1', 'memory.workflowsStep.step2', 'v1.game.memory.step3'],
			tips: 'memory.workflowsStep.tips'
		}),
		pairVariant('browser-rendering', 120, {
			steps: ['v1.game.memory.step1', 'memory.browserRendering.step2', 'v1.game.memory.step3'],
			tips: 'memory.browserRendering.tips'
		}),
		pairVariant('ai-gateway', 120, {
			steps: ['v1.game.memory.step1', 'memory.aiGateway.step2', 'v1.game.memory.step3'],
			tips: 'memory.aiGateway.tips'
		}),
		pairVariant('k2-streams', 120, {
			steps: ['v1.game.memory.step1', 'memory.k2Streams.step2', 'v1.game.memory.step3'],
			tips: 'memory.k2Streams.tips'
		}),
		pairVariant('basin-catalog', 120, {
			steps: ['v1.game.memory.step1', 'memory.basinCatalog.step2', 'v1.game.memory.step3'],
			tips: 'memory.basinCatalog.tips'
		}),
		pairVariant('edge-snippets', 120, {
			steps: ['v1.game.memory.step1', 'memory.edgeSnippets.step2', 'v1.game.memory.step3'],
			tips: 'memory.edgeSnippets.tips'
		}),
		pairVariant('images-transform', 120, {
			steps: ['v1.game.memory.step1', 'memory.imagesTransform.step2', 'v1.game.memory.step3'],
			tips: 'memory.imagesTransform.tips'
		}),
		pairVariant('waiting-room', 120, {
			steps: ['v1.game.memory.step1', 'memory.waitingRoom.step2', 'v1.game.memory.step3'],
			tips: 'memory.waitingRoom.tips'
		}),
		pairVariant('privacy-pass', 120, {
			steps: ['v1.game.memory.step1', 'memory.privacyPass.step2', 'v1.game.memory.step3'],
			tips: 'memory.privacyPass.tips'
		}),
		pairVariant('agents-sdk', 120, {
			steps: ['v1.game.memory.step1', 'memory.agentsSdk.step2', 'v1.game.memory.step3'],
			tips: 'memory.agentsSdk.tips'
		}),
		{
			...pairVariant('time-strata', MEMORY_TIME_STRATA_MAX_ACTIONS, {
				steps: ['memory.timeStrata.step1', 'memory.timeStrata.step2', 'memory.timeStrata.step3'],
				note: 'memory.noPreview.scoringNote',
				tips: 'memory.timeStrata.tips'
			}),
			ending: {
				kind: 'completion',
				headlines: { default: 'memory.timeStrata.won' },
				subline: { key: 'ending.memory.subline', values: ['pairs', 'time'] },
				animation: 'fade-rise',
				continue: 'auto_500ms',
				condition: 'Every stack is empty after confirming the final matching tops.'
			}
		},
		...MEMORY_STRATA_VARIANTS.map((variant) => {
			const suffix = variant.slice('memory:'.length) as (typeof NEW_PAIR_SUFFIXES)[number];
			const prefix =
				'memory.' + suffix.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
			return {
				...pairVariant(suffix, MEMORY_TIME_STRATA_MAX_ACTIONS, {
					steps: [`${prefix}.step1`, `${prefix}.step2`, `${prefix}.step3`],
					note: 'memory.noPreview.scoringNote',
					tips: `${prefix}.tips`
				}),
				ending: {
					kind: 'completion' as const,
					headlines: { default: 'memory.timeStrata.won' },
					subline: { key: 'ending.memory.subline', values: ['pairs', 'time'] },
					animation: 'fade-rise' as const,
					continue: 'auto_500ms' as const,
					condition:
						'Every stack and sample shelf is empty after confirming the final matching pair.'
				}
			};
		})
	],
	maxMoves: MEMORY_TIME_STRATA_MAX_ACTIONS,
	parseMove: parseMemoryMove,
	leaderboardGroups: [
		'memory-1:6',
		'memory-1:8',
		'memory-1:10',
		'memory-1:no-preview:6',
		'memory-1:no-preview:8',
		'memory-1:no-preview:10',
		'memory-1:trios:6',
		'memory-1:trios:8',
		'memory-1:trios:10',
		'memory-1:moving:6',
		'memory-1:moving:8',
		'memory-1:moving:10',
		...NEW_GROUPS
	],
	rankedTiming: {
		openingMs: (result, variant?: string) =>
			parseMemoryVariant(variant) === 'memory:no-preview' || isTimeStrata(variant)
				? 0
				: memoryOpeningMs(result.pairs!),
		minimumSeconds: (result, variant?: string) =>
			result.pairs! *
			(({ 'memory:trios': 0.6, 'memory:quads': 0.8 } as Record<string, number>)[
				parseMemoryVariant(variant)
			] ?? 0.4)
	},
	messages,
	createRound: createMemoryRound,
	resumeRound(seed, moves, _scoring?: ScoreValues, variant?: string) {
		if (isTimeStrata(parseMemoryVariant(variant))) return resumeTimeStrata(seed, moves, variant!);
		let round = createMemoryRound(seed, variant);
		if (moves.length > memoryMoveLimit(round)) throw new RangeError('move_limit');
		for (const move of moves) {
			if (round.revealed.length === cardsPerMatch(round)) round = resolveMismatch(round);
			if (Object.keys(move).join(',') !== 'index' || !Number.isInteger(move.index))
				throw new RangeError('move');
			const next = flipCard(round, move.index!);
			if (next.effect === 'ignored') throw new RangeError('move');
			round = next.round;
		}
		return round;
	},
	ending: {
		kind: 'completion',
		headlines: { default: 'ending.memory.headline' },
		subline: { key: 'ending.memory.subline', values: ['pairs', 'time'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition: 'All pairs have been matched.'
	},
	replay(seed, moves, seconds, scoring?: ScoreValues, variant?: string) {
		let round = createMemoryRound(seed, variant);
		if (moves.length > memoryMoveLimit(round)) throw new RangeError('move_limit');
		if (isTimeStrata(memoryVariant(round))) round = resumeTimeStrata(seed, moves, variant!);
		else
			for (const move of moves) {
				if (Object.keys(move).length !== 1 || !Number.isInteger(move.index))
					throw new RangeError('move');
				const result = flipCard(round, move.index!);
				if (result.effect === 'ignored') throw new RangeError('move');
				round = result.effect === 'mismatch' ? resolveMismatch(result.round) : result.round;
			}
		if (round.status !== 'won') throw new RangeError('incomplete');
		return {
			score: scoreRound(round, seconds, scoring),
			group:
				memoryVariant(round) === 'memory:classic'
					? `memory-1:${round.pairs}`
					: `memory-1:${memoryVariant(round).slice('memory:'.length)}:${round.pairs}`,
			pairs: round.pairs,
			moves: round.moves
		};
	}
} satisfies PuzzleManifest;
