// Family-owned supported values: operator policy may narrow these, never create new rules.
export const memoryDimensions = [
	{
		key: 'matchSize',
		label: 'policy.matchSize',
		values: [
			{ id: '2', label: 'policy.pairs' },
			{ id: '3', label: 'policy.trios' },
			{ id: '4', label: 'policy.quads' }
		]
	},
	{
		key: 'opening',
		label: 'policy.opening',
		values: [
			{ id: 'preview', label: 'policy.preview' },
			{ id: 'no-preview', label: 'policy.noPreview' },
			{ id: 'derelict-fog', label: 'policy.derelictFog' },
			{ id: 'photosynthesis', label: 'policy.photosynthesis' },
			{ id: 'browser-rendering', label: 'policy.browserRendering' }
		]
	},
	{
		key: 'movement',
		label: 'policy.movement',
		values: [
			{ id: 'static', label: 'policy.static' },
			{ id: 'moving', label: 'policy.moving' },
			{ id: 'swaps', label: 'policy.swaps' },
			{ id: 'collapse', label: 'policy.collapse' },
			{ id: 'drift', label: 'policy.drift' },
			{ id: 'decay', label: 'policy.decay' },
			{ id: 'hyperdrive-warp', label: 'policy.hyperdriveWarp' },
			{ id: 'atlas-terminal', label: 'policy.atlasTerminal' },
			{ id: 'anycast-route', label: 'policy.anycastRoute' },
			{ id: 'bit-rot', label: 'policy.bitRot' },
			{ id: 'argo-reroute', label: 'policy.argoReroute' },
			{ id: 'seed-dispersal', label: 'policy.seedDispersal' },
			{ id: 'k2-streams', label: 'policy.k2Streams' },
			{ id: 'strata-shelf', label: 'policy.strataShelf' },
			{ id: 'strata-cycle', label: 'policy.strataCycle' },
			{ id: 'strata-empty-well', label: 'policy.strataEmptyWell' },
			{ id: 'strata-slip', label: 'policy.strataSlip' }
		]
	},
	{
		key: 'backs',
		label: 'policy.backs',
		values: [
			{ id: 'uniform', label: 'policy.uniform' },
			{ id: 'two-backs', label: 'policy.twoBacks' },
			{ id: 'zebra', label: 'policy.zebra' },
			{ id: 'analysis-visor', label: 'policy.analysisVisor' },
			{ id: 'edge-cache', label: 'policy.edgeCache' },
			{ id: 'r2-glacier', label: 'policy.r2Glacier' },
			{ id: 'kv-consistency', label: 'policy.kvConsistency' },
			{ id: 'seasonal-bloom', label: 'policy.seasonalBloom' },
			{ id: 'bioluminescent', label: 'policy.bioluminescent' },
			{ id: 'images-transform', label: 'policy.imagesTransform' },
			{ id: 'strata-glimpse', label: 'policy.strataGlimpse' },
			{ id: 'strata-echo', label: 'policy.strataEcho' }
		]
	},
	{
		key: 'budget',
		label: 'policy.budget',
		values: [
			{ id: 'standard', label: 'policy.standard' },
			{ id: 'strict', label: 'policy.strict' },
			{ id: 'countdown', label: 'policy.countdown' },
			{ id: 'three-strikes', label: 'policy.threeStrikes' },
			{ id: 'life-support', label: 'policy.lifeSupport' },
			{ id: 'sentinel-heat', label: 'policy.sentinelHeat' },
			{ id: 'pulse-drive', label: 'policy.pulseDrive' },
			{ id: 'rate-limiter', label: 'policy.rateLimiter' },
			{ id: 'trace-route', label: 'policy.traceRoute' },
			{ id: 'ai-tokens', label: 'policy.aiTokens' },
			{ id: 'hyperdrive-pool', label: 'policy.hyperdrivePool' },
			{ id: 'turnstile-verify', label: 'policy.turnstileVerify' },
			{ id: 'chlorophyll-meter', label: 'policy.chlorophyllMeter' },
			{ id: 'botanical-graft', label: 'policy.botanicalGraft' },
			{ id: 'ai-gateway', label: 'policy.aiGateway' },
			{ id: 'waiting-room', label: 'policy.waitingRoom' },
			{ id: 'privacy-pass', label: 'policy.privacyPass' }
		]
	},
	{
		key: 'availability',
		label: 'policy.availability',
		values: [
			{ id: 'standard', label: 'policy.standard' },
			{ id: 'lockout', label: 'policy.lockout' },
			{ id: 'top-only', label: 'policy.topOnly' },
			{ id: 'wild', label: 'policy.wild' },
			{ id: 'sonar', label: 'policy.sonar' },
			{ id: 'one-flip', label: 'policy.oneFlip' },
			{ id: 'combo', label: 'policy.combo' },
			{ id: 'hazard', label: 'policy.hazard' },
			{ id: 'superstorm', label: 'policy.superstorm' },
			{ id: 'glyph-chain', label: 'policy.glyphChain' },
			{ id: 'gravitino-risk', label: 'policy.gravitinoRisk' },
			{ id: 'quantum-entangle', label: 'policy.quantumEntangle' },
			{ id: 'register-buffer', label: 'policy.registerBuffer' },
			{ id: 'firewall-ice', label: 'policy.firewallIce' },
			{ id: 'tls-handshake', label: 'policy.tlsHandshake' },
			{ id: 'burst-transmission', label: 'policy.burstTransmission' },
			{ id: 'durable-object', label: 'policy.durableObject' },
			{ id: 'vectorize-knn', label: 'policy.vectorizeKnn' },
			{ id: 'fifo-queue', label: 'policy.fifoQueue' },
			{ id: 'zero-trust', label: 'policy.zeroTrust' },
			{ id: 'cross-pollination', label: 'policy.crossPollination' },
			{ id: 'mycelium-network', label: 'policy.myceliumNetwork' },
			{ id: 'bee-waggle', label: 'policy.beeWaggle' },
			{ id: 'carnivorous-briar', label: 'policy.carnivorousBriar' },
			{ id: 'workflows-step', label: 'policy.workflowsStep' },
			{ id: 'basin-catalog', label: 'policy.basinCatalog' },
			{ id: 'edge-snippets', label: 'policy.edgeSnippets' },
			{ id: 'agents-sdk', label: 'policy.agentsSdk' },
			{ id: 'strata-linked', label: 'policy.strataLinked' },
			{ id: 'strata-sweep', label: 'policy.strataSweep' },
			{ id: 'strata-chain', label: 'policy.strataChain' },
			{ id: 'strata-order', label: 'policy.strataOrder' }
		]
	}
] as const;

