'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const {spawnSync} = require('node:child_process');

test('destroy and shared AbortSignal cleanup survive forced garbage collection', () => {
    const script = String.raw`
        const assert = require('node:assert/strict');
        const Mediator = require('./dist');

        const mediator = new Mediator();
        const calls = [];
        for (let index = 0; index < 100; index += 1) {
            mediator.addEventListener('owned:' + index, () => calls.push(index));
        }
        for (let index = 0; index < 5; index += 1) global.gc();
        mediator.destroy();
        for (let index = 0; index < 100; index += 1) {
            mediator.dispatchEvent(new CustomEvent('owned:' + index));
        }
        assert.equal(calls.length, 0);

        const controller = new AbortController();
        for (let index = 0; index < 100; index += 1) {
            mediator.addEventListener('signal:' + index, () => calls.push(index), {
                signal: controller.signal
            });
        }
        for (let index = 0; index < 5; index += 1) global.gc();
        controller.abort();
        for (let index = 0; index < 100; index += 1) {
            mediator.dispatchEvent(new CustomEvent('signal:' + index));
        }
        assert.equal(calls.length, 0);
    `;

    const result = spawnSync(process.execPath, ['--expose-gc', '-e', script], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
});
