# Procedural Puzzle Platform: Implementation Plan

Handoff document for a coding agent (Claude Code, Codex, etc.). Before writing code, read sections 1 to 6 and the current phase in section 7, plus any section that phase references (see `AGENTS.md`).

## 1. Product summary

**Name:** Morphi, at the domain morphi.one. All puzzles live on one site (not one site per puzzle), which is a deliberate difference from sites that list puzzles across separate domains. The name is confirmed by the owner; the trademark and store check is on `docs/LAUNCH_CHECKLIST.md`.

A web platform where a visitor (a guest or a signed-in user) clicks one **Play** button and receives a randomly chosen, procedurally generated puzzle (memory, word, sliding, etc.). Each puzzle is generated from a seed plus difficulty and modifiers, so repeat puzzle types still feel new (different items, rules, themes, backgrounds, timers). Players get scores, leaderboards, and a small profile. Payments and multiplayer come later.

The core product risk is **game quality**: each puzzle is designed as a small game, with a clear core loop, responsive feedback, and progression, not as a generic puzzle widget; variety comes second. The platform is built only after the games are proven fun.

## 2. Decisions already made (do not revisit without asking)

| Area                | Decision                                                                                                                                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend            | SvelteKit (Svelte 5), Cloudflare adapter. Not Astro                                                                                                                                                                                                                                                      |
| Game logic          | TypeScript (strict): one shared engine package used by client and server. Rust/WASM is a planned later upgrade for specific puzzles only if needed (heavy solving, custom float math, a shared Rust server). The contract and test vectors make that port safe                                           |
| Rendering           | Svelte + SVG + CSS. No Phaser. PixiJS only if a specific puzzle proves it needs it                                                                                                                                                                                                                       |
| Physics (later)     | Rapier via its deterministic npm build, used from TypeScript (check the current package name). A Rust crate only if needed later. Not Matter.js                                                                                                                                                          |
| Auth                | Better Auth                                                                                                                                                                                                                                                                                              |
| Backend platform    | Cloudflare only for infrastructure: Workers (with Static Assets, via `@sveltejs/adapter-cloudflare`), D1, KV, R2, Durable Objects, Turnstile. Google Search Console and GA4 are used for search and analytics                                                                                            |
| Name and domain     | Morphi, at morphi.one                                                                                                                                                                                                                                                                                    |
| Development mode    | **Local-first:** no GitHub repo, Cloudflare account, or deployment (not even a temporary preview) until the first playable game is verified locally. Phase 2 creates them                                                                                                                                |
| Hosting target      | `@sveltejs/adapter-cloudflare` targets both Workers Static Assets and Pages (`adapter-cloudflare-workers` is deprecated). **Locked: Workers with Static Assets** (Durable Objects need a Worker, and the first run used it); Pages is not used. Assume the Workers Paid plan from Phase 3 (section 12.2) |
| Multiplayer (later) | Cloudflare Durable Objects. No Go                                                                                                                                                                                                                                                                        |
| Scripting/tooling   | Bun (tooling only, not the runtime)                                                                                                                                                                                                                                                                      |
| ORM                 | Drizzle with D1                                                                                                                                                                                                                                                                                          |
| Puzzle generation   | Deterministic TypeScript engine, not runtime AI. AI only offline, for assets and content                                                                                                                                                                                                                 |
| Payments (later)    | NOWPayments (crypto) first; cards later via a provider that supports the owner's country. Stripe does not onboard merchants registered in Pakistan (secondary sources, October 2026; the owner confirms)                                                                                                 |
| Solo play storage   | IndexedDB in the browser for solo/offline play. Results stay unranked and local until the player creates an account (see 8.6)                                                                                                                                                                            |
| Local dev           | Local Cloudflare emulation via Wrangler. Multiplayer and payments get tested live or in sandbox                                                                                                                                                                                                          |

## 3. Non-goals (explicitly out of scope)

- Community / social features, skill trees (mastery levels are only a cosmetic display of stats, not a skill tree; section 11.15)
- Subscriptions (leave the entitlement stub only, see 8.5)
- Player-built puzzles or a scripting language for rules
- Runtime AI-generated puzzles
- Music, heavy particle systems, a game engine
- Building on third-party game templates (for example CodeCanyon or Construct 3 projects): they don't fit a deterministic seeded engine with server replay validation
- "Rage bait" mode (parked; it will be a modifier pack after the modifier system exists)

If a task seems to need something on this list, stop and ask.

## 4. Working rules for the agent

1. Work in phases. Do not start a phase until the previous phase's acceptance criteria are met and the owner confirms.
2. Prefer the smallest implementation that meets the acceptance criteria. No extra features, abstractions or config systems "for later".
3. Cloudflare, Better Auth, Rapier, and the TypeScript and Svelte tooling change often. Check current official docs before using any API, and note version numbers you chose in `docs/DECISIONS.md`.
4. Every phase ends with a short written summary: what was built, what was deliberately skipped, known issues.
5. Keep game logic deterministic and headless in TypeScript. No rendering or randomness from system time inside the engine. All randomness comes from the seeded RNG passed in. No `Math.random`, `Date.now`, or implementation-approximated functions (`Math.sin/cos/tan/exp/log/pow/sqrt` and similar) in engine code; a lint rule enforces this.
6. Never trust the client. Scores are computed on the server.
7. Add tests for the engine (see 6). A puzzle without a determinism test is not done.
8. **The plan states requirements, not code.** Exact types, schemas, SQL, and configuration live in `docs/CONTRACT.md`, the Drizzle schema, and the Wrangler config, never in this plan. When a hint in the plan and the code disagree, fix whichever is wrong and record it in `docs/DECISIONS.md`.

## 5. Architecture

```
/apps/web            SvelteKit app (UI, API routes, Cloudflare adapter)
/packages/engine    TypeScript framework only, with no puzzles in it. `core/`: seeded RNG, the puzzle contract types, canonical serialization, hashing, validation helpers, and test harness. `theme/`: theme, palette, symbol, and style generation (fixed-point tables preferred; no `Date.now` or `Math.random`). No DOM, no platform imports
/packages/selector  Puzzle selector and rotation: pure functions with an injected RNG (section 11.14)
/packages/puzzles/<id>  One package per puzzle family (memory, block-placement, ...): `logic/`, `view/`, `manifest`, `strings/`, `tests/`, and a README. A puzzle never imports another puzzle
/packages/puzzle-kit  Shared puzzle UI helpers: Stage fitting, pointer input with guarded handlers, move recording, feedback, and the motion wrapper. Created in Phase 2, after the third puzzle (section 11.11)
/crates/            Reserved for possible future Rust/WASM ports of specific puzzles or physics (unused until a Rust port or Rust physics is chosen)
/packages/shared    Types needed by both the web app and the Worker that don't belong in the engine (may stay empty at first)
/scripts             Bun scripts (test-vector runner, seed config, migrations helpers). Bun is tooling only; production runs on Cloudflare Workers
/docs                PLAN.md, DECISIONS.md, puzzle specs
```

Data/services (Cloudflare):

- **D1**: users, profiles, sessions, scores, config, plans, purchases
- **KV**: cached config and leaderboard caches only. It is eventually consistent, so never use it for strict counters, rate limits, or single-use enforcement
- **Rate limiting**: Cloudflare rate-limiting rules or Durable Object counters (not KV)
- **R2**: static assets (backgrounds, icon sets, sounds)
- **Durable Objects** (Phase 5): multiplayer rooms, live leaderboards
- **Turnstile**: signup and score submission

The same TypeScript engine package runs in the browser (to render and play) and in the Worker (to validate submissions).
**Dependency rules (enforced by lint and CI):** the engine imports nothing from puzzles; a puzzle imports the engine (and `puzzle-kit` in its view) but never another puzzle; the app reaches puzzles only through the generated registry. A change to the shared engine runs every puzzle's vectors; a change to one puzzle runs only that puzzle's tests plus the shell's smoke test. Each puzzle has its own `engine_version`, so modifying one game never invalidates another.
**Create packages when needed:** Phase 0 creates `apps/web`, `packages/engine`, and `packages/shared`; the Memory package arrives in 1A, `packages/selector` in 1B, and `packages/puzzle-kit` in Phase 2.

## 6. The puzzle contract

Every puzzle type implements the same three functions. This is the most important design element, so it is specified before any puzzle code. The exact types are deliberately not written in this plan (see working rule 8). **Phase 0 writes `docs/CONTRACT.md`, the single source of truth, and the owner approves it.** This plan states the requirements:

- **generate** takes a seed (a decimal string), a difficulty, and modifiers (including the aspect class and any puzzle parameters), and returns the initial puzzle state.
- **validate** takes the puzzle state and the list of moves, and returns a validation result (success or a reason, plus the data the scorer needs).
- **score** takes the puzzle state, the **validation result** (never raw moves), and the elapsed time, and returns a score result (zero or an error for a failed validation). Elapsed time is server-measured for ranked play and active time for solo play.

`docs/CONTRACT.md` must pin: the shapes of the puzzle state, moves, modifiers, validation result, and score result; the move serialization; the canonical serialization (field order and number formats); the hash used for test vectors (the first run used SHA-256 of the UTF-8 JSON string); the RNG (SplitMix64 v1 and nothing else, so vectors never change) and the shuffle (an unbiased rejection-sampled Fisher-Yates, as in the first run); how many seeds the property tests use per puzzle (for example 300); and the `engine_version` scheme, which is a per-puzzle integer incremented whenever the generate, validate, or score output changes for any seed (that is, whenever a test vector changes). It must also pin: the puzzle outcomes (`in_progress`, `won`, `lost`, and for scored runs `ended`; a valid scored-run ending such as no piece fitting or reaching the move cap earns a score and is not a failed validation); the pure transition operation the UI uses to obtain intermediate state (the renderer never re-implements the rules); numeric bounds and rounding; seed normalization and the rejection of invalid seeds; RNG arithmetic and overflow behavior; separate RNG streams for puzzle logic and for cosmetics, so theme draws never perturb the board; and independent expected vectors for the RNG, validation, and scoring (not produced by the code under test).

Rules:

- `generate` is fully deterministic: same inputs give identical **canonical serialized output** on every platform (not merely identical in-memory structs).
- Canonical output rules: use a specified, versioned seeded RNG (name the algorithm and version in `docs/DECISIONS.md`, and implement shuffles explicitly rather than relying on library defaults that may change). Never iterate unordered maps when producing output. No unspecified floating-point values in output. Serialize with a fixed, documented format and field order.
- Engine **core** code (everything except the `theme` module) is integer-only. Do not use `Math.random`, `Date.now`, or implementation-approximated functions (`Math.sin/cos/tan/exp/log/pow/sqrt` and similar); engines differ in the last bit for those. Floating point is allowed only where results never reach canonical output. A lint rule enforces this, and the build must fail on a violation.
- **Two engine boundaries.** `core` (RNG, puzzle logic, validation, scoring, replay) is integer-only, with the banned-math lint enforced. `theme` (colors, symbols, styles, layout) may use the fixed-point lookup tables the first run built (preferred, and exact across engines) or floating point, but never `Date.now` or `Math.random`. Theme output never enters the puzzle's canonical serialization or its determinism hash. Physics (Rapier) is a separate determinism class with its own module, replay budgets, and cross-engine checks.
- Seeds are unsigned 64-bit values, represented as **decimal strings** in JSON and TypeScript types (JavaScript numbers lose precision above 2^53). Inside the engine use `BigInt` or paired 32-bit halves.
- Keep known test vectors (seed, parameters, expected output hash) in the repo and run them in Node, Bun, Chromium, Firefox, WebKit, and the Worker. They are the real specification of the engine: any future Rust/WASM port of a puzzle must reproduce them exactly. Note that Node and Chromium use V8 while Bun and WebKit use JavaScriptCore, so passing in one engine proves little about the others.
- `generate` must guarantee solvability (prove it in code or verify by solving).
- `validate` replays moves and decides success. It never reads wall-clock time.
- `score` has a precondition: it is only meaningful for a successful validation. Define it as taking the `ValidationResult` (or returning 0 / an error when validation failed), not raw unchecked moves. It is a pure function of the validated result and server-measured time.
- Bound inputs before replay: maximum move count and maximum payload size per puzzle type. Reject oversized submissions without replaying them.
- A puzzle type registers itself with a **manifest**: an id, a human name key, supported modifiers, a difficulty range, and its layout, orientation, input, and other needs (section 11.11).
- Variation lives in **parameters derived from the seed** (theme, item set, grid size, rules, timer, visual palette), not in separate code paths.

Frontend: each puzzle type is a lazy-loaded Svelte component that takes a `PuzzleState` and emits `Move`s. The engine decides correctness, the component only renders and collects input.

Contract types live in `packages/engine` and are imported by the web app and the Worker. If a puzzle is later ported to Rust, keep the types in sync with generated bindings or a test.

Tests required for every puzzle type:

- Determinism: same inputs give identical output across many seeds
- Solvability: N random seeds at each difficulty are solvable
- Validation: a known-good move list passes, tampered lists fail
- Variation: across, say, 100 seeds the outputs are meaningfully different (not just reordered)

## 7. Phases

Time estimates below are rough. The acceptance criteria and owner confirmation are the real gates. Do not cut engine tests, determinism checks, or deployment checks to hit an estimate.

### Phase 0: Prove the pipeline and the determinism harness (about 1 to 3 days)

Goal: SvelteKit + a shared TypeScript engine package + Cloudflare works end to end, and determinism is testable across JavaScript engines.

Tasks:

1. Create the monorepo with Bun workspaces and the folder layout above.
2. In `packages/engine`, add the seeded RNG (SplitMix64 v1 and nothing else, recorded in `docs/DECISIONS.md`) and one function `shuffle(seed, n)`. Seeds are decimal strings; use `BigInt` or paired 32-bit halves for 64-bit state. Add the lint rule from section 6 (banned functions in engine core code) and known test vectors (seed, parameters, expected output hash). Also write `docs/CONTRACT.md` (section 6) and get it approved by the owner before building anything on top of it.
3. SvelteKit page with a seed input and a "Generate" button using the engine.
4. **Multi-engine test harness:** run the test vectors in Node and Bun (V8 and JavaScriptCore) and in Chromium, Firefox, and WebKit via Playwright. All results must match.
5. **Worker smoke test:** an API route running in the Workers runtime (via `wrangler dev`, local only) that returns the same output for the same seed. The route runs the full test-vector suite, not just one seed. Also prove a minimal binding read (a KV or D1 binding through `import { env } from 'cloudflare:workers'`) in `vite dev` and in the built local Worker.
6. **Local-only run.** Run the app and the Worker route locally (`vite dev`, `wrangler dev`, or a local preview of the build) and confirm identical output on desktop and from the local Worker route. Check a real phone by opening the local-network dev URL on the same Wi-Fi (section 12.2, local device testing). **No Cloudflare account, no GitHub repo, and no deployment (not even a temporary preview) in Phase 0**; those start in Phase 2.
7. **Tooling check:** pin **TypeScript 6.x** as the canonical `typescript` package. Verified in the SvelteKit 3 migration docs: SvelteKit 3 requires Node 22.17 or newer, TypeScript 6, Svelte 5.57.1 or newer, Vite 8.0.12 or newer, and `@sveltejs/vite-plugin-svelte` 7; project config moves into the `sveltekit` Vite plugin options, the `$lib` alias becomes `#lib` (declared in `package.json` `imports`, with explicit file extensions in every import, for example `#lib/foo.js`, as the official migration guide requires; use `$app/state`, not the removed `$app/stores`), and Cloudflare bindings come from `import { env } from 'cloudflare:workers'` instead of `platform.env` (section 12.2). **TypeScript 7 (the native compiler) can run side by side:** the `svelte-check` README says TypeScript 7 support requires the `--tsgo` flag with both versions installed (`typescript@~6` and `@typescript/native@npm:typescript@7`). Run a short compatibility test in Phase 0: keep TypeScript 6 as the default `bun run verify` check, add a TypeScript 7 check (`svelte-check --tsgo` for the app and plain native `tsc` for `packages/engine`), recheck `typescript-eslint`, and adopt TypeScript 7 for checking only if everything passes reliably. Record the result and versions in `docs/DECISIONS.md`. (The first run reported that `svelte-check` supported only TypeScript 5 or 6; the current README says otherwise.) A registry check on October 19, 2026 shows that `typescript`'s `latest` tag is now 7.0.2, so the pin must be explicit (`typescript@~6.0.3`). The `svelte-check` README is inconsistent about `--tsgo`: one section says it needs `@typescript/native-preview`, another describes the `@typescript/native@npm:typescript@7` alias, and its declared TypeScript peer range (`^5 || ^6`) excludes 7. Test both setups here and record the one that works.
8. **Agent-friendly repo hygiene** (section 12.1): create the `docs/CODEMAP.md` skeleton, an accurate `.gitignore`, and an `.ignore` file for noisy directories.
9. **CI basics and decisions** (section 12.2): create the CI workflow file (GitHub Actions) whose only job is the single command `bun run verify` (lint, `svelte-check` and `tsc` type checks, unit and engine tests, the test vectors in Node and Bun, the production build, the vector check against the built Worker, and the browser tests), including deliberate-violation self-checks for a `.ts` file and a `.svelte` file, and make that command pass locally. A real pull-request run is deferred until the repo is on GitHub (Phase 2). Record in `docs/DECISIONS.md`: the supported-browsers matrix (section 11.1), and the pinned versions.

Acceptance:

- The same seed gives identical output in Node, Bun, Chromium, Firefox, WebKit, the local Worker route, and on a real phone over the local network
- Test vectors pass everywhere, and the lint rule fails the build on a deliberate violation
- `docs/CONTRACT.md` exists and the owner has approved it
- No auth, database, or styling work was done
- `docs/CODEMAP.md`, `.gitignore`, and `.ignore` exist
- `bun run verify` passes locally and fails on a deliberate violation, the CI workflow file exists (its first real run is in Phase 2), and `docs/DECISIONS.md` records the browser matrix and versions

Remember: Bun runs JavaScriptCore, so Bun results alone prove nothing about browsers or Workers.

### Phase 1: Foundation, Memory, and the block puzzle (split into 1A and 1B)

Phase 1 is split in two because one block this size is how big plans stall. 1A delivers a complete, good-looking, playable Memory game with the whole app shell, and ends with a gate. 1B adds the block puzzle, generated themes, and the A/B replay test. Rough estimate: 2 to 3 weeks for each part, with a hard timebox of 3 weeks each.

**Decision (owner): build both first puzzles and compare them.** Order and rules:

- Design the contract up front with two kinds of puzzle: **solve** (finish or fail, like Memory) and **scored run** (endless until stuck, score from replaying the moves, like block-placement). Doing this before writing Memory avoids a rewrite later.
- Build **Memory first**, then the **block-placement score-chaser**: place pieces on a grid, clear full lines, combos, no timer, ends when no piece fits. Block-placement rules (v1). The design brief `docs/puzzles/block-placement.md` must restate them before build, and the owner confirms the defaults at the 1B gate. **Turn:** one placement of one tray piece; the tray holds three pieces and refills with three new pieces after the third placement. **Fair supply:** every refill during the opening turns (config `opening_turns`, default 10) includes at least one piece with a legal placement on the board when it is dealt, so early turns are forgiving; after the opening turns no placement guarantee applies. **Terminal:** the run ends as `ended` (scored, not a failed validation) when no piece in the current tray fits the board, or at the move cap (300 placements). **Difficulty:** the band is fixed for the whole run; the next run's band follows section 11.15. Validation replays the moves; score comes from the replay.
- Timebox: 1A and 1B each have a hard timebox of 3 weeks. If 1B overruns, run the comparison with what exists and report the shortfall; do not extend the phase silently.
- Do not copy any existing game's name, art, or distinctive visual identity. Third-party templates (including CodeCanyon/Construct 3 ones) are not a base for this project.
- After 1B the owner picks a **provisional** first-impression puzzle from the taste review and their own play. The A/B replay test (Phase 2, on a private preview, because it needs non-owner testers) confirms or overturns it. The other puzzle stays in the product and in the random rotation.

