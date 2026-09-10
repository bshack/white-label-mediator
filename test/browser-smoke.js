// Bundle this file for a browser; see docs/events-compatibility.md.
const Mediator = require('..');
const instances = [new Mediator()];
const assert = (value, message) => { if (!value) throw new Error(message); };
for (const emitter of instances) {
    const calls = [];
    const listener = function (value) { assert(this === emitter, 'listener receiver'); calls.push(value); };
    emitter.on('data', listener).on('data', listener);
    emitter.removeListener('data', listener);
    emitter.emit('data', 42);
    assert(calls.length === 1 && calls[0] === 42, 'duplicate removal and payload');
    emitter.prependOnceListener('data', () => calls.push('first'));
    emitter.emit('data', 43);
    assert(calls[1] === 'first' && calls[2] === 43, 'prepend once');
    let once = 0;
    emitter.once('recursive', () => { once++; emitter.emit('recursive'); });
    emitter.emit('recursive');
    assert(once === 1, 'recursive once');
    emitter.once('answer', value => value);
    const raw = emitter.rawListeners('answer')[0];
    assert(raw(42) === 42 && raw(99) === undefined, 'raw once return and one-time invocation');
    emitter.on('keep', listener);
    emitter.removeAllListeners(undefined);
    assert(emitter.listenerCount('keep') === 1, 'explicit undefined preserves unrelated events');
    const symbol = Symbol('observed cleanup');
    let removed = false;
    emitter.on('removeListener', event => { if (event === symbol) removed = true; });
    emitter.on(symbol, listener);
    emitter.removeAllListeners(symbol);
    assert(removed, 'explicit symbol cleanup notification');
    const error = new Error('expected');
    let caught;
    try { emitter.emit('error', error); } catch (value) { caught = value; }
    assert(caught === error, 'unhandled errors');
    emitter.on(Symbol('cleanup'), listener);
    emitter.destroy();
    assert(emitter.eventNames().length === 0, 'cleanup');
}
globalThis.whiteLabelSmokePassed = true;
