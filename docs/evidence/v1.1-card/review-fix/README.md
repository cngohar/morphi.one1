# Desktop Card/scatter correction — 2026-10-28

Open the [updated local demo](http://localhost:5173/demo/card-proof.html).

The intended path is **random entry → settle at centre → unfold at centre →
puzzle's own arrival**. Finishing folds into the played stack. Entry direction
must not affect where unfolding or finishing happens.

Screenshots reproduced an arrival translation retained during later animation
phases. The fix explicitly resets translation/rotation/scale for each board
phase. Earlier frame identity/width checks did not catch this position error.
New probes check stage-centre coordinates and stack landing across three rounds.

Backdrop objects now draw independent x/y positions across the measured exposed
background space. Counts remain 1–5 per side, with current-puzzle objects only,
20% opacity and the approved blend. Compact/mobile layouts hide the object
layer. Resize and theme/board replacement recompute the available space.

- [Earlier off-centre unfold](before-off-centre-unfold.png)
- [Live Google Chrome scatter](desktop-scatter-chrome.png)
- [Live Firefox scatter](desktop-scatter-firefox.png)
- [Chrome: unfold at centre](chrome-centred-unfold.png)
- [Chrome: fold at centre](chrome-fold-centre.png)
- [Chrome: approach the played stack](chrome-stack-landing.png)
- [Three-round Chrome position samples](centred-transitions-chrome.json)

The live scatter captures use normal timers. Transition probes use a controlled
browser clock at 1920×923; they verify geometry and sequence, not physical-device
frame rate. The exact installed Chrome version is 155.0.8059.79. Owner visual
acceptance and actual Card integration remain separate.

The owner then requested a result entrance because the panel appeared suddenly.
The panel now fades from 0 to 1 and rises 20px over 420ms, once, while the big
score alone scrambles over 500ms. Heading/labels/high score/stat values retain
their text. Next stays available and its approved 350ms exit starts from the
current visual frame if pressed early. Reduced motion settles immediately.

- [Result entrance in progress, Google Chrome](result-enter-middle.png)
- [Result entrance completed, Google Chrome](result-enter-settled.png)
- [Result entrance samples](result-entrance-chrome.json)
- [Firefox centre/stack samples](centred-transitions-firefox.json)
- [WebKit centre/stack samples](centred-transitions-webkit.json)
- [Verification summary](verification.json): 54 Card/layout checks, one installed
  Chrome geometry check, nine result checks across three engines, and two
  installed Chrome result checks passed. Type check has zero errors/warnings;
  targeted lint and the 200-theme backdrop property check passed.

Live scatter screenshots use the same seeded fixture in both browsers for
comparison; normal gameplay still draws fresh cosmetic seeds.
