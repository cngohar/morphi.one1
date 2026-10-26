# Active v1 release handoff

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

## Oct 25 accepted design supplement

[The accepted design package](morphi-design-package-2026-10-25/morphi-design-handoff-2026-10-25.md)
wins on design differences, including Home, door navigation/hybrid layout,
profile, result, terminology and motion. This v2 checklist still governs the
rollout tracks and release gates. The owner accepted the preview on Oct 25 and authorized actual local app
integration. Deployment remains separately authorized.
D5 eligibility/jurisdictions remain open. Amendments are in `DECISIONS.md`.

## Owner execution update — 2026-10-24

Ali Gohar supplied the consolidated checklist below and explicitly authorized
starting v1 implementation. This supersedes its original **planning-only**
restriction for local work and the earlier `V1_RELEASE_PLAN.md` proposal.
The simple plan remains authoritative; this owner update promotes the named
v1 work only. Every deployment, provisioning, DNS, secret installation and
Google change still requires its applicable separate authorization.

Owner decisions in this session:

- **D1:** dashboard plus the lite anonymous gameplay events approved. No events
  have been enabled; consent, opt-out, retention and truthful disclosure must
  accompany implementation.
- **D2:** per-type SEO doors remain in v1, with the mystery core preserved.
- **D3:** prepare `/terms` for owner review.
- **D4:** retain curated themes; procedural themes follow v1.
- **D5:** proposed **18+ accounts / guest play without an account** wording is
  approved **for the demo**. Public account eligibility is not finally accepted.
  The specific open question is which jurisdictions and related child-data
  obligations apply to the intended worldwide account launch. Ali Gohar owns
  obtaining a focused legal review and the final launch decision. No age
  verification, geofencing or child-account service is authorized here.
- **Visual review:** owner requested an actual interactive demo in place of
  wireframes. `static/demo/v1.html` previews the screens at all three required
  sizes. The owner accepted the v1 preview on Oct 25 and authorized local integration;
  the integrated build now needs its own device/feel review.
- **Security:** owner explicitly requested Cloudflare skills for best practices;
  project-local `workers-best-practices` and `wrangler` guidance are applied.

Implementation/evidence status: `V1_WORK.md` and the newest `PHASE_REPORTS.md`
entry. The original checklist follows unchanged so source decisions and
unfulfilled release gates remain visible; its unchecked D1/D3/D4 rows are
superseded by the explicit owner decisions above.

---

# Morphi v1 — Consolidated checklist v2

Prepared 2026-10-24. **This is the single handoff document for v1.** It supersedes
`morphi-v1-amended-a-checklist-2026-10-24.md` and folds in every amendment found
while reviewing `V1_RELEASE_PLAN.md` against its reference files, the admin-panel
and SEO decisions, and the corrected randomness positioning.

**Status: planning only.** Nothing in this document approves implementation,
provisioning, a deployment, a DNS change, secret installation, or a Google
change. Every deployment still needs its own explicit owner approval.
`morphi-plan-simple.md` remains authoritative; the long plan (`docs/PLAN.md`) is
reference — only the sections named here are pulled in (§11.2, §11.3, §11.6,
§11.10, §11.14, §12.3/§13.1). If this checklist and the v1 plan conflict, flag
it to the owner; the simple plan wins.

**Ownership:** the production account backend rollout is owner-led, with Codex
doing that work (owner decision, 2026-10-24). This checklist is the handoff for
that track and for the guest track (§4). Muse does not prepare or execute the
rollout unless the owner asks again.

**How to use it:** §1–§2 are closed — do not redo them. §3 lists what is already
decided — do not re-debate them. §4–§5 are the two work tracks. §6 contains the
**open decisions** (five originally; D2 was decided on 2026-10-24, see §6); v1 scope is not frozen until the owner confirms or
flips each one. §7 is the release gates, §8 the rollout/announce sequence.

---

## 1. Already done — closed

- [x] Steps 1–4 built; Step 5 public test accepted by the owner (45+ players,
  > 60% positive; the replay-rate criterion was **waived** because its counts
  > and threshold were missing — not recorded as a pass; see §6, decision D1).
- [x] Step 6 built and **accepted locally by the owner 2026-10-24** after
      PC/mobile review: Google-only sign-in with guest play retained, Better Auth
  - local D1, public player names, saved history/bests, server-replayed ranked
    scores, leaderboards, fresh authenticated deletion, local admin CLI (TOTP,
    no web panel). Evidence: 95 unit tests, 17 D1/auth integration tests,
    six-runtime vectors (one fingerprint), 15 built-Worker checks, 24 browser
    cases — historical results, not re-run for this checklist.
