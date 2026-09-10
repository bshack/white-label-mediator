# Browser adapter optimization results

Measured September 9, 2026 on an Apple M5 Pro, macOS arm64. The Node run uses
Node 24.19.0; the browser run uses Chrome 152 in the Codex in-app browser with
esbuild 0.25.10. The identical adapter implementation is used in Model and Mediator.
These measurements isolate the emitter backend; they do not time a complete
application or Model's mutation/relay work.

## Result

The optimization removes most of the original adapter's avoidable registration
and cleanup cost. At 100 listeners in the browser, registration improved from
23.9 to 1.3 microseconds (about 18x), cold registration-and-dispatch from 24.2 to
2.0 microseconds (about 12x), and a once cycle from 52.2 to 9.5 microseconds
(about 5.5x). Stable one-argument dispatch measured 0.3 microseconds for both
adapter versions.

There is still overhead compared with the previous npm events implementation.
At 100 listeners in the browser, cold dispatch is 2.0 versus 1.3 microseconds;
churn followed immediately by dispatch is 0.8 versus 0.4 microseconds; and once
cycles are 9.5 versus 7.3 microseconds. Six-argument stable dispatch is 0.7 versus
0.6 microseconds. At one listener, observed cleanup is 0.347 versus 0.104
microseconds. This is an improvement to the proposed adapter, not a universal
performance win over the previous dependency.

## Measurements

All numbers below are median microseconds per workload, not per listener.
Lower is better. A zero browser reading means below timer resolution, not free.
Tiny differences and ratios using near-zero values are not reliable conclusions.

### Browser, 100 listeners

| Workload | Previous events | Original adapter | Optimized adapter |
| --- | ---: | ---: | ---: |
| Register all | 0.900 | 23.900 | 1.300 |
| Register all + first emit | 1.300 | 24.200 | 2.000 |
| Prepend all | 2.000 | 24.100 | 2.200 |
| Add/remove one | below resolution | 0.900 | below resolution |
| Add/remove one + emit | 0.400 | 1.300 | 0.800 |
| Stable emit, 1 argument | 0.500 | 0.300 | 0.300 |
| Stable emit, 6 arguments | 0.600 | 0.700 | 0.700 |
| Register all once + emit | 7.300 | 52.200 | 9.500 |
| Remove all, no observers | below resolution | 23.700 | below resolution |
| Remove all, with observer | 2.900 | 24.300 | 3.200 |

### Node, 100 listeners

| Workload | Previous events | Original adapter | Optimized adapter |
| --- | ---: | ---: | ---: |
| Register all | 0.993 | 41.654 | 1.301 |
| Register all + first emit | 1.456 | 41.056 | 2.184 |
| Prepend all | 2.343 | 29.435 | 3.055 |
| Add/remove one | 0.020 | 1.284 | 0.032 |
| Add/remove one + emit | 0.536 | 1.722 | 0.893 |
| Stable emit, 1 argument | 0.511 | 0.388 | 0.417 |
| Stable emit, 6 arguments | 0.596 | 0.684 | 0.675 |
| Register all once + emit | 7.835 | 65.822 | 11.028 |
| Remove all, no observers | 0.022 | 28.366 | 0.029 |
| Remove all, with observer | 2.699 | 28.988 | 3.266 |

### Node stress case, 1,000 listeners

| Workload | Previous events | Original adapter | Optimized adapter |
| --- | ---: | ---: | ---: |
| Register all | 9.955 | 4242.372 | 12.737 |
| Register all + first emit | 14.905 | 4173.420 | 21.712 |
| Prepend all | 54.462 | 2891.853 | 60.720 |
| Add/remove one | 0.027 | 14.528 | 0.040 |
| Add/remove one + emit | 5.605 | 20.527 | 11.058 |
| Stable emit, 1 argument | 5.573 | 4.096 | 4.025 |
| Stable emit, 6 arguments | 6.016 | 6.822 | 6.977 |
| Register all once + emit | 489.466 | 6688.085 | 789.080 |
| Remove all, no observers | 0.017 | 2607.666 | 0.031 |
| Remove all, with observer | 27.088 | 2617.659 | 29.926 |

## Method and evidence

The harness uses seven samples after warm-up and rotates backend order. Setup is
excluded for stable dispatch/churn and for cleanup. Cold dispatch includes all
registration and the first emission, so lazy setup remains visible. Node samples
cover 1, 10, 100, and 1,000 listeners; browser samples cover 1, 10, and 100.
The machine was not an isolated performance lab. Medians reflect
host load, JIT, garbage collection, and clock precision. No heap/GC profiling or
statistical confidence interval is claimed.

- [Harness and reproduction instructions](../benchmark/README.md)
- [Node raw samples and medians](../benchmark/results/node.json)
- [Browser medians captured from visible output](../benchmark/results/browser.json)
- [Upstream source review and design decisions](eventemitter3-review.md)

The previous adapter is loaded from Mediator commit
`80690e233b72a38968a46078de3c119b28ede93f`, identical to the adapter in Model
commit `6b504dad44557f5d1596a19e7c70870fa0db84a3`. Both adapters resolve the same
pinned EventEmitter3 5.0.4 dependency. The prior browser emitter is explicitly
`require('events/')` at 3.3.0, not Node's native EventEmitter. Upstream benchmark
claims are not substituted for these measurements.

## Validation and remaining limits

The pre-change suites passed: 62 Mediator and 216 Model tests. The optimized
implementation passes 87 Mediator and 241 Model tests, including differential
checks against Node and npm events, with 100% per-file statements, branches,
functions, and lines. Build, consumer types, and strict typecheck pass.
Package dry-runs and whitespace checks pass; both dependency audits report zero vulnerabilities.
No standalone lint/format script is configured, so no lint pass is claimed.
Both package smoke bundles pass in the actual Codex browser; their input lists
include EventEmitter3 and exclude the events polyfill.

The source, generated adapter output, and adapter tests remain identical across
Model and Mediator. Node runtime entry points are unchanged. No project dependency,
package-version, public API, or CI configuration change is made by this optimization.
A compatible optimization would be a patch-level change in a future release;
this task does not publish or merge it.

Individual removal and prepend remain O(n). The first emission after removal or
prepend has O(n) rebuild work. Large once batches can still have O(n²) total
removal work, and reentrant removal observers can force repeated rebuilds. These
remaining costs are why a blanket no-regression or faster-than-events claim would
be misleading. No full downstream application, additional browser engine, complete
bundler matrix, or retained-memory profile was tested.
