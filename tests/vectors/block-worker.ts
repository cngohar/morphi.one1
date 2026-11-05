import { verifyVectors } from './block-runner.js';
export default {
	async fetch() {
		return Response.json(await verifyVectors());
	}
};