- [x] Guest site live: homepage + `/privacy`, guest-only, no account
      backend/D1/production OAuth. Current Worker `morphi-one` version
      `b50a7a18-2e85-4406-bd40-77f27c4b3da3` (`44a5846f` was the initial release
      earlier the same day).
- [x] Privacy page live with the approved Cloudflare Web Analytics disclosure
      (Updated: 2026-10-24). Cloudflare Web Analytics is **kept** (owner decision);
      its beacon is injected by Cloudflare automatic setup and is absent from
      build assets by design. No GA4/ads/new analytics pipeline is authorised by
      this.
- [x] Domain ownership / Search Console verified (owner-confirmed). No repeat
      verification or DNS change.
- [x] Google side complete (owner-confirmed 2026-10-24): branding verification
      passed ("verified and being shown to users"), Data Access needs no
      verification (no sensitive/restricted scopes), OAuth client saved,
      Audience **"In production"**. There is no Google review pending.
- [x] General-audience direction approved: Morphi is not child-directed; no
      kids site, age gate, age-verification service, or child-account product.
- [x] Local operator functions exist and are tested as a CLI (`ADMIN_LOCAL.md`):
      hide/restore score, ban/unban, ranked on/off, list-hidden, `prune-expired`,
      `privacy-delete` — TOTP on every command, admin/moderator/support roles,
      atomic audit, mandatory reason (3–240 chars). **Local only**; its OS/TOTP
      enrolment is explicitly _not_ a production authentication design.

## 2. Remaining verification — two items

- [ ] **Privately validate the production OAuth client** (owner/Codex; never
      in chat, docs, or source):
  - [ ] Type is **Web application**; redirect URI is exactly
        `https://morphi.one/api/auth/callback/google`.
  - [ ] No development-only/localhost callbacks on the production client; the
        **separate localhost development project stays separate**.
  - [ ] Scopes stay `openid`, `email`, `profile`, online access only. No added
        Google API permissions; age is never inferred from Google sign-in.
  - [ ] **Confirm the branding is published, not only verified** — the OAuth
        guide (§4) treats publishing as a separate step and mentions a seven-day
        validity window for a verification result. The owner's screenshot ("being
        shown to users") suggests it is published; record the console state.
  - [ ] Record only the client identifier and status. The secret stays outside
        source, documentation, and chat.
- [ ] **Mailbox check:** `PRIVACY_REQUESTS.md` names Ali Gohar /
      cngohar@gmail.com as the monitored privacy/support contact (owner-confirmed
      monitoring), but mailbox delivery/access was never independently tested.
      Send one test message and confirm receipt before launch.

## 3. Already decided — do not re-open

- [x] **A web admin panel is part of v1** (owner decision, later 2026-10-24 —
      supersedes the earlier "trimmed operator path" recommendation). Reasons
      recorded by the owner: Morphi is launching; the panel is the foundation for
      later stages; there is currently no tracking data and no way to see what is
      happening on the site. Scope is defined in §5.2.
- [x] **Puzzle pages are Google-only doors; the mystery core is protected**
      (owner decision, 2026-10-24). The per-type pages in §4.1 exist so search
      engines can find and rank a page per game type and land searchers on it.
      They are **not** a player feature and never become a catalogue: no puzzle
      menu or game-type picker inside the game UI, menus, or result screens, and
      no "pick a puzzle" setting in v1. Inside the core loop the player never
      knows which puzzle comes next: **Next never names or previews the upcoming
      puzzle — its name is revealed only when the puzzle arrives on screen after
      the click.** See §4.1 and §9.
- [x] **"Block first" is removed** (owner decision, 2026-10-24). It was a
      first-test/first-launch rule only (simple plan addition, 2026-10-20). From
      v1 the selector's draw decides which family starts, per long plan §11.14 —
      the randomisation is built for many families from the start. See the
      release-change item in §5.1.
- [x] Cross-device continuation of an _unfinished_ round is out of v1;
      completed-round history across devices is in.
- [x] No username/password authentication; no new games in v1.

## 4. Track A — Guest track (no dependency on accounts; can start now)

### 4.1 SEO — per-type puzzle pages

The v1 release plan omitted SEO entirely; this section restores the locked
decisions (`DECISIONS.md` + long plan §11.3) at the smallest v1 scope.

- [ ] **Two indexable per-type pages:** `/memory` and `/block-puzzle`,
      playable in place, serving only that page's game type; every round on the
      page is a fresh selector draw (new variant, new seed, new theme). No list
      of levels, instances, or seeds exists anywhere on the page.
