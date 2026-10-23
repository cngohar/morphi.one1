# CODEMAP.md

A short map of the codebase so agents can find things without broad searches. Keep it under about 150 lines and update it at the end of every step or phase.

## Current build (Step 5 public test completed; next work awaiting owner direction)

Block placement and Memory are both routed, themed, and alternate on Play/Next (Block first). Step 4 was accepted on 2026-10-22. Step 5 (public test) is live at `https://morphi.one`; the `workers.dev` URL also remains live. `www` and HTTP both redirect to `https://morphi.one`. Single SvelteKit app with a Cloudflare Workers adapter; latest owner-approved deployment to Worker `morphi-one` on 2026-10-23 (version `fb89f416-e757-4015-9d94-0741a7b5bf95`). No accounts. Playwright is a project dev dependency; layout checks run at phone and desktop viewports.

Active plan: `morphi-plan-simple.md`; `docs/PLAN.md` is reference only. On 2026-10-23 the owner reported the public test finished with 45+ players and over 60% positive feedback; exact replay counts are not recorded. See the newest `docs/PHASE_REPORTS.md` entry. Owner-authorized private source repository: `https://github.com/cngohar/morphi.one1`; no automatic deployment.

| Path                                     | Purpose                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/+page.svelte`                | Three-screen flow: Home -> Block/Memory game -> Result; family rotation, per-family best, round number, hint, sound, new-best/so-close         |
| `src/routes/+layout.svelte`              | Global font and CSS imports                                                                                                                    |
| `src/app.css`                            | Design tokens: palette, type, motion, safe areas, block surface and piece colors                                                               |
| `src/env.ts`                             | SvelteKit 3 env schema; optional `ELEVENLABS_API_KEY` for the unused server stub, no secret in source                                          |
| `src/lib/server/elevenlabs.ts`           | Unused server-only ElevenLabs client stub; reads the optional key from `$app/env/private`                                                      |
| `src/lib/engine/rng.ts`                  | SplitMix64 v1, unbiased integer draws, Fisher-Yates shuffle, seed parsing and generation                                                       |
| `src/lib/game/block.ts`                  | Pure block rules: supply, fair opening trays, placement, clears, combo score, cap, replay                                                      |
| `src/lib/game/memory.ts`                 | Pure Memory rules: seeded generation, flip/match/mismatch, win, scoring; routed again for rotation                                             |
| `src/lib/game/symbols.ts`                | Retained Memory symbol ids, labels, verified symbol colors                                                                                     |
| `src/lib/screens/HomeScreen.svelte`      | Title, Play, best score, sound toggle                                                                                                          |
| `src/lib/selector.ts`                    | Pure puzzle selector: injected-RNG family bag, Block first, no immediate repeats                                                               |
| `src/lib/screens/BlockGameScreen.svelte` | HUD, themes, themed picker, 8x8 board, vertical/below tray, tap/drag/keyboard, ghost, clears, end handoff                                      |
| `src/lib/screens/GameScreen.svelte`      | Themed Memory game: preview, flips, mismatch hold, streak, win burst, result handoff                                                           |
| `src/lib/screens/ResultScreen.svelte`    | Shared score, best/new best/so close, title and summary, Next and Home                                                                         |
| `src/lib/components/SoundToggle.svelte`  | Mute control                                                                                                                                   |
| `src/lib/components/MemoryCard.svelte`   | Memory card motion, themed faces/back mark, reduced-motion states                                                                              |
| `src/lib/components/Symbol.svelte`       | Retained inline SVG Memory shapes, no text                                                                                                     |
| `src/lib/components/Confetti.svelte`     | Deterministic Memory win burst with theme colors, under one second                                                                             |
| `src/lib/i18n/messages.ts`               | Every user-facing string, English only                                                                                                         |
| `src/lib/ui/block-themes.ts`             | Four fixed themes with per-theme backdrop, board cell/edge, picker tray/slot, pieces; seed selection; CSS serialization                        |
| `src/lib/ui/memory-themes.ts`            | Same four theme ids for Memory: card back/edge/face/matched, back mark, symbol palette; seed selection; CSS serialization                      |
| `src/lib/ui/sound.ts`                    | Web Audio tones: pick, place, invalid, clear, end, plus retained Memory tones                                                                  |
| `src/lib/ui/storage.ts`                  | Per-game best keys, `morphi.block.hintSeen`, sound, with memory fallback                                                                       |
| `src/lib/ui/active-delay.ts`             | Pausable visible-time deadlines for Memory hide and mismatch transitions; cancellation on unmount                                              |
| `src/lib/ui/format.ts`                   | Number and clock formatting                                                                                                                    |
| `src/lib/engine/rng.test.ts`             | RNG vectors, range, shuffle, seed tests                                                                                                        |
| `src/lib/game/block.test.ts`             | 27 block tests: vectors, fairness, clears, combo, cap, no-fit, replay                                                                          |
| `src/lib/game/memory.test.ts`            | Retained Memory determinism, solvability, flip rules, mismatch, scoring tests                                                                  |
| `src/lib/ui/block-themes.test.ts`        | Theme count, palette uniqueness, board/picker contrast floors, seed determinism, reachability, serialization                                   |
| `src/lib/ui/memory-themes.test.ts`       | Memory theme/Block backdrop match, card and symbol contrast, palette uniqueness, seed determinism, serialization                               |
| `src/lib/ui/storage.test.ts`             | Settings/best regressions: failed writes with readable stale data, later read blocking, recovery, malformed scores, per-game bests             |
| `src/lib/ui/active-delay.test.ts`        | Visible-time deadline tests: background pauses, repeated resume, hidden start, cancellation, zero-delay motion                                 |
| `static/demo/block.html`                 | Unlinked interactive visual sample for Block placement; not production code                                                                    |
| `playwright.config.ts`                   | Project Playwright config: Chromium, dev-server reuse, `test-results/` output, 120 s timeout                                                   |
| `tests/e2e/layout.spec.ts`               | Four-viewport layout audit: board centering, no page scroll, Memory columns/card sizes, HUD type                                               |
| `tests/e2e/reliability.spec.ts`          | Failed-start retry, duplicate Play, final drag coordinates, secondary pointers, lost capture/blur, keyboard repeat, hidden mismatch hold       |
| `wrangler.jsonc`                         | Cloudflare Worker `morphi-one`: built Worker, static assets, compatibility date/flags, logs/traces/issues; custom domain is dashboard-attached |
| `vite.config.ts`                         | SvelteKit + Cloudflare adapter configuration                                                                                                   |
| `vitest.config.ts`                       | Pure Node unit tests, independent of the SvelteKit/Cloudflare runtime; no Worker listener or secrets loading                                   |

## Design docs

- `docs/puzzles/_TEMPLATE.md`: required puzzle brief structure.
- `docs/puzzles/block-placement.md`: approved brief plus Step 3 and Step 4 build status.
- `docs/PHASE_REPORTS.md`: game implementation, engineering reliability, agent setup, and production deployment evidence and known issues.
- `docs/CLOUDFLARE_AGENT_SETUP.md`: project-local skills/MCP setup completed; OAuth and read-only Worker API access verified. No global configuration or deployment changes.

## Conventions

- Path alias: `#lib` (declared in `package.json` `imports`); imports use explicit `.js` extensions.
- Pure rules live in `src/lib/engine` and `src/lib/game`; no DOM, no `Date.now`, no `Math.random`, no approximated math. ESLint enforces this.
- All visible text goes through `src/lib/i18n/messages.ts`.
- Layout uses the tokens in `src/app.css`; no shadows, gradients, glows, or emoji.
- Block engine state is plain data and replays from seed plus moves. The client never submits a score.
- Block colors are shape-position safe: color is not the only cue.

