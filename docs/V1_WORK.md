# v1 local implementation and visual review

## Owner integration authorization — 2026-10-25

The owner accepted the v1 preview and authorized integration into the actual
local app. This supersedes earlier demo-only/review-pending restrictions.
Include per-puzzle entrances through the anime.js motion wrapper: Memory
6/8/10 pairs arrive over 3/4/5 seconds face up, then a full 3-second preview,
then hide before the timer/input start. Block uses the same entrance language.
Generate original action sounds with the installed ElevenLabs SDK. Compare
actual screens with the accepted demo at the required sizes. Profile XP and
achievements are future fixtures and must not ship as real v1 data. Production
resources, credentials, D5 eligibility and every deployment remain separate.

Owner: Ali Gohar. Started 2026-10-24 from the consolidated v2 handoff in
[V1_RELEASE_CHECKLIST.md](V1_RELEASE_CHECKLIST.md). The earlier
[V1_RELEASE_PLAN.md](V1_RELEASE_PLAN.md) is historical. This file records work;
it does not authorize remote changes or mark release gates passed.

## Integrated local app — 2026-10-26

The accepted public layouts are now native Svelte screens, using the existing
engines, ranked replay and durable save queue. Home lives at `/`, Mix starts at
`/play`, and `/memory` / `/block-puzzle` are ready/Stay search doors. Next remains
unnamed. Header/footer, result ordering, Nunito/wordmark and phone landscape
layouts follow the demo. Profile uses real totals/history and native tabs;
future XP, mastery and achievements are omitted. Long public names wrap safely.

Memory has crypto-scattered arrivals over 3/4/5 seconds, followed by three full
seconds face up and the hide before input/timing. Block's opening is three
seconds with placement locked. Anime.js is confined to the motion wrapper;
active-time deadlines own readiness. Hidden/reduced-motion behavior and an
animation-entropy failure are covered. Ranked openings keep a fixed server-known
allowance, including with travel disabled, so shortened motion cannot produce
an invalid server duration. Puzzle template guidance is updated.

Thirteen ElevenLabs SDK cues are generated, trimmed and decoded locally, with
69,320 bytes total and distinct recorded hashes. Playback uses static files,
bounded voices and mute/background cleanup; it makes no generation request.
Prompts and source/processed hashes are in `static/audio/manifest.json`.

The local Stage 1 operator screens use real D1 data, per-action roles, Google
session freshness, TOTP and one-use recovery, short grants, origin/body/rate
checks and audited operations. Exact name/run lookup, hide/restore, ranked
ban/unban, rename, case references, bounded export/deletion and read-only audit
are implemented. Owner enrollment/reset remains an explicit protected local
command; none was run against the owner's account. Google uses its supported
account-selection prompt; the app does not claim to force Google's password UI.

Coarse measurement is off by default, respects DNT/GPC and has a withdrawal
control/disclosure. The privacy candidate's updated date is 2026-10-26. Raw
seven-day cleanup eligibility is distinguished from an unattended deletion SLA.
Terms omit the unapproved public eligibility clause. Production operations,
resources, eligibility and deployment remain separate release gates.

Backdrop dismissal is fixed in app and demo Help/account/confirmation dialogs:
inside clicks/drags do not dismiss, outside clicks close, pending writes keep
their dialog, and focus returns. The accepted demo remains a reference, never
application gameplay or permission code. Build output excludes review demos.

Review captures/logs are under `build/v1-integration-review/`; the latest phase
report records final checks. Public screenshots cover Chromium/Firefox/WebKit
at 390×844, 844×390, 1280×800, 568×320 and 320×480; additional account/operator
captures use the three approved sizes. Short portrait results retain readable
copy by scrolling. These functional captures do not replace owner real-device
or production performance/security release checks. The prior public artifact
is retained at `build/public-privacy-2026-10-24-retained/`; preparing a new local
artifact does not authorize publication.

Final local verification is recorded in `build/v1-integration-review/verify-final.log`:
103 units, 21 integration tests, six-runtime vectors, 15 built-Worker checks
and 39 browser cases pass, with zero type errors/warnings. The 146 public and
account/operator captures have no uncaught browser errors or horizontal overflow.
Six local guest-artifact check groups also pass; the new candidate has 90
allowlisted static files, no account backend/bindings, no replay queue and no
review demos. Artifact preparation uses an explicit Vite mode and staging copy,
so an incomplete build cannot replace the prior candidate. No deployment was run.

## Historical demo delivery