- [ ] **Doors, not a catalogue (owner decision, §3):** the pages are linked
      from Home's content/footer so crawlers can discover them, and from each
      other — never from the game menu, the in-game UI, or result screens, and
      never presented as a puzzle menu or category picker. Home's primary action
      remains Play. Each page also carries a prominent **"Surprise me"** action
      into `/play`, where the selector deals across all game types and the next
      puzzle is never announced in advance.
- [ ] Page structure per long plan §11.3/§11.16: prerendered content, the
      puzzle in the centre, real content in the side columns on expanded screens
      (how to play, scoring, tips), drawers below 1024 px, none on phones.
- [ ] **Wireframes approved by the owner in all three sizes** (phone portrait
      390×844, phone landscape 844×390, desktop 1280×800) before building — these
      are new screens.
- [ ] **Content written and owner-reviewed:** how-to, scoring, and tips copy
      for each game; the side-column content per puzzle is the owner's call
      (IDEAS item, 2026-10-17). This is real writing, not meta tags.
- [ ] Unique `<title>`, meta description, `<h1>`, and canonical per page;
      internal links Home ↔ each per-type page ↔ the other page; a "Try another
      puzzle" link from each per-type page to `/play`.
- [ ] **Site structure matches the locked decisions:** `/` is the prerendered
      landing page (h1 = title, real content), the game lives at `/play`
      (`noindex`). The current live structure (game on Home) differs — implement
      the decided structure as part of this track.
- [ ] `sitemap.xml` exists and lists **canonical, indexable URLs only**:
      `/`, `/memory`, `/block-puzzle`, and `/privacy` (no release document to
      date mentions a sitemap — assume it does not exist until checked).
      `robots.txt` allows the public pages and lists the sitemap. `noindex` on
      `/play`, seed/share pages, and admin, auth, profile, and API routes —
      applied via meta/header, **never by blocking those URLs in `robots.txt`**:
      a blocked URL is never crawled, so its `noindex` would never be seen.
- [ ] Social sharing metadata per the settings in §4.2, including one static
      Open Graph image per puzzle type.
- [ ] Owner submits the sitemap in Search Console; after launch, check
      indexing, queries, and Core Web Vitals (targets: LCP ≤ 2.5 s, INP ≤ 200 ms,
      CLS ≤ 0.1 on a mid-range phone — recorded measurements, §7).
- [ ] Small decision inside this track: whether public leaderboard pages are
      indexable (long plan §11.3 allows it, canonicalised) or `noindex` for v1.
      Record the choice; default to `noindex` if undecided at build time.

**Deferred from §11.3 (not v1):** structured data beyond §4.2, dynamic OG
images, translations/`hreflang`, seed share pages (the share feature itself
is deferred; share links remain the fenced exception in §9).

### 4.2 SEO settings (adopted values)

Brand and metadata values adopted for v1 (owner-supplied SEO configuration,
reviewed 2026-10-24). Exact copy lives here so Codex does not invent its own.

| Setting                                     | Value                                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand                                       | Morphi.One                                                                                                                                                                  |
| Homepage SEO title                          | `Morphi.One – Free Online Puzzles & Brain Games`                                                                                                                            |
| Homepage H1 / headline                      | "Give Your Brain Something to Play With."                                                                                                                                   |
| Homepage meta description                   | "Play free online puzzles at Morphi.One. Start with a quick memory or block puzzle, beat your best score, and discover a new challenge with every round. No signup needed." |
| Homepage supporting copy                    | "One click. A fresh puzzle. Every round brings a new challenge. Play free online memory and block puzzles, then discover more puzzle types as Morphi grows."                |
| Homepage canonical                          | `https://morphi.one/`                                                                                                                                                       |
| Memory page SEO title                       | `Free Online Memory Matching Game \| Morphi.One`                                                                                                                            |
| Memory page H1                              | "Play the Free Memory Matching Game"                                                                                                                                        |
| Memory meta description                     | "Match the pairs, sharpen your memory, and beat your best score in this free online memory game. Play instantly on Morphi.One."                                             |
| Block page SEO title                        | `Free Online Block Puzzle Game \| Morphi.One`                                                                                                                               |
| Block page H1                               | "Play the Free Block Puzzle Game"                                                                                                                                           |
| Block meta description                      | "Place blocks, clear full lines, build combos, and beat your best score in this free online block puzzle. Play instantly on Morphi.One."                                    |
| `og:title` (home)                           | `Morphi.One — A New Puzzle Every Play`                                                                                                                                      |
| `og:description` (home)                     | "One click, a fresh puzzle. Play free online memory and block puzzles, and discover something different every round."                                                       |
| `og:type` / `og:url` / site name / language | `website` / `https://morphi.one/` / Morphi.One / English (`en`)                                                                                                             |
| `og:image` (home)                           | A branded 1200 × 630 image: Morphi logo plus actual puzzle previews — no generic stock imagery                                                                              |
| Twitter card                                | `summary_large_image`                                                                                                                                                       |

