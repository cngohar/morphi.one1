import { dismissOnBackdrop } from '../src/lib/ui/dismiss-dialog.js';
// Demo presentation only. No callback in this wrapper changes puzzle state.
import { animate, createTimeline } from 'animejs';
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const running = new Set<ReturnType<typeof animate> | ReturnType<typeof createTimeline>>();
const layers = new Set<HTMLElement>();
const duration = 1000;
const homeDuration = 1500;
const helpDuration = 500;
let overlay: HTMLElement | null = null;
const initialOpacity = new Map<HTMLElement, string>();
function prepareEntrance(target: HTMLElement) {
	if (!initialOpacity.has(target)) initialOpacity.set(target, target.style.opacity);
	target.style.opacity = '0';
}
function forget(clone: HTMLElement) {
	clone.remove();
	layers.delete(clone);
	if (layers.size === 0) {
		overlay?.remove();
		overlay = null;
	}
}
function track<T extends ReturnType<typeof animate> | ReturnType<typeof createTimeline>>(
	animation: T
): T {
	running.add(animation);
	return animation;
}
function clear() {
	for (const animation of running) animation.revert();
	running.clear();
	for (const [target, opacity] of initialOpacity) target.style.opacity = opacity;
	initialOpacity.clear();
	for (const layer of layers) layer.remove();
	layers.clear();
	overlay?.remove();
	overlay = null;
}
function ghost(node: HTMLElement): HTMLElement {
	const rect = node.getBoundingClientRect();
	const clone = node.cloneNode(true) as HTMLElement;
	clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
	clone.removeAttribute('id');
	clone.setAttribute('aria-hidden', 'true');
	clone.inert = true;
	Object.assign(clone.style, {
		position: 'absolute',
		left: `${rect.left}px`,
		top: `${rect.top}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		margin: '0',
		pointerEvents: 'none',
		zIndex: '100',
		transformOrigin: 'center',
		overflow: 'hidden'
	});
	clone.classList.add('motion-ghost');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.className = 'motion-layer';
		overlay.inert = true;
		overlay.setAttribute('aria-hidden', 'true');
		Object.assign(overlay.style, {
			position: 'fixed',
			inset: '0',
			overflow: 'clip',
			pointerEvents: 'none',
			zIndex: '100',
			contain: 'strict'
		});
		document.body.appendChild(overlay);
	}
	overlay.appendChild(clone);
	layers.add(clone);
	return clone;
}
function arrive(target: HTMLElement | null) {
	if (!target || preference.matches) return;
	track(
		animate(target, {
			opacity: [0, 1],
			translateY: [12, 0],
			scale: [0.97, 1],
			duration,
			ease: 'outCubic'
		})
	);
}
function orbit(root: HTMLElement) {
	if (preference.matches) return;
	const ring = root.querySelector<HTMLElement>('.orbit-rotator');
	const play = root.querySelector<HTMLElement>('.play-circle');
	if (ring) track(animate(ring, { rotate: [0, 360], duration: 36000, ease: 'linear', loop: true }));
	if (play)
		track(
			animate(play, {
				scale: [1, 1.025],
				duration: 1800,
				ease: 'inOutSine',
				alternate: true,
				loop: true
			})
		);
}
function homeExit(previous: HTMLElement, target: HTMLElement) {
	if (preference.matches) return;
	const old = previous;
	prepareEntrance(target);
	const tiles = old.querySelectorAll<HTMLElement>('.orbit-tile');
	track(
		animate(old, {
			opacity: [1, 0],
			duration: 600,
			ease: 'outCubic',
			onComplete: () => {
				forget(old);
			}
		})
	);
	const timeline = track(createTimeline({ defaults: { ease: 'outCubic', duration } }));
	const destination = target.getBoundingClientRect();
	for (const [index, tile] of Array.from(tiles).entries()) {
		const clone = ghost(tile);
		const rect = tile.getBoundingClientRect();
		timeline.add(
			clone,
			{
				translateX: destination.left + destination.width * (0.3 + (index % 4) * 0.12) - rect.left,
				translateY: destination.top + destination.height * 0.4 - rect.top,
				scale: [1, 0.35],
				opacity: [1, 0],
				duration: 1050,
				onComplete: () => {
					forget(clone);
				}
			},
			0
		);
	}
	timeline.add(
		target,
		{ opacity: [0, 1], scale: [0.96, 1], translateY: [10, 0], duration: homeDuration - 550 },
		550
	);
}
function door(
	target: HTMLElement,
	before: DOMRect,
	columns: HTMLElement[],
	help: HTMLElement | null
) {
	if (preference.matches) return;
	const after = target.getBoundingClientRect();
	const timeline = track(createTimeline({ defaults: { ease: 'outCubic', duration } }));
	timeline.add(
		target,
		{
			translateX: [before.left - after.left, 0],
			translateY: [before.top - after.top, 0],
			scale: [before.width / after.width, 1],
			transformOrigin: 'top left'
		},
		0
	);
	for (const [index, column] of columns.entries())
		timeline.add(
			column,
			{
				translateX: [0, index === 0 ? -50 : 50],
				opacity: [1, 0],
				duration: 650,
				onComplete: () => {
					forget(column);
				}
			},
			0
		);
	if (help) {
		prepareEntrance(help);
		timeline.add(help, { opacity: [0, 1], duration: 300 }, 700);
	}
}
function doorReady(root: HTMLElement, before: DOMRect | null) {
	if (preference.matches) return;
	const board = root.querySelector<HTMLElement>('.memory-board,.block-board');
	if (board && before) {
		const after = board.getBoundingClientRect();
		track(
			animate(board, {
				translateX: [before.left - after.left, 0],
				translateY: [before.top - after.top, 0],
				scale: [before.width / after.width, 1],
				transformOrigin: 'top left',
				duration,
				ease: 'outCubic'
			})
		);
	}
	root.querySelectorAll<HTMLElement>('.puzzle-copy').forEach((column, index) =>
		track(
			animate(column, {
				opacity: [0, 1],
				translateX: [index === 0 ? -36 : 36, 0],
				duration: 650,
				delay: 350,
				ease: 'outCubic'
			})
		)
	);
}
function dialogOpen(dialog: HTMLElement, anchor: HTMLElement) {
	if (preference.matches) return;
	const box = dialog.getBoundingClientRect(),
		source = anchor.getBoundingClientRect();
	track(
		animate(dialog, {
			translateX: [source.left + source.width / 2 - box.left - box.width / 2, 0],
			translateY: [source.top + source.height / 2 - box.top - box.height / 2, 0],
			scale: [0.2, 1],
			opacity: [0, 1],
			duration: helpDuration,
			ease: 'outCubic'
		})
	);
}
function dialogExit(dialog: HTMLElement, anchor: HTMLElement | null) {
	if (preference.matches || !anchor) return;
	const clone = ghost(dialog),
		box = dialog.getBoundingClientRect(),
		source = anchor.getBoundingClientRect();
	clone.removeAttribute('open');
	clone.style.display = 'block';
	track(
		animate(clone, {
			translateX: source.left + source.width / 2 - box.left - box.width / 2,
			translateY: source.top + source.height / 2 - box.top - box.height / 2,
			scale: [1, 0.2],
			opacity: [1, 0],
			duration: helpDuration,
			ease: 'outCubic',
			onComplete: () => {
				forget(clone);
			}
		})
	);
}
preference.addEventListener('change', clear);
addEventListener('pagehide', clear);
Object.assign(globalThis, {
	MorphiMotion: {
		dismissOnBackdrop,
		clear,
		ghost: (node: HTMLElement) => (preference.matches ? null : ghost(node)),
		arrive,
		orbit,
		homeExit,
		door,
		doorReady,
		dialogOpen,
		dialogExit
	}
});
