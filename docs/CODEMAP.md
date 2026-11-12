# CODEMAP.md

## Nonogram shell migration — built; verification STOP, not accepted (2026-11-12)

**Owner acceptance (2026-11-12): ACCEPTED.** Supersedes the prior migration-stop wording; ranked reload/resume is deferred as a separate pre-launch policy decision, proven pre-existing at `e69bfe5`, not a migration issue and not waived.

Implemented Steps 1–5 of the accepted shell-migration brief and its §5A
carve-outs. Required focused verification is incomplete: the ranked daily
reload/resume browser case fails on an existing session-abandonment path.
No owner acceptance, waiver or final verification pass is inferred.
This remains a v1.4.1 revision with engine version `nonogram-1`.

### Built files and shared touches

- `src/lib/puzzles/nonogram/motion.ts`: moved `nonogramEnter` unchanged from
  shared motion; `Game.svelte` imports the family file. Shared card and Connect
  motion remain unchanged.
- `src/lib/puzzles/nonogram/Stage.svelte`: copied RoundStage's required props,
  three required snippets, methods, guarded card calls and inert rules. One
  optional `footerContent` snippet supplies session-owned help/high-score
  content; the family Stage renders the copied bottom footer bar. Existing
  shared RoundStage, PuzzleHelp and SiteHeader remain unchanged.
- `scripts/generate-registry.ts`: native `Stage.svelte` presence detection emits
  a partial lazy `puzzleStages` registry and a component type derived from
  RoundStage. Ran `bun run registry:generate`; only `src/lib/registry.ts`
  changed among generated projections. No generated file was hand-edited.
- `src/lib/screens/PlaySession.svelte`: bounded/abortable Stage loading before
  fresh daily issuance and before fresh/resumed state replacement; missing
  registrations use RoundStage. Stage assignment follows successful preparation
  and the previous result exit. The binding interface and `cardBeat()` remain
  unchanged. Failed Next loads retain result data and the pending selector
  family, show the existing failed card with Retry/Home, and permit Retry.
  One shared snippet retains footer content and help-pause state.
- `src/lib/ui/game-shell.css`: moved exactly 18 Nonogram-only rules into family
  Stage CSS, preserving declarations, specificity and media queries. Existing
  980px width and container-based cell/clue sizing remain.
- `tests/e2e/nonogram.spec.ts`: only the authorised motion-failure injection
  target changed from shared motion to the family motion file.
- Reporting: this CODEMAP entry and the factual migration entry in
  `docs/DECISIONS.md`. The owner brief, existing owner documentation changes,
  unrelated template/editor/MCP files and all other families are preserved.

No version bump, new dependency, engine/logic/manifest/scoring change, selector,
server, schema, migration, shared card-shell change or other-family migration.
Locked timings remain: entrance 2,500ms; deal/flip/unfold/fold/result exit
650/400/800/500/350ms. Active-time floors remain 2,500/10,000/22,500ms.

### Focused evidence and required stop

- Baseline and post-extraction evidence: `build/nonogram-shell-baseline/` and
  `build/nonogram-shell-step1/`; each returns green scoped checks, 30 unit
  cases, 20 real-D1 cases and 42 Chromium cases at one worker.
- Final static evidence:
  `build/nonogram-shell-final/static/verification.log`. Scoped format/lint,
  types (0 errors/0 warnings), 30 unit cases, 20 real-D1 cases, import boundaries,
  build and focused lazy-Stage isolation pass. Source assertions confirm the
  exact 18-rule CSS move and unchanged cardBeat/motion bodies.
- Original focused browser suite:
  `build/nonogram-shell-final/browser-42.log`, **42 passed**, one worker.
- Supplemental browser evidence:
  `build/nonogram-shell-final/browser-supplement-5.log`, **4 passed / 1 failed**.
  Passing coverage: optional registry/fallback; footer/help at widths 320, 390,
  844 and 1280 plus resize and missing-game measurement; locked card timings;
  initial/Next Stage-load failure with retained result, pending family,
  Retry and Home. The signed daily reload/resume case fails.
- Focused diagnostic:
  `build/nonogram-shell-final/browser-signed-diagnostic.log`, **1 failed**.
  Before reload the active-session API returns HTTP 200 with the session;
  after reload it returns HTTP 200 with null. The real reload visibility event
  reaches existing PlaySession `cardVisibility` → `reportAbandon` → server
  `recordRoundAbandon`, setting `play_session.abandoned_at`. No synthetic
  hidden event preceded this latest diagnostic. This handler was not changed
  by the migration.
- Required ranked checkpoint/reload/resume: **FAIL**. Ranked UI win/result/Next
  after resume: **NOT REACHED**, not a pass. The 20 real-D1 server cases,
  including below-floor unranked persistence/attempt consumption, still pass;
  they do not establish the failed browser flow.

The existing abandonment behavior and ranked attempt policy are outside the
narrow migration authorisation. Stop and report this gap; no server, policy,
activity handler or shared contract workaround was introduced.

**Motion wording tension:** §6 broadly asks for a failed card on motion failure,
but Step 1 and the stage contract require unchanged motion behavior. Existing
Nonogram entrance-motion failure safely settles to a playable board, as the
passing 42-case suite explicitly verifies. Stage-load failures show the failed
card with Retry/Home. No claim is made that entrance-motion failure transitions
to that card; adding a Game callback/shared contract change was not authorised.

**Edge cases recorded here:** absent Stage registration; bounded/aborted Stage
loads; initial and Next failure/retry with retained result/pending family;
measurement without `.game`; resize/rotation; help pausing and narrow-phone
footer bounds; reduced motion, hidden-tab timing and navigation during entrance.
The ranked reload failure above limits lifecycle verification. These notes
remain here because `docs/EDGE_CASES.md` is outside the brief's narrow edit list.

**Cleanup:** the temporary today-Nonogram daily puzzle and snapshot were restored
to their original null state; fixture users were removed. Runtime checks ended,
with no task process or port 5173 listener left running.

**STOP:** no owner acceptance, Mahjong, Tangram, other-family migration, Connect
motion move, sound work, full `bun run verify`, other-family tests,
physical-device measurements, commit, push, deployment, provisioning or release
step. Owner resolution of the ranked abandonment-policy scope gap is required
before the failed acceptance item can be completed.

## v1.4.1 Nonogram rev 3 — locally built and focused verification complete; STOP (2026-11-09)

Resumed the preserved pre-build handoff at HEAD `56e6460`; no reset or restart.
The owner explicitly instructed completion of rev 3, including §8A/§8B, then
focused §9 and STOP. That execution instruction supersedes the brief's draft
header/pre-build acceptance-line gate; it does **not** record functional acceptance.
The owner brief and seven-puzzle fixture remain unchanged. Required
`gpt-6.1-sol/high` agents implemented engine, UI and carve-outs. The required
`gpt-6-luna/max` verifier returned 503; the owner explicitly authorized parent
verification. All runtime evidence below is parent verification, without
substitute-agent or independent-verifier claims.

**Built:** Classic first, then exactly ten Batch A rule deltas. The baseline
passed eight initial units, types/scoped lint and eleven Chromium cases before
Batch A was added. Final catalogue: **11 enabled presets, 0 variant leaderboard
groups**, three size bands; one reused `(nonogram, UTC date)` board per day.
No new daily subsystem, schema, migration, dependency, selector or other-family
game implementation. Owner functional review remains pending.

### File inventory and authorized shared changes

- Design/rules: `docs/puzzles/nonogram.md`,
  `src/lib/puzzles/nonogram/README.md`.
- Engine/manifest/scoring/messages:
  `src/lib/puzzles/nonogram/{logic,manifest,scoring,messages}.ts`.
- DOM game and adapter: `src/lib/puzzles/nonogram/{Game,View}.svelte`.
- Units: `src/lib/puzzles/nonogram/{logic,variants}.test.ts`.
- Frozen vectors/runner: `tests/vectors/nonogram.json` and
  `tests/vectors/nonogram-runner.ts`; real D1:
  `tests/integration/nonogram.test.ts`; browser:
  `tests/e2e/nonogram.spec.ts`.
- Four small shared touches: `src/lib/ui/motion.ts` adds one `nonogramEnter`
  presentation method; `src/lib/round-timing.ts` adds the 2,500ms constant;
  `src/lib/ui/game-shell.css` adds Nonogram-only reflow/teaching spacing;
  `scripts/check-vectors.ts` adds `--nonogram`, with wrappers in temporary files.
- §8A: `src/lib/engine/contract.ts` makes manifest/variant groups and replay
  group optional; `src/lib/server/daily.ts` and `runs.ts` recover the original
  pinned family/date identity after session removal and across midnight;
  `src/lib/server/games.ts` maps family/variant rows to internal cohorts.
  **Zero-edit exception:** `scripts/generate-registry.ts` already strips client
  groups and accepts the relaxed contract; its source required no change.
- §8B: `runs.ts` stores `result.group ?? run.family`, compares exact active
  milliseconds in both timing branches, and saves below-floor claims unranked
  without a daily row while consuming the attempt. `games.ts` activity/history
  queries use surviving recorded starts for honest preset attribution.
  `memory-directory.ts` changes only its two authorized mapping/history call sites.
- `bun run registry:generate` regenerated
  `src/lib/{catalog,registry,family-index,puzzle-metadata,puzzle-messages}.ts`.
  **Zero-edit exception:** shared `src/lib/scoring.ts` is not generator output
  and needed no change. No generated projection was hand-edited.
- Required reporting updates: this CODEMAP, `morphi-plan-simple.md`, plus
  existing `docs/PHASE_REPORTS.md`/`DECISIONS.md` under AGENTS and
  `docs/EDGE_CASES.md` under §10. No new work-report file.
  Owner-provided brief/demo and unrelated `.cursor/`/`.vscode/mcp.json` are preserved.

### Decisions and limits

Clues derive from seeded silhouettes at 50–60% density. Actual colour/partial/
totals solvers certify line-solvability and uniqueness, with bounded counting
and 100 attempts per band before fallback/rejection. Full/empty and single-run
lines are processed first. Colour silhouettes place bounded coloured sequences
above the grid to preserve portrait cell space; RNG draw order stays fixed.
No generated solution or deduced grid is issued or checkpointed; clue-derived
proofs use an internal WeakMap. Player clues/state determine completion.

Partial clues round 25% down to whole lines: **2/5/7** hidden at sizes 5/10/15.
Seeded hiding retains the anchor, and the physically reduced clues still pass
their own solver. Only unchecked requires every cell decided; unknown and X
both represent empty cells for other modes' clue-based completion.
Numeric wire keys are exactly `at,cell,mark,stroke`. Undo restores the complete
stroke including Auto-X; Restart retains seed, time, penalties and spent hints.
Countdown/hearts losses leave the failed board, save no result, and abandon the
exact ranked session through the existing Try Another flow when leaving.

Ranked replay first resolves timing metadata at zero seconds, then validates
and scores with authoritative active seconds after opening allowances. The floor
comparison retains exact milliseconds; storage/scoring seconds remain floored.
Per-preset immutable `brief-v1` configs remain internal, never board keys.
Group-less completions without any surviving recorded start cannot be safely
attributed to a preset: family history retains them; preset activity/history
omits them. Grouped historical imports retain existing cohort attribution.
Existing other-family tests expecting `too_fast` rejection were not run or
rewritten under the focused scope; their expectations need review before full verify.

### Focused §9 evidence

Evidence directory: `build/v1.4.1/` (local, ignored). No full verification pass
or physical-device acceptance is inferred.

| Item                                                                                                                      | Evidence                                                                          | Result                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Scoped Prettier / ESLint                                                                                                  | `format-final.log`, `lint-final.log`, `lint-corrections.log`, `lint-teaching.log` | PASS; only owned/affected source. Global `bun run lint` wrapper not run.                                                               |
| Types                                                                                                                     | `types-final.log`                                                                 | PASS, 0 errors / 0 warnings; no suppression/waiver.                                                                                    |
| Import/purity boundaries                                                                                                  | `boundaries-final.log`, scoped ESLint                                             | PASS; official synthetic boundary self-checks, no other-family test suite.                                                             |
| Build / Nonogram lazy isolation                                                                                           | `build-final.log`, `lazy-final.log`                                               | PASS; dynamic View includes only its Game; no eager shell Game import.                                                                 |
| Generation, clues, actual solvers, legal moves, helpers, all rule deltas, group-less replay                               | `unit-final.log`                                                                  | PASS, 30 cases.                                                                                                                        |
| Frozen generation/solved/illegal/incomplete replays                                                                       | `vectors-final.log`                                                               | PASS, 33 solved + 66 rejected in each of Node/Bun/Chromium/Firefox/WebKit/workerd; one seed per preset/band. Clean final process exit. |
| Daily persistence/recovery, exact floors, timed branch, losses, audit, scoring isolation, group-less admin counts/history | `d1-final.log`                                                                    | PASS, 20 real-D1 cases with isolated `persist:false` database.                                                                         |
| Seeded clears, endings/result/Next, keyboard/helpers, all three bands/viewports, loss, lifecycle/failure/input            | Serial browser logs below                                                         | PASS, 42 unique Chromium cases at one worker.                                                                                          |
| Final portrait colours and readable HUD                                                                                   | `browser-captures-final.log`, `browser/colour-{2,5}-15-390x844.png`               | PASS; ≥19px colour cells, no overflow; final capture visually inspected.                                                               |
| Owner functional acceptance                                                                                               | Owner review                                                                      | PENDING, no acceptance inferred.                                                                                                       |

