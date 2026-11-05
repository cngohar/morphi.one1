import { verifyVectors } from './block-runner.js';
(
	globalThis as typeof globalThis & { verifyMorphiVectors: typeof verifyVectors }
).verifyMorphiVectors = verifyVectors;
