# Morphi: Simple Plan

## v1.4.4 Tangram — focused verification complete; owner review pending (2026-11-14)

Classic and ten Batch A variants are locally implemented: eleven enabled presets,
zero variant groups, and the reused `(tangram, UTC date)` daily board. Amendment 4
removes New silhouette; Amendment 5 removes Row and its toggle, leaving the Square
tray only. The earlier stops below are historical and superseded by these amendments.

Focused evidence: 26 unit cases, 11 real-D1 cases, 23 single-worker Chromium cases,
33 solved and 66 rejected vectors in each of six runtimes, scoped lint/types (0 errors,
0 warnings), boundaries, build and lazy isolation passed. The shared saver's `seconds=0`
opening replay preflight checks geometry; positive elapsed replay enforces timing. A
zero-active-time save falls below the five-second ranked floor and is unranked.

Owner functional review remains pending. Full `bun run verify` and physical-device
review were not performed. No commit, push, deployment, release or Batch B is authorized.

## Historical, superseded: v1.4.4 partial baseline and session-contract stop (2026-11-13)

The owner selected baseline first, then Batch A, under the accepted Tangram
brief and Amendments 2/3, with focused checks only and no commit/push/deploy.
The accepted `tangram-middle-style-demo` opened in local Chromium; its screenshots
remain in `build/v1.4.4/reference/`. The supplied fixture was copied to
`static/demo/tangram.html` as directed by the fix handover. The earlier UI
projection stop is resolved by Amendment 3; engine geometry remains exact.

**STOP / incomplete:** the demo's New silhouette control requests another
Tangram target. `PuzzleViewProps` exposes only `ontryanother`, explicitly
run-over-only (`src/lib/ui/puzzle-view.ts:40`); `PlaySession.tryAnother()` abandons
the session, records `run_over`, and invokes the cross-family selector
(`src/lib/screens/PlaySession.svelte:1304`). There is no family-preserving fresh
round request in the view contract. The local draft currently wires New
silhouette to that callback; this does not establish the requested behavior.
Changing the view/session contract or PlaySession is outside brief §8, so no
such change or selector workaround was made. Owner clarification/amendment is
needed for this control before the baseline can be called complete.

**Local source, not acceptance:** Classic only, `tangram-1`, one enabled preset,
zero variant groups. Exact integer-pair geometry, all eight orientations,
coverage independent of witness identity, eighteen frozen silhouettes (thirteen
convex plus Cat/House/Bird/Boat/Swan), family SVG Game/View, Stage and motion.
The inherited Swan candidate had equal-area boundary additions/omissions;
its outline was reconstructed from the unchanged seven-piece assembly and
then passed exact coverage. Bird and Boat are own assemblies. The real Sei
cut and all sixteen convex witness candidates are researched under `/tmp/`
only; **no Batch A variant has been added**.

**Files:** `src/lib/puzzles/tangram/{logic,manifest,scoring,messages,motion}.ts`,
`Game.svelte`, `View.svelte`, `Stage.svelte`, `logic.test.ts`, `README.md`;
`docs/puzzles/tangram.md`; `tests/vectors/tangram.json` and
`tangram-runner.ts`; `tests/integration/tangram.test.ts` (prepared for the final
Batch A catalogue, not run); `tests/e2e/tangram.spec.ts`. Two shared source touches
only: `src/lib/round-timing.ts` (1500 ms constant), `scripts/check-vectors.ts`
(`--tangram`). Registry generation, never hand edits, produced catalog,
family-index, puzzle-messages, puzzle-metadata and registry updates.

**Evidence:** `build/v1.4.4/baseline/recheck-unit.log`: 12/12 units pass,
including all eighteen witnesses, all eight exact orientations and an alternate
square/two-small-triangle solution. Scoped ESLint passed and scoped Svelte
check reported 0 errors/0 warnings (`recheck-eslint.log`, `recheck-types.log`).
These two checks precede the latest one-line pointer pickup correction and
have not been repeated after it. Three Classic solved vectors were frozen,
not yet exercised in six runtimes. Chromium runs use one worker. First the
harness selected Connect; saved-selector state then selected Tangram. The
real pointer solve still failed at its first placement in the latest completed
run (`browser-pointer.log`), including after preserving the selected draft's
rotation on pickup. No browser pass, viewport fit or keyboard completion is
claimed. The 844×390 collapse observed in the reference remains a required
app check, not an app pass.

Required `gpt-6.1-sol/high` coding/research and `gpt-6-luna/max` verification
agents performed the recorded work; they subsequently hit usage limits. No
substitute-model checks or silent parent takeover are claimed.

**Not run:** final scoped lint/types after the pointer correction, remaining
browser cases, D1 integration, six-runtime vectors, boundaries, build/lazy
isolation, physical-device checks or full `bun run verify`. No Batch B–J,
other-family implementation, new sounds, commit, push, deployment or release.
Existing editor/MCP files and unrelated static-image deletions were preserved.

## Active status — v1.4.2 source commit and push authorized (2026-11-13)

The owner said “comit and push to github”, authorizing the completed Mahjong
Classic + ten Batch A source handoff to existing `origin/main`. This supersedes
the earlier local commit/push stop for this handoff only. Include the family,
focused tests/vectors, two shared source touches, generated projections, related
docs and owner-provided brief/demo/reference image/template update. Keep build
evidence local and exclude `.cursor/` and `.vscode/mcp.json`.

The focused evidence recorded below is unchanged; no new verification,
physical-device review or owner functional acceptance is inferred. Full
`bun run verify` remains deferred. No Batch B, deployment, provisioning or
production release is authorized. The prior closeout below remains the local
implementation/evidence record; its commit/push restriction is superseded here.

## Active status — v1.4.2 Mahjong Solitaire built; focused checks complete; STOP (2026-11-13)

The owner selected the accepted Rev 2 brief at `56b58af` on 2026-11-12.
Classic passed its baseline gate before exactly ten Batch A variants were added.
**11 enabled presets / 0 variant groups**, seeded Quick/Turtle/Fortress bands,
and a fixed 108-tile Triple exception. One reused `(mahjong-solitaire, UTC date)`
board per day. Family-owned SVG Game, Stage and motion from day one.

