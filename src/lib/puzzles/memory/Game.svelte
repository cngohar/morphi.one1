<script lang="ts">
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import { scoring as defaultScoring } from './scoring.js';
	import { onMount, untrack } from 'svelte';
	import { motion } from '#lib/ui/motion.js';
	import { memoryEntranceMs, MEMORY_PREVIEW_MS, MEMORY_HIDE_MS } from '#lib/round-timing.js';
	import Confetti from '#lib/puzzles/memory/Confetti.svelte';
	import MemoryCard from '#lib/puzzles/memory/Card.svelte';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import {
		flipCard,
		isFaceUp,
		resolveMismatch,
		scoreRound,
		currentScore,
		type MemoryRound
	} from '#lib/puzzles/memory/logic.js';
	import { SYMBOL_COLORS } from '#lib/puzzles/memory/symbols.js';
	import { t } from '#lib/i18n/messages.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { memoryThemeForSeed, memoryThemeStyle } from '#lib/puzzles/memory/themes.js';
	import { sound } from '#lib/ui/sound.js';
	import { SYMBOLS } from '#lib/puzzles/memory/symbols.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle as proceduralStyle } from '#lib/engine/theme/style.js';
	import { memoryThemeFromResolved } from '#lib/puzzles/memory/themes.js';

	let {
		scoring = defaultScoring.defaults,
		round,
		roundNumber,
		soundEnabled,
		ontogglesound,
		onfinish,
		onhome,
		onmove,
		oncomplete,
		paused = false,
		rankedRound = false,
		entranceReady = true,
		onready,
		resolvedTheme = null
	}: {
		round: MemoryRound;
		roundNumber: number;
		soundEnabled: boolean;
		ontogglesound: () => void;
		onfinish: (score: number, seconds: number, moves: number) => void;
		onhome: () => void;
		oncomplete?: (score: number, seconds: number) => void;
		onmove?: (move: { index: number }) => void;
		paused?: boolean;
		rankedRound?: boolean;
		entranceReady?: boolean;
		onready?: () => void;
		scoring?: ScoreValues;
		resolvedTheme?: ResolvedTheme | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let game = $state(round);
	let elapsed = $state(0);
	let matchStreak = $state(0);
	let shake = $state<number[]>([]);
	let celebrating = $state<number[]>([]);
	let delayedFlip = $state<number | null>(null);
	let winWave = $state(false);
	let burst = $state(false);
	let scoreDropping = $state(false);
	let announcement = $state('');
	let phase = $state<'dealing' | 'preview' | 'hiding' | 'playing'>('dealing');
	let boardEl: HTMLDivElement;
	let entrance: ReturnType<typeof motion.deal> | null = null;
	const entranceDelay = createActiveDelay(() => {
		entrance?.settle();
		phase = 'preview';
		announcement = t('status.memorize');
		if (!(document.hidden || paused)) startPreviewClock();
	});

	let rankedClockStart: number | null = null;
	let clockStarted = false;
	let clockRunning = false;
	let clockBase = 0;
	let clockStart: number | null = null;

	const PREVIEW_MS = MEMORY_PREVIEW_MS;
	const MISMATCH_HOLD_MS = 500;
	const WIN_WAVE_DELAY_MS = 160;
	const WIN_BURST_DELAY_MS = 260;
	const WIN_FINISH_MS = 1150;

	let ticker: ReturnType<typeof setInterval> | null = null;
	let shakeTimer: ReturnType<typeof setTimeout> | null = null;
	let celebrateTimer: ReturnType<typeof setTimeout> | null = null;
	let delayedFlipTimer: ReturnType<typeof setTimeout> | null = null;
	let waveTimer: ReturnType<typeof setTimeout> | null = null;
	let burstTimer: ReturnType<typeof setTimeout> | null = null;
	let finishFailed = $state(false);
	const finishDelay = createActiveDelay(() => {
		try {
			onfinish(scoreRound(game, elapsed, scoring), elapsed, game.moves);
		} catch {
			finishFailed = true;
			console.error('morphi:memory_finish_failed');
		}
	});
	let scoreDropTimer: ReturnType<typeof setTimeout> | null = null;
	let previewTimer: ReturnType<typeof setTimeout> | null = null;
	let previewRemaining = PREVIEW_MS;
	let previewStart: number | null = null;
	let hideDuration = 250;
	let layoutMode = $state<'phone' | 'phone-landscape' | 'compact-landscape' | 'wide'>('phone');
	const hideDelay = createActiveDelay(finishHide);
	const mismatchDelay = createActiveDelay(() => {
		game = resolveMismatch(game);
	});

	const columns = $derived(
		layoutMode === 'compact-landscape'
			? game.pairs === 10
				? 5
				: 4
			: layoutMode === 'phone-landscape'
				? game.pairs
				: layoutMode === 'wide'
					? game.pairs === 10
						? 5
						: 4
					: 4
	);
	const rows = $derived(Math.ceil(game.cards.length / columns));
	const theme = $derived(
		resolvedTheme ? memoryThemeFromResolved(resolvedTheme) : memoryThemeForSeed(game.seed)
	);
	const symbolColors = $derived(
		new Map<string, string>(
			SYMBOL_COLORS.map((color, index) => [color, theme.symbols[index] ?? color])
		)
	);
	const confettiColors = $derived([...theme.symbols, theme.mark]);
	const score = $derived(currentScore(game, elapsed, scoring));
	const showAll = $derived(phase === 'preview' || phase === 'dealing');
	const locked = $derived(
		phase !== 'playing' || game.revealed.length >= 2 || game.status === 'won'
	);

	function clockMs(): number {
		if (rankedRound)
			return rankedClockStart === null ? 0 : Math.max(0, performance.now() - rankedClockStart);
		return clockBase + (clockStart === null ? 0 : performance.now() - clockStart);
	}

	function startTicker(): void {
		if (ticker !== null) {
			return;
		}

		ticker = setInterval(() => {
			elapsed = Math.floor(clockMs() / 1000);
		}, 250);
	}

	function stopTicker(): void {
		if (ticker !== null) {
			clearInterval(ticker);
			ticker = null;
		}
	}

	function startClock(): void {
		if (clockRunning) {
			return;
		}

		rankedClockStart ??= performance.now();
		clockStarted = true;
		clockRunning = true;
		clockStart = performance.now();
		startTicker();
	}

	function pauseClock(): void {
		if (!clockRunning || clockStart === null) {
			return;
		}

		clockBase += performance.now() - clockStart;
		clockStart = null;
		clockRunning = false;
		stopTicker();
		elapsed = Math.floor((rankedRound ? clockMs() : clockBase) / 1000);
	}

	function resumeClock(): void {
		if (!clockStarted || clockRunning || game.status !== 'playing') {
			return;
		}

		clockRunning = true;
		clockStart = performance.now();
		startTicker();
	}

	function freezeClock(): number {
		if (clockRunning && clockStart !== null) {
			clockBase += performance.now() - clockStart;
			clockStart = null;
			clockRunning = false;
		}

		stopTicker();
		elapsed = Math.floor((rankedRound ? clockMs() : clockBase) / 1000);
		return elapsed;
	}

	function clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
		if (timer !== null) {
			clearTimeout(timer);
		}
	}

	function startPreviewClock(): void {
		if (phase !== 'preview' || previewStart !== null || previewTimer !== null) {
			return;
		}

		if (previewRemaining <= 0) {
			beginHide();
			return;
		}

		previewStart = performance.now();
		previewTimer = setTimeout(beginHide, previewRemaining);
	}

	function pausePreview(): void {
		if (phase !== 'preview' || previewStart === null) {
			return;
		}

		previewRemaining = Math.max(0, previewRemaining - (performance.now() - previewStart));
		previewStart = null;
		clearTimer(previewTimer);
		previewTimer = null;
	}

	function beginHide(): void {
		if (phase !== 'preview') {
			return;
		}

		previewStart = null;
		clearTimer(previewTimer);
		previewTimer = null;
		phase = 'hiding';
		hideDelay.start(hideDuration, document.hidden || paused);
	}

	function finishHide(): void {
		if (phase !== 'hiding') {
			return;
		}

		phase = 'playing';
		onready?.();
		announcement = t('status.go');

		if (!(document.hidden || paused)) {
			startClock();
		}
	}

	function handleVisibility(): void {
		if (document.hidden || paused) {
			finishDelay.pause();
			entrance?.pause();
			entranceDelay.pause();
			hideDelay.pause();
			mismatchDelay.pause();
			if (phase === 'preview') {
				pausePreview();
			} else if (phase === 'playing') {
				pauseClock();
			}
			return;
		}

		entrance?.resume();
		finishDelay.resume();
		entranceDelay.resume();
		hideDelay.resume();
		mismatchDelay.resume();
		if (phase === 'preview') {
			startPreviewClock();
		} else if (phase === 'playing' && game.status === 'playing') {
			if (!clockStarted) {
				startClock();
			} else {
				resumeClock();
			}
		}
	}

	function handleFlip(index: number): void {
		if (document.hidden || paused || phase !== 'playing' || game.status !== 'playing' || locked) {
			return;
		}

		const revealedBefore = game.revealed;
		const result = flipCard(game, index);
		if (result.effect === 'ignored') {
			return;
		}

		game = result.round;
		onmove?.({ index });

		if (!clockStarted) {
			startClock();
		}

		if (result.effect === 'flip') {
			sound.play('flip');
			return;
		}

		if (result.effect === 'match') {
			const pair = [...revealedBefore, index];
			matchStreak += 1;
			sound.play('match', matchStreak - 1);
			announcement = t('status.match');
			celebrating = pair;
			clearTimer(celebrateTimer);
			celebrateTimer = setTimeout(() => {
				celebrating = [];
				celebrateTimer = null;
			}, 340);
			return;
		}

		if (result.effect === 'mismatch') {
			matchStreak = 0;
			sound.play('mismatch');
			announcement = t('status.mismatch');
			shake = [...game.revealed];
			delayedFlip = game.revealed[1] ?? null;
			clearTimer(shakeTimer);
			shakeTimer = setTimeout(() => {
				shake = [];
				shakeTimer = null;
			}, 220);

			clearTimer(delayedFlipTimer);
			delayedFlipTimer = setTimeout(() => {
				delayedFlip = null;
				delayedFlipTimer = null;
			}, 820);

			scoreDropping = true;
			clearTimer(scoreDropTimer);
			scoreDropTimer = setTimeout(() => {
				scoreDropping = false;
				scoreDropTimer = null;
			}, 180);

			mismatchDelay.start(MISMATCH_HOLD_MS);
			return;
		}

		matchStreak += 1;
		sound.play('win');
		announcement = t('status.won');
		clearTimer(celebrateTimer);
		celebrating = [];
		winWave = false;
		burst = false;
		clearTimer(waveTimer);
		clearTimer(burstTimer);
		waveTimer = setTimeout(() => {
			winWave = true;
			waveTimer = null;
		}, WIN_WAVE_DELAY_MS);
		burstTimer = setTimeout(() => {
			burst = true;
			burstTimer = null;
		}, WIN_BURST_DELAY_MS);

		const seconds = freezeClock();
		const finalScore = scoreRound(game, seconds, scoring);
		oncomplete?.(finalScore, seconds);
		finishDelay.start(motion.reduced() ? 0 : WIN_FINISH_MS, document.hidden || paused);
	}

	$effect(() => {
		const value = paused;
		untrack(() => {
			if (value || typeof document !== 'undefined') handleVisibility();
		});
	});
	let mounted = $state(false);
	let entranceStarted = false;
	$effect(() => {
		if (!mounted || !entranceReady || entranceStarted) return;
		untrack(() => {
			entranceStarted = true;
			const duration = motion.reduced() && !rankedRound ? 0 : memoryEntranceMs(game.pairs);
			entrance = motion.deal(
				Array.from(boardEl.querySelectorAll<HTMLElement>('.memory-card')),
				duration
			);
			announcement = t('v1.game.arriving');
			sound.play('deal');
			entranceDelay.start(duration, document.hidden || paused);
		});
	});

	onMount(() => {
		document.addEventListener('visibilitychange', handleVisibility);
		const wideQuery = window.matchMedia('(min-width: 1024px)');
		const shortLandscapeQuery = window.matchMedia(
			'(orientation: landscape) and (max-height: 560px)'
		);
		const compactQuery = window.matchMedia('(orientation: landscape) and (max-width:700px)');
		const updateLayout = () => {
			layoutMode = shortLandscapeQuery.matches
				? compactQuery.matches
					? 'compact-landscape'
					: 'phone-landscape'
				: wideQuery.matches
					? 'wide'
					: 'phone';
		};
		updateLayout();
		compactQuery.addEventListener('change', updateLayout);
		wideQuery.addEventListener('change', updateLayout);
		shortLandscapeQuery.addEventListener('change', updateLayout);
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const preferenceChanged = () => {
			if (entranceStarted && !rankedRound && motionQuery.matches && phase === 'dealing')
				entranceDelay.start(0, document.hidden || paused);
		};
		motionQuery.addEventListener('change', preferenceChanged);
		hideDuration = MEMORY_HIDE_MS;

		mounted = true;

		return () => {
			motionQuery.removeEventListener('change', preferenceChanged);
			document.removeEventListener('visibilitychange', handleVisibility);
			compactQuery.removeEventListener('change', updateLayout);
			wideQuery.removeEventListener('change', updateLayout);
			shortLandscapeQuery.removeEventListener('change', updateLayout);
			stopTicker();
			entranceDelay.cancel();
			entrance?.destroy();
			clearTimer(previewTimer);
			hideDelay.cancel();
			mismatchDelay.cancel();
			clearTimer(shakeTimer);
			clearTimer(celebrateTimer);
			clearTimer(delayedFlipTimer);
			clearTimer(waveTimer);
			clearTimer(burstTimer);
			finishDelay.cancel();
			clearTimer(scoreDropTimer);
		};
	});
