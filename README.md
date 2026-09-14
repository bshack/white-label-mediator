# white-label-mediator

> Application events without application coupling.

`white-label-mediator` is a small Node-compatible event bus. It lets models, views, routers, and application modules exchange named messages without importing or calling one another directly.

**Responsibility:** move application intent between independent pieces. Nothing more.

## Why it exists

White Label favors explicit composition over framework-owned communication. Mediator gives cross-module events a clear boundary while leaving event names, payloads, state, rendering, routing, and lifecycle policy in the application.

Use it independently or compose it with the rest of White Label:

- [`white-label-model`](https://github.com/bshack/white-label-model) can relay namespaced state events through a mediator.
- [`white-label-router`](https://github.com/bshack/white-label-router) can listen for `router:navigate` intent.
- [`white-label-view`](https://github.com/bshack/white-label-view) can publish or consume application events without becoming coupled to other components.
- [`generator-white-label`](https://github.com/bshack/white-label) demonstrates the pieces together.

The package has no runtime dependency on the other White Label packages.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development
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

Subscribe where a module owns the reaction:

```js
function updateMenu({open}) {
    document.querySelector('#main-menu').hidden = !open;
}

// Keep the same callback reference so this subscription can be removed later.
mediator.on('menu:state', updateMenu);
```

Publish where the intent originates:

```js
// emit() returns true when at least one listener handled the event.
const delivered = mediator.emit('menu:state', {open: true});
```

The publisher does not know who is listening. Emitting an event with no subscribers is valid and has no effect. Delivery is synchronous and follows EventEmitter ordering.

## Public API

Mediator extends a Node.js-compatible `EventEmitter`, supplied in browsers by the `events` package.

| Method | Behavior | Returns |
| --- | --- | --- |
| `on(name, callback)` | Subscribe to a named application event. | The same mediator instance for chaining. |
| `once(name, callback)` | Subscribe for one delivery. | The same mediator instance for chaining. |
| `emit(name, ...payload)` | Synchronously publish an event. | `true` when the event had at least one listener; otherwise `false`. |
| `removeListener(name, callback)` | Release one owned subscription. | The same mediator instance for chaining. |
| `removeAllListeners(...)` | Use the standard EventEmitter cleanup contract. | The same mediator instance for chaining. |
| `listenerCount(name)` | Inspect current listener count. | The number of listeners registered for the event. |
| `initialize()` | Start the lifecycle. | The same mediator instance. |
| `destroy()` | Remove every listener owned by this mediator instance. | The same mediator instance after cleanup. |

## Lifecycle and ownership

Keep callback references so the component that subscribed can clean itself up:

```js
mediator.removeListener('menu:state', updateMenu);
```

Use `once()` for one-time intent:

```js
mediator.once('application:ready', () => {
    console.log('Ready');
});
```

`destroy()` is for the event bus itself leaving the application:

```js
mediator.initialize();
// ...application lifetime...
mediator.destroy();
```

Individual components should remove their own listeners instead of calling `destroy()` or broadly removing listeners they do not own.

## Router intent

Mediator and Router compose through an ordinary event contract:

```js
mediator.emit('router:navigate', {
    url: '/sign-in',
    reason: 'The session expired.'
});
```

Router remains responsible for navigation. Mediator only carries the message.

## Model events

Model can relay local events without importing Mediator:

```js
const session = new Model({authenticated: false});
session.name = 'session';
session.mediator = mediator;

mediator.on('model:session:update', state => {
    console.log(state.authenticated);
});
```

Any EventEmitter-compatible object can fill this role. The integration is intentionally structural rather than hard-wired.

## Typed events

Supply an event map for compile-time event names and payload tuples without adding runtime code:

```ts
type Events = {
    ready: [name: string];
    stopped: [];
};

const mediator = new Mediator<Events>();
mediator.emit('ready', 'Ada');
```

Event names and payloads remain application-defined unless the application supplies a generic event map.

## Extend it when the application has a vocabulary

```js
class ApplicationMediator extends Mediator {
    notifyError(error) {
        this.emit('application:error', {message: error.message});
    }
}

const applicationMediator = new ApplicationMediator();
applicationMediator.on('application:error', console.error);
applicationMediator.notifyError(new Error('Unable to load profile'));
```

Subclassing can provide application-specific vocabulary while preserving the same EventEmitter contract.

## Browser, server, and accessibility

Mediator has no DOM dependency and works through the same event contract in browser and Node.js environments. Because it does not render markup, accessibility and indexing remain responsibilities of the consuming application.

Mediated UI updates should preserve appropriate focus, announce meaningful asynchronous status when necessary, and avoid making important public content dependent on client-only events.

## Event compatibility

The test suite loads both Node's EventEmitter implementation and the npm browser implementation against the same contract. See [`docs/events-compatibility.md`](docs/events-compatibility.md) for covered behavior and limitations. These Node-based checks do not replace application-level browser integration testing.

## TypeScript

Implementation uses strict TypeScript and emits JavaScript, source maps, and declarations into `dist`.

```ts
const messages = new Mediator();
messages.on('greeting', (name: string) => console.log(`Hello, ${name}`));
messages.emit('greeting', 'Ada');
messages.destroy();
```

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