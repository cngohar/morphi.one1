## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest

---

# AGENTS.md (Morphi)

Instructions for coding agents (Codex, Gemini, OpenCode, Claude Code, etc.) working in this repo.

## Subagent policy

The owner authorizes delegation during repository tasks using this routing:

- Planning and research: `gpt-6.1-sol`, reasoning effort `high`.
- Coding, debugging and other execution: `gpt-6.1-sol`, reasoning effort `high`.
- Testing and verification, including lint, E2E, Chromium, Playwright and `bun run verify`: `gpt-6-luna`, reasoning effort `max`.

The parent agent coordinates tasks, integrates results and reports to the owner. Spawn with the explicit model and reasoning effort above, `fork_turns: "none"`, and supply the task context and applicable repository instructions. If a required model or effort is unavailable, report it rather than silently substituting. This policy applies only to this repository; existing scope limits and approval gates remain in force.

For testing and verification:

- Use 2–3 `gpt-6-luna` agents at `max` reasoning for independent checks when useful and concurrency and local resources permit. A suggested split is lint/type checks, unit tests, and integration/Worker/browser checks; coordinate shared setup dependencies first. Small tasks use one testing agent; neither three agents nor duplicate checks are required.
- One agent owns browser testing. Preserve Playwright `workers: 1` unless an isolation or configuration change is separately justified.
- Stabilize source before testing; do not edit or fix files while checks are active. Serialize conflicting builds, Svelte sync, generated-file writes, migrations/local database access, shared server ports and output artifacts.
- Never run multiple `bun run verify` commands concurrently or overlap a full verify with its component commands.

## Source of truth

`morphi-plan-simple.md` is the active day-to-day plan: games first, architecture second. The owner reaffirmed this on 2026-10-23. `docs/PLAN.md` is reference only; pull in relevant sections when the simple plan calls for them. The simple plan and explicit owner instructions take precedence over the full-plan phase requirements below; do not introduce the full platform architecture as a prerequisite to game work. `docs/DECISIONS.md` lists decisions already made. Use `docs/CODEMAP.md` to find code before running broad searches. Report unresolved conflicts to the owner.

## Current phase

**v1.3.5.13 Batch F accepted; source commit and push authorized (2026-11-08):**
The owner said “update the git repo and then push to github”, accepting the completed 10
genuine Memory Cloudflare Next-Gen Developer Platform & Edge Primitives rulesets
(`memory:workflows-step`, `memory:browser-rendering`, `memory:ai-gateway`, `memory:k2-streams`,
`memory:basin-catalog`, `memory:edge-snippets`, `memory:images-transform`, `memory:waiting-room`,
`memory:privacy-pass`, and `memory:agents-sdk`) and authorizing this source commit and push.
The 10 rulesets are implemented end-to-end under ponytail principles in `src/lib/puzzles/memory/logic.ts`,
dimensions in `dimensions.ts`, manifest entries with 30 new immutable leaderboard groups in `manifest.ts`,
localization in `messages.ts`/`i18n`, and regenerated projections. Total catalog Memory variants are now
70 (210 leaderboard groups). Multi-runtime vectors (6/6 runtimes, fingerprint `a8be9d5f...` and memory vector
fingerprint `e11e8733...`), workspace types (0 errors/0 warnings), unit tests (47/47), real-D1 integration
suite (15/15), and Playwright Chromium admin suite (3/3 at one worker) pass. Full `bun run verify` remains
deferred; unauditioned audio and editor exclusions preserved. No production deployment authorized.
See `docs/briefs/v1.3.5.13-batch-f-brief.md` and `docs/work/V1.3.5.13_WORK.md`.

**v1.3.5.12 Batch E accepted; source commit and push authorized (2026-11-08):**
The owner said “update the git repo and push to github”, accepting the completed 10
genuine Memory botanical and nature rulesets under the new Split Dual-Garden Baseline
(`memory:cross-pollination`, `memory:mycelium-network`, `memory:photosynthesis`, `memory:seed-dispersal`,
`memory:seasonal-bloom`, `memory:bee-waggle`, `memory:carnivorous-briar`, `memory:chlorophyll-meter`,
`memory:bioluminescent`, and `memory:botanical-graft`) and authorizing this source commit and push.
The 10 rulesets are implemented end-to-end under ponytail principles in `src/lib/puzzles/memory/logic.ts`,
dimensions in `dimensions.ts`, manifest entries with 30 new immutable leaderboard groups in `manifest.ts`,
localization in `messages.ts`/`i18n`, and regenerated projections. Non-rectangular split board structure is
strictly tied to gameplay invariants (intra-bed flips prohibited / cross-pollination invariant) per Constraint C2.
Total catalog Memory variants are now 60 (180 leaderboard groups). Multi-runtime vectors (6/6 runtimes,
fingerprint `a8be9d5f...` and memory vector fingerprint `e11e8733...`), workspace types (0 errors/0 warnings),
unit tests (46/46), real-D1 integration suite (15/15), and Playwright Chromium admin suite (3/3 at one worker) pass.
Full `bun run verify` remains deferred; unauditioned audio and editor exclusions preserved. No production deployment authorized.
See `docs/briefs/v1.3.5.12-batch-e-brief.md` and `docs/work/V1.3.5.12_WORK.md`.

