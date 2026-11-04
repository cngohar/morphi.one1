# Slice 6 local performance measurements

Created: 2026-11-04T01:36:18.671Z. Chromium 156.0.8078.4. 5 runs per profile/state.
Host: AMD PRO A8-8650B R7, 10 Compute Cores 4C+6G, linux 7.0.0-38-generic.

Desktop Chromium — local host CPU: 1280×800, CPU 1×, fast (20 ms latency, 40/10 Mbps down/up).
Google Pixel 7a reference — Chromium emulation, not physical hardware: 412×915, CPU 4×, throttled 4G (150 ms latency, 1.6/0.75 Mbps down/up).

| Profile/state                                                                          | Metric                                              |   n |        p50 |        p95 | Local goal | Result                  |
| -------------------------------------------------------------------------------------- | --------------------------------------------------- | --: | ---------: | ---------: | ---------: | ----------------------- |
| Desktop Chromium — local host CPU / cold                                               | Home LCP (ms)                                       |   5 |    216.000 |    284.000 |       2500 | met in this lab profile |
| Desktop Chromium — local host CPU / cold                                               | INP lab interaction proxy (ms)                      |   5 |     64.000 |     72.000 |        200 | met in this lab profile |
| Desktop Chromium — local host CPU / cold                                               | Home CLS                                            |   5 |      0.001 |      0.001 |        0.1 | met in this lab profile |
| Desktop Chromium — local host CPU / cold                                               | CLS through Play                                    |   5 |      0.033 |      0.058 |        0.1 | met in this lab profile |
| Desktop Chromium — local host CPU / cold                                               | Critical Home transfer (bytes)                      |   5 | 152894.000 | 152894.000 |     150000 | goal missed             |
| Desktop Chromium — local host CPU / cold                                               | Play to playable, including accepted entrances (ms) |   5 |   5385.200 |   8639.100 |        300 | goal missed             |
| Desktop Chromium — local host CPU / idle-preloaded                                     | Home LCP (ms)                                       |   5 |    204.000 |    224.000 |       2500 | met in this lab profile |
| Desktop Chromium — local host CPU / idle-preloaded                                     | INP lab interaction proxy (ms)                      |   5 |     72.000 |     72.000 |        200 | met in this lab profile |
| Desktop Chromium — local host CPU / idle-preloaded                                     | Home CLS                                            |   5 |      0.001 |      0.001 |        0.1 | met in this lab profile |
| Desktop Chromium — local host CPU / idle-preloaded                                     | CLS through Play                                    |   5 |      0.053 |      0.061 |        0.1 | met in this lab profile |
| Desktop Chromium — local host CPU / idle-preloaded                                     | Critical Home transfer (bytes)                      |   5 | 152894.000 | 153440.000 |     150000 | goal missed             |
| Desktop Chromium — local host CPU / idle-preloaded                                     | Play to playable, including accepted entrances (ms) |   5 |   8572.100 |  10595.900 |        300 | goal missed             |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / cold           | Home LCP (ms)                                       |   5 |    684.000 |    712.000 |       2500 | met in this lab profile |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / cold           | INP lab interaction proxy (ms)                      |   5 |    104.000 |    104.000 |        200 | met in this lab profile |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / cold           | Home CLS                                            |   5 |      0.000 |      0.000 |        0.1 | met in this lab profile |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / cold           | CLS through Play                                    |   5 |      0.088 |      0.091 |        0.1 | met in this lab profile |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / cold           | Critical Home transfer (bytes)                      |   5 | 152894.000 | 152894.000 |     150000 | goal missed             |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / cold           | Play to playable, including accepted entrances (ms) |   5 |   5790.000 |  11290.600 |        300 | goal missed             |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / idle-preloaded | Home LCP (ms)                                       |   5 |    696.000 |    708.000 |       2500 | met in this lab profile |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / idle-preloaded | INP lab interaction proxy (ms)                      |   5 |     96.000 |     96.000 |        200 | met in this lab profile |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / idle-preloaded | Home CLS                                            |   5 |      0.000 |      0.000 |        0.1 | met in this lab profile |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / idle-preloaded | CLS through Play                                    |   5 |      0.088 |      0.093 |        0.1 | met in this lab profile |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / idle-preloaded | Critical Home transfer (bytes)                      |   5 | 152894.000 | 152894.000 |     150000 | goal missed             |
| Google Pixel 7a reference — Chromium emulation, not physical hardware / idle-preloaded | Play to playable, including accepted entrances (ms) |   5 |   6073.300 |   9189.900 |        300 | goal missed             |

