# Work 2 presentation review

Latest: [desktop Card/scatter correction](review-fix/README.md). It supersedes
the earlier captures below for backdrop positions and transition geometry.

Open [the local Card proof](http://localhost:5173/demo/card-proof.html).
If needed, run `bun run demo:card`, then `bun run dev --host 0.0.0.0`.

Use **Preview** in the top-right to select Memory or Block, replay the arrival,
finish a sample round, or try slow/fail-once preparation and static motion.
**Next puzzle** alternates the samples. Try portrait and landscape on a phone;
the played stack uses the bottom-left gap. Desktop uses a side stack.

These are presentation samples, with no account calls or saved scores. They
show the proposed Card timing and stack placement for owner review. Actual
games retain their accepted gameplay entrance/preview timing until that review.
The revised proof expands one persistent frame, then keeps each game's own
deal. Memory's six-pair sample has a three-second random-position arrival and
full three-second preview before hiding. Finishing a sample folds that frame
onto the stack and reveals the central score/statistics/Next result.
Desktop uses a wide score/statistics column and a separate Next-card column;
portrait remains compact. A half-second digit scramble reveals only the
large score,
with no final-score preflash. Reduced motion shows the final text directly.
All labels, high score, statistics and Next text stay static.
Next starts preparation while the result leaves, then deals the next Card
from a fresh random viewport edge position and rotation, settles it at the
centre and unfolds there; finishing folds into the played stack;
reduced motion shows the static equivalents.
Actual puzzle-specific backgrounds and speculative solo preparation are already
in the local app at `/play`; they are tested independently of the sample.
Compact/mobile layouts hide puzzle backdrop objects in both orientations.
Wider layouts show a seeded random 1–5 own objects per side; the approved
background blend and 20% opacity are unchanged.

`tests/e2e/card.spec.ts` captures both games and finished stacks at 390×844,
844×390, 1280×800 and 1920×1080 in Chromium, Firefox and WebKit. All captures
live in ignored `build/v1.1-card/`; selected review images and the final
verification/Next measurement summaries are retained beside this README.
The full local verification log is `build/v1.1-card/final-verify.log`.

Contact-sheet approval is recorded separately. Card/phone stack/overall visual
acceptance remains with the owner; no production publication is implied.

Selected review captures:

- [Desktop result, Memory](memory-stack-1920x1080.png)
- [Desktop result, Block](block-stack-1280x800.png)
- [Phone result and played stack](memory-stack-390x844.png)
- [Landscape result and played stack](block-stack-844x390.png)
- [Memory preview](memory-preview-1280x720.png)
- [Desktop puzzle-only backdrop](block-1280x800.png)
- [Phone with backdrop objects hidden](memory-390x844.png)
- [Continuous-frame/preview samples](continuous-frame.json)
- [Score reveal samples](result-scramble.json)
- [Five cached Next measurements](preparation-measurements.json)

Actual app captures (backdrop/preparation integration, before Card integration):

- [Memory at 1920×923](app-memory-1920x923.png)
- [Block at 1920×923](app-block-1920x923.png)
- [Phone Memory, no backdrop objects](app-memory-390x844.png)

[Full verification summary](verification.json): 116 unit tests, 22 local
integration tests, 20,000 palettes, six-runtime vectors, 15 built-Worker checks
and 110 browser checks passed. Three additional failure checks passed across
Chromium, Firefox and WebKit. [Motion probes](motion-checks.json) record one
headless run per browser; they do not replace owner device/visual review.
