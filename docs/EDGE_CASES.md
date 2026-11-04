# EDGE_CASES.md

Catalog of edge cases with the expected behavior. Every case needs a test (unit, property, Playwright, or a manual drill noted in the phase report). Each phase's acceptance names the categories it must cover. Add every real bug found in play, with a regression test. Format: case → expected behavior.

## 1. Page lifecycle

- Refresh mid-round → the round resumes from the checkpoint (replayed moves), same seed and look.
- Close the tab or restart the browser mid-round → on return, Home offers Resume (primary) and New puzzle.
- Browser crash or tab discarded by the OS → same as closing; the last autosave is at most one move old.
- Back and forward navigation, including restore from the back/forward cache (`pageshow` with `persisted`) → state is intact; timers re-sync from timestamps.
- An exception in an event handler, timer, or Worker callback → not caught by `<svelte:boundary>`; guarded handlers route it to the failed state.
- Page hidden (tab switch, lock screen, app switch) → solo round pauses and autosaves; ranked keeps the server clock.
- Menu to Settings and back mid-round → the round is preserved and paused.
- Reload on the Result screen → show the result again or return Home with the result saved, never lose the finished run.
- Open a share link (`/s/<seed>`) while a round is active → ask whether to leave the current round; never silently discard it.
- Open a share link made with another engine or theme version → regenerate with the recorded version if available, otherwise offer a fresh puzzle with a clear message.
- Duplicate tab or two tabs on the same round → one tab owns the round; the other offers Take over.

## 2. Time

- Simple-build regression: Memory's mismatch hold and preview hide transition consume visible time only; hidden time does not remove the player's remaining hold. An initially hidden mount does not start the preview (`src/lib/ui/active-delay.test.ts`, `tests/e2e/reliability.spec.ts`).

- Device clock moved forward or back, or timezone or DST change → durations use a monotonic clock; wall-clock time is used only for display and daily resets.
- Sleep and wake, or background timer throttling → elapsed time comes from timestamps, not tick counts; a countdown that expires while hidden is evaluated on return.
- Countdown reaches zero in the same instant as the last match → deterministic rule (documented in the puzzle spec); ties never produce negative or double results.
- Daily seed rollover at 00:00 UTC while a player is mid-round → the round keeps its original day's seed.
- Player in a far timezone sees the daily reset at a local time that is not midnight → show the reset time clearly.

## 3. Input

Connect v1.1: an out-of-range, diagonal or foreign-endpoint step, a repeated
cell, a move after win, or a nonmonotonic stroke/timestamp is rejected by the
pure reducer and server replay. Crossing another path cuts its tail; restarting
a previously connected pair incurs exactly one redraw penalty for the stroke.
An all-pairs board with empty cells still wins; only full coverage receives the
grid bonus. The result reports its fill percentage.
Pointer cancellation ends a stroke, while resize leaves the seeded board and
paths intact. `puzzles/connect/logic.test.ts` and `tests/e2e/connect.spec.ts`
cover the main reducer and browser flows.

- Simple-build regression: a failed seed draw must not consume the next puzzle family; retry still starts that family. Two synchronous Play activations start one round only (`tests/e2e/reliability.spec.ts`).
- Simple-build regression: Block drops use the final release coordinates; secondary pointers cannot replace the active drag; lost capture or window blur cancels it; repeated Enter/Space cannot select and place unintentionally (`tests/e2e/reliability.spec.ts`).

- Double or triple tap, or rapid taps before an animation ends → input is ignored or queued by the puzzle's state machine; state never corrupts.
- Tap during the mismatch flip-back delay → ignored (or handled per spec), never a third revealed card.
- Multi-touch, pen and mouse mixed, pointer cancel or touch cancel → clean cancel; no stuck drag state.
- Drag leaves the viewport, drops outside the board, or loses focus mid-drag → piece returns to its origin.
- Orientation change or window resize mid-drag or mid-animation → layout reflows; the drag cancels or continues safely.
- Long press, text selection, context menu, double-tap zoom, pinch zoom, pull-to-refresh, edge-swipe back on iOS → suppressed on the play surface where it would break play.
- Keyboard repeat, Enter or Space on focused controls, and focus loss → no double activation.

## 4. Storage

- Simple-build regression: when writes fail but old disk data remains readable, the latest in-memory best and sound setting take precedence. A previously read best survives later storage blocking, and malformed score strings are discarded (`src/lib/ui/storage.test.ts`).

