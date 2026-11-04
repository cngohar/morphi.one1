<script lang="ts">
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import { scoring as defaultScoring } from './scoring.js';
	import { onMount, tick, untrack } from 'svelte';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle } from '#lib/engine/theme/style.js';
	import { t } from '#lib/i18n/messages.js';
	import { motion } from '#lib/ui/motion.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { sound } from '#lib/ui/sound.js';
	import { formatNumber } from '#lib/ui/format.js';
	import { CONNECT_ENTRANCE_MS } from '#lib/round-timing.js';
	import {
		applyConnectMove,
		connectedCount,
		connectScore,
		filledCount,
		type ConnectMove,
		type ConnectRound
	} from './logic.js';

	let {
		scoring = defaultScoring.defaults,
		round,
		roundNumber,
		resolvedTheme = null,
		paused = false,
		rankedRound = false,
		entranceReady = true,
		onready = () => {},
		onmove = () => {},
		oncomplete = () => {},
		onfinish,
		onhome,
		resume,
		rankedStartedAt = null,
		registerCheckpoint
	}: {
		resume?: CheckpointState;
		rankedStartedAt?: number | null;
		registerCheckpoint?: (read: () => CheckpointState) => void;
		round: ConnectRound;
		roundNumber: number;
		scoring?: ScoreValues;
		resolvedTheme?: ResolvedTheme | null;
		paused?: boolean;
		rankedRound?: boolean;
		entranceReady?: boolean;
		onready?: () => void;
		onmove?: (move: ConnectMove) => void;
		oncomplete?: (score: number, seconds: number) => void;
		onfinish: (score: number, seconds: number, strokes: number, filled: number) => void;
		onhome: () => void;
	} = $props();
	// svelte-ignore state_referenced_locally
	let game = $state(round);
	let phase = $state<'arrival' | 'playing' | 'finished' | 'failed'>('arrival');
	let board: HTMLDivElement;
	let mounted = $state(false);
	let entered = false;
	let activePair = -1;
	let activeStroke = -1;
	let activePointer: number | null = null;
	let lastInvalidAt = -Infinity;
	let elapsed = $state(0);
	let announcement = $state('');
	let ticker: ReturnType<typeof setInterval> | null = null;
	let clockBase = 0;
	let clockStart: number | null = null;
	let rankedStart: number | null = null;
	let entranceMotion: ReturnType<typeof motion.connectEnter> | null = null;
	const entranceDelay = createActiveDelay(() => {
		try {
			entranceMotion?.settle();
			phase = 'playing';
			onready();
		} catch {
			phase = 'failed';
			console.error('morphi:connect_entrance_failed');
		}
	});
	const finishDelay = createActiveDelay(() => {
		try {
			onfinish(connectScore(game, elapsed, scoring), elapsed, game.strokes, filledCount(game));
		} catch {
			phase = 'failed';
			console.error('morphi:connect_finish_failed');
		}
	});
	const total = $derived(game.size * game.size);
	const paths = $derived(game.paths);
	const owners = $derived.by(() => {
		const result = Array<number>(game.size * game.size).fill(-1);
		for (let pair = 0; pair < game.paths.length; pair++)
			for (const cell of game.paths[pair]!) result[cell] = pair;
		return result;
	});
	const endpoints = $derived.by(() => {
		const result = Array<number>(game.size * game.size).fill(-1);
		game.pairs.forEach((pair, i) => {
			result[pair.a] = i;
			result[pair.b] = i;
		});
		return result;
	});
	const colors = $derived(resolvedTheme?.colors ?? ['#2f6fed', '#009a86', '#7d61ae', '#b45309']);
	const symbols = $derived(resolvedTheme?.symbols ?? []);
	const linePoints = (path: number[]) =>
		path
			.map(
				(cell) =>
					`${((cell % game.size) + 0.5) * 100},${(Math.floor(cell / game.size) + 0.5) * 100}`
			)
			.join(' ');
	const cellLabel = (cell: number) =>
		endpoints[cell] >= 0
			? t('connect.cell.dot', {
					pair: endpoints[cell] + 1,
					row: Math.floor(cell / game.size) + 1,
					column: (cell % game.size) + 1
				})
			: t('connect.cell.empty', {
					row: Math.floor(cell / game.size) + 1,
					column: (cell % game.size) + 1
				});

	function clockMs(): number {
		if (rankedRound) return rankedStart === null ? 0 : performance.now() - rankedStart;
		return clockBase + (clockStart === null ? 0 : performance.now() - clockStart);
	}
	function startClock() {
		rankedStart ??= performance.now();
		if (clockStart === null) clockStart = performance.now();
		ticker ??= setInterval(() => {
			elapsed = Math.floor(clockMs() / 1000);
		}, 250);
	}
	function pauseClock() {
		if (clockStart !== null) {
			clockBase += performance.now() - clockStart;
			clockStart = null;
		}
		if (ticker) {
			clearInterval(ticker);
			ticker = null;
		}
	}
	function syncVisibility() {
		if (document.hidden || paused) {
			pointerEnd();
			entranceDelay.pause();
			finishDelay.pause();
			entranceMotion?.pause();
			if (!rankedRound) pauseClock();
		} else {
			entranceDelay.resume();
			finishDelay.resume();
			entranceMotion?.resume();
			if (phase === 'playing' && rankedStart !== null) startClock();
		}
	}
	function perform(move: ConnectMove) {
		try {
			const before = game;
			const after = applyConnectMove(before, move);
			game = after;
			onmove(move);
			void tick().then(() => motion.connectPaths(board, before.paths, after.paths));
			const delta = connectedCount(after) - connectedCount(before);
			const cut = after.paths.some(
				(path, pair) => pair !== move.pair && path.length < before.paths[pair]!.length
			);
			const shortened = after.paths[move.pair]!.length < before.paths[move.pair]!.length;
			if (after.status === 'won')
				motion.connectFeedback(board, 'pair', move.pair, `+${scoring.pair}`);
			else if (after.penalties > before.penalties) {
				sound.play('connect-redraw');
				motion.connectFeedback(board, 'redraw', move.pair, `−${scoring.redraw}`);
			} else if (delta > 0) {
				sound.play('connect-pair');
				motion.connectFeedback(board, 'pair', move.pair, `+${scoring.pair}`);
				announcement = t('connect.pairConnected', { pair: move.pair + 1 });
			} else if (cut || delta < 0) {
				sound.play('connect-cut');
				motion.connectFeedback(board, 'cut', move.pair);
			} else if (shortened) sound.play('connect-backtrack');
			else sound.play(move.stroke === before.strokes ? 'connect-start' : 'connect-extend');
			if (after.status === 'won') {
				phase = 'finished';
				activePair = -1;
				elapsed = Math.floor(clockMs() / 1000);
				pauseClock();
				const score = connectScore(after, elapsed, scoring);
				sound.play('connect-win');
				if (filledCount(after) === total) motion.connectFeedback(board, 'win', move.pair);
				oncomplete(score, elapsed);
				announcement = t('connect.won');
				finishDelay.start(motion.reduced() ? 0 : 1000, document.hidden || paused);
			}
		} catch (error) {
			if (!(error instanceof RangeError)) {
				phase = 'failed';
				console.error('morphi:connect_move_failed');
				return;
			}
			if (performance.now() - lastInvalidAt > 200) {
				lastInvalidAt = performance.now();
				sound.play('connect-invalid');
			}
		}
	}
	function begin(cell: number) {
		if (phase !== 'playing' || paused || document.hidden) return;
		const pair = endpoints[cell] >= 0 ? endpoints[cell] : owners[cell];
		if (pair < 0) return;
		startClock();
		activePair = pair;
		activeStroke = game.strokes;
		perform({ pair, cell, stroke: activeStroke, at: Math.floor(clockMs()) });
	}
	function step(cell: number) {
		if (phase !== 'playing' || paused || activePair < 0 || cell < 0 || cell >= total) return;
		if (game.paths[activePair]?.at(-1) === cell) return;
		perform({ pair: activePair, cell, stroke: activeStroke, at: Math.floor(clockMs()) });
	}
	function cellAt(event: PointerEvent): number {
		const rect = board.getBoundingClientRect();
		const x = Math.floor(((event.clientX - rect.left) * game.size) / rect.width);
		const y = Math.floor(((event.clientY - rect.top) * game.size) / rect.height);
		return x < 0 || y < 0 || x >= game.size || y >= game.size ? -1 : y * game.size + x;
	}
	function pointerDown(event: PointerEvent) {
		if (activePointer !== null) return;
		const cell = cellAt(event);
		if (cell < 0) return;
		begin(cell);
		if (activePair >= 0) {
			try {
				activePointer = event.pointerId;
				board.setPointerCapture(event.pointerId);
				event.preventDefault();
			} catch {
				pointerEnd();
				console.warn('morphi:connect_pointer_capture_failed');
			}
		}
	}
	function pointerMove(event: PointerEvent) {
		if (activePointer === event.pointerId && activePair >= 0) step(cellAt(event));
	}
	function pointerEnd(event?: PointerEvent) {
		if (event && activePointer !== event.pointerId) return;
		activePair = -1;
		activeStroke = -1;
		activePointer = null;
	}
	const cancelStroke = () => pointerEnd();
	function keyDown(event: KeyboardEvent, cell: number) {
		if (event.key === 'Escape') {
			pointerEnd();
			return;
		}
		if (activePointer !== null) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			begin(cell);
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
		const next = cell + delta;
		if (
			next < 0 ||
			next >= total ||
			(Math.abs(delta) === 1 && Math.floor(next / game.size) !== Math.floor(cell / game.size))
		)
			return;
		event.preventDefault();
		board.querySelectorAll<HTMLButtonElement>('.connect-cell')[next]?.focus();
		if (activePair >= 0) step(next);
	}
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
				phase = game.status === 'won' ? 'finished' : 'playing';
				onready();
				if (game.status === 'won') {
					oncomplete(connectScore(game, elapsed, scoring), elapsed);
					finishDelay.start(0, document.hidden || paused);
				} else if (resume.clockStarted && !(document.hidden || paused)) startClock();
				return;
			}
			entranceMotion = motion.connectEnter(board);
			sound.play('connect-appear');
			entranceDelay.start(
				resume?.pending.entrance ?? (motion.reduced() && !rankedRound ? 0 : CONNECT_ENTRANCE_MS),
				document.hidden || paused
			);
		});
	});
	onMount(() => {
		if (resume) {
			clockBase = resume.elapsedMs;
			elapsed = Math.floor(clockBase / 1000);
			if (resume.clockStarted)
				rankedStart =
					performance.now() -
					(rankedRound && rankedStartedAt !== null
						? Math.max(resume.elapsedMs, Date.now() - rankedStartedAt)
						: 0);
		}
		registerCheckpoint?.((): CheckpointState => ({
			phase,
			elapsedMs: clockMs(),
			clockStarted: rankedStart !== null,
			pending: entranceDelay.remaining() === null ? {} : { entrance: entranceDelay.remaining()! }
		}));
		mounted = true;
		document.addEventListener('visibilitychange', syncVisibility);
		window.addEventListener('blur', cancelStroke);
		window.addEventListener('resize', cancelStroke);
		return () => {
			document.removeEventListener('visibilitychange', syncVisibility);
			window.removeEventListener('blur', cancelStroke);
			window.removeEventListener('resize', cancelStroke);
			pauseClock();
			entranceDelay.cancel();
			finishDelay.cancel();
			entranceMotion?.destroy();
		};
	});
