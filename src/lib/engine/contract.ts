/** Platform-free wire contract. Puzzle implementations never import each other. */
export type PuzzleId = string;
export interface Move {
	[field: string]: number | undefined;
}
export interface CompletedRun {
	variant?: string;
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
	group?: string;
	pairs: number | null;
	moves: number;
}
export interface PuzzleVariant {
	id: string;
	name: string;
	weight: number;
	enabled?: boolean;
	maxMoves: number;
	maxSeconds?: number;
	leaderboardGroups?: readonly string[];
	scoring?: import('./scoring.js').ScoreDefinition;
	help?: PuzzlePresentation['help'];
	ending?: PuzzleManifest['ending'];
}
export interface PuzzleFamilyEntry {
	id: PuzzleId;
	weight: number;
	enabled: boolean;
	orientation: 'any' | 'portrait' | 'landscape';
	minViewportWidth?: number;
	minViewportHeight?: number;
	selectionOrder?: number;
}
export type PuzzleMetadata = Pick<
	PuzzleManifest,
	'engineVersion' | 'titleAfterEntrance' | 'scoring' | 'ending' | 'presentation' | 'variants'
> & {
	backdropPieces?: readonly {
		id: string;
		width: number;
		height: number;
		cells: readonly { x: number; y: number }[];
	}[];
};
export interface PuzzlePresentation {
	name: string;
	scoringLabels: Readonly<Record<string, string>>;
	groups: Readonly<Record<string, string>>;
	help: {
		steps: readonly string[];
		rows: readonly { label: string; field?: string; sign?: '+' | '−'; value?: string }[];
		note: string;
		tips: string;
	};
	backdrop: {
		items: readonly { id: string; path: string }[];
		fill: 'solid' | 'outline';
		symbol?: boolean;
	};
	profileIcon?: { color: string; rotation: number };
}
export interface PuzzleManifest {
	variants?: readonly PuzzleVariant[];
	/** Finite family-owned controls; absence means no dimension policy for this family. */
	dimensionPolicy?: {
		dimensions: readonly {
			key: string;
			label: string;
			values: readonly { id: string; label: string }[];
		}[];
		archetypes: readonly { id: string; label: string }[];
		variants: readonly {
			id: string;
			archetype: string;
			change?: readonly [string, string];
			changes?: readonly (readonly [string, string])[];
		}[];
	};
	id: PuzzleId;
	presentation: PuzzlePresentation;
	selectionOrder?: number;
	weight?: number;
	enabled?: boolean;
	orientation?: PuzzleFamilyEntry['orientation'];
	minViewportWidth?: number;
	minViewportHeight?: number;
	titleAfterEntrance?: boolean;
	engineVersion: string;
	maxMoves: number;
	/** Validates exact wire fields and returns their canonical order. */
	parseMove(move: Move): Move;
	leaderboardGroups?: readonly string[];
	/** Null preserves games whose ranked score has no presentation allowance. */
	rankedTiming: {
		/** Null preserves the family's legacy timing for this variant. */
		openingMs(result: ReplayedResult, variant?: string): number | null;
		minimumSeconds(result: ReplayedResult, variant?: string): number;
	} | null;
	scoring: import('./scoring.js').ScoreDefinition;
	messages: Readonly<Record<string, string>>;
	createRound(
		seed: string,
		variant?: string
	): {
		seed: string;
		variant?: string;
		rules?: Record<string, number | boolean>;
	};
	resumeRound?(
		seed: string,
		moves: readonly Move[],
		scoring?: import('./scoring.js').ScoreValues,
		variant?: string
	): { seed: string };
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
		scoring?: import('./scoring.js').ScoreValues,
		variant?: string
	): ReplayedResult;
}

/** Read single-rule and multi-rule policy mappings through the same metadata contract. */
export function dimensionChange(
	variant:
		| {
				id: string;
				change?: readonly [string, string];
				changes?: readonly (readonly [string, string])[];
		  }
		| undefined,
	key: string
): string | undefined {
	return (
		variant?.changes?.find(([dimension]) => dimension === key)?.[1] ??
		(variant?.change?.[0] === key ? variant.change[1] : undefined)
	);
}