</script>

{#if finishFailed}<p role="alert">{t('ending.error')}</p>{/if}

<div
	class="game"
	style={`--cols:${columns};--rows:${rows};${memoryThemeStyle(theme)};${resolvedTheme ? proceduralStyle(resolvedTheme) : ''}`}
	data-family="memory"
	data-round={roundNumber}
	data-theme-version={resolvedTheme?.themeConfigVersion}
	data-theme-generator={resolvedTheme?.themeGeneratorVersion}
	data-theme-recipe={resolvedTheme?.recipe}
	data-phase={phase}
>
	<h2 class="sr-only">{t('game.title')}</h2>

	<header class="hud">
		<button type="button" class="home-button" aria-label={t('game.home')} onclick={onhome}>
			<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path
					d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linejoin="round"
				/>
			</svg>
		</button>

		<div class="stats">
			<div class="stat">
				<span class="stat-label">{t('game.score')}</span>
				<strong class:is-dropping={scoreDropping}>{formatNumber(score)}</strong>
			</div>
			<div class="stat">
				<span class="stat-label">{t('game.time')}</span>
				<strong>{formatDuration(elapsed)}</strong>
			</div>
			<div class="stat">
				<span class="stat-label">{t('v1.game.pairs')}</span><strong
					>{game.matched.length / 2} / {game.pairs}</strong
				>
			</div>
			<div class="stat">
				<span class="stat-label"
					><span class="mismatch-full">{t('v1.game.mismatches')}</span><span class="mismatch-short"
						>{t('v11.game.mismatchesShort')}</span
					></span
				><strong>{game.mismatches}</strong>
			</div>
		</div>

		<SoundToggle enabled={soundEnabled} ontoggle={ontogglesound} />

		<p class="round-meta">
			<span>{t('game.round', { number: roundNumber })}</span>
			{#if matchStreak >= 2}
				{#key matchStreak}
					<span class="streak">{t('game.streak', { count: matchStreak })}</span>
				{/key}
			{/if}
		</p>
	</header>

	<main class="stage">
		<div class="board" bind:this={boardEl} data-pairs={game.pairs} data-columns={columns}>
			{#each game.cards as card, index (card.id)}
				<MemoryCard
					{card}
					{index}
					symbolColor={symbolColors.get(card.color) ?? card.color}
					glyph={resolvedTheme?.symbols[SYMBOLS.findIndex((symbol) => symbol.id === card.symbol)]}
					fillMode={resolvedTheme?.style.fill}
					faceUp={showAll || isFaceUp(game, index)}
					matched={game.matched.includes(index)}
					shaking={shake.includes(index)}
					selected={phase === 'playing' && game.revealed.length === 1 && game.revealed[0] === index}
					delayedFlip={delayedFlip === index}
					celebrating={celebrating.includes(index)}
					winWave={winWave && game.matched.includes(index)}
					{locked}
					dealDelay={Math.floor(index / columns) * 20}
					matchDelay={celebrating[1] === index ? 40 : 0}
					waveDelay={(Math.floor(index / columns) + (index % columns)) * 20}
					onflip={handleFlip}
				/>
			{/each}
		</div>
	</main>

	<footer class="hint">
		<span>{t('game.hint', { pairs: game.pairs })}</span>
	</footer>

	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

	{#if burst}
		<Confetti seed={game.seed} colors={confettiColors} />
	{/if}
</div>

<style>
	.game {
		position: relative;
		isolation: isolate;
		height: 100vh;
		height: 100dvh;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 4px;
		padding: calc(10px + var(--safe-top)) calc(14px + var(--safe-right))
			calc(10px + var(--safe-bottom)) calc(14px + var(--safe-left));
		background: var(--memory-bg);
		overflow: hidden;
	}

	.hud {
		position: relative;
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) 44px;
		align-items: center;
		column-gap: 10px;
		row-gap: 2px;
	}

	.home-button {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--memory-edge);
		border-radius: 14px;
		background: color-mix(in srgb, var(--surface) 72%, transparent);
		color: var(--ink);
		cursor: pointer;
	}

	.home-button svg {
		width: 22px;
		height: 22px;
	}

	.home-button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	.stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(12px, 5vw, 44px);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
	}

	.stat-label {
		color: var(--ink-2);
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.stat strong {
		margin-top: 1px;
		font-size: clamp(0.9375rem, 0.85rem + 0.35vw, 1.125rem);
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.stat strong.is-dropping {
		animation: score-drop 180ms var(--ease-out);
	}

	@keyframes score-drop {
		from {
			opacity: 0.6;
			transform: translateY(-0.3em);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes stat-bump {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.08);
		}
	}

	.round-meta {
		grid-column: 1 / -1;
		display: flex;
		justify-content: center;
		align-items: baseline;
		gap: 12px;
		color: var(--ink-2);
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.streak {
		color: var(--primary-strong);
		animation: streak-pop 180ms var(--ease-out);
	}

	@keyframes streak-pop {
		0% {
			opacity: 0.5;
			transform: scale(0.9);
		}
		60% {
			transform: scale(1.08);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.stage {
		display: grid;
		place-items: center;
		min-height: 0;
		padding: 4px 0;
	}

	.board {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: clamp(5px, 1.5vmin, var(--theme-gap, 12px));
		width: min(92vw, 720px, calc((100dvh - 100px) * var(--cols) * 0.72 / var(--rows)));
	}

	.hint {
		text-align: center;
		color: var(--ink-2);
		font-size: var(--text-13);
		font-weight: 700;
	}

	@media (orientation: landscape) and (max-height: 560px) {
		.board {
			width: min(
				calc(100vw - 216px),
				720px,
				calc((100dvh - 88px) * var(--cols) * 0.72 / var(--rows))
			);
		}
	}

	@media (max-height: 430px) {
		.hint {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.home-button {
			transition: none;
		}

		.stat strong.is-dropping,
		.streak {
			animation: none;
		}
	}
</style>
