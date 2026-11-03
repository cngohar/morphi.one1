<script lang="ts">
	import { defaultScoreConfig, validateScoreValues, type ScoreConfig } from '#lib/scoring.js';
	import { measure } from '#lib/ui/measurement.js';
	import { reportAccountRound } from '#lib/ui/account-activity.js';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import ThemeBackdrop from '#lib/components/ThemeBackdrop.svelte';
	import RoundStage, { type CardPhase } from '#lib/components/RoundStage.svelte';
	import {
		CARD_DEAL_MS,
		CARD_FLIP_MS,
		CARD_UNFOLD_MS,
		CARD_FOLD_MS,
		RESULT_EXIT_MS
	} from '#lib/round-timing.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { motion } from '#lib/ui/motion.js';
	import PuzzleHelp from '#lib/components/PuzzleHelp.svelte';
	import { randomSeed } from '#lib/seeds.js';
	import { onMount, tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createRng } from '#lib/engine/rng.js';
	import { puzzleViews, puzzlePools } from '#lib/registry.js';
	import { familyIndex } from '#lib/family-index.js';
	import { puzzleMetadata } from '#lib/puzzle-metadata.js';
	import { eligibleFamilies, selectorAvailability } from '#lib/ui/selector-eligibility.js';
	import type { Component } from 'svelte';
	import {
		loadPuzzleView,
		loadPuzzleModule,
		type PuzzleRound,
		type PuzzleResult,
		type PuzzleViewProps
	} from '#lib/ui/puzzle-view.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { createPuzzleSelector, type PuzzleFamily, type PuzzleSelector } from '#lib/selector.js';

	import ResultScreen from '#lib/screens/ResultScreen.svelte';
	import { formatNumber } from '#lib/ui/format.js';
	import { sound } from '#lib/ui/sound.js';
	import {
		loadBestScore,
		loadSelectorState,
		saveSelectorState,
		loadFamilyPlayed,
		markFamilyPlayed,
		loadSoundEnabled,
		saveBestScore,
		saveSoundEnabled
	} from '#lib/ui/storage.js';

	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { loadThemeConfig } from '#lib/ui/theme-config.js';
	import { themeProfile } from '#lib/engine/theme/config.js';
	import { soloTheme } from '#lib/ui/solo-theme.js';
	import { createPreparationSlot } from '#lib/ui/prepare-ahead.js';
	import { rememberTheme, themeHistory } from '#lib/ui/theme-history.js';
	import type { CompletedRun, Move } from '#lib/engine/contract.js';
	import {
		enqueue,
		syncProgress,
		startSession,
		abandonSession,
		RankedSessionConflict,
		type ActiveRankedSession,
		durableStorage,
		pendingRuns,
		type SavedResult
	} from '#lib/ui/progress.js';

	const families = familyIndex.map((entry) => entry.id);
	const weights = new SvelteMap(familyIndex.map((entry) => [entry.id, entry.weight]));
	let scoring = $state<ScoreConfig>(defaultScoreConfig(families[0]!));

	let { data }: { data: { account: { signedIn: boolean; ownerKey: string | null } } } = $props();
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

	let cardPhase = $state<CardPhase>('waiting');
	let cardReady = $state(false);
	let revealed = $state(false);
	let stage: RoundStage;
	let playedCount = $state(0);
	let stack = $state<{ family: string; best: number; color: string }[]>([]);
	const endingArrivalMs = 420;
	const endingHoldMs = 500;
	const cardWaits = new SvelteMap<ReturnType<typeof createActiveDelay>, () => void>();
	function waitCard(ms: number) {
		return new Promise<void>((resolveWait) => {
			const delay = createActiveDelay(() => {
				cardWaits.delete(delay);
				resolveWait();
			});
			cardWaits.set(delay, resolveWait);
			delay.start(ms, document.hidden);
		});
	}
	function stopCardWaits() {
		for (const [delay, resolveWait] of cardWaits) {
			delay.cancel();
			resolveWait();
		}
		cardWaits.clear();
	}
	async function cardBeat(value: CardPhase, duration = 0, ranked = rankedRound) {
		cardPhase = value;
		await tick();
		if (generationLifetime.signal.aborted) return;
		const beat =
			value === 'dealing'
				? 'deal'
				: value === 'flipping'
					? 'flip'
					: value === 'unfolding'
						? 'unfold'
						: value === 'folding'
							? 'fold'
							: value === 'result-leaving'
								? 'result-exit'
								: value === 'result'
									? 'result'
									: null;
		if (beat) stage?.present(beat);
		else stage?.stop();
		await waitCard(motion.reduced() && !ranked ? 0 : duration);
	}
	function gameReady() {
		if (screen !== 'game') return;
		cardPhase = 'playing';
		if (roundOwner && !roundActivity) {
			roundActivity = reportAccountRound('start', roundOwner, roundId, family, rankedSession);
		}
	}
	let screen = $state<Screen>('home');
	let family = $state<PuzzleFamily>(families[0]!);
	let round = $state<PuzzleRound | null>(null);
	let View = $state<Component<PuzzleViewProps> | null>(null);
	const familyName = (value: PuzzleFamily) => t(`v1.game.${value}` as MessageKey);
	let resolvedTheme = $state<ResolvedTheme | null>(null);
	const generationLifetime = new AbortController();
	const preparation = createPreparationSlot(async (chosen, signal) => {
		const config = accountsEnabled ? await loadThemeConfig() : null;
		const theme = config
			? await soloTheme(
					chosen,
					await themeHistory(
						chosen,
						config.version,
						themeProfile(config, chosen).freshness.history
					),
					signal,
					config
				)
			: null;
		if (signal.aborted) throw new Error('round_cancelled');
		const seed = theme?.seed ?? randomSeed();
		return {
			theme,
			seed,
			round: (await loadPuzzleModule(puzzlePools[chosen], signal)).manifest.createRound(seed)
		};
	});
	let result = $state<ResultData | null>(null);
	let ending = $state<{ headline: string; subline: string } | null>(null);
	let endingNode = $state<HTMLDivElement>();
	let bests = $state<Record<PuzzleFamily, number>>(
		Object.fromEntries(families.map((id) => [id, 0]))
	);
	let played = $state<Record<PuzzleFamily, boolean>>(
		Object.fromEntries(families.map((id) => [id, false]))
	);
	let soundEnabled = $state(true);
	let startError = $state(false);
	let rankedConflict = $state<ActiveRankedSession | null>(null);
	let startErrorFamily = $state<PuzzleFamily>(families[0]!);
	let resultAnnouncement = $state('');
	let roundNumber = $state(0);
	let selector: PuzzleSelector | null = null;
	let starting = $state(false);
	let helpOpen = $state(false);
	let roundId = $state('');
	let roundOwner: string | null = null;
	let rankedSession: string | null = null;
	let roundActivity: Promise<boolean> | null = null;
	let runMoves: Move[] = [];
	let completedQueuedId: string | null = null;
	let completionQueued: Promise<void> = Promise.resolve();
	let syncStatus = $state('');
	let rankedRound = $state(false);
	let savedScore = $state<number | null>(null);
	const shellStyle = $derived(
		resolvedTheme
			? `--round-bg:${resolvedTheme.background};--round-back:${resolvedTheme.back};--round-edge:${resolvedTheme.edge}`
			: ''
	);

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
		bests = Object.fromEntries(families.map((id) => [id, loadBestScore(id)]));
		played = Object.fromEntries(families.map((id) => [id, loadFamilyPlayed(id)]));
		soundEnabled = loadSoundEnabled();
		sound.setEnabled(soundEnabled);
		startRound();
		retrySync();
		window.addEventListener('online', retrySync);
		const cardVisibility = () => {
			for (const delay of cardWaits.keys()) {
				if (document.hidden) delay.pause();
				else delay.resume();
			}
		};
		document.addEventListener('visibilitychange', cardVisibility);
		const retry = setInterval(retrySync, 15000);
		return () => {
			generationLifetime.abort();
			stopCardWaits();
			document.removeEventListener('visibilitychange', cardVisibility);
			preparation.dispose();
			clearInterval(retry);
			window.removeEventListener('online', retrySync);
		};
	});

	function getSelector(): PuzzleSelector {
		selector ??= createPuzzleSelector({
			families: familyIndex.map((entry) => ({ family: entry.id, weight: entry.weight })),
			weight: (entry) =>
				(weights.get(entry.family) ?? entry.weight) * (played[entry.family] ? 1 : 2),
			rng: createRng(randomSeed()),
			state: loadSelectorState(account.ownerKey),
			onChange: (state) => saveSelectorState(account.ownerKey, state)
		});
		return selector;
	}

	function startRound(takeoverSession?: string): void {
		void prepareRound(takeoverSession).catch(() => {
			starting = false;
			startError = true;
			console.error('morphi:round_start_failed');
		});
	}
	async function makeCandidate(
		chosen: PuzzleFamily,
		rankedGate: Promise<void>,
		takeoverSession?: string
	) {
		const view = await loadPuzzleView(puzzleViews[chosen], generationLifetime.signal);
		if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
		let seed = randomSeed();
		let nextTheme: ResolvedTheme | null = null;
		let nextScoring = defaultScoreConfig(chosen);
		let nextRunId: string = crypto.randomUUID();
		const nextOwner = account.ownerKey;
		let nextSession: string | null = null;
		if (nextOwner) {
			await rankedGate;
			if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
			try {
				const issued = await startSession(chosen, nextOwner, takeoverSession);
				seed = issued.seed;
				nextTheme = issued.theme;
				nextScoring = issued.scoring;
				nextRunId = issued.id;
				nextSession = issued.id;
			} catch (error) {
				if (
					takeoverSession ||
					error instanceof RankedSessionConflict ||
					(error instanceof Error && error.message === 'game_disabled')
				)
					throw error;
				console.warn('morphi:ranked_start_unavailable');
			}
		}
		let candidate = null;
		if (!nextSession) {
			candidate = await preparation.take(chosen);
			if (!candidate) {
				// One foreground retry after failed speculative preparation; retain the family.
				candidate = await preparation.take(chosen);
				if (!candidate) throw new Error('round_preparation_failed');
			}
			nextTheme = candidate.theme;
			seed = candidate.seed;
		} else preparation.clear();
		if (!nextSession && accountsEnabled) {
			try {
				const response = await fetch(resolve('/api/play/scoring') + '?family=' + chosen, {
					signal: AbortSignal.timeout(3000)
				});
				if (!response.ok) throw new Error('scoring_unavailable');
				const config: ScoreConfig = await response.json();
				nextScoring = {
					version: config.version,
					values: validateScoreValues(chosen, config.values)
				};
			} catch {
				console.warn('morphi:score_defaults_offline');
			}
		}
		if (accountsEnabled && !nextTheme) throw new Error('round_theme_missing');
		if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
		const nextRound =
			candidate?.round ??
			(await loadPuzzleModule(puzzlePools[chosen], generationLifetime.signal)).manifest.createRound(
				seed
			);
		if (generationLifetime.signal.aborted) throw new Error('round_cancelled');

		return {
			chosen,
			nextRound,
			nextView: view,
			nextTheme,
			nextOwner,
			nextSession,
			nextRunId,
			nextScoring
		};
	}
	async function refreshAvailableGames(): Promise<void> {
		let available: readonly string[] = families;
		if (accountsEnabled) {
			const response = await fetch(resolve('/api/play/availability'), {
				signal: AbortSignal.timeout(3000),
				cache: 'no-store'
			});
			if (!response.ok) throw new Error('game_unavailable');
			const data = selectorAvailability(familyIndex, await response.json());
			available = data.available;
			for (const entry of familyIndex)
				weights.set(entry.id, data.weights[entry.id] ?? entry.weight);
		}
		getSelector().setAvailable(
			eligibleFamilies(
				familyIndex,
				available.filter((id) => (weights.get(id) ?? 0) > 0),
				window.innerWidth,
				window.innerHeight
			)
		);
	}
	async function assertGameAvailable(chosen: PuzzleFamily): Promise<void> {
		if (!accountsEnabled) return;
		const response = await fetch(resolve('/api/play/availability') + '?family=' + chosen, {
			signal: AbortSignal.timeout(3000),
			cache: 'no-store'
		});
		if (!response.ok) throw new Error('game_unavailable');
		const data: unknown = await response.json();
		if (!data || typeof data !== 'object' || !('available' in data) || data.available !== true)
			throw new Error('game_unavailable');
	}
	async function prepareRound(takeoverSession?: string): Promise<void> {
		if (screen === 'game' || starting || (screen === 'result' && cardPhase !== 'result')) return;
		starting = true;
		startError = false;
		rankedConflict = null;
		let releaseRanked = () => {};
		try {
			sound.unlock();
			await refreshAvailableGames();
			const chosen = getSelector().peek();
			startErrorFamily = chosen;
			await assertGameAvailable(chosen);
			let ready = false;
			const rankedGate = new Promise<void>((resolveGate) => {
				releaseRanked = resolveGate;
			});
			const work = makeCandidate(chosen, rankedGate, takeoverSession).then(
				(value) => {
					ready = true;
					return { value };
				},
				(error: unknown) => {
					ready = true;
					return { value: null, error };
				}
			);
			if (screen === 'result') {
				measure('next_clicked');
				await cardBeat('result-leaving', RESULT_EXIT_MS, false);
			}
			cardReady = false;
			revealed = false;
			await cardBeat('dealing', CARD_DEAL_MS, Boolean(account.ownerKey));
			releaseRanked();
			if (generationLifetime.signal.aborted) return;
			if (!ready) cardPhase = 'waiting';
			const prepared = await work;
			if (!prepared.value) throw prepared.error;
			const { nextRound, nextView, nextTheme, nextOwner, nextSession, nextRunId, nextScoring } =
				prepared.value;
			if (generationLifetime.signal.aborted) return;
			if (!nextSession) await assertGameAvailable(chosen);
			// Commit rotation only after generation succeeds. Retry keeps the same family.
			getSelector().next();
			family = chosen;
			round = nextRound;
			View = nextView;
			resolvedTheme = nextTheme;
			scoring = nextScoring;
			bests = { ...bests, [chosen]: loadBestScore(chosen, scoring.version) };
			roundId = nextRunId;
			roundOwner = nextOwner;
			rankedSession = nextSession;
			roundActivity = null;
			rankedRound = Boolean(nextSession);
			runMoves = [];
			savedScore = null;
			syncStatus = nextOwner ? 'progress.unranked' : '';

			roundNumber += 1;
			result = null;
			resultAnnouncement = '';
			startError = false;
			screen = 'game';
			// Only a committed deal enters history. Slow persistence never delays its board.
			if (nextTheme) void rememberTheme(nextTheme);
			void preparation.warm(getSelector().peek());
			cardPhase = 'flipping';
			await tick();
			stage?.present('flip');
			await waitCard(motion.reduced() && !rankedRound ? 0 : CARD_FLIP_MS / 2);
			if (generationLifetime.signal.aborted) return;
			revealed = true;
			await waitCard(motion.reduced() && !rankedRound ? 0 : CARD_FLIP_MS / 2);
			await cardBeat('unfolding', CARD_UNFOLD_MS);
			if (generationLifetime.signal.aborted) return;
			stage?.stop();
			cardPhase = 'arriving';
			cardReady = true;
			measure('round_started', chosen);
		} catch (error) {
			if (generationLifetime.signal.aborted) return;
			if (error instanceof RankedSessionConflict) rankedConflict = error.active;
			console.error('morphi:round_start_failed', { family: startErrorFamily });
			stage?.stop();
			startError = !rankedConflict;
			cardPhase = result ? 'result' : 'failed';
			revealed = Boolean(result);
		} finally {
			releaseRanked();
			starting = false;
		}
	}

	function toggleSound(): void {
		soundEnabled = !soundEnabled;
		sound.setEnabled(soundEnabled);
		saveSoundEnabled(soundEnabled);
	}

	function recordResult({
		score,
		title,
		summary,
		announcement,
		stats,
		endingValues,
		cap = false
	}: PuzzleResult): void {
		const game = family;
		const previousBest = bests[game];
		const isNewBest = score > previousBest;
		const gap = Math.max(0, previousBest - score);
		const isSoClose = !isNewBest && previousBest > 0 && gap > 0 && gap <= 250;

		if (isNewBest) {
			bests = { ...bests, [game]: score };
			saveBestScore(score, game, scoring.version);
		}

		resultAnnouncement = announcement;
		const endingSpec = puzzleMetadata[game].ending;
		ending = {
			headline: t(
				(cap
					? (endingSpec.headlines.cap ?? endingSpec.headlines.default)
					: endingSpec.headlines.default) as MessageKey
			),
			subline: t(endingSpec.subline.key as MessageKey, endingValues)
		};
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
		cardReady = false;
		void (async () => {
			let timeout: ReturnType<typeof setTimeout> | undefined;
			try {
				await Promise.race([
					completionQueued,
					new Promise<never>((_, reject) => {
						timeout = setTimeout(() => reject(new Error('progress_storage_timeout')), 3000);
					})
				]);
			} catch {
				syncStatus = 'progress.storage';
				console.warn('morphi:progress_queue_timeout');
			} finally {
				if (timeout) clearTimeout(timeout);
			}
			cardPhase = 'ending';
			await tick();
			if (generationLifetime.signal.aborted) return;
			try {
				if (endingNode) motion.arrive(endingNode, endingArrivalMs);
			} catch {
				console.warn('morphi:ending_motion_unavailable');
			}
			await waitCard((motion.reduced() ? 0 : endingArrivalMs) + endingHoldMs);
			if (generationLifetime.signal.aborted) return;
			ending = null;
			await cardBeat('folding', CARD_FOLD_MS, false);
			if (generationLifetime.signal.aborted) return;
			stage?.stop();
			playedCount++;
			stack = [
				...stack,
				{
					family: familyName(game),
					best: Math.max(previousBest, score),
					color: resolvedTheme?.back ?? 'var(--surface-2)'
				}
			].slice(-8);
			await cardBeat('result');
		})().catch(() => {
			if (!generationLifetime.signal.aborted) {
				stage?.stop();
				cardPhase = 'result';
				console.warn('morphi:result_motion_unavailable');
			}
		});
	}

	function persistRound(elapsedSeconds: number, score: number) {
		if (completedQueuedId === roundId) return;
		completedQueuedId = roundId;
		measure('round_completed', family);
		markFamilyPlayed(family);
		played[family] = true;
		if (score > bests[family]) saveBestScore(score, family, scoring.version);
		// The policy-only guest release keeps the existing best/settings behavior;
		// recording account-importable replays belongs to the later account release.
		if (!accountsEnabled) return;
		const seed = round!.seed;
		const run: CompletedRun = {
			scoreConfigVersion: scoring.version,
			version: 1,
			id: roundId,
			family,
			engineVersion: puzzleMetadata[family].engineVersion,
			seed,
			moves: runMoves.slice(),
			elapsedSeconds,
			rankedSession,
			...(resolvedTheme
				? {
						theme: {
							configVersion: resolvedTheme.themeConfigVersion,
							generatorVersion: resolvedTheme.themeGeneratorVersion
						}
					}
				: {})
		};
		syncStatus = roundOwner ? 'progress.pending' : '';
		const owner = roundOwner;
		completionQueued = enqueue({
			id: run.id,
			owner,
			run,
			attempts: 0,
			retryAt: 0,
			...(resolvedTheme ? { resolvedTheme } : {})
		})
			.then(() => {
				if (!durableStorage && run.id === roundId) syncStatus = 'progress.storage';
				if (owner)
					void syncProgress(owner, onSaved, false, (message) => {
						if (run.id === roundId) syncStatus = message;
					}).catch(() => {
						if (run.id === roundId) syncStatus = 'progress.storage';
						console.error('morphi:progress_sync_failed');
					});
			})
			.catch(() => {
				if (run.id === roundId) syncStatus = 'progress.storage';
				console.error('morphi:progress_queue_failed');
			});
	}

	function goHome(): void {
		if (screen === 'game' && completedQueuedId !== roundId && roundOwner && rankedSession) {
			void abandonSession(rankedSession, roundOwner).catch(() =>
				console.warn('morphi:ranked_abandon_failed')
			);
		}
		if (screen === 'game' && completedQueuedId !== roundId && roundOwner && roundActivity) {
			const owner = roundOwner,
				id = roundId,
				game = family,
				session = rankedSession;
			void roundActivity.then((started) => {
				if (started) void reportAccountRound('abandon', owner, id, game, session);
			});
		}
		generationLifetime.abort();
		stopCardWaits();
		stage?.stop();
		preparation.dispose();
		round = null;
		View = null;
		result = null;
		ending = null;
		resultAnnouncement = '';
		startError = false;
		void goto(resolve('/'));
	}