Focused format/lint, types (0 errors/0 warnings), 24 units, boundary probes,
build/lazy isolation, 33 solved/66 rejected frozen vectors in six runtimes,
10 isolated real-D1 cases and 32 single-worker Chromium cases pass. Nine captures
cover all three bands at 390×844, 844×390 and 1280×800; Quick reaches the 44px
portrait target and larger boards have Fit/zoom/pan without page overflow.
The runtime process completed before its agent's usage-limit failure; the owner
said “continue” and the parent inspected the completed evidence and closed docs.
No substitute-agent verification or owner functional acceptance is claimed.

Exactly two shared source touches (entrance constant and vector filter), plus
regenerated registries. No new §8A carve-out, shared contract/server/schema,
selector, shared shell/motion, dependency or other-family edits. Supplied
brief/demo/style image, template and editor/MCP changes remain preserved.

See [CODEMAP inventory, evidence, choices and limits](docs/CODEMAP.md).
**STOP:** no full verify/global lint/other-family suites, physical-device checks,
Batch B–J, new sounds, commit, push, deployment or release. Owner review is next.
The existing signed-browser reload/abandonment policy remains separately deferred;
practice checkpoints and D1 ranked resume are not a waiver of that issue.

## Active status — v1.4.1 rev 3 built and focused verification complete; STOP (2026-11-09)

Resumed the preserved pre-build handoff at `56e6460`, without reset/restart.
The owner's explicit rev 3 completion instruction authorizes execution despite
the brief's draft header; functional acceptance remains pending.
Classic was verified before adding exactly ten Batch A variants. **11 enabled
presets / 0 variant groups**, three size bands, one reused `(nonogram, UTC date)`
board per day. No new daily subsystem or other-family game implementation.

§8A optional contracts/pinned recovery and §8B family-cohort persistence,
exact-millisecond timing downgrade and admin attribution are complete. Registry
generator source needed no edit; projections were regenerated, never hand-edited.
Below-floor saved runs consume the attempt, remain unranked and create no daily
row. Per-preset scoring stays immutable/internal. Without a surviving recorded
start, group-less historical completions stay in family history but are omitted
from preset counts/history.

Focused format/lint, types (0 errors/warnings), boundaries, build/lazy isolation,
30 unit cases, 20 real-D1 cases, 33 solved/66 rejected vectors in six runtimes,
and 42 unique Chromium cases across serial one-worker runs pass. Final colour
portrait cells are ≥19px; teaching leaves HUD labels visible. The required
`gpt-6-luna/max` verifier returned 503; the owner authorized parent verification,
without substitute-agent evidence. Full verify, global lint, other-family suites
and physical-device/production checks remain unrun. Workspace generation
diagnostics are not phone performance proof.

See [complete inventory, §8A/§8B choices, evidence and limits](docs/CODEMAP.md).
**STOP at baseline + Batch A.** Owner functional review is next; no automatic
acceptance, Batch B, new sounds, commit, push, deployment or release step.
The owner brief/fixture and unrelated editor/MCP files remain untouched.

## Earlier status — v1.4.1 rev 2 resumed; remaining scope stop (2026-11-09)

Resumed the preserved pre-build handoff at `56e6460`, using the owner-accepted
rev 2 and unchanged fixture. The brief now also exists at the requested
`docs/briefs/v1.4.1-nonogram-codex-brief.md` as an exact copy of the provided
`v1.4.1-nonogram-codex.md`. No restart or production source change was made.

§8A authorises optional registration/recovery, but `saveRun` still binds the
replay group directly into a required database field and rejects/abandons
below-floor claims instead of saving them unranked. Its whole-second comparison
also cannot enforce the locked 2,500 / 22,500 ms boundaries exactly. These require
insertion/timing operations beyond §8A's recovery-only `runs.ts` allowance.
Additional safe field reads and group-based activity/history consumers remain
in the read-only Memory directory; admin-query compatibility must be resolved.
The brief's §8A/§10 conflict stop applies; no workaround or scope expansion.

Baseline + Batch A, §8A and all focused §9 checks remain **unimplemented/unrun**.
Presets/groups/Nonogram boards added: **0 / 0 / 0**. Read-only scope audit used
the required `gpt-6.1-sol/high`; `gpt-6-luna/max` returned 503, with no substitute
verification claimed. See [exact gaps, inventory, resume needs and every §9
status](docs/CODEMAP.md). Full verification remains deferred. STOP: no Batch B,
other-family change, new sounds, commit, push, deployment or release work.

## Earlier status — v1.4.1 Nonogram pre-build contract-gap stop (2026-11-09)

The owner selected baseline + Batch A exactly from
`docs/briefs/v1.4.1-nonogram-codex-brief.md`, with baseline first, focused §9
checks and no commit/push/deployment. The provided demo exists and remains a
reference only. HEAD remains `56e6460`; no Nonogram source, presets, variant
groups or daily boards were added.

Stopped under the brief's explicit conflict rule: new Nonogram manifests must
define no `leaderboardGroups`, but both manifest/variant contracts require that
field and daily recovery/admin paths consume it. Fixing this needs a scope
resolution; engine/server edits and invented group arrays were not made.
See the top of `docs/CODEMAP.md` for exact source references and remaining
brief inconsistencies. Only these two handoff documents changed. All §9 checks
remain unrun after the pre-build stop; full verification remains deferred.
No Batch B, other family, sounds or release step followed.

## Earlier status — v1.4 built locally; targeted verification complete; STOP (2026-11-09)

Resumed the preserved implementation without resetting HEAD `9e10b73`.
§§8A–8E and full targeted §9 are complete. **253 player variant groups → 0;
boards = families × UTC days**. Daily issuance/recovery is anonymous, practice
rules remain, and every non-baseline round keeps its teaching. §8E needed no
manifest edit. The premium streak freeze remains an ineligible stub.

Scoped lint, types (0 errors/0 warnings), build/boundaries/lazy bundle, 145 units,
8 shared validation cases, 68 unique real-D1 cases, frozen vectors in six runtimes,
and the final whole 123-case Chromium matrix (one worker) pass. Actual local Cron,
interactive CLI/R2 archive-before-delete and the light 10,000-entry query/call
measurements pass. Full `bun run verify` and production/physical-device checks
remain deferred. The parent used recorded owner takeover after the required
verifier returned 503; coding used the prescribed available agents.

