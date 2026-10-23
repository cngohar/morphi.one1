/** A one-shot UI deadline measured only while the page is active. */
export function createActiveDelay(callback: () => void) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let startedAt: number | null = null;
	let remaining: number | null = null;

	function pause(): void {
		if (startedAt !== null && remaining !== null) {
			remaining = Math.max(0, remaining - (performance.now() - startedAt));
		}
		if (timer !== null) clearTimeout(timer);
		timer = null;
		startedAt = null;
	}

	function cancel(): void {
		pause();
		remaining = null;
	}

	function resume(): void {
		if (remaining === null || timer !== null) return;
		startedAt = performance.now();
		timer = setTimeout(() => {
			timer = null;
			startedAt = null;
			remaining = null;
			callback();
		}, remaining);
	}

	return {
		start(duration: number, paused = false): void {
			cancel();
			remaining = duration;
			if (!paused) resume();
		},
		pause,
		resume,
		cancel
	};
}
