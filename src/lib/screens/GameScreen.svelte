<script lang="ts">
	import { onMount } from 'svelte';
	import Confetti from '#lib/components/Confetti.svelte';
	import MemoryCard from '#lib/components/MemoryCard.svelte';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import {
		flipCard,
		isFaceUp,
		resolveMismatch,
		scoreRound,
		currentScore,
		type MemoryRound
	} from '#lib/game/memory.js';
	import { SYMBOL_COLORS } from '#lib/game/symbols.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { memoryThemeForSeed, memoryThemeStyle } from '#lib/ui/memory-themes.js';
	import { sound } from '#lib/ui/sound.js';

	let {
		round,
		roundNumber,
		soundEnabled,
		ontogglesound,
		onfinish,
		onhome
	}: {
		round: MemoryRound;
		roundNumber: number;
		soundEnabled: boolean;
		ontogglesound: () => void;
		onfinish: (score: number, seconds: number, moves: number) => void;
		onhome: () => void;
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
	let phase = $state<'preview' | 'hiding' | 'playing'>('preview');

	let clockStarted = false;
	let clockRunning = false;
	let clockBase = 0;
	let clockStart: number | null = null;

	const PREVIEW_MS = 3000;
	const DEAL_TOTAL_MS = 240;
	const MISMATCH_HOLD_MS = 500;
	const WIN_WAVE_DELAY_MS = 160;
	const WIN_BURST_DELAY_MS = 260;
	const WIN_FINISH_MS = 1150;

	let ticker: ReturnType<typeof setInterval> | null = null;
	let mismatchTimer: ReturnType<typeof setTimeout> | null = null;
	let shakeTimer: ReturnType<typeof setTimeout> | null = null;
	let celebrateTimer: ReturnType<typeof setTimeout> | null = null;
	let delayedFlipTimer: ReturnType<typeof setTimeout> | null = null;
	let waveTimer: ReturnType<typeof setTimeout> | null = null;
	let burstTimer: ReturnType<typeof setTimeout> | null = null;
	let finishTimer: ReturnType<typeof setTimeout> | null = null;
	let scoreDropTimer: ReturnType<typeof setTimeout> | null = null;
	let previewTimer: ReturnType<typeof setTimeout> | null = null;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let previewRemaining = PREVIEW_MS;
	let previewStart: number | null = null;
	let hideDuration = 250;
	let layoutMode = $state<'phone' | 'phone-landscape' | 'wide'>('phone');

	const columns = $derived(
		layoutMode === 'phone-landscape'
			? game.pairs
			: layoutMode === 'wide'
				? game.pairs === 10
					? 5
					: 4
				: game.pairs === 6
					? 3
					: 4
	);
	const rows = $derived(Math.ceil(game.cards.length / columns));
	const theme = $derived(memoryThemeForSeed(game.seed));
	const symbolColors = $derived(
		new Map<string, string>(
			SYMBOL_COLORS.map((color, index) => [color, theme.symbols[index] ?? color])
		)
	);
	const confettiColors = $derived([...theme.symbols, theme.mark]);
	const score = $derived(currentScore(game, elapsed));
	const showAll = $derived(phase === 'preview');
	const locked = $derived(
		phase !== 'playing' || game.revealed.length >= 2 || game.status === 'won'
	);

	function clockMs(): number {
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
		elapsed = Math.floor(clockBase / 1000);
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
		elapsed = Math.floor(clockBase / 1000);
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
		clearTimer(hideTimer);
		hideTimer = setTimeout(finishHide, hideDuration);
	}

	function finishHide(): void {
		hideTimer = null;

		if (phase !== 'hiding') {
			return;
		}

		phase = 'playing';
		announcement = t('status.go');

		if (!document.hidden) {
			startClock();
		}
	}

	function handleVisibility(): void {
		if (document.hidden) {
			if (phase === 'preview') {
				pausePreview();
			} else if (phase === 'playing') {
				pauseClock();
			}
			return;
		}

		if (phase === 'preview') {
			startPreviewClock();
		} else if (phase === 'playing') {
			if (!clockStarted) {
				startClock();
			} else {
				resumeClock();
			}
		}
	}

	function handleFlip(index: number): void {
		if (phase !== 'playing' || game.status !== 'playing' || locked) {
			return;
		}

		const revealedBefore = game.revealed;
		const result = flipCard(game, index);
		if (result.effect === 'ignored') {
			return;
		}

		game = result.round;

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

			clearTimer(mismatchTimer);
			mismatchTimer = setTimeout(() => {
				game = resolveMismatch(game);
				mismatchTimer = null;
			}, MISMATCH_HOLD_MS);
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
		const finalScore = scoreRound(game, seconds);
		clearTimer(finishTimer);
		finishTimer = setTimeout(() => {
			onfinish(finalScore, seconds, game.moves);
		}, WIN_FINISH_MS);
	}

	onMount(() => {
		document.addEventListener('visibilitychange', handleVisibility);
		const wideQuery = window.matchMedia('(min-width: 1024px)');
		const shortLandscapeQuery = window.matchMedia(
			'(orientation: landscape) and (max-height: 560px)'
		);
		const updateLayout = () => {
			layoutMode = shortLandscapeQuery.matches
				? 'phone-landscape'
				: wideQuery.matches
					? 'wide'
					: 'phone';
		};
		updateLayout();
		wideQuery.addEventListener('change', updateLayout);
		shortLandscapeQuery.addEventListener('change', updateLayout);
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		hideDuration = reducedMotion ? 0 : 250;

		if (!reducedMotion) {
			previewRemaining += DEAL_TOTAL_MS;
		}

		announcement = t('status.memorize');
		startPreviewClock();

		return () => {
			document.removeEventListener('visibilitychange', handleVisibility);
			wideQuery.removeEventListener('change', updateLayout);
			shortLandscapeQuery.removeEventListener('change', updateLayout);
			stopTicker();
			clearTimer(previewTimer);
			clearTimer(hideTimer);
			clearTimer(mismatchTimer);
			clearTimer(shakeTimer);
			clearTimer(celebrateTimer);
			clearTimer(delayedFlipTimer);
			clearTimer(waveTimer);
			clearTimer(burstTimer);
			clearTimer(finishTimer);
			clearTimer(scoreDropTimer);
		};
	});
</script>

<div
	class="game"
	style={`--cols:${columns};--rows:${rows};${memoryThemeStyle(theme)}`}
	data-family="memory"
>
	<h1 class="sr-only">{t('game.title')}</h1>

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
				<span class="stat-label">{t('game.moves')}</span>
				{#key game.moves}
					<strong class:is-bump={game.moves > 0}>{formatNumber(game.moves)}</strong>
				{/key}
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
		<div class="board" data-pairs={game.pairs} data-columns={columns}>
			{#each game.cards as card, index (card.id)}
				<MemoryCard
					{card}
					{index}
					symbolColor={symbolColors.get(card.color) ?? card.color}
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

	.stat strong.is-bump {
		animation: stat-bump 120ms var(--ease-out);
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
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: clamp(5px, 1.5vmin, 12px);
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
		.stat strong.is-bump,
		.streak {
			animation: none;
		}
	}
</style>