Owner phone/timing follow-up (Oct 25): general presentation transitions now
last 1 second and Home → puzzle lasts 1.5 seconds. The owner then shortened
help opening/closing to 0.5 seconds (2 seconds for Home → puzzle → help).
The incoming board stays
hidden until its single entrance. Phone active boards are centred in portrait;
landscape uses larger boards with the HUD and controls beside them. Both games
and door/Mix entries share the layout, including 568×320 landscape. Decorative
travel cannot create scrollbars; rotation retains moves and reduced-motion
changes reveal the board immediately. `test:demo` now probes those cases and
samples transition frames. Latest evidence: 366 demo checks, 48 extra Firefox/
WebKit phone layout cases and the full `bun run verify` pass (see the newest
phase report). This review is explicitly **not full acceptance**.

Oct 25 accepted design update: the package under
`docs/morphi-design-package-2026-10-25/` now governs the public demo designs.
Home is centred; door pages have a ready/playing hybrid; profile is Foundation
v2; result follows the accepted desktop/mobile order and ink sign-in treatment.
Public terminology/wordmarks are updated; admin design is preserved.
`v1-design.css` scopes these public changes, and `scripts/demo-motion.ts` is the
only anime.js importer. Rebuild its local asset with `bun run demo:motion`.
`bun run test:demo` starts its own isolated static server and checks the demo,
including reduced/missing motion, scatter bounds, mobile order and profile tabs.
The earlier reused profile described below has been superseded visually, while
its account/name/sign-out/deletion simulation remains local. XP, mastery and
achievement values are fixtures, not implemented application features.

This update stops at the demo: layouts/copy still need owner review before
integration. D5 remains open; the existing 18+ text is still only a proposal
shown in the demo. No deployment approval is inferred.

- Interactive demo: [static/demo/v1.html](../static/demo/v1.html).
  Run `bun run dev --host 0.0.0.0` and open
  `http://localhost:5173/demo/v1.html`, or open the HTML file directly.
  During this review, an independent static server runs at
  `http://localhost:5174/demo/v1.html` (phone LAN: `http://192.168.1.9:5174/demo/v1.html`).
  To restart it: `python3 -m http.server 5174 --bind 0.0.0.0 --directory static`.
  The review controls show portrait 390×844, landscape 844×390 and desktop
  1280×800. “Open full size” opens the selected screen outside the frame.
- Public screens: Home with exact adopted copy, Memory and Block search-entry
  pages with owner-review how-to/scoring/tips, surprise-play core, mystery Next
  result, Terms, and the proposed additional analytics disclosure. Public
  navigation links to the existing isolated account demo, not real Google login.
- User account review (2026-10-25): the same Screen dropdown now includes
  **User / sign in**, **User / player name**, **User / profile**, and
  **User / leaderboard**. These reuse the already approved account demo.
  Direct profile link: `http://localhost:5174/demo/v1.html?screen=profile`.
  Account navigation updates the selected screen and full-size link. The
  review now offers 19 screens; the 2026-10-24 results below cover the original
  15 screens. New focused checks: `build/v1-profile-review/results.json`
  (16 pass, three profile viewport sizes, name editing, leaderboard, sign-in,
  offline and sign-out; no browser errors). Account previews use JavaScript
  modules and should be reviewed through the local HTTP server.
- Operator screens: sign-in/2FA/recovery, D1 aggregate dashboard, ranked switch,
  bounded public-reference lookup, hide/restore, rename, ranked ban/unban,
  report queue, read-only paginated audit and a proposed protected privacy-request
  workflow. Reports use opaque case references rather than email contents.
- Demo scenarios: normal, load failure, empty, offline, re-authentication,
  sign-in lockout and mutation failure. Roles: admin/moderator/support/player.
  Permissions and authentication are **presentations only**, bypassable in a
  static demo, never evidence of production access control.
- Demo interactions are in memory. No accounts, authentication secrets, admin
  enrollment, database writes, telemetry uploads or persistent guest IDs are
  created. Use synthetic input only; any six digits complete simulated 2FA.
  “Complete preview round” in the review toolbar opens a result without adding
  a test button to the game UI. Reload/reset discards every demo change.
- First application slice: remove Block-first; injected-RNG weighted selection
  places each eligible family once per cycle, preserves minimum gaps across
  refills and retains a pending draw through failure. Larger-family tests use
  synthetic IDs, not new games. Home best refers to the current/last family,
  not the upcoming one. Start errors and Next loading text never name the
  upcoming puzzle. Existing engines/vectors/versions are unchanged.

## Owner review

