# Nonogram (`nonogram`) — v1.4.1

Design source: owner-selected rev 3 brief and preserved seven-puzzle visual fixture,
`static/demo/v1.4.1-nonogram.html`. The owner explicitly requested local completion
on 2026-11-09. This records implementation authorization, not functional acceptance.

Fill the picture described by ordered row and column runs. Mark proved empty cells
with X. Classic has no loss state. Different colours may touch; same-colour runs
need one empty cell. Sizes 5×5, 10×10 and 15×15 are difficulty bands, never variants.
Generation uses one seeded integer RNG stream, derives clues, and requires both
line-solvability with a live opening and a counting-solver uniqueness proof. After
100 attempts, drop a band; exhaustion at 5×5 rejects generation.

Touch/click fills; right-click or long-press marks X. Drag stays on one row/column
and stops on a checked mistake. One Undo cancels a stroke including Auto-X.
Keyboard arrows move focus; Space fills, X crosses. Fill/X/Erase, Hint, Check,
Auto-X and same-seed Restart use replayed numeric moves.

The baseline and ten single-rule deltas are exactly §3 of the rev 3 brief:
two colours, five colours, hidden quarter of clues, totals only, unchecked fills,
count-only check, thirty-minute countdown, three hearts, no undo, three-hint budget.
No cosmetics, ordinary sizes or seeds acquire variant identities. All ship enabled.

Score: 1,000 completion + 10 per filled cell + 10 per second under par
(180/600/1,500 s), minus 50 per mistake and 100 per hint, floored at zero.
Countdown adds 10 per remaining second; hearts add 250 each. Each preset has its
own immutable editable `brief-v1` config. Losses save no score. Active timing
floors are exactly 2,500/10,000/22,500 ms; below-floor daily completions consume the
attempt and save unranked without a board row.

Board key: `(nonogram, UTC date)`; variant boards: none. Internal variant IDs and
scoring never appear on player surfaces. Existing daily issuance is reused.

The DOM grid and sticky clue gutters size to their container. Portrait caps at
15×15; 44px cells apply where they fit, with smaller cells on compact screens.
Landscape reflows controls beside the board. No generic wide-stage system.
The seeded backdrop contains only clue-grid motifs, hidden on compact layouts,
with 1–5 objects on each side on wide layouts.

Motion uses the existing anime.js wrapper: 2,500ms board/clue entrance, fill/X
pop, mistake shake, hint pulse and win reveal. Logical readiness owns input;
reduced/failed motion settles, and hidden practice pauses active deadlines.
Ranked time stays server wall-clock. Existing pick/place/invalid/win/clear cues
are reused. Teach one line on the first round and a first two-colour coach.

Clear uses completion/fade-rise/auto_500ms and genuine filled/mistake outputs.
Countdown and heart losses use run_over overrides and retain the failed board.
Risks/checks: generation bounds, clue adjacency, empty/full lines, whole-stroke
undo, rapid input, hide/resume, resize, navigation cleanup and failed motion.
No production or physical-device acceptance is inferred.
