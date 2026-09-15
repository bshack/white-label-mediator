# EventTarget contract and EventEmitter migration

## Runtime model

White Label Mediator v5 extends the platform `EventTarget` class directly. Payload-bearing application messages use `CustomEvent` and place data in `event.detail`. Listener lifecycle uses `AbortController` and standard EventTarget options.

There is no runtime event-emitter dependency in v5.

## Contract under test

The regression suite protects the behavior White Label depends on:

- synchronous native `dispatchEvent()` delivery;
- listener callbacks receiving the dispatched `CustomEvent` and original `detail` references;
- standard `once` and `signal` listener options;
- standard duplicate-registration behavior;
- explicit `removeEventListener()` cleanup;
- lifecycle-wide cleanup through `destroy()`;
- combination of a caller-provided AbortSignal with the mediator lifecycle signal;
- reusing a mediator after `destroy()` creates a fresh lifecycle scope;
- native `dispatchEvent()` cancellation return semantics; and
- the same contract in supported Node runtimes without `window` or `document`.

## Intentional v4 breaking changes

Version 4 exposed Node EventEmitter semantics through the `events` package. Version 5 removes that compatibility layer instead of reimplementing Node behavior on top of EventTarget.

Applications should migrate as follows:

```js
// v4
mediator.on('profile:loaded', profile => render(profile));
mediator.emit('profile:loaded', profile);

// v5
mediator.addEventListener('profile:loaded', event => render(event.detail));
mediator.dispatchEvent(new CustomEvent('profile:loaded', {detail: profile}));
```

The following EventEmitter-specific behaviors are intentionally not reproduced:

- symbol event names;
- `addListener`, `on`, `once`, `emit`, `off`, and `removeListener` aliases;
- `prependListener` and `prependOnceListener`;
- `eventNames`, `listeners`, `rawListeners`, and `listenerCount` inspection;
- `newListener` and `removeListener` meta-events;
- EventEmitter maximum-listener warnings;
- special unhandled `error` event throwing; and
- EventEmitter duplicate-registration/removal rules.

Use ordinary JavaScript exceptions for errors rather than relying on EventEmitter's special `error` event behavior.

## dispatchEvent return value

`EventTarget.dispatchEvent()` returns `false` when a cancelable event was canceled with `preventDefault()` and `true` otherwise. It does not indicate whether listeners were registered.

## Lifecycle cleanup

Listeners registered with `mediator.addEventListener()` are automatically combined with an internal lifecycle signal. `destroy()` aborts that signal and creates a fresh controller, which removes all mediator-scoped listeners while keeping the instance reusable.

When a caller also passes `{signal}`, Mediator combines it with the lifecycle signal through `AbortSignal.any()`. Either abort releases the listener.

## Browser verification

`test/browser-smoke.js` can be bundled for a browser-aware build and exercises `CustomEvent`, `once`, AbortSignal cleanup, and `destroy()` without an EventEmitter polyfill.
