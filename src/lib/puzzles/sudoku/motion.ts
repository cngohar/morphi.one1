import { SUDOKU_ENTRANCE_MS } from '#lib/round-timing.js';

const reducedMotion = '(prefers-reduced-motion: reduce)';

export function sudokuEntrance(board: HTMLElement, ready: () => void) {
	const cells = [...board.querySelectorAll<HTMLElement>('[data-sudoku-cell]')];
	const digits = [...board.querySelectorAll<HTMLElement>('.given .digit')];
	const overlay = board.querySelector<SVGSVGElement>('.clue-overlay');
	const nodes = [...cells, ...digits, ...(overlay ? [overlay] : [])];
	const preference = matchMedia(reducedMotion);
	let timeline: import('animejs').Timeline | undefined;
	let done = false;
	function settle() {
		if (done) return;
		done = true;
		clearTimeout(timer);
		preference.removeEventListener('change', changed);
		try {
			timeline?.revert();
		} finally {
			for (const node of nodes) node.style.removeProperty('opacity');
		}
	}
	function finish() {
		if (done) return;
		try {
			settle();
		} finally {
			ready();
		}
	}
	function changed() {
		if (preference.matches) finish();
	}
	const timer = setTimeout(finish, SUDOKU_ENTRANCE_MS);
	if (preference.matches) {
		finish();
		return settle;
	}
	for (const node of nodes) node.style.opacity = '0';
	preference.addEventListener('change', changed);
	void import('animejs')
		.then(({ createTimeline }) => {
			if (done) return;
			const half = SUDOKU_ENTRANCE_MS / 2;
			timeline = createTimeline({ autoplay: false });
			for (const [group, start] of [
				[cells, 0],
				[digits, half]
			] as const) {
				const slot = half / group.length;
				for (const [index, node] of group.entries())
					timeline.add(
						node,
						{ opacity: [0, 1], duration: slot, ease: 'linear' },
						start + index * slot
					);
			}
			if (overlay) timeline.add(overlay, { opacity: [0, 1], duration: 250 }, half);
			timeline.play();
		})
		.catch(finish);
	return settle;
}

const effects = {
	digit: { scale: [0.75, 1.12, 1], duration: 150 },
	note: { scale: [0.8, 1.08, 1], duration: 120 },
	mistake: { translateX: [0, -3, 3, -2, 2, 0], duration: 300 },
	hint: { backgroundColor: ['#83e0d1', '#e0f9f5'], duration: 400 },
	sweep: { backgroundColor: ['#83e0d1', '#e0f9f5'], duration: 250 },
	win: { backgroundColor: ['#83e0d1', '#e0f9f5'], duration: 280 },
	warning: { scale: [1, 1.16, 1], duration: 350 }
} satisfies Record<string, import('animejs').AnimationParams>;

export function sudokuFeedback(nodes: Element[], kind: keyof typeof effects, signal: AbortSignal) {
	const preference = matchMedia(reducedMotion);
	if (signal.aborted || preference.matches || nodes.length === 0) return;
	void import('animejs')
		.then(({ animate, stagger }) => {
			if (signal.aborted || preference.matches) return;
			const animation = animate(nodes, {
				...effects[kind],
				delay: kind === 'win' ? stagger(4) : kind === 'sweep' ? stagger(16) : 0,
				onComplete: stop
			});
			function stop() {
				signal.removeEventListener('abort', stop);
				preference.removeEventListener('change', stop);
				animation.revert();
			}
			signal.addEventListener('abort', stop, { once: true });
			preference.addEventListener('change', stop, { once: true });
		})
		.catch(() => {});
}

export function sudokuScoreCount(
	score: number,
	update: (score: number) => void,
	signal: AbortSignal
) {
	const preference = matchMedia(reducedMotion);
	if (signal.aborted) return;
	if (preference.matches) {
		update(score);
		return;
	}
	update(0);
	void import('animejs')
		.then(({ animate }) => {
			if (signal.aborted) return;
			if (preference.matches) {
				update(score);
				return;
			}
			const counter = { score: 0 };
			const animation = animate(counter, {
				score,
				duration: 600,
				ease: 'outCubic',
				onUpdate: () => update(Math.round(counter.score)),
				onComplete: settle
			});
			function settle() {
				preference.removeEventListener('change', settle);
				signal.removeEventListener('abort', settle);
				if (!signal.aborted) update(score);
				animation.cancel();
			}
			preference.addEventListener('change', settle, { once: true });
			signal.addEventListener('abort', settle, { once: true });
		})
		.catch(() => {
			if (!signal.aborted) update(score);
		});
}
