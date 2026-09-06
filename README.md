# white-label-mediator

`white-label-mediator` is a small application event bus. It lets otherwise independent models, views, and routers exchange named messages without importing or calling one another directly.

The class extends Node.js-compatible `EventEmitter`, supplied for browsers by the `events` package. Standard methods such as `on`, `once`, `emit`, `removeListener`, and `removeAllListeners` are available.

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

## Development

```sh
npm ci
npm run build
npm test
npm run audit
```

The npm package publishes the compiled `dist` file and this README.
