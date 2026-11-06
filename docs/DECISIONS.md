# DECISIONS.md

## 2026-11-05 — v1.3.3 Member Support local acceptance

- The owner confirmed they already reviewed and accepted Member Support. This supersedes earlier pending-review notes. Remaining improvements are deferred to later stages; details and scope were not supplied.
- Full `bun run verify` remains deferred, not passed or waived. No device/browser details or new automated evidence were supplied. This acceptance does not start the next feature or authorize deployment.

## 2026-11-05 — v1.3.3 Member Support authorization

- Explicit owner decision during handoff: leave full `bun run verify` for later stages and record that decision. The active run was stopped during global ESLint after Prettier passed. Full verification and unrun stages remain deferred, not passed or waived. Targeted support checks remain current evidence. Do not resume or expand verification until the later owner-directed stage.

- API behavior checked against the official [D1 batch reference](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch): sequential statements in `batch` commit as one transaction or roll back together. Reuse existing prepare/bind/batch with a conditional receipt claim and nonce-gated writes/audits. Limiter events belong to the submitting account and do not cascade from tickets, so deleting a ticket owner cannot reset a staff reply quota.
- Text lengths use trimmed UTF-16 code units, matching browser maxlength; NUL is rejected. Support JSON bodies are bounded to 32,768 bytes including streamed bodies. Staff JSON lives under `/admin/support/data` to retain existing operator cookie scope; staff mutations retain recent-auth requirements. Conversations paginate chronologically, twenty messages per page; only opening a member conversation marks the returned page read.

- The owner corrected Member Support from v1.3.4 to v1.3.3; the accepted local v1.3.2 build is the baseline. `docs/planning/V1.3.3_MEMBER_SUPPORT.md` controls the implementation. Earlier acceptance records and the pending v1.3.1 sound audition remain unchanged.
- All proposed defaults, limits, retention and behavior are approved: General/Normal protected fallbacks; 120-character subjects, 4,000-character messages, 60-character taxonomy names; three member creates/hour, five open tickets, ten member replies/ten minutes, thirty staff replies/minute. Limits apply only to successful writes and retries are idempotent.
- Keep conversations until account deletion; closed tickets remain readable with no reopening. Banned members retain support access, pending-deletion/deleted accounts do not. Existing gameplay checks remain unchanged. Admin/moderator ticket permissions are explicit; the existing support role receives none. Admin alone manages taxonomy.
- Plain text only, no attachments/email/assignment/notes/automatic ban reversal. Failed drafts stay in page memory. Staff audits contain no subject/message/taxonomy-name content. Local privacy candidate changes do not publish the policy. No dependency upgrade or deployment authorization.

## 2026-11-05 — v1.3.1 local Block/admin/audio handoff

- Owner-approved D1–D7 brief at base `f053fc3`: ship `block:board-10`, `block:rows-only`, `block:rush-60` plus unchanged classic; equal weights, isolated leaderboard groups, shared `brief-v1`. Keep `block-placement-1` because classic omitted-variant replay/JSON and existing vectors stay identical.
- Rush starts at the first valid client placement and counts through Help/hidden/reload. Owner approved ranked issue-to-claim time minus the fixed 3,000 ms Block entrance and issued Card allowance (new sessions: 1,200 ms), with an exact 62,000 ms ceiling. Do not add the existing one-second scoring allowance. Classic timing is unchanged; replay stays time-free and accepts legal nonempty rush prefixes. No minimum-duration rule is added. Idle before placement still counts server-side and may reject a completed client countdown; the owner accepted this limitation.
- Reuse `/admin/games?game=<family>&subview=settings`, existing permissions, audited lifecycle tables and immutable score versions. Enable/resume accepts no reason and always stores `Resumed by operator (no reason entered)` for families/variants; submitted enable reasons are ignored. Disable requires the existing validated reason and confirmation. Native dialog plus a small local Tab-edge handler contains keyboard focus.
- Registered-cohort variant sums back the overview, with imported guest completions separate. Cache only the global overview for 60 seconds in existing KV and delete on lifecycle writes; live detail/header/enforcement reads stay scoped D1. Normal miss: 7 statements, up to 10 on first family insertion; hit: 0 aggregate statements; detail: 7 + V (V=declared variant count), excluding auth/scoring/read-audit. Mapping is 19 groups/76 binds; batch before exceeding 25 groups. KV freshness is eventual, never authorization.
- Retain SDK `@elevenlabs/elevenlabs-js` 2.74.0, model `eleven_text_to_sound_v2`, format `mp3_44100_128`, prompt influence 0.75 and existing palette prefix. Offline generator stages publication and records exact source/output hashes and processing. New MP3s are mono 44.1 kHz / 64 kbps after leading-silence trim, −3 dB gain and duration padding/trimming. Existing 22 files/provenance are unchanged, including their older palette wording. No runtime ElevenLabs request or Connect cue change.
- Active paid Starter generation checked 2026-11-05; owner preflight 40 credits/second projected 68 credits. Three successful sounds cost 17 credits; a failed first local-processing attempt cost 6, total 23. That attempt published nothing; exact cause is unknown because its raw source was lost. Successful raw sources are ignored build artifacts. S5 owner audition of all three new sounds remains an unsatisfied, unwaived gate; no MP3 commit is authorized before approval.
- No dependency upgrades, routes or migrations; TypeScript stays `~6.0.3`. 39 targeted units, 7 D1 integration checks and 13 Chromium cases, twelve vectors in six runtimes, registry repeat, boundaries/build/lazy checks pass. Global lint/type checks, full verify, unrelated suites and physical devices were not run. Admin browser scoring cleanup appends audited rollback versions restoring coefficients; live ids advance while saved runs and owner rows remain untouched. No commit/push/release/deployment is inferred.

