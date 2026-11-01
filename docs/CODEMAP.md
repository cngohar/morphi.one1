# CODEMAP.md

A short map of the codebase so agents can find things without broad searches. Keep it under about 150 lines and update it at the end of every step or phase.

## Current build (v1.1 Work 5 implemented locally; Work 4 and Step 6 accepted locally)

Block, Memory and Connect are dealt through the selector on `/play`; old family URLs redirect to Home in the local app. Work 5 pages and its assets-only guest candidate passed local verification but are not deployed. The owner accepted Work 5 and the overall Work 2 visual/device pass locally on 2026-10-31. Global-release planning is next; production resources, eligibility and deployment remain separate. The live guest/privacy release remains the owner-approved 2026-10-24 version (`b50a7a18-2e85-4406-bd40-77f27c4b3da3`). Work 4 and Step 6 are accepted locally. Cloudflare Web Analytics is injected at delivery and absent from build files by design. See `docs/PHASE_REPORTS.md` for evidence.

Active plan: `morphi-plan-simple.md`; `docs/PLAN.md` is reference only. On 2026-10-23 the owner accepted the public-test result (45+ players, over 60% positive feedback) and requested the next-step approach. Step 5 closes by owner judgment with the measured replay gate waived; The owner approved Google sign-in, all account screens, and Step 6 implementation (`docs/STEP6.md`). Local account/session/name/deletion, durable progress retries, server-ranked runs, and all-time leaderboards are implemented. Owner PC/mobile functional review is accepted on 2026-10-24 (`STEP6_REVIEW.md`); global-release/admin-panel planning follows, with production operations/resource evidence still open. No account backend has been deployed. Owner-authorized private source repository: `https://github.com/cngohar/morphi.one1`; no automatic deployment.

