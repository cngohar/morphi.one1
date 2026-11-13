# Mahjong Solitaire

Self-contained `mahjong-solitaire-1` family. The accepted
[v1.4.2 brief](../../../../docs/briefs/v1.4.2-mahjong-codex-brief.md) controls this
implementation. Own SVG Game, Stage, motion, manifest, scoring and messages;
shared engine/server/daily contracts are reused unchanged.

Free means uncovered by every higher-layer rectangle and open on at least one
same-layer left/right edge. Standard matches are exact faces except Flowers
and Seasons each form their own group. Clear the player board to win; the
generation witness never determines the player's result.

| Internal preset | Delta from Classic                                             |
| --------------- | -------------------------------------------------------------- |
| classic         | Pairs, face up, free-tile cues, unlimited helpers.             |
| triple-match    | Three free matching tiles; fixed 108-tile Triple Turtle.       |
| exact-only      | Bonus faces match exactly; paired 2-Flower/2-Season bonus set. |
| face-down-peek  | Twelve hidden tiles; recorded permanent peek.                  |
| no-highlight    | Free-tile cues removed.                                        |
| countdown       | 180-second Quick / 600-second larger-band limit.               |
| three-hearts    | Mismatch costs a heart; zero ends the run.                     |
| no-undo         | Undo disabled.                                                 |
| hint-budget     | Three hints.                                                   |
| shuffle-budget  | Three shuffles.                                                |
| avalanche       | Screen-above tiles slide into vacated same-column slots.       |

Quick/Turtle/Fortress are bands, drawn first from SplitMix64; triple is exempt.
Frozen coordinates use integer half steps. Generation reverse-deals shuffled
matching groups onto a removal witness, replays it, bounds attempts at 100 per
band and falls back toward Quick before rejection. Hidden positions are chosen
only after proof; avalanche proof uses sliding geometry. Shuffle rebuilds only
surviving faces and clears Undo. Restart retains the deal and spent costs/time.

Board key: `(mahjong-solitaire, UTC date)`. Variant boards: none. Groups: **0**.
Presets ship enabled. Scores use immutable per-preset `brief-v1` coefficients,
server replay and exact 2,500/10,000ms timing floors. Failed runs save no score.

Keyboard: arrows among free tiles, Enter/Space select, Escape clear, H Hint,
U Undo, S Shuffle, R same-deal Restart. Fit/zoom and panning bound larger layouts
on narrow screens. Family animation is presentation only; the 2,000ms logical
entrance deadline owns input. Reduced motion and animation failure settle safely.
Generic existing audio only. No new assets/dependencies or shared shell edits.

Focused units, frozen six-runtime vectors, real D1 and one-worker Chromium tests
live alongside this family and under `tests/{vectors,integration,e2e}`. Full
verification and owner functional/physical-device acceptance are separate.
