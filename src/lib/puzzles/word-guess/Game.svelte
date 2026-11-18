<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { PuzzleViewProps } from '#lib/ui/puzzle-view.js';
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { formatDuration } from '#lib/ui/format.js';
	import { sound } from '#lib/ui/sound.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { wordGuessMotion } from './motion.js';
	import {
		applyWordGuessMove,
		encodeWord,
		guessError,
		hintTarget,
		resolveVariantFromRules,
		wordGuessScore,
		type WordGuessRound,
		type WordGuessMove
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
		onnewdeal,
		ontryanother,
		resume,
		rankedStartedAt = null,
		registerCheckpoint
	}: Omit<PuzzleViewProps, 'round' | 'onfinish'> & {
		round: WordGuessRound;
		onfinish: (game: WordGuessRound, seconds: number, score: number) => void;
	} = $props();
	let game = $state(untrack(() => round));
	let phase = $state('arrival');
	let typed = $state('');
	let announcement = $state('');
	let elapsed = $state(0);
	let mounted = $state(false);
	let busy = $state(false);
	let timeUp = $state(false);
	let coach = $state('');
	const remaining = $derived(Math.max(0, 120 - elapsed));
	const teaching = $derived(resolveVariantFromRules(game.rules));
	let root: HTMLDivElement;
	let base = 0;
	let started: number | null = null;
	let rankedStart: number | null = null;
	let ticker: ReturnType<typeof setInterval> | undefined;
	let inputRelease: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	const animations = new SvelteSet<ReturnType<typeof wordGuessMotion>>();
	const keys = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
	const label = (key: string, values?: Record<string, string | number>) =>
		t(key as MessageKey, values);
	const keyboard = $derived.by(() => {
		const result: Record<string, number> = {};
		for (const board of game.boards) {
			for (const letter of board.revealed) if (letter) result[letter] = 2;
			for (const [row, marks] of board.feedback.entries())
				for (const [at, mark] of marks.entries())
					result[game.guesses[row]![at]!] = Math.max(result[game.guesses[row]![at]!] ?? -1, mark);
		}
		return result;
	});
	const finishDelay = createActiveDelay(() =>
		guard(() => onfinish(game, elapsed, wordGuessScore(game, elapsed, scoring)))
	);
	function guard(action: () => void) {
		if (disposed) return;
		try {
			action();
		} catch {
			phase = 'failed';
			busy = false;
			clearTimeout(inputRelease);
			pauseClock();
			finishDelay.cancel();
			for (const animation of animations) animation.destroy();
			animations.clear();
			console.error('morphi:word_guess_interaction_failed');
		}
	}
	function clockMs() {
		return rankedRound
			? rankedStart === null
				? 0
				: performance.now() - rankedStart
			: base + (started === null ? 0 : performance.now() - started);
	}
	function pauseClock() {
		if (started !== null) {
			base += performance.now() - started;
			started = null;
		}
	}
	function startClock() {
		rankedStart ??= performance.now();
		started ??= performance.now();
	}
	function animate(nodes: HTMLElement[], kind: Parameters<typeof wordGuessMotion>[1]) {
		try {
			if (kind !== 'end') {
				for (const animation of animations) animation.destroy();
				animations.clear();
			}
			animations.add(wordGuessMotion(nodes, kind));
		} catch {
			for (const node of nodes) {
				node.style.removeProperty('transform');
				node.style.removeProperty('opacity');
			}
			console.warn('morphi:word_guess_motion_unavailable');
		}
	}
	function timeout() {
		if (phase !== 'playing') return;
		timeUp = true;
		phase = 'over';
		elapsed = 120;
		pauseClock();
		announcement = `${t('ending.word-guess.timeUp')} ${game.boards.map((board) => board.answer).join(', ')}`;
		sound.play('clear');
	}
	function expired() {
		if (game.rules.timing === 1 && clockMs() >= 120000) {
			timeout();
			return true;
		}
		return false;
	}
	function hint() {
		guard(() => {
			if (phase !== 'playing' || paused || document.hidden || busy || expired()) return;
			const target = hintTarget(game);
			if (!target) return;
			const move = { action: 1, code: 0 };
			game = applyWordGuessMove(game, move);
			onmove(move);
			sound.play('place');
			announcement = t('word-guess.hintLetter', {
				board: target.board + 1,
				position: target.position + 1,
				letter: target.letter
			});
		});
	}
	function feedbackName(mark: number | undefined) {
		return mark === 2 ? 'correct' : mark === 1 ? 'present' : mark === 0 ? 'absent' : 'empty';
	}
	function submit() {
		if (busy || game.status !== 'playing' || expired()) return;
		const error = guessError(game, typed);
		if (error) {
			const [kind, at = '0', letter = ''] = error.split(':');
			announcement =
				kind === 'present'
					? t('word-guess.presentRule', { count: Number(at), letter })
					: label(`word-guess.${kind}`, { position: Number(at) + 1, letter });
			sound.play('invalid');
			animate([...root.querySelectorAll<HTMLElement>('.active-row')], 'invalid');
			return;
		}
		startClock();
		const move: WordGuessMove = { action: 0, code: encodeWord(typed) };
		game = applyWordGuessMove(game, move);
		onmove(move);
		typed = '';
		busy = true;
		clearTimeout(inputRelease);
		inputRelease = setTimeout(() => {
			busy = false;
		}, 300);
		announcement = game.boards
			.map((board) =>
				board.feedback
					.at(-1)
					?.map((mark) => label(`word-guess.${feedbackName(mark)}`))
					.join(', ')
			)
			.join('; ');
		sound.play('place');
		void tick()
			.then(() => {
				if (!disposed) {
					animate(
						[
							...root.querySelectorAll<HTMLElement>(`[data-row='${game.guesses.length - 1}'] .tile`)
						],
						'flip'
					);
					if (game.status !== 'playing')
						animate([...root.querySelectorAll<HTMLElement>('.word-boards')], 'end');
				}
			})
			.catch(() => console.warn('morphi:word_guess_motion_unavailable'));
		if (game.status !== 'playing') {
			elapsed = Math.floor(clockMs() / 1000);
			pauseClock();
			phase = 'finished';
			sound.play(game.status === 'won' ? 'win' : 'clear');
			oncomplete(wordGuessScore(game, elapsed, scoring), elapsed);
			finishDelay.start(
				matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
				paused || document.hidden
			);
		}
	}
	function input(key: string) {
		guard(() => {
			if (phase !== 'playing' || paused || document.hidden || expired()) return;
			if (key === 'Enter') submit();
			else if (key === 'Backspace') typed = typed.slice(0, -1);
			else if (/^[A-Z]$/.test(key) && typed.length < game.rules.length) {
				startClock();
				typed += key;
				sound.play('pick');
			}
		});
	}
	function keydown(event: KeyboardEvent) {
		if (phase !== 'playing' || paused || document.hidden) return;
		if (
			event.ctrlKey ||
			event.altKey ||
			event.metaKey ||
			event.isComposing ||
			(event.target instanceof HTMLElement &&
				event.target.closest('input,textarea,select,[contenteditable="true"]'))
		)
			return;
		if (event.repeat && event.key === 'Enter') return;
		if (/^[a-zA-Z]$/.test(event.key) || event.key === 'Enter' || event.key === 'Backspace') {
			event.preventDefault();
			input(event.key.length === 1 ? event.key.toUpperCase() : event.key);
		}
	}
	function visibility() {
		guard(() => {
			if (document.hidden || paused) {
				if (!rankedRound) pauseClock();
				finishDelay.pause();
				for (const animation of animations) animation.pause();
			} else {
				if (rankedStart !== null && phase === 'playing') startClock();
				finishDelay.resume();
				for (const animation of animations) animation.resume();
			}
		});
	}
	$effect(() => {
		if (mounted && entranceReady && phase === 'arrival') {
			guard(() => {
				phase = game.status === 'playing' ? 'playing' : 'finished';
				if ((game.rules.timing === 1 || resume?.clockStarted) && game.status === 'playing')
					startClock();
				onready();
				if (game.status !== 'playing') {
					elapsed = Math.floor(base / 1000);
					oncomplete(wordGuessScore(game, elapsed, scoring), elapsed);
					finishDelay.start(resume?.pending.finish ?? 0, paused || document.hidden);
				}
			});
		}
	});
	$effect(() => {
		if (mounted) {
			void paused;
			untrack(visibility);
		}
	});
	onMount(() => {
		if (game.rules.constraint === 1 || game.rules.hint === 1) {
			const key = `morphi.wordGuess.coach.${game.rules.hint ? 'hint' : 'hard'}`;
			try {
				if (localStorage.getItem(key) !== '1') {
					coach = t(game.rules.hint ? 'word-guess.hintCoach' : 'word-guess.rule.hard-mode');
					localStorage.setItem(key, '1');
				}
			} catch {
				coach = t(game.rules.hint ? 'word-guess.hintCoach' : 'word-guess.rule.hard-mode');
			}
		}
		if (resume) {
			base = resume.elapsedMs;
			typed = Object.entries(resume.pending)
				.filter(([key]) => key.startsWith('letter'))
				.sort(([a], [b]) => (a < b ? -1 : 1))
				.map(([, value]) => String.fromCharCode(value))
				.join('')
				.slice(0, game.rules.length);
			if (resume.clockStarted)
				rankedStart =
					performance.now() -
					Math.max(
						base,
						rankedRound && rankedStartedAt !== null ? Date.now() - rankedStartedAt : base
					);
		}
		registerCheckpoint?.((): CheckpointState => ({
			phase,
			elapsedMs: clockMs(),
			clockStarted: rankedStart !== null,
			pending: {
				...Object.fromEntries(
					[...typed].map((letter, at) => [`letter${at}`, letter.charCodeAt(0)])
				),
				...(finishDelay.remaining() === null ? {} : { finish: finishDelay.remaining()! })
			}
		}));
		mounted = true;
		ticker = setInterval(() => {
			guard(() => {
				if (phase === 'playing') {
					elapsed = Math.floor(clockMs() / 1000);
					expired();
				}
			});
		}, 100);
		window.addEventListener('keydown', keydown);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			disposed = true;
			clearInterval(ticker);
			clearTimeout(inputRelease);
			finishDelay.cancel();
			for (const animation of animations) animation.destroy();
			window.removeEventListener('keydown', keydown);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
</script>

<div
	class="game word-guess-game"
	data-family="word-guess"
	data-round={roundNumber}
	data-phase={phase}
	data-busy={busy}
	data-status={game.status}
	data-seed={game.seed}
	data-boards={game.rules.boards}
	bind:this={root}
>
	<h2 class="sr-only">{t('v1.game.word-guess')}</h2>
	<header class="word-hud">
		<span
			>{t('word-guess.tries')} <strong data-tries>{game.guesses.length}/{game.budget}</strong></span
		>
		<span data-countdown={game.rules.timing === 1 ? remaining : undefined}
			>{game.rules.timing === 1 ? t('word-guess.timeLeft') : ''}
			{formatDuration(game.rules.timing === 1 ? remaining : elapsed)}</span
		>
		{#if game.rules.hint === 1}<button
				type="button"
				data-hint
				disabled={phase !== 'playing' || game.hintsUsed >= 3 || !hintTarget(game)}
				onclick={hint}>{t('word-guess.hint', { left: 3 - game.hintsUsed })}</button
			>{/if}
		<button
			type="button"
			disabled={rankedRound || !onnewdeal || phase !== 'playing'}
			onclick={onnewdeal}>{t('word-guess.reset')}</button
		>
	</header>
	<p class="rule">
		{teaching === 'word-guess:classic'
			? t('word-guess.step1')
			: label(`word-guess.rule.${teaching.slice('word-guess:'.length)}`)}
	</p>
	{#if coach}<p class="coach">{coach}</p>{/if}
	<div
		class="word-boards"
		data-boards={game.rules.boards}
		role="group"
		aria-label={t('word-guess.board')}
	>
		{#each game.boards as board, boardAt (boardAt)}
			<div
				class="word-board"
				style={`--letters:${game.rules.length};--rows:${game.budget}`}
				data-board={boardAt}
			>
				{#each Array.from({ length: game.budget }, (_, at) => at) as row (row)}
					<div
						class="guess-row"
						class:active-row={row === game.guesses.length && !board.solvedAt}
						data-row={row}
					>
						{#each Array.from({ length: game.rules.length }, (_, position) => position) as at (at)}
							{@const letter =
								(board.solvedAt && row >= board.solvedAt ? '' : game.guesses[row]?.[at]) ??
								(row === game.guesses.length && !board.solvedAt ? typed[at] : '') ??
								''}
							{@const mark = board.feedback[row]?.[at]}
							<span
								class="tile"
								data-feedback={feedbackName(mark)}
								aria-label={t('word-guess.tile', {
									board: boardAt + 1,
									row: row + 1,
									position: at + 1,
									letter: letter || '—',
									state: label(`word-guess.${feedbackName(mark)}`)
								})}>{letter}</span
							>
						{/each}
					</div>
				{/each}
			</div>
		{/each}
	</div>
	{#if game.hintsUsed > 0}<div class="revealed" aria-label={t('word-guess.revealed')}>
			{#each game.boards as board, boardAt (boardAt)}{#each board.revealed as letter, position (position)}{#if letter}<span
							data-revealed={position}
							>{t('word-guess.hintLetter', {
								board: boardAt + 1,
								position: position + 1,
								letter
							})}</span
						>{/if}{/each}{/each}
		</div>{/if}
	<div class="message" aria-live="polite">{announcement}</div>
	<div class="keyboard" role="group" aria-label={t('word-guess.keyboard')}>
		{#each keys as row, rowAt (row)}
			<div class="key-row">
				{#if rowAt === 2}<button
						type="button"
						class="wide-key"
						data-key="Enter"
						onclick={() => input('Enter')}>{t('word-guess.enter')}</button
					>{/if}
				{#each [...row] as key (key)}<button
						type="button"
						data-key={key}
						data-feedback={feedbackName(keyboard[key])}
						onclick={(event) => {
							input(key);
							animate([event.currentTarget], 'key');
						}}>{key}</button
					>{/each}
				{#if rowAt === 2}<button
						type="button"
						class="wide-key"
						data-key="Backspace"
						aria-label={t('word-guess.delete')}
						onclick={() => input('Backspace')}>⌫</button
					>{/if}
			</div>
		{/each}
	</div>
	{#if timeUp}<div class="time-up" role="alert">
			<strong>{t('ending.word-guess.timeUp')}</strong>
			{game.boards.map((board) => board.answer).join(', ')}<button
				type="button"
				onclick={ontryanother}>{t('word-guess.tryAnother')}</button
			>
		</div>{/if}
	{#if phase === 'failed'}<p role="alert">{t('word-guess.error')}</p>
		<button type="button" onclick={onhome}>{t('game.home')}</button>{/if}
</div>

<style>
	:global(.active-round) .word-guess-game.word-guess-game {
		width: min(100%, 560px);
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
		color: #1b2433;
		min-height: 0;
		overflow: hidden;
	}
	.word-hud {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 13px;
		flex: none;
	}
	.word-hud button {
		min-height: 36px;
		border: 1px solid #c5cfda;
		border-radius: 8px;
		background: #eef2f7;
		padding: 0 10px;
	}
	.rule {
		margin: 0;
		text-align: center;
		font-size: 12px;
		flex: none;
	}
	.word-boards {
		flex: 1;
		min-height: 0;
		display: grid;
		place-items: center;
		gap: 6px;
	}
	.word-boards[data-boards='2'] {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.word-boards[data-boards='4'] {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
	}
	.word-boards[data-boards='8'] {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		gap: 4px;
	}
	.word-boards[data-boards='8'] .word-board {
		gap: 2px;
	}
	.word-boards[data-boards='8'] .guess-row {
		gap: 1px;
	}
	.word-boards[data-boards='8'] .tile {
		font-size: 10px;
		border-radius: 3px;
	}
	.coach,
	.revealed {
		font-size: 10px;
		line-height: 12px;
		margin: 0;
		text-align: center;
	}
	.revealed {
		display: flex;
		gap: 6px;
		justify-content: center;
		flex-wrap: wrap;
	}
	.time-up {
		position: absolute;
		inset: 25% 5% auto;
		padding: 12px;
		background: #eef2f7;
		border: 2px solid #2f6fed;
		border-radius: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
	}
	.word-board {
		width: min(100%, 300px);
		height: 100%;
		max-height: 360px;
		display: grid;
		grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
		gap: 4px;
	}
	.guess-row {
		display: grid;
		grid-template-columns: repeat(var(--letters), minmax(0, 1fr));
		gap: 4px;
		min-height: 0;
	}
	.tile {
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		background: #eef2f7;
		border: 1px solid #c5cfda;
		border-radius: 7px;
		font-weight: 900;
		font-size: clamp(14px, 3.8vh, 24px);
	}
	[data-feedback='correct'] {
		background: #009a86;
		color: white;
		border-color: #009a86;
	}
	[data-feedback='present'] {
		background: #e5532d;
		color: white;
		border-color: #e5532d;
	}
	[data-feedback='absent'] {
		background: #6b7280;
		color: white;
		border-color: #6b7280;
	}
	.message {
		min-height: 18px;
		max-height: 32px;
		overflow: hidden;
		font-size: 11px;
		text-align: center;
		flex: none;
	}
	.keyboard {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: none;
	}
	.key-row {
		display: flex;
		justify-content: center;
		gap: 3px;
	}
	.key-row button {
		width: 9%;
		min-width: 0;
		height: 44px;
		border: 1px solid #c5cfda;
		border-radius: 6px;
		font-weight: 900;
		padding: 0;
		font-size: 13px;
		touch-action: manipulation;
	}
	.key-row button[data-feedback='empty'] {
		background: #dce4ed;
		color: #1b2433;
	}
	.key-row .wide-key {
		width: 14%;
		font-size: 11px;
	}
	button:focus-visible {
		outline: 3px solid #2f6fed;
		outline-offset: 1px;
	}
	@media (orientation: landscape) and (max-height: 560px) {
		:global(.active-round) .word-guess-game.word-guess-game {
			width: min(100%, 640px);
			padding: 2px 10px;
			gap: 2px;
		}
		.word-board {
			width: min(100%, 210px);
		}
		.rule,
		.message {
			font-size: 10px;
		}
		.key-row button {
			height: 28px;
		}
		.word-hud button {
			min-height: 24px;
		}
		.keyboard {
			gap: 2px;
		}
		.word-board {
			gap: 2px;
		}
		.tile {
			font-size: 12px;
			line-height: 1;
		}
		.message {
			min-height: 10px;
			max-height: 10px;
			line-height: 10px;
		}
		.rule {
			line-height: 12px;
		}
		.word-boards[data-boards='4'] {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			grid-template-rows: minmax(0, 1fr);
		}
		.word-boards[data-boards='8'] {
			grid-template-columns: repeat(8, minmax(0, 1fr));
			grid-template-rows: minmax(0, 1fr);
			gap: 3px;
		}
		.word-boards[data-boards='8'] .word-board {
			gap: 0;
		}
		.word-boards[data-boards='8'] .tile {
			font-size: 7px;
			border: 0;
		}
		:global(.active-round) .word-guess-game[data-boards='8'] .key-row button {
			height: 24px;
		}
		.coach {
			font-size: 8px;
			line-height: 10px;
		}
	}
</style>