| Path                                                                                                            | Purpose                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/+page.svelte`                                                                                       | Prerendered accepted landing page; the real loop now lives in `/play` and `PlaySession.svelte`                                                 |
| `src/routes/+layout.svelte`                                                                                     | Global font and CSS imports                                                                                                                    |
| `src/app.css`                                                                                                   | Design tokens: palette, type, motion, safe areas, block surface and piece colors                                                               |
| `src/env.ts`                                                                                                    | SvelteKit 3 env schema; optional `ELEVENLABS_API_KEY` for the unused server stub, no secret in source                                          |
| `src/lib/server/elevenlabs.ts`                                                                                  | Unused server-only ElevenLabs client stub; reads the optional key from `$app/env/private`                                                      |
| `src/lib/engine/rng.ts`                                                                                         | Pure SplitMix64 v1, unbiased integer draws, Fisher-Yates shuffle, seed parsing; entropy lives in `src/lib/seeds.ts`                            |
| `src/lib/puzzles/block-placement/logic.ts`                                                                      | Pure block rules: supply, fair opening trays, placement, clears, combo score, cap, replay                                                      |
| `src/lib/puzzles/memory/logic.ts`                                                                               | Pure Memory rules: seeded generation, flip/match/mismatch, win, scoring; routed again for rotation                                             |
| `src/lib/puzzles/memory/symbols.ts`                                                                             | Retained Memory symbol ids, labels, verified symbol colors                                                                                     |
| `src/lib/screens/HomeScreen.svelte`                                                                             | Title, Play, best score, sound toggle                                                                                                          |
| `src/lib/selector.ts`                                                                                           | Pure weighted family bag: RNG-selected first family, one pick per cycle, minimum gap, stable peek                                              |
| `src/lib/puzzles/block-placement/Game.svelte`                                                                   | HUD/themes, 3 s locked arrival, responsive 8x8 board/tray, tap/drag/keyboard, ghost, clears, result                                            |
| `src/lib/puzzles/memory/Game.svelte`                                                                            | Themed Memory: 3/4/5 s arrival, 3 s preview, hide before input/time; visible-time deadlines, flips and result                                  |
| `src/lib/screens/ResultScreen.svelte`                                                                           | Approved result layout; score/best, Next, guest Google sign-in prompt, signed-in account link, local/pending/saved/ranked status               |
| `src/lib/components/SoundToggle.svelte`                                                                         | Mute control                                                                                                                                   |
| `src/lib/puzzles/memory/Card.svelte`                                                                            | Memory card motion, themed faces/back mark, reduced-motion states                                                                              |
| `src/lib/puzzles/memory/Symbol.svelte`                                                                          | Retained inline SVG Memory shapes, no text                                                                                                     |
| `src/lib/puzzles/memory/Confetti.svelte`                                                                        | Deterministic Memory win burst with theme colors, under one second                                                                             |
| `src/lib/i18n/messages.ts`                                                                                      | Every user-facing string, English only                                                                                                         |
| `src/lib/puzzles/block-placement/themes.ts`                                                                     | Four fixed themes with per-theme backdrop, board cell/edge, picker tray/slot, pieces; seed selection; CSS serialization                        |
| `src/lib/puzzles/memory/themes.ts`                                                                              | Same four theme ids for Memory: card back/edge/face/matched, back mark, symbol palette; seed selection; CSS serialization                      |
| `src/lib/ui/sound.ts`                                                                                           | Static ElevenLabs cues through Web Audio; bounded voices, mute/background stop, no runtime generation                                          |
| `src/lib/ui/storage.ts`                                                                                         | Per-game best keys, `morphi.block.hintSeen`, sound, with memory fallback                                                                       |
| `src/lib/ui/active-delay.ts`                                                                                    | Pausable visible-time deadlines for Memory hide and mismatch transitions; cancellation on unmount                                              |
| `src/lib/ui/format.ts`                                                                                          | Number and clock formatting                                                                                                                    |
| `src/lib/engine/rng.test.ts`                                                                                    | RNG vectors, range, shuffle, seed tests                                                                                                        |
| `src/lib/puzzles/block-placement/logic.test.ts`                                                                 | 27 block tests: vectors, fairness, clears, combo, cap, no-fit, replay                                                                          |
| `src/lib/puzzles/memory/logic.test.ts`                                                                          | Retained Memory determinism, solvability, flip rules, mismatch, scoring tests                                                                  |
| `src/lib/puzzles/block-placement/themes.test.ts`                                                                | Theme count, palette uniqueness, board/picker contrast floors, seed determinism, reachability, serialization                                   |
| `src/lib/puzzles/memory/themes.test.ts`                                                                         | Memory card/symbol contrast, palette uniqueness, seed determinism, serialization; shared consistency in `src/lib/theme-consistency.test.ts`    |
| `src/lib/ui/storage.test.ts`                                                                                    | Settings/best regressions: failed writes with readable stale data, later read blocking, recovery, malformed scores, per-game bests             |
| `src/lib/ui/active-delay.test.ts`                                                                               | Visible-time deadline tests: background pauses, repeated resume, hidden start, cancellation, zero-delay motion                                 |
| `static/demo/accounts.html`                                                                                     | Local review harness for five account screens at three viewport sizes; sample connection/auth states                                           |
| `static/demo/accounts-screen.html`, `accounts.css`, `accounts.js`, `accounts.messages.js`, `accounts-review.js` | Responsive account prototype, isolated catalog and review controls; no backend                                                                 |
| `static/demo/block.html`                                                                                        | Unlinked interactive visual sample for Block placement; not production code                                                                    |
| `playwright.config.ts`                                                                                          | Project Playwright config: Chromium, dev-server reuse, `test-results/` output, 120 s timeout                                                   |
| `tests/e2e/layout.spec.ts`                                                                                      | Four-viewport layout audit: boards, HUD, real Block result/sign-in prompt, no-scroll fit, Memory layout                                        |
| `tests/e2e/reliability.spec.ts`                                                                                 | Failed-start retry, duplicate Play, final drag coordinates, secondary pointers, lost capture/blur, keyboard repeat, hidden mismatch hold       |
| `wrangler.jsonc`                                                                                                | Cloudflare Worker `morphi-one`: built Worker, static assets, compatibility date/flags, logs/traces/issues; custom domain is dashboard-attached |
| `vite.config.ts`                                                                                                | SvelteKit + Cloudflare adapter configuration                                                                                                   |
| `vitest.config.ts`                                                                                              | Pure Node unit tests, independent of the SvelteKit/Cloudflare runtime; no Worker listener or secrets loading                                   |

## Account implementation

| Path                                                              | Purpose                                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/hooks.server.ts`                                             | Per-request Worker-bound auth, signed session resolution, 16 KiB body cap, private/no-store responses, auth failure handling         |
| `src/lib/server/auth.ts`                                          | Better Auth + Drizzle factory; Google-only, explicit CSRF/origin checks, encrypted provider tokens, D1 rate limiting, fresh deletion |
| `src/lib/server/db/`, `migrations/`, `drizzle.config.ts`          | Core auth and public player-name schema, generated local D1 migrations                                                               |
| `src/lib/server/players.ts`                                       | Public-name validation, case-insensitive uniqueness, account-owned edits                                                             |
| `src/lib/server/request-body.ts`                                  | Bounded request streaming for account/auth mutations                                                                                 |
| `src/routes/account/`                                             | Sign-in, name setup/edit, profile, sign-out, delete confirmation and server actions                                                  |
| `src/lib/components/account/`, `src/lib/ui/account.css`           | Approved responsive account layouts and guarded form handling                                                                        |
| `src/routes/+layout.server.ts`, `src/app.d.ts`                    | Minimal session status and typed request locals; no private user fields sent to public pages                                         |
| `scripts/setup-accounts.ts`, `.dev.vars.example`                  | Ignored local secret creation and blank OAuth configuration example                                                                  |
| `tests/integration/accounts.test.ts`, `vitest.accounts.config.ts` | Isolated real D1 + Better Auth session/security/deletion integration checks                                                          |
| `tests/e2e/accounts.spec.ts`                                      | Account layouts/lifecycle, completed Memory guest sign-in flow, signed-in result/Next rotation, retained local best                  |

