import { copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const result = spawnSync(
	'bun',
	[
		'build',
		'scripts/demo-motion.ts',
		'--outfile',
		'static/demo/motion.js',
		'--target',
		'browser',
		'--format',
		'iife',
		'--minify'
	],
	{ stdio: 'inherit' }
);
if (result.status !== 0) throw new Error('Demo motion build failed.');
await copyFile('node_modules/animejs/LICENSE.md', 'static/demo/animejs-LICENSE.md');
console.info('Built isolated demo motion wrapper (animejs 4.5.0, MIT).');
