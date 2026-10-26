# Morphi v1 release plan

> **Historical proposal — superseded 2026-10-24.** Use
> [V1_RELEASE_CHECKLIST.md](V1_RELEASE_CHECKLIST.md) and its owner execution update.
> The owner has authorized local v1 implementation, including the Stage 1 admin
> panel and Terms preparation, and requested an interactive screen demo before
> integration. SEO doors and randomized starting families are now explicit scope.
> Production authorization and release gates remain separate. The original
> proposal is retained below as history.

Prepared 2026-10-24. **Planning only; implementation and launch are not approved by this document.** The owner requested this plan after accepting local Step 6 and publishing the guest homepage/privacy policy.

`../morphi-plan-simple.md` remains authoritative. This document proposes the smallest production release of its Step 6 features. Pull in only the relevant security, admin, content-page and release checks from `PLAN.md`; do not start the full platform phases.

## 1. Starting position

| Area                                                              | Actual status                                                     | Evidence / next action                                                                                                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Memory, Block and per-game structure                              | Implemented and verified locally                                  | `STEP6_WORK.md`; preserve generation, scoring, rotation and curated themes.                                                                                                                |
| Accounts, saved completed rounds, ranked results and leaderboards | Implemented and verified locally                                  | Prior full verification: 95 unit tests, 17 integration tests, six-runtime vectors, 15 built-Worker checks and 24 browser cases. These are historical results, not a new run for this plan. |
| Local functional acceptance                                       | Completed by owner on PC/mobile, 2026-10-24                       | `STEP6_REVIEW.md`; do not repeat this acceptance request. Production checks are separate.                                                                                                  |
| Public homepage/privacy and intentional Cloudflare analytics      | Published and live-checked                                        | `PUBLIC_PRIVACY_RELEASE.md`; latest recorded version `b50a7a18-2e85-4406-bd40-77f27c4b3da3`. Beacon is injected by Cloudflare automatic setup, absent from build assets by design.         |
| Domain ownership                                                  | Owner-confirmed complete                                          | No repeat verification or DNS change planned.                                                                                                                                              |
| Production Google credentials                                     | Owner reports setup complete and supplied a private file location | Credential contents/callback have not been validated by this planning task. Do not copy credentials into documentation or source.                                                          |
| Google branding verification/publication and audience state       | Console evidence not recorded                                     | Record the owner's actual status; a downloaded client file alone does not prove approval or publication. Wait for Google only if a review is actually pending.                             |
| Production account backend                                        | Not deployed                                                      | Public release remains guest-only; the live OAuth callback/account APIs are unavailable.                                                                                                   |
| Production operator, maintenance, recovery and resource checks    | Unresolved                                                        | Local tools are not a production operating path. See `ADMIN_LOCAL.md`, `PRIVACY_REQUESTS.md`, `PRIVACY_RETENTION.md` and `STEP6_MEASUREMENTS.md`.                                          |
| Admin web panel                                                   | Proposal only                                                     | Small Stage 1 slice below; no panel implementation authorized.                                                                                                                             |
| Global v1 launch                                                  | Pending                                                           | Requires the evidence and explicit release authorization below.                                                                                                                            |

## 2. v1 product boundary

Carry the accepted build forward:

- Guest play remains immediate and works if sign-in is cancelled or unavailable.
- Memory and Block rotate as already approved, with their existing seeded randomness and four curated themes. Broader procedural theme generation remains deferred; no new randomness platform is needed for v1.
- Optional Google-only accounts, chosen public names, sign-out and fresh authenticated deletion. No username/password authentication.
- Saved completed-round history and bests across devices; durable retry and explicit unranked guest import. Cross-device continuation of an unfinished round is outside this release.
- Server-issued ranked rounds, replay-computed scores and existing all-time leaderboard groups. Public rows expose chosen names and eligible scores/ranks, never private Google identity or tokens.
- Approved privacy page and monitored support/privacy contact: Ali Gohar, cngohar@gmail.com.
- Existing Cloudflare Web Analytics disclosure. No Google Analytics or new analytics pipeline.

No new games, payments, multiplayer, daily challenges, achievements, translations, CMS, blog, general configuration editor, Durable Objects or database sharding. No separate kids site, age gate, age-verification service or child-account product is introduced by this plan.

## 3. Work order and acceptance

### A. Confirm the release contract and prepare locally

**Can be prepared before Google approval. Implementation starts only after the owner approves its scope.**

