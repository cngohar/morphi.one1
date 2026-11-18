/** Presentation only. Dynamic loading and every animation failure settle immediately. */
export function wordGuessMotion(nodes: HTMLElement[], kind: 'flip' | 'key' | 'invalid' | 'end') {
	let timeline: { pause(): unknown; resume(): unknown; revert(): unknown } | null = null;
	let stopped = false;
	let paused = false;
	const query = matchMedia('(prefers-reduced-motion: reduce)');
	const settle = () => {
		stopped = true;
		try {
			timeline?.revert();
		} catch {
			/* DOM is authoritative. */
		}
		for (const node of nodes) {
			node.style.removeProperty('transform');
			node.style.removeProperty('opacity');
		}
	};
	const preference = () => {
		if (query.matches) settle();
	};
	query.addEventListener('change', preference);
	if (query.matches) settle();
	else
		void import('animejs')
			.then(({ createTimeline }) => {
				if (stopped) return;
				const animation = createTimeline({ autoplay: false });
				timeline = animation;
				for (const [index, node] of nodes.entries())
					animation.add(
						node,
						kind === 'flip'
							? { rotateX: [90, 0], duration: 220, ease: 'outCubic' }
							: kind === 'key'
								? { scale: [1, 0.9, 1], duration: 120, ease: 'outCubic' }
								: kind === 'invalid'
									? { translateX: [0, -5, 5, -3, 3, 0], duration: 300 }
									: { opacity: [0.4, 1], translateY: [8, 0], duration: 300 },
						kind === 'flip' ? Math.floor((index * 80) / Math.max(1, nodes.length - 1)) : 0
					);
				if (!paused) animation.play();
			})
			.catch(() => {
				settle();
				console.warn('morphi:word_guess_motion_unavailable');
			});
	return {
		settle,
		pause: () => {
			paused = true;
			timeline?.pause();
		},
		resume: () => {
			paused = false;
			if (!stopped && !query.matches) timeline?.resume();
		},
		destroy: () => {
			settle();
			query.removeEventListener('change', preference);
		}
	};
}
