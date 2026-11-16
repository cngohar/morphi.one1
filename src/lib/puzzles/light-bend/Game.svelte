<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle } from '#lib/engine/theme/style.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { sound } from '#lib/ui/sound.js';
	import { LIGHT_BEND_ENTRANCE_MS } from '#lib/round-timing.js';
	import { scoring as defaultScoring } from './scoring.js';
	import { lightBendEnter } from './motion.js';
	import {
		applyLightBendMove,
		lightBendHints,
		lightBendScore,
		lightBendStarGrade,
		LIGHT_BEND_ACTION,
		LIGHT_BEND_CELL,
		LIGHT_BEND_COUNTDOWN,
		type LightBendMove,
		type LightBendRound
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
		round: LightBendRound;
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
		onmove?: (move: LightBendMove) => void;
		oncomplete?: (score: number, seconds: number) => void;
		onfinish: (score: number, seconds: number, crystals: number, hints: number) => void;
		onhome: () => void;
		ontryanother?: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let game = $state(round);
	let phase = $state<'arrival' | 'playing' | 'finished' | 'failed'>('arrival');
	let elapsed = $state(0);
	let activeMs = $state(0);
	let announcement = $state('');
	let over = $state(false);
	let mounted = $state(false);
	let root: HTMLDivElement;
	let board: SVGSVGElement;
	let entered = false;
	let clockBase = 0;
	let clockStart: number | null = null;
	let rankedStart: number | null = null;
	let ticker: ReturnType<typeof setInterval> | null = null;
	let entrance: ReturnType<typeof lightBendEnter> | null = null;
	let feedback: ReturnType<typeof lightBendEnter> | null = null;
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	// Pan/zoom viewport (§6 demo reference: drag pans, wheel/pinch zooms at the gesture).
	let offsetX = $state(0);
	let offsetY = $state(0);
	let zoom = $state(1);
	let drag: {
		id: number;
		x: number;
		y: number;
		startX: number;
		startY: number;
		moved: boolean;
		cell: number;
	} | null = null;
	const pointers = new SvelteSet<number>();
	let cancelledTap = false;
	let pinching: { distance: number; zoom: number } | null = null;
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let selection = $state(-1);

	const CELL = 64;
	const TAP_SLOP_PX = 12;
	const MIN_PLAYABLE_SCALE = 44 / 64;
	const locked = $derived(phase !== 'playing' || paused || game.status !== 'playing');
	const placeYourOwn = $derived(game.rules.mirror === 1);
	const hintsLeft = $derived(Math.max(0, lightBendHints(game.rules) - game.hintsUsed));
	const tray = $derived(game.tray);
	const crystals = $derived(game.crystalCells.length);
	const lit = $derived(popcount(game.lit));
	const timed = $derived(game.rules.limit === 1);
	const remaining = $derived(Math.max(0, LIGHT_BEND_COUNTDOWN - activeMs / 1000));
	const stars = $derived(game.status === 'won' ? lightBendStarGrade(game) : 0);

	// Fit-to-viewport scale, then the user's zoom multiplies it. Never below the
	// 44 px tap target the layout contract requires.
	const baseScale = $derived.by(() => {
		if (viewportWidth === 0 || viewportHeight === 0) return 1;
		const fit = Math.min(
			viewportWidth / (game.width * CELL + 24),
			viewportHeight / (game.height * CELL + 24)
		);
		return Math.max(MIN_PLAYABLE_SCALE, fit);
	});
	/**
	 * L6: the Fit floor is absolute — no zoom level may shrink a cell below 44 px.
	 * `minZoom` is the user zoom that lands exactly on the floor for this board.
	 */
	const minZoom = $derived(MIN_PLAYABLE_SCALE / baseScale);
	const scale = $derived(baseScale * Math.max(minZoom, zoom));
	/**
	 * Centre on the playable content, not the raw board rectangle. A board wider
	 * than the viewport centred geometrically pushes the leftmost mirror off
	 * screen; the opening view must show every interactive cell (L6).
	 */
	const contentCentre = $derived.by(() => {
		const cells: number[] = [
			...game.mirrors,
			...game.crystalCells,
			...game.checkpoints,
			...game.splitters,
			...game.portals,
			...game.filters
		];
		for (let index = 0; index + 2 < game.sources.length; index += 3)
			cells.push(game.sources[index]!);
		if (cells.length === 0) return { x: (game.width * CELL) / 2, y: (game.height * CELL) / 2 };
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const cell of cells) {
			if (cell < 0 || cell >= game.width * game.height) continue;
			const x = cell % game.width;
			const y = Math.floor(cell / game.width);
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		}
		if (!Number.isFinite(minX)) return { x: (game.width * CELL) / 2, y: (game.height * CELL) / 2 };
		return { x: ((minX + maxX + 1) * CELL) / 2, y: ((minY + maxY + 1) * CELL) / 2 };
	});
	const originX = $derived(viewportWidth / 2 - contentCentre.x * scale + offsetX);
	const originY = $derived(viewportHeight / 2 - contentCentre.y * scale + offsetY);

	function popcount(value: number): number {
		let total = 0;
		let bits = value;
		while (bits) {
			total += bits & 1;
			bits >>>= 1;
		}
		return total;
	}
	/** Non-colour cue for each crystal, so colour is never the only signal. */
	function colourLetter(colour: number): string {
		return colour === 1 ? 'A' : colour === 2 ? 'B' : 'C';
	}

	const entranceDelay = createActiveDelay(() =>
		guard(() => {
			present(() => entrance?.settle());
			phase = 'playing';
			onready();
			startClock();
		})
	);
	const finishDelay = createActiveDelay(() =>
		guard(() => onfinish(lightBendScore(game, elapsed, scoring), elapsed, crystals, game.hintsUsed))
	);
	const feedbackDelay = createActiveDelay(() => {
		announcement = '';
	});

	function guard(run: () => void) {
		try {
			run();
		} catch (error) {
			console.warn('morphi:light_bend_ui_failed');
			phase = 'failed';
			announcement = t('light-bend.error');
			if (error instanceof Error) console.warn('morphi:light_bend_ui_error', error.message);
		}
	}
	function present(run: () => void) {
		try {
			run();
		} catch {
			console.warn('morphi:light_bend_motion_unavailable');
		}
	}
	function clockMs() {
		return clockStart === null ? clockBase : clockBase + (performance.now() - clockStart);
	}
	function startClock() {
		if (clockStart !== null) return;
		clockStart = performance.now();
		if (ticker !== null) return;
		ticker = setInterval(() => {
			if (document.hidden || paused || phase !== 'playing') return;
			activeMs = clockMs();
			elapsed = Math.floor(activeMs / 1000);
			if (timed && remaining <= 0) runOver();
		}, 250);
	}
	function pauseClock() {
		if (clockStart === null) return;
		clockBase = clockMs();
		clockStart = null;
	}
	function stopClock() {
		pauseClock();
		if (ticker !== null) clearInterval(ticker);
		ticker = null;
	}
	function syncVisibility() {
		if (document.hidden || paused || phase !== 'playing' || game.status !== 'playing') pauseClock();
		else startClock();
	}
	function resize() {
		if (!root) return;
		const rect = root.getBoundingClientRect();
		viewportWidth = Math.max(1, rect.width);
		viewportHeight = Math.max(1, rect.height);
	}
	function runOver() {
		if (game.status !== 'playing' || over) return;
		phase = 'finished';
		over = true;
		activeMs = clockMs();
		elapsed = Math.floor(activeMs / 1000);
		stopClock();
		announcement = t('light-bend.over');
		sound.play('invalid');
	}
	function showFeedback(kind: 'rotate' | 'hint' | 'win' | 'invalid', cell = -1) {
		present(() => {
			feedback = lightBendEnter(root, kind, cell);
		});
		if (feedbackTimer !== null) clearTimeout(feedbackTimer);
		feedbackTimer = setTimeout(() => {
			present(() => feedback?.settle());
		}, 900);
	}
	function perform(move: LightBendMove) {
		if (locked || document.hidden) return;
		const before = game;
		try {
			game = applyLightBendMove(game, move);
		} catch (error) {
			if (!(error instanceof RangeError)) {
				guard(() => {
					throw error;
				});
				return;
			}
			sound.play('invalid');
			showFeedback('invalid', move.cell);
			announcement = t(
				error.message === 'hint'
					? 'light-bend.noHints'
					: error.message === 'undo'
						? 'light-bend.noUndo'
						: error.message === 'place'
							? 'light-bend.trayEmpty'
							: 'light-bend.invalid'
			);
			feedbackDelay.start(1600, document.hidden || paused);
			return;
		}
		onmove(move);
		if (move.action === LIGHT_BEND_ACTION.hint) {
			sound.play('pick');
			showFeedback('hint', game.hintCell);
			announcement = t(placeYourOwn ? 'light-bend.hintedPlace' : 'light-bend.hinted');
		} else if (move.action === LIGHT_BEND_ACTION.fire) {
			sound.play('place');
			showFeedback('rotate');
			announcement = t('light-bend.fired');
		} else if (
			move.action === LIGHT_BEND_ACTION.rotate ||
			move.action === LIGHT_BEND_ACTION.place
		) {
			sound.play('place');
			showFeedback('rotate', move.cell);
		} else if (move.action === LIGHT_BEND_ACTION.reset) {
			sound.play('clear');
			announcement = '';
		} else sound.play('action' in move ? 'place' : 'pick');
		// A blocked beam is not a loss (§2): keep the board and say what happened.
		if (game.status === 'playing' && before.status === 'playing') {
			if (move.action === LIGHT_BEND_ACTION.rotate || move.action === LIGHT_BEND_ACTION.place) {
				if (lit < crystals && game.rules.info === 0) announcement = t('light-bend.blocked');
			}
		}
		if (game.status === 'won') {
			phase = 'finished';
			elapsed = Math.floor(clockMs() / 1000);
			stopClock();
			announcement = t('light-bend.won');
			sound.play('win');
			showFeedback('win');
			oncomplete(lightBendScore(game, elapsed, scoring), elapsed);
			finishDelay.start(
				matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500,
				document.hidden || paused
			);
		}
	}
	function cellAt(index: number) {
		return { x: index % game.width, y: Math.floor(index / game.width) };
	}
	function mirrorAt(index: number) {
		return game.mirrors.indexOf(index);
	}
	function tapCell(cell: number) {
		if (locked || document.hidden) return;
		const index = mirrorAt(cell);
		if (placeYourOwn) {
			if (index < 0) return;
			if (game.placed[index]) {
				announcement = t('light-bend.invalid');
				sound.play('invalid');
				return;
			}
			// Place in the orientation that turns the beam; the plate picks `/` first.
			perform({ action: LIGHT_BEND_ACTION.place, cell, value: 0 });
			selection = cell;
			return;
		}
		if (index < 0) return;
		perform({ action: LIGHT_BEND_ACTION.rotate, cell, value: 0 });
		selection = cell;
	}
	function action(code: number) {
		if (locked || document.hidden) return;
		perform({ action: code, cell: 0, value: 0 });
	}
	function fitView() {
		offsetX = 0;
		offsetY = 0;
		zoom = 1;
	}
	function zoomBy(factor: number) {
		// Clamp to the playable floor as well as the 4× ceiling (L6).
		zoom = Math.min(4, Math.max(minZoom, zoom * factor));
	}
	function pointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		// Presses outside the board viewport belong to the rail/footer controls.
		const target = event.target as Element | null;
		if (!target?.closest('.lb-viewport')) return;
		pointers.add(event.pointerId);
		// A second finger cancels the pending tap (L6) and turns the gesture into a pinch.
		if (pointers.size > 1) {
			cancelledTap = true;
			drag = null;
			return;
		}
		const cellEl = target.closest<SVGElement>('[data-cell]');
		const raw = cellEl?.dataset.cell;
		drag = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			startX: offsetX,
			startY: offsetY,
			moved: false,
			cell: raw === undefined ? -1 : Number(raw)
		};
		cancelledTap = false;
		(event.currentTarget as Element).setPointerCapture?.(event.pointerId);
	}
	function pointerMove(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId) return;
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		// 12 px slop: below it the gesture is still a tap, above it the board pans (L6).
		if (!drag.moved && Math.abs(dx) + Math.abs(dy) < TAP_SLOP_PX) return;
		drag.moved = true;
		offsetX = drag.startX + dx;
		offsetY = drag.startY + dy;
	}
	function pointerEnd(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (!drag || drag.id !== event.pointerId) return;
		const { moved, cell } = drag;
		drag = null;
		if (moved || cancelledTap) {
			cancelledTap = pointers.size > 0;
			return;
		}
		if (cell >= 0) tapCell(cell);
	}
	function cancelDrag() {
		drag = null;
		pinching = null;
		pointers.clear();
		cancelledTap = false;
	}
	function wheel(event: WheelEvent) {
		if (locked) return;
		event.preventDefault();
		zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
	}
	function touchStart(event: TouchEvent) {
		if (event.touches.length !== 2) return;
		const [a, b] = event.touches;
		if (!a || !b) return;
		pinching = {
			distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
			zoom
		};
	}
	function touchMove(event: TouchEvent) {
		if (!pinching || event.touches.length !== 2) return;
		const [a, b] = event.touches;
		if (!a || !b) return;
		event.preventDefault();
		const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
		if (pinching.distance <= 0) return;
		zoom = Math.min(4, Math.max(minZoom, pinching.zoom * (distance / pinching.distance)));
	}
	function touchEnd() {
		pinching = null;
	}
	function keyDown(event: KeyboardEvent) {
		if (locked) return;
		const step = (delta: number) => {
			const cells = game.mirrors;
			if (cells.length === 0) return;
			const current = cells.indexOf(selection);
			const next = current < 0 ? 0 : (current + delta + cells.length) % cells.length;
			selection = cells[next]!;
			announcement = mirrorLabel(selection);
		};
		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				event.preventDefault();
				step(1);
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				event.preventDefault();
				step(-1);
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				if (selection >= 0) tapCell(selection);
				break;
			case 'u':
			case 'U':
				action(LIGHT_BEND_ACTION.undo);
				break;
			case 'h':
			case 'H':
				action(LIGHT_BEND_ACTION.hint);
				break;
			case 'r':
			case 'R':
				action(LIGHT_BEND_ACTION.reset);
				break;
			case 'f':
			case 'F':
				fitView();
				break;
			case '+':
			case '=':
				zoomBy(1.15);
				break;
			case '-':
				zoomBy(1 / 1.15);
				break;
		}
	}
	function mirrorLabel(cell: number): string {
		const at = cellAt(cell);
		const index = mirrorAt(cell);
		const row = at.y + 1;
		const column = at.x + 1;
		if (placeYourOwn && (index < 0 || !game.placed[index]))
			return t('light-bend.slot', { row, column });
		const orientation =
			index >= 0 && game.orientations[index] === 1
				? t('light-bend.mirrorBackslash')
				: t('light-bend.mirrorSlash');
		return t('light-bend.mirror', { row, column, orientation });
	}
	function cellKind(value: number): string {
		switch (value) {
			case LIGHT_BEND_CELL.wall:
				return 'wall';
			case LIGHT_BEND_CELL.crystal:
				return 'crystal';
			case LIGHT_BEND_CELL.source:
				return 'source';
			case LIGHT_BEND_CELL.checkpoint:
				return 'checkpoint';
			case LIGHT_BEND_CELL.splitter:
				return 'splitter';
			case LIGHT_BEND_CELL.portal:
				return 'portal';
			case LIGHT_BEND_CELL.filter:
				return 'filter';
			case LIGHT_BEND_CELL.mirror:
				return 'mirror';
			default:
				return 'empty';
		}
	}
	/** Beam polyline in half-cell units (2 per cell) → board pixels. */
	const beamPoints = $derived.by(() => {
		const points: string[] = [];
		for (let index = 0; index + 1 < game.beam.length; index += 2) {
			const x = (game.beam[index]! / 2) * CELL;
			const y = (game.beam[index + 1]! / 2) * CELL;
			points.push(`${x},${y}`);
		}
		return points.join(' ');
	});
	const hintCellIndex = $derived(phase === 'playing' && game.hintCell >= 0 ? game.hintCell : -1);

	$effect(() => {
		if (!mounted || !entranceReady || entered) return;
		untrack(() => {
			entered = true;
			if (resume?.phase === 'playing' || resume?.phase === 'finished') {
				phase = game.status === 'playing' ? 'playing' : 'finished';
				onready();
				if (game.status === 'won') {
					oncomplete(lightBendScore(game, elapsed, scoring), elapsed);
					finishDelay.start(0, document.hidden || paused);
				} else if (!(document.hidden || paused)) startClock();
			} else {
				present(() => {
					entrance = lightBendEnter(root, 'enter');
				});
				entranceDelay.start(
					resume?.pending.entrance ??
						(matchMedia('(prefers-reduced-motion: reduce)').matches && !rankedRound
							? 0
							: LIGHT_BEND_ENTRANCE_MS),
					document.hidden || paused
				);
			}
		});
	});
	$effect(() => {
		const value = paused;
		untrack(() => {
			if (mounted || value) syncVisibility();
		});
	});
	onMount(() => {
		if (resume) {
			clockBase = resume.elapsedMs;
			activeMs = Math.max(0, Math.floor(clockBase));
			elapsed = Math.floor(activeMs / 1000);
			if (resume.clockStarted)
				rankedStart =
					performance.now() -
					(rankedRound && rankedStartedAt !== null
						? Math.max(clockBase, Date.now() - rankedStartedAt)
						: clockBase);
		}
		registerCheckpoint?.(() => {
			const pending: Record<string, number> = {};
			const entrance = entranceDelay.remaining();
			if (entrance !== null) pending.entrance = entrance;
			return { phase, elapsedMs: clockMs(), clockStarted: rankedStart !== null, pending };
		});
		mounted = true;
		resize();
		document.addEventListener('visibilitychange', syncVisibility);
		window.addEventListener('resize', resize);
		window.addEventListener('blur', cancelDrag);
		return () => {
			document.removeEventListener('visibilitychange', syncVisibility);
			window.removeEventListener('resize', resize);
			window.removeEventListener('blur', cancelDrag);
			stopClock();
			entranceDelay.cancel();
			finishDelay.cancel();
			feedbackDelay.cancel();
			if (feedbackTimer !== null) clearTimeout(feedbackTimer);
			present(() => {
				entrance?.destroy();
				feedback?.destroy();
			});
		};
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
<div
	class="game light-bend-game"
	role="group"
	aria-label={t('v1.game.light-bend')}
	tabindex={-1}
	data-family="light-bend"
	data-round={roundNumber}
	data-phase={phase}
	data-seed={game.seed}
	data-band={game.band}
	data-par={game.par}
	style={resolvedTheme ? themeStyle(resolvedTheme) : ''}
	bind:this={root}
	onkeydown={keyDown}
	onpointerdown={pointerDown}
	onpointermove={pointerMove}
	onpointerup={pointerEnd}
	onpointercancel={cancelDrag}
	onwheel={wheel}
	ontouchstart={touchStart}
	ontouchmove={touchMove}
	ontouchend={touchEnd}
	onlostpointercapture={() => {
		if (drag) cancelDrag();
	}}
>
	<section class="lb-main">
		<header class="lb-heading">
			<h2>{t('v1.game.light-bend')}</h2>
			<p class="lb-status" role="status" aria-live="polite">
				{t('light-bend.crystalsOf', { lit, total: crystals })}
			</p>
		</header>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="lb-viewport"
			bind:clientWidth={viewportWidth}
			bind:clientHeight={viewportHeight}
			data-zoom={zoom}
			data-offset-x={offsetX}
			data-offset-y={offsetY}
			tabindex={-1}
		>
			<svg
				class="lb-board"
				bind:this={board}
				width={viewportWidth}
				height={viewportHeight}
				role="group"
				aria-label={t('v1.game.light-bend')}
				data-scale={scale}
			>
				<g transform={`translate(${originX} ${originY}) scale(${scale})`}>
					<rect
						class="lb-field"
						x="0"
						y="0"
						width={game.width * CELL}
						height={game.height * CELL}
					/>
					{#each game.cells as value, index (index)}
						{@const at = cellAt(index)}
						{@const kind = cellKind(value)}
						{@const mirrorIndex = mirrorAt(index)}
						{@const placedHere = mirrorIndex >= 0 && (!placeYourOwn || game.placed[mirrorIndex])}
						{@const orientation =
							mirrorIndex >= 0 && game.orientations[mirrorIndex] === 1 ? 'backslash' : 'slash'}
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<g
							class="lb-cell lb-{kind}"
							class:lb-hint={index === hintCellIndex}
							class:lb-selected={index === selection}
							class:lb-placed={placedHere}
							class:lb-motion={phase === 'arrival'}
							data-cell={mirrorIndex >= 0 ? index : undefined}
							data-cell-motion={index}
							data-kind={kind}
							role={mirrorIndex >= 0 ? 'button' : undefined}
							tabindex={mirrorIndex >= 0 && !locked ? 0 : -1}
							aria-label={mirrorIndex >= 0 ? mirrorLabel(index) : undefined}
							aria-disabled={mirrorIndex >= 0 && locked ? 'true' : undefined}
							onkeydown={(event) => {
								if (mirrorIndex < 0) return;
								if (event.key !== 'Enter' && event.key !== ' ') return;
								event.preventDefault();
								tapCell(index);
							}}
							transform={`translate(${at.x * CELL} ${at.y * CELL})`}
						>
							{#if mirrorIndex >= 0}
								<!-- Transparent hit target: an SVG shape with no fill is not
								     hit-testable, so the whole cell must be painted to be tappable. -->
								<rect class="lb-hit" x="0" y="0" width="64" height="64" />
							{/if}
							{#if kind === 'crystal'}
								<rect class="lb-crystal" x="16" y="16" width="32" height="32" rx="6" />
								<text class="lb-colour" x="32" y="40">
									{colourLetter(game.crystalColours[game.crystalCells.indexOf(index)] ?? 1)}
								</text>
							{:else if kind === 'source'}
								<circle class="lb-source" cx="32" cy="32" r="15" />
							{:else if kind === 'wall'}
								<rect class="lb-wall" x="4" y="4" width="56" height="56" rx="4" />
							{:else if kind === 'checkpoint'}
								<circle class="lb-checkpoint" cx="32" cy="32" r="14" />
							{:else if kind === 'splitter'}
								<circle class="lb-splitter" cx="32" cy="32" r="16" />
							{:else if kind === 'portal'}
								<ellipse class="lb-portal" cx="32" cy="32" rx="14" ry="20" />
							{:else if kind === 'filter'}
								<rect class="lb-filter" x="14" y="14" width="36" height="36" rx="8" />
							{/if}
							{#if mirrorIndex >= 0 && (!placeYourOwn || game.placed[mirrorIndex])}
								<g class="lb-mirror {orientation}">
									<rect x="10" y="10" width="44" height="44" rx="6" />
									<line x1="16" y1="48" x2="48" y2="16" />
								</g>
							{:else if placeYourOwn && mirrorIndex >= 0}
								<rect class="lb-slot" x="12" y="12" width="40" height="40" rx="6" />
							{/if}
						</g>
					{/each}
					{#if game.beam.length > 1 && (game.rules.info === 0 || game.fired)}
						<polyline class="lb-beam" points={beamPoints} />
					{/if}
				</g>
			</svg>
		</div>
		<p class="lb-caption" aria-live="polite">{announcement}</p>
	</section>
	<aside class="lb-rail">
		<header class="lb-stats">
			<div>
				<span>{t('game.score')}</span><strong
					>{formatNumber(
						game.status === 'won' ? lightBendScore(game, elapsed, scoring) : 0
					)}</strong
				>
			</div>
			<div data-countdown={timed ? remaining : undefined}>
				<span>{t(timed ? 'light-bend.timeLeft' : 'game.time')}</span><strong
					>{formatDuration(timed ? Math.ceil(remaining) : elapsed)}</strong
				>
			</div>
			<div data-hints-left={hintsLeft}>
				<span>{t('light-bend.hintsLeft')}</span><strong>{hintsLeft}</strong>
			</div>
			{#if placeYourOwn}<div data-tray-left={tray}>
					<span>{t('light-bend.tray')}</span><strong>{tray}</strong>
				</div>{/if}
			<div data-par={game.par}><span>{t('light-bend.par')}</span><strong>{game.par}</strong></div>
			{#if game.status === 'won'}<div data-stars={stars}>
					<span>{t('light-bend.stars')}</span><strong>{stars}</strong>
				</div>{/if}
		</header>
		{#if over}
			<div class="lb-run-over" role="group" aria-label={t('light-bend.over')}>
				<strong>{t('light-bend.over')}</strong>
				<p>{t('light-bend.overDetail')}</p>
				<div>
					<button type="button" class="btn" onclick={() => guard(ontryanother ?? onhome)}
						>{t('v1.nav.another')}</button
					><button type="button" class="btn" onclick={() => guard(onhome)}>{t('game.home')}</button>
				</div>
			</div>
		{:else}
			<section class="lb-controls" aria-label={t('v1.game.light-bend')}>
				<button
					class="btn"
					disabled={locked || game.rules.undo === 1}
					onclick={() => action(LIGHT_BEND_ACTION.undo)}>{t('light-bend.undo')}</button
				>
				<button
					class="btn"
					disabled={locked || hintsLeft === 0}
					onclick={() => action(LIGHT_BEND_ACTION.hint)}>{t('light-bend.hint')}</button
				>
				<button class="btn" disabled={locked} onclick={() => action(LIGHT_BEND_ACTION.reset)}
					>{t('light-bend.reset')}</button
				>
				{#if game.rules.info === 1}<button
						class="btn primary"
						disabled={locked}
						onclick={() => action(LIGHT_BEND_ACTION.fire)}>{t('light-bend.fire')}</button
					>{/if}
				<button class="btn" disabled={locked} onclick={() => zoomBy(1 / 1.15)}
					>{t('light-bend.zoomOut')}</button
				>
				<button class="btn" disabled={locked} onclick={() => zoomBy(1.15)}
					>{t('light-bend.zoomIn')}</button
				>
				<button class="btn" disabled={locked} onclick={fitView}>{t('light-bend.fit')}</button>
			</section>
		{/if}
	</aside>
</div>

<style>
	/* The shared `.active-round .game` rule sets `height:auto; flex:0 1 auto`;
	   the family needs a full-height grid so the pan/zoom viewport can flex-fill
	   the stage. Match the shared rule's specificity, Tangram pattern. */
	:global(.design-public .active-round[data-family='light-bend'] .game.light-bend-game) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(180px, 26%);
		gap: 12px;
		/* The family footer is absolutely positioned over the stage; reserve its
		   strip so no playable cell or control ever sits underneath it. */
		padding-bottom: var(--lb-footer-space, 0px);
		min-height: 0;
		height: 100%;
		flex: 1 1 auto;
		color: var(--ink, #1b2433);
	}
	.lb-main {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		min-height: 0;
		min-width: 0;
	}
	.lb-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.lb-heading h2 {
		margin: 0;
		font-size: 18px;
	}
	.lb-status {
		margin: 0;
		font-size: 13px;
		opacity: 0.75;
	}
	.lb-viewport {
		position: relative;
		min-height: 0;
		overflow: hidden;
		border-radius: 10px;
		background: #f7f4ee;
		touch-action: none;
		cursor: grab;
	}
	.lb-viewport:active {
		cursor: grabbing;
	}
	.lb-board {
		display: block;
	}
	.lb-field {
		fill: #fbf9f4;
	}
	.lb-wall {
		fill: #c9c2b4;
	}
	.lb-crystal {
		fill: #2f6fed;
	}
	.lb-colour {
		fill: #fff;
		font-size: 18px;
		font-weight: 700;
		text-anchor: middle;
	}
	.lb-source {
		fill: #e5532d;
	}
	.lb-checkpoint {
		fill: none;
		stroke: #009a86;
		stroke-width: 5;
	}
	.lb-splitter {
		fill: #7d61ae;
	}
	.lb-portal {
		fill: none;
		stroke: #7d61ae;
		stroke-width: 4;
	}
	.lb-filter {
		fill: #b996bf;
	}
	.lb-mirror rect {
		fill: #dfe5ee;
		stroke: #1b2433;
		stroke-width: 2;
	}
	.lb-mirror line {
		stroke: #1b2433;
		stroke-width: 4;
	}
	.lb-mirror.backslash line {
		transform: rotate(90deg);
		transform-origin: 32px 32px;
	}
	.lb-hit {
		fill: transparent;
	}
	.lb-slot {
		fill: none;
		stroke: #9aa4b6;
		stroke-width: 2;
		stroke-dasharray: 5 4;
	}
	.lb-hint rect,
	.lb-hint .lb-slot {
		stroke: #e5532d;
		stroke-width: 3;
	}
	.lb-selected .lb-mirror rect {
		stroke: #2f6fed;
		stroke-width: 3;
	}
	.lb-beam {
		fill: none;
		stroke: #f2bd4f;
		stroke-width: 6;
		stroke-linecap: round;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.lb-caption {
		margin: 6px 0 0;
		min-height: 20px;
		font-size: 13px;
		opacity: 0.8;
	}
	.lb-rail {
		display: grid;
		align-content: start;
		gap: 10px;
		min-width: 0;
	}
	.lb-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.lb-stats div {
		display: grid;
		gap: 2px;
	}
	.lb-stats span {
		font-size: 11px;
		opacity: 0.7;
	}
	.lb-stats strong {
		font-size: 16px;
	}
	.lb-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.lb-controls .btn {
		min-height: 44px;
		padding: 8px 10px;
		font-size: 12px;
	}
	.lb-run-over {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: 10px;
		background: #f3efe6;
	}
	.lb-run-over strong {
		font-size: 16px;
	}
	.lb-run-over p {
		margin: 0;
		font-size: 12px;
		opacity: 0.8;
	}
	.lb-run-over div {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	@media (max-width: 620px) and (orientation: portrait) {
		:global(.design-public .active-round[data-family='light-bend'] .game.light-bend-game) {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
		}
		.lb-rail {
			grid-template-columns: minmax(0, 1fr);
		}
		.lb-stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (orientation: landscape) and (max-height: 560px) {
		:global(.design-public .active-round[data-family='light-bend'] .game.light-bend-game) {
			grid-template-columns: minmax(0, 1fr) minmax(150px, 24%);
			gap: 8px;
		}
		.lb-heading h2 {
			font-size: 14px;
		}
		.lb-controls .btn {
			min-height: 36px;
			padding: 4px 7px;
			font-size: 10px;
		}
		.lb-stats strong {
			font-size: 13px;
		}
	}
</style>
