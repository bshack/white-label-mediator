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

    it('supports standard once and explicit removal semantics', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        mediator.addEventListener('ready', callback, {once: true});
        mediator.dispatchEvent(new CustomEvent('ready', {detail: 'Ada'}));
        mediator.dispatchEvent(new CustomEvent('ready', {detail: 'Grace'}));
        assert.equal(callback.mock.callCount(), 1);
        assert.equal(callback.mock.calls[0].arguments[0].detail, 'Ada');

        mediator.addEventListener('stopped', callback);
        mediator.removeEventListener('stopped', callback);
        mediator.dispatchEvent(new CustomEvent('stopped'));
        assert.equal(callback.mock.callCount(), 1);
    });

    it('uses native duplicate-registration semantics', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        mediator.addEventListener('ready', callback);
        mediator.addEventListener('ready', callback);
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(callback.mock.callCount(), 1);
    });

    it('combines caller abort signals with mediator lifecycle cleanup', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const callback = mock.fn();
        mediator.addEventListener('ready', callback, {signal: controller.signal});
        controller.abort();
        mediator.dispatchEvent(new CustomEvent('ready'));
        assert.equal(callback.mock.callCount(), 0);
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

    it('preserves native dispatchEvent cancellation behavior', () => {
        const mediator = new Mediator();
        mediator.addEventListener('before:save', event => event.preventDefault());
        const result = mediator.dispatchEvent(new CustomEvent('before:save', {cancelable: true}));
        assert.equal(result, false);
    });
});
