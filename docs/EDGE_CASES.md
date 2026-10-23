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

- Device clock moved forward or back, or timezone or DST change → durations use a monotonic clock; wall-clock time is used only for display and daily resets.
- Sleep and wake, or background timer throttling → elapsed time comes from timestamps, not tick counts; a countdown that expires while hidden is evaluated on return.
- Countdown reaches zero in the same instant as the last match → deterministic rule (documented in the puzzle spec); ties never produce negative or double results.
- Daily seed rollover at 00:00 UTC while a player is mid-round → the round keeps its original day's seed.
- Player in a far timezone sees the daily reset at a local time that is not midnight → show the reset time clearly.

## 3. Input

- Double or triple tap, or rapid taps before an animation ends → input is ignored or queued by the puzzle's state machine; state never corrupts.
- Tap during the mismatch flip-back delay → ignored (or handled per spec), never a third revealed card.
- Multi-touch, pen and mouse mixed, pointer cancel or touch cancel → clean cancel; no stuck drag state.
- Drag leaves the viewport, drops outside the board, or loses focus mid-drag → piece returns to its origin.
- Orientation change or window resize mid-drag or mid-animation → layout reflows; the drag cancels or continues safely.
- Long press, text selection, context menu, double-tap zoom, pinch zoom, pull-to-refresh, edge-swipe back on iOS → suppressed on the play surface where it would break play.
- Keyboard repeat, Enter or Space on focused controls, and focus loss → no double activation.

## 4. Storage

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

- 320 px wide phones, 4K screens, 200 percent browser zoom, large system text → no clipped controls or overflow.
- Forced colors or high contrast, reduced motion, color blindness → playable; never color alone.
- Right-to-left locales, very long translations, missing translations → logical CSS, text expansion room, fallback to English.
- Missing or failed font → fallback stack with no layout break.
- Safe areas (notch), browser UI collapsing (dynamic viewport height), foldables → content stays clear of system bars.
- Screen reader and keyboard-only play → results announced with `aria-live`; focus trapped in overlays and restored on close.

## 8. Server and auth (Phase 3)

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
- Seed shopping (starting many ranked sessions and abandoning the hard ones) → caps on session starts, one active session per type, and abandoned sessions counted.
- Multi-account farming → Turnstile, rate limits, and review tools.
- Usernames with HTML, scripts, or look-alike Unicode → escaped everywhere, normalized for uniqueness, and run through the profanity filter.
- Two submits of one session at once, a start racing a submit, a Worker crash between the claim and the insert, or expiry during scoring → at most one score; a retry with the same payload returns the same result; a different payload is rejected (plan section 9.2).

## 12. Analytics and consent

- Consent withdrawn mid-session or the opt-out toggled → stop sending immediately.
- Duplicate events, or bots inflating numbers → de-duplicate and filter known bots.
- A share URL contains the seed → GA4's automatic `page_location` is overridden or the route is excluded.
- Personal data in an event (username, email) → never allowed; schema validation rejects it.

## 13. SEO and crawlers

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
