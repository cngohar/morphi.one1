import { verifyVectors } from './memory-runner.js';
(
	globalThis as typeof globalThis & { verifyMorphiVectors: typeof verifyVectors }
).verifyMorphiVectors = verifyVectors;
