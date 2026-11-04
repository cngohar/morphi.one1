import type { PuzzleId } from '#lib/engine/contract.js';

/** Best effort acknowledgement only: never delay play or persist a guest identity. */
export async function reportAccountRound(
	action: 'start' | 'abandon' | 'play',
	ownerKey: string,
	runId: string,
	family: PuzzleId,
	rankedSession: string | null,
	variant?: string
) {
	try {
		const response = await fetch('/api/play/activity', {
			method: 'POST',
			keepalive: action === 'abandon',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action,
				ownerKey,
				runId,
				family,
				rankedSession,
				...(variant ? { variant } : {})
			}),
			signal: AbortSignal.timeout(3000)
		});
		if (!response.ok) throw new Error('activity_unavailable');
		return true;
	} catch {
		console.warn('morphi:account_activity_unavailable');
		return false;
	}
}
