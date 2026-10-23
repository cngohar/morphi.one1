<script lang="ts">
	import { onMount } from 'svelte';
	import { createRng, randomSeed } from '#lib/engine/rng.js';
	import {
		BLOCK_SO_CLOSE_GAP,
		createBlockRound,
		type BlockEndReason,
		type BlockRound
	} from '#lib/game/block.js';
	import { createMemoryRound, type MemoryRound } from '#lib/game/memory.js';
	import { t } from '#lib/i18n/messages.js';
	import { createPuzzleSelector, type PuzzleFamily, type PuzzleSelector } from '#lib/selector.js';
	import BlockGameScreen from '#lib/screens/BlockGameScreen.svelte';
	import GameScreen from '#lib/screens/GameScreen.svelte';
	import HomeScreen from '#lib/screens/HomeScreen.svelte';
	import ResultScreen from '#lib/screens/ResultScreen.svelte';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { sound } from '#lib/ui/sound.js';
	import {
		loadBestScore,
		loadBlockHintSeen,
		loadSoundEnabled,
		saveBestScore,
		saveBlockHintSeen,
		saveSoundEnabled
	} from '#lib/ui/storage.js';

	type Screen = 'home' | 'game' | 'result';

	interface ResultData {
		score: number;
		best: number;
		previousBest: number;
		isNewBest: boolean;
		isSoClose: boolean;
		gap: number;
		title: string;
		summary: string;
	}

	let screen = $state<Screen>('home');
	let family = $state<PuzzleFamily>('block');
	let nextFamily = $state<PuzzleFamily>('block');
	let blockRound = $state<BlockRound | null>(null);
	let memoryRound = $state<MemoryRound | null>(null);
	let result = $state<ResultData | null>(null);
	let bests = $state<Record<PuzzleFamily, number>>({ block: 0, memory: 0 });
	let soundEnabled = $state(true);
	let startError = $state(false);
	let startErrorFamily = $state<PuzzleFamily>('block');
	let resultAnnouncement = $state('');
	let roundNumber = $state(0);
	let showHint = $state(false);
	let selector: PuzzleSelector | null = null;

	onMount(() => {
		bests = { block: loadBestScore('block'), memory: loadBestScore('memory') };
		soundEnabled = loadSoundEnabled();
		sound.setEnabled(soundEnabled);
	});

	function getSelector(): PuzzleSelector {
		selector ??= createPuzzleSelector({
			families: [
				{ family: 'block', weight: 1 },
				{ family: 'memory', weight: 1 }
			],
			firstFamily: 'block',
			rng: createRng(randomSeed())
		});
		return selector;
	}

	function startRound(): void {
		if (screen === 'game') return;
		try {
			sound.unlock();
			const chosen = getSelector().peek();
			startErrorFamily = chosen;
			const seed = randomSeed();
			const nextBlock = chosen === 'block' ? createBlockRound(seed) : null;
			const nextMemory = chosen === 'memory' ? createMemoryRound(seed) : null;

			// Commit rotation only after generation succeeds. Retry keeps the same family.
			getSelector().next();
			family = chosen;
			nextFamily = getSelector().peek();
			blockRound = nextBlock;
			memoryRound = nextMemory;

			if (chosen === 'block') {
				showHint = !loadBlockHintSeen();
				saveBlockHintSeen();
			} else {
				showHint = false;
			}

			roundNumber += 1;
			result = null;
			resultAnnouncement = '';
			startError = false;
			screen = 'game';
		} catch {
			console.error('morphi:round_start_failed', { family: startErrorFamily });
			startError = true;
		}
	}

	function toggleSound(): void {
		soundEnabled = !soundEnabled;
		sound.setEnabled(soundEnabled);
		saveSoundEnabled(soundEnabled);
	}

	function recordResult(
		score: number,
		previousBest: number,
		title: string,
		summary: string,
		game: PuzzleFamily,
		announcement: string
	): void {
		const isNewBest = score > previousBest;
		const gap = Math.max(0, previousBest - score);
		const isSoClose = !isNewBest && previousBest > 0 && gap > 0 && gap <= BLOCK_SO_CLOSE_GAP;

		if (isNewBest) {
			bests = { ...bests, [game]: score };
			saveBestScore(score, game);
		}

		resultAnnouncement = announcement;
		result = {
			score,
			best: Math.max(previousBest, score),
			previousBest,
			isNewBest,
			isSoClose,
			gap,
			title,
			summary
		};
		screen = 'result';
	}

	function finishBlockRound(
		score: number,
		lines: number,
		pieces: number,
		endReason: BlockEndReason
	): void {
		const summary = t('block.result.summary', { lines, pieces });
		const endSummary = t(endReason === 'cap' ? 'block.result.cap' : 'block.result.noFit', {
			summary
		});
		recordResult(
			score,
			bests.block,
			t('block.result.title'),
			endSummary,
			'block',
			t('block.result.announce', { score: formatNumber(score), summary })
		);
	}

	function finishMemoryRound(score: number, seconds: number, moves: number): void {
		const summary = t('result.summary', {
			pairs: memoryRound?.pairs ?? 0,
			moves,
			time: formatDuration(seconds)
		});
		recordResult(
			score,
			bests.memory,
			t('result.title'),
			summary,
			'memory',
			t('result.announce', { score: formatNumber(score), summary })
		);
	}

	function goHome(): void {
		blockRound = null;
		memoryRound = null;
		result = null;
		resultAnnouncement = '';
		startError = false;
		screen = 'home';
	}
</script>

<svelte:head>
	<title>{t('meta.title')}</title>
	<meta name="description" content={t('meta.description')} />
</svelte:head>

{#if screen === 'home'}
	<HomeScreen
		best={bests[nextFamily]}
		{soundEnabled}
		onplay={startRound}
		ontogglesound={toggleSound}
	/>
{:else if screen === 'game' && family === 'block' && blockRound}
	{#key blockRound.seed}
		<BlockGameScreen
			round={blockRound}
			{roundNumber}
			best={bests.block}
			{showHint}
			{soundEnabled}
			ontogglesound={toggleSound}
			onfinish={finishBlockRound}
			onhome={goHome}
			traySide="right"
		/>
	{/key}
{:else if screen === 'game' && family === 'memory' && memoryRound}
	{#key memoryRound.seed}
		<GameScreen
			round={memoryRound}
			{roundNumber}
			{soundEnabled}
			ontogglesound={toggleSound}
			onfinish={finishMemoryRound}
			onhome={goHome}
		/>
	{/key}
{:else if screen === 'result' && result}
	<ResultScreen
		title={result.title}
		summary={result.summary}
		score={result.score}
		best={result.best}
		previousBest={result.previousBest}
		isNewBest={result.isNewBest}
		isSoClose={result.isSoClose}
		gap={result.gap}
		onnext={startRound}
		onhome={goHome}
	/>
{/if}

{#if startError}
	<p class="start-error" role="alert">
		{t(startErrorFamily === 'memory' ? 'game.error' : 'block.error')}
	</p>
{/if}

<p class="sr-only" aria-live="polite" aria-atomic="true">{resultAnnouncement}</p>

<style>
	.start-error {
		position: fixed;
		left: 50%;
		bottom: calc(20px + var(--safe-bottom));
		transform: translateX(-50%);
		z-index: 30;
		max-width: min(92vw, 420px);
		padding: 12px 18px;
		border-radius: 14px;
		background: var(--danger);
		color: var(--surface);
		font-size: var(--text-15);
		font-weight: 700;
		text-align: center;
	}
</style>
