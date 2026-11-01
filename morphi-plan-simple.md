# Morphi: Simple Plan

## Owner-authorized v1.1 — 2026-10-26

The owner authorized the local [v1.1 brief](docs/morphi-v1.1-handoff-2026-10-26/CODEX-BRIEF.md)
and its adjacent scope. Work order: procedural themes → UI/UX and The Card →
Connect → operator scoring configuration → public-door withdrawal/explainers.
This supersedes the v1 curated-only theme, two-game and door decisions within
that scope. Stop for the required theme taste/visual review; do not infer
deployment or production-operation approval. Share links and admin game-test
routes remain excluded. Status and evidence: [V1.1_WORK.md](docs/V1.1_WORK.md).

During this slice the owner supplied the 1920×923 small-board screenshot and
explicitly requested the planned viewport-sizing fix, then directed continuation.
That bounded Work 2 shell/sizing follow-up is included while theme/Card/overall
visual acceptance remains open; it is not a deployment or acceptance decision.

On 2026-10-27 the owner approved the theme contact sheet and authorized starting
Work 2. Puzzle backdrops must contain only current-puzzle objects, including
future games; mixed-game decoration is Home-only. Prepare the next solo puzzle
while the current entrance plays, with bounded loading/failure/navigation
fallbacks and no speculative ranked reservation. The Card's Memory/Block proofs
and phone played-stack placement remain the next visual review gate.
Owner update (2026-10-28): hide puzzle backdrop objects on compact/mobile
layouts; wider layouts get a seeded random 1–5 own objects per side, keeping
the approved blend. New Cards enter from fresh random positions, including
on Next, settle at the centre and unfold there; finishing folds into the played
stack. Backdrop positions scatter across both dimensions of exposed space,
without fixed columns/rows. Only the large result score scrambles; other result
text stays static.

Owner update (2026-10-28): animations are approved and actual local Card
integration is authorized. Preserve real game entrances, authoritative timing,
account/save behavior and failure recovery. The animation-demo gate is closed;
the rest of Work 2 and real-app device review remain separate.

Owner update (2026-10-29): the Card UI/UX progression gate is closed and local
Connect Work 3 is authorized. Generate its own game-related action sounds with
ElevenLabs. The owner corrected Connect's objective: all pairs connected ends
the round; full-grid coverage is an optional score bonus. This supersedes the
handoff brief's fill-to-win wording. Fix the reported symbol centring and
pre-entrance board visibility. Connect real-device visual/audio review remains
open; no Work 4 or deployment is inferred.

Owner update (2026-10-29): the owner reviewed Connect locally on their own PC
and accepted Work 3. No phone or public-release acceptance is recorded. The
next numbered item is Work 4, operator per-game scoring configuration; this
acceptance does not start Work 4 or authorize deployment.

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

This is the short plan. It replaces the long plan for day-to-day work. The long plan (`docs/PLAN.md`) stays as reference. If a step below needs something from it, pull only that part in.

Current status (2026-10-24): Step 4 accepted; Step 5 accepted by the owner based on the public-test result (45+ players, over 60% positive feedback). The owner accepts proceeding without the missing replay counts and predetermined threshold; the measured replay-rate criterion is waived, not recorded as a pass. Step 6 implementation is authorized: Google sign-in and all five account-screen designs are approved. The owner subsequently confirmed local Google OAuth works and authorized completing Step 6 locally, including the small per-puzzle structural cleanup. Local progress/ranked/leaderboard implementation and verification are tracked in `docs/STEP6_WORK.md`. The owner completed the PC/mobile functional review and explicitly accepted the local Step 6 build on 2026-10-24 (`docs/STEP6_REVIEW.md`); production resource/operating evidence remains open. Global-release planning, including an admin panel proposal, follows local acceptance. See `docs/STEP6.md`. Acceptance and feedback are recorded in `docs/PHASE_REPORTS.md`.

## Owner-authorized local privacy preparation (2026-10-23)

