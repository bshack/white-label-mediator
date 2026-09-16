# white-label-mediator

> Application events without application coupling.

`white-label-mediator` is a lightweight TypeScript and JavaScript event bus for loosely coupled browser and Node.js applications. It is built directly on the web-standard `EventTarget`, `CustomEvent`, and `AbortSignal` APIs and has no runtime dependencies.

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

## Where it fits

Mediator fits best when modules genuinely need to exchange application intent without directly importing or calling one another. That can be a new TypeScript application, a progressively enhanced server-rendered page, an existing CMS/commerce frontend being modernized one feature at a time, or Node.js modules that want the same standards-based event contract.

Because it is an `EventTarget`, it can be introduced independently. A host application does not need to adopt White Label Model, View, Router, a component framework, or a new rendering system just to use the event boundary.

Use direct function calls when the caller already owns the callee and no decoupling boundary is needed. Mediator is intentionally not a durable queue, service bus, cross-process broker, state store, or global application API.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development.
- A runtime with `EventTarget`, `CustomEvent`, `AbortController`, and `AbortSignal.any`.
- npm, Yarn, and pnpm are supported for installation; see [`PACKAGE_MANAGERS.md`](PACKAGE_MANAGERS.md).

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
| `addEventListener(name, callback, options?)` | Subscribe using standard EventTarget options such as `once` and `signal`. Mediator tracks owned registrations for deterministic lifecycle cleanup. |
| `removeEventListener(name, callback, options?)` | Remove a subscription using standard EventTarget matching rules. |
| `dispatchEvent(event)` | Synchronously dispatch an `Event` or `CustomEvent`. |
| `initialize()` | Start the lifecycle and return the same mediator instance. |
| `destroy()` | Remove every listener owned by this mediator and return the same reusable instance. |

All other EventTarget behavior is native rather than reimplemented by this package.

## Lifecycle and ownership

Keep callback references when a component owns explicit cleanup:

```js
mediator.removeEventListener('menu:state', updateMenu);
```

Use native listener options for one-time or abortable intent:

```js
mediator.addEventListener('application:ready', handleReady, {once: true});

const controller = new AbortController();
mediator.addEventListener('application:change', handleChange, {signal: controller.signal});
controller.abort();
```

`destroy()` is for the mediator itself leaving an application lifecycle. Mediator records its registrations and removes them explicitly during destruction, so cleanup does not depend on a shared lifecycle signal and the instance can be reused if needed.

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

This composition is structural: applications can use Mediator with Model, with another EventTarget-compatible source, or by itself.

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

The generic map types listener registration. `dispatchEvent()` remains the native EventTarget method and accepts `Event`; applications construct `CustomEvent` payloads explicitly. TypeScript typing is not runtime payload validation.

## Extend it when the application has a vocabulary

Application-specific convenience methods can live in a subclass without changing the package contract:

```js
class ApplicationMediator extends Mediator {
    notifyError(error) {
        this.dispatchEvent(new CustomEvent('application:error', {
            detail: {message: error.message}
        }));
    }
}
```

This is the preferred place for domain vocabulary. The core package should remain generic rather than accumulating framework-, CMS-, commerce-, or cloud-specific methods.

## Browser, server, and accessibility

Mediator has no `window` or `document` dependency. It uses web-platform event primitives that are also global in the supported Node.js versions, so browser and server applications use the same contract.

Because Mediator does not render markup, accessibility and indexing remain responsibilities of the consuming application. Mediated UI updates should preserve appropriate focus, announce meaningful asynchronous status when necessary, and avoid making important public content dependent on client-only events.

## Serverless and function runtimes

Mediator can coordinate modules inside one serverless invocation without introducing a cloud-specific dependency. When listeners or payloads are request-specific, create the Mediator inside the request handler and call `destroy()` before that request-owned lifecycle ends.

Do not rely on a module-level Mediator for request isolation merely because the platform is called “serverless.” Warm function processes can handle many requests, so listeners and request data can survive into later invocations when a mutable instance is reused.

Mediator is an in-memory event bus. It does **not** replace SQS, SNS, EventBridge, Kafka, Pub/Sub, durable queues, retries, or communication between separate processes/function instances.

## Event contract

Mediator follows standard `EventTarget` listener registration, removal, cancellation, and `CustomEvent.detail` payload semantics. It tracks owned registrations so `destroy()` can clean them up deterministically while leaving the instance reusable. See [`docs/events-compatibility.md`](docs/events-compatibility.md) for detailed compatibility notes.

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

Coverage enforces 100% statements, branches, functions, and lines per implementation file. CI builds authored source, audits dependencies, packs the package, and verifies the public API across npm, Yarn, and pnpm.

Edit `src/*.ts` and regenerate `dist`; do not edit generated files directly.

## Design boundary

Mediator moves named events. It intentionally does not own state, rendering, routing, networking, persistence, durable messaging, or application behavior. Keeping that boundary visible is what lets modules communicate without turning the event bus into the application itself.
