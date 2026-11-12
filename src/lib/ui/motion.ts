/** All application anime.js use lives here. Presentation never commits moves. */
import { animate, createTimeline, scrambleText, type JSAnimation } from 'animejs';
const reduced = () =>
	typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** One frame changes size; puzzle contents retain their own entrance. Absolute beats only. */
export interface CardScene {
	root: HTMLElement;
	frame: HTMLElement;
	card: HTMLElement;
	content: HTMLElement | null;
	backdrop: HTMLElement | null;
	stack: HTMLElement;
	stackIndex: number;
	result: HTMLElement | null;
	score: HTMLElement | null;
}
export function cardSceneMotion(
	scene: CardScene,
	phase: 'deal' | 'flip' | 'unfold' | 'fold' | 'result' | 'result-exit',
	staticMode = false,
	exitFrom?: { opacity: number; translateY: number }
) {
	let timeline: ReturnType<typeof createTimeline> | undefined;
	const { root, frame: board, card, result } = scene;
	const originalStyle = board.getAttribute('style');
	const cardStyle = card.getAttribute('style');
	const resultStyle = result?.getAttribute('style') ?? null;
	const textRestores: (() => void)[] = [];
	const restoreText = () => {
		for (const restore of textRestores.splice(0)) restore();
	};
	const restore = () => {
		timeline?.revert();
		restoreText();
		if (originalStyle === null) board.removeAttribute('style');
		else board.setAttribute('style', originalStyle);
		if (cardStyle === null) card.removeAttribute('style');
		else card.setAttribute('style', cardStyle);
		if (result) {
			if (resultStyle === null) result.removeAttribute('style');
			else result.setAttribute('style', resultStyle);
		}
	};
	if (!staticMode && !reduced())
		try {
			timeline = createTimeline({ autoplay: false, onComplete: restoreText });
			const content = scene.content;
			const css = getComputedStyle(root);
			const cardWidth = parseFloat(css.getPropertyValue('--card-width')) || 160;
			const cardHeight = parseFloat(css.getPropertyValue('--card-height')) || 214;
			if (phase === 'deal') {
				// Each new Card arrives from a fresh viewport edge, independently of puzzle RNG.
				const entropy = crypto.getRandomValues(new Uint32Array(3));
				const side = entropy[0] % 4;
				const along = 0.15 + (entropy[1] / 4294967296) * 0.7;
				const center = board.getBoundingClientRect();
				const insetX = Math.min(cardWidth / 2 + 12, innerWidth / 4);
				const insetY = Math.min(cardHeight / 2 + 12, innerHeight / 4);
				const x = side < 2 ? (side === 0 ? insetX : innerWidth - insetX) : innerWidth * along;
				const y = side >= 2 ? (side === 2 ? insetY : innerHeight - insetY) : innerHeight * along;
				const fromX = x - center.left - center.width / 2;
				const fromY = y - center.top - center.height / 2;
				const rotation = (entropy[2] % 71) - 35;
				// Set the origin before the first paint, including when Next cancels a result reveal.
				board.style.transform = `translateX(${fromX}px) translateY(${fromY}px) rotate(${rotation}deg) scaleX(1) scaleY(1)`;
				board.style.opacity = '0';
				timeline.add(
					board,
					{
						translateX: [fromX, 0],
						translateY: [fromY, 0],
						rotate: [rotation, -5],
						opacity: [0, 1],
						duration: 650,
						ease: 'outCubic'
					},
					0
				);
			}
			if (phase === 'flip')
				timeline.add(
					card.firstElementChild!,
					{ rotateY: [0, 180], duration: 400, ease: 'inOutCubic' },
					0
				);
			if (phase === 'unfold') {
				const target = board.getBoundingClientRect();
				// Set the starting geometry synchronously: never paint the full board then shrink it.
				board.style.width = `${cardWidth}px`;
				board.style.height = `${cardHeight}px`;
				// Explicitly reset every channel: Anime retains parsed transforms across phases.
				board.style.transform = 'translateX(0px) translateY(0px) rotate(-5deg) scaleX(1) scaleY(1)';
				timeline.add(
					board,
					{
						width: [cardWidth, target.width],
						height: [cardHeight, target.height],
						rotate: [-5, 0],
						duration: 800,
						ease: 'inOutCubic'
					},
					0
				);
				timeline.add(card, { opacity: [1, 0], duration: 240, ease: 'outCubic' }, 400);
				if (scene.backdrop)
					timeline.add(
						scene.backdrop!,
						{ opacity: [0, 0.2], duration: 300, ease: 'outCubic' },
						500
					);
			}
			if (phase === 'fold') {
				board.style.transform = 'translateX(0px) translateY(0px) rotate(0deg) scaleX(1) scaleY(1)';
				const source = board.getBoundingClientRect();
				const target = scene.stack.getBoundingClientRect();
				const index = scene.stackIndex;
				card.style.opacity = '0';
				if (content) timeline.add(content, { opacity: [1, 0], duration: 100 }, 0);
				timeline.add(
					board,
					{
						width: [source.width, cardWidth],
						height: [source.height, cardHeight],
						rotate: [0, -6],
						duration: 250,
						ease: 'inOutCubic'
					},
					0
				);
				timeline.add(card, { opacity: [0, 1], duration: 110 }, 110);
				timeline.add(
					board,
					{
						left: [0, target.x + target.width / 2 + index * 2 - source.x - source.width / 2],
						top: [0, target.y + target.height / 2 - index - source.y - source.height / 2],
						scaleX: [1, target.width / cardWidth],
						scaleY: [1, target.height / cardHeight],
						rotate: [-6, index * 3 - 9],
						duration: 250,
						ease: 'inOutCubic'
					},
					250
				);
			}
			if (phase === 'result' && result) {
				// Start under the hidden result, before its first visible paint.
				result.style.opacity = '0';
				result.style.transform = 'translateY(20px)';
				timeline.add(
					result,
					{
						opacity: [0, 1],
						translateY: [20, 0],
						duration: 420,
						ease: 'outCubic'
					},
					0
				);
				// Only the large earned score animates; every label, stat and high score stays static.
				const targets = scene.score ? [scene.score] : [];
				for (const target of targets) {
					const finalText = target.textContent ?? '';
					const children = [...target.childNodes];
					const wrap = document.createElement('span');
					wrap.className = 'scramble-wrap';
					const source = document.createElement('span');
					source.className = 'scramble-source';
					source.textContent = finalText;
					const visual = document.createElement('span');
					visual.className = 'scramble-visual';
					visual.setAttribute('aria-hidden', 'true');
					visual.textContent = finalText.replace(/\S/g, 'X');
					wrap.appendChild(source);
					wrap.appendChild(visual);
					target.replaceChildren(wrap);
					textRestores.push(() => target.replaceChildren(...children));
					const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
					timeline.add(
						visual,
						{
							innerHTML: scrambleText({
								text: finalText,
								chars: 'numbers',
								override: true,
								seed,
								duration: 500,
								settleDuration: 500
							}),
							duration: 500,
							ease: 'linear'
						},
						0
					);
				}
			}

			if (phase === 'result-exit' && result) {
				result.style.opacity = String(exitFrom?.opacity ?? 1);
				result.style.transform = `translateY(${exitFrom?.translateY ?? 0}px)`;
				timeline.add(
					result,
					{
						opacity: [exitFrom?.opacity ?? 1, 0],
						translateY: [exitFrom?.translateY ?? 0, -18],
						duration: 350,
						ease: 'inCubic'
					},
					0
				);
			}

			if (!document.hidden) timeline.play();
		} catch {
			restore();
			console.warn('morphi:card_motion_unavailable');
		}
	return {
		destroy: restore,
		resultFrame: () => {
			if (!result) return { opacity: 1, translateY: 0 };
			const style = getComputedStyle(result);
			return {
				opacity: Number(style.opacity),
				translateY: style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42
			};
		},
		pause: () => {
			if (timeline && !timeline.completed) timeline.pause();
		},
		resume: () => {
			if (timeline && !timeline.completed) timeline.resume();
		}
	};
}

