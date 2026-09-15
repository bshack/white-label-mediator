'use strict';

const assert = require('node:assert/strict');
const {describe, it, mock} = require('node:test');
const Mediator = require('../dist/index');

describe('Mediator EventTarget edge cases', () => {
    it('requires both type and callback arguments', () => {
        const mediator = new Mediator();
        assert.throws(() => mediator.addEventListener('ready'), TypeError);
        assert.throws(() => mediator.removeEventListener('ready'), TypeError);
    });

    it('canonicalizes event types before registration bookkeeping', () => {
        const mediator = new Mediator();
        const callback = mock.fn();

        mediator.addEventListener(1, callback);
        mediator.addEventListener('1', callback);
        mediator.dispatchEvent(new Event('1'));

        assert.equal(callback.mock.callCount(), 1);
        assert.throws(() => mediator.addEventListener(Symbol('ready'), callback), TypeError);
    });

    it('keeps lifecycle ownership when a type object changes its string value', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        let conversions = 0;
        const type = {
            toString() {
                conversions += 1;
                return conversions === 1 ? 'first' : 'second';
            }
        };

        mediator.addEventListener(type, callback);
        mediator.removeEventListener(type, callback);
        mediator.destroy();
        mediator.dispatchEvent(new Event('first'));

        assert.equal(conversions, 2);
        assert.equal(callback.mock.callCount(), 0);
    });

    it('rejects primitive callbacks while still accepting null and undefined callbacks', () => {
        const mediator = new Mediator();
        assert.throws(() => mediator.addEventListener('ready', 0), TypeError);
        assert.throws(() => mediator.removeEventListener('ready', false), TypeError);

        const order = [];
        const type = {
            toString() {
                order.push('type');
                return 'ready';
            }
        };
        const options = {
            get capture() {
                order.push('capture');
                return false;
            },
            get once() {
                order.push('once');
                return false;
            },
            get passive() {
                order.push('passive');
                return false;
            },
            get signal() {
                order.push('signal');
                return undefined;
            }
        };

        mediator.addEventListener(type, null, options);
        mediator.addEventListener('ignored', undefined, null);
        mediator.removeEventListener('ignored', null, null);

        assert.deepEqual(order, ['type', 'capture', 'once', 'passive', 'signal']);
    });

    it('uses Web IDL boolean conversion for primitive listener options', () => {
        const mediator = new Mediator();
        const callback = mock.fn();

        mediator.addEventListener('ready', callback, true);
        mediator.removeEventListener('ready', callback, 1);
        mediator.addEventListener('ready', callback, 'capture');
        mediator.dispatchEvent(new Event('ready'));
        assert.equal(callback.mock.callCount(), 1);

        mediator.removeEventListener('ready', callback, Symbol('capture'));
        mediator.dispatchEvent(new Event('ready'));
        assert.equal(callback.mock.callCount(), 1);
    });

    it('treats function options as dictionaries and reads capture once during fallback removal', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        const addOptions = function() {};
        addOptions.capture = true;
        mediator.addEventListener('ready', callback, addOptions);
        mediator.removeEventListener('ready', callback, true);

        EventTarget.prototype.addEventListener.call(mediator, 'native', callback, {capture: true});
        let reads = 0;
        const removeOptions = function() {};
        Object.defineProperty(removeOptions, 'capture', {
            get() {
                reads += 1;
                return true;
            }
        });
        mediator.removeEventListener('native', callback, removeOptions);
        mediator.dispatchEvent(new Event('native'));

        assert.equal(reads, 1);
        assert.equal(callback.mock.callCount(), 0);
    });

    it('validates falsey and invalid AbortSignal values even with a null callback', () => {
        const mediator = new Mediator();
        assert.throws(() => mediator.addEventListener('ready', null, {signal: null}), TypeError);
        assert.throws(() => mediator.addEventListener('ready', null, {signal: 0}), TypeError);
        assert.throws(() => mediator.addEventListener('ready', null, {signal: {}}), TypeError);
    });

    it('validates a duplicate registration signal without allocating ownership for it', () => {
        const mediator = new Mediator();
        const callback = mock.fn();
        mediator.addEventListener('ready', callback);
        assert.throws(() => mediator.addEventListener('ready', callback, {signal: {}}), TypeError);
        mediator.dispatchEvent(new Event('ready'));
        assert.equal(callback.mock.callCount(), 1);
    });

    it('does not read listener-object handleEvent during registration', () => {
        const mediator = new Mediator();
        const listener = {};
        const callback = mock.fn();

        mediator.addEventListener('ready', listener);
        listener.handleEvent = callback;
        mediator.dispatchEvent(new Event('ready'));

        assert.equal(callback.mock.callCount(), 1);
    });

    it('keeps signal cleanup correct when a handleEvent getter aborts during dispatch', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const calls = [];
        let reads = 0;
        const listener = {
            get handleEvent() {
                reads += 1;
                controller.abort();
                return () => calls.push('called');
            }
        };

        mediator.addEventListener('ready', listener, {signal: controller.signal});
        assert.equal(reads, 0);
        assert.equal(controller.signal.aborted, false);

        mediator.dispatchEvent(new Event('ready'));
        mediator.dispatchEvent(new Event('ready'));

        assert.equal(reads, 1);
        assert.deepEqual(calls, ['called']);
    });

    it('cannot have caller abort cleanup blocked by stopImmediatePropagation', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const callback = mock.fn();

        controller.signal.addEventListener('abort', event => event.stopImmediatePropagation());
        mediator.addEventListener('ready', callback, {signal: controller.signal});
        controller.abort();
        mediator.dispatchEvent(new Event('ready'));

        assert.equal(callback.mock.callCount(), 0);
    });

    it('does not treat a synthetic abort event as an actual signal abort', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const callback = mock.fn();

        mediator.addEventListener('ready', callback, {signal: controller.signal});
        controller.signal.dispatchEvent(new Event('abort'));
        mediator.dispatchEvent(new Event('ready'));
        assert.equal(callback.mock.callCount(), 1);

        controller.abort();
        mediator.dispatchEvent(new Event('ready'));
        assert.equal(callback.mock.callCount(), 1);
    });

    it('reuses one dependent signal for registrations sharing a caller signal', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const first = mock.fn();
        const second = mock.fn();

        mediator.addEventListener('first', first, {signal: controller.signal});
        mediator.addEventListener('second', second, {signal: controller.signal});
        mediator.removeEventListener('first', first);
        controller.abort();
        mediator.dispatchEvent(new Event('second'));

        assert.equal(second.mock.callCount(), 0);
    });
});
