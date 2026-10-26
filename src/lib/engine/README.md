# Pure engine foundations

`rng.ts` implements the versioned SplitMix64 RNG, unbiased integer draws, Fisher–Yates shuffle, and unsigned 64-bit decimal seed parsing. `contract.ts` defines the common completed-run and puzzle manifest interfaces.

This directory has no puzzles, browser APIs, networking, database, system clock, or entropy source. `src/lib/seeds.ts` obtains fresh cryptographic seeds outside the deterministic engine. ESLint enforces the import boundary and banned core math. Tests are allowed to exercise the external seed source.

Each puzzle owns its generator, transitions, replay/scoring adapter, rules version, tests, view, and themes. The generated headless catalog is the server's entry point; the generated registry adds the app's views. Shared engine changes require every puzzle's regression tests and vectors. A puzzle-only rule change increments that puzzle's version and needs a compatibility/migration decision for its outstanding and saved runs.

Run `bun run test:unit -- --run` and `bun run test:vectors`. The latter checks independently specified vectors in Node, Bun, Chromium, Firefox, WebKit, and local workerd.
