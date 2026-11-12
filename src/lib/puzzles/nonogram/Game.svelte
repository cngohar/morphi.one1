<script module lang="ts">
	let colourCoachSeen = false;
</script>

<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle } from '#lib/engine/theme/style.js';
	import { t } from '#lib/i18n/messages.js';
	import * as motion from './motion.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { sound } from '#lib/ui/sound.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { NONOGRAM_ENTRANCE_MS } from '#lib/round-timing.js';
	import { scoring as defaultScoring } from './scoring.js';
	import {
		applyNonogramMove,
		nonogramLineSatisfied,
		nonogramRemainingMs,
		nonogramScore,
		NONOGRAM_ACTION,
		type NonogramMove,
		type NonogramRound
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
		round: NonogramRound;
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
		onmove?: (move: NonogramMove) => void;
		oncomplete?: (score: number, seconds: number) => void;
		onfinish: (
			score: number,
			seconds: number,
			filled: number,
			mistakes: number,
			hints: number
		) => void;
		onhome: () => void;
		ontryanother?: () => void;
	} = $props();
	// svelte-ignore state_referenced_locally
	let game = $state(round);
	let phase = $state<'arrival' | 'playing' | 'finished' | 'failed'>('arrival');
	let mode = $state<-1 | 0 | 1>(1);
	let colour = $state(1);
	let showColourCoach = $state(false);
	let cursor = $state(0);
	let elapsed = $state(0);
	let activeMs = $state(0);
	let announcement = $state('');
	let mounted = $state(false);
	let entered = false;
	let disposed = false;
	let board: HTMLDivElement;
	let grid: HTMLDivElement;
	let clockBase = 0;
	let clockStart: number | null = null;
	let rankedStart: number | null = null;
	let ticker: ReturnType<typeof setInterval> | null = null;
	let activePointer: number | null = null;
	let stroke = -1;
	let strokeCell = -1;
	let strokeStart = -1;
	let strokeMark = 0;
	let strokeAxis = 0;
	let pendingTouch = false;
	let touchOrigin: { x: number; y: number } | null = null;
	let longPress: ReturnType<typeof setTimeout> | null = null;
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
	let entrance: ReturnType<typeof motion.nonogramEnter> | null = null;
	let motionFailed = false;
	const feedback = new SvelteMap<number, ReturnType<typeof motion.nonogramEnter>>();
	const total = $derived(game.size * game.size);
	const colours = [
		'var(--accent)',
		'var(--success)',
		'var(--violet)',
		'var(--warning-text)',
		'var(--danger)'
	];
	const remaining = $derived(
		game.rules.timeLimit > 0
			? Math.ceil(nonogramRemainingMs(game, Math.max(game.lastAt, activeMs)) / 1000)
			: 0
	);
	const filled = $derived(game.cells.filter((value) => value > 0).length);
	const rowDepth = $derived(
		Math.max(1, ...game.rowClues.map((clues) => clues.length)) + Number(game.rules.colours > 1)
	);
	const columnDepth = $derived(Math.max(1, ...game.columnClues.map((clues) => clues.length)));
	const rowDone = $derived(
		game.rowClues.map(
			(clues, row) =>
				!game.hiddenRows?.[row] &&
				nonogramLineSatisfied(
					game.cells.slice(row * game.size, (row + 1) * game.size),
					clues,
					game.rules.totalsOnly
				)
		)
	);
	const columnDone = $derived(
		game.columnClues.map(
			(clues, column) =>
				!game.hiddenColumns?.[column] &&
				nonogramLineSatisfied(
					Array.from({ length: game.size }, (_, row) => game.cells[row * game.size + column]!),
					clues,
					game.rules.totalsOnly
				)
		)
	);
	const locked = $derived(phase !== 'playing' || game.status !== 'playing' || paused);
	const entranceDelay = createActiveDelay(() =>
		guard(() => {
			present(() => entrance?.settle());
			phase = 'playing';
			onready();
			markColourCoach();
			startClock();
		})
	);
	const finishDelay = createActiveDelay(() =>
		guard(() =>
			onfinish(
				nonogramScore(game, elapsed, scoring),
				elapsed,
				filled,
				game.mistakes,
				game.hintsUsed
			)
		)
	);

	function guard(action: () => void) {
		if (disposed) return;
		try {
			action();
		} catch {
			phase = 'failed';
			pointerEnd();
			pauseClock();
			console.error('morphi:nonogram_action_failed');
		}
	}
	function present(action: () => void) {
		if (motionFailed) return;
		try {
			action();
		} catch {
			motionFailed = true;
			const clips = [...feedback.values(), ...(entrance ? [entrance] : [])];
			entrance = null;
			feedback.clear();
			if (feedbackTimer !== null) clearTimeout(feedbackTimer);
			feedbackTimer = null;
			for (const clip of clips) {
				try {
					clip.destroy();
				} catch {
					console.warn('morphi:nonogram_motion_cleanup_unavailable');
				}
			}
			for (const node of board.querySelectorAll<HTMLElement>('.nonogram-clue, .nonogram-cell')) {
				node.style.removeProperty('opacity');
				node.style.removeProperty('transform');
			}
			board.dataset.motionReady = 'true';
			console.warn('morphi:nonogram_motion_unavailable');
		}
	}
	function clockMs(): number {
		if (rankedRound)
			return rankedStart === null
				? clockBase
				: Math.max(clockBase, performance.now() - rankedStart);
		return clockBase + (clockStart === null ? 0 : performance.now() - clockStart);
	}
	function startClock() {
		rankedStart ??= performance.now() - clockBase;
		clockStart ??= performance.now();
		updateClock();
		if (game.status === 'playing') ticker ??= setInterval(() => guard(updateClock), 250);
	}
	function updateClock() {
		activeMs = Math.max(game.lastAt, Math.floor(clockMs()));
		elapsed = Math.floor(activeMs / 1000);
		if (
			phase === 'playing' &&
			game.status === 'playing' &&
			game.rules.timeLimit > 0 &&
			nonogramRemainingMs(game, activeMs) === 0 &&
			!paused &&
			!document.hidden
		)
			perform(NONOGRAM_ACTION.tick);
	}
	function markColourCoach() {
		if (!showColourCoach) return;
		colourCoachSeen = true;
		try {
			localStorage.setItem('morphi.nonogram.colour2.coachSeen', '1');
		} catch {
			console.warn('morphi:nonogram_coach_storage_unavailable');
		}
	}
	function clueLabel(axis: 'row' | 'column', line: number) {
		const hidden = axis === 'row' ? game.hiddenRows?.[line] : game.hiddenColumns?.[line];
		const clues = (axis === 'row' ? game.rowClues : game.columnClues)[line]!;
		return t(axis === 'row' ? 'nonogram.rowClues' : 'nonogram.columnClues', {
			number: line + 1,
			clues: hidden
				? t('nonogram.hiddenClues')
				: clues.length === 0
					? '0'
					: clues
							.map((clue) =>
								game.rules.colours > 1
									? `${clue.length} (${t('nonogram.colour', { number: clue.colour })})`
									: String(clue.length)
							)
							.join(', ')
		});
	}
	function pauseClock() {
		if (clockStart !== null) {
			clockBase += performance.now() - clockStart;
			clockStart = null;
		}
		if (ticker !== null) clearInterval(ticker);
		ticker = null;
	}
	function clearFeedback() {
		if (feedbackTimer !== null) clearTimeout(feedbackTimer);
		feedbackTimer = null;
		for (const value of feedback.values()) present(() => value.destroy());
		feedback.clear();
	}
	function showFeedback(kind: 'pop' | 'mistake' | 'hint' | 'win', cell: number) {
		void tick()
			.then(() =>
				guard(() =>
					present(() => {
						feedback.get(cell)?.destroy();
						feedback.set(cell, motion.nonogramEnter(board, kind, cell));
						if (feedbackTimer !== null) clearTimeout(feedbackTimer);
						feedbackTimer = setTimeout(() => guard(clearFeedback), 650);
					})
				)
			)
			.catch(() => {
				if (!disposed)
					present(() => {
						throw new Error('feedback');
					});
			});
	}
	function finish() {
		pointerEnd();
		elapsed = Math.floor(clockMs() / 1000);
		pauseClock();
		phase = 'finished';
		oncomplete(nonogramScore(game, elapsed, scoring), elapsed);
		announcement = t('nonogram.won');
		sound.play('win');
		showFeedback('win', -1);
		finishDelay.start(500, document.hidden || paused);
	}
	function lose() {
		pointerEnd();
		elapsed = Math.floor(clockMs() / 1000);
		pauseClock();
		phase = 'finished';
		announcement = t('nonogram.over');
		sound.play('invalid');
	}
	function perform(mark: number, cell = -1, strokeId = game.strokes): boolean {
		if (locked || document.hidden) return false;
		try {
			const before = game;
			const move: NonogramMove = {
				at: Math.max(game.lastAt, Math.floor(clockMs())),
				cell,
				mark,
				stroke: strokeId
			};
			const after = applyNonogramMove(before, move);
			game = after;
			onmove(move);
			if (after.lastMistake >= 0 && after.rules.checked) {
				announcement = t('nonogram.invalid');
				sound.play('invalid');
				showFeedback('mistake', after.lastMistake);
			} else if (after.lastHint >= 0) {
				announcement = t('nonogram.hinted', {
					row: Math.floor(after.lastHint / game.size) + 1,
					column: (after.lastHint % game.size) + 1
				});
				sound.play('pick');
				showFeedback('hint', after.lastHint);
			} else if (mark === NONOGRAM_ACTION.check) {
				announcement = t('nonogram.checked', { count: after.checkCount });
				sound.play(after.checkCount > 0 ? 'invalid' : 'pick');
			} else if (cell >= 0 && before.cells[cell] !== after.cells[cell]) {
				sound.play(mark === 0 ? 'clear' : 'place');
				showFeedback('pop', cell);
			} else if (mark !== NONOGRAM_ACTION.tick) sound.play('pick');
			if (after.status === 'won') finish();
			else if (after.status === 'lost') lose();
			return !after.strokeStopped;
		} catch (error) {
			if (error instanceof RangeError) {
				sound.play('invalid');
				return false;
			}
			guard(() => {
				throw error;
			});
			return false;
		}
	}
	function control(mark: number) {
		guard(() => {
			pointerEnd();
			perform(mark);
			if (mark === NONOGRAM_ACTION.restart) cursor = 0;
		});
	}
	function begin(cell: number, mark = mode === 1 ? colour : mode) {
		if (locked || document.hidden || cell < 0 || cell >= total) return;
		cursor = cell;
		stroke = game.strokes;
		strokeCell = cell;
		strokeStart = cell;
		strokeAxis = 0;
		strokeMark = mark !== 0 && game.cells[cell] === mark ? 0 : mark;
		if (!perform(strokeMark, cell, stroke)) stroke = -1;
	}
	function step(cell: number) {
		if (stroke < 0 || cell < 0 || cell >= total || locked) return;
		const row = Math.floor(cell / game.size),
			column = cell % game.size;
		const startRow = Math.floor(strokeStart / game.size),
			startColumn = strokeStart % game.size;
		if (!strokeAxis && cell !== strokeStart)
			strokeAxis = Math.abs(column - startColumn) >= Math.abs(row - startRow) ? 1 : 2;
		const target =
			strokeAxis === 1
				? startRow * game.size + column
				: strokeAxis === 2
					? row * game.size + startColumn
					: cell;
		const distance = strokeAxis === 2 ? game.size : 1;
		const delta = target > strokeCell ? distance : -distance;
		while (stroke >= 0 && strokeCell !== target) {
			strokeCell += delta;
			cursor = strokeCell;
			if (!perform(strokeMark, strokeCell, stroke)) stroke = -1;
		}
	}
	function cellAt(event: PointerEvent | MouseEvent): number {
		const rect = grid.getBoundingClientRect();
		const column = Math.floor(((event.clientX - rect.left) * game.size) / rect.width);
		const row = Math.floor(((event.clientY - rect.top) * game.size) / rect.height);
		return column < 0 || row < 0 || column >= game.size || row >= game.size
			? -1
			: row * game.size + column;
	}
	function clearLongPress() {
		if (longPress !== null) clearTimeout(longPress);
		longPress = null;
	}
	function pointerDown(event: PointerEvent) {
		guard(() => {
			if (activePointer !== null || locked || document.hidden) return;
			const cell = cellAt(event);
			if (cell < 0 || event.button > 2) return;
			event.preventDefault();
			cursor = cell;
			grid
				.querySelector<HTMLButtonElement>(`[data-cell='${cell}']`)
				?.focus({ preventScroll: true });
			activePointer = event.pointerId;
			try {
				grid.setPointerCapture(event.pointerId);
			} catch {
				activePointer = null;
				console.warn('morphi:nonogram_pointer_capture_failed');
				return;
			}
			pendingTouch = event.pointerType === 'touch';
			if (pendingTouch) {
				strokeStart = cell;
				touchOrigin = { x: event.clientX, y: event.clientY };
				longPress = setTimeout(
					() =>
						guard(() => {
							longPress = null;
							if (!pendingTouch || activePointer !== event.pointerId || locked || document.hidden)
								return;
							pendingTouch = false;
							begin(cell, -1);
						}),
					520
				);
			} else
				begin(cell, event.button === 1 || event.button === 2 ? -1 : mode === 1 ? colour : mode);
		});
	}
	function pointerMove(event: PointerEvent) {
		guard(() => {
			const cell = cellAt(event);
			if (activePointer !== event.pointerId) {
				if (activePointer === null && cell >= 0) cursor = cell;
				return;
			}
			if (
				pendingTouch &&
				touchOrigin &&
				(cell !== strokeStart ||
					Math.abs(event.clientX - touchOrigin.x) + Math.abs(event.clientY - touchOrigin.y) > 8)
			) {
				clearLongPress();
				pendingTouch = false;
				begin(strokeStart);
			}
			if (!pendingTouch) step(cell);
		});
	}
	function pointerEnd(event?: PointerEvent) {
		if (event && activePointer !== event.pointerId) return;
		clearLongPress();
		stroke = -1;
		pendingTouch = false;
		touchOrigin = null;
		const pointer = activePointer;
		activePointer = null;
		if (pointer !== null && grid?.hasPointerCapture(pointer)) grid.releasePointerCapture(pointer);
	}
	function pointerUp(event: PointerEvent) {
		guard(() => {
			if (event.pointerId !== activePointer) return;
			if (pendingTouch) begin(strokeStart);
			pointerEnd(event);
		});
	}
	function keyDown(event: KeyboardEvent, cell: number) {
		guard(() => {
			if (event.key === 'Escape') {
				pointerEnd();
				return;
			}
			if (locked || activePointer !== null) return;
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
				event.preventDefault();
				if (game.rules.undo) control(NONOGRAM_ACTION.undo);
				return;
			}
			if ([' ', 'Enter', 'x', 'X', 'Backspace', 'Delete'].includes(event.key)) {
				event.preventDefault();
				if (!event.repeat)
					begin(
						cell,
						event.key.toLowerCase() === 'x'
							? -1
							: ['Backspace', 'Delete'].includes(event.key)
								? 0
								: colour
					);
				pointerEnd();
				return;
			}
			const delta =
				event.key === 'ArrowLeft'
					? -1
					: event.key === 'ArrowRight'
						? 1
						: event.key === 'ArrowUp'
							? -game.size
							: event.key === 'ArrowDown'
								? game.size
								: 0;
			if (!delta) return;
			event.preventDefault();
			const next = cell + delta;
			if (
				next < 0 ||
				next >= total ||
				(Math.abs(delta) === 1 && Math.floor(next / game.size) !== Math.floor(cell / game.size))
			)
				return;
			cursor = next;
			grid.querySelector<HTMLButtonElement>(`[data-cell='${next}']`)?.focus();
		});
	}
	function syncVisibility() {
		guard(() => {
			if (document.hidden || paused) {
				pointerEnd();
				entranceDelay.pause();
				finishDelay.pause();
				present(() => entrance?.pause());
				clearFeedback();
				if (!rankedRound) pauseClock();
			} else {
				entranceDelay.resume();
				finishDelay.resume();
				present(() => entrance?.resume());
				if (phase === 'playing' && game.status === 'playing') startClock();
			}
		});
	}
	const cancelStroke = () => guard(pointerEnd);
	$effect(() => {
		const value = paused;
		untrack(() => {
			if (mounted || value) syncVisibility();
		});
	});
	$effect(() => {
		if (!mounted || !entranceReady || entered) return;
		untrack(() =>
			guard(() => {
				entered = true;
				if (resume?.phase === 'playing' || resume?.phase === 'finished') {
					phase = game.status === 'playing' ? 'playing' : 'finished';
					board.dataset.motionReady = 'true';
					onready();
					markColourCoach();
					if (game.status === 'won') {
						oncomplete(nonogramScore(game, elapsed, scoring), elapsed);
						finishDelay.start(0, document.hidden || paused);
					} else if (game.status === 'lost') announcement = t('nonogram.over');
					else if (!(document.hidden || paused)) startClock();
					return;
				}
				present(() => {
					entrance = motion.nonogramEnter(board);
				});
				sound.play('pick');
				entranceDelay.start(
					resume?.pending.entrance ?? NONOGRAM_ENTRANCE_MS,
					document.hidden || paused
				);
			})
		);
	});
	onMount(() => {
		guard(() => {
			if (game.rules.colours === 2 && !colourCoachSeen) {
				try {
					colourCoachSeen = localStorage.getItem('morphi.nonogram.colour2.coachSeen') === '1';
				} catch {
					console.warn('morphi:nonogram_coach_storage_unavailable');
				}
				showColourCoach = !colourCoachSeen;
			}
			if (resume) {
				clockBase = resume.elapsedMs;
				activeMs = Math.max(game.lastAt, Math.floor(clockBase));
				elapsed = Math.floor(clockBase / 1000);
				if (resume.clockStarted)
					rankedStart =
						performance.now() -
						(rankedRound && rankedStartedAt !== null
							? Math.max(resume.elapsedMs, Date.now() - rankedStartedAt)
							: resume.elapsedMs);
			}
			registerCheckpoint?.((): CheckpointState => ({
				phase,
				elapsedMs: clockMs(),
				clockStarted: rankedStart !== null,
				pending: entranceDelay.remaining() === null ? {} : { entrance: entranceDelay.remaining()! }
			}));
			mounted = true;
		});
		document.addEventListener('visibilitychange', syncVisibility);
		window.addEventListener('blur', cancelStroke);
		window.addEventListener('resize', cancelStroke);
		return () => {
			disposed = true;
			document.removeEventListener('visibilitychange', syncVisibility);
			window.removeEventListener('blur', cancelStroke);
			window.removeEventListener('resize', cancelStroke);
			pointerEnd();
			pauseClock();
			entranceDelay.cancel();
			finishDelay.cancel();
			present(() => entrance?.destroy());
			clearFeedback();
		};
	});
