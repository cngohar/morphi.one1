# THE CARD — presentation decision (owner, 2026-10-26)

**Decision:** After exploring eight out-of-the-box presentation concepts
(Card, Living Sketch, Suspended World, Stage, Dispenser, Jigsaw, Flip
Wall, Card × Jigsaw), the owner picked **Concept 1 — The Card** as
Morphi.One's presentation direction. It replaces the plain board
arrival of the previously accepted shell design. The other seven
concepts are **not adopted**; their demos stay in this folder as
reference only.

Reference demo: `connect-concept-card.html` (Connect board, accepted
shell).

## The experience, beat by beat

1. **The deal.** A face-down card slides in and settles at the centre
   of the stage. Its back carries a Morphi motif — no name, no hint.
   The header's name slot is still empty: nobody knows what this is,
   not even the header.
2. **The flip.** The card flips over. At the flip, the puzzle's name
   arrives in the header (phone: on its own line below the header,
   per the locked phone exception). This is the reveal.
3. **The unfold.** The card unfolds into the board itself: the puzzle
   box settles in with that game's own procedural theme, the board
   deals in (per-game appearance), and the background scatter fades
   in as part of the arrival — never visible before it.
4. **Play.** Unchanged locked shell: HUD stats in their own strip
   above the board, clear gaps above and below the box.
5. **The fold-away.** When the round ends, the board folds back into
   a small card carrying the round's result ("Your high score …"),
   and files itself onto the **played stack** at the side of the
   stage. The stack grows by one card per finished puzzle, all
   session.
6. **The next card.** A fresh face-down card is already waiting.
   Pressing Next starts the same story again.

## What does not change

- The two shell globals: puzzle name in the header; the full-width
  bottom panel, flush with the screen bottom, holding "How to play"
  / "Scoring & tips" (and "Your high score", with the NEW chip on a
  brand-new game).
- The gap rule (puzzle box never touches header or bottom panel;
  scatter keeps out of both bands).
- Background scatter: the puzzle's own items only, seeded, at 80%
  transparency.
- Per-game everything else: board, HUD stats, theme, inside layout.
- No catalogue, no doors, no choosing; the name is never revealed
  before the puzzle arrives — the Card strengthens this, because
  the header stays empty until the flip.

## Timing note

The accepted appearance budget (2.5s) was set for the plain deal-in.
The Card's arrival (deal → flip → unfold → board ready) should stay
in that spirit — snappy, because it plays on every deal and every
Next. The demo is illustrative (~3.5s to a playable board); exact
timings are tuned in the design pass, not locked here.

## Still open (owner / design pass)

- **Phone treatment:** built 2026-10-26 (`connect-concept-card-phone.html`,
  390×844, locked phone shell). Placement call, pending the owner's
  verdict: the played stack moves to the bottom-left gap above the
  bottom panel as a small fanned deck; the finished card flies down
  to it.
- **Proofs for the other games:** only Connect exists in the Card
  treatment so far; Memory and Block proofs to be built the same
  way before Codex treats it as settled.
- **Reduced motion:** the equivalent is a plain fade — card already
  face-up, board simply fades in, stack updates without flight.
- The played stack is session chrome (a visible run of finished
  puzzles), not a record or a score store.
