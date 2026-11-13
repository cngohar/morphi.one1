# Mahjong Solitaire (`mahjong-solitaire`) — v1.4.2

Owner-approved 2026-11-11; per-family shell and Rev 2 corrections approved
2026-11-12. Implementation authority is
[`v1.4.2-mahjong-codex-brief.md`](../briefs/v1.4.2-mahjong-codex-brief.md).
This replaces the stale v1.3.4 proposal. Build Classic first, then Batch A only.

## Rules and controls

Remove matching free tiles until none remain. A free tile has no overlapping
higher tile and at least one open left/right side on its own layer. Same-layer
vertical neighbours do not block. Ordinary faces match exactly; Flowers match
Flowers and Seasons match Seasons. Identical-copy choices can strand a board.

Tap/click selects, tapping again cancels, and a nonmatching free tile replaces
the selection. Tab enters the board; arrows focus free tiles; Enter/Space selects;
Escape cancels. H/U/S/R trigger Hint/Undo/Shuffle/Restart. Restart preserves the
seed and board. Classic Hint/Shuffle/Undo are unlimited. A hint chooses the legal
match freeing the most tiles. Shuffle reverse-deals surviving faces and clears
Undo. Blocked boards lose only when neither Shuffle nor Undo can rescue them.

## Bands, generation and integrity

Bands are layouts, never variants or boards: Quick 56 (42+14), Turtle 144
(87+36+16+4+1), Fortress 144 (92+40+12; 29 initially free). Half-step integer
coordinates are frozen from the supplied fixture. Tile rectangles are 2×2;
upper-layer offsets and Turtle head/tail positions remain as approved.

SplitMix64 draws the band first (Quick/Turtle/Fortress), then a reverse-deal
witness and shuffled face groups. Validate by replay before issuance. Bound each
band to 100 attempts, fall back toward Quick, then reject exhausted generation.
No exact solver. Triple uses only its fixed 108-tile Turtle (63+27+12+5+1),
without a band draw. Avalanche witnesses simulate every slide. Witnesses exist
for tests only and never judge a player's solution or enter issued JSON.

Family and all 11 presets ship enabled. Board key: `(mahjong-solitaire, UTC date)`;
variant boards: none; variant leaderboard groups: **0**. Reuse existing server
issuance/replay, daily storage, immutable per-preset scoring, admin controls and
activity/history plumbing. Moves have exact numeric-only keys and illegal moves
throw. Maximum 10,000 moves. No engine/selector/server/schema/migration changes.

## Batch A — each delta from Classic

| Preset suffix  | Single rule delta                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------- |
| classic        | Match two free tiles; face up; free-tile cues; unlimited helpers.                                 |
| triple-match   | Match three; fixed 108 tiles, 34 ordinary faces ×3 plus three Flowers and Seasons.                |
| exact-only     | Bonus faces match exactly; first two Flowers and Seasons each occur twice.                        |
| face-down-peek | Twelve seeded tiles turn down after witness validation; peek is recorded and permanent.           |
| no-highlight   | Remove free-tile brightening, outline and dot; blocked tiles remain unselectable.                 |
| countdown      | Quick 180 seconds; Turtle/Fortress 600 seconds; timeout loses without a score.                    |
| three-hearts   | Each mismatch loses one of three hearts and keeps the last selection; zero loses.                 |
| no-undo        | Disable Undo.                                                                                     |
| hint-budget    | Three hints; 100-point cost each.                                                                 |
| shuffle-budget | Three shuffles; 50-point cost each.                                                               |
| avalanche      | After removal, screen-above tiles in the same column slide into vacated slots; recompute freedom. |

## Scoring and endings

`brief-v1` defaults: completion 1,000; removal 100 (triple 150); each second
under par 5; each hint −100; each shuffle −50; floor zero. Par is Quick 180,
otherwise 600. Three-hearts adds 250 per surviving heart. Coefficients are
immutable admin-editable versions. Countdown's remaining-time bonus uses its
same par and five-per-second default. Timing floors: Quick exactly 2,500ms;
Turtle/Fortress/Triple exactly 10,000ms. Below-floor claims save unranked and
consume the daily attempt. Hidden ranked time uses server wall-clock.

Clear means an empty player board, `completion`; timed/hearts/no-rescue failure
is `run_over`, with the failed board viewable and no score or daily row. Leaving
abandons the exact ranked session. Ending text uses authoritative counts/time;
`fade-rise`, `auto_500ms`. Persistence never waits for presentation.

## Presentation

Own `Stage.svelte` and `motion.ts`; Stage preserves shared Card props, snippets,
methods, beats, inert rules and footer content. Shared SiteHeader remains the
identity bar. SVG layered opaque traditional-style faces are original artwork:
Characters, Bamboo, Circles, Winds, Dragons, plant Flowers and Seasons. Cream
pills, green edges, visible thickness and bevel follow the supplied style image;
geometry and behaviour follow the fixture only. The scenic image is reference,
not a runtime asset. No English text labels replace tile art.

Quick targets ≥44px tiles at 390px portrait. Turtle/Fortress use Fit/zoom and
panning inside bounded overflow. Resize and rotation preserve the round.
Mahjong-only tile-pair backdrop motifs scatter deterministically on wide screens
and hide on compact layouts. No other family's objects.

Entrance shows an empty board, then every tile in layer order at uniform stagger,
all within 2,000ms. Input uses that logical active deadline. Removal lifts/fades
for 500ms; newly exposed/free tiles settle/highlight; mismatch shakes; win reveals.
Family anime.js wrapper only; reduced motion settles immediately and failures
switch off animation. Generic existing sound cues only; no new sound assets.
First-round hint teaches freedom; first triple round gets one coaching line.
Quick teaching omits bonus groups because Quick has none.

## Verification and stopping point

Focused §9 only: family units, 33+ frozen solved/illegal/incomplete vector sets in
six runtimes, real-D1 daily/scoring/activity cases, one-worker Chromium at
390×844, 844×390 and 1280×800, scoped format/lint/types/boundaries/lazy bundle.
Include keyboard, Fit/zoom, hidden time, checkpoint/resume, input/motion failure
and navigation cleanup. Report missing evidence honestly. No full verify, other
families' tests, physical-device measurements, commit, push, deploy or Batch B.
Owner functional review and pre-launch trademark clearance remain separate.
