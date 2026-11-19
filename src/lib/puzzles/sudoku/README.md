# Sudoku

`sudoku-1` derives the board and its clues from one SplitMix64 seed. The server
rebuilds the board and replays numeric actions to validate the outcome.

| Preset      | Rule                                                                               |
| ----------- | ---------------------------------------------------------------------------------- |
| Classic     | Rows, columns and 3×3 boxes each hold digits 1–9 once.                             |
| Diagonal    | Both main diagonals also hold every digit once.                                    |
| Irregular   | Nine connected regions replace the 3×3 boxes.                                      |
| Killer      | Dotted cages show the sum of distinct digits. The board keeps givens.              |
| Thermo      | Digits increase from the bulb to the tip.                                          |
| Anti-Knight | Cells a knight’s move apart have different digits.                                 |
| Kropki      | White dots mean consecutive digits. Black dots mean one digit is double the other. |
| Countdown   | Finish within 600 seconds of active ranked time.                                   |
| No Hint     | The hint action is unavailable.                                                    |
| Odd–Even    | Circles require odd digits. Squares require even digits.                           |
| XV          | An X marks a sum of ten. A V marks a sum of five.                                  |

Conflicting placements leave the board unchanged. A legal digit that differs
from the solution counts as a mistake. Undo restores the board and notes.
Mistakes, hints and restart costs carry through Undo and Restart.

See [Sudoku design and operator settings](../../../../docs/puzzles/sudoku.md).