## Privacy page

- `src/routes/privacy/`: prerendered policy; account build includes an opt-in measurement control, guest artifact remains readable without app JS; intentional delivered Cloudflare beacon.
- `src/lib/content/privacy.ts`, `src/lib/i18n/messages.ts`: owner contact/audience and structured sections; escaped catalog-backed policy copy.
- `src/lib/components/SiteFooter.svelte`: Home/account/content privacy link, absent during gameplay.
- `tests/e2e/privacy.spec.ts`, `docs/PRIVACY_REVIEW.md`: no-JavaScript/readability/navigation/layout checks, approved general audience, local readiness, pending deployment/Google/account gates.

- `src/lib/server/retention.ts`, `scripts/admin-local.ts`, `docs/PRIVACY_RETENTION.md`, `PRIVACY_REQUESTS.md`: tested local admin cleanup/request deletion and real retention/provider limits.
- `scripts/prepare-public-privacy.ts`, `check-public-privacy.ts`, `wrangler.public-privacy.jsonc`, `docs/PUBLIC_PRIVACY_RELEASE.md`: hashed guest-only assets, local/live checks and owner-approved publication evidence.
- `src/routes/+page.ts`: prerender Home in both builds; private session status refreshes through `/api/account/status`.

## Design docs

- `docs/GOOGLE_OAUTH_PUBLIC.md`: production OAuth guide; owner reports setup complete, console/callback validation unrecorded; no account backend provisioned by the agent.
- `docs/V1_RELEASE_CHECKLIST.md`, `V1_WORK.md`: active owner-supplied v2 handoff, local implementation/decisions and demo review; `V1_RELEASE_PLAN.md` is the historical proposal.
- `static/demo/v1.html`, `v1-screen.html`, `v1-design.css`, `v1*.js`: Oct 25 public designs, hybrid doors, Foundation v2 profile; admin retained; synthetic data only. `scripts/demo-motion.ts`, `build-demo-motion.ts`, `check-v1-demo.ts`: anime wrapper/build and isolated demo checks (1 s / Home 1.5 s / help 0.5 s, centred phone boards, rotation/overflow/frame probes).
- `docs/ADMIN_LOCAL.md`: local OS/TOTP moderation commands and owner enrollment/reset for the protected Stage 1 operator panel.
- `docs/STEP6_WORK.md`: delivery checklist and global-release boundaries.
- `docs/STEP6_MEASUREMENTS.md`: reproducible local replay CPU/heap measurements and limits.
- `docs/GOOGLE_AUTH_SETUP.md`: Google OAuth setup/status, exact localhost callback, Testing vs public brand verification, and production prerequisites.
- `docs/STEP6.md`: Google sign-in choice, account demo review, proposed implementation sequence, database/admin boundaries, and acceptance checks.
- `docs/puzzles/_TEMPLATE.md`, `block-placement.md`: required brief structure and approved Block brief/build status.
- `docs/PHASE_REPORTS.md`: game implementation, engineering reliability, agent setup, and production deployment evidence and known issues.
- `docs/CLOUDFLARE_AGENT_SETUP.md`: project-local skills/MCP setup completed; OAuth and read-only Worker API access verified. No global configuration or deployment changes.

