# Klondike Solitaire (`klondike-solitaire`)

Owner-selected v1.4.3 baseline and Batch A, 2026-11-14, per
[accepted brief](../briefs/v1.4.3-klondike-codex-brief.md).
Implementation and functional acceptance are distinct; owner review follows focused checks.

## Overview & Rules

Klondike Solitaire is the classic standard solitaire card game played with a single 52-card deck.
The objective is to move all 52 cards to the four foundation piles (one per suit: Spades, Hearts, Diamonds, Clubs), building up by suit from Ace to King.

### Table Layout

- **Stock**: Draw pile (face-down) containing 24 cards after the initial deal.
- **Waste**: Face-up discard pile from stock draws; top card is playable.
- **Foundations**: 4 piles (Spades, Hearts, Diamonds, Clubs) building up from Ace (1) to King (13).
- **Tableau**: 7 columns (columns 1..7 holding 1..7 cards initially; top card is face-up, rest face-down).
  Cards build down in descending rank with alternating colours. Only Kings (or any card in `any-card` variant) may fill empty tableau columns.

### Batch A Variants (11 Enabled Presets, 0 Groups)

1. **Classic (`klondike-solitaire:classic`)**: Draw 1 from stock, unlimited passes, alternating colours, King only on empty tableau columns.
2. **Draw 3 (`klondike-solitaire:draw-3`)**: Draw 3 cards from stock at a time; only the top waste card is playable.
3. **Three Passes (`klondike-solitaire:pass-3`)**: At most 3 passes through stock (2 recycles allowed, 3rd recycle throws `RangeError`).
4. **Single Pass (`klondike-solitaire:pass-1`)**: Exactly 1 pass through stock (0 recycles allowed; recycling throws `RangeError`).
5. **Any Card Empty (`klondike-solitaire:any-card`)**: Any card or valid run can fill an empty tableau column.
6. **Thoughtful (`klondike-solitaire:thoughtful`)**: All 28 tableau cards are dealt face-up. Moving sub-columns requires a valid contiguous descending build.
7. **Same Colour (`klondike-solitaire:same-colour`)**: Tableau builds down in the same colour (red on red, black on black).
8. **Different Suit (`klondike-solitaire:different-suit`)**: Tableau builds down in any different suit (regardless of colour).
9. **No Undo (`klondike-solitaire:no-undo`)**: Undo button is disabled; only restart recovers wrong moves.
10. **Hint Budget 3 (`klondike-solitaire:hint-budget-3`)**: At most 3 hints allowed per round; each used hint deducts 20 points.
11. **Draw 3 Pass 3 (`klondike-solitaire:draw-3-pass-3`)**: Combines 3-card draw with at most 3 passes through stock.

### Scoring (Standard Microsoft Rules - Decision D3)

- Waste to Tableau: +5
- Card to Foundation: +10
- Turn tableau card face up: +5
- Foundation back to Tableau: −15 (Decision D7)
- Waste recycle in Draw 1: −100
- Waste recycle in Draw 3: −20 (after 3 initial passes)
- Time Bonus: `floor(7000 * 100 / seconds)` for completions ≥ 30 seconds
- Hint penalty: −20 (in `hint-budget-3`)
- Note: Timed −2 / 10s rule is explicitly excluded. Vegas dollar presentation is not used.

### Locked Decisions (§0 D1–D11)

- **D1**: 00:00 UTC daily reset.
- **D2**: First attempt only counts for ranking.
- **D3**: Standard Microsoft scoring default.
- **D4**: Timing floor 60,000 ms (1 minute, constant in manifest).
- **D5**: Solver budget 100 attempts per deal, 400,000 nodes per deal max; only "won" issues a deal.
- **D6**: Thoughtful variant reveals all 52 locations (all 28 tableau cards face up).
- **D7**: Foundation move-back allowed (−15 penalty).
- **D8**: Hint-assisted daily win marked "solved with hint" and saved unranked.
- **D9**: Double Klondike 9 columns (future baseline, not v1.4.3).
- **D10**: Product name "Klondike Solitaire" (display "Klondike").
- **D11**: `maxMoves` = 10,000. Transport bound raised to 1 MiB on progress/daily routes.

### Leaderboard & Daily Play

- Board key: `(klondike-solitaire, UTC date)`.
- Per-variant leaderboard groups: 0.
- All variants share the single daily board key.
- Server-authoritative daily puzzle issuance, single-attempt ranked play, site-wide streak preservation.
