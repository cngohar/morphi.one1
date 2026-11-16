# Light Bend (`light-bend`)

Owner-approved baseline and Batch A, 2026-11-15: see the [brief](../briefs/v1.4.5-light-bend-codex-brief.md). Implementation and owner functional acceptance are separate; the latter remains pending.

## Core loop and controls

Turn mirrors to direct light through every crystal in one trace. A blocked beam is recoverable, not a loss. Checkpoints also require both tokens to be touched. Countdown ends without a score if time runs out. Reset restores the same board and starting mirrors without resetting time or spent hints.

Tap or click a mirror to turn it; drag to pan and pinch, scroll or use buttons to zoom. A drag over 12 px pans instead of turning; a second finger cancels a tap. Fit preserves a minimum playable cell size of 44 px, so larger boards may need panning. Keyboard controls include arrows, Enter, U, H, R, F, + and −; N advances from the result when Next is enabled. Up to three hints highlight a step toward a shortest solution; hints do not make moves.

## Difficulty, scoring and daily play

The seed selects Gentle (10×7), Medium (14×10), Hard (18×12) or Expert (20×14), with par windows 1–3, 2–5, 3–7 and 4–9 respectively. Place your own uses Gentle only and four tray mirrors. Generation plants a route, validates it and rejects boards without a proven shortest par; alternative complete routes also win. Generation is bounded to 100 attempts and the par search to 200,000 traced states.

The shared `brief-v1` defaults award 1,000 completion points, less 4 per scored second, with that component floored at 200; hints cost 100 and resets 50. Countdown instead adds 10 per remaining second to completion points. The final score is clamped to 0–10,000; undo is free. Values are admin-managed and issued scoring versions remain fixed. Stars grade final mirror changes or placements: three at or below par, two through par + 3, one for any other clear. Hints do not reduce stars. A hinted solve ranks by default, subject to the scoring configuration.

Board key: `(light-bend, UTC date)`; variant boards: none. The daily system issues one family board per UTC day; later plays are practice. The server replays moves, enforces the 10,000-move cap and requires 2,500 ms of server-measured gameplay for ranking. The existing untimed allowance makes the effective minimum approximately 3,500 ms after beam start for Classic versus 2,500 ms for Countdown. Below-floor solves save unranked, consume the daily attempt and do not create a board row.

## Variants and presentation

Classic and ten single-rule deltas are enabled; they are not player-selectable or player-facing identities. The [family README](../../src/lib/puzzles/light-bend/README.md) lists their rules. Each round teaches its own rule in plain language.

The family owns its SVG game, full viewport Stage and motion. The shared header, Card and result shell remain in use. Pan and zoom expose larger boards; the Light Bend beam motif is the family backdrop on wide layouts. The board entrance lasts 1 second, followed by a 2-second triangle arrival; input unlocks and the scoring clock begins at beam start. Reduced or failed motion settles the presentation without changing game rules. Existing cues are used; no new audio is included.

The completion ending uses `ending.light-bend.headline` and `ending.light-bend.subline`, with replayed crystal count and stars, `fade-rise` and `auto_500ms`. Countdown uses `run_over` and `ending.light-bend.timeUp` on timeout; the failed board remains inspectable and no score is saved.

## Evidence and limits

The [work note](../work/V1.4.5_LIGHT_BEND_WORK.md) records 59 focused unit cases, 11 real-D1 cases, 43 vectors across six runtimes and 24 single-worker Chromium cases passing. The work note records the remaining verification limits. Full verification and physical-device review were not performed. A professional trademark search is a pre-launch action, not legal clearance supplied by the brief. Batch B–J, dependent rescues, separate baselines, new sounds, other families and deployment are outside this milestone.