1. Record the Google console's actual Branding, Audience and verification state. Preserve the separate localhost development project. Privately validate the supplied production client as a Web application, with callback `https://morphi.one/api/auth/callback/google` and no development-only callbacks. Record identifiers/status only; keep the secret outside source and chat.
2. Keep `openid`, `email`, `profile` and online access. Do not add Google API permissions or infer age from Google sign-in.
3. Decide the public account-eligibility wording and applicable launch jurisdictions using the already approved general-audience direction. Record any unresolved jurisdiction question; this is not authorization to add an age flow or reopen the privacy draft.
4. Choose whether to include the proposed small admin panel before announcement. Approve its screens/security approach before implementation. A secure, tested production operator path is required even if the panel is deferred.
5. Decide whether v1 includes a simple repository-managed `/terms` page. Recommendation: prepare a short owner-reviewed terms page covering account use, public names/ranking rules and contact, without inventing guarantees. Its implementation and wording require approval. Google treats terms as optional in its homepage requirements; do not call it an automatic OAuth blocker. Separate About/Contact pages and admin editing are deferred; existing Home description and contact can serve this release.
6. Prepare a dedicated production account configuration and release checklist locally. Keep `wrangler.jsonc` as the local-account configuration and `wrangler.public-privacy.jsonc` as the guest-only artifact. Do not run the existing normal deploy script against production.

**Done when:** the owner has a concrete scope, resolved launch-critical eligibility/content decisions, an admin/operator choice and a reviewable configuration/runbook without secret values. Google waiting status must be explicit rather than assumed.

### B. Build only the approved local gaps

1. Implement the approved operator/admin slice and any agreed static terms page; leave games, engine versions and account screens unchanged unless a release defect needs fixing.
2. Prepare production request lookup/access/correction/deletion and maintenance procedures using existing server functions where suitable. Preserve the local CLI's local-only guard; do not turn its OS enrollment file into production authentication.
3. Check the actual production candidate: canonical HTTPS auth base, exact trusted origin, secure/HttpOnly/SameSite session cookies, no private response caching, body/move/rate limits and token-safe error logging. Decide the `workers.dev` behavior explicitly; it is the same Worker, not staging, and must not become an alternate authentication origin accidentally.
4. Prepare a controlled first deployment: use existing supported configuration/controls where possible. If accounts must be restricted to invited testers until checks finish, implement and test an explicit server-side release restriction; obscurity or Google branding approval is not that restriction. Decide the mechanism before provisioning.
5. Run `bun run verify` against the final stable source. Add focused tests for newly approved behavior; preserve existing assertions and engine vectors. Review the build/configuration and diff for fixtures, demos and secrets.

**Done when:** local checks pass, the approved admin/operator workflow has permission/2FA/audit/failure tests, no production action has occurred, and exact provisioning/deployment/rollback steps are ready for review.

### C. Provision and validate production operations

**Requires specific authorization for remote provisioning, credential changes and any test environment. Each deployment still requires its own approval.**

1. Confirm the actual Cloudflare plan, current limits, budget and billing/alert owner. Do not assume a paid-plan upgrade or quote the reference plan's prices as current account settings.
2. Create/bind the intended production D1 database and apply reviewed, compatible migrations. Start with an empty production dataset; do not upload development fixtures or the owner's local accounts/history.
3. Stage an independent `BETTER_AUTH_SECRET`, production `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` securely. Use `BETTER_AUTH_URL=https://morphi.one`. Check current Wrangler behavior before secret commands because some can activate a deployment. Inspect only binding names/status in reports.
4. Enroll the owner through the approved production operator path, including second factor, re-authentication and recovery. Bootstrap must be explicit and not an unauthenticated public endpoint. Keep ordinary players unable to acquire roles.
5. Establish the operating rules in the table below and rehearse maintenance/privacy deletion against synthetic data. Verify account cascades and removal from public boards while another account stays intact.
6. Rehearse a timed restore in an authorized isolated database before real account data is exposed. Reapply erasures before making restored data available. Record recovery time and potential data loss; do not promise an untested recovery objective.
7. Measure the final Worker with auth/D1, cold/warm requests and representative bounded replays. Use an authorized isolated target for load testing with synthetic users; never flood the live guest site or Google login. Reuse synthetic sessions for load tests, and test real Google login separately.

**Done when:** production bindings/secrets/operator controls are ready, maintenance and recovery work, resource evidence meets agreed gates, and the owner can review the exact account-release artifact. Remote readiness does not itself authorize deploying it.

### D. Controlled account rollout

1. After explicit approval, deploy the exact reviewed version with the agreed release restriction. Reinspect the current live version/settings first to detect concurrent changes. Record artifact hashes, migration state and deployment/version identifiers without secrets.
2. Confirm actual Google branding/audience state and test sign-in with an ordinary Google account outside the project-owner/tester group when public access is intended. Check the consent identity, basic scopes and canonical callback. Follow `GOOGLE_OAUTH_PUBLIC.md`; Google approval is not guaranteed by the plan.
3. On a real phone and desktop, test guest/cancel, name setup/edit, sign-out/sign-in, second-device completed history, account isolation, ranked replay/boards, offline retry and duplicate acknowledgment, fresh deletion and session revocation. Record devices/browsers for this production run.
4. Test the operator's moderation, ranked-off/on, audit and verified-request path. A ranked ban is not a login suspension or a substitute for privacy deletion. Confirm guest play survives ranked-off.
5. Check Home/privacy links, production metadata, any approved terms, no draft/development URLs, no private leaderboard fields and the intentional Cloudflare analytics beacon. Update the policy's later-account-release language truthfully when accounts become available; preserve the approved audience wording and use the actual revision date.
6. Check error/resource telemetry and retain rollback capability. Do not expose remaining accounts or announce v1 while a critical data-loss, security, deletion or restore defect is unresolved.

**Done when:** production functional/security/operator checks pass with evidence. This does not announce the global launch automatically.

### E. Announce v1 and monitor

The owner accepts the release evidence and authorizes opening any remaining account restriction and announcing v1. Any code/config deployment needed for that opening needs its own approval. Review errors, save failures, abuse, D1 usage and costs daily for the first seven days (proposed operating cadence, not an implemented service or retention promise). Keep cngohar@gmail.com monitored and record issues for small fixes before considering more games or larger admin stages.

**Done when:** owner release acceptance is recorded, the authorized public account flow is working, the operator can maintain/recover it, and the first-week review has a named owner and recorded outcome. Keep launch acceptance separate from later monitoring completion.

## 4. Small admin panel proposal

**Recommended for approval as a narrow Stage 1 panel. It is not implemented or a universal prerequisite for a public puzzle site; production operations need an effective protected path either way.**

| Screen                  | Smallest useful capability                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin status            | Current ranked on/off state and admin-only switch, confirmation/reason and a clear success/failure result. No custom analytics dashboard.                                                                                        |
| Score/player moderation | Bounded lookup by public player/run identifier; inspect eligible/hidden scores; hide/restore scores; ranked ban/unban with a reason. Reports arrive through the existing monitored contact; no public report system is proposed. |
| Audit log               | Admin-only, paginated actor/action/target/time/outcome and minimal before/after records. No Google tokens, private request messages or children's information in reasons.                                                        |

Security acceptance: explicit enrollment of the owner; approved second-factor/recovery mechanism; deny-by-default permissions checked on every server action; fresh re-authentication for sensitive actions; CSRF/origin protection; bounded validated input; atomic mutation/audit; audited operational reads; no impersonation or role editor. Retain existing admin/moderator/support role boundaries without building team-management screens. New screens need approved portrait, landscape and desktop wireframes before implementation. Do not expose private Google profiles through a general player directory.

Verified-request account lookup/export/deletion and retention maintenance can stay in a protected operator workflow for v1. Define, implement and test that production path separately; the current local CLI cannot operate on production. A web user-management suite and privacy/terms editing remain later Stage 3/5 work.

## 5. Operating decisions before public accounts

| Item                                               | Proposed minimum / decision required                                                                                                                                                                                                                                              | Owner and evidence                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Privacy/support and children's-information reports | Preserve the approved general-audience policy and `PRIVACY_REQUESTS.md`; minimal identity/authority verification, appropriate action and explanation of residual provider/device data. Resolve account eligibility without assuming Google verifies age.                          | Ali Gohar monitors the confirmed address; approved statement and tested operator procedure.          |
| Expired-record maintenance                         | Propose one daily, owner-run maintenance check initially, with failures recorded and a missed-run recovery procedure. Use `PRIVACY_RETENTION.md` rules; unresolved claims remain recoverable. This is proposed cadence, not a guaranteed deletion deadline or existing scheduler. | Owner approves cadence/operator path; synthetic-data maintenance evidence.                           |
| Audits, logs and request correspondence            | Decide access, purpose, review cadence and justified retention. Inspect actual provider settings; configure only supported controls. Do not promise arbitrary 30-day logs, 12-month audits or fixed backup expiry.                                                                | Owner-approved table in `PRIVACY_RETENTION.md`; any unresolved limitation stays explicit.            |
| Recovery and credentials                           | Owner performs/authorizes restore, key rotation and admin recovery; record when rotation is needed, how sessions are affected and how erasures are reapplied after restore.                                                                                                       | Timed isolated restore/recovery drill and protected runbook; no secret material in docs.             |
| Diagnostics, billing and abuse                     | Select minimal redacted failure/usage evidence and available alerts. Confirm ranked rate/start caps remain effective; review abuse before considering additional services. Cloudflare Web Analytics is not account-save/security monitoring.                                      | Owner approves plan/budget and alert responsibilities; record actual configuration and test results. |

