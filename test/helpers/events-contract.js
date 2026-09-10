'use strict';

const assert = require('node:assert/strict');
const {describe, it} = require('node:test');

/** Run the same observable EventEmitter contract through each package subclass. */
function eventsContract(name, createEmitter, Backend) {
    describe(name, () => {
        it('inherits the selected backend and owns its listeners', () => {
            const emitter = createEmitter();
            assert.ok(emitter instanceof Backend);
            emitter.on('data', () => {});
            assert.equal(createEmitter().listenerCount('data'), 0);
        });

        it('delivers synchronously in order with the emitter as this and all arguments', () => {
            const emitter = createEmitter();
            const calls = [];
            const payload = {value: 1};
            function first(...args) {
                assert.equal(this, emitter);
                assert.equal(args[0], payload);
                assert.deepEqual(args, [payload, 2, undefined]);
                calls.push('first');
            }
            assert.equal(emitter.on('data', first), emitter);
            assert.equal(emitter.addListener('data', () => calls.push('second')), emitter);
            assert.equal(emitter.emit('missing'), false);
            assert.equal(emitter.emit('data', payload, 2, undefined), true);
            assert.deepEqual(calls, ['first', 'second']);
        });

        it('removes once listeners before reentrant emission and permits cancellation', () => {
            const emitter = createEmitter();
            let count = 0;
            function callback() {
                count++;
                assert.equal(this, emitter);
                assert.equal(emitter.emit('ready'), false);
            }
            assert.equal(emitter.once('ready', callback), emitter);
            assert.deepEqual(emitter.listeners('ready'), [callback]);
            assert.equal(emitter.rawListeners('ready')[0].listener, callback);
            emitter.emit('ready');
            assert.equal(count, 1);
            emitter.once('ready', callback);
            assert.equal(emitter.removeListener('ready', callback), emitter);
            assert.equal(emitter.emit('ready'), false);
            assert.equal(count, 1);
        });

        it('preserves raw once wrapper return values and invokes the callback only once', () => {
            const emitter = createEmitter();
            let calls = 0;
            emitter.once('answer', function (value) {
                assert.equal(this, emitter);
                calls++;
                return value;
            });
            const raw = emitter.rawListeners('answer')[0];
            assert.equal(raw(42), 42);
            assert.equal(raw(99), undefined);
            assert.equal(calls, 1);
            assert.equal(emitter.listenerCount('answer'), 0);
        });

        for (const observeRemoval of [false, true]) {
            it(`distinguishes explicit undefined from no removal argument (observer: ${observeRemoval})`, () => {
                const emitter = createEmitter();
                const notices = [];
                if (observeRemoval) emitter.on('removeListener', event => notices.push(event));
                emitter.on('keep', () => {});
                emitter.on('undefined', () => {});
                assert.equal(emitter.removeAllListeners(undefined), emitter);
                assert.equal(emitter.listenerCount('keep'), 1);
                assert.equal(emitter.listenerCount('undefined'), 0);
                assert.deepEqual(notices, observeRemoval ? [undefined] : []);
                emitter.removeAllListeners();
                assert.deepEqual(emitter.eventNames(), []);
            });
        }

        it('notifies explicit symbol removal and preserves backend bulk notification behavior', () => {
            const emitter = createEmitter();
            const event = Symbol('cleanup');
            const callback = () => {};
            const notices = [];
            emitter.on('removeListener', (name, listener) => {
                if (name === event) notices.push(listener);
            });
            emitter.on(event, callback);
            emitter.removeAllListeners(event);
            assert.deepEqual(notices, [callback]);
            emitter.on(event, callback);
            notices.length = 0;
            emitter.removeAllListeners();
            // events 3.3.0 clears symbols but omits their bulk removal notifications.
            assert.deepEqual(notices, Backend === require('events/') ? [] : [callback]);
            assert.equal(emitter.listenerCount(event), 0);
            assert.deepEqual(emitter.eventNames(), []);
        });

        it('removes only the most recently added matching duplicate listener', () => {
            const emitter = createEmitter();
            const calls = [];
            const duplicate = () => calls.push('duplicate');
            emitter.on('data', duplicate);
            emitter.on('data', () => calls.push('middle'));
            emitter.on('data', duplicate);
            emitter.removeListener('data', duplicate);
            emitter.emit('data');
            assert.deepEqual(calls, ['duplicate', 'middle']);
            assert.equal(emitter.off('data', duplicate), emitter);
            assert.equal(emitter.listenerCount('data'), 1);
        });

        it('keeps the current emission snapshot when listeners are added or removed', () => {
            const emitter = createEmitter();
            const calls = [];
            const second = () => calls.push('second');
            const later = () => calls.push('later');
            emitter.on('data', () => {
                calls.push('first');
                emitter.removeListener('data', second);
                emitter.on('data', later);
            });
            emitter.on('data', second);
            emitter.emit('data');
            assert.deepEqual(calls, ['first', 'second']);
            calls.length = 0;
            emitter.emit('data');
            assert.deepEqual(calls, ['first', 'later']);
        });

        it('supports symbol events, prepend order, listener inspection, and scoped removal', () => {
            const emitter = createEmitter();
            const event = Symbol('data');
            const calls = [];
            emitter.on(event, () => calls.push('last'));
            assert.equal(emitter.prependListener(event, () => calls.push('first')), emitter);
            assert.equal(emitter.prependOnceListener(event, () => calls.push('once')), emitter);
            emitter.on('other', () => {});
            assert.ok(emitter.eventNames().includes(event));
            assert.equal(emitter.listeners(event).length, 3);
            emitter.emit(event);
            emitter.emit(event);
            assert.deepEqual(calls, ['once', 'first', 'last', 'first', 'last']);
            assert.equal(emitter.removeAllListeners(event), emitter);
            assert.equal(emitter.listenerCount(event), 0);
            assert.equal(emitter.listenerCount('other'), 1);
            assert.equal(emitter.removeAllListeners(), emitter);
            assert.deepEqual(emitter.eventNames(), []);
        });

        it('notifies listener registration before insertion and removal after deletion', () => {
            const emitter = createEmitter();
            const notifications = [];
            const callback = () => {};
            emitter.on('newListener', (event, listener) => {
                if (event === 'data') notifications.push(['add', listener, emitter.listenerCount(event)]);
            });
            emitter.on('removeListener', (event, listener) => {
                if (event === 'data') notifications.push(['remove', listener, emitter.listenerCount(event)]);
            });
            emitter.on('data', callback);
            emitter.removeListener('data', callback);
            assert.deepEqual(notifications, [['add', callback, 0], ['remove', callback, 0]]);
        });

        it('throws unhandled error events and propagates listener exceptions', () => {
            const emitter = createEmitter();
            const error = new Error('expected failure');
            assert.throws(() => emitter.emit('error', error), thrown => thrown === error);
            let received;
            emitter.on('error', value => { received = value; });
            assert.equal(emitter.emit('error', error), true);
            assert.equal(received, error);
            emitter.on('data', () => { throw error; });
            assert.throws(() => emitter.emit('data'), thrown => thrown === error);
        });

        it('validates listeners and supports per-instance listener limits', () => {
            const emitter = createEmitter();
            assert.throws(() => emitter.on('data', null), TypeError);
            assert.throws(() => emitter.once('data', null), TypeError);
            assert.throws(() => emitter.removeListener('data', null), TypeError);
            assert.equal(emitter.setMaxListeners(3), emitter);
            assert.equal(emitter.getMaxListeners(), 3);
            assert.throws(() => emitter.setMaxListeners(-1), RangeError);
        });
    });
}

module.exports = eventsContract;
