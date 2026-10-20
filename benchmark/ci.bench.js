'use strict';

// Short CI benchmark: Mediator paths only, small iteration counts, no native
// EventTarget baseline (two native cases are quadratic; see mediator.bench.js).
// Run with `npm run bench:ci` (builds first). It compares each case's median time
// per operation with benchmark/baseline.json and fails only when a case is more
// than `tolerance` times slower, so runner noise does not fail CI. Deterministic
// counters (AbortSignal.any() calls) must match the baseline exactly.
//
// Refresh the baseline after an intended performance change, on a quiet machine:
//   npm run bench:ci -- --update-baseline

const fs = require('node:fs');
const path = require('node:path');
const {setMaxListeners} = require('node:events');
const {performance} = require('node:perf_hooks');
const Mediator = require('../dist');

const baselinePath = path.join(__dirname, 'baseline.json');
const tolerance = 3;
const rounds = 9;

function median(values) {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
}

// Median nanoseconds per operation; the first (warm-up) round is discarded.
function measure(iterations, setup, run) {
    const samples = [];
    for (let round = 0; round <= rounds; round += 1) {
        const state = setup();
        const start = performance.now();
        run(state, iterations);
        const elapsed = performance.now() - start;
        if (round > 0) {
            samples.push((elapsed * 1e6) / iterations);
        }
    }
    return median(samples);
}

function withListeners(count) {
    return () => {
        const mediator = new Mediator();
        for (let index = 0; index < count; index += 1) {
            mediator.addEventListener('event', () => index);
        }
        return mediator;
    };
}

function dispatch(mediator, iterations) {
    for (let index = 0; index < iterations; index += 1) {
        mediator.dispatchEvent(new CustomEvent('event', {detail: index}));
    }
}

const callback = () => {};

const timings = {
    'dispatch, 1 listener': measure(50_000, withListeners(1), dispatch),
    'dispatch, 10 listeners': measure(20_000, withListeners(10), dispatch),
    'add + remove': measure(50_000, () => new Mediator(), (mediator, iterations) => {
        for (let index = 0; index < iterations; index += 1) {
            mediator.addEventListener('event', callback);
            mediator.removeEventListener('event', callback);
        }
    }),
    'once add + dispatch': measure(20_000, () => new Mediator(), (mediator, iterations) => {
        const event = new Event('event');
        for (let index = 0; index < iterations; index += 1) {
            mediator.addEventListener('event', callback, {once: true});
            mediator.dispatchEvent(event);
        }
    }),
    'signal add + remove': measure(20_000, () => ({mediator: new Mediator(), signal: new AbortController().signal}), (state, iterations) => {
        for (let index = 0; index < iterations; index += 1) {
            state.mediator.addEventListener('event', callback, {signal: state.signal});
            state.mediator.removeEventListener('event', callback);
        }
    }),
    'destroy, per listener': measure(10_000, () => {
        const mediator = new Mediator();
        // 100 listeners per type would otherwise trigger Node's leak warning.
        setMaxListeners(0, mediator);
        return mediator;
    }, (mediator, iterations) => {
        // Includes adding the listeners; destroy() removes them all at once.
        for (let index = 0; index < iterations; index += 1) {
            mediator.addEventListener(`event:${index % 100}`, () => index);
        }
        mediator.destroy();
    })
};

// One private AbortSignal.any() per caller signal, shared across registrations and
// mediators (see src/AGENTS.md). These counts are exact, not timings.
function countAnyCalls(run) {
    const nativeAny = AbortSignal.any;
    let calls = 0;
    AbortSignal.any = function(signals) {
        calls += 1;
        return Reflect.apply(nativeAny, this, [signals]);
    };
    try {
        run();
    } finally {
        AbortSignal.any = nativeAny;
    }
    return calls;
}

const counters = {
    'AbortSignal.any calls, 1,000 add/remove cycles on one signal': countAnyCalls(() => {
        const mediator = new Mediator();
        const {signal} = new AbortController();
        for (let index = 0; index < 1_000; index += 1) {
            mediator.addEventListener('event', callback, {signal});
            mediator.removeEventListener('event', callback);
        }
    }),
    'AbortSignal.any calls, 10 mediators x 100 types on one signal': countAnyCalls(() => {
        const {signal} = new AbortController();
        for (let mediatorIndex = 0; mediatorIndex < 10; mediatorIndex += 1) {
            const mediator = new Mediator();
            for (let index = 0; index < 100; index += 1) {
                mediator.addEventListener(`event:${index}`, callback, {signal});
            }
        }
    }),
    'AbortSignal.any calls, 100 distinct signals': countAnyCalls(() => {
        const mediator = new Mediator();
        for (let index = 0; index < 100; index += 1) {
            mediator.addEventListener(`event:${index}`, callback, {signal: new AbortController().signal});
        }
    })
};

const round2 = value => Math.round(value * 100) / 100;
const current = {
    node: process.version,
    timingsNsPerOp: Object.fromEntries(Object.entries(timings).map(([name, value]) => [name, round2(value)])),
    counters
};

if (process.argv.includes('--update-baseline')) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    console.table(current.timingsNsPerOp);
    console.table(counters);
    console.log(`Baseline written to ${path.relative(process.cwd(), baselinePath)}.`);
    process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const failures = [];
const rows = [];

for (const [name, nsPerOp] of Object.entries(current.timingsNsPerOp)) {
    const expected = baseline.timingsNsPerOp[name];
    if (expected === undefined) {
        failures.push(`${name}: missing from baseline.json; refresh it with --update-baseline`);
        continue;
    }
    const ratio = nsPerOp / expected;
    rows.push({case: name, nsPerOp, baselineNsPerOp: expected, ratio: round2(ratio)});
    if (ratio > tolerance) {
        failures.push(`${name}: ${nsPerOp} ns/op is ${round2(ratio)}x the baseline ${expected} ns/op (limit ${tolerance}x)`);
    }
}
for (const [name, count] of Object.entries(counters)) {
    const expected = baseline.counters[name];
    rows.push({case: name, count, baselineCount: expected});
    if (count !== expected) {
        failures.push(`${name}: ${count}, baseline ${expected} (must match exactly)`);
    }
}

console.table(rows);
console.log(`Baseline recorded on Node ${baseline.node}; timings fail only above ${tolerance}x.`);
if (failures.length > 0) {
    console.error(`bench:ci failed:\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
}
