import { verifyVectors } from './runner.js';
import { replayBatch } from './benchmark.js';

(globalThis as typeof globalThis & { replayMorphiBatch: typeof replayBatch }).replayMorphiBatch =
	replayBatch;
export default {
	async fetch() {
		return Response.json(await verifyVectors());
	}
};
