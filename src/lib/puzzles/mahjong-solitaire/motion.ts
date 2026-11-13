import { createTimeline } from 'animejs';
import { MAHJONG_ENTRANCE_MS } from '#lib/round-timing.js';

let unavailable = false;

/** Presentation only: the active-time deadline owns input and persistence. */
export function mahjongEnter(
	board: SVGSVGElement,
	feedback: 'enter' | 'remove' | 'slide' | 'settle' | 'mistake' | 'hint' | 'win' = 'enter',
	ids: number[] = [],
	offsets: Record<number, { x: number; y: number }> = {}
) {
	let timeline: ReturnType<typeof createTimeline> | null = null;
	let stopped = false;
	const nodes = [...board.querySelectorAll<SVGGElement>('.tile-motion')].filter(
		(node) => feedback === 'enter' || feedback === 'win' || ids.includes(Number(node.dataset.tile))
	);
	const settle = () => {
		stopped = true;
		timeline?.revert();
		for (const node of nodes) {
			node.style.removeProperty('opacity');
			node.style.removeProperty('transform');
			if (feedback === 'remove') node.style.opacity = '0';
		}
		if (feedback === 'enter') board.dataset.motionReady = 'true';
	};
	const query = matchMedia('(prefers-reduced-motion: reduce)');
	const preference = () => {
		if (query.matches) settle();
	};
	try {
		if (query.matches || unavailable) settle();
		else {
			timeline = createTimeline({ autoplay: false });
			for (const [index, node] of nodes.entries()) {
				timeline.add(
					node,
					feedback === 'slide'
						? {
								translateX: [offsets[Number(node.dataset.tile)]?.x ?? 0, 0],
								translateY: [offsets[Number(node.dataset.tile)]?.y ?? 0, 0],
								duration: 350,
								ease: 'outCubic'
							}
						: feedback === 'mistake'
							? { translateX: [0, -5, 5, -3, 3, 0], duration: 280, ease: 'outCubic' }
							: feedback === 'remove'
								? { translateY: [0, -18], opacity: [1, 0], duration: 500, ease: 'outCubic' }
								: feedback === 'enter'
									? { opacity: [0, 1], scale: [0.9, 1], duration: 100, ease: 'outCubic' }
									: { scale: [1, 1.04, 1], duration: 300, ease: 'outCubic' },
					feedback === 'enter'
						? 100 + (index * (MAHJONG_ENTRANCE_MS - 200)) / Math.max(1, nodes.length - 1)
						: 0
				);
			}
			if (!document.hidden) timeline.play();
		}
	} catch {
		unavailable = true;
		settle();
		console.warn('morphi:mahjong_motion_unavailable');
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