**v1.3.5.11 Batch D accepted; source commit and push authorized (2026-11-07):**
The owner said “done, now update the repo and push to github”, accepting the completed 10
genuine Memory distributed cloud and edge architecture rulesets (Workers KV eventual consistency,
Durable Object actor row mutex, Vectorize KNN semantic similarity clustering, Cloudflare Queues FIFO
batch & DLQ, Workers AI 120-token context window budget, Hyperdrive connection pooling, Turnstile
managed challenge human verification, Zero Trust RBAC tiered clearance, Argo smart routing dynamic
quadrant reroute, and Cloudflare R2 Glacier cold archive) and authorizing this source commit and push.
The 10 rulesets are implemented end-to-end under ponytail principles in `src/lib/puzzles/memory/logic.ts`,
dimensions in `dimensions.ts`, manifest entries with 30 new immutable leaderboard groups in `manifest.ts`,
localization in `messages.ts`/`i18n`, and regenerated projections. Total catalog Memory variants are now
50 (150 leaderboard groups). Multi-runtime vectors (6/6 runtimes, fingerprint `a8be9d5f...`), workspace types
(0 errors/0 warnings), unit tests (45/45), real-D1 integration suite (15/15), and Playwright Chromium admin
suite (3/3 at one worker) pass. Full `bun run verify` remains deferred; unauditioned audio and editor
exclusions preserved. No production deployment authorized. See `docs/briefs/v1.3.5.11-batch-d-brief.md`
and `docs/work/V1.3.5.11_WORK.md`.

**v1.3.5.10 Batch C locally implemented & verified (2026-11-07):**
The owner said “done accepted , you can start the implementation”, authorizing local app implementation
of the 10 genuine Memory network and cybernetic protocol rulesets (CDN edge cache ghost imprint, Quantum
entangled twin node, 429 rate limiter cooldown backoff, Data buffer register, ICE firewall barrier unblock,
Anycast perimeter re-route shift, 3-way TLS cryptographic handshake, Security trace quarantine lockdown,
Bit-rot data transposition, and Packet burst uplink flash).
The 10 rulesets are implemented end-to-end under ponytail principles in `src/lib/puzzles/memory/logic.ts`,
dimensions in `dimensions.ts`, manifest entries with 30 new immutable leaderboard groups in `manifest.ts`,
localization in `messages.ts`/`i18n`, and regenerated projections. Total catalog Memory variants are now
40 (120 leaderboard groups). Multi-runtime vectors (6/6 runtimes, fingerprint `e11e8733...`), workspace types
(0 errors/0 warnings), unit tests (44/44), real-D1 integration suite (15/15), and Playwright Chromium admin
suite (3/3 at one worker) pass. Full `bun run verify` remains deferred; unauditioned audio and editor
exclusions preserved. Ready for owner functional review; no auto-commit or push performed.
See `docs/briefs/v1.3.5.10-batch-c-brief.md` and `docs/work/V1.3.5.10_WORK.md`.

**v1.3.5.9 Batch B locally implemented & verified (2026-11-07):**
The owner said “accepted and you can procced to implementaation”, selecting the standard light
theme and authorizing local app implementation of the 10 genuine Memory exploration rulesets
(Superstorm thermal hazard, Sentinel wanted level, Atlas glyph sequential matching, Analysis
visor spectral backs, Exosuit life support power drain, Warp jump diagonal anomaly shift, Gravitino
risk gamble, Pulse drive speed multiplier, Derelict freighter fog of war, and Atlas 16/16 loop).
The 10 rulesets are implemented end-to-end under ponytail principles in `src/lib/puzzles/memory/logic.ts`,
dimensions in `dimensions.ts`, manifest entries with 30 new immutable leaderboard groups in
`manifest.ts`, localization in `messages.ts`/`i18n`, and regenerated projections. Total catalog
Memory variants are now 30 (90 leaderboard groups). Multi-runtime vectors (6/6 runtimes, fingerprint
`a8be9d5f...`), workspace types (0 errors/0 warnings), unit tests (43/43), real-D1 integration
suite (15/15), and Playwright Chromium admin suite (3/3 at one worker) pass. Full `bun run verify`
remains deferred; unauditioned audio and editor exclusions preserved. Ready for owner functional review;
no auto-commit or push performed. See `docs/briefs/v1.3.5.9-batch-b-brief.md` and `docs/work/V1.3.5.9_WORK.md`.

**v1.3.5.8 Batch A accepted locally; source commit authorized (2026-11-07):**
The owner said “done approved you now comit”, accepting the completed 10 genuine Memory
ruleset variants (Countdown timer, Three strikes survival, Wild card, Sonar reveal, Zebra
bicolor constraint, Row drift, Seen card decay, Single-flip continuity, Streak multiplier combo,
and Hazard trap card) and authorizing this source commit. The 10 rulesets are implemented end-to-end
under ponytail principles: stateful mechanics in `src/lib/puzzles/memory/logic.ts`, dimensions in
`dimensions.ts`, manifest entries with 30 immutable leaderboard groups in `manifest.ts`, localization
in `messages.ts`/`i18n`, and dynamic policy counting. Total catalog Memory variants are now 20.
Multi-runtime vectors (6/6 runtimes, fingerprint `e11e8733...`), workspace types (0 errors/0 warnings),
unit tests (20/20), real-D1 integration suite (15/15), and Playwright Chromium admin suite (3/3 at one
worker) pass. Full `bun run verify` remains deferred; unauditioned audio and editor exclusions preserved.
No push, deployment, or Batch B implementation is authorized. See `docs/briefs/v1.3.5.8-batch-a-brief.md`
and `docs/work/V1.3.5.8_WORK.md`.

