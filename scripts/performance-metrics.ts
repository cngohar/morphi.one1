export function percentiles(values: number[]) {
	if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0))
		throw new Error('Performance samples must be finite, non-negative and non-empty');
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return {
		samples: sorted.length,
		p50: sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2,
		p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!
	};
}

export interface BrowserPerformanceSample {
	lcp: number | null;
	cls: number;
	interactions: Record<number, number>;
	click: number | null;
	feedback: number | null;
	playable: number | null;
}

// Self-contained so Playwright can install it before navigation; also exportable to a DevTools snippet.
export function installPerformanceObservers() {
	const state: BrowserPerformanceSample = {
		lcp: null,
		cls: 0,
		interactions: {},
		click: null,
		feedback: null,
		playable: null
	};
	Object.assign(window, { __morphiPerformance: state });
	let sessionStart = 0;
	let sessionEnd = Number.NEGATIVE_INFINITY;
	let sessionValue = 0;
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) state.lcp = entry.startTime;
	}).observe({ type: 'largest-contentful-paint', buffered: true });
	new PerformanceObserver((list) => {
		for (const raw of list.getEntries()) {
			const entry = raw as PerformanceEntry & { value: number; hadRecentInput: boolean };
			if (entry.hadRecentInput) continue;
			if (entry.startTime - sessionEnd < 1000 && entry.startTime - sessionStart < 5000) {
				sessionValue += entry.value;
			} else {
				sessionStart = entry.startTime;
				sessionValue = entry.value;
			}
			sessionEnd = entry.startTime;
			state.cls = Math.max(state.cls, sessionValue);
		}
	}).observe({ type: 'layout-shift', buffered: true });
	const recordEvents: PerformanceObserverCallback = (list) => {
		for (const raw of list.getEntries()) {
			const entry = raw as PerformanceEntry & { interactionId: number };
			if (entry.interactionId)
				state.interactions[entry.interactionId] = Math.max(
					state.interactions[entry.interactionId] ?? 0,
					entry.duration
				);
		}
	};
	new PerformanceObserver(recordEvents).observe({
		type: 'event',
		buffered: true,
		durationThreshold: 16
	} as PerformanceObserverInit);
	new PerformanceObserver(recordEvents).observe({ type: 'first-input', buffered: true });
	document.addEventListener(
		'click',
		(event) => {
			if (!(event.target instanceof Element) || !event.target.closest('.play-circle')) return;
			state.click = performance.now();
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					state.feedback = performance.now();
				});
			});
		},
		true
	);
	const observer = new MutationObserver(() => {
		if (
			state.click !== null &&
			state.playable === null &&
			document.querySelector('.round-stage[data-card-phase="playing"] .game[data-phase="playing"]')
		) {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					state.playable ??= performance.now();
				});
			});
		}
	});
	observer.observe(document, { attributes: true, childList: true, subtree: true });
}
