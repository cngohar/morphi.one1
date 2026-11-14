# Tangram (`tangram`)

Owner-selected v1.4.4 baseline and Batch A, 2026-11-13, per
[accepted brief](../briefs/v1.4.4-tangram-codex-brief.md) including Amendments 3–5
and [fix handover](../briefs/tangram-fix-handover-20261113.md).
Implementation and functional acceptance are distinct; owner review follows focused checks.

Drag all tans from the tray to cover the silhouette exactly. Rotate in 45°
steps; only the classic parallelogram needs flipping. Every tan must touch
another, with no overlap, protrusion or gap. Classic has no blocked or lose
state; pieces can be lifted and rearranged. Reset preserves the issued seed,
silhouette, elapsed time and spent assistance. Amendment 4 removes New
silhouette entirely: no chooser, replacement callback or session-contract edit.
Next continues the shared cross-family sequence, preserving daily single-attempt
play and hidden discovery.

The engine uses exact integer coefficient pairs `(p + q√2)/4`, in units of the
small triangle's leg. Frozen, independently witness-verified silhouettes are
instances, never variants. All eight orientations preserve exact coordinates.
Coverage uses polygon containment, strict non-overlap and exact area, accepting
valid solutions different from the witness. No runtime packing solver is used.
The UI alone projects to pixel coordinates; committed positions resolve back
to exact coefficients. Generation, replay, validation and scoring never use
floating point geometry.

The family owns an SVG Game, two-column Stage and anime.js motion. Silhouette
is left, tray/tools/footer right; portrait stacks board above tray. Landscape
844×390 must remain two columns with a visible board and no page scrolling.
The shared SiteHeader and Card beats are reused. Amendment 5 keeps the Square
tray only; there is no Row arrangement or toggle. Pointer, keyboard arrows, R/Shift+R, F, H and
Enter support play. Touch sizing and overflow must be measured in the app.

`brief-v1` defaults award 1000 for completion, 100 per piece (50 for Double),
5 per second under the applicable par and deduct 100 per hint/peek, floored at
zero. Coloured-map omits the time bonus. Countdown uses remaining seconds;
it has no additional par or fifth score coefficient. Helped solves are marked
and receive the assistance penalty. Peek consumes the same assistance budget
as Hint, so it cannot bypass no-hint or the three-hint limit. Scoring versions
are immutable for issued rounds; future defaults remain admin-editable.

Family and all eleven presets ship enabled. Board key: `(tangram, UTC date)`;
variant boards: none; per-variant groups: zero. The shared daily system issues
one identical puzzle per day with one ranked attempt. Claims below 5000 ms
save unranked and consume the attempt. Timeout or four mistakes save no score
or daily row. Server replay judges submitted snap attempts geometrically.

Entrance lasts 1500 ms with a logical input deadline. Snap and rotate are
200 ms, flip 300 ms, win reveal 500 ms. Reduced motion and failed animation
settle without changing rules or delaying persistence. Existing pick/place/
invalid/win/clear cues are reused; no new audio asset. First-round and first
flip-off teaching are one-time. Checkpoints, hidden tabs, resize, navigation
cleanup and loss recovery use existing lifecycle contracts.

Focused verification passed: 26 unit cases, 11 real-D1 cases, 23 Chromium cases
with one worker, 33 solved and 66 rejected vectors in each of six runtimes,
scoped lint/types (0 errors, 0 warnings), boundaries, build and lazy isolation.
Full verification and physical-device review were not performed; owner functional
review remains pending. The shared saver's `seconds=0` opening replay preflight
checks geometry; positive elapsed replay enforces timing. A zero-active-time save
is below the five-second ranked floor and is unranked.

Only focused Tangram and directly affected shared checks are authorized.
No Batch B, other family implementation, full verification, commit, push,
deployment or release follows this milestone.
