/** Native dialog backdrops retarget pointer events to the dialog itself. */
export function dismissOnBackdrop(node: HTMLDialogElement, onDismiss: () => void) {
	let outsidePointer: number | null = null;
	const outside = (event: PointerEvent) => {
		const rect = node.getBoundingClientRect();
		return (
			event.clientX < rect.left ||
			event.clientX > rect.right ||
			event.clientY < rect.top ||
			event.clientY > rect.bottom
		);
	};
	const down = (event: PointerEvent) => {
		outsidePointer =
			node.open && event.button === 0 && event.isPrimary && outside(event) ? event.pointerId : null;
	};
	const cancel = () => {
		outsidePointer = null;
	};
	const up = (event: PointerEvent) => {
		const dismiss = outsidePointer === event.pointerId && node.open && outside(event);
		outsidePointer = null;
		if (!dismiss || node.querySelector('[aria-busy="true"]')) return;
		try {
			onDismiss();
		} catch {
			console.error('morphi:dialog_dismiss_failed');
		}
	};
	node.addEventListener('pointerdown', down);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('close', cancel);
	return {
		update(next: () => void) {
			onDismiss = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('close', cancel);
		}
	};
}
