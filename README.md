# white-label-mediator

`white-label-mediator` is a small application event bus. It lets otherwise independent models, views, and routers exchange named messages without importing or calling one another directly.

The class extends Node.js-compatible `EventEmitter`, supplied for browsers by the `events` package. Standard methods such as `on`, `once`, `emit`, `removeListener`, and `removeAllListeners` are available.

The mediator has no DOM or generated HTML, so it does not independently affect WCAG conformance or indexing. Applications must ensure mediated UI updates preserve keyboard focus, announce meaningful asynchronous status, and do not make primary public content dependent on client-only events.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development

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

The publisher does not need to know which components are listening. Emitting an event with no subscribers is valid and simply has no effect.

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

// Later, when the entire event bus is no longer needed:
mediator.destroy();
```

Only call `destroy()` when the mediator itself is leaving the application. Individual views should remove their own callbacks with `removeListener()` so they do not accidentally unsubscribe other components.

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

## Event backend compatibility

Node uses its built-in EventEmitter. Browser-aware bundlers select an EventEmitter3 compatibility adapter through the package's `browser` mapping. Tests compare Node, the previous npm emitter, and the adapter. See [the compatibility contract and browser verification instructions](https://github.com/bshack/white-label-mediator/blob/master/docs/events-compatibility.md) for supported behavior, maintenance responsibilities, and limitations.

## Development

Tests live in `test/*.test.js` and use Node's built-in `node:test` runner, strict assertions, and native mocks. Run `npm test` for the build, consumer type checks, and full suite; `npm run coverage` retains the existing c8 coverage gate. After building, run `node --test test/mediator.test.js` for the converted suite alone.

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run coverage
npm run audit
```

The npm package publishes the compiled `dist` file and this README.

## TypeScript development and version 3.0.0 migration

Implementation code now uses strict TypeScript. Builds emit JavaScript, source maps with embedded source, and `.d.ts` declarations into `dist`. JavaScript callers can still use the package without compiling TypeScript themselves. JSDoc comments describe parameters, return values, lifecycle behavior, and validation at the implementation, and are retained in declarations.

```ts
import Mediator from 'white-label-mediator';

const messages = new Mediator();
messages.on('greeting', (name: string) => console.log(`Hello, ${name}`));
messages.emit('greeting', 'Ada');
messages.destroy();
```

The class retains the Node EventEmitter API and its synchronous delivery order. Event names and payloads remain application-defined; TypeScript does not enforce a schema between separate `on` and `emit` calls.

This is a major release because the distribution is now CommonJS emitted by TypeScript, replacing the previous UMD wrapper. CommonJS `require` and the documented ESM imports remain supported. Direct AMD loading or browser script tags that depended on UMD globals must migrate to a browser bundler. Edit `src/*.ts`, then run `npm run build`; do not edit generated `dist` files. The obsolete Babel build dependencies have been removed.

### Verification and coverage

## Tested compatibility

Version 3.1 is tested with model 3.x, view 4.x, and router 4.x. It retains the standard synchronous EventEmitter behavior.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run coverage
npm pack --dry-run
```

`npm test` builds the code, checks TypeScript consumer examples against the emitted declarations, and runs the tests. `npm run coverage` additionally enforces **100% statements, branches, functions, and lines for each implementation file**. Unexecuted implementation files count toward the result; declaration-only files contain no executable code and are excluded. Reports are written to `coverage`, including `lcov.info` for coverage viewers. CI runs the same gate and checks committed build output for drift.

Tests exercise the compiled JavaScript interface used by downstream callers. Coverage is an execution metric, not proof that all possible inputs or external integrations are correct.

To undo this migration, revert its commit and run `npm ci` from the restored lockfile. No npm release, database migration, or production deployment is performed by these development changes.
### Typed events

Supply an event map for compile-time event names and payloads without adding runtime code:

```ts
type Events = {ready: [name: string]; stopped: []};
const mediator = new Mediator<Events>();
mediator.emit('ready', 'Ada');
```
