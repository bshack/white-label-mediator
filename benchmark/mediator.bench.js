'use strict';

const {EventEmitter, setMaxListeners} = require('node:events');
const {performance} = require('node:perf_hooks');
const Mediator = require('../dist');

const rounds = 7;

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
    eventTargetMs: benchmarkSharedSignal(EventTarget, listeners).toFixed(2),
    mediatorMs: benchmarkSharedSignal(Mediator, listeners).toFixed(2)
})));
console.log('Medians of seven rounds. EventEmitter approximates the v4 Node runtime path.');
console.log('Publish columns include CustomEvent allocation; reused dispatch isolates dispatch cost.');
console.log('Shared-signal cases include registration and abort-driven cleanup.');
console.log('Benchmarks are diagnostic only and do not enforce CI thresholds.');
