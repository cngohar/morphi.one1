import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	CARD_DEAL_MS,
	CARD_FLIP_MS,
	CARD_UNFOLD_MS,
	CARD_FOLD_MS,
	RESULT_EXIT_MS
} from '../../round-timing.js';

const beats = vi.hoisted(() => [] as { duration: number; offset: number }[]);
vi.mock('animejs', () => ({
	animate: vi.fn(),
	scrambleText: vi.fn(),
	createTimeline: () => ({
		add: (_target: unknown, options: { duration: number }, offset: number) => {
			beats.push({ duration: options.duration, offset });
		},
		play: vi.fn(),
		revert: vi.fn()
	})
}));
import { cardSceneMotion, type CardScene } from '../../ui/motion.js';

function element() {
	return {
		style: {},
		firstElementChild: {},
		getAttribute: () => null,
		getBoundingClientRect: () => ({ left: 0, top: 0, x: 0, y: 0, width: 200, height: 200 })
	} as unknown as HTMLElement;
}

describe('shared card beats', () => {
	beforeEach(() => {
		beats.length = 0;
		vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
		vi.stubGlobal('innerWidth', 1280);
		vi.stubGlobal('innerHeight', 800);
		vi.stubGlobal('document', { hidden: false });
	});

	afterEach(() => vi.unstubAllGlobals());

	it.each([
		['deal', CARD_DEAL_MS, 650],
		['flip', CARD_FLIP_MS, 400],
		['unfold', CARD_UNFOLD_MS, 800],
		['fold', CARD_FOLD_MS, 500],
		['result-exit', RESULT_EXIT_MS, 350]
	] as const)('%s timeline and wait have the same fixed duration', (phase, wait, expected) => {
		const scene: CardScene = {
			root: element(),
			frame: element(),
			card: element(),
			content: element(),
			backdrop: null,
			stack: element(),
			stackIndex: 0,
			result: element(),
			score: null
		};
		cardSceneMotion(scene, phase);
		expect(beats.length).toBeGreaterThan(0);
		expect(Math.max(...beats.map(({ duration, offset }) => duration + offset))).toBe(expected);
		expect(wait).toBe(expected);
	});
});
