# Morphi.One — Puzzle brief: Connect (Flow)

> Owner correction, 2026-10-29: connecting every pair now finishes the round;
> full-grid coverage is an optional 1,000-point bonus. This supersedes the
> fill-to-win wording below. See `docs/puzzles/connect.md` and `docs/DECISIONS.md`.

Status: third puzzle family, decided by owner 2026-10-25. Built in parallel
with Codex's v1 build; added after the v1 launch. Prototype, not integration.
Follows the per-puzzle brief system (long plan §11.16): one shell, this brief
fills the slots.

## The game in one line

Connect each pair of matching dots with a single path. Fill every cell.
Paths must not cross.

## Why it is the third family

- Block = place shapes (spatial). Memory = remember locations (recall).
  Connect = plan a route (pathfinding). A third, distinct muscle.
- Square grid, centred stage mode — the existing hybrid shell, no new
  wide/full mode, no new page shell.

## How to play (door-page copy, left column)

1. Drag from a dot to start its path. Reach the matching dot to connect
   the pair.
2. Paths run up, down, left and right — never diagonally, and two paths
   can never share a cell.
3. Fill every cell on the grid to finish. A finished path can be redrawn,
   but it costs points.

## Rules (exact)

- A path may be drawn from either endpoint, and may be extended, shortened
  or erased by dragging along it.
- Dragging across another pair's path cuts that path at that cell.
- The round ends when every pair is connected AND every cell is filled.
  Connected pairs alone are not enough — an empty cell means not finished.
- Endpoints carry both a colour and a symbol, so a pair never depends on
  colour alone.

## Seeded generation (guaranteed solvable)

- The seed (SplitMix64 streams, as the other families) builds a full
  solution first: a Hamiltonian path covering every cell (serpentine
  start, randomised by seeded backbite moves — bounded and fast, no
  search), cut into K segments of at least 3 cells. Each segment is one
  pair; its two end cells are the dots the player sees.
- Solvable by construction — the generated solution always exists. A
  player's different solution that connects all pairs and fills the grid
  also wins; the win check tests the rules, not the stored solution.
- The selector draws the band and the seed. The player never chooses the
  grid, the pairs or the theme (Mix mode), as with the other families.

## Difficulty bands (selector-drawn)

| Band | Grid | Pairs | Par time |
|------|------|-------|----------|
| 1    | 5x5  | 5     | 90s      |
| 2    | 6x6  | 6     | 125s     |
| 3    | 7x7  | 8     | 165s     |

## Scoring

- Connect a pair: **+200**
- Complete the grid (all pairs + every cell filled): **+1,000**
- Time bonus: **+10 per second under par** (0 at or over par)
- Redraw a pair that was already connected: **-50**
- Score never goes below 0. "Your high score" is per family, as elsewhere.

## In-round state (HUD)

Score / Pairs (n / K) / Filled (%). No in-round side panel — help lives
behind "How to play" / "Scoring & tips" buttons during the round (hybrid).

## Tips (door-page copy, right column)

- **Start at the edges.** Paths along the wall have fewer ways to go wrong.
- **Leave a way through.** Before you draw, check you are not sealing
  another dot inside your own path.
- **Fill is the finish.** A pair that connects but leaves empty cells
  behind it will need redrawing — plan its route to sweep them up.

## Door page

- Route (at launch of this family): /connect, Stay mode, Google-only door,
  in the sitemap, no on-site navigation to it (doors model).
- Heading: "Connect". Eyebrow / title phrase: "Play the free connect
  puzzle online".
- Surprise entry: the one quiet link, "Or let Morphi deal you a surprise".

## Ranked / replay

- The move record is the list of path strokes (colour, cell sequence) plus
  timestamps. Server replay re-applies the strokes to the seeded board and
  checks the win condition and the score — same pattern as the other
  families.
