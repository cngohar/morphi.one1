import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		files: ['src/lib/engine/**/*.ts', 'src/lib/game/**/*.ts'],
		rules: {
			'no-restricted-properties': [
				'error',
				{ object: 'Math', property: 'random', message: 'Use the seeded engine RNG.' },
				{ object: 'Date', property: 'now', message: 'Engine logic must not read wall-clock time.' },
				{
					object: 'performance',
					property: 'now',
					message: 'Engine logic must not read wall-clock time.'
				},
				{ object: 'Math', property: 'sin', message: 'Approximated math is banned in engine core.' },
				{ object: 'Math', property: 'cos', message: 'Approximated math is banned in engine core.' },
				{ object: 'Math', property: 'tan', message: 'Approximated math is banned in engine core.' },
				{
					object: 'Math',
					property: 'asin',
					message: 'Approximated math is banned in engine core.'
				},
				{
					object: 'Math',
					property: 'acos',
					message: 'Approximated math is banned in engine core.'
				},
				{
					object: 'Math',
					property: 'atan',
					message: 'Approximated math is banned in engine core.'
				},
				{ object: 'Math', property: 'exp', message: 'Approximated math is banned in engine core.' },
				{
					object: 'Math',
					property: 'expm1',
					message: 'Approximated math is banned in engine core.'
				},
				{ object: 'Math', property: 'log', message: 'Approximated math is banned in engine core.' },
				{
					object: 'Math',
					property: 'log1p',
					message: 'Approximated math is banned in engine core.'
				},
				{
					object: 'Math',
					property: 'log2',
					message: 'Approximated math is banned in engine core.'
				},
				{
					object: 'Math',
					property: 'log10',
					message: 'Approximated math is banned in engine core.'
				},
				{ object: 'Math', property: 'pow', message: 'Approximated math is banned in engine core.' },
				{
					object: 'Math',
					property: 'sqrt',
					message: 'Approximated math is banned in engine core.'
				},
				{
					object: 'Math',
					property: 'cbrt',
					message: 'Approximated math is banned in engine core.'
				},
				{
					object: 'Math',
					property: 'hypot',
					message: 'Approximated math is banned in engine core.'
				},
				{
					object: 'Math',
					property: 'sinh',
					message: 'Approximated math is banned in engine core.'
				},
				{
					object: 'Math',
					property: 'cosh',
					message: 'Approximated math is banned in engine core.'
				},
				{ object: 'Math', property: 'tanh', message: 'Approximated math is banned in engine core.' }
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: "NewExpression[callee.name='Date']",
					message: 'Engine logic must not read wall-clock time.'
				}
			]
		}
	}
);
