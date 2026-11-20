<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { CARD_RANKED_OPENING_MS } from '#lib/round-timing.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { formatDuration } from '#lib/ui/format.js';
	import { sound } from '#lib/ui/sound.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import {
		activeCutEdges,
		applyShapeDivisionMove,
		canFinishByCheck,
		entranceDuration,
		findCutPath,
		nextHintCell,
		outlinePath,
		shapeDivisionScore,
		vertexPoint,
		SHAPE_DIVISION_COUNTDOWN,
		SHAPE_DIVISION_MAX_MOVES,
		type Edge,
		type ShapeDivisionMove,
		type ShapeDivisionRound
	} from './logic.js';
	import { shapeDivisionDetach, shapeDivisionEntrance } from './motion.js';

	let {
		round,
		scoring,
		paused,
		rankedRound,
		rankedStartedAt,
		checkpointSavedAt,
		entranceReady,
		resume,
		registerCheckpoint,
		onready,
		onmove,
		oncomplete,
		onfinish,
		ontryanother
	}: Omit<PuzzleViewProps, 'round' | 'onfinish'> & {
		round: ShapeDivisionRound;
		onfinish: (game: ShapeDivisionRound, seconds: number, score: number) => void;
	} = $props();

	const maskPrefix = $props.id();
	let game = $state.raw(untrack(() => round));
	let phase = $state('arrival');
	let mounted = $state(false);
	let seconds = $state(0);
	let selected = $state<number | null>(null);
	let cursor = $state(untrack(() => round.board.vertices[0] ?? 0));
	let hover = $state<number | null>(null);
	let message = $state('');
	let board: HTMLDivElement;
	let outline: SVGPathElement;
	let baseMs = 0;
	let started: number | null = null;
	let stopEntrance: (() => void) | undefined;
	let disposed = false;
	let pointerStart: number | null = null;
	const finishDelay = createActiveDelay(() =>
		onfinish(game, seconds, shapeDivisionScore(game, seconds, scoring))
	);
	const enabled = $derived(phase === 'playing' && !paused);
	const countdown = $derived(game.rules.timing === 1);
	const teaching = $derived(
		game.rules.scoring === 1
			? 'equality-score'
			: game.rules.pieces === 2
				? 'pieces-2'
				: game.rules.pieces === 5
					? 'pieces-5'
					: game.rules.pieceSize === 4
						? 'piece-size-4'
						: game.rules.relation === 1
							? 'equal-area'
							: game.rules.content === 1
								? 'one-tree'
								: game.rules.given === 1
									? 'shape-given'
									: game.rules.timing === 1
										? 'countdown-300'
										: game.rules.hint === 0
											? 'no-hint'
											: 'classic'
	);
	const lastSlot = $derived(game.moves === SHAPE_DIVISION_MAX_MOVES - 1);
	const blocked = $derived(lastSlot && !canFinishByCheck(game, scoring));
	const preview = $derived(
		selected !== null && hover !== null ? findCutPath(game.board, selected, hover) : null
	);
	const drawn = $derived(
		activeCutEdges(game).filter(([a, b]) => {
			const link = game.board.links.find(
				({ edge }) => (edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a)
			);
			return (
				!link ||
				game.pieces.some((piece) => piece.includes(link.cells[0]) && piece.includes(link.cells[1]))
			);
		})
	);
	const progress = $derived(
		Math.min(100, Math.round((100 * (game.pieces.length - 1)) / Math.max(1, game.rules.pieces - 1)))
	);

	function clockMs() {
		if (rankedRound) {
			if (resume?.clockStarted && checkpointSavedAt !== undefined)
				return Math.max(0, resume.elapsedMs + Date.now() - checkpointSavedAt);
			if (rankedStartedAt != null)
				return Math.max(
					0,
					Date.now() -
						rankedStartedAt -
						CARD_RANKED_OPENING_MS -
						entranceDuration(game.board.perimeter) -
						(countdown ? 0 : 1000)
				);
		}
		return baseMs + (started === null ? 0 : performance.now() - started);
	}
	function visibility() {
		if (!mounted) return;
		if (paused || document.hidden) {
			if (started !== null) {
				baseMs += performance.now() - started;
				started = null;
			}
			finishDelay.pause();
		} else {
			if (phase === 'playing' && started === null) started = performance.now();
			finishDelay.resume();
		}
	}
	function finish(delay = 500) {
		phase = 'finished';
		seconds = Math.min(7200, Math.floor(clockMs() / 1000));
		const score = shapeDivisionScore(game, seconds, scoring);
		oncomplete(score, seconds);
		sound.play(game.status === 'won' ? 'win' : 'clear');
		finishDelay.start(
			matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : delay,
			paused || document.hidden
		);
	}
	function updateTime() {
		if (phase !== 'playing') return;
		seconds = Math.min(7200, Math.floor(clockMs() / 1000));
		if (
			countdown &&
			seconds >= SHAPE_DIVISION_COUNTDOWN &&
			(rankedRound || (enabled && !document.hidden))
		)
			commit({ action: 5, first: 0, second: 0 });
	}
	function verdictText() {
		switch (game.verdict) {
			case 'count':
				return t('shape-division.count', { count: game.pieces.length, pieces: game.rules.pieces });
			case 'size':
				return t('shape-division.size', {
					sizes: game.pieces.map((piece) => piece.length).join(', ')
				});
			case 'shape':
				return t('shape-division.shape');
			case 'connected':
				return t('shape-division.connected');
			case 'tree':
				return t('shape-division.tree');
			case 'given':
				return t('shape-division.given');
			case 'equality':
				return t('shape-division.equalityIncomplete');
			default:
				return '';
		}
	}
	function commit(move: ShapeDivisionMove) {
		if (phase !== 'playing' || ((!enabled || document.hidden) && move.action !== 5)) return false;
		if (move.action !== 5 && countdown && clockMs() >= SHAPE_DIVISION_COUNTDOWN * 1000) {
			updateTime();
			return false;
		}
		if (lastSlot && (move.action !== 2 || !canFinishByCheck(game, scoring)) && move.action !== 5)
			return false;
		const previous = game;
		try {
			game = applyShapeDivisionMove(game, move, scoring);
		} catch {
			message = move.action === 3 ? t('shape-division.noHint') : t('shape-division.noRoute');
			sound.play('invalid');
			return false;
		}
		if (previous === game) return false;
		onmove(move);
		message = move.action === 2 ? verdictText() : '';
		if (game.mistakes > previous.mistakes) sound.play('invalid');
		else if (move.action < 2) sound.play('place');
		else if (move.action === 3) sound.play('pick');
		if (game.pieces.length > previous.pieces.length) {
			sound.play('match');
			void tick().then(() => {
				if (disposed) return;
				for (const node of board.querySelectorAll<SVGElement>('[data-piece-inset]')) {
					const group = node.closest('mask')?.nextElementSibling;
					if (group instanceof SVGElement) shapeDivisionDetach(node, group);
				}
			});
		}
		if (game.status !== 'playing') finish();
		return true;
	}
	function visit(vertex: number) {
		if (!enabled || blocked) return;
		cursor = vertex;
		if (selected === null) {
			selected = vertex;
			sound.play('pick');
			return;
		}
		if (selected === vertex) {
			selected = null;
			return;
		}
		if (!findCutPath(game.board, selected, vertex)) {
			message = t('shape-division.noRoute');
			sound.play('invalid');
			selected = null;
			return;
		}
		const exists = game.cuts.some(
			(cut) =>
				(cut.first === selected && cut.second === vertex) ||
				(cut.first === vertex && cut.second === selected)
		);
		commit({ action: exists ? 1 : 0, first: selected, second: vertex });
		selected = null;
	}
	function action(action: number) {
		if (
			action === 3 &&
			(scoring.hintCap === 0 ||
				game.hints.length >= (scoring.hintCap ?? 3) ||
				nextHintCell(game) === null)
		) {
			message = t('shape-division.noHint');
			return;
		}
		if (commit({ action, first: 0, second: 0 })) selected = null;
	}
	function point(event: PointerEvent): number {
		const bounds = board.getBoundingClientRect();
		const x = ((event.clientX - bounds.left) / bounds.width) * game.board.width;
		const y = ((event.clientY - bounds.top) / bounds.height) * game.board.height;
		return game.board.vertices.reduce((best, vertex) => {
			const [vx, vy] = vertexPoint(game.board, vertex);
			const [bx, by] = vertexPoint(game.board, best);
			return Math.hypot(vx - x, vy - y) < Math.hypot(bx - x, by - y) ? vertex : best;
		}, game.board.vertices[0]!);
	}
	function down(event: PointerEvent) {
		if (enabled && event.button === 0) {
			pointerStart = point(event);
			board.setPointerCapture(event.pointerId);
		}
	}
	function up(event: PointerEvent) {
		if (pointerStart === null) return;
		const start = pointerStart;
		pointerStart = null;
		const end = point(event);
		if (end !== start) selected = null;
		visit(start);
		if (end !== start) visit(end);
	}
	function keydown(event: KeyboardEvent) {
		if (!enabled || event.altKey || event.ctrlKey || event.metaKey) return;
		const key = event.key.toLowerCase();
		if (event.target instanceof HTMLButtonElement && (key === 'enter' || key === ' ')) return;
		if (key === 'escape') selected = null;
		else if (key === 'enter' || key === ' ') visit(cursor);
		else if (key === 'u') action(4);
		else if (key === 'h' && game.rules.hint) action(3);
		else if (key === 'r') action(6);
		else if (key === 'c') action(2);
		else if (key.startsWith('arrow')) {
			const [x, y] = vertexPoint(game.board, cursor);
			const dx = key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : 0;
			const dy = key === 'arrowup' ? -1 : key === 'arrowdown' ? 1 : 0;
			const next = game.board.vertices.find((vertex) => {
				const [vx, vy] = vertexPoint(game.board, vertex);
				return vx === x + dx && vy === y + dy;
			});
			if (next !== undefined) cursor = next;
		} else return;
		event.preventDefault();
	}
	function edgePath(edges: readonly Edge[]) {
		return edges
			.map(([a, b]) => {
				const [x1, y1] = vertexPoint(game.board, a);
				const [x2, y2] = vertexPoint(game.board, b);
				return `M${x1} ${y1}L${x2} ${y2}`;
			})
			.join('');
	}
	function centre(piece: number[]) {
		return piece.reduce(
			(sum, index) => {
				const [x, y] = game.board.cells[index]!;
				return { x: sum.x + (x + 0.5) / piece.length, y: sum.y + (y + 0.5) / piece.length };
			},
			{ x: 0, y: 0 }
		);
	}
	function arrived() {
		if (disposed) return;
		phase = 'playing';
		onready();
		visibility();
		if (game.status !== 'playing') finish(resume?.pending.finish ?? 0);
		else updateTime();
	}
	$effect(() => {
		if (!mounted || !entranceReady || phase !== 'arrival') return;
		untrack(() => {
			phase = 'opening';
			if (resume?.phase === 'playing' || resume?.phase === 'finished') arrived();
			else
				stopEntrance = shapeDivisionEntrance(
					outline,
					entranceDuration(game.board.perimeter),
					arrived
				);
		});
	});
	$effect(() => {
		void paused;
		untrack(visibility);
	});
	onMount(() => {
		baseMs = resume?.elapsedMs ?? 0;
		seconds = Math.floor(baseMs / 1000);
		registerCheckpoint?.(() => {
			const pending: Record<string, number> = {};
			const remaining = finishDelay.remaining();
			if (remaining !== null) pending.finish = remaining;
			return {
				phase,
				elapsedMs: phase === 'arrival' || phase === 'opening' ? baseMs : clockMs(),
				clockStarted: phase === 'playing' || phase === 'finished',
				pending
			};
		});
		mounted = true;
		const ticker = setInterval(updateTime, 100);
		window.addEventListener('keydown', keydown);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			disposed = true;
			clearInterval(ticker);
			stopEntrance?.();
			finishDelay.cancel();
			window.removeEventListener('keydown', keydown);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
</script>

<div class="shape-game" data-family="shape-division" data-phase={phase}>
	<div class="board-column">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (The board handles arrow keys and Enter.) -->
		<div
			class="board"
			bind:this={board}
			style:aspect-ratio={`${game.board.width} / ${game.board.height}`}
			onpointerdown={down}
			onpointerup={up}
			onpointercancel={() => (pointerStart = null)}
			onpointermove={(event) => (hover = point(event))}
			onpointerleave={() => (hover = null)}
			role="application"
			aria-label={t('shape-division.board')}
			tabindex="0"
		>
			<svg viewBox={`0 0 ${game.board.width} ${game.board.height}`} aria-hidden="true">
				<path
					d={outlinePath(game.board)}
					class:ghost={game.pieces.length > 1}
					class="outline"
					bind:this={outline}
				/>
				{#if game.pieces.length > 1}
					{#each game.pieces as piece, i (piece[0])}
						<mask
							id={`${maskPrefix}-piece-${i}`}
							maskUnits="userSpaceOnUse"
							x="-1"
							y="-1"
							width={game.board.width + 2}
							height={game.board.height + 2}
						>
							<path d={outlinePath(game.board, piece)} fill="white" fill-rule="evenodd" />
							<path
								data-piece-inset
								d={outlinePath(game.board, piece)}
								fill="none"
								stroke="black"
								stroke-width="12"
								vector-effect="non-scaling-stroke"
							/>
						</mask>
						<g class="detached" data-piece={i} mask={`url(#${maskPrefix}-piece-${i})`}>
							<path class="piece" d={outlinePath(game.board, piece)} fill-rule="evenodd" />
						</g>
					{/each}
				{/if}
				{#each game.hints as cell (cell)}
					{@const pos = game.board.cells[cell]}
					{#if pos}<rect
							class="hint"
							x={pos[0] + 0.28}
							y={pos[1] + 0.28}
							width="0.44"
							height="0.44"
							rx="0.12"
						/>{/if}
				{/each}
				{#each game.board.trees as tree (tree)}
					{@const pos = game.board.cells[tree]}
					{#if pos}<path
							class="tree"
							d={`M${pos[0] + 0.5} ${pos[1] + 0.15}l-.25 .4h.15l-.15 .2h.2v.12h.1v-.12h.2l-.15-.2h.15Z`}
						/>{/if}
				{/each}
				<path class="cuts" d={edgePath(drawn)} />
				{#if preview}<path class="preview" d={edgePath(preview)} />{/if}
				{#each game.board.vertices as vertex (vertex)}
					{@const pos = vertexPoint(game.board, vertex)}
					<circle
						cx={pos[0]}
						cy={pos[1]}
						r={selected === vertex || cursor === vertex ? 0.095 : 0.045}
						class:selected={selected === vertex}
						class:cursor={cursor === vertex}
					/>
				{/each}
			</svg>
			{#each game.board.vertices as vertex (vertex)}
				{@const pos = vertexPoint(game.board, vertex)}
				<span
					class="vertex-hit"
					data-vertex={vertex}
					style={`left:${(100 * pos[0]) / game.board.width}%;top:${(100 * pos[1]) / game.board.height}%`}
				></span>
			{/each}
			{#if game.pieces.length > 1}
				{#each game.pieces as piece (piece[0])}
					{@const pos = centre(piece)}
					<span
						class="board-label"
						style={`left:${(100 * pos.x) / game.board.width}%;top:${(100 * pos.y) / game.board.height}%`}
						>{Math.round((100 * piece.length) / game.board.cells.length)}%</span
					>
				{/each}
			{/if}
			{#each game.hints as cell (cell)}
				{@const pos = game.board.cells[cell]}
				{#if pos}<span
						class="board-label"
						style={`left:${(100 * (pos[0] + 0.5)) / game.board.width}%;top:${(100 * (pos[1] + 0.5)) / game.board.height}%`}
						>{game.board.solution.findIndex((piece) => piece.includes(cell)) + 1}</span
					>{/if}
			{/each}
		</div>
		<p class="status" aria-live="polite">
			{selected === null ? t('shape-division.select') : t('shape-division.second')}
		</p>
	</div>
	<section class="panel" aria-label={t('shape-division.board')}>
		<p class="eyebrow">{t('v1.game.shape-division')}</p>
		<h2>{t(`shape-division.rule.${teaching}` as MessageKey)}</h2>
		<p>
			{game.rules.relation === 1 || game.rules.scoring === 1
				? t('shape-division.teach')
				: t('shape-division.rule.congruence')}
		</p>
		{#if game.rules.given === 1 && game.board.given.length}
			<div class="given">
				<span>{t('shape-division.givenLabel')}</span>
				<svg
					viewBox={`0 0 ${Math.max(...game.board.given.map(([x]) => x)) + 1} ${Math.max(...game.board.given.map(([, y]) => y)) + 1}`}
					aria-hidden="true"
				>
					{#each game.board.given as [x, y] (`${x},${y}`)}<rect
							{x}
							{y}
							width="1"
							height="1"
						/>{/each}
				</svg>
			</div>
		{/if}
		<div class="stats">
			<div><span>{t('shape-division.progress')}</span><strong>{progress}%</strong></div>
			<div>
				<span>{t('shape-division.mistakes')}</span><strong
					>{game.mistakes}{scoring.mistakeLimit ? ` / ${scoring.mistakeLimit}` : ''}</strong
				>
			</div>
			<div>
				<span>{t('shape-division.hints')}</span><strong
					>{game.hints.length} / {scoring.hintCap ?? 3}</strong
				>
			</div>
			<div>
				<span>{t('game.time')}</span><strong
					>{formatDuration(
						countdown ? Math.max(0, SHAPE_DIVISION_COUNTDOWN - seconds) : seconds
					)}</strong
				>
			</div>
		</div>
		{#if message}<p class="message" role="status">
				{#if game.verdict !== 'equality'}<strong>{t('ending.shape-division.lost')}.</strong>{/if}
				{message}
			</p>{/if}
		<div class="controls">
			<button
				class="primary"
				onclick={() => action(2)}
				disabled={!enabled || (lastSlot && !canFinishByCheck(game, scoring))}
				>{t('shape-division.check')}</button
			>
			<button onclick={() => action(4)} disabled={!enabled || lastSlot}
				>{t('shape-division.undo')}</button
			>
			{#if game.rules.hint}<button
					onclick={() => action(3)}
					disabled={!enabled ||
						lastSlot ||
						scoring.hintCap === 0 ||
						game.hints.length >= (scoring.hintCap ?? 3)}>{t('shape-division.hint')}</button
				>{/if}
			<button onclick={() => action(6)} disabled={!enabled || lastSlot}
				>{t('shape-division.restart')}</button
			>
		</div>
		{#if blocked}<p>{t('shape-division.noMoves')}</p>
			<button onclick={ontryanother}>{t('v1.nav.another')}</button>{/if}
	</section>
</div>

<style>
	.shape-game {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(250px, 0.8fr);
		gap: clamp(24px, 4vw, 64px);
		align-items: center;
		width: 100%;
		height: 100%;
		padding: clamp(22px, 4vw, 56px);
	}
	.board-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 0;
	}
	.board {
		position: relative;
		width: min(100%, 520px, 65vh);
		touch-action: pinch-zoom;
		outline: none;
		cursor: crosshair;
	}
	.board:focus-visible {
		outline: 2px solid var(--success);
		outline-offset: 20px;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.outline,
	.piece,
	.cuts,
	.preview {
		vector-effect: non-scaling-stroke;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.outline {
		fill: var(--surface-2);
		stroke: var(--ink-2);
		stroke-width: 3;
	}
	.outline.ghost {
		fill: none;
		stroke: var(--muted);
		stroke-width: 2;
		opacity: 0.5;
	}
	.detached {
		transform: translateY(-2px);
	}
	.piece {
		fill: var(--surface-2);
		stroke: var(--ink-2);
		stroke-width: 16;
	}
	.tree {
		fill: var(--success);
	}
	.given {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.given svg {
		width: 56px;
		height: 56px;
		fill: var(--surface-2);
		stroke: var(--success);
		stroke-width: 0.08;
	}
	.cuts {
		fill: none;
		stroke: var(--ink-2);
		stroke-width: 2.5;
	}
	.preview {
		fill: none;
		stroke: var(--success);
		stroke-width: 2;
		stroke-dasharray: 5 5;
	}
	circle {
		fill: var(--muted);
	}
	circle.selected,
	circle.cursor {
		fill: var(--success);
	}
	.vertex-hit {
		position: absolute;
		width: 44px;
		height: 44px;
		transform: translate(-50%, -50%);
		pointer-events: auto;
	}
	.board-label {
		position: absolute;
		transform: translate(-50%, -50%);
		color: var(--ink);
		font-size: var(--text-13);
		font-weight: 700;
		pointer-events: none;
	}
	.board::before {
		content: '';
		position: absolute;
		inset: -22px;
	}
	.hint {
		fill: var(--success);
		opacity: 0.65;
	}
	.status {
		color: var(--muted);
		text-align: center;
		font-size: 0.85rem;
		margin: 24px 0 0;
	}
	.panel {
		align-self: stretch;
		overflow-y: auto;
		min-height: 0;
		max-height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: safe center;
		color: var(--ink);
	}
	.eyebrow {
		color: var(--success);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.13em;
	}
	h2 {
		font-size: clamp(1.5rem, 3vw, 2.4rem);
		line-height: 1.15;
		margin: 0.5rem 0 1rem;
	}
	.panel > p {
		line-height: 1.5;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
		margin: 1rem 0;
	}
	.stats div {
		background: var(--surface-2);
		border-radius: 12px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.stats span {
		color: var(--muted);
		font-size: 0.75rem;
	}
	.stats strong {
		font-size: 1.15rem;
	}
	.controls {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}
	button {
		min-height: 44px;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink-2);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	button.primary {
		background: var(--success);
		border-color: var(--success);
		color: white;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.message {
		color: var(--danger);
	}
	@media (max-width: 700px) and (orientation: portrait) {
		.shape-game {
			height: auto;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 20px;
			padding: 24px 24px 32px;
		}
		.board {
			width: min(100%, 358px);
		}
		.panel {
			overflow: visible;
		}
		h2 {
			font-size: 1.5rem;
		}
	}
	@media (max-height: 500px) {
		.shape-game {
			padding: 16px 28px;
			gap: 28px;
		}
		.board {
			width: min(100%, 65vh);
		}
		.panel {
			justify-content: flex-start;
		}
	}
</style>
