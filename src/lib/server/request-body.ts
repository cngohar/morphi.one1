/** Bound streamed bodies too: Content-Length may be missing or untrusted. */
export async function boundAccountRequest(
	request: Request,
	limit = 16_384
): Promise<Request | null> {
	if (Number(request.headers.get('content-length') ?? 0) > limit) return null;
	if (!request.body) return request;
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const body = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new Request(request, { body });
}
