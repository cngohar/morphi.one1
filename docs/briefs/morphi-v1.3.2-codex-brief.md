# v1.3.2 Codex Brief: Connect variants, admin scoring/pagination, profile polish

**Status:** ACCEPTED LOCALLY by the owner (2026-11-05).
The owner explicitly directed marking the existing v1.3.2 work accepted.
Automated verification results and device/browser details were not supplied;
this records owner acceptance, not a test-pass claim or verification waiver.
See `docs/PHASE_REPORTS.md`. No commit, push, deployment or next phase is authorized.
**Base:** `origin/main` (v1.3.1 baseline).
**Stop rule:** Build v1.3.2 locally, run the targeted checks in section 7, write the phase report, then STOP. No commit, push, deployment, Mahjong, guest tracking or release step without explicit owner approval.

---

## 0. Owner decisions

| #   | Question                          | Decision in this brief                                                                                                                    |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Which Connect variants ship?      | Three new: `connect:full-grid` (full cover), `connect:board-8` (8×8 grid), `connect:rush-60` (60s countdown). Classic stays the baseline. |
| D2  | Standalone Scoring sidebar entry  | Removed from sidebar navigation; moved into per-game tabs under `/admin/games?game=<family>&subview=scoring`.                             |
| D3  | Route `/admin/scoring` redirect?  | No redirect added; admin is an internal operator area not indexed or in sitemaps. Clean UI removal.                                       |
| D4  | Audit logs pagination style       | Smart numbered pagination (`1..2..3 ... 5..6..7`) allowing direct jumps to pages, with Previous and Next.                                 |
| D5  | Profile overview vs. activity tab | Overview narrows recent rounds to a compact 4-item card with a "View all in Activity →" link; Activity keeps full history.                |
| D6  | Sounds for Connect variants       | Zero new audio assets needed. Reuses existing `connect-*` cues and `timer-tick`.                                                          |

---

## 1. Scope

### In scope:

1. **Connect variants** (`connect:classic`, `connect:full-grid`, `connect:board-8`, `connect:rush-60`) using generic variant plumbing.
2. **Admin panel scoring restructuring**: Remove standalone `Scoring` from the sidebar and place scoring configuration directly inside each game's view under `/admin/games?game=<family>&subview=scoring`.
3. **Admin audit logs numbered pagination**: Allow operators to jump directly to numbered pages with smart ellipsis.
4. **User profile polish**: Limit Recent Rounds on the Overview tab to a compact 4-round summary with a jump to the Activity tab, and preserve the full round history in the Activity tab.
5. **Admin test play**: Ensure Connect variants are fully playable in `AdminTestPlay`.

### Out of scope:

- Mahjong or any 4th puzzle family.
- Deployment, production provisioning, DNS, or Google OAuth changes.
- Guest analytics beacon / tracking modifications.
- New sound recordings (ElevenLabs generation skipped; reuses existing files).

---

## 2. Repo facts

- Connect currently has no `variants` array in its manifest. Its engine version is `connect-1` with bands `[5x5, 6x6, 7x7]`.
- Existing vectors in `tests/vectors/connect.json` and `connect-partial.json` must remain 100% passing.
- `createConnectRound(seed)` currently accepts only `seed`. It needs `createConnectRound(seed, variant?)`.
- `applyConnectMove(round, move)` judges win via `connectedCount(next) === next.pairs.length`. In `connect:full-grid`, it must also require `filledCount(next) === next.size * next.size`.
- `maxSeconds` is already part of `VariantDeclaration` in `src/lib/engine/contract.ts` and supported by `src/lib/server/runs.ts` and `src/routes/play/`.
- Admin sidebar `views` array is located in `src/routes/admin/[view]/+page.svelte`.
- `readAudit` in `src/lib/server/audit.ts` returns `{ rows, more, page }` using a fixed limit of 25.
- `ProfileContent.svelte` duplicates the entire `history` array on both `overview` and `activity` tabs.

---

## 3. Connect variants

### 3.1 Codes, labels, and leaderboard groups

