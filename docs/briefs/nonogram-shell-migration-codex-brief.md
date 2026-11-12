# Nonogram per-family shell migration — Codex Brief

**Status:** ACCEPTED BY OWNER 2026-11-12. Owner may now copy to `docs/briefs/` and run Codex. **Base:** repo HEAD `e69bfe5` ("v1.4.1 Nonogram"), clean tree.
**Stop rule:** Build the Nonogram migration only (§3 Steps 1–6), then STOP and report. Do not commit or push, do not deploy, do not start Mahjong, Tangram, any other family, or any release step. The owner pushes after review.
**Authority:** the per-family shell decision (`docs/DECISIONS.md`, per-family game shell entry, accepted 2026-11-12), `docs/CODEMAP.md`, `morphi-plan-simple.md`, repo `AGENTS.md` (one phase at a time; smallest implementation; locked decisions stay locked; anime.js only through the motion wrapper; failure behaviour part of every feature; local-first, no deploy).
**Locked numbers (owner):** `NONOGRAM_ENTRANCE_MS` 2,500 ms (unchanged); card deal 650 ms, flip 400 ms, unfold 800 ms, fold 500 ms, result exit 350 ms (unchanged, `src/lib/round-timing.ts`); timing floor 2,500 / 10,000 / 22,500 ms (unchanged); maxMoves 10,000 (unchanged).
**Version:** no bump. This is a v1.4.1 revision, not a new version: no gameplay, variant, scoring or daily-board change, and the site is not live. The v1.4.x numbers are puzzle slots (v1.4.3 is Klondike), so this migration must not take one. The family engine version stays `nonogram-1` (the engine is untouched). Recorded in `docs/DECISIONS.md` (per-family shell entry) and `docs/CODEMAP.md`.
**Amendment (owner, 2026-11-12):** adds §5A authorising the three Step 0 scope gaps (generator, game-shell.css, nonogram.spec.ts). All else unchanged from the accepted brief.
**Amendment 2 (owner, 2026-11-12):** corrects the §6 failure-path wording to the split Codex implemented (motion failure → playable board; Stage-load failure → failed card with Retry/Home). No code change; the build already implements this.
**Verification rule (owner, 2026-11-09):** focused verification only. Verify the migration's own files plus the shared code the change touches, nothing else. No full-repo verification, no other families' tests, no untouched-file lint, no full `bun run verify`.
**Build order:** baseline proof first (§3 Step 0), then motion, then Stage, then wiring, then CSS, then verification. The migration must return to the Step 0 baseline or better.

## 1. Scope — this migration is ONLY this

1. Move `nonogramEnter` from `src/lib/ui/motion.ts` to `src/lib/puzzles/nonogram/motion.ts`, same signature and behaviour.
2. Build `src/lib/puzzles/nonogram/Stage.svelte` — a copy of `RoundStage` first, then the wide layout; it owns the placement of the help triggers and the family high score (bottom bar, as today).
3. Wire `PlaySession` to render the registered family Stage when one exists, else `RoundStage` (stage registry in `src/lib/registry.ts`, same shape as `puzzleViews`).
4. Move the wide CSS that only makes sense inside Nonogram's stage.
5. Focused verification only (§6).

**Acceptance criterion:** no edit to engine, selector, server, schema or migrations, logic, manifest, scoring, or any other family. If one is needed, stop and report it as a refactor gap.

**Not in this migration:** Mahjong, Tangram, centered families, Connect's motion move, sound, admin, any new variant or preset, any redesign (the wide layout and the bottom footer bar are copies of today's behaviour, not new designs).

## 2. Rules — the shell split (from the design note)