- Expected ERR_ABORTED cancellations when leaving Home are retained per sample; they are not failed loads. Other network failures and page errors fail the sample, and actual playable-stage arrival is required.
- Kill switches: per-family lifecycle/zero weights control availability; the global ranked switch is enforced by server issuance and replay. Play, recovery and Next recheck availability, and an availability failure serves no fallback family. Save-Data/slow connections skip idle speculation.
- Missing/invalid versioned configuration uses typed defaults or the previous valid parent. Unknown families are rejected; missing game weights default to 1. Existing local defaults initialize catalog games enabled and permit ranked play unless explicitly switched off, still requiring authentication, caps, TTL and authoritative replay. The guest publication has no account backend; anonymous measurement remains consent-gated and off by default. These local defaults do not authorize a public account release or production flag setup.
- Resumed 0 matching saved samples. Each new successful sample is saved atomically in checkpoint.json; source/build/profile/origin/browser/host fingerprints must match to reuse it. Checkpoints, including stale copies, remain until Slice 6 fully passes.
- Built local Worker only; no deployment or production measurements. Sequential samples, one Chromium instance, fresh browser context per sample; browser caches explicitly cleared before every navigation.
- Cold: HTTP cache disabled, click as soon as Play is hydrated; preload may race ahead and its observed ready timestamp is retained. Idle-preloaded: HTTP cache enabled only inside the fresh context; await the actual first-puzzle preload mark, with a 30-second bound. No warmed page navigation is reused.
- Pixel 7a is a named midrange reference profile using Pixel 7 viewport/touch emulation and 4x host CPU slowdown, not calibrated Pixel 7a hardware. Physical phone, real network, GPU/thermal behavior and production edge compression remain unmeasured.
- LCP and Home CLS end at Play. CLS uses the largest session window (1-second gap, maximum 5 seconds) excluding recent-input shifts; clsThroughPlay is also retained.
- INP is an Event Timing lab interaction proxy for the short scripted Play interaction, not field INP or a full-session p75. Event durations use a 16-ms reporting threshold plus buffered first-input; null means no recorded interaction, never fabricated zero.
- Critical transfer is navigation.transferSize plus document resource entries started by Home LCP. This includes estimated HTTP headers and actual locally delivered encoded bodies, may include noncritical early requests, and excludes Worker-internal fetches. Full Home resource timings and transferred bytes at Play are retained separately; edge gzip/Brotli is not assumed.
- Play feedback is two requestAnimationFrame callbacks after the trusted click, a next-frame proxy; Play-to-playable waits for the actual playing stage and game plus a rendering opportunity. Normal accepted Card entrances and Memory preview remain enabled and count toward that timing.
- Next preparation/feedback/playability and full-session gameplay interactions are not measured by this Home/first-Play harness. Historical Next goals remain outstanding unless separately evidenced.
- Optional physical-device drill: use Chrome remote debugging on the local-network built Worker, install collector.js before reloading through DevTools Local Overrides or an automation init script, and collect window.__morphiPerformance plus navigation/resource timings. Run five fresh-cache and five marked-preload samples; report actual model/browser/network. This is a manual procedure, not physical evidence.

- <https://web.dev/articles/cls>
- <https://web.dev/articles/inp>
- <https://chromedevtools.github.io/devtools-protocol/tot/Network/>
- <https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session>
