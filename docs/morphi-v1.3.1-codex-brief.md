# v1.3.1 Codex Brief: Block variants, admin game pages, per-action sounds

**Status:** APPROVED by owner 2026-11-05. The owner accepted the default decisions D1 to D7 in section 0. Codex may start on this brief after the pre-run checks in the hand-off note.
**Base:** `origin/main` = `f053fc39e5bb9e3daa3cba747761cf9e81c5c914` ("Add v1.3 Memory variants and admin controls"). Start from a clean tree. Do not reopen v1.3 or the engine refactor.
**Stop rule:** Build v1.3.1 locally, run the targeted checks in section 8, write the phase report, then STOP. No commit, push, deployment, Connect variants (v1.3.2), Mahjong, guest tracking or release step. The owner reviews and pushes.

## 0. Owner decisions (answer before Codex starts)

| #  | Question                                                                                                                    | Default in this brief                                                                                                                 |
| -- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| D1 | Which Block variants ship?                                                                                                  | Three new: `block:board-10`, `block:rows-only`, `block:rush-60`. Classic stays the baseline.                                          |
| D2 | "Next page" for a game: a new route or URL state?                                                                           | URL state: `/admin/games?game=<family>` with the existing `subview` tabs. No new route.                                              |
| D3 | Enable or resume without a reason, for families and variants?                                                               | Yes for both. Disable keeps its reason.                                                                                               |
| D4 | Freshness of the overview totals                                                                                            | Cached 60 seconds with an "as of" time, invalidated by any lifecycle write.                                                          |
| D5 | Admin test play for Block variants in v1.3.1?                                                                               | Yes. Block joins the test-play families.                                                                                              |
| D6 | Two admin items not in this request: remove the standalone Scoring sidebar entry and fold scoring into each game; numbered audit and list pagination | Not in v1.3.1. Owner says "include" to add them.                                                                                      |
| D7 | Sounds for trios mismatch and rush time-up                                                                                  | Reuse the existing `mismatch` and `end` files. No new sound.                                                                          |

If D1 changes, sections 3 and 5 change with it. Evidence note on D1: rows-only rests on a secondary hands-on review only; rush-60 is the largest item and adds the only new server rule. If the owner wants a smaller release, swap rush-60 for a 9x9 board with 3x3 square clears, or move rush-60 to v1.3.2.

## 1. Scope

In scope:
1. Block variants per D1, using the generic variant plumbing built in v1.3.
2. Admin Games overview: stats cards and a game list.
3. Admin game page: that game's stats, and an enable/disable switch in the header that stays on every subview of that game.
4. Enable and resume without a reason (D3).
5. One ElevenLabs sound per new action, nothing more (section 5).
6. Admin test play extended to Block (D5).

Out of scope: everything in section 9.

## 2. Repo facts Codex must respect (checked at f053fc3)

- Block declares no `variants`. Its manifest has one leaderboard group, `block-placement-1`, and `BLOCK_ENGINE_VERSION = 'block-placement-1'`. The board is fixed at `BLOCK_BOARD_SIZE = 8`. `Game.svelte` uses the constants in about 26 places and hard-codes the 8-column grid in two CSS rules. There is no clock UI.
- `createBlockRound(seed)`, `replayBlockMoves(seed, moves, scoring)` and the manifest `resumeRound` and `replay` take no variant. Memory shows the pattern to copy: `createRound(seed, variant)`, `resumeRound(..., variant)`, `replay(..., variant)`.
- `gameStatistics` treats the first entry of `catalog[family].variants` as the default. Legacy rows with no variant count under that default, so Block's classic must be `variants[0]` with id `block:classic`.
- `src/lib/ui/sound.ts` hard-codes the `SoundKind` union and preloads every kind on unlock.
- `src/routes/admin/[view]/+page.server.ts` hard-codes `testPlayFamilies: ['memory']` in two places.
- `changeGame` and `changeVariant` (`src/lib/server/games.ts`) require a reason of at least 3 characters for every action. `admin_audit.reason` and `variant_lifecycle.reason` are NOT NULL.
- The admin action handler rejects any `game-*` or `variant-*` submission that lacks a reason or `confirm=yes`.
- AGENTS.md excludes `/admin/games/<name>`. Do not create that route.
- `scripts/generate-sounds.ts` already uses `@elevenlabs/elevenlabs-js` 2.74.0, model `eleven_text_to_sound_v2`, format `mp3_44100_128`, `promptInfluence` 0.75. It skips files that already exist and reads the key from `.env.local`, which is git-ignored.

