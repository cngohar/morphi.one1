import { afterEach, expect, it, vi } from 'vitest';
import {
	installPerformanceObservers,
	percentiles,
	type BrowserPerformanceSample
} from '../../scripts/performance-metrics.js';

afterEach(() => vi.unstubAllGlobals());

it('reports median and nearest-rank p95 without mutating samples or hiding invalid measurements', () => {
	const samples = [5, 1, 3, 4, 2];
	expect(percentiles(samples)).toEqual({ samples: 5, p50: 3, p95: 5 });
	expect(samples).toEqual([5, 1, 3, 4, 2]);
	expect(percentiles([1, 2, 3, 4])).toEqual({ samples: 4, p50: 2.5, p95: 4 });
	expect(percentiles(Array.from({ length: 20 }, (_, index) => index + 1)).p95).toBe(19);
	for (const values of [[], [NaN], [Infinity], [-1]])
		expect(() => percentiles(values)).toThrow('Performance samples');
});

it('uses bounded CLS sessions, excludes recent-input shifts and groups Event Timing interactions', () => {
	const callbacks = new Map<string, PerformanceObserverCallback>();
	vi.stubGlobal(
		'PerformanceObserver',
		class {
			constructor(private callback: PerformanceObserverCallback) {}
			observe(options: PerformanceObserverInit) {
				callbacks.set(options.type!, this.callback);
			}
		}
	);
	vi.stubGlobal(
		'MutationObserver',
		class {
			observe() {}
		}
	);
	vi.stubGlobal('window', {});
	vi.stubGlobal('document', { addEventListener() {} });
	installPerformanceObservers();
	const emit = (type: string, entries: object[]) => {
		callbacks.get(type)!(
			{ getEntries: () => entries } as unknown as PerformanceObserverEntryList,
			{} as PerformanceObserver
		);
	};
	const state = (window as unknown as { __morphiPerformance: BrowserPerformanceSample })
		.__morphiPerformance;
	emit('largest-contentful-paint', [{ startTime: 250 }]);
	expect(state.lcp).toBe(250);
	emit('layout-shift', [
		{ startTime: 200, value: 0.02, hadRecentInput: false },
		{ startTime: 800, value: 0.03, hadRecentInput: false },
		{ startTime: 850, value: 0.9, hadRecentInput: true },
		{ startTime: 1900, value: 0.04, hadRecentInput: false }
	]);
	expect(state.cls).toBeCloseTo(0.05);
	emit(
		'layout-shift',
		Array.from({ length: 7 }, (_, index) => ({
			startTime: 3000 + index * 900,
			value: 0.01,
			hadRecentInput: false
		}))
	);
	expect(state.cls).toBeCloseTo(0.06);
	emit('event', [
		{ interactionId: 7, duration: 24 },
		{ interactionId: 7, duration: 48 },
		{ interactionId: 0, duration: 999 }
	]);
	emit('first-input', [{ interactionId: 8, duration: 8 }]);
	expect(state.interactions).toEqual({ 7: 48, 8: 8 });
});
