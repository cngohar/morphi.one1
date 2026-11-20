# Shape Division

Tap two points to make a cut. Tap the same pair to remove it. A turn can be made
with successive cuts, and a swipe uses its two endpoints. Cuts run along the grid
inside the outline. Pieces detach as they separate, and Check evaluates the whole
partition. Connected pieces cover the board by construction.

The family ships enabled with ten enabled presets and zero variant leaderboard
groups. The centered game uses the shared RoundStage.

## Rules

| Preset                | Rule                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Classic               | Cut 12 squares into four congruent pieces. Rotation and reflection are allowed.                           |
| Two pieces            | Cut the shape into two congruent pieces.                                                                  |
| Five pieces           | Cut the shape into five congruent pieces.                                                                 |
| Four-square pieces    | Cut four congruent pieces of four squares each.                                                           |
| Equal area            | Cut four pieces of equal area. Their shapes may differ.                                                   |
| One tree              | Each of the four congruent pieces must contain one tree.                                                  |
| Given shape           | All four pieces must match the silhouette shown.                                                          |
| Five-minute countdown | Finish the same division before 300 gameplay seconds.                                                     |
| No hint               | Play the Classic rules with Hint and its shortcut disabled.                                               |
| Equality score        | Check a partial division for free. Any complete four-piece division scores in proportion to its equality. |

## Generation and daily

SplitMix64 grows a piece and joins orientations of it. Equal area can also join
different connected pieces of the required size. Exact cover counts partitions
up to two, and the forced-corner gate counts every locally legal placement.
One-tree generation requires at least two covers without the clue and one with
it. Given shape limits placement to the revealed silhouette. Equality score
counts perfect partitions only.

Easy uses a compact outline and limited contacts between the pieces. One-tree
allows two extra contacts so that the clue can distinguish multiple divisions.
Equal-area Easy requires multiple covers and a cover with at most one bent
piece. All ten presets have Easy witnesses. Unlimited boards can also use
other boards that meet the fairness gate.

Classic alone is daily-eligible. The server pins one board and scoring version
per `(shape-division, UTC date)` and uses the existing seed walk to select an
Easy board. An issued round can finish during the two-hour rollover window. The
board freezes at 02:00 UTC. Losing, abandoning or saving below the timing floor
spends the daily attempt.

## Scoring and controls

Gameplay time excludes the 1,200 ms card entrance and
`clamp(80 × perimeter, 700, 2600)` ms board entrance. A ranked win must reach
2,500 ms of gameplay. Countdown adds points for whole seconds left. A timeout or
the last allowed wrong Check is a completed loss with zero points and no daily
board row. Undo is free and only reverses cuts. Restart clears cuts and current
mistakes and keeps the board, the clock, and spent hints.

The default win score starts at 1,000, loses one point per gameplay second to a
floor of 200, subtracts hint, wrong Check and Restart deductions, and adds any
countdown bonus. Equality score multiplies this result by the rounded equality
percentage and floors the result. The equality percentage weights the smallest
to largest size ratio and the largest congruent group proportion equally.

The hint marks one cell from a witness piece that the current cuts have kept
intact. If no such cell remains, no move or charge is recorded. Arrow keys move
between vertices. Enter and Space set endpoints, Escape clears a pending point,
and U, H, R and C invoke Undo, Hint, Restart and Check.

## Operator settings

`brief-v1` uses integer values from 0 to 10,000. Updates create an immutable
version for the next unpinned daily. Already issued sessions retain their values.
The countdown, Easy daily grade, timing floor, geometry, and win rules are
code-defined.

| Field                     | Default | Help                                                                                                                                                                                                            |
| ------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `completionPoints`        | 1000    | Points for completing a division. Same for every preset in this family.                                                                                                                                         |
| `pointsPerSecond`         | 1       | Points lost per second of gameplay. The time deduction is floored so a slow solve still scores something — see timeFloorPoints.                                                                                 |
| `timeFloorPoints`         | 200     | Lowest the time part can go. A solve slower than 800 seconds still earns this much from the completion part before other deductions.                                                                            |
| `hintCost`                | 100     | Points lost per hint. A hint reveals one cell's piece assignment from the stored solution.                                                                                                                      |
| `hintSolvedRanks`         | 1       | 0 means a hint-solved daily does not rank. Any positive number means it still ranks, labelled 'solved with hint'. The validator accepts any integer 0–10,000; the saver only checks for 0.                      |
| `hintCap`                 | 3       | Most hints a player may use in one round. 0 means hints are off for this family.                                                                                                                                |
| `mistakeCost`             | 50      | Points lost per wrong Check. A wrong Check is the only mistake in this family.                                                                                                                                  |
| `mistakeLimit`            | 3       | Wrong Checks allowed before the run ends. The run ends on this many wrong Checks. Set to 0 for no limit — wrong Checks still cost points but never end the run. (Sudoku precedent: mistakeLimit 0 = unlimited.) |
| `restartCost`             | 50      | Points lost per restart. A restart re-cuts the same board — it never re-rolls.                                                                                                                                  |
| `countdownBonusPerSecond` | 1       | Points per second left on the countdown when the division is completed. Countdown presets only.                                                                                                                 |

Replay accepts up to 10,000 moves. The final slot is reserved for a terminal
Check or an eligible timeout. The production generator uses whole square cells.
The reference diagonal board overlaps triangles and is excluded. Symbols are
deferred. See the [accepted brief](../briefs/v1.4.9-shape-division-codex-brief.md).