The owner specifically requested this actual demo instead of wireframes.
Review the screens at all three sizes, including failed saves and the role
selector. Approve the layouts and the how-to/scoring/tips/Terms wording, or
provide changes. Approval is required before integrating new production
screens by `AGENTS.md` rule 9 and checklist §§4.1/5.2, with the owner-requested
demo substituting for wireframes.

The 18+ account wording is approved **for this demo**, not final public account
eligibility. Account launch jurisdictions remain pending a focused legal review
owned by Ali Gohar. Google sign-in does not verify age. No age-check flow is
added. Terms are optional under Google's homepage requirements, not an OAuth
blocker. This draft is product copy for review, not a legal compliance finding.

## Remaining implementation and release work

1. Integrate approved Home/game-entry/content layouts, move the core to `/play`,
   add production metadata, sitemap/robots/noindex and static OG images. Exclude review demos from release artifacts. Keep
   family links outside the core. Leaderboards default to noindex for v1.
   The demo is not a prerendered SEO delivery or production artifact.
2. Implement actual Stage 1 server security: explicit owner enrollment,
   Google re-authentication and 2FA/recovery, short privileged sessions,
   deny-by-default per-action RBAC, rate limits/lockout, origin/CSRF checks,
   input/body bounds, atomic mutation/audit, last-admin protection and the
   protected break-glass path. No production enrollment mechanism is chosen
   merely by depicting it in the demo.
3. Implement approved dashboard aggregates and lite anonymous events with
   consent/opt-out, identifier lifetime/retention, coarse enums and truthful
   release disclosure. Do not begin collection before those controls exist.
4. Implement and test protected request export/deletion, retention maintenance,
   unresolved-claim recovery and justified audit retention. Settle production
   logging/sampling/review and the separately stored Better Auth ID-token risk.
5. Resolve the handoff's OAuth/mailbox verifications and operating decisions,
   authorize isolated production resources and synthetic drills/load tests,
   record HTTP/auth/D1 CPU and memory evidence, recovery, rollback and device
   accessibility/performance checks. No gate can be passed with an unresolved
   required measurement; waivers need explicit owner exceptions.
6. Review the exact release artifact/configuration before requesting each
   deployment approval. Do not deploy the local-account config as a guest
   update. Owner acceptance and announcement are separate final steps.

## Cloudflare security guidance applied

Read project-local `workers-best-practices` (runtime/security and configuration)
and `wrangler`. Checked current official Worker best-practices, Web Crypto and
D1 CLI references on 2026-10-24. Keep the project's pinned versions, generated
binding types, request-scoped auth, bounded bodies, server replay and D1 atomic
batches. Do not introduce a service or compatibility change only to satisfy a
sample in a skill. The local CLI's OS/TOTP model is not production admin auth.
Production observability/retention choices remain unresolved; the demo does
not silently turn them on. Existing secrets and live settings were not inspected or
changed in this work; local tools load ignored development bindings normally.

## Evidence

The newest [phase report](PHASE_REPORTS.md) records current checks. Demo browser
checks and screenshots live under `build/v1-demo-review/` (generated local
artifacts, excluded from source). These demonstrate visual and simulated
behavior only. Existing guest packaging explicitly excludes every review demo.

Final local verification (2026-10-24): `bun run verify` passes with 101 unit,
17 integration, six determinism runtimes, 15 built-Worker checks and 27 browser
cases. The fingerprint is unchanged. The demo separately passes 98 checks,
including all 45 screen/viewport combinations, with zero browser errors or
backend mutations. Six local checks of the existing historical guest artifact
also pass with the test-only selector entropy fixture. Logs:
`/tmp/morphi-v1-verify-clean.log`, `/tmp/morphi-v1-demo-final.log`, and
`/tmp/morphi-v1-public-artifact.log`. These are local functional checks, not
production capacity, security acceptance or launch authorization.

## Oct 25 accepted-design verification

`bun run verify` passed: format/lint, zero type errors/warnings, boundaries,
101 unit tests, 17 D1/auth integration tests, six-runtime vectors, 15 built-Worker
checks and 27 application browser cases. `bun run test:demo` separately passed
252 checks, including all 19 demo screens at the three required sizes, active
door states, profile tabs, result order and reduced/missing motion. Home CLS
was 0 in the three local functional probes; this is not production CWV or a
real-device performance pass. Evidence and screenshots:
`build/design-review-2026-10-25/`; logs: `/tmp/morphi-design-verify.log` and
`/tmp/morphi-design-demo-final.log`. The owner now reviews the demo; integration,
deployment and D5 remain separate.
