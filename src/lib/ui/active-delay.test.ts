import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActiveDelay } from '#lib/ui/active-delay.js';

describe('active UI deadlines', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('preserves the remaining mismatch hold across a long hidden interval', () => {
		const callback = vi.fn();
		const delay = createActiveDelay(callback);
		delay.start(500);
		vi.advanceTimersByTime(200);
		expect(delay.remaining()).toBe(300);
		delay.pause();
		vi.advanceTimersByTime(60_000);
		expect(delay.remaining()).toBe(300);
		expect(callback).not.toHaveBeenCalled();
		delay.resume();
		delay.resume(); // Duplicate visibility events must not create another timer.
		vi.advanceTimersByTime(299);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledTimes(1);
		delay.resume();
		vi.runAllTimers();
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('does not consume a hide transition started in a hidden tab', () => {
		const callback = vi.fn();
		const delay = createActiveDelay(callback);
		delay.start(250, true);
		vi.advanceTimersByTime(60_000);
		expect(callback).not.toHaveBeenCalled();
		delay.resume();
		vi.advanceTimersByTime(250);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('accounts for repeated pause and resume cycles', () => {
		const callback = vi.fn();
		const delay = createActiveDelay(callback);
		delay.start(500);
		for (let cycle = 0; cycle < 4; cycle += 1) {
			vi.advanceTimersByTime(100);
			delay.pause();
			delay.pause();
			vi.advanceTimersByTime(1000);
			delay.resume();
		}
		vi.advanceTimersByTime(99);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('cancels callbacks on unmount, including a paused deadline', () => {
		const callback = vi.fn();
		const delay = createActiveDelay(callback);
		delay.start(500);
		delay.cancel();
		vi.runAllTimers();
		expect(callback).not.toHaveBeenCalled();
		delay.start(500, true);
		delay.cancel();
		delay.resume();
		vi.runAllTimers();
		expect(callback).not.toHaveBeenCalled();
	});

	it('replaces an old deadline and supports reduced-motion zero delay', () => {
		const callback = vi.fn();
		const delay = createActiveDelay(callback);
		delay.start(500);
		delay.start(0);
		vi.advanceTimersByTime(0);
		expect(callback).toHaveBeenCalledTimes(1);
		vi.runAllTimers();
		expect(callback).toHaveBeenCalledTimes(1);
	});
});