Owner functional review is pending. See [complete results, 53-file inventory and
zero-edit limits](docs/CODEMAP.md) and [rev 6 brief](docs/briefs/v1.4-leaderboard-codex-brief.md).
No commit, push, deployment, release, new family/variant or v1.4.1 was performed.
**Stop at local v1.4.** Earlier active-status entries below are historical.

## Active status — v1.4 rev 5 types green; teaching-data scope stop (2026-11-09)

Resumed the preserved partial implementation without resetting HEAD `9e10b73`.
§8D source changes, type-contract corrections and required daily test files are
authored. Registry/binding generation pass; final types pass with **0 errors /
0 warnings**. Focused unit outcome is **117/118 unique passes**. The required
round-rule test fails because Connect board-8 and rush-60 provide no differing
help step. The brief forbids the manifest edits needed to satisfy §5A, so its
refactor-gap stop rule applies. Full lint also fails in 10 untouched historical
files. Build and remaining §9 runtime/browser/load checks are unrun.

**253 variant groups → 0 player variant boards; boards = families × UTC days**
is authored, not built or functionally accepted. The required verifier returned
503; parent verification used the owner's explicit takeover authorization.
Full verify remains deferred. See [current evidence/inventory/conflicts](docs/CODEMAP.md)
and [brief](docs/briefs/v1.4-leaderboard-codex-brief.md). No commit, push,
deployment, release or v1.4.1 follows. Resume this tree after resolving the named
allowances; do not restart.

## Active status — v1.4 rev 4 resumed; stopped on further scope gaps (2026-11-09)

The preserved daily-family implementation was resumed without resetting HEAD
`9e10b73`. §§8A–8C source connections, family/date board UI, anonymous rules/help,
streak and the template are authored. Midnight rounds credit their UTC start day;
boards freeze at 02:00 UTC. **253 variant groups → 0 player variant boards;
boards = families × days** is authored but not built or verified.

Registry/type generation pass. `bun run check` fails with **44 errors / 0 warnings
in 15 files**. Removing client groups exposes two further source dependencies
outside the brief's edit list: `server/activity.ts` and `server/memory-directory.ts`.
Practice selector types and old board/projection tests also need reconciliation.
The brief requires stopping on such gaps; partial work and logs are preserved.
Build and all remaining §9 checks are unrun; full verify remains deferred.
The required verifier returned 503, so the parent took over as authorized.
See [current handoff/inventory](docs/CODEMAP.md) and [brief](docs/briefs/v1.4-leaderboard-codex-brief.md).
No v1.4 acceptance, commit, push, deployment or next milestone follows.

## Active status — v1.4 rev 3 partial implementation; stopped on scope gaps (2026-11-09)

The owner selected exact v1.4 implementation including §8A/§8B with Ponytail;
no commit, push, deployment or later milestone. Partial source is preserved locally.
The brief's stop rule applies: `memory/TimeStrata.svelte` still needs anonymous-rule
and variant-display changes outside its explicit file list, and the maintenance CLI
caller must pass `RUN_ARCHIVE` to activate the new completed-run pruning.
All build and verification checks remain unrun; the board transition is incomplete.
The owner chose start-day credit and final freeze after the two-hour midnight grace;
this decision is recorded but its final source adjustment remains pending.
See [partial inventory and handoff](docs/CODEMAP.md) and
[revised brief](docs/briefs/v1.4-leaderboard-codex-brief.md).
No v1.4 acceptance or release authorization is inferred.

## Active status — v1.3.5.17 Memory closeout accepted; audio approved; source commit and push authorized (2026-11-08)

The owner instructed “closeout is now done, you can comit and then push to github, also i review the audio file and approved it,you can include in comit too”.
This accepts the completed v1.3.5.17 focused Memory integration and closeout, approves the three audio files
(`static/audio/reshuffle.mp3`, `static/audio/timer-tick.mp3`, and `static/audio/trio-match.mp3`), and authorizes
source commit and push to GitHub.
Memory expansion concludes at **81 accepted and implemented Memory presets / 243 leaderboard groups**; .16 Batch I is omitted.
Scoped verification is complete: types (0 errors / 0 warnings), format/lint, 81 unit/checkpoint tests,
18 real-D1 cases and all 72 Memory vectors in six runtimes pass. Serial one-worker Chromium runs cover 15 unique passing cases.
Full `bun run verify` remains deferred; editor exclusions preserved. No production deployment authorized.
See [brief](docs/briefs/v1.3.5.17-memory-closeout-brief.md), [work/evidence](docs/work/V1.3.5.17_WORK.md).

## Earlier status — v1.3.5.17 locally verified; ready for closeout review (2026-11-08)

The owner said “ok i chose the stop expending and chose the 1.3.5.17 focuse
integration , you can use the pony tail to start this”. Stop expansion at
**81 accepted and implemented Memory presets / 243 leaderboard groups**; omit
v1.3.5.16 Batch I. The accepted .14/.15 source is committed and pushed at
`9372b99`. This selects local focused integration and necessary bounded
corrections under Ponytail. Final .17 acceptance and any future commit/push,
deployment or next phase remain separate owner decisions.
Local .17 history correction and focused checks pass: 81 units/checkpoints/selector,
18 D1 cases, 72 vectors in six runtimes and 15 unique Chromium cases across serial
runs; types are 0 errors/warnings. Owner .17 acceptance remains pending.
Full verify remains deferred; audio/editor exclusions persist.
See [selected brief](docs/briefs/v1.3.5.17-memory-closeout-brief.md) and
[work/evidence](docs/work/V1.3.5.17_WORK.md).

## Earlier status — v1.3.5.15 Batch H accepted; source commit and push authorized (2026-11-08)

The owner instructed “the last work was done, but comit and pushed to github, so comit now and then push to github”,
accepting the completed Time Strata baseline (v1.3.5.14) and 10 Time Strata ruleset variants (v1.3.5.15 Batch H)
and authorizing this source commit and push to GitHub.
Total catalog Memory variants are now **81 presets / 243 groups**.
Scoped verification is complete: types (0 errors / 0 warnings), format/lint, 65 unit/checkpoint tests,
real-D1 tests and all 72 Memory vectors in six runtimes pass. Serial one-worker Chromium runs cover 105 unique
passing cases (91 Batch H, 11 baseline, 3 admin).
Full `bun run verify` remains deferred; unauditioned audio and editor exclusions preserved. No production deployment authorized.
See [brief](docs/briefs/v1.3.5.15-batch-h-brief.md), [work/evidence](docs/work/V1.3.5.15_WORK.md).