**v1.3.5.7 accepted locally; source-only GitHub handoff authorized (2026-11-07):**
The owner said “got them, approved and now comit and push to github”, accepting the
completed Tier 2 Memory directory and authorizing this source-only commit/push to
existing `origin/main`. This supersedes earlier .7 pending-review and commit/push limits
for this handoff only. Scoped format/lint/types (0 errors/warnings), real-D1 integration
suite (15/15 passed), and Playwright Chromium admin suite (3/3 passed at single worker,
including directory checks across 390×844, 844×390, and 1280×800 with zero horizontal
overflow and retained captures in `build/v1.3.5.7/`) remain the verification evidence.
Ten Memory variants remain the accepted catalogue; .7 adds no new variants. Full `bun run verify`
remains deferred; unauditioned audio and unrelated local editor/MCP files remain excluded.
No .8, future commit/push, deployment, or production change is authorized. See
`docs/briefs/v1.3.5.7-tier2-directory-brief.md` and `docs/work/V1.3.5.7_WORK.md`.

**v1.3.5.6 Memory Tier 1 policy locally completed (2026-11-07):**
The owner accepted the .6 fixture as a functional visual baseline at the three
required sizes, deferred visual polish, and explicitly authorized local
implementation. They allowed direct parent work/testing because required
`gpt-6.1-sol`/`gpt-6-luna` models are unavailable; no substitute agent evidence
is claimed. Memory-only supported dimensions, immutable `game_config` snapshots,
audited CAS policy writes, admin Policy tab, effective availability and atomic
ranked issuance are connected. Existing in-flight rounds retain issued rules;
other families and the ten locally accepted Memory variants are unchanged.
Scoped format/lint/types (0 errors/warnings), dimension unit (1/1), real-D1
(14/14), Chromium admin (2/2 at one worker, policy at three sizes), four focused
shared config/issuance tests, and 38 Memory vectors in six runtimes pass.
Owner functional acceptance of .6 is recorded; .6 completed. Full `bun run verify` remains
deferred; no commit/push, deployment, or production change is authorized.
The pre-existing .4 slice6 unit failure remains recorded. Preserve C1–C10,
unauditioned audio and unrelated palette/editor/MCP files. See
`docs/briefs/v1.3.5.6-tier1-policy-brief.md` and `docs/work/V1.3.5.6_WORK.md`.

**v1.3.5.4 Memory identity locally implemented, owner-accepted (2026-11-07):**
The owner selected .4 local work with “ok do it”. Ranked checkpoint recovery now
compares the existing four-variant identity and score snapshot to authoritative
issuance both before Resume and after ownership refresh. Unknown historical
ranked identities return a safe non-resumable conflict. A pre-existing .2 admin
initializer failed `bun run check`; the owner separately authorized its four-
field pagination-default correction. Scoped format/lint, type check (0 errors/
warnings), 15/15 units, 10/10 real D1, six-runtime Memory vectors and focused
Chromium recovery cases pass. No new variants, UI, schema or version. Existing
four Memory variants remain accepted; six .3 additions remain design candidates.
Full verify stays deferred. The owner's later “Accept .4; start .5” closes
local .4 functional review, without authorizing new commit/push or deployment. Preserve C1–C10,
the audio exclusion and unrelated local palette/editor/MCP files. See
`docs/briefs/v1.3.5.4-identity-brief.md` and `docs/work/V1.3.5.4_WORK.md`.

**v1.3.5.3 Memory design matrix and representative visuals approved (2026-11-07):**
After directing “.3 finish the decision and visual review first”, the owner
separately selected “Approve recommendations” for the six pilot rule/identity/
scoring decisions and “Approve three sizes” for the fixture-only preview at
390×844, 844×390 and 1280×800 (including six-group Quads and Budget run-over).
Four existing Memory variants remain the only implemented/accepted catalogue;
six new IDs are approved design candidates, not implemented or functionally
accepted. Local focused fixture checks passed after correcting a 24-card short-
landscape overflow; no app tests, physical-device review or production UI
acceptance is inferred. Full verification remains deferred. No .4/.5 app work,
new commit/push, deployment or production change is authorized by this planning
approval; await separate selection. Preserve C1–C10 and unrelated local/audio
exclusions. See `docs/briefs/v1.3.5.3-memory-matrix-brief.md` and
`docs/work/V1.3.5.3_WORK.md`.

