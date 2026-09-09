'use strict';
const assert = require('node:assert/strict');
const {it, mock} = require('node:test');
const Adapter = require('../dist/browser-event-emitter');
const Native = require('node:events');
const Legacy = require('events/');

for (const [name, Backend] of [['native', Native], ['legacy', Legacy], ['adapter', Adapter]]) {
    it(`${name}: event name ordering and empty/prototype-like names are preserved`, () => {
        const emitter = new Backend();
        const symbol = Symbol('first');
        for (const event of [symbol, 'z', '10', '2', '', '__proto__']) emitter.on(event, () => {});
        assert.deepEqual(emitter.eventNames(), ['2', '10', 'z', '', '__proto__', symbol]);
        emitter.removeAllListeners('');
        assert.equal(emitter.listenerCount(''), 0);
        assert.equal(emitter.listenerCount('__proto__'), 1);
        emitter.removeAllListeners();
        assert.deepEqual(emitter.eventNames(), []);
    });
    it(`${name}: recursive emits cannot invoke an already fired once callback again`, () => {
        const emitter = new Backend();
        const calls = [];
        emitter.once('data', () => { calls.push('first'); emitter.emit('data'); });
        emitter.once('data', () => calls.push('second'));
        emitter.emit('data');
        assert.deepEqual(calls, ['first', 'second']);
        assert.deepEqual(emitter.rawListeners('data'), []);
    });
    it(`${name}: listener removal is selective and reports reverse teardown order`, () => {
        const emitter = new Backend();
        const a = () => {};
        const b = () => {};
        const removed = [];
        emitter.on('removeListener', (event, fn) => { if (event === 'data') removed.push(fn); });
        emitter.on('data', a).once('data', b).on('data', a);
        const rawB = emitter.rawListeners('data')[1];
        emitter.removeListener('missing', a).removeListener('data', () => {});
        assert.equal(emitter.listenerCount('data'), 3);
        emitter.removeAllListeners('data');
        // Node 24 reports the raw wrapper here; the existing browser package reports b.
        assert.deepEqual(removed, [a, Backend === Native ? rawB : b, a]);
    });
    it(`${name}: raw once wrappers remain bound and can be invoked only once`, () => {
        const emitter = new Backend();
        let calls = 0;
        emitter.once('data', function (value) { assert.equal(this, emitter); assert.equal(value, 42); calls++; });
        const raw = emitter.rawListeners('data')[0];
        raw.call({}, 42);
        raw(42);
        assert.equal(calls, 1);
        assert.equal(emitter.listenerCount('data'), 0);
    });
    it(`${name}: non-Error unhandled payloads retain context`, () => {
        const emitter = new Backend();
        const payload = {reason: 'failure'};
        assert.throws(() => emitter.emit('error', payload), error => error.context === payload);
        assert.throws(() => emitter.emit('error'), Error);
    });
}

it('adapter: listener limits warn once per channel and reset after complete removal', () => {
    const warn = mock.method(console, 'warn', () => {});
    const oldLimit = Adapter.defaultMaxListeners;
    try {
        for (const bad of [-1, NaN, '3']) {
            assert.throws(() => { Adapter.defaultMaxListeners = bad; }, RangeError);
            assert.throws(() => new Adapter().setMaxListeners(bad), RangeError);
        }
        Adapter.defaultMaxListeners = 1;
        const emitter = new Adapter();
        const a = () => {};
        const b = () => {};
        emitter.on('data', a).on('data', b).on('data', a);
        assert.equal(warn.mock.callCount(), 1);
        const warning = warn.mock.calls[0].arguments[0];
        assert.equal(warning.name, 'MaxListenersExceededWarning');
        assert.equal(warning.emitter, emitter);
        assert.equal(warning.type, 'data');
        assert.equal(warning.count, 2);
        assert.equal(emitter.listenerCount('data', a), 2);
        assert.equal(emitter.listenerCount('data', b), 1);
        emitter.removeListener('data', a).on('data', a);
        assert.equal(warn.mock.callCount(), 1);
        emitter.removeAllListeners('data').on('data', a).on('data', a);
        assert.equal(warn.mock.callCount(), 2);
        emitter.setMaxListeners(0);
        emitter.on('other', a).on('other', a);
        assert.equal(warn.mock.callCount(), 2);
        emitter.setMaxListeners(Infinity);
        assert.equal(emitter.getMaxListeners(), Infinity);
    } finally {
        Adapter.defaultMaxListeners = oldLimit;
        warn.mock.restore();
    }
});

for (const [name, Backend] of [['native', Native], ['legacy', Legacy], ['adapter', Adapter]]) {
    it(`${name}: static helpers wait for events and clean up rejected waits`, async () => {
        const emitter = new Backend();
        assert.equal(Backend.EventEmitter, Backend);
        const success = Backend.once(emitter, 'ready');
        assert.equal(Backend.listenerCount(emitter, 'ready'), 1);
        emitter.emit('ready', 1, 2);
        assert.deepEqual(await success, [1, 2]);
        assert.deepEqual(emitter.eventNames(), []);
        const failure = Backend.once(emitter, 'ready');
        const error = new Error('expected');
        emitter.emit('error', error);
        await assert.rejects(failure, value => value === error);
        assert.deepEqual(emitter.eventNames(), []);
        const handled = Backend.once(emitter, 'error');
        emitter.emit('error', error);
        assert.deepEqual(await handled, [error]);
        const target = new EventTarget();
        const wait = Backend.once(target, 'ready');
        const event = new Event('ready');
        target.dispatchEvent(event);
        assert.deepEqual(await wait, [event]);
        target.dispatchEvent(new Event('ready'));
        await assert.rejects(Backend.once({}, 'ready'), TypeError);
    });
}
