/** Position seeded scatter within the actual empty space, rather than narrow viewport columns. */
export function setBackdropBounds(layer: HTMLElement, panel: DOMRect) {
	const bounds = layer.getBoundingClientRect();
	const left = Math.max(0, panel.left - bounds.left);
	const right = Math.max(0, bounds.right - panel.right);
	layer.style.setProperty('--scatter-left-space', `${left}px`);
	layer.style.setProperty('--scatter-right-space', `${right}px`);
}