## Earlier status — v1.3.5.15 Batch H locally implemented and verified (2026-11-08)

The owner requested “continue the progress of batch h which was in middle of
implementation”, then “using the ponytail plugin for implementation” on 2026-11-08.
This authorizes local integration of the ten completed preview rules and supersedes
the preparation-only stopping point. All ten are now locally implemented with
Ponytail on the accepted four-stack board, using `memory-1`, pair `brief-v1` scoring
and thirty isolated groups. Implemented Memory is **81 presets / 243 groups**;
owner-accepted Memory remains **71 / 213**. App functional review remains separate.

Scoped verification is complete: types (0 errors / 0 warnings), format/lint, 65 unit/
checkpoint tests, four real-D1 tests and all 72 Memory vectors in six runtimes pass.
Serial one-worker Chromium runs cover 105 unique passing cases: 91 Batch H,
11 baseline and three admin. Glimpse and Order short-landscape spacing was fixed;
an interrupted run resumed in smaller serial runs. Evidence includes 181 bounds
snapshots and 271 gameplay captures, with a minimum measured target of 65×44px.
The required `gpt-6-luna/max` tester returned 503; the prior owner takeover
instruction authorizes direct parent verification, without substitute-agent claims.
Owner functional/visual review is the next stopping point. Full `bun run verify`
remains deferred. No commit, push, deployment, next batch,
audio audition or unrelated editor/MCP change is authorized.
See [brief](docs/briefs/v1.3.5.15-batch-h-brief.md),
[work/evidence](docs/work/V1.3.5.15_WORK.md) and the retained
[preview](static/demo/v1.3.5.15-batch-h.html).

## v1.3.5.14 Time Strata accepted locally (2026-11-08)

The owner's “mark that accepted” closes post-integration functional acceptance
for the one `memory:time-strata` baseline and its three groups. The prior focused
checks remain the evidence; no new automated check or device/browser review was
supplied. Source remains local and uncommitted above `7eadc3b`. See
[acceptance and evidence](docs/work/V1.3.5.14_WORK.md).

## Earlier v1.3.5.14 implementation evidence (2026-11-08)

The owner said “v1.3.5.14 is now approved, you can start the implementation with ponytail skill” on 2026-11-08. This approves the retained Time Strata preview and authorizes this one baseline’s local app integration. No new device/browser details were supplied; no physical-device review is inferred.

One new `memory:time-strata` baseline, four stacks with top-only access. Local integration and focused checks are complete under Ponytail. The implemented catalogue is 71 / 213: 70 / 210 owner-accepted plus one baseline / three groups awaiting app functional review. Format/lint, types (0/0), 56 unit/checkpoint cases, three D1 cases, six-runtime vectors (38 frozen plus four new) and 25 Chromium cases pass. Full verify remains deferred; no commit/push or deployment. The required testing agent returned 503; the owner reaffirmed direct parent takeover until done. See [work](docs/work/V1.3.5.14_WORK.md).

## Earlier fixture status — v1.3.5.14 Batch G new-baseline preview ready for review (2026-11-08)

On resumption the owner selected “Continue the preview review first”, then clarified:
“we are build a new baseline for this batch instead of new varient”. The active scope is
one new Memory baseline design and its interactive local fixture, replacing the earlier
ten-modifier expansion proposal. The owner selected the layered board: only the top
card of each of four stacks can be played. **Time Strata** is the proposed baseline.
The selected brief is `docs/briefs/v1.3.5.14-batch-g-brief.md`; its playable fixture is
`static/demo/v1.3.5.14-batch-g.html`, with work/evidence in `docs/work/V1.3.5.14_WORK.md`.
The focused runner passed 742 Chromium assertions, 96 solvable generated deals and
gameplay/layout checks at 390×844, 844×390 and 1280×800; scoped format/lint and
runner-only types pass. New captures/JSON are in `build/v1.3.5.14/new-baseline/`.
Earlier `preview-rulesets-*.png` captures describe the superseded ten-tab fixture.
Accepted Memory remains 70 variants (210 leaderboard groups). Owner visual review
and separate local app implementation authorization remain pending. The required testing agent
was unavailable; the owner explicitly authorized direct work in this conversation
through completion, including focused verification.

## Earlier local status — v1.3.5.13 Batch F accepted and committed (2026-11-08)

The owner instructed “update the git repo and then push to github”, accepting the completed 10
genuine Memory Cloudflare Next-Gen Developer Platform & Edge Primitives rulesets
(`memory:workflows-step`, `memory:browser-rendering`, `memory:ai-gateway`, `memory:k2-streams`,
`memory:basin-catalog`, `memory:edge-snippets`, `memory:images-transform`, `memory:waiting-room`,
`memory:privacy-pass`, and `memory:agents-sdk`) and authorizing this source commit and push to main (`7eadc3b`).
Total catalog Memory variants are now 70 (210 leaderboard groups). Multi-runtime vectors (6/6 runtimes,
fingerprint `a8be9d5f...` and memory vector fingerprint `e11e8733...`), workspace types (0 errors/0 warnings),
unit tests (47/47), real-D1 integration suite (15/15), and Playwright Chromium admin suite (3/3 at one worker) pass.
Full `bun run verify` remains deferred; unauditioned audio and editor exclusions preserved. No production deployment authorized.
See `docs/briefs/v1.3.5.13-batch-f-brief.md` and `docs/work/V1.3.5.13_WORK.md`.

## Earlier local status — v1.3.5.12 Batch E accepted and committed (2026-11-08)

