'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {test} = require('node:test');
const {spawnSync} = require('node:child_process');

const distPath = path.join(__dirname, '..', 'dist');

// EventTarget reports listener exceptions asynchronously as uncaught exceptions
// instead of throwing from dispatchEvent(). A child process observes that report
// without it being attributed to the test runner as a failure.
test('listener exceptions are reported natively without stopping dispatch or once cleanup', () => {
    const script = String.raw`
        const Mediator = require(${JSON.stringify(distPath)});
        const mediator = new Mediator();
        const calls = [];
        const reported = [];
        const onceError = new Error('once');
        const objectError = new Error('object');
        process.on('uncaughtException', error => reported.push(
            error === onceError ? 'once' : error === objectError ? 'object' : String(error)
        ));

        const once = () => {
            calls.push('once');
            throw onceError;
        };
        mediator.addEventListener('work', once, {once: true});
        mediator.addEventListener('work', {
            handleEvent() {
                calls.push('object');
                throw objectError;
            }
        });
        mediator.addEventListener('work', () => calls.push('last'));

        const results = [mediator.dispatchEvent(new CustomEvent('work', {cancelable: true}))];
        calls.push('returned');
        results.push(mediator.dispatchEvent(new CustomEvent('work')));
        calls.push('returned');
        mediator.addEventListener('work', once, {once: true});
        results.push(mediator.dispatchEvent(new CustomEvent('work')));

        process.on('exit', () => process.stdout.write(JSON.stringify({calls, results, reported})));
    `;

    const result = spawnSync(process.execPath, ['-e', script], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const {calls, results, reported} = JSON.parse(result.stdout);
    assert.deepEqual(results, [true, true, true]);
    assert.deepEqual(calls, [
        'once', 'object', 'last', 'returned',
        'object', 'last', 'returned',
        'object', 'last', 'once'
    ]);
    assert.deepEqual(reported, ['once', 'object', 'object', 'object', 'once']);
});
