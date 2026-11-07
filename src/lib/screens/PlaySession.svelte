<script lang="ts">
	import {
		defaultScoreConfig,
		puzzleVariant,
		validateScoreValues,
		type ScoreConfig
	} from '#lib/scoring.js';
	import { measure } from '#lib/ui/measurement.js';
	import { familyName } from '#lib/ui/puzzle-presentation.js';
	import {
		loadCheckpoint,
		saveCheckpoint,
		clearCheckpoint,
		claimCheckpoint,
		checkpointDurable,
		checkpointMatchesIssued,
		type RoundCheckpoint,
		type CheckpointState,
		type CheckpointLease
	} from '#lib/ui/checkpoint.js';
	import { paletteIssues } from '#lib/engine/theme/generator.js';
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
		activeSession,
		type ResumableRankedSession,
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
	function reportPresented() {
		if (roundOwner && !roundActivity)
			roundActivity = reportAccountRound(
				'start',
				roundOwner,
				roundId,
				family,
				rankedSession,
				variant
			);
	}
	function gameReady() {
		if (screen !== 'game') return;
		cardPhase = 'playing';
		void checkpointRound();
		reportPresented();
	}
	let screen = $state<Screen>('home');
	let family = $state<PuzzleFamily>(families[0]!);
	let variant = $state<string | undefined>();
	let availableVariants: Record<string, string[]> = Object.fromEntries(
		families.map((id) => [
			id,
			puzzleMetadata[id].variants
				?.filter((entry) => entry.enabled !== false)
				.map((entry) => entry.id) ?? []
		])
	);
	let round = $state<PuzzleRound | null>(null);
	let View = $state<Component<PuzzleViewProps> | null>(null);
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
	let resumeChoice = $state<RoundCheckpoint | ResumableRankedSession | null>(null);
	let resumeInvalid = $state(false);
	let resumeError = $state(false);
	let roundLocked = $state(false);
	let storageNotice = $state(false);
	let lockNotice = $state(false);
	let resumeState = $state<CheckpointState | undefined>();
	let checkpointReader: (() => CheckpointState) | null = null;
	let checkpointSavedAt = $state<number | undefined>();
	let checkpointLease: CheckpointLease | null = null;
	let restoring = false;
	let rankedStartedAt = $state<number | null>(null);

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
		lockNotice = !navigator.locks;
		void restoreChoice().catch(() => {
			resumeError = true;
			console.warn('morphi:checkpoint_load_failed');
		});
		retrySync();
		window.addEventListener('online', retrySync);
		const cardVisibility = () => {
			if (document.hidden) {
				void checkpointRound();
				if (rankedSession) reportAbandon();
			}
			for (const delay of cardWaits.keys()) {
				if (document.hidden) delay.pause();
				else delay.resume();
			}
		};
		document.addEventListener('visibilitychange', cardVisibility);
		const retry = setInterval(retrySync, 15000);
		return () => {
			const lease = checkpointLease;
			void checkpointRound().finally(() => lease?.release());
			generationLifetime.abort();
			stopCardWaits();
			document.removeEventListener('visibilitychange', cardVisibility);
			preparation.dispose();
			clearInterval(retry);
			window.removeEventListener('online', retrySync);
		};
	});

	async function restoreChoice(): Promise<void> {
		if (accountsEnabled) {
			try {
				const response = await fetch(resolve('/api/account/status'), {
					cache: 'no-store',
					signal: AbortSignal.timeout(3000)
				});
				if (!response.ok) throw new Error('account_status');
				const current: unknown = await response.json();
				if (
					!current ||
					typeof current !== 'object' ||
					!('signedIn' in current) ||
					typeof current.signedIn !== 'boolean' ||
					!('ownerKey' in current) ||
					(current.ownerKey !== null && typeof current.ownerKey !== 'string')
				)
					throw new Error('account_status');
				account = { signedIn: current.signedIn, ownerKey: current.ownerKey };
			} catch {
				console.warn('morphi:account_status_unavailable');
			}
		}
		const checkpoint = await loadCheckpoint(account.ownerKey);
		storageNotice = !checkpointDurable;
		let active: ActiveRankedSession | ResumableRankedSession | null = null;
		if (account.ownerKey) {
			try {
				active = await activeSession(account.ownerKey);
			} catch {
				resumeChoice = checkpoint;
				resumeError = true;
				console.warn('morphi:ranked_resume_unavailable');
				return;
			}
		}
		if (generationLifetime.signal.aborted) return;
		if (active && (active.saving || !('family' in active))) {
			rankedConflict = active;
			return;
		}
		if (active && 'family' in active) {
			if (checkpoint?.rankedSession === active.id && !checkpointMatchesIssued(checkpoint, active))
				console.warn('morphi:checkpoint_identity_mismatch');
			resumeChoice =
				checkpoint && checkpointMatchesIssued(checkpoint, active) ? checkpoint : active;
		} else if (checkpoint) {
			// A released/expired ranked checkpoint may still continue locally, without a ranked claim.
			resumeChoice = { ...checkpoint, rankedSession: null, rankedStartedAt: null };
		}
		if (resumeChoice) {
			resumeInvalid =
				!Object.hasOwn(puzzleMetadata, resumeChoice.family) ||
				resumeChoice.engineVersion !== puzzleMetadata[resumeChoice.family].engineVersion;
			if (resumeInvalid) {
				console.info(
					JSON.stringify({
						event: 'round_abandoned',
						family: resumeChoice.family,
						reason: 'engine_version'
					})
				);
				console.warn('morphi:checkpoint_version_mismatch');
				if (account.ownerKey)
					void reportAccountRound(
						'abandon',
						account.ownerKey,
						resumeChoice.id,
						resumeChoice.family,
						'rankedSession' in resumeChoice ? resumeChoice.rankedSession : resumeChoice.id,
						resumeChoice.variant
					);
			}
		} else startRound();
	}
	function reportAbandon(): void {
		if (screen !== 'game' || completedQueuedId === roundId || !roundOwner || !roundActivity) return;
		const owner = roundOwner,
			id = roundId,
			game = family,
			roundVariant = variant,
			session = rankedSession;
		void roundActivity.then((started) => {
			if (started) void reportAccountRound('abandon', owner, id, game, session, roundVariant);
		});
	}
	async function ownCheckpoint(id: string, takeover = false): Promise<boolean> {
		// The live-tab lock belongs to the owner, so Next keeps its existing lease.
		if (!takeover && checkpointLease?.owns()) {
			roundLocked = false;
			return true;
		}
		checkpointLease?.release();
		checkpointLease = await claimCheckpoint(
			id,
			account.ownerKey,
			() => {
				roundLocked = true;
				console.warn('morphi:checkpoint_ownership_lost');
			},
			takeover
		);
		if (generationLifetime.signal.aborted) {
			checkpointLease?.release();
			checkpointLease = null;
			return false;
		}
		roundLocked = !checkpointLease;
		return Boolean(checkpointLease);
	}
	async function checkpointRound(): Promise<void> {
		if (
			screen !== 'game' ||
			restoring ||
			Boolean(resumeChoice) ||
			resumeError ||
			!round ||
			!checkpointReader ||
			!checkpointLease ||
			completedQueuedId === roundId ||
			roundLocked
		)
			return;
		try {
			const state = checkpointReader();
			await saveCheckpoint(
				{
					version: 1,
					id: roundId,
					owner: roundOwner,
					family,
					...(variant ? { variant } : {}),
					seed: round.seed,
					engineVersion: puzzleMetadata[family].engineVersion,
					difficulty: 'band' in round && typeof round.band === 'number' ? round.band : null,
					modifiers: {},
					theme: resolvedTheme,
					scoring,
					moves: runMoves.slice(),
					state,
					status: 'active',
					savedAt: Date.now(),
					rankedSession,
					rankedStartedAt
				},
				checkpointLease
			);
			storageNotice = !checkpointDurable;
		} catch {
			console.warn('morphi:checkpoint_save_failed');
			storageNotice = true;
		}
	}
	function checkpointMove(move: Move): void {
		if (runMoves.length === 0 && roundOwner) {
			reportPresented();
			const owner = roundOwner,
				id = roundId,
				game = family,
				session = rankedSession,
				roundVariant = variant;
			void roundActivity?.then((started) => {
				if (started) void reportAccountRound('play', owner, id, game, session, roundVariant);
			});
		}
		runMoves.push(move);
		// Capture after the move handler has installed any logical deadlines.
		queueMicrotask(() => {
			void checkpointRound();
		});
	}
	async function resumeRound(takeover = false): Promise<void> {
		let choice = resumeChoice;
		if (!choice || starting || resumeInvalid) return;
		starting = true;
		restoring = true;
		resumeError = false;
		try {
			if (!(await ownCheckpoint(choice.id, takeover))) return;
			const latest = await loadCheckpoint(account.ownerKey, true);
			if (latest && latest.id !== choice.id) {
				resumeChoice = latest;
				resumeInvalid =
					!Object.hasOwn(puzzleMetadata, latest.family) ||
					latest.engineVersion !== puzzleMetadata[latest.family].engineVersion;
				checkpointLease?.release();
				return;
			}
			if (latest?.id === choice.id) choice = latest;
			else if ('moves' in choice) {
				resumeInvalid = true;
				checkpointLease?.release();
				return;
			}
			if (
				!Object.hasOwn(puzzleMetadata, choice.family) ||
				choice.engineVersion !== puzzleMetadata[choice.family].engineVersion
			) {
				resumeInvalid = true;
				checkpointLease?.release();
				return;
			}
			if (account.ownerKey && ('rankedSession' in choice ? choice.rankedSession : choice.id)) {
				const active = await activeSession(account.ownerKey);
				if (!active || active.id !== choice.id || active.saving)
					throw new Error('ranked_resume_unavailable');
				if (!('family' in active)) {
					resumeInvalid = true;
					checkpointLease?.release();
					return;
				}
				if ('moves' in choice && !checkpointMatchesIssued(choice, active)) {
					console.warn('morphi:checkpoint_identity_mismatch');
					choice = active;
				}
			}
			if (!puzzleMetadata[choice.family].variants?.length) await assertGameAvailable(choice.family);
			const module = await loadPuzzleModule(puzzlePools[choice.family], generationLifetime.signal);
			const checkpoint = 'moves' in choice ? choice : null;
			const config = choice.scoring;
			validateScoreValues(choice.family, config.values, choice.variant);
			if (
				config.version !== defaultScoreConfig(choice.family, choice.variant).version &&
				!/^[0-9a-f-]{36}$/.test(config.version)
			)
				throw new Error('checkpoint_version');
			const theme = 'theme' in choice ? choice.theme : null;
			if (
				theme &&
				(theme.family !== choice.family ||
					theme.seed !== choice.seed ||
					paletteIssues(theme).length)
			)
				throw new Error('checkpoint_theme');
			const moves = checkpoint?.moves ?? [];
			if (moves.length > module.manifest.maxMoves) throw new Error('checkpoint_moves');
			for (const move of moves) module.manifest.parseMove(move);
			if (!module.manifest.resumeRound) throw new Error('checkpoint_version');
			const restored = module.manifest.resumeRound(
				choice.seed,
				moves,
				config.values,
				choice.variant
			);
			const view = await loadPuzzleView(puzzleViews[choice.family], generationLifetime.signal);
			if (generationLifetime.signal.aborted) return;
			if (screen === 'game') {
				round = null;
				View = null;
				checkpointReader = null;
				await tick();
			}
			family = choice.family;
			variant = puzzleVariant(choice.family, choice.variant)?.id;
			round = restored;
			View = view;
			resolvedTheme = theme;
			scoring = config;
			bests = { ...bests, [family]: loadBestScore(bestKey(), scoring.version) };
			roundId = choice.id;
			roundOwner = account.ownerKey;
			rankedSession = checkpoint ? checkpoint.rankedSession : choice.id;
			rankedStartedAt = checkpoint
				? rankedSession && checkpoint.state.clockStarted
					? Math.floor(checkpoint.savedAt - checkpoint.state.elapsedMs)
					: checkpoint.rankedStartedAt
				: 'startedAt' in choice
					? choice.startedAt
					: null;
			rankedRound = Boolean(rankedSession);
			runMoves = moves.slice();
			checkpointSavedAt = checkpoint?.savedAt;
			resumeState = checkpoint?.state ?? {
				phase: 'playing',
				elapsedMs: 0,
				clockStarted: true,
				pending: {}
			};
			roundNumber++;
			result = null;
			ending = null;
			screen = 'game';
			revealed = true;
			cardPhase = 'arriving';
			cardReady = true;
			resumeChoice = null;
			startError = false;
			void preparation.warm(getSelector().peek());
			await tick();
			restoring = false;
			await checkpointRound();
		} catch (error) {
			console.warn('morphi:checkpoint_resume_failed');
			resumeError = true;
			// Bad local replay data must not trap the player in a retry loop.
			if (
				error instanceof RangeError ||
				error instanceof TypeError ||
				(error instanceof Error &&
					['checkpoint_theme', 'checkpoint_version', 'checkpoint_moves'].includes(error.message))
			)
				resumeInvalid = true;
			checkpointLease?.release();
		} finally {
			restoring = false;
			starting = false;
		}
	}
	async function abandonAndNew(): Promise<void> {
		const choice = resumeChoice;
		if (!choice || starting) return;
		starting = true;
		try {
			const session = 'moves' in choice ? choice.rankedSession : choice.id;
			if (session && account.ownerKey) await abandonSession(session, account.ownerKey);
			if (!(await ownCheckpoint(choice.id, true))) return;
			await clearCheckpoint(account.ownerKey, choice.id);
			console.info(
				JSON.stringify({ event: 'round_abandoned', family: choice.family, reason: 'new_puzzle' })
			);
			if (account.ownerKey)
				void reportAccountRound(
					'abandon',
					account.ownerKey,
					choice.id,
					choice.family,
					session,
					choice.variant
				);
			resumeChoice = null;
			resumeInvalid = false;
			resumeError = false;
			roundLocked = false;
		} catch {
			resumeError = true;
		} finally {
			starting = false;
		}
		if (!resumeChoice) startRound();
	}
	function takeOverRound(): void {
		if (resumeChoice) {
			void resumeRound(true);
			return;
		}
		void loadCheckpoint(account.ownerKey, true)
			.then((checkpoint) => {
				if (!checkpoint) {
					resumeError = true;
					return;
				}
				resumeChoice = checkpoint;
				if (checkpoint.id !== roundId) {
					roundLocked = false;
					return;
				}
				return resumeRound(true);
			})
			.catch(() => {
				resumeError = true;
			});
	}

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
		nextVariant: string | undefined,
		rankedGate: Promise<void>,
		takeoverSession?: string
	) {
		const view = await loadPuzzleView(puzzleViews[chosen], generationLifetime.signal);
		if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
		let seed = randomSeed();
		let nextTheme: ResolvedTheme | null = null;
		let nextScoring = defaultScoreConfig(chosen, nextVariant);
		let nextRunId: string = crypto.randomUUID();
		const nextOwner = account.ownerKey;
		let nextSession: string | null = null;
		let nextStartedAt: number | null = null;
		if (nextOwner) {
			await rankedGate;
			if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
			try {
				const issued = await startSession(chosen, nextOwner, takeoverSession, nextVariant);
				seed = issued.seed;
				nextTheme = issued.theme;
				nextScoring = issued.scoring;
				nextRunId = issued.id;
				nextSession = issued.id;
				nextStartedAt = issued.startedAt;
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
				const response = await fetch(
					resolve('/api/play/scoring') +
						'?' +
						new URLSearchParams({
							family: chosen,
							...(nextVariant ? { variant: nextVariant } : {})
						}),
					{
						signal: AbortSignal.timeout(3000)
					}
				);
				if (!response.ok) throw new Error('scoring_unavailable');
				const config: ScoreConfig = await response.json();
				nextScoring = {
					version: config.version,
					values: validateScoreValues(chosen, config.values, nextVariant)
				};
			} catch {
				console.warn('morphi:score_defaults_offline');
			}
		}
		if (accountsEnabled && !nextTheme) throw new Error('round_theme_missing');
		if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
		const nextRound =
			(nextVariant === undefined || nextVariant === puzzleMetadata[chosen].variants?.[0]?.id
				? candidate?.round
				: null) ??
			(await loadPuzzleModule(puzzlePools[chosen], generationLifetime.signal)).manifest.createRound(
				seed,
				nextVariant
			);
		if (generationLifetime.signal.aborted) throw new Error('round_cancelled');

		return {
			chosen,
			nextVariant,
			nextRound,
			nextView: view,
			nextTheme,
			nextOwner,
			nextSession,
			nextStartedAt,
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
			availableVariants = data.variants;
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
	async function assertGameAvailable(
		chosen: PuzzleFamily,
		selectedVariant?: string
	): Promise<void> {
		if (!accountsEnabled) return;
		const response = await fetch(
			resolve('/api/play/availability') +
				'?' +
				new URLSearchParams({
					family: chosen,
					...(selectedVariant ? { variant: selectedVariant } : {})
				}),
			{
				signal: AbortSignal.timeout(3000),
				cache: 'no-store'
			}
		);
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
			const chosenVariant = getSelector().peekVariant(
				chosen,
				puzzleMetadata[chosen].variants,
				availableVariants[chosen] ?? []
			);
			startErrorFamily = chosen;
			await assertGameAvailable(chosen, chosenVariant);
			let ready = false;
			const rankedGate = new Promise<void>((resolveGate) => {
				releaseRanked = resolveGate;
			});
			const work = makeCandidate(chosen, chosenVariant, rankedGate, takeoverSession).then(
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
			const {
				nextRound,
				nextView,
				nextTheme,
				nextOwner,
				nextSession,
				nextStartedAt,
				nextRunId,
				nextScoring
			} = prepared.value;
			if (generationLifetime.signal.aborted) return;
			if (!nextSession) await assertGameAvailable(chosen, chosenVariant);
			await ownCheckpoint(nextRunId);
			if (generationLifetime.signal.aborted) return;
			// Commit rotation only after generation succeeds. Retry keeps the same family.
			getSelector().commitVariant(chosen, chosenVariant);
			getSelector().next();
			family = chosen;
			variant = chosenVariant;
			round = nextRound;
			View = nextView;
			resolvedTheme = nextTheme;
			scoring = nextScoring;
			bests = {
				...bests,
				[chosen]: loadBestScore(bestKey(chosen, chosenVariant), scoring.version)
			};
			roundId = nextRunId;
			roundOwner = nextOwner;
			rankedSession = nextSession;
			rankedStartedAt = nextStartedAt;
			resumeState = undefined;
			checkpointSavedAt = undefined;
			checkpointReader = null;
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
			reportPresented();
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

	function bestKey(game = family, roundVariant = variant) {
		return roundVariant && roundVariant !== puzzleMetadata[game].variants?.[0]?.id
			? roundVariant
			: game;
	}
	function recordResult({
		score,
		title,
		summary,
		announcement,
		stats,
		endingValues,
		ending: resultEnding,
		cap = false
	}: PuzzleResult): void {
		const game = family;
		const previousBest = bests[game];
		const isNewBest = score > previousBest;
		const gap = Math.max(0, previousBest - score);
		const isSoClose = !isNewBest && previousBest > 0 && gap > 0 && gap <= 250;

		if (isNewBest) {
			bests = { ...bests, [game]: score };
			saveBestScore(score, bestKey(game), scoring.version);
		}

		resultAnnouncement = announcement;
		const endingSpec = puzzleVariant(game, variant)?.ending ?? puzzleMetadata[game].ending;
		ending = resultEnding ?? {
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
					family: familyName(game, variant),
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
		// Keep the final accepted move recoverable while the completed-run queue commits.
		const checkpointed = checkpointRound();
		completedQueuedId = roundId;
		measure('round_completed', family);
		markFamilyPlayed(family);
		played[family] = true;
		if (score > bests[family]) saveBestScore(score, bestKey(), scoring.version);
		// The policy-only guest release keeps the existing best/settings behavior;
		// recording account-importable replays belongs to the later account release.
		if (!accountsEnabled) {
			void clearCheckpoint(roundOwner, roundId);
			return;
		}
		const seed = round!.seed;
		const run: CompletedRun = {
			scoreConfigVersion: scoring.version,
			version: 1,
			id: roundId,
			family,
			...(variant ? { variant } : {}),
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
		completionQueued = checkpointed
			.then(() =>
				enqueue({
					id: run.id,
					owner,
					run,
					attempts: 0,
					retryAt: 0,
					...(resolvedTheme ? { resolvedTheme } : {})
				})
			)
			.then(async (durable) => {
				if (durable) await clearCheckpoint(owner, run.id);
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

	/** Budget run-over: no result is saved; abandon the issued session by exact id, then deal again. */
	async function tryAnother(): Promise<void> {
		if (screen !== 'game' || starting) return;
		if (roundOwner && rankedSession)
			await abandonSession(rankedSession, roundOwner).catch(() =>
				console.warn('morphi:ranked_abandon_failed')
			);
		reportAbandon();
		console.info(JSON.stringify({ event: 'round_abandoned', family, reason: 'run_over' }));
		await clearCheckpoint(roundOwner, roundId);
		stage?.stop();
		round = null;
		View = null;
		checkpointReader = null;
		cardReady = false;
		revealed = false;
		screen = 'home';
		startRound();
	}

	function goHome(): void {
		if (screen === 'game' && completedQueuedId !== roundId && roundOwner && rankedSession) {
			void abandonSession(rankedSession, roundOwner).catch(() =>
				console.warn('morphi:ranked_abandon_failed')
			);
		}
		reportAbandon();
		if (screen === 'game' && completedQueuedId !== roundId) {
			console.info(JSON.stringify({ event: 'round_abandoned', family, reason: 'home' }));
			void clearCheckpoint(roundOwner, roundId);
		}
		checkpointLease?.release();
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
	inert={roundLocked || Boolean(resumeChoice) || resumeError || (starting && screen === 'game')}
	data-family={family}
	data-variant={variant}
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
			? familyName(family, variant)
			: ''}
		gameMode
	/>
	<RoundStage
		bind:this={stage}
		phase={cardPhase}
		title={familyName(family, variant)}
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
					paused={helpOpen ||
						!cardReady ||
						roundLocked ||
						starting ||
						Boolean(resumeChoice) ||
						resumeError}
					{soundEnabled}
					{rankedRound}
					ontogglesound={toggleSound}
					onfinish={recordResult}
					onhome={goHome}
					ontryanother={() => void tryAnother()}
					resume={resumeState}
					{checkpointSavedAt}
					{rankedStartedAt}
					registerCheckpoint={(read) => {
						checkpointReader = read;
						if (!resumeState) void checkpointRound();
					}}
					onmove={checkpointMove}
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
					{variant}
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
					{variant}
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
{#if resumeChoice || roundLocked || resumeError}
	<aside class="ranked-conflict" aria-live="polite" aria-labelledby="resume-title">
		<h2 id="resume-title">{t(roundLocked ? 'resume.locked' : 'resume.title')}</h2>
		{#if resumeInvalid}<p>{t('resume.unavailable')}</p>{/if}
		{#if resumeError}<p role="alert">{t('resume.failed')}</p>{/if}
		{#if roundLocked}<button type="button" disabled={starting} onclick={takeOverRound}
				>{t('resume.takeover')}</button
			>
		{:else if resumeChoice && !resumeInvalid}<button
				type="button"
				disabled={starting}
				onclick={() => void resumeRound()}>{t('resume.action')}</button
			>{/if}
		{#if resumeChoice}<button type="button" disabled={starting} onclick={() => void abandonAndNew()}
				>{t('resume.new')}</button
			>
		{:else if resumeError}<button
				type="button"
				disabled={starting}
				onclick={() => {
					resumeError = false;
					void restoreChoice().catch(() => {
						resumeError = true;
					});
				}}>{t('ranked.retry')}</button
			>{/if}
		<button type="button" onclick={goHome}>{t('ranked.keepCurrent')}</button>
	</aside>
{/if}
{#if storageNotice || lockNotice}<p class="storage-notice" role="status">
		{t(storageNotice ? 'resume.storage' : 'resume.lockUnavailable')}
	</p>{/if}
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

	.storage-notice {
		position: fixed;
		bottom: 72px;
		left: 16px;
		right: 16px;
		z-index: 45;
		text-align: center;
		background: var(--surface);
		color: var(--ink);
		padding: 12px;
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