The owner requested a privacy page before public Google OAuth verification and the later v1 launch. Implement the page locally using the long plan's content-page template; admin editing of privacy/terms/other static pages remains the later Stage 5 content-management scope. Operator/contact: Ali Gohar, cngohar@gmail.com. On 2026-10-24 the owner clarified a general-audience puzzle site, with no child-focused content, design, or marketing and no separate kids site planned. This supersedes the earlier audience-includes-under-13s interpretation. Child accounts remain deferred. The owner approved the wording and authorized finishing practical readiness on 2026-10-24. Retention inventory, the owner-monitored contact/request procedure, and protected local cleanup/privacy deletion are prepared; the public copy has no internal draft notes. A separate assets-only guest publication candidate is prepared for review and deployment authorization. Public account eligibility and production operator/retention operations remain v1 gates. See `docs/PRIVACY_REVIEW.md`. Privacy preparation did not itself close Step 6 acceptance; the subsequent owner-completed review records local functional acceptance separately. Neither authorizes public provisioning, publication, or deployment.

## Owner-authorized publication follow-up (2026-10-24)

The owner explicitly approved publishing the prepared guest homepage/privacy update and confirms Search Console/domain ownership is already verified. Initial public version was `44a5846f-95d6-43d5-b61e-c7f478b6e857`; the subsequently owner-requested analytics disclosure is published as `b50a7a18-2e85-4406-bd40-77f27c4b3da3` with all seven live verification groups passing. Live checks found Cloudflare’s automatic Web Analytics injection; the owner explicitly chose to keep it and requested the privacy disclosure update, intentional-beacon release note and live recheck. The beacon is absent from build assets by design, and this does not authorize GA4 or a new analytics pipeline. Current deployment versions/evidence are in `docs/PHASE_REPORTS.md`; Google project setup/submission stays owner-controlled. Account/global-release operations and admin-panel planning remain separate.

## Owner-requested v1 release planning (2026-10-24)

The owner requested the v1 plan after local Step 6 acceptance and guest/privacy publication. [docs/V1_RELEASE_PLAN.md](docs/V1_RELEASE_PLAN.md) proposes the production account rollout, operating/resource checks, a small Stage 1 admin panel and an optional repository-managed terms page. This simple plan remains authoritative; the proposal does not promote the parked features into implementation. The owner reports production Google setup complete and supplied a private credential-file location; credential validation, actual branding/audience state and live OAuth behavior are not verified by the planning task. No credential is installed and no backend is deployed. Next is agreement on the release contract/local preparation; admin/terms implementation, provisioning and every deployment still require their applicable approval.

## Owner-authorized v1 implementation and visual review (2026-10-24)

The owner supplied the consolidated v2 checklist and authorized starting local
v1 implementation. [docs/V1_RELEASE_CHECKLIST.md](docs/V1_RELEASE_CHECKLIST.md)
records the active handoff and subsequent decisions; the old v1 proposal is
historical. Stage 1 admin, SEO search-entry pages and removal of Block-first
are promoted into v1. Dashboard plus anonymous gameplay events, Terms
preparation, and deferring procedural themes are approved. Proposed 18+
account wording is approved for the demo only; account launch jurisdictions
remain a specific legal-review question owned by Ali Gohar. The owner requested
an interactive demo instead of wireframes; layouts/content await review before
screen integration. No production provisioning or future deployment is approved.

## Oct 25 design-package demo update

The owner accepted the [design package](docs/morphi-design-package-2026-10-25/morphi-design-handoff-2026-10-25.md)
and authorized applying it to the v1 demo only, then running verification and
stopping for visual review. It supersedes earlier design choices (including
door navigation/dimmed columns); the v2 rollout/release gates remain in force.
The owner subsequently accepted this demo and authorized actual local
integration (Oct 25). Deployment, production XP/achievements and a final D5
eligibility/jurisdiction decision remain outside that authorization. See `docs/DECISIONS.md`.

## The goal

Make one small puzzle game that people enjoy on a phone. Then decide what comes next based on whether they enjoy it.

The site has one Play button. Each press gives a new puzzle made from a random seed, so repeat plays feel different.

## Order of work

Game first. Architecture second. Accounts and payments last.

Only do the step you are on. Check it before moving on.

## Step 1: Memory

Build a complete, playable Memory game (about 1 to 2 weeks).

- A grid of face-down cards. Tap one to flip it, tap a second to try a match.
- Matches stay face up. Mismatches flip back after about 0.6 seconds.
- Clear all pairs to win.
- Round size changes with each Play: 6, 8, or 10 pairs. Bigger rounds are harder.
- Score starts at 1,000 per pair, minus 150 per mismatch and minus 5 per second. Never below zero. These are starting values to tune by playtest.
- Three sounds (flip, match, mismatch) and one win moment: a short burst of shapes, under one second.
- Three screens only: Home (title and Play), Game (grid, score, timer), and Result (score, best score, one big Next puzzle button).
- Runs in a phone browser in portrait and in a desktop browser. Local only. Best score is saved in the browser.

