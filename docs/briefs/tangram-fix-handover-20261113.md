# Tangram fix handover — OpenCode audit 2026-11-13 (rebuild, not continue)

**Status:** the build in `~/morphi-one` does NOT match the accepted brief. It is the pre-Amendment-2 lattice design. Do not continue it — rebuild the engine core per §4A, then fix the items below, then run the focused §9 verification and STOP and report. No commit, push or deploy.

## 0. Root-cause check — VERIFIED 2026-11-13, no re-copy needed

The brief in the repo IS the amended one: `wc -l` says **193** and `## 4A` is present. The stale-brief theory is ruled out — the builder had the correct brief and did not follow §4A. No re-copy needed; go straight to the rebuild below.

## 1. Engine core — rebuild per §4A (decisive; fixes #1, #2, #3, #4, #9)

- Coordinates are exact algebraic numbers encoded with integers: each coordinate is an integer pair (p, q) representing p + q√2 in quarter-cell units (u = small-triangle leg = 1). Delete `TANGRAM_LATTICE` and the fixed quarter-cell grid. All engine arithmetic is exact integer arithmetic on the encoding; no floats in logic, manifest, generation or win-check.
- Rotation always allowed in 45° steps (tap / R / Shift+R). Delete the odd-rotation rejection (`rot % 2 !== 0 → RangeError`). All 8 orientations must be placeable and solvable.
- Win check is exact polygon coverage (§4A.3): every piece inside the target, pairwise non-overlap, union area exactly 8. Inside + total area is NOT enough (overlapping pieces can sum to 8 while leaving a gap).
- Move shape carries x/y as integer pairs; `at` only if a timed variant needs it (not on every move).
- Unit test (§4A.6): every tan in all 8 orientations has exact integer-pair coordinates. The old test asserting the opposite ("refuses an odd 45 degree rotation") must be deleted, not kept.

## 2. Mistake-limit-4 — server-side or do not ship (§3 #7)

Mistake = a rejected wrong-slot snap attempt, judged in replay on the server. A client-submitted `mistake` action that replay trusts is not the rule — a modified client can simply omit it. Implement the judgement server-side. If it cannot be implemented, the variant must NOT ship (the brief's own rule) — stop and report instead of shipping the client-trusted version.

## 3. Sei Shōnagon — the genuine cut (§3 #2)

"Sei" must be the real Chie no Ita 7-piece cut, not a mirror of the classic cut (congruent pieces = the same 13 convex shapes = no genuine rule delta, fails C2). Source: Fox-Epstein & Uehara, CCCG 2014, "The Convex Configurations of Sei Shōnagon Chie no Ita" — https://cglab.ca/~cccg/proceedings/2014/papers/paper56.pdf — Figure 1 (right diagram) shows the cut; Figure 8 shows the 16 convex shapes it forms. Take the 7 piece polygons from that figure, encode them in the §4A algebraic coordinates, and add a unit test proving the cut is not congruent to the classic cut and forms at least one convex shape the classic cut cannot.

## 4. Starter silhouettes — all 18 (§2)

13 convex shapes + Cat, House, Bird, Boat, Swan, each frozen and witness-verified. The build has 7 (Pyramid, House, Cat, Dog, Square, Swan, Double square) — Bird and Boat are missing, most of the 13 convex are missing, and Dog is not in the starter set. Bird and Boat have no proven witness yet: create them and prove them tileable with the exact-cover solver (the demo's 5 were proven this way: union area exactly 8, zero overlap). The 13 convex are tileable by definition (Wang & Hsiung 1942) but still need frozen witness-verified outlines.

## 5. Stage — the real two-column Stage (§6)

Build `Stage.svelte` as the two-column layout from the accepted demo (silhouette left, tray + tools right rail; footer bar on the right rail), not a copy of `RoundStage` with the footer at the bottom. Same props, same `present`/`stop`/`measureFrame`, same card calls, same inert rules.

## 6. Secondary fixes

- Animation (§7 budget, accepted build values): rotate 200 ms, flip 300 ms, win reveal 500 ms, entrance total 1,500 ms (currently 220 / 220 / 320 / ~1,660).
- Scoring (§5): no fifth countdown field; coloured-map gets NO par/time bonus — omit the bonus, do not implement it as `second: 0`; no countdown par (the brief's par list has none for countdown-120 — it uses the remaining-seconds bonus).
- Replay: return exactly the `ReplayedResult` shape — no extra `pieces`/`silhouette` fields.
- Tutorial (§7): first-round hint and first-flip-off coach must be gated one-time; verify the gating exists.
- Fixture: the demo fixture must be at `static/demo/tangram.html` (it is currently at `static/demo/tangram-middle-style-demo.html`):

```
cp ~/morphi-one/static/demo/tangram-middle-style-demo.html ~/morphi-one/static/demo/tangram.html
```

## 7. Verification, then STOP

Focused §9 verification only (Tangram files + the 2 shared touches, no full-repo verification). Report every check pass/fail, what was not run, and every place the code forced a choice. Landscape check: at 844×390 the board must not collapse — the Stage must fit one viewport in a landscape phone too (the demo collapses here: its width-only phone breakpoint stacks a portrait layout into 390 px of height; the Stage must not repeat that). Then STOP and report. Do not commit, push or deploy.