## 3. Block variants

### 3.1 Codes, labels, groups

| Code              | Label           | Leaderboard group                |
| ----------------- | --------------- | -------------------------------- |
| `block:classic`   | Classic         | `block-placement-1` (unchanged)  |
| `block:board-10`  | 10 x 10 board   | `block-placement-1:board-10`     |
| `block:rows-only` | Rows only       | `block-placement-1:rows-only`    |
| `block:rush-60`   | 60-second rush  | `block-placement-1:rush-60`      |

HUD, help and result show "Block · <label>", for example "Block · Rows only". Labels are descriptive. Do not use publisher or product names (1010!, Blockudoku, Blocks Puzzle, Sova, Woodoku) in any string, code identifier or asset. Weights are equal. The v1.3 rule applies: the last-served variant is skipped when another is enabled.

### 3.2 Rules

Shared by all variants: 3-piece tray, the existing piece set, no rotation, the opening rule (`BLOCK_OPENING_TURNS` with the single-cell fallback), the placement cap of 300, the no-fit ending, and `brief-v1` scoring (line 100, extra line 50, combo 50) on one shared config.

- **board-10:** 10 x 10 board. Rows and columns clear as today. Board size becomes a round field, and `Game.svelte` reads it instead of the constant and the CSS grid. Classic stays at size 8, and classic replays and vectors stay identical.
- **rows-only:** 8 x 8 board. Only full rows clear. A full column does not clear, and it does not count toward `lines` or `combo`. Columns still block placement like any filled cell. Design note: research entry 8 pairs rows-only with a 15-minute timer. This brief takes the clear rule alone, so the variant is one rule change.
- **rush-60:** 8 x 8 board, rows and columns clear. A 60-second clock starts at the first valid placement and shows a countdown in the HUD. The round also ends at zero, with a "Time's up" headline. No-fit and the cap still end the round. Placement is blocked after zero.

### 3.3 Determinism and time

- The replay logic stays time-free for every variant. The 60-second limit is enforced by the client and by a server ceiling on ranked elapsed time, not inside `replayBlockMoves`. Do not add timestamps to the replay contract.
- Add a `maxSeconds` field to the variant contract (rush: 60). In `server/runs.ts`, next to the existing ranked timing check, reject a ranked rush submission whose elapsed time exceeds 60 s plus a 2 s grace. The grace is a proposal. Report the value and the reason.
- Today Block has `rankedTiming: null` and no server elapsed check. This is the only new server rule in v1.3.1. Report it as a risk item.

### 3.4 Compatibility

- Any Block round or completed run with no variant replays as `block:classic`.
- `tests/vectors/block-cap.json` and every existing Block vector pass unchanged. Adding a vector for a new variant is fine. Changing an existing vector is a failure.
- `engineVersion` stays `block-placement-1`, because classic output does not change. v1.3 kept `memory-1` on the same basis. List this under decisions taken.
- Variant leaderboard groups are never mixed with classic or with each other.

### 3.5 Messages, help, endings

- New Block strings go in `src/lib/puzzles/block-placement/messages.ts`, not in `src/lib/i18n/messages.ts`.
- New keys: variant labels; help steps and rows per variant; `ending.block.timeUp` headline and subline.
- Help for rush states the 60-second clock. Help for rows-only states that columns do not clear. Help for board-10 states the board size.
- Regenerate with `bun run registry:generate`. Commit only what the generator produces.

### 3.6 Admin test play

Derive the test-play family list from the catalog, not from the hard-coded array. `AdminTestPlay.svelte` is already family-generic. Test rounds follow the v1.3 rules: no ranked reservation, no `completed_run`, no leaderboard entry, no variant count, no player activity.

## 4. Admin fixes

### 4.1 Games overview (`/admin/games`, no `game` parameter)

Replace the current card grid with two parts.

**Stats cards, registered users only:**
- Games (families): total, enabled, disabled, deleted.
- Variants: total, enabled.
- Shown.
- Ignored.
- Played (at least one flip).
- Abandoned.
- Finished (registered).
- Still open or unknown exit.
- Total completed: Finished plus saved guest completions that have no start record.
- Under Total completed: ranked and solo split.

