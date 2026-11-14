# Tangram

**Local baseline + Batch A implemented; focused verification complete.**
Eleven enabled presets, zero variant groups; owner functional acceptance is pending.
Amendment 4 removes New silhouette without a replacement callback. Amendment 5
removes Row and its toggle; the tray is Square only.

`tangram-1` uses exact algebraic polygons and numeric move coefficients;
SVG pixel projection is presentation only. The curated starter library contains
13 convex silhouettes plus Cat, House, Bird, Boat and Swan. A silhouette is a
seeded instance, never a preset. Exact coverage accepts alternate solutions.

Classic passed its baseline gate before these ten single-rule deltas were added:

- Classic: seven classic tans, rotation and parallelogram flip, unlimited help.
- Flip off: no flipping; issue only a witness requiring no flip.
- Sei Shōnagon: the genuine seven-piece Chie no Ita cut.
- Double: two classic sets, fourteen pieces, target area sixteen.
- Coloured map: show the reference decomposition; omit the time bonus.
- No full size: show the target at a smaller scale than the pieces.
- Countdown: finish within 120 seconds; timeout saves no score.
- Mistake limit: four geometrically rejected snap attempts end the run.
- Falling pieces: increasing-speed queued arrivals, without a loss condition.
- Hint budget: three hints/peeks total.
- No hint: no hints or peeks.

All eleven presets are enabled and `presentation.groups` is empty. The existing single
`(tangram, UTC date)` daily board remains authoritative. Helpers, reset and
removing placed pieces are replayed. Reset keeps the seed, time and spent help. New silhouette is removed; Next retains the shared cross-family sequence.
Hint places one reference piece and safely removes conflicts; Peek shows a
short reference overlay and spends the same assistance budget. The witness
never judges the player's solution or appears in the issued round JSON.

The Stage owns its two-column layout and right-rail footer. Card presentation,
SiteHeader, result persistence and the engine contract stay shared. Motion
lives in this family only. The 844×390 landscape layout must not copy the demo's
collapsed portrait breakpoint. No new dependencies, audio or generic shell API.

Design and limits: [accepted brief](../../../../docs/briefs/v1.4.4-tangram-codex-brief.md).
Focused checks passed: 26 unit cases, 11 real-D1 cases, 23 single-worker Chromium
cases, 33 solved and 66 rejected vectors in each of six runtimes, scoped lint/types
(0 errors, 0 warnings), boundaries, build and lazy isolation. Full verification and
physical-device review were not performed. Owner functional acceptance remains
pending; no commit, push or deployment is authorized.

The convex grid research reference is Onmywaybackhome's public-domain
[thirteen convex solutions](https://commons.wikimedia.org/wiki/File:Tangrams_convex_solutions.svg).
The integer mathematical outlines are redrawn here and each decomposition is
checked independently by the exact engine. House/Cat/Swan retain the supplied
demo's candidate arrangements only after the same reproof. Bird and Boat are
own assemblies; no copyrighted puzzle-book silhouette is copied. The genuine
Sei cut research source is Fox-Epstein and Uehara, CCCG 2014,
[Figure 1](https://www.cccg.ca/proceedings/2014/papers/paper56.pdf).

Ranked replay retains the shared saver's existing zero-second opening preflight.
That preflight verifies geometry; the subsequent positive authoritative elapsed
replay enforces countdown/arrival times. Every rankable claim is at least five
seconds, so the arrival bound remains enforced for ranked scores. A zero-active-
time save is below the floor and is unranked. No shared saver change is needed.
