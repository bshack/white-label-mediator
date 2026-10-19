'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {test} = require('node:test');
const {spawnSync} = require('node:child_process');

const distPath = path.join(__dirname, '..', 'dist');

test('destroy and shared AbortSignal cleanup survive forced garbage collection', () => {
    // Listener closures are only reachable through the mediator, so delivery after
    // forced GC proves registrations are held strongly until explicit cleanup.
    const script = String.raw`
        const assert = require('node:assert/strict');
        const Mediator = require(${JSON.stringify(distPath)});

        const mediator = new Mediator();
        const calls = [];
        for (let index = 0; index < 100; index += 1) {
            mediator.addEventListener('owned:' + index, () => calls.push(index));
        }
        for (let index = 0; index < 5; index += 1) global.gc();
        for (let index = 0; index < 100; index += 1) {
            mediator.dispatchEvent(new CustomEvent('owned:' + index));
        }
        assert.equal(calls.length, 100);
        mediator.destroy();
        for (let index = 0; index < 100; index += 1) {
            mediator.dispatchEvent(new CustomEvent('owned:' + index));
        }
        assert.equal(calls.length, 100);

        const controller = new AbortController();
        for (let index = 0; index < 100; index += 1) {
            mediator.addEventListener('signal:' + index, () => calls.push(index), {
                signal: controller.signal
            });
        }
        for (let index = 0; index < 5; index += 1) global.gc();
        for (let index = 0; index < 100; index += 1) {
            mediator.dispatchEvent(new CustomEvent('signal:' + index));
        }
        assert.equal(calls.length, 200);
        controller.abort();
        for (let index = 0; index < 100; index += 1) {
            mediator.dispatchEvent(new CustomEvent('signal:' + index));
        }
        assert.equal(calls.length, 200);
    `;

    const result = spawnSync(process.execPath, ['--expose-gc', '-e', script], {
        encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
});
