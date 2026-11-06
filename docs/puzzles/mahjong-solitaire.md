# Puzzle design brief: Mahjong Solitaire (`mahjong-solitaire`)

**Status:** Draft for v1.3.4; owner approval required before build.
**Reference:** `docs/references/game-guides/Mahjong Solitaire — How It Is Played.html`.
**Scope proposal:** Solo tile-pair Mahjong Solitaire, not four-player Mahjong.

## Core loop

- Verb: select two free matching tiles to remove a pair.
- Goal: clear all tiles in the selected seeded layout.
- Win: no tiles remain. Run over: tiles remain but no legal matching free pair exists. Any timer expiry, if approved, is a scored run-over, not invalid replay.
- A tile is free when no tile covers any part of it and at least one long side has no same-layer neighbor. Flowers match Flowers; Seasons match Seasons; other faces require exact matches.
- Fun within the first 30 seconds: spot and remove a free pair, revealing a more open board.

## Proposed variants

Each variant has a stable family-owned code and separate ranked score group; shared matching rules and tile-face set:

- `turtle`: classic 144-tile, four-layer Turtle layout; default and signature mode.
- `quick`: compact 56-tile teaching layout, 14 faces with four copies each; exact geometry is a Morphi design choice.
- `fortress`: 144-tile Fortress layout with a different layered topology from Turtle.

These are layout variants, not rule variants. The 56-tile count is an example used by an existing game, not a universal standard. Final layouts require design and solvability review.

## Controls

- Touch/mouse/pen: tap/click a free tile, then its matching free tile. A different free tile replaces the selection; tapping the selected tile again cancels. Blocked tiles do not select.
- Keyboard: Tab enters the board; arrows move focus among tiles; Enter/Space selects. Expose accessible face, layer, selected and free/blocked state; visual color never carries state alone.

## Difficulty and scoring

- Bands: proposed first axis is layout (`quick`, `turtle`, `fortress`). Whether to add multiple bands per layout is undecided.
- Progression/fairness: deterministic generation from server-issued seed, variant and engine version. Build the initial deal by reverse-dealing legal matching pairs from an empty approved layout and retain the removal witness. Validate the witness before issuance. A random face shuffle may make unsolvable boards; exact solving is computationally hard. Server replay independently validates the player's actual moves.
- Score proposal for a cleared board: `pair × pairs + clear + second × max(0, parSeconds − activeSeconds)`. Provisional defaults: pair=100, clear=1,000, second=5; Quick par=180 s, Turtle/Fortress par=600 s. The existing admin scoring editor configures the three coefficients; par is fixed per variant. Owner may tune after playtesting.
- Fully cleared boards are leaderboard-eligible in their own variant group. Blocked boards remain in history with progress/time but have no leaderboard score. No hints, reshuffles or mismatch penalties in v1.3.4. Wrong selection does not change score.
- Ranked clock is server-owned, excluding only the fixed entrance allowance; client never submits score. Move cap and abandonment behavior require owner approval.

## Layout and style

- Layout profiles: compact, medium and expanded all use `wide` or `full` stage sizing to preserve tile legibility and overlap hit areas. Exact profile-to-layout mapping and minimum tile target are to be settled in wireframes at phone portrait 390×844, phone landscape 844×390 and desktop 1280×800 before implementation.
- Side panels: left side How to play; right side Scoring & tips on expanded layouts; drawers below the project's 1024 px breakpoint; none on phones. Confirm against current page template before build.
- Renderer: SVG candidate, because stacked layers need scalable overlap geometry and deterministic hit regions. Confirm after a small interaction/layout proof; do not add a rendering dependency without need.
- Style profile: flat, original tile faces with clear suit/number or distinct honor symbols; no gradients, glows, shadows/bevels on game objects, emoji or color-only distinctions. Use the project's approved site tokens and theme recipes. Tiles retain stable face identity across cosmetic themes.
- Themeable surfaces: tile backs, board/background and non-semantic accents only. Never alter face matching or readability.

## Puzzle-specific backdrop (standing owner rule, 2026-10-27)

- Allowed objects: Mahjong tiles and tile-pair silhouettes only; shapes/data owned by this puzzle's theme/backdrop adapter.
- Generate positions, rotations and arrangement from the cosmetic seeded RNG; backdrop seed is independent of logic RNG.
- In play use current-puzzle objects only, at 20% opacity, behind the board and outside header/bottom bands. Compact/mobile portrait and landscape hide them. Wider layouts show seeded random 1–5 objects per side scattered in two dimensions. No fixed columns or evenly spaced rows.
- Missing legacy backdrop data uses a deterministic arrangement of Mahjong objects, never another puzzle's motifs or generic decoration. Reveal with the puzzle arrival after the Card reveals its identity. Reduced motion shows static objects only where permitted.
- Evidence: family-isolation and deterministic-scatter tests; hidden backdrop captures at both phone sizes and bounded desktop scatter; verify rotation across visibility breakpoint.