Note line under the cards: "Registered users only; guest solo starts are not counted. Total completed includes saved guest completions that have no start record, which are not counted in Shown or Played. Updated <time>."

Checks built into the aggregate: Shown = Ignored + Played, and Played = Abandoned + Finished + Still open. Every total equals the sum of the per-variant rows across all families.

**Game list, below the cards:** one row per family with name, state badge, variant count, Played, Finished and Total completed. The whole row links to `?game=<family>`.

**Freshness (D4):** the aggregate is cached in KV for 60 seconds, recomputed on a miss, and invalidated by any `game-*` or `variant-*` write. Do not run the aggregate live on every admin page load. Report how many D1 statements one cache miss runs.

### 4.2 Game page (`/admin/games?game=<family>`)

- Keep URL state (D2) and the existing subview tabs: Statistics (default) and Settings. Add no new subview.
- **Header, shared by every subview of that game:** family name, state badge, and the enable/disable switch at the top right. On narrow screens the switch moves under the title and stays above the tabs.
- Remove the enable/disable control from Settings. Delete, restore and hard-delete stay in Settings, unchanged.
- Statistics subview: add a family summary row with the section 4.1 counts for this game. Keep the existing per-variant rows, which already show the five counts and the open bucket. Families without variants (Connect, later) show the same summary computed across all of their rows.

### 4.3 The switch and its dialog

- Element: `button role="switch"` with `aria-checked`. Visible text "On" or "Off". Accessible name "Game enabled" or "Game disabled".
- Clicking the switch never changes it directly. It opens a modal `<dialog>`:
  - Turning **off** (disable): reason field (3 to 240 characters, no `@` and no line breaks, existing rule), a confirm checkbox, and a "Disable game" button.
  - Turning **on** (enable or resume): confirm checkbox and an "Enable game" button only. Render no reason field.
- The switch shows the server state after success. While a request is pending, the button is disabled. On failure, the old state stays and the existing error notice shows.
- Permissions: `can(role, 'game-disable')` and `can(role, 'game-enable')`. Without permission the switch is read-only.
- Keyboard: Escape closes the dialog and returns focus to the switch. Focus stays inside the dialog while it is open.
- If the family state is `deleted` or `hard-deleted`, hide the switch. Settings keeps the restore and delete controls.

### 4.4 Server change for enable without a reason (D3)

- `changeGame`: for `game-enable`, accept a missing reason. Write the audit row with the fixed system text `Resumed by operator (no reason entered)`. Do not accept or store a client reason for enable.
- `changeVariant`: the same rule for `variant-enable`.
- Action handler: for `game-enable` and `variant-enable`, skip the reason requirement. Still require `target` and `confirm=yes`. Disable actions are unchanged.
- Permission names are unchanged.
- No migration. The reason columns stay NOT NULL and receive the fixed text.

### 4.5 Scoring (no behaviour change)

Scoring stays per family and per variant, as in v1.3. Block's variants share `brief-v1`, and the Block editor says so: "Shared with Block Classic, 10 x 10 board, Rows only and 60-second rush. A change applies to future rounds only." The editor sits in Block's Settings, as Memory's does.

### 4.6 Tests to update

- `tests/e2e/operator.spec.ts` (around lines 350 to 460): the card-scoped "Disable game" and "Enable game" buttons and the reason fill on enable move to the switch and dialog.
- `tests/e2e/memory-variants-admin.spec.ts` (around lines 89, 174, 265): `subview=settings` assumptions.
- `tests/integration/runs.test.ts` and `tests/slices/slice3-catalog-server-validation.test.ts`: still valid, because a reason becomes optional for enable, not forbidden.

## 5. ElevenLabs per-action sounds

### 5.1 Rule

Sound identity follows the action. An action that already has a file reuses it, including when a variant performs that action. A new action gets one new file, generated once. Connect's `connect-*` cues are not touched.

### 5.2 Action to file map

| Family and variant              | Action                                             | File           | Status                |
| ------------------------------- | -------------------------------------------------- | -------------- | --------------------- |
| Memory: classic, no-preview, moving | flip, match, mismatch, win, deal                | existing       | reuse                 |
| Memory: trios                   | flip                                               | `flip`         | reuse                 |
| Memory: trios                   | three identical symbols matched                    | `trio-match`   | NEW                   |
| Memory: trios                   | non-matching set flips back                        | `mismatch`     | reuse (D7)            |
| Memory: trios                   | all trios matched                                  | `win`          | reuse                 |
| Memory: moving                  | face-down cards move after a miss                  | `reshuffle`    | NEW                   |
| Block: all variants             | pick, deselect, place, invalid, clear, combo, refill, end, deal | existing | reuse        |
| Block: rush-60                  | last 10 seconds, one tick per second               | `timer-tick`   | NEW (only if rush-60 ships) |
| Block: rush-60                  | time-up                                            | `end`          | reuse (D7)            |