export const memoryArchetypes = [
	{ id: 'core', label: 'policy.core' },
	{ id: 'information', label: 'policy.information' },
	{ id: 'grouping', label: 'policy.grouping' },
	{ id: 'dynamics', label: 'policy.dynamics' },
	{ id: 'pressure', label: 'policy.pressure' },
	{ id: 'constraints', label: 'policy.constraints' }
] as const;

export const memoryPolicyVariants = [
	{ id: 'memory:classic', archetype: 'core' },
	{ id: 'memory:no-preview', archetype: 'information', change: ['opening', 'no-preview'] },
	{ id: 'memory:trios', archetype: 'grouping', change: ['matchSize', '3'] },
	{ id: 'memory:moving', archetype: 'dynamics', change: ['movement', 'moving'] },
	{ id: 'memory:budget', archetype: 'pressure', change: ['budget', 'strict'] },
	{ id: 'memory:lockout', archetype: 'constraints', change: ['availability', 'lockout'] },
	{ id: 'memory:swaps', archetype: 'dynamics', change: ['movement', 'swaps'] },
	{ id: 'memory:two-backs', archetype: 'information', change: ['backs', 'two-backs'] },
	{ id: 'memory:quads', archetype: 'grouping', change: ['matchSize', '4'] },
	{ id: 'memory:collapse', archetype: 'dynamics', change: ['movement', 'collapse'] },
	{ id: 'memory:countdown', archetype: 'pressure', change: ['budget', 'countdown'] },
	{ id: 'memory:three-strikes', archetype: 'pressure', change: ['budget', 'three-strikes'] },
	{ id: 'memory:wild-card', archetype: 'core', change: ['availability', 'wild'] },
	{ id: 'memory:sonar', archetype: 'information', change: ['availability', 'sonar'] },
	{ id: 'memory:zebra', archetype: 'information', change: ['backs', 'zebra'] },
	{ id: 'memory:drift', archetype: 'dynamics', change: ['movement', 'drift'] },
	{ id: 'memory:decay', archetype: 'dynamics', change: ['movement', 'decay'] },
	{ id: 'memory:one-flip', archetype: 'core', change: ['availability', 'one-flip'] },
	{ id: 'memory:combo', archetype: 'pressure', change: ['availability', 'combo'] },
	{ id: 'memory:hazard', archetype: 'constraints', change: ['availability', 'hazard'] },
	{ id: 'memory:superstorm', archetype: 'pressure', change: ['availability', 'superstorm'] },
	{ id: 'memory:sentinel-heat', archetype: 'pressure', change: ['budget', 'sentinel-heat'] },
	{ id: 'memory:glyph-chain', archetype: 'constraints', change: ['availability', 'glyph-chain'] },
	{ id: 'memory:analysis-visor', archetype: 'information', change: ['backs', 'analysis-visor'] },
	{ id: 'memory:life-support', archetype: 'pressure', change: ['budget', 'life-support'] },
	{ id: 'memory:hyperdrive-warp', archetype: 'dynamics', change: ['movement', 'hyperdrive-warp'] },
	{
		id: 'memory:gravitino-risk',
		archetype: 'constraints',
		change: ['availability', 'gravitino-risk']
	},
	{ id: 'memory:pulse-drive', archetype: 'pressure', change: ['budget', 'pulse-drive'] },
	{ id: 'memory:derelict-fog', archetype: 'information', change: ['opening', 'derelict-fog'] },
	{ id: 'memory:atlas-terminal', archetype: 'dynamics', change: ['movement', 'atlas-terminal'] },
	{ id: 'memory:edge-cache', archetype: 'information', change: ['backs', 'edge-cache'] },
	{
		id: 'memory:quantum-entangle',
		archetype: 'information',
		change: ['availability', 'quantum-entangle']
	},
	{ id: 'memory:rate-limiter', archetype: 'pressure', change: ['budget', 'rate-limiter'] },
	{ id: 'memory:register-buffer', archetype: 'core', change: ['availability', 'register-buffer'] },
	{ id: 'memory:firewall-ice', archetype: 'constraints', change: ['availability', 'firewall-ice'] },
	{ id: 'memory:anycast-route', archetype: 'dynamics', change: ['movement', 'anycast-route'] },
	{ id: 'memory:tls-handshake', archetype: 'grouping', change: ['availability', 'tls-handshake'] },
	{ id: 'memory:trace-route', archetype: 'pressure', change: ['budget', 'trace-route'] },
	{ id: 'memory:bit-rot', archetype: 'dynamics', change: ['movement', 'bit-rot'] },
	{
		id: 'memory:burst-transmission',
		archetype: 'information',
		change: ['availability', 'burst-transmission']
	},
	{ id: 'memory:kv-consistency', archetype: 'information', change: ['backs', 'kv-consistency'] },
	{
		id: 'memory:durable-object',
		archetype: 'constraints',
		change: ['availability', 'durable-object']
	},
	{
		id: 'memory:vectorize-knn',
		archetype: 'grouping',
		change: ['availability', 'vectorize-knn']
	},
	{ id: 'memory:fifo-queue', archetype: 'core', change: ['availability', 'fifo-queue'] },
	{ id: 'memory:ai-tokens', archetype: 'pressure', change: ['budget', 'ai-tokens'] },
	{ id: 'memory:hyperdrive-pool', archetype: 'pressure', change: ['budget', 'hyperdrive-pool'] },
	{
		id: 'memory:turnstile-verify',
		archetype: 'pressure',
		change: ['budget', 'turnstile-verify']
	},
	{ id: 'memory:zero-trust', archetype: 'constraints', change: ['availability', 'zero-trust'] },
	{ id: 'memory:argo-reroute', archetype: 'dynamics', change: ['movement', 'argo-reroute'] },
	{ id: 'memory:r2-glacier', archetype: 'information', change: ['backs', 'r2-glacier'] },
	{
		id: 'memory:cross-pollination',
		archetype: 'core',
		change: ['availability', 'cross-pollination']
	},
	{
		id: 'memory:mycelium-network',
		archetype: 'information',
		change: ['availability', 'mycelium-network']
	},
	{
		id: 'memory:photosynthesis',
		archetype: 'information',
		change: ['opening', 'photosynthesis']
	},
	{
		id: 'memory:seed-dispersal',
		archetype: 'dynamics',
		change: ['movement', 'seed-dispersal']
	},
	{
		id: 'memory:seasonal-bloom',
		archetype: 'information',
		change: ['backs', 'seasonal-bloom']
	},
	{
		id: 'memory:bee-waggle',
		archetype: 'information',
		change: ['availability', 'bee-waggle']
	},
	{
		id: 'memory:carnivorous-briar',
		archetype: 'constraints',
		change: ['availability', 'carnivorous-briar']
	},
	{
		id: 'memory:chlorophyll-meter',
		archetype: 'pressure',
		change: ['budget', 'chlorophyll-meter']
	},
	{
		id: 'memory:bioluminescent',
		archetype: 'information',
		change: ['backs', 'bioluminescent']
	},
	{
		id: 'memory:botanical-graft',
		archetype: 'pressure',
		change: ['budget', 'botanical-graft']
	},
	{
		id: 'memory:workflows-step',
		archetype: 'core',
		change: ['availability', 'workflows-step']
	},
	{
		id: 'memory:browser-rendering',
		archetype: 'information',
		change: ['opening', 'browser-rendering']
	},
	{
		id: 'memory:ai-gateway',
		archetype: 'pressure',
		change: ['budget', 'ai-gateway']
	},
	{
		id: 'memory:k2-streams',
		archetype: 'dynamics',
		change: ['movement', 'k2-streams']
	},
	{
		id: 'memory:basin-catalog',
		archetype: 'constraints',
		change: ['availability', 'basin-catalog']
	},
	{
		id: 'memory:edge-snippets',
		archetype: 'dynamics',
		change: ['availability', 'edge-snippets']
	},
	{
		id: 'memory:images-transform',
		archetype: 'information',
		change: ['backs', 'images-transform']
	},
	{
		id: 'memory:waiting-room',
		archetype: 'pressure',
		change: ['budget', 'waiting-room']
	},
	{
		id: 'memory:privacy-pass',
		archetype: 'core',
		change: ['budget', 'privacy-pass']
	},
	{
		id: 'memory:agents-sdk',
		archetype: 'information',
		change: ['availability', 'agents-sdk']
	},
	{
		id: 'memory:time-strata',
		archetype: 'constraints',
		changes: [
			['opening', 'no-preview'],
			['availability', 'top-only']
		]
	},
	{
		id: 'memory:strata-linked',
		archetype: 'constraints',
		changes: [
			['opening', 'no-preview'],
			['availability', 'strata-linked']
		]
	},
	{
		id: 'memory:strata-sweep',
		archetype: 'constraints',
		changes: [
			['opening', 'no-preview'],
			['availability', 'strata-sweep']
		]
	},
	{
		id: 'memory:strata-shelf',
		archetype: 'dynamics',
		changes: [
			['opening', 'no-preview'],
			['availability', 'top-only'],
			['movement', 'strata-shelf']
		]
	},
	{
		id: 'memory:strata-cycle',
		archetype: 'dynamics',
		changes: [
			['opening', 'no-preview'],
			['availability', 'top-only'],
			['movement', 'strata-cycle']
		]
	},
	{
		id: 'memory:strata-empty-well',
		archetype: 'dynamics',
		changes: [
			['opening', 'no-preview'],
			['availability', 'top-only'],
			['movement', 'strata-empty-well']
		]
	},
	{
		id: 'memory:strata-glimpse',
		archetype: 'information',
		changes: [
			['opening', 'no-preview'],
			['availability', 'top-only'],
			['backs', 'strata-glimpse']
		]
	},
	{
		id: 'memory:strata-chain',
		archetype: 'core',
		changes: [
			['opening', 'no-preview'],
			['availability', 'strata-chain']
		]
	},
	{
		id: 'memory:strata-echo',
		archetype: 'information',
		changes: [
			['opening', 'no-preview'],
			['availability', 'top-only'],
			['backs', 'strata-echo']
		]
	},
	{
		id: 'memory:strata-slip',
		archetype: 'dynamics',
		changes: [
			['opening', 'no-preview'],
			['availability', 'top-only'],
			['movement', 'strata-slip']
		]
	},
	{
		id: 'memory:strata-order',
		archetype: 'constraints',
		changes: [
			['opening', 'no-preview'],
			['availability', 'strata-order']
		]
	}
] as const;
