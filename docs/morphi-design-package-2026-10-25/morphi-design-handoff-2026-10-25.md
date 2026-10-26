# Morphi.One — Design decisions handoff (2026-10-25)

Prepared by Muse from the owner's design-review session. Every item below is
**owner-accepted** unless marked otherwise. This package merges with the
owner's own collected notes file when he sends it; together they go to Codex.

## 1. Locked wording and brand

- Score terminology is **"Your high score"** (per puzzle family), never "Best".
  Sweep needed on Codex's user pages: leaderboard ("Best verified score per
  player"), account ("Personal bests"), sign-in ("Keep your best") and the
  profile page, which still says "best" throughout.
- The brand/wordmark is **"Morphi.One"**, never "Morphi" alone. Sweep needed
  on Codex's user-page headers.
- "Contact Ali Gohar" does not appear in footers.

## 2. Homepage (accepted)

- Centred layout, **one screen, no scrolling**, desktop and mobile.
  Headline: "Give Your Brain Something to Play With." Big coral Play circle,
  puzzle tiles orbiting its ring (live: one orbit ~30–40s, gentle pulse,
  respect reduced-motion), "?" mystery tiles under Play.
- **Scatter (accepted final form):** decorative items scattered at random
  positions, re-dealt on every visit, mixing geometry (triangle, circle,
  ring, hexagon, star, diamond) with puzzle items (Block polyomino pieces,
  Memory card, Mahjong tile, jigsaw piece). Items are **blended faint into
  the background** — texture only. Play is the only attention-grabbing
  element. Bounded system: safe zones (never over headline, Play ring,
  "?" row, chips, footer), minimum spacing, drawn before first paint in a
  decorative layer (aria-hidden, no text, no links) so there is no layout
  shift. SEO-safe: Google indexes words/structure, not decoration.
- Info chips carry soft matching tints (pale blue "Free to play", pale teal
  "No signup needed", pale amber "A fresh deal every round"), ink text.
- Footer is **Privacy · Terms only** (see §4).
- Mobile: same design, headline wraps to three lines, chips stack.
- Assets: `morphi-homepage-design/` (desktop PNG + animated GIF,
  `scatter-visit-1/2/3.png`, `morphi-homepage-mobile.png`).

## 3. Transitions (both accepted)

- **Homepage → puzzle:** Play press, homepage fades, orbiting tiles sweep in,
  the dealt board arrives focused.
- **Door page (hybrid):** board's Play morphs the page — columns fade/slide
  outward, board glides to centre and scales up, help buttons fade in last;
  the help modal grows out of the "How to play" button and folds back into
  it; round end reverses (results first).
- Spec: anime.js via the motion wrapper only, ~350ms ease-out, animation
  never drives game logic. Reduced motion: no travel/scale, instant swap or
  ≤150ms fade.
- Assets: `morphi-transition-demos/transition-home-to-puzzle.gif`,
  `transition-door-hybrid.gif`.

## 4. Doors model and navigation (locked)

- Per-type pages (/memory, /block-puzzle) are **Google-only doors** in Stay
  mode: indexable, in the sitemap. They are never an in-product catalogue:
  no puzzle menu/picker in the game UI, menus, result screens, or v1
  settings.
- **Puzzle door links are removed from Morphi's own navigation** (homepage
  footer included). Door pages are reached only from Google search, the
  sitemap, or a direct link. The sitemap therefore carries the discovery
  burden: keep it submitted and current in Search Console.
- **Suspense rule:** the next puzzle's name is never revealed until the
  player clicks Next and the puzzle arrives. Next never names or previews
  what is coming.
- **No double start:** homepage Play is the start (one click → /play, Mix
  mode, round begins on arrival; never via a door page). A door page's board
  sits in a ready state with a single Play on the board.
- Door page template: game name is the heading; SEO phrase in the eyebrow
  and title tag. **No "Surprise me" button** — the quiet "Or let Morphi deal
  you a surprise" link is the only surprise entry point (it exits Stay mode
  into Mix; it is not an in-round skip).

## 5. Door pages — hybrid layout (decided; supersedes §11.16 dimming)

- **HYBRID:** quiet columns before play → during the round the columns step
  aside, the board owns the centre, help lives behind "How to play" /
  "Scoring & tips" buttons (modal/drawer) → results at the end.
- Styling is **minimal**: light typographic structure only — small tracked
  headings, plain coral step numbers, hairline-separated scoring rows with
  values in ink, one plain underlined surprise link. No card boxes, no
  pills. (Not Codex's plain text walls, not loud cards.)
- §11.16's dim-during-play columns are superseded by this decision;
  **DECISIONS.md needs this amendment.**
- The shell (slots, headings, hybrid behaviour, tokens) is designed once;
  each puzzle's brief fills the slots with its own how-to, scoring, tips
  and in-round game state (Block's brief declares no in-round side panel;
  its state is Score/Lines/Streak in the HUD).
- Mobile: no columns — guide stacks below the board before play; during the
  round it is board + HUD + help buttons only.
- Assets: `morphi-hybrid-design/` (`hybrid-block-before/during.png`,
  `hybrid-memory-before/during.png`, `hybrid-memory-mobile-before/during.png`).

## 6. Profile (accepted)

- Foundation v2: identity band (preset-tile avatar, player name, cosmetic
  Level/XP per long plan Phase 3A), tabs Overview / My games / Achievements
  / Activity + Settings, aggregate stats strip, **"My games" as a
  one-row-per-game list** (high score, rounds, last played, difficulty band —
  scales to hundreds of games; per-game detail one click down), aggregated
  Recent activity, fixed right-rail slots for Progression (per-family
  mastery), Achievements showcase and Account — slots exist now and fill in
  as those features land.
- Table labels (HIGH SCORE / ROUNDS / LAST PLAYED etc.) use the darker
  slate (#68798E), per the owner's fix.
- Asset: `morphi-profile-design/morphi-profile-foundation-design.png`.

## 7. Result screen (accepted — owner: "with no heart")

- "Your score" big, "Your high score" per family under it, round stats
  (pairs/mismatches/time for Memory), coral **Next puzzle** (never named),
  quiet line "Morphi deals the next one — you won't know what's coming."
- Guest section: hairline-topped block, "Keep your high scores", sign-in
  copy, device-only note inside the section text (not under the button),
  and a **Morphi-themed sign-in button**: flat ink pill, white text, white
  chip with ink "G" — not Google's white/blue pill.
- No demo/simulated-data footer ships.
- Mobile order: score and Next first, stats after, sign-in section last.
- Assets: `morphi-result-design/morphi-result-desktop.png`,
  `morphi-result-mobile.png`.
- Note: this is the one accepted design the owner does not love; the
  sign-in section is the first candidate for a future revisit. Do not
  redesign it unprompted.

## 8. Design tokens (as used in all accepted designs)

Ink #1B2433 · Coral #E5532D · Blue #2F6FED · Teal #009A86 · Amber #F5A524 ·
Violet #7D61AE · Background #EEF2F7 · Board #DFE9F5 · Slate text #5A6B82 ·
Faint labels #68798E · Hairlines #C9D6E4. Flat fills, no shadows.
