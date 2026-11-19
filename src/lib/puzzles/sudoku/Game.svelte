<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { sound } from '#lib/ui/sound.js';
	import { CARD_RANKED_OPENING_MS, SUDOKU_ENTRANCE_MS } from '#lib/round-timing.js';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import {
		applySudokuMove,
		canEndSudoku,
		sudokuScore,
		SUDOKU_COUNTDOWN,
		SUDOKU_MAX_MOVES,
		type SudokuMove,
		type SudokuRound
	} from './logic.js';
	import { sudokuEntrance, sudokuFeedback, sudokuScoreCount } from './motion.js';

	let {
		round,
		roundNumber,
		scoring,
		paused,
		rankedRound,
		rankedStartedAt,
		entranceReady,
		resume,
		registerCheckpoint,
		onready,
		onmove,
		oncomplete,
		onfinish,
		ontryanother
	}: Omit<PuzzleViewProps, 'round' | 'onfinish'> & {
		round: SudokuRound;
		onfinish: (game: SudokuRound, seconds: number, score: number) => void;
	} = $props();

	let game = $state.raw(untrack(() => round));
	let phase = $state('arrival');
	let mounted = $state(false);
	let seconds = $state(0);
	let selected = $state(-1);
	let cursor = $state(0);
	let pencil = $state(false);
	let confirming = $state(false);
	let message = $state('');
	let coach = $state('');
	let hintCell = $state(-1);
	let displayedScore = $state<number | null>(null);
	let countdownNode: HTMLElement;
	let restartConfirmation = $state<HTMLButtonElement>();
	let board: HTMLDivElement;
	let stopEntrance: (() => void) | undefined;
	let baseMs = 0;
	let startedAt: number | null = null;
	const lifetime = new AbortController();
	const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
	const remaining = $derived(
		digits.map((digit) => 9 - game.cells.filter((cell) => cell === digit).length)
	);
	const lastSlot = $derived(game.loggedMoves === SUDOKU_MAX_MOVES - 1);
	const blocked = $derived(lastSlot && !canEndSudoku(game, scoring));
	const enabled = $derived(phase === 'playing' && !paused);
	const countdown = $derived(game.rules.timing === 1);
	const timeLeft = $derived(Math.max(0, SUDOKU_COUNTDOWN - seconds));
	const finishDelay = createActiveDelay(() =>
		onfinish(game, seconds, sudokuScore(game, seconds, scoring))
	);

	function clockMs() {
		if (rankedRound && rankedStartedAt != null)
			return Math.max(
				0,
				Date.now() -
					rankedStartedAt -
					CARD_RANKED_OPENING_MS -
					SUDOKU_ENTRANCE_MS -
					(countdown ? 0 : 1000)
			);
		return baseMs + (startedAt === null ? 0 : performance.now() - startedAt);
	}

	function visibility() {
		if (!mounted) return;
		if (paused || document.hidden) {
			if (startedAt !== null) {
				baseMs += performance.now() - startedAt;
				startedAt = null;
			}
			finishDelay.pause();
		} else {
			if (phase === 'playing' && startedAt === null) startedAt = performance.now();
			finishDelay.resume();
		}
	}

	function cellClues(cell: number) {
		const clues = [];
		const notes = digits.filter((digit) => game.notes[cell]! & (1 << digit));
		if (notes.length) clues.push(t('sudoku.candidates', { digits: notes.join(', ') }));
		if (game.parity[cell])
			clues.push(t(game.parity[cell] === 1 ? 'sudoku.constraint.odd' : 'sudoku.constraint.even'));
		const cage = game.cages.find((cage) => cage.cells.includes(cell));
		if (cage) clues.push(t('sudoku.constraint.cage', { sum: cage.sum }));
		for (const thermo of game.thermos) {
			const position = thermo.indexOf(cell);
			if (position >= 0)
				clues.push(
					t('sudoku.constraint.thermo', { position: position + 1, length: thermo.length })
				);
		}
		for (const mark of game.marks) {
			if (!mark.cells.includes(cell)) continue;
			const other = mark.cells[mark.cells[0] === cell ? 1 : 0];
			clues.push(
				t('sudoku.constraint.mark', {
					kind: t(`sudoku.mark.${mark.kind}`),
					row: Math.floor(other / 9) + 1,
					col: (other % 9) + 1
				})
			);
		}
		return clues.length ? ` ${clues.join('. ')}.` : '';
	}

	function center(cell: number) {
		return { x: (cell % 9) * 100 + 50, y: Math.floor(cell / 9) * 100 + 50 };
	}

	function cageOutline(cells: number[]) {
		return cells
			.map((cell) => {
				const { x, y } = center(cell);
				const edges = [];
				if (!cells.includes(cell - 9)) edges.push(`M${x - 44} ${y - 44}h88`);
				if (!cells.includes(cell + 9)) edges.push(`M${x - 44} ${y + 44}h88`);
				if (cell % 9 === 0 || !cells.includes(cell - 1)) edges.push(`M${x - 44} ${y - 44}v88`);
				if (cell % 9 === 8 || !cells.includes(cell + 1)) edges.push(`M${x + 44} ${y - 44}v88`);
				return edges.join('');
			})
			.join('');
	}

	function feedback(cells: number[], kind: Parameters<typeof sudokuFeedback>[1]) {
		void tick().then(() => {
			if (lifetime.signal.aborted) return;
			const targets = cells.flatMap((cell) => {
				const node = board.querySelector(
					`[data-sudoku-cell="${cell}"]${kind === 'digit' ? ' .digit' : kind === 'note' ? ' .notes' : ''}`
				);
				return node ? [node] : [];
			});
			sudokuFeedback(targets, kind, lifetime.signal);
		});
	}

	function finish(delay = 600) {
		phase = 'finished';
		const score = sudokuScore(game, seconds, scoring);
		oncomplete(score, seconds);
		sound.play(game.status === 'won' ? 'win' : 'clear');
		if (game.status === 'won') {
			feedback(
				game.cells.map((_, index) => index),
				'win'
			);
			sudokuScoreCount(score, (value) => (displayedScore = value), lifetime.signal);
		}
		finishDelay.start(
			matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : delay,
			paused || document.hidden
		);
	}

	function updateTime() {
		if (phase !== 'playing') return;
		const next = Math.min(7200, Math.floor(clockMs() / 1000));
		if (
			countdown &&
			countdownNode &&
			next !== seconds &&
			next >= SUDOKU_COUNTDOWN - 60 &&
			next < SUDOKU_COUNTDOWN &&
			enabled &&
			!document.hidden
		)
			sudokuFeedback([countdownNode], 'warning', lifetime.signal);
		seconds = next;
		if (countdown && seconds >= SUDOKU_COUNTDOWN && (rankedRound || (enabled && !document.hidden)))
			commit({ action: 5, cell: 0, value: 0 });
	}

	function commit(move: SudokuMove) {
		if (phase !== 'playing' || ((!enabled || document.hidden) && move.action !== 5)) return;
		if (move.action !== 5 && countdown && clockMs() >= SUDOKU_COUNTDOWN * 1000) {
			updateTime();
			return;
		}
		if (lastSlot && move.action !== 0 && move.action !== 5) {
			message = t('sudoku.cap');
			return;
		}
		const previous = game;
		try {
			game = applySudokuMove(game, move, scoring);
		} catch (error) {
			const reason = error instanceof Error ? error.message : '';
			message = t(
				reason === 'given'
					? 'sudoku.givenRefusal'
					: reason === 'conflict'
						? 'sudoku.conflict'
						: reason === 'moves'
							? 'sudoku.cap'
							: 'sudoku.invalid'
			);
			if (move.action <= 2) feedback([move.cell], 'mistake');
			sound.play('invalid');
			return;
		}
		if (game === previous) return;
		onmove(move);
		message = '';
		hintCell = -1;
		if (move.action === 0) {
			if (game.mistakes > previous.mistakes) {
				message = t('sudoku.mistake', { count: game.mistakes });
				feedback([move.cell], 'mistake');
				sound.play('invalid');
			} else {
				feedback([move.cell], 'digit');
				const complete = game.units.filter(
					(unit) =>
						unit.includes(move.cell) &&
						unit.every((cell) => game.cells[cell] === game.solution[cell])
				);
				if (complete.length && game.status === 'playing')
					feedback([...new Set(complete.flat())], 'sweep');
				sound.play('place');
			}
		} else if (move.action === 2) feedback([move.cell], 'note');
		else if (move.action === 4) {
			hintCell = game.cells.findIndex(
				(digit, cell) => digit !== previous.cells[cell] && digit === game.solution[cell]
			);
			if (hintCell >= 0) {
				feedback([hintCell], 'hint');
				sound.play('place');
			}
		} else if (move.action === 6) {
			selected = -1;
			confirming = false;
			sound.play('clear');
		} else if (move.action !== 5) sound.play('pick');
		if (game.status !== 'playing') {
			seconds =
				move.action === 5
					? Math.min(602, Math.max(600, seconds))
					: Math.min(7200, Math.floor(clockMs() / 1000));
			finish(game.status === 'won' ? 600 : 300);
		}
	}

	function select(cell: number) {
		if (!enabled || confirming) return;
		cursor = cell;
		selected = cell;
		message = '';
		sound.play('pick');
	}

	function action(action: number) {
		commit({ action, cell: 0, value: 0 });
	}

	function digit(value: number) {
		if (!enabled || confirming) return;
		if (selected < 0) {
			message = t('sudoku.select');
			return;
		}
		commit({ action: pencil && !lastSlot ? 2 : 0, cell: selected, value });
	}

	function erase() {
		if (selected >= 0 && !lastSlot) commit({ action: 1, cell: selected, value: 0 });
	}

	function restart() {
		if (!enabled || lastSlot) return;
		if (game.history.length) {
			confirming = true;
			void tick().then(() => restartConfirmation?.focus());
		} else action(6);
	}

	function cancelRestart() {
		confirming = false;
		void tick().then(() =>
			board.querySelector<HTMLElement>(`[data-sudoku-cell="${cursor}"]`)?.focus()
		);
	}

	function keydown(event: KeyboardEvent) {
		if (
			!enabled ||
			event.altKey ||
			event.isComposing ||
			(event.target instanceof HTMLElement &&
				event.target.closest('input,textarea,select,[contenteditable=true]'))
		)
			return;
		const key = event.key.toLowerCase();
		if (confirming) {
			if (key === 'escape') cancelRestart();
			return;
		}
		if ((event.ctrlKey || event.metaKey) && key !== 'z') return;
		if (key.startsWith('arrow')) {
			const row = Math.floor(cursor / 9);
			const col = cursor % 9;
			const dy = Number(key === 'arrowdown') - Number(key === 'arrowup');
			const dx = Number(key === 'arrowright') - Number(key === 'arrowleft');
			select(Math.min(8, Math.max(0, row + dy)) * 9 + Math.min(8, Math.max(0, col + dx)));
			board.querySelector<HTMLElement>(`[data-sudoku-cell="${cursor}"]`)?.focus();
		} else if (/^[1-9]$/.test(key)) digit(Number(key));
		else if (key === '0' || key === 'backspace' || key === 'delete') erase();
		else if (key === 'n' && !lastSlot) pencil = !pencil;
		else if (
			(key === 'u' || (key === 'z' && (event.ctrlKey || event.metaKey))) &&
			!lastSlot &&
			game.history.length
		)
			action(3);
		else if (
			key === 'h' &&
			!lastSlot &&
			game.rules.hint !== 2 &&
			(!scoring.hintCap || game.hints < scoring.hintCap)
		)
			action(4);
		else if (key === 'r') restart();
		else return;
		event.preventDefault();
	}

	function arrived() {
		if (lifetime.signal.aborted) return;
		phase = 'playing';
		onready();
		visibility();
		if (game.status === 'playing') updateTime();
		else finish(resume?.pending.finish ?? 0);
	}

	$effect(() => {
		if (!mounted || !entranceReady || phase !== 'arrival') return;
		untrack(() => {
			phase = 'opening';
			if (resume?.phase === 'playing' || resume?.phase === 'finished') arrived();
			else stopEntrance = sudokuEntrance(board, arrived);
		});
	});

	$effect(() => {
		void paused;
		untrack(visibility);
	});

	onMount(() => {
		baseMs = resume?.elapsedMs ?? 0;
		seconds = Math.floor(baseMs / 1000);
		const coachKey = game.rules.killer ? 'morphi.sudoku.killerCoach' : 'morphi.sudoku.firstRound';
		const coachMessage = game.rules.killer ? 'sudoku.coach.killer' : 'sudoku.step.play';
		try {
			if (!localStorage.getItem(coachKey)) {
				coach = t(coachMessage);
				localStorage.setItem(coachKey, '1');
			}
		} catch {
			coach = t(coachMessage);
		}
		registerCheckpoint?.(() => {
			const finish = finishDelay.remaining();
			const pending: Record<string, number> = finish === null ? {} : { finish };
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
			lifetime.abort();
			stopEntrance?.();
			finishDelay.cancel();
			clearInterval(ticker);
			window.removeEventListener('keydown', keydown);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
</script>

<div
	class="game sudoku-game"
	data-family="sudoku"
	data-round={roundNumber}
	data-phase={phase}
	data-status={game.status}
	data-seed={game.seed}
>
	<header class="sudoku-header">
		<h2 class="sr-only">{t('v1.game.sudoku')}</h2>
		<p>{t(game.rules.region ? 'sudoku.rule.irregular' : 'sudoku.rule.classic')}</p>
	</header>
	<div class="stats">
		<span class:danger={countdown && timeLeft <= 60}
			>{t(countdown ? 'sudoku.timeLeft' : 'game.time')}
			<strong bind:this={countdownNode} data-countdown={countdown ? timeLeft : undefined}
				>{formatDuration(countdown ? timeLeft : seconds)}</strong
			>
		</span>
		<span
			>{t('sudoku.mistakes')}
			<strong>{game.mistakes}{scoring.mistakeLimit ? ` / ${scoring.mistakeLimit}` : ''}</strong
			></span
		>
		<span
			>{t('sudoku.hints')}
			<strong>{game.hints}{scoring.hintCap ? ` / ${scoring.hintCap}` : ''}</strong></span
		>
		<span>{t('sudoku.givens')} <strong>{game.givens.filter(Boolean).length}</strong></span>
	</div>
	<div class="sudoku-layout">
		<div class="sudoku-board" role="group" aria-label={t('sudoku.board')} bind:this={board}>
			{#each game.cells as value, cell (cell)}
				{@const r = Math.floor(cell / 9)}
				{@const c = cell % 9}
				{@const wrong = value !== 0 && value !== game.solution[cell]}
				{@const label =
					value === 0
						? t('sudoku.empty')
						: game.givens[cell]
							? t('sudoku.given', { digit: value })
							: t(wrong ? 'sudoku.wrongDigit' : 'sudoku.playerDigit', { digit: value })}
				<button
					type="button"
					class="sudoku-cell"
					class:given={game.givens[cell]}
					class:wrong
					class:hinted={hintCell === cell}
					class:peer={selected >= 0 && game.peers[selected]?.includes(cell)}
					class:same={value && game.cells[selected] === value}
					class:box-right={c < 8 && game.regions[cell] !== game.regions[cell + 1]}
					class:box-bottom={r < 8 && game.regions[cell] !== game.regions[cell + 9]}
					class:diagonal={game.rules.diagonal && (r === c || r + c === 8)}
					data-sudoku-cell={cell}
					aria-label={t('sudoku.cell', { row: r + 1, col: c + 1, state: label }) + cellClues(cell)}
					aria-pressed={selected === cell}
					tabindex={cursor === cell ? 0 : -1}
					disabled={!enabled || confirming}
					onclick={() => select(cell)}
				>
					{#if game.parity[cell]}
						<span class="parity" class:odd={game.parity[cell] === 1} aria-hidden="true"
							>{game.parity[cell] === 1 ? 'O' : 'E'}</span
						>
					{/if}
					{#if value}<span class="digit">{value}</span>
					{:else if game.notes[cell]}
						<span class="notes" aria-hidden="true">
							{#each digits as candidate (candidate)}
								<span>{game.notes[cell]! & (1 << candidate) ? candidate : ''}</span>
							{/each}
						</span>
					{/if}
				</button>
			{/each}
			{#if game.cages.length || game.thermos.length || game.marks.length}
				<svg class="clue-overlay" viewBox="0 0 900 900" aria-hidden="true">
					{#each game.cages as cage (cage.cells[0])}
						{@const anchor = center(Math.min(...cage.cells))}
						<path class="cage-path" d={cageOutline(cage.cells)} />
						<text class="cage-sum" x={anchor.x - 39} y={anchor.y - 21}>{cage.sum}</text>
					{/each}
					{#each game.thermos as thermo (thermo[0])}
						{@const bulb = center(thermo[0]!)}
						<polyline
							class="thermo-line"
							points={thermo
								.map((cell) => {
									const { x, y } = center(cell);
									return `${x},${y}`;
								})
								.join(' ')}
						/>
						<circle class="thermo-bulb" cx={bulb.x} cy={bulb.y} r="25" />
					{/each}
					{#each game.marks as mark (`${mark.cells[0]}-${mark.cells[1]}`)}
						{@const a = center(mark.cells[0])}
						{@const b = center(mark.cells[1])}
						{@const x = (a.x + b.x) / 2}
						{@const y = (a.y + b.y) / 2}
						<circle
							class="mark"
							class:black={mark.kind === 'black'}
							cx={x}
							cy={y}
							r={mark.kind === 'X' || mark.kind === 'V' ? 19 : 13}
						/>
						{#if mark.kind === 'X' || mark.kind === 'V'}
							<text class="mark-letter" {x} {y}>{mark.kind}</text>
						{/if}
					{/each}
				</svg>
			{/if}
		</div>
		<div class="controls">
			<p class="round-message">
				<span role="status">{displayedScore === null ? message || coach : ''}</span>
				{#if displayedScore !== null}
					<span aria-hidden="true"
						>{t('sudoku.score', { score: formatNumber(displayedScore) })}</span
					>
				{/if}
			</p>
			{#if blocked}
				<button class="restart" type="button" onclick={ontryanother}>{t('v1.nav.another')}</button>
			{:else if confirming}
				<p class="confirmation">{t('sudoku.restartConfirm')}</p>
				<div class="tools">
					<button
						bind:this={restartConfirmation}
						class="restart"
						type="button"
						onclick={() => action(6)}>{t('sudoku.restart')}</button
					>
					<button type="button" onclick={cancelRestart}>{t('sudoku.cancel')}</button>
				</div>
			{:else}
				<div class="tools primary-tools">
					<button
						type="button"
						disabled={!enabled || lastSlot || !game.history.length}
						onclick={() => action(3)}>{t('sudoku.undo')}</button
					>
					<button class="restart" type="button" disabled={!enabled || lastSlot} onclick={restart}
						>{t('sudoku.restart')}</button
					>
					{#if game.rules.hint !== 2}
						<button
							type="button"
							disabled={!enabled ||
								lastSlot ||
								Boolean(scoring.hintCap && game.hints >= scoring.hintCap)}
							onclick={() => action(4)}>{t('sudoku.hint')}</button
						>
					{/if}
				</div>
				<div class="tools">
					<button
						type="button"
						aria-pressed={pencil && !lastSlot}
						disabled={!enabled || lastSlot}
						onclick={() => (pencil = !pencil)}>{t('sudoku.notes')}</button
					>
					<button type="button" disabled={!enabled || lastSlot} onclick={() => action(7)}
						>{t('sudoku.autofill')}</button
					>
					<button type="button" disabled={!enabled || lastSlot || selected < 0} onclick={erase}
						>{t('sudoku.erase')}</button
					>
				</div>
				<div class="pad" role="group" aria-label={t('sudoku.digits')}>
					{#each digits as number, index (number)}
						<button
							type="button"
							class:used={remaining[index] === 0}
							disabled={!enabled}
							aria-label={t('sudoku.enter', { digit: number, left: remaining[index]! })}
							data-sudoku-digit={number}
							onclick={() => digit(number)}
							>{number} <small aria-hidden="true">{remaining[index]}</small></button
						>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.sudoku-game {
		--sudoku-border: #1b2433;
		--sudoku-line: #c9d2e0;
		--sudoku-paper: #fff;
		--sudoku-quiet: #f1f4f9;
		--sudoku-ink: #1b2433;
		--sudoku-blue: #215cce;
		width: min(100%, 460px);
		margin: auto;
		color: var(--sudoku-ink);
		display: grid;
		gap: 6px;
	}
	:global(.design-public .active-round) .sudoku-game[data-family='sudoku'] {
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: min(100%, 460px) !important;
		padding: 8px 12px;
		gap: 5px;
	}
	.sudoku-layout {
		align-self: center;
		width: min(100%, max(120px, calc(var(--panel-height, 660px) - 246px)));
	}
	@media (orientation: portrait) and (max-width: 600px) {
		:global(.design-public .active-round) .sudoku-game[data-family='sudoku'] {
			padding-inline: 3px;
		}
		.sudoku-layout {
			width: min(100%, max(120px, calc(var(--panel-height, 660px) - 196px)));
		}
		.pad {
			width: min(100%, 236px);
			margin-inline: auto;
		}
	}

	.sudoku-header {
		text-align: center;
	}
	.sudoku-header h2,
	.sudoku-header p {
		margin: 0;
	}
	.sudoku-header h2 {
		font-size: 1.25rem;
	}
	.sudoku-header p {
		font-size: 0.8rem;
	}
	.stats {
		display: flex;
		gap: 4px;
		text-align: center;
	}
	.stats span {
		flex: 1;
		border: 1px solid var(--sudoku-line);
		background: var(--sudoku-paper);
		border-radius: 18px;
		font-size: 0.65rem;
		font-weight: 800;
	}
	.stats strong {
		display: block;
		font-size: 0.9rem;
	}
	.stats .danger {
		color: #ab231a;
		border-color: currentColor;
	}
	.sudoku-layout,
	.controls {
		min-width: 0;
		display: grid;
		gap: 4px;
	}
	.sudoku-board {
		position: relative;
		display: grid;
		grid-template-columns: repeat(9, minmax(0, 1fr));
		grid-template-rows: repeat(9, minmax(0, 1fr));
		aspect-ratio: 1;
		width: 100%;
		border: 2px solid var(--sudoku-border);
		border-radius: 9px;
		background: var(--sudoku-paper);
	}
	.sudoku-cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: 0;
		border-inline-end: 1px solid var(--sudoku-line);
		border-block-end: 1px solid var(--sudoku-line);
		border-radius: 0;
		background: var(--sudoku-paper);
		color: var(--sudoku-blue);
		font-family: inherit;
		line-height: 1;
		font-size: clamp(1rem, 5vw, 1.55rem);
		font-weight: 800;
		cursor: pointer;
	}
	.sudoku-cell:nth-child(9n) {
		border-inline-end: 0;
	}
	.sudoku-cell:nth-child(n + 73) {
		border-block-end: 0;
	}
	.sudoku-cell.box-right {
		border-inline-end: 2px solid var(--sudoku-border);
	}
	.sudoku-cell.box-bottom {
		border-block-end: 2px solid var(--sudoku-border);
	}
	.sudoku-cell.given {
		background: var(--sudoku-quiet);
		color: var(--sudoku-ink);
		font-weight: 900;
	}
	.sudoku-cell.peer {
		background: #eef3ff;
	}
	.sudoku-cell.same {
		background: #dbe7ff;
	}
	.sudoku-cell.hinted {
		background: #e0f9f5;
		color: #08786a;
	}
	.sudoku-cell.wrong {
		color: #ab231a;
		background: #fdeceb;
		text-decoration: underline 2px;
	}
	.sudoku-cell[aria-pressed='true'] {
		background: #ffe3d6;
		box-shadow: inset 0 0 0 2px #d64f2e;
	}
	.sudoku-cell:focus-visible {
		z-index: 1;
		outline: 2px solid var(--sudoku-blue);
		outline-offset: -3px;
	}
	.sudoku-cell:disabled {
		opacity: 1;
		cursor: default;
	}
	[data-phase='arrival'] .sudoku-cell {
		visibility: hidden;
	}
	[data-status='lost'] .sudoku-board,
	[data-status='timeout'] .sudoku-board {
		filter: saturate(0.35);
	}
	.digit,
	.notes {
		position: relative;
		z-index: 2;
	}
	.sudoku-cell.diagonal {
		background-image: linear-gradient(#7d61ae1f, #7d61ae1f);
	}
	.parity {
		position: absolute;
		inset: 14%;
		display: grid;
		align-items: end;
		justify-items: end;
		padding: 0 2px;
		border: 1px solid #0d7c6f65;
		border-radius: 4px;
		background: #009a861c;
		color: #185d55;
		font-size: 0.55em;
	}
	.parity.odd {
		border-radius: 50%;
		border-color: #215cce66;
		background: #2f6fed18;
		color: #214078;
	}
	.clue-overlay {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	[data-phase='arrival'] .clue-overlay {
		visibility: hidden;
	}
	.cage-path {
		fill: none;
		stroke: #5b467e;
		stroke-width: 3;
		stroke-dasharray: 7 6;
	}
	.cage-sum {
		fill: #34244f;
		font-size: 22px;
		font-weight: 900;
		paint-order: stroke;
		stroke: white;
		stroke-width: 6;
	}
	.thermo-line {
		fill: none;
		stroke: #7d61ae63;
		stroke-width: 18;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.thermo-bulb {
		fill: #7d61ae87;
	}
	.mark {
		fill: white;
		stroke: #1b2433;
		stroke-width: 4;
	}
	.mark.black {
		fill: #1b2433;
	}
	.mark-letter {
		fill: #1b2433;
		font-size: 24px;
		font-weight: 900;
		text-anchor: middle;
		dominant-baseline: central;
	}
	.notes {
		display: grid;
		grid-template: repeat(3, 1fr) / repeat(3, 1fr);
		place-items: center;
		width: 95%;
		height: 95%;
		color: #44546e;
		font-size: clamp(0.45rem, 2vw, 0.7rem);
		line-height: 1;
	}
	.round-message,
	.confirmation {
		margin: 0;
		text-align: center;
		font-size: 0.75rem;
		min-height: 1.2em;
	}
	.tools {
		display: flex;
		gap: 4px;
	}
	.tools button {
		flex: 1;
	}
	.pad {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 3px;
	}
	.controls button {
		border: 1px solid var(--sudoku-line);
		border-radius: 7px;
		background: var(--sudoku-quiet);
		color: var(--sudoku-ink);
		min-height: 30px;
		padding: 2px 4px;
		font-weight: 800;
		cursor: pointer;
	}
	.controls button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.controls button[aria-pressed='true'] {
		border-color: #7459a7;
		background: #ede5fa;
	}
	.controls button.restart {
		background: #ad3820;
		border-color: #ad3820;
		color: white;
	}
	.pad button {
		font-size: 1rem;
		line-height: 1;
	}
	.pad small {
		font-size: 0.62em;
		color: #44546e;
	}
	.pad button.used {
		opacity: 0.5;
	}
	@media (orientation: landscape) and (max-height: 560px) {
		.sudoku-layout {
			--grid-width: min(195px, calc(var(--panel-height) - 70px));
			width: 100%;
			grid-template-columns: var(--grid-width) minmax(0, 1fr);
			align-items: center;
			gap: 8px;
		}
		.controls button {
			min-height: 25px;
			font-size: 0.8rem;
		}
		.sudoku-cell {
			font-size: clamp(0.8rem, 4.7vh, 1.4rem);
		}
	}
</style>
