import { createTimeline } from 'animejs';
import { TANGRAM_ENTRANCE_MS } from '#lib/round-timing.js';

let unavailable = false;

/** Exact state is already committed; animation never owns input or persistence. */
export function tangramEnter(
	root: HTMLElement,
	kind: 'enter' | 'arrive' | 'snap' | 'rotate' | 'flip' | 'mistake' | 'hint' | 'win' = 'enter',
	piece = -1
) {
	let timeline: ReturnType<typeof createTimeline> | null = null;
	let stopped = false;
	const nodes = [...root.querySelectorAll<SVGElement>('.tan-motion')].filter((node) =>
		kind === 'enter'
			? node.closest('.tangram-tray') !== null
			: kind === 'win' || Number(node.dataset.pieceMotion) === piece
	);
	const settle = () => {
		stopped = true;
		try {
			timeline?.revert();
		} finally {
			for (const node of nodes) {
				node.style.removeProperty('opacity');
				node.style.removeProperty('transform');
			}
			if (kind === 'enter') root.dataset.motionReady = 'true';
		}
	};
	const query = matchMedia('(prefers-reduced-motion: reduce)');
	const preference = () => {
		if (query.matches) settle();
	};
	try {
		if (unavailable || query.matches) settle();
		else {
			timeline = createTimeline({ autoplay: false });
			for (const [index, node] of nodes.entries()) {
				const duration =
					kind === 'enter' ? 200 : kind === 'flip' ? 300 : kind === 'win' ? 500 : 200;
				timeline.add(
					node,
					kind === 'arrive'
						? { translateY: [-30, 0], opacity: [0, 1], duration, ease: 'outCubic' }
						: kind === 'mistake'
							? { translateX: [0, -5, 5, -3, 0], duration, ease: 'outCubic' }
							: kind === 'flip'
								? { scaleX: [0.12, 1], duration, ease: 'outCubic' }
								: kind === 'rotate'
									? { rotate: [-45, 0], duration, ease: 'outCubic' }
									: {
											opacity: kind === 'enter' ? [0, 1] : [1, 1],
											scale: kind === 'win' ? [1, 1.045, 1] : [0.94, 1],
											duration,
											ease: 'outCubic'
										},
					kind === 'enter'
						? (index * (TANGRAM_ENTRANCE_MS - duration)) / Math.max(1, nodes.length - 1)
						: 0
				);
			}
			if (!document.hidden) timeline.play();
		}
	} catch {
		unavailable = true;
		try {
			settle();
		} catch {
			root.dataset.motionReady = 'true';
		}
		console.warn('morphi:tangram_motion_unavailable');
	}
	query.addEventListener('change', preference);
	return {
		settle,
		pause: () => timeline?.pause(),
		resume: () => {
			if (!stopped && !query.matches && !unavailable) timeline?.resume();
		},
		destroy: () => {
			try {
				settle();
			} finally {
				query.removeEventListener('change', preference);
			}
		}
	};
}
