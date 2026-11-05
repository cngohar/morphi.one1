# Final engine refactor contract audit — Slice 7

Audit base: owner-confirmed Slice 6 `77ce70f`; frozen accepted base:
`v1.2-local-complete` → `1303c9c4bdb1718bb558886dc43b7b48c597a02a`.
Scope is local refactor closeout only. No language/framework/dependency change.

| Family  | Determinism class | Engine version      | Rules retained                                                               |
| ------- | ----------------- | ------------------- | ---------------------------------------------------------------------------- |
| Block   | Integer-only      | `block-placement-1` | Supply, placement, simultaneous clears, combo, no-fit/300-placement endings  |
| Memory  | Integer-only      | `memory-1`          | 6/8/10 pairs, deck, flips/mismatches, completion and score                   |
| Connect | Integer-only      | `connect-1`         | Stroke validation, redraw penalties, all-pairs win, optional full-grid bonus |

There are no physics-class puzzles. The implemented contract is
`src/lib/engine/contract.ts`, engine README, family manifests and vectors;
`docs/CONTRACT.md` was never created. This audit does not invent a second contract.

## Determinism and replay

- `engine/rng.ts` is byte-identical to the frozen base: SplitMix64 v1 with
  masked unsigned 64-bit BigInt state, unsigned decimal input bounded by
  18446744073709551615, rejection-sampled integer draws, descending Fisher–Yates.
  External entropy remains in `seeds.ts`, outside engine logic. Leading-zero
  decimal input is accepted by the original RNG parser; checkpoints require
  canonical decimal spelling. No seed-format migration is introduced.
- Logic uses integer operations. Approximate color math stays in `engine/theme`.
  ESLint checks actual sources; `check-boundaries.ts` deliberately probes banned
  clocks/randomness, approximate math and forbidden imports. The latter remains
  in `verify`. RNG rejection and shuffle-bound regressions are in Slice 7.
- Theme generation creates an independent, family-domain-separated RNG. Theme
  draws do not advance puzzle RNG state. Slice 7 interleaves cosmetic draws with
  every family generation at 0, 42 and the maximum seed, and repeats replay vectors.
- Family `parseMove` methods preserve canonical field order. Server validation
  rejects invalid envelopes/moves/versions; authoritative replay computes scores.
  Reordered submissions are canonicalized before SHA-256 retry hashing.
- Cosmetic output does not enter the gameplay vector fingerprint. The server's
  submission/idempotency hash also authenticates submitted theme version metadata;
  it is a separate payload identity hash, not the gameplay determinism fingerprint.
- Default scoring is still `brief-v1` with identical coefficients. D1 migration
  0008 forbids score snapshot UPDATE/DELETE. Admin save/rollback inserts new
  audited versions. Issued runs replay with the exact scoring version; unknown
  historical versions fail closed rather than silently using current values.

## Frozen behavior and vectors

`reference.json`, `connect.json`, `connect-partial.json`, `block-cap.json` and
`reference.py` are byte-identical to the frozen base. Existing logic tests,
`round-timing.ts`, motion wrapper, `RoundStage.svelte`, sound playback and
`static/audio/` are unchanged. The three logic-file diffs only generalize Move
typing and replace central scoring imports with identical package-owned defaults.
Replay/ending behavior was retained in manifests. Checkpoint partial replay is
an already-authorized recovery addition, not a change to completion validation.

**Existing cosmetic exception:** only Slice 5 commit `5811356` regenerated
`tests/vectors/themes.json`, for `theme-2026-11-02-1` / `oklch-machado-2`.
See that slice's phase report and DECISIONS entry; the owner confirmed Slice 5.
All six cosmetic records changed. Thus “all vector files unchanged from Slice 0”
is false; gameplay fixtures are unchanged, and cosmetic fixtures are frozen at
that accepted Slice 5 commit. Slice 7 tests both baselines explicitly.

The existing six-runtime harness is reused unchanged: Node, Bun, Chromium,
Firefox, WebKit and local workerd each assert 9 gameplay and 6 cosmetic vectors.
Its returned SHA-256 fingerprint covers RNG/Memory/Block reference output;
Connect and partial-win records have separate exact JSON equality assertions.
The 300-placement Block cap fixture is additionally exercised by puzzle units;
it is not an additional six-runtime harness record.

## Generic package boundaries

Registry generation discovers packages and emits eager headless catalog,
lazy views/pools and small metadata/message/selection projections. Shared server
validation, replay, scoring/timing/groups, theme family lookup, selector,
checkpoint envelope and admin presentation use manifests or generic records.

Existing synthetic-family regressions cover discovery/type-check, folder/id
independence, lazy graph isolation, real D1 issuance/replay/canonical retries,
history/leaderboards/admin/audit, arbitrary selector families, presentation and
backdrop isolation. Slice 7 closes two remaining package-extension gaps:
checkpoint phase accepts bounded nonempty package-owned strings, and server
weight/initial lifecycle defaults honor manifest values. Current shipped games
keep their existing defaults and phase behavior.

Legacy redirect slugs, old migration data and CSS radius aliases are compatibility
artifacts, not active family dispatch. A new family owns its package, view,
manifest, strings, scoring, tests and README, then runs registry generation; no
shared family branch is required. Theme profiles may use the existing generic
fallback or be supplied as editable config data.

## Slice 0 status

`slice0-base-tag.test.ts` adds a retrospective annotated-tag/target/ancestry check
without app changes. It cannot establish that HEAD was checked before Slice 1.
The original timed pre-Slice-1 HEAD check remains deferred and outstanding for
an explicit owner waiver decision at final acceptance; it is never reported as
having run or passed retrospectively.
