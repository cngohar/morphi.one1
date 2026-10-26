# Memory

Owns `logic.ts`, `manifest.ts`, symbols, card/symbol/confetti components, `Game.svelte`, and the four curated themes. It never imports another puzzle. Shared imports are deterministic engine foundations and common app presentation helpers.

Rules version: `memory-1`. The seed chooses 6/8/10 pairs, the symbol set, and shuffled card order. A matched pair remains revealed; mismatches resolve before the next attempt. A complete replay must win, reject ignored/extra/out-of-range moves, and stay within the bounded log. The replay adapter caps attempts at six times the pair count (12 flips per pair; at most 120 flips).

Score: `max(0, pairs * 1000 - mismatches * 150 - wholeSeconds * 5)`. Solo uses visible active time. Ranked uses server start-to-claim wall time, minus the fixed one-second network allowance, rounded down to whole seconds. Ranked time includes preview, background time, and submission delay; hiding the tab does not pause ranked scoring. The local HUD is an estimate; the result's ranked-save line and account/leaderboard show the server result. Boards are separate for 6, 8, and 10 pairs. No client score is accepted.

The view records accepted flips and queues a completed round before the win animation. Cosmetics never consume the logic RNG stream or alter scoring. Four fixed palettes and viewport-based layouts remain the short-plan scope; procedural theme expansion is deferred.

Tests: local `logic.test.ts` and `themes.test.ts`, the app-level theme consistency test, integration/browser account flows, and `tests/vectors/`. A version mismatch is rejected explicitly; no old replay is silently re-scored.

Replay proves legal moves, not human play. The entire deterministic board is available to the client, and the existing preview reveals it. These leaderboards have no prizes and make no claim of bot-proof competition.
