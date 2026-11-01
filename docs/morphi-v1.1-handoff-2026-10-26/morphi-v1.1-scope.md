# Morphi.One — v1.1 scope

Owner scope, 2026-10-26. v1 is built but **not deployed** — the owner is
holding deployment and moving to v1.1. This list is the current scope;
the owner will add more later. Nothing here is a deployment authorization.

## The five works

1. Procedural system
2. UI and UX fixing
3. A new game, with sound from the ElevenLabs SDK (already installed)
4. Game score customization from the admin panel
5. Withdrawal of the Google-doors game catalogue (added 2026-10-26)

Suggested order: **2 → 1 → 3 → 4**, with **5 done alongside 2** (it is
a removal, and it shrinks the screen list the UI/UX pass must cover).
The UI/UX pass fixes the shell and board sizing the other works
inherit; the procedural system gives the new game its themes; score
customization comes last so the new game's scoring is covered by it
too.

---

## 1. Procedural system

The deferred long-plan §11.2 system, now in scope (it supersedes the
v1 decision to ship curated themes only — the 4 curated presets stay as
verified anchors and fallbacks).

**In scope**
- Recipe-based palette generator: seed picks a recipe + continuous base
  hue, colours worked in OKLCH, verified against the §11.1a thresholds
  (contrast + colour-blind separation, with safety margin). Failed
  palettes re-roll deterministically (max 8), then fall back to a preset.
- Generated axes beyond colour: symbol sets from shape families,
  container shape families (shape, proportion, gap, border), style
  families, and quiet backdrop decoration (flat, behind the board,
  contrast ≤ ~1.3:1, margins/corners only). At the §11.2 Phase-1
  targets: ≥6 palette recipes + free-sampling mode, ≥6 symbol shape
  families, ≥4 style records, ≥5 backdrop generators.
- Freshness: selector draws up to 8 candidate seeds; first theme that
  satisfies the freshness rules vs the last 3 rounds wins (no repeat of
  recipe, hue within ~60°, style, container shape, or symbol families).
  Best effort, measured and reported — accessibility is the hard gate.
- Separate RNG streams for theme and puzzle logic, so theme draws can
  never change a board. Same seed + same theme = same validation and
  score, always.
- Versioning: `theme_generator_version` + immutable
  `theme_config_version` recorded per round; recipes/styles are data,
  not code.

**Evidence required**
- Property test: 10,000 seeds, every theme passes the thresholds;
  fallback rate reported per 30° hue bucket, no bucket over ~5%.
- A theme contact sheet (~60 generated themes) for the owner's eye —
  his review is the taste gate; automated passes alone are not acceptance.
- Freshness violation rates from a 10,000-round simulation, reported
  per puzzle.

**Never varied:** solvability, difficulty, fairness, readability,
accessibility. Never raw random RGB, never gradients.

## 2. UI and UX fixing

A full better-looking pass over the integrated v1 screens — Home,
Memory and Block in play, results, profile — at phone portrait, phone
landscape, and desktop. This is a visual acceptance pass, not a bug-fix
list. (Door-page screens leave this list: Work 5 removes the doors.)

**Known starting points (from the owner's desktop Memory screenshot,
1920×923)**
- Board panel ~644px wide on a 1920px screen (~17% of viewport area);
  boards must size from the available viewport on large screens, not
  from a fixed narrow column. The card grid inside the padding is
  smaller still (~440px).
- Dead vertical space: large gaps between header, title, and board.
- Help buttons float disconnected from title and board.
- Play area definition is washed out: pale panel on a pale page.

**Rules for the pass**
- Locked design rules still apply: only Play / the board attracts
  attention, everything else quiet; flat fills, Morphi tokens, hybrid
  columns (quiet before play, dialogs during, results at end).
- Phone layouts already accepted stay the reference for phone; the
  failure is mainly expanded/desktop sizing and overall polish.

### Game-screen shell (owner-decided and ACCEPTED 2026-10-26 — the set is complete)

Reference renders (all in `~/workspace/your_files/morphi-game-ui-redesign/`):
Memory desktop `memory-game-ui-redesign-v6-shell.png`, Block desktop
`block-game-ui-shell.png`, Memory phone `memory-game-ui-shell-phone.png`;
generator prototype `theme_generator.py` in the same folder.

**Global — identical for every game, any board size:**
1. The **puzzle name sits in the page header row** (wordmark left,
   account/sound right; on phone, account collapses to a person icon).
   It appears when the puzzle arrives and never previews the next one.
   **Phone exception (owner, 2026-10-26):** on phone the name leaves
   the header row and sits on its own line directly **below** it (the
   header row then holds wordmark + account/sound only). On every
   other device the name stays in the header row. The accepted phone
   render predates this exception and is superseded on this point.
