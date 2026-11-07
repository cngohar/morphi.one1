# CODEMAP.md

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
