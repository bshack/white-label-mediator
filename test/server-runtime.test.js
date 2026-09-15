'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Mediator = require('../dist');

function withoutBrowserGlobals(t) {
    const previousWindow = global.window;
    const previousDocument = global.document;
    delete global.window;
    delete global.document;
    t.after(() => {
        if (previousWindow === undefined) {delete global.window;} else {global.window = previousWindow;}
        if (previousDocument === undefined) {delete global.document;} else {global.document = previousDocument;}
    });
}

test('mediator uses the web-standard event contract in plain Node without browser globals', t => {
    withoutBrowserGlobals(t);
    const mediator = new Mediator();
    const calls = [];
    mediator.addEventListener('request:state', event => calls.push(['on', event.detail]));
    mediator.addEventListener('request:state', event => calls.push(['once', event.detail]), {once: true});

    assert.equal(mediator.initialize(), mediator);
    assert.equal(mediator.dispatchEvent(new CustomEvent('request:state', {detail: 1})), true);
    assert.equal(mediator.dispatchEvent(new CustomEvent('request:state', {detail: 2})), true);
    assert.deepEqual(calls, [['on', 1], ['once', 1], ['on', 2]]);
    assert.equal(mediator.destroy(), mediator);
    mediator.dispatchEvent(new CustomEvent('request:state', {detail: 3}));
    assert.equal(calls.length, 3);
});

test('separately scoped server mediators do not leak listeners or events across requests', t => {
    withoutBrowserGlobals(t);
    const first = new Mediator();
    const second = new Mediator();
    const received = [];
    first.addEventListener('complete', event => received.push(['first', event.detail]));
    second.addEventListener('complete', event => received.push(['second', event.detail]));

    first.dispatchEvent(new CustomEvent('complete', {detail: 1}));
    assert.deepEqual(received, [['first', 1]]);
});