Result: two new files are required (`trio-match`, `reshuffle`) and one is optional (`timer-tick`). The 22 existing files are not changed. Memory's `trio-match` uses the same streak pitch step as `match` (default). Block's board-10 and rows-only add no sounds.

### 5.3 Generation

- Append the new entries at the end of the `sounds` array in `scripts/generate-sounds.ts`. Do not reorder or edit existing entries.
- Use the same palette string, model, format, `promptInfluence` and SDK version as the existing run. Duration 0.5 to 1.0 seconds.
- Draft descriptions for owner audition. The prompt is recorded, so the owner may edit it freely:
  - `trio-match` (0.6 s): "Three small porcelain tiles click together in one quick cluster, a warm hollow resonant finish, a touch fuller than a single pair click. Successful set of three, under 350 milliseconds."
  - `reshuffle` (0.6 s): "A handful of small walnut and ceramic tiles slide softly across felt and settle into new spots, a short dry scatter with two gentle rests. Cards moving to new places after a miss, under 400 milliseconds."
  - `timer-tick` (0.5 s): "A tiny dry wooden tick on felt, quiet and steady, a single soft click. Under 80 milliseconds."
- Processing: the existing manifest says each file was trimmed of leading silence and re-encoded to mono MP3, 44.1 kHz, 64 kbps. The script does neither. Add the same processing as a documented step for new files, and record `sourceSha256` and `sha256` for each one.
- Fix the generator first. On any failure the loop breaks, and the manifest write that follows drops every later entry. Make the manifest write all-or-nothing, and keep existing entries byte-identical. This is latent today, because new entries are appended, but fix it anyway.
- Provenance: each new entry records the exact prompt it used. Do not rewrite existing provenance. The prompts recorded for the first sounds differ from the palette string in the script; leave them as they are and say so in the phase report.
- Run by the owner, or by Codex with the key in `.env.local`. Never print the key and never commit it.
- Credit check before running. ElevenLabs help pages give 40 credits per second for the web app and two different API rates (11 and 20 credits per second). Use the account's own figure. Expected spend is under 100 credits for all three files at the highest rate.
- Licence: ElevenLabs help pages say audio generated during an active paid subscription can be used commercially, indefinitely. Audio generated on the free plan cannot. Generate while the subscription is active, and record the generation date in the manifest.
- Owner audition is a gate. Commit a file only after the owner has listened to it and approved it. To redo a rejected sound, change its prompt, delete only that file, and run the script again. The script generates only missing files.

### 5.4 Runtime

- `src/lib/ui/sound.ts`: add the new kinds to `SoundKind` and to the preload list. Each file is roughly 5 KB at 64 kbps, so the size cost is small.
- Runtime makes no ElevenLabs request. `src/lib/server/elevenlabs.ts` stays unused and must not be imported.
- Call sites: `trio-match` in the trios match branch of `src/lib/puzzles/memory/Game.svelte`; `reshuffle` after the mismatch hold in moving mode; `timer-tick` on each whole second in the last 10 seconds of rush, if shipped.
- The sound on/off setting is unchanged.

### 5.5 Dependency note (not in scope)

`@elevenlabs/elevenlabs-js` is listed under `dependencies`, although generation is build-time only. Moving it to `devDependencies` is a later clean-up. Do not change it in v1.3.1 unless the owner asks.

## 6. Engineering constraints

- Each family's logic stays in its own package. Shared code must not hard-code `block` or `memory`.
- Variant codes are family-scoped. `block:*` belongs to Block only.
- No migration unless a real schema need appears. If one does, add `0014_*.sql` and report it.
- No new dependency and no new route.
- No change to Memory gameplay, Memory scoring or Memory vectors.
- No secrets in the repo. `.env.local` stays git-ignored.
- Device checks are not claimed. Viewport checks are labelled as emulated.

## 7. Build sequence

