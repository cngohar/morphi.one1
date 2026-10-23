# Puzzle design brief: Block placement (`block-placement`)

Status: owner-approved on 2026-10-20. The owner approval gate and the 10-tester
user testing gate are closed. Step 4 was accepted on 2026-10-22 after a
portrait and landscape phone recheck. Values below are the owner-approved
defaults plus the Step 4 polish.

## Core loop

- Verb: choose one of three tray pieces and place it on an 8x8 board.
- Goal: keep placing pieces, clear full rows and columns, and build a score.
- Win, fail, and end states: scored run. There is no win and no timer. The run
  ends as `ended` when none of the pieces in the current tray fits, or after 300
  placements. The board never "fails" a move validation; an invalid placement is
  simply rejected.
- Fun within the first 30 seconds because: a placement is immediate, the next
  clear is usually one or two moves away, a clear pays out at once, and the tray
  refill gives a fresh hand. The opening 10 placements are guaranteed to include
  a fitting piece, so the first minute is forgiving.

Rules (v1):

- The board starts empty. The board is 8x8.
- The tray holds three pieces. A turn is one placement of one tray piece. After
  the third placement the tray refills with three new pieces.
- Pieces are fixed-orientation polyominoes of 1 to 4 cells:
  monomino, domino, 1x3, L3, 1x4, 2x2, L4, T4, S4. No rotation in v1.
- After a placement, every completed row and column clears at once. There is no
  gravity.
- A combo is a run of placements that each clear at least one line. A placement
  that clears nothing resets the combo to zero.
- The run ends when no piece in the current tray has any legal placement, or at
  the 300-placement cap.
- Fair supply: every tray dealt during the first 10 placements
  (`opening_turns`, default 10) contains at least one piece that fits the board
  at deal time. After that, no placement guarantee applies. If generation cannot
  satisfy the guarantee, the last piece is forced to a monomino.

## Controls

- Touch: drag a tray piece onto the board. The piece follows the finger with a
  board ghost; release on a valid position to place it. Tapping a piece selects
  it, then tapping a cell places its top-left corner there (accessible fallback).
  Dragging uses pointer events and `touch-action: none` so the page does not
  scroll.
- Mouse: drag with the pointer; click a piece then click a cell as the fallback.
  Hovering a selected piece shows the ghost.
- Keyboard: Tab focuses the tray; Left/Right choose a piece; Enter selects it;
  arrows move the ghost; Enter places; Escape cancels. Every action has a visible
  focus state.
- A selected piece lifts with a 2 px outline. Valid ghost cells use the piece
  color; invalid cells use the danger token. Tapping an occupied or out-of-bounds
  cell is invalid, not an accidental placement.
- All tray and board targets are at least 44x44 CSS px at the supported minimum
  viewport of 360x640.

## Difficulty and scoring

- Bands: one band in v1, "standard": 8x8 board, the piece set above. Board
  size and piece mix stay fixed for the whole run. Difficulty bands are config
  data and are deferred until playtesting shows what should change.
- Progression and fairness: the seed determines the piece sequence. The opening
  fair-supply guarantee above is the only solvability promise; a run can still
  dead-end later by design. No solver is needed because the game is survival,
  not a guaranteed-solvable puzzle. Replaying the same seed and moves produces
  the same board and score.
- Score:
  - A placement scores nothing by itself.
  - A clear scores `lines * 100 + (lines - 1) * 50` for multi-line clears, plus
    `(combo - 1) * 50` for the combo, where `combo` counts consecutive clearing
    placements including this one.
  - Examples: first clear of 1 line = 100; first clear of 2 lines = 250; next
    clear of 1 line at combo 2 = 150; next clear of 3 lines at combo 3 = 500.
  - The score is computed by replaying the moves, never submitted by the client.
- "So close" threshold: 250 points below the personal best, and only when the
  run is not a new best (same as Memory).
- Minimum human time: 250 ms per placement for later server validation. Local
  play does not enforce it.
- Move cap: 300 placements. Abandonment: leaving the game or refreshing abandons
  the run; the score is not saved. There is no resume in v1.

## Layout and style

- Layout profiles:
  - Compact (phone portrait, 360-599): centered stage. Board near full width
    (max 440 px) with 1 px gaps; tray below; Score, Lines, and Streak in the HUD;
    Round and Best on a meta line. No timer.
  - Medium (600-1023): centered stage, board 400-480 px, tray below.
  - Expanded (>=1024): centered stage, board up to 520 px, vertical picker
    column on the right by default; the layout supports left or right via one
    prop (`traySide`). No separate side panel.
  - Short landscape (height <= 520): height-limited board left, vertical picker
    on the right, compact HUD. Chrome controls stay in the viewport corners.
- Stage mode: `centered` in all profiles.
- Side panel content: none. The HUD shows Score, Lines, and Streak; Round and Best
  appear on a meta line. Best also appears on Home and Result. No timer, no
  moves-left counter.