Current API references checked: [KV reads](https://developers.cloudflare.com/kv/api/read-key-value-pairs/), [writes/TTL](https://developers.cloudflare.com/kv/api/write-key-value-pairs/), [delete](https://developers.cloudflare.com/kv/api/delete-key-value-pairs/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/); ElevenLabs [billing](https://elevenlabs.io/docs/overview/administration/billing) and [paid-generation content rights](https://elevenlabs.io/docs/help-center/account/general/what-happens-to-my-content-after-my-subscription-ends). Details/evidence: `docs/work/V1.3.1_WORK.md`.

## 2026-10-29 — Connect objective correction during local review

- The owner clarified that connecting every pair is the win condition even
  when cells remain empty. The earlier full-grid requirement in the handoff
  brief and local implementation is superseded. Full-grid coverage is an
  optional 1,000-point bonus if achieved on the winning move; the time bonus
  applies to every all-pairs win. The result reports fill percentage.
- Keep `connect-1` during this unaccepted local Work 3 slice; no Connect rules
  or ranked sessions have been deployed. Server replay and client completion
  use the same corrected reducer. First-frame hiding and a 48×48 SVG viewport
  correct the reported entrance flash and off-centre symbols.
- Measure puzzle backdrop bounds when it becomes visible after the Card unfolds.
  Measuring the concealed layer against the animated narrow frame left some
  Block objects under the final board in WebKit. The existing ResizeObserver
  continues to track later size changes; no theme or puzzle version changes.

## 2026-10-28 — Connect as the third local Mix family

- The owner closed the puzzle Card UI/UX progression gate and directed Work 3.
  Connect is in the generated registry and weighted Mix selector only. There is
  no new public door, play parameter, deployment or production resource change.
  The existing Home/profile polish note is separate from this Card decision.
- Pin rules as `connect-1`: SplitMix64 chooses a 5×5/5, 6×6/6 or 7×7/8 band,
  bounded backbite preserves a full-grid witness, and pair segments have at
  least three cells. The witness is excluded from win validation. Canonical
  path-cell moves contain pair, cell, stroke and monotonic elapsed milliseconds.
  Replay rejects bad order, foreign endpoints, diagonal steps, post-win moves
  and logs above 1,000. Score uses +200 per connected pair, +1,000 complete grid,
  +10 per whole second under par, −50 for redrawing a previously connected
  pair, floored at zero. Ranked time uses server wall time minus the issued Card
  allowance and fixed 2,500 ms Connect opening, never a client score.
- Connect uses the already pinned procedural theme config
  `theme-2026-10-26-1`, generator `oklch-machado-1`, TypeScript `~6.0.3`,
  anime.js 4.5.0 through `ui/motion.ts`, and ElevenLabs SDK 2.74.0 offline.
  The installed SDK's `CreateSoundEffectRequest` type confirms
  `durationSeconds`, `promptInfluence`, `modelId` and `outputFormat`; nine
  original Connect cues were generated as static MP3s. The prompt and hash of
  each are in `static/audio/manifest.json`. Runtime never calls ElevenLabs.
- The accepted shell and Card stay shared. Connect adds its own dot-path-only
  backdrop and a 2.5-second centre ripple/paired-dot entrance; active-time
  deadlines, not Anime completion, gate input. Reduced-motion and muted play
  preserve the rules. The game offers no new public route.

## 2026-10-28 — Approved Card flow in the local app

- Owner approved the reviewed animations and authorized actual app integration.
  `RoundStage.svelte` owns one persistent frame around real puzzle views. The
  typed `cardSceneMotion` wrapper accepts app-owned elements; the reference
  adapter remains separate. No prototype puzzle logic or demo DOM is imported.
- Game views accept an entrance-ready signal. Memory starts its own 3/4/5 s
  deal only after the Card unfolds, then its full 3 s preview and hide. Block
  keeps its own entrance. Logical active-time deadlines own readiness, not
  Anime completion callbacks. Completion persistence precedes presentation.
- Stack chrome retains the latest eight cards plus a session count, clearing
  on leaving the play loop; it is not a saved-history store. Real results keep
  account links, local best and save/sync states in the approved responsive
  result composition.
- Frame measurement runs after responsive game columns update. Disable CSS
  size transitions on the measured containers: the global tiny reduced-motion
  transition otherwise makes Firefox/WebKit return the previous Card width.
  The 10-pair phone-to-desktop regression checks useful board width, unchanged
  round/card identity and no entrance replay in all three browser engines.
- Ranked issuance waits until the neutral 650 ms deal finishes. A session stores
  a server-owned 1200 ms flip/unfold allowance in `card_opening_ms`; migration
  `0007` defaults earlier rows to zero. Memory replay subtracts that issued
  value as well as the existing per-puzzle opening, never a client field. Old
  issued/claimed sessions retain their previous scoring timing. Reduced-motion
  ranked openings retain fixed deadlines, matching the existing Memory policy.
- Keep TypeScript `~6.0.3`, anime.js 4.5.0 and the existing game/theme versions.
  Local D1 only; no binding, secret, DNS, OAuth or deployment change. Checked
  [D1 SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/) and
  [local migration commands](https://developers.cloudflare.com/d1/wrangler-commands/),
  with installed Wrangler 4.151.3 help.

## 2026-10-28 — Result entrance after the Card correction

- Owner accepted Next and reported that the result appeared suddenly. Add one
  420ms panel fade/rise (20px) after folding, alongside the existing 500ms
  score-only scramble. Text contents remain static apart from the large score.
  Initialize the hidden panel before paint. Completed motion never replays.
- Preserve the approved 350ms exit. For an immediate Next, capture the current
  opacity/translation before reverting the entrance, and initialize the exit
  from that frame to prevent a flash. Logical readiness remains immediate;
  reduced motion or cancellation restores the final result and score.
- Verify entrance progress, final state, visibility resume, early/duplicate Next
  and a reduced-motion switch in Chromium/Firefox/WebKit plus installed Chrome.

## 2026-10-28 — Desktop Card transform and scatter correction

- Owner Chrome/Firefox review found lined-up objects and broken arrival/finish.
  Frame screenshots reproduced a retained random entry translation during
  unfold and fold. Reset all board transform channels in inline styles before
  each phase; restore/revert alone did not clear the retained parsed values.
  Entry alone is random: settle at the centre, unfold there, then fold into the
  played stack. Match the flying Card's final rotation to its stack slot.
- Checked anime.js 4.5.0 source and its current
  [transform documentation](https://animejs.com/documentation/animation/animatable-properties/css-transforms):
  JS animation reads individual transforms from inline styles. Keep Anime
  calls in the existing motion wrapper; no engine or readiness change.
- Presentation adapter `own-items-4` uses independent seeded x/y positions.
  Measure exposed background widths for two-dimensional scatter across each
  side, rather than narrow fixed columns or evenly spaced rows. Recompute on
  resize and theme/board replacement. Keep 1–5 objects per side, current-game
  isolation, mobile hiding, blend and opacity. No snapshot/config change.
- Browser regression now checks centre positions during entry/unfold/shrink
  and landing at the actual played stack over three rounds, in addition to
  frame identity/monotonic size. Test installed Google Chrome as well as
  Chromium/Firefox/WebKit and retain screenshots for visual review.

## 2026-10-28 — Card arrival and backdrop review corrections

- Owner requires fresh random Card arrival positions on Next, rather than the
  fixed left origin. The proof draws independent cosmetic entropy for viewport
  edge, position and rotation, preserving the continuous frame, accepted exit
  and per-game entrances. Reduced motion bypasses travel; failed entropy uses
  the existing logged static fallback. No selector or puzzle seed is consumed.
- Owner approved the background blend and requested no backdrop objects on
  mobile, plus 1–5 objects per side on wider layouts. Presentation adapter
  `own-items-3` derives left/right counts and positions from the existing theme
  seed without changing approved palette snapshots. Compact means width ≤900px
  or short landscape height ≤560px, using CSS layout queries in app and proof.
  Family isolation, 20% opacity and the approved blend remain unchanged.

## 2026-10-27 — Work 2 backgrounds, preparation and Card proofs

- Owner review correction: a shrinking/replaced board produced a visible pop.
  The presentation now uses one persistent frame whose dimensions grow into
  the board, then runs the game's own arrival. Preserve Memory's random-position
  deal and full preview/hide contract. The proof's fixed six-pair sample uses
  the existing three-second mapping; actual 6/8/10-pair 3/4/5 s remains intact.
  After fold-away, put score, Your high score, statistics and Next in the
  centre, with the stack at the side/bottom-left. The owner requested the demo
  update and continuation, not design acceptance.
- Subsequent owner result review requested animation and a desktop composition
  rather than the phone stack. The proof uses a wide two-column desktop result,
  compact portrait and separate short-landscape layout. Summary/score, stats
  and waiting-card/Next motion is decorative (700 ms, absolute positions),
  interruptible by Next and skipped for reduced motion. Score text is final
  immediately; no counter animation or completion callback computes a result
  or enables input. Actual app result/save behavior remains unchanged pending
  the design gate.
- The owner then reported duplicate result animation and asked for a flipping
  score and an exit on Next. Replace the overlapping reveal groups with one
  composition entrance and a score-only 3D flip (final text is present
  immediately). Guard completed Anime.js timelines on visibility resume.
  Next starts preparation behind a 350 ms result exit, ignores duplicate
  activation, and then deals the new Card. Reduced motion uses logical/static
  equivalents; no animation completion callback gates the next puzzle.
- Final owner update replaces the score flip (which visibly preflashed) with
  one 500 ms random-text reveal across the whole result. The owner explicitly
  accepted the existing exit animation; retain its 350 ms timing. Use pinned
  anime.js 4.5.0's [scrambleText helper](https://animejs.com/documentation/text/scrambletext)
  on temporary aria-hidden overlays, with final accessible source text keeping
  layout stable. Initialize overlays before showing the result, restore original
  nodes on completion/cancel/reduced motion, and never animate a computed score
  or gate readiness. This supersedes the intermediate flip/stagger choices.
- Owner clarification: the random reveal applies only to the large earned-score
  number (for example the big 450). Keep “Your score”, “Your high score 450”,
  the heading, statistics and Next text static. The implementation now targets
  `.sample-score` only with numeric glyphs; the previously accepted exit is
  unchanged. This narrows the preceding scramble decision.

- The owner directed starting the next step and made puzzle-specific backdrops
  a standing rule for all future puzzles. Block backgrounds contain actual
  block pieces only; Memory backgrounds contain cards only. No cross-game or
  generic background motifs in play. Home alone may mix game objects. Add this
  contract and its isolation/visual evidence to every future puzzle brief.
- `own-items-2` is a presentation adapter derived from the existing resolved
  theme seed. It supplies visible scatter even for old `none` arrangements and
  uses actual Block shapes exposed by the generated catalog/registry. Do not
  rewrite the approved palette/config snapshots or alter game RNG/scores.
  Effective decoration contrast stays ≤1.25 at 20% opacity; header/bottom bands
  clip decoration. Presentation cards/stacks are chrome, not backdrop motifs.
- Prepare at most one next solo candidate during the current entrance, with
  one foreground retry after failed speculation. Peek never consumes a draw;
  only a successful start commits family/history. A ranked start is issued
  only when requested, and its authoritative seed/theme supersedes the solo
  fallback candidate. No ranked reservation, clock change, or early seed leak.
- Bound IndexedDB access to 1.5 s and retain in-memory history on failure.
  Worker generation retains its 5 s deadline and deterministic fallback.
  A neutral loading card plus a normal Home link handles slow preparation;
  cancellation suppresses late commits and motion never signals readiness.
- Deliver interactive Memory/Block Card proofs before actual integration,
  following the owner's [Card decision](morphi-v1.1-handoff-2026-10-26/morphi-game-ui-redesign/THE-CARD-decision.md).
  Phone stack placement remains an owner verdict. The sample has isolated
  replay/finish/slow/failure/static controls, no account or score persistence,
  and is excluded from build output with all other demos. Eight visible stack
  cards bound the DOM; the completed-round count grows throughout the session.
- Retain anime.js 4.5.0 and use the sole `motion.ts` wrapper, with numeric
  absolute positions as required by the brief. Checked against the current
  [timeline position documentation](https://animejs.com/documentation/timeline/time-position).
  No package upgrades, scoring/engine changes or deployment authorization.

## 2026-10-27 — v1.1 contact-sheet approval

The owner approved the procedural-theme contact sheet. Its palette/style taste
gate is accepted. Next is Work 2: the UI/UX pass with The Card, beginning with
Memory and Block visual proofs and phone played-stack placement for review.
Overall visual acceptance, a numerical freshness target, real-device review and
production gates remain separate; no deployment is authorized.

## 2026-10-26 — v1.1 local theme review slice

The owner authorized the [v1.1 brief](morphi-v1.1-handoff-2026-10-26/CODEX-BRIEF.md)
and adjacent scope. Follow the brief's numbered order and retain the required
theme taste review. During the theme slice the owner supplied the 1920×923
small-board screenshot, explicitly requested the planned sizing fix, then
directed work to continue. That authorizes the bounded Work 2 shell/sizing
follow-up while theme/Card/overall visual acceptance remains pending. No
deployment authorization.

- Algorithm `oklch-machado-1`, immutable data snapshot
  `theme-2026-10-26-1`; no dependency upgrades. Recipes use the plan's
  3.3/5.5/9 contrast-target alternative, not the less reliable four-color
  3.5/5/8/14 trial. Chroma is reduced into sRGB gamut; checks operate on the
  final 8-bit colors. Maximum eight palette tries, then documented presets.
- Use the published severity-1 Machado matrices on **linear** sRGB, then
  CIE76 in D65 Lab. The handoff Python reference uses different matrices in
  gamma space; its numbers are not acceptance evidence. Matrix values were
  checked against the [Colour project's published dataset](https://github.com/colour-science/colour/blob/develop/colour/blindness/datasets/machado2010.py).
  Contrast follows [WCAG 2.2](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance);
  cosmetic OKLCH conversion follows [CSS Color 4](https://www.w3.org/TR/css-color-4/#ok-lab).
  Acceptance margins: symbol/edge ≥3.1, text ≥4.7, card back ≥1.55,
  pairwise color difference ≥22, effective decoration ≤1.25 at 20% opacity.
- Keep the PLAN's Shapes/Ocean/Garden/Candy as checked anchors and fallbacks.
  Do not silently promote the legacy app's Sky/Ocean/Garden palettes to safe
  procedural fallbacks; some fail the stricter color-separation rule. Their
  existing guest build path and historical owner-approved evidence remain.
- Theme streams are domain-separated from puzzle RNG. Neither engine versions
  nor known game vectors change. Generated Memory glyphs map onto existing
  logical identities, preserving replay while changing only presentation.
- Solo palette solving uses a Web Worker. A blocked/missing Worker logs an
  event and uses the same bounded, deterministic accessible fallback on the
  main thread. Theme history is the latest three dealt snapshots in IndexedDB,
  with in-memory fallback; it contains no account identity. Block generates
  symbol metadata for the shared theme vocabulary but does not paint glyphs
  on its pieces. Freshness reports this shared-family limitation explicitly;
  no novelty waiver or successful freshness gate is inferred.
- Ranked starts select up to eight candidates on the server, using the user's
  last three issued snapshots. D1 stores config/generator versions and the
  resolved snapshot on starts and completions; the client submits only cosmetic
  version IDs alongside its existing replay data. Pending results keep a local
  snapshot separately. Old queued runs remain readable as `curated-v1`.
  Per-round theme versioning never re-scores or regroups results. Local schema
  migration is `0006_awesome_killraven.sql`.
- CLI/migrations follow the current [D1 migrations documentation](https://developers.cloudflare.com/d1/reference/migrations/)
  and [prepared-statement API](https://developers.cloudflare.com/d1/worker-api/prepared-statements/),
  using the existing pinned Drizzle/Wrangler stack and local D1 only.
- Remove v1's fixed 690px wrap and 440/330px board caps for in-play screens.
  Use viewport height and container size, preserving gameplay and seeds. The
  title moves to the accepted header position, help/high score to the bottom
  viewport panel, and own-item scatter to the stage outside both bands. Add
  explicit ≥70%-height desktop panel and limiting-dimension use assertions,
  including the owner's exact screenshot size. The Card and full visual
  acceptance remain separate; the size fix does not waive them.

## Oct 25 owner follow-up — demo timing and phone layout

- The owner's subsequent review supersedes the package's 350 ms timing:
  door/return/result transitions use **1 second**; Home → puzzle uses
  **1.5 seconds**. A further owner correction sets help opening/closing to
  **0.5 seconds**, giving Home → puzzle → How to play a **2-second** combined
  sequence. All use ease-out through the existing anime.js motion wrapper.
  Round state still commits independently of animation completion. The
  logical Next deadline is separate from presentation duration.
- Prevent the incoming Home board from appearing before its delayed entrance;
  it fades in once. Decorative clones live in a clipped viewport overlay so
  their travel cannot grow the document. Enabling reduced motion mid-entrance
  restores visibility and removes overlays immediately.
- During phone rounds, centre the actual board in the viewport in portrait.
  In short landscape, grow boards from available viewport height and place
  the HUD and help/piece controls beside them. Apply this to both games,
  both direct door play and surprise/Mix play, including narrow landscape.
  Rotation preserves the current round; clear viewport space must not block
  header/help taps. Return transitions also measure the actual board.
- This is a local demo correction, **not full acceptance**, integration or
  deployment authorization. Other design decisions remain as reviewed.
  D5 eligibility/jurisdictions remain open; no new dependency or API pin.

## Accepted Oct 25 design package — demo implementation only

- Source: [design handoff](morphi-design-package-2026-10-25/morphi-design-handoff-2026-10-25.md),
  read in full before code changes, with its enclosed screen/GIF references.
  The package is stored under `morphi-design-package-2026-10-25/` in this
  checkout. It supplements v2; it wins on design conflicts while v2 retains
  rollout tracks, release gates and deployment authorization requirements.
- **Amendment to PLAN §11.16:** the owner replaces dim-during-play columns with
  **HYBRID**: quiet typographic guides before play; columns step aside during
  play; centred board with How to play / Scoring & tips dialogs; results first
  at round end, then the ready guides return in Stay mode. Block's in-round
  state remains Score / Lines / Streak in the HUD, with no side panel.
- **Navigation amendment to v2 §4.1 and PLAN §11.3:** remove puzzle-door links
  from Home, footers and in-product navigation. Doors remain indexable in the
  eventual sitemap and are reached by search/direct links. Sitemap submission
  remains owner-run. There is no Surprise me button; the quiet underlined
  “Or let Morphi deal you a surprise” link appears only in the ready guide,
  exits Stay into Mix and starts once. Home Play starts a dealt Mix round on
  arrival, with no second Play. Core Next never announces its pending family.
- Landing design replaces the earlier wide-column layout with a centred,
  one-screen Home. Coral Play, eight orbiting tiles (36-second orbit), mystery
  tiles, soft tinted chips, faint mixed-shape scatter and Privacy · Terms only.
  Scatter uses bounded visit-local entropy for positions, safe zones and
  spacing; it is static, aria-hidden, unlinked and independent of the engine.
- **Motion amendment to §11.9:** the specifically accepted Home orbit/gentle
  pulse is an exception to the earlier limited decorative-loop guidance.
  Both 350 ms ease-out transition sequences use anime.js through the small
  demo motion wrapper. Reduced motion swaps instantly, with no orbit,
  travel/scale or ghost layers. Navigation/round state never waits for an
  animation callback; callbacks only remove decorative clones. Help opens from
  its button and folds back on close, restoring focus.
- **Wording/brand:** Your high score, scoped to each puzzle family; Morphi.One
  on every user wordmark. No Contact Ali Gohar footer or simulated-data footer
  inside user screens. Operator/contact information remains in content pages.
- **Profile:** Foundation v2 with identity band, tabs, one row per played game,
  a detail view one level down, aggregate activity and three fixed right-rail
  slots. Labels use `#68798E`. Level/XP, mastery and achievements are synthetic
  visual fixtures only; this task promotes no production feature from the
  parked list. Result uses the accepted ink sign-in button, device-only note
  inside its section, and mobile score → Next → stats → sign-in order.
- The accepted public palette is scoped to demo user screens. Existing admin
  CSS/design remains unchanged; admin-reference images are not implemented.
- `animejs@4.5.0` (MIT, already the reference pin) is an exact **dev** dependency.
  `bun run demo:motion` reproducibly builds the isolated 39.1 KB minified
  `static/demo/motion.js`; its license is retained beside it. Only the authored
  wrapper imports anime.js. This is not an application/runtime integration.
  Current official [animation](https://animejs.com/documentation/animation/),
  [timeline](https://animejs.com/documentation/timeline/) and
  [cancellation](https://animejs.com/documentation/animation/animation-methods/cancel/)
  docs and installed types were checked before use. Existing pins stay locked.
- Owner explicitly requires stopping at the updated demo for review. This is
  not integration approval, deployment authorization, production measurement
  evidence or final account eligibility/jurisdiction acceptance. **D5 stays open.**

## Owner-authorized v1 implementation and visual demo — 2026-10-24

- Active handoff: `V1_RELEASE_CHECKLIST.md` (owner-supplied consolidated v2 plus
  recorded execution updates); the earlier `V1_RELEASE_PLAN.md` is historical.
  Explicit instruction to start coding authorizes local work; every deployment
  and applicable remote action still needs separate authorization.
- Confirmed scope: Stage 1 admin, SEO doors at `/memory` and `/block-puzzle`,
  landing `/` and noindex `/play`, and no in-game family catalogue. Core Next
  never names or previews its pending family. Starting family comes from the
  selector RNG; the earlier Block-first override is removed for v1.
- D1 approved: read-only D1 aggregates plus anonymous lite gameplay events and
  their consent/opt-out/disclosure. D3: prepare Terms for review. D4: procedural
  themes deferred; curated presets remain. No telemetry is enabled by the demo.
- D5: owner approved proposed 18+ account wording **in the demo** after asking
  for a recommendation. Final account eligibility/jurisdictions remain open;
  Ali Gohar owns a focused legal review of the intended global account launch.
  A policy statement does not prove age or settle child-data obligations.
- Owner specifically replaced wireframes with an interactive local demo, before
  approval/integration of new screens. `static/demo/v1.html` uses synthetic,
  in-memory interactions; it establishes no production security acceptance.
- Selector weights are nonnegative safe integers, disabled at zero. Each family
  appears once per cycle; weights shape order, never multiplicity. Minimum gap
  is `clamp(floor(eligible / 3), 1, 5)`, except repetition for one family.
  Seeded property checks cover larger synthetic indexes without adding games.
  Failed generation retains the pending draw. No engine vectors/versions change.
- Cloudflare `workers-best-practices`/`wrangler` guidance and current official
  [Worker guidance](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/),
  [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) and
  [local D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/)
  were checked. Existing dependency pins, compatibility settings, secrets and
  production observability remain unchanged; their release gates stay open.

## Owner-requested v1 release plan — 2026-10-24

- Owner requested preparing the v1 plan. `V1_RELEASE_PLAN.md` proposes release of the already accepted Memory/Block account features, secure production operations, measured release checks and a small Stage 1 admin panel. Planning is authorized; new admin/terms implementation, remote provisioning, credential changes and each deployment remain separate approvals. `morphi-plan-simple.md` stays authoritative.
- Preserve accepted local Step 6 review, public general-audience privacy wording, intentional Cloudflare analytics and owner-confirmed domain ownership. Do not add a new puzzle/random-theme platform, password auth, age gate, CMS, GA4, payments or multiplayer.
- Owner reports production Google setup complete and supplied a private credential-file location. This task does not read/install the credentials or independently confirm branding verification/publication, audience state or the live callback. Record the actual console status before rollout; do not infer approval or repeat completed setup from a static client file.
- Proposed sequence: release contract/local preparation; approved local gaps; authorized production provisioning/operations and resource evidence; approved controlled rollout; owner acceptance and launch. Admin panel and optional static terms scope are proposals, not locked implementation decisions. A protected production operator path is required even if the panel is deferred; the current local CLI is not that path.
- No dependency/configuration changes or production actions. Source references and completion gates are in `V1_RELEASE_PLAN.md`; no missing measurement or launch gate is waived.

## Guest privacy publication and intentional Cloudflare analytics — 2026-10-24

- Owner explicitly authorized publishing the previously prepared guest-only homepage/privacy artifact. First deployment: Worker `morphi-one`, version `44a5846f-95d6-43d5-b61e-c7f478b6e857`, deployment `0da17bcf-36a2-4140-83ea-8c663efd7afd`, 2026-10-24T12:14:09.992338Z. Reviewed manifest `15c32fd3562c607d43d676e09041f4ccda498e9457f06a18c553e43ce600efce`; exact deployed artifact archived in ignored `build/public-privacy-published-44a5846f/`. No account backend/D1, DNS, production OAuth or secrets changes.
- The owner-requested analytics disclosure update is published as `b50a7a18-2e85-4406-bd40-77f27c4b3da3`, deployment `fdb5c4e0-d618-40f0-a557-0130470cc24a`, 2026-10-24T12:32:54.790982Z. Manifest `019edab6f58dff4f231739763a527f955e84afa60432da08a9e19a52f28d82c0`. Local checks and all seven live check groups pass; no other external request origins are allowed.
- Owner confirms Search Console/domain ownership is already verified. Record as owner-confirmed rather than requesting the same setup again; Google console/project association is not independently inspected by this task. Owner will configure/apply for the production Google project after publication; no Google action is performed by the agent.
- Live browser checks detected Cloudflare Web Analytics injected by automatic setup on Home and `/privacy`. Its absence from the build files is intentional delivery behavior. The owner chose to keep it, then explicitly requested updating `/privacy`, marking the beacon intentional in the release report and rechecking live pages. This instruction scopes the disclosure follow-up publication; it does not authorize GA4, ads, an analytics pipeline or account rollout.
- Add a concise Website analytics disclosure: provider, automatic script injection, site visits/performance and coarse report dimensions, no custom Google identity/seed/move/history events, and separate provider retention/deletion limits. Preserve general-audience wording and contact. No cookie/consent exemption or fixed provider erasure deadline is asserted.
- Keep strict local build checks (no beacon embedded in assets) and use a live check that permits only the identified `static.cloudflareinsights.com/beacon.min.js` origin/path. All other external requests and account API calls remain failures. The earlier generic no-external-script live assertion correctly surfaced the platform behavior; it is not silently called a pass or waived.

## Owner local Step 6 acceptance — 2026-10-24

- Owner completed `STEP6_REVIEW.md`: every functional item is marked working as expected on PC/mobile, including privacy, sign-in/cancel, public/private names, saved/ranked scores, cross-device history, reconnect/idempotent save, isolation and deletion. The final row explicitly accepts Step 6 on 24-10-2026. Record this as **owner acceptance of the local functional build**; do not ask for the same review again.
- Device/browser models and the mobile OAuth setup were not supplied. Do not invent those details or claim independent physical-device observation. Prior automated checks remain separate evidence. True peak isolate memory, production capacity/operations and applicable public-account eligibility decisions remain unverified/unresolved, without a performance waiver.
- The owner asked whether OAuth submission needs deployment; this is a question, not deployment authorization. Google needs public homepage/privacy information. The prepared guest-only Cloudflare update remains intact with 41 matching asset files; public account backend rollout, domain/DNS changes, Google project/client changes and actual submission remain separately authorized steps.

## Privacy readiness and publication preparation — 2026-10-24

- Owner explicitly authorized the practical local retention/request review, supported controls, public copy cleanup, exact safe guest publication preparation, relevant checks and smallest-next-Step-6 review. No deployment, production provisioning/credential change, DNS change or Google submission is authorized. General-audience wording and direction stay settled.
- Live GET inspection confirms Worker `morphi-one` still serves `fb89f416-e757-4015-9d94-0741a7b5bf95` at 100%, with only `ASSETS`, no bound account database, top-level observability disabled, Logpush off and no tail consumers. Do not infer active retained logs from enabled nested settings or assume the local account configuration matches production.
- Owner confirmed personally monitoring cngohar@gmail.com and handling requests. `PRIVACY_REQUESTS.md` documents minimal verification, credible children's-information review, appropriate lawful action, outcome and limits. No age screen, age-verification service or child product added. Public account eligibility/jurisdictions remain a separate owner decision; Google basic identity scopes do not prove age.
- `PRIVACY_RETENTION.md` records actual tables/provider limits. New local admin-only/TOTP-protected maintenance removes expired sessions/state, auth limiter entries idle over a 24-hour buffer and safely disposable expired ranked starts; ranked address hashes are cleared outside the one-hour cap window. Retain active supersession rows and unresolved claimed runs for recovery. No scheduler, audit TTL or provider expiry guarantee. A verified-request local privacy-delete action cascades the active user data and writes a minimal independent audit; permissions and atomic rollback are tested. No real user database was cleaned/deleted by the task.
- Better Auth `1.7.12` encrypts access/refresh tokens under the existing option; its ID token field is separate. Document the real behavior rather than describing every stored token as application-encrypted. Authorization URL tests enforce exactly openid/email/profile and online access. No auth provider behavior or dependency pin changed.
- Remove public draft banners/review notes/noindex now that the guest-only disclosure and manual procedure are concrete. Use **Updated: 2026-10-24**, not a fictitious earlier effective date. Account descriptions explicitly identify the later release. Internal status/provider limitations and future public-account gates remain in docs.
- Prepare an assets-only publication candidate through `prepare:public-privacy`, `wrangler.public-privacy.jsonc` and a hashed manifest. Build mode `public-guest` prerenders Home, hides account prompts and leaves the later replay queue disabled to preserve the public best/settings-only behavior; the normal local app remains session-aware. Explicit allowlisting excludes Worker/server code, D1/auth variables, environment files, source maps and review demos. Missing account/auth/API/leaderboard paths return 404. Existing game rules/themes/vectors are unchanged. Local workerd/browser checks and packaging dry run precede any request for the mandatory deployment approval.
- The candidate replaces the existing guest Svelte server with static asset serving on the same Worker; this exact operational change is documented for deployment review. Existing custom-domain/DNS attachments are not changed. Main local config gains supported query-string redaction for a future backend rollout; no live setting changed.
- Full verification exposed a collision between the vector harness’s fixed TCP port and another local application. Reuse the harness’s OS-assigned test-server port for workerd and capture bounded startup stderr/early exits. Do not kill the other application, increase timeouts, weaken assertions or change game vectors to make this pass.
- No CMS, GA4, new games, multiplayer, payments or web admin panel. Next smallest Step 6 work is the owner physical-device review in `STEP6_REVIEW.md`, retaining outstanding resource evidence and acceptance limits. Publication, Step 6 acceptance, OAuth submission/verification and global launch are all still pending.

## Owner clarification — 2026-10-24

- Owner subsequently read and approved the current local privacy draft (`2026-10-24-draft-2`). Wording/product direction review is accepted; unresolved retention settings and account-eligibility/request-handling implementation remain recorded in `PRIVACY_REVIEW.md`. No deployment, submission, or Step 6 acceptance is inferred.
- Morphi is a **general-audience puzzle site**, with no child-focused content, design, or marketing and no separate kids site planned. This supersedes the earlier interpretation below that children under 13 were an intended target audience; guest accessibility was the concern. Child accounts remain deferred.
- Update the local privacy draft to describe the actual absence of guest age collection/independent age verification, without claiming this is an exemption or that guest play collects no information. Keep public account eligibility, handling of children’s information, and retention review open. No age gate, consent system, account-access change, or publication is authorized by this clarification.
- FTC general-audience guidance distinguishes child visitors from child-directed services and does not generally require collecting every visitor’s age. Actual design/marketing and known under-13 personal-data collection remain relevant. EU consent-based online-service age thresholds vary by country; no blanket worldwide age of 16 is adopted. Sources are in `PRIVACY_REVIEW.md`.

## Owner update — 2026-10-23

### Local privacy page and intended audience (latest)

- Owner requests the privacy policy locally, with later admin editing, then applicable public Google verification before the full v1 launch. This is a scoped local addition while Step 6 owner acceptance remains pending; it does not authorize deployment, OAuth publication, a CMS, or other new static pages.
- Owner supplied **Ali Gohar** as operator and **cngohar@gmail.com** as the public privacy/support email and chose an audience including children under 13. The owner then selected **guest games for under-13s; child accounts deferred** for v1. This is a product decision, not a determination of legal audience classification or a claim that age/consent controls exist.
- Implement `/privacy` as prerendered public HTML with `csr = false`, title/description/canonical, escaped catalog-backed copy, and a dedicated content file. Normal full-document links preserve authenticated app navigation without reusing prerendered anonymous layout state. The server hook initializes locals and resolves build-time requests before accessing `cloudflare:workers`; runtime session handling is unchanged. Home/account footers link to it; gameplay stays free of the footer. While children's safeguards or retention review are unresolved, show the draft issues and `noindex`. No publication-ready or legal-compliance claim.
- Later terms/privacy/announcement/blog editing belongs to long-plan section 11.10 Stage 5, with its publishing/security/audit requirements. Use the existing content-page template from section 11.16 now; do not implement that future CMS for one page. No dependencies or version pins changed.
- Policy facts were checked against actual auth/schema/storage/replay/logging configuration. It covers private Google identity, public player names/ranked scores, saved rounds, sessions/device storage, explicit guest import, processors, deletion limits, and no current GA4/ads. Separate security/moderation/provider/backups retention is not invented.
- `docs/privacy/PRIVACY_REVIEW.md` records owner decisions, actual data behavior, unresolved children's access/collection and retention work, and current Google/FTC primary sources. Public OAuth submission remains blocked until those points and the final policy/publication are reviewed. Google verification cannot use a localhost-only draft. No sign-in eligibility logic was changed in the privacy-page task.

### Local Step 6 delivery (latest)

- Owner authorization: complete Step 6 locally and perform the small structural cleanup, then plan a global release including a proposed admin panel. This authorizes neither remote provisioning/publication nor web admin implementation or deployment. The owner confirms local Google OAuth works; that supersedes earlier pending real-login notes below. Evidence is owner-reported, not an automated Google consent run.
- Shared platform-free RNG/contracts stay in `src/lib/engine`; cryptographic entropy moved to `src/lib/seeds.ts`. Each puzzle now owns its rules, manifest, version, view/components, themes, README, and tests in `src/lib/puzzles/<id>`. Generated `catalog.ts` is headless; `registry.ts` adds views. Import/re-export/dynamic-import boundaries and deliberate-violation checks enforce isolation. No workspace migration or new dependency was needed.
- Preserve existing game generation/scoring vectors and four curated themes. Versions are `block-placement-1` and `memory-1`; ranked Memory groups additionally include pair count. Cross-runtime vectors now run in Node, Bun, Chromium, Firefox, WebKit, and local workerd. Memory/RNG expected values have an independent Python reference; Block retains its pre-existing golden vector.
- The short plan's smallest implementation uses one local D1 for accounts, history, and authoritative ranked-session rows. Cryptographically random opaque session IDs are account-bound; seed, type, version, issue/expiry, claim time, and payload hash are authoritative database data. This replaces the reference long plan's stateless signed tokens plus enforcement Durable Object for this slice. No token field chosen by the client is authoritative. Parameterized conditional insert/update statements provide the serialization point; tests cover start/submit races, conflicting/identical retries, expiry and interrupted claims. Durable Objects remain deferred.
- Ranked starts: 30 per rolling hour per account and keyed IP hash; at most ten superseded/unclaimed starts per hour, counting the proposed supersession. The ranked lifetime is two hours. Claims freeze first accepted submission time/hash and survive expiry or a later start. Result IDs are unique. Matching committed retries return the acknowledgment even after expiry or ban; changed payloads are refused. First late/superseded results become unranked history through the client's retry path.
- Bounds: 64 KiB run JSON; 300 Block placements; six Memory attempts per pair (at most 120 flips); up to 100 unranked saves/account/hour. Unknown fields, client scores, unsupported versions, malformed moves, and non-terminal replays are rejected. New completed rounds enter IndexedDB at logical completion, before animations; blocked storage falls back to memory with an explicit warning. Retry uses backoff and respects Retry-After. Old browser bests are not importable as completed runs or ranked scores.
- Each pending record is scoped to the account that started it; the client receives only an opaque account-scope hash, not the private Google profile. Server authentication/ownership is checked independently. Guest import is explicit and unranked. Account deletion cascades session/history/ranked data and cleans that account's local pending queue where accessible. The profile shows 30 recent runs and replay-computed bests.
- Ranked Memory uses server issue-to-claim wall time, minus one second of network allowance, rounded down. Preview/background/submission delay count; solo active-time behavior is preserved. Minimum ranked duration is 0.4 seconds/pair. The HUD/local score is an estimate; saved-score status, account, and boards use the server result. Replay establishes legal moves, not human play; no prizes or bot-proof claim.
- Boards are all-time, compatible-version/group scoped, one best eligible result per player, score descending then earlier submission and stable result ID. Pages contain 25 entries, with bounded offsets and the player's position. Hidden/banned/deleted entries are excluded at query time without stale rank caches.
- Stage 0 moderation is a local-only OS-owner command with database role checks, fresh TOTP per operation, and atomic before/after audit records. Admin can toggle ranked; moderators can hide/restore or ban/unban; support can read hidden scores. Enrollment is an explicit owner-run local bootstrap, not automatic. No admin endpoint, panel, impersonation, or production enrollment was added. See `ADMIN_LOCAL.md`.
- Generated local migrations: `0001_panoramic_turbo.sql` (runs, ranked sessions, bans, roles/audits) and `0002_lowly_paladin.sql` (ranked control). Real production storage/retention and admin access/recovery are global-release decisions. No dependency pins changed: TypeScript `~6.0.3`, Better Auth/adapter `1.7.12`, Drizzle ORM `0.45.4`, kit `0.31.11`, Cloudflare adapter `8.0.1`, Wrangler `4.151.3`, compatibility date `2026-10-22`, `nodejs_als`. Node `24.14.1` and Bun `1.4.2` were used locally.
- `bun run verify` now covers format/lint, zero-warning type check, boundary self-checks, units, real local D1/auth integration, six-runtime vectors, isolated built-Worker smoke/build, and account/recovery/layout browsers. Replay CPU and observed heap measurements are in `STEP6_MEASUREMENTS.md`; true production peak memory, load capacity, and physical-device evidence are not invented.
- Current official references used: [D1 atomic batches](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Drizzle parameterized SQL](https://orm.drizzle.team/docs/sql), [Worker CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/). Public Google setup/submission references and steps are in `GOOGLE_OAUTH_PUBLIC.md`. Nothing was provisioned, published, or deployed.

### Earlier updates (historical)

- OAuth credential follow-up: owner supplied Google credentials in ignored `.dev.vars` and reports the OAuth app is in Testing with no branding submission. Presence and local runtime loading were checked without printing secret values. A real user login/callback is still pending; local D1 has no non-fixture Google account yet. No OAuth publication, brand submission, production database, DNS change, or deployment was performed.
- Fixed the real Google start action for SvelteKit 3: `redirect(303, destination, { external: ['https://accounts.google.com'] })` grants only the required provider origin. Current [SvelteKit redirect docs](https://svelte.dev/docs/kit/@sveltejs-kit#redirect) and pinned installed types confirm the explicit allowlist requirement. The previous form failed at the framework redirect step, independently of Google’s Testing/branding settings. Added a real-form browser regression that stops at the provider boundary and checks the canonical callback, basic scopes, and HttpOnly/SameSite state cookie. No versions changed.
- Google’s current production guidance distinguishes Testing, publication, brand verification, and sensitive/restricted-scope review. Keep Testing during local work; prepare production publishing/brand verification and required public privacy/domain information before public accounts. Morphi asks only for basic identity (`openid`, `email`, `profile`); the current Google state table exempts those scopes from Testing allowlisting. Sources and owner steps are recorded in `docs/operations/GOOGLE_AUTH_SETUP.md`.

- Result-screen implementation correction: connected the approved result design to the shared real game screen after the owner reported that finishing a round still showed the old result. Guests get the Google sign-in entry point and signed-in players get an account link, while Next stays primary. The result explicitly describes its best as local; no account-save or leaderboard claim is made before history/ranked sync exists. This uses the already approved design and adds no backend or dependency changes. The public site is not deployed by this local change.

- Subsequent owner approval: all five account-screen designs and proposed Step 6 scope are accepted, with implementation authorized. The first slice is local accounts; history sync and ranked scoring follow. Owner confirmed no Google OAuth client exists yet and requested setup instructions (`docs/operations/GOOGLE_AUTH_SETUP.md`). No deployment or remote provisioning has been performed.
- Local accounts verification: 94 unit tests, six real emulated D1/Better Auth integration tests, and all 14 Chromium cases passed. The built Worker passed session/name/deletion/cache/guest checks in three viewports with isolated temporary D1 storage. Real Google testing remains pending owner OAuth setup; saved history and ranked scoring are not implemented yet. No deployment. See the newest `docs/PHASE_REPORTS.md` entry.
- Accounts dependencies pinned: `better-auth@1.7.12`, `@better-auth/drizzle-adapter@1.7.12`, `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11`. Official Better Auth Google/SvelteKit/Drizzle/user deletion docs, Cloudflare local D1 docs, and pinned adapter source were checked before use. Keep TypeScript `~6.0.3`, adapter-cloudflare 8.0.1, Wrangler 4.151.3, compatibility date 2026-10-22, and `nodejs_als`.
- Accounts are constructed per request from the `cloudflare:workers` environment. The pinned adapter’s Vite emulation exposes `.dev.vars` through those bindings, whereas SvelteKit’s private env schema did not expose those local secrets in the spike. OAuth callbacks and session cookies use the explicit canonical base URL, initially `http://localhost:5173`. Google access is basic identity only; account linking and password registration are disabled, provider tokens are encrypted, and no Google profile image is rendered.
- Better Auth uses database-backed seven-day sessions, no cookie session cache, five-minute freshness for deletion, and explicit CSRF/origin checking. The explicit settings also prevent Better Auth’s test-environment default from bypassing origin checks during integration tests. Public names live separately from Google’s private user fields and are case-insensitively unique in D1; account deletion cascades them. Admin and similar official names are reserved.
- D1 uses an explicitly local placeholder ID (`local-morphi-accounts`), with `remote: false`; migrations are generated by Drizzle Kit and applied using Wrangler `--local`. No auto-provisioning or real remote database ID is present. Generated Worker declarations are ignored and regenerated with `cf:types`/`prepare`. `checkJs` is disabled because Wrangler’s generated main-module declaration imports adapter-built JavaScript; authored application code remains strictly checked TypeScript, and ESLint continues to check authored JavaScript. SvelteKit 3 hook types come from `@sveltejs/kit/hooks`, and form types come from `$app/forms`.

- Subsequent owner choice: Google-only sign-in, with guest play retained, is approved for the first accounts release. The owner requested a local HTML screen demo for review before accepting the screens. `static/demo/accounts.html` provides Sign in, Choose player name, Your account, After a round, and Leaderboard previews at all three required sizes, including failure/offline states. All authentication, saves, deletion, and rankings are simulated. Screen layouts, public-name rules, deletion policy, and leaderboard scope remain proposals. No database, Google OAuth credentials, or admin panel was created. D1 local development and Better Auth database/provider documentation were checked on 2026-10-23; no dependency versions changed.

- Subsequent owner acceptance: "i ill maccept the public test result" closes Step 5 by owner judgment and requests the Step 6 approach. The measured replay-rate criterion is waived because replay counts and the predetermined threshold remain unavailable; sentiment is not reclassified as replay evidence. Step 6 is in planning (`docs/planning/STEP6.md`), with authentication method still pending. Google-only sign-in with continued guest play is the agent's recommendation, not an owner decision. No new games, remote resources, billing changes, or deployment are authorized by this acceptance.

- Owner-approved manual production deployment completed at `2026-10-23T04:39:40Z`: Worker `morphi-one`, version `fb89f416-e757-4015-9d94-0741a7b5bf95`, serving 100% of traffic. Deployable source/config/assets matched merged Git commit `32ed6bf6bcb58f16d9d44e904ab3ca695e378ee0` (49 files). All 92 unit tests and 11 Chromium cases passed before deployment; lint, type-checking, bundle dry run, and built local Worker smoke passed. Both live hostnames passed browser smoke in three viewports and served the reliability fix markers. Runtime date/flags, assets-only bindings, and the custom-domain attachment were verified unchanged. No automatic deployment was enabled; Git remains source backup. See `docs/PHASE_REPORTS.md`.

- Cloudflare setup follow-up: after the owner restored permissions, installed all 19 skills in this repo only (`.agents/skills`, recorded by `skills-lock.json`), registered the MCP server in `.codex/config.toml`, and verified successful OAuth login. Requested scopes are limited to read-only account/Worker diagnostics plus offline access. No global skills/MCP config, optional CLI, or deployment changes. Reload is needed before this conversation can use MCP tools; see `docs/operations/CLOUDFLARE_AGENT_SETUP.md`.

- Maintenance authorized while player surveys continue: harden the current two games without advancing to accounts, platform architecture, or more games. Unit tests now use a standalone `vitest.config.ts`, following [Vitest's configuration guidance](https://vitest.dev/guide/index.html), so pure rules/helpers run without loading SvelteKit, Worker emulation, or local secrets. Type-checking includes the browser tests and both test configs. No dependencies changed.
- Memory hide/mismatch deadlines use visible time and cancel on unmount; cosmetic effects keep their existing timing. Game rules, scoring, seeds, and the approved Block clear duration are unchanged. Storage prefers unsaved session writes over stale disk data and retains the last readable value when later reads fail. Round rotation commits only after generation succeeds.
- Cloudflare agent setup is project-local only, per owner direction. The required `.agents` and `.codex` directories are read-only in this workspace; no global install/configuration or OAuth was performed. See `docs/operations/CLOUDFLARE_AGENT_SETUP.md`.

- `morphi-plan-simple.md` remains the active plan: games first, architecture second. The full plan is reference only, not a requirement to build the platform before improving the games. The stale Phase 0 gate in `AGENTS.md` has been replaced with the current simple-plan status.
- Step 5 manual public testing is complete per the owner: 45+ players, over 60% positive feedback. Some called the games simple/basic, one asked about a tutorial, one asked what comes next, and some gave no feedback. Exact replay counts and the offline threshold have not been supplied; positive sentiment is not a recorded replay-rate pass. Missing feedback does not establish dissatisfaction or demand for more games. No Step 6 or additional game has been approved in this update.
- The owner authorized uploading the existing project to the private repository `https://github.com/cngohar/morphi.one1`. This supersedes the earlier restriction on remote source publication for this repository only. No CI or automatic deployment is introduced, and each Worker deployment still requires explicit owner permission.

Decision log. It records the owner's decisions with a short reason so agents do not have to dig through the plan. Agents add pinned versions and any non-obvious choice.

## Decided by the owner (October 2026)

| Area                          | Decision                                                                                                                                                                                                                                                                        | Why                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name and domain               | Morphi, at morphi.one                                                                                                                                                                                                                                                           | All puzzles live on one site instead of a list of separate sites                                                                                                                                                                                        |
| Development mode              | Local-first: no GitHub repo, Cloudflare account, or deployment until the first game is verified locally                                                                                                                                                                         | Owner preference; Phase 2 creates the accounts and the first deploy                                                                                                                                                                                     |
| Frontend                      | SvelteKit (Svelte 5)                                                                                                                                                                                                                                                            | Daily-use stack; Astro suits content sites, not stateful apps                                                                                                                                                                                           |
| Engine                        | TypeScript now; Rust/WASM later only where needed                                                                                                                                                                                                                               | The owner works in TypeScript daily; WASM glue was a Phase 0 risk; the contract and test vectors make a later port safe                                                                                                                                 |
| Infrastructure                | Cloudflare only (Workers, D1, KV, R2, Durable Objects, Turnstile)                                                                                                                                                                                                               | One platform; Google Search Console and GA4 are used for search and analytics                                                                                                                                                                           |
| Multiplayer                   | Durable Objects, no Go                                                                                                                                                                                                                                                          | Native to Cloudflare                                                                                                                                                                                                                                    |
| Auth                          | Better Auth                                                                                                                                                                                                                                                                     | Owner's preference                                                                                                                                                                                                                                      |
| Physics (later)               | Rapier's deterministic npm build from TypeScript                                                                                                                                                                                                                                | Cross-platform determinism; not Matter.js                                                                                                                                                                                                               |
| Solo storage                  | IndexedDB; an account makes progress permanent and rankable                                                                                                                                                                                                                     | Solo play needs no account; local scores are unranked                                                                                                                                                                                                   |
| Ranked play                   | Server-issued seeds; the server replays moves and computes scores                                                                                                                                                                                                               | Anti-cheat                                                                                                                                                                                                                                              |
| Payments                      | NOWPayments first (sandbox first); Stripe unavailable in the owner's country                                                                                                                                                                                                    |                                                                                                                                                                                                                                                         |
| Analytics                     | Google Search Console and GA4; first-party pipeline for theme analytics                                                                                                                                                                                                         | GA4 cannot hold high-cardinality theme data                                                                                                                                                                                                             |
| Languages                     | Multi-language wanted; English only until after Phase 3                                                                                                                                                                                                                         | The foundation (message catalog, logical CSS) is built from Phase 1                                                                                                                                                                                     |
| Look                          | Light theme first, dark second; Nunito font; flat design                                                                                                                                                                                                                        | The owner accepted the demo direction                                                                                                                                                                                                                   |
| Anti-slop rules               | No gradients, glows, or shadows and bevels on game objects; quiet backdrop decoration is allowed                                                                                                                                                                                | Avoid the generic AI-app look                                                                                                                                                                                                                           |
| Themes                        | Generated from recipes (data) and verified by script; the v2 generated-themes look is accepted                                                                                                                                                                                  | New look every round without garish results                                                                                                                                                                                                             |
| First puzzles                 | Memory and block placement, compared with an A/B replay test                                                                                                                                                                                                                    | Pick the best first impression with data                                                                                                                                                                                                                |
| Color rule                    | Never relax the CIE76 threshold of 20 for a preset; replace the colors instead (the owner chose this on 2026-10-14 when the documented Shapes colors measured 7.7)                                                                                                              | Shapes are an extra safety, not a substitute for color separation                                                                                                                                                                                       |
| Hosting plan                  | Workers Paid ($5 per month) from Phase 3; the owner accepted the cost                                                                                                                                                                                                           | The Free plan's 10 ms CPU limit for ranked replays, and headroom for D1 and Durable Objects (the old compressed bundle limits were removed; Worker size is 64 MiB uncompressed on every plan)                                                           |
| Hosting target                | Workers with Static Assets (locked); Pages is not used                                                                                                                                                                                                                          | Durable Objects need a Worker; the first run used it; the SvelteKit adapter targets it                                                                                                                                                                  |
| Session tokens                | Stateless HMAC-signed, expiring tokens; D1 is written only at submit                                                                                                                                                                                                            | Abandoned starts cost no write; a UNIQUE `session_id` makes a second submit fail                                                                                                                                                                        |
| Engine split                  | `core` (integer-only, banned-math lint) and `theme` (fixed-point or float color math; no `Date.now` or `Math.random`)                                                                                                                                                           | OKLCH color math needs `pow` and cube roots, which the core lint bans                                                                                                                                                                                   |
| Contract source of truth      | `docs/CONTRACT.md`, written in Phase 0 and approved by the owner; the plan states requirements, not code                                                                                                                                                                        | Code in the plan drifted from its own prose (the `score` signature)                                                                                                                                                                                     |
| Animation                     | CSS and Svelte transitions first, the Web Animations API for sequencing, and anime.js v4 (owner request) for timelines, stagger, and number tweens, lazy-loaded behind a `motion` wrapper                                                                                       | Animation is core to the game; the wrapper enforces reduced motion, token durations, and cleanup                                                                                                                                                        |
| Frontend language             | SvelteKit with TypeScript for the UI; Rust only for the engine, and only later where it pays. A Rust-only frontend (Leptos, Dioxus, Yew) was considered on 2026-10-15 and rejected for now                                                                                      | Better Auth, Drizzle, Paraglide, SvelteKit SSR, and animation libraries are JavaScript or TypeScript; Rust frameworks still need JavaScript glue; larger WASM payloads work against instant load; AI coding agents write far less reliable Rust UI code |
| Rotation                      | Next comes from a selector: a weighted shuffle bag over puzzle families (never the same family twice in a row), with Mix and Stay settings for players and admin-editable weights                                                                                               | The first run served Memory with new colors on every Next; variety must change the puzzle, not only the skin                                                                                                                                            |
| Families, variants, instances | A family is code, a variant is data, an instance is a variant plus a seed; rotation is by family                                                                                                                                                                                | Hundreds of thousands of variants are feasible as data; hundreds of thousands of coded families are not                                                                                                                                                 |
| Container shapes              | Surface shape families (shape, proportion, gap, border, topology) are cosmetic theme axes for every puzzle, never changing difficulty                                                                                                                                           | Cards were the same size every refresh                                                                                                                                                                                                                  |
| Enforcement store             | A per-user Durable Object with counters persisted to DO storage handles token supersession, abandoned starts, and daily eligibility; KV is only a hint; the Rate Limiting binding is only a coarse brake                                                                        | Verified: the binding is permissive, per location, and eventually consistent; Durable Object memory is lost on hibernation                                                                                                                              |
| Responsive layout             | Layout profiles (compact, medium, expanded) per puzzle view, selected by viewport and container size; no user-agent sniffing; one puzzle logic for every device, not separate versions per device                                                                               | The first build showed a mobile-sized board on a 1440x900 screen; logic must stay identical so resume, share links, and leaderboards work across devices                                                                                                |
| Puzzle arrival                | The shell owns an `enter` and `exit` protocol; puzzles may supply their own arrival animation                                                                                                                                                                                   | Next should feel like a new puzzle arriving, for every puzzle                                                                                                                                                                                           |
| Tutorials                     | Each puzzle declares a tutorial depth (`hint`, `coach`, `guided`); never a tutorial wall; replayable from the menu                                                                                                                                                              | Memory needs a hint; complex puzzles need guided help                                                                                                                                                                                                   |
| Directory structure           | `packages/engine` (framework only), `packages/selector`, `packages/puzzles/<id>`, `packages/puzzle-kit`; engine never imports puzzles; puzzles never import each other                                                                                                          | Modifying one game must not affect another                                                                                                                                                                                                              |
| Per-user shards               | Not from day one; all personal data goes through a `UserStore` interface so it can move into per-user Durable Objects if the load test shows pressure                                                                                                                           | Sharding adds migration, aggregation, and restore complexity                                                                                                                                                                                            |
| Landing page                  | `/` is a no-scroll, prerendered landing page with the h1 matching the title’s primary topic (v1 title/headline use the separately adopted copy), an animated Play button in the centre and the accepted Oct 25 centred one-screen layout; the game lives at `/play` (`noindex`) | SEO for the homepage and a richer first impression                                                                                                                                                                                                      |
| Admin scope                   | Admins can create, edit, and delete users, puzzle variants and config, and static pages and blog posts (Stage 5), in later phases                                                                                                                                               | Owner request; new puzzle families remain code deploys                                                                                                                                                                                                  |
| Progression                   | Bands and XP now; mastery levels, achievements, and streaks designed in section 11.15 and built after the Phase 3 gate                                                                                                                                                          | Avoid scope growth before the data exists                                                                                                                                                                                                               |
| Plan freeze                   | After v7, change the plan only from phase reports, bugs, or verified facts; everything else goes to `docs/planning/IDEAS.md`                                                                                                                                                    | The plan is complete enough to start; more additions delay learning                                                                                                                                                                                     |
| Puzzle page layout            | Three columns on expanded screens (content, stage, content) for `centered` puzzles; drawers below 1024 px; none on phones; `wide` and `full` stage modes for puzzles that need space                                                                                            | Owner preference; some puzzles (Mahjong, jigsaw) need more room                                                                                                                                                                                         |
| Per-puzzle style              | Each puzzle has a style profile (data) within shared tokens and rules; layered puzzles may use flat depth cues; colors always from recipes                                                                                                                                      | Puzzles have different goals and need different looks                                                                                                                                                                                                   |
| Game-first                    | Every puzzle gets a design brief (core loop, difficulty curve, feedback, controls, layout, tutorial, replay hook) approved by the owner before it is built                                                                                                                      | Owner suggestion: build games, not generic puzzles                                                                                                                                                                                                      |
| Per-type pages                | `/memory` and similar are playable, indexable pages in Stay mode, using the puzzle page template                                                                                                                                                                                | Better SEO than a `noindex` game page                                                                                                                                                                                                                   |
| Dropped or parked             | Community, skill system, subscription billing                                                                                                                                                                                                                                   | Scope                                                                                                                                                                                                                                                   |
| Public v0 before the platform | A public launch without accounts or a database, and a continue/stop gate before Phase 3                                                                                                                                                                                         | A previous very large plan stalled before launch                                                                                                                                                                                                        |

## Simple plan build decisions (October 20, 2026)

These are implementation choices for the simple-plan block placement game. The full-plan phase table above is unchanged.

| Area                | Decision                                                                                                                                                                                                                                                                                                                                                     | Why                                                                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main game           | Block placement is the main game and starts first; Memory is routed again for Play/Next rotation but has no menu entry                                                                                                                                                                                                                                       | Owner directed Step 3; the simple plan keeps the other game in code; owner requested rotation on 2026-10-20                                                                                                                                                               |
| Engine version      | `block-placement-1`; 8x8 board; 3-piece tray; 300-placement cap; 10 opening turns                                                                                                                                                                                                                                                                            | Approved brief; pure and replayable from seed plus moves                                                                                                                                                                                                                  |
| Supply              | 300 pieces built eagerly from seeded 9-piece bags; opening trays are checked for a fit and the last slot falls back to a monomino                                                                                                                                                                                                                            | Deterministic bags keep the piece mix bounded; eager supply makes replay and tests simple                                                                                                                                                                                 |
| Scoring             | `lines*100 + (lines-1)*50 + (combo-1)*50`; no points for a placement without a clear; non-clearing placement resets combo                                                                                                                                                                                                                                    | Approved brief examples verified in unit tests                                                                                                                                                                                                                            |
| End state           | `ended` with `no-fit` or `cap`; no win, timer, resume, or abandonment recovery                                                                                                                                                                                                                                                                               | Scored survival run; simple-plan scope                                                                                                                                                                                                                                    |
| Layout              | Vertical picker on the right by default, left via `traySide`; tray below on compact/medium; max board 440/480/520 px by profile                                                                                                                                                                                                                              | Approved picker constraint; board uses more space on larger screens                                                                                                                                                                                                       |
| Themes              | Four fixed themes (`sky`, `shapes`, `ocean`, `garden`) picked by the seed; same seed gives the same theme; each theme sets its backdrop, board cell/edge, picker tray/slot, and four piece colors; no random colors; themes are cosmetic only                                                                                                                | Step 4 scope plus owner feedback that the board, pieces, and picker must follow the theme; consistent replay and bounded palettes; Shapes uses the verified fallback colors                                                                                               |
| Memory themes       | Memory uses the same four theme ids and backdrops as Block; the Memory round seed picks one and themes the backdrop, card back/edge/face/matched, back mark, symbol palette, and win confetti; the simple plan did not include Memory theme randomization, but the long plan does and the owner promoted it so both games are complete before public testing | Owner wants two full games before Step 5; cosmetic only, engine data and rules unchanged; contrast checked per theme                                                                                                                                                      |
| HUD                 | Score, Lines, and Streak in the main row; Round and Best on a meta line; Best is one overall block best                                                                                                                                                                                                                                                      | Step 4 scope and tester feedback; keeps the round and personal best visible without a side panel                                                                                                                                                                          |
| Interaction         | Pointer drag with a board-anchored ghost; tap-select then tap-cell; tray keyboard with arrows/Enter/Escape; pointer capture and resize cancel                                                                                                                                                                                                                | Touch, mouse, and keyboard parity; no stuck drags                                                                                                                                                                                                                         |
| Teaching            | One hint line on the first round only; short reminder after the first placement; hidden in later rounds; selected state shows the tap/drag fallback; `morphi.block.hintSeen` stored                                                                                                                                                                          | Step 4 tester feedback; avoids a tutorial wall and keeps the first round focused                                                                                                                                                                                          |
| Board visibility    | Each theme tints its empty board cells, edge, and picker tray/slot; `sky` keeps the owner-approved `#CDD9EE` cell and `#C8D3E5` edge. Unit-test floors: cell/backdrop 1.239:1, edge/backdrop 1.31:1, tray/backdrop 1.04:1, slot/tray 1.12:1                                                                                                                  | First-impression feedback; the owner chose a soft grid instead of the earlier dark slate. Measured cell/backdrop is 1.240-1.272:1 and edge/backdrop 1.316-1.385:1, below the full-plan 1.5:1 guideline; this is an explicit owner-approved exception for the simple build |
| Result              | Shared `ResultScreen` takes `title` and `summary`; block summary shows no-fit/cap plus lines and pieces                                                                                                                                                                                                                                                      | Reuse the accepted shell without Memory-specific props                                                                                                                                                                                                                    |
| Storage             | `morphi.block.best` for block; `morphi.block.hintSeen` for the first-round hint; `morphi.memory.best` retained; sound stays `morphi.sound`; in-memory fallback for all                                                                                                                                                                                       | Separate bests and hint state without losing the Memory build; blocked storage still plays                                                                                                                                                                                |
| Sound               | Web Audio adds `pick`, `place`, `invalid`, `clear` (pitch steps with combo), and `end`                                                                                                                                                                                                                                                                       | Existing soft-synth palette, no audio files                                                                                                                                                                                                                               |
| Motion              | Board ripple and tray slide under the 600 ms arrival budget; clear is a 1500 ms fill-only wave (each fill scales to 1.08 then shrinks/fades over 1440 ms with a 0-56 ms row/column wave, board cell and edge persist; no full-line wipe or flash); settle 100 ms; result after 450 ms; instant screen exit                                                   | Step 4 clear; owner explicitly requested 1500 ms and overrode the simple plan's usual under-300 ms guideline on 2026-10-20; animation never advances state                                                                                                                |
| Rotation            | Play/Next uses `src/lib/selector.ts`: an injected-RNG weighted family bag with each eligible family once per cycle, RNG-selected first family and no immediate repeats; with two families it strictly alternates; rotation state is in-memory (v1 owner amendment 2026-10-24)                                                                                | Owner request 2026-10-20 after the Step 4 review ("the same puzzle came again"); plan section 11.14; Memory routed again for rotation                                                                                                                                     |
| Input feedback      | Tray selection and board feedback update synchronously; latest local Chromium run measured 5.2 ms pick and 17.9 ms board response                                                                                                                                                                                                                            | Step 4 requires every tap to answer within 100 ms; local evidence only, not a cross-browser latency claim                                                                                                                                                                 |
| Known evidence gaps | Step 3 user testing closed by owner after 10 qualitative testers; Next/return counts, exact devices, a Memory-vs-block comparison, and the formal 20-round Step 2 Next-rate tally are not recorded                                                                                                                                                           | Owner judgment; not a replay-rate pass                                                                                                                                                                                                                                    |

### Gate status

| Gate                                                  | Status | Date       | Note                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner approval (Step 3 build)                         | closed | 2026-10-20 | Final board colors `#CDD9EE` cells and `#C8D3E5` edge approved in chat                                                                                                                                                                                                             |
| User testing (Step 3 10-tester playtest + real phone) | closed | 2026-10-20 | Owner-reported acceptance; two silent; no Next/return counts or device details                                                                                                                                                                                                     |
| Step 4 (make the winner feel like a game)             | closed | 2026-10-22 | Themes with per-theme board/pieces/picker and Memory themes, HUD, first-round hint, 1500 ms fill-only clear, and Block/Memory rotation built; mobile layout fixes and a repo Playwright layout audit added 2026-10-22; owner accepted after a portrait and landscape phone recheck |
| Owner review (Step 4 build)                           | closed | 2026-10-22 | Owner verified both games on a phone in portrait and landscape and accepted Step 4. Step 5 is next but has not started.                                                                                                                                                            |

### Step 4 layout and tooling decisions (2026-10-22)

- Playwright is a repo dev dependency, pinned as `@playwright/test@1.64.1`, with `playwright.config.ts` and `tests/e2e/`. `bun run test:e2e` runs the Chromium layout audit and reuses a running `bun run dev` server. `test-results/`, `playwright-report/`, `blob-report/`, and `playwright/.cache/` are gitignored; the config and specs are project files.
- Block layout uses a symmetric three-column stage in short landscape and desktop: `1fr auto 1fr`, with the board in the center column and the tray in the side column. This keeps the board centered on the viewport; desktop keeps the existing 520 px board cap.
- Memory layout has three modes: phone portrait, short landscape (`orientation: landscape` and height <= 560 px), and wide (`min-width: 1024px`). Phone portrait uses 3 columns for 6 pairs, otherwise 4 (10 pairs becomes 4x5). Short landscape uses `columns = pairs` and two rows, which gives 6x2, 8x2, or 10x2. Wide keeps 4 columns for 6/8 pairs and 5 for 10.
- Memory board width uses `min(92vw, 720px, (100dvh - 100px) * cols * 0.72 / rows)`, with a short-landscape override that also reserves `216px` for the centered board/tray layout. HUD stat numbers use `clamp(0.9375rem, 0.85rem + 0.35vw, 1.125rem)` so the old 24 px landscape values no longer occur.

## Pinned versions (the agent fills these in)

**Starting point: the last known-good set from the first local run (October 14, 2026).** Verify against current docs before pinning, and record what you actually use.

- Bun 1.4.2; Node 24.14.1
- TypeScript 6.0.3 (canonical; TypeScript 7 only side by side, after the Phase 0 compatibility test), Svelte 5.57.2, SvelteKit 3.0.1, Vite 8.3.4, `@sveltejs/vite-plugin-svelte` 7.3.1, `svelte-check` 4.7.6
- `@sveltejs/adapter-cloudflare` 8.0.0; Wrangler 4.151.0
- Playwright 1.64.1 (Chromium, Firefox, WebKit)
- Paraglide JS 2.27.0 with `@inlang/cli` 3.4.3 (English `baseLocale` strategy, unprefixed routes)
- Nunito 5.3.0 variable Latin WOFF2 subset (about 38 KiB), SIL OFL 1.1 license file kept in the repo

**TypeScript 6 versus 7.** SvelteKit 3 requires TypeScript 6 (verified in its migration docs), so TypeScript 6 stays the canonical `typescript` package. The first run reported that `svelte-check` did not support TypeScript 7, but the current `svelte-check` README says TypeScript 7 works with the `--tsgo` flag when both versions are installed (`typescript@~6` and `@typescript/native@npm:typescript@7`). Phase 0 runs a short compatibility test (including `typescript-eslint`), and TypeScript 7 is adopted for checking only if it passes reliably.

**SvelteKit 3 notes.** Project config lives in the `sveltekit` Vite plugin options (`vite.config`), not `svelte.config.js`. The `$lib` alias is replaced by a `#lib` alias declared in `package.json` `imports`.

Fill in the final pins here:

- TypeScript:
- Svelte and SvelteKit:
- `@sveltejs/adapter-cloudflare`:
- Bun and Node:
- Playwright:
- Wrangler, compatibility date, and flags (Better Auth needs `nodejs_compat` or `nodejs_als`; it is on by default for compatibility dates of 2026-08-04 or later):
- RNG algorithm and version (SplitMix64, documented here):
- Font files (Nunito subset and version):

## Open decisions (settle in the phase noted)

| Decision                                                                                   | When                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| CI provider (first run chose GitHub Actions; the workflow file only runs `bun run verify`) | Phase 0                                                |
| Supported-browsers matrix                                                                  | Phase 0                                                |
| i18n library (first run chose Paraglide JS)                                                | Phase 1A                                               |
| First-impression puzzle                                                                    | Phase 1B gate                                          |
| Third puzzle type                                                                          | After the Phase 1B gate                                |
| Continue or stop after the public v0 data                                                  | Phase 2 gate                                           |
| Sign-in methods and email provider                                                         | Phase 3                                                |
| Account deletion: delete or anonymize scores                                               | Phase 3                                                |
| Durable Object export approach (separate Worker or plugin)                                 | Phase 3A (spike before the enforcement Durable Object) |
| First additional language                                                                  | After Phase 3                                          |
| Service worker and offline play                                                            | After the v0 data                                      |
| Retry the same puzzle after a failed round (see IDEAS)                                     | Phase 1B gate                                          |
| Adopt TypeScript 7 for checking, side by side with TypeScript 6                            | After the Phase 0 compatibility test                   |

## Defaults from the first run (owner-tunable, use as a starting point)

- Memory v1: 6, 8, and 10 pairs for the easy, standard, and challenging bands; the seed picks the timer from 70/80/90, 60/70/80, or 50/60/70 seconds; score starts at 1,000 per pair, minus 150 per mismatch and 5 per elapsed second, and is zero after the timer limit.
- Layouts (examples for the 6-pair easy band): 4x3 cards in portrait and on desktop, 6x2 on a landscape phone (the same seeded order reflows). Every supported pair count needs its own layouts (for example 8 pairs: 4x4, landscape 8x2; 10 pairs: 5x4, landscape 10x2).
- Component failures use Svelte 5 `<svelte:boundary>` with a `failed` snippet.
- Shapes fallback symbol colors approved by the owner: `#009A86`, `#7D61AE`, `#7C4100`, `#003041` (the CIE76 minimum of 20 is kept).
- Recipe generation uses shuffled WCAG contrast targets of 3.5, 5, 8, and 14 against white.

## Lessons from the first local run

1. **Wireframes need all three sizes.** The first wireframes covered phones only; desktop 1280x800 was added after the owner noticed.
2. **Chrome belongs in the viewport corners.** The menu icon sat inside the puzzle container, which looked unfinished.
3. **Variety must include structure.** With only color, symbol, and background changes, cards had the same size every refresh. Card proportions, gaps, corner radius, and layout must vary too (plan section 11.2).
4. **Fake-clock UI tests.** The first build had an accelerated countdown and stale revealed-card state; tests with a fake clock now catch timers, reveal limits, flip-back, and rapid taps.
5. **Local-first.** The agent created a temporary Cloudflare preview and expected a GitHub PR run during Phase 0, which contradicted the owner's local-first wish. Nothing leaves the machine before Phase 2.
6. **The A/B replay test needs non-owner testers**, so it runs on a private preview in Phase 2, not at the end of Phase 1B.
7. **A Vite dynamic-import error after a route compile error** cleared when the dev server was restarted.

## Plan review, October 15, 2026 (two external AI reviews)

Accepted and fixed in the plan: the `score` signature contradiction (the plan now states requirements and Phase 0 writes `docs/CONTRACT.md`); the integer-only rule versus theme color math (the `core` and `theme` split); the theme function inputs; resume no longer depends on the theme config version (the checkpoint stores the resolved theme); one shadow rule; stale color finding; wireframe scope (Admin is Phase 7); one feedback-kit extraction rule and the missing `puzzle-kit` package; recipe contrast targets are recipe data; RNG locked to SplitMix64 v1; share links carry everything needed to reproduce a round; seed leak through GA4 `page_location`; data-model gaps (`imported_runs`, `mode`, `challenge_date`, guest id, session expiry, seeds as TEXT, partial unique index for daily attempts); Phase 4 store UI, refunds, and a reconciliation CLI; offline-at-start wording; unassigned items (observability endpoints, dark theme); starting defaults for thresholds; engine versioning; stateless session tokens; `<svelte:boundary>` does not catch event-handler errors; the cookie bootstrap for prerendered pages; latency allowance in ranked scoring; Safari `persist()` wording; `nodejs_compat`.

Corrected by verification: the Workers size and startup limits in the plan were stale (now a 64 MiB uncompressed limit on every plan and a 1 second startup).

Not confirmed: one review reported that SvelteKit 3 dropped the local Worker bindings emulation. The current adapter docs still describe `platformProxy`, so Phase 3 starts with a spike instead of a change.

## Plan review, October 16, 2026 (GPT 6 Astra) and the owner's rotation questions

Accepted and fixed: TypeScript 7 side by side (`--tsgo`), Cloudflare bindings through `cloudflare:workers` in SvelteKit 3 (verified in the adapter-cloudflare 8.0.0 release notes), `bun run verify` scope including `svelte-check`, the production build, and the built Worker vector check, plus deliberate-violation self-checks for `.ts` and `.svelte` files; scored-run outcomes, a pure transition operation, and independent test vectors in the contract; ranked lifecycle (retries, guests, expiry, late results) and an honest bot limitation (section 9.2); the enforcement store (verified: the Rate Limiting binding is only a coarse brake); no early ranked seed reveal; ruleset-keyed leaderboards and `rules_version`; theme freshness through seed selection with separate RNG streams and a pinned generator version; resume with pending logical transitions and atomic tab ownership; the analytics event envelope; replay test as a qualitative pilot; payment state machine; split 3A and 3B acceptance; richer Phase 5 and 6 acceptance; and a consolidated acceptance-quality section.

Added after the owner's questions: the puzzle selector and rotation (section 11.14), surface shape families, and the threat model (section 9.3).

## Rotation, responsiveness, and landing page (owner questions, October 16, 2026)

Verified for these decisions: user-agent strings are frozen or reduced (device model and OS version cannot be read), so layout uses viewport size, container queries (Baseline widely available), and capability checks; D1 allows 50,000 databases per account on Workers Paid at 10 GB each (about 5,000 bindable per Worker), and SQLite-backed Durable Objects have no object or total-storage limit on Workers Paid (10 GB each).

## Cross-file audit, October 17, 2026

Fixed: the registry location (the engine holds only the interface); the Home description (a landing page, not a single button) in the first-impression task and the frontend guidelines; the per-type pages text; the repo-layout timing (packages are created when their phase needs them); the AGENTS wording; the evidence table and owner responsibilities in the phase report template; the README gates, replay test row, and file map; the CODEMAP packages; the non-goal wording for skill trees versus mastery levels; and the launch checklist items for key rotation, deletion after restore, and the accessibility pass.

## Plan review, October 18, 2026 (12 points)

Accepted as clarifications of decisions already made. No scope was added and the phase structure is unchanged. Where a fix needed a product choice, the default is written into the plan and listed below for the owner to confirm at the gate shown.

| #   | Point                                  | Result                                                                                                                                                                                                  |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Package boundaries                     | The registry was already in the app (1A), so the review's premise did not hold for the registry. The 1B wording that allowed importing Memory helpers is fixed: copy only, until the Phase 2 extraction |
| 2   | Rotation criteria                      | Fixed. Two families strictly alternate; weights shape position in a cycle, not frequency; tests and the gap rule across refills now match                                                               |
| 3   | Block-placement fairness               | Fixed. Turn, refill, opening-turn guarantee, terminal condition, and scored-run progression are defined (Phase 1 and section 11.15)                                                                     |
| 4   | Fallback bypassing kill switches       | Fixed. No family is served as a fallback; an unavailable state with Home and Retry (section 11.14, EDGE_CASES 16)                                                                                       |
| 5   | Theme freshness versus bounded retries | Fixed. Freshness is best effort and measured; accessibility checks stay mandatory                                                                                                                       |
| 6   | "Next under 100 ms"                    | Fixed. Three measured intervals; playable at a logical deadline, not on an animation event                                                                                                              |
| 7   | HTTPS for Web Locks                    | Fixed. Local HTTPS for phone lock checks, or a recorded waiver                                                                                                                                          |
| 8   | Durable Object export approach         | Fixed. Decided in Phase 3A, with a spike before the enforcement Durable Object                                                                                                                          |
| 9   | Ranked submission races                | Fixed. Ordered submit protocol with the claim in the Durable Object; race and interrupted-write tests required                                                                                          |
| 10  | Analytics phases and denominator       | Fixed. Phase 1 local, Phase 2 GA4 after consent, Phase 3 first-party theme events; the gate and the report share one denominator                                                                        |
| 11  | Cross-device resume                    | Owner decision. Not in v1 (the checkpoint is device-local); logged in IDEAS                                                                                                                             |
| 12  | Templates and verify wording           | Fixed. The report template gains measurements and waivers; AGENTS and the CI description name `svelte-check`, the production build, and the built-Worker vectors                                        |

Proposed defaults awaiting the owner's confirmation:

| Decision                          | Proposed default                                                                                                                                    | Confirm at     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Opening turns for block placement | `opening_turns` = 10                                                                                                                                | Phase 1B gate  |
| Scored-run progression            | Reaching "so close" is a success; an ended run below it leaves the band unchanged                                                                   | Phase 1B gate  |
| Rotation weights                  | Weights shape position within a cycle; featured boosts move a family earlier, not more often. Switch to multiplicity per cycle if frequency matters | Phase 1B gate  |
| Theme freshness target            | Owner sets the violation-rate target after the first 10,000-round simulation                                                                        | Phase 1B gate  |
| Local HTTPS for phone lock checks | Required, or a recorded waiver                                                                                                                      | Phase 1A gate  |
| Cross-device active-round resume  | Not in v1                                                                                                                                           | Phase 3 review |

## Cross-check, October 19, 2026 (line by line, with web verification)

Scope: every file in the handoff was read in full, the numbers in section 11.1a and the prototype were recomputed locally, and platform, package, and browser claims were checked against official docs or the npm registry. Allowed under the plan freeze because these are verified facts, not new scope. The full findings are in the cross-check report that accompanies this handoff.

Corrected in the plan:

- Phase 0: explicit TypeScript pin (`typescript@~6.0.3`; npm's `latest` is 7.0.2); the `svelte-check --tsgo` setup must be tested because its README is inconsistent; `#lib` imports need file extensions; use `$app/state`.
- Section 11.9: anime.js size measured at about 40 KB (full), 15 KB (timeline plus stagger), and 4.7 KB (WAAPI namespace) for 4.5.0 (minified and gzipped). The earlier 24.5 KB figure did not reproduce.
- Section 11.4: server-side render errors use `transformError`; the old "does nothing on the server" wording is removed.
- Section 11.6: GA4 "(other)" row mechanism (underlying table row limit; high cardinality above 500 values a day).
- Section 9.2 and Phase 4: a D1 batch is all-or-nothing but cannot branch on earlier results, so ordering comes from the Durable Object; NOWPayments' nine statuses listed; two signing forms to test against sandbox payloads.
- Section 11.1 and 11.1a: user-agent wording; anti-slop note that the approved demo's glows and shadows are not carried over; Machado at severity 1.0 and the Viénot 1999 difference recorded.
- Section 12.2: 128 MB per-isolate memory limit added; Phase 3A measures peak memory.
- Phase 1A: 360x640 added to the responsive check list.
- Sound: Web Audio only, and win effects hand-written, with no library without owner approval (an applied default the owner can override).

Verified and unchanged: SvelteKit 3 minimums and the `vite.config` plugin; adapter-cloudflare 8.0.0 requirements; Durable Object export constraint; Workers CPU, size, and startup limits; Workers Paid pricing; D1 limits and Time Travel; Durable Objects SQLite on Free; Rate Limiting binding is not an accounting system; GA4 standard-property limits; Analytics Engine's three-month retention; Web Locks requires a secure context; Safari's 7-day storage cap and Home Screen counter; Better Auth SvelteKit guidance; Svelte error-boundary scope; Nunito 5.3.0 and its subsets (no Arabic); iPhone element Fullscreen unsupported; Machado matrices match a published implementation; every color figure in 11.1a.

Corrected in our own earlier review: `version.pollInterval` in SvelteKit 3 defaults to one hour (the official migration guide). The edge-case catalog (section 5) was right; an earlier check against SvelteKit 2 docs suggested otherwise.

Not reproduced: the owner's note that the old Shapes colors "measured 7.7". The current demo teal (#12A594) against the other Shapes colors measures 34.4. The owner should confirm which colors measured 7.7.

Open for the owner: whether Howler and canvas-confetti should come back (removed as an applied default); whether light theme should follow an OS dark setting before the dark theme exists (currently ambiguous: "respect the user's choice, and default to light"); the decisions listed under the 12-point review above.

Registry check (npm, October 19, 2026). Every pin below exists. Latest versions differ by a patch in several cases, which is fine to start with but should be recorded at Phase 0:

| Package                          | Pinned in plan   | npm latest  |
| -------------------------------- | ---------------- | ----------- |
| svelte                           | 5.57.2           | 5.57.2      |
| @sveltejs/kit                    | 3.0.1            | 3.1.0       |
| @sveltejs/adapter-cloudflare     | 8.0.0            | 8.0.1       |
| @sveltejs/vite-plugin-svelte     | 7.3.1            | 7.3.1       |
| vite                             | 8.3.4            | 8.3.4       |
| typescript                       | 6.0.3 (pin `~6`) | 7.0.2       |
| svelte-check                     | 4.7.6            | 4.7.7       |
| wrangler                         | 4.151.0          | 4.151.1     |
| playwright                       | 1.64.1           | 1.64.1      |
| bun                              | 1.4.2            | 1.4.3       |
| @inlang/cli                      | 3.4.3            | 3.4.4       |
| @inlang/paraglide-js             | 2.27.0           | 2.29.0      |
| @fontsource-variable/nunito      | 5.3.0            | 5.3.0       |
| @dimforge/rapier2d-deterministic | (Phase 6)        | 0.21.0      |
| animejs                          | (Phase 1)        | 4.5.0 (MIT) |

## Cloudflare deployment setup, October 22, 2026

Step 4 was accepted and Step 5 (public test) is the current target. Deployment was completed after this setup note; current status is recorded below.

- Host: Cloudflare Workers with static assets, built by `@sveltejs/adapter-cloudflare`. Chosen over Cloudflare Pages because the owner wants Wrangler-driven local deploys with no GitHub repository or CI build minutes.
- Worker name: `morphi-one`; `workers_dev: true`; compatibility date `2026-10-22`; compatibility flag `nodejs_als`; assets binding `ASSETS`; no route in the config; the apex custom domain is attached in the Cloudflare dashboard after the zone became active.
- Pins: `@sveltejs/adapter-cloudflare@8.0.1` and `wrangler@4.151.3` (the plan table lists 8.0.0 and 4.151.0; the installed patch versions are recorded here). `@sveltejs/adapter-auto` was removed.
- Deploy flow: `bunx wrangler login` once, then `bun run deploy` (`bun run build && wrangler deploy`) only after explicit owner permission. `bun run deploy:dry` validates the bundle without uploading. `bun run preview:worker` serves the built Worker locally.
- `workers.dev` is not a separate staging environment: it and a custom domain serve the same Worker deployment unless a separate Worker or environment is created. Keeping `workers_dev` enabled lets the `workers.dev` URL stay available after a custom domain is added.
- Custom domain setup: `morphi.one` is registered at Namecheap. Moving it required adding the zone to Cloudflare, changing nameservers at Namecheap, and reviewing existing DNS records; completed 2026-10-22. Wrangler and the Cloudflare API cannot change registrar nameservers. The apex custom domain is attached in the Cloudflare dashboard, not in `wrangler.jsonc`.
- Cloudflare API MCP (`https://mcp.cloudflare.com/mcp`) can manage account APIs after OAuth, but it cannot change Namecheap nameservers; it is configured globally in OpenCode with minimal permissions, not in this repo.
- Verified locally: production build, `wrangler deploy --dry-run` (340.80 KiB upload, 80.37 KiB gzip), and `wrangler dev` serving `/` with HTTP 200, title `Morphi`, and the Home `<h1>`.
- SvelteKit 3 environment migration: the pre-existing unused ElevenLabs server stub now imports from `$app/env/private`, with `src/env.ts` declaring `ELEVENLABS_API_KEY` as optional (`value ?? ''`). This fixes `svelte-check` without committing or requiring the secret; the key remains only in ignored local env files.
- Public Step 5 deployment: `bun run deploy` created Worker `morphi-one` on 2026-10-22. Live URL: `https://morphi-one.electrasincng.workers.dev`; version `6d71da4d-d24b-4ba0-973e-6e63daff2887`. Verified live at 390x844 and 1280x800: HTTP 200, title `Morphi`, one `<h1>`, description present, Play reaches the Block grid, no horizontal overflow, no console/page errors. No custom-domain route or DNS change was made. Cloudflare API MCP and 19 Cloudflare skills are installed; MCP is connected with minimal permissions.
- Custom domain connected, 2026-10-22: `morphi.one` now uses Cloudflare nameservers `gabriella.ns.cloudflare.com` and `cartman.ns.cloudflare.com`, resolves through Cloudflare, and serves the Worker at `https://morphi.one` (HTTP 200, valid Google Trust Services certificate for `morphi.one` and `*.morphi.one`). The apex is attached; `www.morphi.one` resolves and 301-redirects to the apex, and HTTP 301-redirects to HTTPS. `workers.dev` remains live. Live phone/desktop checks reached the Block grid with no overflow or console errors. The previous `_dmarc` TXT record has not been recreated.

- Observability, 2026-10-22: owner enabled Worker logs, traces, issue detection, 100% head sampling, and persistence in the Cloudflare dashboard. `wrangler.jsonc` mirrors this; Wrangler 4.151.3 uses `observability.issues`, not the dashboard export's `issue_detection`. `wrangler tail` confirmed a live request event. The config is not yet part of a deployed version; it applies on the next deploy.
- Step 5 measurement: owner is manually recording round starts and Next presses on paper and keeping the threshold offline; no analytics code was added. Do not change the deployment until the owner finishes the manual test.

## 2026-10-25 — Accepted v1 app integration and puzzle entrances

The owner accepted the v1 preview and authorized actual local app integration,
including per-game entrances and original action sounds. This supersedes the
previous demo-only stop; deployment, production resources and final public
account eligibility remain separate. Do not ship fixture XP/achievements.

- Reuse the existing game engines/replays, queued saves and Google accounts.
  `/` is prerendered Home; `/play` auto-starts Mix. `/memory` and `/block-puzzle`
  are prerendered ready/Stay doors, absent from player navigation. Home/footer
  exposes Privacy and Terms only. Signed-in chrome refreshes a minimal private
  account-status endpoint after static delivery.
- Anime.js remains **4.5.0**, imported only through the application motion
  wrapper (the isolated demo has its own wrapper). Memory arrivals are 3/4/5 s
  for 6/8/10 pairs, followed by a full 3 s preview and 250 ms hide. Input and
  game time start after hide. Block uses a 3 s opening. Fixed server allowances
  come from replay-derived pair count, preserving authoritative time and
  too-fast rejection. Reduced motion removes travel; it never loses the preview.
- **@elevenlabs/elevenlabs-js 2.74.0** generates 13 static MP3 cues with
  `eleven_text_to_sound_v2` / `mp3_44100_128`; runtime has no ElevenLabs request
  or key. Model prompts/files/hashes are in `static/audio/manifest.json`.
  Generation is an explicit manual command, never part of build or gameplay.
- Local operator access uses existing Google auth plus encrypted TOTP, one-use
  hashed recovery codes, sessions tied to the Google session (30 min absolute,
  10 min idle; 15 min freshness for sensitive actions), per-request database
  roles, bounds/origin checks and audited mutations. Explicit OS/TOTP owner
  enrollment/reset stays local. No public bootstrap or role editor exists.
- Optional coarse gameplay measurement is off by default; DNT/GPC override it.
  A 24-hour random browser cookie is stored only after opt-in; D1 stores a
  salted hash, coarse enums and random event references, never account IDs,
  names, emails, seeds or moves. Cleanup removes rows older than seven days
  on event ingestion/operator maintenance, with no unattended deletion SLA.
- Backdrop dismissal is shared by actual Help/account dialogs and demo dialogs:
  pointer down/up must both be outside, inside drags do not dismiss, pending
  account mutations keep their dialog, focus returns normally.
- The built-Worker smoke test allocates an unused loopback port; an existing
  owner preview occupied its historical fixed port 8795. No owner process was
  stopped. Review demos are removed from release build assets.

References checked: [ElevenLabs sound API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert),
[anime.js playback](https://animejs.com/documentation/animation/animation-methods/),
[D1 atomic batches](https://developers.cloudflare.com/d1/worker-api/d1-database/),
[Worker Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).

Google operator re-authentication uses the documented `select_account` prompt
and requires a newly fresh Morphi.One Google session plus TOTP. It does not
claim to force a Google password prompt: Google documents `none`, `consent`
and `select_account`, not `login`. See the
[Google OIDC reference](https://developers.google.com/identity/openid-connect/reference).
Ranked Memory retains its fixed opening deadline even under reduced motion
(cards settle immediately and stay visible), keeping the server timing allowance
consistent. Solo reduced motion can skip the entrance deadline.

### v1.1 Work 4 scoring versions (2026-10-29)

Score coefficients are nonnegative integers bounded at 10,000; par times stay
fixed. Each operator save creates an immutable, audited version, including a
restore to brief defaults. Ranked issuance records the live version atomically;
legacy sessions and offline rounds use `brief-v1`. Solo rounds obtain the live
version when available and retain brief defaults if configuration cannot be
loaded. Leaderboards display only the current version and its identifier, while
older entries remain stored. Local best scores are keyed by scoring version.
No dependency versions changed.

### v1.1 Work 5 — selector-only entry and static explainers (2026-10-31)

Only the selector may choose a public puzzle family. Legacy family slugs
redirect to Home, `/play` query parameters do not choose a family, and the
sitemap/robots omit game routes. Internal ranked issuance remains server-owned.
The static `/how-it-works`, `/about` and `/faq` pages use reusable content
blocks; the first page animates an abstract four-step deal through the existing
motion wrapper. No CMS, blog, share links or puzzle-specific public pages were
added. The assets-only guest candidate mirrors the page set and uses `_redirects`
for legacy slugs; it was prepared and checked locally, not deployed.

SvelteKit 3 route matching uses `defineParams` from `@sveltejs/kit/params` in
root `src/params.ts`. The matcher keeps the four accepted legacy slugs inline
so the built Worker does not need to resolve an application alias at startup.
No dependency versions changed.

## Local next-phase slice 1 (2026-10-31)

- Account activity is tracked prospectively only; missing historical plays,
  abandonments, last activity and warnings are labelled not recorded. Explicit
  departures are reports, not an estimate of all abandonment.
- Ordinary admin deletion becomes irreversible at its adjustable deadline;
  physical anonymization runs on the next local app request or maintenance, as
  authorized by the owner. Verified privacy deletion remains immediate and final.
- Local audit is append-only with no automatic expiry; yearly exports are paged.
  Undo writes another audit and unban undo creates a new permanent ban with a new
  reason. Retained past audit may include public-name snapshots.
- D1 batch behavior checked against the [Cloudflare D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/): statements are sequential and a failed statement rolls back the batch. No versions changed.

- Next-phase review cadence: the owner directed completing all three local slices
  before one combined review. Slice 1 remains pending review; do not mark any
  slice accepted or close the work until the owner accepts the combined review.
  This does not authorize deployment.

## Owner quick review — next-phase work (2026-10-31)

The owner requested a Users overview with metric cards and dropdown navigation,
a searchable/filterable user directory with an accessible right-side quick view,
and a structured detailed account view. Quick views and directory rows exclude
Google name/email; those remain restricted to the individual admin-only detail.
Audit opens an overview with summary counts and recent entries, leading to the
existing detailed filter/export viewer. Metrics must use retained data honestly.

The owner corrected the ending order: game completion → ending text over the open
board → text clears → Card folds into the played stack → existing results. The
ending must hold at least 500 ms before folding; folding should take 500 ms.
This supersedes the prior post-fold ending interstitial and two-second hold.
The intermittent signed-in 403 behavior must be investigated while retaining
operator permissions, TOTP and session freshness limits.

This quick review does not accept the work. Complete implementation and
verification, then provide one combined review handoff; closure requires owner
acceptance. No deployment is authorized.

- Quick-review timing clarification: normal ending entrance is 420 ms followed
  by at least 500 ms fully settled text, then a 500 ms fold. Reduced motion
  displays instantly for 500 ms and settles the fold immediately. Continue taps
  cannot shorten the minimum hold. Contract continue mode is `auto_500ms`.

- Additional owner quick-review navigation update: replace plain Users dropdown
  with styled section tabs and expandable sidebar submenus for Users and Audit.
  Games opens a statistics overview, with individual game links opening dedicated
  game settings/statistics screens and styled game navigation. Reuse the existing
  operator workspace and distinct query URLs; do not invent new game mechanics,
  scoring fields or par-time settings. Review/acceptance remains pending.

- Owner requested additional individual-user detail styling: status/identity
  header, summary cards, readable grouped tables, stronger accessible tabs and
  responsive action cards. Existing account fields and privacy boundaries stay
  intact. This is visual feedback, not acceptance.

## Combined local acceptance (2026-11-01)

The owner accepted all three next-phase slices and the quick-review changes,
closing local work. They reported all checks passed after review on their own PC
and checked mobile layouts using browser responsive emulation without noting
corrections. Browser/device models were not supplied; physical mobile review was
not reported. This supersedes the pending acceptance directions above. It does
not authorize deployment, production release or further implementation.

## Engine refactor Slice 1 — manifest identity and scoring (2026-11-01)

The owner confirmed Slice 0 and authorized Slice 1 only, on frozen base
`v1.2-local-complete` at `1303c9c4bdb1718bb558886dc43b7b48c597a02a`.
`PuzzleId` is a string; registered manifests define scoring fields, defaults,
and the default scoring version. The engine validates a supplied definition
without importing the catalog or naming puzzle families. Catalog-based access
lives in `src/lib/scoring.ts`; server/admin lists and membership use the catalog.

Each manifest references its own tiny `scoring.ts` data module so puzzle replay
and view defaults share the same values without a manifest/logic import cycle.
All three existing default versions remain `brief-v1`, every coefficient and
per-puzzle engine version is unchanged, and operator edits/rollback still create
immutable audited versions. The engine's legacy default-version constant remains
for existing local-best storage compatibility; generic storage is later work.

Each manifest references a family message bundle. Generated typed aggregation
keeps the existing `t` API, keys and copy while shared `messages.ts` owns only
shell/site/admin copy. Ending validation consumes the bundle directly, so
registry generation does not depend on stale generated output. Eager catalog
and registry exports remain until Slice 2. No dependency versions changed.

The Slice 0 base-tag test remains deferred and outstanding under the owner's
explicit Slice 1 instruction; the actual pre-start HEAD/tag checks both passed.
No Slice 2 or production action is authorized.

## Engine refactor Slice 2 — lazy registry and generic session (2026-11-02)

The owner accepted Slice 1 at `e906e87` and authorized Slice 2 only. The generator
emits a headless manifest catalog with typed message aggregation and an app-only
map of dynamic `View.svelte` imports. Existing round generators are referenced
by their manifests; no generator, replay, scoring, ending or sound logic changed.
The Block manifest also retains the headless piece data and replay helper used
by existing backdrop/vector consumers, replacing their old generated exports.

PlaySession holds one generic round and one generic view. Each puzzle's small
view adapter owns its existing result presentation and callback shape; its
`Game.svelte` stays unchanged. Solo preparation uses the headless generator and
does not fetch an unplayed view. The chosen view loads before ranked issuance,
with an eight-second timeout and navigation cancellation. Failures retain the
pending family and the finished result for retry. Manifest presentation metadata
preserves the existing Connect title timing and seeded selector ordering.

Family names, local bests and played flags derive from the puzzle id. Existing
storage key bytes and scoring-version suffixes are preserved, so local bests do
not need migration. The selector algorithm and weights remain unchanged.

The build records client chunk membership and static/dynamic edges outside the
release assets. Verification rejects a Game view in the shell's static import
closure, including indirect imports, or a selected view containing another
family's Game. No dependency versions changed. Current APIs checked against
[Svelte dynamic component markup](https://svelte.dev/docs/svelte/basic-markup),
[Svelte module scripts](https://svelte.dev/docs/svelte/svelte-files) and
[Vite dynamic imports](https://vite.dev/guide/features).

The Slice 0 base-tag test remains deferred and outstanding. Slice 3 requires
the owner's written confirmation; no deployment or production action is included.

The changed client module graph exposed an existing operator browser-test hydration
race: inputs filled before hydration were reset to server values. The operator
shell now exposes the same `onMount`/`data-ready` signal as AccountShell, and the
audit test waits for it before navigation/input. Filtering, permissions and
operator actions are unchanged; no arbitrary sleep or relaxed assertion was added.

## Engine refactor Slice 3 — catalog server contract and local config (2026-11-02)

Owner-confirmed Slice 2 base: `7a84063`. Only Slice 3 is authorized in this
handoff. The manifest owns exact move fields/canonical mapping, existing replay
and scoring, allowed leaderboard groups, and existing ranked opening/minimum
allowances. The shared wire move type permits numeric family-owned fields.
Server envelope/auth/ownership validation stays shared. No game rules, generation,
validation outcomes, scoring logic, endings or sounds are changed.

D1 family ids are text, including `anonymous_event.family`. Missing lifecycle
rows are initialized from the discovered catalog without reviving disabled or
deleted rows. Additive migration `0011_catalog_config_sessions.sql` retains all
old tables/columns/defaults for one release; its new game/theme/style version
and live-pointer tables have safe defaults in code rather than family seed
lists. Version snapshots reject updates/deletes, matching scoring's existing
immutability guards. The migration rebuilds the measurement table to remove its
old two-family SQL check while preserving rows, other checks and indexes. It
marks older unclaimed legacy tokens abandoned while preserving claimed
retries. The owner-approved reset permission covers local D1 only, including
this schema; no reset is required or performed.

The local-only `CONFIG_CACHE` binding caches validated immutable version rows.
Live pointers, lifecycle states, ranked caps and session ownership remain D1
reads/conditions, so stale KV cannot bypass enforcement or postpone a rollback.
KV failure falls through to D1; unavailable/invalid live config falls back to
code defaults. Historical issued scoring versions fail closed if unavailable.
Theme/style storage and readers prepare Slice 5; no theme publishing or selector
v2 work is included. Dependency pins and compatibility date remain unchanged
(Wrangler 4.151.3, Drizzle 0.45.4, TypeScript ~6.0.3).

One active ranked session per account replaces implicit per-family supersession.
Conditional issuance and exact-id takeover abandonment share a D1 batch; failure
preserves the prior round. Home can explicitly abandon an unclaimed session.
Valid claimed unfinished submissions retain their retry rights and lock until completion
or the existing two-hour TTL. Starts/abandons still obey the existing abuse caps.
A second browser gets a visible conflict and must explicitly take over.
Terminal replay/timing rejections release the exact claim's lock and count toward
the abandon cap without clearing its hash or claim time. Storage failures retain
valid claims; a failed terminal-cleanup write remains retryable.

API behavior checked against Cloudflare's [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
[KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/),
and [KV writes](https://developers.cloudflare.com/kv/api/write-key-value-pairs/),
plus the installed Wrangler binding schema. No remote resource was created.
The Slice 0 base-tag test remains deferred and outstanding. Written owner
confirmation is required before Slice 4; no deployment is authorized.

## Engine refactor Slice 4 — Selector v2 (2026-11-02)

Owner-confirmed base: `4cffb4e` (Slice 3). This work is Slice 4 only; Slice 5
requires written owner confirmation. The Slice 0 base-tag test remains deferred
and outstanding. No dependency versions changed.

A weighted exponential key per eligible family and eight fixed radix passes
replace repeated weighted scans and recursive backtracking. Greedy boundary
swaps inspect at most five positions, preserving one occurrence per completed
cycle and the gap `clamp(floor(eligible / 3), 1, 5)`. One eligible family retains
the existing repetition exception. Discovery uses a 2x weight for families with
no completed-play marker; weights change order, never cycle frequency. The
current D1 game-config weight is read alongside lifecycle availability; zero
weight, manifest enabled flag and viewport/orientation eligibility all exclude
families before selection. Eligibility changes between rounds reconcile the
pending queue; an impossible partial cycle starts a fresh eligible cycle while
retaining recent-family exclusions. An active board is never replaced on resize.

The generated family index contains only selection metadata. Browser presentation,
scoring defaults and messages use generated data projections, leaving the eager
manifest catalog on the server. Each current procedural variant pool is its
unchanged manifest `createRound` generator, imported lazily through the generated
registry; this adds no variants or new variant-selection rules. Next preparation
may load the pending family's pool while its view stays deferred until selected.
Pool loads share the existing bounded/cancelable module-load path.

Selector snapshots store eligible ids, pending queue, recent families and cycle
position in versioned localStorage keys scoped to guest or account on this browser.
Writes occur when state changes, including a new peeked cycle and a successful
round commit; failed generation never consumes a pick. Invalid/incompatible state
starts safely fresh. Existing in-memory storage fallback keeps blocked-storage
sessions playable, but cannot survive a browser reload with storage blocked.
Storage clearing, other browser profiles and simultaneous tabs can bypass/reorder
this local continuity; it is a suspense improvement, not an anti-cheat mechanism.
Ranked enforcement remains server-owned. Mid-round checkpoints and ranked resume
remain assigned to Slice 6.

Reference checks: [weighted random sampling research](https://arxiv.org/abs/1012.0256)
and [MDN localStorage persistence and exceptions](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
The algorithm's linear bound follows from its fixed-width radix passes and
bounded gap, rather than a timing-only inference. Slice 4 runs only the authorized
fast checks and targeted reload test; the next full verification is after Slice 6,
with the final full run after Slice 7. No deployment is authorized.

## Engine refactor Slice 5 — Theme and style administration (2026-11-03)

Owner-confirmed base: `2cbaf49` (Slice 4). Slice 5 only; no Slice 6 work or deployment.

- Publish one coherent `theme_config` snapshot containing recipes, style definitions,
  container/backdrop pools, family profiles and 94 site token values. A family may
  override the `default` profile. Existing Slice 3 style read contracts remain
  available; publishing the combined snapshot prevents palette/style/token drift.
- Migration `0012_theme_admin.sql` adds immutable drafts and a unique theme parent.
  Draft/check/preview do not advance live play. Publishing and rollback atomically
  write an immutable child, advance the D1 pointer and append an audit record.
  Concurrent/stale publication fails rather than overwriting an intervening edit.
  Rollback creates a new version with the selected prior values and records its
  source. Admin access and sensitive writes reuse the existing role/TOTP/freshness
  guards. No new dependencies or package-version changes were introduced.
- Default theme configuration is `theme-2026-11-02-1`; cosmetic generator is
  `oklch-machado-2`. Puzzle engine versions, rules, score logic, canonical hashes,
  endings and sounds are unchanged. Only cosmetic theme vector fixtures changed.
  Ranked runs retain their authoritative issued snapshots. The previous bundled
  solo config identifier remains readable with safe default profiles/tokens so
  queued scores are not rejected solely for that older cosmetic identifier.
- Freshness minimizes weighted penalties over up to eight candidates by default,
  with an early exit at zero. Default weights are recipe 3, hue 2, style 2,
  container 1 and symbols 2. History is isolated by family and configuration;
  configured history is bounded to eight, default three. Repeats remain preferences,
  not generation failures. Ten distinct silhouettes are selected from twelve by
  default. Admin counts are limited to 10–12 because current renderers index ten
  identities; no cut-out variants or ambiguous duplicate accessible names were added.
- Cache contrast solves by recipe, one-degree hue bucket, chroma rounded to 0.01,
  target and ground color. The cache is bounded to 32,768 entries. Runtime readers
  follow invalid snapshot parents, with a 32-version traversal bound, and use a
  bounded CPU-only safety-result cache. D1 remains authoritative for live pointers;
  KV caches immutable version rows only. An invalid cached palette cannot become
  an effective live theme.
- Keep OKLCH gamut reduction, Machado checks and site text contrast as publishing
  gates. Raw CSS, arbitrary token names and unsafe token dimensions are rejected.
  CSS fallbacks preserve first-load/guest rendering; conflicting wrapper overrides
  were removed. Circle/squircle radii and the hexagon clip are recorded in resolved
  snapshots. Structural layout, responsive fitting and input geometry stay in code.
  See `docs/reviews/SLICE5_CSS_AUDIT.md` for the four-file audit.
- Normal solo generation uses a Web Worker; Worker failure surfaces through the
  existing retry/result-preservation flow, without synchronous palette solving.
  The live snapshot is passed into preparation. Generation scatters backdrop
  coordinates independently rather than using evenly spaced columns/diagonals.
  The actual rendered scatter seed includes the configured backdrop kind, so
  editing its pool changes the visible layout as well as metadata.
- Keep 10,000 palette safety samples per family. The best-effort freshness
  diagnostic uses 1,000 rounds per family under the owner's fast-check method;
  no numeric freshness acceptance target was supplied. The earlier longer
  diagnostic was stopped without a result. Full verification remains after
  Slice 6 and after Slice 7. The Slice 0 base-tag test remains deferred and outstanding.

D1 transaction behavior was checked against the current
[Cloudflare D1 batch documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/).
Real local D1 concurrency, fallback and rollback tests corroborate this flow.

## Engine refactor Slice 6 — presentation, recovery and delivery (2026-11-03)

- Continue from owner-confirmed `5811356`; Slice 5 is closed. Slice 6 ends at
  local review and requires written confirmation before Slice 7. The Slice 0
  base-tag test remains deferred and outstanding. No dependencies or pinned
  versions change in this slice.
- Require manifest presentation data for family names, help and scoring labels,
  leaderboard groups, profile icons and permitted backdrop objects. Generate the
  browser projection; keep family logic and views lazy. The already catalog-driven
  game lifecycle service retains its audited SQL behavior, with a novel-family
  regression instead of a redundant rewrite. Moderation, user lifecycle, player
  names and operator permissions remain family-agnostic.
- Persist in-progress rounds separately from the completed-run retry queue in
  local IndexedDB, scoped to the account/guest. Replay accepted moves with each
  family's existing reducers; retain resolved theme/scoring snapshots, active
  time and pending logical delays. Checkpoints expire after 24 hours. Changed
  engine versions require a new round; changed theme config keeps the saved look.
  Web Locks owns a live round and an IndexedDB fence guards writes. Unsupported
  storage/locking has explicit user-visible limits. Recovery stays on this device.
- Read the original active ranked issuance through an authenticated no-store
  endpoint. Visibility loss records account abandonment activity without releasing
  the resumable ranked lock; explicit Abandon releases it. Ranked time continues.
  Recovery never requests a new seed or accepts a client-computed ranked score.
- Home idle-preloads only the eligible peeked first puzzle (or saved round) and
  the play route; it neither consumes a selector draw nor starts a ranked session.
  Save-Data and slow-2G/2G skip speculation. The existing one-candidate Instant Next
  preparation and failure-preserved selector/result remain in use.
- Runtime HTML and personal/ranked/API responses are private/no-store. Preserve
  existing `Vary` fields when adding Cookie. Prerendered public documents contain
  no personal state; the adapter emits year-long immutable caching for hashed
  assets. Unhashed audio/OG media use a one-week public max-age. Copy the adapter's
  actual headers into the guest artifact so both delivery paths agree.
- Retain exactly Home, Privacy, Terms, How it works, About and FAQ in the sitemap.
  Play, admin, auth, APIs and reserved seed-share paths are noindex. No per-family
  public page, game picker, door or share-link feature is introduced.
- Measure five cold and five idle-preloaded samples per desktop/phone-emulation
  profile, serially, against a built local Worker. Report median and p95 for Home
  LCP, CLS, transferred bytes and a clearly labeled Event Timing INP lab proxy.
  Normal approved entrances remain enabled. The owner explicitly selected
  emulation on 2026-11-03; physical mid-range-phone evidence stays outstanding.
  Local goals do not close public-launch performance gates or establish field INP.

Current API/delivery references:
[SvelteKit preloading](https://svelte.dev/docs/kit/$app-navigation),
[Cloudflare static headers](https://developers.cloudflare.com/workers/static-assets/headers/),
[HTTP cache policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control),
[idle callbacks](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback).

Slice 6 measurement closeout (2026-11-04): five cold and five confirmed
idle-preloaded runs on HP EliteDesk 705 G2 MT (AMD PRO A8-8650B, Linux,
Chromium 156.0.8078.4), plus the named Pixel 7a reference emulation on that
host. The phone profile uses Pixel 7 touch/viewport emulation, CPU 4× and
150 ms / 1.6 Mbps down / 0.75 Mbps up; it is not calibrated physical hardware.
The owner explicitly chose “Record emulation; physical phone outstanding.”
LCP, the short-interaction INP lab proxy and CLS met the local goals. Critical
Home transfer p95 was 152,894–153,440 bytes against the decimal 150,000-byte
goal. Play-to-playable p95 was 8.639–11.291 seconds with the approved entrances
and Memory preview included; the 300 ms goal was missed. Preserve these results
and the accepted motion/gameplay instead of redefining playable or hiding the
miss. Mix samples selected different families, so the two states do not establish
a controlled preload speedup. All figures are local diagnostics; field INP,
physical-device validation and production edge compression remain outstanding.
See `docs/evidence/slice6/performance.{json,md}` for raw samples and protocol.

Keep the existing kill-switch defaults explicit: invalid availability fails
closed, unknown families are rejected, valid typed defaults/previous theme
parents are used when configuration is missing or invalid, and missing family
weights default to 1. Local catalog games and ranked mode default enabled;
ranked issuance still requires auth, caps, TTL and authoritative replay. The
public guest artifact has no account backend, and anonymous measurement remains
off until consent. No production flag configuration is authorized here.

Verification logs and successful sample checkpoints are temporary restart
evidence, saved immediately per owner instruction. Retain them through the
entire local Slice 6 milestone; archive final measurements and a compact result
summary, then delete the temporary saves. An interruption resumes unfinished
checks rather than rerunning saved passes. The end-of-slice full milestone is
authorized once; follow-up fixes rerun affected suites unless shared code changes.

Slice 6 milestone closeout: one full `bun run verify` invocation covered all
stages, ending with 189/190 browser passes and a stale measurement-consent fixture
expecting Play instead of Resume. The fixture now explicitly abandons the saved
round and starts a fresh consented one; all assertions stay intact. Only that
Chromium case and the changed test file's formatting/lint were rerun, passing.
Combined browser coverage is 190/190; no app/shared code changed, and no second
full verify was run. The accepted Slice 5 palette artifact was restored after
the palette stage changed timing fields only. Keep final evidence under
`docs/evidence/slice6/`; remove temporary restart saves after final doc checks.

## 2026-11-04 — Final engine refactor Slice 7 contract audit

- Retain SplitMix64 v1, integer-only Block/Memory/Connect, existing engine and
  `brief-v1` scoring versions, canonical replay and immutable D1 score snapshots.
  No language, framework, package or puzzle-rule change.
- Reuse the existing six-runtime vector harness from the Slice 7 acceptance test.
  Gameplay fixtures stay byte-identical to the frozen base; cosmetic fixtures
  retain the explicitly versioned, owner-confirmed Slice 5 baseline `5811356`.
- Shared checkpoints validate bounded nonempty package-owned phase names rather
  than existing-game phase names. Server fallback weight and initial enablement
  come from manifests; existing lifecycle rows remain authoritative.
- Add retrospective annotated-base-tag integrity coverage. The original
  pre-Slice-1 HEAD gate cannot be recreated after the fact and remains outstanding
  for an explicit owner waiver decision at final acceptance.
- Keep owner-local editor MCP configuration outside formatting checks without
  modifying its contents. Detailed audit: `docs/reviews/SLICE7_CONTRACT_AUDIT.md`.
- Written owner confirmation is still required for local refactor acceptance;
  no deployment or post-refactor work is authorized.

## 2026-11-04 — v1.3 Memory variants, local only

- Owner-approved brief from `c7bdb03`; refactor closed. Only classic compatibility, no-preview, trios and moving Memory, shared variant plumbing and existing-games-page admin controls/test play are in scope. Stop for owner confirmation; no commit/push/deploy/release.
- Variant code is a generic string validated against its family manifest. All four Memory weights are 1; avoid the last served variant when another is enabled. Missing Memory variant means classic and preserves legacy serialized payload hashes/decks/replay.
- Preserve classic/no-preview/moving `brief-v1` pair scoring. Trios owns `memory-trios-v1` with fields `trio=1500`, `mismatch=150`, `second=5`. Reuse immutable `score_config`/`score_live`, with scope `memory` shared and `memory:trios` separate; rollbacks append a version and never rewrite saved runs.
- Owner clarification: reconciled Finished requires a registered start; completions with neither account activity nor ranked start are separate imported guest completions. Never infer/backfill starts or change import behavior. A late first-flip report can follow an explicit departure without losing the played classification.
- Variant lifecycle is independent of family lifecycle. Reject new disabled-variant starts atomically at issuance, retain in-progress completion/history, and remove Memory availability when no variant is enabled.
- No-preview has a face-down arrival and zero game-opening allowance; the existing separately issued Card allowance remains. Trios caps at 18 flips/group, keeps its board and Home recovery, and emits no completion at an unfinished cap. Moving continues the same seeded stream and pins revealed/matched positions.
- Test play is inline on the existing protected/noindex admin games page. The component uses generic family metadata; only Memory is allowed in v1.3. No player persistence/statistics APIs are called.
- No dependency upgrades; TypeScript remains `~6.0.3` (installed 6.0.3). Existing D1 batch/conditional-write patterns retained; current Cloudflare D1 batch and local Wrangler migration documentation checked. See `docs/work/V1.3_WORK.md` for evidence and local scoring-test version effects.


## 2026-11-06 — v1.3.4 Slice 0 Games admin/query boundaries

- The owner authorized completing the Games admin/query review gaps locally and
  explicitly excluded Mahjong from this plan; game work belongs to later plans.
- Activity statistics pass the complete catalog mapping as one JSON string to
  D1 `json_each(?)`. JSON keys remain camelCase; CTE columns remain snake_case.
  This removes the activity mapping's bind-count ceiling, not all D1 resource
  limits or limits in other queries. No chunking or schema migration is needed.
- Keep registered-start and imported-completion cohorts unchanged, preserve
  legacy default variants and deduplicate ranked activity starts. A 40-group
  exact-count fixture pins the one-bind behavior.
- Use one responsive row per variant, a read-only inspection dialog, and the
  existing audited per-variant forms. Scoring remains in the Scoring subview;
  test play stays on the main page. No bulk actions or matrix controls.
- Reuse message keys, approved site colors and gesture-aware backdrop dismissal.
  Explicit Tab/Shift+Tab wrapping follows the existing game dialog pattern;
  browser coverage includes the Scoring link and focus restoration.
- No dependency/version change. Full verification remains deferred under the
  owner's earlier direction; scoped checks do not constitute a full pass.