</script>

<div
	class="game nonogram-game"
	data-family="nonogram"
	data-round={roundNumber}
	data-phase={phase}
	data-status={game.status}
	data-seed={game.seed}
	data-size={game.size}
	data-theme-version={resolvedTheme?.themeConfigVersion}
	data-theme-generator={resolvedTheme?.themeGeneratorVersion}
	style={resolvedTheme ? themeStyle(resolvedTheme) : ''}
>
	<h2 class="sr-only">{t('v1.game.nonogram')}</h2>
	<header class="hud">
		<div class="stats">
			<div class="stat" data-countdown={game.rules.timeLimit > 0 ? remaining : undefined}>
				<span class="stat-label"
					>{t(game.rules.timeLimit > 0 ? 'nonogram.timeLeft' : 'game.time')}</span
				><strong>{formatDuration(game.rules.timeLimit > 0 ? remaining : elapsed)}</strong>
			</div>
			<div class="stat">
				<span class="stat-label">{t('nonogram.filled')}</span><strong
					>{filled} / {game.filledCells}</strong
				>
			</div>
			<div class="stat" data-hearts={game.hearts}>
				<span class="stat-label"
					>{t(game.rules.hearts > 0 ? 'nonogram.hearts' : 'nonogram.mistakes')}</span
				><strong
					>{game.rules.hearts > 0
						? `${game.hearts} / ${game.rules.hearts}`
						: formatNumber(game.mistakes)}</strong
				>
			</div>
			<div class="stat">
				<span class="stat-label">{t('nonogram.hints')}</span><strong
					>{formatNumber(game.hintsUsed)}{game.rules.hintLimit > 0
						? ` / ${game.rules.hintLimit}`
						: ''}</strong
				>
			</div>
		</div>
	</header>
	<main class="stage">
		<div
			class="nonogram-board"
			bind:this={board}
			class:won={game.status === 'won'}
			style={`--size:${game.size};--row-depth:${rowDepth};--column-depth:${columnDepth};--clue-height:${game.rules.colours > 1 ? 0.6 : 0.8}`}
		>
			<div class="nonogram-corner" aria-hidden="true"></div>
			<div class="column-clues">
				{#each game.columnClues as clues, column (column)}
					<div
						class="nonogram-clue column-clue"
						role="group"
						class:done={columnDone[column]}
						class:active={cursor % game.size === column}
						data-hidden={Boolean(game.hiddenColumns?.[column])}
						aria-label={clueLabel('column', column)}
					>
						{#if game.hiddenColumns?.[column]}<span aria-hidden="true">&nbsp;</span
							>{:else if clues.length === 0}<span aria-hidden="true">0</span
							>{:else}{#each clues as clue, index (index)}<span
									class:colour-clue={game.rules.colours > 1}
									style={game.rules.colours > 1 ? `--clue-fill:${colours[clue.colour - 1]}` : ''}
									aria-hidden="true"
									>{clue.length}{#if game.rules.colours > 1}<small>{clue.colour}</small>{/if}</span
								>{/each}{/if}
					</div>
				{/each}
			</div>
			<div class="row-clues">
				{#each game.rowClues as clues, row (row)}
					<div
						class="nonogram-clue row-clue"
						role="group"
						class:done={rowDone[row]}
						class:active={Math.floor(cursor / game.size) === row}
						data-hidden={Boolean(game.hiddenRows?.[row])}
						aria-label={clueLabel('row', row)}
					>
						{#if game.hiddenRows?.[row]}<span aria-hidden="true">&nbsp;</span
							>{:else if clues.length === 0}<span aria-hidden="true">0</span
							>{:else}{#each clues as clue, index (index)}<span
									class:colour-clue={game.rules.colours > 1}
									style={game.rules.colours > 1 ? `--clue-fill:${colours[clue.colour - 1]}` : ''}
									aria-hidden="true"
									>{clue.length}{#if game.rules.colours > 1}<small>{clue.colour}</small>{/if}</span
								>{/each}{/if}
					</div>
				{/each}
			</div>
			<div
				class="nonogram-grid"
				bind:this={grid}
				role="group"
				aria-label={t('nonogram.board')}
				onpointerdown={pointerDown}
				onpointermove={pointerMove}
				onpointerup={pointerUp}
				onpointercancel={(event) => guard(() => pointerEnd(event))}
				onlostpointercapture={(event) => guard(() => pointerEnd(event))}
				oncontextmenu={(event) => event.preventDefault()}
			>
				{#each game.cells as value, cell (cell)}
					<button
						type="button"
						class="nonogram-cell"
						class:filled={value > 0}
						class:crossed={value === -1}
						class:active={Math.floor(cursor / game.size) === Math.floor(cell / game.size) ||
							cursor % game.size === cell % game.size}
						class:checked={!game.rules.strict && game.checkCells.includes(cell)}
						class:hinted={game.lastHint === cell}
						class:mistake={game.rules.checked && game.lastMistake === cell}
						class:heavy-right={((cell % game.size) + 1) % 5 === 0}
						class:heavy-bottom={(Math.floor(cell / game.size) + 1) % 5 === 0}
						data-cell={cell}
						data-mark={value}
						style={value > 0 && game.rules.colours > 1 ? `--cell-fill:${colours[value - 1]}` : ''}
						aria-label={t('nonogram.cell', {
							row: Math.floor(cell / game.size) + 1,
							column: (cell % game.size) + 1,
							state:
								value > 0 && game.rules.colours > 1
									? t('nonogram.colour', { number: value })
									: t(
											value > 0
												? 'nonogram.fill'
												: value === -1
													? 'nonogram.cross'
													: 'nonogram.unknown'
										)
						})}
						aria-disabled={locked}
						tabindex={cursor === cell ? 0 : -1}
						onkeydown={(event) => keyDown(event, cell)}
						onfocus={() => {
							cursor = cell;
						}}
					>
						{#if value === -1}<svg viewBox="0 0 24 24" aria-hidden="true"
								><path
									d="m6 6 12 12M18 6 6 18"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								/></svg
							>{/if}
						{#if value > 0 && game.rules.colours > 1}<span class="colour-number" aria-hidden="true"
								>{value}</span
							>{/if}
					</button>
				{/each}
			</div>
		</div>
	</main>
	<div class="nonogram-tools" role="group" aria-label={t('nonogram.tools')}>
		{#if game.status === 'lost'}
			<div class="nonogram-run-over" role="group" aria-label={t('nonogram.over')}>
				<p>{t('nonogram.overDetail')}</p>
				<div>
					<button type="button" onclick={() => guard(ontryanother ?? onhome)}
						>{t('nonogram.tryAnother')}</button
					><button type="button" onclick={() => guard(onhome)}>{t('game.home')}</button>
				</div>
			</div>
		{:else}
			{#if game.rules.colours > 1}<div
					class="nonogram-palette"
					role="group"
					aria-label={t('nonogram.fill')}
				>
					{#each colours.slice(0, game.rules.colours) as fillColour, index (index)}<button
							type="button"
							class="colour-button"
							style={`--cell-fill:${fillColour}`}
							aria-label={t('nonogram.colour', { number: index + 1 })}
							aria-pressed={colour === index + 1}
							disabled={locked}
							onclick={() =>
								guard(() => {
									pointerEnd();
									colour = index + 1;
									mode = 1;
								})}><span class="colour-number" aria-hidden="true">{index + 1}</span></button
						>{/each}
				</div>{/if}
			<div class="nonogram-modes" role="group" aria-label={t('nonogram.mode')}>
				{#each [1, -1, 0] as value (value)}<button
						type="button"
						disabled={locked}
						aria-pressed={mode === value}
						onclick={() =>
							guard(() => {
								pointerEnd();
								mode = value as -1 | 0 | 1;
							})}
						>{t(
							value === 1 ? 'nonogram.fill' : value === -1 ? 'nonogram.cross' : 'nonogram.erase'
						)}</button
					>{/each}
			</div>
			<button
				type="button"
				disabled={locked || !game.rules.undo || game.history.length === 0}
				onclick={() => control(NONOGRAM_ACTION.undo)}>{t('nonogram.undo')}</button
			>
			<button type="button" disabled={locked} onclick={() => control(NONOGRAM_ACTION.check)}
				>{t('nonogram.check')}</button
			>
			<button
				type="button"
				disabled={locked || (game.rules.hintLimit > 0 && game.hintsUsed >= game.rules.hintLimit)}
				onclick={() => control(NONOGRAM_ACTION.hint)}>{t('nonogram.hint')}</button
			>
			<button
				type="button"
				disabled={locked}
				aria-pressed={game.autoX}
				onclick={() => control(game.autoX ? NONOGRAM_ACTION.autoXOff : NONOGRAM_ACTION.autoXOn)}
				>{t('nonogram.autoX')}</button
			>
			<button type="button" disabled={locked} onclick={() => control(NONOGRAM_ACTION.restart)}
				>{t('nonogram.restart')}</button
			>
		{/if}
	</div>
	<p class="nonogram-announcement" aria-live="polite" aria-atomic="true">
		{announcement ||
			(roundNumber === 1 || (showColourCoach && phase === 'playing')
				? t('nonogram.firstHint')
				: '')}
	</p>
	{#if phase === 'failed'}<div role="alert">
			<p>{t('nonogram.error')}</p>
			<button type="button" onclick={() => guard(onhome)}>{t('game.home')}</button>
		</div>{/if}
</div>

<style>
	.nonogram-game {
		min-height: 0;
	}
	.nonogram-board {
		--row-gutter: calc(var(--row-depth) * 0.67 + 0.45);
		--column-gutter: calc(var(--column-depth) * var(--clue-height) + 0.3);
		width: min(
			100cqw,
			calc(100cqh * (var(--size) + var(--row-gutter)) / (var(--size) + var(--column-gutter)))
		);
		aspect-ratio: calc((var(--size) + var(--row-gutter)) / (var(--size) + var(--column-gutter)));
		display: grid;
		grid-template-columns:
			calc(100% * var(--row-gutter) / (var(--size) + var(--row-gutter)))
			minmax(0, 1fr);
		grid-template-rows:
			calc(100% * var(--column-gutter) / (var(--size) + var(--column-gutter)))
			minmax(0, 1fr);
		container-type: inline-size;
		user-select: none;
		color: var(--ink);
		border: 2px solid var(--round-edge, var(--border-strong));
		font-size: clamp(8px, calc(100cqw / (var(--size) + var(--row-gutter)) * 0.5), 25px);
	}
	.nonogram-board:not([data-motion-ready='true']) .nonogram-cell,
	.nonogram-board:not([data-motion-ready='true']) .nonogram-clue {
		opacity: 0;
	}
	.nonogram-corner {
		border-right: 2px solid var(--round-edge);
		border-bottom: 2px solid var(--round-edge);
	}
	.column-clues {
		display: grid;
		grid-template-columns: repeat(var(--size), minmax(0, 1fr));
		position: sticky;
		top: 0;
	}
	.row-clues {
		display: grid;
		grid-template-rows: repeat(var(--size), minmax(0, 1fr));
		position: sticky;
		left: 0;
	}
	.nonogram-clue {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
		min-height: 0;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		background: var(--round-bg, var(--bg));
	}
	.column-clue {
		flex-direction: column;
		padding-bottom: 2px;
		border-bottom: 2px solid var(--round-edge);
		line-height: 1.2;
	}
	.row-clue {
		gap: 0.2em;
		padding-right: 3px;
		border-right: 2px solid var(--round-edge);
	}
	.nonogram-clue.done {
		color: var(--ink-2);
		opacity: 0.5;
	}
	.nonogram-clue.active {
		background: color-mix(in srgb, var(--focus) 12%, var(--round-bg, var(--bg)));
	}
	.nonogram-grid {
		display: grid;
		grid-template-columns: repeat(var(--size), minmax(0, 1fr));
		grid-template-rows: repeat(var(--size), minmax(0, 1fr));
		min-height: 0;
		min-width: 0;
		touch-action: none;
	}
	.nonogram-cell {
		display: grid;
		place-items: center;
		padding: 0;
		margin: 0;
		min-width: 0;
		min-height: 0;
		border: 0;
		border-right: 1px solid color-mix(in srgb, var(--round-edge) 35%, var(--round-bg));
		border-bottom: 1px solid color-mix(in srgb, var(--round-edge) 35%, var(--round-bg));
		border-radius: 0;
		background: var(--round-bg, var(--bg));
		color: var(--ink-2);
		cursor: crosshair;
	}
	.nonogram-cell.active {
		background: color-mix(in srgb, var(--focus) 9%, var(--round-bg, var(--bg)));
	}
	.nonogram-cell.filled {
		background: var(--cell-fill, var(--ink));
	}
	.nonogram-cell.heavy-right {
		border-right: 2px solid var(--round-edge);
	}
	.nonogram-cell.heavy-bottom {
		border-bottom: 2px solid var(--round-edge);
	}
	.nonogram-cell svg {
		width: 72%;
		height: 72%;
		pointer-events: none;
	}
	.nonogram-cell:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
		z-index: 1;
	}
	.nonogram-cell.checked,
	.nonogram-cell.mistake {
		outline: 2px solid var(--danger, #d92d20);
		outline-offset: -2px;
	}
	.nonogram-cell.hinted {
		outline: 2px solid var(--success, #009a86);
		outline-offset: -2px;
	}
	.colour-clue {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		border-bottom: 2px solid var(--clue-fill);
		line-height: 1;
	}
	.colour-clue small {
		font-size: max(6px, 0.55em);
		min-width: 0.8em;
		border: 1px solid var(--clue-fill);
		padding: 1px;
	}
	.colour-number {
		display: inline-grid;
		place-items: center;
		background: var(--surface);
		color: var(--ink);
		font-size: clamp(8px, 0.5em, 14px);
		font-weight: 900;
		line-height: 1;
		min-width: 1em;
		padding: 1px;
		pointer-events: none;
	}
	.nonogram-board.won .nonogram-cell {
		border-color: transparent;
	}
	.nonogram-tools {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}
	.nonogram-tools button {
		min-height: 44px;
		padding: 6px 10px;
		border: 1px solid var(--round-edge);
		border-radius: 10px;
		color: var(--ink);
		background: var(--round-bg, var(--bg));
		font: inherit;
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
	}
	.nonogram-tools button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--round-bg, var(--bg));
	}
	.nonogram-tools button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.nonogram-tools button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 1px;
	}
	.nonogram-modes {
		display: flex;
		gap: 3px;
	}
	.nonogram-palette {
		width: 100%;
		display: flex;
		justify-content: center;
		gap: 6px;
	}
	.nonogram-tools .colour-button {
		display: grid;
		place-items: center;
		background: var(--cell-fill);
		width: 44px;
		height: 44px;
		padding: 0;
		border: 2px solid transparent;
	}
	.nonogram-tools .colour-button[aria-pressed='true'] {
		background: var(--cell-fill);
		border-color: var(--ink);
		outline: 2px solid var(--round-bg);
		outline-offset: -4px;
	}
	.colour-button .colour-number {
		font-size: 14px;
	}
	.nonogram-run-over {
		margin: 0;
		text-align: center;
	}
	.nonogram-run-over p {
		margin: 0 0 6px;
		font-size: 12px;
	}
	.nonogram-run-over > div {
		display: flex;
		justify-content: center;
		gap: 8px;
	}
	.nonogram-run-over button {
		min-height: 44px;
		padding: 6px 12px;
		border: 1px solid var(--round-edge);
		border-radius: 10px;
		background: var(--round-bg);
		color: var(--ink);
		font: inherit;
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
	}
	.nonogram-run-over button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 1px;
	}
	.nonogram-announcement {
		min-height: 1em;
		margin: 0;
		font-size: 12px;
		text-align: center;
		line-height: 1.2;
	}
</style>