2. A **bottom panel** holds **How to play** and **Scoring & tips**
   (plus Your high score for the family — a game with no completed
   rounds yet shows **0 with a small NEW tag**; owner decision
   2026-10-26). It spans the **full width**
   of the screen and is **flush with the bottom edge**. For wide or
   full-screen boards it is a transparent overlay. On wide boards it
   is NOT a layer inside the board.

**Everything else is per-puzzle:** the board, its box, the inside
layout, the HUD stats (Block: Score / Lines / Streak; Memory: Score /
Time / Pairs / Mismatches — shortened to "MISM." on phone), and the
theme, all generated from the deal's seed by Work 1's system.

**Gap rule:** the puzzle box touches nothing — a clear gap between
the box and the header above it and between the box and the bottom
panel below it, on every screen size.

**Background rule:** every generated puzzle's background is scattered
items **of that puzzle only** (Memory → cards, Block → block pieces),
seeded random positions, blended at **80% transparency (20%
opacity)**, kept out of the header and bottom bands. No mixing with
other games' items or generic shapes (that mix is homepage-only).

**Evidence required**
- Captures at 390×844, 844×390, 1280×800, and 1920×1080 for every
  in-play screen.
- New acceptance check, added because v1's suite missed this: it
  checked centre + no-overflow only. In-play captures must now also
  pass a **space-use check** — on desktop sizes the board panel fills
  at least ~70% of the viewport height (or the documented limiting
  dimension for its aspect), and the owner visually accepts the set.
  Automated passes are not visual acceptance.

## 3. A new game, with ElevenLabs sound

**CONFIRMED by the owner 2026-10-26: the new game is Connect
(Flow)** — the decided third family. Its brief and playable
prototype already exist and are verified
(`CONNECT_BRIEF.md`: bands 5×5/5 pairs, 6×6/6, 7×7/8; scoring
+200/pair, +1,000 grid, +10/sec under par, −50 redraw; generation
verified on 1,200 seeded boards, 0 failures).