## Step 6 additions

| Path                                                                                                       | Purpose                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/lib/engine/contract.ts`, `src/lib/seeds.ts`                                                           | Pure run/manifest contract; external cryptographic entropy                                           |
| `src/lib/puzzles/<id>/`                                                                                    | Each puzzle owns its logic, manifest, version, view, themes, README, and tests                       |
| `src/lib/catalog.ts`, `src/lib/registry.ts`, `scripts/generate-registry.ts`                                | Generated headless catalog and app views; run `bun run registry:generate`                            |
| `eslint.config.js`, `scripts/check-boundaries.ts`                                                          | Engine purity and cross-puzzle/app import enforcement and deliberate-violation checks                |
| `src/lib/server/runs.ts`, `play-http.ts`                                                                   | Bounded replay, owned history, ranked D1 claims/caps/recovery, public rankings, API guards           |
| `src/routes/api/play/start/`, `src/routes/api/progress/`, `src/routes/leaderboard/`                        | Account-bound start/save/history endpoints and approved board screen                                 |
| `src/lib/ui/progress.ts`                                                                                   | IndexedDB pending runs, opt-in guest import, account ownership, backoff, and memory fallback         |
| `src/lib/server/moderation.ts`, `admin-totp.ts`, `scripts/admin-local.ts`                                  | Local-only moderation, OS/role/TOTP checks, transactional audits, ranked kill switch                 |
| `tests/integration/runs.test.ts`, `tests/vectors/`, `scripts/check-worker.ts`, `scripts/measure-replay.ts` | D1 race/security tests, independent multi-runtime vectors, built Worker smoke, CPU/heap measurements |

## v1 app integration (local only, owner-authorized Oct 25)

- `src/routes/play/`, `src/lib/screens/PlaySession.svelte`: selector-only Mix loop, ranked starts/saves; family query parameters cannot select a game.
- `src/params.ts`, `src/routes/[family=family]/`: legacy family slugs redirect Home. `/how-it-works`, `/about` and `/faq` use `src/lib/content-explainers.ts` and reusable `ContentBlocks.svelte`; no CMS.
- `src/lib/ui/motion.ts`, `dismiss-dialog.ts`, `round-timing.ts`: sole application anime.js wrapper, safe backdrop gestures and server-known opening allowances. Template: `docs/puzzles/_TEMPLATE.md`.
- `static/audio/`, `scripts/generate-sounds.ts`: 13 generated/trimmed cues and provenance; API key stays in ignored local configuration, generation is manual.
- `src/lib/ui/v1.css`, `components/account/ProfileContent.svelte`: accepted presentation and real profile tabs/totals/history; future XP/achievement fixtures omitted.
- `src/routes/terms/`, `sitemap.xml/`, `robots.txt/`, `components/Seo.svelte`, `static/og/`: local content/SEO; core/accounts/admin remain noindex. `scripts/finish-build.ts` removes demos from release assets.
- `src/routes/admin/`, `server/operator.ts`, `operator-http.ts`, `operator-permissions.ts`, migrations `0003`–`0005`: protected local Stage 1 operator UI, owner-only CLI enrollment/reset, TOTP/recovery, bounds/RBAC/audits and deletion counts.
- `src/routes/api/measurement/`, `server/measurement.ts`, `ui/measurement.ts`, `components/MeasurementChoice.svelte`: default-off coarse events, DNT/GPC, withdrawal and disclosed cleanup. `api/account/status/` refreshes static chrome privately.
- `tests/e2e/entrance.spec.ts`, `dialogs.spec.ts`, `operator.spec.ts`, `tests/integration/operator.test.ts`: entrance/timer/lifecycle, backdrop and actual operator permission/action regressions.
- `src/routes/admin/sign-in/`: Google plus the separate Morphi.One second factor; actionable rejected-code, temporary-lock and request-limit messages. Manual authenticator setup is documented in `docs/ADMIN_LOCAL.md`.
- `scripts/check-v1-app.ts`, `build/v1-integration-review/`: actual/demo viewport captures and persistent verification logs. `docs/V1_WORK.md` / latest phase report hold delivery/release boundaries.

## Conventions

- v1.1 theme slice: `docs/V1.1_WORK.md` tracks the Oct 26 brief/order and pending owner taste gate. `src/lib/engine/theme/` owns cosmetic OKLCH/Machado math, immutable JSON recipes/styles, generated silhouettes and bounded freshness; puzzle rules stay integer-only. `scripts/check-palettes.ts` checks the documented presets plus 10,000 seeds/rounds per puzzle; `theme-sheet.ts` writes the 60-theme HTML/PNG in `docs/evidence/v1.1-themes/`.
- `src/lib/ui/theme-history.ts`, `components/ThemeBackdrop.svelte`, puzzle `themes.ts` adapters: bounded IndexedDB history/fallback, own-item scatter and actual procedural rendering. Migration `0006` records versions/resolved snapshots on ranked starts/completions, preserving legacy queued runs. `tests/e2e/themes.spec.ts` covers actual views/snapshots and small silhouettes; six-runtime theme regression vectors live in `tests/vectors/themes.json`.
- `src/lib/ui/game-shell.css`: owner-requested viewport sizing follow-up to the 1920×923 screenshot; replaces fixed board caps, names in the header and full-width bottom help/high-score panel. `solo-theme.ts` / `theme-worker.ts` move solving off the main thread; `storage.ts` distinguishes new families from completed zero-score games. Theme browser checks run in Chromium/Firefox/WebKit, including panel space-use and gap assertions.
- Work 2 review slice: `ui/puzzle-backdrop.ts` / `components/ThemeBackdrop.svelte` render seeded current-puzzle-only motifs (two-dimensional scatter, 1–5 per side on wide layouts, hidden on compact/mobile); `ui/backdrop-layout.ts` measures exposed space when the Card reveals the backdrop and on later resize, including legacy blank layouts. `ui/prepare-ahead.ts` / `components/RoundStage.svelte` overlap one solo candidate with arrival, bound failures and cancel stale work; `theme-history.ts` bounds IndexedDB waits. Regression coverage: `tests/e2e/preparation.spec.ts`, `themes.spec.ts` and matching unit files.
- `static/demo/card-proof.html`, `card-proof.css`, generated `card-proof.js`, `scripts/card-proof.ts`, `build-card-proof.ts`: interactive Memory/Block Card proofs with fresh random Card arrivals that settle/unfold at centre, fixed stack landings and score-only scrambling, isolated sample completion/slow/failure/static controls and phone stack review; regenerate with `bun run demo:card`. The sole anime wrapper is `ui/motion.ts`; `tests/e2e/card.spec.ts` captures four viewports in three browsers under `build/v1.1-card/`. The owner approved animations and actual Card integration on Oct 28; the remaining UI pass/device review stay separate. Future puzzle backdrop/loading contracts are in `docs/puzzles/_TEMPLATE.md`.

- Actual Card integration: `components/RoundStage.svelte`, `ui/card-shell.css`, `screens/PlaySession.svelte` orchestrate the persistent frame, deferred game entrances, session stack and real result/save flow. `ui/motion.ts` shares typed element-based presentation with the isolated proof. `round-timing.ts`, migration `0007` and `server/runs.ts` keep ranked opening allowances server-owned and legacy-compatible. `tests/e2e/app-card.spec.ts` covers real Memory/result/Next at four sizes in three browsers.

- Work 3 Connect (accepted locally on the owner's PC, 2026-10-29): `puzzles/connect/logic.ts`, `manifest.ts`, `Game.svelte`, `README.md` and `docs/puzzles/connect.md` own the seeded all-pairs path game with optional full-grid bonus, stroke replay, 2.5 s entrance and HUD. `PlaySession.svelte`, generated `registry.ts`/`catalog.ts`, selector and `server/runs.ts` integrate Mix, ranked saving and leaderboards. `ui/puzzle-backdrop.ts` supplies its dot-path-only scatter; `ui/motion.ts` owns Connect presentation. `scripts/generate-sounds.ts` created nine unique static cues documented in `static/audio/manifest.json`. `tests/vectors/connect.json`, `connect-partial.json`, `puzzles/connect/logic.test.ts`, `tests/integration/runs.test.ts` and `tests/e2e/connect.spec.ts` cover rules, six runtimes, D1 and browser flows. Captures: `docs/evidence/v1.1-connect/`; local logs: ignored `build/v1.1-connect/`. The Card UI/UX progression gate was closed by the owner; Connect local PC review is accepted; phone and public-release checks were not reported.

- Path alias: `#lib` (declared in `package.json` `imports`); imports use explicit `.js` extensions.
- Pure rules live in `src/lib/engine` and each `src/lib/puzzles/<id>/logic.ts`; no DOM, no `Date.now`, no `Math.random`, no approximated math. ESLint enforces this.
- All visible text goes through `src/lib/i18n/messages.ts`.
- Layout uses the tokens in `src/app.css`; no shadows, gradients, glows, or emoji.
- Block engine state is plain data and replays from seed plus moves. The client never submits a score.
- Block colors are shape-position safe: color is not the only cue.