Browser evidence is serial, not a claim of a single uninterrupted 42-case pass:
`browser-final.log` initially passed 40/41; the countdown fixture installed a fake
clock after gameplay began and needed correction. `browser-corrections.log`
passed countdown/pointer checks but exposed colour portrait sizing; subsequent
`browser-colour-final.log` passed clears/wide layouts. Final
`browser-portrait-final.log` passes all seven portrait cases,
`browser-teaching-final.log` passes all ten variant teaching/clear cases, and
`browser-captures-final.log` passes both final colour portraits. The later passing
checks supersede earlier failed cases; failure evidence is retained.

Final vector SHA-256:
`322a369e54a400b0759c069b5e8451c95eae8f2ca0cb86853beb0bc81b1f7e0b`.

**Measurements (diagnostic goal only):** `generation-performance.json` records
100 seeds per preset in workspace Bun 1.4.2, synchronous calls after module load,
first call included; no device/network emulation, app cold-load or physical-phone
measurement. Median 0.20–0.53ms; p95 0.44–7.70ms (colour-2 1.23ms, colour-5 0.62ms,
totals 3.81ms). Maximum workspace outlier 310.55ms. These are workspace diagnostics,
not proof of an 8ms phone budget. Existing Node 24.14.1, TypeScript 6.0.3,
anime.js 4.5.0, Vitest 4.1.12, Playwright 1.64.1 and Wrangler 4.151.3 are unchanged.

**STOP:** baseline + Batch A complete locally. Full `bun run verify`, global lint,
other-family suites, physical-device/production checks, Batch B–J, geometry
baselines, a new daily system, sounds, commit, push, deployment, provisioning and
release steps were not performed. No waiver or functional acceptance is claimed.
Owner responsibility: review/accept the local game; future source handoff or
deployment needs its own instruction. Historical pre-build stops below are preserved.

## v1.4.1 Nonogram rev 2 — resumed; remaining contract-scope stop (2026-11-09)