- IndexedDB unavailable, blocked, or in private mode → in-memory fallback with a one-time notice.
- Quota exceeded → drop the oldest history first, keep settings and bests, and warn once.
- Schema upgrade blocked by another open tab (`onblocked`) → ask to close other tabs; do not corrupt data.
- User clears site data mid-round → the app continues in memory and recreates storage on the next save.
- Safari deletes script-writable storage after 7 days without interaction → treat local data as a cache; prompt account creation earlier on Safari; the anonymous id is a server-set cookie.
- Corrupted or malformed checkpoint, or one written by a newer app version → discard safely and offer a new puzzle.
- Two tabs write at once → last write wins per record with a version field; no merged garbage.
- Cookies blocked → the anonymous id falls back to a session id; analytics degrade gracefully.
- Very long history → capped (for example the latest 100 runs).

## 5. Network

- Offline mid-round or at submit → solo keeps working (the app is already loaded); ranked is unavailable with a clear message; submissions queue in `pending` and retry with backoff. Offline at start works only after a service worker is added (parked), so a reload while offline fails until then.
- Slow connection, request timeout, or a captive portal returning HTML → timeouts, JSON validation, and a safe fallback to solo.
- Duplicate submit caused by a retry → idempotent by session id; at most one score.
- Server 5xx or 429 with `Retry-After` → backoff; never a tight retry loop.
- Ad blockers block GA4, fonts, or analytics endpoints → the game still works; analytics fail silently.
- Stale chunk after a deploy, or old HTML with new chunks (version skew) → detect, offer a reload, and keep the round checkpoint (SvelteKit 3 polls for a new deployment by default, about hourly).
- CDN serves a cached page while the API has changed → API versioning and graceful "please refresh" handling.

## 6. Engine

Connect v1.1: 1,200 seeded full-grid witnesses have distinct cells, orthogonal
steps and segments of at least three; a replayed witness wins. The witness is
never consulted for a player's win. Known board/score vectors for all three
bands run in six runtimes; local D1 replays ranked strokes and rejects an
incomplete log. Per-puzzle move caps prevent unbounded replay work.

V1 selector regressions (2026-10-24): both starting families must be reachable;
a failed seed/generation attempt retains the pending family; repeated peeks do
not consume it. Every eligible family appears exactly once per cycle, with the
minimum gap preserved across refills. Unequal weights affect cycle position,
not frequency; zero disables a family; invalid/duplicate/overflowing data fails
closed. `src/lib/selector.test.ts` covers these, including synthetic larger
family indexes. Browser fixtures inject entropy only in the browser test
process, never through a shipped family-selection bypass.

- A seed above `2^63 - 1` stored in a database → seeds are TEXT columns, never INTEGER (SQLite integers are signed 64-bit).
- Seed `0`, seed `2^64 - 1`, leading zeros, whitespace, negative, non-numeric, or enormous digit strings → validated; invalid seeds are rejected, never coerced.
- Difficulty out of range or unknown modifiers → clamped or rejected per spec, never undefined behavior.
- Empty move list, moves after completion, duplicate or out-of-range moves, malformed move objects, or an oversize list → rejected cleanly with a reason.
- Generation fails its solvability check → deterministic re-roll (bounded), then a known-good fallback puzzle.
- Symbol set smaller than the pair count, or a layout that does not fit 320x480 → generation constrains itself; never ships a broken puzzle.
- Theme generation fails → verified preset fallback.
- Determinism across engines (V8, JavaScriptCore, SpiderMonkey, Workers) → test vectors in all of them.
- Engine version mismatch between a saved run and the current engine → the run is labeled unreplayable, never mis-scored.
- Extremely long game (thousands of moves) → performance cap and a move limit.

## 7. Rendering and accessibility

Connect v1.1: dot pairs always use a generated symbol as well as color. The
board and its own dot-path backdrop fit phone portrait, short landscape and
desktop; compact backdrops hide and wide layouts show 1–5 objects per side.
The Card gate blocks early input, and a fixed visible-time deadline owns
Connect readiness. Nine original static sounds exist for its actions; starting
muted prevents audio fetches, and enabling sound loads them. These are covered
by `tests/e2e/connect.spec.ts`; real-phone gesture and audio quality review
remain open.

Card-to-board backdrop regression (2026-10-29): while the Card unfolds, its
transformed frame is narrower than the final board. Measure scatter bounds
when the backdrop becomes visible, then on resize, so objects stay outside the
board. The 1920×923 Block WebKit check caught this; repeated WebKit and
cross-browser rechecks pass in `tests/e2e/themes.spec.ts`.

V1.1 owner screenshot regression (2026-10-26): a 1920×923 viewport previously
kept the panel near 642×472 and Memory's cards capped at 440px wide. Size from
the viewport/container instead. Desktop panel height must reach 70% of the
viewport, with at least 95% use of the board's limiting container dimension;
header/box/bottom-panel gaps, full-width flush bottom anchoring, no scroll and
corner chrome are asserted in `tests/e2e/themes.spec.ts`. The four required
viewports plus 1920×923 and 360×640 run in Chromium/Firefox/WebKit. Non-rectangular
cards retain an outer keyboard focus ring; their symbols are checked at 24px
in solid and outline styles. Zero-score completed games do not regain NEW.

