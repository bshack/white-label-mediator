# white-label-mediator

> Application events without application coupling.

`white-label-mediator` is a lightweight TypeScript and JavaScript event bus for loosely coupled browser and Node.js applications. Version 5 is built directly on the web-standard `EventTarget`, `CustomEvent`, and `AbortController` APIs and has no runtime dependencies.

[Documentation](https://whitelabeljs.org/docs/mediator/) · [API reference](https://whitelabeljs.org/api/#mediator) · [Demo site](https://whitelabeljs.org/)

**Responsibility:** move application intent between independent pieces. Nothing more.

## Why it exists

White Label favors explicit composition over framework-owned communication. Mediator gives cross-module events a clear boundary while leaving event names, payloads, state, rendering, routing, and lifecycle policy in the application.

Use it independently or compose it with the rest of White Label:

- [`white-label-model`](https://github.com/bshack/white-label-model) can relay namespaced state events through a mediator.
- [`white-label-router`](https://github.com/bshack/white-label-router) can listen for `router:navigate` intent.
- [`white-label-view`](https://github.com/bshack/white-label-view) can publish or consume application events without becoming coupled to other components.
- [`generator-white-label`](https://github.com/bshack/white-label) demonstrates the pieces together.

The package has no runtime dependencies.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development
- A runtime with `EventTarget`, `CustomEvent`, `AbortController`, and `AbortSignal.any`
- npm, Yarn, and pnpm are supported for installation; see [`PACKAGE_MANAGERS.md`](PACKAGE_MANAGERS.md)

## Install

```sh
npm install white-label-mediator
# or: yarn add white-label-mediator
# or: pnpm add white-label-mediator
```

```js
import Mediator from 'white-label-mediator';

const mediator = new Mediator();
```

## Publish and subscribe

Subscribe with the standard `EventTarget` API. Application payloads live in `CustomEvent.detail`:

```js
function updateMenu(event) {
    document.querySelector('#main-menu').hidden = !event.detail.open;
}

mediator.addEventListener('menu:state', updateMenu);
```

Publish with a standard `CustomEvent`:

```js
mediator.dispatchEvent(new CustomEvent('menu:state', {
    detail: {open: true}
}));
```

Delivery is synchronous. `dispatchEvent()` uses native EventTarget return semantics: it returns `false` only when a cancelable event is canceled with `preventDefault()`; it is not a listener-count signal.

## Public API

Mediator extends the platform `EventTarget` class.

| Method | Behavior |
| --- | --- |
| `addEventListener(name, callback, options?)` | Subscribe using standard EventTarget options such as `once` and `signal`. Mediator automatically adds its lifecycle signal. |
| `removeEventListener(name, callback, options?)` | Remove a subscription using standard EventTarget matching rules. |
| `dispatchEvent(event)` | Synchronously dispatch an `Event` or `CustomEvent`. |
| `initialize()` | Start the lifecycle and return the same mediator instance. |
| `destroy()` | Abort all listeners registered through this mediator, reset the lifecycle scope, and return the same instance. |

All other EventTarget behavior is native rather than reimplemented by this package.

## Lifecycle and ownership

Keep callback references when a component owns explicit cleanup:

```js
mediator.removeEventListener('menu:state', updateMenu);
```

Use the standard `once` option for one-time intent:

```js
mediator.addEventListener('application:ready', () => {
    console.log('Ready');
}, {once: true});
```

`destroy()` is for the mediator itself leaving an application lifecycle. Internally, listener registration is scoped with `AbortController`; destruction aborts that scope and creates a fresh one so the same mediator can be reused if needed.

```js
mediator.initialize();
// ...application lifetime...
mediator.destroy();
```

A caller-provided `AbortSignal` is combined with the mediator lifecycle signal, so either signal can release the listener.

## Router intent

Mediator and Router compose through an ordinary web event:

```js
mediator.dispatchEvent(new CustomEvent('router:navigate', {
    detail: {
        url: '/sign-in',
        reason: 'The session expired.'
    }
}));
```

Router remains responsible for navigation. Mediator only carries the event.

## Model events

Model can relay local state changes to any mediator-compatible EventTarget without importing Mediator directly:

```js
const session = new Model({authenticated: false});
session.name = 'session';
session.mediator = mediator;

mediator.addEventListener('model:session:update', event => {
    console.log(event.detail.authenticated);
});
```

## Typed event details

Supply an event-detail map to type listener event names and `CustomEvent.detail` without adding runtime code:

```ts
type Events = {
    ready: {name: string};
    stopped: undefined;
};

const mediator = new Mediator<Events>();

mediator.addEventListener('ready', event => {
    console.log(event.detail.name);
});

mediator.dispatchEvent(new CustomEvent('ready', {
    detail: {name: 'Ada'}
}));
```

The generic map types listener registration. `dispatchEvent()` remains the native EventTarget method and accepts `Event`; applications construct `CustomEvent` payloads explicitly.

## Extend it when the application has a vocabulary

```js
class ApplicationMediator extends Mediator {
    notifyError(error) {
        this.dispatchEvent(new CustomEvent('application:error', {
            detail: {message: error.message}
        }));
    }
}

const applicationMediator = new ApplicationMediator();
applicationMediator.addEventListener('application:error', event => {
    console.error(event.detail);
});
```

## Browser, server, and accessibility

Mediator has no `window` or `document` dependency. It uses web-platform event primitives that are also global in the supported Node.js versions, so browser and server applications use the same contract.

Because Mediator does not render markup, accessibility and indexing remain responsibilities of the consuming application. Mediated UI updates should preserve appropriate focus, announce meaningful asynchronous status when necessary, and avoid making important public content dependent on client-only events.

## Serverless and function runtimes

Mediator can coordinate modules inside one serverless invocation without introducing a cloud-specific dependency. When listeners or payloads are request-specific, create the Mediator inside the request handler and call `destroy()` before that request-owned lifecycle ends.

Do not rely on a module-level Mediator for request isolation merely because the platform is called “serverless.” Function processes can stay warm and handle many requests, so listeners and request data can survive into later invocations when the same mutable instance is reused.

Mediator is an in-memory event bus. It does **not** replace SQS, SNS, EventBridge, Kafka, Pub/Sub, durable queues, retries, or communication between separate function instances.

## Migrating from v4

Version 5 intentionally drops the Node `EventEmitter` compatibility API. The direct equivalents are:

| v4 | v5 |
| --- | --- |
| `on(name, listener)` | `addEventListener(name, listener)` |
| `once(name, listener)` | `addEventListener(name, listener, {once: true})` |
| `emit(name, payload)` | `dispatchEvent(new CustomEvent(name, {detail: payload}))` |
| `removeListener(name, listener)` | `removeEventListener(name, listener)` |
| `removeAllListeners()` | `destroy()` for mediator-owned lifecycle cleanup |

EventTarget deliberately differs from EventEmitter in duplicate registration, symbol event names, cancellation/return semantics, error events, listener inspection, prepend methods, and meta-events. See [`docs/events-compatibility.md`](docs/events-compatibility.md).

## TypeScript

Implementation uses strict TypeScript and emits JavaScript, source maps, and declarations into `dist`.

## Development

```sh
npm ci --ignore-scripts
npm run build
npm run lint
npm run typecheck
npm test
npm run coverage
npm run audit
npm pack --dry-run
```

Coverage enforces 100% statements, branches, functions, and lines per implementation file. CI builds authored source, uploads generated artifacts for inspection, audits dependencies, packs the package, and verifies the packed public API across npm, Yarn, and pnpm.

Edit `src/*.ts` and regenerate `dist`; do not edit generated files directly.

## Design boundary

Mediator moves named events. It intentionally does not own state, rendering, routing, networking, persistence, or application behavior. Keeping that boundary visible is what lets modules communicate without turning the event bus into the application itself.
