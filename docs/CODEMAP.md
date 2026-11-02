# CODEMAP.md

Read this map before searching. Types and implementation live in code; decisions and historical evidence live in the linked docs.

## Current scope

- Engine refactor Slice 1 is owner-confirmed at `e906e87` ("Refactor puzzle identity and manifest-owned scoring"). Slice 2 is complete locally: generated headless catalog/lazy views and generic PlaySession. Final `bun run verify` passed 137 units, 37 D1/auth tests, six-runtime vectors, Worker smoke, bundle isolation and 176/176 browser tests. Evidence: `build/slice2/verify-final.log`, `docs/PHASE_REPORTS.md`. Stop for written owner confirmation before Slice 3.
- Approved brief: `docs/morphi-engine-refactor-brief.md`. Frozen base tag `v1.2-local-complete` points to `1303c9c4bdb1718bb558886dc43b7b48c597a02a`. The Slice 0 base-tag test remains deferred and outstanding; no reset was performed. Owner edits to the brief are preserved.
- v1.1 and combined next-phase work are accepted locally. Owner PC review and mobile responsive emulation were reported; physical mobile review was not. See `docs/NEXT_PHASE_REVIEW.md`, `docs/V1.1_WORK.md` and `docs/PHASE_REPORTS.md`.
- Active day-to-day plan: `morphi-plan-simple.md`; `docs/PLAN.md` is reference. The approved engine brief controls this refactor. No deployment, production provisioning, secrets, DNS or Google changes are authorized.
- The published guest/privacy version remains `b50a7a18-2e85-4406-bd40-77f27c4b3da3` at `https://morphi.one` and `https://morphi-one.electrasincng.workers.dev`. Cloudflare injects its intentional analytics beacon at delivery. Source repository: `https://github.com/cngohar/morphi.one1`; pushing does not authorize deployment.

## Engine and registration

