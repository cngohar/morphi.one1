import { catalog, createMemoryRound } from '../../src/lib/catalog.js';
import block from './block-cap.json';
const memorySeed = '18446744073709551615';
const round = createMemoryRound(memorySeed);
const symbols = [...new Set(round.cards.map((card) => card.symbol))];
const pairs = symbols.map((symbol) =>
	round.cards.flatMap((card, index) => (card.symbol === symbol ? [index] : []))
);
const wrong = [pairs[0]![0]!, pairs[1]![0]!];
const memoryMoves = [
	...Array.from({ length: round.pairs * 5 }, () => wrong).flat(),
	...pairs.flat()
].map((index) => ({ index }));
export const workloads = [
	{ name: 'block-cap', family: 'block' as const, seed: block.seed, moves: block.moves },
	{ name: 'memory-move-cap', family: 'memory' as const, seed: memorySeed, moves: memoryMoves }
];
export function replayBatch(name: string, count: number) {
	const workload = workloads.find((workload) => workload.name === name);
	if (!workload) throw new Error('Unknown benchmark');
	let score = 0;
	for (let index = 0; index < count; index++)
		score = catalog[workload.family].replay(workload.seed, workload.moves, 60).score;
	return { score, moves: workload.moves.length, iterations: count };
}
