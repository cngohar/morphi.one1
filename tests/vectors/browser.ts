import { verifyVectors } from './runner.js';
(
	globalThis as typeof globalThis & { verifyMorphiVectors: typeof verifyVectors }
).verifyMorphiVectors = verifyVectors;