#### Phase 1A: Foundation and Memory (walking skeleton)

Tasks:

1. Implement the contract (section 6) in `packages/engine` (the contract types, the registry interface, the manifest type, and the Stage/viewport contract, section 11.11); the generated registry that imports the puzzles lives in the app. Create packages only when their phase needs them (Phase 0: `apps/web`, `packages/engine`, `packages/shared`; the Memory puzzle in `packages/puzzles/memory`; `packages/selector` in 1B; `packages/puzzle-kit` in Phase 2). Design the contract for both **solve** and **scored run** kinds up front.
2. Implement the **Memory** puzzle: grid size, number of pairs, symbol sets, themes, timer and other modifiers derived from the seed. Solvable by construction. It lives in `packages/puzzles/memory`, with `logic/` and `view/` in separate folders, and it has a design brief (`docs/puzzles/memory.md`, section 11.16).
3. Svelte component for Memory using SVG/CSS. Flip animations via CSS/Svelte transitions. Respect `prefers-reduced-motion`.
4. Feedback helpers inside the Memory package: 3 to 4 short sound effects (Web Audio, started only after the first user tap, with a mute toggle) and a win/fail state. Extraction into the shared `puzzle-kit` waits until Phase 2, after the third puzzle.
5. Play page: Play button, puzzle area, result screen with score.
6. Engine tests from section 6, plus UI state tests with a fake clock: timers tick once per real second, only the allowed number of cards can be revealed, mismatches flip back after the configured delay, and rapid taps cannot corrupt state.
7. **Result screen (replay hook).** It must show: the score, the player's previous best for this puzzle type (stored in IndexedDB, see 8.6), a clear "new best" or "so close" message when relevant, and one large **Next puzzle** button that starts a new puzzle in one click. No extra screens, ads, or modals between rounds.
8. **First-impression requirements.** The landing page (section 11.1) loads first, and its Play button starts the game (no signup, no category picker, no tutorial wall). The first round must be understandable without instructions, short (target 30 to 90 seconds), and tuned so most new players finish it successfully. Feedback (animation and sound) must make the first interaction feel good. The first round's difficulty is a config constant that can be tuned later.
9. **Replay test tooling and analytics events.** Log locally (an in-memory or IndexedDB event list is enough, no backend) using the event schema in section 11.6: when a round starts, finishes, is abandoned, and when Next is clicked, so the replay test below can be measured. Events must contain no personal data.
10. **App shell and UI/UX** per section 11.1: full-screen play layout, the first screen set (Home, in-game, Result, Menu, and Settings; Leaderboard, Profile, and Account appear only as disabled "Later" entries; Admin is Phase 7), menu panel, and the ranked/solo pause rule. Do this alongside Memory so the first playable build already looks and feels like the final product, and get the wireframes approved first, for every screen in all three sizes: phone portrait 390x844, phone landscape 844x390, and desktop 1280x800 (including the small Settings route). The puzzle page follows the page template and stage modes in section 11.16.
11. **Error handling and fallbacks** (section 11.4) for everything built so far: generation retry with a known-good fallback puzzle, `<svelte:boundary>` around each puzzle component, feature detection, in-memory storage fallback, and audio failure tolerance.
12. **i18n foundation, English only** (section 11.7): message catalog and library chosen, all user-facing strings extracted, logical CSS properties, no text inside SVG graphics. Do not add translations yet.
13. **Difficulty progression v1.** A new player's first round uses the easy band. After a success the next round of that puzzle type steps up one band (up to a configured maximum). After two failures or abandonments in a row it steps down. Progress is stored per puzzle type in IndexedDB. Ranked and daily play use fixed bands chosen by the server. Bands (grid sizes, pair counts, timers) are config data, not code.
14. **Tokens and presets.** Chrome color tokens (section 11.1a), the four verified preset palettes applied to Memory, Nunito self-hosted with the type scale (section 11.8), motion tokens and the Memory animations (section 11.9), and the reduced-motion path.
15. **Instant Next and loading** (section 12.3): the Home screen paints first, then idle-time preloading of the engine and the pre-chosen first puzzle; while a round is played, the next puzzle is prepared (module loaded, generated in a Web Worker when a generator can exceed the time budget), so Next starts with no spinner. Record the measured load times in `docs/DECISIONS.md`. The shell's arrival and exit protocol (section 11.9) is part of this task.
16. **Resume and edge cases** (section 11.13 and `docs/EDGE_CASES.md`): autosave the round after every accepted move and when the page becomes hidden, resume after a refresh, a closed tab, or a browser restart by replaying the recorded moves, handle version mismatch, multiple tabs, and clock changes, and run the lifecycle, input, time, and storage drills.

Acceptance:

- All engine tests pass
- Runs fully local, no backend
- The result screen requirements (item 7) and first-impression requirements (item 8) are met
- **UI check on real devices:** an iPhone (Safari) and an Android phone (Chrome) over the local network (section 12.2), and a desktop browser. If a physical device is unavailable, the owner records an explicit exception, and emulation is never reported as a pass. The play screen fills the viewport with no scrolling or accidental zoom, safe areas are respected, nothing but the minimal HUD is shown during play, and touch targets meet the size rule (section 11.1)
- **Responsive check:** the board and chrome are checked at 360x640, 390x844, 844x390, 768x1024, 1280x800, 1440x900, and 1920x1080. The board scales per its layout profile and never looks like a phone layout floating in a large screen
- **Page template:** the Memory page shows three columns on expanded screens with quiet side content (for example how to play and the personal best), uses drawers below 1024 px, and shows no columns on phones
- **Failure drills pass:** throw inside the generator, throw inside a puzzle component, block IndexedDB (for example private mode), fail a chunk load while offline, and block audio. Each shows the fallback in section 11.4 with no white screen and no lost state
- **Strings and design checks:** no hard-coded user-facing strings in components (checked by lint or grep), and the UI passes the anti-slop checklist in section 11.1
- **Performance targets (starting targets, measured and recorded):** first load of the Home screen under about 150 KB transferred, Play to first interactive puzzle under about 300 ms on a mid-range phone after idle preloading, Next gives visible feedback within about 100 ms of the click, the new puzzle is playable within 600 ms of the click, and there is no spinner on Next. Report three measurements from the arrival timestamps (section 11.9): click to visible feedback; preparation time (how long the next puzzle took to become ready, reported separately because it happens in advance); and click to playable. Each is reported as median and p95 under the measurement protocol in section 13.1.
- **Resume works:** close the tab mid-round and reopen it (and restart the browser), and the round resumes in the same state. After a puzzle engine version change, the app offers a new puzzle instead of resuming, and after a theme config change the saved look is kept (test both). Two tabs cannot both play the same round. On phones this check needs local HTTPS (section 12.2).
- **Edge-case drills pass** for the lifecycle, input, time, and storage categories in `docs/EDGE_CASES.md`.
- **Motion check:** with reduced motion on, the game is playable without movement, and animations hold about 60 fps at 4x CPU throttling (or on a real mid-range phone)
- **Gate 1A (owner):** play at least 20 rounds of Memory on a phone and on desktop. Decide whether Memory is fun enough to keep building. If not, fix Memory before starting 1B.

#### Phase 1B: Block puzzle, generated themes, and the replay test

Tasks:

1. Implement the **block-placement** puzzle and its Svelte component (SVG/CSS), reusing the Memory feedback helpers by copying them into this package (never importing from `packages/puzzles/memory`; extraction into `puzzle-kit` waits for Phase 2), result screen, and IndexedDB bests, per the decision below. It lives in `packages/puzzles/block-placement` and has a design brief (`docs/puzzles/block-placement.md`).
2. **Block-placement polish:** the block-placement entries of the animation catalog (section 11.9), the failure drills and device checks extended to this puzzle, and its Stage layout (portrait-first, centered on desktop).
3. **Color tokens, palette generator, and palette check** (sections 11.1a and 11.2): build on the tokens and presets from 1A: the recipe-based palette generator (OKLCH, deterministic re-roll, fallback to presets), the symbol generator, and `scripts/check-palettes` (WCAG contrast plus color-blind difference checks). Add a property test that 10,000 seeds all produce themes passing the thresholds, and a `scripts/theme-sheet` script that renders a contact sheet of about 60 generated themes for the owner to review by eye. Report pass rates per 30-degree hue bucket in the 10,000-seed test; no bucket may have more than about 5 percent fallbacks (the Python prototype showed 1 to 3 percent in every bucket).
4. **Recipes and styles as data.** Store the palette recipes, style families, and difficulty bands as typed JSON files in the repo, versioned by a `theme_config_version` constant (section 10), plus the backdrop generators and the theme-feature fields in the events (sections 11.2 and 11.6). Style records must vary card or tile proportions (aspect ratio), gaps, corner radius, border width, and fill mode, and layout records must vary the grid dimensions per difficulty band and the orientation layout, so that rounds differ in structure and not only in color and symbols.
5. **Replay test tooling.** A way to choose which puzzle a tester starts with, and a local export of the event log, for the A/B replay test, which runs in Phase 2 on a private preview.
6. **Rotation v1** (section 11.14): the puzzle selector as a pure module with an injected RNG, a weighted shuffle bag over the two puzzles (never the same puzzle twice in a row), the first-impression override, and unit tests with a seeded RNG. **Next must come from the selector, not repeat the current puzzle type.**
7. **Container shape families** (section 11.2): at least 4 shape families for Memory's cards and for Block placement's cells and pieces (for example rounded rectangle, circle, hexagon, diamond), varied with proportion, gap, and border, with 44 px targets and the flip animation tested on each.
8. **How to play** (section 11.1): Memory keeps its one-line hint; Block placement gets 3 in-context coach marks (select a piece, place it, clear a line), shown once per device, skippable, and replayable from the menu.

Acceptance:

- Playing 10 rounds in a row feels different each time (owner judges), and at least 4 of these axes visibly change across the 10 rounds: palette, symbol set, card proportions, corner style or border, spacing, backdrop, grid layout
- **Rotation works:** across 20 Next clicks the puzzle type never repeats in a row, and with two types enabled the sequence strictly alternates (only the seed decides which type starts). With more types, each type appears once per cycle and the order varies by seed. The selector is covered by seeded property tests (section 11.14)
- **Container shapes vary:** at least 4 container shape families appear across 10 rounds in both puzzles, targets stay at least 44 px, and the shape never changes difficulty or scoring
- **Block placement uses the same page template**, and both puzzles' wireframes show their stage mode in all three sizes
- **How to play works:** Block placement's coach marks appear once, can be skipped, and can be replayed from the menu without blocking Play
- **Replay test tooling is ready.** The A/B replay test itself runs in Phase 2, because it needs non-owner testers and a private preview.
- **Palette check passes in tests:** 10,000 generated themes meet the thresholds in section 11.1a, and a deliberately bad palette fails the check. The owner reviews the theme contact sheet and approves the overall taste (or sends back tweaks to the recipes)
- **Theme variety (section 11.2):** freshness is best effort, not a hard gate. A seeded simulation of 10,000 rounds per puzzle reports how often each freshness rule (no repeat within 3 rounds of palette recipe, base hue within about 60 degrees, style family, container shape family, or symbol shape family) is violated, and the phase report records the rates and the target the owner sets at the 1B gate. A test forces all 8 candidates to fail freshness and confirms that the last candidate passing the accessibility checks is used (or the verified preset if none does) and the round still plays. Accessibility thresholds (section 11.1a) remain mandatory in every case. A test confirms the same seed with a different theme gives the same validation result and score; the owner judges that rounds feel new
- The block puzzle passes the same UI, failure-drill, string, design, and motion checks as 1A.
- **Gate 1B (owner):** review the theme sheet and ten consecutive rounds, choose a provisional first-impression puzzle, and decide whether to start Phase 2. This gate is local-only and needs no accounts or deployment.

### Phase 2: Public v0 soft launch, then a third puzzle (about 1 to 2 weeks of work, then 2 to 4 weeks of data)

Part A ships v0 first: two puzzles, no accounts, no database. Part B builds the third puzzle behind a flag while data accumulates; it is not shown to the public until the gate. The third puzzle differs from both Phase 1 puzzles in logic, UI, and layout archetype (for example a wide, landscape-preferred board or a free-form pan-zoom board), so that it tests the layout contract in section 11.11. The owner chooses it after the Phase 1 gate; do not pick it in advance.

Tasks, Part A (public v0):

1. **Accounts and first deploy.** Create the GitHub repository (push the code and make the CI workflow run on a real pull request) and the Cloudflare account, with two-factor on both. Deploy an unlisted, `noindex` preview to staging. This is the first time anything leaves the local machine.
2. **Replay test on the preview.** Run the A/B replay test (`docs/REPLAY_TEST.md`) with 5 to 10 non-owner testers on the preview. This is a qualitative usability and replay pilot, not statistical proof: it can reveal confusion and obvious replay differences, and it confirms or overturns the provisional first-impression puzzle only when the signal is clear.
3. **Deploy** the solo-play build to morphi.one with `@sveltejs/adapter-cloudflare` (SvelteKit on a Worker with static assets, no accounts, no database), on staging first and then production (section 12.2), with HTTPS and the security headers from section 9.1.
4. **SEO basics** (section 11.3): server-rendered Home with title, meta description, and `<h1>`; prerendered per-type landing pages; `sitemap.xml`; `robots.txt`; canonical URLs; `noindex` rules; Open Graph tags; and Lighthouse results recorded.
5. **Analytics** (section 11.6): GA4 with Consent Mode and the event schema, key events, 14-month retention, the opt-out toggle, the server-set first-party anonymous-id cookie, a verified Search Console property with the sitemap submitted, and a documented replay-rate report in GA4.
6. **Share and challenge links** (section 11.3): the Share button on the result screen and the share route (solo, unranked, `noindex`), whose URL carries everything needed to reproduce the round: puzzle type, seed, difficulty, modifiers (including the aspect class), the puzzle engine version, the theme config version, and an optional target score.
7. **Public-launch essentials:** consent bar, privacy notice, a feedback or contact link, friendly 404 and 500 pages, a web app manifest for Add to Home Screen, and the error handling from section 11.4. Apply the loading strategy from section 12.3 and record the measured load times. Add the rotation setting (Mix or Stay on this puzzle) to Settings, and read the type weights, enabled flags, and first-impression family from repo JSON (section 11.14).

Tasks, Part B (third puzzle, behind a flag): 8. Implement the third puzzle via the same contract, with its own component and layout. 9. Create `packages/puzzle-kit` by extracting the shared helpers (Stage fitting, pointer input, move recording, feedback, and the motion wrapper) from the three puzzles (the rule of three), and reuse them. 10. Add a modifier system (shared modifiers such as timer, move limit, fog) applied across puzzle types where sensible. 11. Random puzzle selection: a Play click picks a type by weight. Keep the weights as a small in-code default (equal weights) for now. Do not bring the D1 config system forward into this phase.

Acceptance:

- **Replay test (A/B):** 5 to 10 people who are not the owner play with no instructions, about half starting with Memory and half with block-placement. Record, per person and per puzzle: did they finish the first puzzle, did they click Next/Play again after the first, and after the third. Write the results in `docs/REPLAY_TEST.md`. Target to aim for (not a hard gate): most testers start a second round, and a clear share reach a fifth. If almost nobody replays, stop and rework the result screen and puzzle before building more
- Three separate gates: **2a** private preview and replay pilot, **2b** public launch, **2c** continue or stop after the public data
- v0 is live on morphi.one with SEO and analytics verified: sitemap and robots work, landing pages render without JavaScript, seed share pages are `noindex`, GA4 events arrive only after consent where required, contain no personal data, and respect the opt-out toggle, the replay-rate and funnel reports work, and Search Console shows the sitemap as processed
- Lighthouse and Core Web Vitals meet the targets in section 11.3, or the gaps are written down
- Contract did not need breaking changes. If it did, document why in `docs/DECISIONS.md`
- The third puzzle is playable behind a flag, all three are playable locally, and tests pass for all types
- **Continue/stop gate (the owner decides):** after about 2 to 4 weeks of public v0 data, review the replay rate and feedback. If players do not replay, rework the puzzles and the result screen before building Phase 3. Phase 3 and later do not start without this review. Reason: a very large plan that never ships is the main project risk, and real players beat more planning. Define in advance: the denominator (eligible first-time anonymous ids that clicked Play) and the numerator (those that started 3 or more rounds in the window, as in section 11.6), the minimum useful sample (for example at least 200 first-time visitors), the observation window (extended until the sample is reached), and an "insufficient evidence" outcome that extends the window instead of forcing a decision.

### Phase 3: Platform layer (split into 3A and 3B; rough estimate: 3 to 5 weeks)

Phase 3 starts only after the Phase 2 gate. Assume the Workers Paid plan from here (section 12.2).

**3A: identity and ranked core**

