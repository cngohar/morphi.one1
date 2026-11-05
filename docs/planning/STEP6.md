# Step 6: Accounts, saved progress, and leaderboards

Status (2026-10-23): local implementation delivered and under final verification, with owner acceptance/real-device review still pending. The owner confirms local Google OAuth works and authorized completing saved history, ranked replay, leaderboards, and the small per-puzzle structural cleanup. See `STEP6_WORK.md`, `STEP6_MEASUREMENTS.md`, and the newest `PHASE_REPORTS.md` entry for evidence and limits. Earlier first-slice notes below are historical. Global-release planning, including the proposed web admin panel, follows local acceptance; production provisioning and every deployment still need their applicable explicit authorization.

## Scope

Keep immediate guest play and the existing two-game rotation. Add optional sign-in, saved completed-round progress across devices, and leaderboards containing only server-validated ranked scores. Use the locked Better Auth and Cloudflare stack. Read the relevant identity, scoring, failure, and security sections of `PLAN.md` when implementing each slice; do not adopt the entire platform phase as a prerequisite.

Progress means completed results and personal bests. Cross-device continuation of an unfinished round remains parked. Existing browser bests have no move history and cannot become validated leaderboard scores.

## Implementation sequence

1. **Agree the small release.** Choose authentication, define saved progress and leaderboard rules, and prepare Account/Profile/Leaderboard wireframes at 390x844, 844x390, and 1280x800 for owner approval. Keep Play available without registration.
2. **Prove accounts locally.** Verify current official docs and pin compatible dependencies. Exercise Better Auth and a local D1 database with the existing SvelteKit/Worker build before expanding the UI. Then implement sign-in/out, session handling, a minimal public name, and account deletion. Check cancellation, expiry, unauthorized requests, and isolation between accounts.
3. **Save completed progress.** Record sufficient versioned round data for new runs. Add account-owned completed history and per-game bests, idempotent synchronization, and retry after connection loss. Keep local/unranked results distinguishable from verified ranked results. Test two browser contexts using one account and a separate account with no access to that data.
4. **Validate ranked runs.** Issue seeds and expiring sessions on the server; accept bounded move logs and replay the existing pure rules to calculate scores. Use authoritative timing for timed scores. Implement the relevant anti-cheat session lifecycle, including seed-shopping enforcement, concurrent submissions, identical retry recovery, and rejection of conflicting payloads. Verify replay vectors in the Worker as well as the required local runtimes, and measure replay CPU/memory before release. Validate with adversarial cases from `EDGE_CASES.md`.
5. **Build the leaderboard.** Show validated results for comparable game/ruleset groups, with defined tie-breaking, bounded pagination, and the player's position. Memory's 6/8/10-pair games require separate comparable groups or an explicitly approved fixed ranked size; do not silently change its existing scoring. Verify deletion and hidden/flagged results do not leave inconsistent ranks.
6. **Verify and report.** Run lint, type-checking (zero errors/warnings), unit regressions, browser flows, and the production build. Exercise the built Worker locally, offline/reconnect, reload during submission, session expiry, duplicate requests, and account deletion. Record real-phone review, measured validation costs, and remaining limitations. Present the completed local release for review before any remote provisioning or production deployment.

## Approved scope

