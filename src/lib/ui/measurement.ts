import { resolve } from '$app/paths';
let memoryChoice: boolean | null = null;
export function measurementAllowed() {
	try {
		return (
			import.meta.env.MODE !== 'public-guest' &&
			(memoryChoice ?? localStorage.getItem('morphi.measurement') === 'allow') &&
			navigator.doNotTrack !== '1' &&
			!(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
		);
	} catch {
		return false;
	}
}
export function measure(
	event: 'play_clicked' | 'round_started' | 'round_completed' | 'next_clicked' | 'error',
	family: 'memory' | 'block' | null = null,
	code: 'start' | 'save' | 'view' | null = null
) {
	if (!measurementAllowed()) return;
	void fetch(resolve('/api/measurement'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id: crypto.randomUUID(), consent: true, event, family, code }),
		signal: AbortSignal.timeout(5000)
	}).catch(() => {
		/* Optional measurement never blocks play. */
	});
}
export async function setMeasurement(enabled: boolean) {
	memoryChoice = enabled;
	try {
		localStorage.setItem('morphi.measurement', enabled ? 'allow' : 'deny');
	} catch {
		return false;
	}
	if (!enabled)
		try {
			const response = await fetch(resolve('/api/measurement'), { method: 'DELETE' });
			return response.ok;
		} catch {
			return false;
		}
	return true;
}