</script>

<div
	class="game connect-game"
	data-family="connect"
	data-round={roundNumber}
	data-phase={phase}
	data-seed={game.seed}
	data-theme-version={resolvedTheme?.themeConfigVersion}
	data-theme-generator={resolvedTheme?.themeGeneratorVersion}
	style={resolvedTheme ? themeStyle(resolvedTheme) : ''}
>
	<h2 class="sr-only">{t('v1.game.connect')}</h2>
	<header class="hud">
		<button type="button" class="home-button" aria-label={t('game.home')} onclick={onhome}
			><svg viewBox="0 0 24 24" aria-hidden="true"
				><path
					d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linejoin="round"
				/></svg
			></button
		>
		<div class="stats">
			<div class="stat">
				<span class="stat-label">{t('game.score')}</span><strong
					>{formatNumber(connectScore(game, elapsed, scoring))}</strong
				>
			</div>
			<div class="stat">
				<span class="stat-label">{t('v1.game.pairs')}</span><strong
					>{connectedCount(game)} / {game.pairs.length}</strong
				>
			</div>
			<div class="stat">
				<span class="stat-label">{t('connect.filled')}</span><strong
					>{Math.round((filledCount(game) * 100) / total)}%</strong
				>
			</div>
		</div>
		<p class="round-meta">{t('game.round', { number: roundNumber })}</p>
	</header>
	<main class="stage">
		<div
			class="connect-board"
			bind:this={board}
			style={`--size:${game.size}`}
			role="group"
			aria-label={t('connect.board')}
			onpointerdown={pointerDown}
			onpointermove={pointerMove}
			onpointerup={pointerEnd}
			onpointercancel={pointerEnd}
			onlostpointercapture={pointerEnd}
		>
			<svg
				class="connect-lines"
				viewBox={`0 0 ${game.size * 100} ${game.size * 100}`}
				aria-hidden="true"
			>
				{#each paths as path, pair (pair)}
					{#if path.length > 1}<polyline
							data-pair={pair}
							points={linePoints(path)}
							fill="none"
							stroke={colors[pair % colors.length]}
							stroke-width="24"
							stroke-linejoin="round"
							stroke-linecap="round"
						/>{/if}
				{/each}
			</svg>
			{#each Array.from({ length: total }, (_, i) => i) as cell (cell)}
				<button
					type="button"
					class="connect-cell"
					class:claimed={owners[cell] >= 0}
					class:endpoint={endpoints[cell] >= 0}
					style={`--pair-color:${colors[(endpoints[cell] >= 0 ? endpoints[cell] : Math.max(0, owners[cell])) % colors.length]}`}
					aria-label={cellLabel(cell)}
					tabindex={cell === 0 ? 0 : -1}
					onkeydown={(event) => keyDown(event, cell)}
				>
					{#if endpoints[cell] >= 0}<span class="connect-dot" data-pair={endpoints[cell]}>
							{#if symbols[endpoints[cell]]}<svg viewBox="0 0 48 48" aria-hidden="true"
									><path
										d={symbols[endpoints[cell]].path}
										fill="none"
										stroke="currentColor"
										stroke-width="4"
									/></svg
								>
							{:else}<span aria-hidden="true">{endpoints[cell] + 1}</span>{/if}
							<span class="connect-ring" aria-hidden="true"></span>
						</span>{/if}
				</button>
			{/each}
		</div>
	</main>
	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
	{#if phase === 'failed'}<p class="connect-error" role="alert">{t('connect.error')}</p>{/if}
</div>

<style>
	.connect-game {
		min-height: 0;
	}
	.connect-game[data-phase='arrival'] .connect-cell,
	.connect-game[data-phase='arrival'] .connect-dot {
		opacity: 0;
	}
	.home-button {
		width: 44px;
		height: 44px;
		border: 1px solid var(--round-edge);
		border-radius: 12px;
		background: var(--round-bg);
		color: var(--ink);
		font-size: 22px;
		cursor: pointer;
	}
	.home-button svg {
		width: 22px;
		height: 22px;
	}
	.connect-board {
		position: relative;
		width: min(100cqw, 100cqh);
		aspect-ratio: 1;
		display: grid;
		grid-template-columns: repeat(var(--size), 1fr);
		grid-template-rows: repeat(var(--size), 1fr);
		gap: clamp(3px, 0.6vmin, var(--theme-gap, 7px));
		touch-action: none;
		user-select: none;
	}
	.connect-lines {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 4;
		overflow: visible;
	}
	.connect-cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--round-edge) 24%, transparent);
		border-radius: var(--connect-radius, 14%);
		background: color-mix(in srgb, var(--round-bg) 84%, white);
		color: var(--ink);
		cursor: crosshair;
	}
	.connect-cell.claimed {
		background: color-mix(in srgb, var(--pair-color) 17%, var(--round-bg));
	}
	.connect-cell:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: -4px;
	}
	.connect-dot {
		position: relative;
		z-index: 5;
		display: grid;
		place-items: center;
		width: 59%;
		aspect-ratio: 1;
		border: 3px solid var(--pair-color);
		border-radius: 50%;
		background: var(--pair-color);
		color: var(--theme-face, white);
		font-size: clamp(10px, 2vw, 24px);
		font-weight: 900;
	}
	.connect-dot svg {
		width: 73%;
		height: 73%;
	}
	.connect-ring {
		position: absolute;
		inset: -3px;
		border: 3px solid var(--pair-color);
		border-radius: 50%;
		opacity: 0;
		pointer-events: none;
	}
	.connect-board :global(.connect-float) {
		position: absolute;
		z-index: 8;
		font-size: clamp(15px, 2vw, 25px);
		font-weight: 900;
		letter-spacing: 0.01em;
		pointer-events: none;
		white-space: nowrap;
	}
	.connect-error {
		padding: 12px;
		border: 1px solid var(--danger);
		border-radius: 12px;
		background: var(--round-bg);
		color: var(--danger);
	}
	@media (prefers-reduced-motion: reduce) {
		.connect-cell {
			transition: none;
		}
	}
</style>
