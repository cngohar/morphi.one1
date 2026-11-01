import {
	catalog,
	createMemoryRound,
	createConnectRound,
	replayBlockMoves
} from '../../src/lib/catalog.js';
import { createRng } from '../../src/lib/engine/rng.js';
import expected from './reference.json';
import themes from './themes.json';
import connect from './connect.json';
import connectPartial from './connect-partial.json';
import { generateTheme, paletteIssues } from '../../src/lib/engine/theme/generator.js';

export async function verifyVectors() {
	const rng = createRng('0');
	const vectors = {
		rng: Array.from({ length: 5 }, () => rng.nextU64().toString(16)),
		memory: expected.memory.map(({ seed }) => {
			const round = createMemoryRound(seed);
			const symbols = [...new Set(round.cards.map((card) => card.symbol))];
			const moves = symbols.flatMap((symbol) =>
				round.cards.flatMap((card, index) => (card.symbol === symbol ? [{ index }] : []))
			);
			const customScore = catalog.memory.replay(seed, moves, 10, {
				pair: 1200,
				mismatch: 75,
				second: 3
			}).score;
			if (customScore !== round.pairs * 1200 - 30)
				throw new Error('Custom memory score vector mismatch');
			return {
				seed,
				pairs: round.pairs,
				deck: round.cards.map((card) => card.id),
				score: catalog.memory.replay(seed, moves, 10).score
			};
		}),
		block: (() => {
			const coordinates = [
				[0, 0, 0],
				[1, 1, 0],
				[2, 2, 0],
				[0, 4, 0],
				[1, 6, 0],
				[2, 0, 2],
				[0, 3, 2],
				[1, 4, 2],
				[2, 5, 3],
				[0, 3, 0],
				[1, 7, 0],
				[2, 2, 3],
				[0, 0, 0],
				[1, 3, 0],
				[2, 5, 0],
				[0, 6, 0],
				[1, 0, 1],
				[2, 0, 1],
				[0, 2, 1],
				[1, 6, 1]
			];
			const round = replayBlockMoves(
				'0',
				coordinates.map(([trayIndex, x, y]) => ({ trayIndex: trayIndex!, x: x!, y: y! }))
			);
			return {
				score: round.score,
				lines: round.lines,
				combo: round.combo,
				placements: round.placements,
				status: round.status,
				supplyIndex: round.supplyIndex,
				tray: round.tray
			};
		})()
	};
	if (JSON.stringify(vectors) !== JSON.stringify(expected))
		throw new Error('Known replay vector mismatch');
	const themeVectors = themes.map(({ seed, family }) => {
		const t = generateTheme(seed, family as 'memory' | 'block');
		if (paletteIssues(t).length) throw new Error('Runtime palette safety mismatch');
		return {
			seed,
			family,
			recipe: t.recipe,
			colors: t.colors,
			back: t.back,
			container: t.container,
			style: t.style.id
		};
	});
	if (JSON.stringify(themeVectors) !== JSON.stringify(themes))
		throw new Error('Theme regression vector mismatch');
	const connectVectors = connect.map(({ seed }) => {
		const round = createConnectRound(seed);
		const moves = round.solution.flatMap((path, pair) =>
			path.map((cell, at) => ({ pair, cell, stroke: pair, at: pair * 100 + at }))
		);
		const custom = catalog.connect.replay(seed, moves, 10, {
			pair: 300,
			grid: 500,
			second: 7,
			redraw: 80
		});
		if (custom.score !== round.pairs.length * 300 + 500 + Math.max(0, round.par - 10) * 7)
			throw new Error('Custom connect score vector mismatch');
		return {
			seed,
			band: round.band,
			size: round.size,
			pairs: round.pairs,
			solution: round.solution,
			score: catalog.connect.replay(seed, moves, 10).score
		};
	});
	if (JSON.stringify(connectVectors) !== JSON.stringify(connect))
		throw new Error('Connect vector mismatch');
	const partialVectors = connectPartial.map(({ seed, shortcuts }) => {
		const round = createConnectRound(seed);
		const paths = round.solution.map((path, pair) => {
			const shortcut = shortcuts.find((item) => item.pair === pair);
			return shortcut ? [...path.slice(0, shortcut.from + 1), ...path.slice(shortcut.to)] : path;
		});
		const moves = paths.flatMap((path, pair) =>
			path.map((cell, at) => ({ pair, cell, stroke: pair, at: pair * 100 + at }))
		);
		return {
			seed,
			shortcuts,
			filled: paths.reduce((sum, path) => sum + path.length, 0),
			score: catalog.connect.replay(seed, moves, 10).score
		};
	});
	if (JSON.stringify(partialVectors) !== JSON.stringify(connectPartial))
		throw new Error('Connect partial-win vector mismatch');
	const bytes = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(vectors)))
	);
	return {
		passed: true,
		fingerprint: [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
		vectors: 5 + connectVectors.length + partialVectors.length,
		themeVectors: themeVectors.length
	};
}
