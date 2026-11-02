Morphi engine refactor — single brief for Codex
Status: APPROVED by owner, 2026-11-01 ~11:59 PKT. This brief now
authorises the refactor slices, in order, each verified before the
next, with no deployment, production provisioning, secrets, DNS,
or Google changes.
Progress, Codex-reported 2026-11-01 ~13:18 PKT, NOT yet owner-
confirmed: Slice 0 is frozen, HEAD and annotated tag
v1.2-local-complete both point to
1303c9c4bdb1718bb558886dc43b7b48c597a02a, "Record combined
local acceptance", phase report docs/PHASE_REPORTS.md:1607 and
docs/CODEMAP.md updated, v1.2 local acceptance and local D1 only
reset permission recorded, no reset performed, no code or
production changes, app tests not rerun, formatting and Git
checks passed. Owner confirmation, 2026-11-01 ~13:25 PKT: Slice 0 is confirmed
and Slice 1 is authorised to start. That confirmation accepts
Slice 0 as reported, with the base-tag test still deferred, not
as a blocker for Slice 1; the deferred test remains outstanding
and must be recorded as such in the Slice 1 phase report, not
silently dropped. Slice 1 is now in progress on Codex, and must
stop for owner confirmation before Slice 2.
Method confirmed by owner 2026-11-01 ~18:03 PKT: keep
slice-by-slice for this refactor, with full tests per slice,
despite test time. Do not switch to an all-slices-in-one-go
combined pass without a new owner decision.
Method change, owner decided 2026-11-02 ~11:53 PKT, after Slice 2
cost 1h 46m and 60% of the 5h limit: KEEP single steps for
decisions, SWITCH to fast checks per slice for tests, starting
with Slice 3. Owner confirmation is still required before each
next slice. Full bun run verify is NOT run on every slice from
Slice 3 onward; it is run after Slice 3, after Slice 6, and at
the very end after Slice 7, plus a targeted rerun of an affected
suite only if a fix touches shared code. This change does not
confirm Slice 2, which remains awaiting owner confirmation.
Progress, Codex-reported 2026-11-02 ~12:29 PKT, Slice 3 in
progress, NOT complete, NOT pushed: fast checks are green —
lint, zero-warning type-check, boundaries, units, D1/auth, and
Slice 3 acceptance tests. Review caught an old SQL constraint
that rejected Connect measurement events; migration 0011
catalog_config_sessions removes that constraint while preserving
existing rows and indexes. New files shown include
src/lib/server/ranked-session.ts, src/routes/api/play/abandon/,
and tests/slices/slice3-catalog-server-validation.test.ts.
The one milestone full bun run verify was just starting when
Codex hit its usage limit, with a message to try again at
1:56 PM. Slice 3 is therefore not complete, not verified by a
full run, and not owner-confirmed. Local files and
build/slice3/ logs remain on the owner's PC; resume after the
limit reset, do not restart Slice 3 from scratch.
Update 2026-11-02 ~18:10 PKT: owner instructed Codex to complete
Slice 3 and push it, which by the Slice 3 command also confirms
Slice 2. Slice 3 is now pushed and verified by assistant:
commit 4cffb4e, "Refactor catalog validation, config and ranked
sessions", full hash 4cffb4e205ce924405a35da5f867a8e232f8d16d,
2026-11-02 18:10:35 +0500, 35 files, 2214 insertions, 384
deletions. Diff inspection confirms migration 0011
catalog_config_sessions (game_config, theme_config,
style_config, config_live, anonymous_event recreated without
the two-family CHECK, preserving rows and indexes),
ranked-session.ts with active/abandon/takeover, new
api/play/abandon route, generic runs.ts, and a 608-line
slice3 test. Assistant did not rerun the milestone full verify
itself; Codex's fast-check green and milestone run are
Codex-reported. Slice 3 itself is NOT owner-confirmed yet.
Slice 4 has not started. 5h limit shown 48% left, resetting
10:07 PM.
Owner confirmation, 2026-11-02 ~18:13 PKT: Slice 3 is confirmed
and Slice 4 is authorised to start, with fast checks for the
remaining slices as previously decided. Slice 4 must stop for
owner confirmation before Slice 5, and must NOT run a full
bun run verify; the next full milestone is after Slice 6.
Owner confirmation, 2026-11-02: Slice 4 is accepted locally and
committing/pushing its completed changes to GitHub is authorised.
This is fast-only acceptance pending the full milestone after
Slice 6. The Slice 0 base-tag test remains deferred and outstanding.
Slice 5 has not started; this Git handoff does not start it or
authorise deployment or production changes.
Progress, Codex-reported 2026-11-01 ~18:33 PKT, NOT yet owner-
confirmed, NOT committed or pushed to GitHub: Slice 1 is
complete locally — manifest-owned scoring and messages, generic
puzzle IDs, and catalog-based server/admin family lookup.
Codex reports: current catalog exactly matches all 799
frozen-base message keys and values, vector files and checker
unchanged, bun run verify passed with 131 unit tests, 37 D1/auth
tests, all six vector runtimes, and 174 browser checks, existing
rules, scores, endings, and sounds unchanged. Phase report
docs/PHASE_REPORTS.md, logs and handoff build/slice1/RESUME.md,
CODEMAP updated. Slice 0 base-tag test remains deferred and
outstanding. No deployment occurred. Slice 2 has not started
and awaits the owner's written confirmation. Assistant verified
Slice 1 push on 2026-11-01 ~18:40 PKT: commit e906e87,
"Refactor puzzle identity and manifest-owned scoring", full hash
e906e87f2894934965a702bebfb716c62dc774cd, 2026-11-01 18:38:33
+0500, 53 files, 1675 insertions, 317 deletions. Verified by
diff inspection: PuzzleId is now string, SCORE_FAMILIES and
SCORE_DEFAULTS removed from engine/scoring.ts, each manifest now
carries scoring and messages, per-family messages.ts and
scoring.ts created, main messages.ts reduced, new test
tests/slices/slice1-manifest-scoring.test.ts present, vector
files unchanged, palettes.json change is only regenerated timing
measurements. Assistant did NOT rerun bun run verify itself;
the 131/37/174/six-runtime pass is Codex's reported result.
Owner confirmation, 2026-11-01 ~18:40 PKT: Slice 1 is confirmed
and Slice 2 is authorised to start. Slice 2 must stop for owner
confirmation before Slice 3. Note for Slice 2 planning: Codex
weekly limit was only 2% left at Slice 1 completion, resetting
6:18 AM on 5 Nov, so Slice 2 may hit that limit.
Progress, Codex-reported 2026-11-02 ~11:42 PKT, NOT yet owner-
confirmed, NOT pushed to GitHub: Slice 2 is complete locally —
lazy registry, generic PlaySession, id-derived state/storage,
and bundle enforcement. Fresh bun run verify passed: 137 unit
tests, 37 integration tests, six vector runtimes, bundle
isolation, and 176 browser checks. Phase report
docs/PHASE_REPORTS.md and CODEMAP updated. Slice 0 base-tag test
remains deferred and outstanding. Phone/4G timing remains
unmeasured; no deployment or production changes occurred.
Total Codex time for Slice 2: 1h 46m, using 60% of the 5h limit
(started at 100%, 40% left at completion, resetting 1:56 PM).
Assistant verified Slice 2 push on 2026-11-02 ~11:48 PKT:
commit 7a84063, "Refactor lazy puzzle registry and generic play
session", full hash 7a840632f4b6172d35d9b6aadcc776cb80b78a18,
2026-11-02 11:47:42 +0500, 38 files, 1270 insertions, 775
deletions. Verified by diff inspection: registry puzzleViews
are generated dynamic imports from manifest scan, not static
Game imports; PlaySession now holds one generic round and one
View, with a large net reduction; manifests now carry createRound
and replayRound; new scripts/check-lazy-bundle.ts, new
tests/slices/slice2-lazy-registry.test.ts (236 lines) and
tests/e2e/lazy-registry.spec.ts present; vector reference files
unchanged, only runner/benchmark updated to use catalog.
Assistant did NOT rerun bun run verify itself; the 137/37/
six-runtime/bundle/176 pass is Codex's reported result. Slice 2
is still NOT owner-confirmed.
Audit base: https://github.com/cngohar/morphi.one1.git, HEAD 8727e99,
2026-11-01 09:19, "Record v1.1 review and release planning evidence".
Owner confirmed 2026-11-01: this was the v1.2 repo, without acceptance.
Update 2026-11-01 ~11:01 PKT: owner accepted all three v1.2 slices
and the quick-review improvements, closing v1.2 locally. Acceptance
scope: owner's own PC review, mobile layouts checked using browser
responsive tools (not real devices), no corrections noted. That
acceptance step changed only documentation and did not rerun app
tests; earlier implementation and automated checks were already
complete locally. No deployment occurred.
Update 2026-11-01 ~11:51 PKT: Codex committed and pushed the
acceptance records to GitHub main, reported as 1303c9c, "local
acceptance records", working tree clean, no app tests rerun for
that documentation-only commit, no deployment. Files shown changed:
docs/PHASE_REPORTS.md, morphi-plan-simple.md, and
docs/NEXT_PHASE_VISUAL_REVIEW.md, 7 files changed in total, 78
insertions, 21 deletions. Assistant VERIFIED 1303c9c on 2026-11-01 ~12:14 PKT, after the
owner temporarily made the repo public: full hash
1303c9c4bdb1718bb558886dc43b7b48c597a02a, author cngohar,
2026-11-01 11:51:06 +0500, message "Record combined local
acceptance". Diff vs 8727e99 is exactly 7 files, 78 insertions,
21 deletions, all documentation and plan files (AGENTS.md,
docs/CODEMAP.md, docs/DECISIONS.md, docs/NEXT_PHASE_REVIEW.md,
docs/NEXT_PHASE_VISUAL_REVIEW.md, docs/PHASE_REPORTS.md,
morphi-plan-simple.md), no src/ changes, no deployment. The
acceptance text matches the recorded scope: owner PC review,
mobile layouts via browser responsive emulation, no corrections
noted, physical mobile review not reported, 174/174 browser
checks from the preceding verification report, no deployment.
Slice 0 therefore must use the post-acceptance push 1303c9c,
not the pre-acceptance HEAD 8727e99 audited here. v1.2 complete
locally does not mean deployed, and does not close production
release gates. Owner may make the repo private again now that
verification is complete.
Suspense decision, owner confirmed 2026-11-01, stays intact: public
game pages and doors stay withdrawn because the suspense of not
knowing the next puzzle must be kept. That means no per-type
indexable pages, no game picker, and no Pick menu in this refactor.
Suspense means no choice before a round, not that families are
secret forever: a player who keeps playing the Mix cycle will
naturally see every family in a cycle. That distinction is
deliberate and must not be "fixed" by hiding families.
Owner constraints recorded 2026-11-01
Engine first, before upgrading any puzzle, so many games can be added
  with procedural generation without slowing the app down.
