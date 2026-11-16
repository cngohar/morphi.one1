# Light Bend

`light-bend-1` implements Classic and ten enabled Batch A rule deltas. They share `brief-v1` family scoring and the single `(light-bend, UTC date)` daily board; `presentation.groups` is empty. Variant identities are internal and each round teaches its applicable rule in plain language.

| Preset               | Rule difference from Classic                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Classic              | Turn existing mirrors until one trace lights every crystal; up to three hints and undo are available. |
| Place your own       | Place and turn mirrors from a four-mirror tray on a Gentle board.                                     |
| Colour beam          | Filters change beam colour; crystals light only in their own colour.                                  |
| Splitters            | Split beams into branches and trace both.                                                             |
| Portals              | A matching portal pair carries the beam out in the same direction.                                    |
| Two sources          | Both beams fire together and can cross without mixing.                                                |
| Fire to test         | The beam is hidden while setting mirrors; Fire tests the trace.                                       |
| Two-minute countdown | Finish before 120 seconds; timeout saves no score.                                                    |
| No undo              | Undo is unavailable; Reset restores starting mirrors.                                                 |
| No hints             | Hints are unavailable.                                                                                |
| Checkpoints          | The trace must also touch both checkpoint tokens.                                                     |

Generation is deterministic and path-first. It validates the witness and computes a shortest par, rejecting boards that fail the fairness gates or search budget. The player can win with any valid trace; the witness is not the win condition. Hints point toward a shortest solution. Reset retains the seed, time and spent hints; all actions are replayed. The trace has a bounded loop guard. Difficulty bands are seeded, not player-selected; place your own is limited to Gentle.

Default untimed scoring is `max(200, 1000 - 4 × seconds) - 100 × hints - 50 × resets`; Countdown uses `1000 + 10 × remaining seconds` before the same penalties. Scores are clamped to 0–10,000. Stars measure final mirror changes or placements against par, independently of points. The server replays the round and applies the 2.5-second gameplay floor; below-floor daily solves are unranked and consume the attempt. Hint-solved rounds rank by default, controlled by the immutable issued scoring version.

The family Stage supplies the full pan/zoom viewport, and `motion.ts` owns its entrance. The shared header, card, timing and save contracts remain in use. The accepted [brief](../../../../docs/briefs/v1.4.5-light-bend-codex-brief.md) and [work note](../../../../docs/work/V1.4.5_LIGHT_BEND_WORK.md) describe scope and recorded checks. Owner functional acceptance, remaining focused checks and full verification are not established by this README.
