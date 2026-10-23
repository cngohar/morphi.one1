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

## Layout and style

- Layout profiles (compact, medium, expanded) and the stage mode for each (`centered`, `wide`, `full`):
- Side panel content (left and right slots):
- Renderer (`dom`, `svg`, `canvas2d`, `pixi`) and why:
- Style profile: shape families and proportions, topology, depth cues, motion style, sound palette, backdrop kinds:
- Themeable surfaces:

## Feedback and feel

- Animations (trigger, duration token, reduced-motion alternative, paired sound):
- Arrival and exit animation:
- Replay hook (personal best, "so close", next puzzle):

## Teaching

- Tutorial depth (`hint`, `coach`, `guided`) and the steps:

## Risks

- Edge cases to add to `docs/EDGE_CASES.md`:
- Performance risks:
- IP check (names, art, sounds, mechanics; plan section 11.12):

## Approval

- Owner approval date:
- Game-feel review notes:
