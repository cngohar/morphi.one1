# Puzzle design brief: <name> (`<id>`)

Copy this file to `docs/puzzles/<id>.md` before building a puzzle. The owner approves it first (plan section 11.16). Keep it short and concrete.

## Core loop

- Verb (what the player does):
- Goal:
- Win, fail, and end states (solve, scored run, or realtime; plan section 6):
- Fun within the first 30 seconds because:

## Controls

- Touch:
- Mouse:
- Keyboard:

## Difficulty and scoring

- Bands (easy to hard) and what changes in each:
- Progression and fairness guarantees (solvable by construction or by a solver):
- Score formula, "so close" threshold, and the minimum human time:
- Move cap and abandonment rules:

## Variants and rule differences (standing owner rule, 2026-11-06)

- For each proposed variant: baseline, concrete gameplay rule/rule-setting
  difference, supported combinations and any invalid combinations.
- A variant must change gameplay: matching, legal moves, available information,
  movement, limits or win conditions, for example. Board size/layout qualifies
  only when it changes gameplay rules or rule settings.
- Colors, artwork, themes, animation, purely visual layouts and new seeds/deals
  are not variants. Do not give duplicate gameplay rules separate variant
  identities or inflate the catalogue with cosmetic/instance changes.
- Apply this definition to every new family and subsequent update. Preserve
  accepted identities and replay compatibility unless separately authorized.

## Layout and style

- Layout profiles (compact, medium, expanded) and the stage mode for each (`centered`, `wide`, `full`):
- Side panel content (left and right slots):
- Renderer (`dom`, `svg`, `canvas2d`, `pixi`) and why:
- Style profile: shape families and proportions, topology, depth cues, motion style, sound palette, backdrop kinds:
- Themeable surfaces:

## Puzzle-specific backdrop (standing owner rule, 2026-10-27)

- Declare this puzzle's allowed objects and the code/data that owns their shapes:
- Declare the generated positions, rotations and arrangements:
- In play, render only this puzzle's objects at 20% opacity, behind the board
  and outside the header/bottom bands. Block uses block pieces; Memory uses
  cards. No objects from another game and no generic decorative shapes.
- Compact/mobile layouts hide puzzle backdrop objects in portrait and landscape.
  Wider layouts show a seeded random 1–5 objects per side, distributed in two
  dimensions across the exposed background space. No fixed columns or evenly
  spaced rows.
  Keep the approved background blend; use layout queries, never device sniffing.
- Every generated round has its own seeded scatter. Missing/legacy backdrop
  data uses a deterministic arrangement of the same puzzle's allowed objects;
  never substitute another game's motifs or a blank backdrop.
- Reveal the scatter with the puzzle's arrival, after the Card reveals its
  identity. Reduced motion shows static objects only where the layout permits them.
- Evidence: test allowed-object isolation and deterministic variation; capture
  hidden objects at portrait/landscape phone sizes and bounded visible side
  scatter on desktop. Check rotation across the visibility breakpoint.
- Mixed-game objects belong on Home only. The presentation card and played
  stack are session chrome, not background decoration.

## Feedback and feel

- Animations (trigger, duration token, reduced-motion alternative, paired sound):
- Arrival and exit animation:
- Replay hook (personal best, "so close", next puzzle):

## Ending contract (required)

- Exact engine condition for every ending and any distinct headline (including
  limits and failure states):
- Manifest `ending.kind`: `completion` or `run_over`.
- Catalog keys for the default headline and any distinct conditional headline.
- Catalog subline key and its required `values`, each derived from genuine
  game outputs; document where each value comes from.
- Manifest animation type (`fade-rise`) and continue rule (`auto_2s_tap`).
- Add the complete `ending` declaration to the manifest. Registry generation
  rejects missing fields, unknown catalog keys and mismatched placeholders.
  The presentation must not decide when the game has ended or delay persistence.

## Teaching

- Tutorial depth (`hint`, `coach`, `guided`) and the steps:

## Risks

- Edge cases to add to `docs/EDGE_CASES.md`:
- Performance risks:
- IP check (names, art, sounds, mechanics; plan section 11.12):

## Approval

- Owner approval date:
- Game-feel review notes:

## Entrance and timing contract

Describe the per-object entrance, size-to-duration mapping, ready/input lock,
visible-time pauses, reduced motion and cleanup. Use the shared anime.js
`src/lib/ui/motion.ts` wrapper for presentation only; an active-time phase
deadline owns readiness, never an animation completion callback. Arrival must
finish before a free preview begins, and hiding must finish before scoring
time/input starts. Rank timing allowances must be fixed by the server from
server-owned round metadata, never submitted by the client. Cosmetic travel
uses external crypto entropy and never changes the seed, rules or score.
Test early input, hidden mount, hide/resume, resize/rotation, navigation cleanup,
reduced-motion changes and a missing sound asset.

The Card opens one continuous outer frame; do not replace a miniature board
with a second board during expansion. Once open, retain this puzzle's own
entrance, preview and hide sequence. Finished layers must leave the central
result visible after fold-away, with score, Your high score, statistics and
Next, while the played stack remains visible.

Actual registry game views accept `entranceReady` (default `true` for isolated
routes). The shared stage opens that gate after unfolding. Start the game's own
entrance once, then notify optional `onready` when its logical phase becomes
playable. This notification updates shell presentation only. Keep the engine,
input readiness and scoring clock independent of animation callbacks; do not
restart the entrance on resize or a repeated gate update.

Prepare the next solo candidate during the current entrance animation, without
consuming the selector draw, revealing its name, or reserving a ranked session.
If it is not ready on Next, show a neutral face-down loading card; readiness
comes from completed preparation, never the animation callback. Bound failures,
retain the pending family and finished result, and provide retry/Home. Cancel
on navigation, ignore late completions, and test slow/failed Worker, storage,
network, duplicate Next and reduced/failed motion. Ranked issuance happens only
when requested and always uses the server's seed/theme.

Current Memory mapping (owner, 2026-10-25): 6/8/10 pairs = 3/4/5 seconds of
face-up arrivals, then three full seconds face up, then the flip-back. Reduced
motion skips travel and keeps the preview. Block's fixed board uses a three-second
arrival for the grid/tray, with input locked until it settles. Each game names
its sound cues; generation happens offline through ElevenLabs, with static
assets at runtime.
