<script lang="ts">
	import { SCORE_DEFAULTS, type ScoreValues } from '#lib/engine/scoring.js';
	import { onMount, untrack } from 'svelte';
	import { motion } from '#lib/ui/motion.js';
	import { createActiveDelay } from '#lib/ui/active-delay.js';
	import { BLOCK_ENTRANCE_MS } from '#lib/round-timing.js';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import {
		BLOCK_BOARD_SIZE,
		PIECE_BY_ID,
		canPlace,
		placeBlockPiece,
		type BlockEndReason,
		type BlockRound,
		type PieceId
	} from '#lib/puzzles/block-placement/logic.js';
	import { t, type MessageKey } from '#lib/i18n/messages.js';
	import { blockThemeForSeed, blockThemeStyle } from '#lib/puzzles/block-placement/themes.js';
	import { formatNumber } from '#lib/ui/format.js';
	import { sound } from '#lib/ui/sound.js';
	import type { ResolvedTheme } from '#lib/engine/theme/generator.js';
	import { themeStyle as proceduralStyle } from '#lib/engine/theme/style.js';
	import { blockThemeFromResolved } from '#lib/puzzles/block-placement/themes.js';

	let {
		scoring = SCORE_DEFAULTS.block,
		round,
		roundNumber,
		best,
		showHint,
		soundEnabled,
		ontogglesound,
		onfinish,
		onhome,
		onmove,
		oncomplete,
		traySide = 'right',
		entranceReady = true,
		onready,
		resolvedTheme = null
	}: {
		round: BlockRound;
		roundNumber: number;
		best: number;
		showHint: boolean;
		soundEnabled: boolean;
		ontogglesound: () => void;
		onfinish: (
			score: number,
			lines: number,
			pieces: number,
			endReason: BlockEndReason,
			streak: number
		) => void;
		onhome: () => void;
		oncomplete?: (score: number) => void;
		onmove?: (move: { trayIndex: number; x: number; y: number }) => void;
		traySide?: 'left' | 'right';
		entranceReady?: boolean;
		onready?: () => void;
		scoring?: ScoreValues;
		resolvedTheme?: ResolvedTheme | null;
	} = $props();

	const GAP = $derived(resolvedTheme ? Math.max(2, Math.round(resolvedTheme.style.gap / 3)) : 4);
	const CLEAR_MS = 1500;
	const CLEAR_STEP_MS = 8;
	const SETTLE_MS = 120;
	const INVALID_MS = 220;
	const GAIN_MS = 600;
	const END_MS = 450;
	const ARROW_MOVES: Record<string, [number, number]> = {
		ArrowLeft: [-1, 0],
		ArrowRight: [1, 0],
		ArrowUp: [0, -1],
		ArrowDown: [0, 1]
	};
	const PIECE_COLORS: Record<PieceId, number> = {
		single: 1,
		domino: 2,
		bar3: 3,
		l3: 4,
		bar4: 1,
		square: 2,
		l4: 3,
		t4: 4,
		s4: 1
	};
	const theme = $derived(
		resolvedTheme ? blockThemeFromResolved(resolvedTheme) : blockThemeForSeed(round.seed)
	);
	const themeStyle = $derived(
		blockThemeStyle(theme) + ';' + (resolvedTheme ? proceduralStyle(resolvedTheme) : '')
	);
	const boardRows = Array.from({ length: BLOCK_BOARD_SIZE }, (_, row) =>
		Array.from({ length: BLOCK_BOARD_SIZE }, (_, column) => row * BLOCK_BOARD_SIZE + column)
	);
	const traySlots = Array.from({ length: 3 }, (_, index) => index);

	interface DragState {
		index: number;
		piece: PieceId;
		pointerId: number;
		startX: number;
		startY: number;
		grabX: number;
		grabY: number;
		grabFracX: number;
		grabFracY: number;
		moved: boolean;
		over: boolean;
		valid: boolean;
		anchorX: number;
		anchorY: number;
	}

	interface GhostState {
		piece: PieceId;
		left: number;
		top: number;
		cell: number;
		valid: boolean;
	}

	// svelte-ignore state_referenced_locally
	let game = $state(round);
	let selected = $state<number | null>(null);
	let busy = $state(true);
	let ending = $state(false);
	let entering = $state(true);
	let entrance: ReturnType<typeof motion.deal> | null = null;
	const entranceDelay = createActiveDelay(() => {
		entrance?.settle();
		entering = false;
		onready?.();
		busy = false;
	});
	let drag = $state<DragState | null>(null);
	let ghost = $state<GhostState | null>(null);
	let clearing = $state<Record<number, PieceId>>({});
	let clearDelays = $state<Record<number, number>>({});
	let settling = $state<Record<number, PieceId>>({});
	let invalidSlot = $state<number | null>(null);
	let invalidCell = $state<number | null>(null);
	let announcement = $state('');
	let gain = $state<{ amount: number; id: number } | null>(null);

	let boardEl = $state<HTMLDivElement | null>(null);
	let trayEl = $state<HTMLDivElement | null>(null);

	let keyboardAnchor = { x: 0, y: 0 };
	let suppressClick = false;
	let gainId = 0;
	let finished = false;
	let finishFailed = $state(false);
	const finishDelay = createActiveDelay(() => {
		if (finished) return;
		try {
			onfinish(game.score, game.lines, game.placements, game.endReason, game.combo);
			finished = true;
		} catch {
			finishFailed = true;
			console.error('morphi:block_finish_failed');
		}
	});

	let clearTimer: ReturnType<typeof setTimeout> | null = null;
	let settleTimer: ReturnType<typeof setTimeout> | null = null;
	let invalidTimer: ReturnType<typeof setTimeout> | null = null;
	let gainTimer: ReturnType<typeof setTimeout> | null = null;
	let suppressTimer: ReturnType<typeof setTimeout> | null = null;
	let focusFrame: number | null = null;

	function pieceColor(piece: PieceId): string {
		return `var(--piece-${PIECE_COLORS[piece]})`;
	}

	function shapeName(piece: PieceId): string {
		return t(`block.shape.${piece}` as MessageKey);
	}

	function pieceLabel(piece: PieceId, index: number): string {
		return t('block.piece', { number: index + 1, name: shapeName(piece) });
	}

	function cellPiece(index: number): PieceId | null {
		return clearing[index] ?? game.board[index];
	}

	function cellLabel(index: number): string {
		const row = Math.floor(index / BLOCK_BOARD_SIZE) + 1;
		const column = (index % BLOCK_BOARD_SIZE) + 1;
		return game.board[index] === null
			? t('block.cellEmpty', { row, column })
			: t('block.cellFilled', { row, column });
	}

	function clearTimerRef(timer: ReturnType<typeof setTimeout> | null): void {
		if (timer !== null) {
			clearTimeout(timer);
		}
	}

	function hideGhost(): void {
		ghost = null;
	}

	function boardMetrics(): { rect: DOMRect; cell: number; pitch: number } | null {
		if (!boardEl) {
			return null;
		}

		const rect = boardEl.getBoundingClientRect();
		const cell = (rect.width - (BLOCK_BOARD_SIZE - 1) * GAP) / BLOCK_BOARD_SIZE;
		return { rect, cell, pitch: cell + GAP };
	}

	function showGhostAt(piece: PieceId, x: number, y: number, valid: boolean): void {
		const metrics = boardMetrics();
		if (!metrics) {
			return;
		}

		ghost = {
			piece,
			left: metrics.rect.left + x * metrics.pitch,
			top: metrics.rect.top + y * metrics.pitch,
			cell: metrics.cell,
			valid
		};
	}

	function ghostStyle(value: GhostState): string {
		const shape = PIECE_BY_ID[value.piece];
		const width = shape.width * value.cell + (shape.width - 1) * GAP;
		const height = shape.height * value.cell + (shape.height - 1) * GAP;

		return [
			themeStyle,
			`--ghost-cell:${value.cell}px`,
			`--ghost-color:${pieceColor(value.piece)}`,
			`width:${width}px`,
			`height:${height}px`,
			`transform:translate3d(${value.left}px, ${value.top}px, 0)`
		].join(';');
	}

	function cellStyle(index: number): string | undefined {
		const piece = cellPiece(index);
		return piece ? `--cell-color:${pieceColor(piece)}` : undefined;
	}

	function miniStyle(piece: PieceId): string {
		const shape = PIECE_BY_ID[piece];
		return `--w:${shape.width};--h:${shape.height};--mini-color:${pieceColor(piece)}`;
	}

	function miniCellStyle(x: number, y: number): string {
		return `grid-column:${x + 1};grid-row:${y + 1}`;
	}

	function announce(message: string): void {
		announcement = message;
	}

	function showInvalid(index: number, cell: number | null = null): void {
		sound.play('invalid');
		invalidSlot = index;
		invalidCell = cell;
		announce(t('block.statusInvalid'));
		clearTimerRef(invalidTimer);
		invalidTimer = setTimeout(() => {
			invalidSlot = null;
			invalidCell = null;
			invalidTimer = null;
		}, INVALID_MS);
	}

	function showGain(amount: number): void {
		gain = { amount, id: ++gainId };
		clearTimerRef(gainTimer);
		gainTimer = setTimeout(() => {
			gain = null;
			gainTimer = null;
		}, GAIN_MS);
	}

	function selectPiece(index: number, fromKeyboard = false): void {
		if (busy || game.status !== 'playing') {
			return;
		}

		const piece = game.tray[index];
		if (!piece) {
			return;
		}

		selected = index;
		keyboardAnchor = { x: 0, y: 0 };
		invalidSlot = null;
		invalidCell = null;
		sound.play('pick');
		announce(t('block.statusSelected', { name: shapeName(piece) }));

		if (fromKeyboard) {
			showGhostAt(piece, 0, 0, canPlace(game.board, piece, 0, 0));
		} else {
			hideGhost();
		}
	}

	function deselect(): void {
		if (selected !== null) sound.play('deselect');
		selected = null;
		invalidSlot = null;
		invalidCell = null;
		hideGhost();
	}

	function focusTrayRelative(direction: -1 | 1): void {
		const buttons = Array.from(
			trayEl?.querySelectorAll<HTMLButtonElement>('button.tray-slot:not(.is-empty)') ?? []
		);
		if (buttons.length === 0) {
			return;
		}

		const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next = current < 0 ? 0 : (current + direction + buttons.length) % buttons.length;
		buttons[next]?.focus();
	}

	function restoreTrayFocus(): void {
		if (focusFrame !== null) cancelAnimationFrame(focusFrame);
		focusFrame = requestAnimationFrame(() => {
			focusFrame = null;
			if (game.status !== 'playing' || ending) {
				return;
			}

			const active = document.activeElement;
			const insideTray = active instanceof HTMLElement && active.closest('.tray') !== null;
			if (active !== null && active !== document.body && !insideTray) {
				return;
			}

			trayEl?.querySelector<HTMLButtonElement>('button.tray-slot:not(.is-empty)')?.focus({
				preventScroll: true
			});
		});
	}

	function moveKeyboardGhost(dx: number, dy: number): void {
		if (selected === null) {
			return;
		}

		const piece = game.tray[selected];
		if (!piece) {
			return;
		}

		const shape = PIECE_BY_ID[piece];
		keyboardAnchor = {
			x: Math.max(0, Math.min(BLOCK_BOARD_SIZE - shape.width, keyboardAnchor.x + dx)),
			y: Math.max(0, Math.min(BLOCK_BOARD_SIZE - shape.height, keyboardAnchor.y + dy))
		};
		showGhostAt(
			piece,
			keyboardAnchor.x,
			keyboardAnchor.y,
			canPlace(game.board, piece, keyboardAnchor.x, keyboardAnchor.y)
		);
	}

	function beginEnd(): void {
		if (ending) {
			return;
		}

		ending = true;
		busy = true;
		selected = null;
		hideGhost();
		sound.play('end');
		announce(game.endReason === 'cap' ? t('block.statusCap') : t('block.statusEnded'));
		finishDelay.start(motion.reduced() ? 0 : END_MS, document.hidden);
	}

	function finishPlacement(cleared: boolean, ended: boolean): void {
		if (cleared) {
			clearTimerRef(clearTimer);
			clearTimer = setTimeout(() => {
				clearing = {};
				clearTimer = null;

				if (ended) {
					beginEnd();
				} else {
					busy = false;
					restoreTrayFocus();
				}
			}, CLEAR_MS);
			return;
		}

		clearTimerRef(settleTimer);
		settleTimer = setTimeout(() => {
			settling = {};
			clearDelays = {};
			settleTimer = null;

			if (ended) {
				beginEnd();
			} else {
				busy = false;
				restoreTrayFocus();
			}
		}, SETTLE_MS);
	}

	function placeAt(trayIndex: number, x: number, y: number): boolean {
		if (busy || game.status !== 'playing') {
			return false;
		}

		const refilling = game.tray.filter(Boolean).length === 1;
		const result = placeBlockPiece(game, trayIndex, x, y, scoring);
		if (result.effect === 'invalid') {
			const cell =
				x >= 0 && x < BLOCK_BOARD_SIZE && y >= 0 && y < BLOCK_BOARD_SIZE
					? y * BLOCK_BOARD_SIZE + x
					: null;
			showInvalid(trayIndex, cell);
			return false;
		}

		game = result.round;
		if (refilling && game.status === 'playing') sound.play('refill');
		onmove?.({ trayIndex, x, y });
		if (game.status === 'ended') oncomplete?.(game.score);
		selected = null;
		invalidSlot = null;
		hideGhost();
		busy = true;

		if (result.effect === 'cleared') {
			const cleared: Record<number, PieceId> = {};
			const clearedCells = Array.from({ length: BLOCK_BOARD_SIZE * BLOCK_BOARD_SIZE }, () => false);
			for (const cell of result.cleared) {
				cleared[cell.index] = cell.piece;
				clearedCells[cell.index] = true;
			}

			const rows: number[] = [];
			const columns: number[] = [];

			for (let row = 0; row < BLOCK_BOARD_SIZE; row += 1) {
				let full = true;
				for (let column = 0; column < BLOCK_BOARD_SIZE; column += 1) {
					if (!clearedCells[row * BLOCK_BOARD_SIZE + column]) {
						full = false;
						break;
					}
				}
				if (full) {
					rows.push(row);
				}
			}

			for (let column = 0; column < BLOCK_BOARD_SIZE; column += 1) {
				let full = true;
				for (let row = 0; row < BLOCK_BOARD_SIZE; row += 1) {
					if (!clearedCells[row * BLOCK_BOARD_SIZE + column]) {
						full = false;
						break;
					}
				}
				if (full) {
					columns.push(column);
				}
			}

			const delays: Record<number, number> = {};
			for (const cell of result.cleared) {
				const row = Math.floor(cell.index / BLOCK_BOARD_SIZE);
				const column = cell.index % BLOCK_BOARD_SIZE;
				const rowDelay = rows.includes(row) ? column * CLEAR_STEP_MS : CLEAR_MS;
				const columnDelay = columns.includes(column) ? row * CLEAR_STEP_MS : CLEAR_MS;
				delays[cell.index] = Math.min(rowDelay, columnDelay);
			}

			clearing = cleared;
			clearDelays = delays;
			settling = {};
			sound.play(
				result.round.combo > 1 || result.lines > 1 ? 'combo' : 'clear',
				result.round.combo - 1
			);
			showGain(result.gained);
		} else {
			const settled: Record<number, PieceId> = {};
			for (const index of result.placed) {
				settled[index] = result.round.board[index] as PieceId;
			}
			settling = settled;
			clearing = {};
			sound.play('place');
		}

		if (result.lines === 1) {
			announce(
				t('block.statusLine', {
					points: formatNumber(result.gained),
					score: formatNumber(game.score)
				})
			);
		} else if (result.lines > 1) {
			announce(
				t('block.statusLines', {
					lines: result.lines,
					points: formatNumber(result.gained),
					score: formatNumber(game.score)
				})
			);
		} else {
			announce(t('block.statusPlaced', { score: formatNumber(game.score) }));
		}

		finishPlacement(result.effect === 'cleared', result.round.status === 'ended');
		return true;
	}

	function boardCellFromEvent(event: MouseEvent | PointerEvent): { x: number; y: number } | null {
		const target = event.target;
		if (!(target instanceof Element)) {
			return null;
		}

		const cell = target.closest<HTMLElement>('[data-index]');
		if (!cell || !boardEl?.contains(cell)) {
			return null;
		}

		const index = Number(cell.dataset.index);
		if (!Number.isSafeInteger(index)) {
			return null;
		}

		return { x: index % BLOCK_BOARD_SIZE, y: Math.floor(index / BLOCK_BOARD_SIZE) };
	}

	function handleBoardClick(event: MouseEvent): void {
		if (suppressClick || busy || game.status !== 'playing' || selected === null) {
			return;
		}

		const position = boardCellFromEvent(event);
		if (!position) {
			return;
		}

		placeAt(selected, position.x, position.y);
	}

	function handleBoardPointerMove(event: PointerEvent): void {
		if (drag || busy || selected === null || game.status !== 'playing') {
			return;
		}

		if (event.pointerType !== 'mouse') {
			return;
		}

		const piece = game.tray[selected];
		const position = boardCellFromEvent(event);
		if (!piece || !position) {
			return;
		}

		showGhostAt(piece, position.x, position.y, canPlace(game.board, piece, position.x, position.y));
	}

	function handleBoardPointerLeave(): void {
		if (!drag) {
			hideGhost();
		}
	}

	function startDrag(event: PointerEvent, index: number): void {
		if (
			drag !== null ||
			!event.isPrimary ||
			busy ||
			game.status !== 'playing' ||
			(event.pointerType === 'mouse' && event.button !== 0)
		) {
			return;
		}

		const piece = game.tray[index];
		const slot = event.currentTarget;
		if (!piece || !(slot instanceof HTMLButtonElement)) {
			return;
		}

		const mini = slot.querySelector<HTMLElement>('.mini');
		const rect = mini?.getBoundingClientRect();
		const shape = PIECE_BY_ID[piece];
		const pitch = rect ? rect.width / shape.width : 22;
		const grabX = rect
			? Math.max(0, Math.min(shape.width - 1, Math.floor((event.clientX - rect.left) / pitch)))
			: 0;
		const grabY = rect
			? Math.max(0, Math.min(shape.height - 1, Math.floor((event.clientY - rect.top) / pitch)))
			: 0;
		const grabFracX = rect
			? Math.max(0, Math.min(1, (event.clientX - rect.left - grabX * pitch) / pitch))
			: 0.5;
		const grabFracY = rect
			? Math.max(0, Math.min(1, (event.clientY - rect.top - grabY * pitch) / pitch))
			: 0.5;

		drag = {
			index,
			piece,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			grabX,
			grabY,
			grabFracX,
			grabFracY,
			moved: false,
			over: false,
			valid: false,
			anchorX: 0,
			anchorY: 0
		};
		try {
			slot.setPointerCapture(event.pointerId);
		} catch {
			cancelDrag();
			console.error('morphi:pointer_capture_failed');
			return;
		}
		sound.unlock();
	}

	function moveDrag(event: PointerEvent): void {
		if (!drag || event.pointerId !== drag.pointerId) {
			return;
		}

		const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
		if (!drag.moved && distance <= 6) {
			return;
		}

		if (!drag.moved) {
			drag = { ...drag, moved: true };
			selected = null;
			sound.play('pick');
		}

		const current = drag;
		const metrics = boardMetrics();
		if (!metrics) {
			return;
		}

		const over =
			event.clientX >= metrics.rect.left &&
			event.clientX <= metrics.rect.right &&
			event.clientY >= metrics.rect.top &&
			event.clientY <= metrics.rect.bottom;

		let left: number;
		let top: number;
		let anchorX = 0;
		let anchorY = 0;
		let valid = false;

		if (over) {
			const boardX = Math.max(
				0,
				Math.min(
					BLOCK_BOARD_SIZE - 1,
					Math.floor((event.clientX - metrics.rect.left) / metrics.pitch)
				)
			);
			const boardY = Math.max(
				0,
				Math.min(
					BLOCK_BOARD_SIZE - 1,
					Math.floor((event.clientY - metrics.rect.top) / metrics.pitch)
				)
			);
			anchorX = boardX - current.grabX;
			anchorY = boardY - current.grabY;
			left = metrics.rect.left + anchorX * metrics.pitch;
			top = metrics.rect.top + anchorY * metrics.pitch;
			valid = canPlace(game.board, current.piece, anchorX, anchorY);
		} else {
			left = event.clientX - (current.grabX + current.grabFracX) * metrics.pitch;
			top = event.clientY - (current.grabY + current.grabFracY) * metrics.pitch;
		}

		drag = { ...current, over, valid, anchorX, anchorY };
		ghost = {
			piece: current.piece,
			left,
			top,
			cell: metrics.cell,
			valid: valid || !over
		};
	}

	function endDrag(event: PointerEvent): void {
		if (!drag || event.pointerId !== drag.pointerId) {
			return;
		}

		// The final pointerup can have newer coordinates than the last pointermove.
		moveDrag(event);
		const current = drag;

		if (!current.moved) {
			drag = null;
			return;
		}

		event.preventDefault();
		drag = null;
		hideGhost();
		suppressClick = true;
		clearTimerRef(suppressTimer);
		suppressTimer = setTimeout(() => {
			suppressClick = false;
			suppressTimer = null;
		}, 60);

		if (current.over && current.valid) {
			placeAt(current.index, current.anchorX, current.anchorY);
		} else {
			const cell =
				current.over &&
				current.anchorX >= 0 &&
				current.anchorX < BLOCK_BOARD_SIZE &&
				current.anchorY >= 0 &&
				current.anchorY < BLOCK_BOARD_SIZE
					? current.anchorY * BLOCK_BOARD_SIZE + current.anchorX
					: null;
			showInvalid(current.index, cell);
		}
	}

	function cancelDrag(): void {
		if (!drag) {
			return;
		}

		drag = null;
		hideGhost();
	}

	function handlePointerCancel(event: PointerEvent): void {
		if (drag?.pointerId === event.pointerId) cancelDrag();
	}

	function handleTrayClick(index: number): void {
		if (suppressClick || busy || game.status !== 'playing') {
			return;
		}

		if (selected === index) {
			deselect();
			return;
		}

		selectPiece(index);
	}

	function handleTrayKeydown(event: KeyboardEvent, index: number): void {
		if (busy || game.status !== 'playing') {
			return;
		}

		const key = event.key;
		if (event.repeat && (key === 'Enter' || key === ' ')) {
			event.preventDefault();
			return;
		}

		if (key === 'Escape') {
			if (selected !== null) {
				event.preventDefault();
				deselect();
			}
			return;
		}

		if (selected === null) {
			if (key === 'ArrowLeft' || key === 'ArrowRight') {
				event.preventDefault();
				focusTrayRelative(key === 'ArrowLeft' ? -1 : 1);
				return;
			}

			if (key === 'Enter' || key === ' ') {
				event.preventDefault();
				selectPiece(index, true);
			}
			return;
		}

		if (index !== selected && (key === 'Enter' || key === ' ')) {
			event.preventDefault();
			selectPiece(index, true);
			return;
		}

		if (key === 'Enter' || key === ' ') {
			event.preventDefault();
			placeAt(selected, keyboardAnchor.x, keyboardAnchor.y);
			return;
		}

		const move = ARROW_MOVES[key];
		if (!move) {
			return;
		}

		event.preventDefault();
		moveKeyboardGhost(move[0], move[1]);
	}

	function handleWindowKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') {
			return;
		}

		if (drag) {
			cancelDrag();
		}

		if (selected !== null) {
			deselect();
		}
	}

	function handleVisibility(): void {
		if (document.hidden) {
			finishDelay.pause();
			entrance?.pause();
			entranceDelay.pause();
			cancelDrag();
			hideGhost();
		} else {
			finishDelay.resume();
			entrance?.resume();
			entranceDelay.resume();
		}
	}

	function handleResize(): void {
		cancelDrag();
		hideGhost();
	}

	let mounted = $state(false);
	let entranceStarted = false;
	$effect(() => {
		if (!mounted || !entranceReady || entranceStarted) return;
		untrack(() => {
			entranceStarted = true;
			const duration = motion.reduced() ? 0 : BLOCK_ENTRANCE_MS;
			entrance = motion.deal(
				[
					...Array.from(boardEl?.querySelectorAll<HTMLElement>('.cell') ?? []),
					...Array.from(trayEl?.querySelectorAll<HTMLElement>('.tray-slot') ?? [])
				],
				duration
			);
			entranceDelay.start(duration, document.hidden);
			sound.play('deal');
		});
	});

	onMount(() => {
		const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
		const preferenceChanged = () => {
			if (entranceStarted && motionQuery.matches && entering)
				entranceDelay.start(0, document.hidden);
		};
		motionQuery.addEventListener('change', preferenceChanged);
		mounted = true;
		document.addEventListener('keydown', handleWindowKeydown);
		document.addEventListener('visibilitychange', handleVisibility);
		window.addEventListener('resize', handleResize);
		window.addEventListener('blur', handleResize);
		boardEl?.addEventListener('click', handleBoardClick);

		return () => {
			motionQuery.removeEventListener('change', preferenceChanged);
			document.removeEventListener('keydown', handleWindowKeydown);
			document.removeEventListener('visibilitychange', handleVisibility);
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('blur', handleResize);
			boardEl?.removeEventListener('click', handleBoardClick);
			clearTimerRef(clearTimer);
			clearTimerRef(settleTimer);
			clearTimerRef(invalidTimer);
			clearTimerRef(gainTimer);
			finishDelay.cancel();
			entranceDelay.cancel();
			entrance?.destroy();
			clearTimerRef(suppressTimer);
			if (focusFrame !== null) cancelAnimationFrame(focusFrame);
		};
	});
