<script lang="ts">
	import { onMount } from 'svelte';
	import type { Move } from '#lib/engine/contract.js';
	import type { ScoreValues } from '#lib/engine/scoring.js';
	import type { PuzzleRound } from '#lib/ui/puzzle-view.js';
	import type { CheckpointState } from '#lib/ui/checkpoint.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle } from '#lib/engine/theme/style.js';
	import { sound } from '#lib/ui/sound.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { formatDuration, formatNumber } from '#lib/ui/format.js';
	import { klondikeEnter } from './motion.js';
	import {
		applyKlondikeMove,
		autoFinishSweep,
		canBuildOn,
		canFillEmpty,
		canOnFoundation,
		cardRank,
		cardSuit,
		createInitialDeal,
		isRedSuit,
		KLONDIKE_ACTION,
		klondikeDeal,
		klondikeScore,
		parseRules,
		type KlondikeRules,
		type KlondikeState
	} from './logic.js';

	const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'];
	const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

	let {
		round,
		roundNumber = 1,
		scoring,
		resolvedTheme = null,
		paused = false,
		rankedRound = false,
		entranceReady = true,
		resume,
		rankedStartedAt = null,
		registerCheckpoint,
		onhome,
		ontryanother,
		onnewdeal,
		onready = () => {},
		onmove = () => {},
		oncomplete = () => {},
		onfinish
	}: {
		round: PuzzleRound;
		roundNumber?: number;
		scoring: ScoreValues;
		resolvedTheme?: ResolvedTheme | null;
		paused?: boolean;
		rankedRound?: boolean;
		entranceReady?: boolean;
		resume?: CheckpointState;
		rankedStartedAt?: number | null;
		registerCheckpoint?: (read: () => CheckpointState) => void;
		onhome?: () => void;
		ontryanother?: () => void;
		onnewdeal?: () => void;
		onready?: () => void;
		onmove?: (move: Move) => void;
		oncomplete?: (score: number, seconds: number) => void;
		onfinish: (score: number, seconds: number, moves: number, hintUsedSession: boolean) => void;
	} = $props();

	let rootEl: HTMLDivElement;
	let boardEl: HTMLDivElement;

	const rules: KlondikeRules = $derived.by(() => parseRules(round.variant));

	// Deal generation from seed
	// svelte-ignore state_referenced_locally
	const initialDeal = klondikeDeal(round.seed, round.variant);
	let initialDeck: number[] = $state(initialDeal.deck);
	// svelte-ignore state_referenced_locally
	let gameState: KlondikeState = $state(
		createInitialDeal(initialDeal.deck, parseRules(round.variant))
	);
	const currentScore = $derived.by(() => klondikeScore(gameState, 0, scoring, rules));

	let undoStack: KlondikeState[] = $state([]);
	let runMoves: Move[] = $state([]);
	let hintUsedSession = $state(false);
	let seconds = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let timerStarted = $state(false);
	let completed = $state(false);
	let blocked = $state(false);
	let message = $state('');

	// Selection and Hint State
	type Selection =
		| { kind: 'waste' }
		| { kind: 'foundation'; col: number }
		| { kind: 'tableau'; col: number; idx: number };

	let selected: Selection | null = $state(null);
	let hintHighlight: { sel: Selection | null; dest: { kind: string; col?: number } | null } | null =
		$state(null);
	let lastTapTime = 0;
	let lastTapCard: number | null = null;

	// Drag state
	let dragCard: { card: number; count: number; src: Selection } | null = $state(null);
	let dragPos = $state({ x: 0, y: 0 });
	let isDragging = $state(false);

	function startTimer() {
		if (timerStarted || completed) return;
		timerStarted = true;
		timerInterval = setInterval(() => {
			if (!paused && !completed) {
				seconds++;
			}
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function initRound() {
		const { deck } = klondikeDeal(round.seed, round.variant);
		initialDeck = deck;
		gameState = createInitialDeal(initialDeck, rules);
		undoStack = [];
		runMoves = [];
		hintUsedSession = false;
		seconds = 0;
		timerStarted = false;
		completed = false;
		blocked = false;
		selected = null;
		hintHighlight = null;
		message = '';
	}

	function commitMove(move: Move, nextState: KlondikeState) {
		startTimer();
		runMoves = [...runMoves, move];
		gameState = nextState;
		onmove(move);
		checkGameEnd();
	}

	function checkGameEnd() {
		const totalHome = gameState.foundations.reduce((sum, r) => sum + r, 0);
		if (totalHome === 52) {
			completed = true;
			stopTimer();
			sound.play('win');
			const finalScore = klondikeScore(gameState, seconds, scoring, rules);
			oncomplete(finalScore, seconds);
			onfinish(finalScore, seconds, gameState.movesCount, hintUsedSession);
			return;
		}

		// Check if blocked
		const hint = findHint();
		if (!hint.dest && !hint.sel) {
			blocked = true;
			stopTimer();
			message = t('klondike-solitaire.overDetail');
		}
	}

	function handleStockClick() {
		if (completed || blocked) return;
		selected = null;
		hintHighlight = null;

		if (gameState.stock.length > 0) {
			const count = Math.min(rules.draw, gameState.stock.length);
			const topCard = gameState.stock[gameState.stock.length - count];
			const move: Move = {
				action: KLONDIKE_ACTION.draw,
				at: 0,
				card: topCard,
				count,
				dst: 0,
				src: 0
			};
			undoStack = [...undoStack, JSON.parse(JSON.stringify(gameState))];
			const res = applyKlondikeMove(gameState, move, rules, initialDeck);
			sound.play('place');
			message = `Drew ${count} card${count > 1 ? 's' : ''}.`;
			commitMove(move, res.nextState);
		} else if (gameState.waste.length > 0) {
			const maxRecycles = rules.passes === 1 ? 0 : rules.passes === 3 ? 2 : Infinity;
			if (gameState.recyclesDone >= maxRecycles) {
				sound.play('invalid');
				message = 'No recycles remaining.';
				return;
			}
			const move: Move = {
				action: KLONDIKE_ACTION.recycle,
				at: 0,
				card: 0,
				count: 0,
				dst: 0,
				src: 0
			};
			undoStack = [...undoStack, JSON.parse(JSON.stringify(gameState))];
			const res = applyKlondikeMove(gameState, move, rules, initialDeck);
			sound.play('reshuffle');
			message = rules.draw === 1 ? 'Waste recycled (−100).' : 'Waste recycled.';
			commitMove(move, res.nextState);
		}
	}

	function executeMove(sel: Selection, dstKind: 'foundation' | 'tableau', dstCol: number): boolean {
		let srcCode = 0;
		let cardId = 0;
		let count = 1;

		if (sel.kind === 'waste') {
			srcCode = 1;
			if (gameState.waste.length === 0) return false;
			cardId = gameState.waste[gameState.waste.length - 1];
			count = 1;
		} else if (sel.kind === 'foundation') {
			srcCode = 2 + sel.col;
			const rank = gameState.foundations[sel.col];
			if (rank === 0) return false;
			cardId = sel.col * 13 + (rank - 1);
			count = 1;
		} else if (sel.kind === 'tableau') {
			srcCode = 6 + sel.col;
			const col = gameState.tableau[sel.col];
			if (col.up.length <= sel.idx) return false;
			cardId = col.up[sel.idx];
			count = col.up.length - sel.idx;
		}

		const dstCode = dstKind === 'foundation' ? 2 + dstCol : 6 + dstCol;
		const move: Move = {
			action: KLONDIKE_ACTION.move,
			at: 0,
			card: cardId,
			count,
			dst: dstCode,
			src: srcCode
		};

		try {
			const res = applyKlondikeMove(gameState, move, rules, initialDeck);
			undoStack = [...undoStack, JSON.parse(JSON.stringify(gameState))];
			sound.play('place');
			message = dstKind === 'foundation' ? 'Home.' : 'Moved.';
			selected = null;
			hintHighlight = null;
			commitMove(move, res.nextState);
			return true;
		} catch {
			sound.play('invalid');
			return false;
		}
	}

	function trySendHome(cardId: number, sel: Selection): boolean {
		const suit = cardSuit(cardId);
		if (canOnFoundation(cardId, suit, gameState.foundations[suit])) {
			return executeMove(sel, 'foundation', suit);
		}
		return false;
	}

	function handleCardClick(cardId: number, sel: Selection) {
		if (completed || blocked) return;

		const now = Date.now();
		if (lastTapCard === cardId && now - lastTapTime < 350) {
			// Double tap -> send home
			lastTapTime = 0;
			lastTapCard = null;
			if (trySendHome(cardId, sel)) return;
		}
		lastTapTime = now;
		lastTapCard = cardId;

		// If a card is already selected:
		if (selected) {
			if (
				selected.kind === sel.kind &&
				('col' in selected ? selected.col : -1) === ('col' in sel ? sel.col : -1) &&
				('idx' in selected ? selected.idx : -1) === ('idx' in sel ? sel.idx : -1)
			) {
				// Clicked selected card -> deselect
				selected = null;
				return;
			}
			// Try placing selected onto this card's pile
			if (sel.kind === 'tableau') {
				if (executeMove(selected, 'tableau', sel.col)) return;
			} else if (sel.kind === 'foundation') {
				if (executeMove(selected, 'foundation', sel.col)) return;
			}
		}

		// Otherwise select this card
		selected = sel;
		hintHighlight = null;
	}

	function handleSlotClick(kind: 'foundation' | 'tableau', col: number) {
		if (completed || blocked) return;
		if (selected) {
			executeMove(selected, kind, col);
		}
	}

	function handleUndo() {
		if (!rules.undo || undoStack.length === 0 || completed) return;
		const previous = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		gameState = previous;
		selected = null;
		hintHighlight = null;
		sound.play('clear');
		message = 'Undone.';
		const move: Move = { action: KLONDIKE_ACTION.undo, at: 0, card: 0, count: 0, dst: 0, src: 0 };
		runMoves = [...runMoves, move];
		onmove(move);
	}

	function findHint() {
		const w = gameState.waste.length > 0 ? gameState.waste[gameState.waste.length - 1] : null;

		// 1. Waste to foundation
		if (w !== null) {
			const suit = cardSuit(w);
			if (canOnFoundation(w, suit, gameState.foundations[suit])) {
				return {
					sel: { kind: 'waste' as const },
					dest: { kind: 'foundation', col: suit },
					text: `Send the ${RANK_LABELS[cardRank(w) - 1]}${SUIT_GLYPHS[suit]} home.`
				};
			}
		}

		// 2. Tableau to foundation
		for (let c = 0; c < 7; c++) {
			const col = gameState.tableau[c];
			if (col.up.length > 0) {
				const top = col.up[col.up.length - 1];
				const suit = cardSuit(top);
				if (canOnFoundation(top, suit, gameState.foundations[suit])) {
					return {
						sel: { kind: 'tableau' as const, col: c, idx: col.up.length - 1 },
						dest: { kind: 'foundation', col: suit },
						text: `Send the ${RANK_LABELS[cardRank(top) - 1]}${SUIT_GLYPHS[suit]} home.`
					};
				}
			}
		}

		// 3. Tableau move revealing face-down card
		for (let c = 0; c < 7; c++) {
			const col = gameState.tableau[c];
			if (col.up.length > 0 && col.down.length > 0) {
				const bottomCard = col.up[0];
				for (let d = 0; d < 7; d++) {
					if (c === d) continue;
					const dstCol = gameState.tableau[d];
					if (dstCol.up.length === 0) {
						if (canFillEmpty(bottomCard, rules.anyCard)) {
							return {
								sel: { kind: 'tableau' as const, col: c, idx: 0 },
								dest: { kind: 'tableau', col: d },
								text: `Move the ${RANK_LABELS[cardRank(bottomCard) - 1]}${SUIT_GLYPHS[cardSuit(bottomCard)]} to column ${d + 1} — turns a card over.`
							};
						}
					} else {
						const dstTop = dstCol.up[dstCol.up.length - 1];
						if (canBuildOn(bottomCard, dstTop, rules.build)) {
							return {
								sel: { kind: 'tableau' as const, col: c, idx: 0 },
								dest: { kind: 'tableau', col: d },
								text: `Move the ${RANK_LABELS[cardRank(bottomCard) - 1]}${SUIT_GLYPHS[cardSuit(bottomCard)]} to column ${d + 1} — turns a card over.`
							};
						}
					}
				}
			}
		}

		// 4. Waste to tableau
		if (w !== null) {
			for (let d = 0; d < 7; d++) {
				const dstCol = gameState.tableau[d];
				if (dstCol.up.length === 0) {
					if (canFillEmpty(w, rules.anyCard)) {
						return {
							sel: { kind: 'waste' as const },
							dest: { kind: 'tableau', col: d },
							text: `Play the ${RANK_LABELS[cardRank(w) - 1]}${SUIT_GLYPHS[cardSuit(w)]} onto column ${d + 1}.`
						};
					}
				} else {
					const dstTop = dstCol.up[dstCol.up.length - 1];
					if (canBuildOn(w, dstTop, rules.build)) {
						return {
							sel: { kind: 'waste' as const },
							dest: { kind: 'tableau', col: d },
							text: `Play the ${RANK_LABELS[cardRank(w) - 1]}${SUIT_GLYPHS[cardSuit(w)]} onto column ${d + 1}.`
						};
					}
				}
			}
		}

		// 5. Tableau to tableau general
		for (let c = 0; c < 7; c++) {
			const col = gameState.tableau[c];
			if (col.up.length > 0) {
				for (let idx = 0; idx < col.up.length; idx++) {
					const bottomCard = col.up[idx];
					if (idx === 0 && col.down.length === 0) continue; // Skip pointless king shuffle
					for (let d = 0; d < 7; d++) {
						if (c === d) continue;
						const dstCol = gameState.tableau[d];
						if (dstCol.up.length === 0) {
							if (canFillEmpty(bottomCard, rules.anyCard)) {
								return {
									sel: { kind: 'tableau' as const, col: c, idx },
									dest: { kind: 'tableau', col: d },
									text: `Move the ${RANK_LABELS[cardRank(bottomCard) - 1]}${SUIT_GLYPHS[cardSuit(bottomCard)]} to column ${d + 1}.`
								};
							}
						} else {
							const dstTop = dstCol.up[dstCol.up.length - 1];
							if (canBuildOn(bottomCard, dstTop, rules.build)) {
								return {
									sel: { kind: 'tableau' as const, col: c, idx },
									dest: { kind: 'tableau', col: d },
									text: `Move the ${RANK_LABELS[cardRank(bottomCard) - 1]}${SUIT_GLYPHS[cardSuit(bottomCard)]} to column ${d + 1}.`
								};
							}
						}
					}
				}
			}
		}

		// 6. Foundation back to tableau
		for (let f = 0; f < 4; f++) {
			const rank = gameState.foundations[f];
			if (rank > 0) {
				const cardId = f * 13 + (rank - 1);
				for (let d = 0; d < 7; d++) {
					const dstCol = gameState.tableau[d];
					if (dstCol.up.length > 0) {
						const dstTop = dstCol.up[dstCol.up.length - 1];
						if (canBuildOn(cardId, dstTop, rules.build)) {
							return {
								sel: { kind: 'foundation' as const, col: f },
								dest: { kind: 'tableau', col: d },
								text: `Bring the ${RANK_LABELS[rank - 1]}${SUIT_GLYPHS[f]} back to column ${d + 1} (−15).`
							};
						}
					}
				}
			}
		}

		if (gameState.stock.length > 0) {
			return { sel: null, dest: { kind: 'stock' }, text: 'Draw from the stock.' };
		}
		if (gameState.waste.length > 0) {
			const maxRecycles = rules.passes === 1 ? 0 : rules.passes === 3 ? 2 : Infinity;
			if (gameState.recyclesDone < maxRecycles) {
				return { sel: null, dest: { kind: 'stock' }, text: 'Recycle the waste pile.' };
			}
		}

		return { sel: null, dest: null, text: 'No moves left.' };
	}

	function handleHint() {
		if (completed || (rules.hintBudget === 3 && gameState.hintsUsed >= 3)) return;
		hintUsedSession = true;
		const hint = findHint();
		hintHighlight = { sel: hint.sel, dest: hint.dest };
		message = hint.text;

		const move: Move = { action: KLONDIKE_ACTION.hint, at: 0, card: 0, count: 0, dst: 0, src: 0 };
		const res = applyKlondikeMove(gameState, move, rules, initialDeck);
		sound.play('pick');
		commitMove(move, res.nextState);
	}

	const isAutoFinishAvailable = $derived.by(() => {
		if (completed || blocked) return false;
		const sweep = autoFinishSweep(gameState);
		return sweep.won;
	});

	function handleAutoFinish() {
		if (!isAutoFinishAvailable) return;
		const sweep = autoFinishSweep(gameState);
		if (sweep.won && sweep.finalState) {
			const move: Move = {
				action: KLONDIKE_ACTION.autoFinish,
				at: 0,
				card: 0,
				count: 0,
				dst: 0,
				src: 0
			};
			undoStack = [...undoStack, JSON.parse(JSON.stringify(gameState))];
			sound.play('win');
			commitMove(move, { ...sweep.finalState, movesCount: sweep.finalState.movesCount + 1 });
		}
	}

	function handleRestart() {
		const move: Move = {
			action: KLONDIKE_ACTION.restart,
			at: 0,
			card: 0,
			count: 0,
			dst: 0,
			src: 0
		};
		const res = applyKlondikeMove(gameState, move, rules, initialDeck);
		undoStack = [];
		sound.play('clear');
		message = 'Deal restarted.';
		selected = null;
		hintHighlight = null;
		commitMove(move, res.nextState);
	}

	// Pointer drag handlers
	function startDrag(card: number, count: number, src: Selection, ev: PointerEvent) {
		if (completed || blocked) return;
		dragCard = { card, count, src };
		dragPos = { x: ev.clientX, y: ev.clientY };
		isDragging = true;
		selected = src;
	}

	function onPointerMove(ev: PointerEvent) {
		if (isDragging) {
			dragPos = { x: ev.clientX, y: ev.clientY };
		}
	}

	function onPointerUp(ev: PointerEvent) {
		if (!isDragging || !dragCard) return;
		isDragging = false;
		const elem = document.elementFromPoint(ev.clientX, ev.clientY);
		if (elem) {
			const dropTarget = elem.closest<HTMLElement>('[data-drop-zone]');
			if (dropTarget) {
				const zone = dropTarget.dataset.dropZone;
				const col = Number(dropTarget.dataset.dropCol);
				if (zone === 'foundation') {
					executeMove(dragCard.src, 'foundation', col);
				} else if (zone === 'tableau') {
					executeMove(dragCard.src, 'tableau', col);
				}
			}
		}
		dragCard = null;
	}

	// Keyboard navigation
	function handleKeydown(ev: KeyboardEvent) {
		if (completed) return;
		if (ev.key === 'h' || ev.key === 'H') {
			ev.preventDefault();
			handleHint();
		} else if (ev.key === 'u' || ev.key === 'U') {
			ev.preventDefault();
			handleUndo();
		} else if (ev.key === 'r' || ev.key === 'R') {
			ev.preventDefault();
			handleRestart();
		} else if (ev.key === 'Escape') {
			selected = null;
			hintHighlight = null;
		}
	}

	onMount(() => {
		if (resume) {
			const elapsed =
				rankedRound && rankedStartedAt !== null
					? Math.max(resume.elapsedMs, Date.now() - rankedStartedAt)
					: resume.elapsedMs;
			seconds = Math.floor(elapsed / 1000);
			if (resume.clockStarted) {
				timerStarted = true;
				startTimer();
			}
		} else {
			initRound();
		}
		registerCheckpoint?.((): CheckpointState => ({
			phase: completed ? 'completed' : 'running',
			elapsedMs: seconds * 1000,
			clockStarted: timerStarted,
			pending: {}
		}));
		onready();

		if (rootEl && entranceReady) {
			const handle = klondikeEnter(rootEl, 'enter', rules.thoughtful);
			return () => handle.destroy();
		}
	});
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp} onkeydown={handleKeydown} />

<div
	class="klondike-game game"
	data-family="klondike-solitaire"
	data-round={roundNumber}
	data-phase={completed ? 'completed' : 'playing'}
	data-seed={round.seed}
	data-variant={round.variant}
	data-ranked={rankedRound}
	data-theme-version={resolvedTheme?.themeConfigVersion}
	data-theme-generator={resolvedTheme?.themeGeneratorVersion}
	style={resolvedTheme ? themeStyle(resolvedTheme) : ''}
	bind:this={rootEl}
>
	<!-- HUD -->
	<header class="hud">
		<div class="title-row">
			<span class="spade-icon" aria-hidden="true">♠</span>
			<h1 class="game-title">Klondike</h1>
			<span class="subtitle">
				{t(`variant.${round.variant ?? 'klondike-solitaire:classic'}` as MessageKey)} · Draw {rules.draw}
			</span>
		</div>
		<div class="stats">
			<div class="stat">
				<span class="stat-label">{t('klondike-solitaire.score')}</span>
				<strong>{formatNumber(currentScore)}</strong>
			</div>
			<div class="stat">
				<span class="stat-label">{t('klondike-solitaire.moves')}</span>
				<strong>{gameState.movesCount}</strong>
			</div>
			<div class="stat">
				<span class="stat-label">{t('klondike-solitaire.time')}</span>
				<strong>{formatDuration(seconds)}</strong>
			</div>
		</div>
	</header>

	<!-- Message bar -->
	<div class="announcement" role="status" aria-live="polite">
		{message}
	</div>

	<!-- Board -->
	<div class="board" bind:this={boardEl}>
		<!-- Top row: stock, waste, empty spacer, 4 foundations -->
		<div class="top-row">
			<!-- Stock -->
			<div class="cell stock-cell">
				{#if gameState.stock.length > 0}
					<button
						type="button"
						class="card card-back stock-btn"
						onclick={handleStockClick}
						aria-label="Draw from stock ({gameState.stock.length} cards remaining)"
					>
						<div class="back-pattern"></div>
						<span class="count-badge">{gameState.stock.length}</span>
					</button>
				{:else}
					<button
						type="button"
						class="slot empty-stock-slot"
						onclick={handleStockClick}
						aria-label="Recycle stock"
					>
						<span class="recycle-icon">↻</span>
					</button>
				{/if}
			</div>

			<!-- Waste -->
			<div class="cell waste-cell">
				{#if gameState.waste.length === 0}
					<div class="slot empty-waste-slot"></div>
				{:else}
					{#each gameState.waste.slice(-3) as cardId, idx (cardId)}
						{@const isTop = idx === Math.min(gameState.waste.length, 3) - 1}
						{@const suit = cardSuit(cardId)}
						{@const rank = cardRank(cardId)}
						{@const red = isRedSuit(suit)}
						{@const isSel = selected?.kind === 'waste' && isTop}
						{@const isHint = hintHighlight?.sel?.kind === 'waste' && isTop}
						<div
							class="card card-face waste-card"
							class:red
							class:selected={isSel}
							class:hint-src={isHint}
							style:left="{idx * 16}px"
							tabindex={isTop ? 0 : -1}
							role="button"
							aria-label="{RANK_LABELS[rank - 1]} of {SUIT_GLYPHS[suit]}"
							onclick={() => isTop && handleCardClick(cardId, { kind: 'waste' })}
							onkeydown={(e) => {
								if (isTop && (e.key === 'Enter' || e.key === ' ')) {
									e.preventDefault();
									handleCardClick(cardId, { kind: 'waste' });
								}
							}}
							onpointerdown={(e) => isTop && startDrag(cardId, 1, { kind: 'waste' }, e)}
						>
							<div class="card-corner">
								<span class="rank-text">{RANK_LABELS[rank - 1]}</span>
								<span class="suit-text">{SUIT_GLYPHS[suit]}</span>
							</div>
							<div class="card-pip">{SUIT_GLYPHS[suit]}</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Spacer -->
			<div class="cell spacer-cell"></div>

			<!-- Foundations (4 suits: 0=spades, 1=hearts, 2=diamonds, 3=clubs) -->
			{#each [0, 1, 2, 3] as suitIdx (suitIdx)}
				{@const currentRank = gameState.foundations[suitIdx]}
				{@const red = isRedSuit(suitIdx)}
				{@const isHintDest =
					hintHighlight?.dest?.kind === 'foundation' && hintHighlight.dest.col === suitIdx}
				<div
					class="cell foundation-cell"
					data-drop-zone="foundation"
					data-drop-col={suitIdx}
					class:hint-dest={isHintDest}
					role="button"
					tabindex="0"
					aria-label="Foundation {SUIT_GLYPHS[suitIdx]}"
					onclick={() => handleSlotClick('foundation', suitIdx)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleSlotClick('foundation', suitIdx);
						}
					}}
				>
					{#if currentRank === 0}
						<div class="slot foundation-slot">
							<span class="ghost-glyph" class:red>{SUIT_GLYPHS[suitIdx]}</span>
						</div>
					{:else}
						{@const topCard = suitIdx * 13 + (currentRank - 1)}
						{@const isSel = selected?.kind === 'foundation' && selected.col === suitIdx}
						<div
							class="card card-face foundation-card"
							class:red
							class:selected={isSel}
							tabindex="0"
							role="button"
							aria-label="{RANK_LABELS[currentRank - 1]} of {SUIT_GLYPHS[suitIdx]} on foundation"
							onclick={(e) => {
								e.stopPropagation();
								handleCardClick(topCard, { kind: 'foundation', col: suitIdx });
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									e.stopPropagation();
									handleCardClick(topCard, { kind: 'foundation', col: suitIdx });
								}
							}}
							onpointerdown={(e) => startDrag(topCard, 1, { kind: 'foundation', col: suitIdx }, e)}
						>
							<div class="card-corner">
								<span class="rank-text">{RANK_LABELS[currentRank - 1]}</span>
								<span class="suit-text">{SUIT_GLYPHS[suitIdx]}</span>
							</div>
							<div class="card-pip">{SUIT_GLYPHS[suitIdx]}</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Tableau row (7 columns) -->
		<div class="tableau-row">
			{#each gameState.tableau as col, colIdx (colIdx)}
				{@const isEmpty = col.down.length === 0 && col.up.length === 0}
				{@const isHintDest =
					hintHighlight?.dest?.kind === 'tableau' && hintHighlight.dest.col === colIdx}
				<div
					class="tableau-column"
					data-drop-zone="tableau"
					data-drop-col={colIdx}
					class:hint-dest={isHintDest}
				>
					{#if isEmpty}
						<button
							type="button"
							class="slot empty-tableau-slot"
							aria-label="Empty tableau column {colIdx + 1}"
							onclick={() => handleSlotClick('tableau', colIdx)}
						>
							<span class="ghost-glyph ghost-k">K</span>
						</button>
					{:else}
						<!-- Face-down cards -->
						{#each col.down as cardId, dIdx (cardId)}
							<div class="card card-back tableau-card tableau-card-enter" style:top="{dIdx * 18}px">
								<div class="back-pattern"></div>
							</div>
						{/each}
						<!-- Face-up cards -->
						{#each col.up as cardId, uIdx (cardId)}
							{@const suit = cardSuit(cardId)}
							{@const rank = cardRank(cardId)}
							{@const red = isRedSuit(suit)}
							{@const isSel =
								selected?.kind === 'tableau' && selected.col === colIdx && selected.idx <= uIdx}
							{@const isHintSrc =
								hintHighlight?.sel?.kind === 'tableau' &&
								hintHighlight.sel.col === colIdx &&
								hintHighlight.sel.idx === uIdx}
							{@const isTop = uIdx === col.up.length - 1}
							<div
								class="card card-face tableau-card tableau-card-enter"
								class:red
								class:selected={isSel}
								class:hint-src={isHintSrc}
								data-flip={isTop ? 'true' : 'false'}
								style:top="{col.down.length * 18 + uIdx * 26}px"
								tabindex="0"
								role="button"
								aria-label="{RANK_LABELS[rank - 1]} of {SUIT_GLYPHS[suit]}"
								onclick={(e) => {
									e.stopPropagation();
									handleCardClick(cardId, { kind: 'tableau', col: colIdx, idx: uIdx });
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										e.stopPropagation();
										handleCardClick(cardId, { kind: 'tableau', col: colIdx, idx: uIdx });
									}
								}}
								onpointerdown={(e) =>
									startDrag(
										cardId,
										col.up.length - uIdx,
										{ kind: 'tableau', col: colIdx, idx: uIdx },
										e
									)}
							>
								<div class="card-corner">
									<span class="rank-text">{RANK_LABELS[rank - 1]}</span>
									<span class="suit-text">{SUIT_GLYPHS[suit]}</span>
								</div>
								<div class="card-pip">{SUIT_GLYPHS[suit]}</div>
							</div>
						{/each}
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Controls Bar -->
	<footer class="controls-bar controls">
		<button
			type="button"
			class="ctrl-btn"
			disabled={!rules.undo || undoStack.length === 0 || completed}
			onclick={handleUndo}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				aria-hidden="true"
			>
				<path d="M3 10h10a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H6" />
				<path d="m7 6-4 4 4 4" />
			</svg>
			{t('klondike-solitaire.undo')}
		</button>

		<button
			type="button"
			class="ctrl-btn hint-btn"
			disabled={completed || (rules.hintBudget === 3 && gameState.hintsUsed >= 3)}
			onclick={handleHint}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				aria-hidden="true"
			>
				<path d="M9 18h6" />
				<path d="M10 22h4" />
				<path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z" />
			</svg>
			{t('klondike-solitaire.hint')}
			{#if rules.hintBudget === 3}
				<span class="badge">({3 - gameState.hintsUsed})</span>
			{/if}
		</button>

		<button
			type="button"
			class="ctrl-btn"
			disabled={!isAutoFinishAvailable || completed}
			onclick={handleAutoFinish}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				aria-hidden="true"
			>
				<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
			</svg>
			{t('klondike-solitaire.autofinish')}
		</button>

		<button type="button" class="ctrl-btn" onclick={handleRestart}>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				aria-hidden="true"
			>
				<path d="M21 12a9 9 0 1 1-2.6-6.3" />
				<path d="M21 3v6h-6" />
			</svg>
			{t('klondike-solitaire.restart')}
		</button>

		{#if onnewdeal}
			<button type="button" class="ctrl-btn primary-btn" onclick={onnewdeal}>
				<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M7 4.5v15l13-7.5-13-7.5z" />
				</svg>
				{t('klondike-solitaire.newdeal')}
			</button>
		{/if}

		{#if blocked && (ontryanother || onhome)}
			<button type="button" class="ctrl-btn try-another-btn" onclick={ontryanother ?? onhome}>
				{t('klondike-solitaire.tryAnother')}
			</button>
		{/if}
	</footer>

	<!-- Drag Ghost -->
	{#if isDragging && dragCard}
		<div class="drag-ghost" style:left="{dragPos.x - 30}px" style:top="{dragPos.y - 40}px">
			<div class="card card-face" class:red={isRedSuit(cardSuit(dragCard.card))}>
				<div class="card-corner">
					<span class="rank-text">{RANK_LABELS[cardRank(dragCard.card) - 1]}</span>
					<span class="suit-text">{SUIT_GLYPHS[cardSuit(dragCard.card)]}</span>
				</div>
				<div class="card-pip">{SUIT_GLYPHS[cardSuit(dragCard.card)]}</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.klondike-game {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 1280px;
		margin: 0 auto;
		padding: clamp(8px, 1.5vh, 16px) clamp(10px, 1.8vw, 24px);
		gap: clamp(8px, 1.4vh, 14px);
		box-sizing: border-box;
		--card-w: clamp(44px, 10.5vw, 110px);
		--card-h: calc(var(--card-w) * 1.4);
		--gap: clamp(6px, 1.2vw, 16px);
	}

	.hud {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.spade-icon {
		font-size: 24px;
		color: #193f34;
	}

	.game-title {
		margin: 0;
		font-size: clamp(20px, 2.2vw, 32px);
		font-weight: 900;
		color: #193f34;
	}

	.subtitle {
		font-size: clamp(12px, 1.1vw, 16px);
		color: #5c6c64;
		border-left: 2px solid #e2d7be;
		padding-left: 10px;
	}

	.stats {
		display: flex;
		gap: 8px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 4px 12px;
		background: #fffbf3;
		border: 1px solid #e2d7be;
		border-radius: 14px;
		min-width: 60px;
	}

	.stat-label {
		font-size: 10px;
		font-weight: 700;
		color: #5c6c64;
		text-transform: uppercase;
	}

	.stat strong {
		font-size: 17px;
		font-weight: 900;
		color: #193f34;
	}

	.announcement {
		min-height: 20px;
		font-size: 13px;
		font-weight: 700;
		color: #4a5a52;
		text-align: center;
	}

	.board {
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 2vh, 20px);
		width: 100%;
	}

	.top-row {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: var(--gap);
		height: var(--card-h);
	}

	.tableau-row {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: var(--gap);
		min-height: calc(var(--card-h) * 2.8);
		align-items: start;
	}

	.cell {
		position: relative;
		height: var(--card-h);
		width: 100%;
		max-width: var(--card-w);
	}

	.tableau-column {
		position: relative;
		min-height: var(--card-h);
		width: 100%;
		max-width: var(--card-w);
	}

	.slot {
		position: absolute;
		inset: 0;
		border: 1.5px dashed #d5c8ab;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		box-sizing: border-box;
	}

	.ghost-glyph {
		font-size: calc(var(--card-w) * 0.45);
		opacity: 0.3;
		line-height: 1;
	}

	.ghost-glyph.red {
		color: #d93829;
	}

	.ghost-k {
		font-weight: 900;
		color: #5c6c64;
	}

	.empty-stock-slot {
		cursor: pointer;
	}

	.recycle-icon {
		font-size: 24px;
		color: #5c6c64;
	}

	.card {
		position: absolute;
		width: 100%;
		max-width: var(--card-w);
		height: var(--card-h);
		border-radius: 8px;
		box-sizing: border-box;
		user-select: none;
		cursor: pointer;
		transition:
			transform 0.1s ease,
			box-shadow 0.1s ease;
	}

	.card-face {
		background: #ffffff;
		border: 1px solid #d9d0be;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
		color: #1a2536;
	}

	.card-face.red {
		color: #d93829;
	}

	.card-back {
		background: linear-gradient(145deg, #1f4287, #132757);
		border: 1px solid #102047;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
	}

	.back-pattern {
		position: absolute;
		inset: 4px;
		border: 1.5px solid rgba(255, 255, 255, 0.3);
		border-radius: 5px;
		background:
			repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.12) 0 2px, transparent 2px 8px),
			repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.12) 0 2px, transparent 2px 8px);
	}

	.count-badge {
		position: absolute;
		right: -4px;
		bottom: -4px;
		background: #193f34;
		color: #fff;
		font-size: 11px;
		font-weight: 900;
		padding: 1px 6px;
		border-radius: 10px;
	}

	.card-corner {
		position: absolute;
		top: 4px;
		left: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}

	.rank-text {
		font-size: calc(var(--card-w) * 0.28);
		font-weight: 900;
	}

	.suit-text {
		font-size: calc(var(--card-w) * 0.2);
		margin-top: 1px;
	}

	.card-pip {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: calc(var(--card-w) * 0.52);
		padding-top: 10%;
	}

	.card.selected {
		outline: 3px solid #2f6fed;
		outline-offset: 1px;
		z-index: 10 !important;
	}

	.card.hint-src {
		outline: 3px solid #009a86;
		outline-offset: 1px;
	}

	.hint-dest {
		outline: 3px dashed #009a86;
		outline-offset: 2px;
		border-radius: 8px;
	}

	.controls-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		padding-top: 8px;
		border-top: 1px solid #e2d7be;
	}

	.ctrl-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: #fffbf3;
		border: 1px solid #d5c8ab;
		border-radius: 10px;
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 800;
		color: #193f34;
		cursor: pointer;
	}

	.ctrl-btn svg {
		width: 16px;
		height: 16px;
	}

	.ctrl-btn:hover:not(:disabled) {
		background: #f5eedb;
	}

	.ctrl-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.primary-btn {
		background: #193f34;
		color: #fff;
		border-color: #193f34;
		margin-left: auto;
	}

	.primary-btn:hover:not(:disabled) {
		background: #235547;
	}

	.try-another-btn {
		background: #d93829;
		color: #fff;
		border-color: #d93829;
	}

	.drag-ghost {
		position: fixed;
		pointer-events: none;
		z-index: 100;
		filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.25));
	}

	.drag-ghost .card {
		position: relative;
	}
</style>
