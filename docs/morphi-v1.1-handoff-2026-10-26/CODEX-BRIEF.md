# Instruction for Codex — Morphi.One v1.1 (owner to paste)

Implement Morphi.One v1.1 from the attached package. The source of
truth is `morphi-v1.1-scope.md`; the folders in the zip are its
references. Work in scope order:

1. **Procedural theme system** (long-plan §11.2): recipe-generated
   OKLCH palettes, generated symbols/shape/style/backdrop axes,
   freshness draws; curated presets become fallbacks/anchors;
   `theme_config_version` recorded per round.
2. **UI/UX pass across v1**, in the locked shell: puzzle name in the
   header (phone: on its own line below the header); full-width
   bottom panel flush with the screen bottom holding "How to play"
   / "Scoring & tips"; a clear gap between the box and both the
   header and the bottom panel; background scatter of that puzzle's
   own items only, at 80% transparency; boards must use the
   available screen space (the v1 fault was a small board centred in
   empty desktop space). Presentation is **The Card** — deal as a
   face-down card, flip reveals the name, card unfolds into the
   board, finished board folds back into a card on a visible played
   stack — per `morphi-game-ui-redesign/THE-CARD-decision.md`
   (references: `connect-concept-card.html`,
   `connect-concept-card-phone.html`).
3. **New game: Connect**, built from
   `morphi-flow-design/CONNECT_BRIEF.md` and the verified prototype
   in the same folder (generation is proven; reuse its logic).
   Sound via the already-installed ElevenLabs SDK, build-time
   generation only, no runtime API calls. Appearance and working
   animation per the accepted demos (`connect-board-appear.html`,
   `connect-working-animation.html`); Anime.js with **absolute
   timeline positions only** (3.2.1 does not create labels on the
   fly — labelled beats are silently dropped).
4. **Per-game score customisation in the admin panel**: scoring
   values editable per game by the operator; the admin panel's
   design stays as-is.
5. **Doors withdrawal**: no per-game public routes, pages, or play
   parameters — the only way into a game is the selector's deal.
   Replacement traffic surface in v1.1 is the static explainer pages
   (How it works / About / FAQ) in `morphi-static-pages/` —
   reference only; integrate as you see fit in Morphi's own code,
   built from content blocks so the later CMS can edit them.

Hard rules: **no deployment** — local build and `bun run verify`
only, reported like the phase reports. **Do not build share links**
(owner decision pending). **Do not build the `/admin/games/<name>`
test-route idea** at the end of the scope file — it is an idea
only, not scope. Wording is "Your high score", never "Best"; the
wordmark is "Morphi.One".
