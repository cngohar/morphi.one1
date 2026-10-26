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

Current Memory mapping (owner, 2026-10-25): 6/8/10 pairs = 3/4/5 seconds of
face-up arrivals, then three full seconds face up, then the flip-back. Reduced
motion skips travel and keeps the preview. Block's fixed board uses a three-second
arrival for the grid/tray, with input locked until it settles. Each game names
its sound cues; generation happens offline through ElevenLabs, with static
assets at runtime.