</script>

<div
	class="active-round card-session"
	data-family={family}
	data-card-phase={cardPhase}
	style={shellStyle}
>
	{#if resolvedTheme}<ThemeBackdrop
			theme={resolvedTheme}
			visible={cardReady ||
				cardPhase === 'folding' ||
				cardPhase === 'ending' ||
				cardPhase === 'result' ||
				cardPhase === 'result-leaving'}
		/>{/if}
	<SiteHeader
		{soundEnabled}
		ontogglesound={toggleSound}
		onhome={goHome}
		gameTitle={revealed &&
		(!puzzleMetadata[family].titleAfterEntrance || cardReady || screen === 'result')
			? familyName(family)
			: ''}
		gameMode
	/>
	<RoundStage
		bind:this={stage}
		phase={cardPhase}
		title={familyName(family)}
		best={result?.best ?? bests[family]}
		ready={cardReady && screen === 'game'}
		failed={startError}
		{stack}
		{playedCount}
		onretry={() => startRound()}
	>
		{#key roundId}
			{#if round && View}
				<View
					{round}
					{resolvedTheme}
					scoring={scoring.values}
					{roundNumber}
					best={bests[family]}
					paused={helpOpen || !cardReady}
					{soundEnabled}
					{rankedRound}
					ontogglesound={toggleSound}
					onfinish={recordResult}
					onhome={goHome}
					onmove={(move) => runMoves.push(move)}
					oncomplete={(score, seconds) => persistRound(seconds, score)}
					entranceReady={cardReady}
					onready={gameReady}
				/>
			{/if}
		{/key}
		{#snippet resultContent()}
			{#if result}
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
					onnext={() => startRound()}
				/>
			{/if}
		{/snippet}
		{#snippet endingContent()}
			{#if ending}
				<div class="ending" aria-live="polite" bind:this={endingNode}>
					<strong>{ending.headline}</strong>
					<span>{ending.subline}</span>
				</div>
			{/if}
		{/snippet}
	</RoundStage>
	<footer class="round-panel">
		<div class="round-panel-inner">
			{#if revealed}<PuzzleHelp
					{family}
					scoring={scoring.values}
					onpause={(value) => (helpOpen = value)}
				/>{/if}
			<div class="family-high">
				<span>{t('v1.game.best')}</span><strong
					>{revealed ? formatNumber(bests[family]) : '—'}{#if revealed && !played[family]}<small
							>{t('v11.game.new')}</small
						>{/if}</strong
				>
			</div>
		</div>
	</footer>
</div>
{#if rankedConflict}
	<aside class="ranked-conflict" aria-live="polite" aria-labelledby="ranked-conflict-title">
		<h2 id="ranked-conflict-title">{t('ranked.activeTitle')}</h2>
		<p>{t(rankedConflict.saving ? 'ranked.savingConflict' : 'ranked.activeConflict')}</p>
		{#if !rankedConflict.saving}<button
				type="button"
				disabled={starting}
				onclick={() => startRound(rankedConflict!.id)}>{t('ranked.takeover')}</button
			>{/if}
		<button type="button" disabled={starting} onclick={() => startRound()}
			>{t('ranked.retry')}</button
		>
		<button type="button" onclick={goHome}>{t('ranked.keepCurrent')}</button>
	</aside>
{/if}
{#if startError && result}<p class="start-error" role="alert">{t('round.startError')}</p>{/if}
<p class="sr-only" aria-live="polite" aria-atomic="true">{resultAnnouncement}</p>

<style>
	.ranked-conflict {
		position: fixed;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%);
		z-index: 40;
		width: min(90vw, 420px);
		max-height: 90dvh;
		overflow: auto;
		padding: 24px;
		border: 2px solid var(--ink);
		border-radius: 16px;
		background: var(--surface);
		color: var(--ink);
		text-align: center;
	}
	.ranked-conflict h2 {
		font-size: var(--text-20);
		margin: 0 0 12px;
	}
	.ranked-conflict p {
		margin: 0 0 16px;
	}
	.ranked-conflict button {
		display: block;
		width: 100%;
		min-height: 44px;
		margin-top: 8px;
	}

	.ending {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		border: 0;
		background: color-mix(in srgb, var(--round-bg, var(--bg)) 70%, transparent);
		color: var(--ink);
		pointer-events: none;
		text-align: center;
	}
	.ending strong {
		font-size: clamp(28px, 5vw, 48px);
	}
	.ending span {
		font-size: var(--text-15);
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