The owner requested resuming the preserved pre-build stop, completing baseline +
Batch A including §8A, then focused §9 verification and STOP. The accepted rev 2
was present as `docs/briefs/v1.4.1-nonogram-codex.md`; an identical copy now lives
at the requested `docs/briefs/v1.4.1-nonogram-codex-brief.md` (§8's permitted file).
The owner fixture `static/demo/v1.4.1-nonogram.html`, existing documentation and
HEAD `56e6460` were preserved. This is a continuation, not a new implementation
or a reset. Rev 2 resolves the original required-field, research-path, table-name
and portrait-cell decisions, but the remaining source dependencies below still
conflict with its operation limits.

**Required stop:** §8A authorises only its five listed files and operations;
`runs.ts` is limited to stored-variant recovery. §8A says, “If any other consumer
of the field is found, stop and report it — do not widen this carve-out silently.”
§10 also says, “If a requirement conflicts with the code as it is, stop and report.
Do not improvise a workaround that changes the design.” No source relaxation,
partial registration, invented group or timing workaround was made.

### Remaining gaps and exact source evidence

- **Group-less persistence:** `src/lib/server/runs.ts:395` binds `result.group`
  directly into `completed_run.rules_group`, which remains required/non-null in
  `src/lib/server/db/schema.ts:139`. Making `ReplayedResult.group` optional does
  not define the stored value or make this insertion work. §8A's `runs.ts`
  instruction at brief line 120 permits recovery changes, not this persistence
  change. A family/date internal storage value would preserve the daily-board
  design, but requires an explicit storage rule and operation authorisation;
  it was not silently added. No schema/migration edit is proposed or made.
- **Exact timing and downgrade:** §5 requires 2,500 / 10,000 / 22,500 ms active
  floors and below-floor claims saved as unranked. `runs.ts:348` floors active
  duration to seconds, `:356` throws `too_fast`, and `:358–369` abandons the
  claimed session and rethrows. `:403` persists ranked status solely from
  `run.rankedSession`. Fractional `minimumSeconds` cannot restore discarded
  milliseconds: 2.5 / 22.5 would reject valid 2,500–2,999 / 22,500–22,999 ms
  claims, while rounding down admits claims below the locked floors. The timed
  `maxSeconds` branch at `:335–346` also bypasses `minimumSeconds`. No manifest-only
  implementation can provide the required exact downgrade; this needs explicit
  timing/validation/persistence authorisation in `runs.ts`, beyond recovery.
- **Additional group consumers and admin compatibility:**
  `src/lib/server/memory-directory.ts:159` and `:299` read the optionalised field
  with safe defaults; those reads do not independently require type fixes.
  However, `:157–167` supplies a group-expanded `ActivityMappingEntry[]` to the
  shared `queryActivityCounts`, and `:294–301` calls group-based
  `queryScoreHistory`. They are additional consumers covered by §8A's reporting
  rule. Changing `buildActivityMapping` alone leaves `games.ts:86`, `:97` and
  `:109` querying group identity. `games.ts:302/:307` also requires groups for
  per-preset score history, with the `:363–365` empty fallback yielding no
  Nonogram preset history. The shared queries need a stated compatibility rule
  for group-less rows and historical imports without a recorded start; the
  latter currently use internal groups for variant attribution. No Memory
  directory, other-family source, existing test or shared query was changed.

**Feasible parts, not applied:** existing manifests use `satisfies PuzzleManifest`
and retain their concrete group arrays/results when the interface is relaxed.
Registry metadata already strips groups (`scripts/generate-registry.ts:86`),
and catalog/pool generation derives its acceptance from that interface. Daily
recovery already joins pinned puzzle/session identity (`daily.ts:209–215`) and
checks the deterministic family/date run id (`:231`); its group check can be
replaced locally. Stored recovery after session removal must join the original
pinned puzzle and verify its family/date run id, retaining midnight-grace rules
rather than inferring the start date from completion submission time.

### Inventory and verification at this stop

Built production files: **none**. §8A applied: **no**; all five files remain
unchanged. New Nonogram presets: **0** (baseline and Batch A remain unbuilt).
Variant groups added: **0**. New Nonogram daily boards: **0**; the required target
remains one `(nonogram, UTC date)` board per day after a compliant implementation.
Changed in this continuation: this CODEMAP, `morphi-plan-simple.md`, and the exact
rev 2 brief copy at its requested filename. The original brief and fixture remain
unchanged. Existing `.cursor/` and `.vscode/mcp.json` files remain untouched.

| §9 item                                      | Result  | Reason / evidence                                                                    |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| Focused Prettier / ESLint                    | NOT RUN | Required pre-build scope stop; no game/shared source changed.                        |
| Types, 0 errors / 0 warnings                 | NOT RUN | No contract relaxation or typed Nonogram registration exists yet; no pass or waiver. |
| Import boundaries                            | NOT RUN | Implementation stopped before source changes.                                        |
| Build / lazy bundle                          | NOT RUN | No Nonogram View/Game or registry addition to build/check.                           |
| Nonogram + §8A units                         | NOT RUN | Required game and contract cases are not implemented.                                |
| Frozen vectors in six runtimes, `--nonogram` | NOT RUN | No Nonogram vectors/runner or filter implemented.                                    |
| Real-D1 integration                          | NOT RUN | Group-less insertion and timing behavior need the scope resolution above.            |
| One-worker Chromium, three viewports         | NOT RUN | No app-integrated Nonogram to exercise; fixture is reference only.                   |

The parent and required `gpt-6.1-sol/high` scope auditor traced the source read-only.
The requested independent `gpt-6-luna/max` verifier returned **503/unavailable**;
no substitute, parent runtime takeover or independent verification pass is
claimed for this milestone. Read-only audit evidence is not §9 verification.
Full `bun run verify`, untouched-file lint, other-family tests and physical-device
measurements remain unrun. No performance measurements or acceptance is inferred.

**Resume requires:** explicitly specify group-less internal storage and permit
the necessary insertion change; permit exact timing-floor downgrade in `runs.ts`;
resolve additional-consumer/admin-query compatibility while retaining existing
internal historical cohorts. These are decisions needed for the current baseline
and Batch A, not a proposal for a new milestone or broader architecture.
STOP followed: no Batch B–J, geometry baseline, new daily subsystem, sounds,
other-family change, commit, push, deployment, provisioning or release step.

## v1.4.1 Nonogram — pre-build contract-gap stop (2026-11-09)

The owner selected `docs/briefs/v1.4.1-nonogram-codex-brief.md` exactly:
actual baseline first, then Batch A only, focused §9 verification, no commit,
push or deployment. HEAD is `56e6460`. The owner-provided brief and
`static/demo/v1.4.1-nonogram.html` are present and preserved; the fixture was
read as a visual/behaviour reference only. No production puzzle code was copied
or implemented. No baseline or Batch A preset, variant group or daily board
was added. Only this CODEMAP and `morphi-plan-simple.md` were updated.

**Required stop:** §§1/5/8/10 forbid new Nonogram `leaderboardGroups`, prohibit
engine/server edits and require stopping if reality conflicts with the brief.
The current `src/lib/engine/contract.ts` requires `leaderboardGroups` on both
`PuzzleVariant` (line 33) and `PuzzleManifest` (line 105), and requires a replay
`group` (line 22). Registry generation omits groups from client metadata, but
its generated catalog and pool types still require `PuzzleManifest`.
There is no compliant typed registration under the current contract.

This is also a runtime dependency, not just a type mismatch:

- `src/lib/server/daily.ts:234` calls the selected variant's
  `leaderboardGroups.includes(run.rulesGroup)` during daily completion recovery.
- `src/lib/server/runs.ts:198` uses the array to recover a stored ranked variant.
- `src/lib/server/games.ts:68` maps every variant's array for admin activity;
  omitting it would break the generic admin path required by the brief.

Empty arrays or type assertions are not a resolution: they do not remove the
required field or preserve recovery/admin cohort behaviour. No workaround,
contract relaxation or server refactor was made. Resume needs an explicit
resolution of this contract gap and its permitted source scope.

Other brief issues observed before stopping: the two referenced research
files under `workspace/research_notes/` are absent at the stated repository
paths; §9 names `leaderboard_best`, while the v1.4 daily table is `daily_best`;
and a 15-column board at 44px per cell needs at least 660px before clue gutters,
so it cannot fit 390px portrait without a band/layout decision. These were not
resolved by changing the design. `visibilitychange` currently checkpoints the
round and reports ranked departure when hidden; Connect's reference pauses
practice timing and presentation, while ranked timing remains server based.

**§9 verification:** not run after the required pre-build stop: scoped
Prettier/ESLint, type check, boundaries, lazy bundle, Nonogram units, six-runtime
vectors, real-D1 integration and one-worker Chromium/three-viewport checks.
The contract trace is read-only evidence, not a test pass. Full-repo verification,
other-family tests and physical-device checks were not run. The requested
`gpt-6-luna/max` independent contract verifier returned 503/unavailable; no
substitute agent or independent verification pass is claimed. No Batch B–J,
geometry baseline, new sound, other-family change, commit, push, deployment or
release work followed. Existing editor/MCP files remain untouched.

## v1.4 rev 6 — built locally; full targeted §9 passed; stopped (2026-11-09)

Resumed the preserved implementation through §§8A–8E without resetting or
restarting completed files. The initial CODEMAP/diff inspection preserved HEAD
`9e10b73`; it remains unchanged. **253 player variant board groups → 0; boards =
families × UTC days.** Internal immutable replay/scoring cohorts remain.
The owner has not functionally accepted v1.4. No commit, push, deployment,
provisioning, release or next milestone was performed.

Preserved: daily migration/storage, server issuance and replay validation,
anonymous engine rules, daily start/recovery, family/date board UI and history,
TimeStrata rule controls, archive retention/CLI wiring, separate Cron Worker,
generated metadata removal, and the template/decision updates.

Finished in this run: §8E teaching derivation (step → note → scoring-row value),
all required units and runtime checks, authoritative legacy ranked start
compatibility inside §8D's start-validation allowance, and final-freeze rejection
for uncommitted daily claims. Omitted-baseline canonical hashes remain compatible.
Browser verification found and corrected the named-action JSON transport in the
already-authorised PlaySession/leaderboard files: a bounded single-payload form
now enters SvelteKit, then the existing JSON/auth/session/origin/owner guards.
The new teaching line uses the existing header gap and compact full text, retaining
original game-frame space. Result teaching spacing was fitted in portrait.
Tests were reconciled with anonymous rules and the removed public variant query;
no assertions were skipped or game outcomes changed. The network recorder now
reads finished responses, retaining every outgoing request, so reload-interrupted
keepalive bodies cannot hang verification.

§8E's manifest fallback was **not needed**. No manifest was edited. Both required
Connect sentences pass exactly: “This board is 8 × 8 with 8 pairs.” and “Connect
all pairs before the 60-second clock runs out.” Every non-baseline round has a
nonempty anonymous teaching line. All 86 non-baseline copies fit at the three
required sizes: **258 layout checks**, minimum measured clearance **2.609375px**,
with full text preserved and no HUD overlap.

Required `gpt-6.1-sol/high` agents performed scoped coding. The required
`gpt-6-luna/max` verifier returned 503; the parent performed verification under
the previously recorded explicit owner takeover instruction. No substitute-model
evidence is claimed. Source was stable during checks; shared setup/builds and
browser execution were serial, with Playwright **workers: 1** retained.

### Every §9 verification result

Evidence is local under `build/v1.4/`; this directory is ignored.

- Registry generation: **PASS**, `registry-rev6.log`. Only the regenerated client
  metadata projection changes; no per-variant board data is emitted.
- Binding generation: **PASS**, `types-rev6.log`; D1/KV/R2 and local secret types.
  Generated `worker-configuration.d.ts` is ignored, never hand-edited.
- Scoped Prettier + ESLint: **PASS** on all v1.4 files supported by these tools;
  final log `lint-v14-complete.log`. The SQL migration has no installed Prettier
  parser and is validated by real D1. Untouched formatting drift is listed below.
- Types: **PASS**, **0 errors / 0 warnings**, `check-v14-complete.log`.
  No suppression or waiver of the earlier 44 errors.
- Build: **PASS**, `build-v14-complete.log`.
- Import boundaries: **PASS**, `boundaries.log`.
- Lazy bundle: **PASS**, `lazy-bundle-v14-complete.log`; shell isolation and three
  independently imported Game views remain.
- Focused units: **145/145 across 13 complete files**, `unit-rev6.log`, including
  the original 118-case scope, every existing Block/Memory/Connect variant file,
  teaching priority/exact Connect sentences, daily derivation/weighted enabled
  pick, ties/ranks/percentiles, streak transitions, freeze stub and cache rules.
  Daily recheck: **14/14**, `daily-unit-final.log`.
- Shared catalogue/server validation: **8/8**, `slice3-validation.log` (isolated
  real D1). Synthetic validation is test-only; no new family was implemented.
- Real-D1 integration: **68 unique cases pass** across accounts, runs, Block,
  Memory and daily boards. `integration-final.log` had 66/68 with one stale rules
  assertion causing a downstream active-session failure. After that correction,
  the entire Memory file passes **18/18**, `memory-integration-final.log`; the
  other four complete files already passed. Daily start/save/best/snapshot/read,
  replay tampering, spent/second attempts, start validation, start-day credit,
  final freeze/interrupted claims, history and retention are covered.
- Frozen vectors: **PASS in all six runtimes** — Node, Bun, Chromium, Firefox,
  WebKit and workerd. `vectors-global.log` retains fingerprint `a8be9d5f…`
  (nine game vectors plus six theme vectors); `vectors-memory.log` covers all
  **72 Memory vectors** (38 frozen + 4 Time Strata + 30 Batch H);
  `vectors-block.log` covers all **12 Block vectors**. Outcomes unchanged.
- Chromium browser/admin: final whole run **123/123**, **one worker**, **25.0m**,
  `browser-v14-complete.log`: Connect 9, daily boards 8, admin 4, Time Strata
  baseline 11 and Batch H 91. Earlier failures were corrected and superseded
  by this full run. Required 390×844 / 844×390 / 1280×800 board views, zero
  horizontal overflow, 44px targets, family-only selectors/results/profile/Home,
  anonymous issuance/network/DOM/resume, no-preview and clock teaching,
  admin variant inspection and zero-write test play all pass. Time Strata includes
  every mode/size/viewport, utility recovery, bounds, keyboard and motion failure.
- Source/refactor audits: **PASS**, `source-audit.log`: no gameplay
  `round.variant`/literal variant comparison, TimeStrata identity reads/attribute,
  `rules_group` filter in activity, `BOARD_GROUPS` or window-ranked run query.
  Admin statistics keep their server-manifest cohort breakdown; directory board
  references use family/date. Public availability rejects `?variant=` (400),
  returns no variant list; old group board URLs return 404. Admin test play uses
  its operator/manifest path, independently of public variant availability.
- Local Cron: **PASS**, `cron-invocations.json` and `cron-proof.log`. Actual
  scheduled invocations at midnight, month start and 02:00 returned 200/ok;
  tomorrow's three family puzzles, six current/previous snapshots and yesterday's
  final freeze were verified. Shape: **separate scheduled-only `workers/cron.ts`
  via Wrangler's `env.cron`**, because the SvelteKit app Worker exports fetch only.
  The app fetch handler was untouched. All configured bindings remain shared.
- Actual authenticated interactive CLI prune/R2: **PASS**, `cli-prune.log`
  (TOTP redacted) and `cli-r2-proof.log`. A >90-day run's exact move log was archived
  to local `RUN_ARCHIVE` by run ID, then deleted from D1. It did not silently skip.
  The isolated fixture was removed after proof; original credentials stayed local.
- Light local load: **PASS**, `integration/daily-load.json`. With 10,000 entries,
  indexed Top25 reads **25 rows**; total COUNT reads **10001**, outside-top own-rank
  COUNT **10000**. Query plan uses covering `daily_best_board`; cold board has
  **6 round trips**, without a window scan. True HEAD/current comparison in
  `save-before-after.log`: legacy `saveRun` **7 → 7**, daily **8** calls, including
  Drizzle `raw()`. This is a local query measurement, not production throughput;
  no speculative DO/Queue was introduced.

### Untouched formatting drift — pre-existing, not fixed

The earlier global lint failure was limited to these ten files, unchanged from
HEAD. §8E narrows lint to v1.4 files; this is not a global lint pass.

- `docs/briefs/v1.3.4-mahjong-codex-brief.md.md`
- `docs/briefs/v1.3.5.10-batch-c-brief.md`
- `docs/briefs/v1.3.5.13-batch-f-brief.md`
- `docs/briefs/v1.3.5.6-tier1-policy-brief.md`
- `docs/briefs/v1.3.5.7-tier2-directory-brief.md`
- `docs/evidence/v1.3.4/research/review.json`
- `docs/evidence/v1.3.5/v1.3.5.1-verification.json`
- `docs/work/V1.3.5.1_WORK.md`
- `docs/work/V1.3.5.6_WORK.md`
- `docs/work/V1.3.5.7_WORK.md`

### Zero-edit scope limits, preserved and reported

- `recordRoundPlay`/`recordRoundAbandon` remain outside §8D's start-validation
  allowance. Non-baseline anonymous daily telemetry does not update first-move/
  departure timestamps. Exact-session abandonment spends the attempt; authoritative
  daily replay/save/board/streak functionality passes.
- Historical non-daily/non-baseline ranked UI recovery may lose identity. New
  anonymous daily recovery and current practice TimeStrata checkpoints pass;
  no out-of-scope legacy recovery patch or owner waiver is claimed.
- Excluded `MemoryDirectory.svelte` still uses its board-reference value as a
  scoring-editor fragment and retains an old rules-group heading. The authorised
  server directory reference is family/date; admin tests pass. Its wording/anchor
  was not patched outside this brief.

Premium streak freeze remains the specified **ineligible stub**, not live.
Full `bun run verify`, global lint repair, production load/device measurements,
physical-device review and provisioning/deployment remain unrun/deferred.
No v1.4.1, new family/variant, friends boards, leagues, DO/Queue/sharding, payments,
new sounds or release work followed. **STOP at local v1.4; owner review next.**

### Final authored/preserved/regenerated inventory — 53 files

The owner-provided brief is included. `.cursor/` and `.vscode/mcp.json` remain
excluded. Ignored build evidence and generated Worker types are not source files.

- `docs/CODEMAP.md`
- `docs/DECISIONS.md`
- `docs/briefs/v1.4-leaderboard-codex-brief.md`
- `docs/puzzles/_TEMPLATE.md`
- `migrations/0015_daily_boards.sql`
- `morphi-plan-simple.md`
- `scripts/admin-local.ts`
- `scripts/generate-registry.ts`
- `src/lib/block-variants.test.ts`
- `src/lib/components/PuzzleHelp.svelte`
- `src/lib/components/account/ProfileContent.svelte`
- `src/lib/engine/contract.ts`
- `src/lib/i18n/messages.ts`
- `src/lib/puzzle-metadata.ts`
- `src/lib/puzzles/block-placement/Game.svelte`
- `src/lib/puzzles/block-placement/View.svelte`
- `src/lib/puzzles/block-placement/logic.ts`
- `src/lib/puzzles/connect/Game.svelte`
- `src/lib/puzzles/connect/View.svelte`
- `src/lib/puzzles/connect/logic.ts`
- `src/lib/puzzles/memory/Game.svelte`
- `src/lib/puzzles/memory/TimeStrata.svelte`
- `src/lib/puzzles/memory/View.svelte`
- `src/lib/puzzles/memory/logic.ts`
- `src/lib/screens/PlaySession.svelte`
- `src/lib/screens/ResultScreen.svelte`
- `src/lib/selector.ts`
- `src/lib/server/activity.ts`
- `src/lib/server/config-cache.ts`
- `src/lib/server/daily.test.ts`
- `src/lib/server/daily.ts`
- `src/lib/server/games.ts`
- `src/lib/server/memory-directory.ts`
- `src/lib/server/ranked-session.ts`
- `src/lib/server/retention.ts`
- `src/lib/server/runs.ts`
- `src/lib/ui/puzzle-presentation.test.ts`
- `src/lib/ui/puzzle-presentation.ts`
- `src/routes/api/play/availability/+server.ts`
- `src/routes/leaderboard/+page.server.ts`
- `src/routes/leaderboard/+page.svelte`
- `tests/e2e/daily-boards.spec.ts`
- `tests/e2e/memory-variants-admin.spec.ts`
- `tests/e2e/time-strata-batch-h.spec.ts`
- `tests/e2e/time-strata.spec.ts`
- `tests/integration/accounts.test.ts`
- `tests/integration/block-variants.test.ts`
- `tests/integration/daily-boards.test.ts`
- `tests/integration/memory-variants.test.ts`
- `tests/integration/runs.test.ts`
- `tests/slices/slice3-catalog-server-validation.test.ts`
- `workers/cron.ts`
- `wrangler.jsonc`

The earlier records below are preserved history, superseded by this closeout.

## v1.4 rev 5 — resumed; types green; stopped at required teaching-data gap (2026-11-09)

The owner requested resuming the preserved partial implementation exactly through
§§8A–8D and §9, with no commit, push or deployment. The run first read this
CODEMAP's preserved rev 4 handoff and `git diff --stat`; HEAD remains `9e10b73`.
No completed source file was reset or restarted. Ponytail was applied. Required
`gpt-6.1-sol/high` coding agents completed scoped tasks; the required
`gpt-6-luna/max` verifier returned 503, and the parent performed checks under the
owner's explicit takeover instruction. **v1.4 remains incomplete and unbuilt.**

Preserved from earlier runs: migration and daily storage/issuance/replay, anonymous
engine rules and teaching envelopes, family/date board UI, profile history,
TimeStrata anonymous controls, R2 retention and CLI pass-through, separate Cron
entrypoint, generated client metadata removal and template/documentation changes.
This run authored §8D start validation against authoritative daily family/date
identity and `daily_best` recovery, plus the admin Memory directory's family/date
board reference. Internal activity variant and admin replay/scoring cohorts remain
server-side. It fixed the selector's needless board-group type requirement,
Memory rules structural compatibility, the Cron/app auth-URL environment type,
unknown-JSON action narrowing, and stale tests of deliberately removed public
board/history/identity contracts. A final server-manifest annotation corrected
one new directory type diagnostic; no type error was waived or suppressed.
The two required daily integration/browser files are authored and formatted.

### Verification results

- `bun run registry:generate`: PASS (`build/v1.4/registry-rev5.log`). Manifests
  unchanged; only `puzzle-metadata.ts` differs among generated registry files.
- `bun run cf:types`: PASS (`build/v1.4/types-rev5.log`). D1/KV/R2 and secret types
  generated. Cron explicitly carries the same non-secret auth URL so app types
  retain their required string; no secret was printed or committed.
- `bun run check`: final PASS, **0 errors / 0 warnings**
  (`build/v1.4/check-final.log`). The preserved 44 errors are fixed.
- Focused units: 10 complete files / 118 cases; first run 116 passed, one failed
  required teaching test, and one Connect 1,200-seed test timed out at the default
  five seconds (`build/v1.4/unit-rev5.log`). The entire Connect file passed 7/7 in
  a serial rerun with a 15-second timeout, taking 2.42 seconds
  (`build/v1.4/connect-unit-recheck.log`). Unique final result: **117/118 pass**;
  the required daily teaching test remains failing and is not relaxed.
- `bun run lint`: FAIL at Prettier in 10 untouched historical files
  (`build/v1.4/lint-rev5.log`); ESLint was not reached. `git diff --quiet` confirms
  these files are unchanged from HEAD: the .4 Mahjong, .5.10, .5.13, .5.6 and .5.7
  briefs, the .4 research and .5.1 verification JSON evidence, and .5.1/.5.6/.5.7
  work logs. Formatting those files is outside this brief's edit list.
- Read-only source audits: no `round.variant` or literal variant-ID comparison
  in Game/logic gameplay branches; no `memoryVariant(`, `variant ===` or
  `data-strata-rule={variant}` in TimeStrata; no `rules_group` in activity.ts;
  no old window-ranking query or `BOARD_GROUPS` in runs.ts. Client metadata has
  no board data; its `Omit<..., 'leaderboardGroups'>` type explicitly removes that
  property. These inspections are not browser/runtime acceptance.
- **Not run after the refactor-gap stop:** build, boundaries, lazy-bundle,
  six-runtime vectors, real-D1 daily/legacy integration, browser/admin tests,
  local scheduled runtime, interactive prune-expired CLI/R2 end-to-end, or the
  10,000-row/round-trip measurements. Authored tests and load instrumentation
  are unverified. Full `bun run verify` remains deferred.

### Exact stopping point and remaining scope conflicts

§5A requires every non-baseline variant's round-rule line to come from its first
help step absent from baseline; §9 requires none of these lines to be empty.
The brief asserts all current variants already have that step. The actual
`src/lib/puzzles/connect/manifest.ts:81` (`connect:board-8`) and `:92`
(`connect:rush-60`) both spread baseline help without overriding `steps`.
Only scoring rows/note/tips differ. Therefore both required rule lines are empty.
The new required daily unit case detects this. Correcting the missing teaching
steps needs an explicit narrow manifest allowance (and a Connect message-copy
allowance if new sentences are supplied); manifests are explicitly forbidden.
No invented fallback, manifest edit, skipped assertion or changed gameplay was
used to hide this conflict. The brief's refactor-gap rule requires stopping here.

Further traced consumers, preserved without out-of-scope changes:

- `parseRoundActivity` normalizes omitted variant and an explicit baseline to the
  same value. `recordRoundStart` resolves anonymous daily identity server-side;
  it can reject mismatched non-baseline identity/family/owner/session, but cannot
  distinguish that parser-normalized explicit baseline from omission.
- Existing `recordRoundPlay`/`recordRoundAbandon` compare the request's normalized
  baseline identity. Non-baseline anonymous daily telemetry will not update its
  first-move/departure timestamps without a shared server-identity resolution
  allowance. Exact-session `abandonSession` still spends the daily attempt;
  completion and board eligibility use authoritative issuance.
- Legacy ranked activity assertions were retained in existing integration tests.
  §8D start validation currently requires daily identity for ranked starts; the
  untouched legacy issuance path still exists. This compatibility conflict needs
  review inside the start-validation allowance; its tests have not run.
- `MemoryDirectory.svelte:488` uses the board-reference field as a scoring-editor
  fragment. Its new family/date value is not a scoring cohort anchor, and the
  drawer's old heading still says leaderboard rules group. This component is
  explicitly excluded; the directory data change is authored, not browser-verified.

The board transition is authored: **253 variant groups → 0 player variant boards;
boards = families × UTC days**. Internal manifest/replay groups are unchanged.
No successful v1.4 build, full §9 pass, functional acceptance, commit, push,
deployment, release, v1.4.1, new family, friends/leagues, DO/Queue/sharding or
physical-device evidence is claimed. Resume this working tree after resolving
these specific allowances; do not restart.

### Preserved authored/regenerated inventory

The owner's in-repo brief is also present. Generated `worker-configuration.d.ts`
is ignored and regenerated, not hand-edited. Existing `.cursor/` and
`.vscode/mcp.json` remain excluded and unchanged by this run.

- `docs/CODEMAP.md`
- `docs/DECISIONS.md`
- `docs/puzzles/_TEMPLATE.md`
- `migrations/0015_daily_boards.sql`
- `morphi-plan-simple.md`
- `scripts/admin-local.ts`
- `scripts/generate-registry.ts`
- `src/lib/block-variants.test.ts`
- `src/lib/components/PuzzleHelp.svelte`
- `src/lib/components/account/ProfileContent.svelte`
- `src/lib/engine/contract.ts`
- `src/lib/i18n/messages.ts`
- `src/lib/puzzle-metadata.ts`
- `src/lib/puzzles/block-placement/Game.svelte`
- `src/lib/puzzles/block-placement/View.svelte`
- `src/lib/puzzles/block-placement/logic.ts`
- `src/lib/puzzles/connect/Game.svelte`
- `src/lib/puzzles/connect/View.svelte`
- `src/lib/puzzles/connect/logic.ts`
- `src/lib/puzzles/memory/Game.svelte`
- `src/lib/puzzles/memory/TimeStrata.svelte`
- `src/lib/puzzles/memory/View.svelte`
- `src/lib/puzzles/memory/logic.ts`
- `src/lib/screens/PlaySession.svelte`
- `src/lib/screens/ResultScreen.svelte`
- `src/lib/selector.ts`
- `src/lib/server/activity.ts`
- `src/lib/server/config-cache.ts`
- `src/lib/server/daily.test.ts`
- `src/lib/server/daily.ts`
- `src/lib/server/games.ts`
- `src/lib/server/memory-directory.ts`
- `src/lib/server/ranked-session.ts`
- `src/lib/server/retention.ts`
- `src/lib/server/runs.ts`
- `src/lib/ui/puzzle-presentation.test.ts`
- `src/lib/ui/puzzle-presentation.ts`
- `src/routes/api/play/availability/+server.ts`
- `src/routes/leaderboard/+page.server.ts`
- `src/routes/leaderboard/+page.svelte`
- `tests/e2e/daily-boards.spec.ts`
- `tests/e2e/memory-variants-admin.spec.ts`
- `tests/e2e/time-strata-batch-h.spec.ts`
- `tests/e2e/time-strata.spec.ts`
- `tests/integration/accounts.test.ts`
- `tests/integration/block-variants.test.ts`
- `tests/integration/daily-boards.test.ts`
- `tests/integration/memory-variants.test.ts`
- `tests/integration/runs.test.ts`
- `tests/slices/slice3-catalog-server-validation.test.ts`
- `workers/cron.ts`
- `wrangler.jsonc`

## v1.4 rev 4 — resumed partial work; verification found further scope gaps (2026-11-09)

The run first read the preserved rev 3 handoff below and `git diff --stat`, then
continued those changes without resetting or rewriting completed files from HEAD.
HEAD remains `9e10b73`. The owner selected §§8A–8C and all of §9, with Ponytail,
no commit, push, deployment, release or later milestone. **v1.4 is incomplete.**

Already preserved: migration/daily storage, server issuance and replay checks,
anonymous engine rules, metadata generator changes, presentation helpers,
retention and the separate Cron entrypoint. This run completed client daily
start/live recovery, anonymous ending/help/rules, streak display, the family/date
board UI and public availability removal. §8C TimeStrata now reads anonymous
rules without an identity attribute; `admin-local.ts` passes `RUN_ARCHIVE`.
Daily completion/best/snapshot invalidation/streak now commit atomically.
Start-day board credit remains open through 02:00 UTC; frozen retries cannot
rewrite ranks. Accepted entries retain positions when a player is deleted/banned;
live name resolution anonymizes them. Existing puzzles survive secret rotation;
future puzzles use the new key. Only midnight pre-generates tomorrow.

The template records `(family, UTC date)`, variant boards: none, per-round teaching
and the admin test-play exception. The old board query is removed; regenerated
client metadata contains no board-group data. **253 variant groups → 0 player
variant boards is authored, not built or verified; boards = families × days.**

Verification performed:

- `bun run registry:generate`: PASS. Only `puzzle-metadata.ts` changed among
  generated registry files; no manifest was edited.
- `bun run cf:types`: PASS. Local D1/KV/R2 and auth/daily secret types generated;
  the secret value remains only in ignored `.dev.vars`. Required-secret declarations
  were removed to preserve existing dev credential inference. Named Cron env
  currently makes `BETTER_AUTH_URL` optional in the generated common interface;
  config/type reconciliation remains unfinished.
- `bun run check`: FAIL — **44 errors, 0 warnings, 15 files**. Log:
  `build/v1.4/check.log`; generation logs are beside it.
- Read-only source audit: no `round.variant` or literal variant equality remains
  in Game/logic gameplay; no `memoryVariant(`, `variant ===` or identity attribute
  remains in TimeStrata; no old window ranking or BOARD_GROUPS remains in runs.ts.
  These inspections are not gameplay or browser passes.
- Not run: build, lint, boundaries, lazy-bundle, daily/variant units, six-runtime
  vectors, real-D1 integration, browser/admin checks, local Cron, CLI/R2 retention
  or 10,000-row load/round-trip measurements. Full `bun run verify` stays deferred.
  Thirteen daily unit cases are authored but unrun. New daily integration/E2E files
  have not been authored. The required `gpt-6-luna/max` verifier returned 503;
  the parent took over under the owner's explicit instruction.

The brief's refactor-gap stop rule was triggered by two unlisted source consumers:

1. `server/activity.ts:72` still reads `puzzleVariant(...).leaderboardGroups` from
   client metadata for activity recovery/cohort binding. It needs a server-manifest
   lookup that preserves variant scoping; restoring client board groups would
   violate v1.4. This file is outside §§8–8C.
2. `server/memory-directory.ts:213` also reads that removed property for admin
   inspection. Its server-only manifest lookup is outside §§8–8C; the allowance
   for `server/games.ts` does not cover this consumer.

Additional type failures needing explicit reconciliation: selector `peekVariant`
still requires full PuzzleVariant including leaderboardGroups (the failing caller
is practice, beyond the daily-only selector allowance); presentation/Block
projection tests require deleted metadata; old account/run/Memory/Slice3 tests
call the deleted group/offset board contract or inspect removed history fields.
Existing TimeStrata browser tests likewise require removed identity attributes.
Narrowly updating those tests has not been authorized by the edit list. Within
the allowed files, MemoryRules lacks the Record index signature required by the
new createRound contract, and the practice scoring action needs unknown-JSON
object narrowing. No implementation fixes followed detection of the scope gaps.

Authored/regenerated inventory (38 files, including reporting/template; plus the
owner's brief; existing editor/MCP files preserved):

- `docs/CODEMAP.md`, `docs/DECISIONS.md`, `docs/puzzles/_TEMPLATE.md`, `morphi-plan-simple.md`
- `migrations/0015_daily_boards.sql`, `workers/cron.ts`, `wrangler.jsonc`
- `scripts/admin-local.ts`, `scripts/generate-registry.ts`
- `src/lib/engine/contract.ts`, `src/lib/i18n/messages.ts`, `src/lib/puzzle-metadata.ts`
- `src/lib/components/PuzzleHelp.svelte`, `src/lib/components/account/ProfileContent.svelte`
- `src/lib/puzzles/block-placement/{logic.ts,Game.svelte,View.svelte}`
- `src/lib/puzzles/connect/{logic.ts,Game.svelte,View.svelte}`
- `src/lib/puzzles/memory/{logic.ts,Game.svelte,View.svelte,TimeStrata.svelte}`
- `src/lib/screens/{PlaySession,ResultScreen}.svelte`, `src/lib/ui/puzzle-presentation.ts`
- `src/lib/server/{daily.ts,daily.test.ts,config-cache.ts,games.ts,ranked-session.ts,retention.ts,runs.ts}`
- `src/routes/api/play/availability/+server.ts`, `src/routes/leaderboard/+page.server.ts`, `src/routes/leaderboard/+page.svelte`
- `tests/e2e/memory-variants-admin.spec.ts` (only the removed nested Game identity
  expectation was changed to family plus absent data-variant; not executed)

No successful build, functional acceptance, full §9 pass, commit, push, deployment,
v1.4.1, friends/leagues, DO/Queues/sharding, new family or release work is claimed.
Resume from this tree only after the remaining edit-list gaps are resolved.

## v1.4 rev 3 — partial local implementation; stopped on scope gaps (2026-11-09)

The owner selected exact implementation of the daily-family leaderboard brief, including
§8A and §8B, under Ponytail, with no commit, push, deployment or later milestone.
Source changes are **partial and unverified**. No build, registry generation, generated
binding types, lint/type/boundary/lazy-bundle checks, integration, browser or load checks
were run. Nine daily unit cases were authored but not executed. The completed v1.3.5.17
baseline remains `9e10b73`; the working tree contains the partial v1.4 changes below.
The 253-to-zero board transition is not complete or verified.

The brief's stop rule was triggered by `src/lib/puzzles/memory/TimeStrata.svelte`,
which still derives variant IDs for utility controls and exposes `data-strata-rule`.
The required anonymous-rule and display conversion is outside the explicit
`logic.ts` / `Game.svelte` / stated View allowances in §8B. A second integration
scope gap is `scripts/admin-local.ts:125`: the existing maintenance command does
not pass the new `RUN_ARCHIVE` binding, so its invocation safely skips completed-run
pruning. Activating archive-before-delete through that command requires its caller
to pass the bucket; this caller is outside the brief's edit list.

The owner answered the midnight edge case during implementation: **credit the UTC
start day and freeze after the two-hour grace period**. This answer is recorded,
but the source still needs the final 02:00 UTC freeze adjustment. Other unfinished
integration includes consistent live/frozen ban/deletion membership, restricting
tomorrow generation to the required schedule, wiring PlaySession and the board UI,
registry/type generation, all verification and the final visibility/template closeout.

Implementation choices already authored: daily start/resume actions in the permitted
leaderboard server route preserve the existing ranked start API; anonymous gameplay
parameters in the three families; a separate scheduled-only Cron environment; one
local `RUN_ARCHIVE` binding. These are not acceptance or test-pass claims.

Authored source inventory (26 files; none constitutes a successfully built v1.4):

- `migrations/0015_daily_boards.sql`
- `scripts/generate-registry.ts`
- `src/lib/components/PuzzleHelp.svelte`
- `src/lib/components/account/ProfileContent.svelte`
- `src/lib/engine/contract.ts`
- `src/lib/puzzles/block-placement/Game.svelte`
- `src/lib/puzzles/block-placement/View.svelte`
- `src/lib/puzzles/block-placement/logic.ts`
- `src/lib/puzzles/connect/Game.svelte`
- `src/lib/puzzles/connect/View.svelte`
- `src/lib/puzzles/connect/logic.ts`
- `src/lib/puzzles/memory/Game.svelte`
- `src/lib/puzzles/memory/View.svelte`
- `src/lib/puzzles/memory/logic.ts`
- `src/lib/screens/ResultScreen.svelte`
- `src/lib/server/config-cache.ts`
- `src/lib/server/daily.test.ts`
- `src/lib/server/daily.ts`
- `src/lib/server/games.ts`
- `src/lib/server/ranked-session.ts`
- `src/lib/server/retention.ts`
- `src/lib/server/runs.ts`
- `src/lib/ui/puzzle-presentation.ts`
- `src/routes/leaderboard/+page.server.ts`
- `workers/cron.ts`
- `wrangler.jsonc`

The owner-provided brief and unrelated `.cursor/` / `.vscode/mcp.json` files are
preserved. This report, `docs/DECISIONS.md` and `morphi-plan-simple.md` are the only
additional reporting edits. Resume only within a revised authorized scope; no
v1.4.1, release, commit, push, deployment or new-family work follows this stop.

- **v1.3.5.17 locally verified; ready for owner closeout review (2026-11-08):** .16 omitted;
  81 accepted/implemented presets and 243 groups at pushed `9372b99`.
  `server/games.ts` owns bounded score-cohort queries; `games-admin.ts` selects
  variant pages before loading their history; `memory-directory.ts` shares the
  history query after filtering/paging. `components/MemoryDirectory.svelte`
  reuses the Games drawer truncation notice. Regression scope:
  `tests/integration/memory-variants.test.ts` and
  `tests/e2e/memory-variants-admin.spec.ts`.
  [Selected brief](briefs/v1.3.5.17-memory-closeout-brief.md),
  [work/evidence](work/V1.3.5.17_WORK.md). Focused checks pass: 81 units, 18 D1, 72 vectors/six runtimes, 15 Chromium
  cases across serial runs and lint/types (0/0). Six new Directory captures in
  `build/v1.3.5.17/browser/`; query/payload measurements in `integration/`.
  Owner .17 acceptance pending; full verify deferred; no auto-commit/push/deploy.

- **v1.3.5.15 Batch H accepted and pushed at `9372b99` (2026-11-08):** Ten Time Strata rules
  in `memory/logic.ts`, identities/replay/help/groups in `manifest.ts`, shared
  stack/shelf/clue/order UI in `Game.svelte` / `TimeStrata.svelte`, help and labels
  in `messages.ts`. `dimensions.ts`, global policy labels and `server/config.ts`
  support the six finite policy dimensions and explicitly compatible historical
  snapshots. Generated `puzzle-metadata.ts` / `puzzle-messages.ts` expose 81
  accepted and implemented presets / 243 groups. Focused sources:
  `memory/time-strata.test.ts`, `variants.test.ts`, `dimensions.test.ts`,
  `tests/vectors/memory-batch-h.json` / `memory-runner.ts`,
  `tests/integration/memory-variants.test.ts`,
  `tests/e2e/time-strata-batch-h.spec.ts` / `memory-variants-admin.spec.ts`.
  Format/lint/types, 65 units/checkpoints, four D1 cases and 72 vectors across six
  runtimes pass. Serial one-worker Chromium runs cover 105 unique passing cases
  (91 H, 11 baseline, three admin), after scoped Glimpse/Order landscape fixes.
  Retained evidence includes 181 bounds snapshots and 271 gameplay captures.
  App evidence: `build/v1.3.5.15/app/`; earlier preview evidence remains in
  `build/v1.3.5.15/preview/`. Owner acceptance is recorded in the latest .15 work entry; full verify deferred.
  Source is pushed; deployment remains separate. [Brief](briefs/v1.3.5.15-batch-h-brief.md),
  [work](work/V1.3.5.15_WORK.md).

- **v1.3.5.14 Time Strata accepted locally (2026-11-08):** The owner's
  “mark that accepted” closes app functional review; 71 presets / 213 groups are
  now accepted. No new check/device evidence, commit or push is inferred.
  `memory/logic.ts`
  owns balanced stacks, top-only moves and numeric cancel/Continue; `Game.svelte` plus
  `TimeStrata.svelte` render the approved layered board and preserve pending outcomes
  on reload. `manifest.ts` owns its identity, replay, timing and three groups;
  `dimensions.ts` records both no-preview and top-only policy changes. Existing
  `server/{config,memory-policy,memory-directory}` and `components/MemoryPolicy.svelte`
  preserve earlier policy snapshots and show/enforce both changes. Tests: Memory
  `time-strata.test.ts`, `dimensions.test.ts`, `variants.test.ts`,
  `tests/vectors/memory-time-strata.json` and `memory-runner.ts`,
  `tests/integration/memory-variants.test.ts`, `tests/e2e/time-strata.spec.ts`.
  Catalogue-name search in `memory-directory.ts` includes the new baseline’s displayed name.
  Checks pass: 56 units/checkpoints, 3 D1, 6 runtimes, 25 Chromium cases, format/lint/types.
  App captures in `build/v1.3.5.14/app/`; [work/evidence](work/V1.3.5.14_WORK.md).

- **v1.3.5.14 Memory Batch G new-baseline preview (2026-11-08):**
  [Time Strata fixture](../static/demo/v1.3.5.14-batch-g.html) implements one
  four-stack, top-only-access design with solvable 6/8/10-pair deals. No app rules,
  manifest, dimensions or registry changes; accepted Batch F remains 70 variants /
  210 groups at `7eadc3b`. [Focused runner](../scripts/check-batch-g-baseline.ts)
  checks real gameplay, cancellation/reset/completion, solvability, guide, keyboard,
  reduced/missing motion and three viewports in one serial Chromium browser.
  [Brief](briefs/v1.3.5.14-batch-g-brief.md),
  [work/evidence](work/V1.3.5.14_WORK.md); captures and JSON in
  `build/v1.3.5.14/new-baseline/`. Checks pass; owner visual approval pending.

- **v1.3.5.12 Memory Batch E accepted and pushed (2026-11-08):**
  10 genuine Memory botanical & nature rulesets implemented end-to-end under ponytail
  principles and Constraint C2 (Split Dual-Garden Baseline `memory:cross-pollination`, `memory:mycelium-network`,
  `memory:photosynthesis`, `memory:seed-dispersal`, `memory:seasonal-bloom`, `memory:bee-waggle`,
  `memory:carnivorous-briar`, `memory:chlorophyll-meter`, `memory:bioluminescent`, and `memory:botanical-graft`)
  in `src/lib/puzzles/memory/logic.ts`, dimensions in `dimensions.ts`, manifest entries with 30 new
  immutable leaderboard groups in `manifest.ts`, localization in `messages.ts`/`i18n`, and regenerated
  projections. Total catalog Memory variants are now 60 (180 leaderboard groups). Multi-runtime vectors (6/6
  runtimes, standard fingerprint `a8be9d5f...`, memory fingerprint `e11e8733...`), workspace types (0 errors/0 warnings),
  unit tests (46/46), real-D1 integration suite (15/15), and Playwright Chromium admin suite (3/3 at one worker) pass.
  [Brief](briefs/v1.3.5.12-batch-e-brief.md), [work/evidence](work/V1.3.5.12_WORK.md), [fixture](../static/demo/v1.3.5.12-batch-e.html).

- **v1.3.5.11 Memory Batch D accepted and pushed (2026-11-07):**
  10 genuine Memory distributed cloud and edge architecture rulesets implemented end-to-end under ponytail
  principles in `src/lib/puzzles/memory/logic.ts`, dimensions in `dimensions.ts`, manifest entries with 30 new
  immutable leaderboard groups in `manifest.ts`, localization in `messages.ts`/`i18n`, and regenerated
  projections. Total catalog Memory variants are now 50 (150 leaderboard groups). Multi-runtime vectors (6/6
  runtimes, fingerprint `a8be9d5f...`), workspace types (0 errors/0 warnings), unit tests (45/45), real-D1
  integration suite (15/15), and Playwright Chromium admin suite (3/3 at one worker) pass.
  [Brief](briefs/v1.3.5.11-batch-d-brief.md), [work/evidence](work/V1.3.5.11_WORK.md), [fixture](../static/demo/v1.3.5.11-batch-d.html).

- **v1.3.5.7 Tier 2 Memory directory locally implemented (2026-11-07):**
  `server/memory-directory.ts` provides dual-source curated/observed union, keyset cursor
  pagination (`encodeCursor`/`decodeCursor`), dimension breakdown evaluation, and multi-filter
  resolution; `components/MemoryDirectory.svelte` renders the dedicated Directory tab, responsive
  multi-filter toolbar, keyset pagination bar, and accessible inspection drawer modal with dimension
  breakdown, telemetry stats, and scoring links; `routes/admin/[view]/+page.server.ts` and
  `components/GamesAdmin.svelte` integrate the tab. Scoped Prettier/ESLint/types (0 errors/warnings),
  real-D1 `tests/integration/memory-variants.test.ts` (15/15 passed), and Playwright Chromium
  `tests/e2e/memory-variants-admin.spec.ts` (3/3 passed at single worker across 390×844, 844×390, 1280×800
  with zero horizontal scroll overflow and screenshots retained in `build/v1.3.5.7/`). [Brief](briefs/v1.3.5.7-tier2-directory-brief.md),
  [work/evidence](work/V1.3.5.7_WORK.md), [fixture](../static/demo/v1.3.5.7-tier2.html). Owner functional
  review pending. No new commit/push, deployment, or .8 is authorized.
- **v1.3.5.6 Tier 1 Memory policy completed (2026-11-07):**
  `puzzles/memory/dimensions.ts` and the manifest own six finite dimensions,
  six archetypes and ten mappings; `engine/contract.ts` exposes optional family
  policy metadata via generated `catalog.ts` without changing projections.
  `server/{config,memory-policy,games,ranked-session}.ts` validate immutable
  `game_config` snapshots, read D1-live policy, audit/CAS writes, filter eligible
  variants and enforce policy inside atomic ranked issuance. The admin Games
  route, `components/{GamesAdmin,MemoryPolicy}.svelte` and `i18n/messages.ts`
  provide the Memory-only Policy tab, confirmation and affected summary; the
  existing availability API reflects filtered variants. Tests: Memory dimensions
  unit, real-D1 `tests/integration/memory-variants.test.ts`, browser
  `tests/e2e/memory-variants-admin.spec.ts`, focused Slice 3 config/issuance,
  six-runtime Memory vectors. The [fixture](../static/demo/v1.3.5.6-tier1.html)
  is owner-approved as a functional visual baseline; [brief](briefs/v1.3.5.6-tier1-policy-brief.md)
  and [work/evidence](work/V1.3.5.6_WORK.md). Owner confirmed .6 completed on 2026-11-07. No
  new commit/push, deployment or unselected implementation is authorized.
- **v1.3.5.5 six-rule Memory pilot accepted locally (2026-11-07):**
  `memory:{budget,lockout,swaps,two-backs,quads,collapse}` live in
  `src/lib/puzzles/memory/{logic,manifest,scoring,messages,Card,Game,View}`
  with `memory-quads-v1` scoring; `PlaySession.svelte` `tryAnother` +
  `ui/puzzle-view.ts` `ontryanother` handle Budget run-over (exact-ID ranked
  abandon, checkpoint clear, no saved result). Tests: `memory/variants.test.ts`,
  `tests/vectors/memory-{runner,variants}`, `tests/integration/memory-variants.test.ts`,
  `tests/e2e/memory-variants{,-admin}.spec.ts`. [Brief](briefs/v1.3.5.5-memory-pilot-brief.md),
  [work/evidence](work/V1.3.5.5_WORK.md). Fixtures: `static/demo/v1.3.5.{3,5}-*.html`.
- **v1.3.5.4 Memory identity accepted locally (2026-11-07):**
  [selected brief](briefs/v1.3.5.4-identity-brief.md) and
  [work/evidence](work/V1.3.5.4_WORK.md) map existing-four checkpoint identity
  validation in `src/lib/ui/checkpoint.ts` and `src/lib/screens/PlaySession.svelte`,
  safe historical ranked-session fallback in `src/lib/server/ranked-session.ts`,
  `checkpoint.test.ts`, `tests/integration/memory-variants.test.ts` and
  `tests/e2e/resume.spec.ts`. Separately owner-approved `.2` type fix:
  `src/routes/admin/[view]/+page.server.ts` empty Games defaults. Scoped units,
  D1, Memory vectors, Chromium recovery, lint/format and project types pass.
  The owner later accepted .4 locally and selected .5; this earlier evidence does
  not authorize a new commit/push or deployment.

- **v1.3.5.3 Memory design/visual acceptance (2026-11-07):**
  [approved matrix brief](briefs/v1.3.5.3-memory-matrix-brief.md) names six
  rule-distinct design candidates, approved compatibility/score/outcome intent
  and scoped implementation/test reach. The [fixture-only preview](../static/demo/v1.3.5.3-memory.html)
  is owner-approved for 390×844, 844×390 and 1280×800; a focused local Chromium
  review corrected a 24-card quad landscape overflow. [Work/evidence](work/V1.3.5.3_WORK.md)
  records exact scope, checks and limitations. No app source, registry, config,
  schema, vector or test changed. Four existing Memory variants remain the only
  implemented/accepted catalogue. No .4/.5, new push or deployment authorized.

- **v1.3.5.2 bounded loading accepted locally (2026-11-07):** Owner said
  “update the git repo and push to github”, accepting completed .2 bounded
  Games queries, pagination, and lazy scoring version hydration and authorizing
  this source-only commit/push to existing `origin/main`.
  [bounded Games brief](briefs/v1.3.5.2-bounded-games-brief.md) and
  [work record](work/V1.3.5.2_WORK.md) map changes across `server/{games,games-admin}.ts`,
  `routes/admin/[view]/+page.server.ts`, `components/GamesAdmin.svelte`,
  and `tests/integration/memory-variants.test.ts`. Scoped Prettier, ESLint,
  Vitest, and Playwright Chromium checks pass. No .3, future commit/push,
  or deployment is authorized.

- **v1.3.5.1 Games extraction accepted locally (2026-11-07):** Owner said “ok
  mark this accepted and push to github”, accepting the completed .1 and
  authorizing this source-only commit/push to existing `origin/main`.
  `components/GamesAdmin.svelte` owns the Games UI and drawer;
  `server/games-admin.ts` owns data assembly/lifecycle dispatch. Existing admin
  route retains shell, shared guards/scoring, audit/error boundaries and the
  reason snippet. `games.ts` services/SQL/cache and player behavior are unchanged.
  Scoped format/lint/types, four D1 cases and two Chromium cases pass. Twelve page
  captures and drawer comparisons cover the three required viewports. Local
  implementation is owner-accepted; no new automated or device/browser evidence
  was supplied. See [work/evidence](work/V1.3.5.1_WORK.md) and the
  [accepted brief](briefs/v1.3.5.1-games-extraction-brief.md). Full verify remains
  deferred; unauditioned audio and unrelated local settings/palette changes remain
  excluded. No .2, future push, deployment or production change is authorized.

- **v1.3.5 AI handoff (2026-11-06):** begin at START HERE in
  `docs/planning/V1.3.5_ROADMAP.md` for selected-milestone scope, owner constraints,
  visual gates, focused-check selection, completion and fresh-session handoff.
  `docs/planning/v1.3.5-preview.html` is the linked human summary. Model-independent
  draft for later milestones; completed .1 is accepted locally on 2026-11-07.
  Only its current source-only GitHub handoff is authorized; no later selection.

- **Standing variant definition (owner, 2026-11-06):** `AGENTS.md`,
  `docs/DECISIONS.md` and `docs/puzzles/_TEMPLATE.md` require a meaningful gameplay
  rule/rule-setting difference for every new variant across all updates and
  future families. Cosmetics and new seeds/deals do not count. Draft Memory-only
  scope and provisional checkpoints: `docs/planning/V1.3.5_ROADMAP.md` and
  `docs/planning/v1.3.5-preview.html`; cap 100 total including the existing four.
  Documentation only; no accepted identities, replay behavior or implementation
  authorization changes.

- **Earlier v1.3.4 Slice 0 admin/query baseline (2026-11-06):** Owner-authorized local
  completion of Games admin/query review gaps. Mahjong is explicitly excluded;
  it belongs to later plans. `server/games.ts` owns `ActivityMappingEntry`,
  `buildActivityMapping` and the single-bind `queryActivityCounts` runner.
  `routes/admin/[view]/+page.svelte`, `i18n/messages.ts` and
  `ui/dismiss-dialog.ts` provide one responsive row per variant, translated
  controls and the inspection drawer. The 40-group exact-count D1 test lives in
  `tests/integration/memory-variants.test.ts`; drawer/viewport/audit checks live
  in `tests/e2e/memory-variants-admin.spec.ts` and `operator.spec.ts`.
  Scope, verification and limits: [Slice 0 work record](work/V1.3.4_SLICE0_WORK.md).
  Local implementation and targeted checks are complete; owner visual review
  remains separate. Eight focused D1 tests and six unique Chromium cases pass
  across retained runs; a separate broader Support timeout is recorded.
  Full verify remains deferred; no deployment or next feature is authorized.

- **Mahjong variant research (2026-11-05):** `docs/references/puzzle-variants/Mahjong Solitaire Variants.html` follows the existing Memory research format, with 28 sourced examples across 18 variation dimensions, 21 linked sources, filters/comparison, a tile-freedom diagram and a configuration estimator. Direct Chromium review and screenshots: `docs/evidence/v1.3.4/research/`. Reference only; no expansion of v1.3.4 implementation scope.

- **Proposed v1.3.4 Mahjong Solitaire:** Draft plan and puzzle brief at `docs/planning/V1.3.4_MAHJONG.md` and `docs/puzzles/mahjong-solitaire.md`. Proposed variants: Turtle 144, Quick 56 and Fortress 144. Awaiting owner decisions; no game implementation is authorized. Existing guide: `docs/references/game-guides/Mahjong Solitaire — How It Is Played.html`. Visual review draft: `static/demo/v1.3.4-mahjong.html` (conceptual geometry only). Screenshots: `docs/evidence/v1.3.4/` (three desktop variants and Turtle phone emulation).

- **Source handoff (2026-11-05):** Owner requested updating and pushing the current source to existing GitHub `origin/main`, including accepted v1.3.2, local v1.3.3 and documentation organization. Full verification remains deferred; the owner subsequently confirmed v1.3.3 local review and acceptance, with remaining improvements deferred to later stages. Local editor settings, ignored credentials/runtime artifacts, unauditioned audio and pre-existing palette timing changes are excluded; no deployment is authorized.

- **v1.3.3 Member Support accepted locally (2026-11-05):** Implemented on accepted v1.3.2; 7 focused D1 and 4 unique Chromium cases pass, with zero type errors/warnings and scoped lint passing. Owner explicitly deferred full `bun run verify` to later stages; no full pass or waiver is inferred. The owner confirmed local review and acceptance; remaining improvements are deferred to later stages, with details and scope not supplied. Device/browser details were not supplied. See [approved plan](planning/V1.3.3_MEMBER_SUPPORT.md), [work record](work/V1.3.3_WORK.md) and [evidence](evidence/v1.3.3/verification.json). No source push or deployment is authorized.

- **v1.3.2 accepted locally (2026-11-05):** Owner acceptance covers the existing Connect variants, per-game admin scoring tabs, audit pagination and profile summary/activity changes. Automated verification evidence and device/browser details were not supplied; no test pass or waiver is inferred. No commit/push, deployment or next phase is authorized. See `docs/briefs/morphi-v1.3.2-codex-brief.md` and `docs/PHASE_REPORTS.md`.

- **Documentation directory:** see [README.md](README.md) for grouped briefs, planning, work records, reviews, operations, privacy, and imported references. Imported documents do not authorize implementation.

- **v1.3.1 local implementation (2026-11-05):** Block variants, admin Games/cache/switch and three new per-action sounds are implemented. Targeted automated checks pass; S5 owner audition and owner local review remain pending. The owner subsequently authorized a source-only commit/push; the three unauditioned MP3s stay local. No deployment or next phase is inferred. See `docs/work/V1.3.1_WORK.md` and `docs/evidence/v1.3.1/verification.json`.

Read this map before searching. Types and implementation live in code; decisions and historical evidence live in the linked docs.

## Current scope

- v1.3.1 is implemented locally from the v1.3 source baseline `f053fc39e5bb9e3daa3cba747761cf9e81c5c914`. Targeted automated checks pass; S5 sound audition and owner local review remain pending. The refactor stays closed; this does not infer v1.3 functional acceptance. The owner subsequently authorized a source-only GitHub handoff; unauditioned MP3s remain excluded, with no deployment or next phase authorized. See `docs/work/V1.3.1_WORK.md` and `docs/evidence/v1.3.1/verification.json`.
- v1.3.3 Member Support is accepted locally on the owner-accepted v1.3.2 baseline; remaining improvements are deferred to later stages. The v1.3.4 admin/query Slice 0 is the earlier baseline; current .1 extraction evidence is linked above. Mahjong is excluded and deferred to later plans; its proposal and puzzle brief remain drafts without game implementation authorization. Preserve earlier game, admin and sound changes and their acceptance/evidence boundaries. The three new v1.3.1 MP3s remain uncommitted pending owner audition.
- v1.1 and combined next-phase work are accepted locally. Owner PC review and mobile responsive emulation were reported; physical mobile review was not. See `docs/reviews/NEXT_PHASE_REVIEW.md`, `docs/work/V1.1_WORK.md` and `docs/PHASE_REPORTS.md`.
- Active day-to-day plan: `morphi-plan-simple.md`; `docs/PLAN.md` is reference. The current v1.3.5.1 Games extraction is accepted locally in `docs/work/V1.3.5.1_WORK.md`; accepted Member Support and registered-start/imported-completion cohorts remain unchanged. The owner authorized this source-only commit/push on 2026-11-07, while the three new MP3s and unrelated local settings/palette changes remain local. No deployment, production provisioning, secret installation, DNS/Google changes or next phase is authorized.
- The published guest/privacy version remains `b50a7a18-2e85-4406-bd40-77f27c4b3da3` at `https://morphi.one` and `https://morphi-one.electrasincng.workers.dev`. Cloudflare injects its intentional analytics beacon at delivery. Source repository: `https://github.com/cngohar/morphi.one1`; pushing does not authorize deployment.

## Engine and registration

| Path                                                            | Purpose                                                                                                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/engine/contract.ts`, `scoring.ts`                      | Platform-free ids, numeric family-owned moves, canonical parser, ranked timing, leaderboard groups, runs and scoring contracts                 |
| `src/lib/engine/rng.ts`, `src/lib/seeds.ts`                     | Pure SplitMix64 v1 and canonical seed handling; external cryptographic entropy                                                                 |
| `src/lib/puzzles/<directory>/manifest.ts`                       | Family-owned generation/replay, move shape/canonical order, ranked timing/groups, scoring, messages, endings and presentation metadata         |
| `src/lib/puzzles/*/scoring.ts`, `messages.ts`                   | Family-owned coefficients/default versions and text bundles; no replay/manifest import cycle                                                   |
| `scripts/generate-registry.ts`                                  | Discovers/sorts packages and validates ids/endings; emits server catalog, small family index, browser data projections and lazy view/pool maps |
| `src/lib/catalog.ts`                                            | Generated eager server manifest catalog; browser messages are in generated `puzzle-messages.ts`                                                |
| `src/lib/registry.ts`                                           | Generated `puzzleViews[id]()` and `puzzlePools[id]()` dynamic imports; pools retain unchanged procedural generators                            |
| `src/lib/scoring.ts`                                            | Generated manifest-data scoring defaults and validation for UI/server/admin; no eager logic imports                                            |
| `src/lib/selector.ts`                                           | Linear injected-RNG weighted cycles, bounded gap repair, stable peek and validated queue/recent/position snapshots                             |
| `src/lib/family-index.ts`                                       | Generated small selection-only index: ids, weights, enablement, orientation and viewport limits                                                |
| `src/lib/puzzle-metadata.ts`, `puzzle-messages.ts`              | Generated browser data projections for scoring/presentation/messages; no manifest or logic value imports                                       |
| `src/lib/ui/selector-eligibility.ts`                            | Validates availability/weights and filters by manifest viewport/orientation between rounds                                                     |
| `eslint.config.js`, `scripts/check-boundaries.ts`               | Engine purity, cross-puzzle/app boundaries and deliberate-violation self-checks                                                                |
| `scripts/validate-ending.ts`, `src/lib/ending-contract.test.ts` | Ending declaration validation against each family's supplied messages                                                                          |
| `tests/slices/slice1-manifest-scoring.test.ts`                  | Manifest discovery, ownership and isolated novel-family generation/type-check                                                                  |
| `tests/slices/slice2-lazy-registry.test.ts`                     | Lazy discovery, novel id/folder mapping, invalid ids, bundle graph regressions, generic storage and bounded view loading                       |
| `tests/slices/slice3-catalog-server-validation.test.ts`         | Real local D1 synthetic-family issuance/replay/scoring, canonical retries, config/cache fallback, lock/TTL and legacy upgrade preservation     |
| `tests/slices/slice4-selector-property.test.ts`                 | Seeded cycle/gap/discovery properties, linear-work/timing bounds, small-index/pool consistency and storage/eligibility recovery                |

## Games and presentation

| Path                                                                                     | Purpose                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/puzzles/block-placement/logic.ts`                                               | Deterministic 8×8 Block supply, placement, clears, combos, cap and replay                                                                                                    |
| `src/lib/puzzles/memory/logic.ts`                                                        | Deterministic Memory generation, flips, mismatch resolution, completion and scoring                                                                                          |
| `src/lib/puzzles/connect/logic.ts`                                                       | Deterministic all-pairs path game; empty cells are allowed, full-grid coverage is a score bonus                                                                              |
| `src/lib/puzzles/*/Game.svelte`                                                          | Existing per-game rendering, input, entrances, timing, endings and sounds; unchanged by Slice 2                                                                              |
| `src/lib/puzzles/*/View.svelte`                                                          | Lazy adapters from generic shell props to each Game and its existing result presentation                                                                                     |
| `src/lib/ui/puzzle-view.ts`                                                              | Common round/view/result props and eight-second view-load timeout with navigation cancellation                                                                               |
| `src/lib/puzzles/*/themes.ts`, `memory/symbols.ts`                                       | Legacy themes and procedural adapters; retained Memory symbols                                                                                                               |
| `src/lib/puzzles/memory/{Card,Symbol,Confetti}.svelte`                                   | Memory card presentation, inline symbols and deterministic win burst                                                                                                         |
| `src/lib/engine/theme/`                                                                  | Cosmetic OKLCH/Machado math, validated versioned recipes/styles/profiles/tokens, palette cache, distinct subsets and weighted best-of-N; excluded from game determinism hash |
| `scripts/check-palettes.ts`, `theme-sheet.ts`                                            | Palette safety/freshness diagnostics and owner-approved contact sheet; `docs/evidence/v1.1-themes/`                                                                          |
| `src/lib/ui/solo-theme.ts`, `theme-worker.ts`, `theme-history.ts`                        | Worker solving with explicit failures; bounded family/version history; live snapshot loading via `theme-config.ts`                                                           |
| `src/lib/ui/puzzle-backdrop.ts`, `backdrop-layout.ts`, `components/ThemeBackdrop.svelte` | Seeded current-game-only objects, exposed-space sizing, compact-layout hiding; Block piece data comes from its headless manifest                                             |
| `src/lib/ui/prepare-ahead.ts`                                                            | One speculative solo candidate, no selector draw/ranked reservation; generation does not download the next view                                                              |
| `src/lib/ui/motion.ts`, `active-delay.ts`, `src/lib/round-timing.ts`                     | Sole anime.js wrapper, visible-time delays and server-known entrance/Card allowances                                                                                         |
| `src/lib/ui/sound.ts`, `static/audio/`, `scripts/generate-sounds.ts`                     | Original offline ElevenLabs cues, bounded Web Audio playback and provenance; no runtime generation                                                                           |
| `src/lib/ui/storage.ts`, `storage.test.ts`                                               | Id-derived best/played keys, sound/hint settings and versioned guest/account selector snapshots with blocked-storage fallback                                                |
| `src/lib/ui/format.ts`, `dismiss-dialog.ts`                                              | Number/clock formatting and guarded backdrop dismissal                                                                                                                       |

Slice 5 additions:

- `src/lib/engine/theme/site-tokens.{json,ts}`: 94 bounded editable site tokens,
  contrast and CSS validation; `style.ts` carries configured container shapes in snapshots.
- `src/lib/server/theme-admin.ts`, `migrations/0012_theme_admin.sql`: immutable
  drafts, check/publish/rollback, audit and single-child conflict protection.
- `src/routes/admin/theme-preview/`, `components/{ThemeEditor,ThemePreview}.svelte`:
  protected draft editing and actual Worker previews; `/admin/themes` reuses operator guards.
- `src/routes/api/play/theme/`, `src/lib/ui/theme-config.ts`: effective safe live
  snapshot API, bounded client loading and site-token application.
- `tests/slices/slice5-theme-admin-rollback.test.ts`: isolated real D1/KV safety,
  conflicting edits, fallback and rollback; `tests/e2e/theme-admin-preview.spec.ts`
  proves three responsive sizes, publishing and invalid-live recovery via actual HTTP.
- `docs/reviews/SLICE5_CSS_AUDIT.md`, `docs/evidence/slice5-themes/`, `build/slice5/`:
  four-file audit, palette measurements/contact sheet and fast-check/browser evidence.

Slice 6 additions:

- `src/lib/engine/contract.ts`, each manifest and generated `puzzle-metadata.ts`:
  required family presentation data and family-owned partial-round replay adapters.
- `src/lib/ui/puzzle-presentation.ts`, generic help/result/profile/leaderboard/admin
  views: explicit manifest names, scoring labels, group labels and backdrop objects.
- `src/lib/ui/{checkpoint,idle-preload}.ts`: account-scoped local round snapshots,
  fresh/version validation, active timer restoration, fencing and first-family speculation.
- `src/lib/server/response-policy.ts`, root `_headers`: private runtime HTML/API
  policy, noindex route policy and public media caching; guest artifact reuses adapter headers.
- `tests/slices/slice6-performance-seo.test.ts`, `slice6-performance-metrics.test.ts`,
  checkpoint/presentation units and `tests/e2e/resume.spec.ts`: Slice 6 regressions.
- `scripts/{measure-performance,performance-metrics}.ts`: repeatable built-Worker
  desktop/phone-emulation cold/preloaded p50/p95 diagnostic, with temporary sample checkpoints.
- `scripts/performance-checkpoint.ts`, `tests/slices/slice6-performance-checkpoint.test.ts`:
  atomic per-sample persistence and source/build/profile identity checks on resumption.
- `docs/evidence/slice6/`: permanent measurements and compact verification results;
  `docs/PHASE_REPORTS.md` records goal misses, admin audit and remaining owner gates.

## App shell and public pages

| Path                                                                                            | Purpose                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/play/`, `src/lib/screens/PlaySession.svelte`                                        | Selector-only Mix loop; one generic round/view, id-derived names/bests/played flags, Card orchestration and durable results |
| `src/lib/components/RoundStage.svelte`                                                          | Persistent Card, entrances, played stack, ending overlay and result stage                                                   |
| `src/lib/screens/{HomeScreen,ResultScreen}.svelte`                                              | Approved landing/result views, Home idle-preload/Resume entry, real account/save controls and Next                          |
| `src/routes/+page.svelte`, `+page.ts`, `+layout.svelte`                                         | Prerendered Home and global styles/fonts; account status refresh stays private                                              |
| `src/app.css`, `src/lib/ui/{v1,game-shell,card-shell}.css`                                      | Design tokens, accepted presentation and viewport-based game sizing                                                         |
| `src/lib/components/{SiteHeader,SiteFooter,SoundToggle,PuzzleHelp,PuzzleGuide}.svelte`          | Viewport chrome, policy link, sound and catalog-backed help/scoring copy                                                    |
| `src/lib/i18n/messages.ts`                                                                      | Shell/site/admin copy plus generated family bundle aggregation; English only                                                |
| `src/params.ts`, `src/routes/[family=family]/`                                                  | Accepted legacy family slugs redirect Home; no per-type public game doors                                                   |
| `src/routes/{how-it-works,about,faq}/`, `src/lib/content-explainers.ts`, `ContentBlocks.svelte` | Static explainer content and reusable rendering; no CMS                                                                     |
| `src/routes/{privacy,terms,sitemap.xml,robots.txt}/`, `components/Seo.svelte`, `static/og/`     | Existing public policies, SEO assets and selector-only crawl policy                                                         |
| `src/lib/content/privacy.ts`                                                                    | Owner contact and approved general-audience privacy copy                                                                    |

## Accounts, replay and operations

| Path                                                                                                                               | Purpose                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks.server.ts`, `src/app.d.ts`, `src/routes/+layout.server.ts`                                                              | Request auth, bounded bodies, private/no-store responses and minimal account status                                                                            |
| `src/lib/server/auth.ts`, `players.ts`, `request-body.ts`                                                                          | Better Auth/Drizzle factory, Google-only sessions, public names, CSRF/origin/rate guards and bounded input                                                     |
| `src/lib/server/db/`, `migrations/`, `drizzle.config.ts`                                                                           | Plain-text family keys; local D1 auth/runs/operators; migration 0011 preserves legacy rows/claims and adds config snapshots and ranked abandonment             |
| `src/routes/account/`, `src/lib/components/account/`, `src/lib/ui/account.css`                                                     | Real account lifecycle/profile layouts; AccountShell readiness is the house hydration pattern                                                                  |
| `src/lib/ui/progress.ts`, `checkpoint.ts`                                                                                          | IndexedDB completed-run retries plus fresh in-progress checkpoints, resolved look/timers, Web Locks ownership/fencing, guest import and storage fallback       |
| `src/lib/server/runs.ts`, `play-http.ts`, `src/routes/api/play/`                                                                   | Catalog-driven envelope/move validation, canonical replay/hash, manifest timing/groups, history/boards and guarded play HTTP; no family dispatch branches      |
| `src/lib/server/ranked-session.ts`, `src/routes/api/play/{start,active,abandon}/`                                                  | Atomic account-wide ranked lock, original-issuance recovery, exact-id takeover/abandon, two-hour TTL, caps and saving conflict                                 |
| `src/lib/server/{config,config-cache,scoring}.ts`                                                                                  | Catalog lifecycle and typed config readers; invalid themes follow previous valid parents; immutable snapshots cached in KV; live pointers/enforcement stay D1  |
| `src/routes/api/progress/`, `src/routes/leaderboard/`                                                                              | Saved history and server-computed rankings                                                                                                                     |
| `src/lib/server/operator*.ts`, `admin-totp.ts`, `src/routes/admin/`, `scripts/admin-local.ts`                                      | Protected local operator workspace, role/TOTP/freshness guards, owner enrollment and audit; operator shell exposes readiness for browser input synchronization |
| `src/lib/server/{user-lifecycle,activity,admin-users,audit,moderation,games}.ts`                                                   | User controls, prospective activity, append-only audit, game lifecycle/statistics and scoring rollback                                                         |
| `src/lib/ui/account-activity.ts`, `src/routes/api/play/activity/`                                                                  | Existing account round-start/abandon reports                                                                                                                   |
| `src/lib/server/retention.ts`, `docs/privacy/PRIVACY_RETENTION.md`, `PRIVACY_REQUESTS.md`                                          | Local cleanup/request deletion and documented retention/operator limits                                                                                        |
| `src/lib/server/measurement.ts`, `src/lib/ui/measurement.ts`, `src/routes/api/measurement/`, `components/MeasurementChoice.svelte` | Default-off coarse measurement, consent/DNT/GPC and withdrawal; families validate against catalog                                                              |
| `src/env.ts`, `src/lib/server/elevenlabs.ts`                                                                                       | Optional key schema and unused server stub; offline sound generation remains manual                                                                            |

## Build, verification and evidence

| Path                                                                                                            | Purpose                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`, `scripts/check-lazy-bundle.ts`                                                                | Client chunk membership/static/dynamic graph in ignored `build/slice2/client-chunks.json`; rejects eager/transitive Game imports and cross-family view closures |
| `package.json`, `vitest.config.ts`                                                                              | Bun commands and headless units, including Slice acceptance tests; verify runs bundle analysis after Worker build                                               |
| `tests/integration/`, `vitest.accounts.config.ts`                                                               | Isolated real D1/auth, scoring, lifecycle, audit and activity integration tests (full accounts suite skipped for Slice 5)                                       |
| `tests/vectors/`, `scripts/check-vectors.ts`, `measure-replay.ts`                                               | Unchanged known vectors in Node/Bun/Chromium/Firefox/WebKit/workerd and local replay-cost diagnostics                                                           |
| `scripts/check-worker.ts`, `finish-build.ts`                                                                    | Isolated built-Worker smoke and removal of demo assets from release output                                                                                      |
| `playwright.config.ts`, `tests/e2e/`                                                                            | One browser worker; account, Card, game, recovery, operator, policy, selector and layout regressions across configured browsers                                 |
| `tests/e2e/lazy-registry.spec.ts`, `selector-reload.spec.ts`                                                    | Selected-view-only requests, failed import retry/retained result, and actual page-refresh selector continuity                                                   |
| `static/demo/`, `scripts/{card-proof,build-card-proof,check-v1-app,check-v1-demo}.ts`                           | Reference demos and isolated visual checks; never production game logic                                                                                         |
| `wrangler.jsonc`, `wrangler.public-privacy.jsonc`                                                               | Local-account Worker configuration versus published assets-only guest/privacy configuration; never deploy without specific approval                             |
| `scripts/{prepare-public-privacy,check-public-privacy,setup-accounts}.ts`                                       | Guest artifact validation and ignored local credential setup                                                                                                    |
| `docs/PHASE_REPORTS.md`, `docs/DECISIONS.md`, `docs/EDGE_CASES.md`                                              | Acceptance evidence, locked choices and required failure behavior                                                                                               |
| `docs/operations/ADMIN_LOCAL.md`, `GOOGLE_AUTH_SETUP.md`, `GOOGLE_OAUTH_PUBLIC.md`, `CLOUDFLARE_AGENT_SETUP.md` | Owner-only local enrollment, Google setup/release gates and project-local Cloudflare tooling                                                                    |
| `docs/{STEP6_WORK,STEP6_REVIEW,STEP6_MEASUREMENTS,V1_WORK,V1.1_WORK,NEXT_PHASE_REVIEW}.md`                      | Historical accepted local implementation/review and remaining production boundaries                                                                             |
| `docs/puzzles/`, `docs/morphi-v1.1-handoff-2026-10-26/`                                                         | Approved per-game briefs, templates and historical v1.1 handoff                                                                                                 |
| `docs/reviews/NEXT_PHASE_VISUAL_REVIEW.md`, `build/combined-review/`                                            | Earlier combined visual comparison and verification evidence                                                                                                    |
| `build/slice1/`, `build/slice2/`, `build/slice3/`, `build/slice4/`                                              | Ignored refactor logs/measurements; Slice 3 milestone evidence retained; Slice 4 fast checks, timing and focused reload evidence                                |

## Commands and conventions

- Install: `bun install`; local setup: `bun run accounts:setup`, `bun run cf:types`, `bun run db:migrate:local`.
- Dev: `bun run dev --host 0.0.0.0`; type-check: `bun run check`; format/lint: `bun run lint`.
- Slice 7 uses fast lint/types/boundaries/units and six-runtime vectors during development, then one final `bun run verify`. Never overlap verify with its components; after fixes rerun only affected suites unless shared code changes.
- Full gate: `bun run verify`; targeted commands: `test:unit -- --run`, `test:accounts`, `test:vectors`, `test:worker`, `test:e2e`, `check:boundaries`, `check:lazy-bundle`.
- Generate registry: `bun run registry:generate`; palette diagnostics: `bun run test:palettes`; contact sheet: `bun run theme:sheet`.
- Build/local Worker: `bun run build`, `bun run preview:worker`. Deployment and even a remote preview still require explicit owner approval.
- App alias: `#lib`, explicit `.js` extensions. Pure engine imports only engine; puzzle packages never import each other; app reaches puzzles through generated files.
- Core logic is deterministic integer-only; cosmetic theme math has a separate boundary. Every family owns its version, vectors, manifest, messages, view and README.
- User-facing copy uses the catalog; motion uses the wrapper. Themes never affect rules/score. No user-agent layout sniffing, gradients, glows or shadows on game objects.

## Slice 7 final audit

- `docs/reviews/SLICE7_CONTRACT_AUDIT.md`: per-family determinism classes, canonical replay/hash/scoring audit, generic boundaries and the recorded Slice 5 cosmetic-vector exception.
- `tests/slices/slice7-determinism-six-runtimes.test.ts`: frozen fixtures, rejection sampling/Fisher–Yates, cosmetic RNG isolation and actual existing six-runtime harness execution.
- `tests/slices/slice0-base-tag.test.ts`: retrospective annotated-tag target and ancestry integrity; does not assert the original timed gate ran.
- `scripts/check-boundaries.ts`: explicit approximate-math negative probes in addition to purity/import checks.
- `src/lib/ui/checkpoint.ts`, `src/lib/server/config.ts`: package-owned bounded phases and manifest-derived weight/initial enablement; checkpoint/Slice 3 regressions.
- `docs/evidence/slice7/verification.json`, `build/slice7/`: compact permanent verification evidence and local detailed logs.

## v1.3 Memory variants

- `src/lib/puzzles/memory/{logic,manifest,scoring,messages,Game,View}.ts` (Svelte views use `.svelte`): classic/no-preview/trios/moving plus v1.3.5.5 budget/lockout/swaps/two-backs/quads/collapse, pinned deterministic mismatch shuffle, trio/quad/budget caps and variant presentation; package README describes timing and compatibility.
- `engine/contract.ts`, `selector.ts`, `scoring.ts`, generated `puzzle-metadata.ts`/`puzzle-messages.ts`, `screens/PlaySession.svelte`, `ui/{checkpoint,progress,account-activity,selector-eligibility}.ts`: family-owned codes, weighted variant selection, default classic, durable round/ranked identity and isolated bests.
- `server/{activity,games,ranked-session,runs,scoring}.ts`, `server/db/schema.ts`, `migrations/0013_variants.sql`, `routes/api/play/{activity,availability,start,scoring}`: first-flip/activity cohorts, lifecycle/audit, authoritative replay and independent immutable scoring scopes.
- `routes/admin/[view]/+page.{server.ts,svelte}`, `components/{ScoringEditor,AdminTestPlay}.svelte`: existing games detail variant expansion, shared/trio editors and authenticated ephemeral test play. No new route.
- `memory/variants.test.ts`, `lib/memory-variants.test.ts`, `tests/integration/memory-variants.test.ts`, `tests/e2e/memory-variants{,-admin}.spec.ts`, `tests/vectors/memory-*`: scoped acceptance checks. `bun scripts/check-vectors.ts --memory` runs only Memory vectors in six runtimes; `bun scripts/check-palettes.ts --memory` checks only Memory palettes.
- `docs/work/V1.3_WORK.md`, `docs/evidence/v1.3/`: final report, exact groups, full file inventory, targeted verification and local diagnostic measurements. Full verify and other-family suites were deliberately not run.

## v1.3.1 Block variants, admin and sounds

- `src/lib/puzzles/block-placement/{logic,manifest,messages,Game,View}` and package README: classic-compatible optional variant/size, board-10, rows-only, continuous rush clock, help/results and shared score copy.
- `src/lib/engine/contract.ts`, `server/runs.ts`, `ui/puzzle-view.ts`, `screens/PlaySession.svelte`: optional maxSeconds, exact ranked elapsed ceiling, checkpoint save-time bridge and family-owned time-up ending.
- `server/games.ts`, `routes/admin/[view]/+page.{server.ts,svelte}`, `components/{GameSwitch,ScoringEditor}.svelte`, `components/account/AccountForm.svelte`: cached global sums, selected-family queries, audited reason-free enable, accessible switch/dialog and catalog test-play families.
- `scripts/generate-sounds.ts`, `static/audio/manifest.json`, `static/audio/{trio-match,reshuffle,timer-tick}.mp3`, `ui/sound.ts`, `puzzles/memory/Game.svelte`: staged offline generation, preserved old provenance, new action assets and runtime hooks. New MP3 owner audition remains pending.
- `scripts/{generate-registry,check-vectors}.ts`, generated `puzzle-{metadata,messages}.ts`, `tests/vectors/block-*`: maxSeconds projection, `bun scripts/check-vectors.ts --block`, three-seed vectors per new variant plus preserved classic vectors in six runtimes.
- `puzzles/block-placement/variants.test.ts`, `src/lib/block-variants.test.ts`, `tests/integration/block-variants.test.ts`, filtered `tests/integration/memory-variants.test.ts`, `tests/slices/v1.3.1-sounds.test.ts`, `tests/e2e/{block-variants,variant-sounds,memory-variants-admin,operator}.spec.ts`: targeted logic, compatibility, ceiling, statistics/cache/lifecycle, action sounds and admin evidence.
- `docs/work/V1.3.1_WORK.md`, `docs/evidence/v1.3.1/{verification,audio-quality}.json`: complete inventory, B/S/A results, known risks and pending S5 gate. No full verify/global lint/type checks or physical-device claim.

## v1.3.3 Member Support

- `migrations/0014_member_support.sql`, `server/db/schema.ts`: taxonomy, account-owned tickets/messages, per-ticket read marker, retry receipts and rolling successful-write limiter events.
- `server/support.ts`, `operator-permissions.ts`, `server/retention.ts`: explicit admin/moderator support permissions, ban-tolerant member guard, conditional atomic writes/audits, quota/idempotency, protected defaults/reassignment, account cascades and expired-limit maintenance.
- `server/support-http.ts`, `routes/api/support/`, `routes/admin/support/data/`: bounded same-origin JSON with owner binding, guarded staff sessions/freshness and private/no-store/noindex replies. Staff endpoints retain the existing `/admin` cookie scope.
- `components/SupportDesk.svelte`, `routes/account/support/`, `routes/account/+page.svelte`, `routes/admin/[view]/`: member support and staff inbox/taxonomy in existing shells; paginated plain text, unread replies and memory-only drafts/ambiguous retry ids.
- `content/privacy.ts`, `i18n/messages.ts`, `docs/privacy/{PRIVACY_RETENTION,PRIVACY_REQUESTS}.md`: approved local conversation retention/deletion policy; no publication.
- `tests/integration/support.test.ts`, `tests/e2e/support.spec.ts`, `tests/e2e/privacy.spec.ts`: focused service/access/race/deletion and UI/privacy coverage. Targeted results and the explicit full-verification deferral are recorded in `docs/work/V1.3.3_WORK.md`, `docs/evidence/v1.3.3/verification.json` and the latest phase report.
