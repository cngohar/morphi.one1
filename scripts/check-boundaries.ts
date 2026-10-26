import { ESLint } from 'eslint';
import { resolve } from 'node:path';
const eslint = new ESLint();
const cases = [
	{
		file: 'src/lib/engine/probe.ts',
		source: "import '#lib/puzzles/memory/logic.js';",
		rule: 'morphi/boundaries'
	},
	{
		file: 'src/lib/puzzles/memory/probe.ts',
		source: "export * from '#lib/puzzles/block-placement/logic.js';",
		rule: 'morphi/boundaries'
	},
	{
		file: 'src/lib/probe.ts',
		source: "void import('#lib/puzzles/memory/logic.js');",
		rule: 'morphi/boundaries'
	},
	{
		file: 'src/lib/engine/probe.ts',
		source: 'Math.random(); Date.now();',
		rule: 'no-restricted-properties'
	}
];
for (const probe of cases) {
	const [result] = await eslint.lintText(probe.source, { filePath: resolve(probe.file) });
	if (!result?.messages.some((message) => message.ruleId === probe.rule))
		throw new Error(`Boundary self-check failed: ${probe.file}`);
}
console.info('Engine purity and puzzle import boundary self-checks passed.');
