<script lang="ts">
	import { measure } from '#lib/ui/measurement.js';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import PuzzleHelp from '#lib/components/PuzzleHelp.svelte';
	import { randomSeed } from '#lib/seeds.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createRng } from '#lib/engine/rng.js';
	import {
		BLOCK_SO_CLOSE_GAP,
		createBlockRound,
		type BlockEndReason,
		type BlockRound
	} from '#lib/registry.js';
	import { createMemoryRound, type MemoryRound } from '#lib/registry.js';
	import { t } from '#lib/i18n/messages.js';
	import { createPuzzleSelector, type PuzzleFamily, type PuzzleSelector } from '#lib/selector.js';
	import { BlockGame as BlockGameScreen, MemoryGame as GameScreen } from '#lib/registry.js';

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

	import { catalog } from '#lib/catalog.js';
	import type { CompletedRun, Move } from '#lib/engine/contract.js';
	import {
		enqueue,
		syncProgress,
		startSession,
		durableStorage,
		pendingRuns,
		type SavedResult
	} from '#lib/ui/progress.js';

	let {
		data,
		fixedFamily = null
	}: {
		data: { account: { signedIn: boolean; ownerKey: string | null } };
		fixedFamily?: PuzzleFamily | null;
	} = $props();
	// svelte-ignore state_referenced_locally
	let account = $state(data.account);
	const accountsEnabled = import.meta.env.MODE !== 'public-guest';

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
		stats: { label: string; value: string }[];
	}

	let screen = $state<Screen>('home');
	let family = $state<PuzzleFamily>('block');
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
	let starting = $state(false);
	let helpOpen = $state(false);
	let roundId = '';
	let roundOwner: string | null = null;
	let rankedSession: string | null = null;
	let runMoves: Move[] = [];
	let completedQueuedId: string | null = null;
	let syncStatus = $state('');
	let rankedRound = $state(false);
	let savedScore = $state<number | null>(null);

	function onSaved(saved: SavedResult) {
		if (saved.id !== roundId) return;
		syncStatus = saved.ranked ? 'progress.ranked' : 'progress.saved';
		savedScore = saved.score;
	}
	function retrySync() {
		if (account.ownerKey)
			void syncProgress(account.ownerKey, onSaved, false, (message) => {
				syncStatus = message;
			})
				.then(async () => {
					const entries = await pendingRuns();
					if (entries.some((entry) => entry.id === roundId && entry.rejected))
						syncStatus = 'progress.rejected';
				})
				.catch(() => console.error('morphi:progress_sync_failed'));
	}

	onMount(() => {
		bests = { block: loadBestScore('block'), memory: loadBestScore('memory') };
		soundEnabled = loadSoundEnabled();
		sound.setEnabled(soundEnabled);
		startRound();
		retrySync();
		window.addEventListener('online', retrySync);
		const retry = setInterval(retrySync, 15000);
		return () => {
			clearInterval(retry);
			window.removeEventListener('online', retrySync);
		};
	});

	function getSelector(): PuzzleSelector {
		selector ??= createPuzzleSelector({
			families: [
				{ family: 'block', weight: 1 },
				{ family: 'memory', weight: 1 }
			],
			rng: createRng(randomSeed())
		});
		return selector;
	}

	function startRound(): void {
		void prepareRound().catch(() => {
			starting = false;
			startError = true;
			console.error('morphi:round_start_failed');
		});
	}
	async function prepareRound(): Promise<void> {
		if (screen === 'game' || starting) return;
		starting = true;
		try {
			if (fixedFamily && accountsEnabled) {
				try {
					const response = await fetch(resolve('/api/account/status'));
					if (response.ok) account = await response.json();
				} catch {
					console.warn('morphi:session_refresh_unavailable');
				}
			}
			sound.unlock();
			const chosen = fixedFamily ?? getSelector().peek();
			startErrorFamily = chosen;
			let seed = randomSeed();
			roundId = crypto.randomUUID();
			roundOwner = account.ownerKey;
			rankedSession = null;
			runMoves = [];
			savedScore = null;
			syncStatus = roundOwner ? 'progress.unranked' : '';
			if (roundOwner) {
				try {
					const issued = await startSession(chosen, roundOwner);
					seed = issued.seed;
					roundId = issued.id;
					rankedSession = issued.id;
				} catch {
					console.warn('morphi:ranked_start_unavailable');
				}
			}
			rankedRound = Boolean(rankedSession);
			const nextBlock = chosen === 'block' ? createBlockRound(seed) : null;
			const nextMemory = chosen === 'memory' ? createMemoryRound(seed) : null;

			// Commit rotation only after generation succeeds. Retry keeps the same family.
			if (!fixedFamily) getSelector().next();
			family = chosen;
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
			measure('round_started', chosen);
		} catch {
			console.error('morphi:round_start_failed', { family: startErrorFamily });
			startError = true;
		} finally {
			starting = false;
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
		announcement: string,
		stats: { label: string; value: string }[]
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
			summary,
			stats
		};
		screen = 'result';
	}

	function persistRound(elapsedSeconds: number, score: number) {
		if (completedQueuedId === roundId) return;
		completedQueuedId = roundId;
		measure('round_completed', family);
		if (score > bests[family]) saveBestScore(score, family);
		// The policy-only guest release keeps the existing best/settings behavior;
		// recording account-importable replays belongs to the later account release.
		if (!accountsEnabled) return;
		const seed = family === 'block' ? blockRound!.seed : memoryRound!.seed;
		const run: CompletedRun = {
			version: 1,
			id: roundId,
			family,
			engineVersion: catalog[family].engineVersion,
			seed,
			moves: runMoves.slice(),
			elapsedSeconds,
			rankedSession
		};
		syncStatus = roundOwner ? 'progress.pending' : '';
		const owner = roundOwner;
		void enqueue({ id: run.id, owner, run, attempts: 0, retryAt: 0 })
			.then(() => {
				if (!durableStorage && run.id === roundId) syncStatus = 'progress.storage';
				if (owner)
					return syncProgress(owner, onSaved, false, (message) => {
						if (run.id === roundId) syncStatus = message;
					});
			})
			.catch(() => {
				syncStatus = 'progress.storage';
				console.error('morphi:progress_queue_failed');
			});
	}

	function finishBlockRound(
		score: number,
		lines: number,
		pieces: number,
		endReason: BlockEndReason,
		streak: number
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
			t('block.result.announce', { score: formatNumber(score), summary }),
			[
				{ label: t('block.lines'), value: formatNumber(lines) },
				{ label: t('v1.game.moves'), value: formatNumber(pieces) },
				{ label: t('block.streak'), value: streak > 0 ? `×${streak}` : '—' }
			]
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
			t('result.announce', { score: formatNumber(score), summary }),
			[
				{ label: t('v1.game.pairs'), value: String(memoryRound?.pairs ?? 0) },
				{ label: t('v1.game.mismatches'), value: String(moves - (memoryRound?.pairs ?? 0)) },
				{ label: t('game.time'), value: formatDuration(seconds) }
			]
		);
	}

	function goHome(): void {
		blockRound = null;
		memoryRound = null;
		result = null;
		resultAnnouncement = '';
		startError = false;
		void goto(resolve('/'));
	}
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>
{#if screen === 'home'}
	<main class="round-loading" aria-live="polite">
		<p>{t(startError ? 'round.startError' : 'round.starting')}</p>
		{#if startError}<button onclick={startRound}>{t('account.retry')}</button>{/if}
	</main>
{:else if screen === 'game' && family === 'block' && blockRound}
	<div class="active-round" data-family="block">
		<SiteHeader {soundEnabled} ontogglesound={toggleSound} onhome={goHome} />
		<div class="active-wrap">
			<h1>{t('v1.game.block')}</h1>
			<PuzzleHelp family="block" onpause={(value) => (helpOpen = value)} />
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
					onmove={(move) => runMoves.push(move)}
					oncomplete={(score) => persistRound(0, score)}
					traySide="right"
				/>
			{/key}
		</div>
	</div>
{:else if screen === 'game' && family === 'memory' && memoryRound}
	<div class="active-round" data-family="memory">
		<SiteHeader {soundEnabled} ontogglesound={toggleSound} onhome={goHome} />
		<div class="active-wrap">
			<h1>{t('v1.game.memory')}</h1>
			<PuzzleHelp family="memory" onpause={(value) => (helpOpen = value)} />
			{#key memoryRound.seed}
				<GameScreen
					paused={helpOpen}
					round={memoryRound}
					{roundNumber}
					{soundEnabled}
					ontogglesound={toggleSound}
					{rankedRound}
					onmove={(move) => runMoves.push(move)}
					oncomplete={(score, seconds) => persistRound(seconds, score)}
					onfinish={finishMemoryRound}
					onhome={goHome}
				/>
			{/key}
		</div>
	</div>
{:else if screen === 'result' && result}
	<ResultScreen
		{family}
		stats={result.stats}
		title={result.title}
		summary={result.summary}
		score={result.score}
		best={result.best}
		previousBest={result.previousBest}
		isNewBest={result.isNewBest}
		isSoClose={result.isSoClose}
		gap={result.gap}
		signedIn={account.signedIn}
		{accountsEnabled}
		{syncStatus}
		{savedScore}
		{starting}
		onnext={() => {
			measure('next_clicked');
			startRound();
		}}
		onhome={goHome}
	/>
{/if}

{#if startError}
	<p class="start-error" role="alert">
		{t('round.startError')}
	</p>
{/if}

<p class="sr-only" aria-live="polite" aria-atomic="true">{resultAnnouncement}</p>

<style>
	.round-loading {
		min-height: 100dvh;
		display: grid;
		place-content: center;
		gap: 20px;
		text-align: center;
	}
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
