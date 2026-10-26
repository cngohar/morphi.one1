/** Platform-free wire contract. Puzzle implementations never import each other. */
export type PuzzleId = 'block' | 'memory';
export interface Move {
	index?: number;
	trayIndex?: number;
	x?: number;
	y?: number;
}
export interface CompletedRun {
	version: 1;
	id: string;
	family: PuzzleId;
	engineVersion: string;
	seed: string;
	moves: Move[];
	elapsedSeconds: number;
	rankedSession: string | null;
}
export interface ReplayedResult {
	score: number;
	group: string;
	pairs: number | null;
	moves: number;
}
export interface PuzzleManifest {
	id: PuzzleId;
	engineVersion: string;
	maxMoves: number;
	replay(seed: string, moves: readonly Move[], seconds: number): ReplayedResult;
}