</script>

{#if finishFailed}<p role="alert">{t('ending.error')}</p>{/if}

<div
	class="game"
	class:is-over={ending}
	style={`${themeStyle};--block-grid-gap:${GAP}px`}
	data-theme={theme.id}
	data-theme-version={resolvedTheme?.themeConfigVersion}
	data-theme-generator={resolvedTheme?.themeGeneratorVersion}
	data-family="block"
	data-round={roundNumber}
	data-phase={entering ? 'dealing' : 'playing'}
>
	<h2 class="sr-only">{t('block.title')}</h2>

	<header class="hud">
		<button type="button" class="home-button" aria-label={t('block.home')} onclick={onhome}>
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
				<span class="stat-label">{t('block.score')}</span>
				{#key game.score}
					<strong class:is-bump={game.score > 0}>{formatNumber(game.score)}</strong>
				{/key}
			</div>
			<div class="stat">
				<span class="stat-label">{t('block.lines')}</span>
				<strong>{formatNumber(game.lines)}</strong>
			</div>
			<div class="stat">
				<span class="stat-label">{t('block.streak')}</span>
				{#key game.combo}
					<strong class:is-bump={game.combo > 0}>{game.combo > 0 ? `×${game.combo}` : '—'}</strong>
				{/key}
			</div>
		</div>

		<SoundToggle enabled={soundEnabled} ontoggle={ontogglesound} />

		<p class="round-meta">
			<span>{t('block.round', { number: roundNumber })}</span>
			<span>{t('block.best', { score: formatNumber(best) })}</span>
		</p>
	</header>

	<main class="stage" data-tray={traySide}>
		<div class="board-wrap">
			<div
				class="board"
				bind:this={boardEl}
				role="grid"
				tabindex="-1"
				aria-label={t('block.board')}
				onpointermove={handleBoardPointerMove}
				onpointerleave={handleBoardPointerLeave}
			>
				{#each boardRows as row, rowIndex (rowIndex)}
					<div class="row" role="row">
						{#each row as index (index)}
							{@const piece = cellPiece(index)}
							<div
								class="cell"
								class:is-filled={piece !== null}
								class:is-clearing={clearing[index] !== undefined}
								class:is-settling={settling[index] !== undefined}
								data-entering={entering}
								class:is-invalid={invalidCell === index}
								style={`${cellStyle(index) ?? ''};--ripple:${(rowIndex + (index % BLOCK_BOARD_SIZE)) * 12}ms;--clear-delay:${clearDelays[index] ?? 0}ms`}
								data-index={index}
								role="gridcell"
								aria-label={cellLabel(index)}
							></div>
						{/each}
					</div>
				{/each}
			</div>

			{#if gain}
				{#key gain.id}
					<span class="gain is-show" aria-hidden="true">
						+{formatNumber(gain.amount)}
					</span>
				{/key}
			{/if}
		</div>

		<div class="tray" bind:this={trayEl} role="group" aria-label={t('block.tray')}>
			{#each traySlots as index (index)}
				{@const piece = game.tray[index]}
				{#if piece}
					<button
						type="button"
						class="tray-slot"
						class:is-selected={selected === index}
						class:is-source={drag?.index === index}
						class:is-invalid={invalidSlot === index}
						aria-label={pieceLabel(piece, index)}
						aria-pressed={selected === index}
						aria-disabled={busy || game.status !== 'playing'}
						data-tray-index={index}
						onclick={() => handleTrayClick(index)}
						onkeydown={(event) => handleTrayKeydown(event, index)}
						onpointerdown={(event) => startDrag(event, index)}
						onpointermove={moveDrag}
						onpointerup={endDrag}
						onpointercancel={handlePointerCancel}
						onlostpointercapture={handlePointerCancel}
					>
						<span class="mini" style={miniStyle(piece)} aria-hidden="true">
							{#each PIECE_BY_ID[piece].cells as cell (`${cell.x},${cell.y}`)}
								<span class="mini-cell" style={miniCellStyle(cell.x, cell.y)}></span>
							{/each}
						</span>
					</button>
				{:else}
					<div
						class="tray-slot is-empty"
						aria-label={t('block.emptySlot')}
						data-tray-index={index}
					></div>
				{/if}
			{/each}
		</div>
	</main>

	{#if showHint}
		<footer class="hint">
			<span>
				{selected !== null
					? t('block.hintSelected')
					: game.placements === 0
						? t('block.hint')
						: t('block.hintShort')}
			</span>
		</footer>
	{/if}

	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
</div>

{#if ghost}
	{@const shape = PIECE_BY_ID[ghost.piece]}
	<div class="ghost" class:is-invalid={!ghost.valid} style={ghostStyle(ghost)} aria-hidden="true">
		{#each shape.cells as cell (`${cell.x},${cell.y}`)}
			<span
				class="ghost-cell"
				style={`left:${cell.x * (ghost.cell + GAP)}px;top:${cell.y * (ghost.cell + GAP)}px`}
			></span>
		{/each}
	</div>
{/if}

<style>
	.game {
		position: relative;
		isolation: isolate;
		height: 100vh;
		height: 100dvh;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 4px;
		padding: calc(10px + var(--safe-top)) 0 calc(8px + var(--safe-bottom));
		background: var(--block-bg);
		overflow: hidden;
	}

	.hud {
		position: relative;
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) 44px;
		align-items: center;
		column-gap: 8px;
		row-gap: 2px;
		padding-inline: calc(14px + var(--safe-left)) calc(14px + var(--safe-right));
	}

	.home-button {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--border-strong);
		border-radius: 14px;
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
		transition: background var(--dur-instant) linear;
	}

	.home-button:hover {
		background: var(--surface-2);
	}

	.home-button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	.home-button svg {
		width: 22px;
		height: 22px;
	}

	.stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(12px, 5vw, 44px);
		min-width: 0;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
		min-width: 0;
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
		font-size: clamp(1rem, 4.2vw, 1.5rem);
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.stat strong.is-bump {
		animation: stat-bump 160ms var(--ease-out);
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
		align-items: baseline;
		justify-content: center;
		gap: 14px;
		color: var(--ink-2);
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.stage {
		display: grid;
		grid-template-rows: auto auto;
		place-content: center;
		justify-items: center;
		gap: 12px;
		min-height: 0;
		padding: 4px 0;
	}

	.board-wrap {
		z-index: 1;
		position: relative;
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.board {
		position: relative;
		display: grid;
		grid-template-rows: repeat(8, minmax(0, 1fr));
		gap: var(--block-grid-gap, 1px);
		width: min(100vw, 440px, calc(100dvh - 248px));
		aspect-ratio: 1;
		touch-action: none;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: var(--block-grid-gap, 1px);
		min-height: 0;
	}

	.cell {
		clip-path: var(--theme-clip, none);
		position: relative;
		min-width: 0;
		min-height: 0;
		border: 1px solid var(--block-cell-edge);
		border-radius: var(--block-radius);
		background: var(--block-cell);
	}

	@keyframes cell-in {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.cell.is-filled {
		border-color: var(--block-cell-edge);
	}

	.cell.is-filled::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: var(--cell-color);
	}

	.game[data-theme-version] .cell {
		border: 0;
		background: var(--block-cell-edge);
	}
	.game[data-theme-version] .cell::after {
		content: '';
		position: absolute;
		inset: 1px;
		border-radius: inherit;
		clip-path: inherit;
		background: var(--block-cell);
	}
	.game[data-theme-version] .cell.is-filled::before {
		inset: 1px;
		z-index: 1;
		clip-path: inherit;
	}
	.game[data-theme-version] .mini-cell {
		clip-path: var(--theme-clip, none);
		border-radius: var(--block-radius);
	}
	.ghost-cell {
		clip-path: var(--theme-clip, none);
	}

	.cell.is-settling {
		animation: settle 100ms var(--ease-out);
	}

	.cell.is-invalid {
		z-index: 2;
		outline: 2px solid var(--danger);
		outline-offset: -2px;
		animation: cell-shake 220ms var(--ease-out);
	}

	@keyframes cell-shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-2px);
		}
		75% {
			transform: translateX(2px);
		}
	}

	.cell.is-clearing {
		z-index: 2;
		border-color: var(--block-cell-edge);
	}

	.cell.is-clearing::before {
		animation: clear-cell 1440ms var(--ease-out) var(--clear-delay, 0ms) forwards;
	}

	@keyframes settle {
		0% {
			transform: scale(0.86);
		}
		65% {
			transform: scale(1.04);
		}
		100% {
			transform: scale(1);
		}
	}

	@keyframes clear-cell {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		18% {
			transform: scale(1.08);
			opacity: 1;
		}
		100% {
			transform: scale(0.08);
			opacity: 0;
		}
	}

	.gain {
		position: absolute;
		left: 50%;
		top: 48%;
		z-index: 5;
		padding: 2px 12px;
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		background: var(--surface);
		pointer-events: none;
		color: var(--ink);
		font-size: clamp(1.25rem, 5vw, 1.75rem);
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.03em;
		opacity: 0;
		transform: translate(-50%, -50%);
	}

	.gain.is-show {
		animation: gain-float 600ms var(--ease-out) forwards;
	}

	@keyframes gain-float {
		0% {
			opacity: 0;
			transform: translate(-50%, -40%) scale(0.92);
		}
		15% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
		70% {
			opacity: 1;
			transform: translate(-50%, -88%) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -110%) scale(1);
		}
	}

	.tray {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: min(calc(100vw - 20px), 330px);
		padding: 8px;
		border: 1px solid var(--block-cell-edge);
		border-radius: 22px;
		background: var(--block-tray);
		animation: tray-in 200ms var(--ease-out) backwards;
	}

	@keyframes tray-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.tray-slot {
		--mini-cell: 20px;
		--mini-gap: 2px;
		position: relative;
		width: 92px;
		height: 92px;
		display: grid;
		place-items: center;
		flex: 1 1 0;
		min-width: 0;
		padding: 0;
		border: 1px solid var(--block-cell-edge);
		border-radius: 16px;
		background: var(--block-tray-slot);
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		transition:
			background var(--dur-instant) linear,
			transform var(--dur-instant) ease-out,
			outline-color var(--dur-instant) linear;
	}

	.tray-slot:hover {
		background: var(--block-cell-edge);
	}

	.tray-slot:active {
		transform: scale(0.97);
	}

	.tray-slot:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	.tray-slot.is-selected {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		background: var(--block-tray);
		transform: scale(1.05);
	}

	.tray-slot.is-selected .mini {
		animation: pick-pop 100ms var(--ease-out);
	}

	@keyframes pick-pop {
		from {
			transform: scale(0.9);
		}
		to {
			transform: scale(1);
		}
	}

	.tray-slot.is-source {
		opacity: 0.35;
	}

	.tray-slot.is-invalid {
		animation: tray-shake 220ms var(--ease-out);
	}

	.tray-slot.is-empty {
		border: 1px dashed var(--border-strong);
		background: transparent;
		cursor: default;
	}

	@keyframes tray-shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-4px);
		}
		50% {
			transform: translateX(4px);
		}
		75% {
			transform: translateX(-2px);
		}
	}

	.mini {
		display: grid;
		grid-template-columns: repeat(var(--w), var(--mini-cell));
		grid-template-rows: repeat(var(--h), var(--mini-cell));
		gap: var(--mini-gap);
		pointer-events: none;
	}

	.mini-cell {
		width: var(--mini-cell);
		height: var(--mini-cell);
		border-radius: 6px;
		background: var(--mini-color);
	}

	.hint {
		padding: 0 calc(14px + var(--safe-left)) calc(4px + var(--safe-bottom))
			calc(14px + var(--safe-right));
		text-align: center;
		color: var(--ink-2);
		font-size: var(--text-13);
		font-weight: 700;
	}

	.ghost {
		position: fixed;
		inset: 0 auto auto 0;
		z-index: 50;
		pointer-events: none;
		will-change: transform;
	}

	.ghost-cell {
		position: absolute;
		width: var(--ghost-cell);
		height: var(--ghost-cell);
		border-radius: var(--block-radius);
		background: var(--ghost-color);
		opacity: 0.78;
	}

	.ghost.is-invalid .ghost-cell {
		background: var(--danger);
		opacity: 0.65;
	}

	.game.is-over .board-wrap,
	.game.is-over .tray,
	.game.is-over .hint {
		opacity: 0.45;
		transition: opacity 300ms linear;
	}

	.game.is-over .tray-slot {
		cursor: default;
	}

	@media (min-width: 600px) and (max-width: 1023px) {
		.board {
			width: min(480px, calc(100vw - 48px), calc(100dvh - 258px));
		}
	}

	@media (min-width: 1024px) and (min-height: 521px) {
		.stage {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
			grid-template-rows: auto;
			align-items: center;
			justify-items: center;
			column-gap: clamp(24px, 3vw, 40px);
		}

		.board-wrap {
			grid-column: 2;
			width: auto;
		}

		.board {
			width: min(calc(100vw - 320px), calc(100dvh - 218px), 520px);
		}

		.tray {
			grid-column: 3;
			justify-self: start;
			align-self: center;
			flex-direction: column;
			width: 112px;
			padding: 10px;
		}

		.tray-slot {
			flex: 0 0 auto;
			width: 92px;
			height: 92px;
		}

		.stage[data-tray='left'] .tray {
			grid-column: 1;
			justify-self: end;
		}
	}

	@media (orientation: landscape) and (max-height: 520px) {
		.game {
			gap: 2px;
			padding-top: calc(4px + var(--safe-top));
		}

		.hud {
			padding-inline: calc(8px + var(--safe-left)) calc(8px + var(--safe-right));
		}

		.stage {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
			grid-template-rows: auto;
			align-items: center;
			justify-items: center;
			column-gap: 16px;
			padding: 2px calc(8px + var(--safe-right)) 2px calc(8px + var(--safe-left));
		}

		.board-wrap {
			grid-column: 2;
			width: auto;
		}

		.board {
			width: min(calc(100vw - 216px), calc(100dvh - 82px), 440px);
		}

		.tray {
			grid-column: 3;
			justify-self: start;
			align-self: center;
			flex-direction: column;
			width: 92px;
			padding: 6px;
			border-radius: 16px;
		}

		.tray-slot {
			--mini-cell: 16px;
			--mini-gap: 1px;
			flex: 0 0 auto;
			width: 72px;
			height: 72px;
		}

		.hint {
			display: none;
		}

		.stage[data-tray='left'] .tray {
			grid-column: 1;
			justify-self: end;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tray-slot,
		.game.is-over .board-wrap,
		.game.is-over .tray,
		.game.is-over .hint {
			transition: none;
		}

		.cell.is-clearing::before,
		.cell.is-invalid,
		.cell.is-settling,
		.stat strong.is-bump,
		.tray,
		.tray-slot.is-invalid,
		.tray-slot.is-selected .mini {
			animation: none;
		}

		.cell.is-clearing::before {
			opacity: 0;
		}

		.tray-slot.is-selected {
			transform: none;
		}

		.gain.is-show {
			animation: none;
			opacity: 1;
			transform: translate(-50%, -50%);
		}
	}
</style>
