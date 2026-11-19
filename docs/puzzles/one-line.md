# One-line v1.4.7

Draw every line exactly once. A round shows the entire seeded figure in the shared centered stage. Start on either ringed dot when there are two odd dots. On an even figure, start anywhere. Crossings without a dot leave the lines separate.

Classic plus ten Batch A presets are enabled by default. Presets change a rule and stay internal to the catalogue and admin tooling. Board size comes from the first seed draw. Daily draws accept 17–24 edges and share one board per family and UTC date. Verdict rounds are unlimited-only. There are zero per-preset leaderboard groups.

The engine constructs a connected integer lattice figure and checks its parity. A drawable figure needs a re-walked Hierholzer witness and a reachable trap. Two-stroke checks the remaining stroke budget when it evaluates a route. Impossible verdict figures carry a connected four-odd parity certificate.

The server replays recorded moves and uses the issued family scoring configuration. Each required traversal is worth 100 points, hints subtract 100, and restarts subtract 50 by default. Undo is free. Countdown wins also earn 10 points per remaining second. A correct impossible verdict earns 500. Completed losses earn zero and leave the daily board empty for that attempt. The default daily ranking includes hinted wins and labels them. The ranked timing floor is 2,500 ms of measured gameplay.

See [the implementation brief](../briefs/v1.4.7-one-line-codex-brief.md) for the approved scope and [the family README](../../src/lib/puzzles/one-line/README.md) for the preset rules.
