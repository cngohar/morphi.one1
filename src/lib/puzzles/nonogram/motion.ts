import { createTimeline } from 'animejs';

/** Nonogram presentation only; the game's logical deadline owns input readiness. */
export function nonogramEnter(
	board: HTMLElement,
	feedback: 'enter' | 'pop' | 'mistake' | 'hint' | 'win' = 'enter',
	cell = -1
) {
	let timeline: ReturnType<typeof createTimeline> | null = null;
	let stopped = false;
	const nodes =
		feedback === 'enter'
			? [...board.querySelectorAll<HTMLElement>('.nonogram-clue, .nonogram-cell')]
			: feedback === 'win'
				? [...board.querySelectorAll<HTMLElement>('.nonogram-cell.filled')]
				: [...board.querySelectorAll<HTMLElement>(`[data-cell='${cell}']`)];
	const settle = () => {
		stopped = true;
		timeline?.revert();
		for (const node of nodes) {
			node.style.removeProperty('opacity');
			node.style.removeProperty('transform');
		}
		if (feedback === 'enter') board.dataset.motionReady = 'true';
	};
	const query = matchMedia('(prefers-reduced-motion: reduce)');
	const preference = () => {
		if (query.matches) settle();
	};
	try {
		if (query.matches) settle();
		else {
			timeline = createTimeline({ autoplay: false });
			for (const [index, node] of nodes.entries()) {
				const start =
					feedback === 'enter'
						? (index * 1950) / Math.max(1, nodes.length - 1)
						: feedback === 'win'
							? (index * 180) / Math.max(1, nodes.length - 1)
							: 0;
				timeline.add(
					node,
					feedback === 'mistake'
						? { translateX: [0, -4, 4, -3, 3, 0], duration: 300, ease: 'outCubic' }
						: feedback === 'hint'
							? { scale: [1, 0.8, 1.12, 1], duration: 420, ease: 'outCubic' }
							: {
									opacity: feedback === 'enter' ? [0, 1] : [1, 1],
									scale: feedback === 'enter' ? [0.82, 1] : [0.8, 1.12, 1],
									duration: feedback === 'enter' ? 450 : 280,
									ease: 'outCubic'
								},
					start
				);
			}
			if (!document.hidden) timeline.play();
		}
	} catch {
		settle();
		console.warn('morphi:nonogram_motion_unavailable');
	}
	query.addEventListener('change', preference);
	return {
		settle,
		pause: () => timeline?.pause(),
		resume: () => {
			if (!stopped && !query.matches) timeline?.resume();
		},
		destroy: () => {
			settle();
			query.removeEventListener('change', preference);
		}
	};
}