Download and explore the full repo, do not plan from a handful of files.
All in Cloudflare. Nothing outside Cloudflare for hosting, compute,
  data, storage, CDN, or analytics at runtime.
Workers Paid plan, so do not design around free-tier limits, but still
  respect real limits: D1 write throughput, Worker CPU, and bundle size.
No hardcoding of style, ever. Everything style-related must be
  changeable from the admin panel, except necessary things listed below.
World-best practice for reliability, stability, performance, and SEO.
Cross-check the plan file.
Global research is a must for verification of every suggestion.
Database reset is acceptable for this refactor because Morphi has not
  been deployed yet. That removes legacy migration of old local runs,
  but it does not remove replay, versioning, or vector requirements for
  runs created after the refactor.
Cross-check against docs/PLAN.md — what still binds, what is superseded
Read PLAN.md sections 2, 5, 6, 10, 11.2, 11.3, 11.4, 11.10, 11.11,
11.14, 11.16, 12.3, and 13 before coding. morphi-plan-simple.md is the
day-to-day plan ("games first, architecture second"), so this refactor
is scoped to engine core only. It is not a full platform rebuild, and it
is not a prerequisite for every future game beyond the engine changes
listed here. The owner ordering — engine first, then puzzle upgrades —
is recorded here as the owner override for this refactor only.
Still binding from PLAN.md:
Section 2: SvelteKit (Svelte 5) with Cloudflare adapter, TypeScript
  strict, one shared engine used by client and server. Physics later
  is Rapier via its deterministic npm build, used from TypeScript,
  not Matter.js, and not a different frontend framework.
Section 5: engine imports nothing from puzzles; a puzzle imports the
  engine but never another puzzle; the app reaches puzzles only through
  the generated registry. A shared-engine change runs every puzzle's
  vectors; a single-puzzle change runs that puzzle's tests plus shell
  smoke. Each puzzle has its own engine_version, so changing one game
  never invalidates another.