- **Stays shared:** the selector (`src/lib/selector.ts`); the daily issue (`src/lib/server/daily.ts` — server hands a family a seed, the family returns a solvable board); the session core (`PlaySession` — checkpoints, scoring validation, timing, account activity, header, help panel); the card opening (`cardSceneMotion` — deal/flip/unfold, locked forever by the owner's THE-CARD decision and re-locked 2026-11-11); the result recording (standard `PuzzleResult` shape, ranked only above the timing floor, below-floor saved unranked); timing floors and entrance budgets; the anime.js setup (anime.js 4.5.0, one wrapper pattern); `RoundStage` as the default centered stage.
- **Moves per family:** the Stage (layout, chrome, where the controls live); the motion (entrance, feedback, clear, win choreography); the result and ending presentation layout.
- **The card deal stays shared forever.** Families own animation *after* the card opens, never the opening itself.
- **The top header stays shared.** `SiteHeader` (brand, game title, account, sound) is the Morphi identity bar. The title is per-family data, revealed in the header at the flip as part of the card ritual (THE-CARD decision). The header is a slim bar above the stage and does not constrain the stage layout. A family does not redesign the header.
- **Help: dialog and content shared, placement per family.** The `PuzzleHelp` component (buttons, dialog, how/scoring tabs, backdrop dismissal, pausing the game, dialog motion) stays shared; the help content is already per-family in each manifest's `presentation.help`. The footer *bar* (help triggers + family high score) is stage chrome: the Stage decides where they sit — bottom (Block, Nonogram), right rail (Tangram), left rail. The played stack was already inside the stage and stays there.
- **Engine: contract shared, logic already per-family.** `src/lib/engine/` (contract types, SplitMix64 RNG, scoring framework, theme generator) and the server replay stay shared. Each family's logic (`src/lib/puzzles/<family>/logic.ts` — rules, moves, generation, scoring formula) is already private to that family. Nothing moves there.
- **Sound:** sound sets are per family (owner, 2026-11-12) — Block
  sounds cannot be used with Connect, and so on. The sound engine
  stays shared; the loader loads only the current family's sounds,
  lazily, and releases the previous family's decoded buffers on
  family switch (the RAM rule — never all families upfront, never
  held forever). The card's own sounds (`deal`, `flip`) stay shared.
  This migration adds no new sounds: Nonogram keeps its current cues
  (`pick`, `place`, `invalid`, `win`, `clear`) as its set. The loader
  rework itself is separate future work, not this migration.

## 3. Build steps

### Step 0 — Baseline proof (before touching anything)

Re-run the current Nonogram focused checks and record them green: scoped lint/types, `logic.test.ts`, `variants.test.ts`, the real-D1 cases, and the Chromium Nonogram cases at 390×844, 844×390 and 1280×800. This is the bar the migration must return to.

### Step 1 — Extract the motion

Create `src/lib/puzzles/nonogram/motion.ts` containing `nonogramEnter`, moved verbatim from `src/lib/ui/motion.ts` (same signature `(board, kind?, cell?)`, kinds `'enter' | 'pop' | 'mistake' | 'hint' | 'win'`, same returned handle with `destroy()` / `settle()`). Change the import in `Game.svelte` only. Delete `nonogramEnter` from the shared file. Verify by grep that nothing else imports it (there is nothing else) and that `connectEnter`, `connectPaths`, `connectFeedback` and the shared helpers are untouched. Run the Step 0 checks.

### Step 2 — Build Nonogram's Stage

Create `src/lib/puzzles/nonogram/Stage.svelte` as a copy of `RoundStage.svelte` — same props, same three methods, same markup, same styles, same card calls. Then make the one layout change this migration exists for: the wide stage. The board keeps the v1.4.1 layout decision A (container-sized cells); the clue rows/columns keep the space they need beside the board instead of squeezing into the centered card. The card, the stack, the ending and the result slots stay exactly as copied. The Stage also renders the bottom footer bar (help triggers + family high score), copied from `PlaySession`'s `round-panel`, so there is no visual change.

### Step 3 — Wire the session

Extend `scripts/generate-registry.ts` so it emits a stage registry in the same shape as `puzzleViews` (lazy loader per family), then run `bun run registry:generate` (see §5A). Register Nonogram's Stage there. In `PlaySession`, load the family's Stage when one is registered and render it in place of `RoundStage`; otherwise render `RoundStage` as today. The `stage` binding and `cardBeat()` do not change — they call `present` / `stop` on whichever stage is mounted. The header, help dialog, footer content and result recording do not change.

### Step 4 — Move the wide CSS

Audit `Game.svelte`'s CSS and any stage sizing it depends on (`measureFrame`, `--frame-width`, the `.game` selector). Anything that only makes sense inside Nonogram's stage moves into the family's Stage or Game CSS; anything shared stays. No visual change is the goal — this step is a move, not a redesign.

### Step 5 — Cutover check

Grep the repo for `nonogramEnter` outside the family and for any remaining Nonogram import of the shared stage. Both must be empty. Confirm Connect, Memory and Block still import the shared motion and still play through `RoundStage`.

### Step 6 — Focused verification

See §6.

## 4. The stage contract

A family Stage is a drop-in replacement for `RoundStage`:

- Same props (`phase`, `title`, `best`, `ready`, `failed`, `stack`, `playedCount`, `onretry`, the three snippets: board `children`, `endingContent`, `resultContent`) and the same three exported methods (`present(beat)`, `stop()`, `measureFrame()`).
- Same inert rules: the board content is inert unless ready, and during folding / result / result-leaving. Input stays locked until the logical deadline.
- Same card behaviour: the deal / flip / unfold / fold / result-exit beats go through `cardSceneMotion` exactly as `RoundStage` calls it today, with the same reduced-motion handling and the same guarded failure (`try/catch`, `console.warn('morphi:card_motion_unavailable')`).
- Same session chrome rendered: the card, the played stack, the ending overlay, the result slot, the loading/failed card, and the footer bar (help triggers + family high score). The family may change the stage's *layout* — it may not redesign the session chrome or drop any of it.
- The family's motion file exports `nonogramEnter` with the same signature and behaviour, including the per-cell feedback kinds. anime.js only, via the same wrapper pattern (AGENTS.md rule 9); animation never drives game logic.
- Entrance budget unchanged: `NONOGRAM_ENTRANCE_MS` 2,500 ms. `PuzzleViewProps` unchanged. Logic, manifest presets, scoring, daily issue, selector, leaderboard and the result record shape do not change.
- Failure modes (split): an entrance-motion failure settles to a playable board, as today (the existing e2e failure test proves this). A Stage that fails to load shows the existing failed card (Retry/Home) with the finished result and pending family retained; a family with no registered Stage falls back to `RoundStage`. Never a blank page.

## 5. Files — narrow list

**New (do not add others without owner approval):**
1. `src/lib/puzzles/nonogram/Stage.svelte`
2. `src/lib/puzzles/nonogram/motion.ts`
3. `docs/briefs/nonogram-shell-migration-codex-brief.md` (this brief, in-repo copy)
4. `docs/CODEMAP.md` + `docs/DECISIONS.md` updates (docs only)

**Small shared touches (each justified; no others):** `src/lib/registry.ts` (stage registry, `puzzleViews` shape), `src/lib/screens/PlaySession.svelte` (render the registered Stage, else `RoundStage`; `cardBeat()` unchanged), `src/lib/ui/motion.ts` (delete `nonogramEnter` only), `src/lib/puzzles/nonogram/Game.svelte` (import `nonogramEnter` from the family file).
**Run, never hand-edit:** `bun run registry:generate` if the registry change requires it — regenerates the generated files; never hand-edit them.

**Must NOT touch:** `src/lib/engine/*`, `src/lib/selector.ts`, `src/lib/server/*`, `src/lib/server/db/schema.ts`, `migrations/`; `src/lib/puzzles/nonogram/{logic,manifest,scoring,messages}.ts`; generated files; other families (`memory`, `block-placement`, `connect` — read-only reference); `src/lib/components/SiteHeader.svelte`, `src/lib/components/PuzzleHelp.svelte`; `src/lib/ui/puzzle-view.ts`; `docs/PLAN.md` (reference only), `package.json` / `wrangler.jsonc`, no new dependencies, no schema/migration. No cross-family imports; the Stage stays a dynamic import via the registry (`check-lazy-bundle`).

## 5A. Scope carve-out — the Step 0 stop, resolved (authorised narrowly)

Step 0 stopped before Step 1 (correctly, under §1's rule) on three required changes that fall outside §5's allowed files. This section authorises ONLY the minimal changes below. No other file is added to the scope.

1. `scripts/generate-registry.ts` — `src/lib/registry.ts` is generated (header: "Generated by scripts/generate-registry.ts. Do not edit by hand.") and cannot be hand-edited. Extend the generator so it emits the stage registry (same shape as `puzzleViews`) alongside the view registry, then run `bun run registry:generate` to regenerate. No other generator change. The generated files are never hand-edited.
2. `src/lib/ui/game-shell.css` — the Nonogram-wide CSS lives here (`[data-family='nonogram']` rules, ~line 64: board width, HUD stats grid, stat layout). Step 4 moves those rules out of this file into the family's Stage/Game CSS. No other family's rules are touched.
3. `tests/e2e/nonogram.spec.ts` — the 'failed entrance motion settles to a playable board' test injects failure by routing `src/lib/ui/motion.ts` and overwriting `motion.nonogramEnter`. After extraction that method no longer exists in the shared file, so the test must route the family's motion file (`src/lib/puzzles/nonogram/motion.ts`) and inject there instead. No other test change.

Scope is these 3 files only. Types must pass 0 errors / 0 warnings with no suppression or waiver. If any further consumer of the old shared method or any other file is found, stop and report it — do not widen this carve-out silently.

## 6. Verification — focused only (owner rule 2026-11-09)

Verify the migration's own files + the shared touches above only. **No full-repo verification, no other families' tests, no untouched-file lint, no full `bun run verify`.**

- Baseline: the Step 0 checks, re-run green at the end.
- Units: `logic.test.ts`, `variants.test.ts` (unchanged behaviour); the family motion file exports the same `nonogramEnter` signature; the registry returns Nonogram's Stage for `nonogram` and nothing for the other families.
- Integration (real D1): a Nonogram daily round plays end to end through the new Stage — entrance, play, win, result, Next rotates the family away; resume/checkpoint restores the board and entrance state; a below-floor run still saves unranked with no daily-board row and consumes the attempt.
- Browser (one worker, Playwright): Nonogram at 390×844 / 844×390 / 1280×800, zero horizontal overflow; the card opening is unchanged (deal 650 ms, flip 400 ms, unfold 800 ms, fold 500 ms, result exit 350 ms); entrance completes inside 2,500 ms with input locked until the deadline; reduced motion settles immediately (unranked) and the ranked path keeps its timings; keyboard play and the help panel work from the new Stage; the footer bar (help triggers + high score) sits at the bottom as today.
- Failure paths (split): an entrance-motion failure settles to a playable board, as today — the existing e2e failure test proves this, and no failed card is shown for it. A failed stage load shows the failed card with retry/Home, with the finished result and pending family retained — never a white screen and never a lost result (AGENTS.md rule 11).
- Checks (focused only): `bun run lint`, `bun run check`, `bun run check:boundaries`, `bun run check:lazy-bundle`, focused Vitest files only — all scoped to the migration files + the shared touches above. Full `bun run verify` stays deferred. Do NOT run other families' tests, physical-device measurement, or any deployment/provisioning.

## 7. Edge cases, risks, report-back

**Edge cases for `docs/EDGE_CASES.md`:** a family with no registered Stage (falls back to `RoundStage`); a stage load failure mid-round (retain the pending family and finished result, show the failed card with retry/Home); `measureFrame` with no `.game` element; resize/rotation during a Nonogram round; hidden-tab ranked time; reduced-motion changes mid-round; navigation during entrance; the footer bar on the narrowest phone width.
**Risks:** inventing a generic stage system instead of one family Stage (fails the smallest-implementation rule); changing the card beats or timings; moving the header or the help dialog into the family; editing engine/selector/server to "add stage support"; copying the demo fixture's code; hand-editing generated files; cross-family or eager Stage imports; skipping the Step 0 baseline (no before/after proof).

**Report back, then STOP:** built files (list); shared touches applied (list); verification (every check above, pass/fail, what was not run); gaps/conflicts (every place code forced a choice); **not done:** Mahjong, Tangram, centered families, Connect's motion move, sound, commit/push/deploy. If a requirement conflicts with the code as it is, stop and report. Do not improvise a workaround that changes the design.