The owner instructed “update the git repo and push to github”, accepting the 10 genuine Memory botanical & nature
rulesets under the new Split Dual-Garden Baseline (`memory:cross-pollination`, `memory:mycelium-network`,
`memory:photosynthesis`, `memory:seed-dispersal`, `memory:seasonal-bloom`, `memory:bee-waggle`,
`memory:carnivorous-briar`, `memory:chlorophyll-meter`, `memory:bioluminescent`, and `memory:botanical-graft`)
and authorizing this source commit and push to main. Total Memory catalogue expanded from 50 to 60 variants
(150 to 180 leaderboard groups). Multi-runtime vectors (6/6 runtimes, standard fingerprint `a8be9d5f...`, memory
fingerprint `e11e8733...`), workspace types (0 errors/0 warnings), unit tests (46/46), real-D1 integration suite (15/15),
and Playwright Chromium admin suite (3/3 at one worker) pass. Full `bun run verify` remains deferred; unauditioned
audio and editor exclusions preserved. No production deployment authorized.
See `docs/briefs/v1.3.5.12-batch-e-brief.md` and `docs/work/V1.3.5.12_WORK.md`.

## Earlier local status — v1.3.5.11 Batch D locally implemented & verified (2026-11-07)

Following the owner's review and instruction “got them. i reviewd it and find useful , you can start the implementation”,
the 10 genuine Memory distributed cloud & edge architecture rulesets (Workers KV eventual consistency, Durable Object
actor row mutex, Vectorize KNN semantic similarity clustering, Cloudflare Queues FIFO batch & DLQ, Workers AI 120-token context window
budget, Hyperdrive connection pooling, Turnstile managed challenge human verification, Zero Trust RBAC tiered clearance, Argo smart routing
dynamic quadrant reroute, and Cloudflare R2 Glacier cold archive) are locally implemented and verified under ponytail principles.
Total Memory catalogue expanded from 40 to 50 variants (120 to 150 leaderboard groups). Multi-runtime vectors (6/6 runtimes,
fingerprint `a8be9d5f...`), workspace types (0 errors/0 warnings), unit tests (45/45), real-D1 integration suite (15/15), and Playwright
Chromium admin suite (3/3 at one worker) pass. Full `bun run verify` remains deferred; unauditioned audio and editor exclusions preserved.
Ready for owner functional review; no auto-commit or push performed. See `docs/briefs/v1.3.5.11-batch-d-brief.md` and `docs/work/V1.3.5.11_WORK.md`.

## Earlier local status — v1.3.5.10 Batch C accepted and committed (2026-11-07)

The owner authorized and accepted the 10 genuine Memory network and cybernetic protocol rulesets (Edge
cache ghost imprint, Quantum entangle twin node, 429 rate limiter cooldown backoff, Data buffer register, ICE
firewall barrier unblock, Anycast perimeter re-route shift, 3-way TLS cryptographic handshake, Security trace
quarantine lockdown, Bit-rot data transposition, and Packet burst uplink flash). Committed to main (`86b813e`).
Total Memory catalogue expanded to 40 variants (120 leaderboard groups).

## Earlier local status — v1.3.5.9 Batch B accepted and committed (2026-11-07)

The owner reviewed and authorized local implementation of the 10 genuine Memory exploration rulesets (Superstorm thermal
hazard, Sentinel wanted level, Atlas glyph sequential matching, Analysis visor spectral backs, Exosuit life
support power drain, Warp jump diagonal anomaly shift, Gravitino risk gamble, Pulse drive speed multiplier,
Derelict freighter fog of war, and Atlas 16/16 loop). All 10 rulesets were implemented end-to-end under ponytail
principles with multi-runtime vectors, unit tests, real D1 integration, and Playwright Chromium admin suite passing.
Committed to main (`6e56989`). Total Memory catalogue expanded from 20 to 30 variants (90 leaderboard groups).

## Earlier local status — v1.3.5.8 Batch A accepted locally and committed (2026-11-07)

The owner reviewed and approved the 10 genuine Memory ruleset variants (Countdown timer, Three strikes survival,
Wild card, Sonar reveal, Zebra bicolor constraint, Row drift, Seen card decay, Single-flip continuity,
Streak multiplier combo, and Hazard trap card) and directed: “done approved you now comit”. All 10
rulesets are implemented end-to-end under ponytail principles with multi-runtime vectors (6/6 runtimes,
fingerprint `e11e8733...`), workspace types (0 errors/warnings), unit tests (20/20), real D1 integration (15/15),
and Playwright Chromium admin suite (3/3) passing. Total Memory catalogue is now 20 variants. Full `bun run verify`
remains deferred; unauditioned audio and editor exclusions preserved. No deployment authorized. Preserve C1–C10.

## Earlier local status — .7 directory accepted locally and pushed to GitHub (2026-11-07)

The owner approved the completed Tier 2 Memory directory and authorized committing and pushing
to GitHub (`db18127 Accept v1.3.5.7 Memory Tier 2 directory, Tier 1 policy and pilot variants`).
Scoped format, lint, type checks, real-D1 integration suite (15/15), and Playwright Chromium suite
(3/3 at single worker) passed. Ten Memory variants remain the accepted catalogue.

## Earlier local status — .6 policy implemented (2026-11-07)

## Earlier local status — v1.3.5.4 Memory identity accepted (2026-11-07)

The owner selected local .4 implementation with “ok do it”. Existing-four issued
identity now gates ranked checkpoint recovery at both initial selection and
lease refresh; malformed historical active identities remain non-resumable with
explicit takeover rather than rewritten defaults. After an initial `bun run check`
failure in a pre-existing .2 admin initializer, the owner separately approved its
four-field default fix. Scoped Prettier/ESLint, `bun run check` (0 errors/warnings),
Memory units (15/15), real D1 (10/10), Memory-only six-runtime vectors and focused
Chromium recovery cases passed. See [selected .4 brief](docs/briefs/v1.3.5.4-identity-brief.md)
and [work/evidence](docs/work/V1.3.5.4_WORK.md). No new variant, UI or schema was
introduced; the accepted playable Memory catalogue remains four. The owner
subsequently accepted .4 as recorded above. Full `bun run verify` is still
deferred, not passed or waived. The earlier .4 handoff alone did not authorize .5,
a new commit/push, deployment or production change. Preserve the unauditioned-audio and unrelated
palette/editor/MCP exclusions.

## Earlier local status — v1.3.5.3 Memory design approved (2026-11-07)

