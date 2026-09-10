# Event adapter measurements

Build the package, then pass the pre-optimization PR commit to the Node runner:

```sh
npm run build
node benchmark/run.js 80690e233b72a38968a46078de3c119b28ede93f > /tmp/events-results.json
```

For Model, the equivalent baseline commit is `6b504dad44557f5d1596a19e7c70870fa0db84a3`.
The baseline adapter source and generated code are identical between these commits.
The runner loads the baseline using `git show`, without altering the checkout,
and uses the same locked EventEmitter3 dependency for both adapters.

## Method

Compare npm `events@3.3.0` (explicit `events/`, not Node's built-in module), the
original PR adapter, and the optimized adapter. Each workload has one warm-up,
seven measured samples, and rotated backend order. Results contain every sample
and the median in microseconds per workload. Node uses 1, 10, 100, and 1,000
listeners on a single event; browser runs use 1, 10, and 100. Each sample repeats
the workload `max(100, floor(100000 / listenerCount))` times. These synthetic
microbenchmarks do not estimate application responsiveness or retained heap.

- Registration/prepend include constructing and populating an emitter.
- Cold dispatch includes registration and the first emission, exposing deferred setup cost.
- Churn adds/removes one distinct callback on an already populated event.
- Churn/emit also dispatches after each add/remove pair.
- Stable dispatch primes the dispatch cache outside timing; one- and six-argument cases are separate.
- Once cycle includes construction, registration, and one emission.
- Cleanup measures removal from a prebuilt batch, with and without removal observers.

Listener limits are disabled equally for all implementations. Setup for stable
dispatch/churn and cleanup is outside the timed region. Callbacks update a
returned accumulator; registration results escape the timed loop. Garbage
collection, timer precision, JIT compilation, and host load affect measurements.
Browser medians of zero mean below timer resolution, not zero-cost operations;
do not calculate speedup ratios from those rows. Tiny differences should not be
treated as statistically established wins. No performance threshold is added to CI.

## Browser reproduction

Install esbuild in a temporary tooling directory, outside this package. The
recorded run used esbuild 0.25.10. Substitute its executable path below:

```sh
git show 80690e233b72a38968a46078de3c119b28ede93f:dist/browser-event-emitter.js > /tmp/white-label-baseline.cjs
esbuild benchmark/browser.js --bundle --platform=browser --alias:benchmark-baseline=/tmp/white-label-baseline.cjs --alias:eventemitter3=./node_modules/eventemitter3 --outfile=/tmp/white-label-browser.js
```

For Model, use its baseline SHA above. Serve the output alongside a local HTML
page containing a `button`, an `output` inside a `pre`, and a script tag loading
`white-label-browser.js`. Click the button; the final output is the JSON result.
The browser runner yields between listener counts to keep progress visible.
Do not run Node and browser benchmarks simultaneously.

See [the source review](../docs/eventemitter3-review.md) and
[recorded results](../docs/events-performance.md) for implementation decisions,
measured tradeoffs, and validation limits.
