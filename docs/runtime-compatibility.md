# Runtime compatibility

`white-label-mediator` uses the same public class and EventEmitter-compatible API in browser and Node.js server applications.

The package does not require `window` or `document`. The `events` dependency supplies the same EventEmitter-style contract to browser bundles while Node applications use the package through the same `Mediator` import and methods.

```js
import Mediator from 'white-label-mediator';

const mediator = new Mediator();
mediator.on('request:complete', payload => {
    console.log(payload);
});
mediator.emit('request:complete', {ok: true});
```

For request-specific server events, scope a mediator to the request or another intentional lifetime. A singleton mediator is appropriate only for events that are intentionally application-wide; otherwise listeners and request data can cross request boundaries.

The regression suite explicitly executes the mediator with no `window` or `document` globals and verifies synchronous ordering, `once`, teardown, and isolation between separately scoped mediator instances.
