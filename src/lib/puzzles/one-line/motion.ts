import { createTimeline } from 'animejs';

let unavailable = false;

/** Cosmetic feedback never controls input or the round outcome. */
export function oneLineMotion(
	nodes: Element[],
	kind: 'trace' | 'pulse' | 'press' | 'win' | 'panel'
) {
	let timeline: ReturnType<typeof createTimeline> | null = null;
	const preference = matchMedia('(prefers-reduced-motion: reduce)');
	function settle() {
		try {
			timeline?.revert();
		} catch {
			// Animation is optional.
		}
		for (const node of nodes) node.removeAttribute('style');
	}
	function changed() {
		if (preference.matches) settle();
	}
	try {
		if (!unavailable && !preference.matches && nodes.length) {
			timeline = createTimeline({ autoplay: false, loop: kind === 'pulse' });
			for (const node of nodes) {
				if (kind === 'trace' && node instanceof SVGGeometryElement) {
					const length = node.getTotalLength();
					timeline.add(
						node,
						{ strokeDasharray: length, strokeDashoffset: [length, 0], duration: 200 },
						0
					);
				} else if (kind === 'win') {
					timeline.add(node, { stroke: ['#2f6fed', '#009a86'], duration: 400 }, 0);
				} else if (kind === 'panel') {
					timeline.add(node, { scale: [0.97, 1], duration: 300 }, 0);
				} else {
					timeline.add(
						node,
						{
							scale: kind === 'press' ? [1, 0.92, 1] : [1, 1.12, 1],
							duration: kind === 'press' ? 120 : 450
						},
						0
					);
				}
			}
			timeline.play();
		}
	} catch {
		unavailable = true;
		settle();
	}
	preference.addEventListener('change', changed);
	return {
		destroy() {
			preference.removeEventListener('change', changed);
			settle();
		}
	};
}