- Renderer: `dom` with CSS Grid. The board is 64 cells and the tray is three
  pieces; DOM is sufficient, accessible, and easy to animate with CSS.
- Style profile: flat fills, no gradients, glows, shadows, or bevels. Board cells
  are rounded rectangles with the standard radius; pieces are unions of the same
  cell shape. Shape family is rounded rectangle, with fixed proportions. The
  surface palette uses existing tokens: primary, accent, success, and warning
  fill for the four piece colors; each theme chooses its own four piece colors.
  Empty cells use the theme's board-cell tint and edge, with `sky` keeping the
  owner-approved `#CDD9EE` cell and `#C8D3E5` edge. The board reads as a grid
  without becoming a dark slab. Shape and position distinguish pieces, never
  color alone.
- Fixed themes: four curated themes, `sky`, `shapes`, `ocean`, and `garden`. The
  seed picks one, so replaying a seed replays its look. Themes are cosmetic only
  and never affect solvability, difficulty, validation, or score.
  - `sky`: `#E8F0FC` backdrop, `#CDD9EE` cell, `#C8D3E5` edge, `#F3F8FF` tray,
    `#DBE5F5` slot, and the current four piece tokens.
  - `shapes`: `#F3EEFB` backdrop, `#DCD2EE` cell, `#D4C9E7` edge, `#FAF6FF`
    tray, `#E6DCF5` slot, and the verified fallback colors `#009A86`, `#7D61AE`,
    `#7C4100`, and `#003041`.
  - `ocean`: `#E2F3FA` backdrop, `#C2DDE9` cell, `#BAD6E2` edge, `#F0FAFD`
    tray, `#D3E8F1` slot, and `--accent`, `--success`, `#003041`, and
    `--warning-fill` pieces.
  - `garden`: `#E6F4E1` backdrop, `#C9DFC0` cell, `#C3D8BB` edge, `#F4FBF0`
    tray, `#D9E9D0` slot, and `--success`, `--primary`, `--warning-fill`, and
    `#7C4100` pieces.
  - Every theme's cell/backdrop, edge/backdrop, tray/backdrop, and slot/tray
    contrast is checked by a unit test with floors of 1.239:1, 1.31:1, 1.04:1,
    and 1.12:1. No raw random colors, gradients, or color-only cues. Theme names
    are internal for now and are not shown in the HUD.
- Themeable surfaces: board frame, board cells, pieces, tray, backdrop. The
  tray/picker panel uses the theme tray tint and its slots use the slot tint;
  HUD and corner chrome stay neutral. Shape, radius, gaps, and proportions may
  vary as cosmetic theme axes later; board size and topology are not theme axes.
- No decoration inside the board. The quiet backdrop is allowed only behind the
  puzzle and never changes contrast.

## Feedback and feel

- Animations:
  - Pick up: scale 1.05 and 2 px outline, 80 ms, `--ease-out`; a short `pick-pop`
    on the mini piece; sound `pick`.
  - Drag ghost: no animation; follows the pointer.
  - Drop: settle 80-120 ms; sound `place`.
  - Invalid drop: the ghost disappears, the tray slot shakes for 220 ms, and a
    touched board cell gets a danger outline and a 220 ms shake; sound `invalid`.
  - Line clear: each cleared filled cell briefly scales to 1.08, then shrinks
    and fades over 1440 ms with an 8 ms row/column wave delay (0-56 ms). The
    board cell and its edge stay visible underneath throughout; there is no
    full-line wipe or flash. The fill motion finishes inside the owner-requested
    1500 ms busy window. This is an explicit override of the simple plan's
    usual under-300 ms motion guideline. Sound `clear`, with the pitch stepping
    up for each combo step.
  - Score and streak: a 160 ms bump when they change. The gained score floats up
    from the board for 600 ms; short pitch step in `clear`.
  - Run end: board dims over 300 ms; result appears after 450 ms; sound `end`.
  - New best badge: the existing badge pop; no win confetti because this is not
    a win state.
  - Reduced motion: no movement or scale; fades of 150 ms or less, or instant.
    The board ripple, tray slide, clear fill, settle, invalid shake, pick pop,
    and score/streak bump are disabled; a cleared fill disappears immediately
    and the board cell stays.
- Arrival: board cells ripple in a diagonal wave over 250 ms with a maximum
  168 ms row/column stagger, and the tray slides in over 200 ms; both finish
  inside the 600 ms arrival deadline. Exit is an instant screen swap in this
  simple build; the shell exit protocol is deferred. Reduced motion disables the
  ripple and slide. Animations never advance the game state.
- Replay hook: score, personal best, "so close" result line, and Next for a new
  seed. Next always starts a fresh run; it never offers the same board.
- Sound palette: the existing soft synth palette. No external audio files.

## Teaching