## 6. Evidence required for release

| Gate                          | Pass evidence                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product regression            | Final `bun run verify` passes with zero type warnings/errors, unchanged known vectors and reviewed production bundle. Previous local owner acceptance remains valid; new evidence covers release changes.                                                                                                                                                                                                                                   |
| Public OAuth                  | Actual branding/audience status recorded, exact HTTPS callback/basic scopes, ordinary account succeeds, cancel/failure returns safely to guest play.                                                                                                                                                                                                                                                                                        |
| Data/privacy                  | Cross-device saves, isolated ownership, retries, private leaderboard fields absent, self-service/operator deletion and post-restore erasures verified. Policy matches deployed behavior.                                                                                                                                                                                                                                                    |
| Operator/admin                | Protected enrollment/2FA/re-authentication, every action authorized and audited, moderation/ranked switch, maintenance and recovery drills pass.                                                                                                                                                                                                                                                                                            |
| CPU, memory and capacity      | Record actual production-plan limits and measured HTTP/auth/D1 CPU, peak-memory evidence or its explicit measurement limitation, query timings, request rates, error rates and latency median/p95. Post-batch local heap observations do not prove peak isolate usage. No capacity pass while a required measurement is unresolved; any waiver needs an explicit owner exception and risk.                                                  |
| Load envelope                 | Proposal: first establish 100 simultaneous synthetic player sessions at a documented round cadence, with ramp, duration, request mix and pass thresholds agreed before running. Do not claim 500/2,000-player support. Larger reference-plan tests need a separately approved target/budget; none are silently passed or waived.                                                                                                            |
| Interaction and accessibility | Use `PLAN.md` §12.3/§13.1: starting budgets under about 150 KB critical Home transfer, about 300 ms preloaded Play, visible Next feedback about 100 ms and playable within 600 ms. Record cold/preloaded, named phone/desktop, network profile, at least five runs and median/p95; record keyboard, focus, reduced motion and a manual screen-reader pass for both games. Public-launch gates require evidence or an explicit owner waiver. |
| Compatibility and rollback    | Supported active-run versions remain verifiable through their lifetime or have a clear retry path; migrations compatible for one release. Rehearse with synthetic data. Define who can invoke rollback and obtain applicable deployment approval; never reset production D1 to undo a code release.                                                                                                                                         |
| Final authorization           | Exact artifact/configuration reviewed, remaining risks explicit, owner approves each deployment and separately accepts/announces the public launch.                                                                                                                                                                                                                                                                                         |

Store current evidence and failures in `PHASE_REPORTS.md`, measurements in `STEP6_MEASUREMENTS.md`, operating facts in the privacy/admin docs and decisions in `DECISIONS.md`. Label items completed/verified, implemented/unverified, owner decision, deployment authorization or Google review as applicable. Do not check a future gate merely because it appears in this plan.

## 7. Next smallest task

Approve **A: the release contract and local preparation**, including whether to build the Stage 1 panel and a simple terms page. Then prepare the selected local operator/admin design and production configuration. Google review can proceed in parallel; no provisioning or deployment is needed to write and review these artifacts.

This planning task neither reads/installs the supplied OAuth secret nor changes the live site. It approves no new implementation, external service, DNS change, Google submission or future deployment.

## References

Repository evidence: `STEP6_WORK.md`, `STEP6_REVIEW.md`, `STEP6_MEASUREMENTS.md`, `ADMIN_LOCAL.md`, `PRIVACY_REVIEW.md`, `PRIVACY_RETENTION.md`, `PRIVACY_REQUESTS.md`, `PUBLIC_PRIVACY_RELEASE.md` and `GOOGLE_OAUTH_PUBLIC.md`. Relevant reference-plan sections: §9.1, §11.10 Stage 1, §11.16 content templates, §12.3 and §13.1; larger stages remain deferred.

Official references rechecked 2026-10-24; inspect actual account settings and current command behavior again before implementation/provisioning:

- [Google production policy, homepage/optional terms and secure redirects](https://developers.google.com/identity/verification/authentication-policy-compliance).
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/); limits and sampled local measurements are separate from actual production capacity evidence.
- [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/); record actual plan/recovery support rather than promising a provider deletion deadline.
