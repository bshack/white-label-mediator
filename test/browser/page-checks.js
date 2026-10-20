// Runs inside Chromium. test/browser/chromium.test.js bundles this file with the
// built package and reads `window.mediatorBrowserResults`: one entry per check,
// with `error` set when that check failed.

// Count AbortSignal.any() calls before the package is used, so the dependent
// signal cache can be checked against the browser's own AbortSignal.
const nativeAny = AbortSignal.any;
let anyCalls = 0;
AbortSignal.any = function(signals) {
    anyCalls += 1;
    return Reflect.apply(nativeAny, this, [signals]);
};

const Mediator = require('../..');

function assert(value, message) {
    if (!value) {
        throw new Error(message);
    }
}

function assertSame(actual, expected, message) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    assert(actualJson === expectedJson, `${message}: expected ${expectedJson}, got ${actualJson}`);
}

const checks = {
    'existing smoke script'() {
        require('../browser-smoke.js');
        assert(globalThis.whiteLabelSmokePassed === true, 'smoke script did not finish');
    },

    'EventTarget subclassing'() {
        class AppEvents extends Mediator {
            ready(detail) {
                return this.dispatchEvent(new CustomEvent('ready', {detail}));
            }
        }
        const events = new AppEvents();
        assert(events instanceof EventTarget, 'subclass is not an EventTarget');
        assert(events instanceof Mediator, 'subclass is not a Mediator');
        let target;
        events.addEventListener('ready', event => {
            target = event.target;
        });
        assert(events.ready(1) === true, 'dispatch result');
        assert(target === events, 'event.target is the subclass instance');
    },

    'CustomEvent detail'() {
        const mediator = new Mediator();
        const detail = {id: 7};
        let received;
        mediator.addEventListener('data', event => {
            received = event;
        });
        mediator.dispatchEvent(new CustomEvent('data', {detail}));
        assert(received instanceof CustomEvent, 'listener received a CustomEvent');
        assert(received.detail === detail, 'detail is delivered by reference');
    },

    'once'() {
        const mediator = new Mediator();
        const calls = [];
        const listener = event => calls.push(event.detail);
        mediator.addEventListener('once', listener, {once: true});
        mediator.dispatchEvent(new CustomEvent('once', {detail: 1}));
        mediator.dispatchEvent(new CustomEvent('once', {detail: 2}));
        mediator.addEventListener('once', listener, {once: true});
        mediator.dispatchEvent(new CustomEvent('once', {detail: 3}));
        assertSame(calls, [1, 3], 'once listener calls');
    },

    'capture matching'() {
        const mediator = new Mediator();
        const calls = [];
        const listener = event => calls.push(event.eventPhase);
        mediator.addEventListener('phase', listener, true);
        mediator.addEventListener('phase', listener, {capture: false});
        mediator.dispatchEvent(new Event('phase'));
        assert(calls.length === 2, 'one callback in each capture mode is two listeners');

        mediator.removeEventListener('phase', listener, {capture: true});
        mediator.dispatchEvent(new Event('phase'));
        assert(calls.length === 3, 'removing with capture leaves the bubble listener');

        mediator.removeEventListener('phase', listener, true);
        mediator.dispatchEvent(new Event('phase'));
        assert(calls.length === 4, 'a capture-mode removal does not match the bubble listener');

        mediator.removeEventListener('phase', listener);
        mediator.dispatchEvent(new Event('phase'));
        assert(calls.length === 4, 'bubble-mode removal matches the bubble listener');
    },

    'passive'() {
        const mediator = new Mediator();
        let insidePassive;
        mediator.addEventListener('scrollish', event => {
            event.preventDefault();
            insidePassive = event.defaultPrevented;
        }, {passive: true});
        const passiveEvent = new Event('scrollish', {cancelable: true});
        assert(mediator.dispatchEvent(passiveEvent) === true, 'passive preventDefault must not cancel');
        assert(passiveEvent.defaultPrevented === false && insidePassive === false, 'passive event not defaultPrevented');

        const active = new Mediator();
        active.addEventListener('scrollish', event => event.preventDefault());
        const activeEvent = new Event('scrollish', {cancelable: true});
        assert(active.dispatchEvent(activeEvent) === false, 'non-passive preventDefault cancels');
        assert(activeEvent.defaultPrevented === true, 'non-passive event is defaultPrevented');
    },

    'AbortSignal removal and AbortSignal.any caching'() {
        const first = new Mediator();
        const second = new Mediator();
        const controller = new AbortController();
        const calls = [];
        const before = anyCalls;
        first.addEventListener('a', () => calls.push('first-a'), {signal: controller.signal});
        first.addEventListener('b', () => calls.push('first-b'), {signal: controller.signal});
        second.addEventListener('a', () => calls.push('second-a'), {signal: controller.signal});
        const repeated = () => calls.push('repeated');
        for (let index = 0; index < 100; index += 1) {
            first.addEventListener('c', repeated, {signal: controller.signal});
            first.removeEventListener('c', repeated);
        }
        assert(anyCalls - before === 1, `one AbortSignal.any() per caller signal, got ${anyCalls - before}`);

        const other = new AbortController();
        first.addEventListener('d', () => calls.push('other'), {signal: other.signal});
        assert(anyCalls - before === 2, 'a different caller signal gets its own dependent signal');

        first.dispatchEvent(new Event('a'));
        first.dispatchEvent(new Event('b'));
        second.dispatchEvent(new Event('a'));
        controller.abort();
        first.dispatchEvent(new Event('a'));
        first.dispatchEvent(new Event('b'));
        second.dispatchEvent(new Event('a'));
        first.dispatchEvent(new Event('d'));
        assertSame(calls, ['first-a', 'first-b', 'second-a', 'other'], 'abort removes only that signal\'s listeners');

        const aborted = AbortSignal.abort();
        first.addEventListener('e', () => calls.push('pre-aborted'), {signal: aborted});
        first.dispatchEvent(new Event('e'));
        assert(!calls.includes('pre-aborted'), 'an already-aborted signal adds nothing');
    },

    'listener errors reach window error without stopping later listeners'() {
        const mediator = new Mediator();
        const calls = [];
        const reported = [];
        const onceError = new Error('once failure');
        const objectError = new Error('object failure');
        const onError = event => {
            reported.push(event.error === onceError ? 'once' : event.error === objectError ? 'object' : String(event.error));
            // The errors are intentional; keep them out of the console.
            event.preventDefault();
        };
        window.addEventListener('error', onError);
        try {
            mediator.addEventListener('work', () => {
                calls.push('once');
                throw onceError;
            }, {once: true});
            mediator.addEventListener('work', {
                handleEvent() {
                    calls.push('object');
                    throw objectError;
                }
            });
            mediator.addEventListener('work', () => calls.push('last'));
            const results = [mediator.dispatchEvent(new CustomEvent('work', {cancelable: true}))];
            calls.push('returned');
            results.push(mediator.dispatchEvent(new CustomEvent('work')));
            assertSame(results, [true, true], 'dispatch results');
            assertSame(calls, ['once', 'object', 'last', 'returned', 'object', 'last'], 'listener order');
            // Browsers report listener exceptions synchronously, during dispatch.
            assertSame(reported, ['once', 'object', 'object'], 'window error reports');
        } finally {
            window.removeEventListener('error', onError);
        }
    },

    'destroy()'() {
        const mediator = new Mediator();
        const controller = new AbortController();
        const calls = [];
        mediator.addEventListener('x', () => calls.push('plain'));
        mediator.addEventListener('x', () => calls.push('capture'), true);
        mediator.addEventListener('x', {handleEvent: () => calls.push('object')});
        mediator.addEventListener('x', () => calls.push('signal'), {signal: controller.signal});
        mediator.addEventListener('x', () => calls.push('once'), {once: true});
        assert(mediator.destroy() === mediator, 'destroy() returns the mediator');
        mediator.dispatchEvent(new Event('x'));
        assertSame(calls, [], 'destroy() removes every owned listener');

        mediator.addEventListener('x', () => calls.push('after'));
        mediator.dispatchEvent(new Event('x'));
        assertSame(calls, ['after'], 'mediator is reusable after destroy()');
        controller.abort();
    }
};

window.mediatorBrowserResults = Object.entries(checks).map(([name, check]) => {
    try {
        check();
        return {name};
    } catch (error) {
        return {name, error: String(error && error.stack || error)};
    }
});
