# PHASE_REPORTS.md

One report per phase, newest first. Use the template below (the same one in `AGENTS.md`).

## Template

- **Built:**
- **Skipped (and why):**
- **Known issues:**
- **Decisions and pinned versions:**
- **Questions for the owner:**
- **Evidence table:** each acceptance item with its evidence type, where the evidence lives, and the result (pass, fail, or waived with the owner's recorded exception)
- **Measurements:** per performance target: device class, network profile, cold or preloaded load, number of runs, median and p95, and gate or goal
- **Waivers:** each waived item, the owner's recorded exception, and the risk
- **Owner responsibilities:** what only the owner can do next
- **CODEMAP updated:** yes / no

## Reports

## v1.1 Work 3: Connect local integration — 2026-10-29

- **Built:** Added Connect as the third Mix family behind the generated puzzle
  registry. Its deterministic 5×5, 6×6 and 7×7 bands use orthogonal stroke
  replay, path cutting and redraw penalties. The server computes ranked scores
  from issued sessions; client scores are never submitted. The accepted Card
  opens into Connect's 2.5 s entrance, then its own board, HUD, help, result,
  session stack, account save and Next. Procedural symbols/colors and a
  Connect-only dot-path backdrop cover the three layout sizes. Nine original
  ElevenLabs game cues were generated offline, one per action, with distinct
  hashes in `static/audio/manifest.json` and no runtime provider call.
- **Owner correction:** Connecting all pairs is the finish condition. Empty
  cells do not block the result; filling the full grid at completion earns an
  optional 1,000-point bonus. This supersedes the earlier brief. Corrected the
  reported off-centre symbols and visible-before-entrance board, then added
  first-frame and centring browser checks. The result now shows fill percentage;
  Connect's phone result spacing keeps the played stack clear of save text.
- **Skipped (and why):** No `/connect` door, share link, score editor, Work 4,
  deployment, production resource or secret change. These are outside Work 3.
- **Known issues:** The owner accepted Connect after a local PC review; phone
  gesture, motion and audio checks were not reported. Headless browsers
  do not establish real-phone smoothness. The initial full browser run had one
  WebKit Block-backdrop failure: bounds were measured against the Card's
  transient narrow frame. Bounds now recalculate when the backdrop becomes
  visible; the affected case passed three WebKit repeats and a cross-browser
  recheck. A single post-fix full-suite rerun was not performed.
- **Decisions and pinned versions:** `connect-1` remains the pre-acceptance
  local rules version; no Connect rules have been deployed. Full-grid bonus is
  checked only on the winning move. TypeScript `~6.0.3`, anime.js `4.5.0`,
  ElevenLabs SDK `2.74.0`, theme config `theme-2026-10-26-1`, and generator
  `oklch-machado-1` remain pinned. See `docs/DECISIONS.md`.
- **Questions for the owner:** None for Work 3. Work 4 is the next numbered item.
- **Evidence table:**

| Acceptance item                                                 | Evidence type and location                                                     | Result                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic bands, valid routes, cut/redraw and pair-only win | `src/lib/puzzles/connect/logic.test.ts`, `tests/vectors/connect*.json`         | 1,200 witnesses and 5 Connect units pass; 9 vectors match in six runtimes                                                                                                                                                                |
| Authoritative ranked and pair-only saved replay                 | `tests/integration/runs.test.ts`; built Worker smoke                           | 25 D1/auth tests and 15 built-Worker checks pass                                                                                                                                                                                         |
| Card entrance before visible board; centred symbols             | `tests/e2e/connect.spec.ts` first-frame samples and SVG geometry               | pass in Chromium, Firefox and WebKit                                                                                                                                                                                                     |
| Phone/landscape/desktop fit, family-only backdrop and result    | Browser layout checks and [review captures](evidence/v1.1-connect/README.md)   | Connect passed in all three engines; Block wide-backdrop recheck passed after fix                                                                                                                                                        |
| Unique game-related action sounds and mute                      | `static/audio/manifest.json`, nine MP3 hashes, browser request test            | nine distinct hash-verified assets; browser request/mute tests pass in three engines                                                                                                                                                     |
| Format, type, boundaries, palette safety and full regressions   | `bun run verify` stages; `build/v1.1-connect/e2e-final.log`; focused follow-up | lint/check/boundaries, 30,000 palettes, 122 units, 25 D1/auth, 9 six-runtime vectors and 15 Worker checks pass; browser run 155/156 before the final backdrop fix, then 3/3 WebKit repeats and 3/3 cross-browser wide-layout checks pass |
| Local Connect visual/audio acceptance                           | Owner review, 2026-10-29                                                       | accepted after checking locally on own PC; phone/public checks not claimed                                                                                                                                                               |

- **Measurements:** The 2,500 ms Connect entrance is a configured animation
  and input deadline, not a measured device frame-rate result. Browser layout
  evidence uses unthrottled localhost and fresh navigation with round
  preparation overlapping the Card on headless Chromium/Firefox/WebKit at
  390×844, 844×390 and 1920×923; each case runs once in the suite, with three
  repeated WebKit checks for the corrected wide Block backdrop. Median/p95
  frame-time measurements are not available. Real-device smoothness is
  an owner review gate; the owner accepted the local PC build without a
  reported phone measurement. No performance waiver or phone result is inferred.
- **Waivers:** None.
- **Owner responsibilities:** Local Connect acceptance is complete. Decide when
  to start Work 4; authorize any later production action separately.
- **CODEMAP updated:** Yes, `docs/CODEMAP.md` includes Connect and its tests.
- **Owner acceptance:** Work 3 closed on 2026-10-29. The owner explicitly
  accepted Connect after local review on their own PC. No phone check or public
  deployment is implied.

## v1.1 popup dismissal correction and owner review — 2026-10-28

- **Built:** The popup exit animation's temporary viewport-sized layer now has
  a transparent background. Its inherited site background previously covered
  the game until the 500ms exit completed. Both help buttons retain their
  dismissal, focus and motion behavior.
- **Owner review:** The owner reported phone and desktop passed and accepted
  the other reviewed behavior; device/browser models were not supplied. The
  remaining Home/profile UI pass is separate from this Card-flow review.
- **Evidence:** Normal-motion help dismissal regression covers both buttons,
  verifies the game remains visible and the exit layer is transparent, and
  checks cleanup. Existing backdrop, inside-click, Escape and focus tests run
  alongside it. Type checking and targeted lint are recorded in `build/popup-*.log`.
- **Skipped / limitations:** No deployment or new game work. Physical-device
  verification of this specific correction remains with the owner.
- **Next:** Finish the remaining Work 2 UI/UX visual pass, then Connect in the
  numbered handoff. No new version pins or waivers. CODEMAP remains current.

## v1.1 actual Card integration — 2026-10-28

- **Built:** The owner approved the reviewed animations and authorized local
  app integration. `/play` now uses one persistent app-owned Card frame around
  the real registry game view: fresh random entry, centre, flip/name, unfold,
  then the game's own entrance. Memory keeps its 3/4/5-second entrance, full
  three-second preview and hide before input/timing. Completion is queued before
  win/fold motion. Finished rounds file into a session stack (eight visible
  cards plus total count), followed by the actual result with a single 420ms
  fade/rise and 500ms scramble of only the large score. Next retains the 350ms
  exit, including early activation. Real account/save/sync controls remain.
  Preparation overlaps motion; failed Next restores the finished result and
  retains the pending selector family. Unmount cancels waits/preparation;
  hidden tabs pause presentation deadlines. Responsive frame measurement waits
  for the game's media-query update and suppresses CSS size transitions, which
  otherwise returned stale widths in Firefox/WebKit under reduced motion.
- **Skipped (and why):** Remaining Work 2 Home/profile/overall visual review,
  real-device acceptance, Connect, score editor and public-door withdrawal
  belong to later work in the numbered handoff. No production changes or
  deployment. No XP/achievement fixtures or new dependencies.
- **Known issues:** Headless viewport checks cannot establish physical-device
  smoothness. Existing procedural-theme freshness limits and production gates
  remain. The owner accepted the demo animations; this report does not accept
  the integrated app's full visual pass or complete v1.1.
- **Decisions and pinned versions:** Shared typed element-based presentation
  in the existing anime.js 4.5.0 wrapper; app stage/layout and engine remain
  separate from the isolated reference demo. Logical readiness uses fixed
  visible-time deadlines, never animation callbacks. Ranked issuance follows
  the neutral deal, with a server-owned 1200ms flip/unfold allowance in local
  migration `0007`; legacy sessions default to zero. Replay wire/engine versions
  are unchanged. TypeScript `~6.0.3` and Wrangler `4.151.3` remain pinned. See
  `DECISIONS.md` for the D1 references and timing rationale.
- **Questions for the owner:** No implementation clarification is required.
  Real-app desktop/phone review and the remaining Work 2 visual pass are open.
- **Evidence table:**

| Acceptance item                                                                                        | Evidence type and location                                                                          | Result                                                          |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Integrate the accepted animation flow                                                                  | Owner authorization in `AGENTS.md`; actual `/play`; [captures](evidence/v1.1-integration/README.md) | implemented locally; device review separate                     |
| One continuous centred frame, real Memory completion, result, Next and stack                           | Normal-motion browser frame samples/screenshots; `tests/e2e/app-card.spec.ts`                       | see [verification](evidence/v1.1-integration/verification.json) |
| Result arrives once; only large score scrambles; accepted exit                                         | Actual-result opacity samples plus shared `card.spec.ts` entrance/early-Next checks                 | see verification                                                |
| Phone/landscape/desktop fit and resizing without restarting                                            | Four real-flow sizes in Chromium/Firefox/WebKit; 10-pair resize regression                          | see verification                                                |
| Own-family scatter, mobile hiding and desktop 1–5 per side                                             | `themes.spec.ts`, backdrop property tests and captures                                              | see verification                                                |
| Preparation failure retains result/family; duplicate Next commits once                                 | `preparation.spec.ts`, real lifecycle duplicate activation, preparation unit tests                  | see verification                                                |
| Durable completion and real accounts/save/retry remain                                                 | Account browser regressions and local D1/auth integration                                           | see verification                                                |
| Ranked timing remains authoritative and legacy-compatible                                              | `tests/integration/runs.test.ts`: equal real play time, legacy default, rejected client allowance   | pass: targeted 23-test integration run                          |
| Format/lint, zero-warning type check, purity, palettes, units, vectors, built Worker and browser suite | `bun run verify`; summary and full local log linked in evidence                                     | see verification                                                |
| Full Work 2 visual and real-device acceptance                                                          | Owner review of integrated app                                                                      | pending; no waiver                                              |
| CODEMAP                                                                                                | `docs/CODEMAP.md` stage/layout/game gate/migration/test entries                                     | updated                                                         |

- **Measurements:** The accepted Card budgets are 650ms entry, 400ms flip,
  800ms unfold, 900ms fold/file, 420ms result entrance, 500ms score scramble
  and 350ms exit. These are configured presentation budgets, not measured
  device frame rates. Local preloaded Next diagnostics use headless desktop
  Chromium, 1280×720, unthrottled localhost and reduced motion, five runs;
  median 36.1ms and p95 52ms. Raw samples are in
  [preparation measurements](evidence/v1.1-integration/preparation-measurements.json).
  The metric ends at next-round DOM, before the game's entrance/preview; reduced
  motion skips solo Card waits. It is a diagnostic goal only. Cold phone/4G,
  physical-device frame-rate and production measurements were not taken and
  are not waived or claimed as release evidence.
- **Waivers:** None added. Earlier owner approvals/recorded exceptions remain
  historical; the demo-animation gate is closed by explicit approval.
  Required checks are recorded across the full verification pipeline and
  focused browser rechecks: older startup/score/error-copy probes needed the
  integrated flow's readiness conditions. A desktop cleanup artifact collision
  from parallel test runs was rechecked with an isolated output directory.
  The evidence summary preserves the first-run failures and recheck results.
  All 131 browser cases have passing evidence across those runs; the initial
  full command ended with 119 passes and 12 failures, rather than a clean exit.
- **Owner responsibilities:** Review `/play` on desktop and a real phone,
  including finish/result/Next, rotation and stack placement. Overall Work 2
  visual acceptance and production authorization remain separate.
- **CODEMAP updated:** yes.

## v1.1 desktop Card/scatter correction and result entrance — 2026-10-28

- **Built:** Reproduced the owner's Chrome/Firefox report with screenshots.
  Random entry transforms were retained by later board animations, moving
  unfolding and folding away from the centre. Each phase now explicitly resets
  translation, rotation and scale. Entry alone is random; the Card settles and
  unfolds at the centre, then retains the game's own arrival. Finish shrinks
  at the centre and files into the actual played stack, matching its slot's
  rotation. Backdrop adapter `own-items-4` draws independent x/y positions
  across measured exposed background widths, replacing narrow columns and
  regular rows. Keep 1–5 objects per side, mobile hiding, approved blend,
  current-family isolation and 20% opacity. Resize/theme replacement updates
  bounds without touching game state. The owner subsequently accepted Next
  and requested a result entrance: one 420ms fade/rise of the panel, with only
  the large number scrambling for 500ms. Labels/high score/stat contents stay
  unchanged. Early Next preserves the current opacity/position before the
  accepted 350ms exit, avoiding a reset flash. Reduced motion settles directly.
- **Skipped (and why):** Actual Card integration still awaits the required
  proof/phone-stack verdict. No new game, score logic, account change or
  production action is included.
- **Known issues:** The earlier passing identity/monotonic-size probes did not
  check centre coordinates or stack landing and missed this defect. The new
  geometry probe covers those positions across three consecutive rounds/Next.
  Clock-controlled screenshots are geometry evidence, not device smoothness
  acceptance. Prior freshness and production/device limits remain.
- **Decisions:** Keep anime.js 4.5.0 and all game/theme snapshot versions.
  Reset every animated board transform channel explicitly between phases.
  Cosmetic scatter counts and x/y remain seeded; the DOM adapter measures only
  available space. See `DECISIONS.md` for the installed source/official docs.
- **Questions for the owner:** Review the updated concrete Card/phone-stack
  proof; overall visual acceptance remains open.
- **Evidence table:**

| Acceptance item                                                                      | Evidence                                                                                            | Result                                                          |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Random entry to centre, centred unfolding, fixed stack landing over three rounds     | `card.spec.ts`, [Chrome samples](evidence/v1.1-card/review-fix/centred-transitions-chrome.json)     | pass: Google Chrome, Chromium, Firefox, WebKit                  |
| Two-dimensional scatter and visible objects in Chrome/Firefox                        | [live screenshots](evidence/v1.1-card/review-fix/README.md), backdrop property test                 | live capture/property pass                                      |
| Mobile hiding, both puzzle families, wide/compact layouts and existing Card controls | targeted `card.spec.ts` / `themes.spec.ts` browser run                                              | pass: 54 targeted browser checks                                |
| Result entrance once, score-only scramble, no early-Next flash and reduced motion    | [result evidence](evidence/v1.1-card/review-fix/README.md), `result-tests.log`, `chrome-result.log` | pass: nine three-engine checks plus two installed Chrome checks |
| Type/format/lint checks                                                              | `build/v1.1-card/review-fix/` logs                                                                  | type check: zero errors/warnings; targeted lint pass            |
| Owner visual acceptance                                                              | [local demo](http://localhost:5173/demo/card-proof.html)                                            | pending                                                         |

- **Measurements:** Desktop 1920×923, localhost unthrottled, normal-motion
  live captures in Chrome 155.0.8059.79 and Firefox. The regression samples
  three rounds per browser with a controlled clock; centre error must be <1px
  during flip/unfold/shrink and the nearing-stack centre error <12px. These
  are geometry gates, not median/p95 runtime or physical-device performance
  measurements. Prior five-run cached-Next diagnostics remain unchanged.
- **Waivers:** None added. The earlier full verification remains baseline
  evidence; it does not replace the new position checks.
- **Owner responsibilities:** Review desktop transitions and phone stack
  placement before actual Card integration.
- **CODEMAP updated:** yes, including `ui/backdrop-layout.ts` and the revised
  motion contract.

## v1.1 Work 2 — backdrop/preparation fixes and Card presentation proofs — 2026-10-27–28

- **Built:** Recorded contact-sheet approval and the owner's authorization to
  start Work 2. Made current-puzzle-only backdrops a standing project/future
  brief rule. Actual Memory backgrounds scatter cards; Block backgrounds draw
  actual piece definitions through the generated registry. Every round gets
  seeded scatter, including legacy blank layouts; 20% opacity, quiet contrast
  and header/bottom exclusions remain. Owner update on Oct 28 hides objects
  on compact/mobile layouts and limits wider layouts to a seeded random 1–5
  objects on each side. The approved background blend remains unchanged.
  A single next solo candidate prepares
  during the current entrance and is reused on Next. No selector draw/history
  commit or ranked reservation happens speculatively. Slow starts show a neutral
  loading card and native Home link; Worker/storage waits are bounded, failures
  retain the result/pending family, and navigation ignores late completion.
  New run/save metadata commits only with a successful start. The underlying
  result is inert during the loading overlay. Interactive Memory/Block Card
  proofs include reveal/unfold, fold/stack, Next, slow/fail-once and static
  controls. They use the shared motion wrapper and numeric absolute beats.
  Owner review then reported a duplicate-board pop. The revised proof expands
  one persistent frame before the existing per-game deal; Memory's six-pair
  sample keeps three seconds of random travel, three full seconds of preview
  and hiding before readiness. The result now shows score/high score, statistics
  and Next centrally after folding, with no lingering animation layer over it.
  The owner's subsequent desktop review requested a wider, animated result:
  score/statistics and waiting-card/Next now occupy two desktop columns, with
  compact phone and separate short-landscape profiles. The final owner revision
  uses one 500 ms scramble on the large earned-score number only, initialized
  before first paint,
  with final accessible text preserved. The owner accepted the 350 ms exit on
  Next; next-sample preparation starts during it. Each new Card enters from
  a fresh random viewport edge position/rotation, including Next; initial
  geometry is set before paint, with cosmetic entropy independent of puzzles.
  Duplicate activation, replay
  after visibility resume, cancellation and reduced motion are guarded.
  Headings, labels, high score, statistics and Next text stay static, as the
  owner clarified during review. Full local verification passed: 116 unit,
  22 integration and 110 browser checks, 20,000 palettes, six-runtime vectors
  and 15 built-Worker checks. Three additional browser checks cover unavailable
  Card entropy and preparation/static fallbacks.
- **Skipped (and why):** Actual Card integration awaits the specified
  Memory/Block proof and phone stack review in `THE-CARD-decision.md`: “proofs
  to be built the same way before Codex treats it as settled.” The complete
  Home/result/profile pass and actual phone-landscape title exception remain
  Work 2. No Connect, scoring editor, door withdrawal/explainers, share links,
  admin game-test route, production resource/secret/DNS/Google work or deployment.
- **Known issues:** Proof scenes are presentation samples, not playable games
  or saved scores. Sample Card timing is a design-review candidate; actual
  gameplay keeps its accepted entrance/preview/ranked allowances. The stack
  retains all sample rounds in memory and renders the latest eight cards plus
  the session count to bound DOM size. Freshness vocabulary limits and all
  prior production/device acceptance limits remain.
- **Decisions and pinned versions:** Presentation adapter `own-items-3` derives
  motifs from the resolved snapshot without rewriting approved palettes or
  changing score/RNG contracts. Keep anime.js 4.5.0, theme config
  `theme-2026-10-26-1`, generator `oklch-machado-1`, and existing engine versions.
  IndexedDB access has a 1.5 s deadline; generation retains its 5 s Worker
  deadline and deterministic fallback. Native Home navigation also works before
  hydration. Full decisions and the current Anime.js source are in `DECISIONS.md`.
- **Questions for the owner:** Review `/demo/card-proof.html`: Memory/Block
  Card transitions and the phone's bottom-left played stack. Open Preview for
  controls, finish each sample and press Next. These concrete proofs satisfy
  the required design-review deliverable; overall Work 2 acceptance is open.
- **Evidence table:**

| Acceptance item                                                                                      | Evidence type                                                             | Where                                                                                                                 | Result                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Theme-sheet taste gate                                                                               | Explicit owner approval, 2026-10-27                                       | `DECISIONS.md`, `V1.1_WORK.md`                                                                                        | accepted; overall UI separate                 |
| Current-puzzle-only objects, 1–5 per side on wide layouts, hidden on compact/mobile, blend preserved | Unit/property checks and 39 theme browser checks                          | `ui/puzzle-backdrop.test.ts`, `themes.spec.ts`, [app captures](evidence/v1.1-card/README.md)                          | pass                                          |
| Single prepared candidate, failed speculation, family switch and cancellation                        | Deferred-promise regression tests                                         | `ui/prepare-ahead.test.ts`                                                                                            | pass                                          |
| Stalled storage/Worker, leaving during loading, repeated Next and saved-result retention             | Four app fault-injection checks and storage unit checks                   | `preparation.spec.ts`, `theme-history.test.ts`, [Next measurements](evidence/v1.1-card/preparation-measurements.json) | pass                                          |
| Continuous Card, random origin on Next, fold/stack and wide/phone results                            | 27 Card checks across Chromium, Firefox and WebKit; captures/frame probes | `card.spec.ts`, [review evidence](evidence/v1.1-card/README.md)                                                       | pass; owner visual gate separate              |
| Only large earned score scrambles, static labels/high score/stats, accepted exit and no replay       | First-visible-frame sampling and immediate/duplicate Next                 | [motion checks](evidence/v1.1-card/motion-checks.json), `card.spec.ts`                                                | pass in all three browsers                    |
| Reduced/failed motion, unavailable cosmetic entropy, slow/failed preparation and hidden identity     | Browser fault injection; independent logical deadlines                    | `card.spec.ts`, `build/v1.1-card/entropy-tests.log`                                                                   | pass in all three browsers                    |
| Existing release checks, authoritative replay and six-runtime vectors                                | Full `bun run verify`                                                     | `build/v1.1-card/final-verify.log`, [summary](evidence/v1.1-card/verification.json)                                   | pass: 116 units, 22 integration, 110 browsers |
| Actual Card/phone stack visual decision                                                              | Owner review                                                              | [local proof](http://localhost:5173/demo/card-proof.html), Card decision                                              | pending; no acceptance inferred               |
| Project/future puzzle instructions and code map                                                      | Documentation review                                                      | `AGENTS.md`, simple plan, `EDGE_CASES.md`, `puzzles/_TEMPLATE.md`, `CODEMAP.md`                                       | updated                                       |

- **Measurements:** Five preloaded solo Next activations are instrumented in
  the app browser test, from activation to generated game DOM, excluding the
  prescribed entrance/preview. Diagnostic environment: headless desktop
  Chromium at 1280×720, unthrottled localhost development server, reduced
  motion, five runs: median **29.9 ms**, p95 **36.0 ms**.
  Evidence: [preparation measurements](evidence/v1.1-card/preparation-measurements.json).
  These are local goals; cold-load, mid-range phone, throttled 4G and public
  launch median/p95 gates remain unmeasured and unwaived. Proof fault controls
  use 200 ms normal preparation and 4.5 s slow preparation; those are synthetic
  scenarios, not measured generation performance.
- **Waivers:** None added. Contact-sheet approval does not waive freshness,
  Card/overall visual acceptance, physical-device or production gates.
- **Owner responsibilities:** Review the linked concrete proofs and phone
  stack placement, then the remaining integrated UI pass on actual devices.
  Production actions remain separately authorized.
- **CODEMAP updated:** yes.

## v1.1 procedural themes and requested viewport sizing — local review slice — 2026-10-26–27

- **Built:** Recipe-generated OKLCH palettes, bounded verification/fallback,
  immutable theme data and versions, generated Memory silhouettes, four surface
  shapes, five styles and five own-item scatter arrangements. Memory/Block use
  resolved themes; solo solving runs in a Web Worker with a logged fallback.
  IndexedDB retains the latest three appearances; local D1 migration `0006`
  stores versions/snapshots on starts and completed results. Legacy queued runs
  remain compatible. A reproducible 60-theme sheet is prepared for taste review.
  The owner subsequently requested the planned 1920×923 screenshot sizing fix:
  viewport/container sizing replaces the fixed caps, names sit in the header
  (below it on narrow portrait), and a full-width bottom help/high-score panel
  leaves a clear gap around the game box. A completed zero-score game loses NEW.
  Landscape uses one full-height game row; tray slots remain reachable. Drag
  previews inherit the dealt colors/shapes, and small HUD/footer labels meet
  4.5:1 text contrast. Current game entrances remain unchanged.
- **Skipped (and why):** This is a local review slice, not completed v1.1.
  Theme taste acceptance remains open. The Card/full UI pass, Connect/audio,
  scoring customization and public-door withdrawal/explainers remain queued.
  Phone landscape title placement and Card proofs remain part of the full UI
  pass. No share links, admin game-test routes, deployment, production resources,
  secret installation, DNS or Google changes.
- **Known issues:** Freshness is best effort. The small shared symbol-family
  vocabulary overlaps every later theme; the full conjunction misses in 99.99%
  of simulated rounds. All violation rates are reported without weakening the
  rules. Block stores shared symbol metadata without painting glyphs on pieces.
  Concurrent ranked starts can read the same last-three history; accessibility
  stays mandatory and start caps remain atomic. Small Block cells on short
  landscape screens retain the physical space constraint; no universal 44px
  per-cell target, real-device acceptance or new waiver is claimed. Cold/Next
  preparation latency and production CPU/heap/operations remain unmeasured gates
  or goals under their existing release contract.
- **Decisions and pinned versions:** `theme-2026-10-26-1`,
  `oklch-machado-1`; six harmonies plus free mode; contrast targets 3.3/5.5/9.
  Post-hex margins: symbols/edges 3.1, primary text 4.7, back 1.55, CIE76 22,
  effective decoration ≤1.25 at 20% opacity. Use the documented verified
  Shapes/Ocean/Garden/Candy anchors. No package, scoring or engine-version
  changes. Sources and choices are in `docs/DECISIONS.md`.
- **Questions for the owner:** Review the theme sheet and enlarged screens,
  specify palette/surface changes, and set the freshness target after reviewing
  the measured vocabulary limits. The required taste gate comes from Work 1 of
  the handoff scope and AGENTS rule 1. No deployment approval is requested.
- **Evidence table:**

| Acceptance item                                                                        | Evidence type                            | Where                                                                                      | Result                                                                                                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Recipes/free mode, structural axes and immutable versions                              | Unit tests and typed JSON                | `src/lib/engine/theme/`                                                                    | pass                                                                                                                            |
| 10,000 accessible themes per existing family                                           | Property check                           | `docs/evidence/v1.1-themes/palettes.json`                                                  | pass: 20,000/20,000                                                                                                             |
| ≤5% fallback per initial 30° hue bucket                                                | Property report                          | Same JSON                                                                                  | pass: worst Memory 3.89%, Block 3.69%                                                                                           |
| Documented anchors checked; bad palettes rejected                                      | Table parser/unit tests                  | `scripts/check-palettes.ts`, `theme.test.ts`                                               | pass                                                                                                                            |
| Bounded freshness and accessible last-candidate fallback                               | Regression/simulation                    | `freshness.ts`, `theme.test.ts`, palettes JSON                                             | measured; owner target pending                                                                                                  |
| Theme taste and overall visual acceptance                                              | HTML/PNG review                          | `docs/evidence/v1.1-themes/contact-sheet.html`, `contact-sheet.png`                        | pending owner                                                                                                                   |
| Authoritative snapshots, old queued runs, saves and deletion                           | Real local D1 integration                | `tests/integration/runs.test.ts`, migration `0006`                                         | pass: 22 integration tests overall                                                                                              |
| Unchanged game vectors and six theme regression vectors                                | Node/Bun/Chromium/Firefox/WebKit/workerd | `tests/vectors/`                                                                           | pass in all six runtimes                                                                                                        |
| Shapes, 24px silhouettes, text contrast, gaps, sizing, reachable trays and themed drag | Three-browser automation and 36 captures | `tests/e2e/themes.spec.ts`, `docs/evidence/v1.1-themes/layouts.json`, `build/v1.1-themes/` | pass: 39 theme checks                                                                                                           |
| Worker/storage failure behavior                                                        | Unit/browser regressions                 | `solo-theme.test.ts`, `theme-history.test.ts`, account/recovery checks                     | pass                                                                                                                            |
| Full local release verification                                                        | `bun run verify`, exit 0 on 2026-10-27   | `docs/evidence/v1.1-themes/verification.json`, `build/v1.1-themes/verify.log`              | pass: format/lint, 0 errors/warnings, boundaries, 111 units, 22 integration, palettes, vectors, built Worker, 79 browser checks |
| Phase status, privacy inventory, decisions and code map                                | Documentation                            | `V1.1_WORK.md`, `PRIVACY_RETENTION.md`, `DECISIONS.md`, `CODEMAP.md`                       | updated                                                                                                                         |

- **Measurements:** Local Linux x64 development machine, Bun 1.4.2, no network,
  preloaded generator, 10,000 runs per family. Memory median/p95 0.99/3.67 ms;
  Block 1.77/7.48 ms (worst 124.19 ms). These are informational generation
  measurements, not cold-load, phone, Worker CPU or Instant Next passes. Exact
  values are in the JSON. Fallbacks: Memory 276/10,000 (2.76%), Block 299/10,000
  (2.99%). Per-10,000-round freshness violation rates (recipe/hue/style/container/
  symbols): Memory 38.18/70.57/48.29/57.53/99.99%; Block
  38.17/70.69/49.05/58.45/99.99%. No owner freshness target is inferred.
  One capture per family/viewport/browser covers 360×640, 390×844, 844×390,
  1280×800, 1920×923 and 1920×1080. At 1920×923, Memory's panel is about
  855×719 with an 805px grid (previously about 642×472 and 440px). Both panels
  use about 78% of viewport height. Desktop panel height ≥70%, limiting-dimension
  use ≥95%, clear gaps and no scroll are automated geometric gates; human
  visual/real-device acceptance is still pending.
- **Waivers:** None added. Earlier Step 6 and public guest/privacy evidence is
  preserved. Taste, real-device, freshness-target and production gates remain.
- **Owner responsibilities:** Review the sheet/screens and give palette/style
  feedback, then review the subsequent Card proofs/phone stack. Production
  operations and every deployment remain separate owner decisions.
- **CODEMAP updated:** yes.

## v1 operator sign-in follow-up — 2026-10-26

- **Built:** Distinct sign-in messages for rejected/replayed codes, recovery
  codes, account locks, request limits and service failures. The code field now
  identifies the Morphi.One authenticator entry. Clarified manual Base32 setup
  and the separate terminal/web authenticators in `ADMIN_LOCAL.md`. Generated
  private offline QR helper pages in the ignored local build directory.
- **Skipped:** Credential rotation, permission/limit changes, public setup and
  deployment. Owner bootstrap and web enrollment were performed by the owner;
  the helper reads existing enrollment material without changing it.
- **Known issues:** Owner confirmation of successful web sign-in is pending.
- **Decisions:** Preserve the existing second-factor and replay protections;
  distinguish actionable authentication failures from a data-loading failure.
- **Questions / owner responsibilities:** Add the separate Morphi.One entry and
  confirm sign-in using its current code; retain recovery codes privately.
- **Evidence:** `tests/e2e/operator.spec.ts` covers rejected-code recovery to a
  successful dashboard, ordinary-player denial, account-lock and request-limit
  messages. Run evidence: `build/v1-integration-review/operator-login-followup.log`.
  Type check: zero errors/warnings; changed-file format and lint checks pass.
- **Measurements:** Functional localhost desktop Chromium checks only; no new
  performance measurements or production capacity claims.
- **Waivers:** None. Existing public release gates remain open.
- **CODEMAP updated:** Yes.

## v1 local app integration — 2026-10-26 (local review candidate)

- **Built:** Accepted Home, Mix/Stay doors, results, real-data profile and local
  Stage 1 operator screens; metadata/sitemap/robots/OG assets and Terms. Memory
  3/4/5-second arrivals → full 3-second preview → hide → input/timer; a locked
  3-second Block arrival. Shared anime.js wrapper and cosmetic-failure fallback.
  Thirteen generated ElevenLabs cues (69,320 bytes), static playback only.
  Default-off coarse measurement with privacy controls. Backdrop dismissal in
  app and demo; long names, correct Nunito/wordmark, landscape and board geometry
  corrected through comparison. Template, retention and owner setup docs updated.
- **Skipped:** New games, XP/mastery/achievements, CMS, production provisioning,
  owner credential/enrollment changes, DNS/Google changes and deployments.
  They are outside this local integration or remain explicit release gates.
- **Known issues / limits:** Post-integration owner real-device/feel review and
  production resource/security/operating gates remain open. Short portrait result
  pages scroll to preserve approved readable copy. A fresh app Google session
  plus TOTP is enforced; no claim of forcing a Google password prompt is made.
- **Decisions:** Existing engine versions/vectors retained; anime.js 4.5.0 and
  existing lockfile-resolved ElevenLabs SDK 2.74.0. Fixed server opening allowance;
  no score/seed selection by the ranked client. See `DECISIONS.md`.
- **Questions for the owner:** Review the integrated desktop/phone experience and
  generated sounds. Final account jurisdictions/eligibility and production
  operating decisions remain the previously recorded owner responsibilities.
- **Evidence table:** The final `bun run verify` passes; the artifacts below record the local scope.

| Acceptance item                                              | Evidence type / location                                                                                          | Result                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Accepted public layouts / responsive boards                  | 110 actual/demo viewport captures across Chromium, Firefox and WebKit; `build/v1-integration-review/results.json` | Pass: no uncaught browser errors or horizontal overflow      |
| Profile and native operator screens                          | 36 captures, three approved sizes; `account-results.json`, synthetic fixture removed afterward                    | Pass: no uncaught browser errors or horizontal overflow      |
| Memory / Block entrance and timer sequence                   | `tests/e2e/entrance.spec.ts`, active-delay and timing units                                                       | Pass: final verification                                     |
| Backdrop dismissal / focus / inside drags                    | `tests/e2e/dialogs.spec.ts`, account deletion flow                                                                | Pass: final browser suite                                    |
| Account saves / recovery / rotation                          | Existing account, reliability and selector browser regressions                                                    | Pass: final verification                                     |
| Operator permissions / recovery / audited actions            | `tests/integration/operator.test.ts`, `tests/e2e/operator.spec.ts`                                                | Pass: integration matrix/recovery and native browser actions |
| Sound assets and provenance                                  | `static/audio/manifest.json`, `audio.json`; 13 hashes and ffprobe decoding                                        | Pass                                                         |
| Formatting, types, boundaries, units and six-runtime vectors | `build/v1-integration-review/verify-final.log`                                                                    | Pass: final verification                                     |
| Built Worker with isolated D1                                | `scripts/check-worker.ts`, automatically allocated loopback port                                                  | Pass: 15 isolated built-Worker checks                        |
| Guest-only artifact / publication separation                 | `public-prepare.log`, `public-check.log`; retained historical artifact                                            | Pass: six local groups, 90 static files; no deployment       |
| Schema / future migration baseline                           | `schema.log`: Drizzle reports no changes; migrations 0003–0005 and snapshots                                      | Pass                                                         |
| Owner device review / public release gates                   | Owner review and release checklist                                                                                | Pending, not waived                                          |

- **Measurements:** Functional desktop-headless browser runs used localhost with
  no network shaping, at the viewport sizes above. They measure layout and
  behavior, not real phones or production capacity. The 69,320-byte sound set is
  a payload measurement, not a loading-performance claim.

| Target                                   | Device / network / load                                                   | Runs                | Median / p95 | Gate or goal / result                       |
| ---------------------------------------- | ------------------------------------------------------------------------- | ------------------- | ------------ | ------------------------------------------- |
| LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1        | Required mid-range real phone, specified network, cold/preloaded protocol | 0 for this delivery | Not measured | Release targets remain pending              |
| Tap response ≤100 ms                     | Real device / actual delivery                                             | 0 measured          | Not measured | Feel goal; functional response only checked |
| Production Worker/auth/D1 CPU and memory | Production configuration / load profile                                   | 0                   | Not measured | Release gate remains pending                |

- **Waivers:** None added. Historical owner exceptions remain recorded in their
  earlier reports; no production, device or accessibility gate is newly waived.
- **Owner responsibilities:** Real-device review and acceptance; explicit local
  operator enrollment if desired (`ADMIN_LOCAL.md`); settle D5 and production
  operations/resource evidence; review the final release artifact and separately
  authorize each deployment. Current published version/evidence is preserved.
- **CODEMAP updated:** yes.

Final verification: **103 unit tests, 21 D1/auth/operator integration tests, six
determinism runtimes, 15 isolated built-Worker checks and 39 browser cases all
pass**, with zero type errors/warnings and passing format/lint/boundaries.
`verify-final.log` is the complete clean run. `results.json` and
`account-results.json` contain 146 captures with no uncaught errors or horizontal
overflow; actual layouts retain curated themes and real data rather than demo
fixture scores. `public-check.log` passes all six guest-only groups, including
real Block → result → Memory play without account APIs/queues/prompts. Schema
drift check reports no changes. `asset-safety.json` records the generated-browser
asset scan (no configured private values, backend or review demos in the guest
bundle). These are local evidence, not owner acceptance or launch authorization.

## Demo phone layout and slower transitions — 2026-10-25

- **Built:** Owner-requested timing revision: 1-second door/return/result
  presentation, 1.5-second Home → puzzle and the subsequent owner correction
  to 0.5-second help opening/closing (2 seconds combined Home → puzzle → help). Incoming Home stage is hidden
  before its delayed fade, preventing the visible/fade/reappear flash.
  Decorative travel uses a clipped viewport overlay; active phone stages are
  clipped without adding scrollbars during scale/translation. Reduced-motion
  changes restore visibility and clear layers immediately.
- **Phone layouts:** Actual boards are centred in portrait for Memory and
  Block, both door and surprise/Mix entry. Short landscape sizes boards from
  available height, with the HUD on the left and help/pieces on the right.
  Layouts include 568×320 narrow landscape; rotation preserves moves. Clear
  stage space lets taps reach header/help controls. Forward and return door
  transitions measure the board rather than its full-screen stage.
- **Skipped:** Application integration, admin redesign, deployment, remote
  resources and final eligibility/jurisdictions. Other screen designs remain
  as reviewed. The owner explicitly said this is **not full acceptance**.
- **Known issues:** Owner physical-device review remains pending. Automated
  viewport checks cannot establish real-device browser/performance acceptance.
  Early checks found help-button interception and transient animation overflow;
  both were corrected before final demo checks. Full verification exposed a
  pre-existing guest-account test assumption that the first family is always
  Block. Its assertion now accepts the dealt Memory card or Block grid;
  application code is unchanged.
- **Decisions and pins:** `DECISIONS.md` records the later owner timing/layout
  amendment, superseding the package's 350 ms timing. Existing anime.js 4.5.0
  dev pin remains; logic is independent of animation completion.
- **Questions for the owner:** No implementation clarification required. Review
  the revised demo; integration/deployment and D5 remain separate gates.
- **Evidence table:**

| Item                                                                                   | Evidence type / location                                                                                                                                     | Result                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Portrait centring, landscape size, no scrolling, tappable controls                     | Synthetic Chromium, both families × door/Mix × six phone sizes; `build/design-review-2026-10-25/phone-layouts.json`, screenshots, `phone-cross-browser.json` | Pass: 24 Chromium cases plus 48 Firefox/WebKit cases                                                                 |
| Rotation preserves a revealed card or placed cell                                      | Same demo script, portrait → landscape → portrait                                                                                                            | Pass: both families                                                                                                  |
| Single Home arrival, slower timing, no transient scrollbar, mid-arrival reduced motion | Per-frame samples in `memory-motion-frames.json` / `block-motion-frames.json` in the same evidence directory                                                 | Pass: monotonic arrival; all sampled frames fit; reduced-motion cleanup                                              |
| Half-second help opening and closing                                                   | Same frame traces, `helpFrames`; How to play and Scoring & tips for both families                                                                            | Pass: both dialogs complete in 0.5 s; close cleans overlays                                                          |
| Existing screen flows and admin unchanged                                              | `bun run test:demo`; `/tmp/morphi-demo-phone.log`; original admin stylesheet SHA-256                                                                         | Pass: 366 checks, no browser errors or uploads                                                                       |
| Product regression                                                                     | `bun run verify`; `/tmp/morphi-phone-verify-final.log`; final help change also checked in `/tmp/morphi-demo-phone-types.log` and scoped ESLint               | Pass: zero type errors/warnings, 101 units, 17 account integration, six runtimes, 15 Worker checks, 27 browser tests |
| Full acceptance, integration, deployment, D5                                           | Explicit owner scope                                                                                                                                         | Pending; not granted or finalized                                                                                    |

- **Measurements:** Local static server; Chromium desktop emulation at
  390×844, 844×390, 667×375, 568×320, 320×568 and 320×480. One layout probe
  per game/entry/size and one frame trace per family/transition; no network
  throttling. At 844×390, final Memory board is about 371×276 and Block is
  278×278, replacing the previous 280×90 and roughly 164–170-square boards.
  Every phone board centre is within 1 px of the viewport centre. The 0.5/1/1.5 s
  durations are presentation settings, not performance percentiles. No median,
  p95, production capacity or physical-phone measurement claim is made.
- **Waivers:** None.
- **Owner responsibilities:** Re-review phone layouts and transition feel.
  No full acceptance inferred; later integration and every deployment still
  need their separate authorization. D5 remains open.
- **CODEMAP updated:** Yes; scoped phone/motion probes are mapped.

## Accepted Oct 25 design package applied to the demo — 2026-10-25

- **Built:** Read the complete owner-accepted handoff before code. The actual
  package path is `docs/morphi-design-package-2026-10-25/`. Updated the existing
  v1 demo screen by screen using its images and both GIFs (including sampled
  transition frames). Public changes are isolated in `v1-design.css`; the
  existing admin stylesheet remains byte-for-byte unchanged.
- **Screen delivery:** Home is centred, one screen, with coral Play, a 36-second
  orbit/gentle pulse, mystery tiles, tinted chips and bounded visit-local mixed
  scatter. Its decorative layer is aria-hidden/unlinked, respects safe zones
  and spacing, and is laid out synchronously before paint. Footers contain
  Privacy · Terms only. Door pages start ready with one board Play; quiet
  numbered/scoring guides step aside for play and two help dialogs. Game names
  are headings; SEO phrases are eyebrows/titles; only the ready-state quiet
  surprise link enters Mix. Results appear first at round end; Next returns a
  door to its ready guides in Stay mode. Home Play starts Mix on arrival.
- **Profile/result/wording:** Foundation v2 adds the identity band, keyboard
  tabs, one row per played game with detail view, activity and three fixed
  right-rail slots. Labels use #68798E; Level/XP/mastery/achievements are
  synthetic fixtures, not production additions. All user wordmarks say
  Morphi.One and user score wording uses Your high score per family. Result
  follows the accepted ink sign-in treatment with its device-only note inside
  the section; mobile order is score → Next → stats → sign-in. No simulated
  data footer appears inside user screens; the outer review harness explains
  the simulation. Admin reference images were not implemented.
- **Motion:** `scripts/demo-motion.ts` is the only anime.js importer. Both
  transitions and help grow/fold use 350 ms ease-out presentation; reduced
  motion swaps instantly and stops orbit/pulse. Logic commits independently of
  animation completion, missing motion does not block start, and decorative
  clones are cleaned up. `bun run demo:motion` builds its demo-only asset and
  retains the MIT license; `bun run test:demo` is reproducible and isolated.
- **Skipped:** Application/route/engine integration, production XP/mastery or
  achievements, public metadata/sitemap deployment, account eligibility,
  provisioning, DNS, secrets, Google settings and every deployment. V2 release
  tracks/gates are unchanged. D5 remains open; the existing 18+ wording remains
  a demo proposal only. This delivery does not imply integration approval.
- **Known issues:** No unresolved failure in the scoped automated checks.
  Initial checks caught reduced-motion clones and short-screen Block sizing;
  both were fixed before the final demo pass. Visual review on owner devices
  remains pending, and this demo does not prove production accessibility,
  load/capacity, account operations or legal readiness. Account preview modules
  require the HTTP review server, as before. Review demos must be excluded from
  any eventual release artifact.
- **Decisions:** `DECISIONS.md` records the explicit §11.16 amendment from
  dimming to hybrid, navigation amendment removing door links from product
  navigation, accepted Home loop exception, scoped palette and design-package
  precedence. V2 still controls rollout gates. `animejs@4.5.0` (MIT) is an exact
  dev pin; other version pins remain unchanged. Generated motion JS alone is
  excluded from ESLint; its authored TypeScript wrapper is checked.
- **Questions for the owner:** Review the updated demo's layouts, copy and
  transition feel. Integration needs the later owner direction; each deployment
  retains its own explicit approval. D5 still needs its separate resolution.
- **Evidence table:**

| Acceptance item                                        | Evidence type / location                                           | Result                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accepted handoff and all public design references used | Complete handoff read; screen/GIF review; `DECISIONS.md` amendment | Pass                                                                                                                                             |
| Home/scatter/chips/footer                              | `build/design-review-2026-10-25/checks.json`, screenshots          | Pass: three required sizes, short-phone fit, fresh bounded mixed scatter, no door navigation                                                     |
| Door ready/playing/help/results flow                   | Same synthetic demo evidence                                       | Pass: single Play, columns leave, two help controls, Escape/focus restoration, Stay return                                                       |
| Both transitions and reduced/missing-motion behavior   | Same checks; `motion-evidence.json`; authored wrapper              | Pass: logical state before animation finishes; instant reduced fallback; missing bundle still starts                                             |
| Foundation v2 and per-family high scores               | Same checks/screenshots; profile detail and keyboard tabs          | Pass: fixed slots, two game rows, #68798E labels                                                                                                 |
| Result layout and sign-in section                      | Same checks/screenshots                                            | Pass: mobile order, ink button and internal device-only note                                                                                     |
| Admin preserved                                        | SHA-256 of original `v1.css` checked by demo script                | Pass: stylesheet unchanged; reference redesign not implemented                                                                                   |
| Product regression                                     | `/tmp/morphi-design-verify.log`                                    | Pass: `bun run verify`, zero type errors/warnings, 101 units, 17 integration, six runtimes, 15 built-Worker checks, 27 application browser cases |
| Demo verification                                      | `/tmp/morphi-design-demo-final.log`, `checks.json`                 | Pass: 252 checks, zero browser errors, zero backend/telemetry uploads                                                                            |
| Production integration/deployment/D5                   | Owner scope and v2 release gates                                   | Pending; not authorized or finalized by this task                                                                                                |

- **Measurements:** Functional desktop Chromium emulation at 390×844, 844×390
  and 1280×800; local static server, font-ready probes, one local layout-shift
  probe per size. Recorded Home CLS = 0 at all three sizes and a stationary
  orbit under reduced motion. The 350 ms duration is configured, not a measured
  real-device performance percentile. No throttled network, five-run median/
  p95, real-phone or production resource evidence was collected; no v2
  performance/capacity gate is passed by this demo evidence.
- **Waivers:** None.
- **Owner responsibilities:** Review the updated demo and copy before
  integration; resolve D5 and operating gates separately; authorize each
  applicable remote action/deployment and the eventual launch.
- **CODEMAP:** Updated with public design scope, motion build and demo checks;
  remains 150 lines. The simple plan, active v2 handoff and `V1_WORK.md` link
  the accepted design supplement without reopening rollout authorization.

## v1 demo user-profile access — 2026-10-25

- **Built:** Added the missing User / profile entry to the v1 demo Screen
  dropdown, with the existing approved sign-in, player-name and leaderboard
  previews. Reused the account demo; synchronized its navigation with the v1
  selector and full-size link. Restarted the static review server on port 5174.
- **Skipped:** No new profile design, backend, auth, game, deployment or scope
  acceptance. This is access to previously approved simulated account screens.
- **Known issues:** Account previews require the local HTTP server because
  they use JavaScript modules. Existing v1 visual/release gates remain open.
- **Decisions:** Reuse the approved screens and catalog; no dependency changes.
- **Questions for the owner:** Continue the pending visual review; no additional
  decision is needed to expose the existing profile preview.
- **Evidence:** `build/v1-profile-review/results.json`: 16 focused browser
  checks pass, including profile at 390×844, 844×390 and 1280×800, full-size
  links, no horizontal overflow, name editing, leaderboard/sign-in/sign-out
  navigation, offline state and zero browser errors. Explicit Prettier/ESLint
  checks pass for the two changed demo scripts. Full application verification
  was not repeated for this isolated demo-navigation change; the previous
  verification remains historical.
- **Measurements/waivers:** Functional viewport emulation only; no new timing,
  capacity or real-device evidence and no waivers.
- **Owner responsibilities:** Review layouts/content before integration and
  retain separate approval for deployments and public-account release gates.
- **CODEMAP:** Updated with the integrated profile/account previews.

## v1 handoff, interactive demo and first selector slice — 2026-10-24

- **Built:** Imported the owner-supplied consolidated v2 handoff into
  `V1_RELEASE_CHECKLIST.md`, marked the earlier v1 proposal historical and
  recorded explicit local implementation authorization. Captured D1 dashboard
  plus anonymous events, D3 Terms preparation, D4 curated themes, and D5 proposed
  18+ wording approved for the demo only. Updated the simple plan/agent guidance
  to preserve those newer owner instructions.
- **Built for visual review:** `static/demo/v1.html` and its isolated screen,
  catalog, styles and interactions provide 15 public/operator screens at all
  three required viewport sizes. Includes puzzle interactions, mystery Next,
  content/Terms review, simulated 2FA/recovery/re-authentication, role
  presentations, moderation/reporting/audit and a proposed protected privacy
  workflow. Everything is synthetic and in memory. The owner specifically
  requested this actual demo instead of wireframes; layouts/copy await approval.
- **Application slice:** Removed Block-first. Weighted family order is sampled
  without replacement, with one of each eligible family per cycle, minimum gaps
  across refills and stable pending draws through failures. Added larger-index
  property checks without new puzzles. Generic start-error and loading text
  preserve the mystery; Home best no longer reads the next family's best.
  Browser fixtures inject selector entropy in tests only. No engine logic,
  replay vectors, engine versions or dependency versions changed.
- **Skipped/pending:** New production screens, SEO routes/metadata/OG/sitemap,
  real admin security/backend and enrollment, telemetry and its final privacy
  controls, final Terms publication, production operating decisions/resources,
  OAuth/mailbox verification, restore/load/rollback/resource/device drills and
  every deployment remain unfinished. The demo does not implement or validate
  production security, collection or account rollout. Public site is unchanged.
- **Known issues:** Account eligibility is not finally accepted; Ali Gohar owns
  a focused legal review of jurisdictions/child-data obligations for the
  intended global account launch. Proposed age wording does not verify age.
  Production ID-token storage, audit/claim retention, observability, admin
  recovery, resource measurements and operating rules remain explicit gates.
  The initial demo check caught phone admin overflow; fixed before the passing
  45-layout check. Two overlapping Playwright runs initially collided in their
  shared trace directory (ENOENT during browser-context cleanup); the affected
  run was stopped. A serial rerun passed 26/27 browser cases and exposed one
  stale privacy-test assumption that the first family must be Block; that
  assertion now checks either game, matching the owner amendment. The final
  clean `bun run verify` passes, including all 27 browser cases. No application
  defect remains from those test-harness/obsolete-expectation failures.
- **Decisions/security:** Owner asked for Cloudflare security skills;
  project-local `workers-best-practices` and `wrangler` guidance and relevant
  current official Worker/Web Crypto/D1 references were checked. Keep pinned
  versions and compatibility settings; no secrets, DNS, Google or live Worker
  settings were inspected or changed. Local tools use ignored development
  bindings normally. Demo-only role tests are not production RBAC evidence.
- **Questions for the owner:** Review/approve or amend the demo layouts and
  how-to/scoring/tips/Terms copy before production screen integration (checklist
  §§4.1/5.2 and `AGENTS.md` rule 9; demo replaces wireframes at owner request).
  Final account eligibility and jurisdictions need owner resolution after
  focused legal review; operating choices and future remote approvals remain.
- **Evidence table:**

| Acceptance item                                               | Evidence type / location                                                | Result                                                                                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revised handoff and explicit owner decisions preserved        | `V1_RELEASE_CHECKLIST.md`, `DECISIONS.md`, simple plan, `V1_WORK.md`    | Pass: local work authorized; release scope not finally frozen                                                                                                   |
| Actual interactive visual demo at 390×844, 844×390, 1280×800  | Local Chromium: `build/v1-demo-review/results.json`, 22 screenshots     | Pass: 98 checks, 45 screen/viewport cases, zero browser errors or backend mutations; owner approval pending                                                     |
| Direct-file review without a dev server                       | Same synthetic browser evidence; open `static/demo/v1.html`             | Pass                                                                                                                                                            |
| RNG-start, cycle counts/weights/gaps, stable failed draws     | `src/lib/selector.test.ts`, `tests/e2e/selector.spec.ts`, `entropy.ts`  | Pass: 13 selector unit cases and 3 new selector browser cases                                                                                                   |
| Existing product regression                                   | `/tmp/morphi-v1-verify-clean.log`                                       | Pass: full `bun run verify`; format/lint, zero type errors/warnings, boundaries, 101 units, 17 integration, six runtimes, 15 Worker checks and 27 browser cases |
| Determinism preserved                                         | Six-runtime output in verification log                                  | Pass: fingerprint `a8be9d5fdacc1818c3d078be2fa014cb279c349d6ba7313029f9a363b40b0ac4` unchanged                                                                  |
| Historical guest artifact remains testable                    | `/tmp/morphi-v1-public-artifact.log`, `scripts/check-public-privacy.ts` | Pass: six local check groups; selector entropy fixture used only by the test browser; no new artifact or deployment                                             |
| Production admin, telemetry, SEO delivery and public accounts | Active handoff release gates                                            | Pending: not implemented by a mock/demo                                                                                                                         |

- **Measurements:** Desktop Chromium functional checks at the three viewport
  sizes are emulations, not named real devices or performance measurements.
  No network profile, cold/preloaded timing, median/p95, peak memory, production
  CPU, capacity or screen-reader pass is claimed. Existing release targets
  remain gates; synthetic demo checks are not substitutes.
- **Waivers:** None. The earlier Step 5 owner waiver remains historical; no v1
  acceptance item is waived by this work.
- **Owner responsibilities:** Review the demo and content, resolve final
  eligibility/jurisdictions and operating choices, authorize applicable remote
  work and each deployment, complete real-device/provider checks and accept
  the eventual release. No global launch acceptance is inferred.
- **CODEMAP updated:** yes; active handoff, work log, demo and selector behavior
  are mapped. `V1_WORK.md` lists the remaining implementation/release sequence.

## V1 release planning — 2026-10-24

- **Built:** Owner-requested `V1_RELEASE_PLAN.md`, grounded in the authoritative simple plan and accepted Step 6 evidence. It separates the release contract, approved local work, authorized production provisioning/operations, controlled account deployment and global launch. Includes a narrow Stage 1 admin-panel proposal, optional static terms decision, production request/maintenance/restore duties, measurement gates and deployment/rollback approval boundaries. Updated the simple plan, decision record, OAuth status note and CODEMAP.
- **Skipped:** No application/configuration changes, credential-file access/installation, Google action, provisioning, DNS change, deployment, new services or admin/terms implementation. The plan does not authorize its proposed implementation.
- **Known issues:** Owner reports production OAuth setup complete; actual client metadata, console branding/audience state and live sign-in are not verified by this planning task. Production account endpoints are not deployed. Account eligibility, operating/retention choices, protected production access and resource evidence remain open; no earlier local functional acceptance is reopened.
- **Decisions and pinned versions:** Existing versions unchanged. Keep the two accepted games and seeded generation; general-audience privacy and intentional automatic Cloudflare beacon remain settled. Larger long-plan phases and parked features stay deferred.
- **Questions for the owner:** Decide the release contract, Stage 1 panel versus a protected operator alternative, optional static terms scope, launch account eligibility and production operating/budget rules. These decisions are listed concretely in the plan; no implementation approval is assumed.
- **Evidence table:**

| Acceptance item                             | Evidence type / location                                                                 | Result                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Reviewable v1 sequence and completion gates | Document review: `V1_RELEASE_PLAN.md` §§1–3, 6–7                                         | Pass: plan prepared; execution pending                     |
| Small admin proposal and explicit limits    | Document review: §§2, 4–5; `ADMIN_LOCAL.md`, reference `PLAN.md` §11.10                  | Pass: proposal only; implementation pending owner decision |
| Honest Google/privacy/local-review status   | Cross-check: plan §1, `STEP6_REVIEW.md`, `PUBLIC_PRIVACY_RELEASE.md`, owner messages     | Pass: reported versus verified status distinguished        |
| Formatting, links and final scope review    | Prettier/ESLint, local Markdown link and plan-status checks; diff against saved baseline | Pass: lint, links and scope checks complete                |

- **Checks:** `bun run lint` passes (repository Prettier check and ESLint); local Markdown links and plan-status checks pass; CODEMAP remains 150 lines. Diff against the saved pre-task documentation baseline shows only the intended plan/status/link additions. No obvious credential patterns found in changed documents. Application tests/type checks/build were not rerun for documentation-only changes; prior results are labelled historical.
- **Measurements:** None taken; documentation-only task. Historical replay observations remain in `STEP6_MEASUREMENTS.md`; no new median/p95, production memory or capacity pass is claimed.
- **Waivers:** None. Existing Step 5 owner waiver is unchanged; no new release gate is waived.
- **Owner responsibilities:** Approve the selected implementation scope, supply actual Google console status, decide operating/eligibility/budget choices, authorize each applicable remote action/deployment, and perform/accept production device checks and public launch.
- **CODEMAP updated:** yes; release plan is linked without changing the simple plan's authority.

## Guest privacy publication and intentional Cloudflare analytics — 2026-10-24

- **Built/published:** Owner explicitly approved publishing the prepared guest homepage/privacy bundle. Initial release: `morphi-one` version `44a5846f-95d6-43d5-b61e-c7f478b6e857`, deployment `0da17bcf-36a2-4140-83ea-8c663efd7afd`, 2026-10-24T12:14:09.992338Z; reviewed manifest `15c32fd3562c607d43d676e09041f4ccda498e9457f06a18c553e43ce600efce`, archived in `build/public-privacy-published-44a5846f/`. Home/privacy return 200 on custom domain and workers.dev; HTTP/www redirects remain canonical; guest Block/result/Next/Memory works and account/API paths stay unavailable.
- **Intentional beacon:** Live browser responses include **Cloudflare Web Analytics through Cloudflare’s automatic setup**. It is absent from build files **by design** because Cloudflare injects it at delivery. The owner explicitly chose to keep it and instructed updating `/privacy`, noting intentional injection here, and rechecking live pages. No analytics configuration was added or toggled by the agent. The first generic no-external-request assertion surfaced this behavior; it is recorded as a failed assumption, not silently declared a pass. Raw build integrity checks remain strict; live checks now permit only the exact identified Cloudflare beacon origin/path and still reject other external requests.
- **Disclosure update:** Added Website analytics copy describing visits/performance, coarse report dimensions, automatic delivery injection, no custom Google identity/seed/move/history events and separate provider report retention. General-audience/contact/deletion direction remains unchanged. Follow-up publication is explicitly requested by the owner's live-page update instruction; final published version is `b50a7a18-2e85-4406-bd40-77f27c4b3da3`, deployment `fdb5c4e0-d618-40f0-a557-0130470cc24a`, 2026-10-24T12:32:54.790982Z; final evidence is recorded below.
- **Skipped:** No production account backend/D1, Google project/client/credential changes, Google submission, DNS edits, GA4, ads, new analytics pipeline, consent/age flow, CMS, admin web panel or game changes. Cloudflare account analytics settings were not changed. Domain ownership is already done according to the owner's explicit confirmation.
- **Known issues:** The diagnostic MCP session cannot inspect account-level Web Analytics settings (`account-settings.read` missing); retention is not independently configured/verified. No fixed provider erasure deadline or blanket privacy-law/consent exemption is claimed. Initial Python-urllib HTTP 403 was not reproduced by successful curl/browser delivery checks; it is not reported as an ongoing outage. Public accounts and their operating/resource gates remain separate from this guest/policy release.
- **Decisions/versions:** Keep existing dependency pins and static publication config. Update only policy content and focused verification behavior for the owner's intentional provider analytics choice. Keep main local-account config away from public deployment. Source/docs references are in `PRIVACY_RETENTION.md` and `DECISIONS.md`.
- **Owner responsibilities:** Domain ownership is owner-confirmed complete. Owner will configure/apply for the production Google project using the public home/privacy URLs; no Google verification or global account launch is inferred. Every later deployment still requires its applicable explicit authorization.
- **Evidence:** Source type check: zero errors/warnings; focused privacy browser cases: 2/2 pass; exact regenerated artifact: 41 files, manifest `019edab6f58dff4f231739763a527f955e84afa60432da08a9e19a52f28d82c0`, credential scan clean. Type check, lint, focused privacy cases (2/2), build, six local artifact groups and packaging dry run pass. The owner-requested live recheck passes all seven groups, including intentional Cloudflare beacon and no other external requests; account/auth/API routes remain 404 and Block/result/Next/Memory works. Both hostnames serve updated disclosure/metadata; curl HTML matches reviewed assets and HTTP/www redirects remain canonical. Evidence: `/tmp/morphi-analytics-{check,lint,privacy-browser,build,local-smoke,dry,live-smoke}.log` and `build/public-privacy/checks/{deployment,live-results,live-http-results}.json`; three live screenshots captured. The post-deployment API reports 100% of traffic on the new version, no backend bindings, and custom domain still attached. Earlier 95-unit/17-integration/six-runtime/15-Worker/24-browser verification remains the prior functional evidence; these unrelated tests were not repeated for policy text.
- **Measurements/waivers:** Functional desktop Chromium checks at phone portrait/landscape and desktop sizes; no new speed/memory medians or p95 claims, no waiver. Tests use synthetic guest rounds, no production account data.
- **CODEMAP:** Updated with publication/intentional-beacon status before delivery.

## Owner local Step 6 review accepted — 2026-10-24

- **Built:** Reviewed the owner-completed `STEP6_REVIEW.md` and synchronized the current plan, decision/status records and CODEMAP. No application code changed.
- **Skipped:** No deployment, provisioning, DNS/OAuth change, Google submission or admin-panel implementation. The question about deployment is not treated as authorization.
- **Known issues:** Specific device/browser models and the mobile OAuth connection method were not supplied. Peak isolate memory, production capacity and operating/eligibility decisions remain open; no measurement pass or waiver is inferred.
- **Decisions:** Owner accepts the local functional Step 6 build on 2026-10-24. PC/mobile checks are owner-reported evidence. Public account rollout and global launch are not accepted by this review.
- **Questions / owner responsibilities:** Explicit approval is still required before the prepared guest-policy Cloudflare deployment; subsequent domain/Google setup and submission require their applicable authorization. Additional device/browser details can be recorded later without reopening the accepted functional review.
- **Evidence:** All nine functional review rows report working as expected on PC/mobile; the final row explicitly accepts Step 6 (`STEP6_REVIEW.md`). Existing automated evidence remains in the prior report; tests were not rerun for this documentation-only update. The prepared guest artifact still has 41 matching files and config hash; manifest SHA-256 `15c32fd3562c607d43d676e09041f4ccda498e9457f06a18c553e43ce600efce`.
- **Measurements / waivers:** No new timing or memory measurements, medians/p95, or waivers. Owner records PC/mobile only.
- **CODEMAP updated:** yes.

## Privacy readiness and guest publication preparation — 2026-10-24

- **Built:** Reviewed public policy candidate with the approved general-audience direction, owner/contact, updated date, production canonical, Home/account links, no internal draft banner/notes/noindex and no client JavaScript on the legal page. The copy distinguishes public guest play from later account features. Added a real retention inventory and an owner-monitored privacy/children's-information request procedure. Added local admin/TOTP-protected operational cleanup and verified-request deletion, each audited atomically. Prepared an assets-only guest publication artifact with explicit allowlisting, hashed manifest and local browser/workerd checks. Updated the Google production setup/submission instructions and prepared a physical-device Step 6 review checklist.
- **Skipped:** No deployment, public publication, DNS modification, production D1/secrets/OAuth changes, Google submission, automatic cleanup service, age gate/verification/parental-consent service, CMS, GA4, new puzzle, multiplayer, payments or web admin panel. No real personal account or owner's local saved data was deleted/cleaned by the task. No dependency or engine/schema/auth-provider changes.
- **Known issues:** Initial full checks exposed a Worker-vector startup failure and one source-reload interruption in a layout test. Captured diagnostics identified a fixed-port collision with another local application; the vector harness now reuses its OS-assigned test port, reports bounded child startup errors and exits promptly when the child fails. No timeout or assertions were weakened, and the other application was left untouched. The layout trace shows Vite hot updates resetting an in-progress game during a final source edit; the final stable-source full run passes, as recorded below. Account data/saved rounds remain until account deletion; audit records, unlinked state/rate limits, unresolved claimed starts, browser copies and provider records can outlive that deletion. Maintenance is manual/local, not scheduled, and provider log/recovery retention is not configured by this task. Public account eligibility/jurisdictions and production operator/maintenance/audit/restore procedures remain v1 gates. Owner physical-device acceptance and true peak isolate memory/production capacity evidence remain pending. No universal legal-compliance determination or Google-approval guarantee is made.
- **Decisions / versions:** Owner confirmed personally monitoring cngohar@gmail.com. Preserve general-audience intent; no child-focused product or separate site. Use the published-update label with source revision date 2026-10-24, not a fictitious effective date. Existing Better Auth 1.7.12 session/online basic scopes and token storage were inspected; only access/refresh token encryption is asserted at application level. Cleanup preserves active supersession rows and unresolved claims. The assets-only candidate targets the same Worker/custom domain and replaces guest server rendering with static serving; no backend binding is included. `redact_query_string:true` is prepared locally, with no live changes. Existing dependency pins stay unchanged; see `DECISIONS.md`.
- **Questions / owner responsibilities:** Review and explicitly authorize the exact guest publication artifact before deploying it; `AGENTS.md` requires a separate approval for every deployment. Confirm Search Console/domain/project state, perform or authorize production Google setup and applicable submission, follow requests received at the monitored mailbox, resolve public-account operational/eligibility decisions, and complete the physical-device checklist. No settled audience/wording question is reopened.
- **Evidence table:**

| Acceptance item                                                                             | Evidence                                                                                                      | Result                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Real public/local architecture and provider limitations                                     | Read-only Cloudflare settings/deployment GETs; schema/auth/source inspection; current primary docs            | Live version unchanged, ASSETS only/no account D1, observability top-level disabled, Logpush off/no tails; limitations in `PRIVACY_RETENTION.md` |
| Privacy copy, updated date, production URL/contact, no draft/local notices                  | `tests/e2e/privacy.spec.ts`; publication static/browser assertions                                            | Pass; final full verification below                                                                                                              |
| Home/account links, no-JS legal document and layouts                                        | Normal account/privacy browser cases and guest artifact checks                                                | Pass; final full verification below                                                                                                              |
| Real Google scopes and auth data                                                            | Google authorization URL assertions, pinned auth/provider/schema inspection                                   | Exactly openid/email/profile and online access; no password registration; no age claim inferred                                                  |
| Local cleanup permission, active/expired distinction, safe supersession/retry recovery      | `tests/integration/accounts.test.ts`                                                                          | Pass in isolated D1                                                                                                                              |
| Privacy deletion, FK cascades, revoked sessions, board field allowlist and separate records | Accounts/runs integration and built-Worker checks                                                             | Pass; integration plus 15-check built-Worker smoke                                                                                               |
| Atomic audit requirement                                                                    | Injected audit-insert failure triggers in isolated D1                                                         | Cleanup and privacy deletion both roll back; successful actions audit without request-message/age/email evidence                                 |
| Request procedure and responsible contact                                                   | `PRIVACY_REQUESTS.md`; owner reply                                                                            | Prepared; monitoring owner-confirmed; mailbox deliverability not independently tested                                                            |
| Exact guest publication payload, inaccessible account/API routes and real two-game rotation | `build/public-privacy/manifest.json`; `scripts/check-public-privacy.ts`; local workerd/browser checks         | Pass; 41 asset files match the final manifest, all six workerd/browser check groups pass                                                         |
| Source diff/secrets/scope                                                                   | Local baseline comparison (workspace has no Git metadata); configured-credential scan without printing values | No credential-value matches; core RNG/game logic/auth/schema unchanged                                                                           |
| Publication / OAuth / Step 6 acceptance / global launch                                     | Live deployment state and owner/Google evidence                                                               | Pending; none inferred or waived                                                                                                                 |
| Authoritative plan/decisions/CODEMAP                                                        | `morphi-plan-simple.md`, `DECISIONS.md`, `CODEMAP.md`                                                         | Updated; CODEMAP 150 lines                                                                                                                       |

Changed files for this task:

| Area                                                           | Files                                                                                                                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public policy                                                  | `src/lib/content/privacy.ts`, `src/lib/i18n/messages.ts`, `src/routes/privacy/+page.svelte`                                                                                   |
| Guest publication mode (account prompts/replay queue disabled) | `src/routes/+page.ts` (new), `src/routes/+page.svelte`, `src/lib/screens/HomeScreen.svelte`, `src/lib/screens/ResultScreen.svelte`                                            |
| Local operator controls                                        | `src/lib/server/retention.ts` (new), `scripts/admin-local.ts`                                                                                                                 |
| Publication preparation/checks                                 | `scripts/prepare-public-privacy.ts`, `scripts/check-public-privacy.ts` (both new)                                                                                             |
| Existing verification                                          | `tests/integration/accounts.test.ts`, `tests/e2e/privacy.spec.ts`, `scripts/check-vectors.ts`                                                                                 |
| Configuration                                                  | `package.json`, `wrangler.jsonc`, `wrangler.public-privacy.jsonc` (new)                                                                                                       |
| Operational docs                                               | `docs/PRIVACY_RETENTION.md`, `PRIVACY_REQUESTS.md`, `PUBLIC_PRIVACY_RELEASE.md`, `STEP6_REVIEW.md` (new)                                                                      |
| Project records                                                | `AGENTS.md`, `morphi-plan-simple.md`, `docs/PRIVACY_REVIEW.md`, `GOOGLE_OAUTH_PUBLIC.md`, `ADMIN_LOCAL.md`, `STEP6_WORK.md`, `DECISIONS.md`, `CODEMAP.md`, `PHASE_REPORTS.md` |

- **Final verification:** `bun run verify` passes in `/tmp/morphi-readiness-verify-complete.log`: format/lint, 0-error/0-warning type check, boundary self-checks, 95 unit tests, 17 D1/auth integration tests, six runtime vectors (unchanged fingerprint `a8be9d5fdacc1818c3d078be2fa014cb279c349d6ba7313029f9a363b40b0ac4`), production build, 15 isolated built-Worker checks and all 24 Chromium account/privacy/recovery/layout/input cases. Initial failures and their fixes are described above; `/tmp/morphi-readiness-layout-hmr.zip` retains the interrupted-run evidence. A final factual mail-disclosure addition was checked separately with `bun run check` (0 errors/warnings) and the rebuilt artifact checks. Final `prepare:public-privacy`, `test:public-privacy` and `wrangler deploy --config wrangler.public-privacy.jsonc --dry-run` all pass (`/tmp/morphi-readiness-public-build-final.log`, `/tmp/morphi-readiness-public-test-final.log`, `/tmp/morphi-readiness-public-dry.log`). Dry run reports no bindings and exits without upload; its 47 filesystem entries correspond to 41 asset files plus directories, not a claim about total uploaded asset bytes. Manifest SHA-256: `15c32fd3562c607d43d676e09041f4ccda498e9457f06a18c553e43ce600efce`. After the dry run, all asset names/hashes still match. Final phone rendering inspected at `build/public-privacy/checks/privacy-390.png`; three approved sizes captured. The final scan of 30 changed source/config/doc files and all 41 asset files found no configured credential-value matches; baseline diff is `/tmp/morphi-privacy-readiness.diff` (no Git metadata in this workspace).
- **Measurements:** Local Linux development desktop and Chromium; localhost serving; policy layouts 390×844, 844×390 and 1280×800 in the artifact check, plus the normal 320×480 policy case. These are functional/layout checks, not new latency/performance claims. No median/p95 series was introduced; prior replay measurements and their limits remain in `STEP6_MEASUREMENTS.md`.
- **Waivers:** None. The initial harness collision and interrupted layout run are disclosed, not waived. No remaining owner/device/resource/legal/production gate is marked accepted by this task.
- **CODEMAP updated:** yes.

## Privacy audience clarification — 2026-10-24

- **Built / decisions:** Owner clarified that Morphi is a general-audience puzzle site with no child-focused content, design, or marketing and no separate kids site planned. This supersedes the intended-under-13 audience interpretation in the report below. Updated the local draft to describe guest ages not being requested or independently verified, essential connection/provider data, deferred child accounts, and unresolved public account eligibility/request handling. Policy version: `2026-10-24-draft-2`. Updated the simple plan, AGENTS, decision record, OAuth guide, and `PRIVACY_REVIEW.md`; the latter links rechecked FTC/EU guidance. The clarification does not establish a legal classification by itself.
- **Skipped:** No age gate, consent system, sign-in eligibility change, CMS, analytics, publication, Google submission, or deployment. No dependency changes.
- **Known issues / owner responsibilities:** Account eligibility, handling of known children's information, retention, and final wording still require review before publication. The policy remains draft/noindex. No new owner question or waiver; Step 6 acceptance remains pending.
- **Evidence:** `bun run check` passes with zero errors/warnings; both updated `tests/e2e/privacy.spec.ts` Chromium cases pass, covering the no-JavaScript disclosures, draft state, navigation, and four layouts. Existing static rendering and account-navigation evidence remains in the prior report. No new performance claim or measurements; CODEMAP updated.

## Privacy policy page — local draft, 2026-10-23

- **Built:** `/privacy` with the owner-supplied operator Ali Gohar and public contact cngohar@gmail.com, current Google/account/history/leaderboard/device-storage/security disclosures, provider links, deletion/retention limits, and children's/families wording. Prerendered HTML with client JavaScript disabled, readable without sign-in, title/description/canonical, accessible headings, and a visible draft/noindex state. Home and account/content footers link to it; gameplay has no footer overlay. Content is separate from the route layout and all copy uses the message catalog. Fixed the server hook's build guard so prerendering never reads unavailable Worker bindings. Added static-document/account-navigation and layout checks, plus `/privacy` in the isolated built-Worker smoke.
- **Skipped (and why):** No publication, Google submission, DNS/credentials/backend provisioning, or deployment. No admin editor/CMS, terms/blog/other new pages, analytics, age screen, or parental-consent flow. The owner selected under-13 guest games with child accounts deferred; this task records that decision and exposes the unimplemented safeguards instead of inventing an account flow. Later editable static pages belong to long-plan section 11.10 Stage 5.
- **Known issues:** This is deliberately a local draft, not a publication-ready policy or a legal-compliance determination. The under-13 guest-only/account-eligibility and data-collection safeguards must be designed, implemented, and reviewed before public accounts. Security/moderation/provider-log/backup retention periods and request handling still need owner review. Google's requirements and children's privacy considerations apply to actual behavior; a page alone does not establish those protections. `docs/PRIVACY_REVIEW.md` records the scope and blockers. Step 6 owner/physical-device acceptance remains open.
- **Decisions and pinned versions:** Owner chooses public OAuth verification before the full v1 launch, with final home/privacy information published first through a separately authorized, reviewed change. The local accounts configuration is not a policy-only deploy artifact. Keep Google-only sign-in, guest play, and existing dependency pins. Use the approved scrolling content template; no CMS schema or Markdown/HTML interpreter is added. Current SvelteKit prerender/CSR and Google/FTC primary sources are linked in `PRIVACY_REVIEW.md`; no dependencies changed.
- **Questions for the owner:** Review the local policy and the recorded under-13 guest-only direction. A separate safeguards/retention design review is needed before this policy can be finalized for Google submission. Admin editing and other static pages remain future scoped work.
- **Evidence table:**

| Acceptance item                                                                       | Evidence type                                   | Where                                                                            | Result                                                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Publicly readable policy without sign-in or JavaScript                                | Browser with JS disabled; built HTML inspection | `tests/e2e/privacy.spec.ts`; `.svelte-kit/output/prerendered/pages/privacy.html` | pass; generated HTML contains policy/contact details and no script tags |
| Owner/contact, draft blockers, canonical, and children's disclosure                   | Browser assertions and source review            | `privacy.spec.ts`, `src/lib/content/privacy.ts`, message catalog                 | pass                                                                    |
| Home/account links; no gameplay footer; mobile and desktop fit                        | Browser layout/navigation checks                | `privacy.spec.ts` at 390×844, 844×390, 1280×800, 320×480                         | pass                                                                    |
| Static-document navigation preserves sign-in                                          | Real local signed-session browser test          | privacy navigation case in `tests/e2e/accounts.spec.ts`                          | pass                                                                    |
| Existing account, recovery, game-layout, and input checks                             | Existing Chromium cases in full browser run     | `/tmp/morphi-privacy-e2e.log`                                                    | all 21 pre-existing cases pass                                          |
| Final new privacy/navigation checks                                                   | Focused Chromium run                            | `/tmp/morphi-privacy-focused.log`                                                | 3/3 pass; the new Play assertion waits for Home hydration               |
| Lint/format and type check                                                            | Project commands                                | `bun run lint`, `bun run check`                                                  | pass; 0 errors, 0 warnings                                              |
| Production build including prerender                                                  | Framework build                                 | `bun run test:worker`; `/tmp/morphi-privacy-worker.log`                          | pass after moving build guard before Worker binding reads               |
| Built Worker still serves public pages and validates/revokes real sessions            | Isolated temporary local D1 smoke               | `scripts/check-worker.ts`, `/tmp/morphi-privacy-worker.log`                      | 15 checks pass, including guest `/privacy`                              |
| Readable layout review                                                                | Local Chromium screenshots                      | `/tmp/morphi-privacy-390.png`, `-844.png`, `-1280.png`                           | inspected portrait and desktop; all sizes captured                      |
| Public publication / Google verification / children's safeguards / retention approval | Owner review and future implementation          | `docs/PRIVACY_REVIEW.md`                                                         | pending; no waiver or public-ready claim                                |
| CODEMAP and decision records                                                          | Documentation                                   | `docs/CODEMAP.md`, `docs/DECISIONS.md`, simple plan                              | updated                                                                 |

- **Measurements:** Layout checks use local desktop Chromium with the four viewport sizes above and normal scrolling for the policy; Home retains its no-scroll fit. No new timing/load-performance claim or median/p95 series was introduced. Existing Step 6 replay measurements remain unchanged.
- **Waivers:** None. The policy remains visibly draft/noindex; unresolved children's safeguards and retention review are not waived.
- **Owner responsibilities:** Review the wording, confirm the contact is monitored, and complete the separate safeguards/retention decisions and implementation review. Then review a concrete policy/home publication artifact or production rollout configuration and explicitly authorize its deployment before Google submission. Continue v1 release work after those gates; do not publish the current local backend configuration as a shortcut.
- **CODEMAP updated:** yes (145 lines).

## Step 6 local delivery and puzzle isolation — 2026-10-23

Status: implementation and automated local verification delivered. Owner acceptance and new physical-device review remain pending; Step 6 is not declared accepted or globally released.

- **Built:** Dedicated Memory/Block directories with pure rules, manifests/versions, local views/themes/components/tests and READMEs; pure shared engine and external seed entropy; generated headless catalog/app registry and linted dependency boundaries. New versioned completed runs queue at logical completion before animations, replay into account-owned history/bests, and retry idempotently through IndexedDB/backoff. Explicit guest import remains unranked. Added server-owned ranked starts, authoritative timed scoring, D1 caps/supersession/claims/recovery, bounded replay, compatible all-time boards, personal position, hide/ban/deletion consistency, and private API/cache handling. Added local role/TOTP moderation with transactional audits and a ranked kill switch. Public OAuth submission guide and local delivery/measurement docs are written.
- **Skipped (and why):** No production database/secrets, OAuth project/publication/brand submission, DNS change, repository publication, or deployment; this authorization is local. No full admin web panel, new game, expanded procedural themes, unfinished-round cross-device continuation, payments, multiplayer, analytics pipeline, or sharding. Global-release planning (including a web admin panel proposal) follows owner review. No admin is automatically enrolled.
- **Known issues:** The remaining real-phone check is owner-operated. Cross-device functionality is automated with two independent browser contexts; no physical second-device OAuth sign-in was claimed. Replay CPU and observed heap were measured, but allocation-time peak isolate memory, production request cost/capacity, and real-phone loading performance are unmeasured. Long Memory logs beyond the documented cap are retained locally with an explicit verification failure rather than saved/ranked. IndexedDB failure retains only in-memory pending results until acknowledged; the UI warns to keep the tab open. Ranked Memory wall time includes preview/background/submission delay, unlike solo active time; the saved-score line shows the authoritative result. Replay cannot establish human play. Local session/history retention, production key rotation/pending-data compatibility, and production admin recovery need review in the global-release plan.
- **Decisions and pinned versions:** No dependency upgrades. Keep TypeScript `~6.0.3`, Better Auth and Drizzle adapter `1.7.12`, Drizzle ORM `0.45.4`, kit `0.31.11`, Cloudflare adapter `8.0.1`, Wrangler `4.151.3`. Use stateful, opaque, account-bound D1 ranked sessions and conditional atomic claims for the short-plan scope instead of the long plan's stateless-token/Durable Object platform. Preserve game vectors and four fixed themes. Details, caps, timing, group/tie rules, and the moderation boundary are in the latest `DECISIONS.md` entry.
- **Questions for the owner:** Review the local account/history/leaderboard flows and a round on a physical phone, then accept or report issues. The following planning discussion should define the global-release scope and smallest useful protected admin panel; this report does not implement it.
- **Evidence table:**

| Acceptance item                                                                  | Evidence type                                               | Where                                                                                          | Result                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Guest play and Block-first/Memory rotation retained                              | Unit/browser regression                                     | `selector.test.ts`, `tests/e2e/layout.spec.ts`, `reliability.spec.ts`                          | pass                                                                |
| Google sign-in/out, cancellation, expired sessions, fresh deletion               | Owner-reported interactive OAuth; D1/browser tests          | owner confirmation in chat; `tests/integration/accounts.test.ts`, `tests/e2e/accounts.spec.ts` | local OAuth owner-confirmed; automated flows pass                   |
| Engine/puzzle isolation and unchanged generation/scoring                         | Import self-checks, independent vectors, unit regressions   | `scripts/check-boundaries.ts`, puzzle tests, `tests/vectors/`                                  | pass                                                                |
| New completed history, bests, account ownership/isolation                        | D1 tests and independent browser contexts                   | `tests/integration/runs.test.ts`, account browser suite                                        | pass for automated contexts; physical second device unverified      |
| Old browser bests and guest imports never become ranked scores                   | Replay/API and browser import tests                         | `runs.test.ts`, account browser suite                                                          | pass                                                                |
| Server chooses ranked seeds and computes scores                                  | D1 and actual built-Worker checks                           | `runs.test.ts`, `scripts/check-worker.ts`                                                      | pass                                                                |
| Malformed/forged/oversized/expired/superseded/conflicting submissions rejected   | D1/adversarial HTTP tests                                   | `runs.test.ts`, account browser suite                                                          | pass                                                                |
| Identical/concurrent retries and interrupted-claim recovery store one result     | D1 race tests; lost-response browser test; built Worker     | `runs.test.ts`, account browser suite, `check-worker.ts`                                       | pass                                                                |
| Finished result survives reload and interruption                                 | Logical-completion-before-animation and lost-response tests | account browser suite; `src/lib/ui/progress.ts`                                                | pass                                                                |
| Blocked storage remains playable with honest warning                             | Real browser API failure injection                          | account browser suite                                                                          | pass; persistence unavailable is explicitly disclosed               |
| Comparable groups, one best result/player, hidden/banned/deleted entries removed | Real D1 queries and browser/built-Worker deletion           | `runs.test.ts`, account browser suite, `check-worker.ts`                                       | pass                                                                |
| Necessary moderation permissions, second factor, and audits                      | D1 role/audit tests; RFC 6238 vector                        | `runs.test.ts`, `admin-totp.test.ts`, `docs/ADMIN_LOCAL.md`                                    | pass; owner enrollment not performed                                |
| Lint/format and zero-error/zero-warning type check                               | Full verification command                                   | `bun run verify`                                                                               | pass                                                                |
| Unit and account/ranked integration regressions                                  | Vitest                                                      | full verification: 95 unit and 15 integration tests                                            | pass                                                                |
| Browser account, recovery, input, and approved layouts                           | Chromium                                                    | full verification: 21 cases including 390×844, 844×390, 1280×800, smaller portraits            | pass                                                                |
| Node/Bun/Chromium/Firefox/WebKit/Worker vectors                                  | Independent-reference comparison                            | `bun run test:vectors`; fingerprint in `STEP6_MEASUREMENTS.md`                                 | pass                                                                |
| Production build and local built Worker                                          | Framework build, isolated temporary D1 smoke                | `bun run test:worker` within full verification                                                 | pass, 14 smoke checks                                               |
| Deployable bundle validation, without upload                                     | Wrangler dry run                                            | `/tmp/morphi-step6-bundle.log`                                                                 | pass: 2547.44 KiB / 475.44 KiB gzip; no upload                      |
| Replay CPU and memory observations documented                                    | Five warmed batches per workload, Node CPU and V8 inspector | `scripts/measure-replay.ts`, `STEP6_MEASUREMENTS.md`                                           | local observations recorded; true peak/production limits unverified |
| Physical phone and final local acceptance                                        | Owner review                                                | owner                                                                                          | pending; no waiver                                                  |
| Public OAuth instructions                                                        | Current official documentation review                       | `GOOGLE_OAUTH_PUBLIC.md`                                                                       | written; no remote action                                           |
| CODEMAP                                                                          | Documentation                                               | `docs/CODEMAP.md`                                                                              | updated                                                             |

- **Measurements:** Desktop AMD PRO A8-8650B/Linux, no network during replay, warmed, five batches of 1,000 replays/workload. Local Worker median/p95 batch-average sampled CPU per replay: Block 300 moves 0.750/0.768 ms; Memory 120 flips 0.0540/0.0721 ms. Maximum observed post-batch Worker used/allocated heap: Block 2,127,772/6,553,600 B; Memory 4,042,988/10,747,904 B. These are local baseline observations, not a new production CPU or peak-memory pass. Node comparison, exact method, fingerprint, device/network limitations, and unmeasured targets are in `STEP6_MEASUREMENTS.md`. No real-phone cold/preloaded median/p95 load series or production concurrency test was taken.
- **Waivers:** None added. The prior Step 5 replay-measurement waiver remains the owner's recorded exception; it is not reused for Step 6 device/memory/release evidence.
- **Owner responsibilities:** Review on a physical phone and accept the local delivery. If desired, enroll local moderation through `ADMIN_LOCAL.md`; protect its OS login and authenticator. Next, agree the global-release/admin-panel scope, operator/contact/age/retention details, and public pages. Only after concrete review should production Google/D1/secrets and deployment be authorized. Follow `GOOGLE_OAUTH_PUBLIC.md` at that time.
- **CODEMAP updated:** yes.

Newest first.

## Step 6: OAuth credentials and real sign-in start — 2026-10-23

- **Built:** Verified the owner’s new local OAuth credential fields are populated, the client ID has the expected format, and `.dev.vars` remains mode 0600; no credential values were printed. Restarted the local app to load them. Fixed the real SvelteKit sign-in action to explicitly allow its external redirect only to `https://accounts.google.com`. Previously, SvelteKit 3 rejected the redirect and returned a 500 before Google could handle it. Added a browser regression for the actual enhanced form, canonical callback, basic identity scopes, and HttpOnly/SameSite state cookie. Updated active status and Google Testing/brand-verification guidance.
- **Skipped (and why):** No user Google password, consent, or identity interaction was automated. No Google app publishing, brand submission, DNS change, production database, secret upload, or deployment. Saved progress and ranked scoring remain the next implementation slices after the real account flow is verified.
- **Known issues:** Reaching Google’s sign-in page does not verify the client secret/token exchange or create an account. The aggregate-only local D1 check found zero non-fixture Google-linked accounts and active sessions; full user login/callback is still pending. The local browser check reached Google with the expected callback, detected a sign-in page and no identified provider error/block, but did not authenticate. The new regression skips explicitly when OAuth credentials are absent; it passed with this configured local app.
- **Decisions:** Current SvelteKit docs and installed types require explicit external redirect permission. Use an origin allowlist instead of allowing arbitrary destinations. Keep the OAuth app in Testing, as reported by the owner. Development/testing does not require brand verification. Plan production publishing and brand verification for Morphi’s public Google-login release; basic `openid`, `email`, and `profile` scopes do not require sensitive/restricted-scope verification. Google’s current state table also gives basic-identity-only apps an exception to Testing allowlisting. No pinned versions changed.
- **Questions for the owner:** Complete a Google login in the normal browser at `http://localhost:5173/account/sign-in`, choose a public player name, sign out, and sign back in. This verifies the external identity/callback path that a test fixture cannot establish.
- **Evidence table:**

| Item                                                 | Evidence type                                           | Where                                                                              | Result                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Credentials present and local file protected         | Values inspected without printing them                  | Ignored `.dev.vars`; sanitized presence/format check                               | configured; mode 0600                                                                                    |
| App loads credentials                                | Browser UI/runtime check                                | Real `/account/sign-in`                                                            | Continue with Google enabled                                                                             |
| Actual form permits Google-only redirect             | Chromium regression with provider-boundary interception | `tests/e2e/accounts.spec.ts`; `/tmp/morphi-google-redirect-regression.log`         | 1 targeted case passes                                                                                   |
| Canonical callback, basic scopes, state-cookie flags | Same regression                                         | Callback `http://localhost:5173/api/auth/callback/google`; scope/cookie assertions | pass                                                                                                     |
| Real Google page reached                             | Chromium navigation without login                       | `/tmp/morphi-google-start-check.cjs`                                               | sign-in page detected, no identified provider error/block or page errors; no authenticated login claimed |
| Types                                                | Svelte/TypeScript                                       | `bun run check`; `/tmp/morphi-google-check.log`                                    | 0 errors, 0 warnings                                                                                     |
| Formatting/lint                                      | Prettier/ESLint                                         | `bun run lint`; `/tmp/morphi-google-lint.log`                                      | pass                                                                                                     |
| Production build                                     | Cloudflare adapter                                      | `bun run build`; `/tmp/morphi-google-build.log`                                    | pass                                                                                                     |
| Google token exchange and authenticated callback     | Owner-operated real login                               | Normal browser                                                                     | pending, not waived                                                                                      |

- **Measurements:** Local Vite and headless Chromium; no network throttling or latency benchmarking. The targeted browser regression took 11.4 seconds, a test duration rather than a user performance measurement. The provider-boundary regression avoids authenticating or storing personal identity. No median/p95 claim.
- **Waivers:** None. Real Google authentication remains a required check.
- **Owner responsibilities:** Complete the real login test. Keep Testing while development continues. Before public accounts, prepare the production OAuth project/client, canonical HTTPS callback, verified domain, public privacy/home information, and brand verification. Publishing OAuth settings and deploying the Worker are separate operations requiring the applicable owner authorization.
- **CODEMAP updated:** yes.

## Step 6: connect the approved result screen to real games — 2026-10-23

- **Built:** Replaced the old shared result card with the approved responsive result layout and connected it to the real Block/Memory completion flow. Next puzzle remains primary. Guests get a “Sign in with Google” link to `/account/sign-in`; signed-in players get their account link. The route passes server-layout session state into the result screen. Score, best/new-best/so-close, round summary, and Home/Next behavior remain intact. Added compact spacing down to 320x480 and message-catalog copy that describes current scores as local, without claiming account synchronization.
- **Skipped (and why):** No deployment, OAuth provisioning, database/schema change, game rules, score synchronization, ranked scoring, or leaderboard implementation. Those are outside this bounded correction. The standalone demo is still a reference; this change fixes its missing connection to the actual game.
- **Known issues:** Real Google login still needs the owner’s OAuth client. Saved history/cloud sync and ranked results remain outstanding Step 6 slices. The first full browser run passed all nine account/layout cases but the reused local Vite server stopped before the seven reliability cases (`ERR_CONNECTION_REFUSED`); after restarting it, all seven failed cases passed with `--last-failed`. This was an environment interruption, not an ignored test failure. Real-phone validation of the implemented result flow is not recorded.
- **Decisions:** Use the already approved result-screen design for both games. Show a sign-in entry point regardless of local OAuth readiness; the account page handles unavailable authentication and guest continuation. Until synchronization is implemented, the result says the best stays on this device and does not show “Saved to your account.” No dependencies or versions changed.
- **Questions for the owner:** None required for this fix. Use the local game to review actual completion; the public site has not received these changes.
- **Evidence table:**

| Acceptance item                                                               | Evidence type                                          | Where                                                                           | Result                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Real Block completion shows guest sign-in and retains Next rotation           | Chromium, four actual played rounds                    | `tests/e2e/layout.spec.ts`                                                      | pass at 390x844, 844x390, 360x640, 1280x800                                |
| Real Memory completion shows guest sign-in and follows it to the account page | Chromium, actual preview/flip/match flow               | `tests/e2e/accounts.spec.ts`                                                    | pass; browser best retained after navigation                               |
| Signed-in Memory result shows the account link and Next rotates to Block      | Chromium with signed local session fixture             | `tests/e2e/accounts.spec.ts`                                                    | pass; guest sign-in link absent                                            |
| Result fits small and approved viewports                                      | Chromium measurements                                  | Memory case at 320x480, 360x640, 390x844, 844x390, 1280x800; Block layout cases | no page overflow; guest link in viewport                                   |
| All browser cases                                                             | Full suite plus failed-case rerun after server restart | `/tmp/morphi-result-e2e-all.log`, `/tmp/morphi-result-e2e-retry.log`            | all 16 cases pass across the two runs                                      |
| Existing unit suite                                                           | Node/Vitest                                            | `bun run test:unit -- --run`; `/tmp/morphi-result-unit.log`                     | 94 tests pass                                                              |
| Types                                                                         | Svelte/TypeScript                                      | `bun run check`; `/tmp/morphi-result-check.log`                                 | 0 errors, 0 warnings                                                       |
| Formatting/lint                                                               | Prettier/ESLint                                        | `bun run lint`; `/tmp/morphi-result-lint.log`                                   | pass                                                                       |
| Production build                                                              | Cloudflare adapter                                     | `bun run build`; `/tmp/morphi-result-build.log`                                 | pass                                                                       |
| Built Worker real guest completion → sign-in                                  | Local Wrangler + Chromium, actual Memory round         | `/tmp/morphi-result-worker-smoke.cjs`, `/tmp/morphi-result-worker-smoke.log`    | pass; correct link, real account page, local best retained, no page errors |

- **Measurements:** Virtual Chromium viewports listed above, local dev server plus one built-Worker run at 390x844, no throttling. Actual completed rounds were used; results were not injected. Screenshot artifacts are in `/tmp/morphi-result-review-20261023/` (including the built Worker Memory result). Initial browser run took 2.9 minutes and the seven-case environment retry took 24.6 seconds; these are test durations, not user latency measurements. No median/p95 or real-device performance claim.
- **Waivers:** None. Failed cases were rerun successfully after restoring the local server.
- **Owner responsibilities:** Review `http://localhost:5173/` through Play and a completed round. `morphi.one` remains the prior owner-approved deployment; no deployment was performed. Follow `docs/GOOGLE_AUTH_SETUP.md` to enable real Google login when ready.
- **CODEMAP updated:** yes.

## Step 6: local accounts foundation — 2026-10-23

- **Built:** Recorded the owner’s approval of all five account-screen designs and proposed Step 6 scope. Implemented the first local slice with Better Auth, D1/Drizzle, Google-only authorization setup, server-owned sessions, separate public player names, database-enforced case-insensitive uniqueness, name edits, sign-out, and account deletion. Added approved Svelte account screens and a Home account link using the existing tokens and message catalog. Requests are constructed per Worker request, mutations are bounded to 16 KiB even without Content-Length, signed-out/revoked sessions cannot access account routes, and account responses are private/no-store. Deletion requires a session created in the last five minutes. Sign-out revokes the database session before asking Better Auth to clear cookies, so storage failures cannot silently leave a supposedly revoked session valid. Local D1 migrations, generated binding types, ignored credential setup, and owner Google setup instructions are included.
- **Skipped (and why):** Real Google login/callback verification is pending the owner’s OAuth client; the owner confirmed it does not exist yet. No remote database, Google project, deployment, web admin panel, new game, or gameplay/scoring change. Saved-round synchronization and validated ranked leaderboards are the next slices and are not claimed complete; the account page truthfully shows empty progress instead of mock scores. The standalone demo remains a reference artifact.
- **Known issues:** No real Google OAuth callback has been exercised. Account creation via Google, cancellation/denied consent, and provider credential errors need a real test once credentials exist. Local cookie/session tests use privileged helpers only in the test processes; no fixture endpoint or test-login path ships in the app. Real-device review of the implemented screens, Firefox/WebKit account verification, account-scale load measurements, and full Step 6 release hardening remain outstanding. The D1 ID and canonical base URL are explicitly local and must be replaced/reviewed before any production release. The browser tests use the same local D1 file as the dev app, so they create and remove reserved test accounts; fixture proxies are closed before browser requests to avoid competing local SQLite writers.
- **Decisions and pinned versions:** `better-auth@1.7.12`, `@better-auth/drizzle-adapter@1.7.12`, `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11`. Kept TypeScript `~6.0.3`, adapter-cloudflare 8.0.1, Wrangler 4.151.3, runtime date 2026-10-22, and `nodejs_als`. Seven-day sessions, daily update age, five-minute freshness for deletion, encrypted provider tokens, disabled password registration/account linking, explicit origin/CSRF checks, and database-backed auth rate limiting. Public names use 3–20 ASCII letters/numbers/underscores with official names reserved; Google profile fields are not used publicly. Secrets are read from `cloudflare:workers`, including the pinned adapter’s Vite emulation of `.dev.vars`. See `docs/DECISIONS.md` for generated-types and SvelteKit 3 API details.
- **Questions for the owner:** No further screen/scope approval needed. Create the Google OAuth web client using `docs/GOOGLE_AUTH_SETUP.md` and enter its credentials only in ignored `.dev.vars`; then the real provider flow can be tested. This is an external setup dependency, not a request to reapprove implementation.
- **Evidence table:**

| Acceptance item for this slice                                                                         | Evidence type                                  | Where                                                                                                                                | Result                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Screen and scope approval                                                                              | Explicit owner instruction                     | Conversation, 2026-10-23: “everything is approved you are authorized to go to next step”                                             | approved                                                                                                                             |
| Local D1 migration                                                                                     | Wrangler local migration and isolated D1 setup | `migrations/0000_flimsy_turbo.sql`; `bun run db:migrate:local`                                                                       | pass; six tables, no remote resource                                                                                                 |
| Signed/tampered/expired sessions, name races, origin checks, sign-out and deletion cascades            | Better Auth + real emulated D1 integration     | `tests/integration/accounts.test.ts`; `bun run test:accounts`                                                                        | 6 tests pass                                                                                                                         |
| Existing games and bounded request bodies                                                              | Node/Vitest                                    | `bun run test:unit -- --run`; `src/lib/server/request-body.test.ts`                                                                  | 94 tests pass across 9 files                                                                                                         |
| Three account layouts, two-account isolation, name-error correction, deletion freshness and revocation | Chromium/Playwright                            | `tests/e2e/accounts.spec.ts`                                                                                                         | 3 tests pass                                                                                                                         |
| Full account/layout/input/lifecycle suite                                                              | Chromium/Playwright                            | `bun run test:e2e`; `/tmp/morphi-accounts-e2e-all.log`                                                                               | 14 tests pass in 3.3 minutes                                                                                                         |
| Type-check                                                                                             | Svelte/TypeScript                              | `bun run check`; `/tmp/morphi-accounts-check-final.log`                                                                              | 0 errors, 0 warnings                                                                                                                 |
| Formatting and lint                                                                                    | Prettier/ESLint                                | `bun run lint`; `/tmp/morphi-accounts-lint-final.log`                                                                                | pass                                                                                                                                 |
| Production bundle                                                                                      | Adapter build                                  | `bun run build`; `/tmp/morphi-accounts-build-final.log`                                                                              | pass                                                                                                                                 |
| Built Worker with real D1/session operations                                                           | Isolated local Wrangler + Chromium             | `/tmp/morphi-account-worker-smoke.ts`; `/tmp/morphi-accounts-worker-result.json`; screenshots `/tmp/morphi-accounts-worker-screens/` | pass; profile at all 3 sizes, private cache headers, name edit, fresh deletion, revoked-session redirect, guest game; no page errors |
| Local secret values excluded from browser output                                                       | Byte scan, no values printed                   | `.svelte-kit/output/client/` (37 files) against the local auth secret                                                                | no matches                                                                                                                           |
| Real Google authorization completion                                                                   | Real provider/browser test                     | Owner OAuth client not yet created                                                                                                   | pending; not waived                                                                                                                  |
| Saved game history, ranked scoring, leaderboard and release gates                                      | Later Step 6 slices                            | `docs/STEP6.md`                                                                                                                      | outstanding; no Step 6 completion claimed                                                                                            |

- **Measurements:** Automated Chromium uses virtual 390x844, 844x390, and 1280x800 viewports. The built Worker smoke uses a separate temporary local D1 state directory, the same configured runtime flags, canonical localhost origin overridden to port 8787, no network throttling, and one profile capture per viewport. No horizontal overflow or page errors. Full browser-suite duration is 3.3 minutes; it is not a user latency measurement. No median/p95, real-device, load-capacity, or ranked-replay CPU/memory claim. Temporary logs/scripts/screenshots are session artifacts; outcomes are recorded durably here.
- **Waivers:** None added. The Step 5 replay-evidence waiver remains historical; real Google testing and Step 6 release checks are still required.
- **Owner responsibilities:** Follow `docs/GOOGLE_AUTH_SETUP.md`; do not send secrets in chat. Use `http://localhost:5173/account/sign-in` on the development machine for the exact configured callback. Report real-device issues. Remote D1 provisioning, production Google settings/secrets, and any deployment remain separate authorized operations.
- **CODEMAP updated:** yes.

## Step 6 Google choice and account-screen preview — 2026-10-23

- **Built:** Recorded the owner’s Google-only sign-in choice with guest play retained. Added an isolated local HTML review harness (`static/demo/accounts.html`) and five responsive proposed screens: Sign in, Choose player name, Your account, After a round, and Leaderboard. Included normal/cancelled/failed/offline connection samples, an in-memory sign-in/name flow, public-name validation samples, edit/sign-out, deletion confirmation, and game/Memory-size filters. Reused the existing self-hosted Nunito subset and palette tokens; prototype copy lives in its own message catalog. Documented the database and administration sequence in `docs/STEP6.md`.
- **Skipped (and why):** Production UI/authentication, migrations/database creation, real Google access, new dependencies, admin panel, gameplay changes, and deployment. The owner requested a demo to review before accepting screens. Sample actions do not persist or perform real sign-in, saving, deletion, or scoring.
- **Known issues:** New-screen approval is pending. Profile history scrolls at phone sizes and short landscape; the landscape leaderboard also scrolls. Preview Play/Next shows a notice instead of starting the games. Public-name rules, deletion policy, leaderboard windows, and saved-progress scope remain design proposals. Real-phone review and real Google/D1 integration are not established by this preview.
- **Decisions:** Google sign-in selected by the owner. Start account storage with local D1 using the locked Better Auth stack; no resource was created. A full admin web panel is not a prerequisite: the full plan’s Stage 0 audit-logged command tool precedes it. Current Better Auth Google/database and Cloudflare D1 local-development documentation checked 2026-10-23. No pinned dependency versions changed.
- **Questions for the owner:** Review the screens and request adjustments or accept the layouts. Approve remaining progress/leaderboard/public-name/deletion choices before production implementation.
- **Evidence table:**

| Item                                                            | Evidence type                                 | Where                                                                      | Result                                                       |
| --------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Google sign-in choice                                           | Explicit owner instruction                    | Conversation, 2026-10-23: “i chose your recommandation of google accounts” | selected                                                     |
| Five screens at all three requested sizes                       | Chromium browser measurements and screenshots | `/tmp/morphi-account-review/`; script `/tmp/morphi-account-review.cjs`     | 15 combinations pass horizontal fit; no unnamed icon buttons |
| Sign-in/name validation/edit/sign-out and deletion confirmation | Chromium interaction checks                   | Same script; `results.json`                                                | pass                                                         |
| Cancelled/failed/offline sign-in retains guest continuation     | Chromium interaction checks                   | Same script                                                                | pass                                                         |
| Game/Memory-size grouping and review-harness synchronization    | Chromium interaction checks                   | Same script                                                                | pass                                                         |
| Browser errors                                                  | Chromium page/console capture                 | Same script                                                                | none                                                         |
| New prototype JavaScript lint                                   | ESLint API, project config                    | `accounts.js`, `accounts-review.js`, `accounts.messages.js`                | 0 errors, 0 warnings                                         |
| Formatting                                                      | Prettier API, project config                  | Changed prototype and documentation files                                  | pass                                                         |
| Owner screen approval                                           | Owner review                                  | `http://localhost:5174/demo/accounts.html`                                 | pending                                                      |

- **Measurements:** Local static HTTP server and headless desktop Chromium, no network throttling; one layout capture per screen/viewport. Exact viewports: 390x844, 844x390, 1280x800. No horizontal overflow in 15 combinations. Sign-in, name entry, and result fit vertically in all three sizes; desktop profile fits 800 px. Phone profile content height 975 px; landscape profile 695 px and leaderboard 653 px, intentionally scrollable. No performance gate or median/p95 claim. `/tmp` screenshots/scripts are temporary session artifacts; outcomes are recorded here.
- **Waivers:** None added. Layouts are proposed and unaccepted; this is not a Step 6 completion report.
- **Owner responsibilities:** Review the local demo (including on a phone). Google OAuth credentials and remote D1 provisioning will need the applicable setup/authorization when integration begins. Deployment still requires a separate owner instruction.
- **CODEMAP updated:** yes.

## Step 5 owner acceptance and Step 6 planning — 2026-10-23

- **Built:** Recorded the owner's acceptance of the public-test result and prepared `docs/STEP6.md` with a proposed sequence for accounts, completed-progress sync, server-validated scores, and leaderboards. Updated the active status in the simple plan, agent instructions, decisions, and CODEMAP.
- **Skipped (and why):** No runtime changes, dependency installation, authentication implementation, new games, remote resource creation, or deployment. The owner requested the next-step approach; authentication and new-screen choices remain unresolved.
- **Known issues:** Replay counts and the predetermined threshold are still unavailable. The acceptance is owner judgment, not a measured retention or replay claim. Existing browser bests cannot be replay-validated because they contain no move logs.
- **Decisions:** Step 5 is accepted. Google-only sign-in with guest play is recommended but not selected. Step 6 planning draws only relevant requirements from the full plan.
- **Questions for the owner:** Select the sign-in method; review the saved-progress and leaderboard scope before implementation. Account/Profile/Leaderboard wireframes will need approval before screen implementation.
- **Evidence table:**

| Acceptance item                                    | Evidence type                 | Where                                                            | Result                                               |
| -------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| Owner accepts the public-test result               | Explicit owner instruction    | Conversation, 2026-10-23: "i ill maccept the public test result" | accepted by owner judgment                           |
| Second-round share against predetermined threshold | No measured evidence supplied | Prior public-test feedback report                                | waived by owner acceptance; no measured pass claimed |
| Proposed Step 6 sequence and unresolved choices    | Documentation                 | `docs/STEP6.md`                                                  | prepared; implementation not begun                   |

- **Measurements:** No new performance measurements; documentation-only change.
- **Waivers:** The owner accepts proceeding from Step 5 without the missing replay counts and predetermined threshold. Risk: positive sentiment may not predict repeat play.
- **Owner responsibilities:** Choose authentication, review upcoming wireframes, and provide provider setup/credentials when needed. Any remote resource creation or deployment requires the applicable authorization.
- **CODEMAP updated:** yes.

## Owner-approved production release — 2026-10-23

- **Built:** Deployed the merged reliability fixes with `bun run deploy` after explicit owner authorization ("if all successfull then deploy the latest changes"). Worker `morphi-one`, version `fb89f416-e757-4015-9d94-0741a7b5bf95`, deployment `6c735baf-ccb7-4c1a-8629-6a3a7bd6750f`, created `2026-10-23T04:39:40.274344Z`, serves 100% of traffic. Pre-deploy comparison found all 49 deployable source/config/assets files identical to merged commit `32ed6bf6bcb58f16d9d44e904ab3ca695e378ee0`. Cloudflare MCP identity, docs/spec search, settings, domain, and deployment reads also succeeded.
- **Skipped (and why):** No new game, feature, dependency upgrade, CI/automatic deploy, database, resource creation, or DNS change. No real-phone, Firefox, or WebKit run in this release; automated browser coverage is Chromium.
- **Known issues:** Previously documented simple-build limitations remain, including no reload recovery, first-hint behavior, and incomplete generic handler guards. The old browser-run environment blocker is resolved: all 11 existing/new browser tests now pass. Virtual phone viewports do not establish real-device performance.
- **Decisions and pinned versions:** Kept Wrangler 4.151.3, adapter-cloudflare 8.0.1, runtime compatibility date `2026-10-22`, and `nodejs_als`. The same `ASSETS` binding, `morphi.one` attachment, and nested logs/traces/issues settings were verified before and after deployment. GitHub remains source backup; releases remain manual and owner-approved. Previous version: `6d71da4d-d24b-4ba0-973e-6e63daff2887`.
- **Questions for the owner:** None required for this release.
- **Evidence table:**

| Item                                  | Evidence type                                 | Location                                                                                                    | Result                                |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Source matches merged PR              | Git blob comparison                           | 49 source/config/assets files against merged commit above                                                   | pass; no differences                  |
| Formatting and lint                   | Prettier/ESLint                               | `bun run lint`                                                                                              | pass                                  |
| Types                                 | Svelte/TypeScript                             | `bun run check`                                                                                             | pass; 0 errors/warnings               |
| Unit regression suite                 | Node/Vitest                                   | `bun run test:unit -- --run`                                                                                | pass; 92 tests, 8 files               |
| Layout/input/lifecycle browser suite  | Chromium/Playwright                           | `bun run test:e2e`, `tests/e2e/`, screenshots under `test-results/`                                         | pass; 11 tests in 1.9 minutes         |
| Production build and packaging        | Adapter build and Wrangler dry run            | `bun run deploy:dry`; `/tmp/morphi-deploy-dry-20261023.log`                                                 | pass                                  |
| Built Worker behavior                 | Local Wrangler + Chromium                     | `/tmp/morphi-deployment-smoke.cjs`, `http://127.0.0.1:8794`                                                 | pass; 390x844, 844x390, 1280x800      |
| Production rollout                    | Wrangler output and Cloudflare deployment API | `/tmp/morphi-deploy-20261023.log`; deployment/version above                                                 | pass; version at 100%                 |
| Live site behavior and updated bundle | Chromium HTTP/browser checks                  | `https://morphi.one`, `https://morphi-one.electrasincng.workers.dev`; `/tmp/morphi-live-smoke-20261023.log` | pass; both origins in all 3 viewports |
| Bindings/runtime/domain preservation  | Before/after Cloudflare MCP reads             | settings, domains, deployments APIs for `morphi-one`                                                        | pass                                  |

- **Live checks:** HTTP 200, title, description, one Home h1, Block's 64-cell board, Home/Play rotation into Memory, Memory flip input, no page overflow, and no console/page errors. The served game bundle contains `morphi:round_start_failed`, `morphi:pointer_capture_failed`, and `lostpointercapture`, confirming the new reliability code is live.
- **Measurements:** Wrangler reported 354.03 KiB upload / 83.37 KiB gzip and 10 ms startup (single tool-reported values, not latency gates). Smoke used headless desktop Chromium with virtual viewports, no network throttling, new browser contexts, one visit per viewport/origin. No statistical load/input measurement, median, or p95 is claimed. The 11-case suite took 1.9 minutes; this is test duration, not player performance. Temporary `/tmp` logs/scripts are session artifacts; outcomes and release identifiers are recorded here durably.
- **Waivers:** None added.
- **Owner responsibilities:** Continue player surveys; report real-device issues. Every future deployment still requires separate owner authorization.
- **CODEMAP updated:** yes.

## Cloudflare project-local setup follow-up — 2026-10-23

- **Built:** Installed 19 Cloudflare skills in `.agents/skills`, generated `skills-lock.json`, and registered the enabled Cloudflare MCP server in `.codex/config.toml`. Completed browser OAuth with read-only account/Worker diagnostic scopes plus offline access.
- **Skipped:** Global installation/configuration, the optional `cf` CLI, deployment, and infrastructure changes. The current conversation needs a reload before it can invoke newly registered MCP tools.
- **Known issues:** MCP API/tool access has not been exercised after login; authentication success does not establish that every API operation is available with the selected scopes. No gameplay changes.
- **Decisions:** Project-only configuration; Wrangler remains the deployment tool. Codex manages OAuth credentials outside the repository. Installation paths and scopes are recorded in `docs/CLOUDFLARE_AGENT_SETUP.md`.
- **Questions for the owner:** None.
- **Evidence table:**

| Item                                | Evidence type                          | Location                                                                        | Result                              |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------- |
| Project directories writable        | Create/delete probes                   | `.agents`, `.codex`                                                             | pass                                |
| Project-local skill installation    | Filesystem and CLI inventory           | `.agents/skills`, `skills-lock.json`, `npx -y skills list --agent codex --json` | pass; 19 skills                     |
| Local MCP registration              | Config parse and CLI inventory         | `.codex/config.toml`, `codex mcp list --json`                                   | pass; Cloudflare enabled            |
| Browser OAuth                       | Login completion and credential status | `codex mcp login cloudflare`, subsequent MCP listing                            | pass; successful login and `o_auth` |
| MCP API access in this conversation | Tool invocation                        | Awaiting agent reload                                                           | not run                             |

- **Measurements:** No performance targets apply to this setup; no gameplay measurements were run.
- **Waivers:** None.
- **Owner responsibilities:** Restart/reopen the agent to load the new MCP tools. Production deployments remain separately approved.
- **CODEMAP updated:** yes.

## Engineering reliability review — 2026-10-23

- **Built:** Fixed stale best/sound reads after failed writes; retained the last readable settings when storage later blocks; rejected malformed score strings. Memory now pauses mismatch and hide deadlines while hidden and does not start preview on an initially hidden mount. Failed round starts retain the queued family and the previous screen; duplicate synchronous Play activations start one round. Block uses final release coordinates, ignores secondary pointers, cancels on lost capture/blur, ignores repeated activation keys, and cancels pending focus/click-suppression work on unmount. Unit tests run independently of the Cloudflare runtime; browser tests and config files are included in type-checking.
- **Skipped (and why):** No new games, tutorial UI, accounts, architecture migration, dependencies, CI, or deployment. Cloudflare project-local setup was investigated and documented, but installation/activation is blocked by this workspace's read-only `.agents` and `.codex` directories; no global changes were made.
- **Known issues:** The new browser regressions are unexecuted: the dev server fails with `listen EPERM 127.0.0.1`, and standalone Chromium launch fails with `sandbox_host_linux.cc: shutdown: Operation not permitted`. Real-device, Firefox, and WebKit checks remain unperformed. Existing first-hint behavior (consumed at start, hidden in short landscape), no reload recovery, and incomplete guards around existing event/timer callbacks remain outside this bounded repair. Session storage fallback cannot persist through reload if disk writes fail.
- **Decisions and pinned versions:** No dependency or gameplay-version changes. Standalone Vitest config, visible-time UI deadlines, and project-only Cloudflare setup are recorded in `docs/DECISIONS.md`.
- **Questions for the owner:** None required to review the code. Browser/device verification is needed before considering deployment. Cloudflare activation needs writable project config directories and subsequent browser OAuth authorization.
- **Evidence table:**

| Acceptance item                                    | Evidence type                              | Location                          | Result                                                                  |
| -------------------------------------------------- | ------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------- |
| Storage corruption and failed-write fallback       | Unit regressions                           | `src/lib/ui/storage.test.ts`      | pass; earlier comparison against original code reproduced four failures |
| Visible-time UI deadlines and cancellation         | Fake-clock unit tests                      | `src/lib/ui/active-delay.test.ts` | pass                                                                    |
| Existing rule, RNG, selector, and palette tests    | Node/Vitest                                | `bun run test:unit -- --run`      | 92 tests pass across 8 files                                            |
| Types, including new browser cases and test config | Svelte/TypeScript                          | `bun run check`                   | 0 errors, 0 warnings                                                    |
| Formatting and lint                                | Prettier/ESLint                            | `bun run lint`                    | pass                                                                    |
| Production bundle                                  | Local build                                | `bun run build`                   | pass with Cloudflare adapter; no upload                                 |
| Browser regression discovery                       | Playwright listing                         | `bun run test:e2e -- --list`      | 11 cases discovered in 2 files                                          |
| Retry, drag, keyboard, visibility integration      | Browser tests                              | `tests/e2e/reliability.spec.ts`   | blocked by local listener/browser sandbox; no browser pass claimed      |
| Project-local Cloudflare agent setup               | Read-only inspection/current official docs | `docs/CLOUDFLARE_AGENT_SETUP.md`  | blocked; no MCP registration, OAuth, or new skill installation          |

- **Measurements:** No new latency/load performance measurements; device/network profile, cold/preloaded runs, median, and p95 are not available. Fake-clock tests establish deadline behavior, not device performance.
- **Waivers:** None. Browser verification is blocked, not waived.
- **Owner responsibilities:** Review the maintenance changes; verify affected paths in a browser/phone when the environment allows. Decide deployment separately. Allow standard project config directories to be written before Cloudflare MCP activation.
- **CODEMAP updated:** yes.

## Step 5 public-test feedback and source handoff — 2026-10-23

- **Built:** No gameplay changes. Updated the active-plan instructions and recorded the owner's completed manual public test. Prepared the existing project for the owner-authorized private GitHub repository `cngohar/morphi.one1`, excluding local secrets and generated artifacts.
- **Skipped (and why):** No deployment, analytics integration, architecture migration, accounts, leaderboard, new games, or tutorial implementation; these were not authorized by this update.
- **Known issues:** Exact round-start, Next, unique second-round-player counts, and the predetermined offline threshold were not supplied. Positive feedback cannot establish the replay-rate acceptance criterion. Devices, browsers, test duration, and the positive-feedback denominator are not recorded. Some players gave no feedback; their reasons are unknown.
- **Decisions and pinned versions:** The simple plan is the active plan; the full plan remains reference. No dependency versions changed. The owner authorized private GitHub source publication; deployment still requires separate permission.
- **Questions for the owner:** Choose the next bounded piece of game work, or accept the Step 5 replay gate using the manual tally. More games satisfying the remaining players is an untested hypothesis.
- **Evidence table:**

| Item                                               | Evidence type                     | Location                                  | Result                                             |
| -------------------------------------------------- | --------------------------------- | ----------------------------------------- | -------------------------------------------------- |
| Public-test reach (about 50 people)                | Owner report: 45+ players         | Owner message, 2026-10-23; this report    | pass as approximate reach; exact count unavailable |
| Player sentiment                                   | Owner report: over 60% positive   | Owner message, 2026-10-23; this report    | encouraging feedback; not the replay gate          |
| Second-round share against predetermined threshold | Manual paper record held by owner | Counts and threshold not supplied in repo | unverified; no pass or waiver recorded             |

- **Player feedback:** Some asked why the games were so simple or called them basic. One asked about a missing tutorial; the owner explained that the games were familiar. One asked about future plans. Some provided no feedback. The owner suggested more games might satisfy the remaining players; this has not been validated.
- **Measurements:** No new performance measurements; device/network profile, run count, median, and p95 unavailable. The reported 60% is positive sentiment, not replay or retention.
- **Waivers:** None recorded for the replay criterion.
- **Owner responsibilities:** Keep the manual tally; supply the replay result or explicitly decide how to close that gate, and choose the next implementation scope.
- **CODEMAP updated:** yes.

Source-upload verification (2026-10-23): `bun run lint` passed; `bun run check` found 0 errors and 0 warnings. `bun run test:unit -- --run` could not initialize because the environment denied its local listener (`listen EPERM 127.0.0.1`); no unit-test pass is claimed. No build or browser suite was rerun for this documentation/source upload. The upload includes 78 project files; generated output, dependencies, local environment files, and agent/credential directories are excluded. Scans found no private-key/common-token patterns or copies of local environment secret values in the upload candidates. The temporary Git checkout is `/tmp/morphi-one1-upload-20261023`; the workspace's `.git` directory is managed read-only, so a normal local Git checkout still requires a writable location.

## Step 4 layout fixes and project Playwright — 2026-10-22

- **Built:** Three owner-reported mobile layout fixes plus a persistent browser-test setup.
  - Block: the short-landscape and desktop stage is now a symmetric three-column grid (`1fr auto 1fr`), with the board in the center column and the tray in the side column. This removes the previous 54 px (844x390) and 75 px (1280x800) horizontal board offset while keeping the desktop 520 px board cap and the tray beside it.
  - Memory: added phone-portrait, short-landscape (`orientation: landscape` and height <= 560 px), and wide (`min-width: 1024px`) layout modes. Phone portrait uses 3 columns for 6 pairs and 4 otherwise (10 pairs becomes 4x5); short landscape uses `columns = pairs` and two rows (6x2, 8x2, 10x2); wide keeps 4/4/5 columns. Board width now uses the available height more fully, and short landscape reserves room for the centered board/tray layout.
  - Memory HUD: stat numbers are now `clamp(0.9375rem, 0.85rem + 0.35vw, 1.125rem)` (about 15-18 px) instead of the previous 24 px landscape values.
  - Playwright is now a repo dev dependency pinned at `@playwright/test@1.64.1`, with `playwright.config.ts`, `tests/e2e/layout.spec.ts`, and `bun run test:e2e`. The config reuses a running dev server and writes artifacts to the ignored `test-results/` directory. The audit runs at 390x844, 844x390, 360x640, and 1280x800 and checks no page scroll, Block board centering, Memory board centering/fit, Memory columns, HUD type size, and 6-pair card widths; it attaches screenshots for review.
- **Skipped (and why):** No Step 5 work. No engine, rules, scoring, theme, or message changes. No new browser engines: the project audit is Chromium-only for now; Firefox/WebKit coverage remains a later gate. No agent-run real-phone test; the owner verified both games in portrait and landscape on 2026-10-22. No committed screenshot gallery.
- **Known issues:** Phone-portrait 8- and 10-pair Memory boards remain width-limited, so their cards are close to the previous size; the fix mainly enlarges the 6-pair portrait layout and the 6-pair landscape layout. The normal four-run suite observed 8-pair phone portrait, 8-pair small portrait, 10-pair landscape, and 6-pair desktop; a separate layout-only run with the pair count pinned to 6 confirmed the 3x4 portrait layout (359 px board, about 115 px cards), then was reverted. The owner verified both games in portrait and landscape on 2026-10-22. The short-landscape board-width reservation means a 640x360 Block board is narrower than the old uncentered layout, but it is now centered and the tray no longer shifts it. Step 4 was accepted after that recheck.
- **Decisions and pinned versions:** Playwright `@playwright/test@1.64.1` is a dev dependency; `test-results/`, `playwright-report/`, `blob-report/`, and `playwright/.cache/` are gitignored. Memory modes and column counts are recorded in `docs/DECISIONS.md`; no existing pins changed.
- **Questions for the owner:** Resolved. The owner verified both games on a phone in portrait and landscape on 2026-10-22 and accepted Step 4.
- **Evidence table:**

| Acceptance item                                   | Evidence type            | Where                                                | Result                                   |
| ------------------------------------------------- | ------------------------ | ---------------------------------------------------- | ---------------------------------------- |
| Block board centered at four viewports            | Chromium automation (4)  | `tests/e2e/layout.spec.ts`                           | pass (center delta <= 1 px)              |
| No page scroll at four viewports                  | Chromium automation (4)  | `tests/e2e/layout.spec.ts`                           | pass                                     |
| Memory board centered and inside stage            | Chromium automation (4)  | `tests/e2e/layout.spec.ts`                           | pass                                     |
| Memory columns per layout mode                    | Chromium automation (4)  | `tests/e2e/layout.spec.ts`                           | pass (observed modes)                    |
| Memory HUD stat size <= 18 px                     | Chromium automation (4)  | `tests/e2e/layout.spec.ts`                           | pass                                     |
| 6-pair card width floors                          | Chromium automation      | `tests/e2e/layout.spec.ts` (desktop 6-pair observed) | pass                                     |
| Full unit suite                                   | Unit tests (74, 7 files) | `bun run test:unit -- --run`                         | pass                                     |
| Format and lint                                   | `bun run lint`           | terminal                                             | pass                                     |
| Type-check                                        | `bun run check`          | terminal                                             | pass (0 errors, 0 warnings)              |
| Production build                                  | `bun run build`          | terminal                                             | pass (expected `adapter-auto` warning)   |
| Screenshots for Block and Memory at four sizes    | Playwright attachments   | `test-results/layout-*/`                             | pass (regenerated by `bun run test:e2e`) |
| Owner recheck of the three reported layout faults | Owner review             | real phone, portrait and landscape (2026-10-22)      | pass; Step 4 accepted                    |
| CODEMAP updated                                   | Doc                      | `docs/CODEMAP.md`                                    | yes                                      |

- **Measurements:** Before the fix, Block board center offsets were 0 px at 390x844, -54 px at 844x390, -75.2 px at 1280x800, and 0 px at 360x640; after the grid change all four are within 1 px. Memory stat numbers were 16.38 px at 390x844 and 24 px at 844x390 before; the new clamp caps them at 18 px. The 6-pair phone-portrait layout is 3x4 with a 359 px board and about 115 px cards; desktop Memory at 1280x800 with 6 pairs is 4x3 with a 672 px board; desktop Block remains 520 px. The four Playwright runs completed in 1.5-1.9 minutes total. These are local Chromium measurements, not performance gates.
- **Waivers:** None new. The owner's previous board-visibility exception and the 1500 ms fill-only clear override are unchanged.
- **Owner responsibilities:** Step 4 is closed. Step 5 (public test) needs owner decisions on the host, analytics, and the replay threshold before any deployment. Do not start Step 5 from this report. The Step 2 Next-rate tally and exact Step 3 device record remain missing.
- **Owner acceptance:** Step 4 accepted on 2026-10-22 after a real-phone portrait and landscape recheck.
- **CODEMAP updated:** yes

## Step 4 Memory theme addition (simple plan) — 2026-10-20

- **Built:** Owner-promoted Memory theme randomization so both games are complete before public testing. The simple plan did not include Memory themes, but the long plan does (`docs/PLAN.md` item 2), and the owner asked for the same treatment as Block. Added `src/lib/ui/memory-themes.ts`: the same four theme ids and backdrops as Block; the Memory round seed picks one and themes the backdrop, card back/edge/face/matched, back mark, four symbol colors, and win confetti. `GameScreen.svelte` applies the theme via inline CSS variables, maps each card's symbol color to the theme palette, and passes theme colors to `Confetti`; `MemoryCard.svelte` uses the themed edge and mark. Engine data, rules, timer, scoring, and replay are unchanged. Added 5 Memory-theme unit tests and an 8-check Chromium harness; the suite is now 74 tests in 7 files.
- **Skipped (and why):** No new theme ids, no theme-choice UI, no theme transition, no theme persistence or lock, no Memory theme on the shared Result screen, and no extra symbol sets. No new dependency.
- **Known issues:** The browser harness observed real rounds in Sky and Garden; Shapes and Ocean are covered by unit contrast tests, not screenshots. Card back/background is 1.24–1.27:1 because Memory reuses the Block cell/backdrop; the 3.28–4.47:1 card border carries the boundary, which is a lighter treatment than the previous dark neutral border. No real-phone run for the themed Memory screen, and Step 4 is still awaiting owner acceptance.
- **Decisions and pinned versions:** Same four theme ids and backdrops as Block; Memory card surfaces reuse the Block cell/tray/tray-slot values; card border uses the theme's second piece color; back mark uses a dark theme color; symbols use the theme palette with `--warning-text` in place of the low-contrast warning fill; matched border uses the mark color; all contrast floors are unit-tested. No dependency pins changed.
- **Questions for the owner:** Do the themed card borders and symbol palettes look right in all four themes? Is the Back-first Memory look acceptable, or should Memory get its own theme set later? Step 4 remains unaccepted until you confirm.
- **Evidence table:**

| Acceptance item                                    | Evidence type            | Where                                       | Result                                 |
| -------------------------------------------------- | ------------------------ | ------------------------------------------- | -------------------------------------- |
| Memory uses the four Block theme ids/backdrops     | Unit test                | `src/lib/ui/memory-themes.test.ts`          | pass                                   |
| Card, mark, and symbol contrast per theme          | Unit tests               | `src/lib/ui/memory-themes.test.ts`          | pass                                   |
| Same seed gives the same theme; all four reachable | Unit test                | `src/lib/ui/memory-themes.test.ts`          | pass                                   |
| Real Memory round renders the selected theme       | Chromium automation (8)  | `/tmp/opencode/morphi-test/memory-theme.ts` | pass (Sky and Garden observed)         |
| Themes survive rotation from Block to Memory       | Chromium automation      | `memory-theme.ts` (block round auto-played) | pass                                   |
| Full unit suite                                    | Unit tests (74, 7 files) | `bun run test:unit -- --run`                | pass                                   |
| Format and lint                                    | `bun run lint`           | terminal                                    | pass                                   |
| Type-check                                         | `bun run check`          | terminal                                    | pass (0 errors, 0 warnings)            |
| Production build                                   | `bun run build`          | terminal                                    | pass (expected `adapter-auto` warning) |
| No page or console errors                          | Chromium automation      | `memory-theme.ts`                           | pass                                   |
| CODEMAP updated                                    | Doc                      | `docs/CODEMAP.md`                           | yes                                    |

- **Measurements:** No load-performance gate for themes. Local Chromium at 390x844; no median/p95.
- **Waivers:** The Block board-visibility exception now also covers Memory card back/background (1.24–1.27:1) because the same theme surfaces are reused; the 3.28–4.47:1 border provides the card boundary. No new waiver requested.
- **Owner responsibilities:** Review the themed Memory screenshots or play a Memory round, confirm the visual direction, and accept or revise Step 4. Real-phone testing is still pending.
- **CODEMAP updated:** yes

## Step 4 rotation addition (simple plan) — 2026-10-20

- **Built:** Owner-requested Play/Next variety after the Step 4 review ("the same puzzle came again"). Added `src/lib/selector.ts`: a pure weighted-shuffle-bag selector with an injected RNG, a first-impression family, and a no-immediate-repeat rule; with the two eligible families it strictly alternates. The route now picks a family on every Play/Next, creates that family's round from a fresh crypto seed, and routes Block (`data-family="block"`) or Memory (`data-family="memory"`) through the same Home/Game/Result flow. Memory is routed again. Themes were Block-only at this point; Memory themes were promoted separately (see the Memory theme addition above). Added per-family best (`morphi.block.best`, `morphi.memory.best`), per-family result titles/summaries/live announcements, per-family start-error text, and a Home best that follows the family Play will start. Added 7 selector unit tests, 14 rotation browser checks, and updated the Step 4 browser harness to skip Memory rounds and to verify the gain chip. The full unit suite was 69 tests in 6 files at this point; it is 74 in 7 after the Memory theme addition above.
- **Skipped (and why):** No Stay/Pick/Exclude settings, no config JSON or weights beyond equal block/memory, no cross-reload rotation history, no Instant Next preloading, and (at this point) no Memory themes; Memory themes were promoted separately after this fix. No new dependency; Playwright 1.64.1 stays temporary.
- **Known issues:** Rotation state is in-memory only: a reload restarts at Block, and a player who leaves mid-session cannot resume the sequence. The first family is hard-coded to Block (the main game); Memory had no theme variants at this point, which the Memory theme addition above changes. The round counter and Best meta count both families, while Best is per family. Browser evidence is local Chromium only; no real-phone run for rotation. Step 4 is still awaiting owner acceptance.
- **Decisions and pinned versions:** Selector bag with equal weights; first family Block; two families alternate and never repeat in a row; single eligible family repeats; disabled/no family state throws into the existing start-error path. Themes were Block-only at this point; see the Memory theme addition above. Memory result uses the shared ResultScreen with `result.title`/`result.summary`, a 250-point so-close gap, and `result.announce`. Home best follows the upcoming family. No dependency pins changed.
- **Questions for the owner:** Is Block-first (then Memory) the right first impression, or should the first family be random? Should Memory get its own theme set (the owner has since promoted the same four themes; confirm the look)? Should the rotation resume across reloads? Do you want a Stay option later? Rotation is part of the Step 4 review, so Step 4 is not accepted until you confirm.
- **Evidence table:**

| Acceptance item                                         | Evidence type            | Where                                    | Result                                 |
| ------------------------------------------------------- | ------------------------ | ---------------------------------------- | -------------------------------------- |
| Selector never repeats a family and alternates two      | Unit tests (7)           | `src/lib/selector.test.ts`               | pass                                   |
| Selector is reproducible from an injected RNG           | Unit test                | `src/lib/selector.test.ts`               | pass                                   |
| Full unit suite                                         | Unit tests (74, 7 files) | `bun run test:unit -- --run`             | pass                                   |
| Play rotates Block, Memory, Block and Home best follows | Chromium automation (14) | `/tmp/opencode/morphi-test/rotation.ts`  | pass                                   |
| Memory result screen and Next rotates back to Block     | Chromium automation      | `rotation.ts` (memory round auto-played) | pass                                   |
| Block screen unchanged under rotation                   | Chromium automation (29) | `/tmp/opencode/morphi-test/step4.ts`     | pass                                   |
| Format and lint                                         | `bun run lint`           | terminal                                 | pass                                   |
| Type-check                                              | `bun run check`          | terminal                                 | pass (0 errors, 0 warnings)            |
| Production build                                        | `bun run build`          | terminal                                 | pass (expected `adapter-auto` warning) |
| No page or console errors                               | Chromium automation      | `rotation.ts`, `step4.ts`                | pass                                   |
| CODEMAP updated                                         | Doc                      | `docs/CODEMAP.md`                        | yes                                    |

- **Measurements:** No load-performance gate for rotation. Local Chromium only; first Play to interactive is the same block arrival path as Step 4; Memory round reaches the shared result screen within the existing Step 1 budget. No median/p95.
- **Waivers:** None new. The Step 4 board-visibility exception and the 1500 ms clear override are unchanged.
- **Owner responsibilities:** Confirm the rotation behavior and the Block-first choice; review the Memory themes added above and decide whether rotation should persist. Then accept or revise Step 4. Real-phone testing is still pending.
- **CODEMAP updated:** yes

## Step 4: Block placement polish (simple plan) — 2026-10-20

- **Built:** Step 4 polish for the block-placement game (rotation was added later; see the rotation addition above). Added four fixed themes (`sky`, `shapes`, `ocean`, `garden`) in `src/lib/ui/block-themes.ts`; the round seed selects the theme, the same seed repeats it, and themes are cosmetic only. After the owner's first look, each theme now sets its own backdrop, board cell/edge, picker tray/slot, and four piece colors instead of sharing one board palette. Added a Score/Lines/Streak HUD with a Round/Best meta line, a session round counter, and the best score in `BlockGameScreen.svelte`. Added a first-round-only hint stored under `morphi.block.hintSeen`: the full hint is one line at 320/360/390/768 px, becomes "Fill a row or column." after the first placement, and is absent in later rounds. Reframed the line clear as a fill-only wave: each cleared filled cell scales to 1.08 then shrinks/fades over 1440 ms with an 8 ms row/column wave delay (0–56 ms), while the board cell and edge stay visible underneath; there is no full-line wipe or flash. The fill motion finishes inside the owner-requested 1500 ms busy window; added score/streak bumps, an invalid board-cell outline/shake, and a tray pick pop. Reduced motion disables all new motion. Updated the five theme tests with palette uniqueness and the board/picker visibility floors, added one hint-storage memory-fallback test, and updated the brief, decisions, edge cases, codemap, and this report.
- **Skipped (and why):** No theme-choice UI or player-facing theme labels; the seed chooses the theme. No theme transition animation. No new sound or audio file. No timer, resume, accounts, Worker, deployment, analytics, CI, or multi-browser harness; those remain outside the simple-plan Step 4 scope. Tester 9's elapsed timer stays parked in `IDEAS.md`. No new testers were run for Step 4.
- **Known issues:** The owner has not accepted the revised Step 4. The first look asked for themed boards/pieces and a less abrupt clear, then a themed vertical picker and finally a 1500 ms clear that removes only filled cells while board cells remain; all were changed, but the owner still needs to judge the result. The first-round hint is hidden in the short-landscape profile by the existing compact-layout rule, so a first-time landscape player sees no hint. The hint is consumed when the first round starts, so abandoning that round loses it. `roundNumber` is session-only and resets to 1 on reload; Best became per family with the rotation addition above. The theme mapping changes if the theme list changes, but it is cosmetic and does not change the engine, score, or replay. Browser evidence is local Chromium only; no Step 4 real-phone run yet. The board-visibility exception remains: cell/backdrop is 1.240–1.272:1 and edge/backdrop 1.316–1.385:1 across the four themes, below the full-plan 1.5:1 guideline. The 1500 ms clear is an explicit owner override of the simple plan's usual under-300 ms motion guideline. The Step 2 formal Next-rate tally and exact Step 3 device details are still missing.
- **Decisions and pinned versions:** Four themes, each with its own palette: `sky` backdrop `#E8F0FC`, cell `#CDD9EE`, edge `#C8D3E5`, tray `#F3F8FF`, slot `#DBE5F5`, current four piece tokens; `shapes` `#F3EEFB`, `#DCD2EE`, `#D4C9E7`, tray `#FAF6FF`, slot `#E6DCF5`, and `#009A86`/`#7D61AE`/`#7C4100`/`#003041`; `ocean` `#E2F3FA`, `#C2DDE9`, `#BAD6E2`, tray `#F0FAFD`, slot `#D3E8F1`, and `--accent`/`--success`/`#003041`/`--warning-fill`; `garden` `#E6F4E1`, `#C9DFC0`, `#C3D8BB`, tray `#F4FBF0`, slot `#D9E9D0`, and `--success`/`--primary`/`--warning-fill`/`#7C4100`. HUD: Score, Lines, Streak, Round, Best; per-family best after the rotation addition. Hint: first round only, `morphi.block.hintSeen`, saved at start, with memory fallback. Clear: owner-requested 1500 ms fill-only wave; each fill scales to 1.08 then shrinks/fades over 1440 ms with an 8 ms wave (0–56 ms), while the board cell and edge persist; 1500 ms busy window; no full-line wipe or flash; this overrides the simple plan's usual under-300 ms guideline. Picker: tray and slot surfaces use the theme tints, while HUD/chrome stay neutral. Invalid cell: 220 ms shake and danger outline. No dependency pins changed; Playwright 1.64.1 remains a temporary `/tmp/opencode/morphi-test` harness, not a repo dependency. TypeScript stays `~6.0.3`.
- **Questions for the owner:** Review the revised four themes, especially whether the board, piece, and picker colors now feel distinct enough. Does the 1500 ms fill-only clear, with the board cells staying visible, feel better? Should the first-run hint also appear in short landscape? Is consuming the hint at round start the right behavior? Step 4 is not accepted until the owner confirms these.
- **Evidence table:**

| Acceptance item                                        | Evidence type                     | Where                                                 | Result                                                         |
| ------------------------------------------------------ | --------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Four fixed seed-picked themes, deterministic           | Unit tests (5)                    | `src/lib/ui/block-themes.test.ts`                     | pass                                                           |
| Theme board, picker, and piece palette uniqueness      | Unit test                         | `src/lib/ui/block-themes.test.ts`                     | pass                                                           |
| Board and picker visibility floors                     | Unit test                         | `src/lib/ui/block-themes.test.ts`                     | pass (cell ≥1.239:1, edge ≥1.31:1, tray ≥1.04:1, slot ≥1.12:1) |
| Hint memory fallback when storage is blocked           | Unit test                         | `src/lib/ui/storage.test.ts`                          | pass                                                           |
| Full unit suite                                        | Unit tests (74, 7 files)          | `bun run test:unit -- --run`                          | pass                                                           |
| Format and lint                                        | `bun run lint`                    | terminal                                              | pass                                                           |
| Type-check                                             | `bun run check`                   | terminal                                              | pass (0 errors, 0 warnings)                                    |
| Production build                                       | `bun run build`                   | terminal                                              | pass (expected `adapter-auto` warning)                         |
| Block theme rotation and first-round hint              | Chromium automation               | `/tmp/opencode/morphi-test/step4.ts`                  | pass (29 checks)                                               |
| Themed picker follows the theme                        | Chromium automation               | `step4.ts`                                            | pass (4 tray styles observed)                                  |
| Pick and board feedback under 100 ms                   | In-page Chromium measurement      | `step4.ts`; latest local run                          | pass (5.2 ms pick; 17.9 ms board)                              |
| One-line hint at 320/360/390/768                       | Chromium layout measurement       | `layout.ts`, `step4.ts`; screenshots                  | pass                                                           |
| Fill-only clear, board cells persist, and short hint   | Chromium automation + screenshot  | `step4.ts`, `block-clear-360x640.png`                 | pass (1500 ms busy; 1440 ms fill; delays 0–56 ms)              |
| 320x480, 320x568, 360x640, 390x844, 768x1024 no scroll | Chromium layout measurement       | `layout.ts`                                           | pass                                                           |
| 844x390 and 1280x800 no scroll; tray beside board      | Chromium automation + screenshots | `step4.ts`, `block-844x390.png`, `block-1280x800.png` | pass                                                           |
| Reduced motion disables new motion                     | Chromium reduced-motion run       | `step4.ts`                                            | pass                                                           |
| Four-theme visual gallery                              | Screenshots                       | `/tmp/opencode/morphi-step4/theme-*.png`              | pending owner review                                           |
| No page or console errors                              | Chromium automation               | `step4.ts`                                            | pass                                                           |
| Owner review of Step 4 look                            | Owner review                      | pending                                               | pending                                                        |
| CODEMAP updated                                        | Doc                               | `docs/CODEMAP.md`                                     | yes                                                            |

- **Measurements:** No Step 4 load-performance gate. Local Chromium only; no median/p95, cold/preloaded, or network profiles. Layout: 320x480 board 232 px/cell 28.13 px; 320x568 320 px/39.13 px; 360x640 360 px/44.13 px; 390x844 390 px/47.88 px; 768x1024 480 px/59.13 px; 844x390 308 px/37.63 px; 1280x800 and 1440x900 520 px/64.13 px. HUD height 60.84 px. All checked viewports fit without page scroll. Latest input feedback: pick 5.2 ms; board 17.9 ms (earlier runs 6.0/14.5, 4.2–5.4/19.2–19.7, and 9.8/14.6 ms); goal <100 ms, not a formal gate. Theme contrast: cell/backdrop 1.240–1.272:1; edge/backdrop 1.316–1.385:1; tray/backdrop 1.068–1.082:1; slot/tray 1.190–1.237:1. The cell and edge steps remain below the full-plan 1.5:1 guideline, owner-approved exception. Clear budget: 1500 ms fill-only wave, 1440 ms fill plus a 0–56 ms delay, all inside the 1500 ms busy window; board cells persist.
- **Waivers:** The approved board-visibility exception remains (1.240–1.272:1 cell/backdrop, 1.316–1.385:1 edge/backdrop). The Ocean backdrop was changed from `#DFF1F8` to `#E2F3FA` so the cell contrast does not drop below the approved floor, and all four themes now have their own checked cell/edge/tray/slot tints. The owner explicitly overrode the simple plan's usual under-300 ms motion guideline for this clear (1500 ms). Theme review and real-phone Step 4 play are not waived; they are pending the owner. Step 3 user testing remains an owner-judgment closure without Next/return counts.
- **Owner responsibilities:** Review the revised Step 4 build and decide whether the four palettes, themed picker, HUD, first-round hint, and slower fill-only clear are accepted or need changes. The four-theme gallery is in `/tmp/opencode/morphi-step4/theme-*.png`; the clear screenshot is `block-clear-360x640.png`; the desktop themed picker is in `block-1280x800.png`. Test on a real phone, especially the first-round hint, the themed board/picker, and the 1500 ms fill-only clear. If accepted, update the gate and state the next step; do not start Step 5 from this report. The Step 2 Next-rate tally and exact device record are still missing.
- **CODEMAP updated:** yes

## Step 3: Block placement (simple plan) — 2026-10-20

- **Built:** A complete local block-placement game as the routed main game. The pure engine in `src/lib/game/block.ts` (`block-placement-1`) uses an 8x8 board, a 3-piece tray, nine fixed-orientation pieces, a 300-piece seeded supply made from 9-piece bags, a 10-placement opening fair-tray guarantee, simultaneous row/column clears, combo scoring, no-fit and 300-placement end states, and replay from seed plus moves. `BlockGameScreen.svelte` adds tap-select/tap-cell, pointer drag with a board-anchored ghost, tray keyboard play, a vertical right picker by default (`traySide` supports left), tray below on compact/medium screens, score/lines/combo HUD, clear/gain feedback, arrival motion, and the 450 ms end handoff. The shared `ResultScreen` now takes a title and summary and shows block end reason plus lines/pieces, with a route-level polite live announcement of the result. Block best is stored under `morphi.block.best`; Memory stayed in code but unrouted during Step 3 (routed again by the Step 4 rotation addition above). Added pick/place/invalid/clear/end sounds, block message keys, block surface and piece tokens, and an approved brief update. Owner first-impression feedback twice tuned the board: the final empty cells are `#CDD9EE` with a `#C8D3E5` edge, a soft grid that the owner approved; pieces keep the existing palette. The owner approval gate is closed.
- **Skipped (and why):** The user testing gate closed on 2026-10-20 after 10 owner-run testers; no code changes came from it. The total-elapsed-time idea is parked in `IDEAS.md` by the owner and was not implemented. No tray-side chooser UI (the `traySide` prop is ready). No resume, abandonment recovery, per-size best, server replay, accounts, Worker, CI, multi-browser harness, or shell exit protocol; the simple plan defers those. Memory has no menu entry by the Step 3 rule.
- **Known issues:** The Step 2 Next-rate tally was not recorded; the owner directed Step 3 instead. The owner approval gate closed on 2026-10-20 and the user testing gate closed the same day after 10 testers (mixed phone and desktop; exact devices not recorded). The owner reports acceptance, but Next/return counts and a Memory-vs-block comparison were not recorded, two testers were silent, and no tester rejected it. One tester asked why there is only one animation and one reported no visible line-complete animation; the 250 ms clear exists but may be too subtle. One suggested total elapsed time until the result box; the owner is parking it in `IDEAS.md` and it is not implemented. The approved board cell/ground step is 1.24:1 (edge/ground 1.32:1), below the full-plan 1.5:1 back/ground guideline; the owner explicitly chose these values. At 360x640 the board is full viewport width (no side margin) so cells reach 44.13 px; short-landscape cells are about 39.9 px, while tray targets stay 72 px. The hint becomes a short persistent reminder after the first placement to avoid a footer jump; the brief records this. Result decor is still the shared quiet card shapes. Best is one overall block best, not per profile.
- **Decisions and pinned versions:** Main game block placement; Memory retained but unrouted during Step 3 (routed again by the Step 4 rotation addition above). Engine version `block-placement-1`; 8x8; 3-piece tray; 300 cap; 10 opening turns; eager 300-piece supply from seeded 9-piece bags; forced monomino fallback. Score `lines*100 + (lines-1)*50 + (combo-1)*50`; combo resets on a non-clearing placement. Vertical picker right by default, left via `traySide`; board max 440/480/520 px. Tap, pointer drag, and tray keyboard share one busy guard; resize/hidden cancels drag and ghost. `morphi.block.best` added separate from `morphi.memory.best`; sound key unchanged. `ResultScreen` title/summary props replace Memory-specific pairs/moves/seconds. Arrival budget is 250 ms cell ripple plus at most 168 ms stagger, and a 200 ms tray slide, all under 600 ms; clear 250 ms, settle 100 ms, result after 450 ms. Board empty cells are `#CDD9EE` with a `#C8D3E5` edge; the owner chose these final values after first-impression feedback. Cell/ground is 1.24:1, below the full-plan 1.5:1 guideline; this is an owner-approved visual exception for the simple build. No dependency pins changed.
- **Questions for the owner:** None. The owner approved the build and closed the user testing gate. Step 4 is next; the animation feedback from testers 3 and 8 is its first input. The elapsed-time idea stays parked in `IDEAS.md`.
- **User testing gate (closed 2026-10-20):** 10 owner-run testers, mixed phone and desktop. 1 "awesome"; 2 "ok"; 3 asked why only one animation; 4 "okay"; 5 "great idea"; 6 and 7 silent; 8 reported no line-complete animation; 9 suggested a total elapsed timer until the result box (owner parking in `IDEAS.md`); 10 "go ahead". No rejection. Next/return counts and exact devices were not recorded; the owner closed the gate on the overall signal.
- **Evidence table:**

| Acceptance item                                                           | Evidence type                      | Where                                                                                                 | Result                                             |
| ------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Engine rules, clear union, combo, cap, no-fit, fair opening trays, replay | Unit tests (27)                    | `src/lib/game/block.test.ts`                                                                          | pass                                               |
| Known vectors and 20-placement replay (score 700, lines 5)                | Unit tests                         | `src/lib/game/block.test.ts`                                                                          | pass                                               |
| Full unit suite (Memory retained + block)                                 | Unit tests (56)                    | `bun run test:unit -- --run`                                                                          | pass                                               |
| Format and lint including Svelte key/a11y rules                           | `bun run lint`                     | terminal                                                                                              | pass                                               |
| Type-check                                                                | `bun run check`                    | terminal                                                                                              | pass (0 errors, 0 warnings)                        |
| Production build                                                          | `bun run build`                    | terminal                                                                                              | pass (expected `adapter-auto` environment warning) |
| Tap, drag, keyboard, invalid placement, result, best storage              | Chrome automation                  | `/tmp/opencode/ui-test/block-game.ts`                                                                 | pass                                               |
| 360x640, 844x390, 1280x800 no-scroll and tray placement                   | Chrome automation and screenshots  | `/tmp/opencode/ui-test/block-game.ts`, `block-360x640.png`, `block-844x390.png`, `block-1280x800.png` | pass                                               |
| 320x480 and 320x568 no-scroll                                             | Chrome measurement                 | `/tmp/opencode/ui-test/block-small.ts`                                                                | pass                                               |
| Board visible at first glance against the light ground                    | Chrome screenshot + owner approval | `/tmp/opencode/ui-test/block-dark-360x640.png`                                                        | pass (owner-approved soft grid)                    |
| Board cell at least 44 px at 360x640                                      | Chrome measurement                 | same script                                                                                           | pass (44.13 px)                                    |
| Touch tap placement and mid-round resize                                  | Chrome mobile-emulation automation | `/tmp/opencode/ui-test/block-touch.ts`                                                                | pass                                               |
| Reduced motion disables arrival/clear motion                              | Chrome reduced-motion automation   | `/tmp/opencode/ui-test/block-reduced.ts`                                                              | pass                                               |
| Block result fits 844x390 without scroll                                  | Chrome automation and screenshot   | `/tmp/opencode/ui-test/block-game.ts`, `block-result-844x390.png`                                     | pass                                               |
| Arrival under 600 ms                                                      | CSS budget by construction         | `BlockGameScreen.svelte` (250 ms + max 168 ms; tray 200 ms)                                           | pass (not instrumented)                            |
| Real-phone game and result gate                                           | Owner-reported mixed devices       | owner; exact models not recorded                                                                      | closed by owner (caveat)                           |
| Five-person Step 3 playtest                                               | Owner-run pilot (10 testers)       | owner; results in the gate note above                                                                 | closed (owner judgment; no Next counts)            |
| Memory remains available in code                                          | Code inspection and tests          | `src/lib/game/memory.ts`, route not importing it                                                      | pass                                               |
| CODEMAP updated                                                           | Doc                                | `docs/CODEMAP.md`                                                                                     | pass                                               |
| Owner approval gate                                                       | Owner decision in chat             | 2026-10-20                                                                                            | closed                                             |
| User testing gate                                                         | Owner decision in chat             | 2026-10-20                                                                                            | closed                                             |

- **Measurements:** No Step 3 load-performance gate. Local Chrome only: 360x640 board cells 44.13 px and no scroll; 844x390 board cells about 39.9 px and no scroll; 1280x800 board 520 px and no scroll; 320x480 and 320x568 fit without scroll; result 844x390 no scroll. Arrival budget is at most 418 ms for the last cell plus 200 ms tray, under the 600 ms deadline by construction. No median/p95 load runs were taken, so no performance claim beyond layout and motion budgets.
- **Waivers:** Owner-approved visual exception: the final board cell/ground step is 1.24:1 (edge/ground 1.32:1), below the full plan's 1.5:1 back/ground guideline; the owner selected the values and closed the approval gate. The user testing gate is closed by owner judgment; no Next/return-rate claim is made.
- **Owner responsibilities:** No further Step 3 work. Step 4 is next; the animation feedback from testers 3 and 8 is the first input. The approved defaults (short persistent hint, one overall block best, right-side picker, block placement as the main game) stand. The Step 2 Next-rate tally and decision record are still missing.
- **CODEMAP updated:** yes

## Step 1: Memory (simple plan) — 2026-10-20

- **Built:** A complete local Memory game in SvelteKit/Svelte 5/TypeScript: seeded 6/8/10-pair rounds, flip/match/mismatch rules, 500 ms mismatch hold with a 40 ms staggered flip-back, timer, live score, best score in localStorage, Home/Game/Result screens, a 3-second face-up preview that hides with the card flip animation, Web Audio feedback, and a deterministic win burst under one second. Motion polish: row-staggered deal-in, selected-card lift and press feedback, offset match pops, mismatch dip with a 40 ms flip-back stagger, diagonal win wave, HUD score/move feedback, round number and cosmetic match streak, pitch-rising match audio, and a so-close result line. Rules live in `src/lib/game/memory.ts`; RNG and shuffle live in `src/lib/engine/rng.ts`.
- **Skipped (and why):** Multi-browser harness, CI, Cloudflare Worker, accounts, themes beyond the verified Shapes palette, resume, and IndexedDB. The simple plan defers them; Step 1 only needs a local playable game.
- **Known issues:** The owner played about 10 rounds and accepted the feel; a full 20-round real-phone gate is not recorded. Playtesters described Memory as basic; the owner chose the bounded feel pass and directed work to proceed to the second game. A five-person Next-rate tally was not recorded, so this is an owner decision, not a recorded Step 2 pass. `adapter-auto` prints its expected "no production environment" warning on `bun run build`; local dev/build still succeed. Best score is a single overall best, not per round size. Moves count completed two-card attempts: a mismatched pair is 1 move, not 2.
- **Decisions and pinned versions:** SplitMix64 v1 with unbiased rejection-sampled Fisher-Yates; crypto seed as a decimal string; score = `max(0, pairs*1000 - mismatches*150 - seconds*5)`; live HUD shows the projected total from the start of the round; moves count completed two-card attempts; the preview gives 3000 ms of fully visible cards after a 240 ms row-staggered deal (the preview phase lasts 3240 ms), input is locked while cards are visible or hiding, and the clock starts only after they are hidden; gameplay motion stays at or under 250 ms; the mismatch hold is 500 ms with a 40 ms second-card flip-back delay; the HUD shows the session round number, a cosmetic consecutive-match streak, and rises the match tone by up to four 6% steps; a score within 250 points of the previous best shows a so-close line; the win sequence holds 160 ms, then runs a 1000 ms diagonal wave while confetti starts at 260 ms (the burst itself stays under 1 s) and the result appears at 1150 ms; all motion is disabled under reduced motion; sounds are generated with Web Audio; best score and mute use localStorage with an in-memory fallback; TypeScript pinned to `~6.0.3`.
- **Questions for the owner:** Keep the overall best across 6/8/10-pair rounds, or store a best per round size? Is the projected live score (starts at pairs x 1000 and drains with time) the right reading of the scoring rule?
- **Evidence table:** Unit tests: `bun run test:unit -- --run` — 29/29 pass. Lint: `bun run lint` — pass. Type-check: `bun run check` — 0 errors, 0 warnings. Production build: `bun run build` — pass. Automated Chrome play: 20 consecutive rounds after the preview and motion changes, no console or page errors, best score monotonic. Mismatch timing: cards stay up through 430 ms, resolution starts at 500 ms, and both cards report face down by 550 ms (visual flip-back completes by about 790 ms). Preview timing: all cards face up and timer at 00:00 through 2.5 s, cards hidden and playable afterward, timer starts only after the hide. Motion checks: deal delays 0/20/40/60 ms by row, selected-card lift applied, matched pair animates at 0/40 ms, mismatch produces two shakes plus one 40 ms delayed flip-back and a score pulse, win wave covers all matched cards at 180 ms and runs for 1000 ms, confetti starts at 260 ms, result appears at 1150 ms, reduced-motion Chrome disables the deal and selected lift, no console errors. Feel pass: round number and streak appear and the streak resets after a mismatch; round number increments on Next; a controlled so-close round showed `125 points off your best`; the same result card fits 844x390 without clipping or page scroll. Viewports checked without scroll: 360x640, 390x844, 844x390, 768x1024, 1280x800, 1440x900, 1920x1080. Win-moment screenshot captured. Real-phone run: pending owner.
- **Measurements:** Not a Step 1 gate. Cold local first load and Play-to-interactive were not measured with the Phase 1 protocol.
- **Waivers:** Real-phone play is not waived; it is pending the owner's device test.
- **Owner responsibilities:** Finish the 20-round real-phone gate and confirm the tuned values (pair sizes, 500 ms mismatch hold, score formula, 250-point so-close threshold).
- **CODEMAP updated:** yes

## v1.1 Work 4 — per-game scoring (accepted locally, 2026-10-29)

**Built:** Admin-only scoring editor for Block, Memory and Connect; bounded
integer validation, restore defaults, sensitive re-authentication, atomic audit
and immutable versions. Ranked starts record their version; client scoring,
help, saved runs and authoritative replay use it. Current-version leaderboards
and versioned local bests avoid comparing scores across changed coefficients.

**Skipped:** Par-time editing, public deployment and Work 5, per scope.

**Known issues:** A solo round started offline uses brief defaults; its version
is retained on later save. Owner acceptance applies to the local PC review only;
public-test acceptance and deployment remain separate.

**Decisions:** See `docs/DECISIONS.md`; no dependency changes.

| Acceptance item                                                          | Evidence                                                       | Result               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------- |
| Edit and restore coefficients, validate inputs, audit and access control | `tests/integration/runs.test.ts`, `tests/e2e/operator.spec.ts` | Pass locally         |
| New, in-flight and past scores and server replay use their versions      | `tests/integration/runs.test.ts`                               | Pass locally         |
| Immutable versions, race and stale-edit handling, leaderboard separation | `tests/integration/runs.test.ts`                               | Pass locally         |
| Cross-runtime scoring vectors                                            | `tests/vectors/runner.ts`                                      | Pass in six runtimes |
| Local owner review                                                       | Owner                                                          | Pass                 |

**Measurements:** No new performance gate specified for this step; production
resource evidence remains a separate release gate. **Waivers:** None.
**Owner responsibilities:** Direct the next handoff item, Work 5. No deployment was authorized.
**CODEMAP:** Updated. Final `bun run verify` passed all stages: 30,000 palettes, unit and D1/auth integration, six-runtime vectors, built Worker and 156/156 browser checks. Local review/acceptance applies to the owner PC only; public-test acceptance was not claimed. See `docs/V1.1_WORK.md`.

## v1.1 Work 5 — family-door withdrawal and static explainers (2026-10-31)

**Built:** Removed the Memory and Block door pages and shared door screen.
Legacy family slugs now redirect Home in the local app; `/play` query
parameters cannot select a family. Ranked family issuance remains server-owned.
Added static, indexable `/how-it-works`, `/about` and `/faq` content pages with
reusable blocks. How it works has an abstract interactive four-step deal with
clickable steps, autoplay, pause/replay and reduced-motion handling through the
existing motion wrapper. Sitemap and robots omit game routes, `/play` is
noindex, and the assets-only guest artifact includes the new pages and matching
slug redirects.

**Skipped:** CMS/blog, share links, per-game public pages, new games and
deployment. They are outside this Work 5 scope; the guest artifact stayed local.

**Known issues:** The owner accepted the separate Work 2 overall visual/device
pass locally on 2026-10-31; specific device/browser models were not supplied.
The rerun theme simulation reports at least one freshness violation in 99.99%
of sampled rounds for each family, with symbol-family overlap the main
constraint. This remains an existing Work 1 best-effort diagnostic; no numeric
target was supplied and no theme code changed here.

**Decisions:** Public game choice remains selector-only, including on `/play`;
internal ranked issuance is unchanged. SvelteKit 3 route matchers use
`defineParams` from `@sveltejs/kit/params` in root `src/params.ts`; the family
list stays inline to avoid a built-Worker alias resolution failure. No package
versions changed. See `docs/DECISIONS.md`.

**Questions for the owner:** No Work 5 or Work 2 visual acceptance remains.
Global-release planning should set the theme-freshness target and define the
production/admin proposal. This does not authorize provisioning or deployment.

**Evidence table:**

| Acceptance item                                                                         | Evidence type and location                                                                                 | Result                                                                                            |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Legacy family slugs return to Home; no public family door remains                       | `tests/e2e/explainers.spec.ts`, `scripts/check-worker.ts`, `scripts/check-public-privacy.ts`               | Pass locally                                                                                      |
| `/play` query parameters cannot select a family                                         | `tests/e2e/explainers.spec.ts`; existing selector and ranked replay checks                                 | Pass locally                                                                                      |
| Three indexable explainers work; the interactive page supports steps and reduced motion | `src/lib/content-explainers.ts`, `src/lib/components/DealExplainer.svelte`, `tests/e2e/explainers.spec.ts` | Pass locally, including JavaScript-disabled text                                                  |
| Sitemap and robots omit game routes                                                     | `src/routes/sitemap.xml/+server.ts`, `src/routes/robots.txt/`, `scripts/check-worker.ts`                   | Pass locally                                                                                      |
| Guest-only candidate contains the reviewed pages and no account/replay exposure         | `build/public-privacy/`; `bun run prepare:public-privacy`, `bun run test:public-privacy`                   | Pass: 109 files prepared; local checks pass                                                       |
| Repository verification                                                                 | `bun run verify`; Playwright configured for one worker                                                     | Pass: 123 unit, 27 account integration, six runtime vectors, Worker smoke, 166/166 browser checks |
| Work 5 local visual acceptance                                                          | Owner review in this conversation, 2026-10-31                                                              | Pass locally                                                                                      |
| Work 2 overall integrated visual/device acceptance                                      | Owner review in this conversation, 2026-10-31                                                              | Pass locally; exact device/browser models not supplied                                            |
| CODEMAP                                                                                 | `docs/CODEMAP.md`                                                                                          | Updated                                                                                           |

**Measurements:** No new Work 5 latency target was specified. Explainer layout
checks ran in headless local browsers at 390×844, 844×390 and 1280×800; no
network profile, physical-device timing, cold-load timing or median/p95 was
collected for these pages. The full verify incidentally reran the existing
preloaded palette-generation goal on local Linux x64 / Bun 1.4.2, no network,
10,000 runs per family: Memory median 1.18 ms / p95 4.86 ms; Block 1.40 / 5.09
ms; Connect 1.52 / 6.23 ms. These are diagnostic goals, not gates. Full details
and freshness/fallback counts are in `docs/evidence/v1.1-themes/palettes.json`.

**Waivers:** None. Work 2 visual/device acceptance is recorded as a local pass.

**Owner responsibilities:** Plan the global release, including production
operations/resources and an admin-panel proposal. The theme-freshness target
remains an owner decision. No account, credential, production-resource or
deployment action is authorized by this local work.

**CODEMAP:** Updated.

## Next phase assessment — local only (2026-10-31)

**Built:** Gap assessment with code evidence, current behavior, undo matrix,
proposed order and owner decisions in `docs/NEXT_PHASE_ASSESSMENT.md`.
**Skipped:** Implementation, test execution, deployment and remote operations;
this slice was assessment only. **Known issues:** Single web-operator enrollment,
audit integrity limitations and incomplete statistics are detailed in the report.
**Decisions:** None; no dependency changes. **Questions for the owner:** See the
report's ten decision questions; approve a slice and order before implementation.

| Acceptance item                                                     | Evidence type and location                                   | Result                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| Six requested gaps and current local implementation                 | Code/schema/test inspection, `docs/NEXT_PHASE_ASSESSMENT.md` | Assessed; owner decisions pending |
| Existing features, undo limits, proposed order and decision context | Code inspection, same report                                 | Documented                        |
| Local-only and behavior unchanged                                   | Working-tree inspection; report-only documentation changes   | Pass                              |

**Measurements:** None requested or collected. **Waivers:** None.
**Owner responsibilities:** Review the report, decide the open questions and
approve the next slice. **CODEMAP:** Updated with the assessment location.

## Next phase slice 1 — local user controls and audit (2026-10-31)

**Built:** Existing operator panel gains an admin-only user directory and detail,
timed or permanent bans, reversible ordinary account deletion with an adjustable
restoration deadline, audit filters, yearly paged export, and undo for moderation.
D1 guards audit updates/deletes and captures mutation snapshots in the transaction.
The local application records future account activity and reported round starts
and explicit departures; it does not backfill historical activity. Owner-approved
expiry behavior makes restoration impossible at the deadline and finalizes on
the next application request or local maintenance. The local privacy text now
describes these account records and deletion behavior.

**Skipped:** Slice 2 game controls and scoring rollback, slice 3 endings, broad
profile editing, role editing, production provisioning and deployment; these are
outside this slice. Player-visible profiles are unchanged.

**Known issues:** Activity collection is best effort, excludes guests, and can
miss starts, departures or completion acknowledgements; unknown exits are not
invented as abandonments. The last observed authenticated request may be a
background request. Historical plays, abandonment, last activity and warnings are
not recorded. Final anonymization cannot run while the app receives no requests
and maintenance is not run; restoration is already blocked. Audit is retained
indefinitely and may contain public names in prior rename snapshots, so retained
audit is pseudonymous rather than a promise that every independent record is
anonymous. Provider records and other devices remain separate. Real-device owner
review and production privacy/operations remain separate gates.

**Decisions:** Owner approved no historical estimates, future tracking, and
request/maintenance-driven anonymization. Undoing an unban creates a fresh
permanent ban with a new reason; a later action can change it. Saved score
summaries group by rules group and score version. D1 batches capture state and
mutation atomically; see Cloudflare D1 database documentation. No dependency
versions changed. See `docs/DECISIONS.md`.

**Questions for the owner:** Review the local slice and its limitations before
accepting it and directing slice 2. No deployment is authorized.

| Acceptance item                                                                | Evidence type and location                                                                                                                    | Result                                                       |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Admin-only user details, saved stats and restricted Google identity            | `src/lib/server/admin-users.ts`, `tests/e2e/operator.spec.ts`                                                                                 | Local focused browser checks pass; owner review pending      |
| Timed/permanent bans, expiry, restore and gameplay restrictions                | `src/lib/server/moderation.ts`, `src/lib/server/runs.ts`, `tests/integration/runs.test.ts`, `tests/e2e/operator.spec.ts`                      | Local integration and focused browser checks pass            |
| Reversible ordinary delete, deadline and finalization; privacy-delete separate | `src/lib/server/user-lifecycle.ts`, `migrations/0009_sticky_black_knight.sql`, `tests/integration/runs.test.ts`, `tests/e2e/operator.spec.ts` | Local integration and focused browser checks pass            |
| Immutable audit, filters, archive and moderation undo                          | `src/lib/server/audit.ts`, `src/lib/server/moderation.ts`, `tests/integration/audit.test.ts`, `tests/e2e/operator.spec.ts`                    | Local integration and focused browser checks pass            |
| Honest historical gaps and forward activity tracking                           | `src/lib/server/activity.ts`, `tests/integration/activity.test.ts`, `src/lib/server/admin-users.ts`                                           | Local integration checks pass; tracking is best effort       |
| Three admin viewport sizes                                                     | `tests/e2e/operator.spec.ts`: 390×844, 844×390, 1280×800                                                                                      | Focused Chromium checks pass; physical device review pending |
| Full repository verification                                                   | `bun run verify`                                                                                                                              | Pass: all stages, 167/167 browser checks                     |

**Measurements:** No new performance target specified; no physical-device,
network or latency measurements collected. **Waivers:** None; the owner chose
request-driven anonymization and honest historical gaps as implementation rules.
**Owner responsibilities:** Review locally, accept or request changes before
slice 2, and separately decide any production/deployment work. **CODEMAP:** Updated.

## Owner direction — combined review for next-phase slices (2026-10-31)

The owner directed completing all three local slices before one combined owner
review. Slice 1 remains review-pending; continuing implementation is not acceptance.
Slices 2 and 3 and their verification remain required. Close the work only after
the owner completes and accepts the combined review. No deployment or production
change is authorized by this direction.

## Owner quick-review changes — pending implementation/verification (2026-10-31)

Owner requested Users and Audit overview/detail navigation, user search/filters
and right-side quick view, structured individual detail, pre-fold ending text
(minimum 500 ms) followed by a 500 ms fold, and investigation of signed-in 403s.
See `docs/DECISIONS.md`. All three slices remain pending full owner review;
this feedback is not acceptance. Combined verification/handoff remains required.

Owner added styled Users tabs/sidebar submenus and a Games overview with dedicated
per-game settings/statistics screens. The focused browser run was stopped for
these changes after 8 checks passed; one active check was interrupted, not a
completed assertion failure. Verification of the final UI remains pending.

## Combined next-phase slices 2–3 and owner quick-review refinements — local (2026-10-31)

**Built:** Central game overview and dedicated game statistics/settings screens,
availability-aware selector, audited disable/re-enable and staged deletion that
preserves history, scoring rollback as a new immutable version, and server-valid
fallback for invalid live coefficients. Shared manifest-validated ending text now
appears over the completed board: 420 ms entrance, at least 500 ms settled hold,
then a 500 ms fold into the played stack and the existing result sequence.
Reduced motion holds instant text for 500 ms and settles folding immediately.
Completion queue/storage fallback and selected-family recovery are preserved.

Owner quick-review changes add Users/Audit summary screens, expandable sidebar
menus, styled section navigation, searchable/filterable directory, right-side
quick view, structured individual-user tabs/cards/tables, and compact headers
with full-width content. Expired admin grants now require sign-in (401), while
real permission denials remain 403. Screenshot inspection prompted readable
scrolling tables, a structured drawer and compact audit filter/export panels.

**Skipped:** Deployment, remote provisioning, broader game settings, par times,
role editing, CMS and new games. Existing overview cards and ending presentation
were retained where screenshots showed a clear design.

**Known issues:** Historical stats remain limited to retained saved rounds;
unknown abandonment and end-type counts are not invented. Per-game grouped
statistics disclose a 100-group display cap. Prospective account tracking is
best effort. The separate live/static guest release has no backend availability
control and is unchanged. Hard game deletion retires availability, retaining the
installed replay code and history. The requested Block cap wording “Board full!”
is retained, although a placement cap does not guarantee full grid occupancy.
A transient local multi-process SQLite lock occurred during one capture run;
the isolated rerun passed. Before captures include the already-completed first
user-detail polish; no earlier screenshot is fabricated.

**Decisions:** The owner explicitly authorized all slices before one combined
review and supplied visual corrections. None of that constitutes final
acceptance. See `docs/DECISIONS.md`. No dependency versions changed.

**Questions for the owner:** Review `docs/NEXT_PHASE_REVIEW.md` and the local
before/after gallery, then accept or request corrections. Closing the work waits
for that acceptance; no production/deployment action follows automatically.

| Acceptance item                                                                     | Evidence type/location                                                                   | Result                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| User/audit overview, directory/drawer/tabs, restricted identity and controls        | `tests/e2e/operator.spec.ts`, `server/admin-users.ts`, operator route                    | Focused Chromium pass                                        |
| Expired grants distinguish sign-in from role denial                                 | `tests/integration/operator.test.ts`, `server/operator.ts`                               | Integration pass                                             |
| Game state transitions, history preservation, ranked start guard                    | `tests/integration/runs.test.ts`, `server/games.ts`, migration `0010_game_lifecycle.sql` | Integration pass                                             |
| New-version rollback and invalid-live fallback                                      | `tests/integration/scoring.test.ts`, `server/scoring.ts`                                 | Integration pass                                             |
| Disabled families excluded, retry and all-disabled recovery                         | `selector.test.ts`, `tests/e2e/selector.spec.ts`                                         | Focused unit/browser pass                                    |
| Ending declarations, text ordering/hold/fold, durable completion and reduced motion | `ending-contract.test.ts`, `tests/e2e/{ending,connect}.spec.ts`                          | Focused unit/browser pass                                    |
| Screenshot review at required sizes plus owner desktop                              | `build/combined-review/{before,after}/`, local `index.html`                              | 63 matched pairs; 48 admin and 15 game images per stage      |
| Final combined full verification                                                    | `bun run verify`                                                                         | Pass: 174/174 browser checks; all stages passed (2026-11-01) |

**Measurements:** No new latency target specified. Screenshot sizes: 390×844,
844×390 and 1280×800 for games/admin, plus 1920×923 for admin. Local headless
Chromium, no network timing profile; these are layout checks, not device latency
measurements. **Waivers:** None. **Owner responsibilities:** Complete combined
local visual/device/functional review and acceptance; production remains a
separate gate. **CODEMAP:** Updated. All slices remain owner-review pending.

### Final combined verification — 2026-11-01

`bun run verify` completed with exit 0 after the final quick-review styling and
short-landscape sidebar fixes: format/lint, zero-error/zero-warning type check,
import-boundary self-checks, 30,000 palettes, 126 unit tests, 37 account integration
tests, vectors in Node/Bun/Chromium/Firefox/WebKit/workerd, 32 built-Worker smoke
checks, and 174/174 browser checks (one worker, 35.8 minutes). Full persistent log:
`build/combined-review/verify-final.log`. Final capture evidence has 63 matched
before/after pairs; `docs/NEXT_PHASE_VISUAL_REVIEW.md` records findings.

All implementation and automated checks are complete locally. All three slices
and owner quick-review changes remain **pending combined owner acceptance**.
No deployment occurred. CODEMAP and review handoff are updated.

## Combined next-phase local acceptance — 2026-11-01

**Built:** All three local slices and the owner-requested quick-review changes,
covered by the preceding implementation and verification report.

**Skipped:** Production provisioning, deployment and further implementation;
they are outside this local acceptance.

**Known issues:** The previous report's operational and data limitations remain.
Physical mobile review was not reported; browser and device models are unspecified.

**Decisions:** The owner reported all checks passed and accepted the combined
local work. This supersedes earlier pending-review statements; no dependency
versions changed. See `docs/DECISIONS.md`.

**Questions for the owner:** None required to close this local work. Any further
work and production release remain separate decisions.

| Acceptance item                       | Evidence type and location                                                       | Result                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Three slices and quick-review changes | Owner report of review on their own local PC, 2026-11-01                         | Accepted locally; owner reported all checks passed                 |
| Mobile layouts                        | Owner report of browser responsive emulation, 2026-11-01                         | Checked; no corrections noted. Physical mobile review not reported |
| Combined automated verification       | `build/combined-review/verify-final.log` and preceding final verification report | Pass: all stages, 174/174 browser checks                           |

**Measurements:** No new performance measurements or targets; the preceding
report records screenshot dimensions and verification context. **Waivers:** None
reported; no physical-mobile waiver is inferred. **Owner responsibilities:**
Decide any future work and separately authorize production actions or deployment.
**CODEMAP:** Updated.

## Engine refactor Slice 0 — Freeze the base (2026-11-01)

**Built:** Confirmed local HEAD before proceeding:
`1303c9c4bdb1718bb558886dc43b7b48c597a02a`, "Record combined local
acceptance", the post-acceptance v1.2 base. Local annotated tag
`v1.2-local-complete` freezes that commit. The approved single brief is supplied
as `docs/morphi-engine-refactor-brief.md`.

v1.2 is complete locally: the owner accepted all three slices and quick-review
changes after reviewing on their own PC and checking mobile layouts through
browser responsive tools, with no corrections noted. This is local acceptance;
physical mobile review was not reported, device/browser models were not supplied,
and no deployment occurred. The preceding combined verification and acceptance
reports retain the implementation evidence, including 174/174 browser checks.

**Skipped:** Slice 1 and all implementation, database resets, deployments,
production provisioning, secrets, DNS and Google changes. No puzzle rules,
gameplay, scoring logic, vectors or replay results changed. Per-type indexable
pages and game doors remain withdrawn. Only this report and CODEMAP were edited;
the tag is local and was not pushed. Existing owner changes to `AGENTS.md` and
the untracked brief were preserved.

**Known issues:** Written owner confirmation of this freeze remains pending.
The brief requires `tests/slices/slice0-base-tag.test.ts`; that file is deferred
to the pre-Slice 1 gate because the owner's explicit Slice 0 instruction allows
only the tag and documentation updates. It was not added or claimed as passed.
Before Slice 1, both `git rev-parse HEAD` and
`git rev-parse 'v1.2-local-complete^{commit}'` must still equal the full base
hash above, and the required base-tag test must pass. No documentation commit
was made in Slice 0, preserving HEAD at the required base.

**Decisions:** Database-reset permission covers **local D1 only**, including
later local refactor schema work. It grants no production D1 reset, remote
migration, provisioning or deployment permission. No database was reset here.
The earlier public guest/privacy release remains separate from the undeployed
local v1.2 account build. No dependencies or pinned versions changed.

**Questions for the owner:** Confirm the frozen base in writing before Slice 1.
The brief's remaining pre-Slice 1 owner decisions remain for that gate; no answer
or authorization is inferred from this freeze.

| Acceptance item                           | Evidence type and location                                              | Result                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Correct post-acceptance base and title    | Local `git rev-parse HEAD` and `git log -1 --format=%s`                 | Pass: required full hash and title confirmed before proceeding              |
| Base tag targets the required commit      | Local `git rev-parse 'v1.2-local-complete^{commit}'`                    | Pass: required full hash                                                    |
| v1.2 completion and review scope recorded | Owner instructions; preceding combined local acceptance report; CODEMAP | Recorded: PC review, mobile responsive tools, no corrections, no deployment |
| Reset permission restricted to local D1   | Owner Slice 0 instruction and approved brief; this report               | Recorded; no reset performed                                                |
| Documentation-only scope                  | Local diff and status review                                            | Only PHASE_REPORTS and CODEMAP edited by this slice; no application changes |
| Owner confirms frozen base in writing     | Owner response to this Slice 0 handoff                                  | Pending; Slice 1 must not start                                             |
| Required base-tag test file               | Brief's pre-Slice 1 gate                                                | Deferred under explicit Slice 0 no-code scope; not passed or waived         |

**Measurements:** No performance target applies to this documentation/tag slice.
No device/network, cold/preloaded, run-count, median or p95 measurements were
collected. Prior app checks were not rerun; no new app-test result is claimed.
**Waivers:** None inferred; the deferred base-tag test remains required before
Slice 1. **Owner responsibilities:** Confirm the base in writing and resolve
the brief's remaining pre-Slice 1 decisions. Production actions require separate
authorization. **CODEMAP:** Updated with the brief, frozen base and next-slice gate.

## Engine refactor Slice 1 — Core identity and manifest source of truth (2026-11-01)

**Status:** Implementation and full local verification complete. The owner resumed
this slice after the PC shutdown pause. Slice 2 has not started and requires the
owner's written confirmation. This report records local evidence, not deployment
or owner acceptance of Slice 1.

**Built:** Started from frozen base `v1.2-local-complete`; both pre-start HEAD
and `git rev-parse 'v1.2-local-complete^{commit}'` matched
`1303c9c4bdb1718bb558886dc43b7b48c597a02a`, and the resumed/final checks still
match. The owner's instruction confirms Slice 0 and authorizes only Slice 1.
Existing Slice 0 documentation and owner edits were preserved.

`PuzzleId` is a generic string. Each manifest supplies its scoring fields,
defaults and default version through family-local data shared with replay and
view defaults. The engine contains only generic scoring definitions and bounded
integer validation; `SCORE_FAMILIES` and the hardcoded engine default map were
removed. Catalog-based helpers serve the UI/server; game lists and membership in
server, API and admin code read the catalog. Operator saves and rollback retain
immutable audited versions and in-flight version lookup. Every existing engine
version and coefficient is unchanged.

Puzzle-specific strings moved into each manifest's family bundle. Generated
aggregation preserves literal message-key types and the existing `t` API; shared
`messages.ts` retains shell/site/admin copy. Ending declaration validation reads
the supplied family bundle without importing stale generated output. The exact
comparison against the frozen base passed for all 799 message keys and values.

Added `tests/slices/slice1-manifest-scoring.test.ts` to normal unit discovery.
Its three tests scan/load all manifests, check manifest-owned scoring/messages,
reject unknown/prototype family names, and generate/type-check an isolated extra
manifest with a novel id, scoring field, version and strings, without engine edits.
Existing validation, audit, rollback and browser regressions also passed.

**Skipped:** Slice 2 and all later slices; eager registry exports, PlaySession's
family-specific state, move/timing/group dispatch, schema/lifecycle seeding,
selector persistence and theme administration remain for their assigned slices.
No rules, generation, move validation, scoring formulas, gameplay, endings or
sounds were changed. No games or per-type indexable pages/game doors were added.
No deployment, provisioning, secrets, DNS, Google changes, database reset, remote
migration, commit or push occurred. The owner-supplied brief is excluded alongside
existing owner references in `.prettierignore`, preserving its original bytes.

**Known issues:** `tests/slices/slice0-base-tag.test.ts` was deferred and remains
outstanding. It was not added, run, passed or waived by this slice. The owner
explicitly carried it forward while authorizing Slice 1; actual HEAD/tag checks
passed. Shared message aggregation currently loads headless manifests eagerly;
lazy loading remains Slice 2. Manifest-only registration/type-checking is covered
here; generic new-family gameplay, server dispatch and D1 lifecycle setup belong
to later slices. No new physical-device or production-load evidence is claimed.

**Decisions:** Small family-local scoring data modules avoid manifest/replay
import cycles while the manifest supplies the public scoring contract. Existing
families keep `brief-v1`, immutable operator versions and legacy best-score
storage compatibility. No dependencies or pinned versions changed. See
`docs/DECISIONS.md`.

**Questions for the owner:** Review Slice 1 and provide written confirmation
before Slice 2. No earlier Slice 0 decision is reopened.

| Acceptance item                                   | Evidence type and location                                                                                                       | Result                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Frozen base and owner confirmation                | Owner Slice 1 instruction; pre-start, resumed and final HEAD/tag commit checks                                                   | Pass: required full hash                                                           |
| Generic identity and manifest-owned scoring       | Engine contract/scoring, family manifests/data, `lib/scoring.ts`; Slice 1 acceptance tests                                       | Pass                                                                               |
| Extra manifest requires no engine edit            | Isolated registry generation + TypeScript check in `tests/slices/slice1-manifest-scoring.test.ts`; full unit run                 | Pass: novel id, field, version and messages                                        |
| Family message ownership and unchanged copy       | Manifest bundles and generated aggregation; `build/slice1/message-preservation.log`                                              | Pass: exact 799/799 keys and values                                                |
| Server/admin catalog source and immutable scoring | Catalog-driven routes/helpers; 37 D1/auth tests, including scoring/rollback and two audit tests; browser operator/scoring checks | Pass                                                                               |
| Original vectors and checker unchanged            | Final `git diff --exit-code HEAD -- tests/vectors scripts/check-vectors.ts`; `build/slice1/verify-final.log`                     | Pass: 9 known + 6 theme vectors in each of six runtimes                            |
| Theme regression                                  | Full palette check; `build/slice1/theme-sheet.log`; pre/post contact-sheet hashes                                                | Pass: 30,000 palettes; HTML/PNG byte-identical                                     |
| Full local verification                           | `bun run verify`; `build/slice1/verify-final.log`                                                                                | Pass, exit 0: 131 units, 37 D1/auth tests, 174/174 browser tests, all other stages |
| Deferred Slice 0 test                             | `tests/slices/slice0-base-tag.test.ts`                                                                                           | Deferred and outstanding; not passed or waived                                     |
| Slice and production boundaries                   | Final diff and local command review                                                                                              | Slice 1 only; no production changes                                                |

**Measurements:** Local desktop, AMD PRO A8-8650B, Linux x64, Bun 1.4.2;
preloaded generator with no network, 10,000 measured runs per family. Values are
reported goals/diagnostics, not a new performance gate. Evidence:
`docs/evidence/v1.1-themes/palettes.json` and `build/slice1/RESUME.md`.

| Family  | Runs   | Median   | p95      | Status          |
| ------- | ------ | -------- | -------- | --------------- |
| Block   | 10,000 | 1.178 ms | 4.213 ms | Diagnostic goal |
| Memory  | 10,000 | 0.916 ms | 3.526 ms | Diagnostic goal |
| Connect | 10,000 | 1.100 ms | 4.086 ms | Diagnostic goal |

All 30,000 palette checks passed. Freshness remains best effort; no numeric target
was introduced. No phone, cold-load, LCP/INP/CLS or production-load measurement was
performed. Browser regression coverage completed in 38.5 minutes with
`workers: 1` across Chromium, Firefox and WebKit; this is suite duration, not a
product-performance measurement. The earlier owner-interrupted run is preserved
as `build/slice1/verify-interrupted.log`. Tooling emitted color-environment notices;
the app type-check passed with zero errors and zero warnings.

**Waivers:** None inferred; the deferred Slice 0 test remains outstanding.
**Owner responsibilities:** Review Slice 1 and explicitly confirm before Slice 2.
Production authorization remains separate. **CODEMAP:** Updated with the completed
Slice 1 implementation, evidence paths and next-slice boundary. Saved handoff:
`build/slice1/RESUME.md`. No automatic continuation to Slice 2 is authorized.

## 2026-11-02 — Engine refactor Slice 2: lazy registry and generic PlaySession

**Built:** The owner confirmed Slice 1 at `e906e87f2894934965a702bebfb716c62dc774cd`
("Refactor puzzle identity and manifest-owned scoring") and authorized Slice 2
only. Work started at that HEAD; the owner's existing brief edits were preserved.
Slice 1's acceptance was not reopened.

The generator now emits a headless manifest/message catalog and a separate lazy
`puzzleViews` map, discovered from manifest ids and package directories. Neither
file exports hardcoded puzzle logic or eager Game components. Each manifest
references its existing round generator; Block's existing headless backdrop data
and replay helper remain available through its manifest. Existing consumers and
the Slice 1 synthetic fixture were migrated to this interface.

PlaySession keeps one generic round and one generic view. Small per-package
`View.svelte` adapters preserve each unchanged Game's props, completion callback
and result presentation. Names, bests, played flags and best-score storage keys
derive from ids, retaining existing key bytes/version suffixes. Manifest metadata
preserves the original seeded selection order and Connect title reveal timing.
Solo preparation still generates one candidate without drawing the selector or
reserving ranked play; it does not download an unplayed view. Only the foreground
view loads, before ranked issuance, with an eight-second timeout and cancellation
on departure. Failed loading retains the pending family and any finished result.

Added `tests/slices/slice2-lazy-registry.test.ts`, actual browser request/retry
coverage, and a client chunk-graph report/check in `verify` after the Worker build.
The checker rejects direct or transitive static Game imports from the shell and
cross-family Game dependencies in a selected view. Its regression fixtures include
indirect imports and merged views. Diagnostic output stays outside release assets.

The first full browser run exposed a preexisting hydration race in the operator
audit test. Trace inspection showed actor/action inputs populated, then reset
during late hydration before submission, with no intervening data request. The
operator shell now reuses AccountShell's readiness signal; the test waits for
hydration before navigation/input. Filter logic and assertions are unchanged.
The targeted test and the fresh full suite passed. Earlier failed-run logs remain
in `build/slice2/`; the failed run was stopped before changing source.

**Skipped:** Slice 3 and later slices, server dispatch/config refactoring, new
puzzles, per-type indexable pages/game doors, deployment, provisioning, secrets,
DNS, Google changes, database reset, commit and push. No puzzle rules, generation
functions, validation, scoring logic/data, Game components, ending declarations,
messages, vector data or sounds changed. Vector harness imports changed only to
use manifest methods. The Slice 0 base-tag test remains deferred and outstanding;
it was not added, run, passed or waived by Slice 2.

**Known issues:** No functional regression remains from this slice's checks.
View code loads on demand; real-phone/4G cold-load and Next timing remain
unmeasured. Headless manifest/message aggregation remains eager; this slice's
acceptance isolates Game views, not every headless engine module. No physical-device,
production-load or launch-performance acceptance is claimed.

**Decisions:** Reuse existing generators and unchanged Game components behind
small adapters; preserve storage compatibility and seeded selector ordering.
Use actual emitted static/dynamic chunk edges for the bundle gate and the existing
shell readiness pattern for reliable input synchronization. No dependencies or
pinned versions changed. See `docs/DECISIONS.md` and `docs/EDGE_CASES.md`.

**Questions for the owner:** Written confirmation is required before Slice 3.
No further implementation has started.

| Acceptance item                                             | Evidence type and location                                                                                              | Result                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required Slice 1 starting point and scope                   | Initial HEAD `e906e87`; owner instruction and final local diff                                                          | Pass; Slice 2 only                                                                                                                                                              |
| Generated headless catalog and lazy id-to-view map          | `scripts/generate-registry.ts`, generated files; Slice 2 unit discovery/synthetic-folder fixture                        | Pass; no hardcoded logic/eager Game exports                                                                                                                                     |
| Generic session and id-derived state/storage                | `PlaySession.svelte`, per-game adapters, storage regression; full account/Card/result/browser coverage                  | Pass; one round/view pair, compatible saved keys                                                                                                                                |
| Unplayed Game views excluded on first Play                  | Emitted graph `build/slice2/client-chunks.json`; `check:lazy-bundle`; `tests/e2e/lazy-registry.spec.ts`                 | Pass; shell isolated and 3 independent Game views; speculative preparation requests no other view                                                                               |
| Load failure, retry, cancellation and retained result       | Slice 2 loader units, actual failed-import/retry browser test and existing preparation/recovery checks                  | Pass; no selector draw or lost result on failure                                                                                                                                |
| Existing gameplay, endings, sounds and selector-only routes | Unchanged Game/logic/scoring/message/audio/vector files; six-runtime vectors; browser game/ending/sound/redirect checks | Pass                                                                                                                                                                            |
| Operator audit input synchronization                        | `build/slice2/operator-hydration.log`; test 70 in final full browser run                                                | Pass; targeted 1/1 and final full suite                                                                                                                                         |
| Full local verification                                     | `bun run verify`, `build/slice2/verify-final.log`                                                                       | Pass, exit 0: lint, zero-error/zero-warning types, boundaries, 30,000 palettes, 137 units, 37 D1/auth tests, six runtimes, isolated Worker smoke, bundle gate, 176/176 browsers |
| Deferred Slice 0 base-tag test                              | Owner's explicit carry-forward; `tests/slices/slice0-base-tag.test.ts` remains absent                                   | Deferred and outstanding; not passed or waived                                                                                                                                  |
| Production and next-slice boundary                          | Local command/diff review                                                                                               | No deployment/production changes; Slice 3 not started                                                                                                                           |

**Measurements:** Bundle isolation is a structural acceptance gate, checked on
one local production build, rather than a latency target. The following chunk
sizes are diagnostics from that build (raw/gzip bytes, no network/device or
median/p95 interpretation). Each contains only its own Game/View; shared chunks
are additional. Evidence: `build/slice2/client-chunks.json` and built client output.

| Family  | Independent chunk | Raw bytes | Gzip bytes |
| ------- | ----------------- | --------- | ---------- |
| Memory  | `zQ15A06p.js`     | 15,750    | 5,969      |
| Block   | `D2Js6mbM.js`     | 17,873    | 6,852      |
| Connect | `Brd-x7R9.js`     | 9,630     | 3,970      |

The existing Next measurement ran on headless desktop Chromium, 1280×720, on an
unthrottled localhost development server: preloaded solo Memory-to-selector
transitions, fresh session each run, reduced motion, 5 runs. Next activation to
next-round DOM measured **median 497.3 ms, p95 907.5 ms**; this excludes per-game
entrance/preview. This remains a diagnostic goal, not phone/4G or public-launch
acceptance. Evidence: `build/v1.1-card/preparation-measurements.json`. LCP/INP/CLS,
physical devices and production resource targets were not measured in this slice.
Palette diagnostics from this run are preserved in `build/slice2/palettes.json`;
timing-only changes to the tracked historical palette artifact were removed.
All 30,000 palette checks passed; freshness remains best effort with no new target.
The full browser suite used `workers: 1` across Chromium, Firefox and WebKit and
took 39.0 minutes; that is suite duration, not product performance.

**Waivers:** None inferred. The Slice 0 base-tag test remains deferred and
outstanding under the owner's explicit instruction; its missing automated
freeze check remains an evidence gap, not a Slice 2 pass.

**Owner responsibilities:** Review Slice 2 and provide written confirmation
before any Slice 3 work. Production/resource, deployment, Google and physical-device
release responsibilities remain separate; no new approval is inferred.

**CODEMAP:** Updated and condensed to the current package/shell/testing map,
including lazy registration, generic views, evidence and the Slice 3 stop boundary.

**Owner Git handoff — 2026-11-02:** After the local closeout above, the owner
explicitly requested updating the Git repository and pushing to GitHub. This
authorizes committing and pushing the completed Slice 2 source, tests and docs,
including the owner's existing brief edits. The earlier skipped commit/push
entry records the original closeout. This handoff does not authorize Slice 3,
deployment or production changes.

## Engine refactor Slice 3 — Server validation and D1/KV config (2026-11-02)

**Built:** Worked from owner-confirmed Slice 2 push `7a84063`, "Refactor lazy
puzzle registry and generic play session". Only Slice 3 was implemented.

Manifests own move shapes/canonical mapping, replay/scoring validation, existing
ranked opening/minimum timing and leaderboard groups. Shared server validation
uses these contracts without family branches. A synthetic manifest-only family
with novel numeric fields starts, replays, scores, retries canonically, and appears
in server history/rankings without family-specific server/schema/migration edits.

D1 family columns are plain text. Missing lifecycle rows come from catalog lookup
without reviving disabled/deleted entries. Migration
`0011_catalog_config_sessions.sql` adds immutable game/theme/style snapshots,
live config pointers and ranked abandonment. It removes the stale measurement
family SQL check while preserving rows, remaining checks and indexes, invalidates
older unclaimed tokens, and preserves claimed retries. Existing columns, tables,
defaults and request envelopes remain usable for one release.
**Database-reset permission covers local D1 only, including this schema; no reset
was performed.** No remote database or namespace was provisioned.

Config readers use D1 live pointers, validated immutable KV snapshots, bounded
parent fallback and safe code defaults. KV failures fall through to D1; issued
historical scoring versions never substitute new defaults. The local-only
`CONFIG_CACHE` binding/types are ready. Applying selector weights remains Slice 4;
theme/style application and admin publishing remain Slice 5.

Ranked issuance permits one active round per account across families with the
existing two-hour TTL. A second browser sees a conflict and must explicitly take
over. Takeover/issuance commit together; failed starts preserve the first session.
Home abandons an exact unclaimed session; stale requests cannot release a
replacement. Valid claimed submissions remain locked/retryable through storage
failure. Review found and fixed terminal replay/timing rejection retaining the
lock: terminal failures release only their own session, retain hash/claim time,
and count toward the existing abandon cap. Puzzle rules and scores are unchanged.

**Skipped:** Slice 4 and later work; new games or public game doors; production
provisioning, secrets, DNS, Google changes, deployment, commit and push. Existing
owner edits to the brief were preserved. **The Slice 0 base-tag test remains
deferred and outstanding; it was not added or claimed as passed.**

**Known issues:** No known Slice 3 functional failure remains in the checks below.
Live production D1/KV behavior, resource/load measurements and physical-device or
phone/4G performance remain unverified. Theme freshness remains the existing
best-effort diagnostic for its assigned later slice. The missing automated
base-tag assertion remains an evidence gap.

**Decisions:** Code owns rules, validation, timing/security and typed defaults;
D1 owns config/live pointers and enforcement; KV caches immutable config only.
New families require no schema or migration seed-list edits. Details are in
`docs/DECISIONS.md` and `docs/EDGE_CASES.md`. Dependency versions and compatibility
date are unchanged: Wrangler 4.151.3, Drizzle 0.45.4, TypeScript ~6.0.3.

**Verification method:** Development used fast static/unit/D1 checks without
palettes or the full browser suite. One milestone `bun run verify` passed through
Worker/bundle checks, then a host restart interrupted browsers; that invocation
has no final exit status. Only the browser stage restarted: **177/177 passed**
with `workers: 1`. After the bounded lock-recovery fix, affected units, D1/auth,
lint/types, Worker/bundle and **3/3** Chromium cases passed. No second full verify,
palette or vector run was started. A new cap test initially expected rejection
one attempt early; only its expectation was corrected to preserve the existing
"more than ten abandons" rule, then its entire affected suite passed.

**Evidence table:**

| Acceptance item                                                                               | Evidence type and location                                                                                   | Result                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Novel manifest-only family starts/replays/scores; canonical moves, timing, groups and history | Real isolated D1; `tests/slices/slice3-catalog-server-validation.test.ts`; `build/slice3/units-recovery.log` | Pass; 6 Slice 3 cases within 143/143 units                                                      |
| Catalog lifecycle/config/weights, text family keys and Connect measurements                   | Synthetic D1 config/cache/fallback and measurement inserts in Slice 3 suite                                  | Pass                                                                                            |
| Compatible migration; legacy measurement rows/indexes and claimed hashes/times preserved      | Before/after 0011 D1 fixtures in Slice 3 suite                                                               | Pass; no reset                                                                                  |
| Account-wide lock, concurrency, explicit takeover/abandon and two-hour TTL                    | Real D1 tests and two-browser account test; `build/slice3/e2e-final.log`, `e2e-recovery.log`                 | Pass                                                                                            |
| Terminal rejection recovery, protected valid retries, unchanged abuse cap                     | Trigger-injected D1 failure/rejection tests; `build/slice3/accounts-recovery.log`, `runs-recovery-final.log` | All 41 cases covered: other 19 passed; affected run suite 22/22 passed after fixture correction |
| Formatting/lint, zero-warning types and import boundaries                                     | `build/slice3/verify-final.log`, `lint-recovery.log`, `lint-runs-recovery.log`, `check-recovery.log`         | Pass; 0 errors/0 warnings                                                                       |
| Palettes, vectors, built Worker and lazy isolation                                            | `build/slice3/verify-final.log`, `worker-recovery.log`, `bundle-recovery.log`                                | 30,000 palettes; 9 vectors in each of six runtimes; Worker/bundle pass                          |
| Gameplay, endings, sounds, layouts and withdrawn doors                                        | 177 browser checks; 3 affected reruns after recovery fix; unchanged game views, vector files and audio       | Pass                                                                                            |
| Slice 0 automated base-tag test                                                               | Owner-recorded deferral in prior reports and this handoff                                                    | Deferred and outstanding, not a pass                                                            |

**Measurements:** Theme diagnostics used local Linux x64/Bun 1.4.2, a preloaded
generator, no network and 10,000 runs per family. Results are preserved in
`build/slice3/palettes.json`; timing-only changes to the historical tracked palette
artifact were removed. These are diagnostic goals without an owner-approved
numeric gate, not phone/4G release evidence.

| Measurement                                                                                |   Runs |   Median |      p95 | Status                                         |
| ------------------------------------------------------------------------------------------ | -----: | -------: | -------: | ---------------------------------------------- |
| Memory theme generation                                                                    | 10,000 | 1.037 ms | 3.884 ms | Diagnostic goal                                |
| Block theme generation                                                                     | 10,000 | 1.391 ms | 5.118 ms | Diagnostic goal                                |
| Connect theme generation                                                                   | 10,000 | 1.261 ms | 4.589 ms | Diagnostic goal                                |
| Mid-range phone/4G LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1; cold/preloaded critical path ~150 KB |      0 |        — |        — | Unmeasured release targets; no waiver inferred |
| Production D1/KV latency, throughput and resource targets                                  |      0 |        — |        — | Unmeasured; separate production evidence       |

The browser stage took 35m38.66s on the local desktop host, unthrottled localhost,
Chromium/Firefox/WebKit, one worker. Recovery Worker smoke took 37.77s; the three
affected Chromium checks took 91.82s. These are test durations, not user-performance
measurements.

**Waivers:** No new waivers. The owner's permission to proceed with the Slice 0
test deferred remains in force; that test and its missing freeze assertion remain
outstanding rather than silently waived or closed.

**Questions for the owner / owner responsibilities:** Review this local Slice 3
handoff and provide written confirmation before Slice 4. No next-slice work or
production/deployment action is inferred. Existing release/device/Google and
operations responsibilities remain separate.

**CODEMAP:** Updated with manifest server contracts, config/cache readers,
ranked ownership/recovery, migration/test evidence and the Slice 4 stop boundary.

**Owner Git handoff — 2026-11-02:** The owner explicitly requested updating the
Git repository and pushing to GitHub. This authorizes committing and pushing the
completed Slice 3 source, tests and documentation, including the owner's existing
brief edits. The skipped commit/push entry above records the original closeout.
This handoff does not accept Slice 3, authorize Slice 4, or authorize deployment
or production changes. Existing verification evidence is retained; app tests
were not repeated for this Git handoff.

## Engine refactor Slice 4 — Selector v2 (2026-11-02)

**Scope/base:** Owner confirmed Slice 3 and authorized Slice 4 only, starting at
`4cffb4e` ("Refactor catalog validation, config and ranked sessions"). Slice 3's
acceptance/evidence is retained. Slice 5 has not started and requires written
owner confirmation.

**Built:** Replaced recursive backtracking and repeated weighted scans with one
weighted exponential key per family, eight fixed radix passes and greedy gap
repair bounded by five recent families. Every family appears exactly once per
completed stable-eligibility cycle; no immediate repeat and
`gap = clamp(floor(eligible / 3), 1, 5)` hold across cycles. The existing sole-family
repeat exception remains. A 2x discovery weight favors never-completed families
without extra appearances. D1 config weights, lifecycle availability and manifest
viewport/orientation flags filter selection between rounds, retaining an active
board through resize.

The generated 443-byte TypeScript family index contains selection metadata only.
Browser scoring/presentation/messages use generated data projections; the eager
manifest catalog remains server-side. The chosen/pending procedural variant pool
loads through a dynamic manifest import using its unchanged `createRound`;
preparation still defers the next view and never consumes a pick. Pool/view loads
share the existing cancellation and eight-second timeout path.

Versioned localStorage snapshots retain eligible ids, queue, recent families and
cycle position per guest/account on this browser. A peeked refill and successful
round commit save immediately; failed generation retains the pending family.
Invalid/stale snapshots reset safely and blocked storage uses the existing memory
fallback. The actual refresh test verifies the saved snapshot is read intact,
then advances exactly one queued family. Retention and edge cases are documented.

**Skipped:** Slice 5 and later work, new variants/games, mid-round checkpoint or
ranked-resume UI (assigned to Slice 6), per-type public pages/game doors, commit
and push. No puzzle rules, generation, validation, scoring logic, gameplay,
endings or sounds changed. No deployment, provisioning, secrets, DNS or Google
changes occurred. Existing owner edits to the brief were preserved.
**The Slice 0 base-tag test remains deferred and outstanding.**

**Known issues:** Storage clearing, another browser/profile, or simultaneous tabs
can bypass/reorder local selector continuity; this is not anti-cheat. Blocked
storage cannot preserve the in-memory fallback through reload. Eligibility
changes reconcile a partial cycle; if its new gap is impossible, a fresh cycle
retains recent-family exclusions. Phone/4G and production resource behavior are
unmeasured. No unresolved Slice 4 failure remains in the authorized checks.

**Decisions:** No dependencies or pins changed. The linear bound comes from fixed
radix passes and bounded repair, supported by deterministic work counters and
adversarial timing. Existing procedural pools are reused without new variant
selection or puzzle parameters. See `docs/DECISIONS.md`, `docs/EDGE_CASES.md` and
`docs/PRIVACY_RETENTION.md`.

**Verification method:** Fast checks only. Lint, zero-warning type-check and
boundaries passed. The broad unit rerun passed 157/158; one existing Connect seed
loop exceeded its 5-second timeout under concurrent host load (5.13 s). Its
unchanged file passed all 5 cases in isolation (2.16 s), covering all 158 cases
across the runs. The explicit Slice 4 file passed 15/15; the focused Chromium
reload test passed 1/1 with `workers: 1`. Initial fixture/type/lint issues were
corrected before the final checks; source edits and checks were serialized.

No `bun run verify`, palette suite, account integration suite, vector matrix,
Worker build/smoke or full browser suite ran. The next full milestone is after
Slice 6, with the final full run after Slice 7; this fast-only handoff remains
provisional until that milestone. The reload test stubs availability/scoring
responses and exercises the real page, loaders, selector and browser storage;
it makes no claim about account/backend integration.

**Evidence table:**

| Acceptance item                                                                      | Evidence type and location                                                                                                             | Result                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Exactly once/cycle, no immediate repeat, gap formula and weighted discovery          | Seeded properties in `tests/slices/slice4-selector-property.test.ts`, plus existing selector units; `build/slice4/slice4-targeted.log` | Pass; 15/15 Slice 4 cases, including 2–50-family sequences                  |
| Linear work and no backtracking blow-up at 50 families                               | Adversarial weighted cycles, RNG/repair counters and instrumented timing in the Slice 4 file/log                                       | Pass; 50 RNG draws/cycle; bounded repair                                    |
| Small family index, lazy pools and unchanged manifest projections                    | Generated-index/projection consistency, browser import guards, synthetic generator fixtures and lazy-pool round equivalence            | Pass in Slice 1/2/4 unit coverage                                           |
| Reload preserves queue/recent/position; account/guest isolation and failure fallback | Storage units plus `tests/e2e/selector-reload.spec.ts`; `build/slice4/reload-chromium.log`                                             | Pass; actual Chromium refresh, one worker                                   |
| Lint, types, boundaries and units                                                    | `build/slice4/lint-final.log`, `check-final.log`, `boundaries.log`, `unit-rerun.log`, `connect-rerun.log`                              | Pass; 0 errors/0 warnings; all 158 unit cases covered across suite/recovery |
| Full milestone verification                                                          | Owner-authorized fast-check schedule                                                                                                   | Deferred to after Slice 6, then final after Slice 7                         |
| Slice 0 automated base-tag test                                                      | Recorded owner deferral                                                                                                                | Deferred and outstanding; not a pass or closed waiver                       |

**Measurements:** Local Linux x64 desktop host, Node v24.14.1, Vitest, no network.
Selector code was preloaded; 10/25/50-family bound checks warmed it before 25
samples, each containing ten complete 50-family cycles with adversarial weights.
Selector construction/setup was excluded; the repair counter instrumentation was
included. The median was **1.948 ms** and p95 **2.830 ms per ten-cycle sample**;
50 RNG draws and 6.2 repair checks per cycle were observed in the recorded sample.
The test's p95 <1,000 ms guard and linear-work bounds passed. These are local
algorithm checks, not phone/rendering benchmarks. Chromium refresh took 10.8 s
(22.3 s including command/server startup), without network throttling; that is a
test duration, not a user-performance target. LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1,
cold/preloaded phone/4G transfer and production resource targets have zero runs in
this slice; no release-performance pass or waiver is inferred.

**Waivers:** No new waivers. The Slice 0 base-tag test remains deferred and
outstanding. Fast-only verification follows the owner's explicit schedule.

**Questions for the owner / owner responsibilities:** Review the local Slice 4
handoff and provide written confirmation before Slice 5. No next-slice or
production/deployment action is inferred. Existing release/device/Google and
operations responsibilities remain separate.

**CODEMAP:** Updated for selector state/eligibility, generated small index/data
projections, lazy procedural pools, acceptance tests, evidence and the Slice 5
stop boundary.

**Owner acceptance and Git handoff — 2026-11-02:** The owner explicitly accepted
Slice 4 and authorized pushing it to GitHub. Commit and push the completed
Slice 4 source, tests and documentation, including the existing owner brief
updates. The earlier skipped commit/push entry records the original closeout.
Acceptance follows the fast-check schedule and remains provisional until the
full milestone after Slice 6; the Slice 0 base-tag test remains deferred and
outstanding. This Git handoff does not start Slice 5 or authorize deployment or
production changes. Existing app-test evidence is retained; app tests were not
repeated for this documentation/Git handoff.

## Engine refactor Slice 5 — Theme/style admin, freshness and palette cache (2026-11-03)

**Status:** complete locally for owner review, from owner-confirmed Slice 4 push
`2cbaf49` ("Refactor selector cycles, lazy pools and persistence"). Work resumed
following the interrupted 2026-11-02 session. Slice 4 was not reopened. Slice 6
has not started and requires the owner's written confirmation. This fast-only
result remains provisional until the full milestone after Slice 6.

**Built:** `/admin/themes` provides immutable JSON drafts, palette/config checks,
protected Worker previews, publish and rollback using the existing sensitive
operator guards and audit flow. The versioned D1 snapshot includes recipes,
styles, containers, backdrops, per-family profiles and site tokens. Migration
`0012_theme_admin.sql` preserves existing rows and adds immutable drafts and
single-child publication conflict protection. Live readers follow bad versions
back to their last valid parent, including invalid cached rows. Rollback restores
prior values in a new audited version without changing code. The local browser
fixture restores its original values after exercising publication and rollback.

Freshness now selects the lowest weighted penalty among bounded candidates,
using family/version history and varying distinct symbol subsets. Palette solves
are cached by recipe, hue bucket, chroma, target and ground. OKLCH/Machado safety
and site contrast remain hard publishing gates. Normal solo generation stays in
its Worker; a Worker failure uses existing recovery instead of blocking the main
thread with synchronous solving. New backdrop positions scatter independently in
two dimensions. The actual scatter seed includes its configured backdrop kind,
so admin pool edits affect the rendered layout. The legacy CSS audit covers all four requested files, removes
conflicting wrapper colors, connects cosmetic values to 94 editable tokens, and
retains structural sizing/layout. Container shapes are carried in round snapshots.

**Skipped:** Slice 6; full `bun run verify`; full accounts and browser suites;
six-runtime vectors; guest artifact/deployment checks; production measurements;
physical-device testing; commits/pushes and all deployment/provisioning/secret/DNS/
Google changes. No game doors or per-family indexable pages were introduced.
No puzzle rules, generation/validation/scoring logic, gameplay, endings or sounds
were changed. Only cosmetic theme vector fixtures were regenerated.

**Known issues/limits:** two existing 5-second unit cases timed out during the
combined run under concurrent machine load. Both passed isolated reruns with the
same timeout; no timeout or game logic was changed. All 173 unit cases are covered
across that run and the isolated recovery. The preview is Chromium responsive
emulation, not physical phone review. Freshness is a preference score, so some
weighted repeats remain; the previous construction that always repeated the
symbol set is gone. Local generation timings include machine contention and
must not be interpreted as phone/Web Vitals measurements. The previous solo
cosmetic identifier is accepted with safe current profile/token defaults; exact
historical solo art is not asserted. Issued ranked snapshots remain authoritative.

**Decisions:** `theme-2026-11-02-1` configuration and `oklch-machado-2` cosmetic
generator; one combined theme/style/token version; bounded immutable caches;
10-of-12 distinct symbols by default, with a 10–12 admin bound protecting the
current ten renderer slots. Existing Memory pair counts remain 6/8/10. No
package changes or new dependencies. Details and the D1 reference are recorded
in `docs/DECISIONS.md`.

**Questions for the owner:** confirm Slice 5 in writing, or provide corrections,
before Slice 6 may begin.

### Evidence

| Acceptance item                                                                                                      | Evidence type and location                                                                                                                                            | Result                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| D1 draft/check/publish flow, family profiles, immutable versions, audit and conflicting edits                        | Real isolated D1: `tests/slices/slice5-theme-admin-rollback.test.ts`; `build/slice5/units-final.log`                                                                  | Pass, 4/4 Slice 5 cases; per-family style/container/symbol values exercised after publish                   |
| Bad palette rejected by normal publication                                                                           | Actual publishing gate in the Slice 5 D1 test; engine safety unit cases                                                                                               | Pass                                                                                                        |
| Invalid live palette/config falls back to previous effective version, then rollback restores values without redeploy | D1/KV bad-palette and invalid-JSON parent-chain test; actual HTTP/browser workflow in `tests/e2e/theme-admin-preview.spec.ts`; `build/slice5/theme-preview-final.log` | Pass; unsafe publication is fault-injected through D1 because the normal admin gate correctly rejects it    |
| Preview before publish/invalid-live/rollback at 390×844, 844×390 and 1280×800                                        | One Chromium workflow, `workers: 1`; three PNGs in `build/slice5/browser/theme-admin-preview-operat-5995d-lls-back-without-a-redeploy-chromium/`                      | Pass; captures inspected locally                                                                            |
| Weighted best-of-N, family/version isolation, distinct symbol subsets and palette reuse                              | `src/lib/engine/theme/theme.test.ts`, `src/lib/ui/theme-history.test.ts`; `docs/evidence/slice5-themes/palettes.json`                                                 | Pass; all 66 possible 10-of-12 subsets reached per family in the diagnostic                                 |
| Palette safety, gamut reduction and Machado separation                                                               | `build/slice5/palettes-pass.log`; `docs/evidence/slice5-themes/palettes.json`; negative publishing tests                                                              | Pass, 30,000 palettes; every hue bucket below the existing 5% fallback gate                                 |
| Worker normal path and explicit failure recovery                                                                     | Worker config/failure unit tests; preview observes real `theme-worker` instances                                                                                      | Pass; no synchronous solver fallback                                                                        |
| Four-file legacy CSS audit and editable safe tokens/shapes                                                           | `docs/SLICE5_CSS_AUDIT.md`; site-token/schema/shape tests; responsive previews                                                                                        | Pass; structural layout retained                                                                            |
| Theme sheet and scattered backdrop coordinates                                                                       | `docs/evidence/slice5-themes/contact-sheet.html` and `contact-sheet.png`; engine scatter and existing family-isolation tests                                          | Pass; 60 samples across all three families; sheet inspected                                                 |
| Fast lint, zero-warning types and boundaries                                                                         | `build/slice5/lint-pass.log`, `check-pass.log`, `boundaries-final.log`; final fixture/document closeout logs in the same directory                                    | Pass; 0 type errors, 0 warnings                                                                             |
| Units                                                                                                                | `build/slice5/units-final.log`, `timeouts-connect.log`, `timeouts-backdrop.log`, `backdrop-final.log`                                                                 | All 173 cases covered: 170 in combined run, 2 isolated timeout recoveries and the final backdrop regression |
| Rules/scoring/endings/sounds and public-door boundaries unchanged                                                    | Source diff review and unit coverage; no gameplay vector files changed                                                                                                | Pass for scoped source review; full runtime/vector milestone deferred                                       |
| Slice 0 base-tag test                                                                                                | Owner's recorded deferral; no reset performed                                                                                                                         | **Deferred and outstanding**, not passed or waived                                                          |

### Measurements

Local Linux x64 desktop, Bun 1.4.2; preloaded generator and progressively warm
bounded cache, no network; 10,000 palette-generation runs per family. Other local
jobs were active. These are reported **goals**, not phone performance gates.

| Family  | Median generation | p95 generation | Fallbacks / 10,000 | Worst hue-bucket fallback rate |
| ------- | ----------------: | -------------: | -----------------: | -----------------------------: |
| Memory  |           1.42 ms |       10.24 ms |                245 |                          3.71% |
| Block   |           2.60 ms |       20.69 ms |                286 |                          4.52% |
| Connect |           4.43 ms |       25.92 ms |                265 |                          3.46% |

The final best-effort freshness diagnostic runs 1,000 rounds per family with
three-theme history and at most eight candidates. Weighted score median/p95 was
3/5 for each family; symbol penalties occurred in 41.1% / 42.3% / 40.6% of
Memory/Block/Connect choices, rather than being unavoidable. There is no
owner-supplied numeric freshness target. The palette safety gate retained
10,000 samples per family; the earlier 10,000-round freshness diagnostic attempt
was stopped before producing a result. Browser functional review used one local
Chromium workflow with three viewport captures, not repeated performance runs.
No phone, cold/4G, LCP, INP or CLS result is claimed in this fast slice.

**Waivers:** no new acceptance waiver. The owner requested fast checks and
explicitly deferred full verification to after Slice 6, then after Slice 7.
The Slice 0 base-tag test remains deferred and outstanding. Deferral retains the
risk that the later full milestone finds integration issues beyond this slice.

**Owner responsibilities:** review the theme/admin result and confirm Slice 5
in writing before Slice 6. Production authorization and any physical-device or
launch measurements remain separate owner gates; no such acceptance is inferred.

**CODEMAP:** updated for Slice 5 runtime/admin/config paths, tests and evidence.

### Slice 5 Git handoff — owner authorization (2026-11-03)

The owner requested updating the local Git repository and pushing the completed
Slice 5 work to GitHub. Include the source, tests, evidence, phase documentation
and the existing owner updates to the engine brief. The earlier skipped
commit/push entry records the original local closeout. Existing fast-check
evidence is retained; app tests are not repeated for this Git handoff. This
instruction authorizes source publication only: Slice 6 still requires written
confirmation, and no deployment or production change is authorized. The Slice 0
base-tag test remains deferred and outstanding.
