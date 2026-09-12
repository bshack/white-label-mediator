import Mediator from '../dist/index.js';
const mediator = new Mediator();
mediator.on('ready', (value: string) => value.toUpperCase());
mediator.emit('ready', 'Ada');
mediator.initialize().destroy();
const typed = new Mediator<{ready: [name: string]; stopped: []}>();
const readyListener = (name: string) => name.toUpperCase();
typed.on('ready', readyListener);
typed.once('ready', readyListener);
typed.emit('ready', 'Ada');
typed.emit('stopped');
typed.removeListener('ready', readyListener);
// @ts-expect-error unknown event names are rejected for typed mediators.
typed.emit('missing');
// @ts-expect-error event payloads must match the declared tuple.
typed.emit('ready', 42);
