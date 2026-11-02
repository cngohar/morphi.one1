/** Platform-free wire contract. Puzzle implementations never import each other. */
export type PuzzleId = string;
export interface Move {
	index?: number;
	trayIndex?: number;
	x?: number;
	y?: number;
	pair?: number;
	cell?: number;
	stroke?: number;
	at?: number;
}
export interface CompletedRun {
	scoreConfigVersion?: string;
	version: 1;
	id: string;
	family: PuzzleId;
	engineVersion: string;
	seed: string;
	moves: Move[];
	elapsedSeconds: number;
	rankedSession: string | null;
	/** Absent on queued v1 runs. Cosmetic metadata never changes replay or score. */
	theme?: { configVersion: string; generatorVersion: string };
}
export interface ReplayedResult {
	score: number;
	group: string;
	pairs: number | null;
	moves: number;
}
export interface PuzzleManifest {
	id: PuzzleId;
	selectionOrder?: number;
	titleAfterEntrance?: boolean;
	engineVersion: string;
	maxMoves: number;
	scoring: import('./scoring.js').ScoreDefinition;
	messages: Readonly<Record<string, string>>;
	createRound(seed: string): { seed: string };
	ending: {
		kind: 'completion' | 'run_over';
		headlines: { default: string; cap?: string };
		subline: { key: string; values: readonly string[] };
		animation: 'fade-rise';
		continue: 'auto_500ms';
		condition: string;
	};
	replay(
		seed: string,
		moves: readonly Move[],
		seconds: number,
		scoring?: import('./scoring.js').ScoreValues
	): ReplayedResult;
}
