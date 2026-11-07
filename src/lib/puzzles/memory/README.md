# Memory

Owns the `memory-1` engine, manifest, messages, scoring, symbols, themes, and view. It never imports another puzzle. Cosmetic themes never consume the logic RNG or affect rules and scores.

The seed chooses 6/8/10 groups and the symbol set. The family-owned variants are:

| Variant             | Rules                                                                           | Scoring default                                         | Leaderboard groups                                                         |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `memory:classic`    | Two identical cards match; entrance, three-second preview, then hide            | `brief-v1`: 1,000/pair − 150/mismatch − 5/second        | `memory-1:6`, `memory-1:8`, `memory-1:10`                                  |
| `memory:no-preview` | Classic deck and rules; face-down entrance, no preview or opening allowance     | Shared `brief-v1`                                       | `memory-1:no-preview:6`, `memory-1:no-preview:8`, `memory-1:no-preview:10` |
| `memory:trios`      | Three identical cards match; a mixed set turns back after the third flip        | `memory-trios-v1`: 1,500/trio − 150/mismatch − 5/second | `memory-1:trios:6`, `memory-1:trios:8`, `memory-1:trios:10`                |
| `memory:moving`     | Classic matching; after a mismatch, only still-down unmatched positions shuffle | Shared `brief-v1`                                       | `memory-1:moving:6`, `memory-1:moving:8`, `memory-1:moving:10`             |

| `memory:budget` | Classic matching; 2 completed attempts per group. Exhausting them unfinished is a run-over (no score, no saved result); the last attempt may still win | Shared `brief-v1` | `memory-1:budget:6`, `:8`, `:10` |
| `memory:lockout` | Classic matching; the last card flipped in a miss cannot be flipped on the next completed attempt (no lock when fewer than two other unmatched cards remain) | Shared `brief-v1` | `memory-1:lockout:6`, `:8`, `:10` |
| `memory:swaps` | Classic matching; after a miss hides, two down unmatched cards swap from the continued logic stream and stay marked until the next accepted flip | Shared `brief-v1` | `memory-1:swaps:6`, `:8`, `:10` |
| `memory:two-backs` | Classic matching; every pair has one dotted and one striped back, so same-back cards never match | Shared `brief-v1` | `memory-1:two-backs:6`, `:8`, `:10` |
| `memory:quads` | Four identical cards match; 4/5/6 groups (16/20/24 cards), six attempts per group | `memory-quads-v1`: 2,000/quad − 150/mismatch − 5/second; ranked minimum 0.8 s/group | `memory-1:quads:4`, `:5`, `:6` |
| `memory:collapse` | Classic matching; matched cards leave and survivors close up in reading order (`cleared` counts removed cards) | Shared `brief-v1` | `memory-1:collapse:6`, `:8`, `:10` |

Round state added only by these identities: `lock` (lockout), `marked` (swaps; `rngDraws` counts logic-stream draws like moving), `cleared` (collapse), `back` on cards (two-backs). Classic, no-preview, trios and moving keep their original serialization. A swap with fewer than two eligible cards is a no-op with no draw.

An omitted variant means classic. Explicit classic and omitted-classic generation keep the original round serialization, deck, and replay unchanged. New variants carry their family-scoped code. Moving additionally persists `rngDraws`, counting every SplitMix64 draw including rejection sampling. Each mismatch continues the same seed stream after all previous generation/shuffle draws; matched and currently revealed cards stay pinned. Hiding the revealed mismatch consumes no RNG.

A move in the replay log is one accepted flip; `round.moves` counts completed attempts. Replay caps remain 12 flips per pair for pair variants and are 18 flips per trio for trios (six attempts per group; absolute maxima 120/180). The trios view stops accepting input at its cap, preserves the visible board, and shows an instruction to use the existing Home control. An unfinished cap is not a win, saved completion, or result. The last permitted attempt may still win. No new loss flow is introduced.

Scores floor at zero. The server replays moves and never accepts a client score or ranked seed. Solo uses visible active time. No-preview begins its clock with the face-down deal and skips preview/hide; other variants retain the fixed entrance, full preview, and hide before their clock/input. Ranked uses authoritative server elapsed time and the variant's fixed opening allowance, including background and submission time. The no-preview allowance is zero; the shared Card allowance is handled by the app. Ranked minimum time retains 0.2 seconds per required flip (0.4/group for pairs, 0.6/group for trios). HUD timing is an estimate.

Immutable scoring edits change future rounds; classic/no-preview/moving share pair scoring, while trios owns its separate definition/history. Variant groups never mix scores. Persistence, eligibility, and lifecycle remain app/server concerns.

Tests: `logic.test.ts`, `variants.test.ts`, `themes.test.ts`; Memory-only six-runtime fixtures and entrypoints are `tests/vectors/memory-*`. Frozen classic vectors remain in `reference.json`; `memory-variants.json` adds generation and a two-mismatch moving replay, independently derived with SplitMix64/Fisher–Yates. Run the scoped vector harness with `bun scripts/check-vectors.ts --memory`. Replay proves legal moves, not human play; these leaderboards have no prizes or bot-proof claim.
