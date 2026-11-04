import { verifyVectors } from './memory-runner.js';
export default {
	async fetch() {
		return Response.json(await verifyVectors());
	}
};
