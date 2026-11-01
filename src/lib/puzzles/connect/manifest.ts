import { messages } from './messages.js';
import type { PuzzleManifest } from '#lib/engine/contract.js';
import { scoring } from './scoring.js';
import {
	applyConnectMove,
	connectScore,
	CONNECT_ENGINE_VERSION,
	createConnectRound,
	type ConnectMove
} from './logic.js';

export const manifest = {
	id: 'connect',
	engineVersion: CONNECT_ENGINE_VERSION,
	scoring,
	maxMoves: 1000,
	messages,
	ending: {
		kind: 'completion',
		headlines: { default: 'ending.connect.headline' },
		subline: { key: 'ending.connect.subline', values: ['filled'] },
		animation: 'fade-rise',
		continue: 'auto_500ms',
		condition: 'Every pair is connected; filling every cell is not required.'
	},
	replay(seed, moves, seconds, scoring) {
		if (moves.length > this.maxMoves) throw new RangeError('move_limit');
		let round = createConnectRound(seed);
		for (const move of moves) {
			if (Object.keys(move).sort().join(',') !== 'at,cell,pair,stroke')
				throw new RangeError('move');
			round = applyConnectMove(round, move as ConnectMove);
		}
		if (round.status !== 'won') throw new RangeError('incomplete');
		return {
			score: connectScore(round, seconds, scoring),
			group: `${CONNECT_ENGINE_VERSION}:${round.band}`,
			pairs: round.pairs.length,
			moves: round.strokes
		};
	}
} satisfies PuzzleManifest;
