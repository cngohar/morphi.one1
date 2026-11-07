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
			{ id: 'derelict-fog', label: 'policy.derelictFog' }
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
			{ id: 'bit-rot', label: 'policy.bitRot' }
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
			{ id: 'edge-cache', label: 'policy.edgeCache' }
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
			{ id: 'trace-route', label: 'policy.traceRoute' }
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
			{ id: 'burst-transmission', label: 'policy.burstTransmission' }
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
	}
] as const;