- **Sign-in (decided):** Google-only for the first release; guest play remains available. No password or transactional email flow in this release. Better Auth’s [Google guide](https://better-auth.com/docs/authentication/google) requires OAuth credentials; checked 2026-10-23. The owner selected this method after the initial planning discussion.
- **Progress:** completed history and per-game bests are the first saved data. Local scores remain unranked; no fabricated migration of old browser bests into validated results.
- **Leaderboards:** one all-time board per game/ruleset group, with Memory split by pair count; no daily challenge. Use the full plan’s earlier-validated-submission tie-break. Only server-validated ranked rounds qualify. Public player names are 3–20 ASCII letters, numbers, or underscores, unique without regard to case; official names are reserved. Deletion removes the account’s saved data and ranked entries. The owner approved the proposed scope and screen behavior.

## Release checks

- Guests can still play both games immediately.
- Sign-in/out, cancellation, expired sessions, and deletion have explicit, recoverable behavior.
- The same account sees saved completed progress on a second device; another account cannot read or modify it.
- Local bests never enter ranked tables as verified scores.
- The server selects ranked seeds and computes scores; malformed, forged, oversized, expired, superseded, and conflicting submissions cannot produce a ranked result.
- Identical retries and concurrent submissions produce one stored result, including interrupted-write recovery.
- A network interruption preserves a completed result for safe retry without double counting.
- Leaderboards compare compatible rulesets and reflect deletion/moderation correctly.
- Required automated checks and local Worker verification pass, with real-device evidence and measured replay limits recorded before release.

Every deployment still requires explicit owner approval under `AGENTS.md`. OAuth credentials, remote databases, and any paid resources require the applicable owner setup/authorization; development starts locally.

## Screen review

Open `http://localhost:5174/demo/accounts.html` while the static preview server is running, or `/demo/accounts.html` through the existing Vite dev server. Source: `static/demo/accounts.html`. Choose the screen, required viewport size, connection state, or signed-in sample. “Open at full size” opens the responsive screen directly.

- Sign in: optional Google sign-in and guest continuation.
- Choose player name: separate public identity from the Google profile; preview validation is illustrative and not a server check.
- Your account: personal bests, recent rounds, connection state, edit name, sign out, and delete confirmation.
- After a round: Next stays primary; saving progress is optional. Local results are distinguished from ranked scores.
- Leaderboard: sample all-time rankings per game, with Memory pair-count groups and a signed-in position sample.

All data and actions are simulated in memory. Google is not contacted, and the preview has no database. Selecting Google simulates successful authentication; cancel/error/offline can be selected explicitly. Play/Next end at a preview notice, not an actual game. Account/history and leaderboard pages may scroll on short screens; gameplay and its layout are unchanged. All five screen layouts and their proposed behavior were subsequently approved by the owner on 2026-10-23. The demo remains a reference artifact; production behavior is implemented separately.

## Database and administration

The accounts release needs durable storage for user/account links, sessions, completed progress, and validated scores. Start with one local D1 database and migrations using the locked Better Auth + D1/Drizzle stack; create separate production storage only with the applicable owner authorization. D1 supports [local development](https://developers.cloudflare.com/d1/best-practices/local-development/); Better Auth documents its [core tables](https://better-auth.com/docs/concepts/database). Checked 2026-10-23. No database schema or resource was added for this demo.

A full admin web panel is not a prerequisite for accounts. Follow `PLAN.md` section 11.10: begin with the Stage 0 admin command tool for necessary user bans and score moderation, with permission checks and audit records. The web admin panel remains a later stage. This demo request does not authorize building an admin panel.

## First-slice account implementation (historical)

See `GOOGLE_AUTH_SETUP.md` for installation, the exact callback URL, and Google setup. The first slice adds `/account/sign-in`, `/account/name`, `/account`, server-owned sessions, case-insensitive unique public names, sign-out, and deletion with a five-minute fresh-session requirement. Production screens use the message catalog and existing design tokens. Until game-history sync is implemented, the profile truthfully shows no saved rounds or scores. The original games still play locally and their old browser bests remain local.

The local migration includes only Better Auth’s core tables, its rate-limit table, and the public player-name table. No production database, OAuth project, admin panel, score table, or ranked endpoint has been created. Secrets are read from `cloudflare:workers` bindings on each request; the adapter’s Vite emulation reads `.dev.vars` there. No fixture or test login endpoint exists in the app.

## First-slice result connection (historical)

The approved result design is now connected to the actual Home → Play → Block/Memory → Result flow. Guests see “Sign in with Google” leading to `/account/sign-in`, with Next puzzle still primary. Signed-in players see their account link. The route supplies session state from the server layout; the result screen does not pretend that a local round has been saved to an account. Best scores continue to be saved locally before the result appears. History sync, importing a local round, and ranked results remain the following implementation slices.

Browser coverage completes real rounds: Block results are checked in the layout suite, and the account suite completes Memory as a guest and a signed-in player. The guest case follows the sign-in link and checks that the browser best remains stored, including fit at 320x480, 360x640, and the three approved screen sizes. These changes are local and have not been deployed to the public site.

## OAuth credential follow-up (historical)

The owner supplied credentials locally and reported the Google OAuth app remains in Testing with no branding submission. The local app loads the credentials without exposing their values. Fixed the SvelteKit 3 sign-in action to allow the external redirect only to `https://accounts.google.com`, following the current `redirect` API; the previous action returned a framework error before reaching Google. The real form now has a regression test for its authorization redirect, canonical callback, basic identity scopes, and state-cookie flags. Interactive Google consent and the callback/session creation remain a user-operated check. No production provisioning, publishing, or deployment is authorized by adding local credentials.

## Local Step 6 delivery

- Pure shared engine foundations live in `src/lib/engine`; each puzzle owns its logic, replay manifest/version, tests, view, components, and themes in `src/lib/puzzles/<id>`. Generated catalog/registry imports and ESLint enforce the boundaries without a workspace migration.
- New completed rounds are queued at logical completion, before result animations, with versioned seeds and accepted moves. Account history and personal bests are calculated from server replay. Guest imports require an explicit save action; old browser bests cannot be imported or ranked.
- Signed-in, named players request a server-generated ranked session when Play/Next starts. If starting ranked is unavailable, the game remains playable locally and its saved result is unranked.
- Ranked sessions use opaque cryptographic IDs and authoritative D1 records, rather than introducing the long plan's stateless-token/Durable Object architecture. Conditional insertion/claim statements enforce user/IP start caps, abandoned-start limits, latest-session supersession, bans, expiry, and the ranked kill switch. Frozen claims recover after interrupted writes or expiry; unique result IDs and canonical payload hashes make retries idempotent.
- Timed ranked Memory uses server wall time from issue to first claim, a fixed one-second network allowance, and whole-second quantization. Preview, background time, and submission delay count. Solo retains active time. The local result/HUD is an estimate; the saved-score line, profile, and board show the server value.
- The local database stores bounded replay logs and shows 30 recent results. All-time boards show one best eligible result per player and compatible group, with earlier submissions winning ties; pagination is capped. Hidden results and banned/deleted players are excluded.
- `docs/operations/ADMIN_LOCAL.md` documents the local OS-owner/role/TOTP command and transactional moderation audits. No administrator is enrolled automatically and no web admin route is exposed. A public admin panel is a future planning item.
- `docs/operations/GOOGLE_OAUTH_PUBLIC.md` supplies future public OAuth submission instructions. No production setup was performed.

Validation and acceptance status belong to the phase report. Local tests do not substitute for the remaining owner-operated physical-device checks or global-launch readiness work.