Section 6, the puzzle contract: generate / validate / score, with
  canonical serialization, field order, SHA-256 of UTF-8 JSON for
  vectors in the first run, SplitMix64 v1 and nothing else, unbiased
  rejection-sampled Fisher-Yates, unsigned 64-bit seeds as decimal
  strings, BigInt or paired 32-bit halves inside the engine, and
  separate RNG streams for puzzle logic and cosmetics. Theme draws
  never perturb the board. Known test vectors are the real
  specification: they must pass exactly, in Node, Bun, Chromium,
  Firefox, WebKit, and the Worker. V8 and
  JavaScriptCore differ in the last bit for approximated math, which is
  why engine core is integer-only.
Core banned math: no Math.random, Date.now, or approximated
  functions (sin, cos, tan, exp, log, pow, sqrt, and
  similar) in engine core. Theme code may use float colour math, but
  theme output never enters canonical serialization or the determinism
  hash.
Section 10, config policy ("no hard-coding, with a boundary"):
  editable config is stored in D1 and cached in KV: difficulty curves,
  puzzle weights, enabled types and modifiers, scoring weights, XP,
  prices and plans, feature flags, daily schedule. Code, not
  configurable: puzzle rules, generators, validation, scoring logic,
  and security checks. Every config key has a typed schema and a safe
  default in code, so a missing or invalid value never breaks the app.
  Do not build a rules-scripting system. Until Phase 3, recipes,
  styles, bands, and weights lived as typed JSON in the repo; D1-backed
  config and admin editing arrive in Phase 3 and later, with the same
  schema. This refactor brings that admin editing forward for theme
  and style config only. It does not make rules or scoring logic
  admin-editable.
Section 11.11, catalog and layout: a family is code, a variant is
  data that parameterises a family, an instance is a variant plus seed
  and difficulty band. Add content as variants whenever a family can
  express it; write a new family only when the rules differ. Each
  family is a self-contained, lazy-loaded package with logic, view,
  manifest, strings, tests, and README. The registry is generated
  from the packages, so there is no hand-maintained central list.
  Manifest fields include id, name key, kind, timing, orientation,
  aspect range, layout mode, layout profiles, stage mode per profile,
  side panels, renderer, style profile, depth cues, design brief,
  tutorial depth, immersive, input, target session length, audio,
  languages, ranked-capable, determinism class, performance class,
  accessibility notes, and engine version.
Section 11.14, selector: rotation is at family level first, then
  variant inside the family, then seed. Weighted shuffle bag over
  eligible families, each family exactly once per cycle, never repeat
  the just-played family, minimum gap K = clamp(floor(eligible / 3),
  1, 5). Selector takes an injected RNG, uses a small family index
  (id, weight, flags, orientation, chunk URL), never loads a full
  catalog, and lazily loads the chosen family's variant pool.
  Next means the selector's next pick, with Instant Next preparing
  round N+1 while round N is played.
Section 11.2, theme variety: a theme is a cosmetic skin, a
  deterministic function of seed, puzzle type, item counts the puzzle
  needs, and theme_config_version. It never affects solvability,
  difficulty, validation, or score, and is kept out of the determinism
  hash so art can change without invalidating stored runs. Independent
  axes: palette from curated recipes, symbol set from shape families,
  tile/card shape, texture/pattern, background pattern, layout where
  allowed, motion style, and sound set. Sizes that change difficulty
  are parameters in difficulty bands, not theme. A symbol set needs
  at least as many distinct symbols as the pair count.
Section 11.3, SEO; 11.4, error handling; 12.3, performance: see the
  best-practice section below. Targets from the plan: LCP at most
  2.5 s, INP at most 200 ms, CLS at most 0.1, on a mid-range phone.
  Critical path target in the plan: under about 150 KB transferred.
Section 13, definition of done: every slice ends with built,
  skipped, known issues, decisions, questions, an evidence table, and
  measurements with device class, network profile, cold or preloaded
  load, number of runs, median and p95, and whether each target is a
  gate or a goal.
Superseded or flagged, do not silently reintroduce:
PLAN.md section 2 lists GA4 and Google Search Console for search and
  analytics. Current code uses Cloudflare Web Analytics, not GA4, and
  the owner now says Cloudflare-only. This refactor keeps analytics
  as Cloudflare Web Analytics only, and does not add GA4, an external
  analytics script, or an external font or CDN at runtime. Fonts are
  already bundled with @fontsource, audio is local static files.
Google sign-in remains the only outside-Cloudflare runtime touch,
  as the owner previously approved Google-only sign-in with guest play
  retained. ElevenLabs is build-time sound generation only
  (scripts/generate-sounds.ts); its server client file is not a
  runtime dependency. Replacing Google sign-in is a separate owner
  decision, not part of this refactor, and privacy docs must not be
  changed to imply otherwise without that decision.
PLAN.md section 2 says local-first with no GitHub repo until Phase 2.
  That is superseded: the owner-authorised private repo exists.
  Pushing source does not authorise a deployment.
PLAN.md section 11.3 describes indexable per-type pages
  (/memory, /block-puzzle). Work 5 withdrew public game doors and
  those routes now redirect to Home. Do not reintroduce indexable
  per-type pages in this refactor without a separate owner decision.
  SEO work here is for the existing indexable content pages, not for
  re-opening game doors.
