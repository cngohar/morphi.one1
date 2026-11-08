<script lang="ts">
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import { onMount, tick, untrack } from 'svelte';
	import { motion } from '#lib/ui/motion.js';
	import { memoryEntranceMs, MEMORY_PREVIEW_MS, MEMORY_HIDE_MS } from '#lib/round-timing.js';
	import Confetti from '#lib/puzzles/memory/Confetti.svelte';
	import MemoryCard from '#lib/puzzles/memory/Card.svelte';
	import TimeStrata from '#lib/puzzles/memory/TimeStrata.svelte';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import {
		flipCard,
		isFaceUp,
		resolveMismatch,
		scoreRound,
		currentScore,
		cardsPerMatch,
		memoryVariant,
		memoryVariantName,
		memoryMoveLimit,
		memoryCapReached,
		matchedCount,
		applyMemoryMove,
		timeStrataTops,
		timeStrataOutcome,
		isTimeStrata,
		type MemoryMove,
		type MemoryRound
	} from '#lib/puzzles/memory/logic.js';
	import { SYMBOL_COLORS } from '#lib/puzzles/memory/symbols.js';
	import { t } from '#lib/i18n/messages.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { memoryThemeForSeed, memoryThemeStyle } from '#lib/puzzles/memory/themes.js';
	import { sound } from '#lib/ui/sound.js';
	import { SYMBOLS, symbolLabel } from '#lib/puzzles/memory/symbols.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle as proceduralStyle } from '#lib/engine/theme/style.js';
	import { memoryThemeFromResolved } from '#lib/puzzles/memory/themes.js';

	let {
		scoring,
		round,
		roundNumber,
		soundEnabled,
		ontogglesound,
		onfinish,
		onhome,
		onmove,
		oncomplete,
		ontryanother,
		paused = false,
		rankedRound = false,
		entranceReady = true,
		onready,
		resolvedTheme = null,
		resume,
		rankedStartedAt = null,
		registerCheckpoint
	}: {
		resume?: CheckpointState;
		rankedStartedAt?: number | null;
		registerCheckpoint?: (read: () => CheckpointState) => void;
		round: MemoryRound;
		roundNumber: number;
		soundEnabled: boolean;
		ontogglesound: () => void;
		onfinish: (score: number, seconds: number, moves: number) => void;
		onhome: () => void;
		/** Budget run-over: abandon this round and start the next puzzle. */
		ontryanother?: () => void;
		oncomplete?: (score: number, seconds: number) => void;
		onmove?: (move: MemoryMove) => void;
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
	const entranceDelay = createActiveDelay(() =>
		guard(() => {
			entrance?.settle();
			if (noPreview) {
				beginPlay();
				return;
			}
			phase = 'preview';
			announcement = t(
				trios ? 'memory.trios.memorize' : quads ? 'memory.quads.memorize' : 'status.memorize'
			);
			if (!(document.hidden || paused)) startPreviewClock();
		})
	);

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
	let failed = $state(false);
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
	const hideDelay = createActiveDelay(() => guard(finishHide));
	const mismatchDelay = createActiveDelay(() =>
		guard(() => {
			game = resolveMismatch(game);
			if (memoryVariant(game) === 'memory:moving') sound.play('reshuffle');
			if (swaps && game.marked?.length === 2)
				announcement = t('memory.swaps.swapped', {
					a: game.marked[0] + 1,
					b: game.marked[1] + 1
				});
		})
	);

	const variant = $derived(memoryVariant(game));
	const trios = $derived(variant === 'memory:trios');
	const quads = $derived(variant === 'memory:quads');
	const swaps = $derived(variant === 'memory:swaps');
	const collapse = $derived(variant === 'memory:collapse');
	const budget = $derived(variant === 'memory:budget');
	const timeStrata = $derived(isTimeStrata(variant));
	const noPreview = $derived(variant === 'memory:no-preview' || timeStrata);
	const matchSize = $derived(cardsPerMatch(game));
	const capped = $derived(memoryCapReached(game));
	// Budget shows its run-over choice once the final miss has turned back down.
	const runOver = $derived(budget && capped && game.revealed.length === 0);
	const attemptsLeft = $derived(Math.max(0, memoryMoveLimit(game) / matchSize - game.moves));
	const total = $derived(game.pairs * matchSize);
	let tryButton = $state<HTMLButtonElement>();
	const variantLabel = $derived(
		t('memory.variantLabel', { variant: t(memoryVariantName(variant)) })
	);

	const columns = $derived(
		quads
			? layoutMode === 'phone' || layoutMode === 'wide'
				? Math.min(game.pairs, 5)
				: 6
			: layoutMode === 'compact-landscape'
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
	const rows = $derived(Math.ceil(total / columns));
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
	const showAll = $derived(!noPreview && (phase === 'preview' || phase === 'dealing'));
	const locked = $derived(
		failed ||
			capped ||
			phase !== 'playing' ||
			game.revealed.length >= matchSize ||
			(timeStrata && (game.echo?.length ?? 0) > 0) ||
			game.status === 'won'
	);

	function guard(action: () => void): void {
		try {
			action();
		} catch {
			failed = true;
			pauseClock();
			console.error('morphi:memory_callback_failed');
		}
	}

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
		if (clockRunning || capped || failed) {
			return;
		}

		rankedClockStart ??=
			rankedRound && noPreview && rankedStartedAt !== null
				? performance.now() - Math.max(0, Date.now() - rankedStartedAt)
				: performance.now();
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
		if (!clockStarted || clockRunning || game.status !== 'playing' || capped || failed) {
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
		previewTimer = setTimeout(() => guard(beginHide), previewRemaining);
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

		beginPlay();
	}

	function beginPlay(): void {
		phase = 'playing';
		onready?.();
		announcement = t(timeStrata ? 'memory.timeStrata.ready' : 'status.go');

		if (!(document.hidden || paused)) {
			startClock();
		}
	}

	function handleVisibility(): void {
		guard(updateVisibility);
	}

	function updateVisibility(): void {
		if (document.hidden || paused) {
			finishDelay.pause();
			entrance?.pause();
			entranceDelay.pause();
			hideDelay.pause();
			mismatchDelay.pause();
			if (phase === 'preview') {
				pausePreview();
			} else if (phase === 'playing' || (noPreview && clockStarted)) {
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
		} else if ((phase === 'playing' || (noPreview && clockStarted)) && game.status === 'playing') {
			if (!clockStarted) {
				startClock();
			} else {
				resumeClock();
			}
		}
	}

	/** Collapse removes the focused card; move focus to the next surviving card in reading order. */
	async function refocusAfterCollapse(before: string[], index: number): Promise<void> {
		const focused = boardEl.contains(document.activeElement);
		const remaining = game.cards.map((card) => card.id);
		const next = before.slice(index + 1).find((id) => remaining.includes(id));
		await tick();
		if (!focused) return;
		const position = next === undefined ? remaining.length - 1 : remaining.indexOf(next);
		boardEl.querySelectorAll<HTMLElement>('.memory-card')[position]?.focus();
	}

	function handleFlip(index: number): void {
		guard(() => acceptFlip(index));
	}

	function acceptFlip(index: number): void {
		if (document.hidden || paused || phase !== 'playing' || game.status !== 'playing' || locked) {
			return;
		}
		if (timeStrata) {
			acceptTimeStrataMove(game.revealed.includes(index) ? { cancel: 1 } : { index });
			return;
		}

		const revealedBefore = game.revealed;
		const lockBefore = game.lock;
		const survivors = game.cards.map((card) => card.id);
		const result = flipCard(game, index);
		if (result.effect === 'ignored') {
			if (index === game.lock) announcement = t('memory.lockout.ignored', { number: index + 1 });
			return;
		}

		game = result.round;
		onmove?.({ index });
		const released =
			lockBefore != null && game.lock == null ? ` ${t('memory.lockout.released')}` : '';

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
			sound.play(trios ? 'trio-match' : 'match', matchStreak - 1);
			announcement = t('status.match') + released;
			celebrating = collapse ? [] : pair;
			if (collapse) void refocusAfterCollapse(survivors, index);
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
			announcement = capped
				? t(budget ? 'memory.budget.over' : 'memory.trios.cap')
				: game.lock != null
					? t('memory.lockout.locked', { number: game.lock + 1 })
					: t('status.mismatch');
			if (capped) freezeClock();
			shake = [...game.revealed];
			delayedFlip = game.revealed[matchSize - 1] ?? null;
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

		finishWin();
	}

	async function focusTimeStrataTop(): Promise<void> {
		await tick();
		boardEl
			.querySelector<HTMLElement>(
				'[data-strata-top]:not(:disabled), [data-strata-shelf]:not(:disabled)'
			)
			?.focus();
	}

	function timeStrataSelectionMessage(index: number): string {
		const card = game.cards[index];
		const glyph = resolvedTheme?.symbols[SYMBOLS.findIndex((symbol) => symbol.id === card.symbol)];
		return t(
			game.shelf?.index === index ? 'memory.strataShelf.selected' : 'memory.timeStrata.selected',
			{
				symbol: t(glyph ? `symbol.${glyph.label}` : symbolLabel(card.symbol)),
				stack: ['I', 'II', 'III', 'IV'][timeStrataTops(game).indexOf(index)]
			}
		);
	}

	function timeStrataStatus(): string {
		if ((game.echo?.length ?? 0) > 0) return t('memory.strataEcho.held');
		const outcome = timeStrataOutcome(game);
		if (outcome === 'order-blocked') return t('memory.strataOrder.blocked');
		if (outcome === 'match')
			return t(
				game.chain
					? 'memory.strataChain.held'
					: game.shelf && game.revealed.includes(game.shelf.index)
						? 'memory.strataShelf.match'
						: 'memory.timeStrata.match'
			);
		if (outcome === 'mismatch')
			return t(
				variant === 'memory:strata-slip'
					? 'memory.strataSlip.mismatch'
					: game.shelf && game.revealed.includes(game.shelf.index)
						? 'memory.strataShelf.mismatch'
						: 'memory.timeStrata.mismatch'
			);
		return game.revealed.length === 1
			? timeStrataSelectionMessage(game.revealed[0])
			: t('memory.timeStrata.ready');
	}

	function acceptTimeStrataMove(move: MemoryMove): void {
		if (document.hidden || paused || failed || phase !== 'playing' || game.status !== 'playing')
			return;
		const previousOutcome = timeStrataOutcome(game);
		const hadEcho = (game.echo?.length ?? 0) > 0;
		const selectedSample = game.shelf && game.revealed.includes(game.shelf.index);
		const result = applyMemoryMove(game, move);
		if (result.effect === 'ignored') return;
		game = result.round;
		onmove?.(move);
		if ('cancel' in move) {
			announcement = t('memory.timeStrata.cancelled');
			void focusTimeStrataTop();
		} else if ('continue' in move) {
			if (result.effect === 'win') finishWin();
			else if ((game.echo?.length ?? 0) > 0 || game.revealed.length === 2) {
				announcement = timeStrataStatus();
				if (game.chain) {
					matchStreak += 1;
					sound.play('match', matchStreak - 1);
				}
			} else {
				announcement = t(
					hadEcho
						? 'memory.strataEcho.closed'
						: previousOutcome === 'order-blocked'
							? 'memory.strataOrder.closed'
							: previousOutcome === 'match'
								? selectedSample
									? 'memory.strataShelf.matched'
									: 'memory.timeStrata.lifted'
								: selectedSample
									? 'memory.strataShelf.closed'
									: variant === 'memory:strata-slip'
										? 'memory.strataSlip.sunk'
										: 'memory.timeStrata.closed'
				);
				void focusTimeStrataTop();
			}
		} else if ('index' in move) {
			if (result.effect === 'flip') sound.play('flip');
			else if (result.effect === 'match') {
				matchStreak += 1;
				sound.play('match', matchStreak - 1);
			} else {
				matchStreak = 0;
				sound.play('mismatch');
			}
			announcement = timeStrataStatus();
		} else {
			announcement = t(
				'lift' in move
					? 'memory.strataShelf.lifted'
					: 'return' in move
						? 'memory.strataShelf.returned'
						: 'cycle' in move
							? 'memory.strataCycle.cycled'
							: 'memory.strataEmptyWell.moved'
			);
			void focusTimeStrataTop();
		}
	}

	function finishWin(): void {
		if (!timeStrata) matchStreak += 1;
		sound.play('win');
		announcement = t(
			timeStrata
				? 'memory.timeStrata.won'
				: trios
					? 'memory.trios.won'
					: quads
						? 'memory.quads.won'
						: 'status.won'
		);
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
	$effect(() => {
		if (runOver) tryButton?.focus();
	});
	let mounted = $state(false);
	let entranceStarted = false;
	$effect(() => {
		if (!mounted || !entranceReady || entranceStarted) return;
		untrack(() =>
			guard(() => {
				entranceStarted = true;
				if (resume && resume.phase !== 'dealing') {
					if (resume.phase === 'preview') {
						phase = 'preview';
						previewRemaining = resume.pending.preview ?? PREVIEW_MS;
						if (!(document.hidden || paused)) startPreviewClock();
					} else if (resume.phase === 'hiding') {
						phase = 'hiding';
						hideDelay.start(resume.pending.hide ?? MEMORY_HIDE_MS, document.hidden || paused);
					} else {
						phase = 'playing';
						if (!timeStrata && game.revealed.length === matchSize) {
							if (resume.pending.mismatch === undefined) game = resolveMismatch(game);
							else mismatchDelay.start(resume.pending.mismatch, document.hidden || paused);
						}
						onready?.();
						if (timeStrata) announcement = timeStrataStatus();
						if (game.status === 'won') {
							oncomplete?.(scoreRound(game, elapsed, scoring), elapsed);
							finishDelay.start(0, document.hidden || paused);
						} else if (!(document.hidden || paused)) startClock();
					}
					return;
				}
				if (noPreview && !(document.hidden || paused)) startClock();
				const duration =
					resume?.pending.entrance ??
					(motion.reduced() && !rankedRound ? 0 : memoryEntranceMs(game.pairs));
				entrance = motion.deal(
					Array.from(
						boardEl.querySelectorAll<HTMLElement>(timeStrata ? '.strata-top' : '.memory-card')
					),
					duration
				);
				announcement = t('v1.game.arriving');
				sound.play('deal');
				entranceDelay.start(duration, document.hidden || paused);
			})
		);
	});

	onMount(() => {
		if (resume) {
			clockBase = resume.elapsedMs;
			elapsed = Math.floor(clockBase / 1000);
			clockStarted = resume.clockStarted;
			rankedClockStart =
				rankedRound && rankedStartedAt !== null && clockStarted
					? performance.now() - Math.max(resume.elapsedMs, Date.now() - rankedStartedAt)
					: null;
		}
		registerCheckpoint?.(() => ({
			phase,
			elapsedMs: clockMs(),
			clockStarted,
			pending: Object.fromEntries(
				Object.entries({
					entrance: entranceDelay.remaining(),
					preview:
						phase === 'preview'
							? Math.max(
									0,
									previewRemaining - (previewStart === null ? 0 : performance.now() - previewStart)
								)
							: null,
					hide: hideDelay.remaining(),
					mismatch: mismatchDelay.remaining()
				}).filter((entry): entry is [string, number] => entry[1] !== null)
			)
		}));
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
{#if failed}<p role="alert">{t('memory.error')}</p>{/if}

<div
	class="game"
	class:is-capped={capped && !budget}
	style={`--cols:${columns};--rows:${rows};${memoryThemeStyle(theme)};${resolvedTheme ? proceduralStyle(resolvedTheme) : ''}`}
	data-family="memory"
	data-variant={variant}
	data-round={roundNumber}
	data-theme-version={resolvedTheme?.themeConfigVersion}
	data-theme-generator={resolvedTheme?.themeGeneratorVersion}
	data-theme-recipe={resolvedTheme?.recipe}
	data-phase={phase}
>
	<h2 class="sr-only">{variantLabel}</h2>

	<header class="hud">
		<button
			type="button"
			class="home-button"
			aria-label={t('game.home')}
			onclick={() => guard(onhome)}
		>
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
				<span class="stat-label"
					>{t(trios ? 'memory.trios.label' : quads ? 'memory.quads.label' : 'v1.game.pairs')}</span
				><strong>{matchedCount(game) / matchSize} / {game.pairs}</strong>
			</div>
			<div class="stat">
				<span class="stat-label"
					><span class="mismatch-full">{t('v1.game.mismatches')}</span><span class="mismatch-short"
						>{t('v11.game.mismatchesShort')}</span
					></span
				><strong>{game.mismatches}</strong>
			</div>
			{#if budget}
				<div class="stat">
					<span class="stat-label"
						><span aria-hidden="true">{t('memory.budget.left')}</span><span class="sr-only"
							>{t('memory.budget.leftFull')}</span
						></span
					><strong>{attemptsLeft} / {memoryMoveLimit(game) / matchSize}</strong>
				</div>
			{/if}
		</div>

		<SoundToggle enabled={soundEnabled} ontoggle={ontogglesound} />

		<p class="round-meta">
			<span>{variantLabel}</span>
			<span>{t('game.round', { number: roundNumber })}</span>
			{#if matchStreak >= 2}
				{#key matchStreak}
					<span class="streak">{t('game.streak', { count: matchStreak })}</span>
				{/key}
			{/if}
		</p>
	</header>
	{#if capped && !budget}<p class="cap" role="status">{t('memory.trios.cap')}</p>{/if}

	<main class="stage">
		<div
			class={timeStrata ? 'strata-board' : 'board'}
			bind:this={boardEl}
			data-pairs={game.pairs}
			data-columns={columns}
			data-cap={capped}
		>
			{#if timeStrata}
				<TimeStrata
					{game}
					locked={locked || paused}
					controlsLocked={failed || paused || phase !== 'playing' || game.status !== 'playing'}
					status={announcement}
					{symbolColors}
					{resolvedTheme}
					onflip={handleFlip}
					oncancel={() => guard(() => acceptTimeStrataMove({ cancel: 1 }))}
					oncontinue={() => guard(() => acceptTimeStrataMove({ continue: 1 }))}
					onutility={(move) => guard(() => acceptTimeStrataMove(move))}
				/>
			{:else}
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
						selected={phase === 'playing' &&
							game.revealed.length < matchSize &&
							game.revealed.includes(index)}
						delayedFlip={delayedFlip === index}
						celebrating={celebrating.includes(index)}
						winWave={winWave && game.matched.includes(index)}
						{locked}
						lockedOut={index === game.lock}
						marked={game.marked?.includes(index) ?? false}
						dealDelay={Math.floor(index / columns) * 20}
						matchDelay={celebrating[1] === index ? 40 : 0}
						waveDelay={(Math.floor(index / columns) + (index % columns)) * 20}
						onflip={handleFlip}
					/>
				{/each}
			{/if}
		</div>
		{#if runOver}
			<div class="run-over" role="dialog" aria-modal="true" aria-labelledby="run-over-title">
				<div class="run-over-panel">
					<h2 id="run-over-title">{t('memory.budget.over')}</h2>
					<p>{t('memory.budget.overBody')}</p>
					<div class="run-over-actions">
						<button
							type="button"
							bind:this={tryButton}
							onclick={() => guard(() => ontryanother?.())}>{t('memory.budget.tryAnother')}</button
						>
						<button type="button" onclick={() => guard(onhome)}>{t('game.home')}</button>
					</div>
				</div>
			</div>
		{/if}
	</main>

	<footer class="hint">
		<span
			>{t(
				timeStrata
					? variant === 'memory:strata-shelf'
						? 'memory.strataShelf.hint'
						: 'memory.timeStrata.hint'
					: trios
						? 'memory.trios.hint'
						: quads
							? 'memory.quads.hint'
							: 'game.hint',
				{
					pairs: game.pairs
				}
			)}</span
		>
		{#if trios || quads}<span>
				· {t('memory.trios.flips', {
					flips:
						game.moves * matchSize + (game.revealed.length < matchSize ? game.revealed.length : 0),
					limit: memoryMoveLimit(game)
				})}</span
			>{/if}
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

	.game.is-capped {
		grid-template-rows: auto auto minmax(0, 1fr) auto;
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

	.cap {
		grid-column: 1 / -1;
		margin: 0;
		text-align: center;
		font-size: var(--text-13);
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
		position: relative;
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

	.strata-board {
		width: min(100%, 620px);
	}

	.run-over {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		place-items: center;
		padding: 12px;
		background: color-mix(in srgb, var(--memory-bg) 90%, transparent);
	}

	.run-over-panel {
		width: min(100%, 320px);
		padding: 16px;
		border: 1px solid var(--memory-edge);
		border-radius: 12px;
		background: var(--surface);
		color: var(--ink);
		text-align: center;
	}

	.run-over-panel h2 {
		margin: 0 0 6px;
		font-size: var(--text-20);
	}

	.run-over-panel p {
		margin: 0 0 12px;
		font-size: var(--text-13);
	}

	.run-over-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}

	.run-over-actions button {
		min-height: 44px;
		padding: 8px 14px;
		border: 1px solid var(--memory-edge);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}

	.run-over-actions button:first-child {
		background: var(--ink);
		color: var(--surface);
	}

	.run-over-actions button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	.hint {
		text-align: center;
		color: var(--ink-2);
		font-size: var(--text-13);
		font-weight: 700;
	}

	@media (orientation: landscape) and (max-height: 560px) {
		:global(.design-public .active-round) .game.is-capped {
			grid-template-rows: minmax(0, 1fr) auto;
		}
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