1. Better Auth with D1 (Drizzle). Email signup/login. Turnstile on signup. **Decide with the owner before starting** whether email verification and password reset are required, and which email delivery provider to use. Construct the auth and database objects per request from the Cloudflare `env` (imported from `cloudflare:workers` in SvelteKit 3; `platform.context` became `platform.ctx` and `cf` is on the request; verify against the pinned adapter). Verified against Better Auth docs: `svelteKitHandler` does not populate `event.locals.user`/`event.locals.session`, so call `auth.api.getSession` in the `handle` hook and set them explicitly. For auth calls made inside SvelteKit server actions, add the `sveltekitCookies(getRequestEvent)` plugin (it must be the last plugin in the array; requires SvelteKit 2.20.0 or later). Also choose the sign-in methods with the owner (email and password, magic link, or OAuth such as Google). OAuth-only avoids building email delivery for v1.
2. Server-issued play sessions (see section 9): `POST /api/play/start` returns a signed seed, type, difficulty, modifiers; `POST /api/play/submit` receives moves only. The response also carries the server-computed theme spec and `theme_config_version`, so everyone sees the same theme, and the seed-shopping limits from section 9 apply. The token is stateless (HMAC-signed and expiring; see section 9), so nothing is written to D1 at start.
3. Server validates via the same engine package in a Worker, computes the score, stores it. Measure CPU time and bundle size (section 12.2), cap the moves per puzzle type, and record the numbers in `docs/DECISIONS.md`. Also measure peak memory against the 128 MB per-isolate limit, since a replay holds the full move list.
4. Leaderboards: global and daily (per puzzle type), read from D1 with KV caching if needed. Define scopes (per puzzle type and ruleset; daily, weekly, and all-time time windows, which are not the parked daily challenge), a tie-break (the earlier validated submission wins), pagination (top 100 plus the player's own rank), cache lifetimes, and what is shown for deleted users.
5. Minimal profile: username, avatar from preset list, stats (games played, best score per type), recent history. No bios, friends, uploads or customization. Add XP and levels as cosmetic progression driven by config (XP per completed round, level thresholds). Progression never unlocks difficulty or scoring advantages. Profile stats are complete per player: per puzzle family and difficulty band (rounds, outcomes, best and average scores, time played, streaks, and the highest band reached), computed from ranked runs and from solo runs the player syncs or imports (opt-in). Admins can see the same stats for any player.
6. Config table and loader (see section 10). Admin screens are not built in this phase. Move the recipes, styles, and difficulty bands from repo JSON into the config table, creating an immutable `theme_config_version` for every change (section 11.2).
7. Rate limiting and enforcement: per-user enforcement (token supersession, abandoned-start accounting, daily eligibility, and ban checks) lives in a Durable Object per user or guest, with counters persisted to DO storage. The Workers Rate Limiting binding and Cloudflare rate-limiting rules are only coarse abuse brakes; KV is never used for counters or revocation. Kill switches propagate through KV within a documented delay (target about 60 seconds), while security-critical revocations are checked against the authoritative store.
8. **Environments and limits** (section 12.2): staging and preview environments, secrets per environment, the Drizzle migration flow in CI, and confirming billing and alerts for Workers Paid (already decided). Run a load test with 100, 500, and 2,000 simulated players against staging (section 12.3) and record request rate, p95 latency, D1 query time, and errors. Start Phase 3 with a spike on local bindings (D1, Better Auth, and the per-user Durable Object in `vite dev`, with `vite preview` or `wrangler dev` as the fallback). Run this spike before task 7. It also decides and records the Durable Object export approach (a separate Worker that exports the class and is bound from the app, the default, or a community exporter plugin; section 12.2), because the enforcement Durable Object cannot be built without it. Record the results in `docs/DECISIONS.md`.

**3B: hardening and data** 9. Local-to-account import endpoint (see 8.6): validate each run by replaying it, flag as imported, dedupe, cap size and count. 10. **Ranked failure handling** (section 11.4): `pending` queue with backoff, idempotent submit, structured error responses, and kill-switch config flags. 11. **Account lifecycle and moderation basics** (see `docs/LAUNCH_CHECKLIST.md`): username rules (length, allowed characters, uniqueness, profanity filter), account and data deletion that keeps leaderboards consistent (delete or anonymize scores, decided with the owner), and the Stage 0 **admin CLI** from section 11.10 (set config, toggle kill switches, hide or restore a score, ban or unban a user, all audit-logged). The admin web panel comes later (Phase 7). 12. **Theme analytics pipeline** (section 11.6): write theme feature events through a first-party endpoint to Workers Analytics Engine and build the daily `theme_stats` rollup. 13. **Observability endpoints** (section 11.4): a rate-limited client error-report endpoint (no personal data), a health endpoint, and Workers logs with correlation ids.

Acceptance 3A (identity and ranked core):

- A logged-out visitor can still play immediately (guest session with a server-issued seed, nothing required up front), but only logged-in users' validated scores reach leaderboards; the result screen invites signup to save the score, and a guest's finished session can be claimed on signup (for example via a guest session cookie)
- Tampered or too-fast submissions are rejected or flagged
- Leaderboards show only validated scores
- A session can be submitted only once; replays and double submissions are rejected, including under concurrent requests. Each race and interrupted-write case in section 9.2 (step 3) has a passing test: concurrent submits, a start racing a submit, a crash between claim and insert, and expiry during scoring
- Validation CPU time and bundle size are measured and recorded, with a move cap per puzzle type
- The load test results are recorded, and the first bottleneck is identified (section 12.3)
- Seed-shopping limits work: starting sessions beyond the cap is refused
- Everything runs locally with Wrangler emulation
- Ranked start reveals the seed only when the authoritative clock starts; an identical authenticated retry returns the stored result, and a conflicting payload for the same session is rejected (section 9.2)
- Each ranked board is defined by a ruleset (puzzle type, fixed difficulty band and modifiers, and rules version), and personal bests are keyed by band and rules version

Acceptance 3B (hardening and data):

- Local-to-account import works: IndexedDB history is re-validated server-side, imported idempotently, shown as unranked history, and never appears on leaderboards
- Network failure drill: cutting the network mid-submit leaves the run in the `pending` store, and it syncs after reconnect without double scoring
- Deleting an account removes personal data, leaves leaderboards consistent, and is covered by a test
- Admin CLI actions work and each one writes an audit log record
- Theme analytics events reach Analytics Engine and the `theme_stats` rollup runs
- 3A stays private (no public ranked launch) until 3B is complete
- The phase report lists the owner's responsibilities (accounts, credentials, devices) so agents do not assume them

### Phase 4: Payments (sandbox first)

Tasks: 0. **Decide what to sell from data.** Before building the paid item, review the analytics from Phases 1 to 3 (for example which themes and puzzle types retain players, and where players drop off) and propose 1 to 3 candidate items to the owner. Do not choose the item yourself.

1. `plans`, `purchases`, `entitlements` tables and a single `hasEntitlement(user, feature)` function used everywhere.
2. NOWPayments integration: create an invoice, receive the IPN webhook on a Worker, and verify it. Verified in NOWPayments' docs: the callback carries an `x-nowpayments-sig` header, which is an HMAC-SHA512 of the JSON body with its keys sorted, computed with the IPN secret from the dashboard. Compare in constant time. Implementers report that re-serializing the body can change number formatting (for example `1e-7`), so test with real sandbox payloads. The documented statuses are `waiting`, `confirming`, `confirmed`, `sending`, `partially_paid`, `finished`, `failed`, `refunded`, and `expired`; list them all in the transition table. Official snippets sign `JSON.stringify(params, Object.keys(params).sort())`, whose array replacer also filters nested keys, while at least one SDK signs the raw body. Test both forms against captured sandbox payloads, including any nested objects, before choosing. After verifying, confirm the payment through the NOWPayments API before granting anything, and grant the entitlement only on the `finished` status. Handle `partially_paid`, `failed`, `expired`, and refund-type statuses by recording them and notifying the user without granting. Make processing idempotent by payment id. The merchant account may require identity verification (KYC), so start that early. Keep sandbox and live keys separate. Idempotency is per payment id and status transition, not only per payment id: a late or duplicate event must never overwrite a finished payment or grant twice.
3. One cosmetic paid item only (for example, a theme pack). No effect on difficulty, scoring or fairness.
4. Leave subscription as a stub in the schema and `hasEntitlement`. Do not implement billing.
5. **Store UI (minimal):** one page listing the paid item or items, a buy button that creates the invoice, and pending and paid states. No subscriptions. It emits the `store_viewed` and `purchase` events.
6. **Refunds:** when a payment is refunded or reversed after a grant, revoke the entitlement with an audit record.
7. **Reconciliation before the admin panel exists:** a Stage 0 CLI command that lists payments taken but not granted and any failed or partial statuses (the admin view arrives in Phase 7).
8. **Order and payment state machine:** orders (id, user, product, amount as a decimal string, currency, environment), an idempotency key for invoice creation, payment-to-order binding, an allowed-transition table in which statuses only move forward (a late `waiting` must not overwrite `finished`), a durable receipt of each webhook before acknowledging it, a non-2xx response when verification or the status confirmation call fails (so the provider retries), exactly-once entitlement grant in one database transaction, and no floating-point money.

Acceptance:

- Sandbox payment completes and unlocks the item
- Replayed or forged webhooks do nothing
- Statuses other than `finished` never grant an entitlement, and a tampered body fails verification (tested with sandbox payloads)
- A refund after a grant revokes the entitlement, and the CLI lists unreconciled payments
- Out-of-order and duplicate webhook events never change a finished payment or grant twice
- Tested via a tunnel or deployed environment (not purely local)

### Phase 5: Multiplayer

Tasks:

1. Durable Object per room (head-to-head race on a shared seed). Use the Durable Object export approach recorded in Phase 3A (section 12.2). Check current Cloudflare docs. Durable Objects with SQLite storage are available on the Workers Free plan.
2. Matchmaking: simple queue or invite link.
3. Server-side result validation using the same engine.
4. Test live on a deployed environment.

Acceptance: two players can race the same seed and a winner is decided by validated results, including reconnect, an opponent forfeit, a simultaneous finish, a Durable Object restart, and room caps.

### Phase 6: Physics puzzle (Rapier)

Tasks:

1. **Determinism spike first (half a day):** run one scripted simulation for N fixed ticks in Chrome, Firefox, Safari, and a Worker. Hash final body positions and compare. If hashes differ, stop and report.
2. Use Rapier's deterministic npm build from TypeScript (check the current package name, for example the `-deterministic` variants of `@dimforge/rapier2d`). Pin the exact version and use the same version on client and server, and load it lazily as a separate chunk. Rapier's docs say the JavaScript/WASM version is cross-platform deterministic as long as every initial value comes from deterministic operations, so do not use `Math.sin`/`Math.cos`-style functions to compute initial positions (use precomputed constants or exact arithmetic). A Rust crate is only a later option.
3. Extend the contract with `simulate(state, inputs_by_tick)`. Fixed timestep. Input recorded by tick number.
4. Procedural generation by working backward: build a solution, derive the puzzle, verify by simulation that a solution exists.
5. Rendering: read body transforms from the physics engine each frame and write them to SVG elements directly (do not push per-frame state through Svelte reactivity).

Acceptance: one physics puzzle is playable, deterministic across browsers and server replay. It also stays within a documented replay CPU budget and tick cap.

### Phase 7: Admin panel (staged)

Build in the stages from section 11.10: Stage 1 (login, roles, audit log, kill switches, moderation queue), Stage 2 (schema-driven config editor with rollback), Stage 3 (users and payments), Stage 4 (dashboard and announcements), Stage 5 (content management for static pages and the blog). Do not start a stage until the previous one is in use and there is a real need.

Acceptance: permission tests pass (non-admins get 403 on every admin route), every admin action writes an audit record, two-factor authentication is enforced for admin accounts, impersonation is disabled, and the config rollback test passes.

### Parked (do not build until the owner asks)

Rage bait modifier pack (promote it if the replay test shows it drives more replays than normal play), a Wordle-style daily challenge with a spoiler-free share grid and a light streak (the data model already carries `mode` and `challenge_date`, so it can be added without a schema change), the dark theme (after the Phase 2 gate, when the owner decides), music, particle effects, achievements, mastery levels, and streaks (designed in section 11.15), a code-index/knowledge-graph MCP tool (revisit after Phase 2, section 12.1), dynamic OG images, structured-data markup, translations, community, skills, subscriptions billing, AI-generated assets pipeline, a "Mix" setting to exclude puzzle types (add when there are 5 or more types), a service worker for offline play and installable PWA behavior (decide after the v0 data), puzzle backlog items beyond the first three (section 11.12).

## 8. Data model sketch (D1)

- `users` (Better Auth managed)
- `profiles`: user_id, username, avatar_id, created_at
- **No session row is written at start.** `POST /api/play/start` returns an HMAC-signed, expiring session token (session id, user or guest id, puzzle type, seed, difficulty, modifiers, aspect class, mode, challenge date, engine version, rules version, theme config version and the resolved theme, issued-at, and expires-at). `POST /api/play/submit` verifies the signature and expiry, replays the moves, and writes one `scores` row. Trade-offs: active sessions cannot be listed, and a revoked or banned user's tokens are rejected at submit by checking the authoritative store (a Durable Object or D1; KV is only a fast hint, because it is eventually consistent).
- `scores`: id, session_id (UNIQUE), user_id or guest_id, puzzle_type, mode (`ranked` | `daily`), challenge_date (nullable), seed, difficulty, modifiers (json), engine_version, rules_version (an immutable snapshot of scoring weights and difficulty curves), theme_config_version, payload_hash, moves (bounded; stored for flagged and top scores), theme_features (json), score, moves_count, elapsed_ms, flagged (bool), created_at. A partial unique index on (user_id, puzzle_type, challenge_date) where challenge_date is not null enforces one stored daily result; eligibility must also be consumed at attempt start (token issue time), including guest-to-account claims, so an abandoned attempt cannot be retried.
- `imported_runs`: id, user_id, puzzle_type, seed, difficulty, modifiers (json), engine_version, score, verified, created_at (unranked history from local import; never in `scores`)
- **All seed columns are TEXT** (decimal strings). SQLite integers are signed 64-bit and cannot hold seeds above 2^63 - 1.
- `config`: key, value (json), updated_at, updated_by
- `audit_log`: id, actor, action, target, before (json), after (json), reason, created_at (append-only; admin actions only write to it)
- `theme_stats`: feature_key, feature_value, puzzle_type, difficulty_band, first_round (bool), day, rounds, completions, replays, abandons, total_duration_ms (daily rollup of theme analytics events)
- `player_stats`: user_id, puzzle_type, difficulty_band, rounds, wins, best_score, total_score, total_active_ms, last_played_at, streak fields (a rollup updated at submit and at import; the source of the profile and of the admin player view)
- `plans`, `purchases`, `entitlements`: as in Phase 4

### 8.5 Entitlement stub

All feature gating goes through `hasEntitlement(user, feature)`. Today it checks one-time purchases. Subscriptions plug in later without touching callers.

### 8.6 Local solo storage (IndexedDB)

Solo play needs no account and no database, and is saved in IndexedDB. (True offline use after the first load needs a service worker, which is parked until after the v0 data.) An account is what makes progress permanent and eligible for rankings.

Two kinds of play:

- **Solo (local):** the client generates the seed. Results are **unranked and unverified**: they appear in personal stats and history only, never on leaderboards, and the server never trusts them. Reason: a client-chosen seed lets a player cherry-pick easy puzzles, so a local score cannot be compared fairly.
- **Ranked (online):** server-issued signed seed (section 9). Guests may play, and only validated scores of logged-in users reach leaderboards.

Stores (versioned schema with migrations; a small wrapper such as `idb` is fine):

- `settings`: mute, theme, reduced-motion override
- `bests`: best score/time per puzzle type
- `runs`: id, puzzle_type, seed, difficulty, modifiers, moves, local score, elapsed_ms, played_at, **engine_version**, source (`solo` | `ranked`), session_id (if server-issued), synced flag, **theme_config_version**, theme_features
- `pending`: finished server-issued sessions not yet submitted (retry when back online)

Account flow:

- On signup or login, offer to **import local history into the account**. The server re-validates each imported run by replaying seed + moves with the engine; runs that fail are discarded. Imported runs go into the separate server table `imported_runs`, appear in the player's history and stats, and never enter `scores` or leaderboards.
- Import is idempotent (dedupe by run id), capped (for example the latest 100 runs), size-limited, and rate-limited.
- A guest's finished ranked session can be claimed on signup (see Phase 3).

Rules and caveats:

- Local data is user-editable and can be cleared by the user or the browser (private browsing may also block IndexedDB). **Verified for Safari:** it deletes a site's script-writable storage (IndexedDB, localStorage, service worker registrations and caches) after 7 days of Safari use without the user interacting with the site, while Home Screen web apps have their own counter and are not expected to lose data. So on iPhone, solo progress can vanish for a casual weekly player. Never promise permanence, do not rely on `navigator.storage.persist()` against Safari's deletion (the documented exemption is installing to the Home Screen; verify current behavior), show the "create an account to keep your progress" prompt earlier on Safari, suggest Add to Home Screen, and keep the anonymous analytics id in a **server-set first-party cookie** (not only in IndexedDB), because retention numbers break otherwise. Recheck current browser behavior in the docs. Verified: server-set first-party cookies are not subject to the 7-day cap (browsers cap cookies at about 400 days). A Home Screen web app is not part of Safari and has its own day counter; it also reportedly uses its own storage and cookie container, so a Safari session's sign-in and anonymous id may not carry into the installed app.
- The app must still work if IndexedDB is unavailable: fall back to in-memory state. Wrap every access in try/catch.
- Never store auth tokens or secrets in IndexedDB (sessions use cookies).
- Stamp every run with the engine/contract version. If a generator changes, old runs can no longer be replayed. Decide per release whether to keep legacy engine versions for import or to drop those runs, and record it in `docs/DECISIONS.md`.

## 9. Anti-cheat design

Browser games cannot be made cheat-proof. Goal: make it hard, detectable, and not worth the effort.

1. **Server-authoritative scoring.** Client submits moves only, never a score. Server replays with the engine and computes the score. Enforce per-type limits on move count and payload size before replaying.
2. **Server-issued, signed, single-use seeds.** The client never chooses a seed. The session token is stateless, HMAC-signed, and expiring (section 8), so abandoned starts cost no D1 write. A token can produce at most one score: the `scores` insert with its UNIQUE `session_id` fails on a second submit. Check the signature and expiry with a constant-time comparison before replaying anything.
3. **Server-side timing.** Record start and submit times on the server and measure elapsed time there. Reject impossible solve times. The server only sees the full move list at submit, so it cannot observe per-move intervals. Optional client-supplied move timestamps may be stored as untrusted anomaly telemetry for review, never as scoring evidence. **Latency fairness:** server-measured time includes network delay, so for ranked timed puzzles rank by score and move efficiency first, treat time as a bonus with a tolerance, and never rank purely on raw milliseconds. For ranked scoring use elapsed = max(0, server elapsed minus 1 second of network allowance), quantized to whole seconds, so players on slow connections are not penalized.
4. **Turnstile and rate limits** on signup and play/submit. Also limit **seed shopping** (starting many ranked sessions and abandoning the hard ones): cap session starts per user and IP per hour, track the latest issued token per user and puzzle type in a per-user Durable Object (counters persisted to DO storage, because in-memory state is lost when a Durable Object hibernates), reject submits of superseded tokens, and count starts without a matching submit as abandoned against the cap. The Workers Rate Limiting binding is permissive, per location, and eventually consistent (verified in the docs), so it is only a coarse abuse brake, never accounting. Daily challenges give one seed per day, so shopping is impossible there.
5. **Flag and review.** Flagged scores are hidden from leaderboards pending review. Admin can remove scores and ban users. Consider shadow-banning.
6. Seed policy: unique seed per player per session by default. Shared seed only for daily challenges and multiplayer matches. Do not reveal a daily seed or puzzle before the player starts. Daily seeds are derived on the server (for example an HMAC of the UTC date, the puzzle type, and a secret), reset at 00:00 UTC, and cannot be computed by clients in advance.

Do not rely on obfuscation. No prizes or real money tied to leaderboards for now.

**Starting defaults** (config values, guesses to tune from data, not measurements): token lifetime of twice the puzzle's time limit, at least 10 minutes and at most 2 hours (untimed scored runs: 2 hours); 30 ranked session starts per hour per user and per IP; more than 10 abandoned starts in an hour trigger a one-hour start cooldown; submissions faster than the puzzle's documented minimum human time are rejected (Memory: 0.4 seconds per pair); a network allowance of 1 second; and move caps per puzzle type (Memory: 6 times the pair count; Block placement: 300 placements), documented in each puzzle's spec.

### 9.1 Security baseline

- **Headers:** a strict Content-Security-Policy (SvelteKit's CSP support with nonces or hashes, no `unsafe-inline` scripts), HSTS, `X-Content-Type-Options: nosniff`, a Referrer-Policy, and a Permissions-Policy. Check the consent script, GA4, and fonts against the CSP.
- **Validation:** validate every request body, query, and webhook payload with a schema library (for example Valibot or Zod) at the edge of each endpoint. Reject unknown fields and oversize bodies.
- **Database:** Drizzle's parameterized queries only, never string-built SQL.
- **Cookies:** `HttpOnly`, `Secure`, `SameSite=Lax` (or Strict where possible); review Better Auth's defaults.
- **CORS and CSRF:** CORS closed by default, CSRF protection on state-changing routes.
- **Secrets:** only as Worker secrets (`wrangler secret`), never in the repo or a client bundle, with `.dev.vars` ignored.
- **Dependencies:** commit the lockfile, run an audit step in CI, keep dependencies minimal, review every new one, and pin versions (supply-chain risk).
- **Logging:** no personal data, tokens, or payment details in logs.
- **Webhooks:** parse only as far as needed to canonicalize, verify the signature with a constant-time comparison, take no business action until verification succeeds, and process each event transition at most once.

### 9.2 Ranked session lifecycle

1. **Start:** the server, using the per-user Durable Object for enforcement, issues the token at the moment the clock starts and updates the supersession and abandoned-start counters.
2. **Play:** the client replays locally; nothing is written on the server.
3. **Submit (order matters):**
   a. Verify the signature in constant time. Then look up `scores` by session id before any other check. If a row exists, an identical payload returns the stored result and a different payload is rejected and logged. This holds regardless of expiry, ban, or supersession, so a retry after a lost response still gets the result that was accepted.
   b. For a first submission, check the expiry, then call the per-user Durable Object to `claim(session_id, payload_hash)`. The Durable Object is single-threaded and decides the race: it rejects the claim if the token is no longer the latest for that user and puzzle type, or if the user is banned. Otherwise it records the claim as `submitting` in its storage. A recorded claim cannot be superseded later, and a start that arrives after it does not invalidate it. A start that arrives before the claim makes the claim fail.
   c. Replay and score the moves, then insert the `scores` row with its payload hash. The UNIQUE `session_id` is the final guard: a unique violation means a concurrent claim already committed, so re-read that row and apply rule (a). A D1 batch is all-or-nothing but cannot branch on an earlier statement's result, so the ordering comes from the Durable Object in step b, not from the batch.
   d. Mark the claim `committed` in the Durable Object. If the Worker dies between (b) and (d), a retry with the same payload hash resumes the same claim, even after expiry, because the claim was recorded before expiry. A retry with no claim and no row after expiry is a first submission after expiry (step 6).
4. **Retries:** an identical retry (same session id and payload hash) returns the stored result, even after the token has expired or been superseded. A different payload for the same session, whether stored or still claimed, is rejected and logged. A retry after a lost response never double counts.
5. **Guests:** a guest may submit immediately. Claiming the result for an account is a separate ownership operation with its own checks (the guest cookie, the session id, and a time limit), never a re-submission.
6. **Expiry:** the play token's expiry and the login session's expiry are independent. A first submission that arrives after the play token expired is kept only as a local, unranked result. A claim recorded before expiry completes even if scoring finishes after it (step 3b).
7. **Late or queued results:** results queued offline that arrive after expiry are unranked history.
8. **Bots:** replay proves the moves were legal, not that a human made them, and a client that holds the whole deterministic board can automate a legal solution. Mitigations are Turnstile, timing and anomaly flags, caps, review tools, and leaderboards without prizes. Where fairness needs hidden information (for example ranked Memory), the server may hold a secret that is revealed only through moves. Treat that as a per-puzzle ranked design choice, not a default.

### 9.3 Threat model and protections

| Threat                                            | Protection                                                                                                                                                               | Phase           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Score tampering, fake results                     | Server replay, signed single-use tokens, payload hash, UNIQUE session id                                                                                                 | 3A              |
| Replayed or stolen play token                     | Short expiry, user or guest binding, supersession, UNIQUE session id, no secrets inside the token                                                                        | 3A              |
| Seed shopping                                     | Start caps, abandoned-start counting, one active token per type, no early ranked seed reveal                                                                             | 3A              |
| Bots and automation                               | Turnstile on signup, start, and submit; timing and anomaly flags; caps; review tools; Cloudflare WAF and bot rules (check which your plan includes)                      | 3A              |
| Request floods and DDoS                           | Cloudflare's network and managed WAF rules, rate-limiting rules, payload and move caps, a replay CPU cap                                                                 | 2 to 3A         |
| Account takeover, credential stuffing             | Rate limits and lockout, a breached-password check if Better Auth supports it (verify), optional player 2FA, uniform responses (no user enumeration), email verification | 3A              |
| Session hijacking and fixation                    | `HttpOnly`, `Secure`, and `SameSite` cookies; rotate sessions on login and privilege change; revoke all sessions on password change; no tokens in URLs or logs           | 3A              |
| CSRF                                              | `SameSite` cookies, CSRF tokens or custom-header checks on state-changing routes, strict Origin checks                                                                   | 3A              |
| XSS and injection                                 | Strict CSP, output escaping, schema validation, parameterized queries, username normalization                                                                            | 2 to 3A         |
| Clickjacking                                      | `frame-ancestors 'none'` in the CSP (and `X-Frame-Options`)                                                                                                              | 2               |
| Open redirects, OAuth abuse                       | Allow-listed redirect URLs with exact matching, OAuth `state` and PKCE                                                                                                   | 3A              |
| Password reset and email abuse                    | Single-use short-lived tokens, rate limits, identical responses, SPF, DKIM, and DMARC                                                                                    | 3A              |
| Admin takeover                                    | 2FA, Cloudflare Access or an IP allowlist, RBAC, audit log, re-authentication for sensitive actions, impersonation disabled                                              | CLI 3B, panel 7 |
| Webhook forgery, payment fraud                    | Signature verification, API confirmation, the payment state machine, exactly-once grants, separate sandbox and live keys                                                 | 4               |
| WebSocket hijacking (multiplayer)                 | Authenticate on connect, check Origin, authorize per room, validate messages, cap size and rate                                                                          | 5               |
| Cache poisoning, host header abuse                | Careful cache keys, ignore untrusted headers, correct `Vary`, no personalized HTML cached publicly                                                                       | 2 to 3A         |
| Supply chain                                      | Lockfile, pinned versions, audit in CI, review new dependencies, avoid install scripts where possible, no secrets in CI logs                                             | 0 onward        |
| Secrets exposure                                  | Worker secrets only, a rotation plan, no secrets in client bundles or logs                                                                                               | 0 onward        |
| Domain, DNS, and certificate hijack               | Registrar lock, 2FA on the registrar and Cloudflare, DNSSEC if the TLD supports it (check), expiry alerts                                                                | 2               |
| Scraping and abuse of leaderboards or share links | Pagination caps, caching, rate limits, `noindex`, no personal data                                                                                                       | 3A              |
| Analytics poisoning and endpoint spam             | Schema validation, rate limits, size caps, sampling-aware reports, bot filtering                                                                                         | 2 to 3B         |
| Data exposure and privacy                         | Minimal data, a deletion flow, no personal data in events or logs, a backup retention policy                                                                             | 3B              |

**Security tests per phase:** a short checklist drawn from OWASP ASVS level 1 for the features in that phase; header and cookie checks in CI against the preview; the dependency audit; optionally an automated scan of staging (for example the OWASP ZAP baseline); and manual abuse drills (replay a token, tamper a payload, race a double submit, brute-force a login, forge a webhook). Cloudflare feature availability depends on the plan, so check what your plan includes before relying on any of it. Write a minimal incident runbook (`docs/RUNBOOK.md`: where the logs are, how to revoke all sessions, rotate secrets, and disable features with kill switches) before public launch.

## 10. Config policy ("no hard-coding", with a boundary)

- **Config (editable, stored in D1, cached in KV):** difficulty curves, puzzle weights, enabled puzzle types and modifiers, scoring weights, XP values, prices and plans, feature flags, daily-puzzle schedule.
- **Code (not configurable):** puzzle rules, generators, validation, scoring logic, security checks (payment signature verification, auth).
- Every config key has a typed schema and a safe default in code, so a missing or invalid value never breaks the app.
- Do not build a rules-scripting system.
- **Staged by phase:** until Phase 3, recipes, styles, difficulty bands, and weights live as typed JSON files in the repo (versioned in git, with a `theme_config_version` constant). The D1-backed config table and admin editing arrive in Phase 3 and later, with the same schema. The first-impression puzzle choice is one of those repo values until Phase 3.
- **Selector config** (section 11.14): per-family weights and enabled flags, the minimum gap, the discovery boost, featured families, the first-impression family, and the default rotation mode. User settings override within the limits the config allows.

## 11. Frontend and polish guidelines

- Svelte + SVG/CSS. Animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.
- Themes are sets of CSS variables (colors, fonts, backgrounds), derived from the seed where appropriate.
- Sound: Web Audio only, user-gesture-gated, mute toggle persisted. Simple effects are synthesized to avoid asset files.
- Win effects are hand-written SVG and CSS (the confetti burst in section 11.9). Adding any library needs owner approval and a dependency review (section 9.1).
- Lazy-load each puzzle component and the physics module.
- The Home screen is the no-scroll landing page with one primary action, the Play button (section 11.1). A puzzle picker, if it is added later, lives in Settings and never on Home.

### 11.1 UI/UX spec (game-first, full-screen, minimal chrome)

Goal: the puzzle is the interface. The game fills the screen and everything else stays out of the way.

**Screen and layout**

- The play screen fills the viewport (`100dvh`/`100dvw`), with no page scroll and no header or footer during play. Use `viewport-fit=cover` and `env(safe-area-inset-*)` so content avoids notches and system bars.
- Disable accidental browser behavior on the play surface: `touch-action: none`, `overscroll-behavior: none` (no pull-to-refresh), no text selection, no long-press callout, no double-tap zoom.
- The puzzle is centered and scaled to the largest size that fits while keeping its aspect ratio. It must work in portrait (mobile-first), landscape, tablet, and desktop. On large desktop screens do not stretch the puzzle: center it over an ambient themed background.
- **True fullscreen:** use the Fullscreen API where supported and show a fullscreen button only when `document.fullscreenEnabled` is true. Do not depend on it. Research found it has not been available on iPhone Safari (it works on iPad and desktop), and iOS PWAs with `display: fullscreen` have had bugs; verify the current state before building. The baseline is "the game fills the viewport"; for a more app-like feel offer PWA install (manifest with `display: standalone`) and an "Add to Home Screen" hint after the second session.

**Mobile first, desktop adapted**

- Design and build phone portrait first. The demo's 390 by 844 screens are the master layout, and the phone layout is never a shrunk desktop layout.
- **Use the space on larger screens.** The first local build showed a mobile-sized board centered on a 1440x900 screen, which looks unfinished. The stage scales with the viewport: each puzzle declares a maximum stage size per layout profile (compact, medium, expanded; default width thresholds of 600 and 1024 CSS px, combined with orientation), and on expanded screens the board should use most of the available height (target: at least about 60 percent of the shorter side of the available stage, up to the puzzle's maximum). Extra width goes to puzzle-specific side information (for example score, progress, and a next-up tray) and, on the landing page, to content, never to decoration. A soft panel behind the puzzle is fine.
- **Detect size and capability, not the browser.** Layout comes from the viewport and container size (`ResizeObserver`, media queries, and CSS container queries, which are Baseline widely available) and from capability checks (pointer type, hover, reduced motion). Do not parse the User-Agent for layout: Chrome and other engines froze or reduced the string, so it cannot be relied on for the device model or OS version, and feature detection is the recommended replacement. The User-Agent or Client Hints may be used only for coarse analytics buckets.
- **One puzzle, several layout profiles, not several puzzle versions.** The logic, the seed, the share link, the resume checkpoint, and the leaderboard are identical on every device, so a player can start on a phone and continue on a desktop. Each puzzle's view implements the layout profiles (with different arrangements, sizes, and side panels), selected by viewport. Build the profiles into the first puzzles now, because adding them later is painful.
- Desktop chrome stays minimal: menu top-left, sound and fullscreen top-right (show the fullscreen button because the API works on desktop browsers). Side columns are allowed only as quiet content on expanded screens, following the page template in section 11.16; there are no ads in v1. The result card stays centered and the same size. These controls anchor to the viewport corners (on phones, the safe-area corners), outside the stage, and **never inside the puzzle container**; a menu icon inside the container looks unfinished.
- Landscape phones and tablets: each puzzle declares its layout when width is greater than height (for example, block puzzle: board left, piece tray right; memory: re-flow the grid to fit the height). Rotating or resizing mid-round never loses state.
- Input: mouse hover, focus rings, and pointer-event drag; keyboard shortcuts on desktop only (Esc menu, M sound, F fullscreen, Enter/Space for the primary action such as Play or Next), with small unobtrusive key hints that are hidden on touch devices.
- Non-game pages (leaderboard, profile, settings, admin) may use wider layouts such as two columns and tables on desktop, but stay simple.
- Support browser zoom up to 200% without clipped controls.
- Test matrix: iPhone Safari, Android Chrome, one tablet, and desktop Chrome and Firefox (Safari if possible) at common window sizes.
- **Supported browsers:** record the matrix in `docs/DECISIONS.md` in Phase 0. A sensible start is the last two major versions of Chrome, Edge, Firefox, and Safari, plus iOS and iPadOS 16 and later. The owner decides.

**Screens (keep the set small)**

1. **Home (the landing page, at `/`):** a no-scroll screen on every size. A single `<h1>` and the page `<title>` carry the same primary phrase (for example "Morphi: a new puzzle every time"). The animated Play button sits in the center. **Wide screens (1024 px and up):** quiet text content on the left and right (three short "how it works" points on one side; the puzzle families and the latest announcement, as real text and links, on the other). **Medium screens:** one compact content row. **Phones:** h1, tagline, Play, and one row of links only, with no side columns. If a very small viewport cannot fit the content, the page scrolls instead of clipping it. Corner icons (menu, sound) stay tiny. No category picker, banners, cards, or tutorial. Play starts the game at `/play` with the prepared puzzle. This replaces the first run's single-button Home; the owner approves a new Home wireframe in all three sizes.
2. **In-game:** puzzle plus a minimal HUD: score and time or moves as small, low-contrast text near a corner, and one menu icon. On expanded screens the puzzle page follows the template in section 11.16. Nothing else. Optionally let the HUD fade while the player is interacting.
3. **Result:** an overlay card over the dimmed puzzle: score, previous best, "new best"/"so close" message, one large **Next puzzle** button, and small secondary actions (Home, Share). Preload the next puzzle while this is showing so Next is instant.
4. **Menu:** a slide-in panel opened from the corner icon: Resume, Restart, How to play, Sound, Settings, Leaderboard, Profile, Account. Leaderboard, profile, settings, and auth are separate routes reached from the menu or home, never shown during play.
5. **Admin:** a separate route and design, not part of the game UI.

**Interaction**

- Touch targets at least 44 by 44 px. Put primary actions in the lower half of the screen for one-handed use. Support touch, mouse, and keyboard where it makes sense. No hover-only controls.
- Never interrupt play: no modals, popups, or overlays during a round, and no ads in v1. A signup prompt appears only on the result screen, is dismissible, and never blocks Next. Any consent notice is a single small bar shown once. Exceptions: the non-blocking coach marks (see the tutorial rule) and drawers the player opens themselves.
- **No tutorial walls, but guided help where a puzzle needs it.** Each puzzle declares a tutorial depth in its manifest: `hint` (a one-line hint that disappears on the first move; Memory), `coach` (a few in-context coach marks that point at the real controls, for example select a piece, place it, clear a line; Block placement), or `guided` (an easy first round with step-by-step prompts, for complex puzzles). Coaching is shown once per puzzle family per device, never blocks Play, is skippable, is replayable from the menu (How to play), is localized, works with a screen reader and reduced motion, and is measured (`tutorial` events).
- **Pause rule:** when the tab is hidden, solo puzzles pause. For **ranked** timed puzzles the server clock is authoritative (section 9), so pausing does not stop it: opening the menu in a ranked round keeps the clock running and no free pause is offered. Show a small "ranked" indicator so players know.
- Errors and offline: a small, non-blocking indicator; ranked mode falls back to solo play with a clear message.

**Visual design**

- **Design direction (avoid the generic AI-app look).** The owner approved the current demo (light theme) as the visual reference. Chrome stays neutral, and color lives in the puzzle theme. Type is big and confident (a large wordmark and score numerals, with a strong type scale). The tiles, cards, and symbols are the art. Copy is real and specific. These rules are guardrails against the usual AI defaults: heavy gradients, neon glows, glassmorphism, emoji icons, random decorative blobs, and everything rounded and bouncing. **Anti-slop checklist for acceptance (any failure is a bug):** 1) no gradients anywhere: flat fills only, with no gradient text, gradient buttons, or shimmer skeletons; 2) no neon or colored glows and no glassmorphism or blur-heavy panels; 3) no shadows, bevels, inner shadows, or hard offset shadows on game objects (tiles, cards, pieces, buttons), because they read as dated; show elevation with borders, contrast, or color, and allow at most one soft shadow on floating overlays (menu, result card) or none; 4) at most one accent color in the app chrome; 5) decoration is allowed only as a quiet backdrop that follows the rules in section 11.2 (faint, flat, behind the puzzle, non-interactive); 6) pills only for short status tags, one-line hints, and interactive controls, never as containers for paragraphs; 7) icons are inline SVG from one consistent set, never emoji; 8) fonts only from the typography spec (section 11.8); 9) motion follows section 11.9; 10) copy is short and specific, with no filler marketing phrases; 11) every element is part of the game or necessary navigation; 12) chrome controls (menu, sound, fullscreen) anchor to the viewport corners and never sit inside the puzzle container. The approved demo boards are not a source for these rules: the Play button's coloured glow, the shadows on tiles and the result card, and the memory tile's inset shadow break checklist items 2 and 3, so they are not carried into the build.
- **Light theme first, dark second.** Build and polish the light theme only. Never hard-code colors in components: every color, radius, and shadow comes from CSS variable tokens, so the dark theme later is just a second set of token values (planned after Phase 2 is accepted, not before). Respect the user's choice, and default to light.
- **Two layers of theme:** (1) the **app theme** (light/dark UI tokens: backgrounds, text, buttons, menus); (2) the **puzzle theme** (seed-derived: tile palette, symbol set, background decoration, tile shapes). The puzzle theme draws from a curated palette that must stay readable on both app themes and keep tiles distinguishable by shape or pattern as well as color.
- **Game graphics are code, not image files:** tiles, cards, symbols, backgrounds, and pieces are inline SVG and CSS (see the UI demo for the style: rounded tiles, flat bright colors, no shadows on game objects, simple geometric symbols). Bitmap art is optional and only for later themes.
- **Colors:** see section 11.1a (locked v1 tokens, verified contrast ratios, and color-blind rules). Tokens in section 11.1a win over any hex code seen in the demo.
- At most two font families (self-hosted, with a system-font fallback); icons as inline SVG.
- Per-puzzle theming (backgrounds, palettes) is derived from the seed within the design tokens, never at the cost of contrast or readability.
- Use logical CSS properties (inline-start/end) so right-to-left languages can be added later. No translations yet (the message catalog and library are built in Phase 1A), and keep user-facing strings in one place.