**v1.3.5.2 accepted locally; source-only GitHub handoff authorized (2026-11-07):**
The owner said “update the git repo and push to github”, accepting the completed
bounded Games admin queries and pagination and authorizing this source-only
commit/push to existing `origin/main`. This supersedes earlier .2 pending-review
and commit/push limits for this handoff only. Existing scoped format/lint, Vitest
(9/9), Slice 3 (8/8), and Playwright Chromium suites at all three sizes remain the
verification evidence; no new checks or device/browser details were supplied.
Preserve shared security/scoring, roadmap C1–C10, full-verification deferral,
and the unauditioned-audio exclusion; unrelated local editor/MCP settings and palette
timing changes remain local. No .3, future commit/push, deployment, or production
change is authorized. See `docs/briefs/v1.3.5.2-bounded-games-brief.md` and
`docs/work/V1.3.5.2_WORK.md`.

**v1.3.5.1 accepted locally; source-only GitHub handoff authorized (2026-11-07):**
The owner said “ok mark this accepted and push to github”, accepting the completed
Games extraction and authorizing this source-only commit/push to existing
`origin/main`. This supersedes earlier .1 pending-review and commit/push limits
for this handoff only. Existing scoped format/lint/types, four D1 cases, two
Chromium cases and source/capture comparisons at all three sizes remain the
verification evidence; no new checks or device/browser details were supplied.
Preserve shared security/scoring, roadmap C1–C10, full-verification deferral and
the unauditioned-audio exclusion; unrelated local editor/MCP settings and palette
timing changes remain local. No .2, future commit/push, deployment or production
change is authorized. See `docs/work/V1.3.5.1_WORK.md`.

**v1.3.5 planning handoff (2026-11-06):**
`docs/planning/V1.3.5_ROADMAP.md` is the shared, model-independent entry point
for the draft Memory-only roadmap. Read its START HERE instructions before
preparing or resuming a selected milestone; the HTML preview is a human summary.
This planning handoff does not authorize implementation or replace the active
simple plan. A later explicit owner instruction may authorize one selected
milestone; preserve its visual gates, focused-check limits and complete stopping
point. Do not infer approval of all provisional batches or an automatic commit.

**Source-only GitHub handoff authorized (2026-11-05).** The owner explicitly requested committing the current source handoff and pushing to the existing `origin/main`. Include accepted v1.3.2 changes, local v1.3.3 support and reorganized documentation. This supersedes the commit/push restrictions below only for this handoff. Preserve full-verification deferral and the unauditioned-audio exclusion; v1.3.3 local acceptance is recorded below; no deployment or production change is authorized.

**v1.3.3 Member Support accepted locally (2026-11-05).** The owner confirmed they already reviewed and accepted the implementation; remaining improvements are deferred to later stages, with details and scope not supplied. This supersedes earlier pending-review notes. Device/browser details were not supplied; no physical-device or new automated evidence is inferred. The owner corrected the version from v1.3.4 to v1.3.3 and confirmed accepted v1.3.2 as the baseline. Approved defaults, limits, retention and behavior are implemented; targeted D1, Chromium, types and scoped lint checks pass. The owner explicitly deferred full `bun run verify` to later stages; the active run was stopped during global ESLint after Prettier passed. This is a recorded deferral, not a full verification pass or waiver. See `docs/planning/V1.3.3_MEMBER_SUPPORT.md`, `docs/work/V1.3.3_WORK.md` and the latest phase report. No commit, push, deployment, production change or next feature is authorized.

**v1.3.2 accepted locally (2026-11-05).** The owner explicitly directed marking
the existing Connect variants, admin scoring/pagination and profile polish
accepted. This supersedes the v1.3.2 brief's pending-review status. Automated
verification evidence and device/browser details were not supplied; no test pass
or waiver is inferred. No commit, push, deployment, production change or next
implementation is authorized. See `docs/briefs/morphi-v1.3.2-codex-brief.md`
and `docs/PHASE_REPORTS.md`. Earlier v1.3.1 sound-audition status is unchanged.

**Combined next-phase local work closed (2026-11-01).** The owner accepted all
three slices and quick-review changes, reporting all checks passed after review on
their own local PC and mobile layout checks using browser responsive emulation
with no corrections noted. Browser/device models were not supplied; physical
mobile review was not reported. This supersedes earlier pending-review and next-
phase notes below. No deployment, production release or next implementation is
authorized. See `docs/reviews/NEXT_PHASE_REVIEW.md` and `docs/PHASE_REPORTS.md`.

**Simple plan: Step 6 accepted locally; active v1 integration review.** Step 5 was accepted by owner judgment on 2026-10-23, with the measured replay-rate criterion waived. The owner selected Google-only sign-in with guest play retained, then approved all five account/demo screens and the proposed Step 6 scope and authorized implementation. The first slice implements local D1, Better Auth sessions, public names, sign-out, and deletion. The owner subsequently authorized completing Step 6 locally and the small per-puzzle structural cleanup. Local saved history, ranked replay, leaderboards, and moderation controls are implemented; do not claim Step 6 accepted before its release checks and owner real-device review pass. The owner confirms local Google OAuth works. On 2026-10-24 the owner completed `docs/reviews/STEP6_REVIEW.md`, reported all functional checks working on PC/mobile, and explicitly accepted the local functional build. This supersedes pending owner-review notes; specific device/browser models were not supplied. Production resource measurements/operations remain unresolved, with no waiver or deployment/global-launch approval inferred. See `docs/work/STEP6_WORK.md` and the newest phase report for current evidence. Owner setup and Testing/branding guidance are documented in `docs/operations/GOOGLE_AUTH_SETUP.md`. No additional games or full admin web panel implementation are authorized. After local Step 6 review, the owner wants global-release planning including an admin panel proposal; do not bring that implementation into this local task. Production provisioning and deployment still need their applicable explicit authorization. See `docs/planning/STEP6.md` and `docs/PHASE_REPORTS.md`.