## Commands

- Install: `bun install`; first accounts setup: `bun run accounts:setup`, `bun run cf:types`, `bun run db:migrate:local`
- Dev: `bun run dev --host 0.0.0.0` (phone testing over the local network)
- Type-check: `bun run check`
- Lint and format check: `bun run lint`
- Full local verification: `bun run verify`; boundary self-check: `bun run check:boundaries`
- Replay vectors: `bun run test:vectors`; replay costs: `bun run measure:replay`; isolated built Worker: `bun run test:worker`
- Unit tests: `bun run test:unit -- --run`; D1/auth integration: `bun run test:accounts`
- Browser account/recovery/layout tests: `bun run test:e2e` (installs nothing; run `bunx playwright install chromium` once on a new machine)
- Build: `bun run build`
- Local Worker preview: `bun run preview:worker`
- Validate the deploy bundle without uploading: `bun run deploy:dry`
- Public guest/privacy deploy: `bunx wrangler deploy --config wrangler.public-privacy.jsonc` only with approval for that deployment; normal local-account config is not a guest release
- Live Step 5 Worker: `https://morphi.one` (Worker `morphi-one`); `https://morphi-one.electrasincng.workers.dev` also works

## Where to look for...

- Block rules, score, supply, fairness, cap, replay: `src/lib/puzzles/block-placement/logic.ts`
- Block themes, board/picker/piece palettes, seed selection: `src/lib/puzzles/block-placement/themes.ts`
- Memory themes, card/symbol palettes, seed selection: `src/lib/puzzles/memory/themes.ts`
- Block interaction, HUD, fill-only clear, hint, themed tray layout, end feel: `src/lib/puzzles/block-placement/Game.svelte`
- Screen flow, family rotation, saved runs and results: `src/lib/screens/PlaySession.svelte`
- Puzzle family selection: `src/lib/selector.ts`
- Shared result card: `src/lib/screens/ResultScreen.svelte`
- Seeded randomness: `src/lib/engine/rng.ts`
- Text: `src/lib/i18n/messages.ts`
- Colors and motion tokens: `src/app.css`
- Storage keys: `src/lib/ui/storage.ts`
- Memory game: `src/lib/puzzles/memory/logic.ts`, `src/lib/puzzles/memory/Game.svelte`, `src/lib/puzzles/memory/Card.svelte`, `src/lib/puzzles/memory/themes.ts`
- Connect game: `src/lib/puzzles/connect/logic.ts`, `manifest.ts`, `Game.svelte`; design brief at `docs/puzzles/connect.md`
- Layout regressions: `tests/e2e/layout.spec.ts`; screenshots and traces under the ignored `test-results/` directory
- Deployment: `wrangler.jsonc`, `vite.config.ts`; custom domain and DNS are active, `www` and HTTP redirect to the apex

