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
			{ id: 'no-preview', label: 'policy.noPreview' }
		]
	},
	{
		key: 'movement',
		label: 'policy.movement',
		values: [
			{ id: 'static', label: 'policy.static' },
			{ id: 'moving', label: 'policy.moving' },
			{ id: 'swaps', label: 'policy.swaps' },
			{ id: 'collapse', label: 'policy.collapse' }
		]
	},
	{
		key: 'backs',
		label: 'policy.backs',
		values: [
			{ id: 'uniform', label: 'policy.uniform' },
			{ id: 'two-backs', label: 'policy.twoBacks' }
		]
	},
	{
		key: 'budget',
		label: 'policy.budget',
		values: [
			{ id: 'standard', label: 'policy.standard' },
			{ id: 'strict', label: 'policy.strict' }
		]
	},
	{
		key: 'availability',
		label: 'policy.availability',
		values: [
			{ id: 'standard', label: 'policy.standard' },
			{ id: 'lockout', label: 'policy.lockout' }
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
	{ id: 'memory:collapse', archetype: 'dynamics', change: ['movement', 'collapse'] }
] as const;