/** Isolated reference adapter; the app supplies its own typed scene elements. */
export function cardProofMotion(
	root: HTMLElement,
	phase: Parameters<typeof cardSceneMotion>[1],
	staticMode = false,
	exitFrom?: { opacity: number; translateY: number }
) {
	return cardSceneMotion(
		{
			root,
			frame: root.querySelector<HTMLElement>('.proof-board')!,
			card: root.querySelector<HTMLElement>('.proof-card')!,
			content: root.querySelector<HTMLElement>('.proof-content'),
			backdrop: root.querySelector<HTMLElement>('.proof-scatter'),
			stack: root.querySelector<HTMLElement>('.stack-cards')!,
			stackIndex: Number(root.dataset.stackIndex ?? 0),
			result: root.querySelector<HTMLElement>('.proof-result-inner'),
			score: root.querySelector<HTMLElement>('.sample-score')
		},
		phase,
		staticMode,
		exitFrom
	);
}

export const motion = {
	/** Connect's 2.5 s centre ripple and pair-by-pair dot arrival. Logical readiness is external. */
	connectEnter(board: HTMLElement) {
		let timeline: ReturnType<typeof createTimeline> | null = null;
		const cells = [...board.querySelectorAll<HTMLElement>('.connect-cell')];
		const dots = [...board.querySelectorAll<HTMLElement>('.connect-dot')];
		const size = Number(board.style.getPropertyValue('--size')) || 5;
		const title = board.closest('.active-round')?.querySelector<HTMLElement>('.puzzle-name');
		const settle = () => {
			timeline?.revert();
			for (const node of [...cells, ...dots, ...(title ? [title] : [])]) {
				node.style.removeProperty('opacity');
				node.style.removeProperty('transform');
			}
		};
		try {
			if (!reduced()) {
				timeline = createTimeline({ autoplay: false });
				if (title)
					timeline.add(
						title,
						{ opacity: [0, 1], translateY: [12, 0], duration: 600, ease: 'outCubic' },
						120
					);
				for (let cell = 0; cell < cells.length; cell++) {
					const row = Math.floor(cell / size),
						column = cell % size;
					const distance = Math.abs(row - (size - 1) / 2) + Math.abs(column - (size - 1) / 2);
					timeline.add(
						cells[cell]!,
						{ opacity: [0, 1], scale: [0.78, 1], duration: 430, ease: 'outCubic' },
						160 + distance * 180
					);
				}
				for (const dot of dots) {
					const pair = Number(dot.dataset.pair ?? 0);
					timeline.add(
						dot,
						{ opacity: [0, 1], scale: [0.35, 1.16, 1], duration: 320, ease: 'outCubic' },
						1300 + pair * 110
					);
					const ring = dot.querySelector<HTMLElement>('.connect-ring');
					if (ring)
						timeline.add(
							ring,
							{ opacity: [0.6, 0], scale: [0.55, 1.8], duration: 450, ease: 'outCubic' },
							1300 + pair * 110
						);
				}
				if (!document.hidden) timeline.play();
			}
		} catch {
			settle();
			console.warn('morphi:connect_entrance_unavailable');
		}
		return {
			settle,
			pause: () => timeline?.pause(),
			resume: () => timeline?.resume(),
			destroy: settle
		};
	},
	connectPaths(board: HTMLElement, previous: number[][], current: number[][]) {
		if (reduced()) return;
		try {
			const svg = board.querySelector<SVGSVGElement>('.connect-lines');
			if (!svg) return;
			for (let pair = 0; pair < current.length; pair++) {
				const oldPath = previous[pair] ?? [],
					nextPath = current[pair] ?? [];
				if (oldPath.length === nextPath.length && oldPath.every((cell, i) => cell === nextPath[i]))
					continue;
				const line = svg.querySelector<SVGPolylineElement>(`polyline[data-pair="${pair}"]`);
				if (nextPath.length > oldPath.length && line) {
					const total = line.getTotalLength();
					const segment = Math.max(1, total / Math.max(1, nextPath.length - 1));
					line.style.strokeDasharray = `${total} ${total}`;
					line.style.strokeDashoffset = String(segment);
					animate(line, {
						strokeDashoffset: [segment, 0],
						duration: 150,
						ease: 'outCubic',
						onComplete: () => {
							line.style.removeProperty('stroke-dasharray');
							line.style.removeProperty('stroke-dashoffset');
						}
					});
				} else if (oldPath.length > nextPath.length) {
					const size = Number(board.style.getPropertyValue('--size')) || 5;
					const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
					overlay.setAttribute(
						'points',
						oldPath
							.map(
								(cell) => `${((cell % size) + 0.5) * 100},${(Math.floor(cell / size) + 0.5) * 100}`
							)
							.join(' ')
					);
					overlay.setAttribute('fill', 'none');
					overlay.setAttribute(
						'stroke',
						line?.getAttribute('stroke') ??
							getComputedStyle(
								board.querySelector<HTMLElement>(`.connect-dot[data-pair="${pair}"]`) ?? board
							).backgroundColor
					);
					overlay.setAttribute('stroke-width', '24');
					overlay.setAttribute('stroke-linejoin', 'round');
					overlay.setAttribute('stroke-linecap', 'round');
					svg.appendChild(overlay);
					animate(overlay, {
						opacity: [1, 0],
						duration: Math.min(700, 210 * (oldPath.length - nextPath.length)),
						ease: 'outCubic',
						onComplete: () => overlay.remove()
					});
				}
			}
			for (const counter of board.closest('.game')?.querySelectorAll<HTMLElement>('.stat strong') ??
				[])
				animate(counter, { scale: [1, 1.06, 1], duration: 240, ease: 'outCubic' });
		} catch {
			console.warn('morphi:connect_path_motion_unavailable');
		}
	},
	connectFeedback(
		board: HTMLElement,
		kind: 'pair' | 'cut' | 'redraw' | 'win',
		pair: number,
		deltaText = ''
	) {
		if (reduced()) return;
		try {
			if (kind === 'win') {
				const cells = [...board.querySelectorAll<HTMLElement>('.connect-cell')];
				for (const [index, cell] of cells.entries())
					animate(cell, { opacity: [0.6, 1], duration: 260, delay: index * 14, ease: 'outCubic' });
				return;
			}
			const targets = [...board.querySelectorAll<HTMLElement>(`.connect-dot[data-pair="${pair}"]`)];
			for (const target of targets)
				animate(target, {
					scale: kind === 'pair' ? [1, 1.2, 1] : [1, 0.88, 1],
					duration: kind === 'redraw' ? 420 : 300,
					ease: 'outCubic'
				});
			if (deltaText && targets.length) {
				const label = document.createElement('span');
				label.className = 'connect-float';
				label.textContent = deltaText;
				const point = targets[0]!.getBoundingClientRect(),
					base = board.getBoundingClientRect();
				label.style.left = `${point.left + point.width / 2 - base.left}px`;
				label.style.top = `${point.top - base.top}px`;
				label.style.color =
					kind === 'redraw' ? 'var(--danger)' : getComputedStyle(targets[0]!).backgroundColor;
				board.appendChild(label);
				animate(label, {
					opacity: [0, 1, 0],
					translateY: [5, -26],
					duration: 650,
					ease: 'outCubic',
					onComplete: () => label.remove()
				});
			}
		} catch {
			console.warn('morphi:connect_feedback_unavailable');
		}
	},
	loadingCard(node: HTMLElement) {
		if (reduced()) return () => {};
		let animation: JSAnimation | undefined;
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const stop = () => {
			animation?.revert();
		};
		try {
			animation = animate(node, {
				translateY: [0, -8],
				rotate: [-3, 3],
				duration: 900,
				alternate: true,
				loop: true,
				ease: 'inOutSine'
			});
		} catch {
			console.warn('morphi:loading_motion_unavailable');
		}
		query.addEventListener('change', stop);
		return () => {
			stop();
			query.removeEventListener('change', stop);
		};
	},
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
			background: 'transparent',
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
	explainer(root: HTMLElement, step: number, staticMode = false) {
		if (staticMode || reduced()) return () => {};
		const animations: JSAnimation[] = [];
		try {
			const content = root.querySelector<HTMLElement>('.scene-content');
			if (content)
				animations.push(
					animate(content, {
						opacity: [0, 1],
						translateY: [14, 0],
						duration: 420,
						ease: 'outCubic'
					})
				);
			for (const [index, tile] of [
				...root.querySelectorAll<HTMLElement>('.abstract-board i, .mysteries i')
			].entries())
				animations.push(
					animate(tile, {
						scale: [step === 3 ? 0.4 : 0.75, 1],
						opacity: [0, 1],
						delay: 80 + index * 45,
						duration: 450,
						ease: 'outCubic'
					})
				);
		} catch {
			for (const animation of animations) animation.revert();
			console.warn('morphi:explainer_motion_unavailable');
		}
		return () => {
			for (const animation of animations) animation.revert();
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
