import { spawnSync } from 'node:child_process';
const result = spawnSync(
	'bun',
	[
		'build',
		'scripts/card-proof.ts',
		'--outfile',
		'static/demo/card-proof.js',
		'--target',
		'browser',
		'--format',
		'esm',
		'--minify'
	],
	{ stdio: 'inherit' }
);
if (result.status !== 0) throw new Error('Card proof build failed.');
