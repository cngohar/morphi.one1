export function responsePolicy(response: Response, pathname: string, personal: boolean): void {
	const restricted = /^\/(?:account|admin|auth|api|leaderboard)(?:\/|$)/.test(pathname);
	const play = /^\/(?:play|share|seed|s)(?:\/|$)/.test(pathname);
	if (restricted || personal || response.headers.get('Content-Type')?.includes('text/html')) {
		response.headers.set('Cache-Control', 'private, no-store');
		const vary =
			response.headers
				.get('Vary')
				?.split(',')
				.map((value) => value.trim()) ?? [];
		if (!vary.some((value) => value.toLowerCase() === 'cookie')) vary.push('Cookie');
		response.headers.set('Vary', vary.join(', '));
	}
	if (restricted || play) response.headers.set('X-Robots-Tag', 'noindex');
}
