import { createTimeline } from 'animejs';
import { LIGHT_BEND_ENTRANCE_MS } from '#lib/round-timing.js';

let unavailable = false;

/**
 * Presentation-only feedback. State is already committed by the time this runs,
 * so a motion failure settles immediately and never blocks input or saving.
 */
export function lightBendEnter(
	root: HTMLElement,
	kind: 'enter' | 'trace' | 'rotate' | 'hint' | 'win' | 'invalid' = 'enter',
	cell = -1
) {
	let timeline: ReturnType<typeof createTimeline> | null = null;
	const nodes =
		kind === 'enter'
			? [...root.querySelectorAll<SVGElement>('.lb-motion')]
			: kind === 'trace' || kind === 'win'
				? [...root.querySelectorAll<SVGElement>('.lb-beam')]
				: [...root.querySelectorAll<SVGElement>(`[data-cell-motion="${cell}"]`)];
	const settle = () => {
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
		if (unavailable || query.matches || nodes.length === 0) settle();
		else {
			timeline = createTimeline({ autoplay: false });
			if (kind === 'enter') {
				for (const [index, node] of nodes.entries()) {
					timeline.add(
						node,
						{
							opacity: [0, 1],
							translateY: [6, 0],
							duration: 420,
							delay: Math.round((index / Math.max(1, nodes.length)) * 900)
						},
						0
					);
				}
			} else if (kind === 'trace' || kind === 'win') {
				// The beam draws from its source: a short dash sweep, never a timing input.
				for (const node of nodes) {
					timeline.add(
						node,
						{
							opacity: [0.15, 1],
							duration: kind === 'win' ? 620 : 240,
							ease: 'linear'
						},
						0
					);
				}
			} else if (kind === 'rotate') {
				for (const node of nodes) {
					timeline.add(node, { scale: [0.82, 1], duration: 220, ease: 'outQuad' }, 0);
				}
			} else if (kind === 'hint') {
				for (const node of nodes) {
					timeline.add(node, { opacity: [1, 0.35, 1, 0.35, 1], duration: 720 }, 0);
				}
			} else {
				for (const node of nodes) {
					timeline.add(node, { translateX: [0, -3, 3, 0], duration: 200 }, 0);
				}
			}
			timeline.play();
		}
	} catch {
		unavailable = true;
		settle();
	}
	query.addEventListener('change', preference);
	return {
		settle,
		destroy() {
			query.removeEventListener('change', preference);
			try {
				timeline?.revert();
			} catch {
				/* motion is cosmetic */
			}
			timeline = null;
			for (const node of nodes) {
				node.style.removeProperty('opacity');
				node.style.removeProperty('transform');
			}
		}
	};
}

export { LIGHT_BEND_ENTRANCE_MS };
