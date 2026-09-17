'use strict';

const assert = require('node:assert/strict');
const {describe, it, mock} = require('node:test');
const Mediator = require('../dist/index');

describe('Mediator security regressions', () => {
    it('does not invoke signal-bound callbacks during re-entrant abort dispatch', () => {
        for (const registerAbortFirst of [true, false]) {
            const mediator = new Mediator();
            const controller = new AbortController();
            const callback = mock.fn();
            const dispatchOnAbort = () => mediator.dispatchEvent(new Event('work'));

            if (registerAbortFirst) {
                controller.signal.addEventListener('abort', dispatchOnAbort);
            }
            mediator.addEventListener('work', callback, {signal: controller.signal});
            if (!registerAbortFirst) {
                controller.signal.addEventListener('abort', dispatchOnAbort);
            }

            controller.abort();
            mediator.dispatchEvent(new Event('work'));
            assert.equal(callback.mock.callCount(), 0);
        }
    });

    it('suppresses once and object listeners while their shared signal is aborting', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const once = mock.fn();
        const handleEvent = mock.fn();
        const listener = {handleEvent};

        mediator.addEventListener('once', once, {once: true, signal: controller.signal});
        mediator.addEventListener('object', listener, {signal: controller.signal});
        controller.signal.addEventListener('abort', () => {
            mediator.dispatchEvent(new Event('once'));
            mediator.dispatchEvent(new Event('object'));
        });

        controller.abort();
        assert.equal(once.mock.callCount(), 0);
        assert.equal(handleEvent.mock.callCount(), 0);

        mediator.addEventListener('once', once);
        mediator.dispatchEvent(new Event('once'));
        assert.equal(once.mock.callCount(), 1);
    });

    it('uses intrinsic AbortSignal state instead of a shadowed aborted property', () => {
        const mediator = new Mediator();
        const controller = new AbortController();
        const callback = mock.fn();

        mediator.addEventListener('work', callback, {signal: controller.signal});
        Object.defineProperty(controller.signal, 'aborted', {
            configurable: true,
            value: false
        });
        controller.signal.addEventListener('abort', () => {
            mediator.dispatchEvent(new Event('work'));
        });

        controller.abort();
        assert.equal(callback.mock.callCount(), 0);
    });

    it('keeps nested registrations out of every dispatch already in progress', () => {
        const mediator = new Mediator();
        const calls = [];
        const late = () => calls.push('late');

        mediator.addEventListener('outer', () => {
            calls.push('first');
            mediator.dispatchEvent(new Event('inner'));
        });
        mediator.addEventListener('outer', () => calls.push('last'));
        mediator.addEventListener('inner', () => {
            mediator.addEventListener('outer', late);
        });

        mediator.dispatchEvent(new Event('outer'));
        assert.deepEqual(calls, ['first', 'last']);

        mediator.dispatchEvent(new Event('outer'));
        assert.deepEqual(calls, ['first', 'last', 'first', 'last', 'late']);
    });
});