## Feedback and feel

- Selection, valid pair, invalid pair, removal, blocked ending and win each get clear accessible visual feedback. Sound cues are distinct, original offline-generated assets if approved; missing sound remains silent without error.
- Arrival: after the continuous Card unfolds, show the board face-up. Tiles settle by layer with small upward movement and row stagger; no second miniature board and no face-down Memory-style preview. Proposed fixed entrance: 1.6 s Quick, 2.5 s Turtle/Fortress. Input stays locked to a logical active-time deadline; solo scoring time starts afterward, and ranked timing uses the matching server-owned allowance.
- Pair: selected free tile lifts slightly and gets an outline. A non-match gives a brief shake with no penalty and selects the second tile. A match lifts/fades both tiles over about 180 ms; newly uncovered tiles settle and newly free edges briefly highlight. Animations never control rules or scoring.
- Ending: board folds into played stack, then shared 420 ms result fade-rise. Only the large score may use the accepted 500 ms scramble. Reduced motion settles immediately.
- Replay hook: variant best, score, pairs removed, elapsed time and Next.

## Ending contract (required)

- Exact engine condition: `completion` when the final legal pair leaves zero tiles; `run_over` when tiles remain and the engine finds no matching pair among currently free tiles. If a ranked timer is approved, expiry is a distinct scored run-over reason. Generation failure is not a game ending; return a bounded preparation failure while preserving the current result/pending family.
- Manifest `ending.kind`: `completion` for clear; `run_over` for blocked/timed-out.
- Catalog keys: default completion headline and default run-over headline; distinct blocked/timed-out headline keys if timeout is approved. Exact key names pending message-catalog implementation.
- Catalog subline: completion values `pairs` and `elapsed`; blocked values `tilesRemaining`; timed-out values `tilesRemaining` and `elapsed`. Each value comes from authoritative engine/replay output. Exact key names pending.
- Manifest animation type: `fade-rise`; continue rule: `auto_2s_tap`.
- Complete the manifest declaration and verify keys/placeholders with registry generation before the build is reviewable. Presentation never decides end state or delays result persistence.

## Teaching

- Tutorial depth: `coach` candidate; introduce free-tile top/side rule, matching and Flower/Season groups with an accessible first selection.
- Explain blocked endings and that choosing among identical copies can affect future options.
- Whether hints exist, and whether they are disabled or penalized in ranked play, remains an owner decision.

## Risks

- Edge cases for `docs/EDGE_CASES.md`: unsolvable witness rejection; bounded generation exhaustion/fallback; partial tile overlap and z-order hit testing; identical-copy dead ends; no free matching pair; interruption/resume; missing asset; rapid/double input; navigation during entrance; reduced motion; duplicate ranked submission; storage failure.
- Performance: bound reverse-deal attempts and layout size; measure generation and SVG interaction on a named mid-range phone and desktop. Do not add an exact solver to the request path.
- IP: original Morphi symbols, layout data, sound and presentation. The reference guide informs rules only; do not copy its art/code or distinctive visual identity.

## Approval

- Owner approval date: pending.
- Owner decisions: approve game and variants; approve Flower/Season groups; pick timer or move-based scoring and coefficients/par targets; decide hint policy; approve visual direction, sounds and entrance timing; confirm this is the v1.3.4 implementation phase.
- Game-feel review notes: pending. The owner must approve this brief before implementation.

## Entrance and timing contract

Use `src/lib/ui/motion.ts` only for presentation. Choose a fixed entrance deadline after layout and device-size review; do not scale gameplay timing by tile count without an approved contract. Input readiness follows an active-time phase deadline, never animation completion. Ranked opening allowance is fixed by server-owned metadata; no client-supplied timing. Reduced motion settles presentation while preserving server-owned ranked allowance. Cosmetic travel uses external crypto entropy and never changes the seed, rules or score.

Test early input, hidden mount, hide/resume, resize/rotation, navigation cleanup, reduced-motion changes, failed motion and missing sound. Prepare the next solo candidate without consuming selector draws or reserving a ranked session; on preparation failure retain the result and pending family with retry/Home. Follow the shared Card contract in `_TEMPLATE.md` and existing shell.

## Research references

- [Rules and named layouts](https://www.mahjongsolitaire.games/pages/rules)
- [56-tile easy board example](https://mahjong.handeware.com/)
- [Reverse-deal and solvability notes](https://www.meowjong.com/mahjong-solitaire/rules/)
- [Complexity result](https://arxiv.org/abs/1203.6559)