| Path                                                            | Purpose                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/engine/contract.ts`, `scoring.ts`                      | Platform-free string ids, moves, runs and manifest/scoring contracts; manifest `createRound` supplies headless generation    |
| `src/lib/engine/rng.ts`, `src/lib/seeds.ts`                     | Pure SplitMix64 v1 and canonical seed handling; external cryptographic entropy                                               |
| `src/lib/puzzles/<directory>/manifest.ts`                       | Puzzle id/version, generation, replay, scoring definition, messages, ending declaration and presentation/order metadata      |
| `src/lib/puzzles/*/scoring.ts`, `messages.ts`                   | Family-owned coefficients/default versions and text bundles; no replay/manifest import cycle                                 |
| `scripts/generate-registry.ts`                                  | Discovers/sorts packages and validates ids/endings; emits catalog and lazy view map, with no hardcoded logic or Game exports |
| `src/lib/catalog.ts`                                            | Generated headless manifest catalog and typed message aggregation; no Svelte views                                           |
| `src/lib/registry.ts`                                           | Generated app `puzzleViews[id]()` dynamic imports of each package's `View.svelte`                                            |
| `src/lib/scoring.ts`                                            | Catalog-driven scoring defaults and validation for UI/server/admin                                                           |
| `src/lib/selector.ts`                                           | Injected-RNG weighted family bag, minimum gap and stable peek; existing algorithm unchanged                                  |
| `eslint.config.js`, `scripts/check-boundaries.ts`               | Engine purity, cross-puzzle/app boundaries and deliberate-violation self-checks                                              |
| `scripts/validate-ending.ts`, `src/lib/ending-contract.test.ts` | Ending declaration validation against each family's supplied messages                                                        |
| `tests/slices/slice1-manifest-scoring.test.ts`                  | Manifest discovery, ownership and isolated novel-family generation/type-check                                                |
| `tests/slices/slice2-lazy-registry.test.ts`                     | Lazy discovery, novel id/folder mapping, invalid ids, bundle graph regressions, generic storage and bounded view loading     |

## Games and presentation

| Path                                                                                     | Purpose                                                                                                                          |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/puzzles/block-placement/logic.ts`                                               | Deterministic 8×8 Block supply, placement, clears, combos, cap and replay                                                        |
| `src/lib/puzzles/memory/logic.ts`                                                        | Deterministic Memory generation, flips, mismatch resolution, completion and scoring                                              |
| `src/lib/puzzles/connect/logic.ts`                                                       | Deterministic all-pairs path game; empty cells are allowed, full-grid coverage is a score bonus                                  |
| `src/lib/puzzles/*/Game.svelte`                                                          | Existing per-game rendering, input, entrances, timing, endings and sounds; unchanged by Slice 2                                  |
| `src/lib/puzzles/*/View.svelte`                                                          | Lazy adapters from generic shell props to each Game and its existing result presentation                                         |
| `src/lib/ui/puzzle-view.ts`                                                              | Common round/view/result props and eight-second view-load timeout with navigation cancellation                                   |
| `src/lib/puzzles/*/themes.ts`, `memory/symbols.ts`                                       | Legacy themes and procedural adapters; retained Memory symbols                                                                   |
| `src/lib/puzzles/memory/{Card,Symbol,Confetti}.svelte`                                   | Memory card presentation, inline symbols and deterministic win burst                                                             |
| `src/lib/engine/theme/`                                                                  | Cosmetic OKLCH/Machado math, JSON recipes/styles, seeded silhouettes and bounded freshness; excluded from game determinism hash  |
| `scripts/check-palettes.ts`, `theme-sheet.ts`                                            | Palette safety/freshness diagnostics and owner-approved contact sheet; `docs/evidence/v1.1-themes/`                              |
| `src/lib/ui/solo-theme.ts`, `theme-worker.ts`, `theme-history.ts`                        | Worker solving, bounded IndexedDB history and fallback                                                                           |
| `src/lib/ui/puzzle-backdrop.ts`, `backdrop-layout.ts`, `components/ThemeBackdrop.svelte` | Seeded current-game-only objects, exposed-space sizing, compact-layout hiding; Block piece data comes from its headless manifest |
| `src/lib/ui/prepare-ahead.ts`                                                            | One speculative solo candidate, no selector draw/ranked reservation; generation does not download the next view                  |
| `src/lib/ui/motion.ts`, `active-delay.ts`, `src/lib/round-timing.ts`                     | Sole anime.js wrapper, visible-time delays and server-known entrance/Card allowances                                             |
| `src/lib/ui/sound.ts`, `static/audio/`, `scripts/generate-sounds.ts`                     | Original offline ElevenLabs cues, bounded Web Audio playback and provenance; no runtime generation                               |
| `src/lib/ui/storage.ts`, `storage.test.ts`                                               | Id-derived versioned best/played keys, unchanged legacy bytes, sound/hint settings and blocked-storage fallback                  |
| `src/lib/ui/format.ts`, `dismiss-dialog.ts`                                              | Number/clock formatting and guarded backdrop dismissal                                                                           |

## App shell and public pages

| Path                                                                                            | Purpose                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/play/`, `src/lib/screens/PlaySession.svelte`                                        | Selector-only Mix loop; one generic round/view, id-derived names/bests/played flags, Card orchestration and durable results |
| `src/lib/components/RoundStage.svelte`                                                          | Persistent Card, entrances, played stack, ending overlay and result stage                                                   |
| `src/lib/screens/{HomeScreen,ResultScreen}.svelte`                                              | Approved landing/result views, actual account/save controls and Next                                                        |
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
| `src/lib/server/db/`, `migrations/`, `drizzle.config.ts`                                                                           | Local D1 schema/migrations for auth, public profiles, runs and operator controls                                                                               |
| `src/routes/account/`, `src/lib/components/account/`, `src/lib/ui/account.css`                                                     | Real account lifecycle/profile layouts; AccountShell readiness is the house hydration pattern                                                                  |
| `src/lib/ui/progress.ts`                                                                                                           | IndexedDB pending replays, ownership, guest import, retries and memory fallback                                                                                |
| `src/lib/server/runs.ts`, `play-http.ts`, `src/routes/api/play/`                                                                   | Ranked issuance/caps, authoritative bounded replay, immutable scoring versions and availability; per-family server dispatch remains for Slice 3                |
| `src/routes/api/progress/`, `src/routes/leaderboard/`                                                                              | Saved history and server-computed rankings                                                                                                                     |
| `src/lib/server/operator*.ts`, `admin-totp.ts`, `src/routes/admin/`, `scripts/admin-local.ts`                                      | Protected local operator workspace, role/TOTP/freshness guards, owner enrollment and audit; operator shell exposes readiness for browser input synchronization |
| `src/lib/server/{user-lifecycle,activity,admin-users,audit,moderation,games}.ts`                                                   | User controls, prospective activity, append-only audit, game lifecycle/statistics and scoring rollback                                                         |
| `src/lib/ui/account-activity.ts`, `src/routes/api/play/activity/`                                                                  | Existing account round-start/abandon reports                                                                                                                   |
| `src/lib/server/retention.ts`, `docs/PRIVACY_RETENTION.md`, `PRIVACY_REQUESTS.md`                                                  | Local cleanup/request deletion and documented retention/operator limits                                                                                        |
| `src/lib/server/measurement.ts`, `src/lib/ui/measurement.ts`, `src/routes/api/measurement/`, `components/MeasurementChoice.svelte` | Default-off coarse measurement, consent/DNT/GPC and withdrawal; families validate against catalog                                                              |
| `src/env.ts`, `src/lib/server/elevenlabs.ts`                                                                                       | Optional key schema and unused server stub; offline sound generation remains manual                                                                            |

