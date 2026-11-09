# Nonogram — `nonogram-1`

Classic fills a monochrome picture from ordered row/column runs, with at least one
empty cell between runs. Empty lines show 0. Unknown, fill and X are distinct marks;
checked play needs every solution cell filled, with X completion optional.

| Preset        | Single rule change from Classic                                      |
| ------------- | -------------------------------------------------------------------- |
| Classic       | Checked fills, full clues, standard helpers, no loss                 |
| colour-2      | Two required fill colours; unlike colours may touch                  |
| colour-5      | Five required fill colours; unlike colours may touch                 |
| partial-clues | Seeded quarter of lines hidden, rounded down to whole lines          |
| totals-only   | Monochrome filled totals replace run breakdowns                      |
| unchecked     | Wrong fills persist silently; Check reveals them; every cell decided |
| strict-count  | Silent fills; Check returns only the number of wrong filled cells    |
| countdown     | Thirty minutes, wrong fills remove 2/4/8 minutes; zero loses         |
| three-hearts  | Wrong fills refuse the mark and remove a heart; zero loses           |
| no-undo       | Undo unavailable; manual Erase remains legal                         |
| hint-budget   | At most three line-solver hints                                      |

Sizes 5/10/15 are bands. Every preset has an immutable per-preset `brief-v1` scoring
scope. Variant board groups: **0**. Board key: `(nonogram, UTC date)`; one identical
server-issued daily puzzle. Internal storage of group-less completions uses the
family cohort `nonogram`, which is never a board or a variant identity.

Generation uses one SplitMix64 stream and integer calculations. Seeded silhouettes
have about 50–60% filled density. Clues are derived; every accepted picture passes
its actual variant's line solver with a non-dead opening and a counting proof
stopping at two. The pipeline keeps 100 attempts per band, then drops 15→10→5;
full exhaustion throws. Solutions are test witnesses only, never issued state.

Moves have exactly numeric `at,cell,mark,stroke` keys. Cell marks are -1 X, 0 Erase,
and 1–5 fill colours. Control marks 6–12 replay Undo, Check, Hint, Auto-X off/on,
Restart and countdown expiry; their cell is -1. Strokes start sequentially at 0
and stay adjacent on one row or column. Undo restores the whole stroke including
Auto-X. Restart retains the puzzle, elapsed time and spent penalties/hints.

`Game.svelte` owns container reflow and controls; rules and scoring stay in the
engine. Entrance readiness uses the logical 2,500ms active deadline. Motion and
sound are cosmetic. Losses retain the board, save no score, and use the shell's
exact-session abandon action when the player leaves. No Batch B or new sounds.