- Work 4 scoring, Work 5 door withdrawal/explainers, and the Work 2 overall visual/device review are accepted locally. Verification and acceptance evidence are in `docs/V1.1_WORK.md` and `docs/PHASE_REPORTS.md`. Next: global-release planning, including an admin-panel proposal; no production provisioning or deployment is authorized.

- Historical next-phase assessment: `docs/NEXT_PHASE_ASSESSMENT.md`. The owner later authorized local implementation of all three slices and one combined review; no deployment is authorized.

- Next-phase slice 1 (local): `src/lib/server/user-lifecycle.ts`, `activity.ts`, `admin-users.ts`, `audit.ts` and `moderation.ts`, `migrations/0009_sticky_black_knight.sql`, `/admin/users` and `/admin/audit` implement account controls, prospective activity and append-only audit. `tests/integration/{runs,activity,audit}.test.ts` and `tests/e2e/operator.spec.ts` cover the paths. Full verification passed; owner acceptance remains pending.

- Owner direction (2026-10-31): finish next-phase slices 1–3 locally, then request one combined owner review; all slices remain review-pending until accepted. See `docs/PHASE_REPORTS.md`.

- Combined review handoff: `docs/NEXT_PHASE_REVIEW.md` (acceptance pending). `/admin/users` overview/directory/detail tabs and `/admin/audit` overview/explorer use `admin-users.ts` and the existing operator route. `games.ts`, migration `0010_game_lifecycle.sql`, scoring rollback and availability-aware selector implement game controls. Ending declarations/checks live in manifests, `scripts/validate-ending.ts` and `ending-contract.test.ts`; PlaySession shows text before the 500 ms fold. Final combined verification passed on 2026-11-01 (174 browser checks); combined owner acceptance remains pending.

- Visual audit: `docs/NEXT_PHASE_VISUAL_REVIEW.md`; local ignored `build/combined-review/index.html` compares 63 before/after pairs. Final verification output: `build/combined-review/verify-final.log`.