| Code                | Label          | Leaderboard group         | Description                                                            |
| ------------------- | -------------- | ------------------------- | ---------------------------------------------------------------------- |
| `connect:classic`   | Classic        | `connect-1:1`, `:2`, `:3` | Baseline 5×5, 6×6, 7×7 bands. Finish when all pairs connected.         |
| `connect:full-grid` | Full grid      | `connect-1:full-grid`     | All pairs connected **and** 100% of cells covered to finish.           |
| `connect:board-8`   | 8 × 8 board    | `connect-1:board-8`       | 8×8 grid with 8 pairs (par 210s) for expansive pathfinding.            |
| `connect:rush-60`   | 60-second rush | `connect-1:rush-60`       | 60-second countdown clock starting on first stroke (`maxSeconds: 60`). |

### 3.2 Rules and Determinism

- **classic:** Unchanged. All-pairs connection finishes the round; 100% grid fill grants the 1,000 pt bonus.
- **full-grid:** All pairs connected without full grid coverage leaves the status as `'playing'`. The round finishes only once every cell is covered.
- **board-8:** Band is fixed to `size: 8, pairs: 8, par: 210`. Uses the existing SplitMix64 Hamiltonian backbite generator without modification.
- **rush-60:** Enforces a 60-second countdown clock. The client HUD shows remaining seconds. Server replay rejects submissions with elapsed time exceeding 60 s + 2 s grace.
- All variants preserve deterministic replay without wall-clock timestamps in the move record.

---

## 4. Admin panel improvements

### 4.1 Remove Sidebar Scoring & Add Per-Game Scoring Subview

- Remove `'scoring'` from `const views` in `src/routes/admin/[view]/+page.svelte`.
- In `/admin/games?game=<family>`, introduce three clean subview tabs:
  - `Statistics` (`?game=<family>`)
  - `Scoring` (`?game=<family>&subview=scoring`)
  - `Settings` (`?game=<family>&subview=settings`)
- Under the `Scoring` subview, render `<ScoringEditor {config} />` for each configured variant of that specific game.

### 4.2 Audit Logs Numbered Pagination

- In `src/lib/server/audit.ts`, compute total matching entries:
  ```sql
  SELECT count(*) as total FROM admin_audit [WHERE filters]
  ```
- Return `{ rows, more, page, total, totalPages }`.
- In `src/routes/admin/[view]/+page.svelte` (Audit viewer), generate a page jump bar:
  - First page, last page, and window around current page (`current - 1`, `current`, `current + 1`).
  - Ellipsis indicators where gaps exist (e.g. `1 2 3 ... 5 6 7`).
  - Active visual state on the current page number.
  - Form GET buttons that retain all active search/filter fields.

---

## 5. User profile polish

### 5.1 Overview tab

- Truncate recent rounds to the latest 4 rounds: `history.slice(0, 4)`.
- Display a clean footer action: `<button class="text-button" onclick={() => (tab = 'activity')}>View all in Activity →</button>`.
- Keeps the overview page concise and vertically balanced with the stats summary.

### 5.2 Activity tab

- Displays the complete, un-truncated list of player rounds with date, mode (Ranked vs Solo), rules group, and scores.

---

## 6. Audio assets

- Zero new audio files needed.
- `rush-60` countdown tick uses the existing `timer-tick.mp3` from v1.3.1.
- All actions reuse existing `connect-*` cues (`connect-pair`, `connect-cut`, `connect-win`, etc.).

---

## 7. Verification and targeted checks

1. **Connect logic & vectors:**
   - Unit tests covering `connect:classic`, `connect:full-grid` (empty cell prevention), `connect:board-8`, and `connect:rush-60`.
   - `bun scripts/check-vectors.ts` across all 6 runtimes (Node, Bun, Chromium, Firefox, WebKit, workerd).
2. **Admin testing:**
   - Test navigating to `/admin/games?game=connect&subview=scoring` and editing scoring values.
   - Verify sidebar no longer lists standalone Scoring.
   - Test audit log page jumping across multiple pages with active filters.
3. **Profile testing:**
   - Verify Overview tab displays max 4 rounds and clicking "View all" switches to Activity tab.
   - Verify Activity tab shows all rounds.
4. **Registry:**
   - Run `bun run registry:generate`.
