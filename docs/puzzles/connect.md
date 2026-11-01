# Puzzle design brief: Connect (`connect`)

The owner chose Connect as the third family and authorized local v1.1 work on
2026-10-26. Source: `docs/morphi-v1.1-handoff-2026-10-26/morphi-flow-design/CONNECT_BRIEF.md`.
The working animation was accepted on 2026-10-26. Local app visual and real-phone
review of this implementation remain open.

## Core loop

- Draw orthogonal paths between matching dot pairs. Paths cannot cross. The
  round ends when every pair is connected; filling every cell earns a bonus.
- Either endpoint starts a path. A path can be shortened, erased or redrawn. A
  path entering another pair's path cuts that path at the entered cell.
- The first action is a dot drag. The opening is a fixed 2.5-second arrival.

## Controls

- Touch/mouse/pen: drag from a dot or owned path cell through adjacent cells;
  release ends a stroke. Pointer cancellation ends it safely.
- Keyboard: focus the board cells; arrows move focus, Enter/Space starts a stroke,
  and arrows extend or retract it. Endpoints also carry distinct symbols and
  accessible pair labels.

## Difficulty, fairness and scoring

| Band | Grid | Pairs | Par   |
| ---- | ---- | ----- | ----- |
| 1    | 5×5  | 5     | 90 s  |
| 2    | 6×6  | 6     | 125 s |
| 3    | 7×7  | 8     | 165 s |

The seeded generator starts with a serpentine Hamiltonian path, applies bounded
backbite moves and cuts the path into segments of at least three cells. The
stored solution is a witness only; any legal all-pairs solution wins. Generation
uses SplitMix64 and integer operations. The score is 200 per currently connected
pair, plus 1,000 when every cell is filled at completion, plus 10 per whole
second under par,
minus 50 when a previously connected pair is redrawn, floored at zero. Solo
time pauses while hidden; ranked time comes from the server's issued session,
with fixed Card/Connect opening allowances. Moves are ordered path-cell visits
with a stroke id and monotonic elapsed milliseconds. At most 1,000 moves are
accepted. Invalid/extra moves fail replay. There is no partial end state or
move cap inside a live round; Home abandons it.

## Layout, style and backdrop

- Centred stage in the accepted Card shell; Score / Pairs / Filled HUD; shared
  bottom How to play and Scoring & tips controls. The square board sizes from
  its container on portrait, landscape and desktop.
- DOM grid plus SVG paths. Procedural theme colors and generated symbols are
  cosmetic and never affect the generated route or score.
- Connect's only backdrop object is a pair of dots joined by a bent path,
  owned by `ui/puzzle-backdrop.ts`. Seeded positions and rotations show 1–5
  objects per side on wide layouts, at 20% opacity outside header/footer bands.
  Phone and short landscape layouts hide them. Other families' objects are
  forbidden in this backdrop.

## Feedback, sound and entrance

The Card deals, flips and unfolds once; Connect then runs its own 2.5-second
centre ripple. The name rises, cells appear from the centre, pairs pop together
with rings and the puzzle-only scatter fades in. Logical readiness uses an
active-time deadline, independent of animation completion. Reduced motion
settles presentation immediately for solo; ranked retains its server-owned
opening allowance. Draw, cut, backtrack, pair, redraw and full-grid bonus events
use `ui/motion.ts`; the result folds into the shared played stack.

Nine distinct ElevenLabs-generated static cues cover appearance, start, extend,
backtrack, pair, cut, redraw, invalid and win. They are generated offline by
`scripts/generate-sounds.ts` with provenance and SHA-256 in
`static/audio/manifest.json`. Runtime uses only static files and respects mute.

## Teaching, risks and evidence

Help explains dot drag, orthogonal no-crossing paths, pair completion and the
optional full-grid bonus;
Scoring & tips explains the formula and edge-routing hint. The result shows
score, Your high score, pairs, fill percentage, strokes and time. Full path replay verifies rules,
but it cannot prove a human played; the local leaderboard has no prizes.

Generation/property, cut/redraw and malformed move tests are in
`src/lib/puzzles/connect/logic.test.ts`; known vectors in
`tests/vectors/connect.json` and `connect-partial.json` run in Node, Bun,
Chromium, Firefox, WebKit and
workerd. D1 ranked replay is covered in `tests/integration/runs.test.ts`.
`tests/e2e/connect.spec.ts` covers real Mix entry, all-pairs wins with gaps,
solution/result/Next, entrance first frames, centred symbols, responsive boards,
family-only backdrops and muted/loaded cues. Real-device
review and overall visual acceptance remain owner gates.
