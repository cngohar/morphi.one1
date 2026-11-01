/** Isolated visual proof. No play route, account/network calls or saved scores. */
import { createMemoryRound, createBlockRound } from '../src/lib/catalog.js';
import { generateTheme, type ResolvedTheme } from '../src/lib/engine/theme/generator.js';
import { t, type MessageKey } from '../src/lib/i18n/messages.js';
import { motion, cardProofMotion } from '../src/lib/ui/motion.js';
import { createActiveDelay } from '../src/lib/ui/active-delay.js';
import { puzzleBackdrop } from '../src/lib/ui/puzzle-backdrop.js';
import { setBackdropBounds } from '../src/lib/ui/backdrop-layout.js';
import { randomSeed } from '../src/lib/seeds.js';
import {
	memoryEntranceMs,
	MEMORY_PREVIEW_MS,
	MEMORY_HIDE_MS,
	BLOCK_ENTRANCE_MS
} from '../src/lib/round-timing.js';

const root = document.querySelector<HTMLElement>('#proof')!;
const node = <T = HTMLElement>(selector: string) => root.querySelector(selector) as T;
for (const element of document.querySelectorAll<HTMLElement>('[data-message]'))
	element.textContent = t(element.dataset.message as MessageKey);
document.title = t('v11.proof.title');
node('#review-tools').appendChild(node('.review-controls'));
const familyChoice = node<HTMLSelectElement>('#family');
const loadChoice = node<HTMLSelectElement>('#load');
const motionChoice = node<HTMLSelectElement>('#motion');
const finishButton = node<HTMLButtonElement>('#finish');
const replayButton = node<HTMLButtonElement>('#replay');
const retryButton = node<HTMLButtonElement>('#retry');
const name = node('#puzzle-name');
const status = node('#status');
const media = matchMedia('(prefers-reduced-motion: reduce)');
let alive = true;
let busy = false;
let theme: ResolvedTheme | null = null;
let currentFamily: 'memory' | 'block' = 'memory';
let currentScore = 0;
let failedOnce = false;
let count = 0;
const stack: { family: string; score: number; color: string }[] = [];
let cardMotion: ReturnType<typeof cardProofMotion> | null = null;
let entrance: ReturnType<typeof motion.deal> | null = null;
const deadlines = new Set<ReturnType<typeof createActiveDelay>>();
const staticMode = () => media.matches || motionChoice.value === 'off';
function wait(ms: number) {
	return new Promise<void>((resolve) => {
		const delay = createActiveDelay(() => {
			deadlines.delete(delay);
			resolve();
		});
		deadlines.add(delay);
		delay.start(ms, document.hidden);
	});
}
function visibility() {
	for (const delay of deadlines) {
		if (document.hidden) delay.pause();
		else delay.resume();
	}
	if (document.hidden) {
		cardMotion?.pause();
		entrance?.pause();
	} else {
		cardMotion?.resume();
		entrance?.resume();
	}
}
function settleMotion() {
	cardMotion?.destroy();
	cardMotion = null;
}
function beat(phase: 'deal' | 'flip' | 'unfold' | 'fold' | 'result' | 'result-exit') {
	const exitFrom = phase === 'result-exit' ? cardMotion?.resultFrame() : undefined;
	settleMotion();
	cardMotion = cardProofMotion(root, phase, staticMode(), exitFrom);
}
function phase(value: string) {
	root.dataset.phase = value;
}
function controls() {
	finishButton.disabled = busy || root.dataset.phase !== 'playing';
	replayButton.disabled = busy;
	familyChoice.disabled = busy;
	node<HTMLButtonElement>('#next').disabled = busy;
}
function setTheme(value: ResolvedTheme) {
	root.style.setProperty('--round-bg', value.background);
	root.style.setProperty('--round-back', value.back);
	root.style.setProperty('--round-edge', value.edge);
	root.style.setProperty('--gap', `${value.style.gap}px`);
	root.style.setProperty(
		'--radius',
		value.container === 'circle' ? '50%' : `${value.style.radius}%`
	);
	const backdrop = puzzleBackdrop(value);
	node('.proof-scatter').innerHTML = backdrop.items
		.map(
			(item) =>
				`<svg data-item="${item.kind}" data-band="${item.band}" viewBox="0 0 60 60" style="--item-x:${item.x};--item-y:${item.y}%;transform:translate(-50%,-50%) rotate(${item.rotate}deg);color:${backdrop.color}">${value.family === 'memory' ? `<rect x="12" y="5" width="36" height="50" rx="5" fill="currentColor"/><path d="${item.glyph}" transform="translate(19 19) scale(.45)" fill="${value.background}"/>` : `<path d="${item.path}" fill="currentColor"/>`}</svg>`
		)
		.join('');
}
function renderBoard(value: ResolvedTheme) {
	const board = node('.proof-board');
	board.dataset.family = currentFamily;
	const stat = (label: MessageKey, value: string) =>
		`<span>${t(label)}<strong>${value}</strong></span>`;
	node('.proof-hud').innerHTML =
		currentFamily === 'memory'
			? stat('game.score', '0') + stat('game.time', '0:00') + stat('v1.game.pairs', '0 / 6')
			: stat('block.score', '0') + stat('block.lines', '0') + stat('block.streak', '—');
	if (currentFamily === 'memory') {
		const round = createMemoryRound(value.seed);
		const shown = [...round.cards.slice(0, 6), ...round.cards.slice(0, 6)];
		node('.proof-grid').innerHTML = shown
			.map(
				(_, i) =>
					`<div class="sample-memory" aria-hidden="true"><div class="sample-inner"><div class="sample-front"><svg viewBox="0 0 48 48"><path d="${value.symbols[i % 6].path}" fill="${value.colors[i % value.colors.length]}" fill-rule="evenodd"/></svg></div><div class="sample-back"><i></i></div></div></div>`
			)
			.join('');
	} else {
		const round = createBlockRound(value.seed);
		node('.proof-grid').innerHTML = round.board
			.map(
				(_, i) =>
					`<div class="sample-block" aria-hidden="true"${i > 39 && i % 5 !== 0 ? ` style="background:${value.colors[Math.floor(i / 8) % value.colors.length]}"` : ''}></div>`
			)
			.join('');
	}
}
type PreparedScene = { value: ResolvedTheme | null };
function prepareScene(family: 'memory' | 'block'): Promise<PreparedScene> {
	const mode = loadChoice.value;
	return (async () => {
		await wait(mode === 'slow' ? 4500 : 200);
		if (mode === 'fail' && !failedOnce) {
			failedOnce = true;
			throw new Error('fixture_preparation');
		}
		return { value: generateTheme(randomSeed(), family) };
	})().catch(() => ({ value: null }));
}
async function deal(preparing?: Promise<PreparedScene>) {
	if (busy || !alive) return;
	busy = true;
	root.dataset.static = String(staticMode());
	entrance?.destroy();
	entrance = null;
	currentFamily = familyChoice.value === 'block' ? 'block' : 'memory';
	name.textContent = '';
	status.textContent = t('round.starting');
	retryButton.hidden = true;
	node('.proof-card-front strong').textContent = '';
	node('.proof-card-front span').textContent = '';
	phase('dealing');
	controls();
	beat('deal');
	try {
		let ready = false;
		// Start work with the deal; the animation is never the readiness signal.
		const guardedWork = (preparing ?? prepareScene(currentFamily)).then((prepared) => {
			ready = Boolean(prepared.value);
			return prepared;
		});
		await wait(staticMode() ? 0 : 650);
		if (!ready) phase('waiting');
		const prepared = await guardedWork;
		if (!alive) return;
		if (!prepared.value) throw new Error('proof_preparation');
		theme = prepared.value;
		setTheme(theme);
		renderBoard(theme);
		currentScore = currentFamily === 'memory' ? 1200 : 450;
		const label = t(currentFamily === 'memory' ? 'v1.game.memory' : 'v1.game.block');
		node('.proof-card-front strong').textContent = label;
		phase('flipping');
		beat('flip');
		await wait(staticMode() ? 0 : 200);
		name.textContent = label;
		await wait(staticMode() ? 0 : 200);
		phase('unfolding');
		setBackdropBounds(node('.proof-scatter'), node('.proof-board').getBoundingClientRect());
		beat('unfold');
		await wait(staticMode() ? 120 : 800);
		settleMotion();
		phase('arriving');
		status.textContent = t('v1.game.arriving');
		const duration = staticMode()
			? 0
			: currentFamily === 'memory'
				? memoryEntranceMs(6)
				: BLOCK_ENTRANCE_MS;
		entrance = motion.deal(
			[...root.querySelectorAll<HTMLElement>('.sample-memory,.sample-block')],
			duration
		);
		await wait(duration);
		entrance.settle();
		if (currentFamily === 'memory') {
			phase('preview');
			status.textContent = t('status.memorize');
			await wait(MEMORY_PREVIEW_MS);
			phase('hiding');
			await wait(MEMORY_HIDE_MS);
		}
		phase('playing');
		status.textContent = t('v11.proof.ready');
	} catch {
		settleMotion();
		phase('failed');
		status.textContent = t('round.startError');
		retryButton.hidden = false;
		console.warn('morphi:proof_preparation_unavailable');
	} finally {
		busy = false;
		controls();
	}
}
async function finish() {
	if (busy || root.dataset.phase !== 'playing' || !theme) return;
	busy = true;
	phase('folding');
	controls();
	node('.proof-card-front span').textContent = `${t('v1.game.best')} ${currentScore}`;
	root.dataset.stackIndex = String(Math.min(count, 7));
	beat('fold');
	await wait(staticMode() ? 0 : 900);
	if (!alive) return;
	settleMotion();
	count++;
	stack.push({ family: name.textContent ?? '', score: currentScore, color: theme.back });
	node('.sample-score').textContent = String(currentScore);
	node('.sample-high').textContent = String(currentScore);
	const resultStats: { label: MessageKey; value: string }[] =
		currentFamily === 'memory'
			? [
					{ label: 'v1.game.pairs', value: '6' },
					{ label: 'v1.game.mismatches', value: '2' },
					{ label: 'game.time', value: '0:42' }
				]
			: [
					{ label: 'block.lines', value: '3' },
					{ label: 'v1.game.moves', value: '14' },
					{ label: 'block.streak', value: '×2' }
				];
	node('.proof-result-stats').innerHTML = resultStats
		.map((stat) => `<div><dt>${t(stat.label)}</dt><dd>${stat.value}</dd></div>`)
		.join('');
	node('#stack-label').textContent = t('v11.proof.played', { count });
	node('.stack-cards').innerHTML = stack
		.slice(-8)
		.map(
			(card, i) =>
				`<span style="transform:translate(${i * 2}px,${-i}px) rotate(${i * 3 - 9}deg);background:${card.color}">${card.family}<strong>${card.score}</strong></span>`
		)
		.join('');
	// Build the scramble under the hidden result so the final score never flashes first.
	beat('result');
	phase('result');
	status.textContent = t('v11.proof.resultAnnounce', { score: currentScore });
	busy = false;
	controls();
	node<HTMLButtonElement>('#next').focus();
}
function guarded(action: () => Promise<void>) {
	return () => {
		void action().catch(() => {
			phase('failed');
			busy = false;
			controls();
			status.textContent = t('round.startError');
			retryButton.hidden = false;
			console.error('morphi:proof_action_failed');
		});
	};
}
finishButton.onclick = guarded(finish);
replayButton.onclick = retryButton.onclick = guarded(deal);
async function next() {
	if (busy || root.dataset.phase !== 'result') return;
	busy = true;
	controls();
	const nextFamily = currentFamily === 'memory' ? 'block' : 'memory';
	// Preparation starts while the result is still leaving, with rejection already handled.
	const preparing = prepareScene(nextFamily);
	phase('result-leaving');
	beat('result-exit');
	await wait(staticMode() ? 0 : 350);
	if (!alive) return;
	familyChoice.value = nextFamily;
	busy = false;
	await deal(preparing);
}
node('#next').onclick = guarded(next);
familyChoice.onchange = guarded(deal);
loadChoice.onchange = () => {
	failedOnce = false;
};
function reducedChanged() {
	root.dataset.static = String(staticMode());
	settleMotion();
	if (staticMode()) entrance?.settle();
}
media.addEventListener('change', reducedChanged);
motionChoice.onchange = reducedChanged;
document.addEventListener('visibilitychange', visibility);
window.addEventListener('resize', () => {
	try {
		settleMotion();
		setBackdropBounds(node('.proof-scatter'), node('.proof-board').getBoundingClientRect());
	} catch {
		console.warn('morphi:backdrop_layout_unavailable');
	}
});
window.addEventListener('pagehide', () => {
	alive = false;
	settleMotion();
	entrance?.destroy();
	for (const delay of deadlines) delay.cancel();
});
node('#stack-label').textContent = t('v11.proof.played', { count });
void deal();
