# Klondike Solitaire (`klondike-solitaire`)

**Local baseline + Batch A implemented; focused verification complete.**
Eleven enabled presets, zero variant groups; owner functional acceptance is pending.

`klondike-solitaire-1` is an integer-based engine modeling the full 52-card Klondike rules with pure functional transitions and an iterative A* priority queue MaxHeap solver.

Classic passed its baseline gate before these ten single-rule deltas were added:

- **Classic (`klondike-solitaire:classic`)**: Draw 1 from stock, unlimited passes, alternating colours (red on black / black on red), King only on empty tableau columns.
- **Draw 3 (`klondike-solitaire:draw-3`)**: Draw 3 cards from stock at a time to waste; only top waste card is playable.
- **Three Passes (`klondike-solitaire:pass-3`)**: At most 3 passes through stock (2 recycles allowed, 3rd recycle throws `RangeError`).
- **Single Pass (`klondike-solitaire:pass-1`)**: Exactly 1 pass through stock (0 recycles allowed; recycling throws `RangeError`).
- **Any Card Empty (`klondike-solitaire:any-card`)**: Any card or valid run can fill an empty tableau column.
- **Thoughtful (`klondike-solitaire:thoughtful`)**: All 28 tableau cards are dealt face-up; building down rules still require valid contiguous sequences to move.
- **Same Colour (`klondike-solitaire:same-colour`)**: Tableau builds down in the same colour (red on red, black on black).
- **Different Suit (`klondike-solitaire:different-suit`)**: Tableau builds down in any different suit (regardless of colour).
- **No Undo (`klondike-solitaire:no-undo`)**: Undo button is disabled; only restart recovers wrong moves.
- **Hint Budget 3 (`klondike-solitaire:hint-budget-3`)**: At most 3 hints allowed per round; each used hint deducts 20 points.
- **Draw 3 Pass 3 (`klondike-solitaire:draw-3-pass-3`)**: Combines 3-card draw with at most 3 passes through stock.

All eleven presets are enabled and `presentation.groups` is empty. The existing single
`(klondike-solitaire, UTC date)` daily board is authoritative across all variants.

### Scoring (Standard Microsoft Rules - Decision D3)

- Waste to Tableau: +5
- Card to Foundation: +10
- Turn tableau card face up: +5
- Foundation back to Tableau: −15 (Decision D7)
- Waste recycle in Draw 1: −100
- Waste recycle in Draw 3: −20 (after 3 initial passes)
- Time Bonus: `floor(7000 * 100 / seconds)` for completions ≥ 30 seconds
- Hint used: −20 (in `hint-budget-3`)
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

### Focused Checks Passed

- 15 unit test cases in `logic.test.ts`.
- 11 variant test cases in `variants.test.ts`.
- 33 solved and 66 rejected vectors in each of six runtimes (Node, Bun, Chromium, Firefox, WebKit, Cloudflare Worker workerd) with identical SHA-256 fingerprint `a2dcc6a6d98ffc00ac31221a74ea0606c39c6ffbff8dcfec0eede76a7b52ef5d`.
- 5 real-D1 integration cases in `tests/integration/klondike-solitaire.test.ts`.
- Scoped format and lint (0 errors, 0 warnings).
- `svelte-check` (0 errors, 0 warnings).
- Boundary check (`bun run check:boundaries`).
- Lazy bundle isolation check (`bun run check:lazy-bundle`) confirming shell isolation and exactly 7 independent Game views.