**Design (owner-directed 2026-10-26, delivered for review)** — Connect
designed in the accepted Work 2 shell, in
`~/workspace/your_files/morphi-game-ui-redesign/`: desktop
(`connect-game-ui-shell.png`) and phone
(`connect-game-ui-shell-phone.png`) renders wearing its own
generated theme (seed 314159: triadic, hue 304.3, pale lilac; dots
carry colour AND symbol per the brief), HUD Score / Pairs / Filled,
and Connect's own background item (a dot pair joined by a bent path,
20% opacity). **Animation is designed in Anime.js**: two demos in the same
folder. `connect-board-appear.html` — **how the board appears**
(the owner's specific meaning of "animation"), **exactly 2.5s
total** (owner decision 2026-10-26, superseding the earlier 2.0s):
on the first arrival the shell settles fast; the **puzzle name gets
its own arrival beat** (rises, settles, fades in, in step with the
board landing); grid cells ripple in from the centre, then dots pop
in **pair by pair** (both dots of a pair together, each pop sending
out a ring in the pair's colour that expands and dissolves); the
background scatter fades in as part of the appearance, never
pre-visible; reduced-motion = one plain fade. **On every later deal
the shell stays static** — wordmark, account, box and bottom panel
do not re-animate; only the new puzzle's own things move (name
arrival, scatter re-fade, board re-deal). `connect-animated.html` — the
interaction motion: path draws itself, pair dots pulse on
completion, HUD counters tween with the draw, a second path starts
and stops mid-route, scatter drifts. Both loop; in production the
same Anime.js timelines drive the real interactions (drag-draw,
cut, completion, win). `connect-working-animation.html` — **the
working animation** (owner-directed next step, 2026-10-26;
animation only, no logic): a scripted play sequence deciding the
working beats — **draw** (path grows cell by cell under the
finger, claimed cells tint in step, ~150ms/segment), **connect**
(pair locks: dots pulse, +200 floats, Score/Pairs/Filled tween),
**cut** (crossing another path pops everything past the crossing
away cell by cell; the cut pair's far dot dims and Pairs flips
back), **backtrack** (dragging back retracts one segment at a
time, ~210ms), **grid-complete sweep** (a light bar crosses the
board, dots answer in reading order; fires only on a full grid
with all pairs connected), plus the shared **float system** for
score deltas (+200 connect; −50 redraw penalty in red, same
motion — specified here, not separately demoed). **The working
animation is ACCEPTED by the owner (2026-10-26) and locked.** (Demo
note for Codex: anime.js 3.2.1 `timeline.add()` does not create
string labels on the fly — label-positioned children silently never
run. The demos were rewritten with absolute millisecond positions;
use absolute positions, or `addLabel()` first, in production
timelines too.)

**In scope**
- Full integration on the Connect brief: engine package behind the
  registry, seeded generation, selector entry via the Mix weighted bag
  **only** (no `/connect` door — withdrawn by Work 5, below; the brief's
  door-page copy is kept on file but not built as a page), HUD Score /
  Pairs / Filled, ranked server replay of path strokes, per-family
  "Your high score".
- Sound through the already-installed ElevenLabs SDK (2.74.0, as used
  for v1's 13 cues): generate this game's cue set at build time and
  ship it as static assets, like v1 — **no runtime API calls, no API
  key in the client, no per-play cost**. Cues paired to the game's
  animation list (per §11.9), e.g. path start, extend, pair connected,
  path cut, redraw penalty, grid complete / win, invalid move.
  Provenance + hashes recorded in the audio manifest, as v1 did.
- The new game uses the procedural themes from Work 1 and the fixed
  shell sizing from Work 2 — it is not built on the v1 look.

**Evidence required**
- The brief's engine tests + known vectors in all six runtimes;
  generation property run (no unsolvable boards).
- Browser suite: door → play → result → Next (Mix and Stay), sound
  cues play, mute respected, reduced-motion respected.

## 4. Game score customization from the admin panel

The operator can change per-game scoring values from the existing
admin panel (Stage 1 operator screens; panel design stays as-is —
this adds a function, not a restyle).

**In scope**
- Editable per family: every scoring value in that family's brief —
  e.g. Connect +200/pair, +1,000 grid, +10/sec under par, −50 redraw;
  the equivalent Memory and Block values. Difficulty-band par times
  are in scope only if the owner says so; default: out.
- Values are config data, schema-validated with safe ranges per field
  (no negatives where the brief forbids them, score floor rules kept).

**Non-negotiable mechanics**
- **Versioned:** every save creates a new immutable
  `score_config_version`. A round is scored — client display and
  server replay alike — with the version that was live when the round
  started. Edits never re-score a round in progress or a past round.
- **Server is authoritative:** replay computes the score from the
  recorded version; the client never submits a score (existing rule).
- **Audited:** every change writes an audit record (who, when, field,
  old → new), and saving requires the panel's existing re-auth /
  TOTP step for sensitive actions.
- **Leaderboard honesty:** rounds and board entries carry their
  `score_config_version`, so scores set under different values are
  never silently mixed — at minimum the version is displayed in admin
  and stored with every ranked entry.
- Revert-to-brief-defaults in one action, itself audited and versioned.

**Evidence required**
- Integration tests: edit a value → new rounds use it, in-flight and
  past rounds unchanged, replay of an old round with its recorded
  version reproduces its original score exactly.
- Audit trail shown for a change; invalid values rejected with the
  panel unchanged.

## 5. Withdrawal of the Google-doors game catalogue

Owner decision, 2026-10-26. The previously agreed model — per-type
playable pages (`/memory`, `/block-puzzle`, `/connect`) kept out of
site navigation but indexable, listed in the sitemap, and reachable
from Google — is **withdrawn entirely**.

**Why (the owner's edge case):** anyone can search
`site:morphi.one intitle:"puzzle-game"` and enumerate every indexed
game page, collect the URLs, and — because guest play is unrestricted
— play each game on demand. An indexed playable page cannot be hidden.
Most players would never do this; someone eventually will, out of
curiosity, and at 100+ families the whole catalogue is exposed and
the suspense is gone.

**The model he's following:** Arena (LMArena / arena.ai). A user
submits a task and is assigned a random model — Chinese or frontier —
without knowing or choosing; the task still gets done. Arena's core
mode is blind random assignment, and its public, indexable surfaces
are its blog and leaderboards, not a pick-a-model catalogue.

**In scope**
- The per-family playable routes do not exist in v1.1. A request for
  `/memory`, `/block-puzzle`, `/connect` (or any family slug) must not
  start that family — redirect to Home. Removing them from the sitemap
  or adding `noindex` is **not** sufficient: an existing route can be
  guessed and shared even if Google never lists it.
- `/play` accepts no family choice: no `?game=` parameter, no slug,
  no setting reaches a chosen family. The only way into any game is
  the selector's random deal.
- Sitemap lists only non-game pages: Home, Privacy, Terms, and the
  static explainer pages under (B). v1's public site has only Home +
  Privacy live and v1 was never deployed, so no door URLs are live or
  indexed yet — removing them now costs nothing, which is exactly why
  this is decided before deployment, not after.
- Stay mode survives, if at all, only as an internal capability (e.g.
  a ranked board fixing its family server-side). It is never exposed
  as a public URL a guest can open.
- Existing door designs, briefs and copy are kept on file as reference
  (how-to / scoring / tips text can be reused by in-game help and by
  the static explainer pages) — they are not built as pages.

**Flagged consequence for a later owner call:** share links. The long
plan's share links carry the puzzle type and open that family solo —
under this stricter model they are also a way to reach a chosen game,
just a narrower one. Not decided here; noted so it isn't built by
accident.

**(B) Replacement traffic in v1.1 — static explainer pages only**
The owner accepts losing per-game search traffic. What replaces it
**in v1.1 is only this:**

- **Static explainer pages:** How it works / About and FAQ —
  indexable pages about the deal itself ("a random puzzle, dealt
  fresh every round"), built like the existing static pages (Terms /
  Privacy pattern). They may describe how playing works in general;
  they are not per-game pages, they carry no playable game, and every
  play link on them goes to Home / Play, where the selector deals.
  **Owner refinement (2026-10-26): the How it works page is
  INTERACTIVE** — an animated infographic (Anime.js) that plays the
  four steps of the deal (press Play → a puzzle is dealt → play and
  score → Next deals a different one, never the same kind twice in a
  row), with clickable step cards and auto-play; its boards stay
  abstract and name no puzzle. About and FAQ stay static, with copy
  Muse fills in (easily edited later). Design demos delivered
  2026-10-26 in `~/workspace/your_files/morphi-static-pages/` and
  **accepted by the owner as reference only** — Codex integrates
  them as he sees fit, taking the reference from the demos rather
  than shipping their copy/code as-is.
  **Built to become admin-editable later (owner note, 2026-10-26):**
  each page is assembled from a small set of reusable content blocks
  (heading, paragraph, steps, FAQ question/answer pairs), so in the
  Stage 5 CMS phase the same blocks' text can be edited from the
  admin panel with no redesign. In v1.1 the text ships static; no
  CMS is built in v1.1.

**Explicitly NOT in v1.1:** a blog. In the long plan the blog belongs
to the content-management stage (§11.10 Stage 5: CMS for static pages
and the blog) — a later phase, not this one. No blog, no CMS, and no
other traffic surface is added to v1.1 beyond the static explainers
above; if a blog comes later, it is scoped in its own phase.

Guardrail: the explainer pages must not add up to a per-game
catalogue either — no page per game, no list that pairs each game
with a way to reach it.

**Evidence required**
- Route tests: every known family slug and play-parameter variant
  fails to start that family (redirect / Mix deal only).
- Sitemap and robots output contain no game routes; a `site:`-style
  crawl of the built site finds no per-game playable URL.

---

## Out of scope (unchanged from v1 unless the owner adds them)

Deployment of any kind; production provisioning/secrets; new families
beyond Work 3; a blog or CMS (long-plan §11.10 Stage 5, a later phase);
multiplayer, payments, translations, dark theme, achievements/XP,
daily challenge (parked list). D5 jurisdictions and
the production gates from the v1 report stay open and are not waived
by this scope.

## Owner gates

- Visual acceptance of the UI/UX pass and of the procedural theme
  contact sheet — the owner's eye, not the test suite.
- Confirmation that the new game is Connect, or a different name.
- Each deployment still needs its own explicit authorization.

---

## Added owner decision (2026-10-26) — presentation: The Card

After an eight-concept exploration, the owner chose **The Card** as
Morphi.One's presentation direction, replacing the plain board
arrival: every puzzle is dealt as a face-down card; the flip reveals
the name (which then sits in the header per the shell rules); the
card unfolds into the board; a finished puzzle folds back into a
small card and files onto a visible played stack; the next
face-down card waits. The locked shell is unchanged (two globals,
gap rule, own-items scatter at 80% transparency, per-game themes
and HUD). Full decision note:
`morphi-game-ui-redesign/THE-CARD-decision.md`; reference demo:
`morphi-game-ui-redesign/connect-concept-card.html`. Still open:
phone treatment incl. where the played stack lives, Card-treatment
proofs for Memory and Block, final arrival timings.

**Owner idea (2026-10-26) — admin-side game test routes; IDEA ONLY,
not decided, not scope.** With public per-game URLs removed, the
operator still needs a way to test one specific game without playing
the random deal until it appears. The owner's idea: keep per-game
URLs on the ADMIN side only — `morphi.one/admin/games/<game-name>` —
behind the admin login, noindex, like the rest of the admin area:
the admin can open and test any game directly, and the route is not
publicly accessible, so it does not rebuild the catalogue (nothing
for a guest to reach, guess-and-share, or for Google to list).
Notes from Muse for when this is decided: (1) unauthenticated hits
should get the same response as any other admin path — the route
must never be linked from a public page, listed in the sitemap, or
reachable via the play selector's parameters; (2) rounds played
there are test runs — they must not write ranked scores, public
leaderboards, or player-facing high scores; (3) this pairs naturally
with Work 4 (per-game score customisation): the admin edits a game's
values, then opens that game's admin route to feel them.