1. Admin: switch and dialog, enable-without-reason rule, overview aggregate with cache, game-page header, test-play family list.
2. Generator fix, then the new sounds, then the owner audition gate.
3. Memory hooks for `trio-match` and `reshuffle`.
4. Block variants: variant parameter and round size, then board-10, then rows-only, then rush-60 (clock, then server ceiling).
5. Block messages, help, registry regeneration and vectors.
6. Targeted verification, phase report, then STOP.

## 8. Verification (targeted only)

Report pass or fail for each line.

**Block**
- B1 Logic: existing Block logic tests unchanged and passing. New tests for board-10 (placement, cap, clears), rows-only (columns never clear; combo counts rows only) and rush-60 (no placement after zero; time-up ending).
- B2 Vectors: existing Block vectors unchanged. New `block-variants.json` replay vectors for each variant, three seeds each, identical in Node, Bun, Chromium, Firefox, WebKit and workerd, using a Block filter in the vector runner in the same style as the v1.3 `--memory` run.
- B3 Manifest: registry regenerated; every variant label, help key and ending key resolves; generated files match generator output.
- B4 Browser: variant label on HUD, help and result; 10 x 10 board renders at 390x844, 844x390 and 1280x800 (emulated); rush countdown and time-up; selector rotates across Block variants.
- B5 Ranked: a rush submission over 62 seconds is rejected; one within the limit is accepted; a replay of a pre-v1.3.1 Block run with no variant still returns classic.

**Sounds**
- S1 Generator: a forced failure leaves `manifest.json` complete, with every existing entry byte-identical.
- S2 Files: new files decode; duration within 0.15 s of the request; peak at or below -1 dBFS; each under 12 KB. The 22 existing hashes are unchanged.
- S3 Mapping: every action in section 5.2 resolves to a file; reused actions point at the existing file, with no duplicates.
- S4 Browser: trios matches play `trio-match`, not `match`; moving mode plays `reshuffle` once per miss; no request to an external host during play.
- S5 Audition: owner approval recorded for each new file.

**Admin**
- A1 Overview: totals equal the sum of all variant rows; Shown = Ignored + Played; Played = Abandoned + Finished + Still open; the cache returns the same figures until a lifecycle write invalidates it.
- A2 Switch: present on Statistics and Settings for the same game; the disable dialog requires reason and confirm; the enable dialog has no reason field; the server rejects a disable without a reason; enable writes the fixed audit reason and ignores any submitted reason.
- A3 Variants: enable and disable follow the same rule; with every Block variant disabled, Block is unavailable.
- A4 Test play: operator-only; noindex; a disabled Block variant is playable; no `completed_run`, leaderboard entry, variant count or activity row changes.
- A5 Specs: `operator.spec.ts` and `memory-variants-admin.spec.ts` updated and passing.

**Shared boundaries touched:** `server/runs.ts` (rush ceiling), `ui/sound.ts`, the selector's variant draw, `server/games.ts`, the admin page. `bun run check:boundaries` and `bun run check:lazy-bundle` must pass.

**Not run:** full `bun run verify`; Memory gameplay beyond the touched hooks; Connect; Mahjong; users and moderation suites; the accounts suite; physical devices.

## 9. Not done in v1.3.1

Connect variants (v1.3.2), Mahjong, guest counting, any new family, deployment, production provisioning, DNS, secrets, Google changes, a new admin route, per-family sound manifests (later refactor), the dependency move in section 5.5, and the D6 items unless the owner adds them.

## 10. Report back, then STOP

Use the v1.3 format: Built (files changed), Variant groups added, Verification (each check, pass or fail, and what was not run), Decisions taken where this brief was silent, Known issues, Not done. Then stop for owner confirmation.

## Sources

- Block Puzzle Variants research catalogue: entries 1 (10 x 10 board), 7 (60-second rush), 8 (rows-only clear), 2 and 3 (9 x 9 with 3 x 3 squares, alternative).
- ElevenLabs help centre, sound effects: 40 credits per second on the web app; API rate reported as 11 or 20 credits per second; duration 0.1 to 30 seconds; commercial use of audio generated during an active paid subscription.
- Morphi repository at f053fc3: `docs/morphi-engine-refactor-brief.md` (admin overview caching; sounds are build-time only), `docs/morphi-v1.3-memory-variants-codex-brief.md` (variant mechanism; admin test-play rules), `AGENTS.md` (excluded `/admin/games/<name>`).
