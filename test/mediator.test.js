'use strict';

const assert = require('node:assert/strict');
const {describe, it, mock} = require('node:test');
const Mediator = require('../dist/index');

describe('Mediator', () => {
    it('is a standards-based EventTarget with lifecycle chaining', () => {
        const mediator = new Mediator();
        assert.ok(mediator instanceof EventTarget);
        assert.equal(mediator.initialize(), mediator);
        assert.equal(mediator.destroy(), mediator);
    });

    it('dispatches CustomEvent payloads synchronously', () => {
        const mediator = new Mediator();
        const received = [];
        mediator.addEventListener('menu:state', function(event) {
            assert.equal(this, mediator);
            received.push(event.detail);
        });

        const delivered = mediator.dispatchEvent(new CustomEvent('menu:state', {detail: {open: true}}));
        assert.equal(delivered, true);
        assert.deepEqual(received, [{open: true}]);
    });

    it('removes once listeners before re-entrant dispatch', () => {
        const mediator = new Mediator();
        const calls = [];
        mediator.addEventListener('ready', event => {
            calls.push(event.detail);
            mediator.dispatchEvent(new CustomEvent('ready', {detail: 'recursive'}));
        }, {once: true});

        mediator.dispatchEvent(new CustomEvent('ready', {detail: 'first'}));
        assert.deepEqual(calls, ['first']);
    });

    it('supports explicit removal and native capture matching', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        mediator.addEventListener('ready', callback, true);
        mediator.addEventListener('ready', callback, false);
        mediator.removeEventListener('ready', callback, true);
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(callback.mock.callCount(), 1);
        mediator.removeEventListener('ready', callback, false);
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(callback.mock.callCount(), 1);
    });

    it('uses native duplicate-registration semantics', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        mediator.addEventListener('ready', callback);
        mediator.addEventListener('ready', callback, {once: true});
        mediator.dispatchEvent(new CustomEvent('ready'));
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(callback.mock.callCount(), 2);
    });

    it('honors inherited and non-enumerable listener options', () => {
        const mediator = new Mediator();
        const inherited = mock.fn();
        const inheritedOptions = Object.create({once: true});
        mediator.addEventListener('inherited', inherited, inheritedOptions);
        mediator.dispatchEvent(new CustomEvent('inherited'));
        mediator.dispatchEvent(new CustomEvent('inherited'));
        assert.equal(inherited.mock.callCount(), 1);

        const hidden = mock.fn();
        const hiddenOptions = {};
        Object.defineProperty(hiddenOptions, 'once', {value: true});
        mediator.addEventListener('hidden', hidden, hiddenOptions);
        mediator.dispatchEvent(new CustomEvent('hidden'));
        mediator.dispatchEvent(new CustomEvent('hidden'));
        assert.equal(hidden.mock.callCount(), 1);
    });

    it('supports caller abort signals without sharing lifecycle signals internally', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const first = mock.fn();
        const second = mock.fn();
        mediator.addEventListener('first', first, {signal: controller.signal});
        mediator.addEventListener('second', second, {signal: controller.signal});
        controller.abort();
        mediator.dispatchEvent(new CustomEvent('first'));
        mediator.dispatchEvent(new CustomEvent('second'));
        assert.equal(first.mock.callCount(), 0);
        assert.equal(second.mock.callCount(), 0);
    });

    it('honors inherited abort signals', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const callback = mock.fn();
        const options = Object.create({signal: controller.signal});
        mediator.addEventListener('ready', callback, options);
        controller.abort();
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(callback.mock.callCount(), 0);
    });

    it('ignores a duplicate registration signal just like native EventTarget', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const callback = mock.fn();
        mediator.addEventListener('ready', callback);
        mediator.addEventListener('ready', callback, {signal: controller.signal});
        controller.abort();
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(callback.mock.callCount(), 1);
    });

    it('allows a listener to be registered again after once or signal cleanup', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        mediator.addEventListener('once', callback, {once: true});
        mediator.dispatchEvent(new CustomEvent('once'));
        mediator.addEventListener('once', callback);
        mediator.dispatchEvent(new CustomEvent('once'));

        const controller = new AbortController();
        mediator.addEventListener('signal', callback, {signal: controller.signal});
        controller.abort();
        mediator.addEventListener('signal', callback);
        mediator.dispatchEvent(new CustomEvent('signal'));
        assert.equal(callback.mock.callCount(), 3);
    });

    it('supports EventListener objects and preserves handleEvent receiver', () => {
        const mediator = new Mediator();
        const listener = {
            calls: 0,
            handleEvent() {
                assert.equal(this, listener);
                this.calls += 1;
            }
        };
        mediator.addEventListener('ready', listener, {once: true});
        mediator.dispatchEvent(new CustomEvent('ready'));
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(listener.calls, 1);
    });

    it('accepts boolean listener options and null callbacks', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        mediator.addEventListener('ready', callback, false);
        mediator.addEventListener('ready', null);
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(callback.mock.callCount(), 1);
    });

    it('removes lifecycle-scoped listeners on destroy and can be reused', () => {
        const mediator = new Mediator();
        const first = mock.fn();
        const second = mock.fn();
        mediator.addEventListener('ready', first);
        mediator.destroy();
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(first.mock.callCount(), 0);

        mediator.addEventListener('ready', second);
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(second.mock.callCount(), 1);
    });

    it('removes later listeners when destroy is called during dispatch', () => {
        const mediator = new Mediator();
        const calls = [];
        mediator.addEventListener('ready', () => {
            calls.push('first');
            mediator.destroy();
        });
        mediator.addEventListener('ready', () => calls.push('second'));
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.deepEqual(calls, ['first']);
    });

    it('preserves native dispatchEvent cancellation behavior', () => {
        const mediator = new Mediator();
        mediator.addEventListener('before:save', event => event.preventDefault());
        const result = mediator.dispatchEvent(new CustomEvent('before:save', {cancelable: true}));
        assert.equal(result, false);
    });
});
