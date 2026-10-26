# Block placement

Owns `logic.ts`, `manifest.ts`, `Game.svelte`, themes, and tests. It never imports another puzzle. Shared imports are the deterministic engine and common app presentation helpers.

Rules version: `block-placement-1`. Existing rules and vectors are preserved: 8×8 board; three-piece trays; seeded nine-piece bags; opening fairness for ten placements; rows/columns clear together; combo scoring; terminal no-fit or the 300-placement cap. A saved replay must reach a terminal scored-run ending and contain only legal placements. The manifest bounds each log at 300 moves. All-time ranked results use one compatible rules group.

The view records successful placements and queues a completed result as soon as the logic becomes terminal, before clear/end animations. Themes are cosmetic and never alter supply, placements, or scores. The four curated themes remain the approved short-plan behavior. The v1 selector draws the starting family from its injected RNG; Block-first was a first-test override removed by the owner on 2026-10-24.

Tests: local logic/theme tests, shared theme consistency, server integration, layout/input browser regressions, and cross-runtime vectors. `tests/vectors/block-cap.json` is a valid 300-placement benchmark workload (seed 784); it is a measurement input, not an independent scoring specification. The pre-existing seed-0/20-placement vector remains the independent scoring regression.