- [ ] **H1/title rule (amended):** `DECISIONS.md` records the homepage H1 as
      _equal to_ the title; the adopted settings deliberately use different
      title and H1 lines. v1 follows long plan §11.3's rule instead — the H1
      matches the title's primary phrase/topic — and Codex updates the
      `DECISIONS.md` landing-page entry to match. Search-result titles and
      snippets are Google's choice regardless; both lines stay unique, accurate,
      and relevant.
- [ ] **Keyword use:** target phrases live naturally in titles, headings,
      descriptions, visible copy, and internal links — primary "online puzzles"
      themes on Home, block-puzzle phrases on `/block-puzzle`, memory-game
      phrases on `/memory`. There is **no meta keywords tag** (Google ignores
      it). Do **not** target "daily brain challenge" (daily challenge is a
      parked feature Morphi does not have) or "random puzzle generator"
      (a generator is a tool the user operates; Morphi deals the puzzle — the
      differentiator line is "one click, a fresh puzzle"). Keyword themes are
      untested candidates; Search Console data decides what actually works.
- [ ] **Structured data:** deferred, as above. At most, a bare `WebSite`
      entry if it is trivially cheap — with no invented ratings, review counts,
      prices, or FAQ content. Valid structured data is never a launch gate.

### 4.3 SEO launch verification

Run against production after the SEO pages deploy (each deployment with its
own owner approval); this is a verification list, not a second build spec.

- [ ] Homepage title, meta description, H1, and canonical are live as §4.2.
- [ ] Memory and Block pages carry their unique §4.2 metadata.
- [ ] `sitemap.xml` and `robots.txt` work in production; the sitemap lists
      canonical, indexable URLs only.
- [ ] `noindex` is in effect on `/play` and on seed/share pages (and those
      URLs are **not** blocked in `robots.txt`).
- [ ] Apex domain verified in Google Search Console (done, §1 — confirm the
      property still shows it).
- [ ] Sitemap submitted; homepage and both game URLs inspected in Search
      Console.
- [ ] Rendered HTML, mobile layout, and HTTP status codes checked for `/`,
      `/memory`, `/block-puzzle`, `/privacy`, and `/play`.
- [ ] Social sharing metadata and the branded preview image render correctly
      when the homepage and game pages are shared.
- [ ] Core Web Vitals tested (§4.1 targets); structured data tested only if
      any was added.
- [ ] Post-launch, monthly (owner): review real search queries and
      landing-page performance in Search Console and adjust copy from evidence,
      not guesses.

### 4.4 Why this track goes first

SEO pages need weeks to be indexed and ranked, and they depend on nothing in
Track B. Ship them on the guest build (each deployment with its own owner
approval) so the audience grows while accounts are built.

## 5. Track B — Account track (owner/Codex)

### 5.1 Production backend preparation

- [ ] **Release change to the accepted build — remove "Block first" (§3):**
      the selector's weighted shuffle-bag draw decides which family starts
      (long plan §11.14); with two families the sequence still strictly
      alternates after the drawn start, and no family repeats in a row. Update
      the repo's simple-plan and `DECISIONS.md` entries that record the
      2026-10-20 "Block comes first" addition, and update any selector tests
      that assert a Block-first start; the change is covered by the §7 product
      regression gate like any other release change. Also implement the §3
      mystery rule in the core loop: the Next action and any preloaded-round
      UI must not name, preview, or otherwise reveal the upcoming puzzle
      before it arrives.
- [ ] Dedicated production configuration + release checklist prepared locally,
      reviewable **without secret values**. `wrangler.jsonc` stays the
      local-account configuration; `wrangler.public-privacy.jsonc` stays the
      guest-only artifact. **Do not run the existing normal deploy script against
      production.**
- [ ] Confirm the actual Cloudflare plan, current limits, budget, and
      billing/alert owner before provisioning. Do not assume a paid-plan upgrade
      or quote reference-plan prices as current settings.
- [ ] Create/bind the production D1 database; apply reviewed, compatible
      migrations; start from an **empty** dataset (no development fixtures, no
      local accounts/history).