V1.1 theme failures: eight inaccessible palette attempts → documented verified
preset; eight freshness misses → last accessible candidate, with violation rates
reported. Blocked Worker → logged synchronous deterministic fallback; unmount →
terminate the worker; blocked IndexedDB → latest-three memory history. Cosmetic
metadata never changes game scores or legal moves. Legacy queued runs without
theme metadata remain valid. See `engine/theme/theme.test.ts`,
`ui/solo-theme.test.ts`, `ui/theme-history.test.ts`, and D1 run integration tests.

Oct 25 design demo checks (`bun run test:demo`): bounded scatter stays outside
foreground safe zones, never creates links/focus targets and re-deals only on
visits/resize; Home/footer fit short phones; door Play commits a round once;
columns leave during play; help traps/restores focus and closes on Escape;
results appear before returning to ready guides; missing/disabled/reduced
motion cannot block a logical state change; mobile result order is score,
Next, statistics, sign-in; profile tabs work by keyboard and each game has one
row. These are synthetic demo checks, not application acceptance or device
measurements.

Phone follow-up: both families are forced in tests for direct door and Mix
play at 390×844, 844×390, 667×375, 568×320, 320×568 and 320×480. Assert the
actual board centre, usable landscape size, full control visibility and tap
reachability without scrolling. Rotation must retain a revealed card/placed
cell. Frame samples check a single monotonic Home arrival over 1.5 seconds,
no early flash, one-second door presentation, half-second help opening/closing
and no transition overflow.
Switching reduced motion on during arrival must restore visibility and clear
decorative overlays; missing animation must still allow play.

- 320 px wide phones, 4K screens, 200 percent browser zoom, large system text → no clipped controls or overflow.
- Forced colors or high contrast, reduced motion, color blindness → playable; never color alone.
- Right-to-left locales, very long translations, missing translations → logical CSS, text expansion room, fallback to English.
- Missing or failed font → fallback stack with no layout break.
- Safe areas (notch), browser UI collapsing (dynamic viewport height), foldables → content stays clear of system bars.
- Screen reader and keyboard-only play → results announced with `aria-live`; focus trapped in overlays and restored on close.

## 8. Server and auth (Phase 3)

Post-round account entry regression (2026-10-23): completing either real game as a guest must reveal the sign-in option without blocking Next. A signed-in result links to the account instead. The saved local best survives navigating to sign-in, and the result must not claim a cloud save before synchronization exists. Coverage: `tests/e2e/accounts.spec.ts` and `tests/e2e/layout.spec.ts`.

Local account regressions (2026-10-23): `tests/integration/accounts.test.ts` and `tests/e2e/accounts.spec.ts` cover signed/tampered/expired/revoked sessions, two-account isolation, concurrent case-insensitive public-name claims, retries after a name conflict, session freshness before deletion, sign-out and deletion revocation, and password registration being disabled. `src/lib/server/request-body.test.ts` covers oversized bodies without Content-Length. A name field must retain edits after an error, and it is disabled while its request finishes so pending-state rendering cannot reset a new edit.

- Session expires mid-round → play is not interrupted; re-authenticate after the result and claim the run.
- Logged out in another tab, account deleted mid-round, or user banned mid-round → the round finishes locally; submission is refused with a neutral message.
- Another user's session id submitted, an old submission replayed, or a tampered timestamp → rejected and logged.
- Double submit or concurrent submits (race) → the unique session constraint and the atomic batch allow exactly one score.
- D1 error mid-batch, or a partial failure → the whole batch rolls back; the client sees a retryable error.
- Deploy during an active session (client/server version skew) → versioned API; old clients get a clear upgrade message.
- Turnstile unavailable → degraded mode with stricter rate limits, never an open door.
- Password reset replay, OAuth cancel, or undelivered email → safe single-use tokens and clear messages.

## 9. Payments (Phase 4)

- User pays and closes the tab → the webhook grants the entitlement; the next visit shows it.
- Webhook arrives before the redirect, arrives twice, or arrives out of order → idempotent by payment id; statuses only move forward.
- Partial, under, or over payment; expired invoice paid later; wrong currency → recorded, never granted automatically (only `finished` grants), and visible in the admin reconciliation view.
- Refund after grant → entitlement revoked with an audit record.
- Signature failure, or sandbox and live keys mixed → rejected and logged; separate keys per environment.

## 10. Multiplayer (Phase 5)

- Socket drops, or the opponent leaves → reconnect with resume; after the grace period, end per the rules.
- Both players finish in the same millisecond → deterministic tie-break.
- Durable Object restarts or evicts → state restored from storage.
- Stalling or griefing → timeouts and forfeits.