**Performance targets (to be measured, not assumed)**

- The Home screen with its Play button appears first; puzzle code (and later the physics module) loads lazily in the background. Aim for a fast first interaction on a mid-range phone over a mobile connection. Record real numbers in `docs/DECISIONS.md`.
- Keep animations to `transform` and `opacity`; target smooth frame rates on mid-range phones.

**Accessibility**

- Honor `prefers-reduced-motion`. Never rely on color alone (use shapes, patterns, or labels as well). Maintain readable contrast. Give every control an accessible name. Respect text scaling where text is shown. Sound effects start only after the first tap, with an obvious mute control; music stays off. Target WCAG 2.2 AA for all non-game UI (menus, forms, admin). Overlays (menu, result card) trap and restore focus, results are announced to screen readers with `aria-live`, and everything outside the puzzle is keyboard operable. Puzzles are keyboard playable where it makes sense (section 11.11).

**Wireframes first:** before building the first screen set (Home, in-game, Result, Menu, and the small Settings route), produce simple low-fidelity wireframes of every screen in all three sizes (phone portrait 390x844, phone landscape 844x390, and desktop 1280x800) and get the owner's approval. Each new puzzle also gets a gameplay wireframe in the same three sizes (showing its stage mode and side columns) before it is built. Later variations of approved screens do not need new wireframes; review a screenshot after implementation instead. Wireframes may be rough, but the built UI must pass the full anti-slop checklist.

