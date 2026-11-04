# v1.3 Codex Brief — Memory Variants Only — OWNER-ACCEPTED

**Owner acceptance:** 2026-11-04 ~17:07 PKT. This brief is authorised for local implementation only.
**Base:** post-refactor HEAD `c7bdb03` ("Audit final engine determinism and generic contracts"), clean. Do not re-litigate the refactor.
**Stop rule:** Build v1.3 only, then STOP and report for owner confirmation. Do not commit and push on your own, do not deploy, do not start Block variants, Connect variants, Mahjong, a new centered/full game, the knowledge graph, or any release step. The owner pushes after review.

## Final scope — v1.3 is ONLY this

1. Three new Memory variants, classic stays as baseline (not counted as new).
2. Per-variant admin statistics: shown, ignored, played, abandoned, finished.
3. Per-variant disable, audited, with in-progress rounds allowed to finish.
4. Per-variant score editing, following immutable scoring versions.
5. Admin-only, noindex test play for Memory only (classic + all variants, including disabled).
6. Generic variant plumbing, with family-scoped variant codes.
7. Targeted verification only — see §Verification below.

Nothing else. No Block, Connect, or Mahjong change. No new family. No public release.

## Variants — exact rules

Classic (`memory:classic`) is unchanged: 6/8/10 pairs, preview then hide, flip two, identical symbols match, score 1,000 per pair − 150 per mismatch − 5 per second, scoring version `brief-v1`, groups `memory-1:6`, `memory-1:8`, `memory-1:10`, max 120 flips (12 per pair). Classic rounds made before v1.3 must still replay as classic.

### V1 — `memory:no-preview`
No opening preview at all; cards start face down, play begins immediately. Everything else is classic. Preview/opening allowance is 0 for this variant; ranked opening time follows the variant, not the family. Help text and the memorise phase are variant-aware. Scoring stays `brief-v1`, same values. Groups: `memory-1:no-preview:6`, `memory-1:no-preview:8`, `memory-1:no-preview:10`.

### V2 — `memory:trios` (Match-3)
Flip three cards per attempt; three identical symbols stay face up, any non-matching set flips back. Move cap is re-derived, not copied: 18 flips per trio (6 attempts per trio). New scoring version required: 1,500 points per trio − 150 per mismatch − 5 per second (500 per card, same per-card rate as classic). Messages, help, and result summary say trios, not pairs. Groups: `memory-1:trios:6`, `memory-1:trios:8`, `memory-1:trios:10`, where the number is the count of trios.

### V3 — `memory:moving` (Moving cards on mismatch)
After a mismatch, the still face-down, unmatched cards are reshuffled to new positions, deterministically from the same seeded RNG stream. Matched and currently revealed cards never move. Scoring stays `brief-v1`, same values. Groups: `memory-1:moving:6`, `memory-1:moving:8`, `memory-1:moving:10`.

Each variant gets its own leaderboard groups. Scores are never mixed across variants.

## Variant mechanism — generic field, family-scoped codes

- The `variant` field itself is generic: selector, PlaySession, server replay, admin statistics, lifecycle, and test play handle it the same way for any family.
- The codes are family-scoped and manifest-owned: `memory:classic`, `memory:no-preview`, `memory:trios`, `memory:moving`. Do NOT create a global variant enum that every family must understand, and do NOT reuse a Memory code for another family. Later Block/Connect steps will create their own codes and manifest definitions, reusing this plumbing.
- Selection: selector picks a family first, as today, then a weighted variant draw picks one enabled variant, avoiding the last variant served. Variant weights live in the manifest (or admin-editable catalog config if that route is already established in code — do not invent a second config system).
- Persistence and replay: the variant id travels with the round, the solo checkpoint, the pending run, and the ranked session, and is passed into `createRound` / `resumeRound` / `replay`. The server never trusts a client-submitted score or variant; it replays and computes, as today. A round with no variant id replays as `classic`.
- Label: HUD, help, and result always show the variant name (for example "Memory · Moving cards"), not just "Memory".

## Admin variant statistics — definitions that must reconcile

Location: existing admin games page, Memory detail (`?game=memory`), a Variants section on that same detail page. One row per variant (classic + three new), each expanding in place to full detail. No new admin route, and do NOT reuse the old excluded `/admin/games/<name>` test-route pattern. Right-side panel on the same page is only a fallback if the detail page genuinely cannot fit the table on phone widths — not a separate popup window.

For each variant, from registered-user activity only:

- **Shown:** a round of this variant was dealt and presented. Ranked: `play_session` starts. Signed-in solo: `account_round_activity` starts.
- **Ignored:** shown, then left with zero flips (Next / Home / abandon before any card is turned).
- **Played:** shown with at least one flip.
- **Abandoned:** played, then left without finishing (`account_round_activity.abandoned_at` set and `completed_at` null, or ranked `play_session.abandoned_at` with no matching `completed_run`).
- **Finished:** won and saved (`completed_run` for that variant's `rules_group`).

Rules:
- Shown = ignored + played, and played = abandoned + finished + still open. "Still open / unknown exit" is its own bucket — unknown exits are NOT silently called abandons.
- **Registered users only in v1.3.** Guest solo starts are NOT counted, because solo guest rounds are not server-recorded until saved and counting every guest start would add a per-round write on the hottest path. Label the page plainly, for example "Registered users only; guest solo starts are not counted". Guest counting is a later, separately scoped step. Finished guest runs that are later saved appear under Finished only.
- Finished also keeps the existing split: ranked vs solo, best, average, duration, per variant group, and best/average per scoring version (see below).

## Disable a variant

Model it on the existing family disable in `src/lib/server/games.ts` (`game_lifecycle`): a new `variant_lifecycle` record (family + variant, state, reason, audit), operator permission, reason and confirm step, written to `admin_audit`, same pattern as `game-enable` / `game-disable`.

- A disabled variant is excluded from the selector variant draw and the server rejects new ranked starts for it.
- It is NOT deleted; history and leaderboards stay, and it can be re-enabled with the same audited action.
- In-progress rounds can finish. Disabling must not strand a player mid-round or invalidate a round already dealt.
- If every Memory variant is disabled, Memory as a family is effectively unavailable: selector and availability check must exclude Memory in that case, rather than serving a disabled variant or crashing rotation. Family-level disable through the existing switch stays separate and unchanged.

## Score editing — what changes, what does not

Follow the existing immutable scoring-version system (`src/lib/server/scoring.ts`, `score_live`): an edit creates a new version, rollback creates another new version with old values, with the existing reason, expected-version conflict check, and audit record.

- An edit changes ONLY future rounds and live-leaderboard eligibility for the affected variant(s). Live leaderboards count only runs whose `score_config_version` is live.
- An edit does NOT change already-saved scores, already-saved `completed_run` rows, or any of the five admin counts.
- Classic, no-preview, and moving share one scoring config (`brief-v1` values). An edit to that shared config affects all three future rounds — the admin page must say so.
- Trios has its OWN scoring config and version history (1,500 / 150 / 5). Do not apply pair values to trios or trio values to pairs. The scoring editor on the Memory detail page must show the shared config and the trios config separately, each with its own live version, history, and rollback.

## Admin-only test play — Memory only, noindex, hidden

- Operator-authenticated exactly like existing admin pages (which already carry `<meta name="robots" content="noindex">`). Not linked from any public page, not in the sitemap, not in public navigation. Authentication is the gate; noindex is the second layer, not the gate.
- The admin can play classic Memory (the main game) and every variant, INCLUDING a disabled variant, via an explicit family + variant picker — not the public selector draw. This is how a disabled or new variant is tested before it goes live.
- Test play runs the same Memory view, engine, and replay logic as public play, with a clear "Admin test" banner and the variant label.
- Test rounds are ephemeral: no ranked session, no ranked cap consumed, no `completed_run`, no leaderboard entry, and NOT counted in shown / ignored / played / abandoned / finished. Test rounds may be logged only as an admin test action if a lightweight audit note is already established — never as player activity.
- Scope: Memory test play ONLY in v1.3. The route and picker pattern must be family-generic so Block/Connect can reuse it later, but do NOT build Block/Connect test play in v1.3.

## Verification — targeted ONLY

Run ONLY:

- Memory units and generator vectors for classic, no-preview, trios, and moving — Memory's vectors only, in the six runtimes as for existing games, including a replay vector proving a moving-cards round replays identically and a classic round still replays as classic.
- Memory manifest, scoring (including the new trios scoring version), messages, and theme/palette checks — Memory's own palettes only.
- Memory browser checks: variant label, no-preview start, trios matching and cap, moving-cards reshuffle after a mismatch, result / Next, and selector rotation across variants.
- Admin browser and unit checks for the games page ONLY: Variants section, five counts with the open bucket, disable/enable with reason and audit, all-variants-disabled fallback, per-variant score editing (shared vs trios, new version only, old scores unchanged), and admin test play (operator-only, noindex, disabled variant playable, test rounds creating no leaderboard or statistics records).
- Shared boundaries v1.3 actually touches: selector variant draw, PlaySession variant persistence, server replay/validation, `completed_run.rules_group`, and the `gameStatistics` query.

Explicitly DO NOT run:

- A full `bun run verify`, or any Block, Connect, Mahjong, users, moderation, themes, or scoring-for-other-families test, unless a shared file v1.3 actually touches pulls that area in — and then only that area.
- Physical-device measurement, unless the owner supplies devices. Emulated-phone evidence, if used, must be labelled emulated, with physical validation outstanding.
- Any deployment, public release, or production provisioning, DNS, Google, or secret change.
- Any other Memory variant, any Block/Connect variant, and any guest-tracking system.

## Report back — then STOP

When v1.3 is complete locally, report in this format and stop for owner confirmation. Do not push, do not deploy, do not continue:

- **Built:** each variant, admin statistics, disable, score editing, test play — with the files changed.
- **Variant groups:** the exact leaderboard groups added.
- **Verification:** every targeted check above, with pass/fail, and explicitly what was NOT run (full verify, other games).
- **Known issues / open details:** anything where the code forced a choice not in this brief, with the choice you made.
- **Not done:** Block/Connect/Mahjong, guest counting, and any other scope, stated as not done.

If a requirement in this brief conflicts with the code as it actually is, stop and report the conflict. Do not improvise a workaround that changes the design.