## 11. Anti-cheat

- Modified client, replayed submissions, bots with human-like timing → server replay, signed single-use seeds, and anomaly flags.
- Seed shopping (starting many ranked sessions and abandoning the hard ones) → caps on session starts, one active ranked session per account across all families, and abandoned sessions counted.
- Multi-account farming → Turnstile, rate limits, and review tools.
- Usernames with HTML, scripts, or look-alike Unicode → escaped everywhere, normalized for uniqueness, and run through the profanity filter.
- Two submits of one session at once, a start racing a submit, a Worker crash between the claim and the insert, or expiry during scoring → at most one score; a retry with the same payload returns the same result; a different payload is rejected (plan section 9.2).

## 12. Analytics and consent

- Consent withdrawn mid-session or the opt-out toggled → stop sending immediately.
- Duplicate events, or bots inflating numbers → de-duplicate and filter known bots.
- A share URL contains the seed → GA4's automatic `page_location` is overridden or the route is excluded.
- Personal data in an event (username, email) → never allowed; schema validation rejects it.

## 13. SEO and crawlers

Privacy-page regressions (2026-10-23): `/privacy` is public, prerendered, and readable without JavaScript or a session. The build hook must skip Worker binding reads during prerendering. Draft publication issues stay visible with `noindex`; the page must not claim implemented children's safeguards or retention schedules that do not exist. Home/account links remain available at the approved widths, the footer stays out of gameplay, and visiting the static document preserves signed-in access on return. Coverage: `tests/e2e/privacy.spec.ts`, the static-document navigation case in `tests/e2e/accounts.spec.ts`, the production build and isolated built-Worker smoke.

- A prerendered page is served by the CDN without running the Worker → no cookie is set; the page requests a tiny endpoint to create the anonymous id (or `run_worker_first` is set for HTML routes).
- Crawlers without JavaScript → landing pages render server-side or prerendered.
- Seed share pages becoming a crawl trap → `noindex`, not in the sitemap, not linked.
- Locale pages with conflicting canonicals → one canonical per locale with `hreflang`.

## 14. Operations

- Cloudflare, D1, or KV outage or stale data → solo play keeps working; ranked degrades with a clear message.
- Free-plan daily limits reached (Workers Free) → the reason to be on Workers Paid from Phase 3; alerts before limits.
- Cost spike or abuse traffic → rate limits, caps, and billing alerts.
- Secrets rotated, migration fails, or a rollback is needed → documented runbook and a tested restore.
- Domain or certificate expiry → calendar reminders and monitoring.

## 15. Gameplay rules

- First-ever round → easy band; the result says "New best" with no previous best.
- "So close" threshold → defined numerically per puzzle in its spec.
- Score ties, negative scores, and absurdly fast finishes → defined, clamped, and flagged.
- Difficulty progression bounds (minimum and maximum band) → never out of range; abandonment rules as in section 11.13 of the plan.
- Failed round → Try again versus Next (pending owner decision in `docs/IDEAS.md`).
- Daily puzzle played twice → only the first attempt counts for ranking.
- Block placement: no tray piece fits after the opening turns → the run ends as `ended` and is scored. During the opening turns every refill includes at least one fitting piece (plan section 7, Phase 1B rules).
- Block placement: a clear completes a row and a column together → the union of both lines clears once, both count toward `lines`, and the combo increments once.
- Block placement: a placement clears nothing → the combo resets; a placement clears one or more lines → the combo increments and the score uses the score formula.
- Block placement: the third tray piece is placed → the tray refills immediately; the next tray is checked for a fit only during the opening turns.
- Block placement: the board fills exactly at the 300th placement → the run ends as `ended` with the cap reason and the tray is not refilled.
- Block placement: invalid tap or drop → the piece stays in the tray (or remains selected), the invalid slot shakes, and the live region announces the failure; no board cell changes.
- Block placement: drag leaves the board, pointer cancel, page hidden, or resize/orientation change → the drag and ghost cancel; the round is unchanged and the next input starts cleanly.
- Block placement: input during a clear or settle animation → ignored by the busy guard; no double placement or third tray activation.
- Block placement: the last clear or placement ends the run → the clear animation finishes, the board dims, and the result appears after the scored state is final.
- Block placement: keyboard placement → focus returns to a playable tray slot after the animation, except at the end when the result takes over.
- Block placement: refresh or close mid-run → the run is abandoned and no score is saved; there is no resume in v1.
- Block placement: block and Memory bests → stored under separate keys; clearing or changing one never changes the other.

## 16. Rotation and selection