The owner directed finishing .3 decisions and visual review before implementation,
then explicitly approved the [six-rule decision package](docs/briefs/v1.3.5.3-memory-matrix-brief.md)
and separately approved the [fixture-only visual reference](static/demo/v1.3.5.3-memory.html)
at 390×844, 844×390 and 1280×800 (including six-group Quads and Budget run-over).
Only the four existing Memory variants remain implemented and accepted; the six
new IDs are approved **design candidates**. Focused local Chromium fixture checks
passed after correcting a 24-card landscape overflow; no app, D1, vectors,
real-device or new functional checks ran. See [work/evidence](docs/work/V1.3.5.3_WORK.md).
Full verification remains deferred, not waived or passed. No .4/.5 app work,
new commit/push, deployment or production change is authorized by this .3 approval;
wait for a separate selection. Existing .2 acceptance and its source-only handoff
remain historical and do not authorize a .3 handoff.

## Earlier local status — v1.3.5.2 accepted locally, source-only GitHub handoff authorized (2026-11-07)

The owner said “update the git repo and push to github”, accepting the completed
[v1.3.5.2 bounded loading and pagination](docs/briefs/v1.3.5.2-bounded-games-brief.md) locally
and authorizing this source-only commit/push to existing `origin/main`. This closes
the implementation-review gate and supersedes earlier .2 push restrictions only
for this handoff. Existing scoped format/lint, Vitest (9/9), Vitest Slice 3 (8/8),
and Playwright Chromium suites at all three sizes remain the evidence; no new
tests or device/browser details were supplied. All roadmap C1–C10 limits apply.
Full verify stays deferred, not passed or waived. Preserve unauditioned audio and
unrelated local editor/MCP settings and palette timing changes outside the handoff.
No .3 selection, future push, deployment, or production change is authorized.
Execution/evidence: [work record](docs/work/V1.3.5.2_WORK.md).

## Earlier local status — v1.3.5.1 Games extraction accepted (2026-11-07)

The owner said “ok mark this accepted and push to github”, accepting the completed
[v1.3.5.1 extraction](docs/briefs/v1.3.5.1-games-extraction-brief.md) locally and
authorizing this source-only commit/push to existing `origin/main`. This closes
the implementation-review gate and supersedes earlier .1 push restrictions only
for this handoff. Existing scoped format/lint/types, four D1 cases, two Chromium
cases and unchanged-UI comparisons at all three sizes remain the evidence; no new
tests or device/browser details were supplied. All roadmap C1–C10 limits apply.
Full verify stays deferred, not passed or waived. Preserve unauditioned audio and
unrelated local editor/MCP settings and palette timing changes outside the handoff.
No new variants, .2 selection, future push, deployment or production change is
authorized. Execution/acceptance: [work record](docs/work/V1.3.5.1_WORK.md).

## Earlier local baseline — v1.3.4 Slice 0 admin/query (2026-11-06)

The owner authorized completing the reviewed Games admin/query gaps locally.
Scope: single-bind activity mapping, exact-count regression coverage, responsive
variant rows, accessible inspection drawer, message/token cleanup and scoped
verification. Mahjong is explicitly excluded and belongs to later plans. Existing
Mahjong proposals below are future reference, not this slice's implementation plan.
Full `bun run verify` remains deferred under the existing owner decision. No commit,
push, deployment, production change or next feature is authorized by this task.
Local implementation and targeted verification are complete; owner visual
acceptance remains separate. Scoped lint/format/types, 8 focused D1 tests and six
unique Chromium cases pass across retained runs. The separate broader Support
quota timeout remains recorded; this is not a full verification pass.
Closeout: [Slice 0 work record](docs/work/V1.3.4_SLICE0_WORK.md).

## Future planning — proposed Mahjong Solitaire (2026-11-05)

Member Support v1.3.3 is accepted locally. The next candidate is Mahjong
Solitaire with Turtle (144), Quick (56) and Fortress (144) layouts. The plan and
puzzle brief are drafts; owner decisions and implementation authorization remain
pending. See [v1.3.4 plan](docs/planning/V1.3.4_MAHJONG.md) and [draft puzzle
brief](docs/puzzles/mahjong-solitaire.md). No deployment is authorized.

## Current local status — 2026-11-05

The owner explicitly accepted the existing local v1.3.2 Connect variants,
admin scoring/pagination and profile polish. This supersedes the brief's
pending-review status. Automated verification results and device/browser
details were not supplied; no test-pass claim or verification waiver is made.
No commit, push, deployment, production change or next implementation is
authorized. See [the v1.3.2 brief](docs/briefs/morphi-v1.3.2-codex-brief.md)
and `docs/PHASE_REPORTS.md`. The separate v1.3.1 sound-audition gate is unchanged.

## Current local status — 2026-11-01

The owner accepted all three next-phase slices and quick-review changes, closing
the local work. They reported all checks passed after reviewing on their own PC
and checking mobile layouts in browser responsive emulation without noting
corrections. Browser/device models were not supplied; physical mobile review was
not reported. This supersedes earlier pending-review and next-phase notes below.
No deployment, production release or further implementation is authorized. See
[the combined review](docs/reviews/NEXT_PHASE_REVIEW.md) and `docs/PHASE_REPORTS.md`.

## Owner-authorized v1.1 — 2026-10-26

The owner authorized the local [v1.1 brief](docs/morphi-v1.1-handoff-2026-10-26/CODEX-BRIEF.md)
and its adjacent scope. Work order: procedural themes → UI/UX and The Card →
Connect → operator scoring configuration → public-door withdrawal/explainers.
This supersedes the v1 curated-only theme, two-game and door decisions within
that scope. Stop for the required theme taste/visual review; do not infer
deployment or production-operation approval. Share links and admin game-test
routes remain excluded. Status and evidence: [V1.1_WORK.md](docs/work/V1.1_WORK.md).

During this slice the owner supplied the 1920×923 small-board screenshot and
explicitly requested the planned viewport-sizing fix, then directed continuation.
That bounded Work 2 shell/sizing follow-up is included while theme/Card/overall
visual acceptance remains open; it is not a deployment or acceptance decision.

