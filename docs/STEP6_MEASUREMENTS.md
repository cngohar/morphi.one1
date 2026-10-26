# Local Step 6 replay measurements

Measured 2026-10-23 using `bun run measure:replay`. This is local replay evidence, not a production load/capacity claim.

## Method

- Device: AMD PRO A8-8650B R7, 10 Compute Cores 4C+6G, Linux desktop development machine.
- Runtime: Node v24.14.1; local workerd from the installed Wrangler 4.151.3 toolchain. Bun 1.4.2 orchestrates the scripts.
- Network: none during pure replay. The Worker inspector uses localhost; network, authentication, database, and response costs are excluded from the CPU figures.
- State: warmed with 100 replays before measurement. Five batches of 1,000 replays per workload. Median and p95 below are calculated from the five per-batch average CPU times per replay (nearest-rank p95); they are not individual-request tail-latency statistics.
- Workloads: a valid 300-placement Block run, seed 784, ending at the cap; and a valid 120-flip/60-attempt, ten-pair Memory run at its log cap. The Block benchmark fixture is a measurement input; the pre-existing seed-0 golden scoring vector remains independent evidence.
- Node CPU: `process.cpuUsage`, user plus system CPU, divided by the batch count.
- Worker CPU: V8 inspector profiler, 100 μs sampling interval, summing samples in `replayBatch` and its descendants. These are sampled local CPU estimates, not Cloudflare production billing measurements.
- Memory: maximum of five post-batch heap observations; Worker figures use `Runtime.getHeapUsage`. Node also records whole-process peak resident memory. Post-batch observations do not capture allocation-time peak isolate memory.

## Results

| Runtime       | Workload | Moves     | Median CPU/replay | p95 batch-average CPU/replay | Maximum observed used heap | Maximum observed allocated heap |
| ------------- | -------- | --------- | ----------------- | ---------------------------- | -------------------------- | ------------------------------- |
| Node          | Block    | 300       | 1.206 ms          | 1.406 ms                     | 7,397,992 B                | not sampled                     |
| Node          | Memory   | 120 flips | 0.0712 ms         | 0.0975 ms                    | 7,695,640 B                | not sampled                     |
| local workerd | Block    | 300       | 0.750 ms          | 0.768 ms                     | 2,127,772 B                | 6,553,600 B                     |
| local workerd | Memory   | 120 flips | 0.0540 ms         | 0.0721 ms                    | 4,042,988 B                | 10,747,904 B                    |

Node whole-process peak RSS was 61,340 KiB after Block and 63,140 KiB after Memory. These include runtime overhead and are not per-replay allocations. All figures come from the same successful local measurement run.

## Interpretation and remaining evidence

Bounded replay is comfortably small in these local observations. The implementation caps payloads at 64 KiB, Block at 300 placements, and Memory at six attempts per pair. The limits and local cost measurement are release evidence; a new numeric production CPU guarantee has not been invented. The long plan's production runtime/heap limits must be rechecked before provisioning.

True peak production-isolate memory, cold HTTP request cost including auth/D1, concurrent-player capacity, and real-phone/network performance remain unmeasured. No waiver or production capacity pass is claimed. Keep these limitations in the global-release plan and the owner acceptance report.

Cross-runtime known vectors pass in Node, Bun, Chromium, Firefox, WebKit, and local workerd with SHA-256 fingerprint `a8be9d5fdacc1818c3d078be2fa014cb279c349d6ba7313029f9a363b40b0ac4`. The independently generated Python Memory fixtures and pre-existing Block/RNG vectors are in `tests/vectors/`.

The built application Worker is additionally exercised against a separate temporary local D1 by `bun run test:worker`: real signed sessions, private profile, server-issued ranked start, authoritative timed replay/save, identical retries, one stored result, leaderboard display, account deletion, and session revocation. It adds no fixture endpoint to the app.

Cloudflare documents why ordinary Worker timers are insufficient for synchronous CPU profiling: [profiling CPU usage](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/). The measurement harness uses the inspector rather than treating `performance.now()` as an authoritative Worker CPU measurement.
