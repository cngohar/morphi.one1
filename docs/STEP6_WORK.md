# Step 6 local delivery

Owner authorization: complete Step 6 locally and perform the small engine/puzzle structural cleanup. Production provisioning, OAuth publication, deployment, a web admin panel, and the global-release scope remain separate owner decisions.

## Delivery order

- [x] Isolate Memory and Block placement in dedicated puzzle directories; enforce dependency boundaries and preserve rule vectors.
- [x] Record versioned completed runs; replay and score them on the server; persist account-owned history and bests.
- [x] Add durable browser retries, account isolation, guest-to-account opt-in, and honest saved/pending/unranked states.
- [x] Add server-issued ranked sessions, authoritative timing, start caps, supersession, atomic claim/retry recovery, and bounded input.
- [x] Connect the approved all-time leaderboard and account history screens, grouped by ruleset and Memory pair count.
- [x] Provide local moderation controls and audit records; keep the web admin panel for global-release planning.
- [x] Verify Node/Bun/browser/Worker vectors, security/race/failure cases, layouts, build, and replay costs. Record owner-only real-device review separately; that evidence remains pending.
- [x] Write the public Google OAuth submission instructions and local delivery report; update CODEMAP and decisions.

## Owner review accepted; production evidence remains open

- [x] Owner reported every functional check working on PC and mobile on 2026-10-24 in `STEP6_REVIEW.md`, including cross-device saved history, offline/reconnect, privacy, account isolation and deletion. Specific device/browser models were not supplied.
- [x] Owner explicitly accepts the local Step 6 functional build on 2026-10-24. Unmeasured peak isolate memory/production capacity and production operating decisions remain open; no performance waiver or public launch is inferred.

Full local `bun run verify` passed: 95 unit tests, 17 D1/auth integration tests, six runtime vector checks, 15 isolated built-Worker checks, and 24 Chromium account/privacy/recovery/layout/input tests (latest privacy-readiness verification). The deployment bundle passed a local dry run (2547.44 KiB, 475.44 KiB gzip), with no upload. See the latest phase report and `STEP6_MEASUREMENTS.md`.

## Release boundaries

The current public site remains the owner-approved Step 5 game test. Step 6 local completion does not establish global-launch readiness. Privacy/terms, consent and GA4, Search Console/SEO, production operations, and the proposed admin panel will be planned with the owner after this work. Broad procedural themes, additional games, active-round cross-device resume, payments, and multiplayer stay deferred.

Local OAuth is working according to the owner's confirmation in this conversation. Older setup notes describing it as pending are superseded by that owner report.

## Privacy readiness follow-up — 2026-10-24

Owner-authorized local readiness adds the retention inventory, monitored-contact/request procedure, protected maintenance/privacy deletion and a separate guest-policy publication candidate; see `PRIVACY_REVIEW.md`. This does not accept Step 6 or enable public accounts. Updated test evidence is in the latest phase report. `STEP6_REVIEW.md` prepares the next smallest owner-operated physical-device checks; no outcomes are prefilled. Public account eligibility, secure production operator access, maintenance/restore rules and audit-retention decisions remain for the v1 operations review. No web admin panel is implemented.

## Owner review recorded — 2026-10-24

The owner filled `STEP6_REVIEW.md` and accepted all local functional checks on PC/mobile. This supersedes the earlier pending owner-review notes. It authorizes no deployment or production OAuth change. Next: separately approve/publish the already tested guest homepage/privacy update, then follow `GOOGLE_OAUTH_PUBLIC.md`; plan the production account rollout and smallest admin panel separately, retaining unresolved operating/resource evidence.

## Guest-policy publication — 2026-10-24

The separately owner-authorized homepage/privacy publication is complete, including the requested intentional Cloudflare Web Analytics disclosure (version `b50a7a18-2e85-4406-bd40-77f27c4b3da3`). Domain ownership is owner-confirmed done. Source builds contain no beacon by design; Cloudflare automatic setup injects it into delivered pages. Local/live checks pass; see `PUBLIC_PRIVACY_RELEASE.md`. This does not enable account endpoints or complete production account/Google setup.