On 2026-10-27 the owner approved the theme contact sheet and authorized starting
Work 2. Puzzle backdrops must contain only current-puzzle objects, including
future games; mixed-game decoration is Home-only. Prepare the next solo puzzle
while the current entrance plays, with bounded loading/failure/navigation
fallbacks and no speculative ranked reservation. The Card's Memory/Block proofs
and phone played-stack placement remain the next visual review gate.
Owner update (2026-10-28): hide puzzle backdrop objects on compact/mobile
layouts; wider layouts get a seeded random 1–5 own objects per side, keeping
the approved blend. New Cards enter from fresh random positions, including
on Next, settle at the centre and unfold there; finishing folds into the played
stack. Backdrop positions scatter across both dimensions of exposed space,
without fixed columns/rows. Only the large result score scrambles; other result
text stays static.

Owner update (2026-10-28): animations are approved and actual local Card
integration is authorized. Preserve real game entrances, authoritative timing,
account/save behavior and failure recovery. The animation-demo gate is closed;
the rest of Work 2 and real-app device review remain separate.

Owner update (2026-10-29): the Card UI/UX progression gate is closed and local
Connect Work 3 is authorized. Generate its own game-related action sounds with
ElevenLabs. The owner corrected Connect's objective: all pairs connected ends
the round; full-grid coverage is an optional score bonus. This supersedes the
handoff brief's fill-to-win wording. Fix the reported symbol centring and
pre-entrance board visibility. Connect real-device visual/audio review remains
open; no Work 4 or deployment is inferred.

Owner update (2026-10-29): the owner reviewed Connect locally on their own PC
and accepted Work 3. No phone or public-release acceptance is recorded. The
next numbered item is Work 4, operator per-game scoring configuration; this
acceptance does not start Work 4 or authorize deployment.

## Owner integration authorization — 2026-10-25

The owner accepted the v1 preview and authorized integration into the actual
local app. This supersedes earlier demo-only/review-pending restrictions.
Include per-puzzle entrances through the anime.js motion wrapper: Memory
6/8/10 pairs arrive over 3/4/5 seconds face up, then a full 3-second preview,
then hide before the timer/input start. Block uses the same entrance language.
Generate original action sounds with the installed ElevenLabs SDK. Compare
actual screens with the accepted demo at the required sizes. Profile XP and
achievements are future fixtures and must not ship as real v1 data. Production
resources, credentials, D5 eligibility and every deployment remain separate.

This is the short plan. It replaces the long plan for day-to-day work. The long plan (`docs/PLAN.md`) stays as reference. If a step below needs something from it, pull only that part in.

Current status (2026-10-24): Step 4 accepted; Step 5 accepted by the owner based on the public-test result (45+ players, over 60% positive feedback). The owner accepts proceeding without the missing replay counts and predetermined threshold; the measured replay-rate criterion is waived, not recorded as a pass. Step 6 implementation is authorized: Google sign-in and all five account-screen designs are approved. The owner subsequently confirmed local Google OAuth works and authorized completing Step 6 locally, including the small per-puzzle structural cleanup. Local progress/ranked/leaderboard implementation and verification are tracked in `docs/work/STEP6_WORK.md`. The owner completed the PC/mobile functional review and explicitly accepted the local Step 6 build on 2026-10-24 (`docs/reviews/STEP6_REVIEW.md`); production resource/operating evidence remains open. Global-release planning, including an admin panel proposal, follows local acceptance. See `docs/planning/STEP6.md`. Acceptance and feedback are recorded in `docs/PHASE_REPORTS.md`.

## Owner-authorized local privacy preparation (2026-10-23)

The owner requested a privacy page before public Google OAuth verification and the later v1 launch. Implement the page locally using the long plan's content-page template; admin editing of privacy/terms/other static pages remains the later Stage 5 content-management scope. Operator/contact: Ali Gohar, cngohar@gmail.com. On 2026-10-24 the owner clarified a general-audience puzzle site, with no child-focused content, design, or marketing and no separate kids site planned. This supersedes the earlier audience-includes-under-13s interpretation. Child accounts remain deferred. The owner approved the wording and authorized finishing practical readiness on 2026-10-24. Retention inventory, the owner-monitored contact/request procedure, and protected local cleanup/privacy deletion are prepared; the public copy has no internal draft notes. A separate assets-only guest publication candidate is prepared for review and deployment authorization. Public account eligibility and production operator/retention operations remain v1 gates. See `docs/privacy/PRIVACY_REVIEW.md`. Privacy preparation did not itself close Step 6 acceptance; the subsequent owner-completed review records local functional acceptance separately. Neither authorizes public provisioning, publication, or deployment.

## Owner-authorized publication follow-up (2026-10-24)

The owner explicitly approved publishing the prepared guest homepage/privacy update and confirms Search Console/domain ownership is already verified. Initial public version was `44a5846f-95d6-43d5-b61e-c7f478b6e857`; the subsequently owner-requested analytics disclosure is published as `b50a7a18-2e85-4406-bd40-77f27c4b3da3` with all seven live verification groups passing. Live checks found Cloudflare’s automatic Web Analytics injection; the owner explicitly chose to keep it and requested the privacy disclosure update, intentional-beacon release note and live recheck. The beacon is absent from build assets by design, and this does not authorize GA4 or a new analytics pipeline. Current deployment versions/evidence are in `docs/PHASE_REPORTS.md`; Google project setup/submission stays owner-controlled. Account/global-release operations and admin-panel planning remain separate.

## Owner-requested v1 release planning (2026-10-24)

The owner requested the v1 plan after local Step 6 acceptance and guest/privacy publication. [docs/planning/V1_RELEASE_PLAN.md](docs/planning/V1_RELEASE_PLAN.md) proposes the production account rollout, operating/resource checks, a small Stage 1 admin panel and an optional repository-managed terms page. This simple plan remains authoritative; the proposal does not promote the parked features into implementation. The owner reports production Google setup complete and supplied a private credential-file location; credential validation, actual branding/audience state and live OAuth behavior are not verified by the planning task. No credential is installed and no backend is deployed. Next is agreement on the release contract/local preparation; admin/terms implementation, provisioning and every deployment still require their applicable approval.

## Owner-authorized v1 implementation and visual review (2026-10-24)

