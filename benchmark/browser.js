'use strict';

const {runBenchmarks} = require('./events');
const Legacy = require('events/');
// Resolve this name to the saved pre-optimization adapter when bundling.
const Original = require('benchmark-baseline');
const Optimized = require('../dist/browser-event-emitter');

document.querySelector('button').onclick = async () => {
    const output = document.querySelector('output');
    const combined = {runtime: navigator.userAgent, samples: 7, sizes: [1, 10, 100], results: []};
    for (const size of combined.sizes) {
        output.textContent = `Running ${size} listeners…`;
        await new Promise(resolve => setTimeout(resolve, 50));
        const data = runBenchmarks([
            ['events@3.3.0', Legacy],
            ['original-adapter', Original],
            ['optimized-adapter', Optimized]
        ], {sizes: [size]});
        combined.results.push(...data.results);
    }
    output.textContent = JSON.stringify(combined, null, 2);
};
