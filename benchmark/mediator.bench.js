'use strict';

const EventEmitter = require('events');
const Mediator = require('../dist');
const { performance } = require('node:perf_hooks');

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

function formatComparison(mediatorTime, emitterTime) {
    const difference = ((mediatorTime / emitterTime) - 1) * 100;
    const sign = difference >= 0 ? '+' : '';
    return `${sign}${difference.toFixed(1)}%`;
}

function benchmarkEmit(listenerCount) {
    const iterations = Math.max(10_000, Math.floor(10_000_000 / listenerCount));
    const listener = () => {};

    function run(Emitter) {
        const emitter = new Emitter();
        emitter.setMaxListeners(0);

        for (let index = 0; index < listenerCount; index += 1) {
            emitter.on('event', listener);
        }

        for (let index = 0; index < 10_000; index += 1) {
            emitter.emit('event', index);
        }

        return measure(() => {
            for (let index = 0; index < iterations; index += 1) {
                emitter.emit('event', index);
            }
        });
    }

    const emitterTime = run(EventEmitter);
    const mediatorTime = run(Mediator);

    return {
        operation: `emit (${listenerCount} listener${listenerCount === 1 ? '' : 's'})`,
        iterations,
        emitterMs: emitterTime.toFixed(2),
        mediatorMs: mediatorTime.toFixed(2),
        delta: formatComparison(mediatorTime, emitterTime)
    };
}

function benchmarkListenerLifecycle() {
    const iterations = 250_000;
    const listener = () => {};

    function run(Emitter) {
        const emitter = new Emitter();

        return measure(() => {
            for (let index = 0; index < iterations; index += 1) {
                emitter.on('event', listener);
                emitter.removeListener('event', listener);
            }
        });
    }

    const emitterTime = run(EventEmitter);
    const mediatorTime = run(Mediator);

    return {
        operation: 'on + removeListener',
        iterations,
        emitterMs: emitterTime.toFixed(2),
        mediatorMs: mediatorTime.toFixed(2),
        delta: formatComparison(mediatorTime, emitterTime)
    };
}

function benchmarkOnce() {
    const iterations = 100_000;
    const listener = () => {};

    function run(Emitter) {
        const emitter = new Emitter();

        return measure(() => {
            for (let index = 0; index < iterations; index += 1) {
                emitter.once('event', listener);
                emitter.emit('event', index);
            }
        });
    }

    const emitterTime = run(EventEmitter);
    const mediatorTime = run(Mediator);

    return {
        operation: 'once + emit',
        iterations,
        emitterMs: emitterTime.toFixed(2),
        mediatorMs: mediatorTime.toFixed(2),
        delta: formatComparison(mediatorTime, emitterTime)
    };
}

function benchmarkDestroy() {
    const iterations = 100_000;
    const listener = () => {};

    return {
        operation: 'destroy',
        iterations,
        mediatorMs: measure(() => {
            for (let index = 0; index < iterations; index += 1) {
                const mediator = new Mediator();
                mediator.on('event', listener);
                mediator.destroy();
            }
        }).toFixed(2)
    };
}

const results = [
    benchmarkEmit(1),
    benchmarkEmit(10),
    benchmarkEmit(100),
    benchmarkEmit(1_000),
    benchmarkListenerLifecycle(),
    benchmarkOnce(),
    benchmarkDestroy()
];

console.table(results);
console.log('Times are medians of five rounds. Lower is better; delta compares Mediator with EventEmitter.');
console.log('Benchmarks are diagnostic only and intentionally do not enforce CI thresholds.');