## Commands

- Install: `bun install`
- Dev: `bun run dev --host 0.0.0.0` (phone testing over the local network)
- Type-check: `bun run check`
- Lint and format check: `bun run lint`
- Unit tests: `bun run test:unit -- --run`
- Browser layout tests: `bun run test:e2e` (installs nothing; run `bunx playwright install chromium` once on a new machine)
- Build: `bun run build`
- Local Worker preview: `bun run preview:worker`
- Validate the deploy bundle without uploading: `bun run deploy:dry`
- Deploy: `bun run deploy` only after `bunx wrangler login` and explicit owner permission
- Live Step 5 Worker: `https://morphi.one` (Worker `morphi-one`); `https://morphi-one.electrasincng.workers.dev` also works

## Where to look for...

- Block rules, score, supply, fairness, cap, replay: `src/lib/game/block.ts`
- Block themes, board/picker/piece palettes, seed selection: `src/lib/ui/block-themes.ts`
- Memory themes, card/symbol palettes, seed selection: `src/lib/ui/memory-themes.ts`
- Block interaction, HUD, fill-only clear, hint, themed tray layout, end feel: `src/lib/screens/BlockGameScreen.svelte`
- Screen flow, family rotation, per-family best, round number, hint state, so-close logic: `src/routes/+page.svelte`
- Puzzle family selection: `src/lib/selector.ts`
- Shared result card: `src/lib/screens/ResultScreen.svelte`
- Seeded randomness: `src/lib/engine/rng.ts`
- Text: `src/lib/i18n/messages.ts`
- Colors and motion tokens: `src/app.css`
- Storage keys: `src/lib/ui/storage.ts`
- Memory game: `src/lib/game/memory.ts`, `src/lib/screens/GameScreen.svelte`, `src/lib/components/MemoryCard.svelte`, `src/lib/ui/memory-themes.ts`
- Layout regressions: `tests/e2e/layout.spec.ts`; screenshots and traces under the ignored `test-results/` directory
- Deployment: `wrangler.jsonc`, `vite.config.ts`; custom domain and DNS are active, `www` and HTTP redirect to the apex