V1.1 preparation during animation (owner, 2026-10-27): prepare one next solo
candidate during the current entrance, without consuming the selector peek or
reserving a ranked start. On Next use that candidate only for the pending
family; ranked issuance still supplies its own seed/theme. Slow preparation
shows a neutral face-down loading card without revealing the next family.
Failed speculation is caught/logged, then gets one foreground retry; failure
retains the family and finished result with Retry/Next and Home available.
Worker waits and IndexedDB opens/transactions are bounded. Navigation aborts
preparation and ignores late completions; duplicate Next cannot commit twice.
Reduced/failed motion never controls readiness. See `ui/prepare-ahead.test.ts`,
`theme-history.test.ts`, `tests/e2e/preparation.spec.ts` and `card.spec.ts`.

V1.1 backdrop isolation (standing owner rule, 2026-10-27): in-play decoration
contains only current-puzzle objects. Every Memory round has cards; every Block
round has actual block-piece shapes. Legacy `none` snapshots get seeded own-item
scatter, never another game's motifs. Owner update (2026-10-28): compact/mobile
portrait and landscape hide the object layer; wider layouts show a seeded random
1–5 own objects per side, scattered in two dimensions throughout the exposed
background space rather than fixed columns or regular rows. Keep the approved
background blend.
Rotation/reflow must update visibility without changing puzzle state. All motifs stay at
20% opacity outside header/bottom bands, with effective contrast ≤1.25. Future
puzzle briefs must declare and test their own allowed objects; mixed-game
decoration is Home-only. See `ui/puzzle-backdrop.test.ts`, `themes.spec.ts` and
`docs/puzzles/_TEMPLATE.md`. The Card/played stack are session chrome.

Actual Card integration (owner approved, 2026-10-28): mount the game with
entrance deferred. The Card's logical deadlines, independent of Anime callbacks,
release each puzzle's own entrance; never start Memory preview/time under the
folded Card. Visibility pauses Card deadlines; resize/reduced motion settles
visual state without losing the logical phase. Abort resolves pending UI waits
and cannot commit a late candidate. Save completion before any fold/result
presentation. Failed Next restores the finished result and pending family;
repeated Next commits one round. Record ranked flip/unfold allowance on issuance,
with zero for legacy sessions; never accept opening time from a client payload.
The session stack is bounded chrome, not a saved-history copy.
When resizing across Memory's four/five-column boundary, measure after the
reactive layout update and without CSS size transitions. Even a tiny global
reduced-motion transition can return the previous width in Firefox/WebKit.
Check useful desktop width and unchanged round/card identity, not only viewport
fit; a tiny board can pass a no-overflow test.

V1.1 Card random arrival (owner, 2026-10-28): every new Card, including after
Next, starts at a fresh random viewport edge position and rotation. Entry
settles at the stage centre; unfolding stays centred, and finishing folds into
the played stack. Reset every transform channel between phases so a cached
entry translation or prior scale cannot leak into unfold/fold/replay. Cosmetic
entropy must not consume puzzle selector/seed draws. Reduced motion and failed
entropy settle to the static Card without blocking preparation. Check distinct
origins across Next while retaining the accepted result exit and single frame.

V1.1 Card review regression (owner, 2026-10-27): enlargement must not fade out
a small board and insert a second full board. Keep one frame node, expand its
geometry continuously, then retain the puzzle's own arrival. Memory's random
travel precedes a full three-second preview and hide. Fold-away must leave no
visible animation child covering the central score/statistics/Next result.
Test frame identity/count and monotonic expansion, random travel, preview time,
hidden-page pause, reduced motion, result visibility and four viewport sizes.
See `tests/e2e/card.spec.ts`; actual game timings remain covered separately by
`entrance.spec.ts`.

Desktop result review (owner, 2026-10-27): a desktop result must use the available
width rather than repeat the phone stack. Keep score/high score/stats separate
from the Next-card column. Decorative result entrance must not delay readiness,
change score text, or break an immediate Next. Cancelling it, switching reduced
motion, or rotating retains the logical result. Test desktop columns, phone/
landscape fit, animation presence, static fallback and an interrupted entrance
in `tests/e2e/card.spec.ts`.

Final result review (owner, 2026-10-28): do not replay a completed result
on visibility resume or layer multiple reveals. Only the large earned-score
number gets a single 500 ms digit scramble. The panel itself fades/rises once
over 420 ms after fold-away (owner follow-up). Early Next captures current
opacity/translation before cancelling entrance; the accepted exit must not
flash back to full opacity. Reduced motion settles the panel immediately. The heading, “Your score”, high
score, stats and Next stay static. Install the aria-hidden score overlay before
the first visible frame; keep final accessible text/layout and Next's name
stable. Restore the original nodes once, including on cancellation or reduced
motion. Do not expose the final score, hide it, then replay a reveal. Next
locks duplicate activation, prepares during the accepted 350 ms exit, then
deals the next Card. Static motion skips travel without delaying readiness.
`card.spec.ts` samples the first score frame, resolve duration, static labels,
visible departure, preparation overlap, distinct Card origins and no replay.

