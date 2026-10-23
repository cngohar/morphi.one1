export const messages = {
	'meta.title': 'Morphi',
	'meta.description': 'A new puzzle every time you press Play.',

	'home.title': 'Morphi',
	'home.tagline': 'A new puzzle every time',
	'home.play': 'Play',
	'home.best': 'Best {score}',

	'game.title': 'Memory',
	'game.score': 'Score',
	'game.time': 'Time',
	'game.moves': 'Moves',
	'game.round': 'Round {number}',
	'game.streak': 'Streak {count}',
	'game.hint': '{pairs} pairs · Find the matching pairs',
	'game.home': 'Back to home',
	'game.error': 'Could not start a round. Try again.',

	'sound.on': 'Turn sound on',
	'sound.off': 'Turn sound off',

	'status.match': 'Match',
	'status.mismatch': 'Not a match',
	'status.won': 'All pairs found',
	'status.memorize': 'Memorize the pairs',
	'status.go': 'Go',

	'card.down': 'Card {number}, face down',
	'card.up': 'Card {number}, {symbol}',
	'card.matched': '{symbol}, matched',

	'symbol.circle': 'circle',
	'symbol.triangle': 'triangle',
	'symbol.square': 'square',
	'symbol.diamond': 'diamond',
	'symbol.star': 'star',
	'symbol.hexagon': 'hexagon',
	'symbol.cross': 'cross',
	'symbol.ring': 'ring',
	'symbol.pentagon': 'pentagon',
	'symbol.heart': 'heart',

	'block.title': 'Block puzzle',
	'block.score': 'Score',
	'block.lines': 'Lines',
	'block.streak': 'Streak',
	'block.round': 'Round {number}',
	'block.best': 'Best {score}',
	'block.board': '8 by 8 board',
	'block.tray': 'Pieces',
	'block.piece': 'Piece {number}: {name}',
	'block.emptySlot': 'Empty tray slot',
	'block.cellEmpty': 'Row {row}, column {column}, empty',
	'block.cellFilled': 'Row {row}, column {column}, filled',
	'block.shape.single': 'single block',
	'block.shape.domino': 'two-block bar',
	'block.shape.bar3': 'three-block bar',
	'block.shape.l3': 'small L',
	'block.shape.bar4': 'four-block bar',
	'block.shape.square': 'square',
	'block.shape.l4': 'large L',
	'block.shape.t4': 'T shape',
	'block.shape.s4': 'S shape',
	'block.hint': 'Drag or tap a piece. Fill a row or column.',
	'block.hintSelected': 'Tap a cell, or drag the piece.',
	'block.hintShort': 'Fill a row or column.',
	'block.home': 'Back to home',
	'block.error': 'Could not start a run. Try again.',
	'block.statusSelected': '{name} selected',
	'block.statusPlaced': 'Piece placed. Score {score}.',
	'block.statusLine': 'Line cleared. {points} points. Score {score}.',
	'block.statusLines': '{lines} lines cleared. {points} points. Score {score}.',
	'block.statusInvalid': 'That piece does not fit there.',
	'block.statusEnded': 'No moves left.',
	'block.statusCap': 'Run complete.',
	'block.result.title': 'Run ended',
	'block.result.summary': '{lines} lines · {pieces} pieces',
	'block.result.noFit': 'No moves left · {summary}',
	'block.result.cap': 'Run complete · {summary}',
	'block.result.announce': 'Run ended. Score {score}. {summary}',

	'result.title': 'All pairs found',
	'result.newBest': 'New best',
	'result.soClose': 'So close · {points} points off your best',
	'result.score': 'Your score',
	'result.best': 'Best {score}',
	'result.previousBest': 'Previous best {score}',
	'result.summary': '{pairs} pairs · {moves} moves · {time}',
	'result.announce': 'Round ended. Score {score}. {summary}',
	'result.next': 'Next puzzle',
	'result.home': 'Home'
} as const;

export type MessageKey = keyof typeof messages;

type MessageValues = Record<string, string | number>;

export function t(key: MessageKey, values?: MessageValues): string {
	const message: string = messages[key];

	if (!values) {
		return message;
	}

	return message.replace(/\{(\w+)\}/g, (token, name: string) => {
		const value = values[name];
		return value === undefined ? token : String(value);
	});
}
