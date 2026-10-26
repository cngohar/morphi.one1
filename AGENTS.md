## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest

---

# AGENTS.md (Morphi)

Instructions for coding agents (Codex, OpenCode, Claude Code, etc.) working in this repo.

## Source of truth

`morphi-plan-simple.md` is the active day-to-day plan: games first, architecture second. The owner reaffirmed this on 2026-10-23. `docs/PLAN.md` is reference only; pull in relevant sections when the simple plan calls for them. The simple plan and explicit owner instructions take precedence over the full-plan phase requirements below; do not introduce the full platform architecture as a prerequisite to game work. `docs/DECISIONS.md` lists decisions already made. Use `docs/CODEMAP.md` to find code before running broad searches. Report unresolved conflicts to the owner.

## Current phase

**Simple plan: Step 6 accepted locally; active v1 integration review.** Step 5 was accepted by owner judgment on 2026-10-23, with the measured replay-rate criterion waived. The owner selected Google-only sign-in with guest play retained, then approved all five account/demo screens and the proposed Step 6 scope and authorized implementation. The first slice implements local D1, Better Auth sessions, public names, sign-out, and deletion. The owner subsequently authorized completing Step 6 locally and the small per-puzzle structural cleanup. Local saved history, ranked replay, leaderboards, and moderation controls are implemented; do not claim Step 6 accepted before its release checks and owner real-device review pass. The owner confirms local Google OAuth works. On 2026-10-24 the owner completed `docs/STEP6_REVIEW.md`, reported all functional checks working on PC/mobile, and explicitly accepted the local functional build. This supersedes pending owner-review notes; specific device/browser models were not supplied. Production resource measurements/operations remain unresolved, with no waiver or deployment/global-launch approval inferred. See `docs/STEP6_WORK.md` and the newest phase report for current evidence. Owner setup and Testing/branding guidance are documented in `docs/GOOGLE_AUTH_SETUP.md`. No additional games or full admin web panel implementation are authorized. After local Step 6 review, the owner wants global-release planning including an admin panel proposal; do not bring that implementation into this local task. Production provisioning and deployment still need their applicable explicit authorization. See `docs/STEP6.md` and `docs/PHASE_REPORTS.md`.

Owner-authorized local privacy preparation (2026-10-23): build `/privacy` for review before public Google verification and the later v1 launch, with future static-page admin editing scoped separately. Public operator/contact: Ali Gohar, cngohar@gmail.com. On 2026-10-24 the owner clarified that Morphi is a general-audience puzzle site with no child-focused content, design, or marketing; children being able to visit as guests was not an intention to target them. Child accounts remain deferred; no separate kids site is planned. The owner approved the general-audience wording and then authorized finishing local privacy readiness and preparing a guest-only publication artifact (2026-10-24). The public candidate has no internal draft notes; retention inventory, a monitored contact/request procedure, and tested local admin maintenance/privacy deletion are implemented. Public account eligibility, production operator/maintenance/audit rules, production resource evidence, deployment authorization, and Google setup/submission remain separate gates. Local functional Step 6 acceptance is separately recorded in the owner review. See `docs/PRIVACY_REVIEW.md` and `docs/PUBLIC_PRIVACY_RELEASE.md`. No age/consent flow, CMS, or web admin implementation is authorized by this task. The owner subsequently authorized publication and then explicitly requested the live Cloudflare Web Analytics disclosure update/recheck. Current public version is `b50a7a18-2e85-4406-bd40-77f27c4b3da3`; Cloudflare’s automatic analytics beacon is intentional and absent from build assets by design. Domain ownership is owner-confirmed complete; Google project setup/submission remains owner-run. These scoped deployments do not authorize future deployments or the account backend.

Owner-authorized maintenance (2026-10-23): review and improve engineering reliability in the existing two-game build while player surveys continue. This does not advance the product step. Cloudflare agent setup is project-local and OAuth-authenticated; see `docs/CLOUDFLARE_AGENT_SETUP.md` for installation, requested read-only scopes, and tool activation status.

## Owner-authorized v1 follow-up — 2026-10-24

The owner supplied the consolidated v2 checklist and authorized local v1 coding.
`docs/V1_RELEASE_CHECKLIST.md` now records the active handoff and explicit owner
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

## Rules

1. **One phase at a time.** Stop when the acceptance criteria are met, write the report (format below), and wait for the owner.
2. **No scope additions.** Non-goals (section 3) and the parked list (end of section 7) are off limits. Ask first. Do not act on `docs/IDEAS.md` or `docs/LAUNCH_CHECKLIST.md` unless the owner promotes an item into the plan.
3. **Smallest implementation that meets the acceptance criteria.** No speculative abstractions or extra config systems.
4. **Locked decisions stay locked** (section 2 and `docs/DECISIONS.md`). Do not swap them without asking.
5. **Check current docs before using any API** (Cloudflare, adapter-cloudflare, TypeScript 6.x as the canonical compiler, pinned explicitly as `typescript@~6.0.3` because npm's default tag is now TypeScript 7 (TypeScript 7 only side by side, after the Phase 0 compatibility test), Better Auth, Rapier, NOWPayments, GA4). Record pinned versions and non-obvious choices in `docs/DECISIONS.md`.
6. **Engine rules.** `packages/engine` is TypeScript, deterministic, and headless, split into `core` (integer-only, banned-math lint) and `theme` (fixed-point or float color math allowed, never `Date.now` or `Math.random`): SplitMix64 seeded RNG, integer-only logic, no `Math.random`, `Date.now`, or approximated Math functions (sin, cos, tan, exp, log, pow, sqrt) in engine core code (a lint rule enforces this), no unordered-map iteration in output, canonical serialized output, 64-bit seeds as decimal strings. Every puzzle needs the tests in the plan plus known test vectors, run in Node, Bun, Chromium, Firefox, WebKit, and the Worker. The vectors are the spec for any later Rust/WASM port.
7. **Never trust the client.** The server replays moves and computes scores. The client never submits a score or picks a ranked seed.
8. **Themes are cosmetic only** and never affect solvability, difficulty, validation, or score. Puzzle palettes come from curated recipes (data), verified by `scripts/check-palettes` with a safety margin. Never raw random colors, never gradients, never rely on color alone.
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
