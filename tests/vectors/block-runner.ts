import { catalog } from '../../src/lib/catalog.js';
import classic from './reference.json';
import cap from './block-cap.json';
import expected from './block-variants.json';

export async function verifyVectors() {
	const manifest = catalog.block;
	for (const seed of ['0', '42', '18446744073709551615'])
		if (
			JSON.stringify(manifest.createRound(seed)) !==
			JSON.stringify(manifest.createRound(seed, 'block:classic'))
		)
			throw new Error('Explicit classic changed legacy serialization');
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
	const baseline = manifest.replayRound(
		'0',
		coordinates.map(([trayIndex, x, y]) => ({ trayIndex: trayIndex!, x: x!, y: y! }))
	);
	const summary = {
		score: baseline.score,
		lines: baseline.lines,
		combo: baseline.combo,
		placements: baseline.placements,
		status: baseline.status,
		supplyIndex: baseline.supplyIndex,
		tray: baseline.tray
	};
	if (JSON.stringify(summary) !== JSON.stringify(classic.block))
		throw new Error('Frozen classic Block vector mismatch');
	if (
		manifest.replay(cap.seed, cap.moves, 0).score !== cap.score ||
		manifest.replay(cap.seed, cap.moves, 0, undefined, 'block:classic').score !== cap.score
	)
		throw new Error('Frozen Block cap vector mismatch');
	const vectors = expected.map(({ seed, variant, moves }) => {
		const round = manifest.resumeRound(seed, moves, undefined, variant);
		return {
			seed,
			variant,
			moves,
			board: round.board,
			tray: round.tray,
			supplyIndex: round.supplyIndex,
			lines: round.lines,
			combo: round.combo,
			status: round.status,
			result: manifest.replay(seed, moves, 60, undefined, variant)
		};
	});
	if (JSON.stringify(vectors) !== JSON.stringify(expected))
		throw new Error('Block variant replay vector mismatch');
	const bytes = new Uint8Array(
		await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(JSON.stringify({ summary, cap: cap.score, vectors }))
		)
	);
	return {
		passed: true,
		fingerprint: [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
		vectors: vectors.length + 2,
		themeVectors: 0
	};
}