Done when you can play 20 rounds on a phone without a bug, and the win moment makes you want the next one.

## Step 2: Playtest

Give the phone build to five people who have not seen it. Say only "tap Play." Watch them and take notes. Ask three things afterwards:

1. Did you finish a round?
2. Did you press Next?
3. Would you play again tomorrow?

If most of them press Next, go to Step 3. If they quit early or ask what to do, fix the feel first: faster feedback, clearer flips, a stronger win moment. Do not add features. Test again with five new people.

## Step 3: Block puzzle

Build the second game (about 1 to 2 weeks). Place pieces on a grid. Clear full lines to score. The run ends when no piece in the tray fits. It uses the same Home, Game, and Result screens and the same feedback style as Memory.

Playtest it with five new people, the same way as Step 2. Keep the game more people replay as the main game. The other one stays in the code but is not in the menu for now.

## Step 4: Make the winner feel like a game (about 2 to 4 weeks)

- Three or four fixed color themes. The seed picks one. No randomly generated colors yet.
- Every tap answers within 100 ms: a flip, a pop, a shake, or a sound.
- One signature moment that people remember, such as a reveal, a combo, or a line clear. Pick one and make it great.
- Game words in the small HUD: round number, streak, best.
- A one-line hint on the first round only, then never again.
- Owner addition (2026-10-20): Play and Next rotate the games. Block comes first, then Memory, then Block, and the same game never comes twice in a row.
- Owner addition (2026-10-20): Memory gets the same four themes. The seed picks one and changes the backdrop, cards, and symbols. The simple plan did not include Memory theme randomization, but the long plan does, and the owner wants both games complete before public testing.

## Step 5: Public test (about 1 week)

- Deploy the static build to any static host. The Cloudflare setup in the long plan works, but it is not needed yet.
- Page title, one-sentence description, and one `<h1>` on Home.
- Analytics only if it is simple to set up. Two events: round started and Next pressed. No personal data.
- Share the link with about 50 people.

Done when a clear share of the people who started a round also started a second one. Decide what "clear" means before you look at the numbers.

## Step 6: Accounts and leaderboards (only if Step 5 works)

Only now: sign-in, progress across devices, and a leaderboard. Scores must be checked on the server, because local scores can be edited. The anti-cheat section of the long plan starts to matter here, and not before.

The owner accepted Step 5 on 2026-10-23. The proposed Step 6 sequence and decisions needed before implementation are in `docs/STEP6.md`; the full platform phase is not added wholesale to this step.

## Look and feel

- Flat shapes, big type, and bright colors on a light background. No gradients, no glow, no drop shadows on game pieces.
- Minimal means few things on screen, not empty. The board is the art.
- Feel comes from motion and sound. Keep motion short (under 300 ms) and respect the reduced-motion setting. Owner override (2026-10-20): the block-placement line clear may run 1500 ms.
- Menus stay small and out of the way. The first screen is a title and one Play button.
- Use the light palette from section 11.1a of the long plan so text stays readable. Do not invent new colors.
- Icons are simple inline shapes. No emoji.

## Rules for whoever builds it

1. Work on one step at a time.
2. If a task is not in this file, ask first.
3. Keep the game rules separate from drawing, so the rules can be tested without a browser.
4. Each round is made from a seed number, so any round can be recreated.
5. Keep all visible text in one place, so translations are easy to add later.
6. Test on a real phone at every step.

## Stack

SvelteKit with Svelte 5 and TypeScript, as already chosen. Skip the multi-browser test setup, the CI pipeline, and the Cloudflare Worker setup until Step 5.

## Parked

Not for now. Each of these is designed in the long plan and stays there until players ask for it.

- Multiplayer
- Payments and subscriptions
- Admin panel
- Physics puzzles
- Translations and right-to-left layout
- Dark theme
- Achievements, levels, and XP
- Daily challenge and share links
- Server-side scoring and anti-cheat (until leaderboards exist)
- Durable Objects, D1 sharding, seed banks, analytics pipeline, and audit logs
- Puzzle types beyond the first two
