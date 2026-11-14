# Handover — Klondike Solitaire v1.4.3 Codex Brief

**Date:** 2026-11-14. **Status:** brief is ACCEPTED — the owner locked §0 (D1–D11) on 2026-11-14. **Amendment 1 (2026-11-14):** Codex stopped before implementation under the brief's stop rule — four conflicts verified against the code at HEAD `80c270e`; §8B of the brief authorises ONLY the four narrow shared changes that resolve them. **Amendment 2 (2026-11-14):** a second review before implementation found five further blockers and three risks (no files changed, no tests run, demo not opened); §8C authorises ONLY the narrow extensions that resolve them. **Amendment 3 (2026-11-14):** a third review found one confirmed conflict (daily seed generation — §8C(f)'s 1,000-seed walk cannot be built without changing the shared daily path the brief prohibited) plus two clarifications (hint-then-Restart label, New Deal selector peek + seed); §8D authorises ONLY the narrow changes that resolve them. **Amendment 5 (2026-11-14):** a fifth review found one remaining request-size conflict (a long daily resume sends the full move log to the leaderboard daily action, which enforces its own 65,536-byte form limit — §8E(a)'s claim that daily resume "does not hit the cap" was wrong) plus a handover accounting inconsistency (the permitted `/api/progress` route edit was a 9th shared-touch file the "8 total" never counted); §8F authorises ONLY the narrow changes that resolve them, and corrects the shared-touch total to **10**. If the owner already copied the 377-line Amendment 4 brief to `docs/briefs/`, re-copy the amended file. The demo fixture is present on the reviewer's machine (verified by the reviewer, 2026-11-14) — step 2 below is verify-only; copy only if the file is missing.

## What this is

Step 4 of the Morphi puzzle workflow for Klondike Solitaire (v1.4.3, third wide puzzle, next game after Tangram; Jigsaw is parked). Research, demo and variant matrix are already done — this handover only prepares the Codex brief:

- Global research: `~/workspace/research_notes/klondike-solitaire-global-research-20261109-1205/report.md` (7/7 topics, 2026-11-09)
- Variant matrix: `~/workspace/research_notes/klondike-variant-matrix-20261114/matrix.md` (288 raw, 0 exclusions, 288 combinable, 287 genuine — 100+ proven)
- Demo: artifact `klondike-solitaire-demo` (owner-accepted 2026-11-14 after the layout, drag, horizontal-flight and pre-placed-tableau fixes)
- This brief: `~/workspace/klondike-v1.4.3-brief/v1.4.3-klondike-codex-brief.md`

## Owner locks — applied 2026-11-14 (§0 of the brief, all LOCKED)

1. **D1** reset 00:00 UTC
2. **D2** daily attempts: first try only for ranking
3. **D3** scoring per the brief's recommendation: foundation-return −15, time-bonus divisor 700,000, timed −2/10 s EXCLUDED, NO Vegas money presentation. Scoring is the Standard Microsoft default and is **admin-changeable any time** (brief-v1 versions)
4. **D4** timing floor 60,000 ms (1 minute) — **NOT admin-changeable** (manifest code constant; changing it needs a code change via a brief). Consequence, locked knowing it: legitimate wins faster than 1 minute are downgraded to unranked (fastest attested win is 23 s)
5. **D5** solver budget 100 attempts per deal, then reject the seed; only "won" issues a deal; solver-winnable only, no casual-budget requirement
6. **D6** Thoughtful: all tableau cards face up, stock order shown/peekable
7. **D7** foundation move-back ALLOWED
8. **D8** hint-assisted daily win marked "solved with hint", NOT a ranked daily win
9. **D9** Double Klondike 9 columns (separate baseline, not v1.4.3)
10. **D10** name stays "Klondike Solitaire" (display title "Klondike") — do NOT rename to just "Solitaire" (umbrella term; Mahjong Solitaire is already a family). Formal trademark search still required before launch; the brief is not legal clearance
11. **D11** `maxMoves` 10,000

**Do-not-copy note (owner, 2026-11-14 — in the brief §2 and §6):** Codex must NOT copy the demo's bottom Draw 1 / Draw 3 segmented control into the app (Tangram Square/Row lesson — Row had to be removed in Amendment 5). Draw 1 vs Draw 3 is a rule variant selected by the variant system / daily board, never a player-facing toggle; the round-rule line states the draw mode for that round only. The demo's Restart-menu Quick-finish test deal is likewise demo-only and must not ship as a player option.

## Copy commands (run on the owner's machine, `~/morphi-one` is the Morphi clone)

```bash
# 1. Copy the brief into the repo (read-only here — the workspace copy is the source)
cp ~/workspace/klondike-v1.4.3-brief/v1.4.3-klondike-codex-brief.md ~/morphi-one/docs/briefs/v1.4.3-klondike-codex-brief.md

# 2. Verify the demo fixture is where the brief expects it (present per the reviewer, 2026-11-14).
#    Copy ONLY if it is missing — if it is missing, Codex must STOP and report, do not invent one.
ls ~/morphi-one/static/demo/v1.4.3-klondike.html
#    (if missing: cp ~/Downloads/"Klondike Solitaire Demo.html" ~/morphi-one/static/demo/v1.4.3-klondike.html,
#     adjusting the downloaded filename to the actual export name; the file must be the demo artifact's export)

# 3. Confirm the base is HEAD 80c270e PLUS the pre-existing uncommitted changes/deletions in the
#    working tree (reported by the reviewer, 2026-11-14, and preserved by them) — NOT a clean tree.
#    Preserve those changes exactly; do not touch, commit, revert or build on them.
cd ~/morphi-one && git rev-parse HEAD && git status --short
```

## How the user runs Codex himself

The user runs Codex CLI (ponytail plugin) himself on his own machine. Hand Codex the brief in `~/morphi-one/docs/briefs/v1.4.3-klondike-codex-brief.md` only — not the workspace research or matrix files (the brief is self-contained; it cites them as sources). Codex's stop rule is in the brief header: build baseline + Batch A only, then STOP and report. Do not commit or push, do not deploy, do not start Batch B.

## Acceptance gate before commit (owner reviews, then pushes)

Codex must report back, then STOP. Before the owner commits/pushes, all of this must hold:

1. **Files:** the 17 new files in brief §8 exist, plus only the 10 shared touches (§8F adds ONE new shared file, `src/routes/leaderboard/+page.server.ts` — the daily action only, 1 MiB on both the `actionRequest` and `readPlayBody` layers, §8F(a); §8F(b) also corrects the count: §8E's "8 total" never counted the permitted `/api/progress` POST route edit, which was a 9th file, so the true total after §8E was 9 and after §8F is 10; §8C added no new shared file, it extended the authorised changes inside the 6; §8D added `src/lib/server/daily.ts`): `src/lib/round-timing.ts` +1 const, `scripts/check-vectors.ts` + `--klondike-solitaire` filter, `src/lib/ui/puzzle-view.ts` + optional `onnewdeal` prop, `src/lib/screens/PlaySession.svelte` + `newDeal()` handler + constrained `prepareRound`/`makeCandidate` parameters + the View-wiring line + the fixed-path warm suppression and seed-difference check (§8D(c)) + the optional `updateSelector` parameter on `refreshAvailableGames` (§8E(b)), `src/lib/engine/contract.ts` + optional `hintUsed` on `ReplayedResult` + optional `resolveVariantFromRules` on `PuzzleManifest` + optional `dailySeedOk` on `PuzzleManifest` (§8D(a)), `src/lib/server/runs.ts` + one `ranked` line in `saveRun`, `src/lib/server/daily.ts` + daily-seed walk in `dailyPuzzle` only (§8D(a)) + per-family try/catch in `refreshDailyBoards` (§8E(c)), `src/lib/server/play-http.ts` + optional limit parameter on `readPlayBody` (§8E(a)), `src/routes/api/progress/+server.ts` POST + `readPlayBody(event, 1_048_576)` call (§8E(a)), `src/routes/leaderboard/+page.server.ts` + daily action only (§8F(a)). No other shared file was touched; no engine/selector/server/schema/migration edit beyond §8B/§8C/§8D/§8E/§8F.
2. **Carve-out:** NONE new (§8A reuse only, plus §8B/§8C/§8D/§8E/§8F authorised items). **Variant groups added: 0.** Daily board `(klondike-solitaire, date)`: 1 per day.
3. **Verification (focused only):** units (incl. solver won/proved-dead/undecided, variant-rule solver checks, pass-limit enforcement, below-floor boundaries), vectors in 6 runtimes (`bun scripts/check-vectors.ts --klondike-solitaire`), real-D1 integration (daily start → saveRun → replay → `daily_best` row), browser at 390×844 / 844×390 / 1280×800 with zero horizontal overflow, and the locked 3,000 ms deal-in sampled mid-flight (every flying card portrait, tableau filling one by one, nothing pre-placed). Plus §8B: New Deal starts a fresh deal in the same family + same variant with a new seed (never another puzzle, never the same seed), and a hint-assisted win saves unranked with no `daily_best` row and is labelled "solved with hint". Plus §8C: New Deal on a daily round recovers the variant from the issued `round.rules` (exactly one match); Restart replays identically (score/hints reset, elapsed time does not); partial Draw 3 draws record the actual count; solver never exceeds 400,000 nodes per deal; Auto-finish only when the greedy sweep empties the board; Thoughtful deal-in flies face-up with no flip. Plus §8D: the daily walk in `dailyPuzzle` pins the first solver-won seed (attempt 0 reproduces the current derivation; a family without `dailySeedOk` is untouched; no row pinned and `daily_unavailable` if none passes in 1,000 seeds) with measured walk numbers (nodes + wall time) in the §10 report; hint → Restart → win is unranked + labelled "solved with hint" (sticky flag, never reset by Restart); New Deal on the fixed path performs no selector peek/warm and never re-deals the same seed. Plus §8E: a 10,000-move completed run submits to `/api/progress` (1 MiB bound) while every other play route still rejects over 65,536 bytes with 413 — except the leaderboard daily action, whose bound §8F raises to 1 MiB (see §8F below); a New Deal with changed availability leaves the selector byte-identical; a rigged `dailyPuzzle` throw for one family does not stop the next family's board/snapshot refresh (failure logged with family + date); the daily walk keeps attempt 0's variant across all retries. Plus §8F: a ranked daily resume with a 10,000-move log succeeds through the leaderboard daily action (1 MiB on both layers) while the `streak` action still rejects over 65,536 bytes and the `scoring` action still rejects over 4096; a resume with an illegal move still fails validation, not the bound. `bun run lint` / `bun run check` may run project-wide as READ-ONLY checks — only failures in the Klondike files + the 10 shared touches block acceptance; failures in untouched files are reported as pre-existing drift and do NOT block (§8C(e)).
4. **Demo gaps closed in-app:** the paths the demo never verified live must be driven in the app before acceptance — blocked ending, keyboard-only play, double-tap home, foundation → tableau −15, recycle penalties, full win on a random (solver-approved) deal. The brief §9 lists them; a pass on the Quick-finish deal alone does not close them.
5. **Gaps/conflicts:** every place the code forced a choice is reported, including any zero-edit exception. If a requirement conflicts with the code, Codex stops and reports — it does not improvise a workaround that changes the design.

## No deploy

No deploy without a separate explicit yes from the owner. Deployment is on hold until enough content/puzzles are built (owner, 2026-11-09). All development stays local.

## Known verification gaps carried into the brief (not hidden)

- Double-tap gesture, foundation-to-tableau −15, recycle penalties, full win on a random deal, blocked ending and keyboard-only play were NOT verified live in the demo — they are §9 acceptance items for Codex.
- Audio output was never heard (muted sandbox); Nunito never loaded in the sandbox (CDN blocked) — owner to confirm on their own 1920×1080 screen.
- The solver does not exist yet — it is the biggest new-work item in this milestone (no reuse point in the repo; Nonogram's line-solver is a structural pattern only).
- The time-bonus figure 700,000 cannot be a `ScoreDefinition` field (values must be integers 0..10000, verified in `src/lib/engine/scoring.ts`) — the brief re-expresses it as field `timeBonus: 7000` with bonus = floor(7000×100/seconds). Owner locks this with D3(b).