Owner-authorized local privacy preparation (2026-10-23): build `/privacy` for review before public Google verification and the later v1 launch, with future static-page admin editing scoped separately. Public operator/contact: Ali Gohar, cngohar@gmail.com. On 2026-10-24 the owner clarified that Morphi is a general-audience puzzle site with no child-focused content, design, or marketing; children being able to visit as guests was not an intention to target them. Child accounts remain deferred; no separate kids site is planned. The owner approved the general-audience wording and then authorized finishing local privacy readiness and preparing a guest-only publication artifact (2026-10-24). The public candidate has no internal draft notes; retention inventory, a monitored contact/request procedure, and tested local admin maintenance/privacy deletion are implemented. Public account eligibility, production operator/maintenance/audit rules, production resource evidence, deployment authorization, and Google setup/submission remain separate gates. Local functional Step 6 acceptance is separately recorded in the owner review. See `docs/privacy/PRIVACY_REVIEW.md` and `docs/privacy/PUBLIC_PRIVACY_RELEASE.md`. No age/consent flow, CMS, or web admin implementation is authorized by this task. The owner subsequently authorized publication and then explicitly requested the live Cloudflare Web Analytics disclosure update/recheck. Current public version is `b50a7a18-2e85-4406-bd40-77f27c4b3da3`; Cloudflare’s automatic analytics beacon is intentional and absent from build assets by design. Domain ownership is owner-confirmed complete; Google project setup/submission remains owner-run. These scoped deployments do not authorize future deployments or the account backend.

Owner-authorized maintenance (2026-10-23): review and improve engineering reliability in the existing two-game build while player surveys continue. This does not advance the product step. Cloudflare agent setup is project-local and OAuth-authenticated; see `docs/operations/CLOUDFLARE_AGENT_SETUP.md` for installation, requested read-only scopes, and tool activation status.

## Owner-authorized v1 follow-up — 2026-10-24

The owner supplied the consolidated v2 checklist and authorized local v1 coding.
`docs/planning/V1_RELEASE_CHECKLIST.md` now records the active handoff and explicit owner
updates, superseding the earlier v1 planning-only/admin prohibition for this
scope. The owner approved dashboard plus anonymous gameplay events, Terms
preparation, and curated themes for v1. Proposed 18+ account wording is approved
for the demo only; public eligibility/jurisdictions remain a release gate.
The owner requested an interactive visual demo instead of wireframes; review
`static/demo/v1.html` before integrating new screens. Preserve the earlier
functional acceptance and public deployment evidence. No production resource,
secret, DNS, Google change or deployment is authorized by this local work.

## Owner-authorized actual v1 integration — 2026-10-25

The owner accepted the preview and authorized actual local app integration.
This supersedes earlier demo-only restrictions. Include the approved screens,
per-puzzle anime.js entrances (Memory 3/4/5 s by pair count, then a full 3 s
preview and hide before input/timing), original offline-generated ElevenLabs
sounds, and comparison against the accepted demo. Future profile XP/achievement
fixtures are excluded from v1. The owner also requested backdrop dismissal for
all popups; app and demo now share its gesture handling. No production resource,
secret installation, DNS/Google change or deployment is authorized. Local
operator enrollment remains an explicit OS/TOTP owner command.

## Owner-authorized v1.1 handoff — 2026-10-26