- Only one eligible family → repetition is allowed; no error.
- Every family disabled, excluded by the player, or turned off by a kill switch → show the unavailable state with Home and Retry (plan section 11.14). No family is served as a fallback, including a default one, so no kill switch is bypassed.
- The prepared next family fails to load → pick another family (bounded retries) and keep the player moving.
- The bag's remaining families are all excluded by the gap rule → one of them swaps with an earlier pick in the same cycle, so each family still appears once per cycle.
- A weight of zero or a negative weight → treated as disabled; invalid config is rejected with safe defaults.
- A new family is added mid-session → it joins at the next cycle; the discovery boost applies once.
- The player chooses Stay, then the family is disabled → fall back to Mix with a short message.
- Two eligible families → strictly alternate (that order is fixed by design); the seed decides which family starts and each round's variant and seed; never the same family twice in a row.
- A returning player's history is cleared → rotation restarts, and the first-impression rule applies only to brand-new players.
- The selected variant does not fit the viewport (for example landscape-only on a small portrait phone) → choose another variant or family.
- Theme freshness cannot be satisfied in 8 candidates → accept the last candidate that passes the accessibility checks (otherwise the verified preset); never block a round.
- Simple build rotation → the first round is Block, then Memory, then Block; Play and Next use the same selector so the family never repeats in a row; a reload restarts at Block and rotation history is not persisted; both families use seeded themes, chosen independently from each round seed; Home Best follows the family Play will start.
- Memory theme randomization → the same four theme ids as Block; the seed picks the theme and changes the backdrop, card back/edge/face/matched, back mark, symbol palette, and win confetti; themes are cosmetic and never change pairs, symbols, the timer, score, or replay; shape still carries the match, so color is never the only cue.

## 17. Responsive layout and the landing page

- A 1440x900, 1920x1080, or 2560x1440 window → the board scales per its layout profile and never looks like a phone layout in a large screen.
- Window resized across a profile threshold mid-round → the view re-lays out without losing state or restarting the arrival animation.
- Ultrawide or very short windows (for example 1280x400) → the board fits the shorter side; controls stay reachable.
- Browser zoom at 200 percent on the landing page → content reflows, and the page scrolls rather than clipping.
- A tablet in both orientations → the matching layout profile loads without a reload.
- A foldable changes size mid-round → treated as a resize.
- Landing page on a very small phone → h1, tagline, Play, and links only; scroll is allowed if they do not fit.
- Arrival animation interrupted by a fast tap, a resize, or a resume → the round starts in a consistent state with input enabled.
- A player starts a round on a phone and opens the game on a desktop (same account) → the round is not offered there, because its checkpoint lives in the phone's IndexedDB (plan section 11.13). The desktop shows Home with New puzzle. The logic and seed are identical on both devices, so a share link or a finished run reproduces the same round, and only the layout differs.

## 18. Stage modes, columns, and tutorials

- A puzzle declares `wide` or `full` but the viewport is a phone → the manifest's phone profile applies (portrait reflow or `centered`); the puzzle is never clipped.
- The window crosses 1280 px or 1024 px mid-round → the columns collapse into drawers (or expand) without losing state or restarting the arrival animation.
- Side column content is longer than the column → it scrolls inside the column, never the stage.
- Dimmed column content and a focus or hover → it returns to full emphasis, and keyboard focus is never lost.
- A drawer is open and the round resumes or the tab changes → the drawer closes without altering the round.
- A coach mark's target is not visible after a resize or rotation → the mark repositions or is skipped, and Play is never blocked.
- A tutorial was completed on one device and the player signs in on another → coaching is per device unless synced; replay stays available from the menu.
- A layered puzzle (depth cues) is viewed in forced-colors or high-contrast mode → pieces stay distinguishable through outlines and stacking order.
- A `canvas2d` or `pixi` puzzle fails to initialize (no WebGL, out of memory) → the puzzle's fallback renderer or the standard failure path, never a blank stage.

## 19. Block placement Step 4 polish

