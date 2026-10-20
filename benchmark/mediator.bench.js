'use strict';

// Diagnostic benchmark comparing Mediator with native EventTarget and EventEmitter.
// Run with `npm run benchmark` (builds first). It is not part of the gate or CI.
// Results are medians of several rounds and enforce no thresholds.
//
// Node's native EventTarget is quadratic in two signal cases (shared signal add +
// abort, and duplicate add with signal), which alone take more than 30 minutes. Their
// native baseline columns are skipped unless you pass the flag:
//   npm run benchmark -- --include-native-quadratic
// The Mediator columns for those cases always run.

const {EventEmitter, setMaxListeners} = require('node:events');
const {performance} = require('node:perf_hooks');
const Mediator = require('../dist');

const rounds = 7;
const includeNativeQuadratic = process.argv.includes('--include-native-quadratic');
const skipped = 'skipped (--include-native-quadratic)';

// Native EventTarget baseline for the quadratic cases, or a placeholder when skipped.
function nativeQuadratic(run) {
    return includeNativeQuadratic ? run().toFixed(2) : skipped;
}

function median(values) {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
}

function measure(callback) {
    const samples = [];
    for (let round = 0; round < rounds; round += 1) {
        const start = performance.now();
        callback();
        samples.push(performance.now() - start);
    }
    return median(samples);
}

function addListeners(target, listenerCount, add) {
    for (let index = 0; index < listenerCount; index += 1) {
        add(target, () => index);
    }
}

function benchmarkEmitter(listenerCount, iterations) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    addListeners(emitter, listenerCount, (target, listener) => target.on('event', listener));
    return measure(() => {
        for (let index = 0; index < iterations; index += 1) {
            emitter.emit('event', index);
        }
    });
}

function benchmarkTarget(Target, listenerCount, iterations, reuseEvent) {
    const target = new Target();
    setMaxListeners(0, target);
    addListeners(target, listenerCount, (instance, listener) => instance.addEventListener('event', listener));
    const event = new CustomEvent('event', {detail: 1});
    return measure(() => {
        for (let index = 0; index < iterations; index += 1) {
            target.dispatchEvent(reuseEvent ? event : new CustomEvent('event', {detail: index}));
        }
    });
}

function benchmarkLifecycle(Target, iterations) {
    const callback = () => {};
    const target = new Target();
    setMaxListeners(0, target);
    return measure(() => {
        for (let index = 0; index < iterations; index += 1) {
            target.addEventListener('event', callback);
            target.removeEventListener('event', callback);
        }
    });
}

function benchmarkSharedSignal(Target, listenerCount) {
    return measure(() => {
        const target = new Target();
        const controller = new AbortController();
        setMaxListeners(0, target, controller.signal);
        for (let index = 0; index < listenerCount; index += 1) {
            target.addEventListener(`event:${index}`, () => {}, {signal: controller.signal});
        }
        controller.abort();
    });
}

function benchmarkDuplicateSignal(Target, iterations) {
    const target = new Target();
    const controller = new AbortController();
    const callback = () => {};
    setMaxListeners(0, target, controller.signal);
    target.addEventListener('event', callback);
    return measure(() => {
        for (let index = 0; index < iterations; index += 1) {
            target.addEventListener('event', callback, {signal: controller.signal});
        }
    });
}

function benchmarkPreAbortedSignal(Target, iterations) {
    const target = new Target();
    const controller = new AbortController();
    const callback = () => {};
    controller.abort();
    setMaxListeners(0, target, controller.signal);
    return measure(() => {
        for (let index = 0; index < iterations; index += 1) {
            target.addEventListener('event', callback, {signal: controller.signal});
        }
    });
}

const cases = [
    {listeners: 1, iterations: 500_000},
    {listeners: 10, iterations: 100_000},
    {listeners: 100, iterations: 20_000}
];

const results = cases.map(({listeners, iterations}) => ({
    listeners,
    iterations,
    eventEmitterMs: benchmarkEmitter(listeners, iterations).toFixed(2),
    eventTargetReusedMs: benchmarkTarget(EventTarget, listeners, iterations, true).toFixed(2),
    eventTargetPublishMs: benchmarkTarget(EventTarget, listeners, iterations, false).toFixed(2),
    mediatorPublishMs: benchmarkTarget(Mediator, listeners, iterations, false).toFixed(2)
}));

console.table(results);
console.table([{
    operation: 'add + remove',
    iterations: 100_000,
    eventTargetMs: benchmarkLifecycle(EventTarget, 100_000).toFixed(2),
    mediatorMs: benchmarkLifecycle(Mediator, 100_000).toFixed(2)
}]);
console.table([100, 1_000, 10_000].map(listeners => ({
    operation: 'shared signal add + abort',
    listeners,
    eventTargetMs: nativeQuadratic(() => benchmarkSharedSignal(EventTarget, listeners)),
    mediatorMs: benchmarkSharedSignal(Mediator, listeners).toFixed(2)
})));
console.table([{
    operation: 'duplicate add with signal',
    iterations: 100_000,
    eventTargetMs: nativeQuadratic(() => benchmarkDuplicateSignal(EventTarget, 100_000)),
    mediatorMs: benchmarkDuplicateSignal(Mediator, 100_000).toFixed(2)
}, {
    operation: 'pre-aborted signal add',
    iterations: 100_000,
    eventTargetMs: benchmarkPreAbortedSignal(EventTarget, 100_000).toFixed(2),
    mediatorMs: benchmarkPreAbortedSignal(Mediator, 100_000).toFixed(2)
}]);
console.log('Medians of seven rounds. EventEmitter approximates the v4 Node runtime path.');
console.log('Publish columns include CustomEvent allocation; reused dispatch isolates dispatch cost.');
console.log('Signal cases include registration and, where applicable, abort-driven cleanup.');
if (!includeNativeQuadratic) {
    console.log('Quadratic native EventTarget baselines were skipped; pass --include-native-quadratic to run them.');
}
console.log('Benchmarks are diagnostic only; `npm run bench:ci` is the thresholded CI check.');