The owner supplied `docs/morphi-v1.1-handoff-2026-10-26/CODEX-BRIEF.md`
and authorized starting local v1.1 implementation. Its numbered order controls:
procedural themes, UI/UX with The Card, Connect, scoring configuration, then
public-door withdrawal and explainers. The adjacent `morphi-v1.1-scope.md`
defines the scope; the brief supersedes its suggested ordering. Curated-only,
two-game-only, and public-door restrictions from v1 are superseded for this
local work. Theme contact-sheet and visual acceptance remain owner gates.
Share links and `/admin/games/<name>` remain excluded. No deployment,
production provisioning, secrets, DNS or Google changes are authorized.
See `docs/work/V1.1_WORK.md` for the current slice and pending work.
During the slice the owner supplied the 1920×923 small-board screenshot,
requested the already-planned viewport-sizing fix and directed continuation.
That bounded Work 2 shell/sizing follow-up is included while theme/Card/overall
visual acceptance remains pending; no acceptance or deployment is inferred.
On 2026-10-27 the owner approved the theme contact sheet, closing that
palette/style taste gate. Work 2 UI/UX with The Card is next; Memory/Block Card
proofs, phone played-stack placement and overall visual acceptance remain open.
The owner then authorized starting Work 2 and added preparation during animation
with loading/failure fallbacks as an explicit edge case. Prepare solo candidates
without consuming selector draws or reserving ranked sessions; preserve the
finished result and pending family on failure. See `docs/EDGE_CASES.md`.
During Card review the owner reported a duplicate-board pop and requested the
demo update. The Card must be one continuous frame that opens into the board;
retain each game's own entrance afterwards. Memory keeps its random-position
deal, full three-second preview and hide before input/timing. After fold-away,
show the central result with score, Your high score, statistics and Next while
the played stack stays visible. These demo corrections do not accept the design
or authorize deployment.
Owner review update (2026-10-28): every new Card, including after Next, enters
from a fresh random viewport position/rotation. Only the large earned-score
number scrambles for 500 ms; headings, labels, high score, statistics and Next
text stay static. Retain the accepted result exit.
Owner clarification (2026-10-28): randomness applies only to entry direction;
the Card settles at the centre before unfolding. Finish folds into the played
stack, never toward the random entry origin. Desktop backdrop objects scatter
in two dimensions across the exposed background space, without lined-up
columns or evenly spaced rows.
Later result review: the owner accepted Next and requested a result entrance.
Fade/rise the panel once over 420 ms after fold-away, with the existing 500 ms
scramble on the large score only. Keep label/high-score/stat contents static.
The accepted 350 ms exit starts from the current visual frame on early Next;
reduced motion settles immediately.

## Owner-authorized Card integration — 2026-10-28

The owner approved the animations and explicitly authorized integration into
the actual local app. This closes the demo-animation gate and supersedes the
earlier proof-only restriction for this flow. Integrate the persistent Card,
per-game entrances/Memory preview, session stack, real result entrance/score
scramble and accepted exit. Preserve authoritative replay, durable completion,
selector semantics and preparation failures. The app's account/save controls
remain real. No deployment or next product phase is inferred. Real-app device
review and the remaining Work 2 visual pass stay separate.

## Owner-directed Connect review — 2026-10-29

The owner closed the Card UI/UX progression gate and directed local Work 3
Connect. Generate a distinct game-related sound for each Connect action using
ElevenLabs offline. The owner reported off-centre symbols and the board showing
before its entrance. Most importantly, the owner clarified that connecting
every pair finishes Connect even when cells remain empty; full-grid coverage
is an optional score bonus. This supersedes the earlier fill-to-win wording in
the handoff's Connect brief. Local visual/device acceptance remains open, and
no deployment or Work 4 is authorized by this review.

## Owner acceptance of Connect — 2026-10-29

The owner reviewed Connect locally on their own PC and explicitly accepted it.
Work 3 is closed. This records a local PC acceptance, not a phone review or a
public deployment. The next item in the numbered v1.1 handoff is Work 4:
operator per-game scoring configuration in the existing admin panel. The owner
asked to be told that next step; implementation and deployment are not implied
by this acceptance.

## Owner acceptance of Work 4 scoring — 2026-10-30

The owner reviewed the per-game scoring section locally, confirmed it worked,
and directed closeout after the scoring editor styling was corrected. Work 4
is accepted on the local PC. The final `bun run verify` passed all stages,
including 156/156 browser checks. This does not record public-test acceptance
or authorize deployment. Work 5 was the next handoff item at that time; see
the later Work 5 authorization below.

## Owner-authorized Work 5 local implementation — 2026-10-31

The owner authorized starting Work 5 locally. The selector-only route policy,
static explainer pages, sitemap/robots updates and guest artifact changes are
implemented. Full local verification passed, including 166/166 browser checks;
the guest artifact was prepared and checked without `--live`. No deployment or
production change is authorized. Owner visual acceptance was pending at this
point and is recorded in the later acceptance entry below. See `docs/work/V1.1_WORK.md` and the latest entry in
`docs/PHASE_REPORTS.md`.

## Owner acceptance of Work 5 — 2026-10-31

The owner reviewed and accepted Work 5 locally. This closes only the family-door
withdrawal and static explainer work; it is not physical-device acceptance or
deployment approval. At that point the separate Work 2 integrated visual/device
review was still open; see the later acceptance below. See `docs/work/V1.1_WORK.md`.

## Owner acceptance of Work 2 visual/device review — 2026-10-31

The owner confirmed the overall integrated v1.1 visual/device review is complete
and accepted locally, including Home/profile polish, Card and played-stack
placement, and the phone-landscape title layout. Specific device/browser models
were not supplied. No deployment is authorized. Global-release planning,
including an admin-panel proposal, is the next phase; production provisioning
and deployment remain separate approvals. The theme-freshness simulation stays
a best-effort diagnostic; no numeric target was supplied.

## Rules