- First-ever round before the first placement → the full hint shows as one line at 320, 360, 390, and 768 px widths; it never wraps or scrolls the page.
- After the first placement in the first round → the hint becomes "Fill a row or column."; it stays visible and does not jump the footer.
- Second and later rounds → no hint footer; the board and tray keep their positions.
- First round abandoned before a placement → the first-run marker was already saved at start, so the next start has no hint. This is intentional first-run behavior.
- `localStorage` blocked or private → the hint marker falls back to memory, the game still plays, and the hint is suppressed for the rest of the session; a reload may show it again.
- First visit in short landscape → the compact layout hides the hint; the board, tray, and result stay usable. This is a known owner-review question, not a blocker.
- Same seed opened again → the same theme; all four themes are reachable and the theme never affects legality, clearing, score, or replay.
- Theme list changed later → the seed-to-theme mapping may change, but the board, pieces, and score do not; themes are cosmetic.
- Theme board changes → each theme's empty cells and edge stay above the approved 1.239:1 cell/backdrop and 1.31:1 edge/backdrop floors; the picker tray/slot stay above 1.04:1 tray/backdrop and 1.12:1 slot/tray; the board remains visible without becoming a dark slab.
- Theme picker changes → the vertical picker panel and slots take the theme tray/slot tints, mini pieces keep the theme piece colors, and HUD/corner chrome stay neutral.
- HUD with Best 500 and Round 14 at 320x480 or 360x640 → Round and Best stay on one meta line, do not overlap the stats, and the page does not scroll.
- A line clear → each cleared filled cell scales to 1.08 then shrinks/fades over 1440 ms with a 0–56 ms row/column wave while the board cell and edge stay visible; there is no full-line wipe or flash; the board updates once after the 1500 ms busy window; rapid taps during it are ignored.
- A clear completes both a row and a column → both cell waves run once, the wave uses the smaller delay for each cell, the board cells persist, and the combo increments once.
- Invalid board tap → the cell gets a danger outline and 220 ms shake, the board is unchanged, and the tray remains selected; reduced motion removes the shake but keeps the outline.
- Reduced motion → clear fill/wave, invalid shake, pick pop, score/streak bump, settle, arrival, and tray motion are disabled; cleared fills disappear immediately while the board cells keep their themed static colors and the result still appears on time.

## v1 integration regressions (2026-10-26)

- Memory arrival consumes 3/4/5 visible seconds for 6/8/10 pairs; all cards stay
  face up for a further 3 seconds, then hide before input and the timer begin.
- Hidden entrance/preview/hide pauses its deadline; reduced-motion changes
  reveal safely. Ranked openings keep the server-known fixed deadline, even
  with travel disabled. Cosmetic entropy failure cannot block readiness.
- Block rejects early placement until its 3-second arrival settles; drag
  geometry uses the same gaps as rendering. Rotation reflows without a new run.
- A dialog backdrop click dismisses, inside clicks remain open, and an inside
  drag released outside does not dismiss. Pending account mutations retain the
  dialog; focus returns after closing. App and accepted demo share this rule.
- Empty profile history has no fabricated list row; zero-point completed rounds
  show a real zero. Settings does not hide save failures or guest-import notices.
- Ordinary players receive 403 on every operator page/action. Two-factor replay,
  short/expired grants, cross-origin writes and missing per-action permissions
  fail closed. Recovery is single-use; operator-account/last-admin guards apply.
- Gameplay measurement starts only after opt-in, obeys DNT/GPC, accepts strict
  coarse fields and stops on withdrawal. A blocked provider/asset never blocks play.
- A pre-existing local server can occupy a smoke-test port; the built Worker
  check allocates its own port and refuses to pass against the wrong service.

Coverage: `tests/e2e/entrance.spec.ts`, `dialogs.spec.ts`, `operator.spec.ts`,
existing account/recovery/layout tests, `tests/integration/operator.test.ts`,
`src/lib/server/measurement.test.ts`, and `scripts/check-worker.ts`.

## Engine refactor Slice 2: lazy views

Only the foreground selected view is imported; preparing the next solo round
uses its headless manifest generator. A rejected or eight-second stalled view
load enters the existing failed-start path without consuming the selector draw
or discarding a finished result. Navigation cancels the wait and ignores late
imports. Code loads before any ranked seed is issued. Check the Slice 2 unit,
client-bundle and lazy-registry browser regressions.

## Engine refactor Slice 3: catalog validation, config and ranked ownership

- A manifest-only family supplies move parsing/canonical field order, replay,
  scoring fields, leaderboard groups and ranked presentation/minimum timing.
  Unknown families, malformed moves and client-supplied scores still fail closed.
- Missing catalog lifecycle rows are inserted without changing existing disabled
  or deleted rows. Family ids are plain text, including anonymous measurements.
- Live config pointers and lifecycle/lock enforcement read D1. Only validated
  immutable version snapshots use KV. Corrupt/missing cache entries read D1;
  cache outages do not block a valid D1 read. Missing/invalid/unreachable live
  config uses code defaults; invalid versions follow a bounded parent chain.
  An explicitly issued historical scoring version never substitutes new defaults.
- Two browsers starting the same account, even different families, produce one
  active ranked session. The losing browser shows the conflict and offers
  takeover. An explicit exact-id takeover and issuance commit together; a failed
  issuance leaves the old session valid. Stale takeover/abandon requests cannot
  release a replacement. Cross-family departures count toward the abandon cap.
