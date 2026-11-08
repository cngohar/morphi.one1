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
			{ id: 'photosynthesis', label: 'policy.photosynthesis' }
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
			{ id: 'seed-dispersal', label: 'policy.seedDispersal' }
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
			{ id: 'bioluminescent', label: 'policy.bioluminescent' }
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
			{ id: 'botanical-graft', label: 'policy.botanicalGraft' }
		]
	},
	{
		key: 'availability',
		label: 'policy.availability',
		values: [
			{ id: 'standard', label: 'policy.standard' },
			{ id: 'lockout', label: 'policy.lockout' },
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
			{ id: 'carnivorous-briar', label: 'policy.carnivorousBriar' }
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
	}
] as const;
