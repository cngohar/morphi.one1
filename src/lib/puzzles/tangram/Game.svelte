<script module lang="ts">
	let coachSeen = false;
	let flipCoachSeen = false;
</script>

<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle } from '#lib/engine/theme/style.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { sound } from '#lib/ui/sound.js';
	import { TANGRAM_ENTRANCE_MS } from '#lib/round-timing.js';
	import { scoring as defaultScoring } from './scoring.js';
	import { tangramEnter } from './motion.js';
	import {
		applyTangramMove,
		tangramPiecePolygon,
		tangramPieces,
		tangramTray,
		tangramAvailablePieces,
		tangramArrivalAt,
		tangramScore,
		tangramWitness,
		TANGRAM_ACTION,
		type TangramRound,
		type TangramMove,
		type TangramPlacement,
		type TangramPoint
	} from './logic.js';

	let {
		round,
		roundNumber,
		scoring = defaultScoring.defaults,
		resolvedTheme = null,
		paused = false,
		rankedRound = false,
		entranceReady = true,
		resume,
		rankedStartedAt = null,
		registerCheckpoint,
		onready = () => {},
		onmove = () => {},
		oncomplete = () => {},
		onfinish,
		onhome,
		ontryanother
	}: {
		round: TangramRound;
		roundNumber: number;
		scoring?: ScoreValues;
		resolvedTheme?: ResolvedTheme | null;
		paused?: boolean;
		rankedRound?: boolean;
		entranceReady?: boolean;
		resume?: CheckpointState;
		rankedStartedAt?: number | null;
		registerCheckpoint?: (read: () => CheckpointState) => void;
		onready?: () => void;
		onmove?: (move: TangramMove) => void;
		oncomplete?: (score: number, seconds: number) => void;
		onfinish: (score: number, seconds: number, pieces: number, hints: number) => void;
		onhome: () => void;
		ontryanother?: () => void;
	} = $props();
	// svelte-ignore state_referenced_locally
	let game = $state(round);
	let phase = $state<'arrival' | 'playing' | 'finished' | 'failed'>('arrival');
	let selected = $state(-1);
	let draft = $state<TangramPlacement | null>(null);
	let elapsed = $state(0);
	let activeMs = $state(0);
	let flipCoach = $state(false);
	let previousAvailable: number[] = [];
	let announcement = $state('');
	let coach = $state(false);
	let peek = $state(false);
	let mounted = $state(false);
	let root: HTMLDivElement;
	let board: SVGSVGElement;
	let entered = false;
	let disposed = false;
	let clockBase = 0;
	let clockStart: number | null = null;
	let rankedStart: number | null = null;
	let ticker: ReturnType<typeof setInterval> | null = null;
	let entrance: ReturnType<typeof tangramEnter> | null = null;
	let feedback: ReturnType<typeof tangramEnter> | null = null;
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
	let motionFailed = false;
	let drag: {
		id: number;
		x: number;
		y: number;
		offsetX: number;
		offsetY: number;
		moved: boolean;
	} | null = null;
	const palette = ['#f2bd4f', '#ed7759', '#6a9c87', '#77a6bb', '#b996bf', '#e4aa63', '#7192a8'];
	const locked = $derived(phase !== 'playing' || paused || game.status !== 'playing');
	const placed = $derived(game.placements.filter(Boolean).length);
	const pieces = $derived(tangramPieces(game));
	const timed = $derived(game.rules.timeLimit > 0 || game.rules.falling);
	const available = $derived(tangramAvailablePieces(game, Math.max(0, game.lastAt, activeMs)));
	const remaining = $derived(
		Math.max(0, Math.ceil((game.rules.timeLimit * 1000 - activeMs) / 1000))
	);
	const hintsLeft = $derived(
		game.rules.hintLimit < 0 ? Infinity : Math.max(0, game.rules.hintLimit - game.hintsUsed)
	);
	const mistakesLeft = $derived(Math.max(0, game.rules.mistakeLimit - game.mistakes));
	const bounds = $derived(polygonBounds(game.silhouette.outline));
	const view = $derived({
		x: bounds.x - 0.65,
		y: bounds.y - 0.65,
		width: bounds.width + 1.3,
		height: bounds.height + 1.3
	});
	const trayPositions = $derived(tangramTray(game));
	const trayBounds = $derived(
		polygonBounds(trayPositions.flatMap((placement, piece) => polygon(piece, placement)))
	);
	const entranceDelay = createActiveDelay(() =>
		guard(() => {
			present(() => entrance?.settle());
			phase = 'playing';
			onready();
			startClock();
			if (flipCoach) {
				flipCoachSeen = true;
				try {
					localStorage.setItem('morphi.tangram.flipCoachSeen', '1');
				} catch {
					console.warn('morphi:tangram_coach_storage_unavailable');
				}
			}
			if (coach) {
				coachSeen = true;
				try {
					localStorage.setItem('morphi.tangram.coachSeen', '1');
				} catch {
					console.warn('morphi:tangram_coach_storage_unavailable');
				}
			}
		})
	);
	const finishDelay = createActiveDelay(() =>
		guard(() => onfinish(tangramScore(game, elapsed, scoring), elapsed, placed, game.hintsUsed))
	);
	const peekDelay = createActiveDelay(() => {
		peek = false;
	});

	// Projection is UI-only (§4A); exact polygons and committed coefficients come from the engine.
	const screenX = (point: TangramPoint) => (point.xp + point.xq * Math.SQRT2) / 4;
	const screenY = (point: TangramPoint) => (point.yp + point.yq * Math.SQRT2) / 4;
	const points = (polygon: readonly TangramPoint[]) =>
		polygon.map((point) => `${screenX(point)},${screenY(point)}`).join(' ');
	function polygonBounds(polygon: readonly TangramPoint[]) {
		const xs = polygon.map(screenX),
			ys = polygon.map(screenY);
		return {
			x: Math.min(...xs),
			y: Math.min(...ys),
			width: Math.max(...xs) - Math.min(...xs),
			height: Math.max(...ys) - Math.min(...ys)
		};
	}
	function polygon(piece: number, placement: TangramPlacement) {
		return tangramPiecePolygon(piece, placement, game.rules);
	}
	function name(piece: number) {
		const value = pieces[piece]!.name;
		const label = value.startsWith('tangram.') ? t(value as MessageKey) : value;
		return game.rules.copies > 1 ? `${label} · ${Math.floor(piece / 7) + 1}` : label;
	}
	function guard(action: () => void) {
		if (disposed) return;
		try {
			action();
		} catch {
			phase = 'failed';
			pauseClock();
			console.error('morphi:tangram_action_failed');
		}
	}
	function present(action: () => void) {
		if (motionFailed) return;
		try {
			action();
		} catch {
			motionFailed = true;
			for (const clip of [entrance, feedback])
				try {
					clip?.destroy();
				} catch {
					/* Logical deadlines still settle input. */
				}
			root.dataset.motionReady = 'true';
			for (const node of root.querySelectorAll<SVGElement>('.tan-motion')) {
				node.style.removeProperty('opacity');
				node.style.removeProperty('transform');
			}
			console.warn('morphi:tangram_motion_unavailable');
		}
	}
	function showFeedback(kind: Parameters<typeof tangramEnter>[1], piece = selected) {
		void tick().then(() => {
			if (disposed) return;
			present(() => {
				feedback?.destroy();
				feedback = tangramEnter(root, kind, piece);
			});
			if (feedbackTimer !== null) clearTimeout(feedbackTimer);
			feedbackTimer = setTimeout(
				() =>
					present(() => {
						feedback?.destroy();
						feedback = null;
					}),
				500
			);
		});
	}
	function clockMs() {
		return rankedRound
			? rankedStart === null
				? clockBase
				: Math.max(clockBase, performance.now() - rankedStart)
			: clockBase + (clockStart === null ? 0 : performance.now() - clockStart);
	}
	function startClock() {
		rankedStart ??= performance.now() - clockBase;
		clockStart ??= performance.now();
		updateClock();
		if (game.status === 'playing') ticker ??= setInterval(() => guard(updateClock), 100);
	}
	function updateClock() {
		activeMs = Math.max(0, game.lastAt, Math.floor(clockMs()));
		elapsed = Math.floor(activeMs / 1000);
		if (
			game.rules.timeLimit > 0 &&
			activeMs >= game.rules.timeLimit * 1000 &&
			phase === 'playing' &&
			!paused &&
			!document.hidden
		)
			perform({ action: TANGRAM_ACTION.tick });
	}
	function pauseClock() {
		if (clockStart !== null) {
			clockBase += performance.now() - clockStart;
			clockStart = null;
		}
		if (ticker !== null) clearInterval(ticker);
		ticker = null;
	}
	function perform(move: TangramMove) {
		if (locked || document.hidden) return;
		try {
			const before = game;
			if (timed) move = { ...move, at: Math.max(0, game.lastAt, Math.floor(clockMs())) };
			game = applyTangramMove(game, move);
			onmove(move);
			const accepted = game.placements.some(
				(position, piece) => position !== before.placements[piece]
			);
			if ('piece' in move && !('action' in move) && !accepted) {
				announcement = t('tangram.invalid');
				sound.play('invalid');
				showFeedback('mistake');
			} else if (move.action !== TANGRAM_ACTION.tick) {
				sound.play('action' in move && move.action === TANGRAM_ACTION.reset ? 'clear' : 'place');
				showFeedback('snap');
			}
			if (game.status === 'lost') {
				phase = 'finished';
				activeMs = Math.max(0, game.lastAt, Math.floor(clockMs()));
				elapsed = Math.floor(activeMs / 1000);
				pauseClock();
				cancelDrag();
				peek = false;
				peekDelay.cancel();
				announcement = t(game.rules.timeLimit > 0 ? 'tangram.timeUp' : 'tangram.mistakesOver');
				sound.play('invalid');
			} else if (game.status === 'won') {
				phase = 'finished';
				elapsed = Math.floor(clockMs() / 1000);
				pauseClock();
				selected = -1;
				draft = null;
				peek = false;
				oncomplete(tangramScore(game, elapsed, scoring), elapsed);
				announcement = t('tangram.won');
				sound.play('win');
				showFeedback('win');
				finishDelay.start(
					matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500,
					document.hidden || paused
				);
			}
		} catch (error) {
			if (error instanceof RangeError) {
				sound.play('invalid');
				announcement = t('tangram.invalid');
			} else
				guard(() => {
					throw error;
				});
		}
	}
	function choose(piece: number) {
		if (locked || document.hidden || !available.includes(piece)) return;
		selected = piece;
		draft = {
			...(game.placements[piece] ?? {
				xp: Math.round((bounds.x + bounds.width / 2) * 4),
				xq: 0,
				yp: Math.round((bounds.y + bounds.height / 2) * 4),
				yq: 0,
				rot: 0,
				flip: 0
			})
		};
		announcement = t('tangram.selected', { piece: name(piece) });
		sound.play('pick');
	}
	function lift() {
		if (selected >= 0 && game.placements[selected])
			perform({ action: TANGRAM_ACTION.remove, piece: selected });
	}
	function rotate(direction = 1) {
		if (locked || selected < 0 || !draft) return;
		lift();
		if (!draft || locked) return;
		draft = { ...draft, rot: (draft.rot + direction + 8) % 8 };
		showFeedback('rotate');
	}
	function flip() {
		if (locked || selected < 0 || !draft) return;
		if (!game.rules.flip) {
			announcement = t('tangram.flipForbidden');
			sound.play('invalid');
			return;
		}
		if (selected % 7 !== 6) {
			announcement = t('tangram.flipOnly');
			sound.play('invalid');
			return;
		}
		lift();
		if (!draft || locked) return;
		draft = { ...draft, flip: draft.flip ? 0 : 1 };
		showFeedback('flip');
	}
	function commit() {
		if (selected < 0 || !draft || locked) return;
		perform({ piece: selected, ...draft });
		selected = -1;
		draft = null;
	}
	function action(action: number) {
		if ((action === TANGRAM_ACTION.hint || action === TANGRAM_ACTION.peek) && hintsLeft === 0)
			return;
		perform({ action });
		selected = -1;
		draft = null;
	}
	function pointerPosition(event: PointerEvent) {
		const matrix = board.getScreenCTM();
		if (!matrix) return null;
		return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
	}
	function snapPosition(x: number, y: number): TangramPlacement {
		const oriented = { ...draft!, xp: 0, xq: 0, yp: 0, yq: 0 };
		const vertices = polygon(selected, oriented);
		const anchors = [
			...game.silhouette.outline,
			...game.placements.flatMap((position, piece) =>
				position && piece !== selected ? polygon(piece, position) : []
			)
		];
		const matrix = board.getScreenCTM();
		let nearest = matrix ? 24 / Math.hypot(matrix.a, matrix.b) : 0.3;
		let result = { ...draft!, xp: Math.round(x * 4), xq: 0, yp: Math.round(y * 4), yq: 0 };
		for (const anchor of anchors)
			for (const vertex of vertices) {
				const xp = anchor.xp - vertex.xp,
					xq = anchor.xq - vertex.xq,
					yp = anchor.yp - vertex.yp,
					yq = anchor.yq - vertex.yq;
				const distance = Math.hypot((xp + xq * Math.SQRT2) / 4 - x, (yp + yq * Math.SQRT2) / 4 - y);
				if (distance < nearest) {
					nearest = distance;
					result = { ...draft!, xp, xq, yp, yq };
				}
			}
		return result;
	}
	function pointerDown(event: PointerEvent, piece: number, source: 'board' | 'tray') {
		if (locked || drag || event.button !== 0 || !available.includes(piece)) return;
		if (selected !== piece || !draft) choose(piece);
		if (!draft) return;
		const position = pointerPosition(event);
		const center = polygonBounds(polygon(piece, { ...draft, xp: 0, xq: 0, yp: 0, yq: 0 }));
		drag = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			offsetX:
				source === 'board' && position ? position.x - screenX(draft) : center.x + center.width / 2,
			offsetY:
				source === 'board' && position ? position.y - screenY(draft) : center.y + center.height / 2,
			moved: false
		};
		try {
			root.setPointerCapture(event.pointerId);
			event.preventDefault();
		} catch {
			drag = null;
		}
	}
	function pointerMove(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId || locked) return;
		if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
		if (!drag.moved) lift();
		if (!drag || !draft || locked) return;
		drag.moved = true;
		const position = pointerPosition(event);
		if (position) draft = snapPosition(position.x - drag.offsetX, position.y - drag.offsetY);
	}
	function pointerEnd(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId) return;
		const previous = drag;
		drag = null;
		if (previous.moved) {
			const rect = board.getBoundingClientRect();
			if (
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom
			)
				commit();
			else {
				selected = -1;
				draft = null;
			}
		} else rotate();
	}
	function cancelDrag() {
		drag = null;
		selected = -1;
		draft = null;
	}
	function keyDown(event: KeyboardEvent) {
		if (locked || event.altKey || event.ctrlKey || event.metaKey) return;
		const key = event.key.toLowerCase();
		if (
			[
				'r',
				'f',
				'h',
				'enter',
				'arrowleft',
				'arrowright',
				'arrowup',
				'arrowdown',
				'escape'
			].includes(key)
		)
			event.preventDefault();
		else return;
		if (key === 'h') action(TANGRAM_ACTION.hint);
		else if (key === 'r') rotate(event.shiftKey ? -1 : 1);
		else if (key === 'f') flip();
		else if (key === 'enter') commit();
		else if (key === 'escape') cancelDrag();
		else if (draft && selected >= 0) {
			lift();
			if (!draft || locked) return;
			const horizontal = key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : 0;
			const vertical = key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0;
			draft = {
				...draft,
				xp: draft.xp + (event.shiftKey ? horizontal : 0),
				xq: draft.xq + (event.shiftKey ? 0 : horizontal),
				yp: draft.yp + (event.shiftKey ? vertical : 0),
				yq: draft.yq + (event.shiftKey ? 0 : vertical)
			};
		}
	}
	function syncVisibility() {
		cancelDrag();
		if (document.hidden || paused) {
			entranceDelay.pause();
			finishDelay.pause();
			peekDelay.pause();
			present(() => {
				entrance?.pause();
				feedback?.pause();
			});
			if (!rankedRound) pauseClock();
		} else {
			entranceDelay.resume();
			finishDelay.resume();
			peekDelay.resume();
			present(() => {
				entrance?.resume();
				feedback?.resume();
			});
			if (phase === 'playing') startClock();
		}
	}
	function resize() {
		cancelDrag();
		present(() => {
			entrance?.settle();
			feedback?.settle();
		});
	}
	$effect(() => {
		const ids = available;
		const playing = phase === 'playing';
		untrack(() => {
			if (mounted && playing && game.rules.falling)
				for (const piece of ids)
					if (!previousAvailable.includes(piece)) showFeedback('arrive', piece);
			previousAvailable = ids;
		});
	});
	$effect(() => {
		const value = paused;
		untrack(() => {
			if (mounted || value) syncVisibility();
		});
	});
	$effect(() => {
		if (!mounted || !entranceReady || entered) return;
		untrack(() => {
			entered = true;
			if (resume?.phase === 'playing' || resume?.phase === 'finished') {
				phase = game.status === 'playing' ? 'playing' : 'finished';
				onready();
				if (game.status === 'won') {
					oncomplete(tangramScore(game, elapsed, scoring), elapsed);
					finishDelay.start(0, document.hidden || paused);
				} else if (game.status === 'lost')
					announcement = t(game.rules.timeLimit > 0 ? 'tangram.timeUp' : 'tangram.mistakesOver');
				else if (!(document.hidden || paused)) startClock();
			} else {
				present(() => {
					entrance = tangramEnter(root);
				});
				entranceDelay.start(
					resume?.pending.entrance ??
						(matchMedia('(prefers-reduced-motion: reduce)').matches && !rankedRound
							? 0
							: TANGRAM_ENTRANCE_MS),
					document.hidden || paused
				);
			}
		});
	});
	onMount(() => {
		if (resume) {
			clockBase = resume.elapsedMs;
			activeMs = Math.max(0, game.lastAt, Math.floor(clockBase));
			elapsed = Math.floor(activeMs / 1000);
			if (resume.clockStarted)
				rankedStart =
					performance.now() -
					(rankedRound && rankedStartedAt !== null
						? Math.max(clockBase, Date.now() - rankedStartedAt)
						: clockBase);
		}
		try {
			coach = !coachSeen && localStorage.getItem('morphi.tangram.coachSeen') !== '1';
			flipCoach =
				!game.rules.flip &&
				!flipCoachSeen &&
				localStorage.getItem('morphi.tangram.flipCoachSeen') !== '1';
		} catch {
			coach = !coachSeen;
			flipCoach = !game.rules.flip && !flipCoachSeen;
		}
		registerCheckpoint?.(() => {
			const pending: Record<string, number> = {};
			const entrance = entranceDelay.remaining();
			if (entrance !== null) pending.entrance = entrance;
			return { phase, elapsedMs: clockMs(), clockStarted: rankedStart !== null, pending };
		});
		mounted = true;
		document.addEventListener('visibilitychange', syncVisibility);
		window.addEventListener('resize', resize);
		window.addEventListener('blur', cancelDrag);
		return () => {
			disposed = true;
			document.removeEventListener('visibilitychange', syncVisibility);
			window.removeEventListener('resize', resize);
			window.removeEventListener('blur', cancelDrag);
			pauseClock();
			entranceDelay.cancel();
			finishDelay.cancel();
			peekDelay.cancel();
			if (feedbackTimer !== null) clearTimeout(feedbackTimer);
			present(() => {
				entrance?.destroy();
				feedback?.destroy();
			});
		};
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="game tangram-game"
	role="group"
	aria-label={t('v1.game.tangram')}
	data-family="tangram"
	data-round={roundNumber}
	data-phase={phase}
	data-seed={game.seed}
	style={resolvedTheme ? themeStyle(resolvedTheme) : ''}
	bind:this={root}
	onkeydown={keyDown}
	onpointermove={pointerMove}
	onpointerup={pointerEnd}
	onpointercancel={cancelDrag}
	onlostpointercapture={() => {
		if (drag) cancelDrag();
	}}
>
	<section class="tangram-board-panel" aria-label={t('tangram.board')}>
		<header class="board-heading">
			<h2>{game.silhouette.name}</h2>
			<span>{t('tangram.placed', { count: placed, total: game.placements.length })}</span>
		</header>
		<div class="board-space">
			<svg
				class="tangram-board"
				bind:this={board}
				viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
				role="group"
				aria-label={t('tangram.board')}
			>
				{#if game.rules.fullSize}<polygon
						class="silhouette"
						points={points(game.silhouette.outline)}
					/>
				{:else}<rect
						class="build-workspace"
						x={view.x}
						y={view.y}
						width={view.width}
						height={view.height}
					/>{/if}
				{#if game.rules.fullSize && (peek || game.rules.map)}{#each tangramWitness(game) as placement (placement.piece)}<polygon
							class="peek-piece"
							class:map-piece={game.rules.map}
							points={points(polygon(placement.piece, placement))}
							fill={palette[placement.piece % palette.length]}
						/>{/each}{/if}
				{#each [...game.placements.keys()].sort((a, b) => Number(a === selected) - Number(b === selected)) as piece (piece)}
					{@const placement = game.placements[piece]}
					{#if placement || (piece === selected && draft)}
						{@const position = piece === selected && draft ? draft : placement!}
						<g
							role="button"
							data-piece={piece}
							data-xp={position.xp}
							data-xq={position.xq}
							data-yp={position.yp}
							data-yq={position.yq}
							data-rot={position.rot}
							data-flip={position.flip}
							tabindex={locked ? -1 : 0}
							aria-label={name(piece)}
							onfocus={() => {
								if (selected !== piece) choose(piece);
							}}
							onpointerdown={(event) => pointerDown(event, piece, 'board')}
						>
							<g class="tan-motion" data-piece-motion={piece}
								><polygon
									class="tan"
									class:selected={selected === piece}
									points={points(polygon(piece, position))}
									fill={palette[piece % palette.length]}
								/></g
							>
						</g>
					{/if}{/each}
			</svg>
			{#if !game.rules.fullSize}<svg
					class="tangram-reference"
					viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
					role="img"
					aria-label={t('tangram.smallReference')}
				>
					<polygon class="silhouette" points={points(game.silhouette.outline)} />
					{#if peek}{#each tangramWitness(game) as placement (placement.piece)}<polygon
								class="peek-piece"
								points={points(polygon(placement.piece, placement))}
								fill={palette[placement.piece % palette.length]}
							/>{/each}{/if}
				</svg>{/if}
		</div>
		<p class="board-caption">{t('tangram.boardHint')}</p>
	</section>
	<aside class="tangram-rail">
		<header class="tangram-stats">
			<div>
				<span>{t('game.score')}</span><strong
					>{formatNumber(tangramScore(game, elapsed, scoring))}</strong
				>
			</div>
			<div data-countdown={game.rules.timeLimit > 0 ? remaining : undefined}>
				<span>{t(game.rules.timeLimit > 0 ? 'tangram.timeLeft' : 'game.time')}</span><strong
					>{formatDuration(game.rules.timeLimit > 0 ? remaining : elapsed)}</strong
				>
			</div>
			<div data-hints-left={Number.isFinite(hintsLeft) ? hintsLeft : undefined}>
				<span>{t(Number.isFinite(hintsLeft) ? 'tangram.hintsLeft' : 'tangram.hints')}</span><strong
					>{Number.isFinite(hintsLeft) ? hintsLeft : game.hintsUsed}</strong
				>
			</div>
			{#if game.rules.mistakeLimit > 0}<div data-mistakes-left={mistakesLeft}>
					<span>{t('tangram.mistakesLeft')}</span><strong>{mistakesLeft}</strong>
				</div>{/if}
		</header>
		<section class="tray-panel" aria-label={t('tangram.tray')}>
			<header>
				<h3>
					{t('tangram.tray')}{#if game.rules.falling}
						<small>{available.length}/{pieces.length}</small>{/if}
				</h3>
			</header>
			<svg
				class="tangram-tray"
				viewBox={`${trayBounds.x - 0.2} ${trayBounds.y - 0.2} ${trayBounds.width + 0.4} ${trayBounds.height + 0.4}`}
				role="group"
				aria-label={t('tangram.tray')}
			>
				{#each trayPositions as placement, piece (piece)}
					<g
						role="button"
						data-piece={piece}
						data-arrived={available.includes(piece)}
						data-arrival-at={tangramArrivalAt(game, piece)}
						class:tan-pending={!available.includes(piece)}
						tabindex={locked || !available.includes(piece) ? -1 : 0}
						aria-label={name(piece)}
						aria-disabled={locked || !available.includes(piece)}
						class:used={!!game.placements[piece]}
						class:chosen={selected === piece}
						onfocus={() => {
							if (selected !== piece) choose(piece);
						}}
						onpointerdown={(event) => pointerDown(event, piece, 'tray')}
						onkeydown={(event) => {
							if (event.key === ' ' || (event.key === 'Enter' && selected !== piece)) {
								event.preventDefault();
								choose(piece);
								event.stopPropagation();
							}
						}}
					>
						<g class="tan-motion" data-piece-motion={piece}
							><polygon
								class="tan"
								points={points(polygon(piece, placement))}
								fill={palette[piece % palette.length]}
							/></g
						>
					</g>
				{/each}
			</svg>
		</section>
		<section class="tangram-tools" aria-label={t('tangram.tools')}>
			<button disabled={locked || selected < 0 || !game.rules.flip} onclick={flip}
				>{t('tangram.flip')} <kbd>F</kbd></button
			><button disabled={locked || hintsLeft === 0} onclick={() => action(TANGRAM_ACTION.hint)}
				>{t('tangram.hint')} <kbd>H</kbd></button
			>
			<button
				disabled={locked || hintsLeft === 0}
				onclick={() => {
					if (!peek) {
						perform({ action: TANGRAM_ACTION.peek });
						peek = true;
						peekDelay.start(2000, document.hidden || paused);
					} else {
						peek = false;
						peekDelay.cancel();
					}
				}}>{t('tangram.peek')}</button
			><button disabled={locked} onclick={() => action(TANGRAM_ACTION.reset)}
				>{t('tangram.reset')}</button
			>
		</section>
		{#if flipCoach}<p class="tangram-coach" data-flip-coach>
				{t('tangram.flipCoach')}
			</p>{:else if coach}<p class="tangram-coach" data-hint-coach>{t('tangram.coach')}</p>{/if}
		<p class="tangram-status" aria-live="polite" aria-atomic="true">{announcement}</p>
		{#if game.status === 'lost'}<div class="tangram-over" role="status">
				<strong>{t(game.rules.timeLimit > 0 ? 'tangram.timeUp' : 'tangram.mistakesOver')}</strong
				><button onclick={() => guard(ontryanother ?? onhome)}>{t('v1.nav.another')}</button>
			</div>{/if}
		{#if phase === 'failed'}<p role="alert">{t('tangram.error')}</p>
			<button onclick={onhome}>{t('game.home')}</button>{/if}
	</aside>
</div>

<style>
	:global(.design-public .active-round[data-family='tangram'] .game.tangram-game) {
		width: 100%;
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 24px;
		padding: 18px;
	}
	.tangram-board-panel {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-right: 1px solid var(--round-edge, #ddd);
		padding-right: 24px;
	}
	.board-heading,
	.tray-panel > header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	h2,
	h3,
	p {
		margin: 0;
	}
	h2 {
		font-size: clamp(16px, 2vw, 24px);
	}
	h3 {
		font-size: 15px;
	}
	.board-heading span,
	.board-caption {
		font-size: 11px;
		color: var(--ink-2);
	}
	.board-space {
		position: relative;
		flex: 1 1 0;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tangram-board {
		width: 100%;
		height: 100%;
		overflow: visible;
		touch-action: none;
	}
	.silhouette {
		fill: color-mix(in srgb, var(--ink) 18%, var(--round-bg));
		stroke: color-mix(in srgb, var(--ink) 35%, transparent);
		stroke-width: 0.015;
	}
	.tan {
		stroke: var(--round-bg, #fff);
		stroke-width: 0.015;
		stroke-linejoin: round;
		cursor: grab;
	}
	.selected,
	.chosen .tan {
		stroke: #ed8c23;
		stroke-width: 0.055;
		filter: drop-shadow(0 0.06px 0.07px #0003);
	}
	.tangram-reference {
		position: absolute;
		right: 8px;
		top: 8px;
		width: 96px;
		height: 96px;
		padding: 4px;
		border: 1px solid var(--round-edge);
		border-radius: 8px;
		background: var(--round-bg);
		pointer-events: none;
	}
	.build-workspace {
		fill: none;
		stroke: var(--round-edge);
		stroke-width: 0.015;
		stroke-dasharray: 0.07 0.07;
	}
	.tan-pending {
		visibility: hidden;
		pointer-events: none;
	}
	.tangram-over {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		font-size: 12px;
	}
	.peek-piece {
		opacity: 0.4;
		stroke: var(--round-bg);
		stroke-width: 0.02;
		pointer-events: none;
	}
	g:focus-visible {
		outline: none;
	}
	g:focus-visible .tan {
		stroke: var(--focus, #ed8c23);
		stroke-width: 0.07;
	}
	.tan-motion {
		transform-box: fill-box;
		transform-origin: center;
	}
	.tangram-rail {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-bottom: 72px;
	}
	.tangram-stats {
		display: flex;
		justify-content: space-around;
		gap: 8px;
		flex-shrink: 0;
	}
	.tangram-stats div {
		display: flex;
		flex-direction: column;
		text-align: center;
		gap: 3px;
	}
	.tangram-stats span {
		font-size: 10px;
		color: var(--ink-2);
		text-transform: uppercase;
	}
	.tangram-stats strong {
		font-size: 22px;
	}
	.tray-panel {
		flex: 1 1 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	button {
		min-height: 44px;
		border: 1px solid var(--round-edge);
		border-radius: 10px;
		padding: 7px 10px;
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		background: var(--round-bg);
		color: var(--ink);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.tangram-tray {
		width: 100%;
		height: 100%;
		flex: 1 1 0;
		min-height: 0;
		touch-action: none;
	}
	.used {
		opacity: 0.18;
	}
	.used .tan {
		cursor: pointer;
	}
	.tangram-tools {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
		flex-shrink: 0;
	}
	kbd {
		font: inherit;
		font-size: 10px;
		opacity: 0.6;
	}
	.tangram-coach,
	.tangram-status {
		font-size: 11px;
		line-height: 1.4;
	}
	.tangram-status {
		min-height: 15px;
		color: var(--ink-2);
	}
	.tangram-game[data-phase='arrival']:not([data-motion-ready='true']) .tangram-tray .tan-motion {
		opacity: 0;
	}
	@media (max-width: 600px) and (orientation: portrait) {
		:global(.design-public .active-round[data-family='tangram'] .game.tangram-game) {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 0.75fr) minmax(0, 1.25fr);
			gap: 10px;
			padding: 10px;
		}
		.tangram-board-panel {
			border: 0;
			padding: 0;
			gap: 2px;
		}
		.board-caption {
			display: none;
		}
		.tangram-rail {
			gap: 6px;
			padding-bottom: 60px;
		}
		.tangram-stats strong {
			font-size: 16px;
		}
		.tangram-stats span {
			font-size: 9px;
		}
		.tangram-stats div {
			flex-direction: row;
			align-items: baseline;
			gap: 4px;
		}
		.tray-panel {
			gap: 3px;
		}
		.tangram-tools {
			gap: 4px;
		}
		button {
			font-size: 11px;
			padding: 5px 6px;
		}
		.tangram-coach {
			font-size: 10px;
		}
		.tangram-status {
			font-size: 10px;
			min-height: 12px;
		}
		h3 {
			font-size: 12px;
		}
	}
	@media (orientation: landscape) and (max-height: 560px) {
		:global(.design-public .active-round[data-family='tangram'] .game.tangram-game) {
			grid-template-columns: minmax(0, 57fr) minmax(0, 43fr);
			gap: 12px;
			padding: 8px;
		}
		.tangram-board-panel {
			padding-right: 12px;
			gap: 2px;
		}
		.board-caption {
			display: none;
		}
		.board-heading h2 {
			font-size: 16px;
		}
		.tangram-rail {
			gap: 4px;
			padding-bottom: 48px;
		}
		.tangram-stats strong {
			font-size: 14px;
		}
		.tangram-stats span {
			font-size: 8px;
		}
		.tangram-stats div {
			flex-direction: row;
			align-items: baseline;
			gap: 4px;
		}
		.tray-panel {
			gap: 2px;
		}
		h3 {
			font-size: 11px;
		}
		button {
			min-height: 34px;
			padding: 4px 6px;
			font-size: 10px;
		}
		.tangram-tools {
			gap: 4px;
		}
		kbd {
			display: none;
		}
		.tangram-coach {
			font-size: 9px;
			line-height: 1.2;
		}
		.tangram-status {
			font-size: 9px;
			min-height: 11px;
		}
	}
</style>