- [ ] Stage an independent `BETTER_AUTH_SECRET`, production
      `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` as Worker secrets;
      `BETTER_AUTH_URL=https://morphi.one`. Check current Wrangler behaviour
      before any secret command — some can activate a deployment. Reports show
      binding names/status only, never values.
- [ ] Production candidate checks: canonical HTTPS auth base, exact trusted
      origin, secure/HttpOnly/SameSite session cookies, no private caching of
      responses, body/move/rate limits, token-safe error logging.
- [ ] `workers.dev` behaviour decided explicitly: it is the **same Worker** as
      morphi.one, not staging, and must not become an alternate authentication
      origin accidentally.
- [ ] If accounts open first to invited testers, the restriction is an
      explicit, tested, server-side mechanism decided before provisioning —
      obscurity is not a restriction.
- [ ] Security review item: in the pinned Better Auth (1.7.12), OAuth
      access/refresh tokens get application-level encryption but the **ID token is
      stored separately without it** (`PRIVACY_RETENTION.md`). Record the accepted
      risk or the mitigation before real account data exists.

### 5.2 Admin panel — Stage 1 (decided in §3; scope here)

Foundation: the functions already exist in the local CLI (§1); the panel is
secure production _access_ to them, plus the dashboard in §5.3. Build to long
plan §11.10 Stage 1 and the RBAC matrix; Stages 2–5 stay deferred (see §10).

- [ ] **Screens:** admin status (ranked on/off with confirmation, reason, and
      a clear result); score/player moderation (bounded lookup by public
      player/run id; inspect eligible/hidden scores; hide/restore; ranked
      ban/unban with reason; **public player-name handling** — the RBAC matrix
      includes `user:rename` for admin/moderator, and the launch checklist
      requires at minimum that an admin can hide a score, rename, or ban);
      moderation queue including username reports (reports arrive via the
      monitored contact — no public report system in v1); audit log viewer
      (admin-only, paginated, read-only — the panel cannot delete audit rows).
