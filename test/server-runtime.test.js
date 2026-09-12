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

test('mediator preserves its EventEmitter contract in plain Node without browser globals', t => {
    withoutBrowserGlobals(t);
    const mediator = new Mediator();
    const calls = [];
    mediator.on('request:state', value => calls.push(['on', value]));
    mediator.once('request:state', value => calls.push(['once', value]));

    assert.equal(mediator.initialize(), mediator);
    assert.equal(mediator.emit('request:state', 1), true);
    assert.equal(mediator.emit('request:state', 2), true);
    assert.deepEqual(calls, [['on', 1], ['once', 1], ['on', 2]]);
    assert.equal(mediator.destroy(), mediator);
    assert.equal(mediator.listenerCount('request:state'), 0);
});

test('separately scoped server mediators do not leak listeners or events across requests', t => {
    withoutBrowserGlobals(t);
    const first = new Mediator();
    const second = new Mediator();
    const received = [];
    first.on('complete', value => received.push(['first', value]));
    second.on('complete', value => received.push(['second', value]));

    first.emit('complete', 1);
    assert.deepEqual(received, [['first', 1]]);
    assert.equal(second.listenerCount('complete'), 1);
});
