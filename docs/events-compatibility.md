# EventTarget contract and EventEmitter migration

## Runtime model

White Label Mediator v5 extends the platform `EventTarget` class directly. Payload-bearing application messages use `CustomEvent` and place data in `event.detail`. Mediator explicitly tracks the native listener registrations it owns so lifecycle cleanup does not depend on a shared internal `AbortSignal`.

There is no runtime event-emitter dependency in v5.

## Contract under test

The regression suite protects the behavior White Label depends on:

- synchronous native `dispatchEvent()` delivery;
- listener callbacks receiving the dispatched `CustomEvent` and original `detail` references;
- standard `once`, `capture`, `passive`, and caller-provided `signal` options;
- inherited and non-enumerable EventTarget option properties;
- standard duplicate-registration behavior;
- listener-object `handleEvent` lookup at dispatch time rather than registration time;
- listeners added during one dispatch being deferred until a later dispatch, while remaining visible to a nested dispatch;
- explicit `removeEventListener()` cleanup;
- lifecycle-wide cleanup through `destroy()`;
- forced-GC cleanup for mediator-owned listeners and listeners sharing a caller AbortSignal;
- re-registering listeners after `once` or signal-driven cleanup;
- reusing a mediator after `destroy()`;
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
- EventEmitter maximum-listener APIs;
- special unhandled `error` event throwing; and
- EventEmitter duplicate-registration/removal rules.

Use ordinary JavaScript exceptions for errors rather than relying on EventEmitter's special `error` event behavior.

Listener exceptions also follow EventTarget semantics. In particular, callers should not depend on a listener exception being rethrown directly from `dispatchEvent()` the way EventEmitter listener exceptions propagate from `emit()`.

## dispatchEvent return value

`EventTarget.dispatchEvent()` returns `false` when a cancelable event was canceled with `preventDefault()` and `true` otherwise. It does not indicate whether listeners were registered.

## Listener registration and dispatch normalization

Mediator normalizes the portions of the web EventTarget contract that have observable differences across supported runtimes.

Event names are converted to their DOM string value before ownership bookkeeping. Listener objects are registered through a thin function wrapper so `handleEvent` is looked up when the event is delivered rather than during Node registration. This avoids registration-time user-code execution from a getter and matches the callback-interface model used by browsers.

The DOM dispatch algorithm works from a clone of the listener list. Supported Node versions walk a live listener list, so a listener added while an event is already being delivered can otherwise run later in that same dispatch. Mediator tracks nested dispatches and suppresses only listeners that Node reaches in the same dispatch in which they were added. A nested dispatch gets its own snapshot boundary and can observe the new registration.

Capture is still delegated to the underlying EventTarget. Node documents capture primarily as registration identity rather than implementing a DOM tree's capture/bubble propagation phases; Mediator does not invent a DOM tree or reimplement event propagation.

## Lifecycle cleanup

Mediator records each native EventTarget registration by the event type's DOM string value, original callback, and capture mode. `destroy()` removes those owned registrations explicitly and leaves the mediator reusable.

One-time registrations are removed from both EventTarget and the ownership registry before their callback is invoked, preserving re-entrant `once` behavior. Explicit `removeEventListener()` calls update the same registry.

Caller-provided AbortSignals remain supported, but Mediator does not pass a shared lifecycle signal through every EventTarget registration. Registrations sharing one caller signal are grouped behind one private dependent signal created with `AbortSignal.any()`. Cleanup therefore follows actual signal abort state rather than ordinary, interceptable `'abort'` event delivery: application listeners cannot block cleanup with `stopImmediatePropagation()`, and manually dispatching an `'abort'` event does not cancel registrations.

The source signal is brand-validated and checked for an already-aborted state before a dependent signal is allocated. Duplicate registrations and registrations using an already-aborted signal therefore remain cheap no-ops while invalid signal values still throw.

This design avoids relying on Node's signal-backed EventTarget listener-retention path for mediator lifecycle cleanup. Regression coverage runs a child process with `--expose-gc` so cleanup remains verified even after forced garbage collection.

Mediator also uses the object form of `{capture}` for owned removals. Supported Node versions have differed in boolean capture-removal behavior when the same callback is registered in both capture modes; normalizing owned removal avoids exposing that runtime inconsistency through Mediator.

## Browser verification

`test/browser-smoke.js` can be bundled for a browser-aware build and exercises `CustomEvent`, `once`, caller AbortSignal cleanup, and `destroy()` without an EventEmitter polyfill.