The owner supplied the consolidated v2 checklist and authorized starting local
v1 implementation. [docs/planning/V1_RELEASE_CHECKLIST.md](docs/planning/V1_RELEASE_CHECKLIST.md)
records the active handoff and subsequent decisions; the old v1 proposal is
historical. Stage 1 admin, SEO search-entry pages and removal of Block-first
are promoted into v1. Dashboard plus anonymous gameplay events, Terms
preparation, and deferring procedural themes are approved. Proposed 18+
account wording is approved for the demo only; account launch jurisdictions
remain a specific legal-review question owned by Ali Gohar. The owner requested
an interactive demo instead of wireframes; layouts/content await review before
screen integration. No production provisioning or future deployment is approved.

## Oct 25 design-package demo update

The owner accepted the [design package](docs/morphi-design-package-2026-10-25/morphi-design-handoff-2026-10-25.md)
and authorized applying it to the v1 demo only, then running verification and
stopping for visual review. It supersedes earlier design choices (including
door navigation/dimmed columns); the v2 rollout/release gates remain in force.
The owner subsequently accepted this demo and authorized actual local
integration (Oct 25). Deployment, production XP/achievements and a final D5
eligibility/jurisdiction decision remain outside that authorization. See `docs/DECISIONS.md`.

## The goal

Make one small puzzle game that people enjoy on a phone. Then decide what comes next based on whether they enjoy it.

The site has one Play button. Each press gives a new puzzle made from a random seed, so repeat plays feel different.

## Order of work

Game first. Architecture second. Accounts and payments last.

Only do the step you are on. Check it before moving on.

## Step 1: Memory

Build a complete, playable Memory game (about 1 to 2 weeks).

- A grid of face-down cards. Tap one to flip it, tap a second to try a match.
- Matches stay face up. Mismatches flip back after about 0.6 seconds.
- Clear all pairs to win.
- Round size changes with each Play: 6, 8, or 10 pairs. Bigger rounds are harder.
- Score starts at 1,000 per pair, minus 150 per mismatch and minus 5 per second. Never below zero. These are starting values to tune by playtest.
- Three sounds (flip, match, mismatch) and one win moment: a short burst of shapes, under one second.
- Three screens only: Home (title and Play), Game (grid, score, timer), and Result (score, best score, one big Next puzzle button).
- Runs in a phone browser in portrait and in a desktop browser. Local only. Best score is saved in the browser.

Done when you can play 20 rounds on a phone without a bug, and the win moment makes you want the next one.

## Step 2: Playtest

Give the phone build to five people who have not seen it. Say only "tap Play." Watch them and take notes. Ask three things afterwards:

1. Did you finish a round?
2. Did you press Next?
3. Would you play again tomorrow?

If most of them press Next, go to Step 3. If they quit early or ask what to do, fix the feel first: faster feedback, clearer flips, a stronger win moment. Do not add features. Test again with five new people.

## Step 3: Block puzzle

Build the second game (about 1 to 2 weeks). Place pieces on a grid. Clear full lines to score. The run ends when no piece in the tray fits. It uses the same Home, Game, and Result screens and the same feedback style as Memory.

Playtest it with five new people, the same way as Step 2. Keep the game more people replay as the main game. The other one stays in the code but is not in the menu for now.

## Step 4: Make the winner feel like a game (about 2 to 4 weeks)

- Three or four fixed color themes. The seed picks one. No randomly generated colors yet.
- Every tap answers within 100 ms: a flip, a pop, a shake, or a sound.
- One signature moment that people remember, such as a reveal, a combo, or a line clear. Pick one and make it great.
- Game words in the small HUD: round number, streak, best.
- A one-line hint on the first round only, then never again.
- Owner addition (2026-10-20): Play and Next rotate the games. Block comes first, then Memory, then Block, and the same game never comes twice in a row.
- Owner addition (2026-10-20): Memory gets the same four themes. The seed picks one and changes the backdrop, cards, and symbols. The simple plan did not include Memory theme randomization, but the long plan does, and the owner wants both games complete before public testing.

## Step 5: Public test (about 1 week)

- Deploy the static build to any static host. The Cloudflare setup in the long plan works, but it is not needed yet.
- Page title, one-sentence description, and one `<h1>` on Home.
- Analytics only if it is simple to set up. Two events: round started and Next pressed. No personal data.
- Share the link with about 50 people.

Done when a clear share of the people who started a round also started a second one. Decide what "clear" means before you look at the numbers.

## Step 6: Accounts and leaderboards (only if Step 5 works)

Only now: sign-in, progress across devices, and a leaderboard. Scores must be checked on the server, because local scores can be edited. The anti-cheat section of the long plan starts to matter here, and not before.

The owner accepted Step 5 on 2026-10-23. The proposed Step 6 sequence and decisions needed before implementation are in `docs/planning/STEP6.md`; the full platform phase is not added wholesale to this step.

## Look and feel

- Flat shapes, big type, and bright colors on a light background. No gradients, no glow, no drop shadows on game pieces.
- Minimal means few things on screen, not empty. The board is the art.
- Feel comes from motion and sound. Keep motion short (under 300 ms) and respect the reduced-motion setting. Owner override (2026-10-20): the block-placement line clear may run 1500 ms.
- Menus stay small and out of the way. The first screen is a title and one Play button.
- Use the light palette from section 11.1a of the long plan so text stays readable. Do not invent new colors.
- Icons are simple inline shapes. No emoji.

## Rules for whoever builds it

1. Work on one step at a time.
2. If a task is not in this file, ask first.
3. Keep the game rules separate from drawing, so the rules can be tested without a browser.
4. Each round is made from a seed number, so any round can be recreated.
5. Keep all visible text in one place, so translations are easy to add later.
6. Test on a real phone at every step.

## Stack

SvelteKit with Svelte 5 and TypeScript, as already chosen. Skip the multi-browser test setup, the CI pipeline, and the Cloudflare Worker setup until Step 5.

## Parked

Not for now. Each of these is designed in the long plan and stays there until players ask for it.

- Multiplayer
- Payments and subscriptions
- Admin panel
- Physics puzzles
- Translations and right-to-left layout
- Dark theme
- Achievements, levels, and XP
- Daily challenge and share links
- Server-side scoring and anti-cheat (until leaderboards exist)
- Durable Objects, D1 sharding, seed banks, analytics pipeline, and audit logs
- Puzzle types beyond the first two