Cloudflare-only target architecture
Workers with Static Assets for the app, Worker for APIs and replay,
D1 as the system of record for accounts, scores, sessions, config,
and admin audit. KV only for cached config and leaderboard caches,
never for strict counters, rate limits, or single-use enforcement.
Cache API for public static and leaderboard reads. R2 only if a slice
proves a need for large static assets (backgrounds, icon sets,
sounds); it is not required by default, because audio and assets
already ship as Worker assets.
Do not add, in this refactor, unless a slice produces measured need:
Durable Objects (multiplayer rooms, live leaderboards, hot counters),
Queues, or per-user shards. The plan says do not add Queues or
Durable Objects until a measured need appears, and do not shard
before load-test evidence. Cron Triggers are allowed for seed-bank
generation, daily rollups, audit archiving, and cleanup, all inside
Cloudflare, when a slice needs them.
No external runtime services: no Supabase, Firebase, AWS, Vercel, or
other host, database, CDN, font, or analytics provider. No runtime
AI-generated puzzles. AI is offline only, for assets and content,
as in the plan.
Paid plan note: Workers Paid removes free-tier worry, but it does not
remove D1 single-threaded write throughput, Worker CPU, or bundle
costs. The plan's own estimate is that D1 writes, not Worker
requests, break first at thousands of concurrent ranked players.
Mitigations, in order, remain: cache leaderboard reads, batch writes,
keep hot counters out of D1 where the plan allows, roll up with Cron
Triggers, and only then shard. Load-test before launch, do not
prematurely shard.
Audit and stats, D1 rule added 2026-11-01: audit writes are
admin-frequency, not player-frequency. One audit insert, batched
in the same D1 transaction as the mutation, for each admin action
(ban, delete, game lifecycle, scoring publish, operator read/login),
adds no material load at 100 concurrent players, and must never
be written per player round, per move, or per measurement event.
Stats must not add a second counter write per round. Completed
runs, sessions, and round activity are already the stats source;
per-game and per-user stats are derived reads over indexed
completed_run, not new hot-row counters. Those admin reads share
D1's single-threaded queue with player writes, so the global admin
overview and other whole-table count(*) reads must be cached in
KV/Cache or served from Cron rollups at scale, not run live on
every admin page load. Audit is kept indefinitely with a yearly
archive: archive a year only after a verified export, keep the
archive immutable and queryable, and keep the live audit table
paginated and indexed. Anonymous measurement is the hidden
player-frequency write, up to several inserts per round when
consented, so at scale it must be sampled, batched, or moved out
of D1, never left as one D1 insert per event.
Admin-driven style — what is editable, what is necessary code
Editable from the admin panel, in D1, versioned, audited, with a
draft -> check -> preview -> publish -> rollback flow that mirrors
the existing scoring-version flow:
Game enable/disable, lifecycle, weights, minimum gap, discovery
  boost, featured boosts, first-impression family, beta flags.
Difficulty bands and per-family parameters, within the band caps
  in the global-research section below.
Scoring values (already admin-editable), per family, as new
  immutable versions, never by rewriting history.
Theme recipes: harmony, offsets, jitter, chroma range, lightness
  targets, background tier.
Style records: radius, border, gap, aspect, fill, container shapes,
  backdrop kinds and layout, motion tokens, and per-family style
  profiles.
Per-family theme profiles: palette size, symbol families and count,
  backdrop objects allowed for that family only, surface list
  (tile/card container, board frame, pieces, backdrop), depth cues,
  and stage/layout profile values.
Site and game token values. Token names and structure stay in code;
  token values become data. Changing a value must never require a
  code deploy to take effect, once published.
Necessary things that stay in code, never admin-editable, even under
"no hardcoding":
Puzzle rules, generators, validation, replay, scoring logic
  (values are data, logic is code), RNG, canonical serialization,
  and determinism class.
Security: RBAC matrix, TOTP and re-authentication for sensitive
  actions, impersonation disabled, audit immutability, input
  validation, anti-cheat and server replay, rate and session caps.
Accessibility and safety floors that admin values must pass before
  publishing: symbol contrast, back contrast, edge contrast, mark
  contrast, text contrast, minimum colour difference including
  Machado colour-blindness simulation, no colour-alone meaning,
  tap targets at least 44 x 44 px, shape never carries meaning alone,
  reduced-motion alternative, and no gradients, glows, or shadows on
  game objects except a puzzle's approved layered depth exception
  (solid offset side face, outlines, stacking order, small gaps).
Anti-slop structure, message catalog for user-facing text, and the
  engine import boundary (engine never imports puzzles, puzzles never
  import each other, app reaches puzzles only through the registry).
Safe defaults in code for every config key, so a missing, invalid,
  or unreachable config value falls back safely and never whitescreens
  the app. Kill switches work without a redeploy, and a bad published
  config can be rolled back by switching the live version.