### 11.1a Color system (v1, locked)

Status: the owner accepted the demo's light-theme direction. This section locks the actual token set after a contrast and color-blindness check (WCAG contrast ratios; color-vision-deficiency simulation with the Machado 2009 matrices at full severity (1.0) for protanopia, deuteranopia, and tritanopia). A published implementation switches to Viénot 1999 for full protanopia and deuteranopia, so record which model the check uses in `docs/DECISIONS.md`. The owner may change any value, but changes must pass the checks below.

**App chrome tokens (light theme)**

| Token                               | Value                                                | Notes                                                                                                  |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--bg`                              | `#F5F8FC`                                            | page ground; ink on it is 14.6:1                                                                       |
| `--surface`                         | `#FFFFFF`                                            | cards, overlays                                                                                        |
| `--surface-2`                       | `#EEF3FC`                                            | subtle fills                                                                                           |
| `--border`                          | `#E2E8F0`                                            | decorative only (1.2:1), never the sole cue for a control                                              |
| `--border-strong`                   | `#7A889E`                                            | inputs and outlined controls (3.6:1 on white)                                                          |
| `--ink`                             | `#1B2433`                                            | primary text                                                                                           |
| `--ink-2`                           | `#3B475C`                                            | secondary text (8.8:1 on `--bg`)                                                                       |
| `--muted`                           | `#5A667B`                                            | tertiary text (5.4:1 on `--bg`, 5.8:1 on white)                                                        |
| `--primary`                         | `#E5532D`                                            | **large CTA only**: white text on it is 3.75:1, so label text must be at least 24 px, or 18.66 px bold |
| `--primary-strong`                  | `#C9441F`                                            | primary for any smaller text or controls (white text 4.85:1)                                           |
| `--accent`                          | `#2F6FED`                                            | links, focus ring, secondary actions (white text 4.55:1)                                               |
| `--success`                         | `#0E7C6E`                                            | success states (white text 5.09:1)                                                                     |
| `--warning-fill` / `--warning-text` | `#F5A524` with `--ink` text / `#8A5A00` on `#FFF1D6` | 7.6:1 and 5.3:1                                                                                        |
| `--danger`                          | `#B42318`                                            | errors and destructive actions (white text 6.6:1)                                                      |
| `--focus`                           | 3 px `--accent` ring, 2 px offset                    | visible on every interactive element                                                                   |
| `--scrim`                           | `rgba(27,36,51,.35)`                                 | behind overlays                                                                                        |

Hover and pressed states are derived from the base token (about 6 percent and 12 percent darker), defined once as tokens, not ad hoc per component. Disabled controls use `--border` fill with `--muted` text. The dark theme (later) is a separate token set and is not designed yet.

**Thresholds (every palette and component must pass)**

- Normal text at least 4.5:1; large text (24 px, or 18.66 px bold) and UI components at least 3:1.
- Symbols and graphics on a card face at least 3:1 against the card (white).
- Card or tile back versus the theme background at least 1.5:1, plus a visible edge (a border or a contrast step), never a shadow.
- **Color-blind rule:** for the colors in use together in one puzzle, the minimum color difference (CIE76 in Lab) across normal vision and all three simulations is at least 20. If a palette fails, change the colors; shapes and patterns are an extra cue, never an exemption. Never rely on color alone.
- A script (`scripts/check-palettes`) runs these checks in tests, so a failing palette fails the build.

**Preset palettes (verified anchors and fallbacks).** Most rounds use palettes generated from recipes (section 11.2). These presets are known-good anchors that define the target taste, and they are the fallback when a generated palette fails the checks.

| Palette | Background                                                                      | Back      | Symbol colors (on white)                                                                                                                |
| ------- | ------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Shapes  | `#E8F0FC`                                                                       | `#A9BCDD` | teal `#009A86` (3.52), violet `#7D61AE` (5.01), brown `#7C4100` (8.04), navy `#003041` (14.01); minimum color-blind difference about 35 |
| Ocean   | `#DFF1F8`                                                                       | `#5BB5D5` | drop `#1F78B4` (4.77), fish `#C27400` (3.63)                                                                                            |
| Garden  | `#E6F4E1`                                                                       | `#6FBF73` | leaf `#2E8B57` (4.25), mushroom cap `#B45309` (5.02); color-blind difference about 26                                                   |
| Candy   | `#FDE8F2`                                                                       | `#F27AAE` | heart `#D6336C` (4.62), star `#C27400` (3.63)                                                                                           |
| more    | add presets later when the review sheet shows generated favorites worth keeping |           |                                                                                                                                         |

**Findings from the check that changed the demo's values**

- The demo's amber (`#F5A524`) on a white card is only 2.0:1, so amber symbols use `#C27400`. Amber remains fine as a tile fill with `--ink` text.
- The demo's teal symbol (`#12A594`) is 3.07:1, so symbols used `#0E8F80`; superseded, the Shapes preset now uses `#009A86`, see the table above.
- **Blue (`#2F6FED`) and violet (`#8B5CF6`) are nearly indistinguishable under red-green color blindness** (difference about 5), so violet is not used in a puzzle together with blue.
- **Correction (found during the first local build):** an earlier version of this table claimed the Shapes preset passed the difference-of-20 check. That was measured with the lighter amber (`#F5A524`) and not re-measured after amber was darkened to `#C27400` for contrast, and the darker amber against coral (`#E5532D`) is only about 7.7 under the Machado simulation. The owner chose to **replace the colors** and keep the threshold of 20 (the Shapes symbols above, approved on 2026-10-14). A recheck of the other presets found the same flaw in Garden (coral mushroom cap versus the green leaf, about 16.5), fixed with `#B45309`. Ocean (about 81) and Candy (about 32) pass.
- **Rule:** never relax the threshold to rescue a preset, and never treat shape differences as a reason to lower it. Shapes are an extra safety, not a substitute. Replace the colors instead. `scripts/check-palettes` must read this preset table directly, so a documented palette that fails breaks the build.
- The Shapes card back (`#C9D8EE`) is only 1.26:1 against its background, so it is darkened to `#A9BCDD`.

### 11.2 Theme variety (every round should feel new)

Each press of Play picks a puzzle type and a theme. Even when the puzzle type repeats, the theme is different enough that it does not feel like the same puzzle in the same skin.

- A theme is a cosmetic **skin**: a deterministic function of the seed, a function of the seed, the puzzle type, the item counts the puzzle needs (so there are enough symbols), and the `theme_config_version`. It never affects solvability, difficulty, validation, or score, and it is kept out of the puzzle logic's determinism hash so art can change without invalidating stored runs. The one constraint it must respect: a symbol set needs enough distinct symbols for the puzzle (for example at least as many as the pair count).
- **Independent axes**, each picked or generated from the seed within curated recipes: palette (generated from a recipe), symbol set (generated from shape families), tile or card shape (corner style, aspect ratio, border), tile texture or pattern, background pattern, layout (grid topology and orientation where the puzzle allows), motion style, and sound set (pitch scale and timbre). Sizes that change difficulty (grid dimensions, number of items) are **parameters**, not theme, and stay inside the difficulty bands. Phase 1 targets per puzzle: at least 6 recipe records (data, plus the free-sampling mode), a symbol generator with at least 6 shape families, at least 4 style records (data), and at least 5 backdrop generators.
- **Surface shape families (not only colors).** Every puzzle manifest declares its themeable surfaces (tile or card container, board frame, pieces, backdrop) and which axes may vary on each: shape family (rounded rectangle with varying radius, squircle, circle, hexagon, diamond, notched ticket), proportion (aspect ratio), size within the layout, gap, border width, and, where the puzzle supports it, grid topology (square, offset or brick, hexagonal). This applies to Memory's cards and to Block placement's cells, pieces, and board frame alike. Rules: shape and topology are cosmetic and never change difficulty, rules, or scoring (a different playable board shape is a _variant_, not a theme); every tap target stays at least 44 by 44 px; hit testing matches the visible shape or the bounding box consistently; the symbol stays inside the inscribed area and readable; non-rectangular shapes are tested with the flip animation, because clip paths and 3D transforms can behave differently across browsers; and shape never carries meaning on its own (accessibility).
- **Palettes are generated by curated recipes, then verified.** A recipe fixes the harmony (analogous, complementary, split, triadic, or monochrome plus accent), the lightness steps (colors must also differ in lightness, which helps color-blind players), a chroma cap (no neon), and the background tier. The seed picks a recipe and a base hue and works in OKLCH, then converts to sRGB. Choose each symbol color's lightness by solving for contrast targets against white of about 3.3, 5.5, and 9 for three colors (the first run used 3.5, 5, 8, and 14 for four; the targets are recipe data, tunable by the owner, and the checks stay the pass criteria) (shuffled), with a chroma cap near 0.19; in a prototype this wider lightness spread cut the fallback rate from about 15 percent to about 2 percent, because color-blind separation is mostly a lightness problem. Every generated palette runs through the thresholds in section 11.1a. If it fails, derive the next candidate from the seed (a deterministic re-roll, at most 8 tries), then fall back to a verified preset. Require a safety margin above each threshold so tiny floating-point differences between browsers cannot flip the outcome. Never generate raw random RGB, and never use gradients. For ranked and daily puzzles the server computes the theme once and sends it as data, so everyone sees the same theme.
- **Recipes are data, not code, and not a closed list.** A recipe is a record of parameter ranges (hue offset ranges and jitter, lightness-contrast targets, chroma range, background tier, back tone). Recipes live in the config table (admin-editable, schema-validated; add, disable, or reweight without a deploy), and each theme records its recipe id for analytics. The six named harmonies (analogous, complementary, triadic, split, tetradic, monochrome plus accent) are only starting presets and labels. A free-sampling mode also draws the parameters directly within the global constraints, so variety is continuous. Base hue is always continuous. Shape families are code (small generators with parameters), while recipes and styles are data.
- **Randomness is not quality.** A random draw can look acceptable by luck, so taste is controlled in layers: constraints in the recipes (chroma caps, lightness steps, background tiers), the automated checks, a theme contact sheet that the owner reviews (every rejected pattern becomes a rule or a blocklist entry in config), and analytics per theme and recipe (replay after the round, abandonment) so weak recipes are pruned by data. The target is never ugly by constraint and often delightful by curation, not by luck.
- **Theme versioning and logging.** Recipes, styles, and blocklists are data that the owner can edit, so the same seed would give a different theme after an edit. Every change creates a new immutable `theme_config_version`, every round records it, and the generator accepts `(seed, theme_config_version)`, so any past theme can be regenerated for support and analysis (exact with the fixed-point tables; tiny floating-point differences between browsers are cosmetic, and for ranked and daily puzzles the server-sent theme is authoritative). Solo play caches the latest config for offline use and records the cached version. Each round also records coarse theme features (recipe id, style id, backdrop kind, base-hue bucket, symbol families, grid layout) for analytics. The full theme can always be rebuilt from the seed plus the version. Pin a `theme_generator_version` (the algorithm, tables, and families) alongside `theme_config_version`, and persist the resolved theme for share links and support, so a past theme never depends on regenerating with changed code.
- **Symbols are generated from shape families** (polygons with n sides and a corner-rounding parameter, stars, rings, crosses, arcs, petals), combined with fill styles (solid, outline, split, dotted). A symbol set is accepted only if every pair has a different silhouette and passes a minimum shape-difference score at the smallest rendered size.
- **Style families are data records, curated by the owner** (corner radius range, border width range, fill mode, spacing and density), not code. Examples: flat, outlined, two-tone, ink, blocky, soft-rounded. No shadows, bevels, inner shadows, or offset shadows on game objects. All styles share the same interaction behavior.
- **Backdrop decoration (quiet by rule).** Backgrounds may carry decoration generated from the seed as a theme axis (soft blobs, large faint symbol shapes, line patterns, dots, waves). Rules: it sits behind the puzzle only, is flat, non-interactive, and `aria-hidden`; its contrast against the background is at most about 1.3:1; it stays toward margins and corners; at most 3 layers; backdrops are static in v1 (no motion). Tile, symbol, and text contrast thresholds in section 11.1a must hold against the worst-case decoration color behind them. Decoration appears on only some themes, not all, so it does not become a uniform template.
- **Novelty comes from structure, not only hue.** Players notice shape language, layout, density, and rhythm more than a hue shift, so vary those. Procedural does not mean random: readability, solvability, fairness, and accessibility are never varied. Check this with property tests over many seeds and a human review sheet (see the Phase 1 palette task).
- **Freshness rules (history influences seed selection, not theme generation).** The theme stays a pure function of its inputs. To get variety, the puzzle selector (section 11.14) draws up to 8 candidate seeds and accepts the first whose derived theme satisfies the rules; if none does, it accepts the last candidate that passes the accessibility checks (otherwise the verified preset), because readability and playability beat novelty. Freshness is best effort: it is measured and reported, not guaranteed. The rules: within the last 3 rounds, do not reuse the same palette recipe, a base hue within about 60 degrees, the same style family, the same container shape family, or the same symbol shape families, and consecutive themes must differ in hue family and symbol set. Round history lives in IndexedDB for solo play and on the server for ranked sessions. The puzzle logic and the theme use **separate RNG streams** so theme draws can never perturb the board.
- **Readability rules:** every palette must pass contrast checks, and tiles must stay distinguishable by shape or pattern, not only color. Symbols must be easy to tell apart at small sizes. Reduced motion is respected.
- **Fairness:** for ranked and daily seeds everyone gets the same theme. Theme variety must not change difficulty, so leaderboards stay comparable.
- **Honest limit:** a new skin makes the first minutes feel fresh, but players recognize the underlying mechanic after a few rounds. Longer-term freshness needs variation in layers: theme (cosmetic), parameters and modifiers (grid size, pair count, timer, move limit, fog), and puzzle type. Measure this in the replay test.
- The UI demo's "Theme variety" board shows the same memory puzzle in four themes (Shapes, Ocean, Garden, Candy) as a style reference.

### 11.3 SEO and discoverability

A single Play button with no scrolling gives search engines almost nothing to read, so discoverability needs a few deliberate, minimal supporting pages. This is a real tension with the "minimal chrome" goal, resolved as follows:

- **Home is server-rendered and prerendered** at `/` with a real `<title>`, a meta description, one `<h1>` that matches the title's primary phrase, and the side content as real text (semantic `<section>` and `<aside>` elements with `<h2>` headings, internal links to the per-type landing pages, and no hidden text). The landing page is the SEO homepage. The game itself lives at `/play` (`noindex`, because it is stateful and has little text). The no-scroll rule applies to the landing page only; every other page scrolls normally.
- **Per-type pages, one per puzzle family** (for example `/memory`, `/block-puzzle`): playable, indexable pages in Stay mode (section 11.14) that use the puzzle page template (section 11.16): the puzzle in the center and real content in the side columns (how to play, tips, and links to other puzzles). They are entry points for search and sharing, and a Try another puzzle link goes to `/play`. Prerender the content and let the game hydrate in place. Home stays a landing page with one primary action, not a category picker.
- **Seed share pages** exist only for social previews. Seeds are effectively unlimited, so these pages are `noindex`, are not in the sitemap, and are not linked from crawlable pages, to avoid a crawl trap. Start with one static Open Graph image per puzzle type. Share links carry the puzzle type, seed, difficulty, modifiers (including the aspect class), the puzzle engine version, the theme config version, and an optional target score. They open the same puzzle in solo, unranked mode, optionally with a "beat my score" target, and contain no personal data. The result screen's Share button uses the Web Share API where available and falls back to copying the link.
- `sitemap.xml` and `robots.txt`; canonical URLs; `noindex` for admin, auth, profile, and API routes. Public leaderboard pages may be indexable, with filter and pagination variants canonicalized.
- **Google Search Console:** verify the domain via DNS, submit the sitemap, and after launch check indexing, search queries, and the Core Web Vitals report (per locale if translations are added).
- **Performance is part of SEO.** The Largest Contentful Paint element is the heading or Play button; avoid layout shift and lazy-load puzzle code. Measure with Lighthouse and record the results in `docs/DECISIONS.md`. Targets (Google's "good" thresholds): LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1, measured on a mid-range phone.
- Structured data, translations (hreflang), and dynamic OG images are optional and later. Do not expect rich results from structured data.
- Analytics: see section 11.6.

### 11.4 Error handling and fallbacks

Principles: never show a white screen, never lose a finished result, and give every failure (1) a user-visible state, (2) an automatic fallback where possible, and (3) a logged event.

| Failure                                                                                | Required behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Puzzle generation throws or fails its solvability check                                | Retry with derived seeds (bounded, for example 5 attempts) and log it. Then serve a precomputed known-good puzzle for that type. If that also fails, serve the other enabled puzzle type. Only enabled, eligible families are served, so this never bypasses a kill switch; if none is enabled, show the unavailable state (section 11.14)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Puzzle component throws                                                                | Wrap every puzzle component in `<svelte:boundary>` (Svelte 5.3+) with a `failed` snippet: a short message plus Next puzzle and Home buttons, and report via `onerror`. **Verified:** boundaries catch only render and effect errors; errors in event handlers, timers, and async or Worker callbacks are not caught, and server-side render errors reach a boundary only through the `transformError` option of `render` from `svelte/server`, which strips sensitive detail before the client sees it. So the shared puzzle helpers (local in Phase 1, extracted into `puzzle-kit` in Phase 2) wrap every input handler, timer, and callback in a guard that reports the error and switches the boundary to its failed state, with global `error` and `unhandledrejection` handlers as the last resort. The run is abandoned without a score. After two crashes of one type in a session, stop serving that type for the session |
| Route-level errors                                                                     | SvelteKit `+error.svelte` and `handleError` hooks (client and server), logging with a correlation id; friendly 404 and 500 pages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Lazy chunk fails to load (puzzle code, physics)                                        | Retry with backoff (about 2 retries), then offer the other puzzle type or a reload. If a new deploy makes the chunk stale, prompt a reload                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Offline or network down                                                                | Solo play keeps working from IndexedDB. Ranked is unavailable with a clear message. Use fetch timeouts. Submissions go to the `pending` store and retry with exponential backoff; the unique session id makes retries idempotent. Show "Saved locally, will sync"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `POST /api/play/start` fails                                                           | Fall back to solo (local seed, unranked) and say so                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Submission rejected (expired session, oversize, too fast)                              | Neutral message ("This run couldn't be verified"). Keep it in local history as unverified. Do not reveal detection logic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Server errors                                                                          | Structured JSON `{code, message, retryable}`; 429 with `Retry-After`; never leak stack traces; a D1 failure returns a retryable 503                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| IndexedDB blocked, over quota, or migration fails                                      | In-memory fallback and a one-time notice. A failed migration never silently wipes data: keep the old store and reset only settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Web Audio blocked or unsupported                                                       | Stay silent without crashing. Start audio only after a user gesture                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Unsupported browser features (IndexedDB, Pointer Events, `dvh`, Web Audio, Fullscreen) | Feature-detect and degrade gracefully. Record the minimum supported browsers in `docs/DECISIONS.md`. Add a `<noscript>` message with static content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Session expires mid-run                                                                | Do not interrupt play. Ask the user to re-authenticate after the result and claim the run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Payment: webhook delayed or fails                                                      | "Payment pending" state with a refresh option. A signature failure grants nothing and is logged. Webhook processing is idempotent. Never grant an entitlement from a client redirect alone. Admin gets a reconciliation view                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Multiplayer: socket drops                                                              | Auto-reconnect and resume the same room from Durable Object state. If an opponent stays disconnected past a grace period, end per the documented rules. Matchmaking failure offers solo play                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

- **Kill switches:** config flags (cached from D1/KV, with safe defaults in code if config is unreachable) can disable a puzzle type, a modifier, ranked mode, payments, or multiplayer instantly without a redeploy.
- **Observability:** Workers logs with correlation ids, a rate-limited client error-report endpoint (no personal data) or a hosted error service (owner decides), and a health endpoint. Later, an "errors per puzzle type" view in the admin panel.
- **Failure drills** are part of acceptance (see the Phase 1 and Phase 3 criteria).

### 11.5 Prototype references (AI web builders)

The owner prototypes on AI web builders (Google AI Studio, z.ai, arena.ai) before the real build. Treat their output as **reference only**.

- Findings so far: AI Studio produced the best UI, z.ai the best gameplay, and arena.ai mixed results.
- Do not copy their stack, architecture, plans, or "confirmed decisions". These tools substitute their own environment (for example React and Express), which conflicts with section 2.
- Use them for UI reference (layout, spacing, components) and gameplay feel and rules (scoring, piece distributions, timings, animations).
- Any gameplay taken from a prototype must be re-implemented behind the engine contract (`generate`, `validate`, `score`) and pass the engine tests and test vectors. Never import prototype game logic directly.
- Record findings in `docs/PROTOTYPE_NOTES.md`: which prototype, what to keep, what to discard (including tuning numbers), with screenshots or links.
- Timebox prototyping so it does not replace building.

### 11.6 Analytics (learn what players actually want)

Goal: answer a few questions with data instead of guesses. Do people replay? Which puzzle types, themes and modifiers keep them? Where do they quit? What would they pay for?

- **Tools (owner's choice):** Google Search Console for search performance (queries, indexing, sitemap, Core Web Vitals) and Google Analytics 4 for on-site behavior. Keep events anonymous and coarse: a random anonymous id, no personal data (never send emails, usernames, or user ids to GA4), no free text. Add an opt-out toggle in the menu. Where consent is required (for example EU traffic), load GA4 only after consent using Consent Mode, with a small non-blocking consent bar shown once and never over the game. Decide the consent rules with the launch checklist.
- **North-star metric:** replay rate, meaning the share of first-time anonymous ids that clicked Play and started 3 or more rounds within the observation window. This is the same denominator and numerator as the Phase 2 continue or stop gate (section 7), so the report and the gate measure one thing.
- **Funnel:** visit, Play clicked, round started, round completed, Next clicked, 3rd round, signup prompt shown, signup completed, ranked round played, store viewed, purchased.
- **Per puzzle type, theme, modifier, and difficulty:** starts, completion rate, abandonment point, median duration, whether the next round started (replay-after), and how often "new best" and "so close" occur.
- **Retention:** return visits on day 1 and day 7 per anonymous id.
- **Quality:** errors per puzzle type (ties to section 11.4), load timings, and coarse device and browser class.
- **Acquisition:** referrer and UTM parameters only.
- **Revenue:** item views, purchases, conversion, and refunds.

**Event schema** (one schema, used everywhere): `page_view`, `play_clicked`, `round_started {type, difficulty, modifiers, mode: solo|ranked, theme: {recipe_id, style_id, decor_kind, hue_bucket, symbol_families, grid, theme_config_version}}` (never the raw seed, which is a high-cardinality value), `result_viewed {new_best, so_close}`, `round_completed {outcome, score_bucket, duration_ms, moves}`, `round_abandoned {phase}`, `next_clicked`, `signup_prompt {shown|accepted|dismissed}`, `tutorial {shown|skipped|completed}`, `error {code, type}`, `store_viewed`, `purchase {started|completed|failed}`. Keep payloads coarse (buckets, ids, and enums only). Phase 1 logs these locally in the same shape, with no network calls. Phase 2 sends them to GA4 after consent (see Integration). Phase 3 adds the first-party endpoint for theme events.

**Event envelope** (on every event): `event_id` (for de-duplication), `schema_version`, the anonymous id, an analytics `session_id`, a `round_id` that links a round's events (with `resumed` set when a round continues after a resume), `puzzle_type`, `difficulty_band`, `rules_version`, `first_round`, `locale`, and the consent state. Theme is a nested object in the first-party stream and is flattened to a few low-cardinality parameters for GA4. Consent covers the first-party pipeline and the identifier as well as GA4; on withdrawal, stop sending, clear the queue, and delete or rotate the identifier. Rollups are idempotent, weight Analytics Engine rows by their sample interval, and tolerate late events.

**Integration (Phase 2, public v0):** GA4 via `gtag` with Consent Mode, custom events using the schema above, key events (conversions) defined for signup and purchase, and event data retention set to the 14-month maximum (the default for Explorations is 2 months). Verify a Search Console property by DNS and submit the sitemap. Phase 1 logs events locally only. Phase 2 (Part A) sends the schema events to GA4 after consent, with no raw seeds and no personal data, and the local log stays available for debugging. Phase 3 adds the first-party theme-analytics pipeline described below. **Fallback:** if consent friction or ad blockers undercount badly, add a first-party endpoint writing to Workers Analytics Engine, which keeps data for only three months, so roll up daily aggregates into D1. The anonymous id is a first-party cookie set by the server (not only an IndexedDB value), because Safari deletes script-writable storage after 7 days without interaction, which would break retention numbers. In v0, theme features go to GA4 as a handful of low-cardinality custom dimensions (recipe, style, backdrop kind, hue bucket, grid), never raw seeds. **Cookie bootstrap:** matching static assets (prerendered pages) are served by the CDN without invoking the Worker unless `run_worker_first` is set, so prerendered landing pages cannot set the cookie. Either set `run_worker_first` for HTML routes (one Worker invocation per page) or have the page request a tiny endpoint (for example `GET /api/session`) when the cookie is missing; prefer the bootstrap. **Seed leak:** the share route's URL contains the seed and GA4 collects the page URL automatically, so override `page_location` (strip everything after `/s/`) or exclude that route from GA4 page views.

**Theme analytics (first-party, Phase 3).** The owner wants to know which themes have the most playable value. GA4 is a poor fit for this: a standard property allows only 50 event-scoped custom dimensions, and Google treats a dimension as high-cardinality above 500 unique values a day; reports then show an "(other)" row once the underlying table reaches its row limit (Google's support page), so raw seeds and exact theme combinations must never be sent to GA4. Instead, the first-party event endpoint writes theme feature events to Workers Analytics Engine and a daily rollup fills `theme_stats` in D1 (rounds, completions, replays, abandons, and total duration per feature value and puzzle type). The admin panel reads `theme_stats`. Rules for reading it:

- **Measure features, not single themes.** Every exact theme is unique, so aggregate by recipe, style, backdrop kind, hue bucket, symbol family, and grid layout, with sample sizes and confidence intervals. Do not act on a feature value with fewer than about 300 rounds.
- **Define "playable value" carefully.** The primary metric is replay-after rate (the next round started), with completion rate and abandonment as guards. Do not optimize for time spent, which rewards frustration.
- **Treat comparisons as exploratory.** Theme choice is randomized by the generator, which helps, but real traffic still confounds the comparison (device, difficulty, first versus later rounds, traffic source). Compare within the same puzzle type and difficulty band, separate first rounds, show sample sizes and uncertainty, and use the results to prune obviously weak features, not to declare winners.
- **Keep exploring.** A weak feature value gets a lower weight or a blocklist entry in config, and a strong one a higher weight, but never below a floor, because diversity is the product and rare themes may score well only because they are new. Review the effect of each change after a few weeks.
- **No personal data.** Theme logs contain only coarse features and the anonymous id rules from this section.

**Reports:** use GA4 Explorations (funnel and path reports) or Looker Studio, with no custom dashboards at first. Replay rate is computed as defined in the north-star metric above (first-time anonymous ids, 3 or more rounds started in the window), so the GA4 report matches the gate. In Phase 7 add a small analytics page to the admin panel only if GA4 reports prove awkward.

**Experiments:** use config flags to bucket players deterministically by anonymous id (for example the first-impression puzzle, result screen variants, theme packs). Do not draw conclusions from small samples; a few hundred sessions mostly show noise.

### 11.7 Languages (internationalization)

The owner wants multiple languages. Doing the foundation from day one is cheap, and retrofitting it later is painful, so Phase 1 builds the foundation in English only and translations come after Phase 3.

- **Foundation (English only, from Phase 1):** every user-facing string comes from a message catalog (key to text), with no hard-coded strings in components and no text baked into SVG graphics. SvelteKit has no built-in i18n, so pick a library in Phase 0 or 1 (Paraglide JS from the inlang project is the popular option in the SvelteKit ecosystem and can be added via the `sv` CLI; check which package is current). Never keep the active locale in a module-level variable on the server, because it leaks between server-rendered requests. Derive it per request.
- **URLs and SEO:** non-default locales get a path prefix (for example `/ur/...`), each page declares `hreflang` alternates, the sitemap lists each locale, titles and descriptions are translated, and a language switcher lives in the menu. The default comes from `Accept-Language` but the user's choice is saved and wins.
- **Right-to-left (RTL):** set `dir` on `<html>`, use logical CSS properties everywhere, mirror directional icons only where it makes sense, and test every screen in an RTL locale. Decide per puzzle whether the board mirrors (a memory grid can; a placement puzzle's logic should not).
- **Typography:** some scripts need large font files. Subset and lazy-load fonts per locale, set sensible fallbacks, and check font licenses.
- **Formatting:** numbers, dates, and plurals go through `Intl` and ICU plural rules, with no string concatenation. Allow for 30 to 40 percent text expansion in layouts. Decide per locale which digits to show.
- **Content:** puzzle symbols are shapes, so they are language-neutral, which is a big advantage. A **word puzzle is a per-language project** (dictionaries, letter sets, rules), so defer it until the language list is decided.
- **Translation workflow:** machine-translate a draft, then have a native speaker review before shipping. Legal pages (privacy, terms) need professional translation. Keep catalogs in the repo.
- **Analytics:** add a `locale` dimension to events.
- **Rollout:** English first. After Phase 3 the owner picks the first additional language, and each language gets a short QA checklist (layout, RTL if relevant, fonts, SEO tags).

### 11.8 Typography

- **Type carries the identity.** Use big, confident type with few sizes: a large wordmark, large score numerals, and a clear hierarchy.
- **Decision (owner): Nunito.** The owner picked it from the "Font candidates" board in the UI demo (the others were Archivo, Bricolage Grotesque, and Rubik). Record the version and the self-hosted subset in `docs/DECISIONS.md`. Nunito covers Latin, Cyrillic, and Vietnamese but not Arabic script, so other scripts need their own fonts (see below).
- **Rules:** at most two families. Heavy weights (800 to 900) only for the wordmark, score, and headings; 500 to 600 for UI text. Use tabular figures for scores and timers (`font-variant-numeric: tabular-nums`), and verify the chosen font supports them. System fonts are a fallback only, never the intended look.
- **Type scale tokens** (starting point): 13, 15, 16, 20, 28, 40, and a 72 to 96 display size for scores.
- **Loading:** self-host WOFF2 subsets (from the repo or R2) instead of requesting Google Fonts at runtime. This avoids a third-party request, which also sidesteps a privacy concern in some jurisdictions. Preload the primary display font, use `font-display: swap`, and set a size budget for first load that is recorded in `docs/DECISIONS.md`.
- **Licenses:** open fonts only (SIL Open Font License), with the license files kept in the repo.
- **Other scripts (section 11.7):** choose a font per locale and lazy-load it. Two options found for Arabic-script languages: Vazirmatn (OFL since version 27, variable weights 100 to 900, made for Persian and includes Latin glyphs) and Noto Nastaliq Urdu (OFL, a Nastaliq design for Urdu that, per Google Fonts, needs software support for complex text layout shaping and usually needs extra line height). Test numerals, weights, and layout in the real UI before committing.

### 11.9 Motion and animation

- **Principles:** motion explains cause and effect, stays fast, and stays consistent. Animate only `transform` and `opacity`. Never block input because an animation is running; the puzzle's state machine may still lock input for logical reasons (for example during the mismatch delay), independent of animation completion. No decorative loops. The one exception is the puzzle arrival (below), which holds input for at most 600 ms as an explicit logical state.
- **Tokens (CSS variables):** durations `--dur-instant` 80 ms, `--dur-fast` 150 ms, `--dur-base` 250 ms, `--dur-slow` 400 ms; easings `--ease-out` and `--ease-in-out`. At most one subtle overshoot, reserved for success moments.
- **Animation catalog (v1):**
  - Play button press: scale to 0.97 for 80 ms.
  - Round start: the puzzle fades and scales in over 250 ms.
  - Memory: flip (3D `rotateY`, about 300 ms); match (small scale pop, then fade to the matched state, 250 ms); mismatch (horizontal shake of 200 ms, flipping back after about 600 ms); win (one confetti burst of at most 1.2 s and at most about 60 pieces).
  - Block placement: pick up (scale 1.05 and a 2 px outline); drop (settle in 80 to 120 ms); invalid drop (return with ease-out in 200 ms); line clear (flash, then shrink in 250 ms); combo (score pop with a short pitch step in the sound); game over (board dims over 300 ms).
  - Score count-up: 300 to 600 ms, skipped under reduced motion.
  - Result card: slides up and fades in over 250 ms.
  - Next puzzle: the arrival and exit protocol below (exit about 150 ms, enter about 250 ms, input held for at most 600 ms). The theme change happens inside this transition, never as a jarring cut.
  - Menu panel: slides in over 250 ms.
- **Reduced motion:** honor `prefers-reduced-motion` and add a menu toggle. Remove movement (flips, shakes, slides, confetti, count-ups). Use opacity fades of 150 ms or less, or instant changes. The game stays fully playable, and sound is unaffected.
- **Performance:** target 60 fps on a mid-range phone and test with 4x CPU throttling. Use `will-change` sparingly, cap particles, and pause animations when the tab is hidden.
- **Anti-slop:** no bounce-everything, no parallax, no endless pulsing or floating loops (one exception: the Home Play button may have a subtle idle animation, such as a soft ring, limited to a few cycles, stopped on hover, focus, or interaction, and removed under reduced motion), no shimmer skeleton gradients, and no hover wiggles.
- **Implementation:** CSS transitions and Svelte transitions first for simple state changes, the Web Animations API for native sequencing, and **anime.js v4 (owner-approved)** for what those make awkward: timelines, staggered effects (for example line-clear waves across a grid), number tweens such as score count-ups, and SVG path effects. anime.js v4 is MIT-licensed, modular, and tree-shakeable, with timeline, stagger, and WAAPI modules (a registry check of the 4.5.0 package, minified and gzipped, measured about 40 KB for the full bundle, about 15 KB for timeline plus stagger, and about 4.7 KB for the WAAPI namespace; the earlier 24.5 KB figure did not reproduce, so import only the modules used and verify the real size in the build). Rules: use it only through one small `motion` wrapper (local to each puzzle in Phase 1, in `puzzle-kit` after Phase 2); lazy-load it inside the puzzle chunks that need it, never in the Home critical path; import it on the client only (not at module top level during server rendering); take durations and easings from the motion tokens; honor reduced motion in the wrapper (movement removed, fades of 150 ms or less, or instant); cancel animations on unmount; animate only `transform` and `opacity`; never let an animation drive game logic (the engine and logic timers decide state, and an animation finishing must not be what advances the game); keep our own pointer-based drag and drop (not anime.js draggable) so input stays deterministic and testable. GSAP and Motion One are not needed.
- **Animation spec per puzzle:** every puzzle's spec lists its animations: trigger, duration token, reduced-motion alternative, and paired sound. Themes may vary the motion style (for example flip versus fade, or a spring versus an ease) as one of the theme axes in section 11.2, within the same tokens and performance budget.
- **Puzzle arrival and exit (shell protocol).** The shell owns a transition protocol so every puzzle gets arrival animations without writing the plumbing. On Next the shell (1) plays the old puzzle's `exit` (default: scale and fade, 150 ms), (2) swaps in the prepared puzzle, (3) plays the new puzzle's `enter` (default: fade and scale, 250 ms; a puzzle may supply its own, for example Memory deals the cards in with a short stagger, and Block placement ripples the board cells in and slides the tray in), and (4) becomes playable at a logical deadline: the state machine enters `playing` when the declared `enter` duration has elapsed on the logic clock, capped at 600 ms. The animation's own completion event never starts input or the clock. An animation still running at the deadline is cut short; this is presentation only. Rules: `enter` and `exit` are presentation only and never part of the logic; they use the `motion` wrapper and the tokens; reduced motion replaces them with a fade; the whole transition stays under about 600 ms; if the next puzzle is not ready, the arrival shows a skeleton, not a spinner; the theme's motion style may vary the default arrival; a resumed round skips the arrival; and tests with a fake clock check that no input is accepted before the arrival deadline and that the deadline holds even when the animation runs late.

### 11.10 Admin panel

Goal: manage Morphi without redeploys or hand-edited SQL, while keeping the "config in data, rules in code" boundary from section 10. The panel is a tool for the owner, not a product, so it is built late, in small stages, and only for real needs.

**Delivery stages**

- **Stage 0 (Phase 3): admin CLI.** Bun scripts using wrangler and D1, all audit-logged: set a config value, toggle a kill switch, list flagged scores, hide or restore a score, ban or unban a user. No UI.
- **Stage 1 (Phase 7, first):** `/admin` with login, role checks, an audit log viewer, kill switches, and a moderation queue (flagged scores, username reports).
- **Stage 2:** config editor. Forms are generated from the typed config schema, so a new config key appears automatically with its validation and default, with change history and one-click rollback.
- **Stage 3:** users (create, edit, delete, search, roles, ban, deletion requests, and each player's full stats) and payments (purchase list, webhook event log, reconcile, manual grant or revoke with a reason).
- **Stage 4:** dashboard (errors per puzzle type, active kill switches, links to the GA4 or Looker Studio reports), a **theme performance page** (aggregates from `theme_stats` by recipe, style, backdrop, hue bucket, symbol family, and grid, with sample sizes, confidence intervals, and weight and blocklist controls), a **seed lookup tool** (enter a seed and theme config version to see the generated theme and replay the puzzle), and an announcement or maintenance banner.
- **Stage 5: content management.** Static pages (terms, privacy policy, announcements, and a blog) with draft, preview, publish, version history, SEO fields (title, description, canonical), localization, scheduled publish and unpublish, sanitized Markdown rendering (no raw HTML or scripts from the editor), prerendering or caching with invalidation on publish, sitemap inclusion, and audit entries.
- **Boundary:** new puzzle **families** are code and need a deploy. Variants, weights, flags, achievements, and pages are data that an admin can create, edit, and delete (with soft delete and audit).
- Do not start a stage until the previous one is in use and there is a real need for the next.

**Configurable (data):** puzzle types enabled and their weights, rotation rules (minimum gap, discovery boost, featured families, the default rotation mode), difficulty curves, modifiers, scoring weights, XP, prices and plans, feature flags and kill switches (ranked mode, payments, multiplayer, individual puzzle types), the daily puzzle schedule, banned words, announcement text, the first-impression puzzle, and A/B bucket sizes. **Not configurable (code):** puzzle rules and generators, validation and scoring logic, security checks, payment signature verification, and the generator code and fixed preset assets (recipe parameter ranges are data and editable in the panel with schema validation; a preset can be enabled or disabled by id, but not edited).

**RBAC (roles and permissions)**

Three fixed roles in v1. Permissions marked * need recent re-authentication.

| Permission                                       | admin | moderator | support |
| ------------------------------------------------ | ----- | --------- | ------- |
| `config:read`                                    | yes   | no        | no      |
| `config:write` *                                 | yes   | no        | no      |
| `flags:toggle` (kill switches) *                 | yes   | no        | no      |
| `score:read`                                     | yes   | yes       | yes     |
| `score:hide` / `score:restore`                   | yes   | yes       | no      |
| `user:read`                                      | yes   | yes       | yes     |
| `user:ban` / `user:unban`                        | yes   | yes       | no      |
| `user:rename`                                    | yes   | yes       | no      |
| `user:delete` *                                  | yes   | no        | no      |
| `user:role-set` *                                | yes   | no        | no      |
| `user:create` / `user:edit` *                    | yes   | no        | no      |
| `stats:read` (a player's stats)                  | yes   | no        | yes     |
| `page:write` (static pages, announcements, blog) | yes   | no        | no      |
| `page:publish` *                                 | yes   | no        | no      |
| `purchase:read`                                  | yes   | no        | yes     |
| `purchase:grant` / `purchase:refund` *           | yes   | no        | no      |
| `announce:write`                                 | yes   | no        | no      |
| `audit:read`                                     | yes   | no        | no      |

A custom-role editor, per-user permission overrides, and temporary elevated access are parked until there is more than one person on the team.

**Security (the part that matters most)**

- **RBAC:** deny by default. Permissions are checked per action (not per page) on the server, using the permission matrix above. Role definitions live in code (versioned, reviewed, and tested), and role assignment lives in the database, changed through the CLI or the admin panel with an audit record. There is no role-editor UI in v1 (parked). The last remaining admin cannot be demoted or deleted. Sensitive permissions (marked in the matrix) need recent re-authentication within about 15 minutes.
- Use Better Auth's admin plugin for the user-management primitives. Verified in its docs: it can create users, set roles, ban and unban with a reason and expiry, list and search users, list and revoke sessions, impersonate users, and remove users. **Disable impersonation at first** (privacy and trust risk). Enable it only with owner approval, with audit logging and a visible banner.
- Require two-factor authentication for every admin account (check the Better Auth two-factor plugin), use short admin sessions, and apply strict rate limits and lockout on `/admin` and `/api/admin`.
- Defense in depth: consider putting `/admin` behind Cloudflare Access or an IP allowlist (check current limits and how it works with your routes). Admin routes are `noindex`, excluded from the sitemap, and never linked from the public site.
- CSRF protection on every state-changing admin request, no admin secrets in the client bundle, and separate staging and production admin.
- **Audit log:** every admin action (who, when, what, before and after values, and a reason) goes into an append-only table. The viewer is read-only, and the panel cannot delete audit rows.
- Destructive actions (delete a user, refund, disable payments) need a confirmation and a reason. Consider a two-person rule if there is ever more than one admin.
- Break-glass: the Stage 0 CLI keeps working if the admin UI is down, and it requires direct Cloudflare credentials.

**Design and UX:** functional, dense, desktop-first, and English-only, using the same tokens, the Nunito font, and the light theme, with no game animations. The anti-slop checklist still applies (no gradients, no glows, no emoji icons). Prefer plain Svelte components over adopting a heavy admin framework unless the owner approves one. Every screen has loading, empty, and error states; tables have search, sort, and pagination; destructive actions use confirm dialogs.

**Testing:** an automated test generated from the permission matrix (for every role and permission, expect allow or deny, including 403 for ordinary players on every admin route, with staff roles allowed only their permitted actions), an audit-log test for each action, config schema validation tests, and a rollback test.

### 11.11 Puzzle catalog and layout contract (many puzzle types)

Morphi may eventually host hundreds of puzzle types (jigsaw, mahjong, tetromino-style, solitaire, word, and more) with very different shapes: some are square, some wide, some tall, some need the full screen, some need landscape, some work in both. This is decided now so the first two puzzles do not lock in a square-only design.

**Family, variant, instance (section 11.14).** A family is code, a variant is data that parameterizes a family, and an instance is a variant plus a seed and a difficulty band. Add new content as variants whenever a family can express it, and write a new family only when the rules differ.

**Puzzle package.** Each puzzle family is a self-contained, lazy-loaded package under `packages/puzzles/<id>/` with `logic/` (the contract implementation; imports only the engine), `view/` (the Svelte renderer; imports `puzzle-kit`), `manifest`, `strings/`, `tests/`, and a README. The registry is generated from the packages, so there is no hand-maintained central list. See the dependency rules in section 5.

**Manifest fields (data):** `id`, `family`, `name key`, `kind` (`solve` | `scored-run` | `realtime`), `timing` (`turn` | `tick`), `orientation` (`portrait` | `landscape` | `both`), `aspect range`, `min viewport` (for example 320 by 480 CSS px), `layout mode` (`contain` | `reflow` | `pan-zoom` | `fill`), `layout profiles` (compact, medium, expanded, each with its maximum stage size), `stage mode` per profile (`centered` | `wide` | `full`), `side panels`, `renderer` (`dom` | `svg` | `canvas2d` | `pixi`), `style profile`, `depth cues` (`flat` | `outlined` | `layered`), `design brief` (its path), `tutorial depth` (`hint` | `coach` | `guided`), `immersive` (true or false), `input` (tap, drag, keyboard, multi-touch), `target session length`, `audio` (needed or optional), `languages` (neutral or a list), `ranked-capable`, `determinism class` (integer-only or physics), `performance class`, `accessibility notes`, and `engine version`.

**Viewport contract.** The host gives each puzzle a **Stage**: width, height, orientation, safe-area insets, pointer type, a reduced-motion flag, and an observable for resize and rotation. The puzzle renders inside the Stage, never overflows it, and re-lays out on resize or rotation without losing state. Every puzzle view implements at least the compact and expanded layout profiles (medium may reuse one), each with its own maximum stage size.

**Layout strategies.** `contain` scales the board uniformly to fit. `reflow` means the view provides different layouts per orientation class. `pan-zoom` is for large boards such as jigsaws (pinch and drag, with a small overview). `fill` gives the puzzle the whole Stage for canvas-style puzzles. **Every puzzle ships at least one layout that is playable on a 360 by 640 portrait phone, or it declares itself landscape-only.**

**Orientation policy.** The selector serves only puzzles compatible with the current viewport class. Portrait-only puzzles on a wide desktop sit in the centered Stage, which is fine. Landscape-only puzzles on a portrait phone are skipped by default, or offered with a rotate hint, never forced. Do not rely on orientation locking: it is not available everywhere (verify current browser support, including iPhone Safari).

**Immersive puzzles.** `immersive: true` hides everything except a minimal HUD and the menu icon, uses the Fullscreen API where it exists (not on iPhone, see section 11.1), and otherwise fills the viewport.

**Logic never depends on the viewport.** Generation, validation, and scoring must not read the screen size, because replays are validated on the server. If a puzzle needs different arrangements for portrait and landscape (for example mahjong layouts), the session records an **aspect class** (portrait or landscape) as a modifier, so generation stays deterministic and the server can replay it. The view maps the same logic to different layouts.

**Real-time puzzles** (falling pieces, timing games) use a fixed-timestep simulation with inputs recorded by tick number, the same approach as the physics puzzle (`simulate(state, inputs_by_tick)`), and need the same cross-engine determinism check.

**Families and the shared kit.** Group puzzles by family (grid, tile-matching, placement, card, word, physics, free-form). A shared `puzzle-kit` package holds what every puzzle needs: Stage fitting, pointer drag-and-drop, move recording, the feedback kit (sound and animation), theme application, an error boundary wrapper, and analytics events. **Do not design the kit in the abstract**: extract it from the first three puzzles (the rule of three).

**Admission checklist for a new puzzle type:** a complete manifest; a design brief (`docs/puzzles/<id>.md`, section 11.16) approved by the owner, including a game-feel review; contract tests (determinism, solvability, validation, variation) plus UI state tests with a fake clock (timers, reveal limits, flip-back delays, rapid taps); layout tests at 360x640, 390x844, 768x1024, 1280x800, and landscape 844x390; keyboard playable where it makes sense; color-blind safe; works with generated themes; string keys for all text; an animation list (trigger, duration token, reduced-motion alternative, paired sound); error boundary and fallback; analytics events; a performance budget (about 60 fps on a mid-range phone); a kill switch and a weight in config; and an entry in `docs/CODEMAP.md`.

**Scale and order.** Do not build hundreds. Add puzzle types by value, each behind a beta flag with its own replay metrics, and keep the weights in config. Reuse inside families makes later puzzles cheaper. The continue/stop gate still applies. Parked: user-created puzzles and a puzzle marketplace.

### 11.12 Puzzle backlog and IP rules

Candidates, not commitments. Orientation: P portrait, L landscape, B both. Effort: S, M, L.

| Puzzle family               | Layout and orientation         | Kind              | Effort | Notes                                                                     |
| --------------------------- | ------------------------------ | ----------------- | ------ | ------------------------------------------------------------------------- |
| Memory (match pairs)        | grid, B                        | solve             | S      | Phase 1                                                                   |
| Block placement             | grid plus tray, P              | scored run        | M      | Phase 1; do not copy any existing game's name or look                     |
| Sliding tiles               | grid, B                        | solve             | S      | generate by legal shuffles from a solved state                            |
| Lights-out and toggle grids | grid, B                        | solve             | S      | solvable by construction                                                  |
| Number merge (2048-like)    | grid, P                        | scored run        | S      |                                                                           |
| Maze and path               | grid, B                        | solve             | S      |                                                                           |
| Flow and pipe connect       | grid, B                        | solve             | M      | draw the paths first, then hide them                                      |
| Nonogram                    | grid, B                        | solve             | M      | needs a uniqueness check                                                  |
| Sudoku-style logic grids    | grid, P                        | solve             | M      | generator plus a solver for uniqueness                                    |
| Match-3 (tile swap)         | grid, P                        | scored run        | M      | cascades must be deterministic                                            |
| Mahjong solitaire           | wide, L with a portrait reflow | solve             | M      | generate solvable layouts by reverse play; uses the aspect-class modifier |
| Card solitaire              | wide, B with two layouts       | solve             | M      | deals must be solvable or labeled luck-based                              |
| Word puzzles                | grid plus keyboard, P          | solve             | M to L | per-language dictionaries; defer until the language list is decided       |
| Falling-block (tetromino)   | tall, P                        | realtime          | L      | tick-based simulation and cross-engine determinism checks                 |
| Jigsaw                      | free-form, pan-zoom, B         | solve             | L      | procedural cut shapes plus original or licensed art                       |
| Physics puzzles             | free-form, B                   | solve or realtime | L      | Rapier, Phase 6                                                           |

**Selection criteria:** replay potential (from analytics), build effort, fit with the shared kit, orientation variety, and IP risk.

**Stage modes (default assumptions):** `centered`: Memory, Block placement, sliding tiles, lights-out, number merge, flow, Sudoku-style grids, match-3, word puzzles, and falling-block. `wide`: Mahjong solitaire, card solitaire, large nonograms, and large mazes. `full`: jigsaw and physics puzzles. Renderers: DOM or SVG for the grid and tile puzzles, and Canvas 2D or PixiJS for jigsaw and any puzzle with hundreds of moving pieces.

**IP rules (not legal advice):** game mechanics are generally not protected the way names, artwork, and distinctive presentation are, but trademarks and trade dress are. Do not use trademarked names (for example Tetris, Wordle, or Candy Crush) and do not copy another game's distinctive look, art, sounds, or text. Name puzzles descriptively and make the look original. If a puzzle is a close clone of a known game, get advice before launch. Generated art and sounds must be original or properly licensed.

### 11.13 Resume, edge cases, and the QA matrix

**Resume (leaving mid-round).** The architecture makes this cheap: a round is a seed plus recorded moves, and the engine is deterministic.

- **Autosave** a checkpoint in IndexedDB after every accepted move and when the page becomes hidden: seed, difficulty, modifiers, `engine_version`, `theme_config_version`, the resolved theme (the actual palette, symbols, and style), moves, pending logical transitions with their remaining active-time deadlines (such as the mismatch delay), active elapsed time, and status. Verified: the `unload` and `beforeunload` events are unreliable (especially on mobile, and `beforeunload` does not fire when a background tab is killed), and the hidden state in `visibilitychange` is the last reliable moment to save. Do not rely on unload events.
- **On return:** if a checkpoint exists and is fresh (about 24 hours; Safari may delete it sooner, see section 8.6), Home shows **Resume** as the primary button with a small **New puzzle** text button. Resume replays the moves through the engine.
- **Time:** solo rounds pause while the page is hidden. Measure active time with a monotonic clock (`performance.now`) and visibility timestamps, never with tick counts, because background timers are throttled.
- **Version mismatch:** the checkpoint stores the resolved theme, so a changed `theme_config_version` does not matter: resume with the stored look. If the puzzle's `engine_version` differs, the moves cannot be replayed safely, so offer a new puzzle and record the round as abandoned.
- **Ranked:** there is no pause (section 9). The server session keeps its clock, and a returning player can continue only within the session's time-to-live. Abandoned sessions count against the seed-shopping cap.
- **Multiple tabs:** only one tab owns the active round, enforced with an atomic lock (the Web Locks API, with a fencing check on every save; a `BroadcastChannel` message alone is not a lock; verify browser support). A second tab shows "This puzzle is open in another tab" with a Take over action. When only the in-memory storage fallback is available, closing the tab cannot preserve the round, and the app says so.
- **Resume tests:** close the tab with one card open, during the mismatch delay, immediately after the final move, and while a result is being written; each must resume or finish consistently.
- **Abandonment** is neutral, but two non-success outcomes in a row (failures, abandonments, or a mix) step the difficulty band down.
- **Scope (v1):** a round resumes only on the device that holds its checkpoint. Cross-device resume of an active round is not in v1, because it would need an account-backed checkpoint with frequent writes (parked in `docs/IDEAS.md`). The cross-device paths in v1 are the share link (solo, unranked) and finished-run history.
- **Retry after a failed round** is a pending owner decision (`docs/IDEAS.md`).

**Edge cases.** `docs/EDGE_CASES.md` is the catalog: page lifecycle, time, input, storage, network, engine, rendering and accessibility, server and auth, payments, multiplayer, anti-cheat, analytics, SEO, internationalization, operations, and gameplay. Every case has an expected behavior and a test (unit, property, Playwright, or a manual drill). Each phase's acceptance names the categories it must cover. The engine gets property tests and fuzzing with random and invalid move sequences and extreme seeds. Add every real bug found in play to the catalog with a regression test.

### 11.14 Puzzle selector and rotation

The first local run exposed a gap: Next served another Memory round with new colors, not a different puzzle. The plan had generation (seed to puzzle) and Instant Next (preparing the next round), but no rule for **what comes next**. This section is that rule.

**Three levels.** A **family** is a puzzle type implemented in code (Memory, Block placement, Sliding tiles, and so on). A **variant** is a data record that parameterizes a family (board topology, rule toggles, size bands, special rules; for example Memory with moving cards). An **instance** is one round: a variant plus a seed and a difficulty band. Rotation happens at the **family** level first, so consecutive rounds feel different; then a variant is picked inside the family; then a seed is drawn. Variety inside a family (colors, shapes, sizes, modifiers) is real but does not count as a different puzzle. This also scales: hundreds of thousands of _variants_ are feasible as data (for example Sudoku or nonogram variants and maze rule sets), while hundreds of thousands of hand-written _families_ are not.

**Where randomness comes from.** For solo play the selector draws a fresh 64-bit seed from a cryptographically secure source (`crypto.getRandomValues`, never `Math.random`). For ranked play the server does the same when it issues a token, and daily seeds are derived by HMAC. After the seed exists, everything else is deterministic (the engine's SplitMix64 streams). The selector lives outside the engine core and takes an **injected RNG**, so tests can seed it and reproduce any sequence.

**Default algorithm (v1): a weighted shuffle bag over eligible families.**

1. Eligible families are enabled in config, compatible with the viewport and orientation class, the language, and the device class, not turned off by a kill switch, and not excluded by the player.
2. Draw families without replacement, with probability proportional to their weights, until the bag is empty, then refill. Every eligible family appears exactly once per completed cycle. Weights therefore shape each family's position within a cycle (a higher weight makes an earlier position more likely), not how often it appears over the long run. A featured boost moves a family earlier in its cycle; it does not make the family appear more often (see the owner decision in `docs/DECISIONS.md`).
3. Never repeat the family just played, and avoid the last K families, where the minimum gap K = clamp(floor(eligible / 3), 1, 5). This also applies across a refill: the first family of a new cycle must differ from the last family played. If only excluded families remain in the bag, swap one of them with an earlier pick of the same cycle, so each family still appears once per cycle. With a single eligible family, repetition is allowed.
4. **Discovery boost:** families the player has never played get a weight multiplier (for example times 2) in their first rounds, so new players see the range quickly.
5. **First round:** a brand-new player gets the configured first-impression family (a repo value until Phase 3, then config).
6. Pick the variant inside the family by weight, avoiding the last variant, and the difficulty band from that family's own progression.
7. Draw the seed, with up to 8 candidates for theme freshness (section 11.2).
8. A failed round does not change the rotation. Try again (same seed) is a separate action (see `docs/IDEAS.md`).

With 2 families and no immediate repeats the sequence strictly alternates, which is acceptable; the seed decides only which family starts. With 50 families a player sees each family once per cycle of 50 rounds, with the weights shaping the order.

**No eligible family.** When every family is disabled, excluded by the player, or ineligible for the viewport, the app shows an unavailable state with Home and Retry actions. No family is served as a fallback, including a default one, so no kill switch is bypassed. Retry re-reads the config.

**Next means the selector's next pick.** Instant Next (section 12.3) asks the selector for round N+1 while round N is played, loads that family's module, and prepares it. If the prepared family fails to load, the selector picks another (bounded retries). Ranked boards have their own rules and may fix the family or ruleset.

**Player settings (Settings route, from Phase 2):** Mix (the default shuffle bag), Stay on this puzzle (same family, new seed and variant), and later Pick a puzzle and Exclude puzzles. Settings override the default within what the admin config allows (for example a beta or ranked-only family can be hidden from Pick).

**Admin config (data, Stage 2):** per-family weights and enabled flags, the minimum gap, the discovery boost, featured families (temporary weight boosts), the first-impression family, beta cohorts, and the default rotation mode. Until the config table exists these are typed JSON files in the repo.

**Scale.** The selector never loads a full catalog. It uses a small family index (id, weight, flags, orientation, chunk URL) and, for the chosen family, a lazily loaded variant pool (a slice served from static assets, KV, or R2 and refreshed periodically). For ranked play the server chooses the variant from the seed. Seed banks (section 12.3) supply verified instances for heavy families.

**Tests:** property tests over many sequences with a seeded RNG (no immediate repeats, including across refills; every eligible family appears exactly once per completed cycle; a heavier family's mean position in the cycle is earlier beyond a stated tolerance while its per-cycle count is unchanged; the gap rule holds, including the forced-swap case; exclusion and kill flags are respected; a single eligible family works; when every family is disabled or excluded, the app shows the unavailable state and serves no family), plus a manual check that 20 Next clicks feel varied.

### 11.15 Difficulty, progression, and achievements

**Decided now.** Difficulty bands per puzzle family (Phase 1A task 13), with per-family progression: the first round is easy, a success steps the band up, and two non-success outcomes in a row step it down. Bands are config data. XP and the account level are cosmetic and config-driven (Phase 3A task 5). Ranked boards use fixed bands. For scored runs (for example block placement), reaching the puzzle's "so close" threshold is a success; an ended run below it is neither a success nor a failure and leaves the band unchanged; abandonment still counts as a non-success.

**Designed now, built later (after the Phase 3 gate).**

- **Mastery levels per family** (for example Bronze to Platinum), derived from stats such as best scores and wins at each band; thresholds are config.
- **Achievements as data:** id, name key, criteria expressed over stats and events, visible or hidden, and rarity. They are awarded server-side from ranked results and from synced solo history, and shown on the profile.
- **Streaks (play-day streaks)** only with anti-dark-pattern rules: no punishing resets, no urgency prompts, and an opt-out.
- **Cosmetic rewards** (themes or avatars) may be unlocked by achievements or bought, and that is decided together with the payments design.
- None of this gives a gameplay or scoring advantage, and no achievement requires spending money.

**Rules.** Definitions are data evaluated by a small engine over stored stats, so a bug can be fixed retroactively by recomputing. Each criterion type has tests. Admins create, edit, and disable achievements as config data (Stage 2).

### 11.16 Page templates, stage modes, and puzzle style

**Game-first.** Morphi is a game site. Each puzzle is designed as a small game: a core loop that is fun within about 30 seconds (an action, immediate feedback, a reward, repeat), a difficulty curve that keeps players in flow (neither bored nor frustrated), clear win and fail states, graphics and sound that answer every input, and a replay hook. General puzzle-design guidance converges on the same points: define the core loop first, build levels from modular components, confirm solvability with a solver or by construction, keep visuals clean with immediate sound feedback, and iterate from playtests. So every puzzle gets a **design brief** before it is built, `docs/puzzles/<id>.md`, approved by the owner. It covers: the core loop and goal; win and fail states; controls on touch, mouse, and keyboard; the difficulty curve and bands; scoring; the layout profiles and stage mode; the style profile; the list of animations and sounds; the tutorial depth; the replay hook; edge cases; the renderer; and an IP check. The first two briefs (Memory and Block placement) are written in Phases 1A and 1B.

**Page templates.**

1. **Landing** (`/`): no scroll, with three columns on wide screens (content, the animated Play button, content), as described in section 11.1.
2. **Puzzle page** (`/play` and the per-type pages): a left column, the stage, and a right column.
3. **Content pages** (Settings, Profile, Leaderboards, Stats, static pages, and the blog): a normal scrolling document with the corner menu and a centered readable column (about 720 px for text). On wide screens it may add section navigation on the left (for Settings, the list of sections) and an aside on the right (table of contents or related links). Phones get a single column. Small footer links (terms, privacy) appear on content pages and on the landing page, never on the puzzle page; Settings also links to the terms, the privacy policy, and feedback, so they are reachable from the game.
4. **Admin:** its own dense layout (section 11.10).
   All templates use the same tokens, type scale, and anti-slop checklist.

**Puzzle page columns.** On expanded screens (default 1280 px and up) the template shows a left and a right column (about 280 to 320 px each) around the stage. From 1024 to 1279 px the right column collapses into a drawer, below 1024 px both become drawers opened by small buttons (for example How to play and Stats), and phones show no columns. Columns hold **quiet content slots** declared in the manifest (`side panels`): candidates are How to play and Tips on the left and Your best, Session stats, and Other puzzles on the right. The owner decides the content per puzzle later. Rules: the content is plain, low-emphasis text and links (no cards, no pills, no ads in v1, nothing animated); it dims while a round is in progress and returns on hover or focus; the stage comes first in reading and tab order, with the columns as `<aside>` landmarks; and column content never changes difficulty or reveals hints unless the puzzle's brief says so.

**Stage modes** (declared per layout profile in the manifest):

- `centered`: small puzzles (Memory, Block placement). The stage is centered between the columns and scales up to its maximum size.
- `wide`: puzzles that need width (Mahjong solitaire, card solitaire). The columns shrink to narrow icon rails whose panels open as drawers, and the stage gets the freed width.
- `full`: puzzles that need the whole screen (jigsaw, physics). Columns are hidden and the stage fills the viewport, with pan and zoom where needed; help and stats move into drawers or a HUD overlay.
  A mode may differ by profile (for example a `wide` puzzle uses `centered` on phones with a portrait reflow). The gameplay wireframes show each puzzle's stage mode in all three sizes.

**Per-puzzle style is allowed, and it is data.** There are three layers. (1) Global tokens, the type scale, motion tokens, and the anti-slop rules are shared, so Morphi feels like one product. (2) Each puzzle has its own **style profile**, in its manifest and package: the shape families and proportions it allows, its layout and topology, its depth cues, motion style, sound palette, backdrop kinds, and typography emphasis. (3) The theme instance is generated from the seed within that profile. Only structure is specific to a puzzle; colors always come from the recipes and the checks.

**Depth cues for layered puzzles.** The no-shadow rule stays for flat puzzles, but layered puzzles (Mahjong, card stacks, jigsaw) need depth to show which piece is on top. They declare `depth cues: layered` and may use flat techniques only: a solid, darker offset side face, outlines, stacking order, and small gaps. Still no blur shadows, gradients, or glows. The exception is approved in that puzzle's wireframe and brief.

**Renderer per puzzle.** The manifest declares `renderer`. Use `dom` or `svg` for grid and tile puzzles (up to a few hundred elements; open-source Mahjong solitaire games generate solvable layouts in TypeScript and render them with DOM and CSS), and `canvas2d` or `pixi` for jigsaw and anything with hundreds of moving pieces (early SVG-plus-canvas-per-piece jigsaw experiments hit performance limits). Heavy renderers load lazily, only inside that puzzle's chunk.

## 12. Local development

- Wrangler local emulation for D1, KV, R2 and Durable Objects (state in `.wrangler/state`).
- SvelteKit dev server with the adapter's emulated Cloudflare bindings. Verified in the adapter-cloudflare 8.0.0 release notes: it requires SvelteKit 3, removes the `cloudflare` platform object in favor of emulating the `cloudflare:workers` module, and renames `platform.context` to `platform.ctx`. Some docs pages still describe `platform.env`, so treat the release notes and the pinned adapter's behavior as the authority. Phase 0 proves a binding read, and Phase 3 starts with a spike (D1 and Better Auth in `vite dev`), with `vite preview` or `wrangler dev` on the built output as the fallback.
- Bun scripts run the test-vector suite and other tooling; Vite runs the dev server. Type-check with `svelte-check` (app) and `tsc --noEmit` (packages); both run inside `bun run verify`.
- Deploy occasionally (per milestone or about daily), and keep a staging environment to catch local/production differences.
- Payments and multiplayer: test on a deployed environment or via a tunnel, not only locally.

### 12.1 Repo layout for AI agents (token efficiency)

Coding agents explore with glob and grep, and noisy results waste tokens. A custom knowledge graph is **not** built at the start (see below). The cheap measures that capture most of the benefit are:

- **Small, single-purpose files** (aim for under about 300 lines), descriptive names, and one clear concept per file. Tests sit next to the code they cover.
- **Public API barrels:** `packages/engine/index.ts` exports the public contract types and the registry interface, and each puzzle package has its own `index.ts`, so an agent can read one file to learn the surface.
- **`docs/CODEMAP.md`:** a short map of each package, its purpose, its key files, and its public API. Create the skeleton in Phase 0 and update it at the end of every phase. Keep it under roughly 150 lines.
- **Search hygiene:** keep `.gitignore` accurate and add an `.ignore` file excluding build output and noise (`.svelte-kit`, `.wrangler`, `dist`, coverage, generated types, lockfiles) so grep and glob return less. Agents should search specific package paths first and never read lockfiles or generated output.
- **Keep `AGENTS.md` short** (it loads every session) and do not load all of this plan every session: read sections 1 to 6, the current phase in section 7, and the sections that phase references.
- **Knowledge graph or code-index tools:** do not build one. Revisit after Phase 2, or earlier if the repo passes roughly 150 to 200 files or agents keep burning tokens on structural questions (who calls this, where is this defined). If so, trial an **existing** tree-sitter-based MCP code-graph server instead of writing your own, and measure tokens per task before and after. Treat vendor token-saving claims as unverified, review any installer before running it (some auto-edit agent settings and add hooks), pin the version, and prefer a project-level configuration. Graph quality degrades on generated code.

### 12.2 Environments, CI/CD, and limits

- **Environments:** local (Wrangler emulation), preview (per pull request), staging, and production. Each has its own D1 database, KV namespaces, R2 buckets, Durable Objects, secrets, and Turnstile keys. Never test against production data.
- **Local-first until Phase 2.** A local git repository is fine. No GitHub repo, Cloudflare account, or deployment (not even a temporary preview) is needed or allowed before Phase 2. Agents must not create accounts, publish code, or deploy.
- **Local device testing.** Test on real phones during local-first work by serving over the local network: run the dev server with `--host` (or `wrangler dev --ip 0.0.0.0`), allow the port through the computer's firewall, and open `http://<computer LAN IP>:<port>` on a phone on the same Wi-Fi. Plain HTTP on a LAN address is not a secure context, so features that need one may not work there: service workers, Web Share, the clipboard API, and the Web Locks API that the single-owner round lock depends on (section 11.13). Phone checks of resume and multi-tab locking therefore need local HTTPS for `vite dev` and `wrangler dev` (for example a mkcert certificate that the phone trusts), or the owner records a waiver for those checks until the Phase 2 preview. Desktop checks on `localhost` are already a secure context. Verify current browser behavior.
- **CI** (GitHub Actions or Cloudflare Workers Builds; choose in Phase 0): on every pull request run `bun run verify`, whose contents are defined in Phase 0 task 9 (lint including the engine banned-functions rule, `svelte-check` and `tsc --noEmit`, unit and engine tests, the test-vector suite on Node and Bun, the production build, the vector check against the built Worker, and the browser tests on Chromium, Firefox, and WebKit). Later phases extend it with the palette check (Phase 1B) and a dependency audit. Any failure fails the build.
- **Deploy:** merging to main deploys to staging automatically. Production needs a manual approval after the staging checks. Keep the previous version available for fast rollback (check how Workers versions and rollbacks work in current docs).
- **Database migrations:** generate them with Drizzle and apply them with Wrangler in CI. Never edit production by hand. Keep migrations backward-compatible for one release (expand, then contract), test each on a copy first, and take a manual export before any destructive migration.
- **Cloudflare limits to design for (verified in the Workers docs; they change, so recheck):** Workers Free allows 10 ms of CPU per request, and Workers Paid allows up to 5 minutes (30 seconds by default). Worker size is now a single 64 MiB uncompressed limit on every plan (the former compressed limits of 3 MB and 10 MB were removed), startup time is 1 second, and each isolate has a 128 MB memory limit on every plan (official limits page, updated October 12, 2026). So bundle size is no longer a reason to pay. The reasons are the Free plan's 10 ms CPU for ranked replays, D1 and Durable Object headroom, and request volume. Public v0 can run on Free. **From Phase 3, assume Workers Paid.** In Phase 3, measure the bundle size and the validation CPU time, cap the moves per puzzle type, and if validation is heavy, move it into a dedicated Worker or a Durable Object. Durable Objects with the SQLite storage backend are available on the Free plan. Check current pricing before relying on any of this.
- **Hosting adapter:** use `@sveltejs/adapter-cloudflare` (it targets both Workers Static Assets and Pages; `adapter-cloudflare-workers` is deprecated). Durable Object classes must be exported from a Worker, so the approach decided in Phase 3A applies (a separate Worker bound from the app, the default, or a community exporter plugin for SvelteKit; Phase 3A task 8), recorded in `docs/DECISIONS.md`.
- **Node compatibility:** Better Auth uses `AsyncLocalStorage`, so enable `nodejs_compat` (or `nodejs_als`) in the Wrangler config. For compatibility dates of 2026-08-04 or later Workers enable it by default, so set a current compatibility date and record the date and flags in `docs/DECISIONS.md`.
- **Feature flags** for unfinished work live in config (section 10) with safe defaults.

### 12.3 Performance, loading, and capacity

**Capacity: do 100 concurrent players cause problems?** Probably not (an estimate from the assumptions below, not a measurement; the load test decides). Puzzles are generated on the player's device and the pages are static assets, so most of the load never reaches a server. The server sees only ranked sessions: about two Worker requests per ranked round (start and submit) plus cached leaderboard reads. Worked example (assumptions, not measurements): 100 players each finishing a round a minute is about 1.7 rounds a second, so roughly 3 to 4 Worker requests and a handful of D1 queries per second. Verified in the Cloudflare docs: a D1 database is single-threaded and runs queries one at a time, so about 1,000 queries per second if the average query takes 1 ms, and about 10 per second at 100 ms. Workers Paid costs $5 a month and includes 10 million requests and 30 million CPU milliseconds, then $0.30 per extra million requests and $0.02 per extra million CPU milliseconds; on the paid plan D1 includes 25 billion rows read and 50 million rows written a month, with extra writes at $1 per million. One million ranked rounds a month is about 2 million Worker requests, inside the included allowance. **What probably breaks first (an estimate)** at thousands of concurrent ranked players is D1 write throughput and rows-written cost (index writes can multiply rows written; check). Mitigations, in order: cache leaderboard reads (KV or the Cache API), batch writes, keep hot counters in Durable Objects, roll up with Cron Triggers, and shard into several smaller D1 databases. Load-test before launch (Phase 3 task 8).

**Loading strategy.** Invert the idea of loading the rest of the site after Play: the Play click is the moment of maximum impatience, so the work must already be done before it.

1. **Critical path:** HTML, CSS, a tiny script, the self-hosted font subset, and the Home screen with the Play button. Starting target: under about 150 KB transferred (measure and record).
2. **After first paint, in idle time:** preload the engine, the shell, and the **pre-chosen first puzzle**. Choose the first puzzle type and seed when the page loads so that exactly that puzzle can be preloaded and even pre-generated. When Play is clicked, the puzzle appears at once.
3. **Secondary routes** (menu, Settings, leaderboard, profile) use SvelteKit's built-in preloading, which gives Astro-style near-instant navigation. Verified in the SvelteKit docs: `data-sveltekit-preload-data` starts on hover (touchstart on mobile) or on tap, `data-sveltekit-preload-code` preloads only the code (`eager`, `viewport`, `hover`, or `tap`), and `preloadCode` and `preloadData` exist for programmatic use. Puzzle modules are dynamic imports, so preload them with `import()` in idle time or module-preload hints.
4. **Budget the speculation.** False positives are fine for small chunks. Heavy modules (physics, jigsaw assets) load only when selected or when the next puzzle is known. Skip idle preloading when `navigator.connection.saveData` is set or the connection is slow (where available).
5. **The spinner** appears only on a first Play whose preloading has not finished. After about 100 ms show a skeleton, not a full-screen loader.

**Generation pipeline (no delay between puzzles).**

- Light puzzles (grids, tiles) generate on demand in well under a frame.
- If a generator can take longer than about 8 ms on a mid-range phone, run it in a **Web Worker**, never on the main thread.
- **Instant Next:** while the player plays round N, prepare round N+1: choose the type and seed (with the recency penalty), load its module, preload its theme assets, and generate it in the worker. Difficulty depends on how round N ends, so prepare the likely band (up after a success) and generate the other band when the outcome is known if the generator is cheap. Next then starts a prepared puzzle with no spinner.
- **Seed bank for heavy puzzles.** Puzzles with expensive generation or verification (uniqueness solvers, mahjong layouts, jigsaw cuts) are pre-verified offline: a Cron Trigger or Queue consumer generates and verifies seeds with a difficulty rating and stores them in KV or D1, and the client draws from the bank. Generation risk and delay shrink to a lookup, and low-quality seeds can be rejected. The bank still needs availability, version compatibility, exhaustion, and fallback handling (a depleted or unreachable bank falls back to a cheap puzzle type or on-device generation).
- **Ranked:** preload code and assets only. Do not pre-generate or reveal a ranked seed early: the server issues the seed and token when the authoritative clock starts, and any pre-start reservation is an opaque handle that counts against the seed-shopping caps. Pre-generation of the next puzzle is for solo play.
- **Registry:** ship a small index (id, weight, orientation, chunk URL), not every manifest. Manifests and engines load lazily, and only the current and next puzzle modules stay in memory.

**How many puzzles can we build?** There is no technical ceiling. Each puzzle is a lazily loaded package and the index grows by a few hundred bytes per puzzle. The limits are your time (roughly 1 to 3 weeks each, less within a family), QA and maintenance, and catalog quality. A realistic first-year target is 8 to 15 types, added by value (section 11.12).

**Cloudflare feature map (use what fits, not everything).** Static pages and assets on the global CDN: Workers Static Assets. Server rendering and APIs: Workers. Config and leaderboard cache: KV and the Cache API. Accounts, scores, sessions, theme stats: D1. Live rooms, hot counters, and strict consistency: Durable Objects. Seed bank generation, daily rollups, and the daily seed: Cron Triggers and Queues. Events at scale: Workers Analytics Engine. Bot protection: Turnstile and rate limiting. Backups and large files: D1 Time Travel and R2. Do not add Queues or Durable Objects until a measured need appears.

**Per-user shards (decision: not from day one, but designed for).** Verified in the Cloudflare docs: D1 allows 50,000 databases per account on Workers Paid (more on request), up to 10 GB each, and is designed for per-user or per-tenant scale-out, but only about 5,000 databases can be bound to one Worker, so per-user D1 databases need dynamic access. SQLite-backed Durable Objects have no limit on the number of objects or on total storage on Workers Paid, with 10 GB per object, and they are addressed by name without per-object bindings, which makes them the natural per-user shard. The costs of sharding: migrations must run per shard, cross-user queries (leaderboards, admin views) need aggregation into a global store, backups and restores are per shard, and debugging gets harder. The plan: Phase 3A uses a global D1 for accounts, scores, and leaderboards, plus a per-user Durable Object for enforcement (already planned). All personal data access goes through a `UserStore` interface, so per-user stats, settings, and history can move into the per-user Durable Object (or per-user shards) if the Phase 3 load test shows D1 write or row-cost pressure. Do not shard before that evidence.

## 13. Definition of done (per phase)

- Acceptance criteria met
- Tests pass and are documented
- `docs/DECISIONS.md` updated with choices and versions
- Short summary written: built, skipped, known issues
- Owner confirms before the next phase starts

### 13.1 Acceptance quality rules

- **Evidence table:** each phase report lists every acceptance item with its evidence type (automated test, manual drill, or measurement), where the evidence lives, and the result (pass, fail, or waived). A waiver records the owner's exception and the risk.
- **Measurement protocol** for performance targets: name the device class (a specific mid-range phone and a desktop), the network profile (for example throttled 4G and a fast connection), cold load versus preloaded, at least 5 repeated runs, and report the median and p95. Say whether each target is a **gate** (blocks acceptance) or a **goal** (recorded only). The load and interaction targets in section 12.3 are goals in 1A and become gates at public launch.
- **Accessibility actions to accept:** card navigation and reveal by keyboard; piece select, place, and cancel by keyboard; accessible names for every control and card state; focus recovery after overlays and after a round starts; results announced; and a recorded manual screen-reader pass on each puzzle.
- **Fallback identity:** every round records its effective puzzle identity (family, variant, seed, versions). If a fallback replaces a failed puzzle, the record says so, and a ranked token is never reused for a different puzzle.
- **Release compatibility:** the token carries engine and rules versions, and the server keeps verifying older versions for the token's lifetime or returns a clear retryable message, so active sessions survive a deployment or rollback. Migrations stay backward compatible for one release.
- **Operations ownership:** who restores a backup (with a timed restore test), who rotates keys and when, how deletion requests are re-applied after a restore, and who watches alerts, by phase.
- **Reference portability:** the private design canvas is not a dependency. Before Phase 0 begins, the owner exports static screenshots of each approved board, with sizes, into `docs/design-demo/screens/`.
- **Owner responsibilities** for each phase (accounts, credentials, physical devices, recruiting testers, accepting gates) are listed in the phase report, so agents never assume them.
