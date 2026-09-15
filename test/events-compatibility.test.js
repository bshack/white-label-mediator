'use strict';

const assert = require('node:assert/strict');
const {test, mock} = require('node:test');
const Mediator = require('../dist');

test('Mediator exposes EventTarget rather than EventEmitter compatibility aliases', () => {
    const mediator = new Mediator();
    assert.ok(mediator instanceof EventTarget);
    assert.equal(typeof mediator.addEventListener, 'function');
    assert.equal(typeof mediator.removeEventListener, 'function');
    assert.equal(typeof mediator.dispatchEvent, 'function');
    assert.equal(mediator.on, undefined);
    assert.equal(mediator.emit, undefined);
    assert.equal(mediator.removeAllListeners, undefined);
});

test('native once, duplicate registration, and cancellation semantics are preserved', () => {
    const mediator = new Mediator();
    const callback = mock.fn();
    mediator.addEventListener('event', callback, {once: true});
    mediator.addEventListener('event', callback, {once: true});
    mediator.dispatchEvent(new CustomEvent('event'));
    mediator.dispatchEvent(new CustomEvent('event'));
    assert.equal(callback.mock.callCount(), 1);

    mediator.addEventListener('cancel', event => event.preventDefault());
    assert.equal(mediator.dispatchEvent(new CustomEvent('cancel', {cancelable: true})), false);
});
