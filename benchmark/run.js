'use strict';

const {execFileSync} = require('node:child_process');
const {createRequire} = require('node:module');
const {compileFunction} = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const {runBenchmarks} = require('./events');

// Supply the pre-optimization PR SHA. Read only its adapter; resolve the same
// locked EventEmitter3 dependency as the optimized adapter for a fair comparison.
const baselineRef = process.argv[2];
if (!baselineRef) throw new Error('Usage: node benchmark/run.js <pre-optimization-commit>');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'dist/browser-event-emitter.js');
const source = execFileSync('git', ['show', `${baselineRef}:dist/browser-event-emitter.js`], {cwd: root, encoding: 'utf8'});
const baseline = {exports: {}};
compileFunction(source, ['exports', 'require', 'module'], {filename})(baseline.exports, createRequire(filename), baseline);
const output = runBenchmarks([
    ['events@3.3.0', require('events/')],
    ['original-adapter', baseline.exports],
    ['optimized-adapter', require('../dist/browser-event-emitter')]
]);
console.log(JSON.stringify({date: new Date().toISOString(), runtime: process.version, platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0].model, baselineRef, ...output}, null, 2));
