import { createTimeline } from 'animejs';
import { KLONDIKE_ENTRANCE_MS } from '#lib/round-timing.js';

let unavailable = false;

export interface MotionHandle {
	settle: () => void;
	pause: () => void;
	resume: () => void;
	destroy: () => void;
}

/**
 * Klondike Solitaire entrance and game motion:
 * - 3,000 ms total entrance deal
 * - 28 tableau cards fly from stock to home in row-by-row left-to-right order
 * - In standard variants: face-down flight (240 ms) + in-place flip (180 ms) for top cards
 * - In thoughtful variant: all cards fly face-up with no flip step
 */
export function klondikeEnter(
	root: HTMLElement,
	kind: 'enter' | 'draw' | 'flip' | 'win' | 'settle' = 'enter',
	thoughtful = false
): MotionHandle {
	let timeline: ReturnType<typeof createTimeline> | null = null;
	let stopped = false;

	const settle = () => {
		stopped = true;
		try {
			timeline?.revert();
		} finally {
			root.dataset.motionReady = 'true';
		}
	};

	const query = matchMedia('(prefers-reduced-motion: reduce)');
	const preference = () => {
		if (query.matches) settle();
	};

	try {
		if (unavailable || query.matches) {
			settle();
		} else if (kind === 'enter') {
			timeline = createTimeline({ autoplay: false });
			const cards = [...root.querySelectorAll<HTMLElement>('.tableau-card-enter')];
			const count = cards.length; // 28 cards
			if (count > 0) {
				const gap =
					(KLONDIKE_ENTRANCE_MS - 240 - (thoughtful ? 0 : 180)) / Math.max(1, count - 1);
				for (const [idx, card] of cards.entries()) {
					const start = idx * gap;
					// Straight translate flight
					timeline.add(
						card,
						{
							opacity: [0, 1],
							translateY: [-40, 0],
							duration: 240,
							ease: 'outCubic'
						},
						start
					);
					// In-place flip for the top card of each column (unless thoughtful)
					if (!thoughtful && card.dataset.flip === 'true') {
						timeline.add(
							card,
							{
								scaleX: [1, 0.05, 1],
								duration: 180,
								ease: 'easeInOutSine'
							},
							start + 240
						);
					}
				}
			}
			timeline.add(
				root,
				{
					opacity: [1, 1],
					duration: 1
				},
				KLONDIKE_ENTRANCE_MS
			);
			if (!document.hidden) timeline.play();
		} else if (kind === 'win') {
			timeline = createTimeline({ autoplay: false });
			const fCards = [...root.querySelectorAll<HTMLElement>('.foundation-card')];
			for (const [idx, card] of fCards.entries()) {
				timeline.add(
					card,
					{
						scale: [1, 1.08, 1],
						duration: 350,
						ease: 'outCubic'
					},
					idx * 60
				);
			}
			if (!document.hidden) timeline.play();
		}
	} catch {
		unavailable = true;
		settle();
		console.warn('morphi:klondike_motion_unavailable');
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
