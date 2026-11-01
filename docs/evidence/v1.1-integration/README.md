# Actual Card integration — 2026-10-28

Review the [actual local app](http://localhost:5173/play).
The owner approved the demo animations and authorized this integration.
Real-app device review and the remaining Work 2 visual pass stay open.

The app keeps one persistent outer frame around the real game view. A fresh
random Card entry settles at the centre, flips, unfolds, then releases the
game's own entrance. Memory retains its full preview/hide before input/timing.
Completed rounds save before presentation, fold into the session stack, and
show the actual result/account controls. Only the large score scrambles.
Next keeps the accepted exit; failed preparation restores the finished result.

- [Desktop Memory](memory-desktop.png)
- [Desktop result](result-desktop.png)
- [Desktop Block after Next](block-next-desktop.png)
- [Phone result](result-phone.png)
- [Phone landscape result](result-landscape.png)
- [Firefox desktop result](result-firefox.png)
- [WebKit desktop result](result-webkit.png)
- [Installed Google Chrome result](result-chrome.png)
- [Desktop frame/opacity samples](frames-desktop.json)
- [Phone frame/opacity samples](frames-phone.json)
- [Preloaded Next diagnostic measurements](preparation-measurements.json)
- [Verification summary](verification.json)

`tests/e2e/app-card.spec.ts` runs the real Memory completion → result → Next
flow at 390×844, 844×390, 1280×800 and 1920×923 in Chromium, Firefox and WebKit.
It checks a single persistent centred frame, monotonic result arrival, real
account links, viewport fit and duplicate-Next protection. A separate ten-pair
resize regression preserves round/card identity while switching four to five
columns. That check found stale frame widths caused by measuring before
reactive reflow and by tiny global reduced-motion CSS transitions in
Firefox/WebKit; measured containers now exclude those size transitions.

Shared proof checks retain visibility/static fallbacks and early Next from the
current visual frame. Preparation tests retain slow/failed Worker/storage,
retry/family preservation and cached Next behavior. Account/browser regressions
exercise durable completion before animation, storage warnings, save retries,
ranked history and deletion. Local D1 tests verify the server-owned opening
allowance and legacy-session compatibility; the client cannot supply it.

The full local log is `build/v1.1-integration/verify-final.log`; additional
installed Chrome output is `build/v1.1-integration/chrome.log`. All captures
use local guest data and unthrottled localhost, without production changes.
Frame samples verify sequence/geometry, not physical-device frame rate.
The five-run Next measurements use preloaded solo Memory and reduced motion;
they stop at the next-round DOM before its own entrance/preview. They do not
establish cold phone/4G or public-launch performance acceptance.

Verification is recorded across the full pipeline and focused browser rechecks.
Older account/layout/input/selector probes assumed the previous startup duration,
read the active scramble overlay, or matched error-container text that now
includes retry/Home controls. They now wait for logical readiness, the settled
score or the error paragraph while retaining their behavioral/layout checks.
A parallel recheck also removed a shared Playwright artifact during desktop
cleanup; rechecks use isolated output folders. The verification summary records
the initial failures and their final rechecks rather than presenting that first
pipeline run as a clean pass.
The WebKit controlled-clock proof allows one RAF at the fold/result boundary,
then still requires progressive fade/rise and the unchanged settled state.
All 131 browser cases have passing evidence across the primary run and focused
rechecks; the primary command itself ended with 119 passes and 12 failures.

No deployment, secret installation, remote migration, DNS or Google changes.
