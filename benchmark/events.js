'use strict';

// Dependency-free harness shared by the Node runner and browser bundles.
// Timings are per workload (not per callback), in microseconds.
function runBenchmarks(backends, {samples = 7, sizes = [1, 10, 100, 1000]} = {}) {
    const results = [];
    let sink = 0;
    const listener = value => { sink += value; };
    const temporary = value => { sink += value; };
    const workloads = ['register', 'cold-dispatch', 'prepend', 'churn', 'churn-emit', 'dispatch', 'dispatch-6-args', 'once-cycle', 'cleanup', 'observed-cleanup'];
    function measure(Backend, workload, count) {
        const iterations = Math.max(100, Math.floor(100000 / count));
        const create = () => new Backend().setMaxListeners(0);
        const populate = emitter => {
            for (let i = 0; i < count; i++) emitter.on('data', listener);
            return emitter;
        };
        const emitter = populate(create());
        emitter.emit('data', 1); // Prime the dispatch cache outside timed work.
        let batch;
        let retained;
        if (workload.endsWith('cleanup')) {
            batch = Array.from({length: iterations}, () => {
                const item = populate(create());
                if (workload === 'observed-cleanup') item.on('removeListener', () => { sink++; });
                return item;
            });
        }
        const start = performance.now();
        for (let round = 0; round < iterations; round++) {
            switch (workload) {
                case 'register':
                case 'cold-dispatch': {
                    const item = create();
                    for (let i = 0; i < count; i++) item.on('data', listener);
                    if (workload === 'cold-dispatch') item.emit('data', 1);
                    retained = item;
                    break;
                }
                case 'prepend': {
                    const item = create();
                    for (let i = 0; i < count; i++) item.prependListener('data', listener);
                    retained = item;
                    break;
                }
                case 'churn':
                    emitter.on('data', temporary);
                    emitter.removeListener('data', temporary);
                    break;
                case 'churn-emit':
                    emitter.on('data', temporary);
                    emitter.removeListener('data', temporary);
                    emitter.emit('data', 1);
                    break;
                case 'dispatch':
                    emitter.emit('data', 1);
                    break;
                case 'dispatch-6-args':
                    emitter.emit('data', 1, 2, 3, 4, 5, 6);
                    break;
                case 'once-cycle': {
                    const item = create();
                    for (let i = 0; i < count; i++) item.once('data', listener);
                    item.emit('data', 1);
                    break;
                }
                default:
                    batch[round].removeAllListeners();
            }
        }
        const elapsed = performance.now() - start;
        if (retained) sink += retained.listenerCount('data');
        return elapsed * 1000 / iterations;
    }
    for (const count of sizes) {
        for (const workload of workloads) {
            const readings = backends.map(() => []);
            // Warm up each workload, then rotate backend order to reduce order bias.
            for (const [, Backend] of backends) measure(Backend, workload, count);
            for (let sample = 0; sample < samples; sample++) {
                for (let offset = 0; offset < backends.length; offset++) {
                    const index = (sample + offset) % backends.length;
                    readings[index].push(measure(backends[index][1], workload, count));
                }
            }
            backends.forEach(([backend], index) => {
                const values = readings[index].slice().sort((a, b) => a - b);
                results.push({workload, listeners: count, backend, medianUs: values[Math.floor(values.length / 2)], samplesUs: readings[index]});
            });
        }
    }
    return {samples, sizes, sink, results};
}

module.exports = {runBenchmarks};