- [ ] **Security acceptance (all required):** explicit enrolment of the owner
      only; two-factor authentication for every admin account plus a recovery
      mechanism; deny-by-default, per-action server-side permission checks from
      the RBAC matrix (roles in code, assignment in the database, no role-editor
      UI); fresh re-authentication (about 15 minutes) for sensitive actions;
      short admin sessions; strict rate limits/lockout on `/admin` and
      `/api/admin`; CSRF/origin protection on every state-changing request;
      bounded, validated input; **atomic mutation + audit** for every action
      (who, when, what, before/after, reason — no Google tokens, private request
      messages, or children's information in reasons); **impersonation disabled**;
      admin routes `noindex`, excluded from the sitemap, never linked from the
      public site; consider Cloudflare Access / IP allowlist as defence in depth;
      the last remaining admin cannot be demoted or deleted; the Stage 0 CLI
      remains the break-glass path if the panel is down.
- [ ] **Wireframes approved** (portrait, landscape, desktop) before
      implementation; panel is desktop-first, dense, English-only per §11.10.
- [ ] **Tests:** a permission-matrix test (every role × permission, allow/deny,
      including 403 for ordinary players on every admin route), an audit-log test
      per action, and failure-state tests. Ordinary players must have no path to
      a role; bootstrap is explicit, never an unauthenticated public endpoint.

### 5.3 Visibility — dashboard and tracking

The panel is a window; this section is the data behind it. Cloudflare Web
Analytics (already live) covers visits/page performance only — it is not
account, save, or security monitoring.

- [ ] **Read-only dashboard (aggregates from data D1 will already store):**
      accounts created; completed runs by game and day; ranked starts vs. claims
      (completion rate); leaderboard entries; hidden scores and active bans;
      deletion counts. No custom analytics dashboard beyond these aggregates in
      v1; link out to Cloudflare Web Analytics for traffic instead of rebuilding
      it.
- [ ] **Guest-funnel events — subject to decision D1 (§6).** If approved, the
      smallest set from long plan §11.6: `play_clicked`, `round_started`,
      `round_completed`, `next_clicked`, `error {code, type}` — anonymous id,
      coarse buckets/enums only, never the raw seed, never personal data, with an
      opt-out and consent handling per §11.6. This is the data whose absence
      forced the Step 5 replay-rate waiver.
- [ ] **Privacy consequence, if D1 is approved:** the live privacy page
      currently states no custom game events are sent. Update the disclosure
      truthfully (actual revision date) as part of the same release; do not ship
      events ahead of the disclosure.
- [ ] **Production logging decision:** live observability is currently
      disabled at the top level, Logpush off, no tail consumers
      (`PRIVACY_RETENTION.md`). Decide and record the production setting: Workers
      logs with correlation ids, the `redact_query_string:true` setting already
      prepared locally, sampling/persistence, and who reviews errors in week one.
      Do not promise a fixed log-retention period that provider settings do not
      support.

### 5.4 Production operations (the four reference amendments)

- [ ] **Maintenance mechanism (amendment 1 — scheduler):** today there is **no
      scheduler at all**. `prune-expired` is manual, local-only, and has never run
      on real data. Decide and build the production mechanism (proposed: one
      daily owner-run check initially, failures recorded, missed-run recovery
      procedure) covering what `PRIVACY_RETENTION.md` defines: expired sessions
      (7-day lifetime), expired OAuth state (~10 min), rate-limit rows idle
  > 24 h, ranked-start IP hashes after the 1-hour cap window, and expired
  > unclaimed ranked starts — while preserving active rows, supersession, and
  > claimed-but-uncommitted runs needed for retry recovery. This cadence is a
  > proposal to approve, not a guaranteed deletion deadline.
- [ ] **Verified-request path (amendment 2 — export):** build the production
      operator path for access/correction/export/deletion per
      `PRIVACY_REQUESTS.md`. There is **no data-export endpoint** today, and an
      access request can cover more than the 30 runs the UI shows. Production
      `privacy-delete` equivalent required (the local command must not be pointed
      at production or have its guard bypassed); deletion revokes sessions and
      removes profile/provider rows, public name, owned runs/starts, and bans,
      with a minimal audit (internal id + opaque case reference only). A ranked
      ban is not a login suspension and never substitutes for erasure.
- [ ] **Audit retention (amendment 3a):** `admin_audit` currently has **no TTL
      or automatic purge**, and unresolved claimed ranked starts have **no maximum
      retention**. Decide audit access, purpose, review cadence, and justified
      retention — and a rule for unresolved claims — and record them in
      `PRIVACY_RETENTION.md`. Unresolved items stay explicit; do not promise
      arbitrary 30-day logs or 12-month audits.
- [ ] **Recovery (amendment 3b, with §5.1's ID-token item):** rehearse a
      **timed restore** in an authorised isolated database before real account
      data is exposed; reapply completed erasures before restored data becomes
      available; record recovery time and potential data loss; do not promise an
      untested recovery objective. D1 Time Travel (7 days Free / 30 days Paid)
      is a recovery window, **not** a backup-expiry or erasure promise. Owner
      performs/authorises restores, key rotation, and admin recovery; record how
      rotation affects sessions.
- [ ] Operator enrolment for production per §5.2 (2FA, re-authentication,
      recovery) rehearsed on synthetic data, including moderation, ranked
      off/on (guest play must survive ranked-off), maintenance, and a full
      privacy deletion where another account stays intact.

## 6. The open decisions (D2 decided; four remain)

v1 scope freezes when the owner confirms or flips each of these. Current
recommendations are recorded so a flip is a conscious change, not a drift.

- [ ] **D1 — Tracking scope.** _Recommendation: approve both halves of §5.3_ —
      the read-only dashboard over existing D1 aggregates **and** the lite
      anonymous guest-funnel event set, with its privacy-page update. Alternative:
      dashboard only (accept that guest replay behaviour — the north-star
      question — stays unmeasured, as in Step 5).
- [x] **D2 — SEO in v1. Decided (owner, 2026-10-24):** yes — per-type pages
      in v1 as §4.1/§4.2, on the guest track ahead of accounts, in the
      Google-only-doors model decided in §3. (The remaining decisions below
      are D1, D3, D4, and D5.)
- [ ] **D3 — Terms page.** _Recommendation: prepare a short `/terms` page_ —
      owner-reviewed, covering account use, public names and ranking rules, and
      the contact (Ali Gohar, cngohar@gmail.com), with no invented guarantees.
      Record either way that terms are **optional under Google's homepage
      requirements and not an OAuth blocker**. Separate About/Contact pages and
      admin editing of pages stay deferred.
- [ ] **D4 — Procedural themes (long plan §11.2).** _Recommendation: out of
      v1._ The generated-theme system (recipe palettes in OKLCH, continuous base
      hue, generated symbol/shape/style/backdrop axes, freshness candidate draws)
      is the first post-launch step. For v1, fix the copy instead (§9). A "yes"
      here re-opens the v1 scope and schedule and needs its own plan.
- [ ] **D5 — Account eligibility and launch jurisdictions.** _Owner's call;
      no recommendation is recorded on the legal substance._ Record (a) the
      public account-eligibility wording, consistent with the approved
      general-audience privacy page, and (b) the applicable launch jurisdictions
      — or the one specific unresolved question and its owner, not a general
      "to be decided." Framing from `PRIVACY_REQUESTS.md`: a general-audience
      disclaimer does not settle a credible child-information report; there is no
      automated eligibility block; Google's basic scopes do not report date of
      birth or prove age. This decision **does not** add an age flow or reopen
      the approved privacy wording, and legal advice is the route where a
      jurisdiction is unclear.

## 7. Release gates — evidence required

No gate is passed by appearing here. Store evidence in `PHASE_REPORTS.md`,
measurements in `STEP6_MEASUREMENTS.md`, operating facts in the privacy/admin
docs, and decisions in `DECISIONS.md`, labelled completed/verified,
implemented/unverified, owner decision, deployment authorisation, or Google
state, as applicable.

- [ ] **Product regression:** final `bun run verify` passes (zero type
      errors/warnings, unchanged known vectors and fingerprints, reviewed
      production bundle). Prior local owner acceptance stands; new evidence
      covers only the release changes.
- [ ] **Public OAuth:** §2 verification recorded; an ordinary Google account
      outside the project-owner/tester group signs in successfully; consent
      identity and basic scopes correct; cancel/failure returns safely to guest
      play.
- [ ] **Data/privacy:** cross-device saves, account isolation, durable
      retries, no private fields on public boards, self-service deletion and the
      §5.4 operator path verified, post-restore erasures reapplied. The deployed
      behaviour matches the privacy page.
- [ ] **Operator/admin:** §5.2 security acceptance and tests pass;
      maintenance and recovery drills (§5.4) pass on synthetic data.
- [ ] **CPU, memory, capacity — currently unmeasured, do not waive casually:**
      the local replay numbers in `STEP6_MEASUREMENTS.md` (workerd median
      0.75 ms per 300-move Block replay, 0.054 ms per Memory replay) exclude
      auth, D1, network, and response costs; their p95 is a batch average and
      their heap figures are post-batch observations, **not** peak isolate
      memory. Required: actual production-plan limits; measured HTTP/auth/D1
      CPU; peak-memory evidence or its explicit measurement limitation; query
      timings; request/error rates; latency median/p95 — cold and warm, with
      representative bounded replays. No capacity pass while a required
      measurement is unresolved; any waiver needs an explicit owner exception
      with the risk recorded.
- [ ] **Load envelope:** proposal — first establish **100 simultaneous
      synthetic player sessions** at a documented round cadence, with ramp,
      duration, request mix, and pass thresholds agreed _before_ running, on an
      authorised isolated target with synthetic users (never flood the live guest
      site or Google login; test real Google login separately). Do not claim
      500/2,000-player support; larger tests need a separately approved
      target/budget.
- [ ] **Interaction and accessibility:** long plan §12.3/§13.1 starting
      budgets — about 150 KB critical Home transfer, about 300 ms preloaded
      Play, visible Next feedback about 100 ms, playable within about 600 ms.
      Record cold/preloaded, named phone and desktop, network profile, at least
      five runs, median/p95; plus keyboard, focus, reduced-motion, and a manual
      screen-reader pass for both games. Evidence or an explicit owner waiver
      per item.
- [ ] **Compatibility and rollback:** supported active-run versions remain
      verifiable through their lifetime (or have a clear retry path); migrations
      are compatible for one release; rollback rehearsed on synthetic data, with
      a named person able to invoke it and the applicable deployment approval
      obtained. **Never reset production D1 to undo a code release.**
- [ ] **Final authorisation:** exact artifact/configuration reviewed,
      remaining risks explicit, owner approves each deployment separately, and
      separately accepts/announces the public launch.

## 8. Controlled rollout and announce

1. [ ] After explicit approval, deploy the exact reviewed artifact with the
       agreed release restriction (§5.1). First re-inspect the live
       version/settings for concurrent changes. Record artifact hashes,
       migration state, and deployment/version ids — no secrets.
2. [ ] Production smoke test on a real phone and a real desktop: guest play
       and sign-in cancel; name setup/edit; sign-out/sign-in; second-device
       completed history; account isolation; ranked replay and boards; offline
       retry and duplicate acknowledgement; fresh deletion and session
       revocation. Record devices/browsers for this run.
3. [ ] Operator test per §5.4, including that guest play survives
       ranked-off.
4. [ ] Page checks: Home/privacy links, production metadata, the per-type
       pages (§4.1) and any approved `/terms`; no draft/development URLs; no
       private leaderboard fields; the intentional Cloudflare analytics beacon
       present and no other analytics. Update the privacy page's
       later-account-release language truthfully now that accounts are live,
       preserving the approved audience wording and using the actual revision
       date — including the §5.3 event disclosure if D1 was approved.
5. [ ] Telemetry and rollback capability checked (§5.3, §7). Do not expose
       remaining accounts or announce while a critical data-loss, security,
       deletion, or restore defect is unresolved.
6. [ ] **Announce:** the owner accepts the release evidence and authorises
       opening any remaining restriction and announcing v1 (any deployment
       needed for the opening needs its own approval). The announcement uses
       the §9 positioning. Review errors, save failures, abuse, D1 usage, and
       costs daily for the first seven days (owner-run cadence; a named owner
       and a recorded outcome for the first-week review).

## 9. Positioning — the corrected randomness line

- **What is true today:** every Play/Next is a fresh draw — a 64-bit seed from
  a cryptographically secure source (`crypto.getRandomValues`, never
  `Math.random`; the server does the same for ranked), with everything else
  deterministic from that seed. The player cannot choose or preview the
  instance.
- **What is not true today:** the content space is small and curated — two
  families in strict alternation (from v1 the selector's draw, not a fixed
  rule, decides which starts — §5.1), four fixed preset themes the seed
  picks between, fixed symbol sets, no generated colours. Simple plan
  Step 4 states it plainly: "Three or four fixed color themes. The seed picks
  one. No randomly generated colors yet." The §11.2 generated-theme system is
  designed but **not built** (decision D4).
- **The honest v1 line:** _"You don't pick the puzzle — Morphi deals you
  one."_ A random draw from a curated box; the unpredictability and the
  no-choice deal are the product, not content entropy. **Do not use "true
  randomness" as a headline** until §11.2 is built.
- **Mystery rule (owner decision, §3):** in the core loop the upcoming
  puzzle is never named, previewed, or teased in advance — not by the Next
  action, a preload, or a result screen. Its name is revealed only when it
  arrives. Per-type pages (§4.1) sit outside that loop as search-engine
  doors and must never be linked or presented as an in-product catalogue.
  The fenced exceptions stay fenced: share links replay one seed in
  solo/unranked "beat my score" mode, and solo Try-again on failure is an
  undecided IDEAS item, banned in ranked play.

## 10. Explicitly out of v1 (parked)

No payments/subscriptions, multiplayer, translations/RTL, dark theme,
achievements/XP/levels, daily challenge, share links, Durable Objects or D1
sharding, seed banks, GA4 or a general analytics pipeline (beyond decision
D1), theme-stats pipeline, physics puzzles, new puzzle families, a kids
site, or a CMS. Admin panel Stages 2–5 (config editor; users/payments suite;
full dashboard/announcements and theme-performance tooling beyond §5.3;
content management) wait until Stage 1 is in use and a real need exists.

## 11. Done when

- [ ] §2 verifications recorded.
- [ ] All decisions in §6 recorded with the owner's name and date.
- [ ] Track A (§4) live or explicitly deferred by the owner, with its
      deployment approvals recorded separately.
- [ ] Track B (§5) built and gated by §7, with evidence stored as §7 directs.
- [ ] §8 completed: the owner has accepted the release, public accounts work
      end-to-end, the operator can maintain and recover the system, and the
      first-week review has a named owner and a recorded outcome.

## Appendix — evidence base for this checklist

Reviewed: `V1_RELEASE_PLAN.md`; `morphi-plan-simple.md`; long plan §11.2,
§11.3, §11.6, §11.10, §11.14 (§11.1a/§11.16 as referenced); `DECISIONS.md`;
`LAUNCH_CHECKLIST.md` (background only — agents act on it only where items
are promoted into the plan, as SEO is via `DECISIONS.md`/§11.3); `IDEAS.md`
(background only); `ADMIN_LOCAL.md`; `GOOGLE_OAUTH_PUBLIC.md`;
`PHASE_REPORTS.md` (top reports); `PRIVACY_REQUESTS.md`;
`PRIVACY_RETENTION.md`; `PUBLIC_PRIVACY_RELEASE.md`; `STEP6_WORK.md`;
`STEP6_REVIEW.md`; `STEP6_MEASUREMENTS.md`. **`PRIVACY_REVIEW.md` was named
in the v1 plan's references but was not among the files supplied for this
review — it has not been cross-checked here.** Where documents layer updates,
the newest dated section wins; two superseded lines worth knowing:
`STEP6_WORK.md` still calls the public site "the Step 5 game test" in one
early section (superseded by its own guest-publication section), and the
OAuth guide's body still describes a future brand submission (superseded by
its own 2026-10-24 owner update and by §1 of this checklist).
