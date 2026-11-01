# Connect

`logic.ts` owns deterministic generation, stroke reduction, win checks and
scoring. `manifest.ts` is the authoritative replay adapter; `Game.svelte`
renders the board and records only accepted moves. The generated registry is
the app/server boundary. Connect does not import another puzzle.

Rules version `connect-1` has three seeded bands: 5×5/5 pairs/90 s,
6×6/6 pairs/125 s and 7×7/8 pairs/165 s. A bounded backbite permutation of a
serpentine Hamiltonian path is cut into segments of at least three cells,
providing a guaranteed witness without using it for win validation. Paths
cannot share cells or cross foreign endpoints; crossing a foreign path cuts it.
Connecting every pair wins. Filling every cell at completion earns an optional
bonus. Score is
`max(0, connected*200 + fullGrid*1000 + max(0, par-seconds)*10 - redraws*50)`.
The server replays every cell visit, rejects invalid stroke order, and supplies
ranked elapsed time. Cosmetic themes and audio never affect it.

The Card shell opens the same frame before the Connect-specific 2.5 s entrance.
Nine original static ElevenLabs cues are generated offline and documented in
`static/audio/manifest.json`. Tests cover 1,200 seeded witnesses, replay,
crossing/redraw, six-runtime vectors, D1 ranking and browser interaction.