1. **One phase at a time.** Stop when the acceptance criteria are met, write the report (format below), and wait for the owner.
2. **No scope additions.** Non-goals (section 3) and the parked list (end of section 7) are off limits. Ask first. Do not act on `docs/planning/IDEAS.md` or `docs/planning/LAUNCH_CHECKLIST.md` unless the owner promotes an item into the plan.
3. **Smallest implementation that meets the acceptance criteria.** No speculative abstractions or extra config systems.
4. **Locked decisions stay locked** (section 2 and `docs/DECISIONS.md`). Do not swap them without asking.
5. **Check current docs before using any API** (Cloudflare, adapter-cloudflare, TypeScript 6.x as the canonical compiler, pinned explicitly as `typescript@~6.0.3` because npm's default tag is now TypeScript 7 (TypeScript 7 only side by side, after the Phase 0 compatibility test), Better Auth, Rapier, NOWPayments, GA4). Record pinned versions and non-obvious choices in `docs/DECISIONS.md`.
6. **Engine rules.** `packages/engine` is TypeScript, deterministic, and headless, split into `core` (integer-only, banned-math lint) and `theme` (fixed-point or float color math allowed, never `Date.now` or `Math.random`): SplitMix64 seeded RNG, integer-only logic, no `Math.random`, `Date.now`, or approximated Math functions (sin, cos, tan, exp, log, pow, sqrt) in engine core code (a lint rule enforces this), no unordered-map iteration in output, canonical serialized output, 64-bit seeds as decimal strings. Every puzzle needs the tests in the plan plus known test vectors, run in Node, Bun, Chromium, Firefox, WebKit, and the Worker. The vectors are the spec for any later Rust/WASM port.
7. **Never trust the client.** The server replays moves and computes scores. The client never submits a score or picks a ranked seed.
8. **Themes are cosmetic only** and never affect solvability, difficulty, validation, or score. Puzzle palettes come from curated recipes (data), verified by `scripts/check-palettes` with a safety margin. Never raw random colors, never gradients, never rely on color alone.
   **Variant identity (owner, 2026-11-06):** applies to every current/future update and puzzle family. A new variant must make a meaningful gameplay rule or rule-setting change: for example matching requirements, legal moves, information available to the player, movement after a miss, time/move limits or win conditions. Colors, palettes, symbol artwork, themes, animation, purely visual layouts and different seeds/deals do not create variants. A layout or board-size change qualifies only when it changes gameplay rules or rule settings. Every proposed variant's matrix/brief must name its baseline and concrete rule difference; do not assign separate variant identities or inflate counts for the same gameplay rules with different cosmetics or seeds. This standing definition does not authorize retroactive removal, renaming or replay changes to accepted variants.
9. **UI:** mobile first, light first, full-screen and minimal. Colors only from the tokens in section 11.1a. Follow the anti-slop checklist in section 11.1 (flat fills, no gradients, no glows, no shadows or bevels on game objects, no emoji icons), typography in section 11.8, and motion in section 11.9 (anime.js is approved for sequencing, only through the `motion` wrapper; animation never drives game logic). All user-facing text goes through the message catalog (section 11.7), with no text inside SVG. Wireframes in all three sizes (phone portrait 390x844, phone landscape 844x390, desktop 1280x800) are approved before the first screen set and each new puzzle's screen are built. Chrome controls (menu, sound, fullscreen) anchor to the viewport corners and never sit inside the puzzle container. Layout comes from viewport and container size (layout profiles, container queries), never from user-agent sniffing, and boards use the space on large screens (section 11.1).
10. **Puzzle types are packages** with a manifest and the Stage and layout contract (section 11.11). Recipes, styles, and difficulty bands are data, not hard-coded lists.
11. **Failure behavior is part of every feature** (section 11.4): never a white screen, never a lost result, always a logged event.
12. **Prototypes are reference only** (section 11.5). Do not copy a prototype's stack, architecture, or game logic. Re-implement behind the engine contract with tests.
13. **Analytics** follow section 11.6: anonymous, coarse (ids, enums, buckets), no personal data, no raw seeds to GA4, consent and opt-out respected.
14. **Security and admin** follow sections 9.1 and 11.10: validate all input, server-side permission checks per action (the RBAC matrix), an audit record for every admin action, two-factor and re-authentication for sensitive permissions, impersonation disabled, no admin UI beyond the current stage.
15. **Search narrowly** to save tokens (section 12.1): read `docs/CODEMAP.md` first, search specific package paths, skip lockfiles and generated output, and update the CODEMAP at the end of each phase. Do not build or install a code-graph tool unless asked.
16. **Local-first until the owner says otherwise.** Do not create accounts or remote repositories, publish code, or deploy (a local git repository is fine), and do not deploy even a temporary preview before Phase 2. Use `wrangler dev` and local previews, and test phones over the local network (section 12.2). If a step seems to need an account or a deployment, stop and ask.
17. **Performance and edge cases:** follow the loading and generation rules in section 12.3 (idle preloading, Web Worker generation, Instant Next) and the resume rules in section 11.13. When building a feature, check `docs/EDGE_CASES.md` for its category and add the tests. Never rely on `unload` or `beforeunload` to save state.
18. **The plan states requirements, not code.** Phase 0 writes `docs/CONTRACT.md` (types, serialization, hash, RNG, `engine_version`), and the owner approves it. Types, schemas, SQL, and config live in code, and a stale hint in the plan is fixed, not obeyed over the code.
19. **Guard handlers.** `<svelte:boundary>` does not catch errors in event handlers, timers, or async and Worker callbacks, so wrap those and route errors to the failed state (section 11.4).
20. **Rotation and shapes:** Next comes from the puzzle selector (section 11.14), never "the same puzzle type again" unless the player chose Stay. The selector takes an injected RNG and draws seeds with `crypto.getRandomValues`. Container shapes, proportions, gaps, and topology vary as cosmetic theme axes (section 11.2) and never change difficulty.
    **Puzzle backdrops (owner, 2026-10-27):** every in-play page uses only objects belonging to its current puzzle: Block → block pieces; Memory → cards; future games must declare their own allowed objects in their design brief. Never mix another game's objects or generic decoration into a puzzle backdrop. Randomize positions/rotations from cosmetic seeded RNG; use 20% opacity and exclude header/bottom bands. Owner update (2026-10-28): hide these objects on compact/mobile layouts (portrait and landscape); wider layouts show a seeded random 1–5 objects on each side only. Preserve the approved background blend. Mixed-game decoration is allowed on Home only. Every new puzzle needs family-isolation and visible-backdrop checks; see `docs/puzzles/_TEMPLATE.md`.
21. **Boundaries:** the engine never imports puzzles, a puzzle never imports another puzzle, and the app reaches puzzles through the generated registry (lint and CI enforce it). Each puzzle has its own `engine_version`, tests, and README (sections 5 and 11.11).
22. **Puzzles are games:** before building a puzzle, get its design brief (`docs/puzzles/<id>.md`, section 11.16) approved. Use the page templates and stage modes (section 11.16), and keep per-puzzle style as data (a style profile in the manifest), with colors always from recipes and the checks.
23. **If reality conflicts with the plan** (a doc changed, something is impossible, an assumption was wrong), stop and report it. Do not improvise a workaround that changes the design.

## Commands

Fill these in during Phase 0 as the repo takes shape.

- Install: `bun install`
- Dev (Vite): `bun run dev --host 0.0.0.0`
- Verify: `bun run verify` runs format/lint, zero-warning type-check, import-boundary self-checks, units, D1/auth integration, six-runtime vectors, isolated built-Worker smoke/build, and browser account/recovery/layout checks.
- Type-check: `bun run check` (0 errors and 0 warnings required).
- Test vectors (Node, Bun, Playwright browsers): `bun run test:vectors` checks known vectors in Node, Bun, Chromium, Firefox, WebKit, and local workerd.
- Local Cloudflare preview: `bun run preview:worker` (`wrangler dev` against the built Worker).
- Guest/privacy deploy: `bunx wrangler deploy --config wrangler.public-privacy.jsonc` only with explicit approval for that deployment. The normal `bun run deploy` currently uses the local-account configuration and must not be used for the guest/policy release. This owner-authorized guest publication is the recorded local-first exception; future deployments still require approval.

## Cloudflare deployment

- Target: Worker `morphi-one`. The published guest/privacy release is assets-only via `wrangler.public-privacy.jsonc`; `wrangler.jsonc` remains the local Step 6 account build using `@sveltejs/adapter-cloudflare`. Do not deploy its local D1/auth settings as a guest update. Owner-authorized private source repository: `https://github.com/cngohar/morphi.one1`. No CI deploy; pushing source does not authorize a deployment.
- Current public guest/privacy URLs: `https://morphi.one` (custom domain) and `https://morphi-one.electrasincng.workers.dev` (latest owner-approved disclosure deployment 2026-10-24; version `b50a7a18-2e85-4406-bd40-77f27c4b3da3`). `www` and HTTP redirect to `https://morphi.one`.
- Ask the owner before every deploy. Never deploy from a hook, schedule, or automatic trigger.
- `workers.dev` and a custom domain serve the same Worker; `workers.dev` is not a separate staging environment.
- `morphi.one` is on Cloudflare nameservers and attached to the Worker. Do not move the zone or add/remove DNS records without owner approval. The custom domain is attached in the Cloudflare dashboard; `wrangler.jsonc` does not declare a route.
- Do not put secrets in `wrangler.jsonc` or commit `.env`/`.dev.vars` files. Use Worker secrets when a backend feature needs them.

## Git and secrets

- Small, focused commits with clear messages. No force pushes.
- Never commit secrets (API keys, `.dev.vars`, webhook secrets). Keep them in ignored files or Worker secrets, and document only the variable names.

## End-of-phase report

Write a short report in `docs/PHASE_REPORTS.md`:

- **Built:** what was implemented
- **Skipped:** what was deliberately not done, and why
- **Known issues:** bugs, risks, shaky assumptions
- **Decisions:** choices made and versions pinned (also in `docs/DECISIONS.md`)
- **Questions for the owner:** anything needed before the next phase
- **Evidence table:** every acceptance item with its evidence type, where the evidence lives, and its result (pass, fail, or waived with the owner's recorded exception)
- **Measurements:** for each performance target, the device class, network profile, cold or preloaded load, number of runs, median and p95, and whether it is a gate or a goal (section 13.1)
- **Waivers:** each waived acceptance item, the owner's recorded exception, and the risk
- **Owner responsibilities:** what only the owner can do next (accounts, credentials, devices, testers, acceptance)
- **CODEMAP:** confirm `docs/CODEMAP.md` is updated
