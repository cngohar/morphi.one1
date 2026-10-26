/** All application anime.js use lives here. Presentation never commits moves. */
import { animate, type JSAnimation } from 'animejs';
const reduced = () =>
	typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const motion = {
	homeExit(root: HTMLElement) {
		if (reduced()) return;
		const layer = document.createElement('div');
		layer.className = 'design-public';
		layer.inert = true;
		layer.setAttribute('aria-hidden', 'true');
		Object.assign(layer.style, {
			position: 'fixed',
			inset: '0',
			zIndex: '100',
			pointerEvents: 'none',
			overflow: 'clip'
		});
		const clone = root.cloneNode(true) as HTMLElement;
		clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
		layer.appendChild(clone);
		document.body.appendChild(layer);
		const animations: JSAnimation[] = [];
		animations.push(animate(clone, { opacity: [1, 0], duration: 600, ease: 'outCubic' }));
		for (const tile of root.querySelectorAll<HTMLElement>('.orbit-tile')) {
			const rect = tile.getBoundingClientRect(),
				piece = tile.cloneNode(true) as HTMLElement;
			Object.assign(piece.style, {
				position: 'absolute',
				left: `${rect.left}px`,
				top: `${rect.top}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				background: getComputedStyle(tile).backgroundColor,
				borderRadius: '5px'
			});
			layer.appendChild(piece);
			animations.push(
				animate(piece, {
					translateX: innerWidth / 2 - rect.left,
					translateY: innerHeight / 2 - rect.top,
					scale: [1, 0.3],
					opacity: [1, 0],
					duration: 1500,
					ease: 'outCubic'
				})
			);
		}
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const cleanup = () => {
			for (const animation of animations) animation.cancel();
			layer.remove();
			query.removeEventListener('change', cleanup);
		};
		query.addEventListener('change', cleanup);
		setTimeout(cleanup, 1550);
	},
	reduced,
	doorExit(root: HTMLElement) {
		if (reduced()) return;
		root.querySelectorAll<HTMLElement>('.puzzle-copy').forEach((column, index) => {
			const rect = column.getBoundingClientRect(),
				layer = document.createElement('div'),
				clone = column.cloneNode(true) as HTMLElement;
			layer.className = 'design-public';
			layer.inert = true;
			layer.setAttribute('aria-hidden', 'true');
			Object.assign(layer.style, {
				position: 'fixed',
				inset: '0',
				overflow: 'clip',
				zIndex: '10',
				pointerEvents: 'none'
			});
			Object.assign(clone.style, {
				position: 'absolute',
				left: `${rect.left}px`,
				top: `${rect.top}px`,
				width: `${rect.width}px`,
				margin: '0'
			});
			layer.appendChild(clone);
			document.body.appendChild(layer);
			animate(clone, {
				translateX: [0, index === 0 ? -50 : 50],
				opacity: [1, 0],
				duration: 1000,
				ease: 'outCubic',
				onComplete: () => layer.remove()
			});
		});
	},
	dialogExit(node: HTMLElement, anchor: HTMLElement) {
		if (reduced()) return;
		const rect = node.getBoundingClientRect(),
			source = anchor.getBoundingClientRect();
		const layer = document.createElement('div'),
			clone = node.cloneNode(true) as HTMLElement;
		layer.className = 'design-public';
		layer.inert = true;
		layer.setAttribute('aria-hidden', 'true');
		Object.assign(layer.style, {
			position: 'fixed',
			inset: '0',
			zIndex: '100',
			overflow: 'clip',
			pointerEvents: 'none'
		});
		clone.removeAttribute('open');
		clone.removeAttribute('id');
		Object.assign(clone.style, {
			display: 'block',
			position: 'absolute',
			left: `${rect.left}px`,
			top: `${rect.top}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			margin: '0'
		});
		layer.appendChild(clone);
		document.body.appendChild(layer);
		animate(clone, {
			translateX: source.left + source.width / 2 - rect.left - rect.width / 2,
			translateY: source.top + source.height / 2 - rect.top - rect.height / 2,
			scale: [1, 0.2],
			opacity: [1, 0],
			duration: 500,
			ease: 'outCubic',
			onComplete: () => layer.remove()
		});
	},
	orbit(root: HTMLElement) {
		const animations: JSAnimation[] = [];
		const ring = root.querySelector<HTMLElement>('.orbit-rotator');
		const play = root.querySelector<HTMLElement>('.play-circle');
		const start = () => {
			if (reduced()) return;
			if (ring)
				animations.push(
					animate(ring, { rotate: [0, 360], duration: 36000, ease: 'linear', loop: true })
				);
			if (play)
				animations.push(
					animate(play, {
						scale: [1, 1.025],
						duration: 1800,
						ease: 'inOutSine',
						alternate: true,
						loop: true
					})
				);
		};
		const stop = () => {
			for (const animation of animations) animation.revert();
			animations.length = 0;
		};
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const change = () => {
			stop();
			start();
		};
		start();
		query.addEventListener('change', change);
		return () => {
			stop();
			query.removeEventListener('change', change);
		};
	},
	arrive(node: HTMLElement, duration = 1000) {
		if (reduced()) return () => {};
		const animation = animate(node, {
			opacity: [0, 1],
			translateY: [12, 0],
			duration,
			ease: 'outCubic'
		});
		return () => animation.revert();
	},
	dialog(node: HTMLElement, anchor: HTMLElement) {
		if (reduced()) return;
		const box = node.getBoundingClientRect(),
			source = anchor.getBoundingClientRect();
		animate(node, {
			translateX: [source.left + source.width / 2 - box.left - box.width / 2, 0],
			translateY: [source.top + source.height / 2 - box.top - box.height / 2, 0],
			scale: [0.2, 1],
			opacity: [0, 1],
			duration: 500,
			ease: 'outCubic'
		});
	},
	/** Stagger fills the whole deadline. Caller owns a separate active-time phase. */
	deal(nodes: HTMLElement[], duration: number) {
		const animations: JSAnimation[] = [];
		let stopped = false;
		const reveal = () => {
			for (const animation of animations) animation.revert();
			for (const node of nodes) {
				node.style.removeProperty('opacity');
				node.style.removeProperty('transform');
			}
		};
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const pref = () => {
			if (query.matches) reveal();
		};
		try {
			if (!reduced()) {
				const entropy = crypto.getRandomValues(new Uint32Array(nodes.length * 4));
				const order = nodes
					.map((node, index) => ({ node, index, key: entropy[index * 4] }))
					.sort((a, b) => a.key - b.key);
				const travel = Math.min(800, duration);
				for (const [rank, { node, index }] of order.entries()) {
					const rect = node.getBoundingClientRect();
					const x = (entropy[index * 4 + 1] / 4294967296) * innerWidth - rect.left - rect.width / 2;
					const y =
						(entropy[index * 4 + 2] / 4294967296) * innerHeight - rect.top - rect.height / 2;
					animations.push(
						animate(node, {
							translateX: [x, 0],
							translateY: [y, 0],
							rotate: [(entropy[index * 4 + 3] % 71) - 35, 0],
							scale: [0.65, 1],
							opacity: [0, 1],
							delay: (rank * (duration - travel)) / Math.max(1, nodes.length - 1),
							duration: travel,
							ease: 'outCubic',
							autoplay: !document.hidden
						})
					);
				}
			}
		} catch {
			console.warn('morphi:entrance_motion_unavailable');
			reveal();
		}

		query.addEventListener('change', pref);
		return {
			pause() {
				for (const animation of animations) animation.pause();
			},
			resume() {
				if (!stopped && !query.matches) for (const animation of animations) animation.resume();
			},
			settle() {
				stopped = true;
				reveal();
			},
			destroy() {
				stopped = true;
				reveal();
				query.removeEventListener('change', pref);
			}
		};
	}
};
