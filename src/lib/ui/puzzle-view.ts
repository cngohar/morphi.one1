import type { Component } from 'svelte';
import type { CheckpointState } from './checkpoint.js';
import type { Move } from '#lib/engine/contract.js';
import type { ScoreValues } from '#lib/engine/scoring.js';
import type { ResolvedTheme } from '#lib/engine/theme/generator.js';

/** The shell keeps identity; each lazy view owns its concrete round and result presentation. */
export interface PuzzleRound {
	seed: string;
}

export interface PuzzleResult {
	score: number;
	title: string;
	summary: string;
	announcement: string;
	stats: { label: string; value: string }[];
	endingValues: Record<string, string | number>;
	cap?: boolean;
}

export interface PuzzleViewProps {
	round: PuzzleRound;
	resume?: CheckpointState;
	rankedStartedAt?: number | null;
	registerCheckpoint?: (read: () => CheckpointState) => void;
	roundNumber: number;
	best: number;
	scoring: ScoreValues;
	resolvedTheme: ResolvedTheme | null;
	paused: boolean;
	rankedRound: boolean;
	soundEnabled: boolean;
	entranceReady: boolean;
	ontogglesound: () => void;
	onhome: () => void;
	onready: () => void;
	onmove: (move: Move) => void;
	oncomplete: (score: number, seconds: number) => void;
	onfinish: (result: PuzzleResult) => void;
}

/** Bound failed chunk loads without losing the selector's pending family or finished result. */
export async function loadPuzzleView(
	load: () => Promise<{ default: Component<PuzzleViewProps> }>,
	signal: AbortSignal
): Promise<Component<PuzzleViewProps>> {
	return (await loadPuzzleModule(load, signal)).default;
}

export async function loadPuzzleModule<T>(load: () => Promise<T>, signal: AbortSignal): Promise<T> {
	if (signal.aborted) throw new Error('round_cancelled');
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let cancel = () => {};
	try {
		const unavailable = new Promise<never>((_, reject) => {
			cancel = () => reject(new Error('round_cancelled'));
			signal.addEventListener('abort', cancel, { once: true });
			timeout = setTimeout(() => reject(new Error('view_load_timeout')), 8000);
		});
		return await Promise.race([load(), unavailable]);
	} finally {
		clearTimeout(timeout);
		signal.removeEventListener('abort', cancel);
	}
}