- A valid claimed unfinished replay holds the lock until completion or the two-hour
  expiry and cannot be abandoned. Identical claimed retries survive expiry and
  later starts. A completed result remains idempotent. Legacy older unclaimed
  tokens are marked abandoned during migration; claimed retries are preserved.
- Terminal replay/timing rejection releases only that session's lock and counts
  toward the abandon cap. Its hash and claim time remain fixed, so retrying the
  rejected payload cannot release a replacement. Transient storage failures keep
  valid claims locked and retryable; a failed rejection-cleanup write is retryable.
- Home sends an explicit ranked abandon independently of optional activity
  reporting. Closing a tab does not rely on unload handlers; the next start
  shows the conflict and the server TTL remains authoritative.

Coverage: `tests/slices/slice3-catalog-server-validation.test.ts`,
`tests/integration/runs.test.ts`, and the two-browser case in
`tests/e2e/accounts.spec.ts`. Theme/style readers are storage contracts for
Slice 5; the existing generation and selector algorithms remain unchanged.

## Engine refactor Slice 4: selector continuity and eligibility

- Each stable eligible set completes a weighted cycle with each family exactly
  once; the last `clamp(floor(eligible / 3), 1, 5)` picks stay excluded across
  refills. A sole eligible family may repeat. Greedy repair never backtracks.
- Discovery doubles only never-completed families' ordering weight. Completion
  removes the boost at subsequent refills without duplicating a family.
- The generated small index supplies manifest orientation and viewport limits;
  lifecycle/weight exclusions also apply before a round. Empty eligibility uses
  the existing unavailable/Retry/Home path, without serving a fallback family.
  Orientation changes affect the next round, never the active puzzle.
- Reload restores the same queue, recent families and cycle position from the
  guest/account key before making the next successful draw. Guest and separate
  accounts do not share a selector cycle. This supersedes the historical simple
  build's reload-reset behavior in section 16 above.
- Corrupt, stale, duplicate or inconsistent saved state resets safely. Blocked
  storage retains session memory and logs the persistence failure; storage
  clearing or switching browsers restarts continuity and is not anti-cheat.
- A failed or stalled lazy procedural pool/view load preserves the pending
  family and completed result. Preparation can load only a pending pool, and
  never consumes a selector draw or reserves a ranked session.

Coverage: `tests/slices/slice4-selector-property.test.ts`, existing selector and
preparation units, and the focused `tests/e2e/selector-reload.spec.ts` refresh test.
Full browser/account/palette checks are deferred to the authorized later milestone.

## v1.3 Memory variants

- Legacy omitted variant → classic with the same generated deck, payload hashing and replay. Unknown/foreign-family variant, ranked variant substitution and signed-in solo start substitution → reject. Variant survives pending completion, checkpoint and ranked resume.
- A failed preparation retains the selector's family and pending variant; speculative preparation does not consume a variant draw or ranked reservation. With only one enabled variant, repetition is allowed; with none, remove the family and keep rotation usable.
- Disable during a round → the issued round can finish; new issuance is blocked by the same conditional statement. Family state remains independent; re-enable has reason/confirmation/audit.
- Trios: two revealed cards are not an attempt; the third decides match/mismatch. The final allowed attempt may win; an unfinished cap disables flips, preserves the board, exposes Home recovery and never saves a completion. Cap text remains visible in the integrated shell and three emulated viewport sizes.
- Moving: all currently revealed and matched positions stay pinned. Draw accounting includes RNG rejection draws; mismatch hiding consumes no draws. Replay and partial resume reproduce the same stream.
- No-preview: no preview/hiding phase or exposed opening faces, including a resumed round; game-opening allowance is zero and help/result labels retain the variant.
- Statistics: zero flips are ignored, a played unknown exit is open, and an explicit played departure is abandoned. A delayed first-flip report must still classify played after Home. A registered completion supersedes departure; imported guest completions never enter the reconciled cohort and no starts are backfilled.
- Score edits/rollbacks: pair variants share a config, trios stays separate; conflict checking and immutable history apply. Existing rows/scores/counts remain; live eligibility follows the new live version. Test fixture cleanup must append a rollback, never rewind a live pointer to a parent that already has a child.
- Admin test play: operator auth before noindex; explicit disabled-variant selection works. Same view/engine/replay, zero ranked/session/completion/activity/leaderboard writes. Public selector and public navigation never expose the test picker.

Evidence: Memory variant/plumbing units, `tests/integration/memory-variants.test.ts`, `tests/e2e/memory-variants{,-admin}.spec.ts`, six-runtime `tests/vectors/memory-*`; final results in `docs/V1.3_WORK.md`.
