export const messages = {
	'v1.game.light-bend': 'Light Bend',
	'variant.light-bend:classic': 'Classic',
	'variant.light-bend:place-your-own': 'Place your own',
	'variant.light-bend:colour': 'Colour beam',
	'variant.light-bend:splitter': 'Splitters',
	'variant.light-bend:portal': 'Portals',
	'variant.light-bend:two-sources': 'Two sources',
	'variant.light-bend:no-preview': 'Fire to test',
	'variant.light-bend:countdown-120': 'Two-minute countdown',
	'variant.light-bend:no-undo': 'No undo',
	'variant.light-bend:no-hint': 'No hints',
	'variant.light-bend:checkpoint': 'Checkpoints',

	'ending.light-bend.headline': 'Every crystal lit!',
	'ending.light-bend.timeUp': "Time's up!",
	'ending.light-bend.subline': '{crystals} crystals lit · {stars} stars',

	'light-bend.step1': 'Tap a mirror to turn it. The beam bends at each mirror it meets.',
	'light-bend.step2':
		'Light every crystal in one trace. A blocked beam is not a loss — turn another mirror.',
	'light-bend.step3': 'Drag to pan, pinch or scroll to zoom. Use Fit view to see the whole board.',
	'light-bend.rule.place-your-own':
		'The board ships empty with a tray of mirrors. Place each mirror, then rotate it to route the beam.',
	'light-bend.rule.colour':
		'Each crystal lights only in its own colour. Filter cells change the colour the beam carries.',
	'light-bend.rule.splitter':
		'A splitter splits one beam into two and merges two into one. Both branches must light their crystals.',
	'light-bend.rule.portal':
		'A portal takes the beam in and puts it out of the matching portal, still travelling the same way.',
	'light-bend.rule.two-sources':
		'Two sources fire at once. Each lights its own crystals, and the beams may cross without mixing.',
	'light-bend.rule.no-preview':
		'The beam is hidden while you set mirrors. Fire once to test the whole trace.',
	'light-bend.rule.countdown-120':
		'Light every crystal before the two-minute countdown reaches zero. A timeout saves no score.',
	'light-bend.rule.no-undo':
		'Undo is unavailable. Only Reset returns the mirrors to where they started.',
	'light-bend.rule.no-hint': 'Hints are disabled. Light every crystal without help.',
	'light-bend.rule.checkpoint':
		'The beam must also pass through both checkpoint tokens, not just light the crystals.',

	'light-bend.note': 'Scores stop at zero. Ranked time and par are checked by the server.',
	'light-bend.tips':
		'Work backwards from the crystals. A mirror the beam never reaches is a decoy, not the answer.',

	'scoring.light-bend.completion': 'Completion points',
	'scoring.light-bend.second': 'Points lost per second',
	'scoring.light-bend.hint': 'Penalty per hint',
	'scoring.light-bend.reset': 'Penalty per reset',
	'scoring.light-bend.countdown': 'Bonus per second remaining',

	'light-bend.crystals': 'Crystals lit',
	'light-bend.crystalsOf': '{lit} of {total} crystals lit',
	'light-bend.par': 'Par',
	'light-bend.stars': 'Stars',
	'light-bend.mirrors': 'Mirrors',
	'light-bend.tray': 'Mirrors left',
	'light-bend.hintsLeft': 'Hints left',
	'light-bend.timeLeft': 'Time left',
	'light-bend.undo': 'Undo',
	'light-bend.hint': 'Hint',
	'light-bend.reset': 'Reset',
	'light-bend.fire': 'Fire',
	'light-bend.zoomIn': 'Zoom in',
	'light-bend.zoomOut': 'Zoom out',
	'light-bend.fit': 'Fit view',
	'light-bend.resetView': 'Reset view',
	'light-bend.next': 'Next',
	'light-bend.hinted': 'Hint: turn the highlighted mirror.',
	'light-bend.hintedPlace': 'Hint: place a mirror on the highlighted cell.',
	'light-bend.noHints': 'Hints are unavailable this round.',
	'light-bend.noUndo': 'Undo is unavailable this round.',
	'light-bend.trayEmpty': 'No mirrors left in the tray. Undo or reset to free one.',
	'light-bend.invalid': 'That move is not available.',
	'light-bend.fired': 'Beam fired. Turn a mirror or fire again.',
	'light-bend.blocked': 'The beam stopped before every crystal. Turn another mirror.',
	'light-bend.won': 'Every crystal is lit.',
	'light-bend.over': 'Run over',
	'light-bend.overDetail': 'Your board stays here to inspect. This attempt saves no score.',
	'light-bend.error': 'This puzzle stopped responding. Return Home to start a fresh one.',
	'light-bend.mirror': 'Mirror at row {row}, column {column}, {orientation}',
	'light-bend.mirrorSlash': 'leaning right',
	'light-bend.mirrorBackslash': 'leaning left',
	'light-bend.slot': 'Empty placement cell at row {row}, column {column}',
	'light-bend.result.title': 'Light Bend solved',
	'light-bend.result.summary':
		'{crystals} crystals lit in {time}, {mirrors} mirrors turned, par {par}, {stars} stars.',
	'light-bend.result.announce': 'Light Bend complete. Score {score}.',
	'light-bend.firstHint': 'Tap a mirror to turn it. The beam bends at each mirror it meets.'
} as const;
