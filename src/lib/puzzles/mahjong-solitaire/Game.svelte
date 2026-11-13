<script module lang="ts">
	let tripleCoachSeen = false;
</script>

<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle } from '#lib/engine/theme/style.js';
	import { t } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { sound } from '#lib/ui/sound.js';
	import { MAHJONG_ENTRANCE_MS } from '#lib/round-timing.js';
	import { mahjongEnter } from './motion.js';
	import { scoring as defaultScoring } from './scoring.js';
	import {
		applyMahjongMove,
		mahjongFreeTiles,
		mahjongHint,
		mahjongMatches,
		mahjongRemainingMs,
		mahjongScore,
		MAHJONG_ACTION,
		type MahjongMove,
		type MahjongRound
	} from './logic.js';

	let {
		round,
		roundNumber,
		scoring = defaultScoring.defaults,
		resolvedTheme = null,
		paused = false,
		rankedRound = false,
		entranceReady = true,
		resume,
		rankedStartedAt = null,
		registerCheckpoint,
		onready = () => {},
		onmove = () => {},
		oncomplete = () => {},
		onfinish,
		onhome,
		ontryanother
	}: {
		round: MahjongRound;
		roundNumber: number;
		scoring?: ScoreValues;
		resolvedTheme?: ResolvedTheme | null;
		paused?: boolean;
		rankedRound?: boolean;
		entranceReady?: boolean;
		resume?: CheckpointState;
		rankedStartedAt?: number | null;
		registerCheckpoint?: (read: () => CheckpointState) => void;
		onready?: () => void;
		onmove?: (move: MahjongMove) => void;
		oncomplete?: (score: number, seconds: number) => void;
		onfinish: (
			score: number,
			seconds: number,
			pairs: number,
			hints: number,
			shuffles: number
		) => void;
		onhome: () => void;
		ontryanother?: () => void;
	} = $props();
	// svelte-ignore state_referenced_locally
	let game = $state(round);
	let phase = $state<'arrival' | 'playing' | 'finished' | 'failed'>('arrival');
	let selected = $state<number[]>([]);
	let cursor = $state(-1);
	let ghosts = $state<number[]>([]);
	let elapsed = $state(0);
	let activeMs = $state(0);
	let showTripleCoach = $state(false);
	let newlyFree = $state<number[]>([]);
	let announcement = $state('');
	let mounted = $state(false);
	let zoom = $state(1);
	let board: SVGSVGElement;
	let viewport: HTMLDivElement;
	let entered = false;
	let disposed = false;
	let clockBase = 0;
	let clockStart: number | null = null;
	let rankedStart: number | null = null;
	let ticker: ReturnType<typeof setInterval> | null = null;
	let entrance: ReturnType<typeof mahjongEnter> | null = null;
	let feedback: ReturnType<typeof mahjongEnter>[] = [];
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
	let motionFailed = false;
	let drag: { id: number; x: number; y: number; left: number; top: number } | null = null;
	let dragged = false;
	const free = $derived(mahjongFreeTiles(game));
	const hint = $derived(mahjongHint(game));
	const remaining = $derived(
		Math.max(0, Math.ceil(mahjongRemainingMs(game, Math.max(game.lastAt, activeMs)) / 1000))
	);
	const locked = $derived(phase !== 'playing' || game.status !== 'playing' || paused);
	const tiles = $derived([...game.tiles].sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x));
	const width = $derived(game.layout.width * 50 + 12);
	const height = $derived(game.layout.height * 60 + 16);
	const entranceDelay = createActiveDelay(() =>
		guard(() => {
			present(() => entrance?.settle());
			phase = 'playing';
			onready();
			markCoach();
			startClock();
		})
	);
	const finishDelay = createActiveDelay(() =>
		guard(() =>
			onfinish(
				mahjongScore(game, elapsed, scoring),
				elapsed,
				game.removals,
				game.hintsUsed,
				game.shufflesUsed
			)
		)
	);

	function guard(action: () => void) {
		if (disposed) return;
		try {
			action();
		} catch {
			phase = 'failed';
			pauseClock();
			console.error('morphi:mahjong_action_failed');
		}
	}
	function present(action: () => void) {
		if (motionFailed) return;
		try {
			action();
		} catch {
			motionFailed = true;
			for (const clip of [...feedback, ...(entrance ? [entrance] : [])]) {
				try {
					clip.destroy();
				} catch {
					console.warn('morphi:mahjong_motion_cleanup_unavailable');
				}
			}
			feedback = [];
			entrance = null;
			for (const node of board.querySelectorAll<SVGGElement>('.tile-motion')) {
				node.style.removeProperty('opacity');
				node.style.removeProperty('transform');
			}
			board.dataset.motionReady = 'true';
			ghosts = [];
			console.warn('morphi:mahjong_motion_unavailable');
		}
	}
	function clockMs() {
		return rankedRound
			? rankedStart === null
				? clockBase
				: Math.max(clockBase, performance.now() - rankedStart)
			: clockBase + (clockStart === null ? 0 : performance.now() - clockStart);
	}
	function startClock() {
		rankedStart ??= performance.now() - clockBase;
		clockStart ??= performance.now();
		updateClock();
		if (game.status === 'playing') ticker ??= setInterval(() => guard(updateClock), 250);
	}
	function updateClock() {
		activeMs = Math.max(game.lastAt, Math.floor(clockMs()));
		elapsed = Math.floor(activeMs / 1000);
		if (
			phase === 'playing' &&
			game.status === 'playing' &&
			game.rules.timeLimit > 0 &&
			remaining === 0 &&
			!paused &&
			!document.hidden
		)
			perform({ action: MAHJONG_ACTION.tick });
	}
	function markCoach() {
		if (!showTripleCoach) return;
		tripleCoachSeen = true;
		try {
			localStorage.setItem('morphi.mahjong.triple.coachSeen', '1');
		} catch {
			console.warn('morphi:mahjong_coach_storage_unavailable');
		}
	}
	function pauseClock() {
		if (clockStart !== null) {
			clockBase += performance.now() - clockStart;
			clockStart = null;
		}
		if (ticker !== null) clearInterval(ticker);
		ticker = null;
	}
	function clearFeedback() {
		for (const clip of feedback) present(() => clip.destroy());
		feedback = [];
		ghosts = [];
		newlyFree = [];
		if (feedbackTimer !== null) clearTimeout(feedbackTimer);
		feedbackTimer = null;
	}
	function showFeedback(
		kind: Parameters<typeof mahjongEnter>[1],
		ids: number[],
		offsets: Record<number, { x: number; y: number }> = {}
	) {
		void tick()
			.then(() =>
				guard(() =>
					present(() => {
						feedback.push(mahjongEnter(board, kind, ids, offsets));
						if (feedbackTimer !== null) clearTimeout(feedbackTimer);
						feedbackTimer = setTimeout(() => guard(clearFeedback), 550);
					})
				)
			)
			.catch(() =>
				present(() => {
					throw new Error('feedback');
				})
			);
	}
	function finish() {
		elapsed = Math.floor(clockMs() / 1000);
		pauseClock();
		phase = 'finished';
		selected = [];
		oncomplete(mahjongScore(game, elapsed, scoring), elapsed);
		announcement = t('mahjong.won');
		sound.play('win');
		showFeedback('win', []);
		finishDelay.start(500, document.hidden || paused);
	}
	function perform(move: MahjongMove) {
		if (locked || document.hidden) return;
		try {
			clearFeedback();
			const before = game;
			if (game.rules.timeLimit > 0)
				move = { ...move, at: Math.max(game.lastAt, Math.floor(clockMs())) };
			game = applyMahjongMove(before, move);
			onmove(move);
			selected = [];
			const removed = game.tiles
				.filter((tile) => tile.removed && !before.tiles[tile.id]!.removed)
				.map((tile) => tile.id);
			if (removed.length) {
				ghosts = removed;
				sound.play('place');
				showFeedback('remove', removed);
			} else if (game.lastMismatch.length) {
				announcement = t('mahjong.mismatch');
				sound.play('invalid');
				showFeedback('mistake', game.lastMismatch);
			} else if ('action' in move && move.action === MAHJONG_ACTION.hint) {
				announcement = t('mahjong.hinted');
				sound.play('pick');
				showFeedback('hint', game.lastHint);
			} else if (move.action !== MAHJONG_ACTION.tick) sound.play('clear');
			const offsets: Record<number, { x: number; y: number }> = {};
			for (const tile of game.tiles) {
				const previous = before.tiles[tile.id]!;
				if (!tile.removed && (tile.x !== previous.x || tile.y !== previous.y))
					offsets[tile.id] = { x: (previous.x - tile.x) * 50, y: (previous.y - tile.y) * 60 };
			}
			if (Object.keys(offsets).length)
				showFeedback('slide', Object.keys(offsets).map(Number), offsets);
			if (removed.length && game.rules.highlight) {
				const previousFree = mahjongFreeTiles(before);
				newlyFree = mahjongFreeTiles(game).filter((id) => !previousFree.includes(id));
				if (newlyFree.length) showFeedback('settle', newlyFree);
			}
			cursor = mahjongFreeTiles(game)[0] ?? -1;
			if (game.status === 'won') finish();
			else if (game.status === 'lost') {
				phase = 'finished';
				elapsed = Math.floor(clockMs() / 1000);
				pauseClock();
				announcement = t('mahjong.over');
				sound.play('invalid');
			} else if (mahjongHint(game).length === 0) announcement = t('mahjong.noMatch');
		} catch (error) {
			if (error instanceof RangeError) sound.play('invalid');
			else
				guard(() => {
					throw error;
				});
		}
	}
	function select(id: number) {
		if (locked || document.hidden || dragged || !free.includes(id)) return;
		cursor = id;
		if (game.tiles[id]!.faceDown) {
			perform({ tile: id });
			return;
		}
		if (selected.includes(id)) {
			selected = selected.filter((value) => value !== id);
			return;
		}
		const ids = [...selected, id];
		if (ids.length < game.rules.groupSize) {
			selected = ids;
			announcement = t('mahjong.selected');
			sound.play('pick');
			return;
		}
		if (mahjongMatches(game, ids))
			perform({
				tileA: ids[0]!,
				tileB: ids[1]!,
				...(game.rules.groupSize === 3 ? { tileC: ids[2]! } : {})
			});
		else {
			if (game.rules.hearts > 0) perform({ tileA: ids[0]!, tileB: ids[1]! });
			selected =
				game.status === 'playing' ? (game.rules.groupSize === 3 ? ids.slice(1) : [id]) : [];
			if (game.status === 'playing')
				announcement = t(
					game.rules.groupSize === 3 ? 'mahjong.tripleMismatch' : 'mahjong.mismatch'
				);
			if (game.rules.hearts === 0) {
				sound.play('invalid');
				showFeedback('mistake', ids);
			}
		}
	}
	function control(action: number) {
		guard(() => perform({ action }));
	}
	function focusTile(id: number) {
		cursor = id;
		board.querySelector<SVGGElement>(`.mahjong-tile[data-tile='${id}']`)?.focus();
	}
	function keyDown(event: KeyboardEvent, id: number) {
		dragged = false;
		if (event.key === 'Escape') {
			selected = [];
			return;
		}
		if (locked || event.altKey || event.metaKey || event.ctrlKey) return;
		const shortcut = (
			{
				h: MAHJONG_ACTION.hint,
				u: MAHJONG_ACTION.undo,
				s: MAHJONG_ACTION.shuffle,
				r: MAHJONG_ACTION.restart
			} as Record<string, number>
		)[event.key.toLowerCase()];
		if (shortcut) {
			event.preventDefault();
			if (!event.repeat) control(shortcut);
			return;
		}
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (!event.repeat) {
				select(id);
				if (game.tiles[id]?.removed && cursor >= 0)
					void tick().then(() =>
						guard(() => {
							if (board.contains(document.activeElement)) focusTile(cursor);
						})
					);
			}
			return;
		}
		const direction = (
			{ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<
				string,
				number[]
			>
		)[event.key];
		if (!direction) return;
		event.preventDefault();
		const current = game.tiles[id]!;
		const candidates = free
			.filter((value) => value !== id)
			.map((value) => {
				const tile = game.tiles[value]!;
				const dx = tile.x - current.x;
				const dy = tile.y - current.y;
				return {
					id: value,
					along: dx * direction[0]! + dy * direction[1]!,
					across: Math.abs(dx * direction[1]! + dy * direction[0]!)
				};
			})
			.filter((value) => value.along > 0)
			.sort((a, b) => a.along + a.across * 3 - b.along - b.across * 3);
		if (candidates[0]) focusTile(candidates[0].id);
	}
	const faceKeys = {
		C: 'mahjong.face.C',
		B: 'mahjong.face.B',
		K: 'mahjong.face.K',
		F: 'mahjong.face.F',
		S: 'mahjong.face.S',
		WE: 'mahjong.face.WE',
		WS: 'mahjong.face.WS',
		WW: 'mahjong.face.WW',
		WN: 'mahjong.face.WN',
		DR: 'mahjong.face.DR',
		DG: 'mahjong.face.DG',
		DW: 'mahjong.face.DW'
	} as const;
	function faceLabel(face: string) {
		const key = (/^[CBKFS]/.test(face) ? face[0] : face) as keyof typeof faceKeys;
		return t(faceKeys[key], {
			number: Number(face.slice(1))
		});
	}
	function pointerDown(event: PointerEvent) {
		dragged = false;
		if (zoom === 1 || event.button !== 0) return;
		drag = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			left: viewport.scrollLeft,
			top: viewport.scrollTop
		};
	}
	function pointerMove(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId) return;
		if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 6) {
			dragged = true;
			viewport.setPointerCapture(event.pointerId);
			viewport.scrollLeft = drag.left - event.clientX + drag.x;
			viewport.scrollTop = drag.top - event.clientY + drag.y;
		}
	}
	function pointerEnd() {
		drag = null;
	}
	function setZoom(value: number) {
		zoom = value;
		drag = null;
		void tick().then(() => {
			viewport.scrollLeft = 0;
			viewport.scrollTop = 0;
		});
	}
	function syncVisibility() {
		guard(() => {
			if (document.hidden || paused) {
				drag = null;
				entranceDelay.pause();
				finishDelay.pause();
				present(() => entrance?.pause());
				clearFeedback();
				if (!rankedRound) pauseClock();
			} else {
				entranceDelay.resume();
				finishDelay.resume();
				present(() => entrance?.resume());
				if (phase === 'playing') startClock();
			}
		});
	}
	$effect(() => {
		const value = paused;
		untrack(() => {
			if (mounted || value) syncVisibility();
		});
	});
	$effect(() => {
		if (!mounted || !entranceReady || entered) return;
		untrack(() =>
			guard(() => {
				entered = true;
				cursor = free[0] ?? -1;
				if (resume?.phase === 'playing' || resume?.phase === 'finished') {
					phase = game.status === 'playing' ? 'playing' : 'finished';
					board.dataset.motionReady = 'true';
					onready();
					markCoach();
					if (game.status === 'won') {
						oncomplete(mahjongScore(game, elapsed, scoring), elapsed);
						finishDelay.start(0, document.hidden || paused);
					} else if (game.status === 'lost') announcement = t('mahjong.over');
					else if (!(document.hidden || paused)) startClock();
					return;
				}
				present(() => {
					entrance = mahjongEnter(board);
				});
				sound.play('pick');
				entranceDelay.start(
					resume?.pending.entrance ?? MAHJONG_ENTRANCE_MS,
					document.hidden || paused
				);
			})
		);
	});
	onMount(() => {
		if (game.rules.groupSize === 3 && !tripleCoachSeen) {
			try {
				tripleCoachSeen = localStorage.getItem('morphi.mahjong.triple.coachSeen') === '1';
			} catch {
				console.warn('morphi:mahjong_coach_storage_unavailable');
			}
			showTripleCoach = !tripleCoachSeen;
		}
		if (resume) {
			clockBase = resume.elapsedMs;
			elapsed = Math.floor(clockBase / 1000);
			if (resume.clockStarted)
				rankedStart =
					performance.now() -
					(rankedRound && rankedStartedAt !== null
						? Math.max(resume.elapsedMs, Date.now() - rankedStartedAt)
						: resume.elapsedMs);
		}
		registerCheckpoint?.((): CheckpointState => ({
			phase,
			elapsedMs: clockMs(),
			clockStarted: rankedStart !== null,
			pending: entranceDelay.remaining() === null ? {} : { entrance: entranceDelay.remaining()! }
		}));
		mounted = true;
		const resize = () => {
			drag = null;
			clearFeedback();
		};
		document.addEventListener('visibilitychange', syncVisibility);
		window.addEventListener('blur', pointerEnd);
		window.addEventListener('resize', resize);
		return () => {
			disposed = true;
			document.removeEventListener('visibilitychange', syncVisibility);
			window.removeEventListener('blur', pointerEnd);
			window.removeEventListener('resize', resize);
			pauseClock();
			entranceDelay.cancel();
			finishDelay.cancel();
			present(() => entrance?.destroy());
			clearFeedback();
		};
	});
