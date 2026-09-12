# white-label-mediator

`white-label-mediator` is a small application event bus. It lets otherwise independent models, views, routers, and application modules exchange named messages without importing or calling one another directly.

The class extends a Node.js-compatible `EventEmitter`, supplied for browsers by the `events` package. Standard methods such as `on`, `once`, `emit`, `removeListener`, and `removeAllListeners` are available.

The mediator has no DOM or generated HTML, so it does not independently affect WCAG conformance or indexing. Applications must ensure mediated UI updates preserve keyboard focus, announce meaningful asynchronous status, and do not make primary public content dependent on client-only events.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development

## Versioning policy

Backward compatibility is not maintained through obsolete distribution formats, aliases, deprecated signatures, or runtime shims. Breaking public API or supported-distribution changes are communicated with a Semantic Versioning major release and release notes outside this README.

## Install and import

```sh
npm install white-label-mediator
```

```js
import Mediator from 'white-label-mediator';

const mediator = new Mediator();
```

## Publish and subscribe

One part of the application subscribes to a named event:

```js
function updateMenu({open}) {
    document.querySelector('#main-menu').hidden = !open;
}

mediator.on('menu:state', updateMenu);
```

Another part publishes the event and its data:

```js
mediator.emit('menu:state', {open: true});
```

The publisher does not need to know which components are listening. Emitting an event with no subscribers is valid and has no effect.

## Remove subscriptions

Keep a reference to each callback so it can be removed during component teardown:

```js
mediator.removeListener('menu:state', updateMenu);
```

For a listener that should run only once:

```js
mediator.once('application:ready', () => {
    console.log('The application is ready.');
});
```

## Application lifecycle

`initialize()` is a lifecycle hook and returns the mediator. `destroy()` removes every listener registered on that mediator instance and returns it:

```js
mediator.initialize();

// When the event bus is no longer needed:
mediator.destroy();
```

Only call `destroy()` when the mediator itself is leaving the application. Individual views and modules should remove their own callbacks with `removeListener()` so they do not accidentally unsubscribe other components.

## Extend the mediator

```js
import Mediator from 'white-label-mediator';

class ApplicationMediator extends Mediator {
    notifyError(error) {
        this.emit('application:error', {message: error.message});
    }
}

const applicationMediator = new ApplicationMediator();
applicationMediator.on('application:error', console.error);
applicationMediator.notifyError(new Error('Unable to load profile'));
```

## Use with other White Label packages

`white-label-model` can publish namespaced change events through a mediator, and `white-label-router` can listen for `router:navigate`:

```js
mediator.emit('router:navigate', {
    url: '/sign-in',
    reason: 'The session expired.'
});
```

## Typed events

Supply an event map for compile-time event names and payloads without adding runtime code:

```ts
type Events = {
    ready: [name: string];
    stopped: [];
};

const mediator = new Mediator<Events>();
mediator.emit('ready', 'Ada');
```

The class preserves synchronous EventEmitter delivery order. Event names and payloads remain application-defined unless a generic event map is supplied.

## Event backend compatibility

The test suite loads both Node's EventEmitter implementation and the npm browser implementation against the same event contract. See `docs/events-compatibility.md` for the covered behavior and limitations. These Node-based checks do not replace real-browser integration testing.

## TypeScript

Implementation code uses strict TypeScript. Builds emit JavaScript, source maps with embedded source, and `.d.ts` declarations into `dist`.

```ts
import Mediator from 'white-label-mediator';

const messages = new Mediator();
messages.on('greeting', (name: string) => console.log(`Hello, ${name}`));
messages.emit('greeting', 'Ada');
messages.destroy();
```

The package uses the Node-compatible EventEmitter API and has no runtime dependency on White Label Model, View, or Router.

## Development and verification

Tests live in `test/*.test.js` and use Node's built-in `node:test` runner, strict assertions, and native mocks.

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

`npm test` builds the code, checks TypeScript consumer examples against emitted declarations, and runs the tests. `npm run coverage` enforces **100% statements, branches, functions, and lines for each implementation file**. CI runs the same gate and checks committed build output for drift.

Tests exercise the compiled JavaScript interface used by downstream callers. Coverage is an execution metric, not proof that all possible inputs or external integrations are correct.

Edit `src/*.ts`, then run the build; do not edit generated `dist` files directly. The npm package publishes the compiled distribution and this README.