- Tutorial depth: `hint` on the first round only. One line under the board:
  "Drag or tap a piece. Fill a row or column." After the first placement it
  becomes the short "Fill a row or column." reminder. Later rounds show no
  footer. While a piece is selected it shows the tap/drag fallback. Everything
  else is described in accessible labels, not a tutorial wall. The
  `morphi.block.hintSeen` marker is saved when the first round starts; if storage
  is blocked, the in-memory fallback still suppresses it for the session. Coach
  marks can replace the hint after playtesting if needed.

## Risks

- Edge cases for `docs/EDGE_CASES.md`: no fitting piece in the initial tray
  (impossible on an empty board); no fitting piece after a refill; a refill
  during the opening guarantee; clearing two or more lines at once; a clear that
  completes both a row and a column; combo reset on a non-clearing placement;
  placement over an occupied cell; placement partly off the board; tapping a
  piece then tapping an invalid cell; tray refill after the third placement;
  reaching the 300-placement cap; resize and orientation change mid-run;
  reduced motion; refresh/abandon; replaying the same seed and moves.
- Performance risks: 64 DOM cells and 3 tray pieces are small. Avoid a reactive
  animation per cell; use one board state and CSS classes. Line clears should
  update the model immediately and animate the removed cells only. Long runs
  must not leak timers or event listeners.
- IP check: the mechanic (place polyominoes, clear lines, endless score) is
  generic. Use an original name, original flat art, original sounds, and original
  code. Do not copy the name, look, piece palette, or UI of 1010!, Block Blast,
  Woodoku, or any other existing game. No ads, timers, or energy systems.
- Main design risk: a run can dead-end before the player understands why. The
  10-placement fairness window and the visible tray are the mitigation; watch
  first-run length and "no moves" reactions in playtesting.

## Approval

- Visual sample: `/demo/block.html` (sample board; add `?empty` for an empty start).
- Owner approval date (Step 3): 2026-10-20 (in chat).
- **Owner approval gate: closed 2026-10-20** after the final board color change:
  cells `#CDD9EE`, edge `#C8D3E5`. All other aspects are approved.
- **User testing gate: closed 2026-10-20.** 10 owner-run testers, mixed phone
  and desktop; owner-reported acceptance. Two were silent, Next/return counts and
  exact devices were not recorded, and no one rejected it. Testers 3 and 8 asked
  for more/clearer animation; tester 9 suggested a total elapsed timer until the
  result box, which the owner is parking in `IDEAS.md`.
- **Step 4 owner review: closed 2026-10-22.** The themes, HUD, first-round hint,
  amplified clear, Block/Memory rotation, themed Memory rounds, and the mobile
  layout fixes (centered Block board, larger Memory layout, smaller HUD type)
  were checked on a phone in portrait and landscape and accepted. Step 5 is live
  at `https://morphi.one`; manual round-start/Next measurement is in progress.
- Game-feel review notes: Owner approved the Step 3 defaults. Desktop picker must
  be vertical and may sit on the left or right; small screens place it below the
  board. Precise feel testing happens in the real build.

## Build status (2026-10-22)

- Engine: `block-placement-1` in `src/lib/game/block.ts`, seeded 9-piece bags,
  the 10-placement opening guarantee, simultaneous row/column clears, combo
  scoring, the 300-placement cap, and replay from moves.
- Screen: `src/lib/screens/BlockGameScreen.svelte` with tap, pointer drag, and
  keyboard play; vertical right picker by default and a `traySide` prop for left;
  tray below the board on compact and medium screens.
- Step 4: four fixed seed-picked themes in `src/lib/ui/block-themes.ts`, each
  with its own backdrop, board cell/edge, picker tray/slot, and four piece
  colors; HUD with Score, Lines, Streak, Round, and Best; first-round-only hint;
  invalid-cell feedback; stat and pick bumps; and a 1500 ms fill-only clear wave
  that keeps the board cell visible. Theme selection has five unit tests; one
  more covers the hint-storage memory fallback; seven selector tests cover the
  rotation; five more cover Memory themes. Total suite: 74 tests.
- Rotation (owner addition 2026-10-20): `src/lib/selector.ts` picks the family
  with an injected RNG, Block first, then Memory, and never repeats a family in a
  row. Memory uses the same seeded themes; see `src/lib/ui/memory-themes.ts`.
- Measured: 44.13 px board cells at 360x640, board cells 37.63 px in the
  844x390 short-landscape profile (the 44 px target is for the 360x640 minimum),
  and a 520 px desktop board at 1280x800. 320x480, 320x568, 390x844, 768x1024,
  844x390, 1280x800, and 1440x900 all fit without page scroll.
- Input feedback: 5.2 ms from a tray click to the selected state and 17.9 ms from
  a board click to placement feedback in the latest local Chromium run; local
  evidence only, not a cross-browser latency claim.
- The shared Result screen takes a title and summary; Memory is routed again for
  rotation and uses the same Result screen; no resume in v1.
- Closed: the Step 3 owner approval gate, the 10-tester user testing gate, and
  the Step 4 owner review. Step 5 is live; do not change the deployment until the
  owner finishes the manual measurement.
