'use strict';

const Mediator = require('../dist');
const {performance} = require('node:perf_hooks');

const rounds = 5;

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

function benchmarkDispatch(Target, listenerCount) {
    const iterations = Math.max(10_000, Math.floor(2_000_000 / listenerCount));
    const target = new Target();
    for (let index = 0; index < listenerCount; index += 1) {
        target.addEventListener(`event:${index}`, () => {});
    }
    const event = new CustomEvent('event:0', {detail: 1});
    return measure(() => {
        for (let index = 0; index < iterations; index += 1) {
            target.dispatchEvent(event);
        }
    });
}

function benchmarkLifecycle() {
    const iterations = 100_000;
    return measure(() => {
        for (let index = 0; index < iterations; index += 1) {
            const mediator = new Mediator();
            mediator.addEventListener('event', () => {});
            mediator.destroy();
        }
    });
}

const results = [1, 10, 100].map(listenerCount => ({
    operation: `dispatch (${listenerCount} registered type${listenerCount === 1 ? '' : 's'})`,
    eventTargetMs: benchmarkDispatch(EventTarget, listenerCount).toFixed(2),
    mediatorMs: benchmarkDispatch(Mediator, listenerCount).toFixed(2)
}));
results.push({operation: 'add + destroy', mediatorMs: benchmarkLifecycle().toFixed(2)});

console.table(results);
console.log('Times are medians of five rounds. Benchmarks are diagnostic only and do not enforce CI thresholds.');