## Build, verification and evidence

| Path                                                                                                 | Purpose                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`, `scripts/check-lazy-bundle.ts`                                                     | Client chunk membership/static/dynamic graph in ignored `build/slice2/client-chunks.json`; rejects eager/transitive Game imports and cross-family view closures |
| `package.json`, `vitest.config.ts`                                                                   | Bun commands and headless units, including Slice acceptance tests; verify runs bundle analysis after Worker build                                               |
| `tests/integration/`, `vitest.accounts.config.ts`                                                    | Isolated real D1/auth, scoring, lifecycle, audit and activity integration tests                                                                                 |
| `tests/vectors/`, `scripts/check-vectors.ts`, `measure-replay.ts`                                    | Unchanged known vectors in Node/Bun/Chromium/Firefox/WebKit/workerd and local replay-cost diagnostics                                                           |
| `scripts/check-worker.ts`, `finish-build.ts`                                                         | Isolated built-Worker smoke and removal of demo assets from release output                                                                                      |
| `playwright.config.ts`, `tests/e2e/`                                                                 | One browser worker; account, Card, game, recovery, operator, policy, selector and layout regressions across configured browsers                                 |
| `tests/e2e/lazy-registry.spec.ts`                                                                    | Actual selected-view-only requests during preparation/Next, failed import retry and retained result                                                             |
| `static/demo/`, `scripts/{card-proof,build-card-proof,check-v1-app,check-v1-demo}.ts`                | Reference demos and isolated visual checks; never production game logic                                                                                         |
| `wrangler.jsonc`, `wrangler.public-privacy.jsonc`                                                    | Local-account Worker configuration versus published assets-only guest/privacy configuration; never deploy without specific approval                             |
| `scripts/{prepare-public-privacy,check-public-privacy,setup-accounts}.ts`                            | Guest artifact validation and ignored local credential setup                                                                                                    |
| `docs/PHASE_REPORTS.md`, `docs/DECISIONS.md`, `docs/EDGE_CASES.md`                                   | Acceptance evidence, locked choices and required failure behavior                                                                                               |
| `docs/ADMIN_LOCAL.md`, `GOOGLE_AUTH_SETUP.md`, `GOOGLE_OAUTH_PUBLIC.md`, `CLOUDFLARE_AGENT_SETUP.md` | Owner-only local enrollment, Google setup/release gates and project-local Cloudflare tooling                                                                    |
| `docs/{STEP6_WORK,STEP6_REVIEW,STEP6_MEASUREMENTS,V1_WORK,V1.1_WORK,NEXT_PHASE_REVIEW}.md`           | Historical accepted local implementation/review and remaining production boundaries                                                                             |
| `docs/puzzles/`, `docs/morphi-v1.1-handoff-2026-10-26/`                                              | Approved per-game briefs, templates and historical v1.1 handoff                                                                                                 |
| `docs/NEXT_PHASE_VISUAL_REVIEW.md`, `build/combined-review/`                                         | Earlier combined visual comparison and verification evidence                                                                                                    |
| `build/slice1/`, `build/slice2/`                                                                     | Ignored local refactor logs, handoff, chunk graph and measurements; Slice 2 initial failed run is retained separately                                           |

## Commands and conventions

- Install: `bun install`; local setup: `bun run accounts:setup`, `bun run cf:types`, `bun run db:migrate:local`.
- Dev: `bun run dev --host 0.0.0.0`; type-check: `bun run check`; format/lint: `bun run lint`.
- Full gate: `bun run verify`; targeted commands: `test:unit -- --run`, `test:accounts`, `test:vectors`, `test:worker`, `test:e2e`, `check:boundaries`, `check:lazy-bundle`.
- Generate registry: `bun run registry:generate`; palette diagnostics: `bun run test:palettes`; contact sheet: `bun run theme:sheet`.
- Build/local Worker: `bun run build`, `bun run preview:worker`. Deployment and even a remote preview still require explicit owner approval.
- App alias: `#lib`, explicit `.js` extensions. Pure engine imports only engine; puzzle packages never import each other; app reaches puzzles through generated files.
- Core logic is deterministic integer-only; cosmetic theme math has a separate boundary. Every family owns its version, vectors, manifest, messages, view and README.
- User-facing copy uses the catalog; motion uses the wrapper. Themes never affect rules/score. No user-agent layout sniffing, gradients, glows or shadows on game objects.
