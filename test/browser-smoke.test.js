'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');

// Keeps the browser smoke script runnable and its assertions true against the
// built package. This runs in Node; it does not replace bundling it for a browser.
test('browser smoke script passes against the built package', t => {
    t.after(() => {
        delete globalThis.whiteLabelSmokePassed;
    });
    require('./browser-smoke.js');
    assert.equal(globalThis.whiteLabelSmokePassed, true);
});