</script>

{#snippet faceArt(face: string)}
	{@const rank = Number(face.slice(1))}
	{#if face[0] === 'K'}
		<text x="50" y="43" text-anchor="middle" font-size="32" font-family="serif" fill="#172e27"
			>{['一', '二', '三', '四', '五', '六', '七', '八', '九'][rank - 1]}</text
		>
		<text x="50" y="84" text-anchor="middle" font-size="38" font-family="serif" fill="#b52d20"
			>萬</text
		>
	{:else if face[0] === 'C' && rank === 1}
		<circle cx="50" cy="55" r="28" fill="none" stroke="#125f45" stroke-width="5" />
		<circle cx="50" cy="55" r="18" fill="none" stroke="#2058a4" stroke-width="6" />
		<circle cx="50" cy="55" r="8" fill="#b52d20" />
		{#each [0, 1, 2, 3, 4, 5, 6, 7] as petal (petal)}<ellipse
				cx="50"
				cy="26"
				rx="4"
				ry="7"
				fill={petal % 2 ? '#2058a4' : '#b52d20'}
				transform={`rotate(${petal * 45} 50 55)`}
			/>{/each}
	{:else if face[0] === 'C' || face[0] === 'B'}
		{#each Array.from({ length: rank }, (_, i) => i) as i (i)}
			{@const columns = rank <= 3 ? 1 : rank <= 6 ? 2 : 3}
			{@const rows = Math.ceil(rank / columns)}
			{@const x = 50 + ((i % columns) - (columns - 1) / 2) * 24}
			{@const y = 55 + (Math.floor(i / columns) - (rows - 1) / 2) * 25}
			{#if face[0] === 'C'}<circle
					cx={x}
					cy={y}
					r="8"
					fill="none"
					stroke={['#165d40', '#ad2e1e', '#235da8'][i % 3]}
					stroke-width="4"
				/><circle cx={x} cy={y} r="2" fill={['#165d40', '#ad2e1e', '#235da8'][i % 3]} />
			{:else}<rect
					x={x - 4}
					y={y - 10}
					width="8"
					height="20"
					rx="4"
					fill={i === 4 ? '#b52d20' : '#206a43'}
				/><path d={`M${x - 4} ${y - 3}h8m-8 6h8`} stroke="#b1c78b" stroke-width="1.5" />{/if}
		{/each}
	{:else if face[0] === 'W' || face === 'DR' || face === 'DG'}
		<text
			x="50"
			y="78"
			text-anchor="middle"
			font-size="56"
			font-family="serif"
			font-weight="700"
			fill={face === 'DR' ? '#b52d20' : face === 'DG' ? '#176843' : '#162e26'}
			>{({ WE: '東', WS: '南', WW: '西', WN: '北', DR: '中', DG: '發' } as Record<string, string>)[
				face
			]}</text
		>
	{:else if face === 'DW'}<rect
			x="23"
			y="25"
			width="54"
			height="65"
			rx="2"
			fill="none"
			stroke="#255ba1"
			stroke-width="5"
		/><rect x="30" y="32" width="40" height="51" fill="none" stroke="#255ba1" stroke-width="2" />
	{:else}
		{#if face === 'F1'}
			<path
				d="M27 96 44 65 47 29M43 67 70 49M46 47 27 36"
				fill="none"
				stroke="#775039"
				stroke-width="4"
			/>
			{#each [[47, 29], [70, 49], [27, 36]] as flower, i (i)}
				<g transform={`translate(${flower[0]} ${flower[1]})`}>
					{#each [0, 1, 2, 3, 4] as petal (petal)}<ellipse
							cx="0"
							cy="-7"
							rx="6"
							ry="8"
							fill="#b74351"
							transform={`rotate(${petal * 72})`}
						/>{/each}
					<circle r="3" fill="#e4b94d" />
				</g>
			{/each}
		{:else if face === 'F2'}
			<path
				d="M46 98Q12 67 22 42Q42 60 46 98Q68 64 77 54Q75 82 46 98M46 98Q41 53 56 30"
				fill="#497c42"
				stroke="#2d643b"
				stroke-width="2"
			/>
			<path
				d="M56 42Q29 38 38 21Q54 20 58 35Q55 8 68 16Q81 28 63 39Q89 37 80 51Q68 58 58 44Q43 65 39 48Z"
				fill="#9781ae"
				stroke="#705d91"
				stroke-width="2"
			/>
			<path d="m52 40 9-5 3 12-8 2Z" fill="#b84b71" />
		{:else if face === 'F3'}
			<path
				d="M50 98V49M50 81Q24 85 25 65Q43 63 50 81M50 72Q77 76 76 55Q57 55 50 72"
				fill="#4f7840"
				stroke="#315a35"
				stroke-width="2"
			/>
			{#each Array.from({ length: 12 }, (_, i) => i) as petal (petal)}<ellipse
					cx="50"
					cy="23"
					rx="5"
					ry="20"
					fill={petal % 2 ? '#d89c2c' : '#e6b944'}
					transform={`rotate(${petal * 30} 50 43)`}
				/>{/each}
			<circle cx="50" cy="43" r="9" fill="#b97626" />
		{:else if face === 'F4'}
			<path d="M38 99V21M59 99 63 34" fill="none" stroke="#3a7540" stroke-width="7" />
			<path
				d="M32 42h12m-12 23h12m-12 22h12m12-32h12m-14 25h12"
				stroke="#b3bd6b"
				stroke-width="3"
			/>
			<path
				d="M38 45Q13 43 18 25Q32 27 38 45M40 65Q65 49 72 58Q57 69 40 65M62 51Q81 24 84 36Q83 48 62 51M59 82Q78 66 84 72Q76 84 59 82"
				fill="#286b40"
			/>
		{:else if face === 'S1'}
			<path
				d="M21 94Q58 79 71 25M49 72 29 54M61 51 83 39"
				fill="none"
				stroke="#6e6040"
				stroke-width="4"
			/>
			<path d="M50 73Q51 46 31 43Q28 61 50 73M64 49Q48 29 54 22Q69 25 64 49" fill="#719b57" />
			{#each [[72, 25], [28, 52], [82, 39]] as bud, i (i)}<path
					d="M0 10Q-20-1-8-10Q0-15 0-6Q12-18 16-7Q19 4 0 10"
					fill="#d995aa"
					transform={`translate(${bud[0]} ${bud[1]}) scale(.65)`}
				/>{/each}
		{:else if face === 'S2'}
			<ellipse cx="49" cy="85" rx="32" ry="12" fill="#3d8b68" />
			<path d="m49 85 25-8M50 85V48" fill="none" stroke="#245e4a" stroke-width="3" />
			<path
				d="M50 60Q21 53 21 30Q38 32 50 48Q38 25 50 13Q66 29 53 49Q67 28 80 30Q80 53 50 60Z"
				fill="#d9899c"
				stroke="#b76887"
				stroke-width="2"
			/>
			<path d="M50 59Q35 48 50 31Q65 47 50 59" fill="#efd0c5" />
		{:else if face === 'S3'}
			<path d="m47 98 6-39" fill="none" stroke="#8e5833" stroke-width="4" />
			<path
				d="m51 81-29-8 9-11-16-17 22 3-2-24 14 15 9-25 9 27 17-9-5 24 11 6-23 12-5 12Z"
				fill="#b65b32"
				stroke="#8d482b"
				stroke-width="2"
			/>
			<path d="m51 80 7-54M54 63 29 49M54 65 76 46" fill="none" stroke="#e8a457" stroke-width="2" />
		{:else}
			<path
				d="M50 100V25M50 46 29 58M50 64 76 74M50 82 22 90"
				fill="none"
				stroke="#6c5b3c"
				stroke-width="4"
			/>
			<path d="m50 14-17 28h11L25 63h14L15 88h70L64 66h12L58 43h11Z" fill="#2f6854" />
			<path
				d="m50 14-10 17h18ZM32 53l-7 10h14l7-5ZM23 79l-8 9h23l-4-6ZM62 54l14 12H62Z"
				fill="#d4e1df"
			/>
		{/if}
		<text x="12" y="22" font-size="15" fill="#345d46">{rank}</text>
	{/if}
{/snippet}

<div
	class="game mahjong-game"
	data-family="mahjong-solitaire"
	data-round={roundNumber}
	data-phase={phase}
	data-status={game.status}
	data-seed={game.seed}
	data-band={game.band}
	data-highlight={game.rules.highlight}
	data-group-size={game.rules.groupSize}
	data-theme-version={resolvedTheme?.themeConfigVersion}
	data-theme-generator={resolvedTheme?.themeGeneratorVersion}
	style={resolvedTheme ? themeStyle(resolvedTheme) : ''}
>
	<h2 class="sr-only">{t('v1.game.mahjong-solitaire')}</h2>
	<header class="hud">
		<div class="stats">
			<div class="stat">
				<span class="stat-label"
					>{t(game.rules.timeLimit > 0 ? 'mahjong.timeLeft' : 'game.time')}</span
				><strong data-countdown={game.rules.timeLimit > 0 ? remaining : undefined}
					>{formatDuration(game.rules.timeLimit > 0 ? remaining : elapsed)}</strong
				>
			</div>
			<div class="stat">
				<span class="stat-label"
					>{t(game.rules.groupSize === 3 ? 'mahjong.triples' : 'mahjong.pairs')}</span
				><strong>{game.removals} / {game.tiles.length / game.rules.groupSize}</strong>
			</div>
			<div class="stat">
				<span class="stat-label">{t('game.score')}</span><strong
					>{formatNumber(game.status === 'lost' ? 0 : mahjongScore(game, elapsed, scoring))}</strong
				>
			</div>
		</div>
	</header>
	<main class="stage">
		<div
			class="mahjong-viewport"
			class:zoomed={zoom > 1}
			data-zoom={zoom}
			bind:this={viewport}
			onpointerdown={pointerDown}
			onpointermove={pointerMove}
			onpointerup={pointerEnd}
			onpointercancel={pointerEnd}
			onlostpointercapture={pointerEnd}
			role="group"
			aria-label={t('mahjong.board')}
		>
			<svg
				class="mahjong-scenery"
				viewBox="0 0 1200 700"
				preserveAspectRatio="xMidYMid slice"
				aria-hidden="true"
			>
				<path d="M0 390 140 180 300 390 440 240 620 450 850 170 1200 430V700H0Z" fill="#c6d3be" />
				<path d="M0 490 240 330 420 550 720 350 930 520 1200 280V700H0Z" fill="#a9bfa7" />
				<path d="M0 660Q280 550 610 650T1200 610V700H0Z" fill="#769578" />
				<path
					d="M1080 0Q1080 90 1200 130M1135 50 1040 100M1150 90 1140 180"
					fill="none"
					stroke="#6d7054"
					stroke-width="12"
				/>
				{#each [[1090, 60], [1130, 90], [1060, 100], [1170, 120], [1140, 160]] as blossom, i (i)}<circle
						cx={blossom[0]}
						cy={blossom[1]}
						r="14"
						fill="#d9a7a1"
					/>{/each}
			</svg>
			<div
				class="mahjong-board-wrap"
				style={`--board-ratio:${width / height};--zoom:${zoom};--readable-width:${game.layout.width * 27}px`}
			>
				<svg
					class="mahjong-board"
					viewBox={`0 0 ${width} ${height}`}
					bind:this={board}
					role="group"
					aria-label={t('mahjong.board')}
				>
					{#each tiles as tile (tile.id)}
						{#if !tile.removed || ghosts.includes(tile.id)}
							<g
								class="mahjong-tile"
								class:free={free.includes(tile.id)}
								class:blocked={!free.includes(tile.id)}
								class:selected={selected.includes(tile.id)}
								class:hinted={game.lastHint.includes(tile.id)}
								class:newly-free={newlyFree.includes(tile.id)}
								class:removing={tile.removed}
								data-tile={tile.id}
								data-face={tile.faceDown ? undefined : tile.face}
								data-face-down={tile.faceDown}
								data-free={free.includes(tile.id)}
								data-layer={tile.z}
								transform={`translate(${tile.x * 50 + 4} ${tile.y * 60 + 4})`}
								role="button"
								tabindex={!tile.removed &&
								free.includes(tile.id) &&
								(cursor === tile.id || (!free.includes(cursor) && free[0] === tile.id))
									? 0
									: -1}
								aria-disabled={locked || !free.includes(tile.id)}
								aria-pressed={selected.includes(tile.id)}
								aria-label={t('mahjong.tile', {
									face: tile.faceDown ? t('mahjong.faceDown') : faceLabel(tile.face),
									state: t(free.includes(tile.id) ? 'mahjong.free' : 'mahjong.blocked'),
									layer: tile.z + 1
								})}
								onclick={() => guard(() => select(tile.id))}
								onkeydown={(event) => guard(() => keyDown(event, tile.id))}
								onfocus={() => {
									cursor = tile.id;
								}}
							>
								<g class="tile-motion" data-tile={tile.id}>
									<rect class="tile-shadow" x="2" y="6" width="98" height="116" rx="8" />
									<rect class="tile-wall" x="0" y="0" width="98" height="119" rx="8" />
									<rect class="tile-body" x="0" y="0" width="98" height="110" rx="8" />
									<path class="tile-bevel" d="M5 105V10Q5 5 10 5H89" fill="none" stroke-width="4" />
									<svg x="3" y="0" width="92" height="108" viewBox="0 0 100 110" aria-hidden="true"
										>{#if tile.faceDown}<rect
												x="12"
												y="12"
												width="76"
												height="87"
												rx="6"
												fill="#29674f"
											/><path
												d="m24 32 26-12 26 12v44L50 88 24 76Zm0 0 52 44M76 32 24 76"
												fill="none"
												stroke="#d7d6ad"
												stroke-width="3"
											/>{:else}{@render faceArt(tile.face)}{/if}</svg
									>
									{#if game.rules.highlight && free.includes(tile.id)}<circle
											class="free-dot"
											cx="86"
											cy="11"
											r="4"
										/>{/if}
								</g>
							</g>
						{/if}
					{/each}
				</svg>
			</div>
		</div>
	</main>
	<div class="mahjong-tools" role="group" aria-label={t('mahjong.tools')}>
		{#if game.status === 'lost'}<div class="mahjong-run-over">
				<p>{t('mahjong.overDetail')}</p>
				<button type="button" onclick={ontryanother ?? onhome}>{t('mahjong.tryAnother')}</button
				><button type="button" onclick={onhome}>{t('game.home')}</button>
			</div>
		{:else}<button
				type="button"
				disabled={locked ||
					hint.length === 0 ||
					(game.rules.hintLimit > 0 && game.hintsUsed >= game.rules.hintLimit)}
				onclick={() => control(MAHJONG_ACTION.hint)}
				>{t('mahjong.hint')}{#if game.rules.hintLimit > 0}<span
						data-hints-left={Math.max(0, game.rules.hintLimit - game.hintsUsed)}
					>
						{Math.max(0, game.rules.hintLimit - game.hintsUsed)}</span
					>{/if}</button
			><button
				type="button"
				disabled={locked || !game.rules.undo || game.history.length === 0}
				onclick={() => control(MAHJONG_ACTION.undo)}>{t('mahjong.undo')}</button
			><button
				type="button"
				disabled={locked ||
					(game.rules.shuffleLimit > 0 && game.shufflesUsed >= game.rules.shuffleLimit)}
				onclick={() => control(MAHJONG_ACTION.shuffle)}
				>{t('mahjong.shuffle')}{#if game.rules.shuffleLimit > 0}<span
						data-shuffles-left={Math.max(0, game.rules.shuffleLimit - game.shufflesUsed)}
					>
						{Math.max(0, game.rules.shuffleLimit - game.shufflesUsed)}</span
					>{/if}</button
			><button type="button" disabled={locked} onclick={() => control(MAHJONG_ACTION.restart)}
				>{t('mahjong.restart')}</button
			>{/if}
		{#if game.rules.hearts > 0}<span
				class="mahjong-hearts"
				data-hearts={game.hearts}
				aria-label={t('mahjong.hearts')}
				>{t('mahjong.hearts')} {game.hearts} / {game.rules.hearts}</span
			>{/if}
		<div class="mahjong-zoom">
			<button type="button" aria-pressed={zoom === 1} onclick={() => setZoom(1)}
				>{t('mahjong.fit')}</button
			><button
				type="button"
				aria-label={t('mahjong.zoomOut')}
				disabled={zoom === 1}
				onclick={() => setZoom(Math.max(1, zoom - 0.5))}>−</button
			><button
				type="button"
				aria-label={t('mahjong.zoomIn')}
				disabled={zoom >= 3}
				onclick={() => setZoom(Math.min(3, zoom + 0.5))}>+</button
			>
		</div>
	</div>
	<p class="mahjong-announcement" aria-live="polite" aria-atomic="true">
		{announcement ||
			(zoom > 1
				? t('mahjong.pan')
				: roundNumber === 1 || showTripleCoach
					? t(game.band === 1 || game.rules.exactOnly ? 'mahjong.quickHint' : 'mahjong.firstHint')
					: '')}
	</p>
	{#if phase === 'failed'}<div role="alert">
			<p>{t('mahjong.error')}</p>
			<button type="button" onclick={onhome}>{t('game.home')}</button>
		</div>{/if}
</div>

<style>
	.mahjong-game {
		min-height: 0;
	}
	.mahjong-viewport {
		position: relative;
		isolation: isolate;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: auto;
		border-radius: 14px;
		background: #e8e8d6;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}
	.mahjong-scenery {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: -1;
	}
	.mahjong-board-wrap {
		position: relative;
		width: min(100cqw, calc(100cqh * var(--board-ratio)));
		height: min(100cqh, calc(100cqw / var(--board-ratio)));
		margin: auto;
	}
	.zoomed {
		touch-action: none;
		cursor: grab;
	}
	.zoomed .mahjong-board-wrap {
		width: max(calc(100cqw * var(--zoom)), var(--readable-width));
		height: auto;
		aspect-ratio: var(--board-ratio);
		margin: 0;
	}
	.mahjong-board {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
		user-select: none;
	}
	.mahjong-game[data-phase='arrival'] .mahjong-board:not([data-motion-ready='true']) .tile-motion {
		opacity: 0;
	}
	.mahjong-tile {
		cursor: pointer;
		outline: none;
	}
	.tile-motion {
		transform-box: fill-box;
		transform-origin: center;
	}
	.tile-shadow {
		fill: #8d896e;
	}
	.tile-wall {
		fill: #215f43;
		stroke: #214d35;
		stroke-width: 2;
	}
	.tile-body {
		fill: #fff8e5;
		stroke: #bcad80;
		stroke-width: 2;
	}
	.tile-bevel {
		stroke: #fffdf5;
	}
	.mahjong-game[data-highlight='true'] .blocked .tile-body {
		fill: #dbd8bf;
	}
	.mahjong-game[data-highlight='true'] .blocked .tile-bevel {
		stroke: #eae6d2;
	}
	.mahjong-game[data-highlight='true'] .blocked {
		cursor: default;
	}
	.mahjong-game[data-highlight='true'] .free .tile-body {
		stroke: #3d8a77;
		stroke-width: 3;
	}
	.free-dot {
		fill: #1a6c51;
	}
	.newly-free .tile-wall {
		stroke: #d1b24f;
		stroke-width: 5;
	}
	.mahjong-hearts {
		align-self: center;
		font-size: 12px;
		color: #a93e30;
	}
	.selected .tile-motion {
		transform: translateY(-5px);
	}
	.selected .tile-body {
		stroke: #de782c;
		stroke-width: 5;
	}
	.hinted .tile-body {
		stroke: #8060a5;
		stroke-width: 5;
	}
	.mahjong-tile:focus-visible .tile-body {
		stroke: #1c64be;
		stroke-width: 5;
	}
	.removing {
		pointer-events: none;
	}
	.mahjong-tools,
	.mahjong-zoom {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 7px;
	}
	.mahjong-tools button {
		min-height: 40px;
		padding: 6px 18px;
		border: 1px solid #d4c7a6;
		border-radius: 24px;
		background: #fff8e8;
		color: #204d3f;
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}
	.mahjong-tools button:disabled {
		color: #808475;
		cursor: default;
	}
	.mahjong-tools button:focus-visible {
		outline: 3px solid #1c64be;
		outline-offset: 2px;
	}
	.mahjong-zoom button {
		padding-inline: 12px;
	}
	.mahjong-announcement {
		flex: 0 0 auto;
		min-height: 28px;
		margin: 0;
		padding: 4px 10px;
		border-radius: 12px;
		background: #204d3f;
		color: #fff6dc;
		text-align: center;
		font-size: 11px;
		line-height: 1.3;
	}
	.mahjong-run-over {
		text-align: center;
	}
	.mahjong-run-over p {
		margin: 0 0 5px;
	}
	@media (max-width: 600px) {
		.mahjong-tools {
			gap: 4px;
		}
		.mahjong-tools button {
			padding: 5px 10px;
			font-size: 12px;
			min-height: 36px;
		}
	}
</style>
