// Bundle this file for a browser; see docs/events-compatibility.md.
const Mediator = require('..');
const mediator = new Mediator();
const assert = (value, message) => { if (!value) throw new Error(message); };
const calls = [];
const listener = event => calls.push(event.detail);

mediator.addEventListener('data', listener);
mediator.dispatchEvent(new CustomEvent('data', {detail: 42}));
assert(calls.length === 1 && calls[0] === 42, 'payload delivery');

mediator.addEventListener('once', listener, {once: true});
mediator.dispatchEvent(new CustomEvent('once', {detail: 1}));
mediator.dispatchEvent(new CustomEvent('once', {detail: 2}));
assert(calls.filter(value => value === 1).length === 1 && !calls.includes(2), 'once option');

const controller = new AbortController();
mediator.addEventListener('abortable', listener, {signal: controller.signal});
controller.abort();
mediator.dispatchEvent(new CustomEvent('abortable', {detail: 3}));
assert(!calls.includes(3), 'abort signal');

const reentrantController = new AbortController();
let reentrantCalls = 0;
mediator.addEventListener('reentrant-abort', () => {
    reentrantCalls += 1;
}, {signal: reentrantController.signal});
reentrantController.signal.addEventListener('abort', () => {
    mediator.dispatchEvent(new Event('reentrant-abort'));
});
reentrantController.abort();
assert(reentrantCalls === 0, 're-entrant abort signal');

mediator.destroy();
mediator.dispatchEvent(new CustomEvent('data', {detail: 99}));
assert(!calls.includes(99), 'lifecycle cleanup');

globalThis.whiteLabelSmokePassed = true;
