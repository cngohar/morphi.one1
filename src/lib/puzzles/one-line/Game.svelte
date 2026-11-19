<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration } from '#lib/ui/format.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { sound } from '#lib/ui/sound.js';
	import { CARD_RANKED_OPENING_MS } from '#lib/round-timing.js';
	import { oneLineMotion } from './motion.js';
	import {
		applyOneLineMove,
		oneLineHint,
		oneLineScore,
		ONE_LINE_COUNTDOWN,
		type OneLineRound,
		type OneLineMove
	} from './logic.js';

	let {
		round,
		roundNumber,
		scoring,
		paused,
		rankedRound,
		entranceReady,
		onready,
		onmove,
		oncomplete,
		onfinish,
		onhome,
		resume,
		rankedStartedAt = null,
		registerCheckpoint
	}: Omit<PuzzleViewProps, 'round' | 'onfinish'> & {
		round: OneLineRound;
		onfinish: (game: OneLineRound, seconds: number, score: number) => void;
	} = $props();
	let game = $state(untrack(() => round));
	let phase = $state('arrival');
	let elapsed = $state(0);
	let mounted = $state(false);
	let selected = $state<number | null>(null);
	let cursor = $state(0);
	let message = $state('');
	let coach = $state('');
	let hintStarts = $state<number[]>([]);
	let hintEdges = $state<number[]>([]);
	let root: HTMLDivElement;
	let board: HTMLDivElement;
	let base = 0;
	let started: number | null = null;
	let rankedStart: number | null = null;
	let ticker: ReturnType<typeof setInterval>;
	let disposed = false;
	let pointer: { id: number; x: number; y: number; moved: boolean; wasCurrent: boolean } | null =
		null;
	const animations: ReturnType<typeof oneLineMotion>[] = [];
	const drawingDots = $derived.by(() => {
		const xs = game.dots.map((dot) => dot.x);
		const ys = game.dots.map((dot) => dot.y);
		const left = Math.min(...xs);
		const top = Math.min(...ys);
		const width = Math.max(...xs) - left;
		const height = Math.max(...ys) - top;
		return game.dots.map(({ x, y }) => ({
			x: ((x - left) * 100) / width,
			y: ((y - top) * 100) / height
		}));
	});
	const current = $derived.by(() => {
		const stroke = game.lifted && game.strokes.length === 1 ? undefined : game.strokes.at(-1);
		return stroke ? (stroke.path.at(-1)?.to ?? stroke.start) : null;
	});
	const counts = $derived.by(() => {
		const result = game.edges.map(() => 0);
		for (const stroke of game.strokes) for (const step of stroke.path) result[step.edge]!++;
		return result;
	});
	const total = $derived(game.edges.reduce((sum, edge) => sum + (edge.double ? 2 : 1), 0));
	const finishDelay = createActiveDelay(() => {
		if (!disposed) onfinish(game, elapsed, oneLineScore(game, elapsed, scoring));
	});
	function clockMs() {
		return rankedRound
			? rankedStart === null
				? 0
				: performance.now() - rankedStart
			: base + (started === null ? 0 : performance.now() - started);
	}
	function startClock() {
		const issuedElapsed =
			rankedRound && rankedStartedAt !== null
				? Date.now() - rankedStartedAt - CARD_RANKED_OPENING_MS
				: 0;
		rankedStart ??= performance.now() - Math.max(base, issuedElapsed);
		started ??= performance.now();
	}
	function pauseClock() {
		if (started !== null) {
			base += performance.now() - started;
			started = null;
		}
	}
	function motion(nodes: Element[], kind: 'trace' | 'pulse' | 'press' | 'win' | 'panel') {
		try {
			if (animations.length >= 12) animations.shift()?.destroy();
			animations.push(oneLineMotion(nodes, kind));
		} catch {
			for (const node of nodes) node.removeAttribute('style');
			console.warn('morphi:one_line_motion_unavailable');
		}
	}
	function finish() {
		elapsed = Math.floor(clockMs() / 1000);
		pauseClock();
		phase = 'finished';
		const score = oneLineScore(game, elapsed, scoring);
		oncomplete(score, elapsed);
		sound.play(game.status === 'won' ? 'win' : 'clear');
		if (game.status === 'won')
			void tick().then(() => {
				if (!disposed) {
					motion([...root.querySelectorAll('.drawn')], 'win');
					motion([...root.querySelectorAll('.board-card')], 'panel');
				}
			});
		finishDelay.start(
			matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
			paused || document.hidden
		);
	}
	function commit(move: OneLineMove) {
		if (phase !== 'playing' || game.status !== 'playing') return false;
		if (move.action !== 5 && game.rules.timing && clockMs() >= ONE_LINE_COUNTDOWN * 1000) {
			commit({ action: 5, edge: 0, value: 0 });
			return false;
		}
		if ((paused || document.hidden) && !(rankedRound && move.action === 5)) return false;
		try {
			const next = applyOneLineMove(game, move);
			game = next;
			onmove(move);
			message = '';
			if (move.action !== 2) {
				hintStarts = [];
				hintEdges = [];
			}
			if (game.status !== 'playing') finish();
			return true;
		} catch (error) {
			const reason = error instanceof Error ? error.message : '';
			message =
				reason === 'direction'
					? t('one-line.direction')
					: reason === 'retraced'
						? t('one-line.retraced')
						: t('one-line.invalid');
			sound.play('invalid');
			return false;
		}
	}
	function visit(dot: number) {
		if (phase !== 'playing' || paused || document.hidden) return;
		if (game.rules.win === 1 && game.verdict === null) return;
		const from = current ?? selected;
		if (from === null) {
			selected = dot;
			cursor = dot;
			startClock();
			sound.play('pick');
			return;
		}
		if (from === dot) return;
		const edge = game.edges.findIndex(
			(item) => (item.from === from && item.to === dot) || (item.to === from && item.from === dot)
		);
		if (edge < 0) {
			message = t('one-line.invalid');
			sound.play('invalid');
			return;
		}
		if (commit({ action: 0, edge, value: current === null ? from : 0 })) {
			selected = null;
			cursor = dot;
			sound.play('place');
			void tick().then(() => {
				if (!disposed) motion([...root.querySelectorAll(`[data-edge="${edge}"] .drawn`)], 'trace');
			});
		}
	}
	function lift() {
		if (current !== null && commit({ action: 6, edge: 0, value: 0 })) selected = null;
	}
	function undo() {
		if (commit({ action: 1, edge: 0, value: 0 })) sound.play('pick');
	}
	function restart() {
		if (commit({ action: 3, edge: 0, value: 0 })) {
			selected = null;
			sound.play('clear');
		}
	}
	function hint() {
		if (phase !== 'playing' || paused || game.rules.hint === 2 || game.hintsUsed >= 3) return;
		const answer = oneLineHint(game);
		if (!commit({ action: 2, edge: 0, value: 0 })) return;
		if (!answer) {
			message = t('one-line.stranded');
			return;
		}
		hintStarts = answer.start;
		const steps = answer.trail.flat();
		hintEdges =
			game.hintsUsed === 1 && answer.start.length
				? []
				: game.hintsUsed < 3
					? steps.slice(0, 1).map((step) => step.edge)
					: steps.map((step) => step.edge);
		sound.play('place');
	}
	function press(event: PointerEvent, dot: number) {
		if (event.button !== 0 || pointer || phase !== 'playing') return;
		event.preventDefault();
		const wasCurrent = current === dot;
		pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, wasCurrent };
		board.setPointerCapture(event.pointerId);
		visit(dot);
	}
	function drag(event: PointerEvent) {
		if (!pointer || pointer.id !== event.pointerId) return;
		if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.moved = true;
		if (!pointer.moved) return;
		const target = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest<HTMLElement>('[data-dot]');
		if (target && board.contains(target)) {
			const dot = Number(target.dataset.dot);
			const stroke = game.strokes.at(-1);
			const previous =
				stroke && stroke.path.length > game.undoFloor
					? (stroke.path.at(-2)?.to ?? stroke.start)
					: null;
			if (dot === previous) {
				undo();
				cursor = dot;
			} else visit(dot);
		}
	}
	function release(event: PointerEvent) {
		if (!pointer || pointer.id !== event.pointerId) return;
		const { moved, wasCurrent } = pointer;
		pointer = null;
		if (moved || wasCurrent) lift();
	}
	function keydown(event: KeyboardEvent) {
		if (
			phase !== 'playing' ||
			paused ||
			document.hidden ||
			event.ctrlKey ||
			event.metaKey ||
			event.altKey ||
			event.isComposing
		)
			return;
		if (
			event.target instanceof HTMLElement &&
			event.target.closest('input,textarea,select,[contenteditable="true"]')
		)
			return;
		const key = event.key.toLowerCase();
		if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
			event.preventDefault();
			const origin = game.dots[cursor]!;
			const dx = key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : 0;
			const dy = key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0;
			const candidates = game.dots
				.map((dot, index) => ({
					index,
					forward: (dot.x - origin.x) * dx + (dot.y - origin.y) * dy,
					side: Math.abs((dot.x - origin.x) * dy - (dot.y - origin.y) * dx)
				}))
				.filter((dot) => dot.forward > 0)
				.sort((a, b) => a.forward + a.side * 2 - (b.forward + b.side * 2));
			if (candidates[0]) {
				cursor = candidates[0].index;
				root.querySelector<HTMLButtonElement>(`[data-dot="${cursor}"]`)?.focus();
			}
		} else if (key === 'enter' || key === ' ') {
			if (event.target instanceof HTMLButtonElement && event.target.dataset.dot === undefined)
				return;
			event.preventDefault();
			if (current === cursor) lift();
			else visit(cursor);
		} else if (key === 'u') {
			event.preventDefault();
			undo();
		} else if (key === 'r') {
			event.preventDefault();
			restart();
		} else if (key === 'h') {
			event.preventDefault();
			hint();
		}
	}
	function visibility() {
		if (document.hidden || paused) {
			if (!rankedRound) pauseClock();
			finishDelay.pause();
			pointer = null;
		} else {
			if (rankedStart !== null && phase === 'playing') startClock();
			finishDelay.resume();
		}
	}
	$effect(() => {
		if (mounted && entranceReady && phase === 'arrival') {
			phase = game.status === 'playing' ? 'playing' : 'finished';
			if ((game.rules.timing === 1 || resume?.clockStarted) && game.status === 'playing')
				startClock();
			onready();
			if (game.status !== 'playing') {
				oncomplete(oneLineScore(game, elapsed, scoring), elapsed);
				finishDelay.start(resume?.pending.finish ?? 0, paused || document.hidden);
			}
		}
	});
	$effect(() => {
		if (mounted) {
			void paused;
			untrack(visibility);
		}
	});
	onMount(() => {
		const coachKey = game.rules.direction
			? 'morphi.oneLine.arrowCoach'
			: 'morphi.oneLine.hintCoach';
		if (game.rules.direction || roundNumber === 1) {
			try {
				if (localStorage.getItem(coachKey) !== '1') {
					coach = t(game.rules.direction ? 'one-line.arrowCoach' : 'one-line.hintCoach');
					localStorage.setItem(coachKey, '1');
				}
			} catch {
				coach = t(game.rules.direction ? 'one-line.arrowCoach' : 'one-line.hintCoach');
			}
		}
		if (resume) {
			base = resume.elapsedMs;
			elapsed = Math.floor(base / 1000);
			if (resume.clockStarted && rankedRound) startClock();
		}
		registerCheckpoint?.((): CheckpointState => ({
			phase,
			elapsedMs: clockMs(),
			clockStarted: rankedStart !== null,
			pending: finishDelay.remaining() === null ? {} : { finish: finishDelay.remaining()! }
		}));
		mounted = true;
		void tick().then(() => {
			if (!disposed) motion([...root.querySelectorAll('.odd span')], 'pulse');
		});
		ticker = setInterval(() => {
			if (phase === 'playing') {
				elapsed = Math.floor(clockMs() / 1000);
				if (game.rules.timing === 1 && elapsed >= ONE_LINE_COUNTDOWN)
					commit({ action: 5, edge: 0, value: 0 });
			}
		}, 100);
		window.addEventListener('keydown', keydown);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			disposed = true;
			clearInterval(ticker);
			finishDelay.cancel();
			for (const animation of animations) animation.destroy();
			window.removeEventListener('keydown', keydown);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
</script>

<div
	class="game one-line-game"
	data-family="one-line"
	data-round={roundNumber}
	data-phase={phase}
	data-status={game.status}
	data-seed={game.seed}
	bind:this={root}
>
	<h2 class="sr-only">{t('v1.game.one-line')}</h2>
	<div class="content">
		<div class="board-card">
			<header class="stats">
				<span>{t('one-line.lines')} <strong>{game.edgesCovered}/{total}</strong></span>
				<span
					data-countdown={game.rules.timing === 1
						? Math.max(0, ONE_LINE_COUNTDOWN - elapsed)
						: undefined}
					>{t(game.rules.timing === 1 ? 'one-line.timeLeft' : 'one-line.time')}
					<strong
						>{formatDuration(
							game.rules.timing === 1 ? Math.max(0, ONE_LINE_COUNTDOWN - elapsed) : elapsed
						)}</strong
					></span
				>
				<span
					>{t('one-line.hints')}
					<strong>{game.rules.hint === 2 ? 0 : Math.max(0, 3 - game.hintsUsed)}</strong></span
				>
			</header>
			<div
				class="board"
				role="group"
				aria-label={t('one-line.board')}
				bind:this={board}
				onpointermove={drag}
				onpointerup={release}
				onpointercancel={release}
			>
				<div class="drawing">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
						<defs
							><marker
								id="one-line-arrow"
								viewBox="0 0 10 10"
								refX="5"
								refY="5"
								markerWidth="5"
								markerHeight="5"
								orient="auto-start-reverse"
								><path d="M 0 0 L 10 5 L 0 10 z" fill="#65778d" /></marker
							></defs
						>
						{#each game.edges as edge, at (at)}
							{@const a = drawingDots[edge.from]!}{@const b = drawingDots[edge.to]!}
							<g data-edge={at}
								><line
									x1={a.x}
									y1={a.y}
									x2={b.x}
									y2={b.y}
									class:hinted={hintEdges.includes(at)}
									class="edge"
									marker-mid={edge.directed ? 'url(#one-line-arrow)' : undefined}
								/>
								{#if counts[at]}<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="drawn" />{/if}
								{#if edge.directed}<path
										d={`M ${a.x} ${a.y} L ${(a.x + b.x) / 2} ${(a.y + b.y) / 2} L ${b.x} ${b.y}`}
										class="arrow-line"
										marker-mid="url(#one-line-arrow)"
									/>{/if}
								{#if edge.double}<text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2}
										>{counts[at] || 0}/2</text
									>{/if}
							</g>
						{/each}
					</svg>
					{#each game.dots as dot, at (at)}
						{@const degree = game.edges.reduce(
							(sum, edge) => sum + (edge.from === at || edge.to === at ? (edge.double ? 2 : 1) : 0),
							0
						)}
						<button
							type="button"
							class="dot"
							class:odd={game.rules.degree === 0 && game.odd.includes(at)}
							class:current={current === at || selected === at}
							class:hint-dot={hintStarts.includes(at)}
							data-dot={at}
							style={`left:${drawingDots[at].x}%;top:${drawingDots[at].y}%`}
							aria-label={game.rules.degree === 1
								? t('one-line.dot', { column: dot.x + 1, row: dot.y + 1 })
								: t('one-line.dotDegree', {
										column: dot.x + 1,
										row: dot.y + 1,
										degree,
										parity: t(degree % 2 ? 'one-line.odd' : 'one-line.even')
									})}
							onpointerdown={(event) => press(event, at)}
							onclick={(event) => {
								if (event.detail === 0) visit(at);
							}}><span></span></button
						>
					{/each}
				</div>
			</div>
		</div>
		<aside class="controls">
			<p class="rule">{coach || t('one-line.step1')}</p>
			{#if game.rules.win === 1 && game.verdict === null}
				<p>{t('one-line.verdictPrompt')}</p>
				<div class="actions">
					<button data-verdict="0" onclick={() => commit({ action: 4, edge: 0, value: 0 })}
						>{t('one-line.drawable')}</button
					><button data-verdict="1" onclick={() => commit({ action: 4, edge: 0, value: 1 })}
						>{t('one-line.impossible')}</button
					>
				</div>
			{:else}
				<div class="actions">
					<button
						data-undo
						disabled={phase !== 'playing' ||
							current === null ||
							(game.strokes.at(-1)?.path.length ?? 0) <= game.undoFloor}
						onclick={(event) => {
							motion([event.currentTarget], 'press');
							undo();
						}}>{t('one-line.undo')}</button
					><button
						class="restart"
						data-restart
						disabled={phase !== 'playing'}
						onclick={(event) => {
							motion([event.currentTarget], 'press');
							restart();
						}}>{t('one-line.restart')}</button
					><button
						data-hint
						disabled={phase !== 'playing' || game.rules.hint === 2 || game.hintsUsed >= 3}
						onclick={(event) => {
							motion([event.currentTarget], 'press');
							hint();
						}}>{t('one-line.hint')}</button
					>
				</div>
			{/if}
			<p class="message" data-message aria-live="polite">{message}</p>
			<div class="teaching">
				<strong>{t('one-line.howTo')}</strong><span>1. {t('one-line.step1')}</span><span
					>2. {t('one-line.step2')}</span
				><span>3. {t('one-line.step3')}</span>
			</div>
		</aside>
	</div>
	{#if phase === 'failed'}<p role="alert">{t('one-line.invalid')}</p>
		<button onclick={onhome}>{t('game.home')}</button>{/if}
</div>

<style>
	:global(.active-round) .one-line-game.one-line-game {
		width: min(100%, 560px);
		height: 100%;
		min-height: 0;
		display: flex;
		padding: 8px;
		color: #1b2433;
		overflow: hidden;
	}
	.content {
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.board-card {
		background: #fff;
		border-radius: 20px;
		box-shadow: 0 8px 24px #1b24331a;
		padding: 8px;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.stats {
		display: flex;
		justify-content: space-around;
		gap: 5px;
		padding: 7px;
		border-radius: 999px;
		background: #e3eaf3;
		font-size: 11px;
		font-weight: 800;
		flex: none;
	}
	.stats span {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
	}
	.stats strong {
		font-size: 15px;
	}
	.board {
		position: relative;
		flex: 1;
		min-height: 0;
		touch-action: none;
		overflow: hidden;
	}
	.drawing {
		position: absolute;
		inset: 24px;
	}
	svg {
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.edge,
	.drawn,
	.arrow-line {
		fill: none;
		stroke: #96a7bc;
		stroke-width: 1.5;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.edge {
		stroke-width: 5;
	}
	.edge.hinted {
		stroke: #009a86;
		stroke-width: 8;
	}
	.drawn {
		stroke: #2f6fed;
		stroke-width: 7;
	}
	.arrow-line {
		stroke: transparent;
	}
	text {
		font-size: 7px;
		fill: #7d61ae;
		font-weight: 900;
		paint-order: stroke;
		stroke: white;
		stroke-width: 2px;
	}
	.dot {
		position: absolute;
		width: 44px;
		height: 44px;
		padding: 0;
		transform: translate(-50%, -50%);
		border: 0;
		border-radius: 50%;
		background: transparent;
		display: grid;
		place-items: center;
		touch-action: none;
	}
	.dot span {
		width: 15px;
		height: 15px;
		border: 3px solid #1b2433;
		background: white;
		border-radius: 50%;
	}
	.dot.odd span {
		outline: 2px solid #e5532d;
		outline-offset: 3px;
	}
	.dot.odd::after {
		content: '';
		position: absolute;
		inset: 5px;
		border: 2px dashed #e5532d;
		border-radius: 50%;
	}
	.dot.current span,
	.dot.hint-dot span {
		background: #2f6fed;
		border-color: #2f6fed;
	}
	.dot:focus-visible {
		outline: 3px solid #2f6fed;
	}
	.controls {
		flex: none;
	}
	.rule {
		text-align: center;
		margin: 0 0 4px;
		font-size: 12px;
	}
	.actions {
		display: flex;
		gap: 6px;
		justify-content: center;
	}
	.actions button {
		min-height: 44px;
		flex: 1;
		border: 1px solid #c9d4e2;
		border-radius: 12px;
		background: #fff;
		font-weight: 800;
		color: #1b2433;
	}
	.actions .restart {
		background: #2f6fed;
		color: white;
		border-color: #2f6fed;
	}
	button:disabled {
		opacity: 0.45;
	}
	.message {
		min-height: 16px;
		margin: 2px 0;
		text-align: center;
		font-size: 11px;
		color: #a33b20;
	}
	.teaching {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 4px 10px;
		font-size: 10px;
		line-height: 1.2;
	}
	@media (orientation: landscape) and (max-height: 560px) {
		:global(.active-round) .one-line-game.one-line-game {
			width: min(100%, 700px);
			padding: 2px 8px;
		}
		.content {
			flex-direction: row;
		}
		.board-card {
			width: 65%;
		}
		.stats {
			padding: 4px 7px;
		}
		.drawing {
			inset: 22px 24px;
		}
		.controls {
			width: 35%;
			min-width: 0;
			display: flex;
			flex-direction: column;
			justify-content: center;
		}
		.actions {
			flex-wrap: wrap;
		}
		.actions button {
			min-height: 40px;
		}
		.teaching {
			flex-direction: column;
		}
	}
</style>
