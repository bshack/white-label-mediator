# Runtime compatibility

`white-label-mediator` uses the same web-standard event contract in browser and supported Node.js server applications.

The package does not require `window` or `document`. It relies on the global `EventTarget`, `CustomEvent`, `AbortController`, and `AbortSignal.any` implementations provided by modern runtimes, so there is no browser event-emitter shim or runtime dependency.

```js
import Mediator from 'white-label-mediator';

const mediator = new Mediator();
mediator.addEventListener('request:complete', event => {
    console.log(event.detail);
});
mediator.dispatchEvent(new CustomEvent('request:complete', {
    detail: {ok: true}
}));
```

Mediator owns lifecycle cleanup by explicitly tracking its native EventTarget registrations. It does not attach one shared lifecycle AbortSignal to every listener. Caller-provided AbortSignals are still supported and are tracked separately from mediator-wide `destroy()` cleanup.

For request-specific server events, scope a mediator to the request or another intentional lifetime. A singleton mediator is appropriate only for events that are intentionally application-wide; otherwise listeners and request data can cross request boundaries.

The regression suite explicitly executes the mediator with no `window` or `document` globals and verifies synchronous delivery, `once`, caller AbortSignal behavior, forced-GC teardown, and isolation between separately scoped mediator instances.