Admin workflow for every style/theme change: edit as draft, run the
palette check (10,000 seeds/rounds per puzzle in the current script,
or the slice's stated equivalent), run affected puzzle vectors,
preview at phone portrait, phone landscape, and desktop, publish as
a new theme_config_version, record before/after, actor, and reason
in admin audit, and keep the previous live version available for
rollback. Theme changes are cosmetic and are kept out of the
determinism hash, so they do not invalidate stored runs, as in
PLAN.md section 11.2. Ranked sessions already in flight keep their
recorded theme version.
Global research verification — every suggestion checked against the roadmap
Source: the refreshed global research, 132 main families plus 88
appendix variants = 220 families, after merges such as Nonogram =
Picross and Flow = Numberlink. The older roadmap file says 242; that
220 vs 242 difference is still unresolved, so this brief uses 220
and does not build any claim on 242. The roadmap is a long-term
library, not a backlog to build all at once. Add families by value,
one at a time, each behind a beta flag with its own replay metrics,
as in PLAN.md section 11.11.
Verification table — suggestion, roadmap evidence, what it forces:
Per-family theme profiles, not one global palette.
  Evidence: families differ in what they need to be readable.
  Grid logic (Sudoku, Nonogram, Kakuro, Slitherlink) needs number
  and grid legibility, low-chroma backgrounds, and cell borders, not
  colour. Matching and sorting (Match-3, Water/Ball Sort, Triple
  Tile) needs many distinct colours plus shapes, dual-coded so
  colour is never the only signal. Tile games (Mahjong Solitaire,
  Jigsaw, Block-fit) need many tile faces and layered depth.
  Word games (Word Search, Crossword) need text contrast first.
  Path games (Flow/Connect) need stroke and dot contrast.
  Forcing: manifest declares palette size, symbol families and
  count, surfaces, and contrast targets per family. The current
  generator's fixed 3 colours, 7 recipes, 5 styles, 4 containers,
  and 10 symbols do not cover this range.
Difficulty and size caps as data, not as bigger boards by default.
  Evidence: the roadmap caps sizes because Morphi's sweet spot is
  1 to 3 minute rounds, teach in at most 10 seconds, and a core loop
  fun within about 30 seconds. Examples in the research: Sudoku
  Hard at 20 to 40 minutes, Nonogram 25x25 at 25 to 60 minutes, and
  Jigsaw 1000 pieces at 120+ minutes are all past that sweet spot.
  Forcing: difficulty bands, board sizes, and round-time targets
  are per-family config data, with caps, and a heavy family must
  use a solver or reverse-play generation plus a seed bank, not a
  larger on-device generation at play time.
Stage modes per family and per profile, not one centred stage.
  Evidence and plan: centred for Memory, Block, Sudoku-style grids,
  Match-3, word, Flow, and falling-block; wide for Mahjong
  Solitaire, card solitaire, large Nonograms, and large mazes;
  full for Jigsaw and physics. Forcing: manifest declares stage
  mode per layout profile, aspect class is a deterministic modifier
  recorded in the session so replay works, the selector skips
  landscape-only puzzles on a portrait phone or offers a rotate
  hint, never forces orientation, and logic never reads viewport
  size.
Input and renderer variety, not one input or one renderer.
  Evidence: tap, drag, stroke, keyboard, and pan-zoom appear across
  the roadmap. Forcing: manifest declares input and renderer
  (dom/svg for grid and tile puzzles up to a few hundred
  elements, canvas2d/pixi only for jigsaw or hundreds of moving
  pieces). Heavy renderers load lazily, only inside that puzzle's
  chunk. No Phaser. PixiJS only if a specific puzzle proves it
  needs it.
Solo first, multiplayer parked.
  Evidence: the roadmap finds no published multiplayer-vs-solo
  retention, session-length, or sessions-per-day split for any
  puzzle game, and multiplayer retention is an unproven hypothesis,
  not a benchmarked uplift. Forcing: this refactor does not build
  Durable Object rooms, matchmaking, or multiplayer retention
  claims. Ranked solo stays the model.
Priority order for engine features.
  Evidence: Mass families in the research include Sudoku, Match-3,
  Water Sort, Block-fit, and Flow, plus Memory pairs. Niche-but-
  loyal families (Slitherlink, Kakuro, KenKen, Minesweeper, Sokoban,
  Tangram) come after, and Band D no-data families come last, if at
  all. Forcing: engine slices must first cover Mass and current
  families, then niche grid logic, and must not be designed around
  a Band D family.
Retention claims must not be invented.
  Evidence: puzzle D1 31.85% and D30 5.35%, Match D1 32.65% and D30
  7.15%, from AppsFlyer Q3 2022 as labelled in the research, with
  no puzzle D7 figure. Forcing: measure replay-after rate as the
  primary metric, with completion rate and abandonment as guards,
  as in PLAN.md. Do not claim a refactor improves retention by a
  percentage.
IP and originality.
  Evidence: mechanics are not the same as names, artwork, and
  distinctive presentation. Forcing: descriptive names only, no
  Tetris, Wordle, Candy Crush, or other trademarked names or looks,
  original art and sounds, and an IP check in every new puzzle's
  design brief.
Current state found in the cloned repo — audit summary
Already generic or good, do not rebuild: the selector is generic
(PuzzleSelector<Family extends string>); the registry generator
scans puzzle folders for manifests; catalog is headless and
registry adds views; theme generation has a worker, a one-slot
speculative preparation, and IndexedDB history; scoring is
versioned and immutable.
Leakage, the actual refactor target: PuzzleId in
engine/contract.ts; SCORE_FAMILIES and SCORE_DEFAULTS in
engine/scoring.ts; PlaySession bests/played records, selector
weights, three nullable rounds, Game if/else chain, family-name
ternary, and availability validation; hardcoded logic and Game
exports in scripts/generate-registry.ts; server run validation
in server/runs.ts (family list, move-shape ternary, canonical
move mapping, per-family timing checks, group-to-family parsing);
params.ts family list; ui/storage.ts best-score keys;
measurement and activity validation; migration 0010 seeding only
three lifecycles; ThemeBackdrop, PuzzleGuide, ResultScreen, and
puzzle-backdrop ternaries; theme generator family xor ternary and
style.ts family CSS variables.
Performance findings: registry.ts statically imports all Game
views, so PlaySession pulls every game into the bundle; selector
refill() uses recursive backtracking under a gap that grows to 5;
solo-theme.ts falls back to main-thread generation if the worker
fails; ranked starts call drawFreshTheme synchronously; freshness
is all-or-nothing over the last 3 themes, and generateSymbols
always returns all 10 symbols, so the symbols rule always fails
against history, while history itself is global, not per family;
Block and Memory still carry old fixed 4-theme fallbacks, and
Connect has no per-game theme adapter, using themeStyle directly.
What this upgrade introduces — and what it does not change
Yes, it upgrades the engine together with the puzzles, but only
their wiring, not their gameplay. The engine cannot be upgraded
alone, because Block, Memory, and Connect are its only consumers,
and every place that hardcodes them has to move to the new
interface. That is a rewiring, not a redesign.
Introduces:
A registry-driven engine: generic string ids, manifest as the
  source of truth for scoring fields, theme profile, stage and
  input and renderer, difficulty bands, and determinism class.
Lazy-loaded puzzle views, so an unplayed game is not bundled
  into first Play, and a generic PlaySession with one generic
  round, not three hardcoded rounds.
Server validation, lifecycle, and config driven from the
  catalog, not from per-family branches, with D1 as truth and KV
  as cache.
A linear, non-backtracking selector, a small family index, and
  lazily loaded variant pools.
Admin-driven theme and style config with draft, check, preview,
  publish, and rollback, scored best-of-N freshness with
  per-family history and symbol subsets, and palette caching.
Selector persistence across reloads, solo checkpoint/resume,
  and a server-side active ranked session per account, to close
  the refresh and multi-browser edge cases in this brief.
The best-practice hardening in this brief: reliability,
  stability, performance, and SEO, all inside Cloudflare.
Does not change, unless a slice proves a bug:
Puzzle rules, generation, validation, scoring logic, difficulty
  feel, endings, sounds, or gameplay for Block, Memory, or
  Connect. Their logic.ts files stay untouched except for the
  interface adaptation needed to fit the new manifest, view
  loader, and theme adapter.
Existing test vectors and replay results. A rule change would
  require a new per-puzzle engine_version, so a slice that
  changes a vector is a failure, not a silent improvement.
The suspense model: selector-only /play, no game picker, no
  per-type indexable pages, and no public doors.
No new games, no new gameplay, and no new puzzle content in
  this upgrade. A new family after this upgrade should mean one
  new self-contained puzzle package, with no engine, selector,
  scoring, server, or theme-style edit.
Puzzle scope, per existing puzzle: expand its manifest, register
its view through the lazy loader, unify its theme adapter, and
re-run its unit, vector, and browser tests. If one puzzle fails
its tests, that puzzle's slice does not pass, and the other
puzzles are not broken by it, because each keeps its own
engine_version.
Slices — in order, each verified before the next
Slice 0 — Freeze the base.
Use the post-acceptance v1.2 push 1303c9c, verified by assistant
2026-11-01 ~12:14 PKT, not the pre-acceptance HEAD audited here.
Tag that base in git, record that
v1.2 is complete locally (owner PC review, mobile layouts via
browser responsive tools, no corrections, no deployment), and
confirm the database-reset permission covers local D1 only. No code
changes in this slice except the tag and the phase report.
Acceptance: owner confirms the base in writing, and the tag
points to full hash 1303c9c4bdb1718bb558886dc43b7b48c597a02a.
A base-tag check must run before Slice 1: git rev-parse HEAD
and the tag target must both equal that hash, otherwise Slice 1
does not start. Test file: tests/slices/slice0-base-tag.test.ts.
Slice 1 — Core identity and manifest as source of truth.
Make PuzzleId a generic string id, move scoring field lists and
defaults into each manifest, delete SCORE_FAMILIES as the source
of truth, and make server and admin code read families from the
catalog, not from a hardcoded list. Keep per-puzzle
engine_version and immutable scoring versions.
Puzzle-specific user-facing strings move into the per-family
message bundle referenced by its manifest; src/lib/i18n/messages.ts
retains shell, site, and admin copy only. The ending strings
already keyed per family in that file (ending.block., ending.memory.,
ending.connect.*) are the first strings to move, not an excuse to
leave a monolithic file untouched.
Acceptance: adding a manifest to a puzzle folder, with no engine
edit, passes type-check and the registry generator, and old test
vectors still pass unchanged. Test file:
tests/slices/slice1-manifest-scoring.test.ts, which scans
src/lib/puzzles/*/manifest.ts, loads each manifest, and asserts
scoring fields and defaults come from the manifest, not from a
hardcoded engine list, and that no puzzle string in the new bundle
requires editing messages.ts for that family.
Slice 2 — Registry v2 and generic PlaySession.
Generator emits catalog plus a lazy view map only, with dynamic
imports, no hardcoded logic or Game exports. Clarification on
catalog.ts: it is already generated by scripts/generate-registry.ts,
headless manifests only, and registry.ts is the same generated
file plus Game views. After this slice, the generator still emits
catalog.ts (manifests only, for the server) and a lazy view map
(for the app), and neither file contains hardcoded logic or Game
exports. PlaySession holds one generic round and one generic view,
not three nullable rounds and an if/else chain. Family names, bests,
played flags, and storage keys are derived from the id.
Acceptance: bundle no longer includes unplayed Game views on first
Play, and bun run verify passes. Test file:
tests/slices/slice2-lazy-registry.test.ts, plus a bundle analysis
check in verify that fails if PlaySession or the shell statically
imports any Game.svelte from block-placement, connect, or memory.
Slice 3 — Server validation and D1/KV config.
Move run validation, move shape, canonical move mapping, timing
rules, and group parsing into the manifest contract, so
server/runs.ts no longer branches per family. Family becomes a
plain text key in D1, lifecycle seeding comes from catalog, and
config reads use D1 with KV cache and safe code defaults.
Schema and migration ownership, added after external review:
update src/lib/server/db/schema.ts so lifecycles, config, and
weights are catalog-driven, not hardcoded seed rows; fix the stale
anonymous_event.family enum, which is ['block', 'memory'] and is
missing connect; add a D1 migration for the new config, theme,
and style tables with safe defaults in code, backward compatible
for one release, and confirm the database-reset permission covers
the new schema for local D1 only. A new family must require zero
changes to schema.ts or to migration files after Slice 1.
Server-side active ranked session, edge case assigned here: one
active ranked session per account, with explicit abandon/takeover
and the existing 2-hour TTL, so a second browser cannot start a
second ranked round in parallel without abandoning or superseding
the first in a visible way.
Acceptance: a new family added in Slice 1 can be started, replayed,
and scored on the server with no server file edited for that family.
Test file: tests/slices/slice3-catalog-server-validation.test.ts,
including a synthetic manifest-only family that is started,
replayed, and scored using only catalog-driven validation, plus
the active-session lock test above.
Slice 4 — Selector v2.
Keep the generic selector, replace backtracking refill() with a
linear greedy weighted shuffle plus gap repair, keeping the plan's
rules: each family exactly once per cycle, no immediate repeat,
gap = clamp(floor(eligible / 3), 1, 5), discovery boost, and
viewport/orientation eligibility from the manifest. Ship a small
family index, not the full catalog, and lazy-load variant pools.
Selector persistence, edge case assigned here: persist selector
state (queue, recent families, cycle position) across reloads, per
device/account in localStorage/IndexedDB, so a refresh continues
the cycle instead of restarting it.
Acceptance: property tests over seeded sequences, plus a timing
test that shows no backtracking blow-up at 50 families, plus a
reload test that the queue, recent families, and cycle position
survive a page refresh. Test file:
tests/slices/slice4-selector-property.test.ts, asserting exactly
once per cycle, no immediate repeat, the gap formula above, and
linear, not backtracking, timing at 50 families.
Slice 5 — Theme and style admin, scored freshness, palette cache.
Move theme recipes, styles, containers, backdrops, and per-family
profiles into the admin D1 config described above, with draft,
check, preview, publish, and rollback. Replace all-or-nothing
freshness with a scored best-of-N choice: weighted violations,
per-family history, and symbol subsets, not always all 10 symbols.
Cache palettes by recipe, hue bucket, chroma, and target, so
colorAtContrast is not recomputed for every candidate. Keep
OKLCH gamut reduction and Machado colour-blindness checks as
publishing gates, keep theme out of the determinism hash, and fix
backdrop layouts that still use evenly spaced columns or diagonal
rows. Legacy CSS audit, added after external review: audit
src/lib/ui/v1.css (43 KB, imported in +layout.svelte),
card-shell.css, game-shell.css, and account.css (imported in
AccountShell.svelte). Move theme values in them (radius, border,
gap, colours, container shapes) into the admin token records;
keep structural layout in code, and delete or neutralise only
duplicate hardcoded theme values that conflict with a token.
Do not delete shell layout wholesale.
Acceptance: palette check passes, freshness no longer fails
on symbols by construction, and theme generation stays off the
main thread with a worker, not a silent main-thread fallback, for
the normal path. Plus a rollback test: publish an intentionally
invalid palette/config, confirm the app falls back to the previous
live theme_config_version, then rollback restores it with no code
redeploy, after preview at phone portrait, phone landscape, and
desktop. Test file: tests/slices/slice5-theme-admin-rollback.test.ts.
Slice 6 — UI, admin, performance, and SEO hardening.
Generic family names and help/result/backdrop rendering from the
manifest. Admin views for games, scoring, users, and audit become
generic over catalog families, with TOTP/re-auth for sensitive
actions and audit for every change. Name the server files
explicitly: games.ts is hardcoded via SCORE_FAMILIES and must
become generic; moderation.ts, user-lifecycle.ts, players.ts, and
operator-permissions.ts were audited and contain no family
branches, so they need no family rewrite, only an audit note
confirming they stay family-agnostic, unless the slice audit finds
a branch the earlier audit missed. Performance: lazy chunks,
idle preload of the first puzzle, Instant Next preparation, Cache
headers (public static, private/no-store for personal and ranked),
and no personalised HTML cached publicly. SEO: prerendered
content pages, sitemap, canonical, OG images, one h1 on Home,
/play noindex, admin/auth/API noindex, seed share pages noindex
and not in the sitemap. Do not reintroduce per-type indexable
pages. Edge cases assigned here: on /play load, offer Resume or
Abandon + New when a ranked session is active; report abandon on
visibilitychange for an active ranked round, distinct from
goHome(); solo checkpoint/resume in IndexedDB as in PLAN.md
section 11.13.
Acceptance: Lighthouse-style targets from the plan, plus
the existing Playwright browser checks, with median and p95
reported, not a single run. The performance harness must report
p50/p95 over at least 5 runs, cold and preloaded, on a named
mid-range phone and desktop, with each target marked gate or goal,
including LCP, INP, CLS, critical path under about 150 KB, and
kill switches with safe defaults when config is missing.
Test file: tests/slices/slice6-performance-seo.test.ts, and for
SEO also run test:public-privacy and test:demo, which are not
currently in the bun run verify chain.
Slice 7 — Final determinism and contract audit, no new language
or framework.
Audit the refactored contract: integer-only core, canonical
serialization, BigInt seeds, separate cosmetic stream, and
per-puzzle determinism class (integer-only or physics).
Correction to the external review: six-runtime coverage already
exists in scripts/check-vectors.ts, which runs Node, Bun,
Chromium, Firefox, WebKit, and local workerd, and fails if the
results differ in any runtime. This slice must keep that script,
not rebuild it, and must keep it in verify.
Acceptance: a written report listing which puzzles are
integer-only, which are physics class, and what vectors must pass
exactly in all six runtimes, plus an integer-only check via
scripts/check-boundaries.ts in verify (no Math.random, Date.now,
or approximated math in engine core). No frontend framework
change in this slice. Test file:
tests/slices/slice7-determinism-six-runtimes.test.ts.
Best practice — reliability, stability, performance, SEO
Reliability: idempotent ranked start and submission (unique session
id, retries do not double-score), bounded retries with backoff,
fetch timeouts, worker timeout with a safe fallback that never
serves a disabled family, never a white screen, never a lost
finished result, a user-visible failed state plus a logged event
for every failure, structured JSON errors with code and retryable
flag, 429 with Retry-After, D1 failure as retryable 503, no stack
traces leaked to the client, correlation ids in Worker logs, and
solo play continuing from IndexedDB when offline, with ranked
clearly unavailable.
Stability: per-puzzle engine_version bumped only when generate,
validate, or score output changes for any seed; immutable scoring
and theme versions; migrations backward compatible for one release;
rollback by switching the live config version, not by redeploying
old code; kill switches and feature flags in config with safe
defaults; a new family behind a beta flag with its own replay
metrics; and a change to the shared engine running every puzzle's
vectors, while a single-puzzle change runs that puzzle's tests plus
shell smoke.
Performance: lazy-loaded puzzle packages, small family index,
critical path under about 150 KB transferred as a goal from the
plan, self-hosted font subset, idle preload of engine, shell, and
first puzzle, Instant Next, worker generation for anything over
about 8 ms on a mid-range phone, seed bank for heavy generators
(solvers, Mahjong layouts, Jigsaw cuts) via Cron Trigger or Queue
only when measured, Cache API and KV for leaderboard and config
reads, and D1 write batching. Report median and p95 over at least
5 runs, cold and preloaded, on a named mid-range phone and desktop,
and say whether each target is a gate or a goal.
Load measurement, clarified 2026-11-01: the plan's example is 100
concurrent players, not 100 players per second. At 1 round per
minute each, 100 concurrent players equal about 1.7 rounds per
second, or 100 rounds per minute, or 6,000 rounds per hour. At the
roadmap's 1 to 3 minute round sweet spot, 100 concurrent players
equal about 0.55 to 1.7 rounds per second. 100 rounds per second
is a different scale entirely: 6,000 rounds per minute, 360,000
per hour, 60 times the plan example, and, sustained for a month,
about 259 million rounds, far above the Paid plan's included
10 million Worker requests. A load test must therefore state all
four numbers separately — concurrent players, rounds per second,
Worker requests per second, and D1 statements per second — plus
p50/p95 latency and error rate, and must separate solo play,
which is mostly static assets and client generation, from ranked
play, which is start plus submit plus availability and activity
calls. Do not claim 100 rounds per second until a ramp test
measures D1 latency and cost at that rate; the plan's own caveat
is that the load test decides, and D1 writes, not Worker requests,
are expected to break first. D1 note, owner clarified 2026-11-01:
SQLite is read-optimised and single-writer by design. D1 does not
change that physics, it manages it: each database is backed by
one primary Durable Object, writes are serialised through that
single owner, and reads can spread across replicas, while writes
still go to the primary. Each D1 database processes queries one
at a time, so throughput is set by query time, not by Worker
concurrency. Morphi's hot queries are indexed in the current
schema (play owner/family, play start time, play IP time, run
owner/time, run board), which keeps them in the small-index-lookup
class rather than full scans, but the conditional ranked-start
insert still carries several count subqueries, so it must be kept
short and measured, not assumed to be 1 ms. If write load ever
proves too high, the Cloudflare-only answers are, in order:
cache reads, batch writes, Cron rollups, splitting data across
databases, and per-user Durable Object SQLite, not an external
database.
SEO: server-rendered and prerendered Home with real title, meta
description, one h1, semantic sections and asides, internal links,
canonical URLs, sitemap and robots, OG images (one static image
per puzzle type to start, dynamic OG only later), noindex for
/play, admin, auth, profile, API, and seed share pages, and
Core Web Vitals as part of SEO, not an afterthought. Do not expect
rich results from structured data; structured data, translations,
and dynamic OG are optional and later.
Verification for every slice
bun run verify today is: lint, zero-warning type-check,
check:boundaries, test:palettes, units, D1/auth integration,
test:vectors, isolated built-Worker smoke/build, and browser
checks. That chain does NOT currently include test:public-privacy
or test:demo, so Slice 6 must run those explicitly, and the slice
acceptance tests below must run per slice, not only at the end.
Plus, per slice: the slice's property tests, theme sheet, admin
audit test, and a phase report in docs/PHASE_REPORTS.md with
built, skipped, known issues, decisions, questions, evidence
table, measurements, waivers, owner responsibilities, and CODEMAP
update. No deployment, production provisioning, secrets, DNS, or
Google setup is authorised by this brief. Local-first, with
wrangler dev and local previews, until the owner gives a
separate deployment approval.
Fast checks per slice, owner decided 2026-11-02, for Slices 3
onward. Fast core on every slice: lint, zero-warning type-check,
boundaries, units, and that slice's own test file, plus a
targeted subset for the area the slice touches, and a summary
report only, not a per-test narration. Slice-specific fast
additions: Slice 3 — D1/auth and synthetic family test, skip
palettes and full browser; Slice 4 — property and 50-family
timing tests, skip palettes, accounts, and full browser;
Slice 5 — palettes, theme sheet, and rollback test, skip full
accounts and full browser except theme preview; Slice 6 —
relevant browser subset, plus test:public-privacy and test:demo;
Slice 7 — six-runtime vectors and boundaries, skip full browser.
Full bun run verify at milestones only: after Slice 3, after
Slice 6, and final after Slice 7. A fast-only slice confirmation
is provisional until the next milestone full run passes; the
final full run is the backstop before the whole refactor is
accepted. No deployment is authorised by a fast-only pass.
Slice acceptance tests, added 2026-11-01 after external review
of the pre-refactor tests and docs. Those existing tests prove
the current v1.1/v1.2 system, not the refactored target, so each
slice must add its own test in tests/slices/, mirroring its
acceptance criteria above, and a slice does not pass if its test
is missing:
slice0-base-tag.test.ts
slice1-manifest-scoring.test.ts
slice2-lazy-registry.test.ts
slice3-catalog-server-validation.test.ts
slice4-selector-property.test.ts
slice5-theme-admin-rollback.test.ts
slice6-performance-seo.test.ts
slice7-determinism-six-runtimes.test.ts
Edge cases this upgrade must solve — found in the audited repo
Direct visit to /play: yes, a puzzle starts immediately. The route
renders PlaySession, onMount calls startRound(), the selector
picks the next family, and generation is committed only after it
succeeds. A game query parameter cannot select a family; /play
stays selector-only, and the page is noindex. A family route
(/[family]) redirects to Home. So direct visiting is not a bug,
it is the Mix entry point, but it currently starts a brand-new
round even if a ranked session is already active, with no
resume/abandon choice.
Refreshing the puzzle page: the selector lives in memory only, so
a refresh creates a brand-new selector with a fresh random first
family, and the in-progress round is lost. There is no mid-round
checkpoint/resume in PlaySession in this repo, only completed runs
queued in IndexedDB for later sync, plus theme history and bests.
For solo/guest play this is free and unranked, so refreshing to
see another family does not affect leaderboards, but it does reset
the suspense cycle and lets a player refresh until a preferred
family appears. For ranked play, refreshing is already partly
capped on the server: startRanked allows at most 30 starts per
hour per user and per IP hash, and at most 10 unclaimed/abandoned
sessions in the calculation in server/runs.ts, sessions expire
after 2 hours, and only the latest session per family can be
claimed — an older session for the same family, once superseded,
returns 410 and is downgraded to unranked on sync. Refresh/close
does not report an explicit abandon; only goHome() reports
abandon, so a refreshed ranked session is counted as unclaimed,
not as an explicit abandon.
Different browsers on the same PC: for guest/solo play, each
browser has separate IndexedDB, localStorage, and cookies, so
each can play at the same time with no server limit, because solo
is local and unranked only, never a leaderboard score. For a
signed-in account, both browsers share the same user id and the
same IP hash, so the 30/hour and 10-unclaimed caps above are
shared, and the latest-session-per-family claim rule applies
across browsers. Two different families could still be played
ranked at the same time in two browsers, and there is no Web
Locks implementation and no server-side active-session lock in
this repo, even though PLAN.md section 11.13 proposes a Web Locks
single-owner rule for tabs. Web Locks would not help across
browsers anyway, because it is per browser profile.
Upgrade requirements for these cases, in Slices 3 and 4:
Persist selector state (queue, recent families, cycle position)
  across reloads, per device/account, so a refresh continues the
  cycle instead of restarting it with a new random first pick.
  Clearing storage or switching browsers is still a bypass, so
  this is a suspense improvement, not an anti-cheat guarantee;
  ranked caps remain the backstop.
On /play load, if a ranked session is active, offer Resume
  or Abandon + New, instead of silently starting a new round and
  superseding the old one.
Solo checkpoint/resume in IndexedDB, as in PLAN.md section
  11.13: seed, difficulty, modifiers, engine and theme versions,
  resolved theme snapshot, moves, pending deadlines, and active
  time, with a freshness limit, and a version mismatch offering a
  new puzzle and recording the old round as abandoned. Save on
  visibilitychange, not on unload/beforeunload.
Server-side active ranked session per account: one active ranked
  session at a time, with explicit abandon/takeover and the existing
  2-hour TTL, so a second browser cannot run a second ranked round
  in parallel without abandoning or superseding the first in a
  visible way. Solo play stays unlocked and unranked.
Report abandon on visibility loss where a ranked round is
  active, not only on goHome(), so unclaimed sessions are not
  silently confused with explicit abandons in admin stats.
Non-goals
No new games, no multiplayer, no payments, no CMS, blog, or share
links, no runtime AI puzzles, no new language or framework, no Phaser, no
PixiJS unless a puzzle proves it needs it, no user-created puzzles
or marketplace, no subscriptions, no skill trees, no community or
social features, and no per-user sharding or Durable Object rooms
without measured need.
Open owner decisions before Slice 1
Note, added 2026-11-01: the external-review items on schema and
migration, legacy CSS, server-file naming, edge-case slice
assignment, i18n, catalog.ts, rollback testing, and slice
acceptance tests are now incorporated into Slices 1 to 7 and
Verification above, and are no longer open. The items below
remain open.
Confirm the v1.2 base: v1.2 is now accepted locally (2026-11-01),
  and Slice 0 base is verified as 1303c9c, so this item is closed
  in substance; Slice 0 must still tag that commit.
Confirm Google sign-in stays as the only outside-Cloudflare
  runtime touch, and that Cloudflare Web Analytics stays the only
  analytics, with no GA4 added.
Confirm per-type indexable pages stay withdrawn, and SEO work
  stays on existing content pages.
Confirm admin theme editing includes site token values as well as
  per-game theme profiles, or per-game only.
Confirm a seed bank is design-only in Slice 5, or is to be built
  in that slice for heavy families.
