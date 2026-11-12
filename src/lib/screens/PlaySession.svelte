<script lang="ts">
	import {
		defaultScoreConfig,
		puzzleVariant,
		validateScoreValues,
		type ScoreConfig
	} from '#lib/scoring.js';
	import { measure } from '#lib/ui/measurement.js';
	import { familyName, roundRuleLine } from '#lib/ui/puzzle-presentation.js';
	import type { DailyIssued } from '#lib/server/daily.js';
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
	import { deserialize } from '$app/forms';
	import { resolve } from '$app/paths';
	import { createRng } from '#lib/engine/rng.js';
	import { puzzleViews, puzzlePools, puzzleStages, type PuzzleStage } from '#lib/registry.js';
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
		summary: string;
		stats: { label: string; value: string }[];
	}

	let cardPhase = $state<CardPhase>('waiting');
	let cardReady = $state(false);
	let revealed = $state(false);
	let stage: RoundStage;
	let Stage = $state<PuzzleStage>(RoundStage);
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
	let dailyRound = $state<DailyIssued | null>(null);
	let streak = $state(0);
	const ruleLine = $derived(dailyRound?.roundRuleLine ?? roundRuleLine(family, variant));
	type DailyActive = DailyIssued & { saving: boolean };
	type ResumeChoice = RoundCheckpoint | ResumableRankedSession | DailyActive;
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
	let resumeChoice = $state<ResumeChoice | null>(null);
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
		if (saved.ranked && dailyRound) void refreshStreak();
	}
	async function refreshStreak() {
		if (!account.ownerKey) return;
		try {
			const value = await pageAction<{ current: number }>('streak', { ownerKey: account.ownerKey });
			if (Number.isSafeInteger(value.current) && value.current >= 0) streak = value.current;
		} catch {
			/* Board/account views can refresh the count after an offline save. */
		}
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

	async function pageAction<T>(
		action: 'daily' | 'scoring' | 'streak',
		body: Record<string, unknown>
	): Promise<T> {
		const form = new FormData();
		form.set('payload', JSON.stringify(body));
		const response = await fetch(resolve('/leaderboard') + `?/${action}`, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { Accept: 'application/json', 'x-sveltekit-action': 'true' },
			body: form,
			signal: AbortSignal.timeout(8000)
		});
		const result = deserialize(await response.text());
		if (result.type === 'success') return result.data as T;
		const failure =
			result.type === 'failure'
				? (result.data as { code?: string; active?: ActiveRankedSession })
				: null;
		if (
			failure?.code === 'ranked_active' &&
			failure.active &&
			typeof failure.active.id === 'string' &&
			typeof failure.active.saving === 'boolean' &&
			Number.isSafeInteger(failure.active.expiresAt)
		)
			throw new RankedSessionConflict(failure.active);
		throw new Error(failure?.code ?? 'daily_unavailable');
	}
	function anonymousRound(value: PuzzleRound) {
		const { variant: identity, ...round } = value as PuzzleRound & {
			rules?: Record<string, number | boolean>;
		};
		void identity;
		return { ...round, rules: (value as { rules?: Record<string, number | boolean> }).rules ?? {} };
	}
	function validDaily(value: unknown): DailyActive {
		if (!value || typeof value !== 'object') throw new Error('daily_response');
		const issued = value as DailyActive;
		if (
			issued.daily !== true ||
			'variant' in issued ||
			!Object.hasOwn(puzzleMetadata, issued.family) ||
			typeof issued.id !== 'string' ||
			typeof issued.seed !== 'string' ||
			!/^(0|[1-9]\d{0,19})$/.test(issued.seed) ||
			BigInt(issued.seed) > 18446744073709551615n ||
			issued.engineVersion !== puzzleMetadata[issued.family].engineVersion ||
			!Number.isSafeInteger(issued.startedAt) ||
			!Number.isSafeInteger(issued.expiresAt) ||
			typeof issued.date !== 'string' ||
			!/^\d{4}-\d{2}-\d{2}$/.test(issued.date) ||
			typeof issued.roundRuleLine !== 'string' ||
			!issued.round ||
			'variant' in issued.round ||
			issued.round.seed !== issued.seed ||
			!issued.round.rules ||
			typeof issued.round.rules !== 'object' ||
			Array.isArray(issued.round.rules) ||
			!Object.values(issued.round.rules).every(
				(value) =>
					typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
			) ||
			!issued.scoring ||
			typeof issued.scoring.version !== 'string' ||
			!issued.scoring.values ||
			!Object.values(issued.scoring.values).every(
				(value) => typeof value === 'number' && Number.isFinite(value)
			) ||
			!issued.help ||
			!Array.isArray(issued.help.steps) ||
			!Array.isArray(issued.help.rows) ||
			!issued.theme ||
			issued.theme.family !== issued.family ||
			issued.theme.seed !== issued.seed ||
			paletteIssues(issued.theme).length
		)
			throw new Error('daily_response');
		return { ...issued, saving: Boolean(issued.saving) };
	}
	function dailySnapshot(choice: ResumeChoice): DailyIssued | null {
		if ('daily' in choice && choice.daily === true) return validDaily(choice);
		if ('daily' in choice && choice.daily && typeof choice.daily === 'object')
			return validDaily(choice.daily);
		return null;
	}
	function sameFields(left: Record<string, unknown>, right: Record<string, unknown>) {
		const keys = Object.keys(left);
		return (
			keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key])
		);
	}
	function matchesIssued(
		checkpoint: RoundCheckpoint,
		issued: ResumableRankedSession | DailyActive
	) {
		const daily = dailySnapshot(checkpoint);
		if (!('daily' in issued) || !issued.daily)
			return !daily && checkpointMatchesIssued(checkpoint, issued);
		return Boolean(
			daily &&
			checkpoint.id === issued.id &&
			checkpoint.rankedSession === issued.id &&
			checkpoint.family === issued.family &&
			checkpoint.seed === issued.seed &&
			checkpoint.engineVersion === issued.engineVersion &&
			checkpoint.scoring.version === issued.scoring.version &&
			sameFields(checkpoint.scoring.values, issued.scoring.values) &&
			sameFields(daily.round.rules, issued.round.rules)
		);
	}
	async function readActiveSession(
		owner: string
	): Promise<ActiveRankedSession | ResumableRankedSession | DailyActive | null> {
		const response = await fetch(
			resolve('/api/play/active') + '?' + new URLSearchParams({ ownerKey: owner }),
			{ cache: 'no-store', signal: AbortSignal.timeout(8000) }
		);
		if (!response.ok) throw new Error('ranked_resume_unavailable');
		const value: unknown = await response.json();
		if (value === null) return null;
		if (value && typeof value === 'object' && 'daily' in value && value.daily === true)
			return validDaily(value);
		return activeSession(owner);
	}
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
		void refreshStreak();
		const checkpoint = await loadCheckpoint(account.ownerKey);
		storageNotice = !checkpointDurable;
		let active: ActiveRankedSession | ResumableRankedSession | DailyActive | null = null;
		if (account.ownerKey) {
			try {
				active = await readActiveSession(account.ownerKey);
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
			if (checkpoint?.rankedSession === active.id && !matchesIssued(checkpoint, active))
				console.warn('morphi:checkpoint_identity_mismatch');
			resumeChoice = checkpoint && matchesIssued(checkpoint, active) ? checkpoint : active;
		} else if (checkpoint) {
			// A released/expired ranked checkpoint may still continue locally, without a ranked claim.
			resumeChoice = { ...checkpoint, rankedSession: null, rankedStartedAt: null };
			// Anonymous daily replay requires the authoritative live session.
			resumeInvalid = Boolean(dailySnapshot(checkpoint));
		}
		if (resumeChoice) {
			resumeInvalid =
				resumeInvalid ||
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
						'variant' in resumeChoice ? resumeChoice.variant : undefined
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
			const checkpoint: RoundCheckpoint & { daily?: DailyIssued } = {
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
				rankedStartedAt,
				...(dailyRound ? { daily: dailyRound } : {})
			};
			await saveCheckpoint(checkpoint, checkpointLease);
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
				const active = await readActiveSession(account.ownerKey);
				if (!active || active.id !== choice.id || active.saving)
					throw new Error('ranked_resume_unavailable');
				if (!('family' in active)) {
					resumeInvalid = true;
					checkpointLease?.release();
					return;
				}
				if ('moves' in choice && !matchesIssued(choice, active)) {
					console.warn('morphi:checkpoint_identity_mismatch');
					choice = active;
				}
			}
			if (!puzzleMetadata[choice.family].variants?.length) await assertGameAvailable(choice.family);
			const module = await loadPuzzleModule(puzzlePools[choice.family], generationLifetime.signal);
			const checkpoint = 'moves' in choice ? choice : null;
			let issuedDaily = dailySnapshot(choice);
			const config = choice.scoring;
			const choiceVariant = 'variant' in choice ? choice.variant : undefined;
			if (!issuedDaily) {
				validateScoreValues(choice.family, config.values, choiceVariant);
				if (
					config.version !== defaultScoreConfig(choice.family, choiceVariant).version &&
					!/^[0-9a-f-]{36}$/.test(config.version)
				)
					throw new Error('checkpoint_version');
			}
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
			let restored: PuzzleRound;
			if (issuedDaily) {
				if (!account.ownerKey || (checkpoint && !checkpoint.rankedSession))
					throw new Error('checkpoint_version');
				issuedDaily = validDaily(
					await pageAction('daily', {
						family: choice.family,
						ownerKey: account.ownerKey,
						sessionId: choice.id,
						resumeMoves: moves
					})
				);
				if (
					issuedDaily.id !== choice.id ||
					issuedDaily.family !== choice.family ||
					issuedDaily.engineVersion !== choice.engineVersion ||
					issuedDaily.seed !== choice.seed ||
					issuedDaily.scoring.version !== config.version ||
					!sameFields(issuedDaily.scoring.values, config.values) ||
					!sameFields(issuedDaily.round.rules, dailySnapshot(choice)!.round.rules)
				)
					throw new Error('checkpoint_version');
				restored = issuedDaily.round;
			} else {
				if (!module.manifest.resumeRound) throw new Error('checkpoint_version');
				restored = anonymousRound(
					module.manifest.resumeRound(choice.seed, moves, config.values, choiceVariant)
				);
			}
			const nextStage = await loadStage(choice.family);
			const view = await loadPuzzleView(puzzleViews[choice.family], generationLifetime.signal);
			if (generationLifetime.signal.aborted) return;
			if (screen === 'game') {
				round = null;
				View = null;
				checkpointReader = null;
				await tick();
			}
			family = choice.family;
			variant = issuedDaily ? undefined : puzzleVariant(choice.family, choiceVariant)?.id;
			dailyRound = issuedDaily;
			round = restored;
			View = view;
			Stage = nextStage;
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
			if (!account.ownerKey) void preparation.warm(getSelector().peek());
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
					'variant' in choice ? choice.variant : undefined
				);
			resumeChoice = null;
			resumeInvalid = false;
			resumeError = false;
			dailyRound = null;
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
	async function loadStage(chosen: PuzzleFamily): Promise<PuzzleStage> {
		const load = puzzleStages[chosen];
		return load ? (await loadPuzzleModule(load, generationLifetime.signal)).default : RoundStage;
	}
	async function makeCandidate(
		chosen: PuzzleFamily,
		rankedGate: Promise<void>,
		takeoverSession?: string
	) {
		const [nextStage, view] = await Promise.all([
			loadStage(chosen),
			loadPuzzleView(puzzleViews[chosen], generationLifetime.signal)
		]);
		if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
		const nextOwner = account.ownerKey;
		let nextDaily: DailyIssued | null = null;
		if (nextOwner) {
			await rankedGate;
			if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
			if (takeoverSession) await abandonSession(takeoverSession, nextOwner);
			try {
				nextDaily = validDaily(await pageAction('daily', { family: chosen, ownerKey: nextOwner }));
				if (nextDaily.family !== chosen) throw new Error('daily_response');
			} catch (error) {
				if (
					error instanceof RankedSessionConflict ||
					(error instanceof Error && error.message === 'game_disabled')
				)
					throw error;
				if (!(error instanceof Error && error.message === 'daily_spent'))
					console.warn('morphi:daily_start_unavailable');
			}
		}
		if (nextDaily) {
			preparation.clear();
			return {
				chosen,
				nextVariant: undefined,
				nextDaily,
				nextRound: nextDaily.round,
				nextView: view,
				nextStage,
				nextTheme: nextDaily.theme,
				nextOwner,
				nextSession: nextDaily.id,
				nextStartedAt: nextDaily.startedAt,
				nextRunId: nextDaily.id,
				nextScoring: nextDaily.scoring
			};
		}
		// Only practice consults the internal variant selector.
		const nextVariant = getSelector().peekVariant(
			chosen,
			puzzleMetadata[chosen].variants,
			availableVariants[chosen] ?? []
		);
		let candidate = await preparation.take(chosen);
		if (!candidate) candidate = await preparation.take(chosen);
		if (!candidate) throw new Error('round_preparation_failed');
		let nextScoring = defaultScoreConfig(chosen, nextVariant);
		if (accountsEnabled) {
			try {
				const config = await pageAction<ScoreConfig>('scoring', {
					family: chosen,
					...(nextVariant ? { variant: nextVariant } : {})
				});
				nextScoring = {
					version: config.version,
					values: validateScoreValues(chosen, config.values, nextVariant)
				};
			} catch {
				console.warn('morphi:score_defaults_offline');
			}
		}
		if (accountsEnabled && !candidate.theme) throw new Error('round_theme_missing');
		if (generationLifetime.signal.aborted) throw new Error('round_cancelled');
		const raw =
			(nextVariant === undefined || nextVariant === puzzleMetadata[chosen].variants?.[0]?.id
				? candidate.round
				: null) ??
			(await loadPuzzleModule(puzzlePools[chosen], generationLifetime.signal)).manifest.createRound(
				candidate.seed,
				nextVariant
			);
		const nextRound = anonymousRound(raw);
		return {
			chosen,
			nextVariant,
			nextDaily: null,
			nextRound,
			nextView: view,
			nextStage,
			nextTheme: candidate.theme,
			nextOwner,
			nextSession: null,
			nextStartedAt: null,
			nextRunId: crypto.randomUUID(),
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
	async function assertGameAvailable(chosen: PuzzleFamily): Promise<void> {
		if (!accountsEnabled) return;
		const response = await fetch(
			resolve('/api/play/availability') + '?' + new URLSearchParams({ family: chosen }),
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
		if (
			screen === 'game' ||
			starting ||
			(screen === 'result' && cardPhase !== 'result' && cardPhase !== 'failed')
		)
			return;
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
			const {
				nextRound,
				nextView,
				nextStage,
				nextTheme,
				nextOwner,
				nextSession,
				nextStartedAt,
				nextRunId,
				nextScoring,
				nextVariant: chosenVariant,
				nextDaily
			} = prepared.value;
			if (generationLifetime.signal.aborted) return;
			if (!nextSession) await assertGameAvailable(chosen);
			await ownCheckpoint(nextRunId);
			if (generationLifetime.signal.aborted) return;
			// Commit rotation only after generation succeeds. Retry keeps the same family.
			if (!nextDaily) getSelector().commitVariant(chosen, chosenVariant);
			getSelector().next();
			family = chosen;
			variant = chosenVariant;
			dailyRound = nextDaily;
			round = nextRound;
			View = nextView;
			Stage = nextStage;
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
			if (!account.ownerKey) void preparation.warm(getSelector().peek());
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
			cardPhase = 'failed';
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
		const endingSpec =
			dailyRound?.ending ?? puzzleVariant(game, variant)?.ending ?? puzzleMetadata[game].ending;
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
	{#if revealed && screen === 'game' && ruleLine}<p class="entrance-rule">{ruleLine}</p>{/if}
	<Stage
		bind:this={stage}
		phase={cardPhase}
		title={familyName(family)}
		best={result?.best ?? bests[family]}
		ready={cardReady && screen === 'game'}
		failed={startError}
		{stack}
		{playedCount}
		onretry={() => startRound()}
		footerContent={roundFooter}
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
					{ruleLine}
					{streak}
					stats={result.stats}
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
	</Stage>
	{#if Stage === RoundStage}<footer class="round-panel">
			<div class="round-panel-inner">{@render roundFooter()}</div>
		</footer>{/if}
</div>
{#snippet roundFooter()}
	{#if revealed}<PuzzleHelp
			{family}
			{variant}
			help={dailyRound?.help}
			{ruleLine}
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
{/snippet}
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
<p class="sr-only" aria-live="polite" aria-atomic="true">{resultAnnouncement}</p>

<style>
	.entrance-rule {
		position: absolute;
		top: var(--game-header-height);
		left: 50%;
		transform: translateX(-50%);
		width: max-content;
		z-index: 2;
		max-width: min(760px, calc(100vw - 32px));
		margin: 0 auto;
		padding: 2px 8px;
		border-radius: 8px;
		background: var(--surface);
		color: var(--ink);
		font-size: 12px;
		line-height: 1.3;
		text-align: center;
	}
	@media (orientation: landscape) and (max-height: 560px) {
		.entrance-rule {
			line-height: 1.2;
		}
	}
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
</style>
